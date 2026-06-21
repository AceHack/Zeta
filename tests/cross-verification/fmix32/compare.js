// MurmurHash3 fmix32 cross-verification oracle.
//
// Delegates to the shared N-way byte-diff harness: all present language oracles
// (TS/F#/C#/Rust/Python/Go) must agree with each other AND with the canonical
// `result` values in vectors.yaml. This is the SECOND "generated-from-ir"
// primitive — its TS oracle reads its finaliser IR from a DynamicValue row
// (`_gen/fmix32.ir.json`) using the SAME total-u-word interpreter that drives
// splitmix64, only at width 32. Byte-lock here proves the IR vocabulary is not
// splitmix64-specific.
import { runNWayDiff } from "../_harness/nway-diff.js";
process.exit(await runNWayDiff({ dir: import.meta.dir }));
