// Student identity helpers. Students log in with a USERNAME, not an email —
// Supabase Auth is email-based, so we map a username to a synthetic email under
// a reserved domain. Shared by the student login form (client), the
// add-student backend, and the seed, so they always agree.
//
// Dependency-free (no "server-only") so both client and server can import it.

export const STUDENT_EMAIL_DOMAIN = "students.passionfruit.local";

/** Normalize a username (lowercase, trimmed, safe characters only). */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

/** The synthetic email a student username maps to for Supabase Auth. */
export function studentUsernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${STUDENT_EMAIL_DOMAIN}`;
}

/** True if an auth email belongs to a student (vs a real parent email). */
export function isStudentEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${STUDENT_EMAIL_DOMAIN}`);
}
