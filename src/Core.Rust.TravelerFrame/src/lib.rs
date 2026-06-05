//! TravelerFrame -- the Rust oracle (#4 of TS/F#/C#/Rust) for the causal vector-clock frame. Conforms to
//! the F# canonical shape (`src/Core/TravelerFrame.fs`) by AGREEING on the shared seed
//! (`src/Core.TypeScript/traveler-frame/golden-vectors.json`) -- seed-first.
//!
//! A frame is a per-actor `i64` map. `transform` is the causal-join (pointwise max over the union of
//! keys = the LUB); `dominates(a, b)` holds iff `a >= b` on every coordinate of `b` (the semilattice
//! order); `converge` folds `transform` over a list of frames to the LUB (order-independent -- the
//! homeostat convergence). The `tests/golden_vectors.rs` oracle replays the shared seed.

use std::cmp::max;
use std::collections::BTreeMap;

/// A per-actor causal vector clock (the frame's coordinates).
pub type Frame = BTreeMap<String, i64>;

fn coord(f: &Frame, k: &str) -> i64 {
    *f.get(k).unwrap_or(&0)
}

/// The inter-frame transformation: the causal-join (pointwise max over the union of keys).
pub fn transform(a: &Frame, b: &Frame) -> Frame {
    let mut out = Frame::new();
    for k in a.keys().chain(b.keys()) {
        out.insert(k.clone(), max(coord(a, k), coord(b, k)));
    }
    out
}

/// `a` dominates `b`: `a >= b` on every coordinate of `b` (the semilattice order).
pub fn dominates(a: &Frame, b: &Frame) -> bool {
    b.iter().all(|(k, &vb)| coord(a, k) >= vb)
}

/// The common frame of a set: fold `transform` from the origin (the LUB).
pub fn converge(frames: &[Frame]) -> Frame {
    frames.iter().fold(Frame::new(), |acc, f| transform(&acc, f))
}
