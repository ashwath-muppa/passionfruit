// Weekly cron entry point (#6): regenerate every student's "here's your week"
// focus card. Real scheduling lives in Supabase pg_cron or vercel.json crons
// (configured outside this codebase) — this route is just the work it triggers.
//
// Auth: if CRON_SECRET is set, require a matching x-cron-secret header; if it is
// unset (local dev), allow. This is a system endpoint — no parent session.

import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { students } from "@/lib/db/schema";
import { generateWeeklyFocus } from "@/lib/habit/loop";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.select({ id: students.id }).from(students);

  let generated = 0;
  for (const { id } of rows) {
    try {
      await generateWeeklyFocus(id);
      generated += 1;
    } catch (err) {
      // One student's failure (e.g. a transient DB/AI hiccup) must not abort the
      // whole run. generateWeeklyFocus already degrades AI gracefully; this is a
      // belt-and-suspenders guard so the cron always finishes the batch.
      console.error(`[cron/weekly] failed for student ${id}:`, err);
    }
  }

  return NextResponse.json({ generated, total: rows.length });
}
