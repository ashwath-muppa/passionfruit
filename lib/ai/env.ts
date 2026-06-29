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
    return process.env.FAST_MODEL ?? "gemini-2.5-flash-lite";
  },
  /** Quality model: anything a kid or parent actually reads (mentor voice).
   *  Defaulted to flash-lite for fast, free-tier-friendly testing; bump to
   *  gemini-2.5-flash / gemini-2.5-pro for richer voice via env. */
  get qualityModel() {
    return process.env.QUALITY_MODEL ?? "gemini-2.5-flash-lite";
  },
  get embeddingModel() {
    return process.env.EMBEDDING_MODEL ?? "gemini-embedding-001";
  },
  /** Embedding width requested from the provider. MUST match the pgvector
   *  column width in the schema (vector(768)). */
  get embeddingDimensions() {
    return Number(process.env.EMBEDDING_DIMENSIONS ?? "768");
  },

  // ── Vertex AI (only required when AI_PROVIDER=vertex) ──
  /** GCP project that owns the Vertex calls (billed to its credits). */
  get vertexProject() {
    return required("GOOGLE_CLOUD_PROJECT");
  },
  /** Vertex regional endpoint (model availability varies by region). */
  get vertexLocation() {
    return process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
  },
};

export type ModelTier = "fast" | "quality";

export function modelForTier(tier: ModelTier): string {
  return tier === "fast" ? aiEnv.fastModel : aiEnv.qualityModel;
}
