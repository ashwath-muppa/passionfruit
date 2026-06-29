// Engagement (#7): record a weekly check-in. Advances the streak, then re-runs
// the engagement read so any streak-threshold badges (3-week, 10-week) are
// awarded in the same request. Body: { studentId }. Ownership enforced.

import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, jsonError, resolveOwnedStudent } from "@/lib/api/helpers";
import { recordCheckIn } from "@/lib/engagement/streak";
import { getEngagement } from "@/lib/engagement";

const bodySchema = z.object({ studentId: z.string().uuid() });

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);

    const owned = await resolveOwnedStudent(parsed.data.studentId);
    if (!owned.ok) return owned.response;

    // Advance the streak first, then re-run engagement to award streak badges
    // and return the fresh badge set alongside the updated streak.
    await recordCheckIn(owned.student.id);
    const engagement = await getEngagement(owned.student.id);

    return NextResponse.json({ streak: engagement.streak, badges: engagement.badges });
  });
}
