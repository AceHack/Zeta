// Dogfood: the room maintains its CoreDORA vocabulary via a LOCAL LLM (Aaron, 2026-06-09:
// "dogfood that test now with local LLMs"). The LLM's SHAPE is the interface, not the
// implementation (Aaron) — `Llm` is a port (prompt -> text, a SoftValue text generator);
// the ollama call is one adapter (local); a remote model would be another. SoftValue:
// LLM output is inherently soft (uncertain) until cross-checked / SolidGround found.
//   bun tools/hygiene/vocab-llm-review.ts [model] [count]
import { readdirSync, lstatSync, existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { fetchBounded } from "../../src/Core.TypeScript/io/safe-io.ts";

const OLLAMA_URL = "http://localhost:11434/api/generate";

/** `num_predict` is 120 tokens; 8 MiB is generous by three orders of magnitude. */
const LLM_RESPONSE_MAX_BYTES = 8 * 1024 * 1024;

/** 2 minutes. A local model that has not answered by then is stuck, not slow. */
const LLM_TIMEOUT_MS = 2 * 60 * 1000;

// --- the interface (the SHAPE of an LLM = the port; impl is swappable) ---
type Llm = (prompt: string) => Promise<string>;          // SoftValue text generator
// THE FLOW IS THE FUNCTION. CodeQL reports this as `js/file-access-to-http`
// (alert #191): the carved sentence read out of a vocab markdown file becomes
// the body of an outbound request. That is precisely what this tool is for --
// "dogfood the vocab with a local LLM" -- and removing the flow would remove
// the tool. What was missing is the BOUND: `fetch(...).json()` had no cap and
// no deadline, so a local model that stalls or floods hangs a review loop with
// no error anywhere. `fetchBounded` supplies both, plus the scheme check that
// stops this adapter ever being pointed at a `file:` URL.
const ollama = (model: string): Llm => async (prompt) => {
  const r = await fetchBounded(OLLAMA_URL, {
    method: "POST",
    body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.2, num_predict: 120 } }),
    maxBytes: LLM_RESPONSE_MAX_BYTES,
    timeoutMs: LLM_TIMEOUT_MS,
    failOnHttpError: false,
  });
  if (!r.ok) throw new Error(`ollama unreachable: ${r.error.kind}: ${r.error.message}`);
  if (r.value.status < 200 || r.value.status >= 300) throw new Error(`ollama ${String(r.value.status)}`);
  if (r.value.truncated) throw new Error(`ollama response exceeded the ${String(LLM_RESPONSE_MAX_BYTES)}-byte cap`);
  return ((JSON.parse(r.value.body)) as { response: string }).response.trim();
};

// --- pick a sample of canonical vocab files ---
const VOCAB = new URL("../", import.meta.url).pathname;
function walk(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir).sort()) {
    if (n === "README.md") continue;
    const p = join(dir, n); const st = lstatSync(p);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) out.push(...walk(p));
    else if (n.endsWith(".md")) out.push(p);
  }
  return out;
}
function carved(f: string): string {
  return (readFileSync(f, "utf8").split("\n").find((l) => l.startsWith("> ")) ?? "").slice(2).trim();
}

const model = process.argv[2] ?? "qwen2.5:0.5b";
const count = Number(process.argv[3] ?? 5);
const llm = ollama(model);
const files = walk(join(VOCAB, "grams")).slice(0, count);

console.log(`vocab-llm-review (dogfood) — local LLM '${model}' reviewing ${files.length} CoreDORA entries\n`);
for (const f of files) {
  const term = basename(f, ".md"), sentence = carved(f);
  const prompt =
    `You are reviewing one vocabulary entry for a software project's glossary.\n` +
    `TERM: ${term}\nDEFINITION (one carved sentence): ${sentence}\n\n` +
    `In <=2 short lines: (1) is it ONE clear, self-contained sentence? (2) is it over-broad or vague? ` +
    `Answer plainly.`;
  try {
    const out = await llm(prompt);
    console.log(`### ${term}\n${out}\n`);
  } catch (e) {
    console.error(`### ${term} — LLM error: ${(e as Error).message}\n`);
  }
}
console.log("dogfood complete — local LLM (SoftValue text-gen behind the Llm port) reviewed the vocab.");
