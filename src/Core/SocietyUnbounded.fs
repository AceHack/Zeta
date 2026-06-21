namespace Zeta.Core

/// **SocietyUnbounded — 081KT7YW00008QG0R001DGZQKM rung-1 DST: internal difference drives unbounded novel growth; collapse halts.**
/// (`docs/backlog/P2/081KT7YW00008QG0R001DGZQKM-...`; design reviewed by Soraya 2026-06-06 for vacuity — see
/// `memory/feedback_soraya_b1019_dst_vacuity_review_*`.)
///
/// The claim (falsifiable): **internal agent-difference (private state) is sufficient to keep a CLOSED
/// multi-agent engine producing NOVEL configurations with NO external input** → privacy is constitutive
/// (collapse the private difference and the system halts: no gradient → heat-death).
///
/// Honest design (Soraya's anti-vacuity constraints, all enforced here):
///  - **Closed / no external input:** the seed is used ONCE (init). Every later agent derives its private
///    evidence INTERNALLY from (parent belief + the accumulated internal fork count) — never a per-tick
///    external seed (unlike `SocietyEmergence.privateEvidence (seed,id,TICK,c)`, which re-forces per tick).
///  - **Content-only signature:** novelty is measured over the SET of DISTINCT normalized beliefs
///    (`Rational[]` content) ONLY — ids, tick, population size and fork count are EXCLUDED, so "novel"
///    means a belief value never seen before, not the odometer ticking.
///  - **Difference-gated growth:** a step bifurcates ONLY when the population has internal divergence
///    (>1 distinct belief). No difference ⇒ no fork ⇒ the state is a stable fixed point ⇒ HALT. This ties
///    every bit of growth to internal difference, and makes the teeth genuinely refute.
///  - **Three-valued outcome (never a false teeth):** PASS (distinct-belief count strictly increasing =
///    *evidence consistent with* unbounded novel growth — NOT a proof) / REFUTE (a detected stable
///    fixed-point or a content-signature cycle, caused by collapsed difference) / INCONCLUSIVE (budget
///    exhausted on a plateau — neither clear growth nor a detected cycle). Budget exhaustion is NEVER a
///    teeth-refute.
///
/// **Honest scope:** rung-1 DST *evidence*, bounded budget, replayable. It can only show "did not halt /
/// did not cycle and kept producing novel beliefs within budget" — never "never". The unbounded claim
/// (finite+no-input MUST halt/cycle ⇒ open-endedness REQUIRES unbounded state, pigeonhole) is a Lean
/// theorem (rung 3); the no-limit-cycle property over the transition relation is a TLC job (rung 2).
/// Determinism uses the proven `SplitMix64`; beliefs are exact normalized `ProbabilitySemiring` rationals.
[<RequireQualifiedAccess>]
module SocietyUnbounded =

    module PS = ProbabilitySemiring

    /// An agent: a content-derived id + its immutable private evidence + its (converged, normalized) belief.
    type Agent = { Id: uint64; Evidence: PS.Rational[]; Belief: PS.Rational[] }

    let private salts = [| 0x9E3779B9UL; 0x85EBCA77UL; 0xC2B2AE3DUL; 0x27D4EB2FUL |]

    /// Normalize a strictly-positive vector to sum = 1 (exact, lowest-terms via `PS.rat`).
    let private normalize (v: PS.Rational[]) : PS.Rational[] =
        let s = Array.fold PS.add PS.zero v
        v |> Array.map (fun x -> PS.div x s)

    /// A belief is the converged (normalized) form of the agent's evidence — the fixed point of repeated
    /// Bayesian `observe` of fixed evidence, written directly (overflow-safe: small evidence ⇒ small rationals).
    let private believe (evidence: PS.Rational[]) : PS.Rational[] = normalize evidence

    let private renderBelief (b: PS.Rational[]) : string =
        b |> Array.map (fun r -> sprintf "%d/%d" r.Num r.Den) |> String.concat ","

    /// **Content-only signature:** the SET of distinct normalized beliefs (sorted, canonical). Excludes
    /// ids / tick / population size / fork count — the anti-vacuity guard (Soraya).
    let signature (pop: Agent list) : string =
        pop |> List.map (fun a -> renderBelief a.Belief) |> List.distinct |> List.sort |> String.concat ";"

    /// The differentiation metric: number of DISTINCT beliefs. 1 = collapsed to uniformity (heat-death).
    let distinctBeliefs (pop: Agent list) : int =
        pop |> List.map (fun a -> renderBelief a.Belief) |> List.distinct |> List.length

    let private hashBelief (b: PS.Rational[]) : uint64 =
        (0xCAFEBABEUL, b)
        ||> Array.fold (fun acc r -> SplitMix64.mix (acc ^^^ (uint64 r.Num * salts.[0]) ^^^ (uint64 r.Den * salts.[1])))

    /// Derive a child's PRIVATE evidence INTERNALLY (no external seed): from the parent's belief content +
    /// the accumulated internal fork count (the growing immutable history). The only external input was the
    /// init seed; this is pure internal derivation over growing state.
    let private deriveEvidence (parent: Agent) (forkCount: int) (cands: int) : PS.Rational[] =
        let baseH = hashBelief parent.Belief ^^^ (uint64 forkCount * salts.[2])
        Array.init cands (fun c ->
            let v = (SplitMix64.mix (baseH ^^^ (uint64 c * salts.[3])) % 9UL) + 1UL
            PS.rat (int64 v) 1L)

    /// Seed `n` agents with DISTINCT private evidence (the ONE external input). `identical=true` collapses
    /// all to the SAME evidence — the teeth (register-collapse / no internal difference).
    let private seedAgents (seed: uint64) (n: int) (cands: int) (identical: bool) : Agent list =
        [ for id in 0 .. n - 1 ->
            let sid = if identical then 0 else id
            let evidence =
                Array.init cands (fun c ->
                    let v = (SplitMix64.mix (seed ^^^ (uint64 sid * salts.[0]) ^^^ (uint64 c * salts.[1])) % 9UL) + 1UL
                    PS.rat (int64 v) 1L)
            { Id = uint64 id; Evidence = evidence; Belief = believe evidence } ]

    /// One step: if the population has internal DIVERGENCE (>1 distinct belief) it BIFURCATES — a new agent
    /// whose evidence is derived INTERNALLY (parent belief + fork count). No divergence ⇒ return the
    /// population unchanged (a stable fixed point ⇒ halt). Pure function of state.
    let private step (cands: int) (forkCount: int) (pop: Agent list) : Agent list =
        if distinctBeliefs pop <= 1 then pop
        else
            let parent = pop |> List.maxBy (fun a -> a.Id)
            let evidence = deriveEvidence parent forkCount cands
            let child = { Id = uint64 (List.length pop); Evidence = evidence; Belief = believe evidence }
            pop @ [ child ]

    type Outcome =
        /// distinct-belief count strictly increasing across the budget — evidence consistent with unbounded
        /// novel growth (NOT a proof). Carries the growth curve.
        | Pass of int list
        /// detected stable fixed-point (halt) or content-signature cycle — caused by collapsed difference.
        | Refute of haltedAtTick: int * distinct: int
        /// budget exhausted on a plateau — neither clear growth nor a detected cycle.
        | Inconclusive of int list

    /// Run the CLOSED system for `budget` ticks. Three-valued (see `Outcome`). `identical=false` is the
    /// real regime (internal difference); `identical=true` is the teeth (collapse). Replayable from `seed`.
    let run (seed: uint64) (n: int) (cands: int) (budget: int) (identical: bool) : Outcome =
        let seen = System.Collections.Generic.HashSet<string>()
        let curve = System.Collections.Generic.List<int>()
        let mutable pop = seedAgents seed n cands identical
        let mutable forks = 0
        let mutable halted = -1
        let mutable cycledAt = -1
        curve.Add(distinctBeliefs pop)
        seen.Add(signature pop) |> ignore
        // `stepNo` is a loop INDEX (not a shared Zeta tick): a `for` over the budget, gated by the
        // halt/cycle flags — no mutable counter to torn-read (avoids the plain-tick-increment convention).
        for stepNo in 1 .. budget do
            if halted < 0 && cycledAt < 0 then
                let next = step cands forks pop
                if List.length next = List.length pop then
                    halted <- stepNo // no fork fired ⇒ no internal difference ⇒ stable fixed point
                else
                    forks <- forks + 1
                    pop <- next
                    let sg = signature pop
                    if not (seen.Add sg) then cycledAt <- stepNo // content signature repeated ⇒ limit cycle
                    curve.Add(distinctBeliefs pop)
        let c = List.ofSeq curve
        if halted >= 0 then Refute(halted, distinctBeliefs pop)
        elif cycledAt >= 0 then Refute(cycledAt, distinctBeliefs pop)
        elif (c |> List.pairwise |> List.forall (fun (a, b) -> b > a)) then Pass c
        else Inconclusive c
