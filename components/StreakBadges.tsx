// Engagement (#7): the streak + progress + badge-collection card. Presentational
// and server-rendered (no "use client") — it just reads the Engagement snapshot.
// Warm-Paper: a single coral accent, a thin progress bar, and the FULL badge
// catalog rendered as chips so kids see what's still collectible. Earned chips
// glow (wash bg / accentInk / emoji); unearned ones sit quietly (sunk bg, faint).

import type { Engagement } from "@/lib/engagement";
import { BADGE_DEFS } from "@/lib/engagement/badges";

export function StreakBadges({ engagement }: { engagement: Engagement }) {
  const { streak, badges, percent } = engagement;
  const earned = new Set(badges.map((b) => b.slug));
  const earnedCount = BADGE_DEFS.filter((b) => earned.has(b.slug)).length;
  const hasStreak = streak.current > 0;

  return (
    <div className="card">
      {/* streak header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`text-[22px] leading-none ${hasStreak ? "" : "opacity-40 grayscale"}`}
            aria-hidden
          >
            🔥
          </span>
          <div>
            {hasStreak ? (
              <>
                <div className="font-display text-[17px] font-semibold leading-tight text-passionfruit-ink">
                  {streak.current}-week streak
                </div>
                <div className="text-[12px] text-passionfruit-faint">
                  {streak.longest > streak.current
                    ? `Best: ${streak.longest} weeks · keep it lit`
                    : "Check in once a week to keep it lit"}
                </div>
              </>
            ) : (
              <>
                <div className="font-display text-[17px] font-semibold leading-tight text-passionfruit-ink">
                  Start your streak
                </div>
                <div className="text-[12px] text-passionfruit-faint">
                  One check-in a week and the fire begins 🌱
                </div>
              </>
            )}
          </div>
        </div>
        <span className="pill-accent flex-none">
          {earnedCount}/{BADGE_DEFS.length} badges
        </span>
      </div>

      {/* progress bar */}
      <div className="mt-3.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="eyebrow">Project progress</span>
          <span className="text-[12px] font-bold text-passionfruit-accentInk">{percent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-passionfruit-sunk">
          <div
            className="h-full rounded-full bg-passionfruit-accent transition-[width]"
            style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
          />
        </div>
      </div>

      {/* badge collection */}
      <div className="mt-4">
        <span className="eyebrow">Badges</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BADGE_DEFS.map((b) => {
            const got = earned.has(b.slug);
            return (
              <span
                key={b.slug}
                title={got ? `Earned: ${b.label}` : `Locked: ${b.label}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  got
                    ? "bg-passionfruit-wash text-passionfruit-accentInk"
                    : "bg-passionfruit-sunk text-passionfruit-faint"
                }`}
              >
                <span aria-hidden className={got ? "" : "opacity-50 grayscale"}>
                  {b.emoji}
                </span>
                {b.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
