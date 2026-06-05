//! FrameDelta -- the Rust oracle (#4 of TS/F#/C#/Rust) for the traveler-frame transformation group.
//! Conforms to the F# canonical shape (`src/Core/FrameDelta.fs`) by AGREEING on the shared seed
//! (`src/Core.TypeScript/frame-delta/golden-vectors.json`) -- seed-first.
//!
//! A frame and a delta are per-actor `i64` maps. `compose` is pointwise add (normalized: zero shifts
//! dropped); `inverse` negates; `between(from, to)` is `to - from`; `apply(delta, frame)` is
//! `frame + delta` (keeps zero coordinates -- the union of keys); `magnitude` is the L1 norm; `distance`
//! is `magnitude(between(..))`. The `tests/golden_vectors.rs` oracle replays the shared seed.

use std::collections::BTreeMap;

/// A per-actor map of `i64` (a frame's coordinates or a delta's shifts).
pub type FrameMap = BTreeMap<String, i64>;

fn get(m: &FrameMap, k: &str) -> i64 {
    *m.get(k).unwrap_or(&0)
}

fn normalize(m: FrameMap) -> FrameMap {
    m.into_iter().filter(|(_, v)| *v != 0).collect()
}

/// Compose two transformations (the group op): pointwise add, normalized.
pub fn compose(a: &FrameMap, b: &FrameMap) -> FrameMap {
    let mut out = FrameMap::new();
    for k in a.keys().chain(b.keys()) {
        out.insert(k.clone(), get(a, k) + get(b, k));
    }
    normalize(out)
}

/// The group inverse: negate every shift.
pub fn inverse(d: &FrameMap) -> FrameMap {
    normalize(d.iter().map(|(k, v)| (k.clone(), -v)).collect())
}

/// The transformation taking frame `from` to `to`: per-actor `to - from`.
pub fn between(from: &FrameMap, to: &FrameMap) -> FrameMap {
    let mut out = FrameMap::new();
    for k in from.keys().chain(to.keys()) {
        out.insert(k.clone(), get(to, k) - get(from, k));
    }
    normalize(out)
}

/// Apply a transformation to a frame (group action by translation); keeps zero coordinates.
pub fn apply(delta: &FrameMap, frame: &FrameMap) -> FrameMap {
    let mut out = FrameMap::new();
    for k in delta.keys().chain(frame.keys()) {
        out.insert(k.clone(), get(frame, k) + get(delta, k));
    }
    out
}

/// The L1 magnitude of a transformation: total absolute shift.
pub fn magnitude(d: &FrameMap) -> i64 {
    d.values().map(|v| v.abs()).sum()
}

/// The range between two frames: the L1 distance of their offset.
pub fn distance(from: &FrameMap, to: &FrameMap) -> i64 {
    magnitude(&between(from, to))
}
