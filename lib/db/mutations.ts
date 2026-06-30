// Write-side of the learner graph. Persists intake extractions (embedding the
// semantic fields for later recall) and promotes a chosen path into a project
// with weekly milestones.

import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./client";
import {
  checkpointDetails,
  constraints,
  goals,
  interests,
  milestones,
  observations,
  projectPaths,
  projects,
  skills,
  strengths,
} from "./schema";
import { embedText } from "@/lib/ai/gateway";
import type {
  CheckpointDetail,
  IntakeExtraction,
  ProjectPathCandidate,
  WeeklyStep,
} from "@/lib/types";
import type { CheckpointDetailRow } from "./schema";

/**
 * Fold an intake extraction into the graph. Interests are upserted by label
 * (strength reinforced over time); everything else is appended. Each intake is
 * also recorded as append-only observations — the longitudinal memory.
 */
export async function applyIntakeExtraction(
  studentId: string,
  extraction: IntakeExtraction,
): Promise<void> {
  // ── Interests: upsert by label, reinforce strength ──
  for (const i of extraction.interests) {
    const [existing] = await db
      .select()
      .from(interests)
      .where(and(eq(interests.studentId, studentId), eq(interests.label, i.label)))
      .limit(1);

    if (existing) {
      await db
        .update(interests)
        .set({
          strength: Math.max(existing.strength, i.strength),
          category: i.category || existing.category,
          lastUpdated: new Date(),
        })
        .where(eq(interests.id, existing.id));
    } else {
      const embedding = await embedText(`${i.label} ${i.category}`);
      await db.insert(interests).values({
        studentId,
        label: i.label,
        category: i.category,
        strength: i.strength,
        source: "intake",
        embedding,
      });
    }
  }

  // ── Strengths ──
  for (const s of extraction.strengths) {
    const embedding = await embedText(`${s.label} ${s.evidence}`);
    await db.insert(strengths).values({
      studentId,
      label: s.label,
      evidence: s.evidence,
      embedding,
    });
  }

  // ── Constraints (no embedding; structured filters) ──
  for (const c of extraction.constraints) {
    await db.insert(constraints).values({ studentId, kind: c.kind, value: c.value });
  }

  // ── Goals ──
  for (const g of extraction.goals) {
    const embedding = await embedText(g.text);
    await db.insert(goals).values({
      studentId,
      horizon: g.horizon,
      text: g.text,
      embedding,
    });
  }

  // ── Observations (append-only longitudinal memory) ──
  for (const content of extraction.observations) {
    const embedding = await embedText(content);
    await db.insert(observations).values({
      studentId,
      type: "intake_signal",
      content,
      source: "intake",
      embedding,
    });
  }
}

/**
 * Persist the Course Builder "spark" result: the skills it surfaced (upserted
 * by label as nascent, low-progress entries) plus an append-only observation.
 * Lightweight, deterministic enrichment of the graph ahead of path matching.
 */
export async function applySparkSkills(
  studentId: string,
  found: { label: string; category: string }[],
): Promise<void> {
  for (const s of found) {
    const [existing] = await db
      .select()
      .from(skills)
      .where(and(eq(skills.studentId, studentId), eq(skills.label, s.label)))
      .limit(1);
    if (!existing) {
      await db.insert(skills).values({
        studentId,
        label: s.label,
        category: s.category,
        progress: 0.15,
      });
    }
  }

  const labels = found.map((s) => s.label).join(", ");
  await db.insert(observations).values({
    studentId,
    type: "spark_session",
    content: `Spark quiz surfaced: ${labels || "(no selections)"}.`,
    source: "reflection",
    payload: { skills: found },
  });
}

/** Persist the generated 2–3 path options as a snapshot. */
export async function saveProjectPaths(
  studentId: string,
  candidates: ProjectPathCandidate[],
): Promise<string> {
  const [row] = await db
    .insert(projectPaths)
    .values({ studentId, candidates })
    .returning({ id: projectPaths.id });
  return row!.id;
}

/** Promote a chosen path into an active project + its weekly milestones. */
export async function createProjectFromPath(
  studentId: string,
  chosen: ProjectPathCandidate,
  steps: WeeklyStep[],
): Promise<string> {
  const [project] = await db
    .insert(projects)
    .values({
      studentId,
      pathType: chosen.pathType,
      title: chosen.title,
      summary: chosen.pitch,
      status: "active",
      chosenAt: new Date(),
    })
    .returning({ id: projects.id });

  const projectId = project!.id;

  if (steps.length) {
    await db.insert(milestones).values(
      steps.map((s) => ({
        projectId,
        weekNo: s.weekNo,
        title: s.title,
        detail: s.detail,
        dueHint: s.dueHint,
      })),
    );
  }

  // Record the choice as a longitudinal signal.
  await db.insert(observations).values({
    studentId,
    type: "project_chosen",
    content: `Chose project: "${chosen.title}" (${chosen.pathType}).`,
    source: "project",
    payload: { pathType: chosen.pathType, title: chosen.title },
  });

  return projectId;
}

/**
 * Cache a generated checkpoint detail (one row per milestone) and stamp the
 * milestone's checkpoint_type. Upsert so "regenerate" replaces cleanly.
 */
export async function saveCheckpointDetail(args: {
  milestoneId: string;
  studentId: string;
  detail: CheckpointDetail;
  model: string | null;
}): Promise<CheckpointDetailRow> {
  const { milestoneId, studentId, detail, model } = args;
  const values = {
    milestoneId,
    studentId,
    type: detail.type,
    difficulty: detail.difficulty,
    description: detail.description,
    resources: detail.resources,
    steps: detail.steps,
    deliverableKind: detail.deliverableKind,
    deliverableSpec: detail.deliverableSpec,
    research: detail.research ?? null,
    model,
    generatedAt: new Date(),
  };

  const [row] = await db
    .insert(checkpointDetails)
    .values(values)
    .onConflictDoUpdate({ target: checkpointDetails.milestoneId, set: values })
    .returning();

  // Reflect the inferred type on the milestone for the timeline treatment.
  await db
    .update(milestones)
    .set({ checkpointType: detail.type })
    .where(eq(milestones.id, milestoneId));

  return row!;
}

/** Persist edited research-accelerator working state on a checkpoint. */
export async function saveResearchState(
  milestoneId: string,
  research: CheckpointDetail["research"],
): Promise<void> {
  await db
    .update(checkpointDetails)
    .set({ research: research ?? null })
    .where(eq(checkpointDetails.milestoneId, milestoneId));
}
