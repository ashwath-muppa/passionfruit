// Create a student profile under the current parent account. Body:
// { name, age, grade, parentalConsent }. The under-13 COPPA flag is derived
// from age and consent is captured at creation.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { students } from "@/lib/db/schema";
import { getParent } from "@/lib/auth/parent";
import { guard, jsonError } from "@/lib/api/helpers";

const bodySchema = z.object({
  name: z.string().min(1).max(80),
  age: z.number().int().min(8).max(18),
  grade: z.string().max(20).optional(),
  parentalConsent: z.boolean(),
});

export async function POST(req: Request) {
  return guard(async () => {
    const parent = await getParent();
    if (!parent) return jsonError(401, "Not authenticated");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);
    const { name, age, grade, parentalConsent } = parsed.data;

    const under13 = age < 13;
    // COPPA: a child under 13 cannot proceed without parental consent.
    if (under13 && !parentalConsent) {
      return jsonError(403, "Parental consent is required for children under 13.");
    }

    const [student] = await db
      .insert(students)
      .values({
        parentId: parent.id,
        name,
        age,
        grade,
        under13,
        parentalConsent,
        consentAt: parentalConsent ? new Date() : null,
      })
      .returning({ id: students.id });

    return NextResponse.json({ studentId: student!.id });
  });
}
