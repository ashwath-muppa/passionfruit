// Mentor checkpoints (#9) — the capped human layer.
//
// The mentor network is the human half that makes Passionfruit more than a
// pure-AI tool: a real top-student mentor (TJ / top college) checks in on the
// student's work. Their job is accountability + raising the bar + unblocking +
// encouragement AT CHECKPOINTS — never delivering the project.
//
// The "sacred cap" is the margin guardrail: mentor time is CAPPED per term
// (2 on Core, 4 on Plus). The cap is enforced HERE, in code — requestCheckpoint
// refuses to insert once a student is out of checkpoints for the term. Nothing
// upstream is trusted to honor it; this is the single chokepoint.

import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { checkpoints, mentors, students } from "@/lib/db/schema";
import { getActiveProject, getLearnerGraphSnapshot } from "@/lib/db/queries";
import type { LearnerGraphSnapshot } from "@/lib/db/queries";
import { projectProgress } from "@/lib/ui";
import type { Checkpoint, Mentor } from "@/lib/db/schema";

// The sacred cap — checkpoints a student gets per term, by plan tier. This is
// the business margin guardrail; changing it changes unit economics.
export const CHECKPOINT_CAP = { core: 2, plus: 4 } as const;

// Statuses that consume a checkpoint against the cap. A cancelled checkpoint
// frees its slot back up; everything else (requested/scheduled/completed) counts.
const COUNTED_STATUSES = ["requested", "scheduled", "completed"] as const;

/**
 * The current academic term key, e.g. "2026-fall" / "2026-spring".
 * Fall = Aug–Dec, Spring = Jan–Jul. The cap counts per term, so this is what
 * a checkpoint is stamped with and what usage is summed over.
 */
export function currentTerm(date: Date = new Date()): string {
  const month = date.getMonth(); // 0 = Jan … 11 = Dec
  const season = month >= 7 ? "fall" : "spring"; // Aug (7) onward = fall
  return `${date.getFullYear()}-${season}`;
}

/** Active mentors available to be requested. */
export async function listMentors(): Promise<Mentor[]> {
  return db
    .select()
    .from(mentors)
    .where(eq(mentors.active, true))
    .orderBy(mentors.name);
}

/** This student's checkpoints, newest first. */
export async function getCheckpoints(studentId: string): Promise<Checkpoint[]> {
  return db
    .select()
    .from(checkpoints)
    .where(eq(checkpoints.studentId, studentId))
    .orderBy(desc(checkpoints.createdAt));
}

export interface CheckpointUsage {
  used: number;
  cap: number;
  remaining: number;
  tier: string;
  term: string;
}

/** How many checkpoints the student has used this term vs. their tier cap. */
export async function checkpointUsage(studentId: string): Promise<CheckpointUsage> {
  const [student] = await db
    .select({ tier: students.tier })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);

  // Default to the safest (lowest) cap if the tier is missing/unknown.
  const tier = student?.tier === "plus" ? "plus" : "core";
  const cap = CHECKPOINT_CAP[tier];
  const term = currentTerm();

  const rows = await db
    .select({ id: checkpoints.id })
    .from(checkpoints)
    .where(
      and(
        eq(checkpoints.studentId, studentId),
        eq(checkpoints.term, term),
        inArray(checkpoints.status, [...COUNTED_STATUSES]),
      ),
    );

  const used = rows.length;
  const remaining = Math.max(0, cap - used);
  return { used, cap, remaining, tier, term };
}

export type RequestCheckpointResult =
  | { ok: true; checkpoint: Checkpoint }
  | { ok: false; reason: "cap_reached" };

/**
 * Request (or schedule) a checkpoint for a student. ENFORCES THE CAP: if the
 * student has no checkpoints left this term, NOTHING is inserted and a
 * cap_reached result is returned — this is the margin guardrail in code.
 */
export async function requestCheckpoint(
  studentId: string,
  opts: { mentorId?: string; scheduledAt?: Date } = {},
): Promise<RequestCheckpointResult> {
  const usage = await checkpointUsage(studentId);
  if (usage.remaining <= 0) {
    // The sacred cap — refuse to insert. Margin protected.
    return { ok: false, reason: "cap_reached" };
  }

  const [checkpoint] = await db
    .insert(checkpoints)
    .values({
      studentId,
      mentorId: opts.mentorId ?? null,
      scheduledAt: opts.scheduledAt ?? null,
      // A time was picked → it's scheduled; otherwise it's a pending request.
      status: opts.scheduledAt ? "scheduled" : "requested",
      term: usage.term,
    })
    .returning();

  return { ok: true, checkpoint: checkpoint! };
}

/** Cancel a checkpoint (frees its slot back against the cap). Scoped to the owner. */
export async function cancelCheckpoint(id: string, studentId: string): Promise<void> {
  await db
    .update(checkpoints)
    .set({ status: "cancelled" })
    .where(and(eq(checkpoints.id, id), eq(checkpoints.studentId, studentId)));
}

// The fixed mentor rubric — what a good capped checkpoint does. This is the
// product's stance on the human layer: raise the bar and unblock, never do the
// work. Surfaced on the mentor prep view so every checkpoint runs to the same bar.
export const CHECKPOINT_RUBRIC: string[] = [
  "Hold them accountable to what they committed to",
  "Raise the bar — push for more ambitious, real work",
  "Unblock what's stuck",
  "Encourage and inspire — never do the work for them",
];

export interface CheckpointPrep {
  checkpoint: Checkpoint;
  mentor: Mentor | null;
  student: LearnerGraphSnapshot["student"];
  graph: LearnerGraphSnapshot;
  progressPercent: number;
  rubric: string[];
}

/**
 * Everything a mentor needs to walk into a checkpoint prepared: the checkpoint
 * itself, the matched mentor, the student's learner-graph snapshot, the active
 * project's progress, and the fixed rubric. Returns null if the checkpoint or
 * the student's graph can't be found.
 */
export async function getCheckpointPrep(checkpointId: string): Promise<CheckpointPrep | null> {
  const [checkpoint] = await db
    .select()
    .from(checkpoints)
    .where(eq(checkpoints.id, checkpointId))
    .limit(1);
  if (!checkpoint) return null;

  const [graph, project, mentor] = await Promise.all([
    getLearnerGraphSnapshot(checkpoint.studentId),
    getActiveProject(checkpoint.studentId),
    checkpoint.mentorId
      ? db
          .select()
          .from(mentors)
          .where(eq(mentors.id, checkpoint.mentorId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  if (!graph) return null;

  const progressPercent = project ? projectProgress(project.milestones).percent : 0;

  return {
    checkpoint,
    mentor,
    student: graph.student,
    graph,
    progressPercent,
    rubric: CHECKPOINT_RUBRIC,
  };
}
