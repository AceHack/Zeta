namespace Zeta.Core

/// **UncertainClock — the clock-with-uncertainty leg of the traveler frame (Layer 0).**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-frame, Layer 0 sub-leg.)
///
/// `TravelerFrame` proved the relative-frame *consistency* law over an EXACT causal clock
/// (`Versionstamp`). But a traveler reading a physical clock has bounded uncertainty — its true
/// time lies within a window `[t, t+ε]` set by the maximum clock offset. This module models that
/// the **CockroachDB way**: a **Hybrid Logical Clock** (Kulkarni et al. 2014, "Logical Physical
/// Clocks"; CockroachDB's HLC) carrying an **uncertainty window** `ε`.
///
/// The point of an uncertain clock is that order becomes *partial*: two readings whose windows are
/// disjoint are **definitely** ordered; two whose windows **overlap** are genuinely uncertain — the
/// frame must NOT claim an order it does not have. That uncertain zone is exactly where a
/// [[SoftValue]] would carry a distribution over both orderings rather than collapse to one (the
/// "never falsely certain" calibration, applied to temporal order). With `ε = 0` the window
/// collapses and we recover the exact comparison — the certain `Versionstamp` case `TravelerFrame`
/// already uses.
///
/// Proven (UncertainClock.Tests): `definitelyBefore` is a strict partial order; trichotomy with the
/// uncertain zone; the uncertain relation is reflexive+symmetric; definite order refines the HLC
/// total order (the frame never claims an order contradicting the clock); the `ε = 0` collapse to
/// exact order; and the HLC receive/send rules are monotone (bounded-divergence — the causal-merge
/// half that composes with `TravelerFrame.transform`).
///
/// Anchors: Kulkarni/Demirbas/Madappa/Avva/Leone (HLC, 2014); CockroachDB uncertainty interval;
/// Lamport (logical clocks). Composes [[TravelerFrame]] (exact-clock consistency) + [[SoftValue]]
/// (the uncertain-order zone).
[<RequireQualifiedAccess>]
module UncertainClock =

    /// A Hybrid Logical Clock reading: a physical-time component with a logical tiebreak. Ordered
    /// lexicographically — a total order that tracks causality (the HLC invariant). Distilled to the
    /// int64 essence, like `Versionstamp`.
    type Hlc = { Physical: int64; Logical: int64 }

    /// Lexicographic HLC comparison (-1 / 0 / +1): physical first, logical as tiebreak.
    let compareHlc (a: Hlc) (b: Hlc) : int =
        let c = compare a.Physical b.Physical
        if c <> 0 then c else compare a.Logical b.Logical

    /// **HLC send** (local event / message send): advance to at least the observed physical time,
    /// bumping the logical tiebreak when physical does not move. Monotone.
    let send (c: Hlc) (nowPhysical: int64) : Hlc =
        let p = max c.Physical nowPhysical
        if p = c.Physical then { Physical = p; Logical = c.Logical + 1L }
        else { Physical = p; Logical = 0L }

    /// **HLC receive** (merge a remote reading): the CockroachDB/HLC update rule. The result
    /// dominates both the local and the message clock (bounded divergence) — the causal-merge half
    /// that composes with `TravelerFrame.transform`.
    let receive (c: Hlc) (msg: Hlc) (nowPhysical: int64) : Hlc =
        let p = max (max c.Physical msg.Physical) nowPhysical
        let l =
            if p = c.Physical && p = msg.Physical then (max c.Logical msg.Logical) + 1L
            elif p = c.Physical then c.Logical + 1L
            elif p = msg.Physical then msg.Logical + 1L
            else 0L
        { Physical = p; Logical = l }

    /// An **uncertain timestamp**: an HLC reading plus the max clock-offset window `ε ≥ 0`. The true
    /// event time lies in the closed window `[Physical, Physical + Eps]` (the CockroachDB uncertainty
    /// interval). Construct with `Eps ≥ 0`; `make` enforces it.
    type Uncertain = { Clock: Hlc; Eps: int64 }

    /// Construct an uncertain reading, clamping a negative window to 0 (ε is a non-negative bound).
    let make (clock: Hlc) (eps: int64) : Uncertain = { Clock = clock; Eps = max 0L eps }

    /// The earliest possible true time (window start).
    let lo (u: Uncertain) : int64 = u.Clock.Physical
    /// The latest possible true time (window end). `lo u ≤ hi u` whenever `Eps ≥ 0`.
    let hi (u: Uncertain) : int64 = u.Clock.Physical + u.Eps

    /// **Definite happens-before**: `a`'s whole window ends strictly before `b`'s window begins.
    /// Only then can we be CERTAIN `a` precedes `b`. The sound, partial temporal order.
    let definitelyBefore (a: Uncertain) (b: Uncertain) : bool = hi a < lo b

    /// **The uncertain zone**: neither reading is definitely before the other (their windows
    /// overlap). Here the order is genuinely unknown — the frame must not invent one; a
    /// [[SoftValue]] carries both orderings. Reflexive and symmetric.
    let uncertain (a: Uncertain) (b: Uncertain) : bool =
        not (definitelyBefore a b) && not (definitelyBefore b a)
