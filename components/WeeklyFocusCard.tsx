"use client";

// The weekly habit card (#6) — the heart of the retention loop. Monday: "here's
// your focus this week" with 1–3 small tasks; check them off; Friday celebrate.
// Sits on the kid weekly-plan screen inside the ~360px phone frame.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WeeklyFocus } from "@/lib/db/schema";

export function WeeklyFocusCard({
  studentId,
  focus,
}: {
  studentId: string;
  focus: WeeklyFocus | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/habit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, ...body }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // No focus yet → invite them to plan the week with Sage.
  if (!focus) {
    return (
      <div className="card">
        <span className="eyebrow">This week</span>
        <p className="mentor-voice mt-1 text-[14px] text-passionfruit-body">
          Ready for a fresh start? Let's pick a couple of small wins for the week.
        </p>
        <button
          onClick={() => post({ action: "generate" })}
          disabled={busy}
          className="btn-primary mt-3 w-full disabled:opacity-60"
        >
          {busy ? "Planning…" : "Plan my week with Sage →"}
        </button>
      </div>
    );
  }

  const tasks = focus.tasks ?? [];
  const allDone = tasks.length > 0 && tasks.every((t) => t.done);
  const celebrated = focus.status === "celebrated";

  return (
    <div className="card border-passionfruit-accentLine">
      <span className="eyebrow">This week</span>
      <p className="mentor-voice mt-1 text-[15px] font-medium text-passionfruit-ink">
        {focus.headline}
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {tasks.map((t, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => post({ action: "toggle", focusId: focus.id, index: i })}
              disabled={busy || celebrated}
              className="flex w-full items-start gap-2.5 text-left disabled:opacity-70"
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border text-[12px] transition ${
                  t.done
                    ? "border-passionfruit-accent bg-passionfruit-accent text-white"
                    : "border-passionfruit-line bg-passionfruit-card text-transparent"
                }`}
              >
                ✓
              </span>
              <span
                className={`text-[13px] leading-snug ${
                  t.done
                    ? "text-passionfruit-faint line-through"
                    : "text-passionfruit-body"
                }`}
              >
                {t.text}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {celebrated ? (
        <div className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-passionfruit-accentInk">
          <span aria-hidden>🎉</span> You celebrated this week — nice work.
        </div>
      ) : (
        allDone && (
          <button
            onClick={() => post({ action: "celebrate", focusId: focus.id })}
            disabled={busy}
            className="btn-primary mt-3 w-full disabled:opacity-60"
          >
            {busy ? "…" : "Celebrate the week 🎉"}
          </button>
        )
      )}
    </div>
  );
}
