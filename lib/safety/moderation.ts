// Safety layer. moderateContent() runs on EVERY AI input and output. Flagged
// content is written to the safety_flags escalation queue. Uses the FAST model
// (classification is cheap) via the gateway's low-level JSON primitive — it
// deliberately does NOT route through the audited task wrapper to avoid
// recursive moderation.

import "server-only";
import { z } from "zod";
import { generateJSON } from "@/lib/ai/gateway";
import { MODERATION_SYSTEM, moderationUser } from "@/lib/ai/prompts/moderation";
import { db } from "@/lib/db/client";
import { safetyFlags } from "@/lib/db/schema";
import type { ModerationResult } from "@/lib/types";

const moderationSchema = z.object({
  flagged: z.boolean(),
  severity: z.enum(["low", "medium", "high"]),
  categories: z.array(z.string()),
  reason: z.string(),
});

// Constrained-decoding schema mirroring moderationSchema. Forces a structurally
// valid verdict (notably the severity enum), so a malformed classifier reply
// can't slip past JSON.parse and trip the fail-safe path unnecessarily.
const moderationResponseSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    flagged: { type: "boolean" },
    severity: { type: "string", enum: ["low", "medium", "high"] },
    categories: { type: "array", items: { type: "string" } },
    reason: { type: "string" },
  },
  required: ["flagged", "severity", "categories", "reason"],
};

export interface ModerationContext {
  direction: "input" | "output";
  studentId?: string | null;
  /** Links the flag back to the audit row, when available. */
  aiInteractionId?: string | null;
}

/**
 * Classify a single piece of content. Always returns a result (fails safe:
 * on a classifier error we flag as low-severity "needs review" rather than
 * silently passing). Writes to the escalation queue when flagged.
 */
export async function moderateContent(
  content: string,
  ctx: ModerationContext,
): Promise<ModerationResult> {
  let result: ModerationResult;

  try {
    const raw = await generateJSON({
      tier: "fast",
      system: MODERATION_SYSTEM,
      user: moderationUser(ctx.direction, content),
      temperature: 0,
      maxOutputTokens: 512,
      jsonSchema: moderationResponseSchema,
    });
    result = moderationSchema.parse(JSON.parse(raw));
  } catch (err) {
    // Fail safe: don't let a classifier hiccup pass content through unchecked.
    result = {
      flagged: true,
      severity: "low",
      categories: ["classifier_error"],
      reason: `Moderation classifier failed: ${(err as Error).message}`,
    };
  }

  if (result.flagged) {
    await db.insert(safetyFlags).values({
      studentId: ctx.studentId ?? null,
      aiInteractionId: ctx.aiInteractionId ?? null,
      severity: result.severity,
      categories: result.categories,
      content,
    });
  }

  return result;
}
