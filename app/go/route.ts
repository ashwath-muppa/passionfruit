// Post-login router. Both login forms send the user here; we resolve their role
// and redirect: parents → their dashboard, students → their own page.

import { NextResponse } from "next/server";
import { getSessionActor } from "@/lib/auth/parent";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getSessionActor();
  const dest =
    actor.role === "parent"
      ? "/dashboard"
      : actor.role === "student"
        ? `/students/${actor.student.id}`
        : "/login";
  return NextResponse.redirect(new URL(dest, req.url));
}
