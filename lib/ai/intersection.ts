// Intersection-Narrative generator (#10). Loads the learner graph, asks the
// model to fuse the kid's interests into one signature theme aimed at the
// parent's chosen end-goal, and validates the result. Mirrors the zod +
// Gemini-response-schema pattern in lib/ai/tasks.ts: the response schema
// constrains decoding, zod parses as the final backstop.

import "server-only";
import { z } from "zod";
import { generateJSON } from "./gateway";
import { intersectionPrompt } from "./prompts/intersection";
import { getLearnerGraphSnapshot } from "@/lib/db/queries";

export interface IntersectionResult {
  theme: string;
  pitch: string;
  interests: string[];
  suggestedVenue: string;
  whyUnique: string;
}

// ── Zod schema (final backstop) ──
const intersectionSchema: z.ZodType<IntersectionResult> = z.object({
  theme: z.string(),
  pitch: z.string(),
  interests: z.array(z.string()),
  suggestedVenue: z.string(),
  whyUnique: z.string(),
});

// ── Gemini response schema (constrained decoding) ──
// Plain JSON-Schema mirror of the zod shape so the model emits structurally
// valid JSON; providers that don't support response schemas ignore it.
type JsonSchema = Record<string, unknown>;
const str: JsonSchema = { type: "string" };

const intersectionResponseSchema: JsonSchema = {
  type: "object",
  properties: {
    theme: str,
    pitch: str,
    interests: { type: "array", items: str },
    suggestedVenue: str,
    whyUnique: str,
  },
  required: ["theme", "pitch", "interests", "suggestedVenue", "whyUnique"],
};

/** Tolerant JSON extraction: strip markdown fences / prose and isolate the
 *  object before parsing, so an occasional fenced or chatty model response
 *  still parses cleanly. */
function extractJson(raw: string): unknown {
  let s = raw.trim();
  // Strip ```json … ``` or ``` … ``` fences.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  // Isolate the outermost object if there's leading/trailing prose.
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  return JSON.parse(s);
}

/** Fuse a multi-interest student's interests into one signature theme (#10). */
export async function generateIntersection(
  studentId: string,
): Promise<IntersectionResult> {
  const graph = await getLearnerGraphSnapshot(studentId);
  if (!graph) throw new Error("Student not found");

  const { system, user } = intersectionPrompt({ graph });
  const raw = await generateJSON({
    tier: "quality",
    system,
    user,
    maxOutputTokens: 1000,
    temperature: 0.6,
    jsonSchema: intersectionResponseSchema,
  });

  return intersectionSchema.parse(extractJson(raw));
}
