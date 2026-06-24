// Provider-agnostic model interface. Swapping providers = implementing this
// once (see providers/gemini.ts) and pointing AI_PROVIDER at it. Nothing above
// this layer knows which vendor is in use.

export interface GenerateTextParams {
  model: string;
  /** Stable instruction block — structured first so context caching can be
   *  added later without reshuffling the cacheable prefix. */
  system: string;
  /** The variable, per-request content. */
  user: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GenerateJSONParams extends GenerateTextParams {
  /** JSON Schema the provider should constrain output to, when supported. */
  jsonSchema?: Record<string, unknown>;
}

export interface ModelProvider {
  readonly name: string;
  generateText(params: GenerateTextParams): Promise<string>;
  /** Returns a raw JSON string; callers validate with Zod. */
  generateJSON(params: GenerateJSONParams): Promise<string>;
  embed(model: string, text: string): Promise<number[]>;
}
