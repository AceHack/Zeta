#!/usr/bin/env bun
// detect-repeated-token-rut.ts — flag degenerate-repetition "ruts" in a
// text/output stream.
//
// WHY (Aaron + Otto, 2026-06-14): a loop with no new entropy coming in
// collapses to a fixed point — the cheapest attractor is one token,
// repeated ("court court court…"). Uncertainty drives attention; with zero
// uncertainty injected, attention has nowhere to go and the generator ruts.
// You cannot break the loop from *inside* it (it took an external interrupt
// to stop the live glitch) — but you CAN make "the artifact is the tell"
// into code: a pure detector any harness can run over surfaced agent output
// (or a hygiene pass over loop responses / commit messages) to catch the rut
// the moment it shows up, instead of needing a human to notice.
//
// This guards the ARTIFACT, not the live sampler (the repo cannot reach into
// the model's token sampler). It is a pure, deterministic function — no I/O,
// no ambient state, DST-replayable, idempotent — so it byte-locks and tests
// cleanly. Disciplines: culture-invariant (no locale-sensitive casing in the
// detection path), weight-free (pure function, no captured state).
//
// Three independent rut signatures (any one trips it):
//   1. RUN          — a run of >= maxRun identical consecutive tokens.
//   2. DOMINANCE    — a single token is >= dominanceRatio of all tokens
//                     (over a stream of at least minTokens).
//   3. LOW-DIVERSITY— distinct/total token ratio <= minDiversityRatio
//                     (over a stream of at least minTokens).
//
// Tokenization is whitespace-split by default; pass `lines: true` to treat
// each non-empty trimmed line as one token (catches "Holding.\nHolding.\n…"
// style ruts where each rut unit is a whole line).
//
// Usage:
//   import { detectRepeatedTokenRut } from "./detect-repeated-token-rut";
//   const v = detectRepeatedTokenRut(text);
//   if (v.isRut) { /* surface v.reason + v.evidence */ }
//
// CLI (reads stdin):
//   echo "court court court court court" | bun src/Core.TypeScript/hygiene/detect-repeated-token-rut.ts
//   exit 0 = no rut, exit 3 = rut detected (prints JSON verdict to stdout)
export const DEFAULT_THRESHOLDS = {
    maxRun: 5,
    dominanceRatio: 0.6,
    minDiversityRatio: 0.2,
    minTokens: 8,
    lines: false,
};
/** Split a stream into comparison tokens. Pure; no locale-sensitive casing. */
export function tokenize(text, lines) {
    if (lines) {
        return text
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
    }
    return text.split(/\s+/u).filter((t) => t.length > 0);
}
/** Longest run of identical consecutive tokens + which token. O(n), pure. */
function longestRun(tokens) {
    let bestLen = 0;
    let bestTok = null;
    let curLen = 0;
    let curTok = null;
    for (const t of tokens) {
        if (t === curTok) {
            curLen += 1;
        }
        else {
            curTok = t;
            curLen = 1;
        }
        if (curLen > bestLen) {
            bestLen = curLen;
            bestTok = curTok;
        }
    }
    return { len: bestLen, token: bestTok };
}
/** Most frequent token + its count. Deterministic on ties (first-seen wins). */
function topToken(tokens) {
    const counts = new Map();
    for (const t of tokens)
        counts.set(t, (counts.get(t) ?? 0) + 1);
    let bestTok = null;
    let bestCount = 0;
    for (const [tok, count] of counts) {
        if (count > bestCount) {
            bestCount = count;
            bestTok = tok;
        }
    }
    return { token: bestTok, count: bestCount };
}
/**
 * Detect a repeated-token rut in `text`. Pure + deterministic: same input +
 * thresholds always yields the same verdict (DST-replayable, idempotent).
 */
export function detectRepeatedTokenRut(text, overrides = {}) {
    const t = { ...DEFAULT_THRESHOLDS, ...overrides };
    const tokens = tokenize(text, t.lines);
    const total = tokens.length;
    const run = longestRun(tokens);
    const top = topToken(tokens);
    const distinct = new Set(tokens).size;
    const diversityRatio = total === 0 ? 1 : distinct / total;
    const topRatio = total === 0 ? 0 : top.count / total;
    const evidence = {
        totalTokens: total,
        distinctTokens: distinct,
        diversityRatio,
        longestRun: run.len,
        longestRunToken: run.token,
        topToken: top.token,
        topTokenCount: top.count,
        topTokenRatio: topRatio,
    };
    const reasons = [];
    // RUN applies regardless of stream length — even "x x x x x" with nothing
    // else is the rut we are guarding against.
    if (run.len >= t.maxRun)
        reasons.push("run");
    // DOMINANCE / LOW-DIVERSITY need a minimum stream so short legitimate
    // outputs (e.g. "ok ok") are not flagged.
    if (total >= t.minTokens) {
        if (topRatio >= t.dominanceRatio)
            reasons.push("dominance");
        if (diversityRatio <= t.minDiversityRatio)
            reasons.push("low-diversity");
    }
    const isRut = reasons.length > 0;
    let reason = "";
    if (isRut) {
        const parts = [];
        if (reasons.includes("run")) {
            parts.push(`run of ${run.len}×"${run.token}"`);
        }
        if (reasons.includes("dominance")) {
            parts.push(`"${top.token}" is ${(topRatio * 100).toFixed(0)}% of ${total} tokens`);
        }
        if (reasons.includes("low-diversity")) {
            parts.push(`only ${distinct} distinct of ${total} tokens (${(diversityRatio * 100).toFixed(0)}%)`);
        }
        reason = `repeated-token rut: ${parts.join("; ")}`;
    }
    return { isRut, reasons, reason, evidence };
}
// ── CLI: read stdin, print verdict, exit 3 on rut ──────────────────────────
if (import.meta.main) {
    const chunks = [];
    for await (const chunk of Bun.stdin.stream())
        chunks.push(chunk);
    const text = Buffer.concat(chunks).toString("utf8");
    const lines = Bun.argv.includes("--lines");
    const verdict = detectRepeatedTokenRut(text, { lines });
    process.stdout.write(JSON.stringify(verdict, null, 2) + "\n");
    process.exit(verdict.isRut ? 3 : 0);
}
