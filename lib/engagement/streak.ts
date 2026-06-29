// Engagement (#7): the WEEKLY check-in streak. Kids protect streaks, so the bar
// to keep one alive is intentionally gentle — a single check-in anywhere within
// an ISO week keeps it; missing a whole week resets to 1 (no shame, just a fresh
// start). Streak math is in ISO weeks so the boundary is stable (Mon–Sun) and
// independent of the time of day a kid checks in.

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { streaks } from "@/lib/db/schema";
import type { Streak } from "@/lib/db/schema";

// ── ISO week helpers ──
// We compare check-ins by an absolute "week index" (a monotonic count of ISO
// weeks since the epoch). Consecutive weeks differ by exactly 1, which makes the
// "same week / previous week / older" decision a single subtraction.

const MS_PER_DAY = 86_400_000;

/** UTC midnight of the Thursday in the ISO week containing `d` (ISO-8601 anchor). */
function isoWeekThursday(d: Date): number {
  // Normalize to UTC midnight to avoid DST / local-time drift.
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  // getUTCDay(): 0=Sun..6=Sat → ISO day 1=Mon..7=Sun.
  const isoDay = new Date(utc).getUTCDay() || 7;
  // Shift to the Thursday of this ISO week (Thursday determines the ISO year).
  return utc + (4 - isoDay) * MS_PER_DAY;
}

/** Monotonic ISO-week index: consecutive weeks differ by exactly 1. */
function isoWeekIndex(d: Date): number {
  return Math.floor(isoWeekThursday(d) / (7 * MS_PER_DAY));
}

/** The student's streak row, creating a zeroed one on first access. */
export async function getOrCreateStreak(studentId: string): Promise<Streak> {
  const [existing] = await db
    .select()
    .from(streaks)
    .where(eq(streaks.studentId, studentId))
    .limit(1);
  if (existing) return existing;

  // Insert-or-ignore against the studentId unique, then read back — this is safe
  // under a race (a concurrent insert just wins; we still return the row).
  await db.insert(streaks).values({ studentId }).onConflictDoNothing();
  const [row] = await db
    .select()
    .from(streaks)
    .where(eq(streaks.studentId, studentId))
    .limit(1);
  return row!;
}

/**
 * Record a check-in for "this week" and advance the streak:
 *  - same ISO week as the last check-in → unchanged (one check-in per week).
 *  - exactly the previous ISO week → current + 1 (longest tracks the max).
 *  - older, or never checked in → current resets to 1.
 * Always stamps lastCheckIn = now.
 */
export async function recordCheckIn(studentId: string): Promise<Streak> {
  const streak = await getOrCreateStreak(studentId);
  const now = new Date();
  const nowWeek = isoWeekIndex(now);

  let current = streak.current;
  if (!streak.lastCheckIn) {
    current = 1;
  } else {
    const delta = nowWeek - isoWeekIndex(streak.lastCheckIn);
    if (delta <= 0) {
      // Same week (delta 0). A future-dated lastCheckIn (delta < 0) is also
      // treated as "already counted" — never grow on a clock anomaly.
      current = streak.current;
    } else if (delta === 1) {
      current = streak.current + 1;
    } else {
      current = 1;
    }
  }

  const longest = Math.max(streak.longest, current);

  const [updated] = await db
    .update(streaks)
    .set({ current, longest, lastCheckIn: now })
    .where(eq(streaks.studentId, studentId))
    .returning();
  return updated!;
}
