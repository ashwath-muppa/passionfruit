// The single typed entry point for model calls. Selects the provider from env
// and exposes low-level primitives. Higher-level, audited+moderated task
// functions live in tasks.ts. This module is intentionally DB-free so it can be
// imported by retrieval helpers without a dependency cycle.

import "server-only";
import { aiEnv, modelForTier, type ModelTier } from "./env";
import { geminiProvider } from "./providers/gemini";
import type {
  GenerateJSONParams,
  GenerateTextParams,
  ModelProvider,
} from "./provider";

function selectProvider(): ModelProvider {
  switch (aiEnv.provider) {
    case "gemini":
      return geminiProvider;
    // TODO(seam): case "openai": return openaiProvider;
    // TODO(seam): case "anthropic": return anthropicProvider;
    default:
      throw new Error(
        `Unknown AI_PROVIDER "${aiEnv.provider}". Supported: gemini.`,
      );
  }
}

const provider = selectProvider();

export interface TextRequest extends Omit<GenerateTextParams, "model"> {
  tier: ModelTier;
}
export interface JSONRequest extends Omit<GenerateJSONParams, "model"> {
  tier: ModelTier;
}

/** Low-level text generation. Most callers should use a task fn in tasks.ts. */
export function generateText(req: TextRequest): Promise<string> {
  return provider.generateText({ ...req, model: modelForTier(req.tier) });
}

/** Low-level JSON generation. Caller validates the returned string with Zod. */
export function generateJSON(req: JSONRequest): Promise<string> {
  return provider.generateJSON({ ...req, model: modelForTier(req.tier) });
}

/** Web-grounded generation (real, current sources). Caller parses the result. */
export function generateGrounded(req: TextRequest): Promise<string> {
  return provider.generateGrounded({ ...req, model: modelForTier(req.tier) });
}

/** Embed text for semantic recall. Used by lib/db/retrieval.ts. */
export function embedText(text: string): Promise<number[]> {
  return provider.embed(aiEnv.embeddingModel, text);
}

export const activeModels = {
  fast: () => modelForTier("fast"),
  quality: () => modelForTier("quality"),
  embedding: () => aiEnv.embeddingModel,
  provider: () => provider.name,
};
