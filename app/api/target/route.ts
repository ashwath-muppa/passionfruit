// Parent-facing target control (Deliverables Engine, #1 + #10). The parent sets
// the end-goal direction, asks for matched real-world targets, and approves one
// as the north star. The student's interests drive the match; the parent steers.

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects, projectTargets, students } from "@/lib/db/schema";
import { guard, jsonError, resolveOwnedStudent } from "@/lib/api/helpers";
import { asEndGoalPref, suggestTargetsForStudent } from "@/lib/deliverables/suggest";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_pref"), studentId: z.string().uuid(), endGoalPref: z.string() }),
  z.object({ action: z.literal("suggest"), studentId: z.string().uuid(), endGoalPref: z.string().optional() }),
  z.object({
    action: z.literal("approve"),
    studentId: z.string().uuid(),
    deliverableId: z.string().uuid(),
    rationale: z.string().max(600).optional(),
  }),
]);

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);

    const owned = await resolveOwnedStudent(parsed.data.studentId);
    if (!owned.ok) return owned.response;
    const data = parsed.data;

    if (data.action === "set_pref") {
      await db
        .update(students)
        .set({ endGoalPref: asEndGoalPref(data.endGoalPref) })
        .where(eq(students.id, data.studentId));
      return NextResponse.json({ ok: true });
    }

    if (data.action === "suggest") {
      const override =
        data.endGoalPref !== undefined ? asEndGoalPref(data.endGoalPref) : undefined;
      const matches = await suggestTargetsForStudent(data.studentId, override);
      // Drop the embedding vectors — the UI doesn't use them and they bloat the payload.
      const lean = matches.map((m) => ({ ...m, deliverable: { ...m.deliverable, embedding: null } }));
      return NextResponse.json({ matches: lean });
    }

    // approve — anchor the chosen deliverable to the latest project (if any) and
    // record the parent's approval as the north star.
    const [activeProject] = await db
      .select()
      .from(projects)
      .where(eq(projects.studentId, data.studentId))
      .orderBy(desc(projects.createdAt))
      .limit(1);

    // Clear any prior unstarted suggestion for this student to keep one north star.
    await db
      .delete(projectTargets)
      .where(and(eq(projectTargets.studentId, data.studentId), eq(projectTargets.status, "suggested")));

    await db.insert(projectTargets).values({
      studentId: data.studentId,
      projectId: activeProject?.id ?? null,
      deliverableId: data.deliverableId,
      rationale: data.rationale ?? null,
      status: "parent_approved",
      parentApproved: true,
    });
    return NextResponse.json({ ok: true });
  });
}
