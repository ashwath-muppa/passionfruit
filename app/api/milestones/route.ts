// Update a weekly step's status (progress tracking). Body: { milestoneId, status }.
// Ownership verified via milestone → project → student → parent.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { milestones, projects, students } from "@/lib/db/schema";
import { getParent } from "@/lib/auth/parent";
import { guard, jsonError } from "@/lib/api/helpers";

const bodySchema = z.object({
  milestoneId: z.string().uuid(),
  status: z.enum(["todo", "doing", "done"]),
});

export async function PATCH(req: Request) {
  return guard(async () => {
    const parent = await getParent();
    if (!parent) return jsonError(401, "Not authenticated");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);
    const { milestoneId, status } = parsed.data;

    // Confirm the milestone belongs to a student this parent owns.
    const [owned] = await db
      .select({ id: milestones.id })
      .from(milestones)
      .innerJoin(projects, eq(milestones.projectId, projects.id))
      .innerJoin(students, eq(projects.studentId, students.id))
      .where(and(eq(milestones.id, milestoneId), eq(students.parentId, parent.id)))
      .limit(1);
    if (!owned) return jsonError(404, "Milestone not found");

    await db.update(milestones).set({ status }).where(eq(milestones.id, milestoneId));
    return NextResponse.json({ ok: true });
  });
}
