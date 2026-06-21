// UncertainClock — a Hybrid Logical Clock with an uncertainty window, TypeScript oracle.
// Conforms to the F# canonical shape (src/Core/UncertainClock.fs) by agreeing on the shared seed
// (./golden-vectors.json) that the C#/F#/Rust oracles also verify. All integer arithmetic — no
// floats, fully byte-lockable. An HLC is {physical, logical}; an uncertain reading is {physical, eps}
// with true time in [physical, physical + eps].
//
// JS numbers are IEEE-754 doubles; the seed stays within Number.MAX_SAFE_INTEGER so every value here
// is an exact integer. (The .NET/Rust oracles use int64; agreement holds on the safe-integer range.)
/** Lexicographic HLC comparison (-1 / 0 / +1): physical first, logical as tiebreak. */
export function compareHlc(a, b) {
    if (a.physical !== b.physical)
        return a.physical < b.physical ? -1 : 1;
    if (a.logical !== b.logical)
        return a.logical < b.logical ? -1 : 1;
    return 0;
}
/** HLC send: advance to at least nowPhysical, bumping logical when physical doesn't move. */
export function send(c, nowPhysical) {
    const p = Math.max(c.physical, nowPhysical);
    return p === c.physical ? { physical: p, logical: c.logical + 1 } : { physical: p, logical: 0 };
}
/** HLC receive: the CockroachDB/HLC merge — the result dominates both inputs (bounded divergence). */
export function receive(c, msg, nowPhysical) {
    const p = Math.max(c.physical, msg.physical, nowPhysical);
    let l;
    if (p === c.physical && p === msg.physical) {
        l = Math.max(c.logical, msg.logical) + 1;
    }
    else if (p === c.physical) {
        l = c.logical + 1;
    }
    else if (p === msg.physical) {
        l = msg.logical + 1;
    }
    else {
        l = 0;
    }
    return { physical: p, logical: l };
}
/** Definite happens-before: a's whole window ends strictly before b's begins. */
export function definitelyBefore(aPhysical, aEps, bPhysical, _bEps) {
    return aPhysical + aEps < bPhysical;
}
/** The uncertain zone: neither reading is definitely before the other (windows overlap). */
export function uncertain(aPhysical, aEps, bPhysical, bEps) {
    return (!definitelyBefore(aPhysical, aEps, bPhysical, bEps) &&
        !definitelyBefore(bPhysical, bEps, aPhysical, aEps));
}
