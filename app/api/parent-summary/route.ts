// On-demand AI-generated parent summary. Body: { studentId }.
// TODO(seam): email delivery — this currently renders on screen only.

import { NextResponse } from "next/server";
import { z } from "zod";
import { generateParentSummary } from "@/lib/ai/tasks";
import { guard, jsonError, resolveOwnedStudent } from "@/lib/api/helpers";

const bodySchema = z.object({ studentId: z.string().uuid() });

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);

    const owned = await resolveOwnedStudent(parsed.data.studentId);
    if (!owned.ok) return owned.response;

    const summary = await generateParentSummary({ studentId: parsed.data.studentId });
    return NextResponse.json({ summary });
  });
}
