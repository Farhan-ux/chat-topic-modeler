/**
 * Rate Limiter for LLM API calls
 *
 * Tracks requests per minute (RPM) and per day (RPD) in memory.
 * When a limit is about to be exceeded, queues the request and waits.
 *
 * For Groq specifically:
 *   - llama-3.1-8b-instant:    30 RPM, 14,400 RPD
 *   - llama-3.3-70b-versatile: 30 RPM, 1,000 RPD
 *
 * For other providers we use a generous default (60 RPM, 10,000 RPD).
 */

export interface RateLimitConfig {
  rpm: number;
  rpd: number;
}

const PROVIDER_LIMITS: Record<string, Record<string, RateLimitConfig>> = {
  groq: {
    "llama-3.1-8b-instant": { rpm: 30, rpd: 14_400 },
    "llama-3.3-70b-versatile": { rpm: 30, rpd: 1_000 },
    "llama-3.1-70b-versatile": { rpm: 30, rpd: 1_000 },
    "mixtral-8x7b-32768": { rpm: 30, rpd: 14_400 },
    "gemma2-9b-it": { rpm: 30, rpd: 14_400 },
    _default: { rpm: 30, rpd: 14_400 },
  },
  google: {
    // Gemini 3.1 Flash Lite — the recommended Google model
    // 15 RPM, 250k TPM, 500 RPD (free tier)
    "gemini-3.1-flash-lite": { rpm: 15, rpd: 500 },
    "gemini-2.5-flash-lite": { rpm: 15, rpd: 500 },
    "gemini-2.5-flash": { rpm: 15, rpd: 500 },
    "gemini-2.0-flash-lite": { rpm: 15, rpd: 500 },
    "gemini-2.0-flash": { rpm: 15, rpd: 500 },
    "gemini-1.5-flash": { rpm: 15, rpd: 500 },
    "gemini-1.5-flash-8b": { rpm: 15, rpd: 500 },
    "gemini-1.5-pro": { rpm: 2, rpd: 50 },
    _default: { rpm: 15, rpd: 500 },
  },
  openai: {
    "gpt-4o": { rpm: 60, rpd: 10_000 },
    "gpt-4o-mini": { rpm: 60, rpd: 10_000 },
    "gpt-4.1": { rpm: 60, rpd: 10_000 },
    "gpt-4.1-mini": { rpm: 60, rpd: 10_000 },
    "gpt-4.1-nano": { rpm: 60, rpd: 10_000 },
    "gpt-4-turbo": { rpm: 60, rpd: 10_000 },
    _default: { rpm: 60, rpd: 10_000 },
  },
};

export function getRateLimits(provider: string, model: string): RateLimitConfig {
  const providerMap = PROVIDER_LIMITS[provider.toLowerCase()];
  if (!providerMap) return { rpm: 30, rpd: 1_000 };
  return providerMap[model] ?? providerMap._default ?? { rpm: 30, rpd: 1_000 };
}

interface RequestRecord {
  timestamp: number;
}

export class RateLimiter {
  private recentRequests: RequestRecord[] = [];
  private dailyRequests: RequestRecord[] = [];
  private config: RateLimitConfig;
  // Reset daily counter at the start of each new day (local time)
  private currentDay: string;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.currentDay = new Date().toDateString();
  }

  private cleanupOldRecords() {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    this.recentRequests = this.recentRequests.filter(
      (r) => r.timestamp > oneMinuteAgo
    );

    // Reset daily counter if day has changed
    const today = new Date().toDateString();
    if (today !== this.currentDay) {
      this.currentDay = today;
      this.dailyRequests = [];
    }
    // Otherwise, filter out anything older than 24 hours
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    this.dailyRequests = this.dailyRequests.filter(
      (r) => r.timestamp > oneDayAgo
    );
  }

  /**
   * How long (ms) to wait before the next request can be made.
   * Returns 0 if we can proceed immediately.
   */
  getWaitTime(): number {
    this.cleanupOldRecords();

    // Check daily limit
    if (this.dailyRequests.length >= this.config.rpd) {
      // Wait until midnight local time
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.getTime() - now.getTime();
    }

    // Check per-minute limit
    if (this.recentRequests.length >= this.config.rpm) {
      const oldest = this.recentRequests[0].timestamp;
      const oneMinuteAfterOldest = oldest + 60_000;
      const wait = oneMinuteAfterOldest - Date.now();
      return Math.max(wait, 0);
    }

    return 0;
  }

  /**
   * Wait until we can make a request, then record it.
   * Returns the actual wait time (0 if no wait was needed).
   */
  async acquire(): Promise<number> {
    const waitTime = this.getWaitTime();
    if (waitTime > 0) {
      // Cap wait at 5 minutes to avoid infinite hangs
      const cappedWait = Math.min(waitTime, 5 * 60 * 1000);
      await new Promise((resolve) => setTimeout(resolve, cappedWait));
      // Recursively check again (in case we hit the cap)
      const remaining = await this.acquire();
      return cappedWait + remaining;
    }
    const now = Date.now();
    this.recentRequests.push({ timestamp: now });
    this.dailyRequests.push({ timestamp: now });
    return 0;
  }

  /**
   * Record a request that has completed (for tracking purposes).
   * Useful if the caller wants to record after success.
   */
  record() {
    const now = Date.now();
    this.recentRequests.push({ timestamp: now });
    this.dailyRequests.push({ timestamp: now });
  }

  getStats() {
    this.cleanupOldRecords();
    return {
      rpmUsed: this.recentRequests.length,
      rpmLimit: this.config.rpm,
      rpdUsed: this.dailyRequests.length,
      rpdLimit: this.config.rpd,
    };
  }
}
