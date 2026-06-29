// Scheduled digest fan-out (#8). A cron (Vercel Cron, GitHub Action, etc.) hits
// this endpoint; it iterates every student, builds the appropriate digest, and
// sends it to that student's parent — falling back to on-screen logging when no
// email provider is configured. Each send is logged in `digests`.
//
// The KIND is selected via ?kind=monthly|weekly (default monthly), so the same
// route serves both a monthly schedule and a weekly schedule. Scheduling itself
// is config; this route only does the work.
//
// Protection: if CRON_SECRET is set, the request must carry a matching
// x-cron-secret header (else 401). In dev (no secret) it's open.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { digests, parents, students } from "@/lib/db/schema";
import { buildMonthly, buildWeeklyNudge } from "@/lib/digest/build";
import { sendEmail } from "@/lib/email/send";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "weekly" ? "weekly" : "monthly";

  // Join students → parents so we have each parent's email in one pass.
  const rows = await db
    .select({
      studentId: students.id,
      studentName: students.name,
      parentEmail: parents.email,
    })
    .from(students)
    .innerJoin(parents, eq(students.parentId, parents.id));

  let sent = 0;
  for (const row of rows) {
    const studentName = row.studentName.split(" ")[0] ?? row.studentName;
    try {
      const message =
        kind === "monthly"
          ? await buildMonthly(row.studentId, studentName)
          : await buildWeeklyNudge(row.studentId, studentName);

      const result = await sendEmail({
        to: row.parentEmail,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      await db.insert(digests).values({
        studentId: row.studentId,
        kind,
        subject: message.subject,
        body: message.text,
        channel: result.channel,
      });
      sent += 1;
    } catch (err) {
      // One bad student must not abort the whole run.
      console.error("[cron:digest] failed for student", row.studentId, err);
    }
  }

  return NextResponse.json({ sent, kind });
}
