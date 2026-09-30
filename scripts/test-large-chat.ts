// Test the WhatsApp parser with a large synthetic file (163k messages)
// to confirm the "Maximum call stack size exceeded" fix works.

import { parseWhatsAppChat, getChatStats } from "../src/lib/whatsapp-parser";

// Generate a synthetic WhatsApp chat with 163k messages over ~2 years
function generateChat(messageCount: number): string {
  const lines: string[] = [];
  const senders = ["Alice", "Bob"];
  const topics = [
    "Hey, how was your day?",
    "Did you see the game last night?",
    "I'm thinking about switching jobs",
    "Let's grab lunch this week",
    "The new movie was incredible",
    "Working late again tonight",
    "Have you talked to mom recently?",
    "This traffic is unbearable",
    "What are you doing this weekend?",
    "I can't believe the news today",
    "Remember that trip we took?",
    "My boss is driving me crazy",
    "Want to play online later?",
    "Just finished a great book",
    "The weather has been weird",
  ];

  const startDate = new Date(2024, 0, 1, 9, 0, 0).getTime();
  const endDate = new Date(2025, 11, 31, 22, 0, 0).getTime();
  const span = endDate - startDate;

  for (let i = 0; i < messageCount; i++) {
    const ts = startDate + Math.floor(Math.random() * span);
    const d = new Date(ts);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const year = String(d.getFullYear()).slice(2);
    let hour = d.getHours();
    const minute = String(d.getMinutes()).padStart(2, "0");
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    const sender = senders[i % 2];
    const msg = topics[Math.floor(Math.random() * topics.length)];
    lines.push(`${month}/${day}/${year}, ${hour}:${minute} ${ampm} - ${sender}: ${msg}`);
  }
  return lines.join("\n");
}

console.log("Generating 163,000 synthetic messages...");
const chatText = generateChat(163_000);
console.log(`Generated: ${(chatText.length / 1024 / 1024).toFixed(2)} MB, ${chatText.split("\n").length} lines`);

console.log("\nParsing (this used to crash with 'Maximum call stack size exceeded')...");
const start = Date.now();
try {
  const result = parseWhatsAppChat(chatText);
  const elapsed = Date.now() - start;
  console.log(`✓ Parsed in ${elapsed} ms`);
  console.log(`  Messages: ${result.messages.length.toLocaleString()}`);
  console.log(`  Participants: ${result.participants.join(", ")}`);
  console.log(`  Date range: ${result.dateRange?.start.toISOString().slice(0,10)} → ${result.dateRange?.end.toISOString().slice(0,10)}`);
  console.log(`  System messages: ${result.systemMessageCount}`);
  console.log(`  Unparsed lines: ${result.unparsedLineCount}`);

  console.log("\nGetting chat stats...");
  const statsStart = Date.now();
  const stats = getChatStats(result);
  console.log(`✓ Stats in ${Date.now() - statsStart} ms`);
  for (const [name, s] of Object.entries(stats)) {
    console.log(`  ${name}: ${s.count.toLocaleString()} msgs`);
  }

  console.log("\n✅ SUCCESS — no stack overflow!");
  process.exit(0);
} catch (err) {
  console.error("❌ FAILED:", (err as Error).message);
  process.exit(1);
}
