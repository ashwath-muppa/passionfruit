// Parent digest send (#8). POST { studentId, kind } → builds the monthly growth
// narrative or the light weekly nudge, sends it to the parent's inbox (or falls
// back to on-screen when no email provider is configured), and logs the send in
// the `digests` table. Returns the channel actually used + the subject so the
// client can show a friendly status.

import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, jsonError, resolveParentOwnedStudent } from "@/lib/api/helpers";
import { requireParent } from "@/lib/auth/parent";
import { buildMonthly, buildWeeklyNudge } from "@/lib/digest/build";
import { sendEmail } from "@/lib/email/send";
import { db } from "@/lib/db/client";
import { digests } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  studentId: z.string().uuid(),
  kind: z.enum(["monthly", "weekly"]),
});

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);
    const { studentId, kind } = parsed.data;

    const owned = await resolveParentOwnedStudent(studentId);
    if (!owned.ok) return owned.response;

    const parent = await requireParent();
    const studentName = owned.student.name.split(" ")[0] ?? owned.student.name;

    const message =
      kind === "monthly"
        ? await buildMonthly(studentId, studentName)
        : await buildWeeklyNudge(studentId, studentName);

    const result = await sendEmail({
      to: parent.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    await db.insert(digests).values({
      studentId,
      kind,
      subject: message.subject,
      body: message.text,
      channel: result.channel,
    });

    return NextResponse.json({ channel: result.channel, subject: message.subject });
  });
}
