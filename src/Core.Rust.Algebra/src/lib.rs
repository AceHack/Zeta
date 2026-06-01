//! Zeta algebra ladder — Rust parity oracle (#4 of TS / F# / C# / Rust).
//!
//! ```text
//! G-Set    ⊂   Bag / multiset   ⊂   Z-set                ⊂   IndexedZSet
//! weights {0,1}    weights ℕ         weights ℤ (retraction)    Z[K × V] grouped-by-key
//! ```
//!
//! The first three rungs each widen the weight codomain ({0,1} → ℕ → ℤ); the
//! fourth adds the *key-index* dimension — an IndexedZSet is a Z-set over
//! `(key, value)` pairs stored grouped by key (`Z[K × V]`), the grouping that
//! turns the bilinear join + key-wise aggregation into a linear merge (the DBSP
//! incremental-view substrate). All four — **G-Set** (bottom), **Bag**,
//! **Z-set**, **IndexedZSet** (top) — are implemented here: one crate, one
//! ladder, mirroring how F# keeps `GSet.fs` + `ZSet.fs` + `IndexedZSet.fs`
//! together in `src/Core/`. Cross-verified against the shared golden vectors so
//! the Rust rungs agree byte-for-byte with the TS/F#/C# oracles (per
//! `m-acc-multi-oracle`: the compilers don't lie; agreement IS the verification).

pub mod bag;
pub mod gset;
pub mod indexed_zset;
pub mod zset;
