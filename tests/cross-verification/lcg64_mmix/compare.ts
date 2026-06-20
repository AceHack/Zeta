// lcg64_mmix cross-verification oracle.
//
// Delegates to the shared N-way byte-diff harness: all present language oracles
// (TS/F#/C#/Rust/Python/Go) must agree with each other AND with the canonical
// `result` values in vectors.yaml. This is the SIXTH "generated-from-ir"
// primitive and the THIRD grammar evolution (zeta-ir-v4) — its TS oracle reads
// its IR from a DynamicValue row (`_gen/lcg64_mmix.ir.json`, schema
// `zeta-ir-v4`) and folds `mul 6364136223846793005 · add 1442695040888963407`
// at width 64 with a total interpreter that now understands the new `add` op.
import { runNWayDiff } from "../_harness/nway-diff.ts";

process.exit(await runNWayDiff({ dir: import.meta.dir }));
