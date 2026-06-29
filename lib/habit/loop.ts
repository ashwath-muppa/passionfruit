// ──────────────────────────────────────────────────────────────────────────
// Weekly Habit Loop (#6) — the retention engine.
//
// The recurring rhythm: Monday "here's your focus this week" (1–3 small tasks
// tied to the current project milestone) → Friday celebrate. One weekly_focus
// row per student per week, AI-phrased in Sage's voice but ALWAYS with a
// deterministic, non-AI fallback (the dev Gemini key is free-tier and may be
// quota-exhausted; this surface must never hard-fail).
// ──────────────────────────────────────────────────────────────────────────

import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { weeklyFocus } from "@/lib/db/schema";
import type { Milestone, WeeklyFocus } from "@/lib/db/schema";
import { getActiveProject } from "@/lib/db/queries";
import { generateJSON } from "@/lib/ai/gateway";
import { MENTOR_PERSONA } from "@/lib/ai/prompts/persona";

type FocusTask = { text: string; done: boolean };

/** Monday 00:00 (local) of the week containing `d`. Weeks start on Monday so the
 *  "here's your week" card lands with the Monday cadence the product promises. */
export function startOfWeek(d: Date = new Date()): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  // getDay(): 0=Sun..6=Sat. Days since Monday: Sun→6, Mon→0, … Sat→5.
  const sinceMonday = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - sinceMonday);
  return out;
}

/**
 * The student's focus for the current week: the latest weekly_focus row whose
 * weekStart is in the current week; if none, the latest open row (so a card
 * generated late on a Sunday still shows). Returns null if there is none.
 */
export async function getCurrentFocus(studentId: string): Promise<WeeklyFocus | null> {
  const weekStart = startOfWeek();
  const [thisWeek] = await db
    .select()
    .from(weeklyFocus)
    .where(and(eq(weeklyFocus.studentId, studentId), gte(weeklyFocus.weekStart, weekStart)))
    .orderBy(desc(weeklyFocus.weekStart), desc(weeklyFocus.createdAt))
    .limit(1);
  if (thisWeek) return thisWeek;

  const [latestOpen] = await db
    .select()
    .from(weeklyFocus)
    .where(and(eq(weeklyFocus.studentId, studentId), eq(weeklyFocus.status, "open")))
    .orderBy(desc(weeklyFocus.weekStart), desc(weeklyFocus.createdAt))
    .limit(1);
  return latestOpen ?? null;
}

/** Split a milestone's detail/coach prose into 1–2 short, doable task lines. */
function fallbackTasks(milestone: Milestone): FocusTask[] {
  const source = (milestone.coach ?? milestone.detail ?? "").trim();
  const sentences = source
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().replace(/[.;:]+$/, ""))
    .filter((s) => s.length > 0)
    .slice(0, 2);

  const tasks: FocusTask[] =
    sentences.length > 0
      ? sentences.map((text) => ({ text, done: false }))
      : [{ text: `Make a first small move on “${milestone.title}”`, done: false }];

  // Always leave them with a tiny, momentum-building closer.
  if (tasks.length < 2) {
    tasks.push({ text: "Jot one line on what you learned", done: false });
  }
  return tasks;
}

/** Deterministic, AI-free focus derived purely from the current milestone. */
function fallbackFocus(milestone: Milestone): { headline: string; tasks: FocusTask[] } {
  return {
    headline: `This week: ${milestone.title}`,
    tasks: fallbackTasks(milestone),
  };
}

const AI_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    tasks: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
  },
  required: ["headline", "tasks"],
} as const;

/**
 * Ask Sage to phrase a warm Monday headline + 1–3 small tasks for THIS
 * milestone. Returns null on any error / quota exhaustion so the caller falls
 * back to the deterministic version. Uses the `fast` tier (low-stakes, cheap).
 */
async function aiFocus(
  studentName: string,
  projectTitle: string,
  milestone: Milestone,
): Promise<{ headline: string; tasks: FocusTask[] } | null> {
  try {
    const raw = await generateJSON({
      tier: "fast",
      temperature: 0.6,
      maxOutputTokens: 400,
      jsonSchema: AI_SCHEMA as unknown as Record<string, unknown>,
      system: `${MENTOR_PERSONA}

It is Monday. Write this week's focus for the student — a warm, specific headline and 1–3 SMALL tasks they can actually finish this week. Tie everything to the current milestone. Keep each task to one short line, action-first ("Sketch…", "Find…", "Write…"). No fluff, no numbering. Return ONLY JSON: { "headline": string, "tasks": string[] }.`,
      user: `Student: ${studentName}
Project: ${projectTitle}
This week's milestone: ${milestone.title}${
        milestone.detail ? `\nWhat it involves: ${milestone.detail}` : ""
      }${milestone.coach ? `\nCoaching note: ${milestone.coach}` : ""}`,
    });

    const parsed = JSON.parse(raw) as { headline?: unknown; tasks?: unknown };
    const headline = typeof parsed.headline === "string" ? parsed.headline.trim() : "";
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
          .slice(0, 3)
          .map((text) => ({ text, done: false }))
      : [];

    if (!headline || tasks.length === 0) return null;
    return { headline, tasks };
  } catch {
    // Quota exhausted, network error, malformed JSON — degrade gracefully.
    return null;
  }
}

/**
 * Build & persist this week's focus for a student.
 *
 * Loads the active project + its CURRENT milestone (first non-done; falls back
 * to the last one if all are done). Tries Sage's voice, falls back to a
 * deterministic version on ANY error. UPSERTs exactly one row for the current
 * week (deletes any existing rows for this week first, then inserts).
 */
export async function generateWeeklyFocus(studentId: string): Promise<WeeklyFocus> {
  const weekStart = startOfWeek();
  const active = await getActiveProject(studentId);

  let headline: string;
  let tasks: FocusTask[];

  if (!active || active.milestones.length === 0) {
    // No project yet — still give them a gentle, real next move.
    headline = "This week: pick your path";
    tasks = [
      { text: "Open your plan and choose a project direction with Sage", done: false },
      { text: "Jot one thing you're curious about right now", done: false },
    ];
  } else {
    const current =
      active.milestones.find((m) => m.status !== "done") ??
      active.milestones[active.milestones.length - 1]!;

    const ai = await aiFocus(
      // student name isn't loaded here; project context is enough for phrasing.
      "your student",
      active.project.title,
      current,
    );
    const built = ai ?? fallbackFocus(current);
    headline = built.headline;
    tasks = built.tasks;
  }

  // UPSERT: one focus row per student per week. Clear this week's rows, insert.
  await db
    .delete(weeklyFocus)
    .where(and(eq(weeklyFocus.studentId, studentId), gte(weeklyFocus.weekStart, weekStart)));

  const [row] = await db
    .insert(weeklyFocus)
    .values({ studentId, weekStart, headline, tasks, status: "open" })
    .returning();
  return row!;
}

/** Mark a week's focus as celebrated (the Friday "we did it" moment). */
export async function celebrateFocus(focusId: string, studentId: string): Promise<void> {
  await db
    .update(weeklyFocus)
    .set({ status: "celebrated" })
    .where(and(eq(weeklyFocus.id, focusId), eq(weeklyFocus.studentId, studentId)));
}

/** Flip tasks[index].done on a focus row and persist. Returns the updated row. */
export async function toggleFocusTask(
  focusId: string,
  studentId: string,
  index: number,
): Promise<WeeklyFocus> {
  const [focus] = await db
    .select()
    .from(weeklyFocus)
    .where(and(eq(weeklyFocus.id, focusId), eq(weeklyFocus.studentId, studentId)))
    .limit(1);
  if (!focus) throw new Error("Focus not found");

  const tasks = focus.tasks ?? [];
  if (index < 0 || index >= tasks.length) {
    throw new Error("Task index out of range");
  }
  const next: FocusTask[] = tasks.map((t, i) =>
    i === index ? { text: t.text, done: !t.done } : t,
  );

  const [updated] = await db
    .update(weeklyFocus)
    .set({ tasks: next })
    .where(and(eq(weeklyFocus.id, focusId), eq(weeklyFocus.studentId, studentId)))
    .returning();
  return updated!;
}
