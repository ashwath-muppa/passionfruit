// Intake turn. Body: { studentId, messages }. Returns the mentor reply and, on
// completion, folds the extracted signals into the learner graph.

import { NextResponse } from "next/server";
import { z } from "zod";
import { runIntake } from "@/lib/ai/tasks";
import { applyIntakeExtraction } from "@/lib/db/mutations";
import { guard, jsonError, resolveOwnedStudent } from "@/lib/api/helpers";

const bodySchema = z.object({
  studentId: z.string().uuid(),
  messages: z.array(
    z.object({
      role: z.enum(["mentor", "student"]),
      text: z.string().min(1),
    }),
  ),
});

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);
    const { studentId, messages } = parsed.data;

    const owned = await resolveOwnedStudent(studentId);
    if (!owned.ok) return owned.response;

    const result = await runIntake({
      studentId,
      student: owned.student,
      messages,
    });

    // Persist to the graph only when the conversation wraps up — the final
    // extraction is computed over the whole transcript, avoiding duplicates.
    if (result.complete) {
      await applyIntakeExtraction(studentId, result.extraction);
    }

    return NextResponse.json({
      reply: result.reply,
      complete: result.complete,
    });
  });
}
