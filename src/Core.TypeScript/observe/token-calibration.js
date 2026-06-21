#!/usr/bin/env bun
// token-calibration.ts — the bytes→tokens calibration layer (B-1016).
//
// HONESTY BOUNDARY (B-1016): byte-cost is PROVEN and byte-locked (deterministic,
// cross-language). Model TOKENS are NOT — they vary by tokenizer and version, so
// this layer is an explicit ESTIMATE, model-specific, OUTSIDE the proof lineage.
// It never feeds a gate on its own; it converts the proven byte signal into a
// money-facing token estimate for the DORA trend. The math here is exact; the
// CONSTANT (bytesPerToken) is empirical and must be fit from real tokenizer
// samples (`--fit`) — until then it is a documented placeholder, flagged.
//
//   estimateTokens(bytes) = bytes / bytesPerToken         (exact, given the ratio)
//   fitRatio(samples)     = Σbytes / ΣobservedTokens      (least-squares thru 0)
/** Estimate tokens from a proven byte count and the calibration ratio. */
export function estimateTokens(bytes, bytesPerToken) {
    return bytes / bytesPerToken;
}
/** Fit bytesPerToken from samples (least-squares through the origin). */
export function fitRatio(samples) {
    if (samples.length === 0)
        throw new Error("fitRatio: no samples");
    const totalBytes = samples.reduce((s, x) => s + x.bytes, 0);
    const totalTokens = samples.reduce((s, x) => s + x.observedTokens, 0);
    if (totalTokens <= 0)
        throw new Error("fitRatio: observed tokens must be positive");
    const bytesPerToken = totalBytes / totalTokens;
    const mape = samples.reduce((s, x) => {
        const est = estimateTokens(x.bytes, bytesPerToken);
        return s + Math.abs(est - x.observedTokens) / x.observedTokens;
    }, 0) / samples.length;
    return { bytesPerToken, sampleCount: samples.length, meanAbsPctError: mape };
}
if (import.meta.main) {
    const { readFileSync } = await import("node:fs");
    const args = new Set(Bun.argv.slice(2));
    const path = "src/Core.TypeScript/observe/token-calibration.json";
    const cal = JSON.parse(readFileSync(path, "utf8"));
    if (args.has("--fit")) {
        const usable = cal.samples.filter((s) => s.observedTokens > 0);
        if (usable.length === 0) {
            console.error("--fit: no samples with observedTokens > 0. Populate token-calibration.json from a real tokenizer first.");
            process.exit(1);
        }
        const fit = fitRatio(usable);
        const next = {
            ...cal,
            bytesPerToken: Number(fit.bytesPerToken.toFixed(4)),
            calibrated: true,
            provenance: `fit from ${fit.sampleCount} samples ${new Date().toISOString().slice(0, 10)} (MAPE ${(fit.meanAbsPctError * 100).toFixed(1)}%)`,
        };
        await Bun.write(path, JSON.stringify(next, null, 2) + "\n");
        console.log(`fit bytesPerToken=${next.bytesPerToken} (MAPE ${(fit.meanAbsPctError * 100).toFixed(1)}%, ${fit.sampleCount} samples)`);
        process.exit(0);
    }
    // Default: estimate tokens for the byte-cost baseline (the cold-boot surface).
    const baseline = JSON.parse(readFileSync("src/Core.TypeScript/observe/context-cost-baseline.json", "utf8"));
    const flag = cal.calibrated ? "" : "  [UNCALIBRATED placeholder ratio — run --fit with real tokenizer samples]";
    console.log(`token estimate (model=${cal.model}, ${cal.bytesPerToken} bytes/token)${flag}`);
    for (const [harness, { total }] of Object.entries(baseline.harnesses)) {
        console.log(`  ${harness}: ${total}B ≈ ${Math.round(estimateTokens(total, cal.bytesPerToken))} tokens (ESTIMATE, not byte-locked)`);
    }
    process.exit(0);
}
