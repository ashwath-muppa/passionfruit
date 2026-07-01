// Create a student profile under the current parent account, WITH the student's
// own login. Body: { name, age, grade, parentalConsent, username, password }.
// The under-13 COPPA flag is derived from age. A Supabase auth user is created
// for the student (service-role) and linked to the students row.

import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { students } from "@/lib/db/schema";
import { getParent } from "@/lib/auth/parent";
import { supabaseAdmin } from "@/lib/auth/admin";
import { normalizeUsername, studentUsernameToEmail } from "@/lib/auth/student-identity";
import { guard, jsonError } from "@/lib/api/helpers";

const bodySchema = z.object({
  name: z.string().min(1).max(80),
  age: z.number().int().min(8).max(18),
  grade: z.string().max(20).optional(),
  parentalConsent: z.boolean(),
  username: z.string().min(3).max(30),
  password: z.string().min(6).max(72),
});

export async function POST(req: Request) {
  return guard(async () => {
    const parent = await getParent();
    if (!parent) return jsonError(401, "Not authenticated");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);
    const { name, age, grade, parentalConsent, password } = parsed.data;

    const username = normalizeUsername(parsed.data.username);
    if (username.length < 3) {
      return jsonError(400, "Username must be at least 3 letters/numbers.");
    }

    const under13 = age < 13;
    // COPPA: a child under 13 cannot proceed without parental consent.
    if (under13 && !parentalConsent) {
      return jsonError(403, "Parental consent is required for children under 13.");
    }

    // 1) Create the student row (owned by the parent).
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
    const studentId = student!.id;

    // 2) Create the student's auth account (username → synthetic email).
    const admin = supabaseAdmin();
    const created = await admin.auth.admin.createUser({
      email: studentUsernameToEmail(username),
      password,
      email_confirm: true,
      user_metadata: { role: "student", name, username },
    });

    if (created.error || !created.data.user) {
      // Roll back the student row so a taken username doesn't orphan a profile.
      await db.delete(students).where(eq(students.id, studentId));
      const msg = /already|exist|registered/i.test(created.error?.message ?? "")
        ? "That username is already taken. Pick another."
        : (created.error?.message ?? "Could not create the student login.");
      return jsonError(409, msg);
    }

    // 3) Link the auth account to the student row.
    await db
      .update(students)
      .set({ authUserId: created.data.user.id })
      .where(eq(students.id, studentId));

    return NextResponse.json({ studentId, username });
  });
}
