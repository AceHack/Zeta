namespace Zeta.Core

/// Fuse CHSH-shaped probe statistics over commit pairs incomparable in recorded ancestry.
/// DAG incomparability does not establish physical separation, prevent communication, or
/// prove Bell measurement assumptions. The caller supplies probes and independently owns
/// setting randomization, measurement independence, locality and sampling validity.
///
/// Eligible probe pairs are compared with a coverage-limited HAC engineering bound.
/// Above/within results are arithmetic observations, not diagnoses of a live channel,
/// superdeterminism, shared sources, independence or physical identity. HAC and the
/// minimum-bucket cap do not establish general dependent-sample calibration.
///
/// Missing probe endpoints are skipped. Nonempty pairs with missing settings, malformed
/// paired values or invalid margin parameters are explicitly unmeasured. The fold retains
/// measured and refused counts separately, and finite bounds cover measured pairs only.
/// See docs/research/chsh-coverage/2026-09-06-audit.md for the prior claims, source review,
/// deterministic counterexamples, and CHSH (1969) / Gill finite-statistics grounding.
[<RequireQualifiedAccess>]
module DecorrelationMeter =

    /// One eligible pair's |Ŝ| compared with the engineering threshold `2 + ε`.
    /// The case names retain the classical-bound reference without asserting physical validity.
    type PairVerdict =
        /// Coverage, paired probe values or margin parameters do not support a reading.
        | Unmeasured
        /// |Ŝ| <= 2 + ε for an eligible pair. Does not establish independence.
        | WithinClassicalBound
        /// |Ŝ| > 2 + ε for an eligible pair. Does not identify why the threshold was exceeded.
        | AboveClassicalBound

    /// Fused arithmetic observations over a commit set; external assumptions are not inferred.
    type Reading =
        { /// Spacelike pairs actually fused (both ends had a non-empty probe stream).
          SpacelikePairs: int
          /// Eligible pairs above their engineering threshold (|Ŝ| > 2 + ε).
          AboveBound: int
          /// Eligible pairs within their engineering threshold (|Ŝ| <= 2 + ε).
          WithinBound: int
          /// Non-empty probe pairs refused by the coverage/value/margin boundary.
          UnmeasuredPairs: int
          /// Maximum finite engineering bound among eligible pairs only; no bound over refused pairs.
          /// None when no pair has an eligible finite margin; serializes as null.
          Bound: float option }

        /// Fraction of eligible pairs within their engineering thresholds, not a decorrelation
        /// or identity measure. None if no measured pairs; refused pairs are excluded.
        member r.WithinBoundFraction : float option =
            let measured = r.SpacelikePairs - r.UnmeasuredPairs
            if measured = 0 then
                None
            else
                Some(float r.WithinBound / float measured)

    /// Compare an eligible paired probe statistic with `2 + chshMarginAutocorr delta a b`.
    /// `delta` in (0,1) controls the engineering margin; it is not a proved error budget
    /// for arbitrary supplied streams. Missing settings, malformed paired probes or
    /// invalid margin parameters return Unmeasured. Neither branch diagnoses a cause.
    let classifyPair (delta: float) (a: AntiSybil.ChshRound list) (b: AntiSybil.ChshRound list) : PairVerdict =
        let bound = 2.0 + AntiSybil.chshMarginAutocorr delta a b
        if not (System.Double.IsFinite bound) then
            Unmeasured
        elif abs (AntiSybil.chshS a b) > bound then
            AboveClassicalBound
        else
            WithinClassicalBound

    /// Fuse per-commit probe streams into a Reading over pairs incomparable in the
    /// recorded DAG. This ancestry filter does not establish CHSH validity. `parents`: the DAG (e.g. from
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
          UnmeasuredPairs = verdicts |> List.filter ((=) Unmeasured) |> List.length
          Bound =
            considered
            |> List.map (fun (sa, sb) -> 2.0 + AntiSybil.chshMarginAutocorr delta sa sb)
            |> List.filter System.Double.IsFinite
            |> function [] -> None | bounds -> Some(List.max bounds) }
