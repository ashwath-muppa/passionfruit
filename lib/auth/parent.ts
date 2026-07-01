// Account model. TWO kinds of auth user:
//   • a PARENT  → maps to a parents row (account holder)
//   • a STUDENT → maps to a students row (own login, created by the parent)
// Role is resolved from these DB links (not trusted metadata). Ownership is
// enforced here in the data layer (RLS is a TODO seam).

import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { parents, students } from "@/lib/db/schema";
import type { Parent, Student } from "@/lib/db/schema";
import { createSupabaseServerClient } from "./supabase-server";

export async function getAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The student row this auth user IS (their own login), or null. */
export async function getStudentSession(): Promise<Student | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.authUserId, user.id))
    .limit(1);
  return student ?? null;
}

/**
 * The parent row for the current auth user, auto-provisioned on first access.
 * Returns null if not authenticated OR if this auth user is a student.
 */
export async function getParent(): Promise<Parent | null> {
  const user = await getAuthUser();
  if (!user) return null;

  // A student auth user is never a parent.
  const [asStudent] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.authUserId, user.id))
    .limit(1);
  if (asStudent) return null;

  const [existing] = await db
    .select()
    .from(parents)
    .where(eq(parents.authUserId, user.id))
    .limit(1);
  if (existing) return existing;

  const name = (user.user_metadata?.name as string | undefined) ?? null;
  const [created] = await db
    .insert(parents)
    .values({ authUserId: user.id, email: user.email ?? "", name })
    .returning();
  return created!;
}

export type SessionActor =
  | { role: "parent"; parent: Parent }
  | { role: "student"; student: Student }
  | { role: "none" };

/** Who is signed in and in what role. */
export async function getSessionActor(): Promise<SessionActor> {
  const student = await getStudentSession();
  if (student) return { role: "student", student };
  const parent = await getParent();
  if (parent) return { role: "parent", parent };
  return { role: "none" };
}

/** For parent-only pages: redirect students to their own page, guests to login. */
export async function requireParent(): Promise<Parent> {
  const actor = await getSessionActor();
  if (actor.role === "parent") return actor.parent;
  if (actor.role === "student") redirect(`/students/${actor.student.id}`);
  redirect("/login");
}

/**
 * The student, if the current actor may VIEW it — the parent who owns it OR the
 * student themselves. Null otherwise (unauthenticated, or someone else's kid).
 */
export async function getOwnedStudent(studentId: string): Promise<Student | null> {
  const actor = await getSessionActor();
  if (actor.role === "student") {
    return actor.student.id === studentId ? actor.student : null;
  }
  if (actor.role === "parent") {
    const [student] = await db
      .select()
      .from(students)
      .where(and(eq(students.id, studentId), eq(students.parentId, actor.parent.id)))
      .limit(1);
    return student ?? null;
  }
  return null;
}

/** For student-facing pages: resolve the student + actor, or redirect to login. */
export async function requireStudentView(
  studentId: string,
): Promise<{ student: Student; actor: SessionActor }> {
  const student = await getOwnedStudent(studentId);
  if (!student) redirect("/login");
  const actor = await getSessionActor();
  return { student, actor };
}

/** Lists the current parent's students. Empty for a student session. */
export async function listStudents(): Promise<Student[]> {
  const parent = await getParent();
  if (!parent) return [];
  return db.select().from(students).where(eq(students.parentId, parent.id));
}
