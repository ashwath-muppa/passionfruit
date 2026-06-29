// Deadline & Calendar Engine (#4) — sync endpoint. POST { studentId }.
//
// Reads the student's anchored north-star target plus the top non-flagged
// matches, parses each deliverable's `cadence` into dated reminders, and writes
// them into the existing `opportunities` table so they surface automatically in
// the "Up next" dashboard card. Idempotent: clears prior deliverable-linked rows
// for this student before reinserting, so re-syncing never duplicates.

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { opportunities } from "@/lib/db/schema";
import type { Deliverable } from "@/lib/db/schema";
import { guard, jsonError, resolveOwnedStudent } from "@/lib/api/helpers";
import { getActiveTarget } from "@/lib/db/queries";
import { suggestTargetsForStudent } from "@/lib/deliverables/suggest";
import { parseDeadlines } from "@/lib/calendar/deadlines";

const bodySchema = z.object({ studentId: z.string().uuid() });

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);

    const owned = await resolveOwnedStudent(parsed.data.studentId);
    if (!owned.ok) return owned.response;
    const studentId = parsed.data.studentId;

    // Gather the deliverables worth dating: the anchored target (if any) plus the
    // top ~4 non-flagged matches. De-dupe by id so a target that also matches
    // isn't processed twice.
    const [active, matches] = await Promise.all([
      getActiveTarget(studentId),
      suggestTargetsForStudent(studentId),
    ]);

    const byId = new Map<string, Pick<Deliverable, "id" | "name" | "cadence" | "url">>();
    if (active) byId.set(active.deliverable.id, active.deliverable);
    for (const m of matches) {
      if (m.deliverable.prestigeTier === "flag") continue; // never a credential
      if (byId.size >= 5) break; // 1 target + up to 4 matches
      byId.set(m.deliverable.id, m.deliverable);
    }

    // Build the fresh rows from parsed cadences.
    const rows = [...byId.values()].flatMap((d) =>
      parseDeadlines(d).map((item) => ({
        studentId,
        kind: item.kind,
        title: item.title,
        whenHint: item.whenHint,
        deliverableId: d.id,
      })),
    );

    // Replace any previously-synced (deliverable-linked) rows for this student,
    // leaving free-form opportunities (deliverableId IS NULL) untouched.
    await db
      .delete(opportunities)
      .where(
        and(eq(opportunities.studentId, studentId), isNotNull(opportunities.deliverableId)),
      );

    if (rows.length > 0) {
      await db.insert(opportunities).values(rows);
    }

    return NextResponse.json({ count: rows.length });
  });
}
