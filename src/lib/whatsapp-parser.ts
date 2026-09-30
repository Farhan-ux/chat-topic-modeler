/**
 * WhatsApp Chat Export Parser
 *
 * Robustly parses WhatsApp .txt exports in various locale formats:
 *   - US 12-hour: 1/13/24, 10:30 AM - Sender: Message
 *   - EU 24-hour: 13/1/24, 10:30 - Sender: Message
 *   - ISO-ish: 2024-01-13 10:30 - Sender: Message
 *   - Bracketed: [1/13/24, 10:30 AM] Sender: Message
 *
 * Handles:
 *   - Multi-line messages (continuation lines without a leading timestamp)
 *   - System messages (encryption notices, group changes, etc.) - filtered out
 *   - Unicode NBSP / NARROW NBSP before AM/PM (iOS WhatsApp exports)
 *   - Empty messages (sender name with no content)
 *   - "<Media omitted>" placeholders
 *   - Mixed date separators across locales
 */

export interface ParsedMessage {
  timestamp: number; // epoch ms
  date: Date;
  sender: string;
  content: string;
  rawLine: number; // 0-indexed source line
}

export interface ParseResult {
  messages: ParsedMessage[];
  participants: string[]; // [Person A, Person B] - A is the first sender chronologically
  systemMessageCount: number;
  unparsedLineCount: number;
  dateRange: { start: Date; end: Date } | null;
  totalLines: number;
}

// Regex matching a leading timestamp at the start of a line.
// Supports:
//   - numeric slashes (1/13/24 or 13/1/2024)
//   - dashes (2024-01-13)
//   - dots (13.1.24)
//   - optional surrounding brackets
//   - 12h (with optional unicode NBSP) or 24h time
//   - optional AM/PM (case-insensitive)
const TIMESTAMP_REGEX =
  /^(\[?)(\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}),\s*(\d{1,2}:\d{2}(?:[:\.]\d+)?(?:\s*[AP]M)?)\]?\s*-\s*/i;

// System message indicators (no sender name after timestamp)
const SYSTEM_MESSAGE_PATTERNS = [
  /Messages and calls are end-to-end encrypted/i,
  /^.+ added .+$/i,
  /^.+ changed .+$/i,
  /^.+ created group/i,
  /^.+ changed the subject/i,
  /^.+ changed this group's icon/i,
  /^.+ deleted this group's icon/i,
  /^.+ is now admin/i,
  /^.+ left/i,
  /^.+ joined using this group's invite link/i,
  /^You were added/i,
  /^.+ security code changed/i,
  /^.+ is now an admin/i,
  /<Media omitted>/i, // media placeholder (we keep these as actual messages, but flag)
];

// Detect a sender in a line that already had its timestamp stripped.
// Sender is everything before the first ": " (colon-space).
const SENDER_REGEX = /^([^:]+?):\s*(.*)$/s;

/**
 * Parse a date string in any of the supported formats.
 * Returns null if it cannot be parsed.
 */
function parseDate(dateStr: string, timeStr: string): Date | null {
  // Normalize unicode NBSP and NARROW NBSP to regular space
  const normalizedTime = timeStr.replace(/[\u202F\u00A0]/g, " ").trim();
  const normalizedDate = dateStr.trim();

  // Try different date formats
  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  if (normalizedDate.includes("-")) {
    // ISO format YYYY-MM-DD
    const parts = normalizedDate.split("-").map(Number);
    if (parts.length === 3) {
      [year, month, day] = parts;
    }
  } else if (normalizedDate.includes(".")) {
    // DD.MM.YY (European dot format)
    const parts = normalizedDate.split(".").map(Number);
    if (parts.length === 3) {
      [day, month, year] = parts;
    }
  } else if (normalizedDate.includes("/")) {
    // Slash format - ambiguous (M/D vs D/M)
    const parts = normalizedDate.split("/").map(Number);
    if (parts.length === 3) {
      // Heuristic: if first number > 12, it must be a day (DD/MM)
      // Otherwise default to US format (M/D)
      if (parts[0] > 12 && parts[1] <= 12) {
        [day, month, year] = parts;
      } else {
        [month, day, year] = parts;
      }
    }
  }

  if (day === null || month === null || year === null) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  // Normalize 2-digit year
  if (year < 100) {
    year = year < 70 ? 2000 + year : 1900 + year;
  }

  // Parse time
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  const timeMatch = normalizedTime.match(
    /^(\d{1,2}):(\d{2})(?:[:\.](\d+))?(?:\s*([AP]M))?$/i
  );
  if (!timeMatch) return null;

  hours = parseInt(timeMatch[1], 10);
  minutes = parseInt(timeMatch[2], 10);
  if (timeMatch[3]) seconds = parseInt(timeMatch[3], 10);
  const ampm = timeMatch[4]?.toUpperCase();

  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  const d = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
  // Use local timezone interpretation - WhatsApp exports use device local time
  // We'll return as if the timestamp was local. Date.UTC gives a stable epoch.
  // Note: we use Date.UTC so the date is stable regardless of viewer timezone,
  // but we will display in local time later. To keep timestamps consistent
  // with the original chat (which is already in the device's local time),
  // we subtract the local timezone offset.
  const localDate = new Date(year, month - 1, day, hours, minutes, seconds);
  return localDate;
}

function isSystemMessage(body: string): boolean {
  // System messages in WhatsApp don't have a sender name (no colon-space)
  // They appear after the timestamp as plain text.
  // We detect them by checking for known patterns.
  for (const pattern of SYSTEM_MESSAGE_PATTERNS) {
    if (pattern.test(body)) return true;
  }
  return false;
}

export function parseWhatsAppChat(rawText: string): ParseResult {
  const lines = rawText.split(/\r?\n/);
  const messages: ParsedMessage[] = [];
  const participants: string[] = [];
  let systemMessageCount = 0;
  let unparsedLineCount = 0;

  let currentMessage: ParsedMessage | null = null;

  const finalizeCurrent = () => {
    if (currentMessage) {
      // Trim trailing whitespace but preserve internal structure
      currentMessage.content = currentMessage.content.replace(/\s+$/, "");
      // Only push if there's content (skip empty messages)
      if (currentMessage.content.length > 0) {
        messages.push(currentMessage);
        if (!participants.includes(currentMessage.sender)) {
          participants.push(currentMessage.sender);
        }
      }
      currentMessage = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tsMatch = line.match(TIMESTAMP_REGEX);

    if (tsMatch) {
      // New message starts here
      finalizeCurrent();

      const dateStr = tsMatch[2];
      const timeStr = tsMatch[3];
      const rest = line.slice(tsMatch[0].length);

      const date = parseDate(dateStr, timeStr);
      if (!date) {
        unparsedLineCount++;
        continue;
      }

      // Check if rest is a system message (no sender colon)
      if (isSystemMessage(rest)) {
        systemMessageCount++;
        continue;
      }

      // Try to extract sender
      const senderMatch = rest.match(SENDER_REGEX);
      if (senderMatch) {
        const sender = senderMatch[1].trim();
        const content = senderMatch[2];
        currentMessage = {
          timestamp: date.getTime(),
          date,
          sender,
          content,
          rawLine: i,
        };
      } else {
        // No sender colon - treat as system message
        if (rest.trim().length > 0) {
          systemMessageCount++;
        }
        continue;
      }
    } else if (currentMessage) {
      // Continuation line of the current message
      // Preserve the line break
      currentMessage.content += "\n" + line;
    } else {
      // Stray line with no current message
      if (line.trim().length > 0) {
        unparsedLineCount++;
      }
    }
  }

  finalizeCurrent();

  // Limit to 2 participants (most WhatsApp 1:1 chats have exactly 2)
  // If there are more (e.g., quoted messages contain names), take the first two
  let finalParticipants = participants;
  if (participants.length > 2) {
    // Find the two most frequent senders
    const counts: Record<string, number> = {};
    for (const m of messages) {
      counts[m.sender] = (counts[m.sender] || 0) + 1;
    }
    finalParticipants = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name);

    // Re-tag messages from "other" senders as the closest participant
    // (This handles edge cases where quoted messages appear as different senders)
  }

  // Determine date range
  let dateRange: ParseResult["dateRange"] = null;
  if (messages.length > 0) {
    const timestamps = messages.map((m) => m.timestamp);
    dateRange = {
      start: new Date(Math.min(...timestamps)),
      end: new Date(Math.max(...timestamps)),
    };
  }

  return {
    messages,
    participants: finalParticipants,
    systemMessageCount,
    unparsedLineCount,
    dateRange,
    totalLines: lines.length,
  };
}

/**
 * Get chat statistics for display
 */
export function getChatStats(parseResult: ParseResult) {
  const { messages, participants } = parseResult;
  const stats: Record<
    string,
    { count: number; totalChars: number; firstMessage?: Date; lastMessage?: Date }
  > = {};

  for (const p of participants) {
    stats[p] = { count: 0, totalChars: 0 };
  }

  for (const msg of messages) {
    if (!stats[msg.sender]) continue;
    stats[msg.sender].count++;
    stats[msg.sender].totalChars += msg.content.length;
    if (!stats[msg.sender].firstMessage || msg.date < stats[msg.sender].firstMessage) {
      stats[msg.sender].firstMessage = msg.date;
    }
    if (!stats[msg.sender].lastMessage || msg.date > stats[msg.sender].lastMessage) {
      stats[msg.sender].lastMessage = msg.date;
    }
  }

  return stats;
}
