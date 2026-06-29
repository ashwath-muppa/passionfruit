// Persist a Course Builder "spark" result into the learner graph, then the
// client routes on to /paths. Body: { studentId, skills: [{label, category}] }.

import { NextResponse } from "next/server";
import { z } from "zod";
import { applySparkSkills } from "@/lib/db/mutations";
import { guard, jsonError, resolveOwnedStudent } from "@/lib/api/helpers";

const bodySchema = z.object({
  studentId: z.string().uuid(),
  skills: z
    .array(z.object({ label: z.string().min(1).max(60), category: z.string().min(1).max(40) }))
    .max(12),
});

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);

    const owned = await resolveOwnedStudent(parsed.data.studentId);
    if (!owned.ok) return owned.response;

    await applySparkSkills(parsed.data.studentId, parsed.data.skills);
    return NextResponse.json({ ok: true });
  });
}
