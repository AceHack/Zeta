// tools/accelerator/validate-local-llm.ts
//
// Proves the CORE local-LLM primitive actually works on THIS machine — the
// "entropy lever" end-to-end check (operator 2026-05-30): after install.sh has run,
// a bare machine should be working substrate. Reads the declarative pins
// (manifests/local-llm), talks to the locally-installed ollama, runs a REAL
// chooseIndex, and asserts a valid, non-fallback choice. Exits non-zero on
// failure (CI gate). Run AFTER install.sh.
//
// Note: asserts the model RESPONDED with a valid in-range index (not a specific
// answer) — that proves the real local-LLM is live. Exact-output DST assertions
// (snapshotting the deterministic temp0+seed output) belong in the test suite.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chooseIndex, ollamaBackend } from "./local-llm.ts";

function arg(flag: string, dflt: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : dflt;
}

const root = arg("--root", process.cwd());
const manifestPath = join(root, "tools/setup/manifests/local-llm");

const txt = readFileSync(manifestPath, "utf8");
const mget = (k: string): string | undefined =>
  txt
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((l) => l.split(/\s+/))
    .find(([key]) => key === k)?.[1];

const model = mget("model");
const host = mget("host");
const seed = Number.parseInt(mget("seed") ?? "0", 10);
const maxAttempts = 3;

if (!model) {
  console.error("validate-local-llm: no 'model' in manifest — cannot validate");
  process.exit(2);
}

const backend = ollamaBackend({ model, seed, ...(host ? { host } : {}) });

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

let r = await chooseIndex(backend, {
  instruction: "This is a health check. Reply with ONLY the digit 0.",
  context: "The local model is being checked after install. Pick option 0.",
  options: ["model responded", "model did not respond"],
});

for (let attempt = 2; r.fallback && attempt <= maxAttempts; attempt += 1) {
  console.log(
    `validate-local-llm: attempt ${attempt - 1}/${maxAttempts} fell back ` +
      `(raw=${JSON.stringify(r.raw)}); retrying after model warmup`,
  );
  await sleep(1_000);
  r = await chooseIndex(backend, {
    instruction: "This is a health check. Reply with ONLY the digit 0.",
    context: "The local model is being checked after install. Pick option 0.",
    options: ["model responded", "model did not respond"],
  });
}

console.log(
  `validate-local-llm: backend=${backend.name} raw=${JSON.stringify(r.raw)} ` +
    `index=${r.index} fallback=${r.fallback}`,
);

if (r.fallback) {
  console.error(
    "validate-local-llm: FAILED — the model fell back (unreachable / unparseable). " +
      "The real local-LLM did not produce a valid selection. Check that install.sh " +
      "installed ollama + pulled the pinned model and the daemon is serving.",
  );
  process.exit(1);
}

console.log("validate-local-llm: OK — real local-LLM produced a valid in-range selection.");
