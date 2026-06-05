//! SplitMix64 finaliser — Sebastiano Vigna's mixer (arxiv 1410.0530 §3; public domain reference
//! <https://prng.di.unimi.it/splitmix64.c>), Rust oracle.
//!
//! Conforms to the F# canonical shape (`src/Core/SplitMix64.fs`) by agreeing on the shared seed
//! (`src/Core.TypeScript/splitmix64/golden-vectors.json`) that the C#/F#/TS oracles also verify.
//! Pure wrapping `u64` arithmetic — fully byte-lockable (uint64 is encoded as decimal strings in the
//! seed since it exceeds JSON's exact number range).

pub const GOLDEN_RATIO: u64 = 0x9E3779B97F4A7C15;
pub const VIGNA_A: u64 = 0xBF58476D1CE4E5B9;
pub const VIGNA_B: u64 = 0x94D049BB133111EB;

/// Apply the SplitMix64 finaliser to a 64-bit input (5 ops, no allocation).
pub fn mix(x: u64) -> u64 {
    let mut z = x.wrapping_mul(GOLDEN_RATIO);
    z = (z ^ (z >> 30)).wrapping_mul(VIGNA_A);
    z = (z ^ (z >> 27)).wrapping_mul(VIGNA_B);
    z ^ (z >> 31)
}
