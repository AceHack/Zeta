// lcg32_numerical_recipes cross-verification oracle.
//
// Delegates to the shared N-way byte-diff harness: all present language oracles
// (TS/F#/C#/Rust/Python/Go) must agree with each other AND with the canonical
// `result` values in vectors.yaml. This is a second "generated-from-ir"
// primitive and proves that the `add` op (zeta-ir-v4) generalizes.
import { runNWayDiff } from "../_harness/nway-diff.ts";

process.exit(await runNWayDiff({ dir: import.meta.dir }));
