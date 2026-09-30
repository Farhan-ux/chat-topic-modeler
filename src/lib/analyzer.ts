/**
 * Topic Analysis Orchestrator
 *
 * Runs the three-phase topic-modeling pipeline:
 *   Phase 1: Process each weekly chunk with the fast model → JSON topic summaries
 *   Phase 2: If too large, aggregate summaries by month with the fast model
 *   Phase 3: Feed aggregated summaries to the capable model → final topic report
 *
 * Emits progress callbacks at each step.
 * Supports cancellation via an AbortController-like signal.
 */

import type { ParseResult } from "./whatsapp-parser";
import { chunkChat, groupChunksByMonth, aggregateSummaries, batchChunks, type ChatChunk } from "./chunking";
import { LLMClient, LLMError, extractJSON, type ChatMessage } from "./llm-client";
import { buildChunkPrompt, buildBatchedChunkPrompt, buildMonthlyAggregationPrompt, buildFinalReportPrompt } from "./prompts";
import type { TopicReport } from "./report-types";

// ───────────────────────────────────────────────────────────────────────────
// Phase 1 result caching (localStorage)
// ───────────────────────────────────────────────────────────────────────────
// If Phase 3 fails (e.g. 503), the user shouldn't have to re-run Phase 1
// (which can take 40+ minutes and burn 400+ API requests). We cache each
// completed chunk summary to localStorage as it arrives, and on the next
// run with the same chat, we skip already-completed chunks.

const CACHE_PREFIX = "topic-modeler:phase1:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedPhase1 {
  chunkSummaries: (ChunkSummary | null)[];
  cachedAt: number;
  totalChunks: number;
}

function getCacheKey(parseResult: ParseResult): string {
  const participants = parseResult.participants.slice().sort().join("|");
  const msgCount = parseResult.messages.length;
  const dateRange = parseResult.dateRange
    ? `${parseResult.dateRange.start.getTime()}-${parseResult.dateRange.end.getTime()}`
    : "no-dates";
  return `${CACHE_PREFIX}${participants}:${msgCount}:${dateRange}`;
}

function loadCachedPhase1(parseResult: ParseResult): CachedPhase1 | null {
  if (typeof window === "undefined") return null;
  try {
    const key = getCacheKey(parseResult);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as CachedPhase1;
    // Expire old caches
    if (Date.now() - data.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveCachedPhase1(parseResult: ParseResult, summaries: (ChunkSummary | null)[]) {
  if (typeof window === "undefined") return;
  try {
    const key = getCacheKey(parseResult);
    const data: CachedPhase1 = {
      chunkSummaries: summaries,
      cachedAt: Date.now(),
      totalChunks: summaries.length,
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    // localStorage might be full (large chat) — fail silently
    console.warn("Failed to cache Phase 1 results:", err);
  }
}

function clearCachedPhase1(parseResult: ParseResult) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getCacheKey(parseResult));
  } catch {
    // ignore
  }
}

/**
 * Check if there's a resumable Phase 1 cache for the given chat.
 * Returns the number of completed chunks, or 0 if no cache.
 */
export function getResumableChunkCount(parseResult: ParseResult): number {
  const cached = loadCachedPhase1(parseResult);
  if (!cached) return 0;
  return cached.chunkSummaries.filter((s) => s !== null).length;
}

/**
 * Clear the Phase 1 cache for a given chat (called on successful completion
 * or when the user starts a new analysis).
 */
export function clearAnalysisCache(parseResult: ParseResult) {
  clearCachedPhase1(parseResult);
}

export interface TopicEntry {
  name: string;
  share: number;
  estimated_messages: number;
  person_a_share: number;
  person_b_share: number;
  initiator: "A" | "B" | "balanced";
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  depth: "surface" | "moderate" | "deep";
  keywords: string[];
  representative_quote: string;
  quote_said_by: "A" | "B";
}

export interface ChunkSummary {
  week_start: string;
  week_end: string;
  topics: TopicEntry[];
  emotional_tone_overall: string;
  message_count_by_person: { A: number; B: number };
  notable_observations: string;
}

export interface ProgressUpdate {
  phase: 1 | 2 | 3;
  phaseName: string;
  current: number;
  total: number;
  message: string;
  /** Estimated seconds remaining, based on rolling average of step durations */
  etaSeconds?: number;
}

export interface AnalysisResult {
  report: TopicReport;
  chunkSummaries: ChunkSummary[];
  chunks: ChatChunk[];
}

export class AnalysisCancelledError extends Error {
  constructor() {
    super("Analysis cancelled by user");
    this.name = "AnalysisCancelledError";
  }
}

export interface AnalyzerOptions {
  parseResult: ParseResult;
  client: LLMClient;
  onProgress: (update: ProgressUpdate) => void;
  isCancelled: () => boolean;
  /** Hook called when rate limit cooldown starts (seconds) */
  onCooldown?: (seconds: number, message: string) => void;
}

export async function runAnalysis(opts: AnalyzerOptions): Promise<AnalysisResult> {
  const { parseResult, client, onProgress, isCancelled } = opts;

  if (parseResult.participants.length < 2) {
    throw new Error("Could not detect two participants in this chat.");
  }

  const personA = parseResult.participants[0];
  const personB = parseResult.participants[1];

  // ─────────────────────────────────────────────────────────────
  // PHASE 1: Chunk processing (batched, with resume from cache)
  // ─────────────────────────────────────────────────────────────
  const chunks = chunkChat(parseResult);
  if (chunks.length === 0) {
    throw new Error("No chat messages found to analyze.");
  }

  const batches = batchChunks(chunks);
  // Use (ChunkSummary | null)[] so we can track which chunks are cached vs pending
  const chunkSummaries: (ChunkSummary | null)[] = new Array(chunks.length).fill(null);
  const stepDurations: number[] = [];
  let processedChunks = 0;

  // Try to load cached Phase 1 results (from a previous run that may have
  // failed at Phase 2 or 3). This saves 40+ minutes and 400+ API requests
  // when retrying after a transient error like a 503.
  const cached = loadCachedPhase1(parseResult);
  if (cached && cached.chunkSummaries.length === chunks.length) {
    let restoredCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      if (cached.chunkSummaries[i]) {
        chunkSummaries[i] = cached.chunkSummaries[i];
        restoredCount++;
      }
    }
    if (restoredCount > 0) {
      processedChunks = restoredCount;
      console.log(`Resumed Phase 1 from cache: ${restoredCount}/${chunks.length} chunks already completed.`);
      onProgress({
        phase: 1,
        phaseName: "Resuming from cache",
        current: restoredCount,
        total: chunks.length,
        message: `Resumed ${restoredCount.toLocaleString()} of ${chunks.length.toLocaleString()} chunks from cache. Skipping to remaining batches...`,
      });
    }
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    if (isCancelled()) throw new AnalysisCancelledError();

    const batch = batches[batchIdx];

    // Skip this batch if ALL its chunks are already cached
    const allCached = batch.every((chunk) => chunkSummaries[chunk.index] !== null);
    if (allCached) {
      continue;
    }

    const stepStart = Date.now();

    // Filter out cached chunks within this batch (process only the missing ones)
    const missingChunks = batch.filter((chunk) => chunkSummaries[chunk.index] === null);
    const completedInBatch = batch.length - missingChunks.length;

    onProgress({
      phase: 1,
      phaseName: "Extracting topics from chat chunks",
      current: processedChunks + 1,
      total: chunks.length,
      message: `Analyzing batch ${batchIdx + 1} of ${batches.length} (${missingChunks.length} weeks: ${missingChunks[0].startDate.toLocaleDateString()} → ${missingChunks[missingChunks.length - 1].endDate.toLocaleDateString()})${completedInBatch > 0 ? ` · ${completedInBatch} cached` : ''}`,
      etaSeconds: estimateEta(stepDurations, batches.length - batchIdx),
    });

    // If some chunks in this batch are cached, process only the missing ones
    const summariesForBatch = missingChunks.length === batch.length
      ? await processBatch(batch, personA, personB, client, opts, isCancelled)
      : await processBatch(missingChunks, personA, personB, client, opts, isCancelled);

    for (let i = 0; i < missingChunks.length; i++) {
      const chunk = missingChunks[i];
      const originalIdx = chunk.index;
      chunkSummaries[originalIdx] = summariesForBatch[i];
    }
    processedChunks += missingChunks.length;
    stepDurations.push(Date.now() - stepStart);

    // Save to cache after each batch (so progress is preserved even if
    // the user closes the tab or the connection drops)
    saveCachedPhase1(parseResult, chunkSummaries);
  }

  // Fill any gaps with fallback summaries (shouldn't happen, but just in case)
  for (let i = 0; i < chunkSummaries.length; i++) {
    if (!chunkSummaries[i]) {
      chunkSummaries[i] = fallbackChunkSummary(chunks[i]);
    }
  }
  // Now safe to cast to ChunkSummary[] (no nulls remain)
  const finalChunkSummaries: ChunkSummary[] = chunkSummaries as ChunkSummary[];

  // ─────────────────────────────────────────────────────────────
  // PHASE 2: Aggregation (monthly if needed)
  // ─────────────────────────────────────────────────────────────
  if (isCancelled()) throw new AnalysisCancelledError();

  const summaryStrings = finalChunkSummaries.map((s) => JSON.stringify(s));
  const { aggregated, needsMonthlyAggregation: autoNeedsAgg } = aggregateSummaries(summaryStrings);

  const forceAggregation = chunks.length >= 6;
  let finalAggregated = aggregated;
  let monthlySummaries: string[] | null = null;

  if (autoNeedsAgg || forceAggregation) {
    onProgress({
      phase: 2,
      phaseName: "Aggregating topics by month",
      current: 0,
      total: 1,
      message: "Compressing weekly topic summaries into monthly digests...",
    });

    const monthGroups = groupChunksByMonth(chunks);
    const monthSummaries: string[] = [];
    monthlySummaries = monthSummaries;

    for (let i = 0; i < monthGroups.length; i++) {
      if (isCancelled()) throw new AnalysisCancelledError();
      const group = monthGroups[i];
      const monthLabel = group[0].startDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      onProgress({
        phase: 2,
        phaseName: "Aggregating topics by month",
        current: i + 1,
        total: monthGroups.length,
        message: `Summarizing topics for ${monthLabel}...`,
      });

      const chunkIndexes = new Set(group.map((c) => c.index));
      const weeklySummariesForMonth = finalChunkSummaries
        .filter((_, idx) => chunkIndexes.has(idx))
        .map((s) => JSON.stringify(s));

      const prompt = buildMonthlyAggregationPrompt(monthLabel, weeklySummariesForMonth);
      try {
        const response = await client.fast(
          [
            {
              role: "system",
              content:
                "You are a careful aggregator. You output ONLY valid JSON, no markdown, no commentary.",
            },
            { role: "user", content: prompt },
          ],
          { temperature: 0.3, maxTokens: 2000 }
        );
        monthSummaries.push(response.content);
      } catch (err) {
        console.warn(`Monthly aggregation failed for ${monthLabel}:`, err);
        monthSummaries.push(weeklySummariesForMonth.join("\n\n"));
      }
    }

    finalAggregated = monthSummaries.join("\n\n===\n\n");
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 3: Final comprehensive topic report
  // ─────────────────────────────────────────────────────────────
  if (isCancelled()) throw new AnalysisCancelledError();

  onProgress({
    phase: 3,
    phaseName: "Generating topic report",
    current: 0,
    total: 1,
    message: "Synthesizing all data into your comprehensive topic report...",
  });

  const dateRange = parseResult.dateRange;
  const timeframe = dateRange
    ? `${dateRange.start.toLocaleDateString("en-US", { month: "short", year: "numeric" })} to ${dateRange.end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
    : "the analyzed period";

  let workingAggregated = finalAggregated;
  let report: TopicReport | null = null;
  let lastError: Error | null = null;

  // 5 attempts (up from 3) to handle transient 503/UNAVAILABLE errors that
  // may persist beyond the LLMClient's internal 6-retry backoff.
  for (let attempt = 0; attempt < 5; attempt++) {
    if (isCancelled()) throw new AnalysisCancelledError();
    try {
      const finalPrompt = buildFinalReportPrompt(
        personA,
        personB,
        timeframe,
        workingAggregated,
        parseResult.messages.length
      );
      let response = await client.capable(
        [
          {
            role: "system",
            content:
              "You are an insightful, witty, and respectful conversation analyst specializing in TOPIC ANALYSIS. You output ONLY valid JSON, never markdown fences, never commentary outside the JSON. All string values must be valid JSON strings (properly escaped).",
          },
          { role: "user", content: finalPrompt },
        ],
        { temperature: 0.7, maxTokens: 12000 }
      );

      // CONTINUATION: If the model hit the token limit, request continuation
      let fullContent = response.content;
      let continuationCount = 0;
      while (response.finishReason === "length" && continuationCount < 3) {
        if (isCancelled()) throw new AnalysisCancelledError();
        continuationCount++;
        console.log(`Response truncated (finish_reason=length), requesting continuation ${continuationCount}...`);
        onProgress({
          phase: 3,
          phaseName: "Generating topic report",
          current: 0,
          total: 1,
          message: `Report is large — continuing generation (part ${continuationCount + 1})...`,
        });
        response = await client.capable(
          [
            {
              role: "system",
              content:
                "You are an insightful, witty, and respectful conversation analyst specializing in TOPIC ANALYSIS. You output ONLY valid JSON, never markdown fences, never commentary outside the JSON. All string values must be valid JSON strings (properly escaped).",
            },
            { role: "user", content: finalPrompt },
            { role: "assistant", content: fullContent },
            {
              role: "user",
              content:
                "Your previous response was cut off due to length limits. Continue EXACTLY where you left off — do not repeat any previous content, do not add any explanation, just output the remaining JSON to complete the object. Start mid-stream if necessary.",
            },
          ],
          { temperature: 0.7, maxTokens: 12000 }
        );
        fullContent += response.content;
      }

      report = extractJSON<TopicReport>(fullContent);
      break;
    } catch (err) {
      lastError = err as Error;
      if (err instanceof LLMError) {
        if (err.type === "rate_limited") {
          const wait = Math.min((err.retryAfter ?? 5000) / 1000, 60);
          opts.onCooldown?.(wait, "Rate limit on capable model. Cooling down...");
          continue;
        }
        if (err.type === "service_unavailable") {
          // 503/UNAVAILABLE — transient. Wait and retry.
          const wait = 30;
          opts.onCooldown?.(wait, `Service temporarily unavailable (503). Waiting ${wait}s before retry...`);
          await new Promise((r) => setTimeout(r, wait * 1000));
          continue;
        }
        if (err.type === "invalid_api_key") throw err;
        if (err.type === "model_unavailable") throw err;
        if (err.type === "context_too_long") {
          if (attempt < 2) {
            workingAggregated = workingAggregated.slice(0, Math.floor(workingAggregated.length / 2));
            continue;
          }
        }
        if (err.type === "unknown" && err.rawBody) {
          throw new Error(`${err.message}\n\nAPI response: ${err.rawBody.slice(0, 500)}`);
        }
      }
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
    }
  }

  if (!report) {
    let errMsg = "Failed to generate final topic report after multiple attempts.";
    if (lastError instanceof LLMError) {
      errMsg = `${errMsg}\n\nLast error: ${lastError.message}`;
      if (lastError.rawBody) {
        errMsg += `\n\nRaw API response: ${lastError.rawBody.slice(0, 800)}`;
      }
    } else if (lastError) {
      errMsg = `${errMsg}\n\nLast error: ${lastError.message}`;
    }
    throw new Error(errMsg);
  }

  onProgress({
    phase: 3,
    phaseName: "Generating topic report",
    current: 1,
    total: 1,
    message: "Topic report complete!",
  });

  // Clear the Phase 1 cache on successful completion (no need to keep it)
  clearCachedPhase1(parseResult);

  return {
    report,
    chunkSummaries: finalChunkSummaries,
    chunks,
  };
}

/**
 * Process a batch of chunks in a single API call.
 * Falls back to individual chunks if the batch fails.
 */
async function processBatch(
  batch: ChatChunk[],
  personA: string,
  personB: string,
  client: LLMClient,
  opts: AnalyzerOptions,
  isCancelled: () => boolean
): Promise<ChunkSummary[]> {
  if (batch.length === 1) {
    const summary = await processSingleChunk(batch[0], client, opts, isCancelled);
    return [summary];
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    if (isCancelled()) throw new AnalysisCancelledError();
    try {
      const prompt = buildBatchedChunkPrompt(batch, personA, personB);
      const response = await client.fast(
        [
          {
            role: "system",
            content:
              "You are a careful, neutral conversation analyst specializing in TOPIC EXTRACTION. You output ONLY a valid JSON array, never markdown fences, never commentary outside the array.",
          },
          { role: "user", content: prompt },
        ],
        { temperature: 0.4, maxTokens: Math.min(5000, 1000 * batch.length) }
      );
      const summaries = extractJSON<ChunkSummary[]>(response.content);
      if (Array.isArray(summaries) && summaries.length === batch.length) {
        return summaries;
      }
      if (Array.isArray(summaries) && summaries.length > 0) {
        const result: ChunkSummary[] = [];
        for (let i = 0; i < batch.length; i++) {
          if (i < summaries.length && summaries[i]) {
            result.push(summaries[i]);
          } else {
            result.push(await processSingleChunk(batch[i], client, opts, isCancelled));
          }
        }
        return result;
      }
    } catch (err) {
      if (err instanceof LLMError) {
        if (err.type === "rate_limited") {
          const wait = Math.min((err.retryAfter ?? 5000) / 1000, 60);
          opts.onCooldown?.(wait, "Rate limit reached. Cooling down...");
          continue;
        }
        if (err.type === "service_unavailable") {
          const wait = 20;
          opts.onCooldown?.(wait, "Service temporarily unavailable (503). Waiting...");
          await new Promise((r) => setTimeout(r, wait * 1000));
          continue;
        }
        if (err.type === "invalid_api_key") throw err;
        if (err.type === "model_unavailable") throw err;
        if (err.type === "context_too_long") {
          break;
        }
      }
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
    }
  }

  const result: ChunkSummary[] = [];
  for (const chunk of batch) {
    if (isCancelled()) throw new AnalysisCancelledError();
    result.push(await processSingleChunk(chunk, client, opts, isCancelled));
  }
  return result;
}

async function processSingleChunk(
  chunk: ChatChunk,
  client: LLMClient,
  opts: AnalyzerOptions,
  isCancelled: () => boolean
): Promise<ChunkSummary> {
  const prompt = buildChunkPrompt(chunk);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a careful, neutral conversation analyst specializing in TOPIC EXTRACTION. You output ONLY valid JSON, never markdown fences, never commentary.",
    },
    { role: "user", content: prompt },
  ];

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (isCancelled()) throw new AnalysisCancelledError();
    try {
      const response = await client.fast(messages, {
        temperature: 0.4,
        maxTokens: 1500,
      });
      return extractJSON<ChunkSummary>(response.content);
    } catch (err) {
      lastError = err as Error;
      if (err instanceof LLMError) {
        if (err.type === "rate_limited") {
          const wait = Math.min((err.retryAfter ?? 5000) / 1000, 60);
          opts.onCooldown?.(wait, "Rate limit reached. Cooling down...");
          continue;
        }
        if (err.type === "service_unavailable") {
          const wait = 20;
          opts.onCooldown?.(wait, "Service temporarily unavailable (503). Waiting...");
          await new Promise((r) => setTimeout(r, wait * 1000));
          continue;
        }
        if (err.type === "invalid_api_key") throw err;
        if (err.type === "model_unavailable") throw err;
        if (err.type === "context_too_long") {
          if (attempt === 0 && chunk.messages.length > 4) {
            try {
              return await splitAndProcessChunk(chunk, client, isCancelled);
            } catch (mergeErr) {
              lastError = mergeErr as Error;
            }
          } else {
            break;
          }
        }
      }
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  console.warn(`Failed chunk ${chunk.index + 1}:`, lastError?.message);
  return fallbackChunkSummary(chunk);
}

async function splitAndProcessChunk(
  chunk: ChatChunk,
  client: LLMClient,
  isCancelled: () => boolean
): Promise<ChunkSummary> {
  if (isCancelled()) throw new AnalysisCancelledError();
  const mid = Math.floor(chunk.messages.length / 2);
  const half1 = { ...chunk, messages: chunk.messages.slice(0, mid) };
  const half2 = { ...chunk, messages: chunk.messages.slice(mid) };
  half1.formattedText = half1.messages
    .map((m) => `[${m.date.toLocaleDateString()} ${m.date.toLocaleTimeString()}] ${m.sender}: ${m.content.slice(0, 1500)}`)
    .join("\n");
  half2.formattedText = half2.messages
    .map((m) => `[${m.date.toLocaleDateString()} ${m.date.toLocaleTimeString()}] ${m.sender}: ${m.content.slice(0, 1500)}`)
    .join("\n");

  const r1 = await client.fast(
    [
      { role: "system", content: "You are a careful conversation analyst. Output ONLY valid JSON." },
      { role: "user", content: buildChunkPrompt(half1) },
    ],
    { temperature: 0.4, maxTokens: 1200 }
  );
  const r2 = await client.fast(
    [
      { role: "system", content: "You are a careful conversation analyst. Output ONLY valid JSON." },
      { role: "user", content: buildChunkPrompt(half2) },
    ],
    { temperature: 0.4, maxTokens: 1200 }
  );
  const s1 = extractJSON<ChunkSummary>(r1.content);
  const s2 = extractJSON<ChunkSummary>(r2.content);
  // Merge topic lists from both halves
  const mergedTopics = [...(s1.topics ?? []), ...(s2.topics ?? [])];
  return {
    week_start: chunk.startDate.toISOString().slice(0, 10),
    week_end: chunk.endDate.toISOString().slice(0, 10),
    topics: mergedTopics.slice(0, 10),
    emotional_tone_overall: s1.emotional_tone_overall ?? "neutral",
    message_count_by_person: {
      A: (s1.message_count_by_person?.A ?? 0) + (s2.message_count_by_person?.A ?? 0),
      B: (s1.message_count_by_person?.B ?? 0) + (s2.message_count_by_person?.B ?? 0),
    },
    notable_observations: [s1.notable_observations, s2.notable_observations].filter(Boolean).join(" | "),
  };
}

function estimateEta(durations: number[], remaining: number): number {
  if (durations.length === 0) return 0;
  const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  return Math.round((avg * remaining) / 1000);
}

function fallbackChunkSummary(chunk: ChatChunk): ChunkSummary {
  const aMessages = chunk.messages.filter((m) => m.sender === chunk.personA);
  const bMessages = chunk.messages.filter((m) => m.sender === chunk.personB);
  return {
    week_start: chunk.startDate.toISOString().slice(0, 10),
    week_end: chunk.endDate.toISOString().slice(0, 10),
    topics: [],
    emotional_tone_overall: "neutral",
    message_count_by_person: {
      A: aMessages.length,
      B: bMessages.length,
    },
    notable_observations: "Topic extraction unavailable for this week.",
  };
}
