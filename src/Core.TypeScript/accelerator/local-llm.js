// tools/accelerator/local-llm.ts
//
// A small, ACCOUNT-FREE local-LLM primitive for the accelerator. The whole
// point: validate the "LLM-in-the-loop" seam on a GitHub CPU runner at ZERO
// spend — no API key, no account — before attaching a real harness (Claude
// Code / Codex / …). Run a tiny instruct model (e.g. Qwen2.5-0.5B) locally on
// the runner; this module is the backend-agnostic core that talks to it.
//
// Reusable for TWO consumers (operator 2026-05-30):
//   1. move-next SELECTOR — "choose your own adventure": pick the next move
//      from the menu (the SelectMove seam in move-next-harness.ts).
//   2. observe.ts AUTO-CLASSIFIER (future, Max's keystone) — "given an
//      observation, pick one label." Same shape: constrained choice among N.
//
// Backend-swappable: ollamaBackend (localhost) today; node-llama-cpp (in-process,
// GBNF-grammar-constrained) or a real account-backed backend later. Selection is
// always validated + falls back safely, so a bad/slow/absent model never stalls
// the loop (exceptions-as-signals: the model is best-effort, the fallback is the
// safety rail).
/**
 * Validate the ollama host is loopback. The local LLM only ever talks to an
 * ON-MACHINE daemon — a host from the (file-sourced) manifest must never point at
 * a remote, which would exfiltrate prompts (the CodeQL "file data → outbound
 * request" SSRF taint, #6123). Returns the validated host (an explicit guard
 * between the file-source and the fetch sink); throws on a non-loopback host.
 */
function loopbackHostOrThrow(raw) {
    const hostname = new URL(raw).hostname.replace(/^\[|\]$/g, ""); // strip IPv6 [ ]
    if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "::1") {
        throw new Error(`local-llm host must be loopback (got "${hostname}") — the local LLM only talks to an on-machine daemon`);
    }
    return raw;
}
/** A ModelBackend backed by a local Ollama server (no account/key). */
export function ollamaBackend(opts = {}) {
    const model = opts.model ?? "qwen2.5:0.5b";
    const host = loopbackHostOrThrow(opts.host ?? "http://127.0.0.1:11434");
    const timeoutMs = opts.timeoutMs ?? 60_000;
    const defaultSeed = opts.seed ?? 0; // fixed seed ⇒ reproducible (DST)
    return {
        name: `ollama:${model}`,
        async complete(prompt, o) {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), timeoutMs);
            try {
                const res = await fetch(`${host}/api/generate`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        model,
                        prompt,
                        stream: false,
                        options: {
                            temperature: o?.temperature ?? 0,
                            seed: o?.seed ?? defaultSeed,
                            num_predict: o?.maxTokens ?? 6,
                        },
                    }),
                    signal: ctrl.signal,
                });
                if (!res.ok)
                    throw new Error(`ollama HTTP ${res.status}`);
                const data = (await res.json());
                return data.response ?? "";
            }
            finally {
                clearTimeout(timer);
            }
        },
    };
}
/**
 * Ask the model to pick ONE option by index. Builds a numbered-options prompt,
 * parses the first integer out of the reply, validates it is in range, and
 * FALLS BACK to index 0 on any failure (empty menu is the only throw). A single
 * option short-circuits with no model call.
 */
export async function chooseIndex(backend, args) {
    const n = args.options.length;
    if (n === 0)
        throw new Error("chooseIndex: options must be non-empty");
    if (n === 1)
        return { index: 0, raw: "", fallback: false };
    const numbered = args.options.map((o, i) => `${i}: ${o}`).join("\n");
    const prompt = `${args.instruction ?? "You are a selector. Choose the single best next action."}\n\n` +
        `State:\n${args.context}\n\n` +
        `Options:\n${numbered}\n\n` +
        `Reply with ONLY the number of the chosen option (0-${n - 1}). Number:`;
    let raw = "";
    try {
        raw = (await backend.complete(prompt, { temperature: 0, maxTokens: 6 })).trim();
    }
    catch {
        return { index: 0, raw: "", fallback: true };
    }
    const m = raw.match(/\d+/);
    if (!m)
        return { index: 0, raw, fallback: true };
    const idx = Number.parseInt(m[0], 10);
    if (!Number.isInteger(idx) || idx < 0 || idx >= n)
        return { index: 0, raw, fallback: true };
    return { index: idx, raw, fallback: false };
}
/**
 * Classify an input into exactly one of `labels` (the observe.ts auto-classifier
 * shape). Thin wrapper over chooseIndex so the selector + classifier share one
 * validated, fallback-safe code path.
 */
export async function classify(backend, args) {
    const r = await chooseIndex(backend, {
        context: args.input,
        options: args.labels,
        instruction: args.instruction ?? "Classify the input into exactly one label.",
    });
    return { label: args.labels[r.index], index: r.index, fallback: r.fallback };
}
