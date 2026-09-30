/**
 * Prompt templates for the topic-modeler analysis pipeline.
 *
 * Phase 1: Weekly chunk analysis (small/fast model)
 *   - Extracts topics discussed that week, with per-topic stats
 * Phase 2: Monthly aggregation (only if Phase 1 output is too large)
 *   - Combines weekly topic summaries into monthly topic digests
 * Phase 3: Final topic report (most capable model)
 *   - Synthesizes everything into an 8-section topic-focused report
 */

import type { ChatChunk } from "./chunking";

/**
 * Phase 1: Build the prompt for analyzing a single weekly chunk.
 * Asks the model to return strict JSON with topic-level data.
 */
export function buildChunkPrompt(chunk: ChatChunk): string {
  const dateRange = `${chunk.startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} to ${chunk.endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  return `Analyze this WhatsApp chat chunk between Person A (${chunk.personA}) and Person B (${chunk.personB}) for the week of ${dateRange}.

Extract the topics discussed this week. A "topic" is a coherent subject of conversation — e.g. "Work complaints", "A specific movie", "Weekend plans", "Dating life", "Family stress", "Football match", "An inside joke about X". Aim for 3-8 distinct topics for the week, ranked by how much of the conversation they consumed.

Return ONLY a JSON object (no markdown fences, no commentary) using this exact schema:

{
  "week_start": "${chunk.startDate.toISOString().slice(0, 10)}",
  "week_end": "${chunk.endDate.toISOString().slice(0, 10)}",
  "topics": [
    {
      "name": "<short topic name, 1-4 words>",
      "share": <percentage of this week's conversation devoted to this topic, 0-100>,
      "estimated_messages": <rough count of messages about this topic this week>,
      "person_a_share": <percentage of this topic's messages from A, 0-100>,
      "person_b_share": <percentage of this topic's messages from B, 0-100>,
      "initiator": "A" | "B" | "balanced",
      "sentiment": "positive" | "negative" | "neutral" | "mixed",
      "depth": "surface" | "moderate" | "deep",
      "keywords": ["<distinctive word or short phrase>", "..."],
      "representative_quote": "<best single message that captures this topic>",
      "quote_said_by": "A" | "B"
    }
  ],
  "emotional_tone_overall": "positive|negative|neutral|mixed",
  "message_count_by_person": { "A": <number>, "B": <number> },
  "notable_observations": "<1-2 sentences on anything notable about this week's topic mix>"
}

Rules:
- Person A is ${chunk.personA}. Person B is ${chunk.personB}.
- Topics should be specific enough to be meaningful (e.g. "Mom's birthday planning" not just "Family"), but generic enough to recur across weeks where applicable (e.g. "Work complaints" can appear in multiple weeks).
- share values across topics should sum to roughly 100.
- person_a_share + person_b_share should sum to roughly 100 per topic.
- Aim for 3-8 topics per week. Pick the most prominent ones.
- Do NOT include any text outside the JSON object.

Chat content:

${chunk.formattedText}`;
}

/**
 * Phase 1 (batched): Build a prompt that analyzes MULTIPLE weekly chunks
 * in a single API call. The model returns a JSON array of summaries,
 * one per chunk.
 *
 * Batching is critical for providers like Google Gemini that have tight
 * daily request limits but generous token-per-minute limits.
 */
export function buildBatchedChunkPrompt(
  chunks: ChatChunk[],
  personA: string,
  personB: string
): string {
  const chunkDescriptions = chunks
    .map((chunk, idx) => {
      const dateRange = `${chunk.startDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })} to ${chunk.endDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
      return `=== CHUNK ${idx + 1} of ${chunks.length} ===
Week: ${dateRange}
Message count: ${chunk.messages.length}

${chunk.formattedText}`;
    })
    .join("\n\n");

  return `Analyze ${chunks.length} WhatsApp chat chunks between Person A (${personA}) and Person B (${personB}).

For EACH chunk, extract the topics discussed that week. Return a JSON ARRAY with ${chunks.length} elements (one per chunk, in order). Each element must follow this schema:

{
  "week_start": "<YYYY-MM-DD>",
  "week_end": "<YYYY-MM-DD>",
  "topics": [
    {
      "name": "<short topic name, 1-4 words>",
      "share": <0-100>,
      "estimated_messages": <number>,
      "person_a_share": <0-100>,
      "person_b_share": <0-100>,
      "initiator": "A" | "B" | "balanced",
      "sentiment": "positive" | "negative" | "neutral" | "mixed",
      "depth": "surface" | "moderate" | "deep",
      "keywords": ["<word or short phrase>", "..."],
      "representative_quote": "<best single message capturing this topic>",
      "quote_said_by": "A" | "B"
    }
  ],
  "emotional_tone_overall": "positive|negative|neutral|mixed",
  "message_count_by_person": { "A": <number>, "B": <number> },
  "notable_observations": "<1-2 sentences>"
}

Rules:
- Person A is ${personA}. Person B is ${personB}.
- Return EXACTLY ${chunks.length} array elements, in the same order as the chunks below.
- Each element's week_start/week_end must match the chunk's date range.
- Topics should be specific but recur where applicable (e.g. "Work complaints" can appear in multiple weeks).
- share values within a chunk should sum to ~100.
- 3-8 topics per chunk — pick the most prominent.
- Do NOT include any text outside the JSON array.

Chat chunks:

${chunkDescriptions}`;
}

/**
 * Phase 2: Monthly aggregation prompt.
 * Takes 4-5 weekly topic summaries and produces a single monthly topic summary.
 */
export function buildMonthlyAggregationPrompt(
  monthLabel: string,
  weeklySummaries: string[]
): string {
  return `You are aggregating weekly WhatsApp chat topic summaries into a monthly topic summary.

Below are ${weeklySummaries.length} weekly summaries for the month of ${monthLabel}. Combine them into a single monthly summary in JSON format (raw JSON, no markdown fences), using this schema:

{
  "month": "${monthLabel}",
  "topics": [
    {
      "name": "<combined topic name>",
      "share": <percentage of the month's conversation, 0-100>,
      "estimated_messages": <sum across weeks>,
      "person_a_share": <0-100>,
      "person_b_share": <0-100>,
      "initiator": "A" | "B" | "balanced",
      "sentiment": "positive" | "negative" | "neutral" | "mixed",
      "depth": "surface" | "moderate" | "deep",
      "keywords": ["<combined keywords>"],
      "representative_quote": "<best quote across the month for this topic>",
      "quote_said_by": "A" | "B"
    }
  ],
  "emotional_tone_overall": "positive|negative|neutral|mixed",
  "message_count_by_person": { "A": <sum>, "B": <sum> },
  "notable_observations": "<1-2 sentences on the month's topic mix>"
}

When combining weekly topics into the monthly list, MERGE topics that are clearly the same subject across weeks (e.g. "Work complaints" appearing in 3 weeks becomes one entry with summed messages and averaged shares). Keep distinct topics separate.

Weekly summaries (each is a JSON object):

${weeklySummaries.join("\n\n---\n\n")}

Return ONLY the JSON object, no other text.`;
}

/**
 * Phase 3: Final topic report prompt.
 * Sends all aggregated summaries + asks for the comprehensive 8-section topic report.
 */
export function buildFinalReportPrompt(
  personA: string,
  personB: string,
  timeframe: string,
  aggregatedSummaries: string,
  totalMessageCount: number
): string {
  return `You are an insightful conversation analyst specializing in TOPIC ANALYSIS. Generate a comprehensive topic-focused report based on the following aggregated chat summaries between Person A (${personA}) and Person B (${personB}) over approximately ${timeframe} (${totalMessageCount} total messages analyzed).

This report is about WHAT they talk about — not WHO they are. Focus on topics, their frequency, evolution, ownership, depth, sentiment, and structure. Write in an engaging, insightful, occasionally humorous but always specific tone. Reference actual topics, names, and quotes from the summaries. Avoid generic platitudes.

# OUTPUT FORMAT

Return a single JSON object (raw JSON, no markdown fences, no comments). The JSON MUST follow this exact schema. Use empty strings or empty arrays only when truly no data exists. Do not add fields not in the schema.

{
  "executive_topic_summary": {
    "total_distinct_topics": <integer>,
    "topic_diversity_score": <0-100, high = dominated by few topics>,
    "top_topics": [
      {"topic": "<name>", "percentage": <0-100>},
      ...5-15 entries, biggest first
    ],
    "theme_distribution": [
      {"theme": "<super-theme like 'Work & Career'>", "share": <0-100>},
      ...5-8 themes
    ],
    "headline_summary": "<2-4 sentences>",
    "surprising_finding": "<1-3 sentences>",
    "essence_sentence": "<single sentence>"
  },
  "topic_ranking_and_themes": {
    "ranking": [
      {"topic": "<name>", "share": <0-100>, "estimated_messages": <number>, "description": "<short one-line description>"},
      ...15-25 entries, biggest first
    ],
    "themes": [
      {"theme": "<name>", "share": <0-100>, "topics": ["<topic1>", "<topic2>"], "note": "<1-2 sentences>"},
      ...5-8 themes
    ],
    "comparison_note": "<2-3 sentences comparing to typical friendship topic mixes>"
  },
  "topic_evolution_and_trends": {
    "trends": [
      {
        "topic": "<name>",
        "monthly_intensity": [{"month": "<label>", "intensity": <0-100>}, ...],
        "trend_description": "<1-2 sentences>"
      },
      ...6-10 top topics
    ],
    "emerging_and_declining": [
      {"topic": "<name>", "status": "emerging" | "declining", "evidence": "<1-2 sentences>"},
      ...3-6 entries
    ],
    "lifecycles": [
      {"topic": "<name>", "first_seen": "<month>", "peak": "<month or 'ongoing'>", "current_status": "active" | "dormant" | "dead", "note": "<1-2 sentences>"},
      ...5-8 major topics
    ],
    "evolution_narrative": "<2-4 sentences on how the topic mix has shifted over time>"
  },
  "per_person_topic_dynamics": {
    "ownership": [
      {"topic": "<name>", "owned_by": "A" | "B" | "balanced", "person_a_share": <0-100>, "person_b_share": <0-100>, "explanation": "<1 sentence>"},
      ...10-15 topics
    ],
    "engagement": [
      {"topic": "<name>", "person_a_avg_length": <chars>, "person_b_avg_length": <chars>, "initiator": "A" | "B" | "balanced", "engagement_note": "<1 sentence>"},
      ...10-15 topics
    ],
    "person_a_signature_topics": ["<topic1>", "<topic2>", "..."],
    "person_b_signature_topics": ["<topic1>", "<topic2>", "..."],
    "ownership_summary": "<2-3 sentences on how topic ownership shapes the relationship>"
  },
  "topic_co_occurrence_and_drift": {
    "co_occurrence_edges": [
      {"source": "<topic1>", "target": "<topic2>", "strength": <0-100>},
      ...15-20 strongest pairs
    ],
    "drift_patterns": [
      {"from_topic": "<topic1>", "to_topic": "<topic2>", "frequency": "frequent" | "occasional" | "rare"},
      ...8-12 common transitions
    ],
    "network_note": "<2-3 sentences on what the co-occurrence network reveals>",
    "drift_note": "<2-3 sentences on how conversations flow topic-to-topic>"
  },
  "topic_depth_and_sentiment": {
    "depth_spectrum": [
      {"topic": "<name>", "depth": "surface" | "moderate" | "deep", "evidence": "<1 sentence>"},
      ...10-15 major topics
    ],
    "sentiment_by_topic": [
      {"topic": "<name>", "sentiment": "positive" | "negative" | "neutral" | "mixed", "note": "<1 sentence>"},
      ...10-15 major topics
    ],
    "deep_dive_topics": ["<topic1>", "<topic2>", "..."],
    "light_topics": ["<topic1>", "<topic2>", "..."],
    "positive_topics": ["<topic1>", "<topic2>", "..."],
    "heavy_topics": ["<topic1>", "<topic2>", "..."]
  },
  "topic_balance_and_untapped": {
    "balance_score": <0-100>,
    "balance_explanation": "<2-3 sentences>",
    "over_represented": ["<topic1>", "<topic2>"],
    "under_represented": ["<topic1>", "<topic2>"],
    "untapped_topics": [
      {"topic": "<name>", "rationale": "<1-2 sentences on why it might be valuable>"},
      ...3-6 suggestions
    ],
    "conversation_starters": ["<starter 1>", "<starter 2>", "<starter 3>", "<starter 4>", "<starter 5>"]
  },
  "quotes_and_keywords": {
    "quotes": [
      {"topic": "<name>", "quote": "<the message>", "said_by": "A" | "B", "context": "<1 sentence on why this captures the topic>"},
      ...8-12 entries
    ],
    "keywords_by_topic": [
      {"topic": "<name>", "keywords": ["<word1>", "<word2>", "...5-10 keywords>"]},
      ...8-12 entries matching the quotes set
    ],
    "overall_top_keywords": ["<word1>", "<word2>", "...30 keywords total>"]
  },
  "closing_thought": "<2-4 sentence memorable closing thought about this conversation's topic ecosystem>"
}

# ANALYSIS CONTEXT

Person A: ${personA}
Person B: ${personB}
Timeframe: ${timeframe}
Total messages analyzed: ${totalMessageCount}

# AGGREGATED WEEKLY/MONTHLY SUMMARIES

${aggregatedSummaries}

# INSTRUCTIONS

1. Be specific - reference actual topics, keywords, and quotes from the summaries
2. Each text field should be substantive (not just a few words) - aim for 2-5 sentences for descriptions
3. For scores, use integers within the specified range
4. For percentages, use integers 0-100
5. Quote actual phrases from the summaries as evidence where possible
6. Be honest but kind - never cruel
7. Use the same Person A / Person B labels consistently (${personA} = A, ${personB} = B)
8. The topics across sections should be CONSISTENT - if you mention "Work complaints" in the ranking, it should appear with the same name in evolution, ownership, depth, etc. where applicable.
9. For monthly_intensity arrays, the months should cover the actual timeframe of the chat. Use a consistent format like "2024-03" or "Mar 2024". Intensity is relative — the peak month for a topic should be 100, others scaled accordingly.
10. Return ONLY the JSON object, no markdown fences, no preamble, no postscript

Return the JSON now.`;
}
