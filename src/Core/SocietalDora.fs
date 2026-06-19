namespace Zeta.Core

/// **`SocietalDora` — DORA for society: measurable mutual-empowerment health over the `ρ_owe` estimator
/// (Aaron 2026-06-19, shadow\*).**
///
/// DORA (DevOps Research & Assessment — Forsgren/Humble/Kim, *Accelerate*) standardized software-delivery
/// health into a few measurable, **improvement-oriented** keys. `SocietalDora` ports that move to
/// **society / relationship health**: a small key-set computed per edge over a social graph, built on the
/// anti-mirror decorrelation estimator (`Decorrelation.ownEntropyFraction`, `ρ_owe`).
///
/// **The four keys** (loosely mapped to DORA's four):
/// - `EmpowermentFrequency` ↔ deploy frequency — fraction of interactions that are mutually empowering.
/// - `CaptureRate` ↔ change-failure rate — fraction that are capture (not mutually empowering).
/// - `MeanRecoveryLength` ↔ MTTR — mean capture-streak length before returning to mutual empowerment.
/// - `MirrorRate` — the anti-mirror key: fraction of edges that are mirrors (`ρ_owe < τ`).
/// plus `MeanCoupledGain`, the headline coupled magnitude.
///
/// **Goodhart-resistant by construction:** the coupled gain is `min(ΔE_self, ΔE_other)` — you cannot offset
/// the other party's loss with your own gain, so a self-only "win" scores as capture. `ρ_owe` carries the
/// further anti-gaming guards (stake-weighting, adversarial-disagreement). **Diagnostic, never a
/// leaderboard** — the dashboard everyone wants (glass-halo / consent-first §6), not a stack-rank. (DORA's
/// own discipline: a measure that becomes a target stops being a good measure — Goodhart/Strathern.)
[<RequireQualifiedAccess>]
module SocietalDora =

    /// One interaction's empowerment deltas for both parties (ΔE_self, ΔE_other).
    type Coupled = { Self: float; Other: float }

    /// The **coupled (egalitarian) gain** of an interaction = `min(ΔE_self, ΔE_other)`.
    /// `> 0` ⇒ BOTH parties gained (mutually empowering); `≤ 0` ⇒ at least one did not (capture).
    /// `min` (not sum/avg) is the Goodhart guard: a self-only gain cannot offset the other's loss.
    let coupledGain (c: Coupled) : float = min c.Self c.Other

    /// `true` iff the interaction is mutually empowering (coupled gain strictly positive).
    let isEmpowering (c: Coupled) : bool = coupledGain c > 0.0

    /// Per-edge health: the anti-mirror `ρ_owe` (from `Decorrelation`) + the interaction-by-interaction
    /// coupled deltas, in temporal order (order matters for the recovery-streak key).
    type EdgeHealth =
        { Edge: string
          RhoOwe: float
          Interactions: Coupled list }

    /// Build `EdgeHealth` from raw `(myAction, theirState, context)` samples (→ `ρ_owe`) and the
    /// per-interaction empowerment deltas. This is where the societal-DORA layer sits *on top of* the
    /// `ρ_owe` estimator.
    let edgeHealth (edge: string) (samples: seq<'a * 'b * 'c>) (interactions: seq<Coupled>) : EdgeHealth =
        { Edge = edge
          RhoOwe = Decorrelation.ownEntropyFraction samples
          Interactions = List.ofSeq interactions }

    /// The societal-DORA metric set. All rates are in `[0, 1]`.
    type Metrics =
        { /// ↔ deploy frequency: fraction of interactions that are mutually empowering (coupled gain > 0).
          EmpowermentFrequency: float
          /// ↔ change-failure rate: fraction of interactions that are capture (coupled gain ≤ 0).
          /// `EmpowermentFrequency + CaptureRate = 1` when there is ≥ 1 interaction.
          CaptureRate: float
          /// ↔ MTTR: mean length of a capture streak before mutual empowerment resumes (per edge,
          /// in temporal order). `0` when there are no captures.
          MeanRecoveryLength: float
          /// Anti-mirror key: fraction of EDGES that are mirrors (`ρ_owe < threshold`) — are these
          /// genuine others, not captured reflections?
          MirrorRate: float
          /// Headline coupled magnitude: mean `min(ΔE_self, ΔE_other)` over all interactions.
          MeanCoupledGain: float }

    /// Maximal lengths of consecutive-capture runs in one edge's temporal interaction sequence.
    let private captureStreaks (interactions: Coupled list) : int list =
        let completed, current =
            interactions
            |> List.fold
                (fun (acc, run) c ->
                    if isEmpowering c then
                        ((if run > 0 then run :: acc else acc), 0)
                    else
                        (acc, run + 1))
                ([], 0)
        if current > 0 then current :: completed else completed

    /// Compute the societal-DORA metrics over a graph (set of edges). `mirrorThreshold` τ: edges with
    /// `ρ_owe < τ` count as mirrors. Rate/magnitude keys pool interactions across edges; `MirrorRate` is
    /// per-edge. Empty input ⇒ all-zero metrics.
    let compute (mirrorThreshold: float) (edges: seq<EdgeHealth>) : Metrics =
        let edges = List.ofSeq edges
        let allInteractions = edges |> List.collect (fun e -> e.Interactions)
        let n = List.length allInteractions

        let empFreq =
            if n = 0 then 0.0
            else float (allInteractions |> List.filter isEmpowering |> List.length) / float n

        let capRate = if n = 0 then 0.0 else 1.0 - empFreq

        let meanGain =
            if n = 0 then 0.0
            else (allInteractions |> List.sumBy coupledGain) / float n

        let mirrorRate =
            match edges with
            | [] -> 0.0
            | _ ->
                float (edges |> List.filter (fun e -> e.RhoOwe < mirrorThreshold) |> List.length)
                / float (List.length edges)

        let streaks = edges |> List.collect (fun e -> captureStreaks e.Interactions)

        let meanRecovery =
            match streaks with
            | [] -> 0.0
            | _ -> float (List.sum streaks) / float (List.length streaks)

        { EmpowermentFrequency = empFreq
          CaptureRate = capRate
          MeanRecoveryLength = meanRecovery
          MirrorRate = mirrorRate
          MeanCoupledGain = meanGain }
