// The public AI surface the app calls. Every function here is audited and
// moderated (input + output). Routes/UI should ONLY call these — never the
// gateway directly.

import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { generateJSON, generateText, generateGrounded, activeModels } from "./gateway";
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
  CheckpointDetail,
  IntakeExtraction,
  ParentSummary,
  ProjectPathCandidate,
  WeeklyStep,
} from "@/lib/types";
import { PATH_TYPES, CHECKPOINT_TYPES } from "@/lib/types";
import type { Milestone, Project } from "@/lib/db/schema";
import {
  INTAKE_COMPLETE_TOKEN,
  intakeExtractionPrompt,
  intakeReplyPrompt,
} from "./prompts/intake";
import { pathsPrompt } from "./prompts/paths";
import { planPrompt } from "./prompts/plan";
import { parentSummaryPrompt } from "./prompts/parentSummary";
import {
  checkpointResourcesPrompt,
  checkpointDetailPrompt,
  checkpointResponseSchema,
} from "./prompts/checkpoints";

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
  /** Response schema for constrained JSON decoding (auditedJSON only). */
  jsonSchema?: Record<string, unknown>;
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
      jsonSchema: call.jsonSchema,
    }),
  );
  return schema.parse(JSON.parse(raw));
}

/** Web-grounded generation, audited + moderated (real, current sources). */
function auditedGrounded(call: AuditedCall): Promise<string> {
  return runAudited(call, () =>
    generateGrounded({
      tier: call.tier,
      system: call.system,
      user: call.user,
      maxOutputTokens: call.maxOutputTokens,
      temperature: call.temperature ?? 0.2,
    }),
  );
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

// ── Gemini response schemas (constrained decoding) ──
// These mirror the Zod schemas above and are passed to the provider so the
// model emits structurally valid JSON (enums, array bounds, required fields)
// at decode time. Zod still parses the result as the final backstop. Kept as
// plain JSON-Schema objects so any provider that supports response schemas can
// consume them; unsupported providers ignore the field.
type JsonSchema = Record<string, unknown>;
const str: JsonSchema = { type: "string" };

const extractionResponseSchema: JsonSchema = {
  type: "object",
  properties: {
    interests: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: str,
          category: str,
          strength: { type: "number" },
        },
        required: ["label", "category", "strength"],
      },
    },
    strengths: {
      type: "array",
      items: {
        type: "object",
        properties: { label: str, evidence: str },
        required: ["label", "evidence"],
      },
    },
    constraints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["time", "budget", "location", "other"] },
          value: str,
        },
        required: ["kind", "value"],
      },
    },
    goals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          horizon: { type: "string", enum: ["short", "long"] },
          text: str,
        },
        required: ["horizon", "text"],
      },
    },
    observations: { type: "array", items: str },
  },
  required: ["interests", "strengths", "constraints", "goals", "observations"],
};

const pathsResponseSchema: JsonSchema = {
  type: "object",
  properties: {
    paths: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          pathType: { type: "string", enum: [...PATH_TYPES] },
          title: str,
          pitch: str,
          whyThisFitsYou: str,
          difficulty: { type: "integer" },
          estimatedWeeks: { type: "integer" },
          finalArtifact: str,
        },
        required: [
          "pathType",
          "title",
          "pitch",
          "whyThisFitsYou",
          "difficulty",
          "estimatedWeeks",
          "finalArtifact",
        ],
      },
    },
  },
  required: ["paths"],
};

const planResponseSchema: JsonSchema = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          weekNo: { type: "integer" },
          title: str,
          detail: str,
          dueHint: str,
        },
        required: ["weekNo", "title", "detail", "dueHint"],
      },
    },
  },
  required: ["steps"],
};

const parentSummaryResponseSchema: JsonSchema = {
  type: "object",
  properties: {
    headline: str,
    body: str,
    suggestedActions: { type: "array", items: str },
  },
  required: ["headline", "body", "suggestedActions"],
};

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
      // Extraction is a faithful read of what the student said — keep it
      // deterministic so the graph isn't seeded with invented signals.
      temperature: 0,
      jsonSchema: extractionResponseSchema,
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
      jsonSchema: pathsResponseSchema,
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
      jsonSchema: planResponseSchema,
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
      jsonSchema: parentSummaryResponseSchema,
    },
    parentSummarySchema,
  );
}

// ── Functional checkpoint detail (lazy, grounded, personalized) ──
const checkpointSchema: z.ZodType<CheckpointDetail> = z.object({
  type: z.enum(CHECKPOINT_TYPES),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  description: z.string(),
  resources: z.array(
    z.object({
      title: z.string(),
      provider: z.string(),
      url: z.string(),
      kind: z.enum(["course", "video", "dataset", "tool", "reading", "other"]),
      note: z.string(),
    }),
  ),
  steps: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      resourceUrl: z.string().optional(),
    }),
  ),
  deliverableKind: z.enum(["certificate", "repo", "image", "paper", "link", "other"]),
  deliverableSpec: z.string(),
  research: z
    .object({
      question: z.string().nullable(),
      sources: z.array(
        z.object({ title: z.string(), url: z.string().optional(), note: z.string().optional() }),
      ),
      outline: z.array(z.string()),
    })
    .optional(),
});

/**
 * Build the full mini-curriculum for one checkpoint: web-grounded REAL resources
 * → structured detail (rationale, difficulty, step-by-step guide, deliverable),
 * personalized to the learner graph. Called lazily on first open and cached.
 */
export async function generateCheckpointDetail(args: {
  studentId: string;
  milestone: Milestone;
  project: Project | null;
  endGoalPref: string | null;
}): Promise<CheckpointDetail> {
  const graph = await getLearnerGraphSnapshot(args.studentId);
  if (!graph) throw new Error("Student not found");

  const ctx = {
    graph,
    milestone: args.milestone,
    project: args.project,
    endGoalPref: args.endGoalPref,
  };

  // 1) Grounded gather of real, free resources. Degrade gracefully — if the
  //    grounded call fails (quota/no tool), compose from the model's knowledge.
  let resourcesText = "";
  try {
    const rp = checkpointResourcesPrompt(ctx);
    resourcesText = await auditedGrounded({
      task: "plan_steps",
      tier: "quality",
      system: rp.system,
      user: rp.user,
      studentId: args.studentId,
      maxOutputTokens: 1200,
      temperature: 0.2,
    });
  } catch {
    resourcesText = "(no grounded results — use well-known free resources you are confident exist)";
  }

  // 2) Compose the structured detail.
  const dp = checkpointDetailPrompt(ctx, resourcesText);
  const detail = await auditedJSON(
    {
      task: "plan_steps",
      tier: "quality",
      system: dp.system,
      user: dp.user,
      studentId: args.studentId,
      maxOutputTokens: 4000,
      temperature: 0.5,
      jsonSchema: checkpointResponseSchema,
    },
    checkpointSchema,
  );

  // Ensure research checkpoints carry an (empty) working state to start.
  if (detail.type === "research" && !detail.research) {
    detail.research = { question: null, sources: [], outline: [] };
  }
  return detail;
}
