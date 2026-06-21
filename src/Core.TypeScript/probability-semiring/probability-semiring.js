// Exact-rational probability (+,×) and Viterbi (max,×) semirings, TypeScript oracle.
// Conforms to the F# canonical shape (src/Core/ProbabilitySemiring.fs) by agreeing on the shared seed
// (./golden-vectors.json) that the C#/F#/Rust oracles also verify. Exact rational ℚ ({n,d}, lowest
// terms, d>0) — no floats. Seed values stay within the safe-integer range.
function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
}
/** Construct a normalized rational (lowest terms, positive denominator). d===0 throws. */
export function rat(num, den) {
    if (den === 0)
        throw new Error("rational denominator is zero");
    const s = den < 0 ? -1 : 1;
    const n = s * num;
    const d = s * den;
    let g = gcd(Math.abs(n), d);
    if (g === 0)
        g = 1;
    return { n: n / g, d: d / g };
}
export const zero = { n: 0, d: 1 };
/** Probability-semiring ⊕: exact a + b. */
export function add(a, b) {
    return rat(a.n * b.d + b.n * a.d, a.d * b.d);
}
/** ⊗ of both semirings: exact a * b. */
export function mul(a, b) {
    return rat(a.n * b.n, a.d * b.d);
}
/** Sign of a - b (-1/0/+1); denominators positive after normalization. */
export function compare(a, b) {
    return Math.sign(a.n * b.d - b.n * a.d);
}
/** Viterbi-semiring ⊕: exact max(a, b). */
export function max(a, b) {
    return compare(a, b) >= 0 ? a : b;
}
/** Exact reciprocal 1/a (ℚ is a field). a.n === 0 throws. */
export function recip(a) {
    if (a.n === 0)
        throw new Error("reciprocal of zero");
    return rat(a.d, a.n);
}
/** Exact division a / b (b = 0 throws) — used by the relative-observer reconciliation. */
export function div(a, b) {
    return mul(a, recip(b));
}
/** Relative-observer 3-way merge over the Merkle ancestor: merged(i) = a(i)·b(i)/ancestor(i). */
export function merge3(ancestor, a, b) {
    const out = [];
    for (let i = 0; i < ancestor.length; i++)
        out.push(div(mul(a[i], b[i]), ancestor[i]));
    return out;
}
/** One forward step over (+,×): π'(j) = Σ_i π(i)·P(i,j). */
export function forwardStep(pi, p) {
    const n = p.length;
    const out = [];
    for (let j = 0; j < n; j++) {
        let acc = zero;
        for (let i = 0; i < pi.length; i++)
            acc = add(acc, mul(pi[i], p[i][j]));
        out.push(acc);
    }
    return out;
}
/** One Viterbi step over (max,×): v'(j) = max_i v(i)·P(i,j). */
export function viterbiStep(v, p) {
    const n = p.length;
    const out = [];
    for (let j = 0; j < n; j++) {
        let acc = zero;
        for (let i = 0; i < v.length; i++)
            acc = max(acc, mul(v[i], p[i][j]));
        out.push(acc);
    }
    return out;
}
