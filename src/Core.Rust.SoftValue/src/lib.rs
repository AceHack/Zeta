//! SoftValue -- the Rust oracle (#4 of TS/F#/C#/Rust) for the "how-sure" value axis (DECISION semantics).
//! Conforms to the F# canonical shape (`src/Core/SoftValue.fs`) by AGREEING on the shared seed
//! (`src/Core.TypeScript/soft-value/golden-vectors.json`) -- seed-first.
//!
//! SoftValue is float-valued and floats do not byte-lock across languages, so only the EXACT decision
//! behavior is cross-verified: `resolve` (argmax candidate returned iff confidence >= rational threshold)
//! and `observe_resolve` (Bayesian multiply, then decide). Weights are exact `i64`; the float
//! confidence/entropy values are F#-only. The `tests/golden_vectors.rs` oracle replays the shared seed.

use std::collections::BTreeMap;

/// Candidate weights (exact integers).
pub type Weights = BTreeMap<String, i64>;

// Argmax: max weight, ties broken by ascending key (BTreeMap iterates keys ascending, so the first max wins).
fn argmax(c: &Weights) -> Option<&String> {
    let mut best: Option<(&String, i64)> = None;
    for (k, &w) in c {
        match best {
            Some((_, bw)) if w > bw => best = Some((k, w)),
            None => best = Some((k, w)),
            _ => {}
        }
    }
    best.map(|(k, _)| k)
}

/// The terminal decision: the argmax candidate iff its confidence (best/total) is >= the rational
/// threshold `num`/`den`; otherwise `None` (never falsely certain). Empty => None.
pub fn resolve(c: &Weights, num: i64, den: i64) -> Option<String> {
    if c.is_empty() {
        return None;
    }
    let total: i64 = c.values().sum();
    let best = argmax(c)?.clone();
    let best_weight = c[&best];
    // confidence >= num/den  <=>  best_weight*den >= num*total
    if best_weight * den >= num * total {
        Some(best)
    } else {
        None
    }
}

/// Bayesian observe (pointwise-multiply the likelihood into the prior; drop zeroed candidates -- no
/// fabricated certainty) followed by `resolve`. If every candidate zeroes, the result is `None`.
pub fn observe_resolve(prior: &Weights, likelihood: &Weights, num: i64, den: i64) -> Option<String> {
    let posterior: Weights = prior
        .iter()
        .map(|(k, &w)| (k.clone(), w * likelihood.get(k).copied().unwrap_or(0)))
        .filter(|(_, w)| *w > 0)
        .collect();
    resolve(&posterior, num, den)
}
