// xoshiro256** OUTPUT SCRAMBLER cross-verification oracle.
//
// Delegates to the shared N-way byte-diff harness: all present language oracles
// (TS/F#/C#/Rust/Python/Go) must agree with each other AND with the canonical
// `result` values in vectors.yaml. This is the FOURTH "generated-from-ir"
// primitive and the FIRST under the EXTENDED zeta-ir-v2 grammar — its TS oracle
// reads its scrambler IR from a DynamicValue row (`_gen/xoshiro256ss.ir.json`,
// schema `zeta-ir-v2`) and folds `mul 5 · rotl 7 · mul 9` at width 64 with a
// total interpreter that now understands `rotl`. Byte-lock here proves the IR
// vocabulary GROWS soundly: a new op (rotl) lands a fourth primitive across all
// six oracles, while the v1 validator still rejects the v2 tag (the firewall,
// pinned in ZetaIrV2.Tests).
import { runNWayDiff } from "../_harness/nway-diff.js";
process.exit(await runNWayDiff({ dir: import.meta.dir }));
