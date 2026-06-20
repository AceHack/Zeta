// MurmurHash3 fmix64 cross-verification oracle.
//
// Delegates to the shared N-way byte-diff harness: all present language oracles
// (TS/F#/C#/Rust/Python/Go) must agree with each other AND with the canonical
// `result` values in vectors.yaml. This is the THIRD "generated-from-ir"
// primitive — its TS oracle reads its finaliser IR from a DynamicValue row
// (`_gen/fmix64.ir.json`) using the SAME total-u-word interpreter that drives
// splitmix64 and fmix32, at width 64. Byte-lock here proves the IR vocabulary
// generalises beyond the seed pair to a SECOND hash-family member at u64.
import { runNWayDiff } from "../_harness/nway-diff.ts";
process.exit(await runNWayDiff({ dir: import.meta.dir }));
