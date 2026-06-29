"use client";

// Parent north-star control (#1 + #10). The parent chooses the *kind* of
// end-goal they'd love for their child, asks Sage for matched real-world
// targets (driven by the student's interests), and approves one. The framing
// keeps the parent feeling they're guiding their child — the AI maps the route,
// the family picks the destination.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Deliverable } from "@/lib/db/schema";
import type { MatchedDeliverable } from "@/lib/deliverables/match";
import { DeliverableCard } from "@/components/DeliverableCard";

const PREFS: { key: string; label: string }[] = [
  { key: "research", label: "A research paper" },
  { key: "competition", label: "A competition result" },
  { key: "portfolio", label: "A creative portfolio" },
  { key: "venture", label: "A small venture" },
  { key: "award", label: "An award or honor" },
  { key: "open", label: "Let Sage suggest" },
];

export function ParentTargetControl({
  studentId,
  studentName,
  initialPref,
  activeTarget,
}: {
  studentId: string;
  studentName: string;
  initialPref: string | null;
  activeTarget: { deliverable: Deliverable; rationale: string | null; approved: boolean } | null;
}) {
  const router = useRouter();
  const [pref, setPref] = useState<string>(initialPref ?? "open");
  const [suggestions, setSuggestions] = useState<MatchedDeliverable[] | null>(null);
  const [changing, setChanging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/target", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, ...body }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Request failed");
    return res.json();
  }

  async function choosePref(key: string) {
    setPref(key);
    setSuggestions(null);
    void post({ action: "set_pref", endGoalPref: key }).catch(() => {});
  }

  async function findTargets() {
    setLoading(true);
    try {
      const { matches } = await post({ action: "suggest", endGoalPref: pref });
      setSuggestions(matches as MatchedDeliverable[]);
    } finally {
      setLoading(false);
    }
  }

  async function approve(m: MatchedDeliverable) {
    setBusyId(m.deliverable.id);
    try {
      await post({
        action: "approve",
        deliverableId: m.deliverable.id,
        rationale: m.reasons.join("; "),
      });
      setChanging(false);
      setSuggestions(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  // Settled view: an approved target exists and we're not changing it.
  if (activeTarget && !changing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-0.5">
          <span className="eyebrow">{studentName}&apos;s north star</span>
          <button
            onClick={() => setChanging(true)}
            className="text-[12px] font-semibold text-passionfruit-accentInk hover:underline"
          >
            Change goal →
          </button>
        </div>
        <DeliverableCard
          deliverable={activeTarget.deliverable}
          rationale={activeTarget.rationale}
          approved={activeTarget.approved}
        />
      </div>
    );
  }

  return (
    <div className="card-sheet p-4">
      <div className="eyebrow">You set the destination</div>
      <p className="mt-1 text-[13px] leading-relaxed text-passionfruit-muted">
        Choose the kind of end-goal you&apos;d love for {studentName}. Sage maps the route from{" "}
        {studentName}&apos;s own interests — you stay the guide.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PREFS.map((p) => (
          <button
            key={p.key}
            onClick={() => choosePref(p.key)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
              pref === p.key
                ? "bg-passionfruit-accent text-white"
                : "bg-passionfruit-sunk text-passionfruit-muted hover:brightness-95"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button onClick={findTargets} disabled={loading} className="btn-primary mt-3.5 text-xs">
        {loading ? "Finding real targets…" : `Find ${studentName}'s targets →`}
      </button>

      {suggestions && (
        <div className="mt-4 flex flex-col gap-3">
          {suggestions.length === 0 && (
            <p className="text-[13px] text-passionfruit-faint">
              No clean match yet — try a different goal or finish intake first.
            </p>
          )}
          {suggestions.map((m) => (
            <div key={m.deliverable.id}>
              <DeliverableCard
                deliverable={m.deliverable}
                rationale={m.reasons.join("; ")}
                caution={m.caution}
              />
              {m.deliverable.prestigeTier !== "flag" && (
                <button
                  onClick={() => approve(m)}
                  disabled={busyId !== null}
                  className="btn-soft mt-1.5 w-full text-xs"
                >
                  {busyId === m.deliverable.id ? "Setting as goal…" : `Make this ${studentName}'s goal`}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {changing && activeTarget && (
        <button
          onClick={() => setChanging(false)}
          className="mt-3 text-[12px] font-semibold text-passionfruit-muted hover:underline"
        >
          ← Keep current goal
        </button>
      )}
    </div>
  );
}
