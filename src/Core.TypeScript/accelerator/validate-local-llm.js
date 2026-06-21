// src/Core.TypeScript/accelerator/validate-local-llm.ts
//
// Validates the CORE local-LLM substrate on THIS machine — the "entropy lever"
// end-to-end check (operator 2026-05-30): after install.sh has run, a bare
// machine should have a reachable local Ollama daemon and the pinned model. Reads
// the declarative pins (manifests/local-llm), probes locally-installed Ollama,
// and runs a REAL chooseIndex.
//
// The model-quality layer is intentionally softer by default: tiny local models
// can occasionally emit empty/unparseable text under CI load even when the
// daemon/model install is healthy. Use --require-selection (or
// ZETA_LOCAL_LLM_REQUIRE_SELECTION=1) when a non-fallback in-range index itself
// is the contract. Exact-output DST assertions belong in the mock-backed tests.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chooseIndex, ollamaBackend } from "./local-llm.js";
function arg(flag, dflt) {
    const i = process.argv.indexOf(flag);
    return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
}
function hasFlag(flag) {
    return process.argv.includes(flag);
}
const root = arg("--root", process.cwd());
const manifestPath = join(root, "tools/setup/manifests/local-llm");
const requireSelection = hasFlag("--require-selection") || process.env.ZETA_LOCAL_LLM_REQUIRE_SELECTION === "1";
const txt = readFileSync(manifestPath, "utf8");
const mget = (k) => txt
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
function loopbackHostOrThrow(raw) {
    const hostname = new URL(raw).hostname.replace(/^\[|\]$/g, "");
    if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "::1") {
        throw new Error(`local-llm host must be loopback (got "${hostname}") — validation only talks to an on-machine daemon`);
    }
    return raw;
}
const ollamaHost = loopbackHostOrThrow(host ?? "http://127.0.0.1:11434");
const backend = ollamaBackend({ model, seed, host: ollamaHost });
async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
async function assertOllamaReachable(rawHost) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
        const versionUrl = new URL("/api/version", rawHost);
        const res = await fetch(versionUrl, { signal: ctrl.signal });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
    }
    finally {
        clearTimeout(timer);
    }
}
try {
    await assertOllamaReachable(ollamaHost);
}
catch (error) {
    console.error("validate-local-llm: FAILED — Ollama daemon is not reachable at the manifest host. " +
        `error=${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
}
let r = await chooseIndex(backend, {
    instruction: "This is a health check. Reply with ONLY the digit 0.",
    context: "The local model is being checked after install. Pick option 0.",
    options: ["model responded", "model did not respond"],
});
for (let attempt = 2; r.fallback && attempt <= maxAttempts; attempt += 1) {
    console.log(`validate-local-llm: attempt ${attempt - 1}/${maxAttempts} fell back ` +
        `(raw=${JSON.stringify(r.raw)}); retrying after model warmup`);
    await sleep(1_000);
    r = await chooseIndex(backend, {
        instruction: "This is a health check. Reply with ONLY the digit 0.",
        context: "The local model is being checked after install. Pick option 0.",
        options: ["model responded", "model did not respond"],
    });
}
console.log(`validate-local-llm: backend=${backend.name} raw=${JSON.stringify(r.raw)} ` +
    `index=${r.index} fallback=${r.fallback}`);
if (r.fallback) {
    const message = "validate-local-llm: WARN — the daemon is reachable, but the model response " +
        "was empty/unparseable so chooseIndex used its safe fallback.";
    if (requireSelection) {
        console.error(`${message} Strict mode is enabled; the real local-LLM must produce a valid selection.`);
        process.exit(1);
    }
    console.warn(`${message} Install substrate is healthy; rerun with --require-selection ` +
        "when selector quality itself must be a hard gate.");
    process.exit(0);
}
console.log("validate-local-llm: OK — real local-LLM produced a valid in-range selection.");
