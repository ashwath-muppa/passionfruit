"use client";

// Engagement (#7): the weekly check-in. A kid taps it once a week to keep the
// streak alive — the single highest-frequency "I showed up" action in the app.
// POSTs to /api/checkin, shows a brief celebratory confirmation, then refreshes
// so the StreakBadges card reflects the new count (and any streak-earned badge).

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Streak } from "@/lib/db/schema";

export function CheckInButton({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ current: number } | null>(null);

  async function checkIn() {
    setBusy(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Check-in failed");
      const data = (await res.json()) as { streak: Streak };
      setDone({ current: data.streak.current });
      router.refresh();
    } catch {
      setDone(null);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 px-1">
        <span className="btn-primary pointer-events-none text-sm">
          {done.current > 1 ? `Streak +1! 🔥 ${done.current} weeks` : "Streak started! 🔥"}
        </span>
        <span className="text-[12px] text-passionfruit-faint">See you next week 🌱</span>
      </div>
    );
  }

  return (
    <button onClick={checkIn} disabled={busy} className="btn-primary w-full text-sm">
      {busy ? "Logging…" : "I worked on it this week 🔥"}
    </button>
  );
}
