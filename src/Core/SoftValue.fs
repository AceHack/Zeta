namespace Zeta.Core

/// **SoftValue — the value-axis "soft" DynamicValue seed (calibrated / probabilistic).**
///
/// A normalized distribution over candidate `DynamicValue`s. The safety property is NOT
/// "always certain" but **"always knows its uncertainty" (calibration / never falsely
/// certain)**: `resolve` collapses to a definite value ONLY when confidence ≥ a threshold —
/// otherwise it returns `None` (held), exactly like the middle value of a three-valued logic
/// is never silently collapsed. This is the **value-axis generalization of `TriBoolean.Tri.N`
/// and `Predicate3`**: where Predicate3 keeps UNKNOWN on the truth axis, SoftValue keeps a
/// full distribution on the value axis.
///
/// `observe` does a Bayesian update with a likelihood and re-normalizes (sharpening with
/// evidence). Crucially, **independent-evidence observes COMMUTE** — posterior ∝ prior · L₁ · L₂
/// and multiplication commutes — so the uncertainty-merge is order-independent. (That is the
/// crux the convergence-despite-reordering analysis flagged: the Bayesian merge is commutative
/// for independent evidence; proven below.)
///
/// Honesty by construction: an `observe` whose likelihood zeroes every candidate (a
/// contradiction) returns `None` rather than fabricating a value — the seed never invents
/// certainty it doesn't have. Composes [[DynamicValue]] + the never-collapse discipline.
[<RequireQualifiedAccess>]
module SoftValue =

    /// **The distribution IS a `WeightedSet` now, not "effectively" one.**
    ///
    /// Held as `WeightedSet<CandidateKey, float>` over `LocalFloatRing` — the semiring-generic
    /// sparse tensor in `src/Core/WeightedSet.fs`, whose `add`/`scale`/`weight`/`inner` this
    /// module now calls instead of re-implementing them over an association list. The key wrapper
    /// exists because `WeightedSet` needs `'K : comparison` and `DynamicValue` is `NoComparison`
    /// (see `src/Core/CandidateKey.fs`); that constraint, not inattention, is why the old comment
    /// in `SoftValueNumeric.fs` said "effectively" and stopped there.
    ///
    /// The weight is `float` **on purpose**: this is a LOCAL posterior. It has no `WireWeight`
    /// (`src/Core/WireWeight.fs`), so it cannot be encoded into shared state; `toExact` below is
    /// the one exit, and it is explicit about what it rounds.
    ///
    /// Invariant (maintained by every constructor): non-empty, all weights > 0, weights sum to 1.
    /// The representation is private so that invariant cannot be bypassed by building the record
    /// directly — `Candidates` is the same read surface it always was.
    [<NoComparison>]
    type SoftValue =
        private
            { Weights: WeightedSet.WeightedSet<CandidateKey, float> }

        /// The candidate distribution (normalized, sums to 1), in **ordinal candidate order**.
        ///
        /// ⚠ CHANGED: this used to be first-seen (arrival) order. A `WeightedSet` is a `Map`, so
        /// the order is now a property of the value rather than of how it was assembled. Reported,
        /// not buried — and it is the direction the rest of the fleet already went: the C#, TS and
        /// Rust `SoftValue` oracles all break `resolve` ties by ascending key, which the old F#
        /// `List.maxBy` (first maximum in arrival order) did not.
        member this.Candidates: (DynamicValue * float) list =
            this.Weights |> WeightedSet.toSeq |> Seq.map (fun (k, w) -> k.Value, w) |> List.ofSeq

    [<Literal>]
    let private EPS = 1e-12

    /// The weight ring. `float`, local, and with no `WireWeight` — the boundary in one line.
    let private R = LocalFloatRing.Instance

    /// Merge equal candidates, drop non-positive weights, normalize.
    /// `None` if nothing positive remains (empty or total ≈ 0) — no fabricated certainty.
    ///
    /// Merging is now `WeightedSet.ofSeq` (duplicate coordinates combine via ⊕) and normalizing is
    /// `WeightedSet.scale`. The total is summed over the MERGED tensor in ordinal order rather
    /// than over the raw input in arrival order — same value in exact arithmetic, and the ordinal
    /// one is the reproducible one when the weights are floats.
    let private build (xs: (DynamicValue * float) list) : SoftValue option =
        let merged =
            xs
            |> Seq.filter (fun (_, w) -> w > 0.0)
            |> Seq.map (fun (d, w) -> CandidateKey d, w)
            |> WeightedSet.ofSeq R

        let total = merged |> WeightedSet.toSeq |> Seq.sumBy snd

        if WeightedSet.isEmpty merged || total <= EPS then
            None
        else
            Some { Weights = WeightedSet.scale R (1.0 / total) merged }

    /// A point mass — fully certain at `dv` (confidence 1).
    let certain (dv: DynamicValue) : SoftValue =
        { Weights = WeightedSet.singleton R (CandidateKey dv) 1.0 }

    /// Build from weighted candidates (merged + normalized). `None` if no positive weight.
    let ofWeighted (xs: (DynamicValue * float) list) : SoftValue option = build xs

    /// **Build WITHOUT normalizing — the invariant-violating route, named so it cannot be taken
    /// by accident.**
    ///
    /// Before this change the representation was a public record, so `{ Candidates = [] }` built
    /// an empty (invariant-violating) `SoftValue` silently, and two downstream suites relied on
    /// exactly that to test their guards — `ComputeReceipt.Tests.fs` CR-6/CR-7 need a value that
    /// `ofWeighted` refuses to produce, because "the guard exists for values that arrive by any
    /// route". Sealing the representation without replacing that route would have deleted a
    /// falsifier, so the route is kept and given a name that states what it is.
    ///
    /// Duplicate candidates still merge (that is the tensor, not the invariant); what is skipped
    /// is normalization and the non-empty check.
    let unnormalized (xs: (DynamicValue * float) list) : SoftValue =
        { Weights = xs |> Seq.map (fun (d, w) -> CandidateKey d, w) |> WeightedSet.ofSeq R }

    /// **Functor map** — relabel each candidate by `f`, merging collisions; weights preserved.
    /// `SoftValue` is the finite-support distribution (Giry) monad; `certain` is its unit.
    let map (f: DynamicValue -> DynamicValue) (sv: SoftValue) : SoftValue =
        build [ for d, p in sv.Candidates -> f d, p ] |> Option.defaultValue sv

    /// **Monad bind** — the distribution-monad `>>=`: each candidate `(d, p)` maps to a
    /// distribution `f d`; the result mixes them as `(w, p·q)`, merged + normalized. With
    /// `certain` as unit this satisfies the monad laws (left/right identity, associativity — see
    /// the tests). This is what makes a **Kleisli arrow** `DynamicValue → SoftValue` composable:
    /// e.g. lowering a distribution over parses into a distribution over lowered programs, the
    /// superposition carried through, never collapsed early.
    let bind (f: DynamicValue -> SoftValue) (sv: SoftValue) : SoftValue =
        build
            [ for d, p in sv.Candidates do
                  for w, q in (f d).Candidates do
                      yield w, p * q ]
        |> Option.defaultValue sv

    /// The candidate distribution (normalized, sums to 1).
    let candidates (sv: SoftValue) : (DynamicValue * float) list = sv.Candidates

    /// Confidence = the probability of the most-likely candidate (1.0 iff a point mass).
    let confidence (sv: SoftValue) : float = sv.Candidates |> List.map snd |> List.max

    /// Shannon entropy (nats) — the system's own measure of how uncertain it is (0 = certain).
    let entropy (sv: SoftValue) : float =
        sv.Candidates |> List.sumBy (fun (_, p) -> if p <= EPS then 0.0 else -p * log p)

    /// Bayesian update: posterior ∝ prior · likelihood, re-normalized. A non-positive likelihood
    /// is clamped to 0 (that candidate refuted). `None` if every candidate is refuted (contradiction).
    let observe (likelihood: DynamicValue -> float) (sv: SoftValue) : SoftValue option =
        build (sv.Candidates |> List.map (fun (d, w) -> d, w * max 0.0 (likelihood d)))

    /// Terminal decision (the ONE legitimate collapse): a definite value iff confidence ≥
    /// `threshold`, else `None` (held / unknown). This is the calibration guarantee — never
    /// returns a value it is not confident enough about; never falsely certain.
    let resolve (threshold: float) (sv: SoftValue) : DynamicValue option =
        let best, p = sv.Candidates |> List.maxBy snd
        if p >= threshold then Some best else None

    /// The weight `sv` assigns to candidate `d` (0 if `d` is absent from the support).
    /// (Now a direct `WeightedSet.weight` lookup — `O(log n)` instead of the old linear scan,
    /// and the semiring supplies the `0` rather than this function hardcoding one.)
    let weightOf (d: DynamicValue) (sv: SoftValue) : float =
        WeightedSet.weight R (CandidateKey d) sv.Weights

    /// **combine — independent-evidence product of two soft values.** The commutative + associative
    /// monoid that lets a soft fold **banana-split and fuse in uncertainty space** without ever
    /// collapsing to a definite value: `combine a b ∝ aᵢ · bᵢ`, renormalized. `None` if their supports
    /// are disjoint (a contradiction — no fabricated certainty, the same discipline as `observe`).
    ///
    /// It is literally `observe` with the other value as the likelihood, so it inherits `observe`'s
    /// normalization and honesty. Because real multiplication commutes and associates, `combine` is a
    /// commutative associative (partial) monoid — therefore folding a node's children with `combine`
    /// is **order-independent** (the soft / NCI analogue of the eager `cata`-fusion law). The carrier
    /// for a `DynamicValueFold.DvAlgebra<SoftValue>` is exactly this: soft cata/bananaSplit/fusion are
    /// the generic schemes at `'r = SoftValue`, and `combine` is the order-free child-combiner.
    let combine (a: SoftValue) (b: SoftValue) : SoftValue option =
        observe (fun d -> weightOf d b) a

    // ── Snap: the policy-gated soft → hard boundary ──
    // The soft model runs entirely in uncertainty space (combine/observe, never collapsing); a *policy*
    // is the one place it is allowed to leave that space and snap to a hard `DynamicValue` that
    // represents the exact (math-provable) value. Bayesian is how we approximate; snap is how we commit.

    /// A **snap policy**: the soft → hard decision. Collapse a soft value to a definite `DynamicValue`,
    /// or hold (`None`) if the policy judges the collapse unwarranted. This is the *only* sanctioned exit
    /// from uncertainty space — everything upstream of it stays soft.
    type SnapPolicy = SoftValue -> DynamicValue option

    /// Snap a soft value to a hard one under a policy. `snap (threshold t)` is calibration-gated (never
    /// falsely certain); `snap best` always takes the argmax. `snap _ (certain dv) = Some dv` — with no
    /// genuine uncertainty the soft layer reproduces exactly the hard value the math team proves.
    let snap (policy: SnapPolicy) (sv: SoftValue) : DynamicValue option = policy sv

    /// Policy: collapse iff confidence ≥ `t` (this is `resolve`, named as a policy).
    let threshold (t: float) : SnapPolicy = resolve t

    /// Policy: always collapse to the most-likely candidate (argmax); never holds.
    let best: SnapPolicy =
        fun sv -> sv.Candidates |> List.maxBy snd |> fst |> Some

    // ── Multi-objective snap: the commit-decision for sensor fusion ──
    // Snap is where a *sensor-fusion* loop commits, so a single threshold is not enough: many sensors
    // (the interrupt handler is one of them, an ISR arrow) each impose an objective. `combine` is the
    // fusion (it folds the sensor distributions into one belief, order-independently); the multi-objective
    // policy is how that fused belief is committed. All pure — no wall clock — so it drops onto the
    // existing wall-clock-free substrate (IScheduler / FerryThrottler / CHIP-8) and stays DST-replayable.

    /// One objective scoring a candidate (higher = better). It may read the fused belief `SoftValue`
    /// (e.g. `posterior`) or be purely value-driven (a sensor's cost/risk/urgency over the candidate).
    ///
    /// Objectives can be **self-aware** (the agent's own state — its flux tank, its uncertainty, its
    /// interrupt-handler-as-sensor) and **society-aware** (the commons / the decorrelated ensemble /
    /// collective bargaining). Both reach self-, society-, and history-state ONLY through an **injected
    /// DI interface** (the single declared, metered door — noninterference), so the objective is built
    /// by *closing over* that injected context and is then a **pure** `SoftValue -> DynamicValue -> float`:
    /// no ambient clock, no resident history (it's externalized behind the DI, e.g. MCP→git), DST-replayable.
    /// The CHIP-8/9 emu runs this the same way — self/society aware, history externalized via the DI.
    type Objective = SoftValue -> DynamicValue -> float

    /// The fused belief itself as an objective — the Bayesian posterior weight of a candidate.
    let posterior: Objective = fun sv d -> weightOf d sv

    /// **Weighted multi-objective policy** — scalarize the objectives by a weighted sum and snap to the
    /// argmax over the belief's support. The support (what `combine` left positive) gates the candidate
    /// set; the objectives rank within it. `weighted [posterior, 1.0]` reduces to `best`.
    let weighted (objectives: (Objective * float) list) : SnapPolicy =
        fun sv ->
            match sv.Candidates with
            | [] -> None
            | cands ->
                cands
                |> List.map fst
                |> List.maxBy (fun d -> objectives |> List.sumBy (fun (o, w) -> w * o sv d))
                |> Some

    /// **Pareto front** — the candidates not strictly dominated on the objectives (`d'` dominates `d`
    /// iff `d'` is ≥ on every objective and `>` on at least one). The *weight-free* multi-objective read:
    /// no objective is coerced above another (NCI-flavoured), so it returns the whole non-dominated set
    /// rather than imposing a scalarization. A downstream tie-break (e.g. `weighted`) commits one.
    let paretoFront (objectives: Objective list) (sv: SoftValue) : DynamicValue list =
        let cands = sv.Candidates |> List.map fst
        let scores d = objectives |> List.map (fun o -> o sv d)
        let dominates d' d =
            let sd', sd = scores d', scores d
            List.forall2 (>=) sd' sd && List.exists2 (>) sd' sd
        cands |> List.filter (fun d -> not (cands |> List.exists (fun d' -> d' <> d && dominates d' d)))

    // ══════════════════════════════════════════════════════════════════════════
    // WIDENING — re-opening a posterior under a non-stationary source
    // ══════════════════════════════════════════════════════════════════════════
    //
    // `observe` sharpens monotonically: posterior ∝ prior · L, and a growing set of
    // consistent evidence concentrates without bound. Under a source that DRIFTS, the
    // belief therefore locks onto stale evidence and cannot re-open. Sivak/Morvan et al.,
    // "Reinforcement learning control of quantum error correction", Nature 655, 879–884
    // (2026), hit the same wall on the policy axis and answer it with a variance floor:
    // "σ(t)² maintains finite spread to never cease exploring."
    //
    // There are TWO ways to re-open a Bayesian posterior, and they are NOT interchangeable —
    // one of them is safe in the shared fold and one of them is not.
    //
    //   (A) WIDEN THE BELIEF     — `widen` below. Untargeted: "everything I know is less
    //                              reliable now", with no culprit named. State-dependent
    //                              (it reads the belief it transforms), and therefore it
    //                              does **NOT** commute with `observe` — the same boundary
    //                              `BeliefConvergence.sharpen` is documented to mark, of
    //                              which `widen` is the exact mirror image (sharpen pushes
    //                              mass toward the peak; widen pushes it toward uniform).
    //                              LOCAL-DECISION / FOLD-BOUNDARY USE ONLY.
    //
    //   (B) RETRACT THE EVIDENCE — `foldRetained` below. Targeted: it names *which*
    //                              observations are discounted, and the posterior is a fold
    //                              over the surviving evidence SET. Because a fold over a set
    //                              is order-independent and `observe` commutes, **(B) commutes
    //                              by construction, with widening enabled**. It is also the
    //                              raw-vault-honest form: the discount is a recorded
    //                              retraction, not an opaque flattening that erases what it
    //                              discounted.
    //
    // (B) is the load-bearing operator; (A) is shipped and labelled to mark the boundary,
    // exactly as `sharpen` is.
    //
    // Anchors (checked, not merely cited):
    //   • Covariance inflation, ensemble Kalman filtering — Anderson & Anderson, Mon. Wea.
    //     Rev. 127 (1999). The classical analogue of (A), and the vocabulary preferred here
    //     ("inflation" / "widening", not "noise"). Their multiplicative inflation P ← (1+δ)P
    //     is the *increment* form; the floor form below is chosen instead because increment
    //     inflation is not idempotent and so is unsafe under DST replay and retry.
    //   • Forgetting factor in recursive least squares (exponential down-weighting of old
    //     evidence) — this is (B) with a geometric schedule, and is why the schedule below is
    //     pluggable rather than hardwired to a hard window.
    //   • Tempering / power posteriors (p ∝ p^β, β<1) — REJECTED as the primitive: p^β is
    //     irrational for rational p, so it cannot ride the exact-ℚ `RationalRing` weights and
    //     would put floats in the byte-lock lineage. The integer multiplicity used by (B)
    //     keeps the whole schedule exact.
    //   • Entropy regularization (Haarnoja et al., SAC) — the paper's own route. Rejected as
    //     the primitive for the same reason (A) is not the load-bearing operator: it is a
    //     belief-reading penalty and does not commute with the evidence fold.
    //
    // NO WALL CLOCK ANYWHERE IN HERE. Staleness is measured in agreed PHASE (logical order
    // carried in the evidence itself), never in elapsed local time
    // (`.claude/rules/local-time-never-enters-the-shared-fold.md`). See `Phase` below.

    /// The **uniform share** of `sv`: the largest `t ∈ [0,1]` such that `sv` can be written
    /// `(1-t)·q + t·uniform` for some distribution `q`. Equals `n · min pᵢ`. This is the
    /// coordinate `widen` floors — the value-axis analogue of the paper's `σ²`.
    /// `0` iff some candidate has zero mass; `1` iff `sv` is exactly uniform.
    let uniformShare (sv: SoftValue) : float =
        let n = List.length sv.Candidates
        float n * (sv.Candidates |> List.map snd |> List.min)

    /// **widen — the idempotent uniform-share FLOOR (belief axis).**
    ///
    /// `uniformShare ← max(uniformShare, lambda)`: if the belief already carries at least
    /// `lambda` of uniform mass it is returned UNCHANGED; otherwise its pure part is remixed
    /// with the uniform distribution to bring the share up to exactly `lambda`. Floor, not
    /// increment — so **applying it twice equals applying it once** (`uniformShare` of the
    /// result is exactly `lambda`, which then satisfies the guard). An increment form
    /// (`p ← (1-λ)p + λu` unconditionally, i.e. classical multiplicative inflation) widens
    /// again on every application and would make DST replay and retry unsafe; that is the
    /// whole reason for the floor formulation.
    ///
    /// Every candidate in the support ends with mass ≥ `lambda/n > 0`, so no candidate is
    /// ever refuted by widening — widening only ever *restores* optionality, never destroys it.
    ///
    /// **`lambda` is a POLICY PARAMETER, deliberately with no default.** No floor constant is
    /// invented here: the honest value depends on how fast the caller's source drifts, and
    /// inventing one would be an unearned number (and `YinYangEnsemble.tsirelsonThreshold`
    /// is `toy` by its own source comment — it is emphatically NOT reused as a floor).
    /// Register: the OPERATOR is metered (its falsifiers are in `SoftValueWidening.Tests.fs`);
    /// any particular `lambda` a caller picks is `unmetered` until that caller meters it.
    ///
    /// ⚠ **State-dependent: does NOT commute with `observe`.** `widen` reads the belief it
    /// transforms, so interleaving it with `observe` is order-dependent and two nodes that
    /// interleave differently WILL diverge. This is the same boundary
    /// `BeliefConvergence.sharpen` is documented to mark. Use it for LOCAL decisions, or once
    /// at the fold boundary (`widen λ (fold …)` is order-independent because the fold under
    /// it is). For re-opening inside a shared fold use `foldRetained`, which commutes.
    let widen (lambda: float) (sv: SoftValue) : SoftValue =
        let n = List.length sv.Candidates
        if n <= 1 || lambda <= 0.0 then sv
        else
            let lambda = min lambda 1.0
            let t = uniformShare sv
            if t >= lambda then sv
            else
                let u = 1.0 / float n
                let a = (1.0 - lambda) / (1.0 - t)
                { Weights =
                    sv.Candidates
                    |> Seq.map (fun (d, p) -> CandidateKey d, a * (p - t * u) + lambda * u)
                    |> WeightedSet.ofSeq R }

    // ── (B) Widening as RETRACTION — the commutative route ──
    //
    // Aaron 2026-08-23: *"our zsets -1 should be able to retract stale priors … seems like we
    // could tie these together too."* They do tie together, and the tie is not a convenience —
    // it is the ONLY formulation that re-opens a posterior without breaking the commutative
    // fold, because it changes the evidence SET rather than reading the belief.
    //
    // MEASURED (2026-08-23), because the whole shape depended on it:
    //   • `Weight` is `int64` (`src/Core/Algebra.fs`), and `ZSet<'K>` — the hot path — is
    //     therefore ℤ. A *fractional* retraction (`-0.1`) is NOT expressible there.
    //   • `ZSetW<'K,'W>` — the generic core — IS ring-generic over `IRing<'W>`, and `IRing`
    //     carries `Negate`; `ZSetW.negate` / `.difference` are exactly retraction.
    //   • `ProbabilitySemiring.RationalRing` already implements `IRing<Rational>` over an
    //     EXACT ℚ. So fractional retraction IS available today, exactly, with no floats —
    //     the ring generalisation the value axis would need was already built and wired.
    //
    // …and then it turned out not to be needed at all, which is the better outcome. A
    // retention schedule expressed as an integer MULTIPLICITY (evidence counted m times ⇒
    // likelihood Lᵐ) gives graded forgetting in ℤ, and dropping m from k to 0 is literally
    // the `-1` retraction. So:
    //   • no fixed-point rescale of shared `ZSet` weights (which would have rewritten
    //     committed golden vectors across all four oracles for no gain),
    //   • no exposure to the `int64` saturation the consolidate path warns about
    //     (multiplicities are small and bounded by `MAX_MULTIPLICITY` below),
    //   • ℚ weights remain available if a continuous schedule is ever wanted.
    // The multiplicity lives inside `SoftValue`'s own fold — smallest blast radius, same result.

    /// **Agreed phase** — a logical sequence position carried BY the evidence, agreed across
    /// nodes. This is the ONLY ordering coordinate the fold is allowed to see.
    ///
    /// This is NOT a new notion of time: it is the phase of the existing phase clock
    /// (`src/Core.TypeScript/observe/phase-clock.ts` — a monotone logical counter with HLC
    /// merge `max(local, peer) + 1`, so peers converge on a shared phase across skew without
    /// any wall clock; Lean semantics in `src/Core.Lean4/ImaginaryStack/PhaseClockErasure.lean`).
    /// That clock's own `wallClockAt` field is documented as "human readability only — NOT the
    /// semantics", which is exactly the discipline this operator inherits. Phase ranges are
    /// already the windowing coordinate elsewhere in the fleet (`observe/attestation-event.ts`
    /// windows are phase ranges), so a phase-keyed retention window is the established shape,
    /// not an invention.
    ///
    /// It must never be derived from a timestamp: a discount keyed on elapsed local time makes
    /// two nodes with different receive-times fold different weights from the same evidence,
    /// and they diverge permanently
    /// (`.claude/rules/local-time-never-enters-the-shared-fold.md`).
    type Phase = int64

    /// One piece of evidence: a likelihood, plus the agreed phase at which it was emitted.
    type Evidence =
        { Phase: Phase
          Likelihood: DynamicValue -> float }

    /// How many times a piece of evidence still counts, given the newest phase present in the
    /// evidence set: `maxPhase -> phase -> multiplicity`. Multiplicity `m` means the
    /// likelihood enters the fold `m` times (`Lᵐ`) — i.e. it is the evidence's Z-set weight,
    /// and lowering it is a retraction. `0` is full retraction.
    ///
    /// A schedule is a pure function of (agreed phase, agreed phase) — it CANNOT read a clock,
    /// and it cannot read arrival order, which is what keeps `foldRetained` commutative.
    type RetentionSchedule = Phase -> Phase -> int

    /// Upper bound on a single piece of evidence's multiplicity. A schedule is caller-supplied,
    /// so an unbounded multiplicity would be an unbounded fold (and, if these multiplicities
    /// were ever pushed into shared `ZSet` weights, a route to the `int64` saturation
    /// `ZSet.consolidateSorted` guards with `Checked.(+)`). Clamped, never trusted.
    [<Literal>]
    let MAX_MULTIPLICITY = 1024

    /// The default schedule: a hard window of `horizon` phases back from the newest evidence.
    /// Multiplicity 1 inside the window, 0 (fully retracted) outside. `horizon <= 0` retains
    /// NOTHING (every piece of evidence is retracted, leaving the prior untouched) — pass `>= 1`.
    ///
    /// `horizon` is a POLICY PARAMETER with no default, for the same reason `lambda` is.
    let window (horizon: int64) : RetentionSchedule =
        fun maxPhase phase -> if horizon > 0L && maxPhase - phase < horizon then 1 else 0

    /// The evidence a schedule still retains (multiplicity > 0). **Idempotent** for any
    /// schedule that retains the newest phase: filtering does not change `maxPhase` (the
    /// newest element always survives, since `maxPhase - maxPhase = 0`), so re-filtering
    /// selects the same set. This is "retract TO a target multiplicity", not "retract BY a
    /// fraction" — the same discipline that makes `widen` a floor rather than an increment.
    let retain (schedule: RetentionSchedule) (evidence: Evidence list) : Evidence list =
        match evidence with
        | [] -> []
        | _ ->
            let maxPhase = evidence |> List.map (fun e -> e.Phase) |> List.max
            evidence |> List.filter (fun e -> schedule maxPhase e.Phase > 0)

    /// **foldRetained — the commutative widening operator.**
    ///
    /// Folds `evidence` into `prior` with each piece weighted by its retention multiplicity.
    /// Stale evidence is RETRACTED (multiplicity 0) rather than the belief being flattened, so:
    ///
    ///   • the posterior **re-opens** under a drifting source (the falsifier: remove the
    ///     schedule and it stays locked on the stale peak);
    ///   • **commutativity is preserved** — the result is a function of the evidence SET and
    ///     the phases carried in it, never of arrival order, so two nodes that receive the
    ///     same evidence in different orders reach the same posterior;
    ///   • a **stationary** source still converges fully inside the window rather than
    ///     jittering forever at a floor — which is where this dominates `widen`, whose floor
    ///     permanently caps confidence at `1 - lambda + lambda/n`.
    ///
    /// `None` on contradiction (every candidate refuted), the same honesty as `observe`.
    let foldRetained
        (schedule: RetentionSchedule)
        (evidence: Evidence list)
        (prior: SoftValue)
        : SoftValue option =
        match evidence with
        | [] -> Some prior
        | _ ->
            let maxPhase = evidence |> List.map (fun e -> e.Phase) |> List.max
            let rec applyN (lik: DynamicValue -> float) n acc =
                if n <= 0 then acc
                else applyN lik (n - 1) (acc |> Option.bind (observe lik))
            evidence
            |> List.fold
                (fun acc e ->
                    let m = min (schedule maxPhase e.Phase) MAX_MULTIPLICITY
                    applyN e.Likelihood m acc)
                (Some prior)

    // ══════════════════════════════════════════════════════════════════════════
    // THE FLOAT / EXACT BOUNDARY — the one sanctioned exit to shared state
    // ══════════════════════════════════════════════════════════════════════════
    //
    // Everything above is float and LOCAL. A `SoftValue` therefore cannot be encoded for the
    // wire: `WeightedSetWire.toDynamicValue` demands a `WireWeight<'W>`, and `WireWeight<float>`
    // does not exist (`src/Core/WireWeight.fs`). The crossing has to be an explicit, lossy,
    // NAMED projection — which is the point. A silent float→wire path is how "floating point
    // errors become the cause of cross machine communication corruptions."

    /// Why a `SoftValue` could not be projected onto exact weights. Data, never thrown.
    [<RequireQualifiedAccess>]
    type ExactError =
        /// The denominator must be in `[1, 1_000_000_000]`. Above that, products of two
        /// numerators can exceed `int64` inside `ProbabilitySemiring.rat`, which does not check
        /// for overflow — an exact ring that silently wraps is worse than an honest float.
        | DenominatorOutOfRange
        /// The projected tensor could not be canonically encoded (a candidate whose
        /// `DynamicValue` has no canonical CBOR form). Surfaced, never thrown.
        | NotEncodable of EncodeError

    /// **toExact — project the local float posterior onto exact ℚ with a stated denominator.**
    ///
    /// Each candidate's weight becomes `nᵢ / denominator` with `nᵢ = round(pᵢ · denominator)`
    /// (banker's rounding, so the rounding itself is not biased). The residual from rounding is
    /// then assigned to the largest-weight candidate — ties broken by ordinal candidate order —
    /// so the projected weights sum to **exactly** `1`, which the floats never quite did.
    ///
    /// This is deliberately NOT an exact re-encoding of the float. An exact one is available
    /// (every finite double IS a rational) and is the wrong choice here: `0.3` is
    /// `5404319552844595 / 18014398509481984`, and multiplying two such weights overflows `int64`
    /// on the first step. Bounded denominator, stated in the signature, is the honest version.
    /// The unbounded version needs a `bigint` rational — which the TypeScript sibling
    /// `src/Core.TypeScript/algebra/exact-weight.ts` already has, and F# does not yet.
    let toExact
        (denominator: int64)
        (sv: SoftValue)
        : Result<WeightedSet.WeightedSet<CandidateKey, ProbabilitySemiring.Rational>, ExactError> =
        if denominator < 1L || denominator > 1_000_000_000L then
            Error ExactError.DenominatorOutOfRange
        else
            let d = float denominator

            let rounded =
                sv.Candidates
                |> List.map (fun (c, p) -> CandidateKey c, int64 (System.Math.Round(p * d, System.MidpointRounding.ToEven)))

            let residual = denominator - (rounded |> List.sumBy snd)

            // Give the residual to the heaviest candidate; `List.maxBy` over the ordinal-ordered
            // list takes the FIRST maximum, so ties resolve by candidate order, not by chance.
            let anchor = rounded |> List.maxBy snd |> fst

            let adjusted =
                rounded
                |> List.map (fun (k, n) -> k, (if k = anchor then n + residual else n))
                |> List.filter (fun (_, n) -> n > 0L)
                |> List.map (fun (k, n) -> k, ProbabilitySemiring.rat n denominator)

            Ok(WeightedSet.ofSeq ProbabilitySemiring.RationalRing.Instance adjusted)

    /// **toWire — the complete crossing: local float belief → exact ℚ → canonical bytes.**
    ///
    /// The only route from a `SoftValue` into shared state, and every step of it is named.
    let toWire (denominator: int64) (sv: SoftValue) : Result<byte[], ExactError> =
        match toExact denominator sv with
        | Error e -> Error e
        | Ok exact ->
            match WeightedSetWire.toCanonicalCbor WireWeight.rational (fun (k: CandidateKey) -> k.Value) exact with
            | Ok bytes -> Ok bytes
            | Error e -> Error(ExactError.NotEncodable e)
