"use client";

// Deadline & Calendar Engine (#4) — parent control row. "Sync deadlines" reads
// the student's target + matches into dated reminders (they then appear in the
// "Up next" card via router.refresh); "Add to calendar (.ics)" downloads the
// feed for the family's real calendar. Compact, Warm-Paper styling.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CalendarActions({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Sync failed");
      const data = (await res.json()) as { count: number };
      setCount(data.count);
      router.refresh();
    } catch {
      setCount(null);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-1">
      <button onClick={sync} disabled={syncing} className="btn-soft text-xs">
        {syncing ? "Syncing…" : "Sync deadlines"}
      </button>
      <a
        href={`/students/${studentId}/calendar.ics`}
        className="text-[12px] font-semibold text-passionfruit-accentInk hover:underline"
      >
        Add to calendar (.ics)
      </a>
      {count !== null && (
        <span className="text-[12px] text-passionfruit-faint">
          Synced ✓ {count} {count === 1 ? "deadline" : "deadlines"}
        </span>
      )}
    </div>
  );
}
