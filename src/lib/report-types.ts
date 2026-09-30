/**
 * TypeScript types for the Topic Modeler analysis report.
 *
 * Mirrors the JSON schema requested in prompts.ts.
 *
 * Whereas chat-dynamics-analyzer focuses on WHO you are to each other
 * (personality, relationship dynamics), this report focuses on WHAT
 * you talk about — topics, their frequency, evolution, ownership,
 * depth, sentiment, and structure.
 */

// ───────────────────────────────────────────────────────────────────────────
// SECTION 1: Executive Topic Summary
// ───────────────────────────────────────────────────────────────────────────

export interface TopicStat {
  /** Topic name (e.g. "Work complaints", "Movies", "Dating") */
  topic: string;
  /** Percentage of conversation devoted to this topic (0-100). All distribution values should sum to ~100. */
  percentage: number;
}

export interface ArchetypeTopicScore {
  /** A super-theme like "Work & Career", "Relationships", "Hobbies & Entertainment" */
  theme: string;
  /** Aggregate percentage of conversation under this theme (0-100) */
  share: number;
}

export interface ExecutiveTopicSummary {
  /** Total distinct topics detected across the chat */
  total_distinct_topics: number;
  /** 0-100 — how concentrated the conversation is on a few topics vs evenly spread (high = dominated by few) */
  topic_diversity_score: number;
  /** The 5-15 most-discussed topics with their share */
  top_topics: TopicStat[];
  /** Topics grouped into super-themes (work/relationships/hobbies/etc.) */
  theme_distribution: ArchetypeTopicScore[];
  /** 2-4 sentence summary of what this conversation is mostly about */
  headline_summary: string;
  /** The single most surprising finding about the topic mix (1-3 sentences) */
  surprising_finding: string;
  /** A single essence sentence capturing what this conversation is, topically */
  essence_sentence: string;
}

// ───────────────────────────────────────────────────────────────────────────
// SECTION 2: Topic Ranking & Themes
// ───────────────────────────────────────────────────────────────────────────

export interface RankedTopic {
  topic: string;
  /** Percentage share of total conversation (0-100) */
  share: number;
  /** Rough estimate of message count devoted to this topic */
  estimated_messages: number;
  /** Short one-line description of what this topic covers */
  description: string;
}

export interface ThemeBreakdown {
  theme: string;
  /** Percentage of conversation under this theme (0-100) */
  share: number;
  /** The specific topics that roll up under this theme */
  topics: string[];
  /** 1-2 sentence description of this theme's role in the chat */
  note: string;
}

export interface TopicRankingAndThemes {
  /** Full ranked list of topics, biggest first (aim for 15-25 entries) */
  ranking: RankedTopic[];
  /** Topics clustered into 5-8 super-themes */
  themes: ThemeBreakdown[];
  /** 2-3 sentence note comparing this chat's topic mix to typical friendships */
  comparison_note: string;
}

// ───────────────────────────────────────────────────────────────────────────
// SECTION 3: Topic Evolution & Trends
// ───────────────────────────────────────────────────────────────────────────

export interface TopicTrendPoint {
  /** Month label, e.g. "2024-03" or "Mar 2024" */
  month: string;
  /** Topic name */
  topic: string;
  /** Intensity 0-100 for this topic this month (relative peak = 100) */
  intensity: number;
}

export interface TopicTrend {
  topic: string;
  /** Monthly intensity series for this topic (length = # months in chat) */
  monthly_intensity: { month: string; intensity: number }[];
  /** 1-2 sentence description of how this topic evolved */
  trend_description: string;
}

export interface EmergingTopic {
  topic: string;
  /** "emerging" (recently gaining traction) or "declining" (fading out) */
  status: "emerging" | "declining";
  /** 1-2 sentence explanation with evidence */
  evidence: string;
}

export interface TopicLifecycleStage {
  topic: string;
  /** When this topic first appeared (month label) */
  first_seen: string;
  /** When it peaked (month label), or "ongoing" */
  peak: string;
  /** "active" | "dormant" | "dead" */
  current_status: "active" | "dormant" | "dead";
  /** 1-2 sentence note on the lifecycle */
  note: string;
}

export interface TopicEvolutionAndTrends {
  /** Monthly trend series for the top 6-10 topics */
  trends: TopicTrend[];
  /** Topics gaining traction recently and topics fading out */
  emerging_and_declining: EmergingTopic[];
  /** Lifecycle stage for major topics */
  lifecycles: TopicLifecycleStage[];
  /** 2-4 sentence overall narrative of how the conversation's topic mix has shifted over time */
  evolution_narrative: string;
}

// ───────────────────────────────────────────────────────────────────────────
// SECTION 4: Per-Person Topic Dynamics
// ───────────────────────────────────────────────────────────────────────────

export interface TopicOwnership {
  topic: string;
  /** Which person brings up this topic more — "A", "B", or "balanced" */
  owned_by: "A" | "B" | "balanced";
  /** Person A's share of mentions of this topic (0-100) */
  person_a_share: number;
  /** Person B's share of mentions of this topic (0-100) */
  person_b_share: number;
  /** 1 sentence explaining why this person owns this topic */
  explanation: string;
}

export interface TopicEngagement {
  topic: string;
  /** Person A's avg message length when discussing this topic (chars) */
  person_a_avg_length: number;
  /** Person B's avg message length when discussing this topic (chars) */
  person_b_avg_length: number;
  /** Who initiates conversations on this topic more — "A", "B", or "balanced" */
  initiator: "A" | "B" | "balanced";
  /** 1 sentence on engagement differences */
  engagement_note: string;
}

export interface PerPersonTopicDynamics {
  /** Which person "owns" which topic — who brings up each topic more */
  ownership: TopicOwnership[];
  /** Engagement metrics per topic per person */
  engagement: TopicEngagement[];
  /** Person A's signature topics (the ones they clearly own) */
  person_a_signature_topics: string[];
  /** Person B's signature topics */
  person_b_signature_topics: string[];
  /** 2-3 sentence note on how topic ownership shapes the relationship */
  ownership_summary: string;
}

// ───────────────────────────────────────────────────────────────────────────
// SECTION 5: Topic Co-occurrence & Drift
// ───────────────────────────────────────────────────────────────────────────

export interface CoOccurrenceEdge {
  /** First topic */
  source: string;
  /** Second topic */
  target: string;
  /** Co-occurrence strength 0-100 (how often these topics appear together) */
  strength: number;
}

export interface TopicDriftStep {
  from_topic: string;
  to_topic: string;
  /** How often this transition happens — "frequent" | "occasional" | "rare" */
  frequency: "frequent" | "occasional" | "rare";
}

export interface TopicCoOccurrenceAndDrift {
  /** Edges of the topic co-occurrence network (top 15-20 pairs) */
  co_occurrence_edges: CoOccurrenceEdge[];
  /** Common transitions from one topic to another */
  drift_patterns: TopicDriftStep[];
  /** 2-3 sentence interpretation of what the network reveals */
  network_note: string;
  /** 2-3 sentence note on how conversations flow topic-to-topic */
  drift_note: string;
}

// ───────────────────────────────────────────────────────────────────────────
// SECTION 6: Topic Depth & Sentiment
// ───────────────────────────────────────────────────────────────────────────

export interface TopicDepthEntry {
  topic: string;
  /** "surface" (brief mentions) | "moderate" | "deep" (multi-week discussions) */
  depth: "surface" | "moderate" | "deep";
  /** 1 sentence describing how deep this topic goes */
  evidence: string;
}

export interface TopicSentimentEntry {
  topic: string;
  /** Emotional tone of discussions on this topic */
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  /** 1 sentence describing the emotional tone */
  note: string;
}

export interface TopicDepthAndSentiment {
  /** Depth classification for each major topic */
  depth_spectrum: TopicDepthEntry[];
  /** Sentiment classification for each major topic */
  sentiment_by_topic: TopicSentimentEntry[];
  /** Topics that consistently spark the deepest conversations */
  deep_dive_topics: string[];
  /** Topics that are mostly light/shallow */
  light_topics: string[];
  /** Topics that consistently bring positive energy */
  positive_topics: string[];
  /** Topics that consistently bring tension or negativity */
  heavy_topics: string[];
}

// ───────────────────────────────────────────────────────────────────────────
// SECTION 7: Untapped Topics & Balance
// ───────────────────────────────────────────────────────────────────────────

export interface UntappedTopic {
  topic: string;
  /** Why this topic might be valuable to discuss (1-2 sentences) */
  rationale: string;
}

export interface TopicBalanceAndUntapped {
  /** 0-100 — how balanced the topic mix is (high = well-distributed; low = dominated by one or two) */
  balance_score: number;
  /** 2-3 sentence explanation of the balance score */
  balance_explanation: string;
  /** Topics that are over-represented (dominating too much) */
  over_represented: string[];
  /** Topics that are under-represented (discussed but deserve more airtime) */
  under_represented: string[];
  /** Topics you almost never discuss but might want to (3-6 suggestions) */
  untapped_topics: UntappedTopic[];
  /** 3-5 concrete conversation starters based on your interests and gaps */
  conversation_starters: string[];
}

// ───────────────────────────────────────────────────────────────────────────
// SECTION 8: Representative Quotes & Keywords
// ───────────────────────────────────────────────────────────────────────────

export interface TopicQuote {
  topic: string;
  /** The best message that captures this topic — paraphrased or quoted */
  quote: string;
  /** Who said it — "A" or "B" */
  said_by: "A" | "B";
  /** 1 sentence on why this quote captures the topic */
  context: string;
}

export interface TopicKeywords {
  topic: string;
  /** 5-10 distinctive keywords/phrases associated with this topic */
  keywords: string[];
}

export interface QuotesAndKeywords {
  /** Representative quote per major topic (aim for 8-12 topics) */
  quotes: TopicQuote[];
  /** Keyword cloud per major topic (same set of topics) */
  keywords_by_topic: TopicKeywords[];
  /** A flat list of the top 30 keywords across all topics, for an overall cloud */
  overall_top_keywords: string[];
}

// ───────────────────────────────────────────────────────────────────────────
// Top-level report
// ───────────────────────────────────────────────────────────────────────────

export interface TopicReport {
  executive_topic_summary: ExecutiveTopicSummary;
  topic_ranking_and_themes: TopicRankingAndThemes;
  topic_evolution_and_trends: TopicEvolutionAndTrends;
  per_person_topic_dynamics: PerPersonTopicDynamics;
  topic_co_occurrence_and_drift: TopicCoOccurrenceAndDrift;
  topic_depth_and_sentiment: TopicDepthAndSentiment;
  topic_balance_and_untapped: TopicBalanceAndUntapped;
  quotes_and_keywords: QuotesAndKeywords;
  /** 2-4 sentence memorable closing thought about this conversation's topic ecosystem */
  closing_thought: string;
}

// Helper: metadata attached to the report
export interface ReportMetadata {
  personA: string;
  personB: string;
  timeframe: string;
  totalMessages: number;
  dateRange: { start: string; end: string };
  generatedAt: string;
  provider: string;
  fastModel: string;
  capableModel: string;
}

/**
 * The 8 sections of the topic report, in display order.
 * Used for the sidebar TOC and section navigation.
 */
export const TOPIC_REPORT_SECTIONS = [
  { id: "executive_topic_summary", label: "Topic Summary", icon: "LayoutDashboard" },
  { id: "topic_ranking_and_themes", label: "Ranking & Themes", icon: "BarChart3" },
  { id: "topic_evolution_and_trends", label: "Evolution & Trends", icon: "TrendingUp" },
  { id: "per_person_topic_dynamics", label: "Per-Person Dynamics", icon: "Users" },
  { id: "topic_co_occurrence_and_drift", label: "Co-occurrence & Drift", icon: "Network" },
  { id: "topic_depth_and_sentiment", label: "Depth & Sentiment", icon: "Layers" },
  { id: "topic_balance_and_untapped", label: "Balance & Untapped", icon: "Scale" },
  { id: "quotes_and_keywords", label: "Quotes & Keywords", icon: "Quote" },
] as const;

export type TopicSectionId = (typeof TOPIC_REPORT_SECTIONS)[number]["id"];
