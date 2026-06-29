"use client";

// Mentor checkpoints (#9) — the human half, on the parent dashboard. A real
// TJ / top-college mentor checks in on the student's work, but mentor time is
// CAPPED (the "sacred cap"): the parent sees exactly how many checkpoints are
// left this term, and once they're out the request is disabled and replaced by
// a warm Plus-tier upsell — never an error. The credibility comes from the
// human detail: a named mentor with a real credential ("TJHSST '26").

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Checkpoint, Mentor } from "@/lib/db/schema";

interface Usage {
  used: number;
  cap: number;
  remaining: number;
  tier: string;
  term: string;
}

const STATUS_PILL: Record<Checkpoint["status"], { label: string; cls: string }> = {
  requested: { label: "Requested", cls: "bg-passionfruit-sunk text-passionfruit-muted" },
  scheduled: { label: "Scheduled", cls: "bg-passionfruit-wash text-passionfruit-accentInk" },
  completed: { label: "Completed", cls: "bg-[#E4F0E4] text-[#3F7A45]" },
  cancelled: { label: "Cancelled", cls: "bg-passionfruit-sunk text-passionfruit-faint" },
};

function termLabel(term: string): string {
  const [year, season] = term.split("-");
  if (!year || !season) return term;
  return `${season.charAt(0).toUpperCase()}${season.slice(1)} ${year}`;
}

function mentorLine(m: Mentor): string {
  return [m.name, m.field, m.credential].filter(Boolean).join(" · ");
}

function whenLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CheckpointBooking({
  studentId,
  studentName,
  mentors,
  checkpoints,
  usage,
}: {
  studentId: string;
  studentName: string;
  mentors: Mentor[];
  checkpoints: Checkpoint[];
  usage: Usage;
}) {
  const router = useRouter();
  const [mentorId, setMentorId] = useState<string>(mentors[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The cap is the source of truth — at the cap, requesting is closed and the
  // upsell takes the button's place. We use the server `usage` directly so a
  // router.refresh() reflects the real state.
  const capped = usage.remaining <= 0;
  const mentorById = new Map(mentors.map((m) => [m.id, m]));

  async function requestCheckpoint() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/checkpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          studentId,
          mentorId: mentorId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Could not request a checkpoint");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function cancel(checkpointId: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/checkpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", studentId, checkpointId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Could not cancel");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  // Only checkpoints that still hold a slot are shown as live; cancelled drop off.
  const liveCheckpoints = checkpoints.filter((c) => c.status !== "cancelled");

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-[16px] font-semibold text-passionfruit-ink">
          Mentor checkpoints
        </h3>
        <span className="eyebrow">{termLabel(usage.term)}</span>
      </div>
      <p className="mt-1 text-[12px] leading-[1.5] text-passionfruit-muted">
        A real TJ / top-college mentor checks in on {studentName}&apos;s work — to keep them
        accountable, raise the bar, and unblock what&apos;s stuck.
      </p>

      {/* Cap usage — clear and honest. The sacred cap, made visible. */}
      <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-passionfruit-sunk px-3 py-2.5">
        <div className="flex flex-none gap-1" aria-hidden>
          {Array.from({ length: usage.cap }).map((_, i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: i < usage.used ? "#E8694A" : "#E0D3C2" }}
            />
          ))}
        </div>
        <span className="text-[12px] font-semibold text-passionfruit-body">
          {usage.used} of {usage.cap} this term
        </span>
        <span className="ml-auto text-[11px] capitalize text-passionfruit-faint">
          {usage.tier} plan
        </span>
      </div>

      {/* Existing checkpoints */}
      {liveCheckpoints.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {liveCheckpoints.map((c) => {
            const mentor = c.mentorId ? mentorById.get(c.mentorId) ?? null : null;
            const pill = STATUS_PILL[c.status];
            const when = whenLabel(c.scheduledAt ? c.scheduledAt.toString() : null);
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-passionfruit-line bg-passionfruit-card px-3 py-2"
              >
                <span className="text-[13px] font-semibold text-passionfruit-ink">
                  {mentor ? mentor.name : "Mentor — to be matched"}
                </span>
                {mentor?.field && (
                  <span className="text-[11px] text-passionfruit-faint">{mentor.field}</span>
                )}
                <span className={`chip-eyebrow ${pill.cls}`}>{pill.label}</span>
                {when && (
                  <span className="text-[11px] text-passionfruit-muted">· {when}</span>
                )}
                <div className="ml-auto flex items-center gap-2.5">
                  <Link
                    href={`/students/${studentId}/checkpoint/${c.id}`}
                    className="text-[12px] font-semibold text-passionfruit-accentInk hover:underline"
                  >
                    Prep view →
                  </Link>
                  {c.status !== "completed" && (
                    <button
                      onClick={() => cancel(c.id)}
                      disabled={pending}
                      className="text-[12px] font-semibold text-passionfruit-faint hover:text-passionfruit-muted disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Request / upsell */}
      {capped ? (
        <div className="mt-3 rounded-xl border border-passionfruit-accentLine bg-passionfruit-wash px-3 py-2.5">
          <p className="text-[12px] leading-[1.5] text-passionfruit-accentInk">
            <span className="font-bold">You&apos;ve used all your mentor checkpoints this term.</span>{" "}
            The <span className="font-bold">Plus</span> plan includes more mentor time — up to{" "}
            {/* Plus cap, kept in copy so the upsell is concrete */}4 checkpoints a term.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {mentors.length > 0 ? (
            <select
              value={mentorId}
              onChange={(e) => setMentorId(e.target.value)}
              disabled={pending}
              className="input text-[13px]"
              aria-label="Choose a mentor"
            >
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {mentorLine(m)}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[12px] text-passionfruit-faint">
              We&apos;ll match {studentName} with the right mentor for their field.
            </p>
          )}
          <button
            onClick={requestCheckpoint}
            disabled={pending}
            className="btn-primary text-xs disabled:opacity-60"
          >
            {pending ? "Requesting…" : "Request a checkpoint"}
          </button>
          <p className="text-center text-[11px] text-passionfruit-faint">
            {usage.remaining} of {usage.cap} checkpoints left this term
          </p>
        </div>
      )}

      {error && <p className="mt-2.5 text-[12px] text-passionfruit-accentInk">{error}</p>}
    </div>
  );
}
