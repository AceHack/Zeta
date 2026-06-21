// byte-cost cross-verification oracle (B-1016 slice 1) — registers the
// context-window minimization meter in the trust-core cross-verify surface.
//
// Run by tools/ci/cross-verify-all.ts with cwd = this dir (so the seed read is
// cwd-relative). Exits non-zero on any mismatch (assert-don't-skip).
//
// WHY cross-verify.ts and not compare.ts (committed per-language outputs):
// byte-cost is measure(text) = UTF-8 byte length — a single well-defined function
// with NO encoder ambiguity, so identical integer counts from every language would
// be a tautology, not a byte-lock. The real 4-language lock is enforced in each
// language's own suite, all reading THIS SAME seed
// (src/Core.TypeScript/byte-cost/golden-vectors.json):
//   - F#   tests/Tests.FSharp/Formal/ByteCost.Laws.Tests.fs   (Z3 + FsCheck + golden)
//   - TS   src/Core.TypeScript/byte-cost/golden-vectors.test.ts
//   - C#   tests/Tests.CSharp/ByteCostCrossVerifyTests.cs
//   - Rust src/Core.Rust.ByteCost/tests/golden_vectors.rs
// This entry is the toolchain-free regression guard: it re-asserts the seed via
// the real TS oracle so a regression to the canonical vectors fails here too.
import { measureText } from "../../../src/Core.TypeScript/byte-cost/byte-cost";
import { readFileSync } from "node:fs";
const seed = JSON.parse(readFileSync("../../../src/Core.TypeScript/byte-cost/golden-vectors.json", "utf8"));
console.log("byte-cost cross-verification:");
console.log(`  seed: ${seed.primitive} ${seed.version} (${seed.unit}), ${seed.vectors.length} vectors`);
let mismatches = 0;
if (seed.primitive !== "byte-cost" || seed.version !== "v1" || seed.unit !== "utf8-bytes") {
    console.error(`  seed header unexpected: ${seed.primitive}/${seed.version}/${seed.unit}`);
    mismatches++;
}
if (seed.vectors.length === 0) {
    console.error("  seed has no vectors — refusing to pass on an empty surface");
    mismatches++;
}
for (const v of seed.vectors) {
    const actual = measureText(v.text).bytes;
    if (actual !== v.bytes) {
        console.error(`  ${v.name} MISMATCH: TS measured ${actual}, seed expects ${v.bytes}`);
        mismatches++;
    }
}
if (mismatches === 0) {
    console.log(`  TS oracle agrees with the seed on all ${seed.vectors.length} vectors.`);
    process.exit(0);
}
else {
    console.log(`  ${mismatches} mismatch(es).`);
    process.exit(1);
}
