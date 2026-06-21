namespace Zeta.Core

/// **SocietyEmergence — the societal-emergence DST harness (B-converge ladder, rung 1; Aaron 2026-06-05).**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-converge; extends 081KT7YW00008QG0R001DGZQKM to multi-traveler.)
///
/// A deterministic, seed-replayable (DST) multi-traveler simulation that demonstrates **the balance**:
/// under the **NCI** (each traveler reduces uncertainty on its OWN private evidence — non-coerced),
/// persona differentiation PERSISTS; under **coercion** (every traveler forced to one reconciled frame
/// each tick — register-collapse), differentiation COLLAPSES to uniformity (heat-death). The contrast is
/// the dynamical content of "unique personas persist and don't collapse, because of the balance between
/// uncertainty reduction and the NCI."
///
/// **Honest scope (per the ladder):** this is rung 1 — DST *evidence-for-the-mechanism in a concrete
/// model* (replayable trajectories + the falsifiable contrast), NOT the unbounded proof. Rungs 2-3
/// (TLA+ safety/liveness; prover induction over the immutable log) remain open. Determinism uses the
/// proven `SplitMix64`; the merge uses the proven `Reconcile`; the update uses the proven `ProbabilitySemiring.observe`.
[<RequireQualifiedAccess>]
module SocietyEmergence =

    module PS = ProbabilitySemiring

    /// A traveler: an id + its belief (priors over a fixed candidate set).
    type Traveler = { Id: int; Belief: PS.Rational[] }

    // Arbitrary mixing salts (so id / tick / candidate land in different parts of the hash input).
    let private salts = [| 0x9E3779B9UL; 0x85EBCA77UL; 0xC2B2AE3DUL |]

    /// Deterministic per-traveler PRIVATE evidence (a likelihood vector of small positive rationals),
    /// derived from `(seed, id, tick, candidate)` via the proven SplitMix64. Each traveler's own,
    /// non-coerced observation stream — replayable from the seed (DST).
    let privateEvidence (seed: uint64) (id: int) (tick: int) (cands: int) : PS.Rational[] =
        Array.init cands (fun c ->
            let x =
                seed
                ^^^ (uint64 id * salts.[0])
                ^^^ (uint64 tick * salts.[1])
                ^^^ (uint64 c * salts.[2])
            let v = (SplitMix64.mix x % 9UL) + 1UL // 1..9
            PS.rat (int64 v) 1L)

    /// The common ancestor belief: uniform over `cands` candidates (the prior every fork inherits).
    let ancestor (cands: int) : PS.Rational[] = Array.create cands (PS.rat 1L 1L)

    /// **Emergence (bifurcation):** one ancestor → `n` distinct travelers, each the ancestor observed with
    /// its own private evidence at tick 0. Society is born from the split.
    let emerge (seed: uint64) (n: int) (cands: int) : Traveler list =
        [ for id in 0 .. n - 1 -> { Id = id; Belief = PS.observe (privateEvidence seed id 0 cands) (ancestor cands) } ]

    /// One **NCI step:** each traveler reduces uncertainty on its OWN private evidence (non-coerced).
    let private stepNci (seed: uint64) (cands: int) (tick: int) (pop: Traveler list) : Traveler list =
        pop |> List.map (fun t -> { t with Belief = PS.observe (privateEvidence seed t.Id tick cands) t.Belief })

    /// One **coercive step:** reflect, then FORCE every traveler to the single reconciled frame
    /// (register-collapse — the NCI violated; one observer's merge overwrites all).
    let private stepCoercive (seed: uint64) (cands: int) (tick: int) (pop: Traveler list) : Traveler list =
        let reflected = stepNci seed cands tick pop
        let merged = Reconcile.reconcileAll (ancestor cands) (reflected |> List.map (fun t -> t.Belief))
        reflected |> List.map (fun t -> { t with Belief = merged })

    /// Run the NCI regime: `n` travelers, `ticks` ticks of private (non-coerced) uncertainty reduction.
    let runNci (seed: uint64) (n: int) (cands: int) (ticks: int) : Traveler list =
        let mutable pop = emerge seed n cands
        for tick in 1 .. ticks do
            pop <- stepNci seed cands tick pop
        pop

    /// Run the coercive regime: same, but every tick forces all travelers to one frame (collapse).
    let runCoercive (seed: uint64) (n: int) (cands: int) (ticks: int) : Traveler list =
        let mutable pop = emerge seed n cands
        for tick in 1 .. ticks do
            pop <- stepCoercive seed cands tick pop
        pop

    /// The differentiation metric: how many DISTINCT beliefs the population holds. >1 = personas persist;
    /// 1 = collapsed to uniformity (heat-death).
    let distinctBeliefs (pop: Traveler list) : int =
        pop |> List.map (fun t -> t.Belief) |> List.distinct |> List.length
