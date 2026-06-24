// The public AI surface the app calls. Every function here is audited and
// moderated (input + output). Routes/UI should ONLY call these — never the
// gateway directly.

import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { generateJSON, generateText, activeModels } from "./gateway";
import type { ModelTier } from "./env";
import { db } from "@/lib/db/client";
import { aiInteractions } from "@/lib/db/schema";
import { logInteraction } from "@/lib/audit/log";
import { moderateContent } from "@/lib/safety/moderation";
import { getActiveProject, getLearnerGraphSnapshot } from "@/lib/db/queries";
import { semanticRecall } from "@/lib/db/retrieval";
import type { AiInteraction } from "@/lib/db/schema";
import type {
  ChatMessage,
  IntakeExtraction,
  ParentSummary,
  ProjectPathCandidate,
  WeeklyStep,
} from "@/lib/types";
import { PATH_TYPES } from "@/lib/types";
import {
  INTAKE_COMPLETE_TOKEN,
  intakeExtractionPrompt,
  intakeReplyPrompt,
} from "./prompts/intake";
import { pathsPrompt } from "./prompts/paths";
import { planPrompt } from "./prompts/plan";
import { parentSummaryPrompt } from "./prompts/parentSummary";

type AiTaskName = AiInteraction["task"];

/** Thrown when input is deemed high-severity unsafe; the call never reaches the model. */
export class SafetyBlockedError extends Error {
  constructor(public readonly direction: "input" | "output") {
    super(`Content blocked by safety layer (${direction}).`);
    this.name = "SafetyBlockedError";
  }
}

const SAFE_FALLBACK =
  "Let's pause here for a moment. I want to keep things safe and positive — it's a good time to check in with a parent or trusted adult.";

interface AuditedCall {
  task: AiTaskName;
  tier: ModelTier;
  system: string;
  user: string;
  studentId: string | null;
  maxOutputTokens?: number;
  temperature?: number;
}

/** Shared pipeline: moderate input → generate → audit → moderate output. */
async function runAudited(
  call: AuditedCall,
  generate: () => Promise<string>,
): Promise<string> {
  // 1) Moderate input. High severity never reaches the model.
  const inputMod = await moderateContent(call.user, {
    direction: "input",
    studentId: call.studentId,
  });
  if (inputMod.severity === "high") throw new SafetyBlockedError("input");

  // 2) Generate.
  const startedAt = Date.now();
  let output: string;
  try {
    output = await generate();
  } catch (err) {
    await logInteraction({
      studentId: call.studentId,
      task: call.task,
      model: activeModels[call.tier](),
      prompt: `${call.system}\n---\n${call.user}`,
      response: `ERROR: ${(err as Error).message}`,
      inputFlagged: inputMod.flagged,
      latencyMs: Date.now() - startedAt,
    });
    throw err;
  }
  const latencyMs = Date.now() - startedAt;

  // 3) Audit (one row per interaction).
  const interactionId = await logInteraction({
    studentId: call.studentId,
    task: call.task,
    model: activeModels[call.tier](),
    prompt: `${call.system}\n---\n${call.user}`,
    response: output,
    inputFlagged: inputMod.flagged,
    latencyMs,
  });

  // 4) Moderate output, linked to the audit row.
  const outputMod = await moderateContent(output, {
    direction: "output",
    studentId: call.studentId,
    aiInteractionId: interactionId,
  });
  if (outputMod.flagged) {
    await db
      .update(aiInteractions)
      .set({ outputFlagged: true })
      .where(eq(aiInteractions.id, interactionId));
  }
  if (outputMod.severity === "high") return SAFE_FALLBACK;

  return output;
}

function auditedText(call: AuditedCall): Promise<string> {
  return runAudited(call, () =>
    generateText({
      tier: call.tier,
      system: call.system,
      user: call.user,
      maxOutputTokens: call.maxOutputTokens,
      temperature: call.temperature,
    }),
  );
}

async function auditedJSON<T>(call: AuditedCall, schema: z.ZodType<T>): Promise<T> {
  const raw = await runAudited(call, () =>
    generateJSON({
      tier: call.tier,
      system: call.system,
      user: call.user,
      maxOutputTokens: call.maxOutputTokens,
      temperature: call.temperature ?? 0.4,
    }),
  );
  return schema.parse(JSON.parse(raw));
}

// ── Zod schemas for structured outputs ──
const extractionSchema: z.ZodType<IntakeExtraction> = z.object({
  interests: z.array(
    z.object({ label: z.string(), category: z.string(), strength: z.number().min(0).max(1) }),
  ),
  strengths: z.array(z.object({ label: z.string(), evidence: z.string() })),
  constraints: z.array(
    z.object({
      kind: z.enum(["time", "budget", "location", "other"]),
      value: z.string(),
    }),
  ),
  goals: z.array(z.object({ horizon: z.enum(["short", "long"]), text: z.string() })),
  observations: z.array(z.string()),
});

const pathsSchema = z.object({
  paths: z
    .array(
      z.object({
        pathType: z.enum(PATH_TYPES),
        title: z.string(),
        pitch: z.string(),
        whyThisFitsYou: z.string(),
        difficulty: z.number().min(1).max(5),
        estimatedWeeks: z.number().min(1).max(52),
        finalArtifact: z.string(),
      }),
    )
    .min(2)
    .max(3),
});

const planSchema = z.object({
  steps: z
    .array(
      z.object({
        weekNo: z.number().int().min(1),
        title: z.string(),
        detail: z.string(),
        dueHint: z.string(),
      }),
    )
    .min(1),
});

const parentSummarySchema: z.ZodType<ParentSummary> = z.object({
  headline: z.string(),
  body: z.string(),
  suggestedActions: z.array(z.string()),
});

// ── Public task functions ──

export interface IntakeTurnResult {
  reply: string;
  extraction: IntakeExtraction;
  complete: boolean;
}

/** One intake turn: warm mentor reply (quality) + graph extraction (fast). */
export async function runIntake(args: {
  studentId: string;
  student: Parameters<typeof intakeReplyPrompt>[0]["student"];
  messages: ChatMessage[];
}): Promise<IntakeTurnResult> {
  const replyP = intakeReplyPrompt({ student: args.student, messages: args.messages });
  const reply = await auditedText({
    task: "intake",
    tier: "quality",
    system: replyP.system,
    user: replyP.user,
    studentId: args.studentId,
    maxOutputTokens: 800,
    temperature: 0.8,
  });

  const extractP = intakeExtractionPrompt(args.messages);
  const extraction = await auditedJSON(
    {
      task: "intake",
      tier: "fast",
      system: extractP.system,
      user: extractP.user,
      studentId: args.studentId,
      maxOutputTokens: 1024,
    },
    extractionSchema,
  );

  const complete = reply.includes(INTAKE_COMPLETE_TOKEN);
  return {
    reply: reply.replace(INTAKE_COMPLETE_TOKEN, "").trim(),
    extraction,
    complete,
  };
}

/** Generate 2–3 personalized project paths from the learner graph. */
export async function matchProjectPaths(args: {
  studentId: string;
}): Promise<ProjectPathCandidate[]> {
  const graph = await getLearnerGraphSnapshot(args.studentId);
  if (!graph) throw new Error("Student not found");

  const recallQuery = [
    ...graph.interests.map((i) => i.label),
    ...graph.goals.map((g) => g.text),
  ].join(", ");
  const recall = recallQuery
    ? await semanticRecall(args.studentId, recallQuery, { perSource: 3 })
    : [];

  const { system, user } = pathsPrompt({ graph, recall });
  const result = await auditedJSON(
    {
      task: "match_paths",
      tier: "quality",
      system,
      user,
      studentId: args.studentId,
      maxOutputTokens: 3000,
      temperature: 0.6,
    },
    pathsSchema,
  );
  return result.paths;
}

/** Break a chosen path into an initial set of weekly steps. */
export async function planWeeklySteps(args: {
  studentId: string;
  chosen: ProjectPathCandidate;
}): Promise<WeeklyStep[]> {
  const graph = await getLearnerGraphSnapshot(args.studentId);
  if (!graph) throw new Error("Student not found");

  const { system, user } = planPrompt({ graph, chosen: args.chosen });
  const result = await auditedJSON(
    {
      task: "plan_steps",
      tier: "quality",
      system,
      user,
      studentId: args.studentId,
      maxOutputTokens: 3000,
      temperature: 0.5,
    },
    planSchema,
  );
  return result.steps;
}

/** Generate the parent-facing progress summary (rendered on the dashboard). */
export async function generateParentSummary(args: {
  studentId: string;
}): Promise<ParentSummary> {
  const graph = await getLearnerGraphSnapshot(args.studentId);
  if (!graph) throw new Error("Student not found");
  const project = await getActiveProject(args.studentId);

  const { system, user } = parentSummaryPrompt({ graph, project });
  return auditedJSON(
    {
      task: "parent_summary",
      tier: "quality",
      system,
      user,
      studentId: args.studentId,
      maxOutputTokens: 1500,
      temperature: 0.6,
    },
    parentSummarySchema,
  );
}
