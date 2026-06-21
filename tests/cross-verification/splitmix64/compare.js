// SplitMix64 cross-verification oracle.
//
// Delegates to the shared N-way byte-diff harness: all present language oracles
// (TS/F#/C#/Rust/Python/Go) must agree with each other AND with the canonical
// `result` values in vectors.yaml. The mixer is the deterministic step behind
// Zeta's DST RNG, so byte-lock here is load-bearing — a lone divergent oracle
// would silently desync replay streams across the ports.
import { runNWayDiff } from "../_harness/nway-diff.js";
process.exit(await runNWayDiff({ dir: import.meta.dir }));
