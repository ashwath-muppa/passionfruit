// Mentor checkpoints API (#9). Parent-owned: request or cancel a capped mentor
// checkpoint. The cap is enforced in lib/mentors/checkpoints — here we just map
// a hit cap to a friendly 422 that points to the Plus plan (the upsell seam).

import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, jsonError, resolveParentOwnedStudent } from "@/lib/api/helpers";
import {
  cancelCheckpoint,
  checkpointUsage,
  getCheckpoints,
  requestCheckpoint,
} from "@/lib/mentors/checkpoints";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    studentId: z.string().uuid(),
    mentorId: z.string().uuid().optional(),
    scheduledAt: z.string().datetime().optional(),
  }),
  z.object({
    action: z.literal("cancel"),
    studentId: z.string().uuid(),
    checkpointId: z.string().uuid(),
  }),
]);

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);

    const owned = await resolveParentOwnedStudent(parsed.data.studentId);
    if (!owned.ok) return owned.response;
    const data = parsed.data;

    if (data.action === "request") {
      const result = await requestCheckpoint(data.studentId, {
        mentorId: data.mentorId,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      });
      if (!result.ok) {
        // The sacred cap was hit — point to the Plus plan instead of erroring out.
        return jsonError(
          422,
          "You've used all your mentor checkpoints this term — the Plus plan includes more mentor time.",
        );
      }
    } else {
      await cancelCheckpoint(data.checkpointId, data.studentId);
    }

    // Return the fresh state so the client can reconcile without a second fetch.
    const [usage, checkpoints] = await Promise.all([
      checkpointUsage(data.studentId),
      getCheckpoints(data.studentId),
    ]);
    return NextResponse.json({ ok: true, usage, checkpoints });
  });
}
