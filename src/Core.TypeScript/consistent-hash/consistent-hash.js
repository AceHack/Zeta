// Rendezvous (HRW) consistent hash (Thaler & Ravishankar 1998), TypeScript oracle.
// Conforms to the F# canonical shape (src/Core/ConsistentHash.fs, RendezvousHash) by agreeing on the
// shared seed (./golden-vectors.json) that the C#/F#/Rust oracles also verify. Pure wrapping uint64 in
// BigInt masked to 64 bits — the score is the (4-lang-proven) SplitMix64 finaliser, so it byte-locks.
// Jump consistent hash is NOT ported here: it uses f64 arithmetic, out of Zeta's proof lineage.
const MASK64 = (1n << 64n) - 1n;
const GOLDEN_RATIO = 0x9e3779b97f4a7c15n;
const VIGNA_A = 0xbf58476d1ce4e5b9n;
const VIGNA_B = 0x94d049bb133111ebn;
function mix(x) {
    let z = (x * GOLDEN_RATIO) & MASK64;
    z = ((z ^ (z >> 30n)) * VIGNA_A) & MASK64;
    z = ((z ^ (z >> 27n)) * VIGNA_B) & MASK64;
    return (z ^ (z >> 31n)) & MASK64;
}
/** Deterministic per-slot seeds: seed(i) = mix(i) for i in [0, n). */
export function seeds(n) {
    const out = [];
    for (let i = 0; i < n; i++)
        out.push(mix(BigInt(i)));
    return out;
}
/** Pick a bucket for key by maximum-score-wins (first index on a tie). O(n). */
export function pick(n, key) {
    const s = seeds(n);
    let bestScore = 0n;
    let bestIdx = 0;
    for (let i = 0; i < s.length; i++) {
        const score = mix((key ^ s[i]) & MASK64);
        if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
        }
    }
    return bestIdx;
}
