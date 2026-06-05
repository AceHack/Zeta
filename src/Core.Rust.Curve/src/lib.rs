//! Curve -- the Rust oracle (#4 of TS/F#/C#/Rust) for the discrete DBSP D/I calculus
//! over the clock. Conforms to the F# canonical shape (`src/Core/Curve.fs`) by AGREEING
//! on the shared seed (`src/Core.TypeScript/curve/golden-vectors.json`) -- seed-first.
//!
//! A signal is values sampled at consecutive clock ticks. `differentiate` is `D = 1 - z^-1`
//! (the per-tick rate of change); `integrate` is `I` (the running prefix sum, the inverse of
//! `D`); `curvature` is `D . D` (the second difference). Exact `i64` arithmetic. The
//! `tests/golden_vectors.rs` oracle replays the shared seed and must match every vector.

/// Differentiate (`D = 1 - z^-1`): the per-tick rate of change. `out[0] = s[0]`;
/// `out[t] = s[t] - s[t-1]` for `t >= 1`.
pub fn differentiate(s: &[i64]) -> Vec<i64> {
    s.iter()
        .enumerate()
        .map(|(i, &v)| if i == 0 { v } else { v - s[i - 1] })
        .collect()
}

/// Integrate (`I`): the running prefix sum -- the inverse of [`differentiate`].
pub fn integrate(s: &[i64]) -> Vec<i64> {
    let mut acc: i64 = 0;
    let mut out = Vec::with_capacity(s.len());
    for &v in s {
        acc += v;
        out.push(acc);
    }
    out
}

/// Curvature (`D . D`): the rate of the rate (second difference).
pub fn curvature(s: &[i64]) -> Vec<i64> {
    differentiate(&differentiate(s))
}
