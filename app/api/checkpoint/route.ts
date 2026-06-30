// Functional checkpoint detail — lazy generate-on-open + cache.
// POST  { milestoneId, force? }  → the full CheckpointDetail (generates + caches
//                                   on first open; `force` regenerates).
// PATCH { milestoneId, research } → save research-accelerator working state.
// Ownership verified via milestone → project → student → parent.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getParent } from "@/lib/auth/parent";
import { getCheckpointDetail, getMilestoneContext } from "@/lib/db/queries";
import { saveCheckpointDetail, saveResearchState } from "@/lib/db/mutations";
import { generateCheckpointDetail } from "@/lib/ai/tasks";
import { activeModels } from "@/lib/ai/gateway";
import { guard, jsonError } from "@/lib/api/helpers";
import type { CheckpointDetail } from "@/lib/types";

const postSchema = z.object({
  milestoneId: z.string().uuid(),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  return guard(async () => {
    const parent = await getParent();
    if (!parent) return jsonError(401, "Not authenticated");

    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);
    const { milestoneId, force } = parsed.data;

    const ctx = await getMilestoneContext(milestoneId);
    if (!ctx || ctx.student.parentId !== parent.id) {
      return jsonError(404, "Checkpoint not found");
    }

    // Cache hit unless a regenerate was requested.
    if (!force) {
      const cached = await getCheckpointDetail(milestoneId);
      if (cached) return NextResponse.json({ detail: rowToDetail(cached), cached: true });
    }

    const detail = await generateCheckpointDetail({
      studentId: ctx.student.id,
      milestone: ctx.milestone,
      project: ctx.project,
      endGoalPref: ctx.student.endGoalPref ?? null,
    });
    const saved = await saveCheckpointDetail({
      milestoneId,
      studentId: ctx.student.id,
      detail,
      model: activeModels.quality(),
    });

    return NextResponse.json({ detail: rowToDetail(saved), cached: false });
  });
}

const patchSchema = z.object({
  milestoneId: z.string().uuid(),
  research: z.object({
    question: z.string().nullable(),
    sources: z.array(
      z.object({ title: z.string(), url: z.string().optional(), note: z.string().optional() }),
    ),
    outline: z.array(z.string()),
  }),
});

export async function PATCH(req: Request) {
  return guard(async () => {
    const parent = await getParent();
    if (!parent) return jsonError(401, "Not authenticated");

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);

    const ctx = await getMilestoneContext(parsed.data.milestoneId);
    if (!ctx || ctx.student.parentId !== parent.id) {
      return jsonError(404, "Checkpoint not found");
    }

    await saveResearchState(parsed.data.milestoneId, parsed.data.research);
    return NextResponse.json({ ok: true });
  });
}

// Map the cached DB row to the API CheckpointDetail shape.
function rowToDetail(row: {
  type: CheckpointDetail["type"];
  difficulty: CheckpointDetail["difficulty"];
  description: string;
  resources: CheckpointDetail["resources"];
  steps: CheckpointDetail["steps"];
  deliverableKind: CheckpointDetail["deliverableKind"];
  deliverableSpec: string;
  research: CheckpointDetail["research"] | null;
}): CheckpointDetail {
  return {
    type: row.type,
    difficulty: row.difficulty,
    description: row.description,
    resources: row.resources,
    steps: row.steps,
    deliverableKind: row.deliverableKind,
    deliverableSpec: row.deliverableSpec,
    research: row.research ?? undefined,
  };
}
