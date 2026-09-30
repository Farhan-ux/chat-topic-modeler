/**
 * Chat Chunking Strategy
 *
 * Splits parsed chat messages into weekly chunks (~7 days each).
 * If a chunk is too small (under minMessages), merges with the next.
 * If a chunk is too large (over maxMessages), splits further.
 *
 * Each chunk returns as a formatted text block ready to send to an LLM.
 */

import type { ParsedMessage, ParseResult } from "./whatsapp-parser";

export interface ChatChunk {
  index: number;
  startDate: Date;
  endDate: Date;
  messages: ParsedMessage[];
  personA: string;
  personB: string;
  /** Formatted text version of the chunk for LLM input */
  formattedText: string;
}

const DEFAULT_MIN_MESSAGES = 10;
const DEFAULT_MAX_MESSAGES = 400;
const DEFAULT_TARGET_DAYS = 7;

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format a single message for the LLM input.
 * Strips very long messages to keep token count reasonable.
 */
function formatMessage(msg: ParsedMessage): string {
  const dateStr = formatDate(msg.date);
  const timeStr = formatTime(msg.date);
  // Truncate extremely long single messages (> 1500 chars)
  let content = msg.content;
  if (content.length > 1500) {
    content = content.slice(0, 1500) + " [...truncated...]";
  }
  return `[${dateStr} ${timeStr}] ${msg.sender}: ${content}`;
}

/**
 * Group messages into weekly chunks.
 *
 * Strategy:
 *   1. Sort messages by timestamp (already sorted by parser but ensure)
 *   2. Walk through messages, starting a new chunk when:
 *      - 7 days have elapsed since chunk start, OR
 *      - Chunk has reached maxMessages
 *   3. After initial grouping, merge any tiny chunks (< minMessages) into the next one
 */
export function chunkChat(
  parseResult: ParseResult,
  options: {
    targetDays?: number;
    minMessages?: number;
    maxMessages?: number;
  } = {}
): ChatChunk[] {
  const targetDays = options.targetDays ?? DEFAULT_TARGET_DAYS;
  const minMessages = options.minMessages ?? DEFAULT_MIN_MESSAGES;
  const maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES;

  const { messages, participants } = parseResult;
  if (messages.length === 0 || participants.length < 2) {
    return [];
  }

  const personA = participants[0];
  const personB = participants[1];

  // Sort by timestamp (stable - parser should already do this)
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  // Phase 1: raw weekly grouping
  const rawChunks: { start: Date; end: Date; msgs: ParsedMessage[] }[] = [];
  let currentStart = sorted[0].date;
  let currentEnd = sorted[0].date;
  let currentMsgs: ParsedMessage[] = [sorted[0]];
  let count = 1;

  for (let i = 1; i < sorted.length; i++) {
    const msg = sorted[i];
    const daysSinceStart = (msg.timestamp - currentStart.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceStart >= targetDays || count >= maxMessages) {
      rawChunks.push({
        start: currentStart,
        end: currentEnd,
        msgs: currentMsgs,
      });
      currentStart = msg.date;
      currentMsgs = [msg];
      count = 1;
    } else {
      currentMsgs.push(msg);
      currentEnd = msg.date;
      count++;
    }
  }
  // Push final
  rawChunks.push({ start: currentStart, end: currentEnd, msgs: currentMsgs });

  // Phase 2: merge tiny chunks into adjacent
  const merged: typeof rawChunks = [];
  for (const chunk of rawChunks) {
    if (chunk.msgs.length < minMessages && merged.length > 0) {
      // Merge into previous
      const prev = merged[merged.length - 1];
      prev.msgs.push(...chunk.msgs);
      prev.end = chunk.end;
    } else {
      merged.push({ ...chunk, msgs: [...chunk.msgs] });
    }
  }

  // If the first chunk is tiny, merge it into the next
  if (merged.length > 1 && merged[0].msgs.length < minMessages) {
    merged[1].msgs.unshift(...merged[0].msgs);
    merged[1].start = merged[0].start;
    merged.shift();
  }

  // Phase 3: build formatted text and metadata
  const chunks: ChatChunk[] = merged.map((chunk, idx) => {
    const header = `=== Chat chunk ${idx + 1} ===\n` +
      `Person A: ${personA}\n` +
      `Person B: ${personB}\n` +
      `Date range: ${formatDate(chunk.start)} to ${formatDate(chunk.end)}\n` +
      `Message count: ${chunk.msgs.length}\n` +
      `===\n\n`;

    const body = chunk.msgs.map(formatMessage).join("\n");
    return {
      index: idx,
      startDate: chunk.start,
      endDate: chunk.end,
      messages: chunk.msgs,
      personA,
      personB,
      formattedText: header + body,
    };
  });

  return chunks;
}

/**
 * Group weekly chunk summaries into monthly groups (roughly 4 per month).
 * Used for the Phase 2 aggregation step when needed.
 */
export function groupChunksByMonth(chunks: ChatChunk[]): ChatChunk[][] {
  if (chunks.length === 0) return [];

  const groups: ChatChunk[][] = [];
  let currentGroup: ChatChunk[] = [chunks[0]];
  let currentMonth = chunks[0].startDate.getMonth();
  let currentYear = chunks[0].startDate.getFullYear();

  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkMonth = chunk.startDate.getMonth();
    const chunkYear = chunk.startDate.getFullYear();

    if (chunkMonth === currentMonth && chunkYear === currentYear) {
      currentGroup.push(chunk);
    } else {
      groups.push(currentGroup);
      currentGroup = [chunk];
      currentMonth = chunkMonth;
      currentYear = chunkYear;
    }
  }
  groups.push(currentGroup);
  return groups;
}

/**
 * Group chunks into batches for a single API call.
 *
 * Why batching? Some providers (e.g. Google Gemini 3.1 Flash Lite) have
 * generous token-per-minute limits (250k TPM) but tight requests-per-day
 * limits (500 RPD). By sending multiple chunks per API call, we cut the
 * total number of requests dramatically.
 *
 * Batching is safe as long as the combined input stays under the model's
 * context window. We target ~40k chars per batch (≈10k tokens), which
 * fits comfortably in any modern model's context.
 */
export function batchChunks(
  chunks: ChatChunk[],
  options: { maxCharsPerBatch?: number; maxChunksPerBatch?: number } = {}
): ChatChunk[][] {
  const maxChars = options.maxCharsPerBatch ?? 40_000;
  const maxChunks = options.maxChunksPerBatch ?? 6;
  const batches: ChatChunk[][] = [];
  let currentBatch: ChatChunk[] = [];
  let currentChars = 0;

  for (const chunk of chunks) {
    const chunkChars = chunk.formattedText.length;
    // If adding this chunk would exceed limits, flush the current batch
    if (
      currentBatch.length > 0 &&
      (currentChars + chunkChars > maxChars || currentBatch.length >= maxChunks)
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }
    currentBatch.push(chunk);
    currentChars += chunkChars;
  }
  if (currentBatch.length > 0) batches.push(currentBatch);
  return batches;
}

/**
 * Estimate token count for a string.
 * Uses a rough heuristic: 1 token ≈ 4 characters.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Aggregate all chunk summaries into a single text block.
 * If too large, the caller should do monthly aggregation first.
 */
export function aggregateSummaries(summaries: string[], maxChars = 100_000): {
  aggregated: string;
  needsMonthlyAggregation: boolean;
} {
  const total = summaries.join("\n\n---\n\n");
  if (total.length > maxChars) {
    return { aggregated: total, needsMonthlyAggregation: true };
  }
  return { aggregated: total, needsMonthlyAggregation: false };
}
