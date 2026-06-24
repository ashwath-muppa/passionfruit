// Student picks a path → plan weekly steps → promote to an active project.
// Body: { studentId, chosen }.

import { NextResponse } from "next/server";
import { z } from "zod";
import { planWeeklySteps } from "@/lib/ai/tasks";
import { createProjectFromPath } from "@/lib/db/mutations";
import { guard, jsonError, resolveOwnedStudent } from "@/lib/api/helpers";
import { PATH_TYPES } from "@/lib/types";

const candidateSchema = z.object({
  pathType: z.enum(PATH_TYPES),
  title: z.string(),
  pitch: z.string(),
  whyThisFitsYou: z.string(),
  difficulty: z.number(),
  estimatedWeeks: z.number(),
  finalArtifact: z.string(),
});

const bodySchema = z.object({
  studentId: z.string().uuid(),
  chosen: candidateSchema,
});

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);
    const { studentId, chosen } = parsed.data;

    const owned = await resolveOwnedStudent(studentId);
    if (!owned.ok) return owned.response;

    const steps = await planWeeklySteps({ studentId, chosen });
    const projectId = await createProjectFromPath(studentId, chosen, steps);

    return NextResponse.json({ projectId, steps });
  });
}
