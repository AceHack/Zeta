// SoftValue — TS oracle of the "how-sure" value axis (DECISION semantics). Grown FROM the shared seed
// (golden-vectors.json); F# is the canonical peer (src/Core/SoftValue.fs). SoftValue is float-valued and
// floats do not byte-lock across languages, so only the EXACT decisions are cross-verified: resolve
// (argmax candidate, returned iff confidence ≥ rational threshold) and observe-then-resolve. Weights are
// exact integers; the float confidence/entropy values are F#-only.
// Argmax: max weight, ties broken by ascending key (deterministic across languages).
const argmax = (c) => {
    const keys = Object.keys(c).sort();
    if (keys.length === 0)
        return null;
    let best = keys[0];
    for (const k of keys)
        if (c[k] > c[best])
            best = k;
    return best;
};
/** The terminal decision: argmax candidate iff confidence (best/total) ≥ num/den, else null. */
export const resolve = (c, num, den) => {
    const keys = Object.keys(c);
    if (keys.length === 0)
        return null;
    const total = keys.reduce((s, k) => s + c[k], 0);
    const best = argmax(c);
    return c[best] * den >= num * total ? best : null;
};
/** Bayesian multiply (drop zeroed candidates — no fabricated certainty), then resolve. */
export const observeResolve = (prior, likelihood, num, den) => {
    const posterior = {};
    for (const k of Object.keys(prior)) {
        const w = prior[k] * (likelihood[k] ?? 0);
        if (w > 0)
            posterior[k] = w;
    }
    return resolve(posterior, num, den);
};
