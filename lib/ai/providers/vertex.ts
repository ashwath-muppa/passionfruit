// Vertex AI implementation of ModelProvider. Same Gemini models, but billed to
// a Google Cloud project (uses your GCP credits + far higher quota). Auth is via
// Application Default Credentials (gcloud auth application-default login) — no
// API key. Selected by AI_PROVIDER=vertex.

import "server-only";
import { GoogleAuth } from "google-auth-library";
import { aiEnv } from "../env";
import type {
  GenerateJSONParams,
  GenerateTextParams,
  ModelProvider,
} from "../provider";

// Ages 11–15: keep provider-level safety filters on. moderateContent() is the
// second line of defense (explicit classification + escalation queue).
const safetySettings = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "BLOCK_MEDIUM_AND_ABOVE" }));

// One GoogleAuth instance; the underlying client caches + refreshes tokens.
const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
let cachedClient: Awaited<ReturnType<GoogleAuth["getClient"]>> | null = null;

async function accessToken(): Promise<string> {
  if (!cachedClient) cachedClient = await auth.getClient();
  const { token } = await cachedClient.getAccessToken();
  if (!token) throw new Error("Could not obtain a Vertex access token from ADC.");
  return token;
}

function modelUrl(model: string, method: "generateContent" | "predict"): string {
  const loc = aiEnv.vertexLocation;
  const proj = aiEnv.vertexProject;
  // The "global" endpoint uses the unprefixed host (and serves the newest
  // models, e.g. gemini-3.5-flash); regional endpoints prefix the host.
  const host =
    loc === "global"
      ? "https://aiplatform.googleapis.com"
      : `https://${loc}-aiplatform.googleapis.com`;
  return `${host}/v1/projects/${proj}/locations/${loc}/publishers/google/models/${model}:${method}`;
}

async function callJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Vertex request failed (${res.status}): ${detail.slice(0, 400)}`);
  }
  return res.json();
}

interface GenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

function textFromResponse(data: GenerateResponse): string {
  const blockReason = data.promptFeedback?.blockReason;
  if (blockReason) throw new VertexBlockedError(blockReason);
  const cand = data.candidates?.[0];
  if (cand?.finishReason === "SAFETY") throw new VertexBlockedError("SAFETY");
  return (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

// Gemini 2.5+ / 3.x are "thinking" models, and on Vertex `maxOutputTokens`
// counts thinking tokens too. Cap the thinking budget and add it ON TOP of the
// caller's intended answer size, so reasoning never truncates the (often JSON)
// answer. Keep some thinking — it lifts quality.
const THINKING_BUDGET = 1024;

function generationBody(params: GenerateTextParams, extra: Record<string, unknown> = {}) {
  return {
    contents: [{ role: "user", parts: [{ text: params.user }] }],
    systemInstruction: { parts: [{ text: params.system }] },
    safetySettings,
    generationConfig: {
      temperature: params.temperature ?? 0.7,
      thinkingConfig: { thinkingBudget: THINKING_BUDGET },
      maxOutputTokens: (params.maxOutputTokens ?? 2048) + THINKING_BUDGET,
      ...extra,
    },
  };
}

export const vertexProvider: ModelProvider = {
  name: "vertex",

  async generateText(params: GenerateTextParams): Promise<string> {
    const data = (await callJson(
      modelUrl(params.model, "generateContent"),
      generationBody(params),
    )) as GenerateResponse;
    return textFromResponse(data);
  },

  async generateJSON(params: GenerateJSONParams): Promise<string> {
    const data = (await callJson(
      modelUrl(params.model, "generateContent"),
      generationBody(
        { ...params, temperature: params.temperature ?? 0.4 },
        {
          responseMimeType: "application/json",
          ...(params.jsonSchema ? { responseSchema: params.jsonSchema } : {}),
        },
      ),
    )) as GenerateResponse;
    return textFromResponse(data);
  },

  async generateGrounded(params: GenerateTextParams): Promise<string> {
    const body = {
      ...generationBody({ ...params, temperature: params.temperature ?? 0.2 }),
      // Google Search grounding → real, current, citeable results (Gemini 2.x).
      tools: [{ googleSearch: {} }],
    };
    const data = (await callJson(
      modelUrl(params.model, "generateContent"),
      body,
    )) as GenerateResponse;
    return textFromResponse(data);
  },

  async embed(model: string, text: string): Promise<number[]> {
    // Vertex embeddings use the predict interface. outputDimensionality is
    // pinned to match the pgvector column width (vector(768)).
    const data = (await callJson(modelUrl(model, "predict"), {
      instances: [{ content: text }],
      parameters: { outputDimensionality: aiEnv.embeddingDimensions },
    })) as { predictions?: Array<{ embeddings?: { values?: number[] } }> };

    const values = data.predictions?.[0]?.embeddings?.values;
    if (!values || values.length === 0) {
      throw new Error("Vertex predict returned no embedding values.");
    }
    return values;
  },
};

export class VertexBlockedError extends Error {
  constructor(public readonly reason: string) {
    super(`Vertex blocked the request (reason: ${reason}).`);
    this.name = "VertexBlockedError";
  }
}
