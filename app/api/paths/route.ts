// Generate 2–3 personalized project paths from the learner graph and snapshot
// them. Body: { studentId }.

import { NextResponse } from "next/server";
import { z } from "zod";
import { matchProjectPaths } from "@/lib/ai/tasks";
import { saveProjectPaths } from "@/lib/db/mutations";
import { guard, jsonError, resolveOwnedStudent } from "@/lib/api/helpers";

const bodySchema = z.object({ studentId: z.string().uuid() });

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);

    const owned = await resolveOwnedStudent(parsed.data.studentId);
    if (!owned.ok) return owned.response;

    const paths = await matchProjectPaths({ studentId: parsed.data.studentId });
    const pathsId = await saveProjectPaths(parsed.data.studentId, paths);

    return NextResponse.json({ pathsId, paths });
  });
}
