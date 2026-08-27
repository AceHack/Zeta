namespace Zeta.Core

/// **Two readings of retraction — erasing vs non-erasing.**
///
/// Aaron 2026-08-26: *our −1 can be viewed as full retraction, this is erasing,
/// and uncertainty widening non-erasing.* Dual-use of the same recognition
/// (`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`): the
/// mechanism is retraction; the **observation** decides the thermodynamic class
/// (`ErasureClass` — Landauer 1961 / Bennett 1973).
///
/// Three observations, not one:
///
/// 1. **`ZSet.neg` / `WSet.negate` alone** — self-inverse bijection. Bennett-free.
///    A Landauer meter on negate reads zero forever (`WSet.fs` honesty;
///    `WSet.ErasureClassification.Laws.Tests`).
/// 2. **Full retraction as one op** — `z + (−z)` then the view. Consolidation
///    annihilates `+w` with `−w`; the support is gone. **Erasing** with respect
///    to the materialized view (Landauer pays at annihilation, not at negate).
///    Those two are easily read as one operation, and they are not.
/// 3. **`SoftValue.widen`** — uniform-share floor. Every candidate keeps mass;
///    optionality is restored, never destroyed. **Non-erasing of support.**
///    State-dependent, does not commute with `observe` — local / fold-boundary
///    only. The commutative twin is `foldRetained` (retract the evidence SET).
///
/// Inverse-free corners (Boolean, tropical, EP/ADF re-normalise) do not get
/// reading (2). They can still widen.
[<RequireQualifiedAccess>]
module RetractionReading =

    /// Observation (2): full −1 as one op. The net view is empty — support erased.
    let fullErasesView (z: ZSet<'K>) : bool =
        (ZSet.add z (ZSet.neg z)).IsEmpty

    /// Observation (1): negate is a bijection on Z-sets (Bennett-free).
    let negateIsInvolution (z: ZSet<'K>) : bool =
        ZSet.neg (ZSet.neg z) = z

    /// Observation (3): widen does not drop candidates (non-erasing of support).
    /// `lambda` is a policy parameter, no default — same contract as `SoftValue.widen`.
    let widenKeepsSupport (lambda: float) (sv: SoftValue.SoftValue) : bool =
        let before = SoftValue.candidates sv |> List.length
        let after = SoftValue.candidates (SoftValue.widen lambda sv) |> List.length
        after = before
