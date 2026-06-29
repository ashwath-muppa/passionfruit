// Intersection-Narrative endpoint (#10, Passionfruit's signature move). Fuses
// the student's interests into one signature theme aimed at the parent's chosen
// end-goal. The student's interests drive the fusion; the family steers the
// destination. Mirrors app/api/target/route.ts (guard + ownership).

import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, jsonError, resolveOwnedStudent } from "@/lib/api/helpers";
import { generateIntersection } from "@/lib/ai/intersection";

const bodySchema = z.object({ studentId: z.string().uuid() });

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);

    const owned = await resolveOwnedStudent(parsed.data.studentId);
    if (!owned.ok) return owned.response;

    const intersection = await generateIntersection(parsed.data.studentId);
    return NextResponse.json({ intersection });
  });
}
