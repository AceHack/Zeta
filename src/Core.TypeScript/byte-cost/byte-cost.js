// ByteCost — TS oracle of the context-window minimization meter (081KT7YW00008QG0R002T1XNWT slice 1).
// Grown FROM the shared seed (golden-vectors.json); the F# oracle is the
// correctness peer (src/Core/ByteCost.fs). Byte-lock: every language reports
// identical UTF-8 byte counts for the same surface text.
//
// WHY bytes, not model tokens: bytes are deterministic + byte-lockable across
// oracles; tokenizers vary by version and cannot enter the proof lineage.
// (ByteCost, add, Zero) is a commutative monoid → a fileset's total cost is the
// order-independent sum of per-file costs (sound DORA aggregate). Measure-only;
// removes no capability (NCI-safe).
export const Zero = { bytes: 0 };
export const ofBytes = (n) => ({ bytes: n });
/** Monoid combine — addition of byte counts. */
export const add = (a, b) => ({ bytes: a.bytes + b.bytes });
const encoder = new TextEncoder();
/** Measure a surface from its text: UTF-8 byte length (the canonical encoding). */
export const measureText = (text) => ({ bytes: encoder.encode(text).length });
/** Order-independent total of a fileset's costs (monoid fold over `add`). */
export const sum = (costs) => costs.reduce(add, Zero);
