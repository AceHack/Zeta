//! Zeta algebra ladder — Rust parity oracle (#4 of TS / F# / C# / Rust).
//!
//! ```text
//! G-Set    ⊂    Bag / multiset    ⊂    Z-set
//! weights {0,1}     weights ℕ            weights ℤ (retraction-native)
//! ```
//!
//! Each rung is the next by widening the weight codomain. All three —
//! **G-Set** (bottom), **Bag** (middle), **Z-set** (top) — are implemented here:
//! one crate, one ladder, mirroring how F# keeps `GSet.fs` + `ZSet.fs` together
//! in `src/Core/`. Cross-verified against the shared golden vectors so the Rust
//! rungs agree byte-for-byte with the TS/F#/C# oracles (per `m-acc-multi-oracle`:
//! the compilers don't lie; agreement IS the verification).

pub mod bag;
pub mod gset;
pub mod zset;
