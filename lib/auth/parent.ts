// Parent-mediated account model. The parent (auth user) is the account holder;
// every student belongs to a parent and all student data is owned by them.
// Ownership is enforced HERE in the data layer (RLS is a TODO seam).

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

/**
 * The parent row for the current auth user, auto-provisioned on first access.
 * Returns null if not authenticated.
 */
export async function getParent(): Promise<Parent | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const [existing] = await db
    .select()
    .from(parents)
    .where(eq(parents.authUserId, user.id))
    .limit(1);
  if (existing) return existing;

  const name =
    (user.user_metadata?.name as string | undefined) ?? null;
  const [created] = await db
    .insert(parents)
    .values({ authUserId: user.id, email: user.email ?? "", name })
    .returning();
  return created!;
}

/** For server components/pages: redirect to /login if not authenticated. */
export async function requireParent(): Promise<Parent> {
  const parent = await getParent();
  if (!parent) redirect("/login");
  return parent;
}

/** Returns the student only if it belongs to the current parent. */
export async function getOwnedStudent(studentId: string): Promise<Student | null> {
  const parent = await getParent();
  if (!parent) return null;
  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.parentId, parent.id)))
    .limit(1);
  return student ?? null;
}

/** Lists the current parent's students. */
export async function listStudents(): Promise<Student[]> {
  const parent = await getParent();
  if (!parent) return [];
  return db.select().from(students).where(eq(students.parentId, parent.id));
}
