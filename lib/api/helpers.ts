// Shared helpers for route handlers: JSON errors, ownership checks, and uniform
// handling of safety blocks.

import "server-only";
import { NextResponse } from "next/server";
import { getOwnedStudent, getParentOwnedStudent } from "@/lib/auth/parent";
import { SafetyBlockedError } from "@/lib/ai/tasks";
import type { Student } from "@/lib/db/schema";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Resolve a student the current parent owns, or return an error response.
 * Returns a discriminated result so callers can early-return cleanly.
 */
export async function resolveOwnedStudent(
  studentId: string | undefined,
): Promise<{ ok: true; student: Student } | { ok: false; response: NextResponse }> {
  if (!studentId) return { ok: false, response: jsonError(400, "studentId is required") };
  const student = await getOwnedStudent(studentId);
  if (!student) {
    // 404 (not 403) so we don't leak which ids exist.
    return { ok: false, response: jsonError(404, "Student not found") };
  }
  return { ok: true, student };
}

/**
 * Like resolveOwnedStudent, but PARENT-ONLY: a student session (even for their
 * own record) is rejected. For parent-steering actions students shouldn't take.
 */
export async function resolveParentOwnedStudent(
  studentId: string | undefined,
): Promise<{ ok: true; student: Student } | { ok: false; response: NextResponse }> {
  if (!studentId) return { ok: false, response: jsonError(400, "studentId is required") };
  const student = await getParentOwnedStudent(studentId);
  if (!student) {
    return { ok: false, response: jsonError(403, "This action is only available to a parent.") };
  }
  return { ok: true, student };
}

/** Wraps a handler body, mapping known errors to clean HTTP responses. */
export async function guard(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof SafetyBlockedError) {
      return NextResponse.json(
        {
          error: "blocked",
          message:
            "That message was held by our safety check. If something's wrong, please talk with a parent or trusted adult.",
        },
        { status: 422 },
      );
    }
    console.error("[api] handler error:", err);
    return jsonError(500, (err as Error).message ?? "Internal error");
  }
}
