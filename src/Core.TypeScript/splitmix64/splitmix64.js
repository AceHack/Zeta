// SplitMix64 finaliser — Sebastiano Vigna's mixer (arxiv 1410.0530 §3; public-domain reference
// https://prng.di.unimi.it/splitmix64.c), TypeScript oracle.
// Conforms to the F# canonical shape (src/Core/SplitMix64.fs) by agreeing on the shared seed
// (./golden-vectors.json) that the C#/F#/Rust oracles also verify. JS numbers cannot hold uint64,
// so this works in BigInt masked to 64 bits — exact wrapping arithmetic matching the .NET/Rust u64.
const MASK64 = (1n << 64n) - 1n;
export const GOLDEN_RATIO = 0x9e3779b97f4a7c15n;
export const VIGNA_A = 0xbf58476d1ce4e5b9n;
export const VIGNA_B = 0x94d049bb133111ebn;
/** Apply the SplitMix64 finaliser to a 64-bit input. All ops wrap mod 2^64. */
export function mix(x) {
    let z = (x * GOLDEN_RATIO) & MASK64;
    z = ((z ^ (z >> 30n)) * VIGNA_A) & MASK64;
    z = ((z ^ (z >> 27n)) * VIGNA_B) & MASK64;
    return (z ^ (z >> 31n)) & MASK64;
}
