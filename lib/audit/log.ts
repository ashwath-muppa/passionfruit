// Audit logging — every AI interaction is recorded for later review.
// (student id, prompt, response, model, flags, latency, timestamp.)

import "server-only";
import { db } from "@/lib/db/client";
import { aiInteractions } from "@/lib/db/schema";
import type { AiInteraction } from "@/lib/db/schema";

type AiTaskName = AiInteraction["task"];

export interface LogInteractionInput {
  studentId: string | null;
  task: AiTaskName;
  model: string;
  prompt: string;
  response: string | null;
  inputFlagged?: boolean;
  outputFlagged?: boolean;
  latencyMs?: number;
}

/** Insert one audit row and return its id (used to link safety flags). */
export async function logInteraction(input: LogInteractionInput): Promise<string> {
  const [row] = await db
    .insert(aiInteractions)
    .values({
      studentId: input.studentId,
      task: input.task,
      model: input.model,
      prompt: input.prompt,
      response: input.response,
      inputFlagged: input.inputFlagged ?? false,
      outputFlagged: input.outputFlagged ?? false,
      latencyMs: input.latencyMs,
    })
    .returning({ id: aiInteractions.id });
  // `row` is always present on a successful single insert.
  return row!.id;
}
