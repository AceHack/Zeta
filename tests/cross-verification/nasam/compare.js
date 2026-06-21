// nasam MIXER cross-verification oracle.
//
// Delegates to the shared N-way byte-diff harness: all present language oracles
// (TS/F#/C#/Rust/Python/Go) must agree with each other AND with the canonical
// `result` values in vectors.yaml. This is the FIFTH "generated-from-ir"
// primitive and the SECOND grammar evolution (zeta-ir-v3) — its TS oracle reads
// its mixer IR from a DynamicValue row (`_gen/nasam.ir.json`, schema
// `zeta-ir-v3`) and folds `xrotxor[39,17] · mul M1 · xshrxor[23,51] · mul M2 ·
// xshrxor[23,51]` at width 64 with a total interpreter that now understands the
// two new ops. Byte-lock here proves the IR vocabulary can GROW A SECOND TIME
// soundly: ops that XOR several self-rotations / self-shifts of the current word
// back in land a fifth primitive across all six oracles, while BOTH the v1 AND
// v2 validators still reject the v3 tag (the two-layer firewall, pinned in
// ZetaIrV3.Tests). Pelle Evensen's public-domain reference:
// mostlymangling.blogspot.com/2020/01/nasam-not-another-strange-acronym-mixer.html
import { runNWayDiff } from "../_harness/nway-diff.js";
process.exit(await runNWayDiff({ dir: import.meta.dir }));
