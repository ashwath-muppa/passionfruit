"use client";

import { useState } from "react";
import type { Milestone } from "@/lib/db/schema";
import { markerState, milestoneIcon, type MarkerState } from "@/lib/ui";

type Status = "todo" | "doing" | "done";

// Vertical milestone timeline (DESIGN.md §7b). Markers cycle status on click:
// to-do → doing → done. Marker visual state is derived from status + position.
export function MilestoneList({ initial }: { initial: Milestone[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function cycle(m: Milestone) {
    const next: Status = m.status === "todo" ? "doing" : m.status === "doing" ? "done" : "todo";
    setBusy(m.id);
    setItems((prev) => prev.map((it) => (it.id === m.id ? { ...it, status: next } : it)));
    try {
      const res = await fetch("/api/milestones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId: m.id, status: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems((prev) => prev.map((it) => (it.id === m.id ? { ...it, status: m.status } : it)));
    } finally {
      setBusy(null);
    }
  }

  const total = items.length;
  const currentIndex = (() => {
    const idx = items.findIndex((m) => m.status !== "done");
    return idx === -1 ? total - 1 : idx;
  })();

  return (
    <div className="relative pt-0.5">
      {/* rail */}
      <div className="absolute bottom-6 left-[15px] top-2 w-0.5 bg-passionfruit-lineSoft" />
      <ol className="flex flex-col gap-3.5">
        {items.map((m, i) => {
          const state: MarkerState = markerState(m, i, currentIndex, total, true);
          return (
            <li key={m.id} className="flex items-start gap-3.5">
              <Marker
                state={state}
                icon={milestoneIcon(m, state === "final")}
                busy={busy === m.id}
                onClick={() => cycle(m)}
              />
              {state === "current" ? (
                <div className="-mt-1 flex-1 rounded-2xl border border-passionfruit-accentLine bg-passionfruit-card p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[.6px] text-passionfruit-accent">
                    This week
                  </div>
                  <div className="mt-0.5 text-[14px] font-bold text-passionfruit-ink">{m.title}</div>
                  {(m.coach || m.detail) && (
                    <p className="mt-1 text-[12px] leading-snug text-passionfruit-muted">
                      {m.coach ?? m.detail}
                    </p>
                  )}
                </div>
              ) : (
                <div className="pt-1.5">
                  <div
                    className={`text-[14px] font-bold ${
                      state === "upcoming" ? "text-[#B6A899]" : "text-passionfruit-ink"
                    }`}
                  >
                    {m.title}
                  </div>
                  <div className="text-[12px] text-passionfruit-faint">
                    {state === "done"
                      ? `${m.source ? `${m.source} · ` : ""}done`
                      : state === "final"
                        ? "final deliverable"
                        : m.dueHint ?? "upcoming"}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Marker({
  state,
  icon,
  busy,
  onClick,
}: {
  state: MarkerState;
  icon: string;
  busy: boolean;
  onClick: () => void;
}) {
  const cls = "relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-[9px] text-[15px] transition disabled:opacity-60";
  let style: React.CSSProperties = {};
  let content: React.ReactNode = null;
  if (state === "done") {
    style = { background: "#E8694A", color: "#fff" };
    content = "✓";
  } else if (state === "current") {
    style = { background: "#fff", border: "2.5px solid #E8694A" };
    content = <span className="animate-pf-float" />;
  } else if (state === "final") {
    style = { background: "#F2B23E" };
    content = icon;
  } else {
    style = { background: "#F4EDE2" };
  }
  return (
    <button
      type="button"
      className={`${cls} ${state === "current" ? "animate-pf-float" : ""}`}
      style={style}
      disabled={busy}
      onClick={onClick}
      title="Click to cycle: to-do → doing → done"
      aria-label="Toggle milestone status"
    >
      {content}
    </button>
  );
}
