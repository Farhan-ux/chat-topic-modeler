// Test the parser with the user's actual uploaded chat.txt file
import { readFileSync } from "fs";
import { parseWhatsAppChat, getChatStats } from "../src/lib/whatsapp-parser";

console.log("Reading /home/z/my-project/upload/chat.txt...");
const text = readFileSync("/home/z/my-project/upload/chat.txt", "utf-8");
console.log(`File size: ${(text.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`Line count: ${text.split(/\r?\n/).length.toLocaleString()}`);

console.log("\nParsing...");
const start = Date.now();
try {
  const result = parseWhatsAppChat(text);
  const elapsed = Date.now() - start;
  console.log(`✓ Parsed in ${elapsed} ms`);
  console.log(`  Messages: ${result.messages.length.toLocaleString()}`);
  console.log(`  Participants: ${result.participants.join(", ")}`);
  console.log(`  Date range: ${result.dateRange?.start.toISOString().slice(0,10)} → ${result.dateRange?.end.toISOString().slice(0,10)}`);
  console.log(`  System messages: ${result.systemMessageCount}`);
  console.log(`  Unparsed lines: ${result.unparsedLineCount}`);

  const stats = getChatStats(result);
  for (const [name, s] of Object.entries(stats)) {
    console.log(`  ${name}: ${s.count.toLocaleString()} msgs, ${s.totalChars.toLocaleString()} chars`);
  }
  console.log("\n✅ SUCCESS");
  process.exit(0);
} catch (err) {
  console.error("❌ FAILED:", (err as Error).message);
  console.error(err);
  process.exit(1);
}
