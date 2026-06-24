"use client";

import { useState } from "react";
import type { Milestone } from "@/lib/db/schema";

type Status = "todo" | "doing" | "done";

export function MilestoneList({ initial }: { initial: Milestone[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function cycle(m: Milestone) {
    const next: Status = m.status === "todo" ? "doing" : m.status === "doing" ? "done" : "todo";
    setBusy(m.id);
    // Optimistic update.
    setItems((prev) => prev.map((it) => (it.id === m.id ? { ...it, status: next } : it)));
    try {
      const res = await fetch("/api/milestones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId: m.id, status: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Roll back on failure.
      setItems((prev) => prev.map((it) => (it.id === m.id ? { ...it, status: m.status } : it)));
    } finally {
      setBusy(null);
    }
  }

  const done = items.filter((i) => i.status === "done").length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-slate-500">{done}/{items.length} done</span>
      </div>

      <ol className="space-y-2">
        {items.map((m) => (
          <li key={m.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <button
              onClick={() => cycle(m)}
              disabled={busy === m.id}
              className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border text-[10px] font-bold ${
                m.status === "done"
                  ? "border-green-500 bg-green-500 text-white"
                  : m.status === "doing"
                    ? "border-amber-400 bg-amber-100 text-amber-700"
                    : "border-slate-300 bg-white text-transparent"
              }`}
              title="Click to cycle: to-do → doing → done"
            >
              {m.status === "done" ? "✓" : m.status === "doing" ? "•" : "·"}
            </button>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-800">
                  Week {m.weekNo}: {m.title}
                </p>
                {m.dueHint && <span className="text-xs text-slate-400">{m.dueHint}</span>}
              </div>
              {m.detail && <p className="mt-1 text-sm text-slate-600">{m.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
