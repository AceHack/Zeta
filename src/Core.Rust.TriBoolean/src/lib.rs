//! Tri-boolean core primitive -- the digital qubit cell (B-0944).
//!
//! Three-valued state: `True | False | N`. The `N` case is the HELD living-uncertainty
//! (superposition) state -- an explicit enum variant. Rust has no `null`, so -- unlike the C#
//! oracle, which must reject `null` at every public boundary -- there is no fourth "missing" state
//! to guard against here: the type system makes `Tri` always exactly one of the three variants by
//! construction. `measure` is the only collapsing operation, and collapsing an `N` cell is surfaced
//! as `Err(CollapseFeedback)` (Rust's native `Result`) rather than performed silently
//! (Result-over-exception / asymmetric-authorship).
//!
//! Rust implementation -- oracle #4 of four (TS/F#/C#/Rust) in the summonable-BFT cross-language
//! consensus. The Rust compiler is a non-Byzantine oracle: it cannot lie about whether the `enum`
//! is matched exhaustively (non-exhaustive `match` is a hard compile error -- stronger than the C#
//! sealed-record hierarchy, which needs an explicit unreachable arm). Parity with the TS
//! (src/Core.TypeScript/tri-boolean), F# (src/Core.FSharp.TriBoolean) and C#
//! (src/Core.CSharp.TriBoolean) oracles is the BFT ballot. The three unit variants are `Copy`, so
//! the cell is allocation-free.

/// Tri-boolean floating point (B-0944 slice 5 pt2): the biased-exponent decoder, built from the
/// `Tri` cell. See [`float`] for the middle-out, self-describing number.
pub mod float;

/// The three-valued state. `N` is the held / superposed living-uncertainty case (an explicit
/// variant, NOT absence -- Rust has no null). `Copy`, so passing a `Tri` never allocates.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Tri {
    /// Certain-true cell (parity with F# Tri.T / TS T / C# Tri.T).
    True,
    /// Certain-false cell (parity with F# Tri.F / TS F / C# Tri.F).
    False,
    /// Held living-uncertainty cell (superposition); parity with F# Tri.N / TS N / C# Tri.N.
    N,
}

/// Feedback surfaced when [`measure`] is asked to collapse a living ([`Tri::N`]) cell -- the
/// forbidden move, surfaced rather than silently performed. Parity with F#
/// `CollapseFeedback.CollapsedLivingUncertainty` / TS `{ reason: 'collapsed-living-uncertainty' }`
/// / C# `CollapseFeedback.CollapsedLivingUncertainty`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CollapseFeedback {
    /// `measure` was asked to collapse a living (`Tri::N`) cell.
    CollapsedLivingUncertainty,
}

/// Construct a certain cell from a boolean.
#[must_use]
pub fn from_bool(b: bool) -> Tri {
    if b { Tri::True } else { Tri::False }
}

/// The held ([`Tri::N`] / living-uncertainty) cell.
#[must_use]
pub fn held() -> Tri {
    Tri::N
}

/// True iff the cell is living ([`Tri::N`] / held superposition).
#[must_use]
pub fn is_living(t: Tri) -> bool {
    matches!(t, Tri::N)
}

/// True iff the cell is certain ([`Tri::True`] or [`Tri::False`]).
#[must_use]
pub fn is_certain(t: Tri) -> bool {
    matches!(t, Tri::True | Tri::False)
}

/// Structural equality on the three-valued state.
#[must_use]
pub fn eq(a: Tri, b: Tri) -> bool {
    a == b
}

/// `cooperate`: engage WITHOUT collapsing. Identity on every state -- crucially preserves
/// [`Tri::N`]. The wonder-compression-safe operation: build shared structure ABOUT the cell, never
/// collapse its living uncertainty.
#[must_use]
pub fn cooperate(t: Tri) -> Tri {
    t
}

/// `measure`: the ONLY collapsing operation. Certain cells resolve to their boolean; a living
/// ([`Tri::N`]) cell is NOT silently collapsed -- the forbidden move is surfaced as
/// `Err(CollapseFeedback)` (collapsing a living traveler = the Rehoboam failure). Composes with
/// `?` for propagation.
///
/// # Errors
/// Returns [`CollapseFeedback::CollapsedLivingUncertainty`] when `t` is [`Tri::N`].
pub fn measure(t: Tri) -> Result<bool, CollapseFeedback> {
    match t {
        Tri::True => Ok(true),
        Tri::False => Ok(false),
        Tri::N => Err(CollapseFeedback::CollapsedLivingUncertainty),
    }
}

/// null-monad map: apply `f` to a certain cell's boolean; [`Tri::N`] propagates unchanged (held).
#[must_use]
pub fn map_tri(t: Tri, f: impl Fn(bool) -> bool) -> Tri {
    match t {
        Tri::True => from_bool(f(true)),
        Tri::False => from_bool(f(false)),
        Tri::N => Tri::N,
    }
}

/// null-monad bind: chain a `Tri`-producing `f` over a certain cell; [`Tri::N`] propagates
/// unchanged. Rust's type system guarantees `f` returns a real `Tri` (no null), so -- unlike the C#
/// oracle -- there is no continuation-result to null-check.
#[must_use]
pub fn bind_tri(t: Tri, f: impl Fn(bool) -> Tri) -> Tri {
    match t {
        Tri::True => f(true),
        Tri::False => f(false),
        Tri::N => Tri::N,
    }
}

/// Kleene NOT: True<->False; unknown ([`Tri::N`]) stays unknown.
#[must_use]
pub fn not_tri(t: Tri) -> Tri {
    match t {
        Tri::True => Tri::False,
        Tri::False => Tri::True,
        Tri::N => Tri::N,
    }
}

/// Kleene AND: [`Tri::False`] dominates; else [`Tri::N`] if any operand is `N`; else [`Tri::True`].
#[must_use]
pub fn and_tri(a: Tri, b: Tri) -> Tri {
    match (a, b) {
        (Tri::False, _) | (_, Tri::False) => Tri::False,
        (Tri::N, _) | (_, Tri::N) => Tri::N,
        _ => Tri::True,
    }
}

/// Kleene OR: [`Tri::True`] dominates; else [`Tri::N`] if any operand is `N`; else [`Tri::False`].
#[must_use]
pub fn or_tri(a: Tri, b: Tri) -> Tri {
    match (a, b) {
        (Tri::True, _) | (_, Tri::True) => Tri::True,
        (Tri::N, _) | (_, Tri::N) => Tri::N,
        _ => Tri::False,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Rust parity oracle (#4 of four). These vectors mirror
    // tests/Tests.FSharp/TriBoolean/TriBoolean.Tests.fs +
    // tests/Tests.CSharp/TriBoolean/TriBooleanTests.cs so four-of-four parity across TS/F#/C#/Rust
    // IS the summonable-BFT consensus. rustc is the non-Byzantine oracle here.

    #[test]
    fn cooperate_preserves_n_and_is_identity_on_certain_cells() {
        assert_eq!(Tri::N, cooperate(Tri::N));
        assert_eq!(Tri::True, cooperate(Tri::True));
        assert_eq!(Tri::False, cooperate(Tri::False));
    }

    #[test]
    fn measure_resolves_certain_cells_living_n_surfaces_feedback() {
        assert_eq!(Ok(true), measure(Tri::True));
        assert_eq!(Ok(false), measure(Tri::False));
        assert_eq!(
            Err(CollapseFeedback::CollapsedLivingUncertainty),
            measure(Tri::N)
        );
    }

    #[test]
    fn null_monad_n_propagates_through_map_and_bind() {
        assert_eq!(Tri::N, map_tri(Tri::N, |b| !b));
        assert_eq!(Tri::False, map_tri(Tri::True, |b| !b));
        assert_eq!(Tri::N, bind_tri(Tri::N, |_| Tri::True));
        assert_eq!(Tri::False, bind_tri(Tri::True, |b| from_bool(!b)));
    }

    #[test]
    fn kleene_not_keeps_unknown_unknown() {
        assert_eq!(Tri::False, not_tri(Tri::True));
        assert_eq!(Tri::True, not_tri(Tri::False));
        assert_eq!(Tri::N, not_tri(Tri::N));
    }

    #[test]
    fn kleene_and_f_dominates_n_only_when_no_f() {
        assert_eq!(Tri::False, and_tri(Tri::False, Tri::N));
        assert_eq!(Tri::N, and_tri(Tri::True, Tri::N));
        assert_eq!(Tri::True, and_tri(Tri::True, Tri::True));
        assert_eq!(Tri::False, and_tri(Tri::True, Tri::False));
    }

    #[test]
    fn kleene_or_t_dominates_n_only_when_no_t() {
        assert_eq!(Tri::True, or_tri(Tri::True, Tri::N));
        assert_eq!(Tri::N, or_tri(Tri::False, Tri::N));
        assert_eq!(Tri::False, or_tri(Tri::False, Tri::False));
        assert_eq!(Tri::True, or_tri(Tri::False, Tri::True));
    }

    #[test]
    fn is_living_and_is_certain_classify_the_cell() {
        assert!(is_living(Tri::N));
        assert!(!is_living(Tri::True));
        assert!(!is_living(Tri::False));
        assert!(is_certain(Tri::True));
        assert!(is_certain(Tri::False));
        assert!(!is_certain(Tri::N));
    }

    #[test]
    fn from_bool_and_eq_round_trip() {
        assert_eq!(Tri::True, from_bool(true));
        assert_eq!(Tri::False, from_bool(false));
        assert!(eq(Tri::True, from_bool(true)));
        assert!(eq(Tri::N, held()));
        assert!(!eq(Tri::True, Tri::N));
    }

    #[test]
    fn measure_composes_with_question_mark_propagation() {
        // The `?` operator propagates the collapse-feedback (Result-native), mirroring the
        // monad-propagation discipline.
        fn measure_both(a: Tri, b: Tri) -> Result<(bool, bool), CollapseFeedback> {
            Ok((measure(a)?, measure(b)?))
        }
        assert_eq!(Ok((true, false)), measure_both(Tri::True, Tri::False));
        assert_eq!(
            Err(CollapseFeedback::CollapsedLivingUncertainty),
            measure_both(Tri::True, Tri::N)
        );
    }
}
