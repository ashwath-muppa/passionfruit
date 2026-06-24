// Typed access to AI configuration. All keys via env — never hardcoded.
// Hard-fails (by design) when a required value is missing.

import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env.local and set it.`,
    );
  }
  return v;
}

export const aiEnv = {
  get provider() {
    return process.env.AI_PROVIDER ?? "gemini";
  },
  get apiKey() {
    return required("GEMINI_API_KEY");
  },
  /** Cheap/fast model: parsing, classification, opportunity-matching. */
  get fastModel() {
    return process.env.FAST_MODEL ?? "gemini-2.0-flash";
  },
  /** Quality model: anything a kid or parent actually reads (mentor voice). */
  get qualityModel() {
    return process.env.QUALITY_MODEL ?? "gemini-2.5-pro";
  },
  get embeddingModel() {
    return process.env.EMBEDDING_MODEL ?? "text-embedding-004";
  },
};

export type ModelTier = "fast" | "quality";

export function modelForTier(tier: ModelTier): string {
  return tier === "fast" ? aiEnv.fastModel : aiEnv.qualityModel;
}
