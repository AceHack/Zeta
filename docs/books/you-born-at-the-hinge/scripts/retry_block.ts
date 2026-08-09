import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";

const TARGET_DIR = path.join(__dirname, "..", "site");

const PROMPT_TEMPLATE = (
  htmlContent: string,
) => `You are an expert, native-level writer and editor in English (Henderson, North Carolina southern drawl). 
The following HTML block is a literal translation of a book chapter. 
Your task is to REWRITE the text content within this HTML so that it flows completely naturally for a native English (Henderson, North Carolina southern drawl) reader, as if the book were written in English (Henderson, North Carolina southern drawl) originally.

CRITICAL RULES:
1. HTML STRUCTURE: You MUST preserve every single HTML tag exactly as it is (e.g., <p class="lead">, <span class="kicker">, <h3>). Do not add, remove, or modify any HTML tags.
2. CONSENT GATES (STRICT):
   - Mother's eating disorder: Must remain an oblique reference (e.g. "insecurity about her own body"). Do not use any clinical or medical terms.
   - CSAM / immutable-ledger: Must remain policy-point-only with zero operational detail. Keep the "refusal-is-the-point" passage intact. Do not add numbers, methods, or identifiers.
   - Anonymity: Keep all people anonymous if they are anonymous in the text. Do not introduce any names.
3. DIRECTNESS & TONE: Match the English tone's directness. Do not soften hard truths or add fluff.
4. NATURAL VOICE: Do not make the text overly verbose. Avoid flowery "AI-speak" at all costs. It must flow completely naturally, as if a human native speaker just sat down and wrote it in their natural voice.

Output ONLY the rewritten HTML block. Do not include markdown codeblocks (\`\`\`html) or any other text before or after the HTML.

Here is the HTML block to rewrite:

${htmlContent}
`;

function processChunk(chunkHtml: string): string {
  const prompt = PROMPT_TEMPLATE(chunkHtml);

  console.log("Running agy...");
  const result = execFileSync("agy", ["-p", prompt, "--model", "gemini-3.1-pro", "--effort", "high"], {
    encoding: "utf-8",
    maxBuffer: 1024 * 1024 * 10,
  });

  let output = result.trim();
  if (output.startsWith("\`\`\`html")) output = output.slice(7);
  if (output.startsWith("\`\`\`")) output = output.slice(3);
  if (output.endsWith("\`\`\`")) output = output.slice(0, -3);

  return output.trim() + "\n\n";
}

const filepath = path.join(TARGET_DIR, "index.en-nc.html");
const content = fs.readFileSync(filepath, "utf-8");
const pattern =
  /(<header class="title">.*?<\/header>|<aside class="note">.*?<\/aside>|<article class="chap">.*?<\/article>)/gs;
const parts = content.split(pattern);

console.log("Rewriting block 10...");
const block = parts[19];
if (block === undefined) {
  console.error("Cannot rewrite block 10: the expected HTML block is missing.");
  process.exitCode = 1;
} else {
  parts[19] = processChunk(block);
  fs.writeFileSync(filepath, parts.join(""), "utf-8");
  console.log("Done");
}
