// ──────────────────────────────────────────────────────────────────────────
// 7-day Activation Sprint (#6) — the early "aha" that guarantees a first win.
//
// For brand-new students: a first task completable in <30 min and a micro-win
// by day 7. We track progress off the student's createdAt and the (nullable)
// students.firstWinAt timestamp. No AI here — pure, deterministic state.
// ──────────────────────────────────────────────────────────────────────────

import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { students } from "@/lib/db/schema";
import { getActiveProject } from "@/lib/db/queries";

export interface ActivationState {
  /** 1..7 during the sprint; clamped to a 8+ "graduated" floor afterward. */
  dayOfSprint: number;
  /** True once the student has logged their first tangible win. */
  firstWin: boolean;
  /** On track if they've won, or are still inside the 7-day window. */
  onTrack: boolean;
  /** A short, concrete next move (the current project's first milestone, or a
   *  prompt to pick a path if there's no project yet). */
  nextStep: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SPRINT_DAYS = 7;

/** Whole days elapsed since `from`, as a 1-based "day N" (day of signup = 1). */
function dayNumberSince(from: Date, now: Date = new Date()): number {
  const elapsed = Math.floor((now.getTime() - from.getTime()) / MS_PER_DAY);
  // Clamp to [1, SPRINT_DAYS + 1]: 8 signals "past the sprint" without inflating.
  return Math.min(Math.max(elapsed + 1, 1), SPRINT_DAYS + 1);
}

/**
 * Current activation state for a student. Reads createdAt + firstWinAt and
 * derives the sprint day, win status, and a concrete next step.
 */
export async function getActivation(studentId: string): Promise<ActivationState> {
  const [student] = await db
    .select({ createdAt: students.createdAt, firstWinAt: students.firstWinAt })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);

  const createdAt = student?.createdAt ?? new Date();
  const firstWin = Boolean(student?.firstWinAt);
  const dayOfSprint = dayNumberSince(createdAt);
  const onTrack = firstWin || dayOfSprint <= SPRINT_DAYS;

  // A concrete first move: the project's first milestone if one exists, else a
  // nudge to pick a path. Kept short so it reads well in the banner.
  let nextStep = "pick a project path";
  const active = await getActiveProject(studentId);
  if (active && active.milestones.length > 0) {
    const first = active.milestones.find((m) => m.status !== "done") ?? active.milestones[0]!;
    nextStep = first.title;
  }

  return { dayOfSprint, firstWin, onTrack, nextStep };
}

/**
 * Record the student's first tangible win (idempotent): set firstWinAt to now
 * only if it is currently null. Safe to call repeatedly.
 */
export async function markFirstWin(studentId: string): Promise<void> {
  await db
    .update(students)
    .set({ firstWinAt: new Date() })
    .where(and(eq(students.id, studentId), isNull(students.firstWinAt)));
}
