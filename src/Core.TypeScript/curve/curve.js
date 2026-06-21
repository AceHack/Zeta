// Curve — TS oracle of the discrete DBSP D/I calculus over the clock (rate ∂ / curvature ∂² / integrate).
// Grown FROM the shared seed (golden-vectors.json); the F# oracle is the canonical peer
// (src/Core/Curve.fs), with the C# oracle (src/Core.CSharp/Curve.cs) the third agreeing voice.
//
// differentiate = D = (1 − z⁻¹): the per-tick rate of change. integrate = I: running prefix sum, the
// inverse of D. curvature = D∘D: the second difference. The values are int64 in F#/C#; the seed values
// stay within JS safe-integer range, so `number` agrees exactly.
/** Differentiate (D = 1 − z⁻¹): the per-tick rate of change. */
export const differentiate = (s) => s.map((value, i) => (i === 0 ? value : value - s[i - 1]));
/** Integrate (I): the running prefix sum — the inverse of `differentiate`. */
export const integrate = (s) => {
    const out = [];
    let acc = 0;
    for (const v of s) {
        acc += v;
        out.push(acc);
    }
    return out;
};
/** Curvature (D∘D): the rate of the rate (second difference). */
export const curvature = (s) => differentiate(differentiate(s));
