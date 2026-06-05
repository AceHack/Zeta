//! Rendezvous (HRW) consistent hash (Thaler & Ravishankar 1998), Rust oracle.
//!
//! Conforms to the F# canonical shape (`src/Core/ConsistentHash.fs`, `RendezvousHash`) by agreeing on
//! the shared seed (`src/Core.TypeScript/consistent-hash/golden-vectors.json`) that the C#/F#/TS oracles
//! also verify. Pure wrapping `u64` arithmetic — the score is the SplitMix64 finaliser, so it byte-locks.
//! (Jump consistent hash is deliberately NOT cross-verified here: it uses `f64` arithmetic, and floats
//! are out of Zeta's proof lineage.)

const GOLDEN_RATIO: u64 = 0x9E3779B97F4A7C15;
const VIGNA_A: u64 = 0xBF58476D1CE4E5B9;
const VIGNA_B: u64 = 0x94D049BB133111EB;

/// SplitMix64 finaliser (see `src/Core/SplitMix64.fs`).
fn mix(x: u64) -> u64 {
    let mut z = x.wrapping_mul(GOLDEN_RATIO);
    z = (z ^ (z >> 30)).wrapping_mul(VIGNA_A);
    z = (z ^ (z >> 27)).wrapping_mul(VIGNA_B);
    z ^ (z >> 31)
}

/// Deterministic per-slot seeds: `seed(i) = mix(i)` for `i in [0, n)` (the F# `RendezvousHash.Create`).
pub fn seeds(n: usize) -> Vec<u64> {
    (0..n as u64).map(mix).collect()
}

/// Pick a bucket for `key` by maximum-score-wins (first index on a tie). O(n).
pub fn pick(n: usize, key: u64) -> i32 {
    let s = seeds(n);
    let mut best_score = 0u64;
    let mut best_idx = 0i32;
    for (i, &seed) in s.iter().enumerate() {
        let score = mix(key ^ seed);
        if score > best_score {
            best_score = score;
            best_idx = i as i32;
        }
    }
    best_idx
}
