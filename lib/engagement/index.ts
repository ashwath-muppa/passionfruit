// Engagement (#7): the one read that powers the streak + badges + progress
// surface. It loads the active project, computes progress, evaluates which
// badges are earned, idempotently awards any newly-earned ones, and returns the
// streak with the full set of earned badge rows. Awarding is a no-op when a kid
// has no active project yet (no signals → nothing to grant), so this is safe to
// call on every dashboard render.

import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { badges } from "@/lib/db/schema";
import type { Badge, Streak } from "@/lib/db/schema";
import { getActiveProject } from "@/lib/db/queries";
import { projectProgress } from "@/lib/ui";
import { evaluateBadges } from "./badges";
import { getOrCreateStreak } from "./streak";

export interface Engagement {
  streak: Streak;
  badges: Badge[];
  /** 0..100, share of the active project's milestones complete. */
  percent: number;
}

export async function getEngagement(studentId: string): Promise<Engagement> {
  const [streak, active] = await Promise.all([
    getOrCreateStreak(studentId),
    getActiveProject(studentId),
  ]);

  const milestones = active?.milestones ?? [];
  const prog = projectProgress(milestones);
  const projectDone =
    active?.project.status === "done" || (prog.total > 0 && prog.doneCount === prog.total);

  const earned = evaluateBadges({
    tasksDone: prog.doneCount,
    total: prog.total,
    projectDone,
    streakWeeks: streak.current,
  });

  // Idempotently award newly-earned badges. The (studentId, slug) unique makes
  // every insert safe to repeat; onConflictDoNothing keeps the original earnedAt.
  if (earned.length > 0) {
    await db
      .insert(badges)
      .values(
        earned.map((b) => ({ studentId, slug: b.slug, label: b.label, emoji: b.emoji })),
      )
      .onConflictDoNothing();
  }

  const earnedRows = await db
    .select()
    .from(badges)
    .where(eq(badges.studentId, studentId));

  return { streak, badges: earnedRows, percent: prog.percent };
}

// Re-export so callers can pull the catalog + the Engagement shape from one place.
export { BADGE_DEFS, evaluateBadges } from "./badges";
export type { BadgeDef } from "./badges";
