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

  async embed(model: string, text: string): Promise<number[]> {
    const client = makeClient();
    const embedModel = client.getGenerativeModel({ model });
    const result = await embedModel.embedContent(text);
    return result.embedding.values;
  },
};

export class GeminiBlockedError extends Error {
  constructor(public readonly reason: string) {
    super(`Gemini blocked the request (reason: ${reason}).`);
    this.name = "GeminiBlockedError";
  }
}
