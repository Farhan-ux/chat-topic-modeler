/**
 * LLM API Client
 *
 * Direct browser → provider API calls (no server-side proxy).
 * Supports: Groq, Google AI Studio, OpenAI.
 *
 * All API calls happen from the browser using fetch().
 * API keys are kept in memory only (Zustand store) and never persisted to disk.
 */

import { RateLimiter, getRateLimits } from "./rate-limiter";

export type Provider = "groq" | "google" | "openai";

export interface LLMConfig {
  provider: Provider;
  apiKey: string;
  /** Fast model for Phase 1 chunk processing */
  fastModel: string;
  /** Capable model for Phase 3 final report */
  capableModel: string;
}

export const PROVIDER_MODELS: Record<
  Provider,
  { fast: string[]; capable: string[] }
> = {
  groq: {
    fast: ["llama-3.1-8b-instant", "llama-3.1-70b-versatile", "gemma2-9b-it"],
    // llama-3.3-70b-versatile is the most capable, but llama-3.1-70b-versatile
    // is a fallback if the user's Groq account lacks access to 3.3
    capable: [
      "llama-3.3-70b-versatile",
      "llama-3.1-70b-versatile",
      "llama-3.1-8b-instant",
    ],
  },
  google: {
    // According to the user's Google AI Studio dashboard, only ONE model has
    // actual free-tier quota available:
    //   Gemini 3.1 Flash Lite — 15 RPM, 250K TPM, 500 RPD
    // All other models show 0/0/0 quota. So we only suggest that one model
    // for both fast and capable (used for everything).
    // Users can still type any other model name manually if their account
    // has access to it (e.g. paid tier or future models).
    fast: ["gemini-3.1-flash-lite"],
    capable: ["gemini-3.1-flash-lite"],
  },
  openai: {
    // Real OpenAI models that are currently available on the OpenAI API.
    // gpt-4o-mini is cheap and fast (~$0.15/M input); gpt-4o is more capable.
    // gpt-4.1-mini and gpt-4.1-nano are the newer 2025 models — included as
    // fallbacks in case gpt-4o is unavailable on the user's account.
    fast: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1-nano"],
    capable: ["gpt-4o", "gpt-4.1", "gpt-4o-mini"],
  },
};

export const PROVIDER_INFO: Record<
  Provider,
  {
    name: string;
    signupUrl: string;
    description: string;
    /** Free-tier rate limits shown in the UI */
    rateLimits?: string;
  }
> = {
  groq: {
    name: "Groq",
    signupUrl: "https://console.groq.com",
    description: "Fastest processing (recommended)",
    rateLimits: "Free tier: 30 RPM, 14,400 RPD (llama-3.1-8b), 1,000 RPD (llama-3.3-70b)",
  },
  google: {
    name: "Google AI Studio",
    signupUrl: "https://aistudio.google.com",
    description: "Single model, generous token limits",
    rateLimits: "Gemini 3.1 Flash Lite: 15 RPM, 250K TPM, 500 RPD (only model with free quota)",
  },
  openai: {
    name: "OpenAI",
    signupUrl: "https://platform.openai.com",
    description: "Most capable models (paid)",
    rateLimits: "Paid: ~60 RPM, generous daily limits. Cost for 100k messages: ~$0.20",
  },
};

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed?: number;
  finishReason?: string;
}

export class LLMError extends Error {
  type:
    | "invalid_api_key"
    | "rate_limited"
    | "context_too_long"
    | "network"
    | "incomplete"
    | "model_unavailable"
    | "unknown";
  retryAfter?: number; // ms
  /** Raw response body from the API, for debugging */
  rawBody?: string;
  /** HTTP status code */
  status?: number;
  constructor(
    type: LLMError["type"],
    message: string,
    retryAfter?: number,
    rawBody?: string,
    status?: number
  ) {
    super(message);
    this.type = type;
    this.retryAfter = retryAfter;
    this.rawBody = rawBody;
    this.status = status;
    this.name = "LLMError";
  }
}

/**
 * Heuristic: does this API error body indicate a context-length issue?
 * We match on specific phrases to avoid false positives (the word "token"
 * alone is too generic — it appears in many error messages).
 */
function isContextLengthError(body: string): boolean {
  const lower = body.toLowerCase();
  return (
    lower.includes("context_length") ||
    lower.includes("context window") ||
    lower.includes("context length") ||
    lower.includes("maximum context length") ||
    lower.includes("input tokens exceed") ||
    lower.includes("too many input tokens") ||
    lower.includes("prompt is too long") ||
    lower.includes("input is too long") ||
    lower.includes("tokens_exceed") ||
    lower.includes("request too large") ||
    lower.includes("content_length") // 413 payload too large
  );
}

/**
 * Heuristic: does this error indicate the model is unavailable for this account?
 */
function isModelUnavailableError(body: string): boolean {
  const lower = body.toLowerCase();
  return (
    (lower.includes("model") && (lower.includes("not found") || lower.includes("not available") || lower.includes("does not exist"))) ||
    lower.includes("model_decommissioned") ||
    lower.includes("model_not_found")
  );
}

/**
 * Manages LLM clients across providers, with rate limiting and retry.
 */
export class LLMClient {
  private config: LLMConfig;
  private fastLimiter: RateLimiter;
  private capableLimiter: RateLimiter;

  constructor(config: LLMConfig) {
    this.config = config;
    this.fastLimiter = new RateLimiter(
      getRateLimits(config.provider, config.fastModel)
    );
    this.capableLimiter = new RateLimiter(
      getRateLimits(config.provider, config.capableModel)
    );
  }

  get provider() {
    return this.config.provider;
  }
  get fastModel() {
    return this.config.fastModel;
  }
  get capableModel() {
    return this.config.capableModel;
  }

  getRateStats() {
    return {
      fast: this.fastLimiter.getStats(),
      capable: this.capableLimiter.getStats(),
    };
  }

  /**
   * Send a chat completion request using the fast model.
   * If the primary fast model is unavailable for the user's account,
   * automatically try fallback fast models from PROVIDER_MODELS.
   */
  async fast(
    messages: ChatMessage[],
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<LLMResponse> {
    await this.fastLimiter.acquire();
    const fallbacks = PROVIDER_MODELS[this.config.provider].fast
      .filter((m) => m !== this.config.fastModel);
    const modelsToTry = [this.config.fastModel, ...fallbacks];
    let lastErr: unknown = null;
    for (const model of modelsToTry) {
      try {
        return await this.sendRequest(model, messages, options);
      } catch (err) {
        if (err instanceof LLMError && err.type === "model_unavailable") {
          lastErr = err;
          continue;
        }
        throw err;
      }
    }
    throw lastErr ?? new LLMError("unknown", "All fast models failed");
  }

  /**
   * Send a chat completion request using the capable model.
   * If the primary capable model is unavailable for the user's account,
   * automatically try fallback capable models from PROVIDER_MODELS.
   */
  async capable(
    messages: ChatMessage[],
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<LLMResponse> {
    await this.capableLimiter.acquire();
    const fallbacks = PROVIDER_MODELS[this.config.provider].capable
      .filter((m) => m !== this.config.capableModel);
    const modelsToTry = [this.config.capableModel, ...fallbacks];
    let lastErr: unknown = null;
    for (const model of modelsToTry) {
      try {
        return await this.sendRequest(model, messages, options);
      } catch (err) {
        if (err instanceof LLMError && err.type === "model_unavailable") {
          lastErr = err;
          continue; // try next fallback
        }
        throw err; // any other error → propagate
      }
    }
    throw lastErr ?? new LLMError("unknown", "All capable models failed");
  }

  /**
   * Validate the API key by making a minimal request using BOTH the fast and
   * capable models. Returns:
   *   - { valid: true } if both work
   *   - { valid: false, reason: "invalid_api_key" } if the key itself is rejected
   *   - { valid: false, reason: "model_unavailable", model, rawBody } if a model
   *     is not accessible (so the user can fix the model name in Advanced settings)
   *   - throws on network errors etc.
   */
  async validateKey(): Promise<
    | { valid: true }
    | { valid: false; reason: "invalid_api_key" | "model_unavailable" | "unknown"; message: string; model?: string; rawBody?: string }
  > {
    // Test fast model
    try {
      await this.sendRequest(
        this.config.fastModel,
        [{ role: "user", content: "Reply with the single word: OK" }],
        { maxTokens: 5 }
      );
    } catch (err) {
      if (err instanceof LLMError) {
        if (err.type === "invalid_api_key") {
          return {
            valid: false,
            reason: "invalid_api_key",
            message: err.message,
            rawBody: err.rawBody,
          };
        }
        if (err.type === "model_unavailable") {
          return {
            valid: false,
            reason: "model_unavailable",
            message: `The fast model "${this.config.fastModel}" is not available for your account. Try a different model name (use Advanced to change it).`,
            model: this.config.fastModel,
            rawBody: err.rawBody,
          };
        }
        if (err.type === "rate_limited") {
          // Can't test, but the key probably works
          // Continue to capable model test
        } else {
          return {
            valid: false,
            reason: "unknown",
            message: err.message,
            rawBody: err.rawBody,
          };
        }
      } else {
        throw err;
      }
    }

    // Test capable model (only if different from fast model)
    if (this.config.capableModel !== this.config.fastModel) {
      try {
        await this.sendRequest(
          this.config.capableModel,
          [{ role: "user", content: "Reply with the single word: OK" }],
          { maxTokens: 5 }
        );
      } catch (err) {
        if (err instanceof LLMError) {
          if (err.type === "invalid_api_key") {
            return {
              valid: false,
              reason: "invalid_api_key",
              message: err.message,
              rawBody: err.rawBody,
            };
          }
          if (err.type === "model_unavailable") {
            return {
              valid: false,
              reason: "model_unavailable",
              message: `The capable model "${this.config.capableModel}" is not available for your account. Try a different model name (use Advanced to change it).`,
              model: this.config.capableModel,
              rawBody: err.rawBody,
            };
          }
          // rate_limited or other — assume OK, let real calls surface issues
        } else {
          throw err;
        }
      }
    }

    return { valid: true };
  }

  /**
   * Underlying request method - dispatches to provider-specific endpoint.
   * Implements retry with exponential backoff for transient errors.
   */
  private async sendRequest(
    model: string,
    messages: ChatMessage[],
    options: { temperature?: number; maxTokens?: number },
    attempt = 0
  ): Promise<LLMResponse> {
    const { temperature = 0.7, maxTokens } = options;

    try {
      const response = await this.dispatchRequest(model, messages, temperature, maxTokens);
      return response;
    } catch (err) {
      if (err instanceof LLMError) {
        // Retry on network errors and rate limits (with backoff)
        const shouldRetry =
          (err.type === "network" || err.type === "incomplete") &&
          attempt < 3;

        if (err.type === "rate_limited") {
          const wait = err.retryAfter ?? 5_000;
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, wait));
            return this.sendRequest(model, messages, options, attempt + 1);
          }
        }

        if (shouldRetry) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 8000);
          await new Promise((r) => setTimeout(r, backoff));
          return this.sendRequest(model, messages, options, attempt + 1);
        }

        throw err;
      }
      throw err;
    }
  }

  private async dispatchRequest(
    model: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    switch (this.config.provider) {
      case "groq":
        return this.callGroq(model, messages, temperature, maxTokens);
      case "openai":
        return this.callOpenAI(model, messages, temperature, maxTokens);
      case "google":
        return this.callGoogle(model, messages, temperature, maxTokens);
    }
  }

  /**
   * Groq uses an OpenAI-compatible API.
   * Endpoint: https://api.groq.com/openai/v1/chat/completions
   */
  private async callGroq(
    model: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    let response: Response;
    try {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          ...(maxTokens ? { max_tokens: maxTokens } : {}),
        }),
      });
    } catch (err) {
      throw new LLMError("network", `Network error: ${(err as Error).message}`);
    }

    if (response.status === 401 || response.status === 403) {
      const text = await response.text();
      // 403 with "Forbidden" and Cloudflare server = geo-block, not bad key
      if (text.includes("Forbidden") && !text.includes("API key")) {
        throw new LLMError(
          "unknown",
          `Groq returned 403 Forbidden — this is usually a regional block. If you're using a VPN, try disabling it. Raw: ${text.slice(0, 200)}`,
          undefined,
          text,
          response.status
        );
      }
      throw new LLMError(
        "invalid_api_key",
        "Invalid API key. Get a free one at https://console.groq.com",
        undefined,
        text,
        response.status
      );
    }
    if (response.status === 429) {
      const retryAfter = parseFloat(
        response.headers.get("retry-after") ?? "5"
      );
      const text = await response.text();
      throw new LLMError(
        "rate_limited",
        "Rate limit exceeded. Cooling down...",
        retryAfter * 1000,
        text,
        response.status
      );
    }
    if (response.status === 413 || response.status === 400) {
      const text = await response.text();
      if (isContextLengthError(text)) {
        throw new LLMError(
          "context_too_long",
          "Input too long for model context window",
          undefined,
          text,
          response.status
        );
      }
      if (isModelUnavailableError(text)) {
        throw new LLMError(
          "model_unavailable",
          `The model "${model}" is not available for your account. Try a different model. Raw: ${text.slice(0, 200)}`,
          undefined,
          text,
          response.status
        );
      }
      throw new LLMError(
        "unknown",
        `Groq bad request (${response.status}): ${text.slice(0, 300)}`,
        undefined,
        text,
        response.status
      );
    }
    if (!response.ok) {
      const text = await response.text();
      throw new LLMError(
        "unknown",
        `Groq API error ${response.status}: ${text.slice(0, 300)}`,
        undefined,
        text,
        response.status
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const finishReason = data.choices?.[0]?.finish_reason;
    const tokensUsed = data.usage?.total_tokens;

    if (!content || (finishReason === "length" && content.length < 50)) {
      throw new LLMError("incomplete", "Response was incomplete");
    }
    return { content, tokensUsed, finishReason };
  }

  /**
   * OpenAI Chat Completions.
   * Endpoint: https://api.openai.com/v1/chat/completions
   */
  private async callOpenAI(
    model: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          ...(maxTokens ? { max_tokens: maxTokens } : {}),
        }),
      });
    } catch (err) {
      throw new LLMError("network", `Network error: ${(err as Error).message}`);
    }

    if (response.status === 401 || response.status === 403) {
      const text = await response.text();
      throw new LLMError(
        "invalid_api_key",
        `OpenAI rejected the API key (${response.status}). Get one at https://platform.openai.com. Raw: ${text.slice(0, 200)}`,
        undefined,
        text,
        response.status
      );
    }
    if (response.status === 429) {
      const retryAfter = parseFloat(
        response.headers.get("retry-after") ?? "10"
      );
      const text = await response.text();
      throw new LLMError(
        "rate_limited",
        "OpenAI rate limit exceeded. Cooling down...",
        retryAfter * 1000,
        text,
        response.status
      );
    }
    if (response.status === 400 || response.status === 413) {
      const text = await response.text();
      if (isContextLengthError(text)) {
        throw new LLMError(
          "context_too_long",
          "Input too long for OpenAI model context window",
          undefined,
          text,
          response.status
        );
      }
      throw new LLMError(
        "unknown",
        `OpenAI bad request (${response.status}): ${text.slice(0, 300)}`,
        undefined,
        text,
        response.status
      );
    }
    if (!response.ok) {
      const text = await response.text();
      throw new LLMError(
        "unknown",
        `OpenAI API error ${response.status}: ${text.slice(0, 300)}`,
        undefined,
        text,
        response.status
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const finishReason = data.choices?.[0]?.finish_reason;
    const tokensUsed = data.usage?.total_tokens;

    if (!content) {
      throw new LLMError("incomplete", "Empty response from OpenAI");
    }
    return { content, tokensUsed, finishReason };
  }

  /**
   * Google AI Studio (Gemini).
   * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
   */
  private async callGoogle(
    model: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;

    // Convert OpenAI-style messages to Gemini format
    const systemMessage = messages.find((m) => m.role === "system");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature,
        ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
      },
    };
    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: systemMessage.content }],
      };
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new LLMError("network", `Network error: ${(err as Error).message}`);
    }

    if (response.status === 400 || response.status === 403) {
      const text = await response.text();
      if (text.includes("API key not valid") || text.includes("API_KEY_INVALID") || text.includes("permission")) {
        throw new LLMError(
          "invalid_api_key",
          `Invalid Google AI API key. Get one at https://aistudio.google.com. Raw: ${text.slice(0, 200)}`,
          undefined,
          text,
          response.status
        );
      }
      if (isContextLengthError(text)) {
        throw new LLMError(
          "context_too_long",
          "Input too long for Gemini context window",
          undefined,
          text,
          response.status
        );
      }
      if (isModelUnavailableError(text)) {
        throw new LLMError(
          "model_unavailable",
          `The model "${model}" is not available. Try a different model. Raw: ${text.slice(0, 200)}`,
          undefined,
          text,
          response.status
        );
      }
      throw new LLMError(
        "unknown",
        `Google API error (${response.status}): ${text.slice(0, 300)}`,
        undefined,
        text,
        response.status
      );
    }
    if (response.status === 429) {
      const text = await response.text();
      throw new LLMError(
        "rate_limited",
        "Google AI rate limit exceeded. Cooling down...",
        15_000,
        text,
        response.status
      );
    }
    if (!response.ok) {
      const text = await response.text();
      throw new LLMError(
        "unknown",
        `Google API error ${response.status}: ${text.slice(0, 300)}`,
        undefined,
        text,
        response.status
      );
    }

    const data = await response.json();
    const content =
      data.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join("") ?? "";
    const finishReason = data.candidates?.[0]?.finishReason;
    const tokensUsed = data.usageMetadata?.totalTokenCount;

    if (!content) {
      throw new LLMError("incomplete", "Empty response from Google AI");
    }
    return { content, tokensUsed, finishReason };
  }
}

/**
 * Robustly extract JSON from an LLM response.
 * Handles: markdown fences, leading/trailing prose, partial JSON.
 */
export function extractJSON<T = unknown>(content: string): T {
  let text = content.trim();

  // Strip markdown code fences (both complete and incomplete)
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // Find the first { or [
  const startBrace = text.indexOf("{");
  const startBracket = text.indexOf("[");
  let start = -1;
  let openChar = "{";
  let closeChar = "}";

  if (startBrace === -1 && startBracket === -1) {
    throw new Error("No JSON object found in response");
  }
  if (startBrace === -1) {
    start = startBracket;
    openChar = "[";
    closeChar = "]";
  } else if (startBracket === -1) {
    start = startBrace;
  } else {
    start = Math.min(startBrace, startBracket);
    if (start === startBracket) {
      openChar = "[";
      closeChar = "]";
    }
  }

  // Track all open/close brackets (both {} and []) to find the true end
  // or detect if the JSON is truncated
  let depth = 0;
  let end = -1;
  let inString = false;
  let escape = false;
  // Track the stack of open bracket types so we can auto-close if truncated
  const stack: string[] = [];

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") {
      depth++;
      stack.push(ch);
    } else if (ch === "}" || ch === "]") {
      depth--;
      stack.pop();
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  let jsonStr: string;

  if (end === -1) {
    // JSON is truncated — try to auto-repair by closing open brackets/strings
    console.warn("JSON appears truncated, attempting auto-repair...");
    jsonStr = attemptJSONRepair(text.slice(start));
  } else {
    jsonStr = text.slice(start, end + 1);
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch (parseErr) {
    // If direct parse fails, try one more repair attempt
    if (end === -1) {
      // Already tried repair — give up with a useful error
      throw new Error(
        `Failed to parse JSON after auto-repair. Original error: ${(parseErr as Error).message}. ` +
        `JSON snippet (last 200 chars): ...${jsonStr.slice(-200)}`
      );
    } else {
      // Try repairing anyway (might have trailing comma issues etc.)
      try {
        const repaired = attemptJSONRepair(jsonStr);
        return JSON.parse(repaired) as T;
      } catch {
        throw new Error(
          `JSON parse failed: ${(parseErr as Error).message}. ` +
          `JSON snippet (last 200 chars): ...${jsonStr.slice(-200)}`
        );
      }
    }
  }
}

/**
 * Attempt to repair truncated or malformed JSON.
 * Handles:
 *   - Unterminated strings (closes the string)
 *   - Missing closing brackets/braces (adds them)
 *   - Trailing commas before closing brackets (removes them)
 *   - Incomplete key-value pairs at the end (trims them)
 */
function attemptJSONRepair(text: string): string {
  let repaired = text;

  // Step 1: Check if we're inside a string when the text ends
  let inString = false;
  let escape = false;
  let lastValidPos = 0;
  const stack: string[] = [];

  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      if (!inString) lastValidPos = i;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") {
      stack.push(ch);
    } else if (ch === "}" || ch === "]") {
      stack.pop();
    }
    lastValidPos = i;
  }

  // If we're inside a string, close it
  if (inString) {
    repaired += '"';
  }

  // Step 2: Try to trim any incomplete key-value pair at the end
  // Look for the last complete value (ends with }, ], ", number, true, false, null)
  // followed by an optional comma. Anything after that is incomplete.
  const lastCompleteMatch = repaired.match(
    /(?:[\}\]"\d]\s*|true\s*|false\s*|null\s*)(?:,\s*)?[^"\{\[\}\]\d]*$/
  );
  if (lastCompleteMatch && stack.length > 0) {
    // Check if there's an incomplete key without a value at the end
    // Pattern: "key": (with no value following) or "key" (no colon)
    const incompleteKeyMatch = repaired.match(/,\s*"[^"]*"\s*:?\s*$/);
    if (incompleteKeyMatch) {
      repaired = repaired.slice(0, incompleteKeyMatch.index);
    }
    // Also handle case where we're in the middle of a key name
    const incompleteKeyNameMatch = repaired.match(/,\s*"[^"]*$/);
    if (incompleteKeyNameMatch) {
      repaired = repaired.slice(0, incompleteKeyNameMatch.index);
    }
  }

  // Step 3: Remove any trailing comma (which would be invalid before our closing brackets)
  repaired = repaired.replace(/,\s*$/, "");

  // Step 4: Close all open brackets/braces in reverse order
  // Re-scan to find what's still open
  const stillOpen: string[] = [];
  inString = false;
  escape = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") {
      stillOpen.push(ch);
    } else if (ch === "}" || ch === "]") {
      stillOpen.pop();
    }
  }

  // Close in reverse order
  for (let i = stillOpen.length - 1; i >= 0; i--) {
    const open = stillOpen[i];
    repaired += open === "{" ? "}" : "]";
  }

  return repaired;
}
