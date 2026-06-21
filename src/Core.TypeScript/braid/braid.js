// Braid — Artin's action of B_n on the free group F_n (Artin 1925, faithful) — TS oracle.
// Port of src/Core/Braid.fs (the F# shelf); agreement locked by ./golden-vectors.json,
// which the F#/C#/Rust oracles also replay. Exhibiting data for the faithful-functor
// kernel theorem (math REPORT #3 §2).
//
// A braid word: nonzero ints, +k = sigma_k (1-based), -k = its inverse; applied left-to-right.
// A free-group word: [generator, exponent] letters (0-based strand, ±1), kept reduced.
/** Cancel adjacent inverse pairs until none remain (confluent, terminating). */
export function reduce(w) {
    const acc = [];
    for (const [g, e] of w) {
        const top = acc[acc.length - 1];
        if (top !== undefined && top[0] === g && top[1] + e === 0)
            acc.pop();
        else
            acc.push([g, e]);
    }
    return acc;
}
/** Concatenate and reduce. */
export function mul(a, b) {
    return reduce([...a, ...b]);
}
/** The inverse word. */
export function inv(w) {
    return [...w].reverse().map(([g, e]) => [g, -e]);
}
/** One generator as a word. */
export function gen(i) {
    return [[i, 1]];
}
function applyCrossingToLetter(c, g, e) {
    const i = Math.abs(c) - 1; // the crossing acts on strands i, i+1
    let image;
    if (c > 0) {
        // sigma_i: x_i -> x_i x_{i+1} x_i^{-1} ; x_{i+1} -> x_i
        if (g === i)
            image = [[i, 1], [i + 1, 1], [i, -1]];
        else if (g === i + 1)
            image = [[i, 1]];
        else
            image = [[g, 1]];
    }
    else {
        // sigma_i^{-1}: x_i -> x_{i+1} ; x_{i+1} -> x_{i+1}^{-1} x_i x_{i+1}
        if (g === i)
            image = [[i + 1, 1]];
        else if (g === i + 1)
            image = [[i + 1, -1], [i, 1], [i + 1, 1]];
        else
            image = [[g, 1]];
    }
    return e === 1 ? image : inv(image);
}
/** Apply one crossing to a word (homomorphic extension), reduced. */
export function applyCrossing(c, w) {
    return reduce(w.flatMap(([g, e]) => [...applyCrossingToLetter(c, g, e)]));
}
/** Apply a braid word (crossings left-to-right) to a free-group word. */
export function act(braid, w) {
    return braid.reduce((acc, c) => applyCrossing(c, acc), w);
}
/** The writhe: exponent sum — the unique homomorphism B_n -> Z. */
export function writhe(b) {
    return b.reduce((s, c) => s + (c > 0 ? 1 : -1), 0);
}
/** Writhe parity — the character B_n -> Z/2 (= word length mod 2 = the permutation's sign). */
export function writheParity(b) {
    return b.length % 2;
}
/** The underlying permutation (position -> strand id): the order-forgetting quotient B_n ->> S_n. */
export function permutation(n, b) {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (const c of b) {
        const i = Math.abs(c) - 1;
        if (i + 1 < n) {
            const t = arr[i];
            arr[i] = arr[i + 1];
            arr[i + 1] = t;
        }
    }
    return arr;
}
