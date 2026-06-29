// Weekly habit loop + activation actions (#6). One POST endpoint, dispatched by
// a discriminated `action`. Ownership is enforced via resolveOwnedStudent.
//
// Body (discriminated union on `action`):
//   { studentId, action: "generate" }                 → (re)build this week's focus
//   { studentId, action: "celebrate", focusId }       → mark the week celebrated
//   { studentId, action: "toggle", focusId, index }   → flip a task's done state
//   { studentId, action: "first-win" }                → record the activation win

import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, jsonError, resolveOwnedStudent } from "@/lib/api/helpers";
import {
  celebrateFocus,
  generateWeeklyFocus,
  getCurrentFocus,
  toggleFocusTask,
} from "@/lib/habit/loop";
import { getActivation, markFirstWin } from "@/lib/habit/activation";

const studentId = z.string().uuid();

const bodySchema = z.discriminatedUnion("action", [
  z.object({ studentId, action: z.literal("generate") }),
  z.object({ studentId, action: z.literal("celebrate"), focusId: z.string().uuid() }),
  z.object({
    studentId,
    action: z.literal("toggle"),
    focusId: z.string().uuid(),
    index: z.number().int().min(0),
  }),
  z.object({ studentId, action: z.literal("first-win") }),
]);

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);
    const body = parsed.data;

    const owned = await resolveOwnedStudent(body.studentId);
    if (!owned.ok) return owned.response;
    const id = owned.student.id;

    switch (body.action) {
      case "generate": {
        const focus = await generateWeeklyFocus(id);
        return NextResponse.json({ focus });
      }
      case "celebrate": {
        await celebrateFocus(body.focusId, id);
        const focus = await getCurrentFocus(id);
        return NextResponse.json({ focus });
      }
      case "toggle": {
        const focus = await toggleFocusTask(body.focusId, id, body.index);
        return NextResponse.json({ focus });
      }
      case "first-win": {
        await markFirstWin(id);
        const state = await getActivation(id);
        return NextResponse.json({ state });
      }
    }
  });
}
