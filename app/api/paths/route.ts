// Project paths — generate 2–3 personalized options ONCE, persist the snapshot,
// and serve it back forever. Body: { studentId, force? }. Only `force: true`
// (the user's "Regenerate ideas") calls the AI again.

import { NextResponse } from "next/server";
import { z } from "zod";
import { matchProjectPaths } from "@/lib/ai/tasks";
import { saveProjectPaths } from "@/lib/db/mutations";
import { getLatestProjectPaths } from "@/lib/db/queries";
import { guard, jsonError, resolveOwnedStudent } from "@/lib/api/helpers";

const bodySchema = z.object({
  studentId: z.string().uuid(),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);
    const { studentId, force } = parsed.data;

    const owned = await resolveOwnedStudent(studentId);
    if (!owned.ok) return owned.response;

    // Cache-first: return the stored snapshot unless a regenerate was requested.
    if (!force) {
      const cached = await getLatestProjectPaths(studentId);
      if (cached && cached.length > 0) {
        return NextResponse.json({ paths: cached, cached: true });
      }
    }

    const paths = await matchProjectPaths({ studentId });
    const pathsId = await saveProjectPaths(studentId, paths);
    return NextResponse.json({ pathsId, paths, cached: false });
  });
}
