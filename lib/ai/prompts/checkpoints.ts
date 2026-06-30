// Functional-checkpoint generation. Two prompts per checkpoint:
//  1) a web-grounded gather of REAL free resources (courses/videos/datasets)
//  2) a structured compose into the full CheckpointDetail (rationale,
//     difficulty, ordered step-by-step guide, deliverable), personalized to the
//     student's learner graph and the family's chosen end-goal.
// Research checkpoints get a specialized guide (question → lit review → paper).

import { MENTOR_PERSONA } from "./persona";
import { renderGraphContext } from "./context";
import { CHECKPOINT_TYPES, type CheckpointType } from "@/lib/types";
import type { LearnerGraphSnapshot } from "@/lib/db/queries";
import type { Milestone, Project } from "@/lib/db/schema";

interface CheckpointCtx {
  graph: LearnerGraphSnapshot;
  milestone: Milestone;
  project: Project | null;
  /** Parent-chosen end-goal direction, if set. */
  endGoalPref: string | null;
}

function header(ctx: CheckpointCtx): string {
  const lines = [
    renderGraphContext(ctx.graph),
    `\nPROJECT: ${ctx.project?.title ?? "(no project yet)"}`,
    `CHECKPOINT (week ${ctx.milestone.weekNo}): ${ctx.milestone.title}`,
  ];
  if (ctx.milestone.detail) lines.push(`Notes: ${ctx.milestone.detail}`);
  if (ctx.endGoalPref) lines.push(`Family end-goal direction: ${ctx.endGoalPref}`);
  return lines.join("\n");
}

/** Step 1 — grounded search for real, current, free-first resources. */
export function checkpointResourcesPrompt(ctx: CheckpointCtx): {
  system: string;
  user: string;
} {
  const system = `You research the best FREE, real, currently-available learning resources for a specific checkpoint a middle-schooler (11–15) is about to do. Use web search to find REAL links that exist right now.

Rules:
- Free-first. Prefer free courses, official docs, YouTube tutorials, public datasets, free tools. A paid option is allowed ONLY if clearly worth it and noted.
- NEVER recommend pay-to-publish, "everyone wins" credential mills, or sketchy upsells.
- Real, working URLs only. Prefer well-known providers (Coursera audit, Khan Academy, freeCodeCamp, Kaggle, YouTube, MIT OCW, official docs).
- Age-appropriate and beginner-friendly.`;

  const user = `${header(ctx)}

List 3–6 of the best free resources for THIS checkpoint. For each: title, provider, URL, kind (course/video/dataset/tool/reading), and one line on why it helps and its cost. Plain text list.`;
  return { system, user };
}

const TYPE_GUIDE = `Decide the checkpoint TYPE from these options: ${CHECKPOINT_TYPES.join(", ")}.
- "course": learn a skill via a course/tutorial; deliverable is usually a completion certificate or notes.
- "build": make something (app, game, model, analysis); give a COMPLETE step-by-step build guide assuming the student knows nothing, including practical steps (e.g. push code to GitHub). Deliverable is the repo/app/link.
- "creative": make an artifact (painting, design, story, video). Start with materials/setup, then technique, then the project. Deliverable is a photo/file of the finished piece.
- "research": a research-process step. Use the Research Accelerator path (brainstorm a question → literature review → write/submit). Deliverable is the question doc, annotated sources, or the paper.`;

/** Step 2 — compose the structured CheckpointDetail from graph + resources. */
export function checkpointDetailPrompt(
  ctx: CheckpointCtx,
  resourcesText: string,
): { system: string; user: string } {
  const system = `${MENTOR_PERSONA}

You turn one checkpoint into a self-contained mini-curriculum for THIS student. It must be concrete and completable — never vague filler.

${TYPE_GUIDE}

Write a step-by-step guide a middle-schooler can actually follow to completion (assume they know nothing). For build/creative/research types, be thorough and ordered. Use the real resources provided; attach a resource URL to a step when it helps. Every checkpoint ends in ONE concrete deliverable the student can add to their resume.

Output STRICT JSON only:
{
  "type": one of [${CHECKPOINT_TYPES.join(", ")}],
  "difficulty": "beginner" | "intermediate" | "advanced",
  "description": string,            // why this checkpoint, for THIS student's goals (2–3 sentences)
  "resources": [{"title":string,"provider":string,"url":string,"kind":"course"|"video"|"dataset"|"tool"|"reading"|"other","note":string}],
  "steps": [{"title":string,"detail":string,"resourceUrl":string?}],   // ordered, assume-nothing
  "deliverableKind": "certificate" | "repo" | "image" | "paper" | "link" | "other",
  "deliverableSpec": string,        // exactly what to produce and add to the resume
  "research": {"question":null,"sources":[],"outline":[]}   // ONLY when type="research", else omit
}`;

  const user = `${header(ctx)}

REAL RESOURCES FOUND (use these, keep the real URLs):
${resourcesText}

Produce the checkpoint detail JSON now.`;
  return { system, user };
}

/** JSON-schema for constrained decoding (mirrors the Zod schema in tasks.ts). */
export const checkpointResponseSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    type: { type: "string", enum: [...CHECKPOINT_TYPES] },
    difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    description: { type: "string" },
    resources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          provider: { type: "string" },
          url: { type: "string" },
          kind: {
            type: "string",
            enum: ["course", "video", "dataset", "tool", "reading", "other"],
          },
          note: { type: "string" },
        },
        required: ["title", "provider", "url", "kind", "note"],
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          resourceUrl: { type: "string" },
        },
        required: ["title", "detail"],
      },
    },
    deliverableKind: {
      type: "string",
      enum: ["certificate", "repo", "image", "paper", "link", "other"],
    },
    deliverableSpec: { type: "string" },
  },
  required: [
    "type",
    "difficulty",
    "description",
    "resources",
    "steps",
    "deliverableKind",
    "deliverableSpec",
  ],
};

export type { CheckpointType };
