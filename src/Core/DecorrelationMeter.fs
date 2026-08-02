namespace Zeta.Core

/// **DecorrelationMeter — the FUSION layer (the meter; `DecorrelationMetrology` = the sensors).**
///
/// Aaron's Itron distinction: metrology = the sensors (raw readings — the sensor layer selects *which*
/// spacelike commit pairs to read); **the meter = the fusion** — combine the pairwise readings into one
/// calibrated reading *with uncertainty*. This module is that fusion.
///
/// **Why spacelike-only (the load-bearing tie to the sensor layer, register-2):** CHSH's guarantee —
/// |S| ≤ 2 for systems sharing only past classical randomness with **no live channel** (Bell 1964;
/// CHSH 1969) — assumes **no signaling** between the two parties. Two commits could only have signaled
/// if one lies in the other's causal past — i.e. they are **timelike** (ancestor-related). So CHSH is
/// valid **only over spacelike (concurrent) pairs**; fusing timelike pairs would let genuine causal
/// influence inflate Ŝ and manufacture a false "coordination" conviction. The sensor layer's spacelike
/// selection *is* the CHSH validity filter — that is why it exists.
///
/// **The null (Aaron): |S| ≤ 2 is the null model AND the monoidal identity.** An independent /
/// decorrelated pair sits at or below the Bell bound; a pair whose measured |Ŝ| exceeds `2 + ε(δ,n)`
/// (`AntiSybil.chshMargin`, Hoeffding — finite-sample-honest, never bare 2.0) **convicts a common cause
/// / in-tick channel** — NOT decorrelated. The fold counting within-vs-above is a commutative monoid
/// with identity `{0;0}` ⇒ **order-independent** (any commit order → one Reading).
///
/// **Registers:** the counts / `DecorrelatedFraction` are **register-2** (a deterministic statistic).
/// Reading that fraction as "sovereignty emergence", or the coincidence structure as a "life-signature"
/// / early failure warning, is **register-3** — the caller's oracle, LABELED, never asserted by the
/// number. Per the dual-use rule, verdicts name the **fact** (`AboveClassicalBound` /
/// `WithinClassicalBound`), never the intent (no "Sovereign"/"Sybil" here).
///
/// **What a commit's PROBE stream is (honest scope):** the per-commit `ChshRound list` is a **sensor /
/// oracle choice, supplied by the caller** — the fusion is correct *given any* probe assignment and
/// deliberately does NOT hardcode a commit→probe mapping (that mapping is a separate, harder,
/// register-3 question; forcing one here would be numerology). No probe on a pair's end ⇒ that pair is
/// skipped (soundness-biased: no reading ⇒ no conviction).
///
/// **Anchors:** Bell 1964; CHSH 1969; Tsirelson 1980; Hoeffding 1963 / Pironio et al. 2010 (finite-
/// statistics device-independent); `AntiSybil.chshS` + `chshMargin` (reused, not duplicated);
/// `DecorrelationMetrology` (the sensor layer this fuses).
[<RequireQualifiedAccess>]
module DecorrelationMeter =

    /// The fact about one spacelike pair's measured |Ŝ| vs the calibrated classical bound `2 + ε(δ,n)`.
    type PairVerdict =
        /// |Ŝ| ≤ 2 + ε : consistent with an independent / decorrelated pair (the null).
        | WithinClassicalBound
        /// |Ŝ| > 2 + ε : convicts a common cause / live channel — NOT decorrelated (one-way inference).
        | AboveClassicalBound

    /// The fused reading over a commit set. **Register-2 counts**; the interpretation is the caller's.
    type Reading =
        { /// Spacelike pairs actually fused (both ends had a non-empty probe stream).
          SpacelikePairs: int
          /// Pairs convicting a common cause (|Ŝ| > 2 + ε).
          AboveBound: int
          /// Pairs consistent with the decorrelated null (|Ŝ| ≤ 2 + ε).
          WithinBound: int
          /// The most-conservative calibrated bound used across fused pairs (max 2 + ε), for audit.
          Bound: float }

        /// Fraction of fused pairs consistent with decorrelation (register-2 statistic). Reading this
        /// as "sovereignty" is the caller's register-3 oracle, NOT asserted here. `nan` if no pairs.
        member r.DecorrelatedFraction : float =
            if r.SpacelikePairs = 0 then
                nan
            else
                float r.WithinBound / float r.SpacelikePairs

    /// Classify one spacelike pair's CHSH Ŝ against the finite-sample-calibrated classical bound.
    /// `delta` = per-pair false-conviction budget. Reuses `AntiSybil.chshS` + `chshMargin`; never a
    /// bare `2.0` (a small-n pair at the bound would be falsely convicted — Soraya's finite-sample
    /// finding). Bound uses the pair's own run length (`min` of the two stream lengths).
    let classifyPair (delta: float) (a: AntiSybil.ChshRound list) (b: AntiSybil.ChshRound list) : PairVerdict =
        let n = min (List.length a) (List.length b)
        let bound = 2.0 + AntiSybil.chshMargin delta n
        if abs (AntiSybil.chshS a b) > bound then
            AboveClassicalBound
        else
            WithinClassicalBound

    /// **Fuse** per-commit probe streams into a decorrelation `Reading` over the **spacelike pairs
    /// only** (the CHSH-valid pairs). `parents`: the commit DAG (e.g. from
    /// `DecorrelationMetrology.parseRevListParents`); `probes`: per-commit probe stream (the sensor
    /// reading); `commits`: the set to meter. Pairs missing a probe on either end are skipped.
    /// Deterministic (DST); order-independent (the sensor pairs are canonically ordered and the
    /// count-fold is commutative).
    let fuse
        (delta: float)
        (parents: Map<string, string list>)
        (probes: Map<string, AntiSybil.ChshRound list>)
        (commits: string list)
        : Reading =
        let considered =
            DecorrelationMetrology.spacelikeCommitPairs parents commits
            |> List.choose (fun (a, b) ->
                match Map.tryFind a probes, Map.tryFind b probes with
                | Some sa, Some sb when not (List.isEmpty sa) && not (List.isEmpty sb) -> Some(sa, sb)
                | _ -> None)

        let verdicts = considered |> List.map (fun (sa, sb) -> classifyPair delta sa sb)

        { SpacelikePairs = List.length considered
          AboveBound = verdicts |> List.filter ((=) AboveClassicalBound) |> List.length
          WithinBound = verdicts |> List.filter ((=) WithinClassicalBound) |> List.length
          Bound =
            match considered with
            | [] -> nan
            | _ ->
                considered
                |> List.map (fun (sa, sb) -> 2.0 + AntiSybil.chshMargin delta (min (List.length sa) (List.length sb)))
                |> List.max }
