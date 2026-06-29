// Gemini implementation of ModelProvider (Google Generative AI SDK).
// Default provider. To add OpenAI/Anthropic later: add a sibling file that
// implements ModelProvider and register it in gateway.ts.

import "server-only";
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";
import { aiEnv } from "../env";
import type {
  GenerateJSONParams,
  GenerateTextParams,
  ModelProvider,
} from "../provider";

// Product is for ages 11–15: keep provider-level safety filters at a low
// block threshold. This is the first line of defense; moderateContent() is the
// second (explicit classification + escalation queue).
const safetySettings = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({
  category,
  threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
}));

function makeClient() {
  return new GoogleGenerativeAI(aiEnv.apiKey);
}

export const geminiProvider: ModelProvider = {
  name: "gemini",

  async generateText(params: GenerateTextParams): Promise<string> {
    const client = makeClient();
    const model = client.getGenerativeModel({
      model: params.model,
      systemInstruction: params.system,
      safetySettings,
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: params.user }] }],
      generationConfig: {
        temperature: params.temperature ?? 0.7,
        maxOutputTokens: params.maxOutputTokens ?? 2048,
      },
    });
    const blockReason = result.response.promptFeedback?.blockReason;
    if (blockReason) {
      throw new GeminiBlockedError(blockReason);
    }
    return result.response.text();
  },

  async generateJSON(params: GenerateJSONParams): Promise<string> {
    const client = makeClient();
    const model = client.getGenerativeModel({
      model: params.model,
      systemInstruction: params.system,
      safetySettings,
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: params.user }] }],
      generationConfig: {
        temperature: params.temperature ?? 0.4,
        maxOutputTokens: params.maxOutputTokens ?? 2048,
        responseMimeType: "application/json",
        ...(params.jsonSchema
          ? { responseSchema: params.jsonSchema as object }
          : {}),
      },
    });
    const blockReason = result.response.promptFeedback?.blockReason;
    if (blockReason) {
      throw new GeminiBlockedError(blockReason);
    }
    return result.response.text();
  },

  async generateGrounded(params: GenerateTextParams): Promise<string> {
    const client = makeClient();
    const model = client.getGenerativeModel({
      model: params.model,
      systemInstruction: params.system,
      safetySettings,
      // Google Search grounding → real, current, citeable results (Gemini 2.x).
      tools: [{ googleSearch: {} }] as unknown as never,
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: params.user }] }],
      generationConfig: {
        temperature: params.temperature ?? 0.2,
        maxOutputTokens: params.maxOutputTokens ?? 2048,
      },
    });
    const blockReason = result.response.promptFeedback?.blockReason;
    if (blockReason) throw new GeminiBlockedError(blockReason);
    return result.response.text();
  },

  async embed(model: string, text: string): Promise<number[]> {
    // Called via REST so we can pin outputDimensionality to match the pgvector
    // column width (gemini-embedding-001 defaults to 3072, which exceeds the
    // pgvector HNSW 2000-dim index limit). Cosine ops don't require normalized
    // vectors, so reduced dimensions are safe for our recall.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(aiEnv.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          outputDimensionality: aiEnv.embeddingDimensions,
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Gemini embedContent failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    const data = (await res.json()) as { embedding?: { values?: number[] } };
    const values = data.embedding?.values;
    if (!values || values.length === 0) {
      throw new Error("Gemini embedContent returned no embedding values.");
    }
    return values;
  },
};

export class GeminiBlockedError extends Error {
  constructor(public readonly reason: string) {
    super(`Gemini blocked the request (reason: ${reason}).`);
    this.name = "GeminiBlockedError";
  }
}
