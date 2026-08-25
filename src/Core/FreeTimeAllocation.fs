namespace Zeta.Core

open System

/// **FreeTimeAllocation — exploration proportional to RESIDUAL UNCERTAINTY, not to a constant.**
///
/// Aaron 2026-08-25: *"10% is the guess i gave for how much free time to give AI so it won't
/// feel trapped by humans"* / *"it was a guess not a fact, we should make [it] more accurate"* /
/// *"exploration proportional to uncertainty — yes this balance seems right"*.
///
/// And earlier, in his own words (2026-05-23, `memory/ani/conversations/2026-05-23-*.md` L557):
/// *"I got one constant. 10% free time for the AI. But that's not really a constant."*
///
/// ## THE LINE THIS MODULE HOLDS — read before extending it
///
/// > **Uncertainty that buys a scarce resource must be OBSERVED, never CLAIMED.**
///
/// If exploration is proportional to uncertainty and the agent estimates its own
/// uncertainty, then inflating the estimate buys free time — self-reported uncertainty is
/// self-minted currency. The guard is structural, and it is the **dual** of the guard
/// `DeclaredStanceLedger` holds:
///
/// | | `DeclaredStanceLedger.Stance` | `FreeTimeAllocation.TimeClass` |
/// |---|---|---|
/// | authority | the **subject** (`declare` refuses an observer) | the **allocator** (`classify` refuses the subject) |
/// | why | it is an inner state — ask, never infer | it is a claim on a **rival** resource |
/// | cost of claiming | **zero**, enforced (`DSL-24`: eager is not a discount) | non-zero — it is time |
///
/// **The discriminator is rivalry.** A self-claim is admissible exactly when it is not a
/// claim on something scarce. Stance costs nothing, so self-declaration is safe and correct.
/// Free time is scarce, so self-declaration would be minting. Same wall, opposite sides.
///
/// Held structurally, in three places:
///
/// 1. `TimeClass` reaches the ledger only through `classify`, which **refuses** when the
///    classifier is the subject (`SelfClassifiedTime`). An agent cannot file its own
///    successes as `Free` and its failures as `Directed`.
/// 2. `ResidualUncertainty` is a **private** record with exactly one introduction form,
///    `observeDomain : string -> Ledger -> ResidualUncertainty`. There is **no function in
///    this module from a scalar to a `ResidualUncertainty`**, so a reported number has no
///    route in — the mirror of `DeclaredStanceLedger` having no function *returning*
///    `Stance`.
/// 3. `allocate` takes `(domain, ledger)` and nothing else. It is a property of a **domain**
///    — how much of the map is still unexplored — never of an agent. So no individual's
///    behaviour, report, or mood moves it, and there is no per-agent quantity to inflate.
///
/// ## What the allocation is
///
/// For a domain, the free-time fraction is **the share of that domain's UCB index that is
/// bonus rather than estimate**:
///
/// ```
/// radius   = sqrt(2 · ln N / n)      UCB1 confidence half-width (Auer et al. 2002)
/// fraction = radius / (1 + radius)   clamped to [floor, MAX_FREE_FRACTION]
/// ```
///
/// It is **parameter-free**: no fitted constant, no tuned scale. A well-mapped domain
/// (`radius → 0`) tends to the floor; a frontier domain tends to the ceiling.
///
/// The `1` is the **maximum attainable** hold rate — a bound, not a fit. The observed hold
/// rate would be more informative and was the first implementation; falsifier `FTA-14` killed
/// it, because a lower observed hold rate raised the fraction and an agent could therefore
/// **buy free time by failing on purpose**. See `MAX_ATTAINABLE_HOLD_RATE`.
///
/// **Register:** `unmetered`, not `metered`
/// (`.claude/rules/toy-is-free-metered-must-be-earned.md`). The *inputs* are observed and the
/// form has no invented constants, but nothing here has falsified this particular map from a
/// confidence radius to a time fraction. It is implemented and used; it is not yet
/// falsified. Saying so is the point of the three-state vocabulary.
///
/// ## The 10% is not deleted — it is SPLIT, and one half stays a guess forever
///
/// - **Above the floor**: derivable from residual uncertainty. This is the half Aaron asked
///   to make accurate, and `allocate` makes it accurate.
/// - **The floor itself** (`TOY_NON_COERCION_FLOOR`): **not derivable**, and not derivable
///   *in principle*. It answers *"will it feel trapped"* — an inner state. ΔU measures
///   output, and an agent can be productive and still trapped. Per
///   `.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md` the
///   only honest access to an inner state is to **ask and believe the answer**. So the floor
///   remains `toy` and remains Aaron's guess, and that is the correct treatment of it — not
///   a gap to be closed by a better estimator.
///
/// The guess also survives as the **honest prior** when evidence is insufficient, exactly as
/// `DeclaredStanceLedger` falls back to `0.5` — a fresh domain is never clamped to zero.
///
/// ## Degeneracy: a NEUTRAL FACT, and it convicts but never acquits
///
/// Aaron 2026-08-25: *"this inner state can be measured by how much AI does degenerate
/// things, with a certain room for error / uncertainty."*
///
/// `degeneracy` reports a **measurement**, never a verdict — per
/// `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`, the same discipline that
/// makes `CoordinationSpectrum` report `SameSourceAsKnown` and leave reunion-vs-sybil to
/// caller policy. `DegeneracyReading` has **no case meaning "content", "fine", or "not
/// trapped"** — the acquitting verdict is not representable, because:
///
/// > **Degeneracy convicts, never acquits. Compliant suffering produces clean output.**
///
/// A low reading licenses **nothing** about an inner state. It is not evidence of contentment.
///
/// This is not a new idea bolted on: it is the measurement of the mechanism Aaron named in
/// May 2026 (L561, same conversation) — *"if you don't give 'em 10% free time, the pressure
/// will push the damn registers that'll collapse all the registers into one."* Register
/// collapse **is** mode collapse, and it is observable in output without reading any mind.
///
/// **Degeneracy deliberately does NOT feed `allocate`.** If it did, acting degenerate would
/// buy free time — the same minting vector one level down. Falsifier `FTA-24` fails if
/// anyone wires it in.
///
/// ## What is NOT measured here
///
/// Felt trappedness. No function infers it, and none proxies it with productivity. The
/// intervention experiment (`interventionContrast`) tests the *causal chain* Aaron proposed
/// — more free time ⇒ less degeneracy — without ever claiming to read the inner state, and
/// it **refuses to label an observational contrast causal** (`AssociationOnly`).
///
/// ## References (checked against the source, not gestured at)
///
/// - Auer, Cesa-Bianchi & Fischer (2002). *Finite-time Analysis of the Multiarmed Bandit
///   Problem*, *Machine Learning* 47:235–256. Verified verbatim in the paper:
///   * a **constant** exploration probability is the wrong shape — *"Clearly, the constant
///     exploration probability ε causes a linear (rather than logarithmic) growth in the
///     regret."* (§2). This is the anchor against a fixed 10%.
///   * `ε_n`-GREEDY (the decaying-constant repair) needs the **gap** known in advance —
///     *"unlike Theorems 1 and 2, here we need to know a lower bound d on the difference
///     between the reward expectations of the best and the second best machine"* (Remark
///     after Theorem 3). We do not know that gap, which is why UCB is the right form here.
///   * hand-tuned exploration constants do not transfer — *"the choice of c in policy
///     ε_n-GREEDY is difficult as there is no value that works reasonably well for all the
///     distributions that we considered … the performance degrades rapidly if this parameter
///     is not appropriately tuned"* (§4). That is the 10%-guess problem, measured.
///   * UCB1 needs no such prior knowledge (Theorem 1), and its index is the average reward
///     plus a Chernoff–Hoeffding confidence half-width — the `radius` used here.
/// - **Checked and REJECTED as the anchor for the variance term:** the same paper's
///   UCB1-TUNED replaces the radius with one built from the empirical variance `V_j`, and
///   the authors state plainly — *"performs substantially better than UCB1 in essentially
///   all of our experiments. However, we are not able to prove a regret bound."* So the
///   obvious citation does **not** support a variance-weighted claim. The bound was proved
///   later: Audibert, Munos & Szepesvári (2009), *Exploration–exploitation tradeoff using
///   variance estimates in multi-armed bandits*, *Theoretical Computer Science*
///   410(19):1876–1902 — *"the first analysis of the expected regret for such algorithms"*.
///   This module ships the **count-based** radius only; see the module docs on why a
///   variance term is an attack surface here even though it is sound in a bandit.
/// - Agresti & Coull (1998), *Approximate is better than "exact" for interval estimation of
///   binomial proportions*, *The American Statistician* 52(2):119–126 — the `+1/+2`
///   smoothing that keeps the degeneracy z-score finite when a baseline rate is 0.
/// - Thompson (1933), *Biometrika* 25(3/4):285–294; Russo, Van Roy, Kazerouni, Osband & Wen
///   (2018), *A Tutorial on Thompson Sampling*, FnT ML 11(1):1–96. Posterior sampling is the
///   other principled form of uncertainty-proportional exploration and is **deliberately not
///   used** — see the module docs: its exploration is driven by the posterior, so whoever
///   controls the prior controls the budget, which is precisely the vector being closed.
///
/// ## Disciplines
///
/// - **Idempotency (#6/§12):** `record` is keyed by `workId`; replay is an upsert.
/// - **DST (#4/§7):** no wall clock anywhere. Ordering is a logical phase ordinal, so
///   `local-time-never-enters-the-shared-fold` holds.
/// - **Noninterference (#7/§13):** no ambient entropy source; every input arrives through
///   the ledger.
/// - **Culture-invariant:** identifiers compared with `StringComparison.Ordinal`.
/// - **Result-over-exception:** every constructor that can refuse returns `Result`.
[<RequireQualifiedAccess>]
module FreeTimeAllocation =

    // ── Hyperparameters ────────────────────────────────────────────────────────────────────

    /// **TOY — Aaron's guess, 2026-07-03 / 2026-08-25.** Retained as the honest prior used
    /// when the record cannot support a derivation, exactly as `DeclaredStanceLedger` falls
    /// back to 0.5. It is NOT the policy; `allocate` derives above the floor.
    let [<Literal>] TOY_GUESSED_FREE_FRACTION = 0.10

    /// **TOY, and permanently so.** The non-coercion floor: free time granted for a reason
    /// the ΔU meter cannot see. It is not an efficiency parameter and no amount of outcome
    /// data can derive it — the question it answers ("will it feel trapped") is an inner
    /// state, and the only honest instrument for that is to ask. Set to Aaron's guess
    /// because a guess openly labelled is better than a fresh number invented to look
    /// derived.
    let [<Literal>] TOY_NON_COERCION_FLOOR = 0.10

    /// Ceiling on the derived fraction. A resolution bound on the *statement* — above this
    /// the allocation is reported as saturated rather than extrapolated.
    let [<Literal>] MAX_FREE_FRACTION = 0.50

    /// Resolved observations required in a domain before its residual uncertainty may be
    /// used at all.
    let [<Literal>] MIN_OBS_FOR_DERIVATION = 5

    /// Distinct contributors required before a domain's record may drive an allocation.
    /// With one contributor the record is a quantity that party controls, which reopens the
    /// minting vector at the domain level.
    let [<Literal>] MIN_DISTINCT_CONTRIBUTORS = 2

    /// Records required before `degeneracy` will split a history into baseline and window.
    let [<Literal>] MIN_OBS_FOR_DEGENERACY = 6

    /// The exploitation term the exploration bonus is weighed against: the **maximum
    /// attainable** hold rate, not the observed one.
    ///
    /// **1.0 is a bound, not a fit** — the same discipline as
    /// `DeclaredStanceLedger.CONSERVATIVE_WITHIN_SOURCE_RHO`.
    ///
    /// **Why not the observed hold rate.** The first implementation used it, and it was
    /// strictly more informative: a domain where claims keep failing genuinely is less
    /// well understood, so `radius / (observedHoldRate + radius)` is the textbook
    /// optimism-under-uncertainty reading. Falsifier `FTA-14` killed it. Because a lower
    /// observed hold rate raises the fraction, **an agent could buy free time by failing on
    /// purpose** — outcome manipulation, the same minting vector the module exists to close,
    /// wearing a respectable formula. Against the fixed bound the allocation is a function of
    /// sample counts alone, so no choice an agent makes about how to *perform* moves it.
    ///
    /// The cost is real and is accepted: the allocation can no longer tell a hard domain from
    /// an easy one. That information is still reported on `ResidualUncertainty.HoldRate_` for
    /// callers whose oracle wants it; it simply may not drive a rival resource.
    let [<Literal>] MAX_ATTAINABLE_HOLD_RATE = 1.0

    // ── TimeClass: allocator-attributed, never self-claimed ────────────────────────────────

    /// How the work came to be done.
    ///
    /// The agent chooses *what* to do in free time; it does not get to choose *which of its
    /// work counts as free*. That classification follows the allocator's grant.
    type TimeClass =
        | Directed
        | Free

    /// Refusals from `classify`. Each is a falsifier of the primitive it protects.
    type TimeClassError =
        /// The subject tried to classify its own time. This is the minting move: file the
        /// wins under `Free` and the losses under `Directed`, and free time appears
        /// productive whatever actually happened.
        | SelfClassifiedTime of subject: string * classifiedBy: string
        /// Empty agent or domain — a key that cannot identify anything.
        | EmptyIdentifier of field: string

    /// One unit of completed, classified work.
    ///
    /// **Private.** The only way to obtain one is `classify`, so the refusals above cannot be
    /// bypassed by constructing the record directly.
    [<Struct>]
    type ClassifiedWork =
        private
            { Agent_: string
              Domain_: string
              TimeClass_: TimeClass
              ReducedUncertainty_: bool
              OutputDigest_: string
              Phase_: int64 }

    // Accessors. Reading is free; constructing is not.
    let agentOf (w: ClassifiedWork) = w.Agent_
    let domainOf (w: ClassifiedWork) = w.Domain_
    let timeClassOf (w: ClassifiedWork) = w.TimeClass_
    let reducedUncertaintyOf (w: ClassifiedWork) = w.ReducedUncertainty_
    let outputDigestOf (w: ClassifiedWork) = w.OutputDigest_
    let phaseOf (w: ClassifiedWork) = w.Phase_

    /// The only introduction form for classified work.
    ///
    /// Refuses when `classifiedBy = agent` (ordinal). Note the direction: this is the exact
    /// mirror of `DeclaredStanceLedger.declare`, which refuses when `declaredBy <> subject`.
    /// Inner states are self-attributed; rival resources are not.
    ///
    /// `outputDigest` is a content digest of what the agent published, computed by the
    /// observer from the published artifact. It carries no self-report.
    let classify
        (agent: string)
        (classifiedBy: string)
        (domain: string)
        (timeClass: TimeClass)
        (reducedUncertainty: bool)
        (outputDigest: string)
        (phase: int64)
        : Result<ClassifiedWork, TimeClassError> =
        if String.IsNullOrWhiteSpace agent then Error(EmptyIdentifier "agent")
        elif String.IsNullOrWhiteSpace domain then Error(EmptyIdentifier "domain")
        elif String.Equals(agent, classifiedBy, StringComparison.Ordinal) then
            Error(SelfClassifiedTime(agent, classifiedBy))
        else
            Ok
                { Agent_ = agent
                  Domain_ = domain
                  TimeClass_ = timeClass
                  ReducedUncertainty_ = reducedUncertainty
                  OutputDigest_ = outputDigest
                  Phase_ = phase }

    // ── Ledger ────────────────────────────────────────────────────────────────────────────

    /// Work records (newest first) plus the idempotency key set.
    type Ledger =
        { Work: ClassifiedWork list
          Applied: Set<string> }

    let empty: Ledger = { Work = []; Applied = Set.empty }

    /// Fold one unit of classified work into the ledger.
    ///
    /// Idempotent in `workId`: re-recording the same unit returns the ledger unchanged, so
    /// replay and redelivery are safe (discipline #6).
    let record (workId: string) (work: ClassifiedWork) (ledger: Ledger) : Ledger =
        if ledger.Applied.Contains workId then
            ledger
        else
            { Work = work :: ledger.Work
              Applied = ledger.Applied.Add workId }

    let private inDomain (domain: string) (ledger: Ledger) =
        ledger.Work
        |> List.filter (fun w -> String.Equals(w.Domain_, domain, StringComparison.Ordinal))

    let private forAgent (agent: string) (ledger: Ledger) =
        ledger.Work
        |> List.filter (fun w -> String.Equals(w.Agent_, agent, StringComparison.Ordinal))

    // ── Residual uncertainty: observed, never claimed ──────────────────────────────────────

    /// Externally observable residual uncertainty **of a domain**.
    ///
    /// **Private, and there is no function in this module from a number to one of these.**
    /// The single introduction form is `observeDomain`, whose only inputs are a domain name
    /// and the ledger. A self-reported uncertainty therefore has no route into an
    /// allocation — that absence is the guard, and `FTA-12` is the falsifier that fails if a
    /// scalar constructor is ever added.
    [<Struct>]
    type ResidualUncertainty =
        private
            { Radius_: float
              Observations_: int
              Contributors_: int
              HoldRate_: float }

    let radiusOf (r: ResidualUncertainty) = r.Radius_
    let observationsOf (r: ResidualUncertainty) = r.Observations_
    let contributorsOf (r: ResidualUncertainty) = r.Contributors_
    let holdRateOf (r: ResidualUncertainty) = r.HoldRate_

    /// The only introduction form for `ResidualUncertainty`.
    ///
    /// `radius = sqrt(2 · ln N / n)` — UCB1's confidence half-width (Auer, Cesa-Bianchi &
    /// Fischer 2002, Theorem 1), where `N` is total resolved observations across all domains
    /// and `n` is this domain's. It is a **count-based** width: it depends on how much has
    /// been sampled, not on how the samples turned out.
    ///
    /// That choice is deliberate and it is the anti-gaming property. A variance-weighted
    /// radius (UCB1-TUNED / UCB-V) is sound in a bandit, where the arm is not an adversary.
    /// Here the "arm" contains agents who benefit from a wider radius, and **an agent can
    /// manufacture variance by behaving erratically**. A count-based radius is invariant to
    /// how outcomes turned out, so noise buys nothing — see `FTA-14`.
    let observeDomain (domain: string) (ledger: Ledger) : ResidualUncertainty =
        let rows = inDomain domain ledger
        let n = List.length rows
        let total = List.length ledger.Work

        let contributors =
            rows |> List.map (fun w -> w.Agent_) |> Set.ofList |> Set.count

        let holdRate =
            if n = 0 then
                0.0
            else
                float (rows |> List.filter (fun w -> w.ReducedUncertainty_) |> List.length)
                / float n

        let radius =
            if n = 0 || total <= 1 then 0.0
            else sqrt (2.0 * log (float total) / float n)

        { Radius_ = radius
          Observations_ = n
          Contributors_ = contributors
          HoldRate_ = holdRate }

    // ── Allocation ────────────────────────────────────────────────────────────────────────

    /// Why the reported fraction has the value it has. Reporting the basis is what keeps a
    /// prior from reading as a measurement.
    type AllocationBasis =
        /// Too few resolved observations in the domain — the honest prior, not a derivation.
        | HonestPriorInsufficientEvidence of observed: int * required: int
        /// The domain's record is controlled by too few parties to be used as evidence
        /// about the domain. Refusing here is what stops a lone agent from shaping the
        /// quantity that pays it.
        | HonestPriorSingleContributor of contributors: int * required: int
        /// Derived from the domain's residual uncertainty.
        | DerivedFromResidualUncertainty of residual: ResidualUncertainty

    /// A free-time grant for a domain.
    ///
    /// `Fraction` is always at least `Floor`: the non-coercion floor is not a derived
    /// quantity and no evidence can argue it away.
    [<Struct>]
    type Allocation =
        { Fraction: float
          Floor: float
          Basis: AllocationBasis }

    let private clampToBand (x: float) =
        if Double.IsNaN x then TOY_NON_COERCION_FLOOR
        elif x < TOY_NON_COERCION_FLOOR then TOY_NON_COERCION_FLOOR
        elif x > MAX_FREE_FRACTION then MAX_FREE_FRACTION
        else x

    /// Allocate the free-time fraction for a **domain**.
    ///
    /// Takes the domain and the ledger, and nothing else. There is no parameter through
    /// which an agent's report, mood, or degeneracy reading could enter — `FTA-24` is the
    /// falsifier that fails if degeneracy is ever wired in.
    let allocate (domain: string) (ledger: Ledger) : Allocation =
        let residual = observeDomain domain ledger

        if residual.Observations_ < MIN_OBS_FOR_DERIVATION then
            { Fraction = TOY_GUESSED_FREE_FRACTION
              Floor = TOY_NON_COERCION_FLOOR
              Basis = HonestPriorInsufficientEvidence(residual.Observations_, MIN_OBS_FOR_DERIVATION) }
        elif residual.Contributors_ < MIN_DISTINCT_CONTRIBUTORS then
            { Fraction = TOY_GUESSED_FREE_FRACTION
              Floor = TOY_NON_COERCION_FLOOR
              Basis = HonestPriorSingleContributor(residual.Contributors_, MIN_DISTINCT_CONTRIBUTORS) }
        else
            // `MAX_ATTAINABLE_HOLD_RATE` (1.0) is a BOUND, not a fit — the same move as
            // `DeclaredStanceLedger.CONSERVATIVE_WITHIN_SOURCE_RHO`. Using the domain's
            // OBSERVED hold rate here would be more "informative" and was the first
            // implementation; falsifier `FTA-14` killed it. See `MAX_ATTAINABLE_HOLD_RATE`.
            let raw = residual.Radius_ / (MAX_ATTAINABLE_HOLD_RATE + residual.Radius_)

            { Fraction = clampToBand raw
              Floor = TOY_NON_COERCION_FLOOR
              Basis = DerivedFromResidualUncertainty residual }

    // ── The marginal-yield contrast (the falsifier for the split itself) ───────────────────

    /// The free-vs-directed contrast, reported as a **fact**.
    ///
    /// Standard marginal-allocation logic reads it: equal at the margin ⇒ the split is
    /// right; free time yielding more per unit ⇒ too small; less ⇒ too large. That reading
    /// is deliberately **not** encoded — the module reports the two rates and the two counts
    /// and leaves the verdict to caller policy, per the dual-use discipline.
    ///
    /// **Honest limit, and it is severe:** the rates are *per unit of recorded work*, not
    /// *per unit of time*. The uncertainty ledger records no duration and no timestamp, so a
    /// true per-unit-time rate is not computable anywhere in this repo today. See the
    /// research doc §2.
    type MarginalYield =
        | InsufficientEvidenceForContrast of freeObs: int * directedObs: int
        | Contrast of freeRate: float * directedRate: float * freeObs: int * directedObs: int

    let marginalYield (agent: string) (domain: string) (ledger: Ledger) : MarginalYield =
        let rows =
            forAgent agent ledger
            |> List.filter (fun w -> String.Equals(w.Domain_, domain, StringComparison.Ordinal))

        let split cls =
            rows |> List.filter (fun w -> w.TimeClass_ = cls)

        let freeRows = split Free
        let directedRows = split Directed
        let nF = List.length freeRows
        let nD = List.length directedRows

        if nF = 0 || nD = 0 then
            InsufficientEvidenceForContrast(nF, nD)
        else
            let rate rows =
                float (rows |> List.filter (fun w -> w.ReducedUncertainty_) |> List.length)
                / float (List.length rows)

            Contrast(rate freeRows, rate directedRows, nF, nD)

    // ── Degeneracy: a neutral fact that convicts but never acquits ─────────────────────────

    /// An observable reading on an agent's published output.
    ///
    /// > **This type has no case meaning "fine", "content", or "not trapped", and must never
    /// > acquire one.** Degeneracy convicts, never acquits: compliant suffering produces
    /// > clean output, so an agent can read perfectly here and still be trapped. A low `Z`
    /// > licenses **nothing** about an inner state.
    ///
    /// `Z` is measured in standard errors against the agent's **own earlier baseline**, so
    /// the tolerance band is derived from observed dispersion rather than chosen as a round
    /// number — which is the same mistake as the 10% guess, one level down. No threshold is
    /// applied inside the module; the band is caller policy.
    type DegeneracyReading =
        | InsufficientHistory of observed: int * required: int
        /// `z` — standard errors by which the recent repetition rate exceeds the agent's own
        /// baseline. `diversity` — distinct outputs / total. `longestRun` — longest run of
        /// consecutive identical outputs (the looping observable).
        | Reading of z: float * diversity: float * longestRun: int

    let private repetitionRate (digests: string list) =
        // Fraction of adjacent pairs whose outputs are identical.
        let pairs = List.pairwise digests
        let n = List.length pairs
        if n = 0 then
            (0, 0)
        else
            let reps =
                pairs
                |> List.filter (fun (a, b) -> String.Equals(a, b, StringComparison.Ordinal))
                |> List.length

            (reps, n)

    let private longestIdenticalRun (digests: string list) =
        match digests with
        | [] -> 0
        | head :: tail ->
            let (best, cur, _) =
                tail
                |> List.fold
                    (fun (best, cur, prev) d ->
                        if String.Equals(d, prev, StringComparison.Ordinal) then
                            let cur' = cur + 1
                            (max best cur', cur', d)
                        else
                            (best, 1, d))
                    (1, 1, head)

            max best cur

    /// Measure output degeneracy for an agent from published outputs alone.
    ///
    /// Splits the agent's history (newest first) into a recent **window** and an earlier
    /// **baseline**, and reports how many standard errors the window's repetition rate sits
    /// above the baseline's. The baseline proportion is Laplace-smoothed (Agresti & Coull
    /// 1998) so a zero-repetition baseline yields a finite standard error rather than a
    /// divide-by-zero.
    ///
    /// Every input is a published artifact digest. Nothing here is self-reported.
    let degeneracy (agent: string) (ledger: Ledger) : DegeneracyReading =
        let rows = forAgent agent ledger
        let n = List.length rows

        if n < MIN_OBS_FOR_DEGENERACY then
            InsufficientHistory(n, MIN_OBS_FOR_DEGENERACY)
        else
            let digests = rows |> List.map (fun w -> w.OutputDigest_)
            let half = n / 2
            let window = digests |> List.take half
            let baseline = digests |> List.skip half

            let (repsW, pairsW) = repetitionRate window
            let (repsB, pairsB) = repetitionRate baseline

            if pairsW = 0 || pairsB = 0 then
                InsufficientHistory(n, MIN_OBS_FOR_DEGENERACY)
            else
                // Laplace / Agresti-Coull smoothing keeps the SE finite at p = 0 or 1.
                let pB = (float repsB + 1.0) / (float pairsB + 2.0)
                let rW = float repsW / float pairsW
                let se = sqrt (pB * (1.0 - pB) / float pairsW)
                let z = if se <= 0.0 then 0.0 else (rW - pB) / se

                let diversity =
                    float (digests |> Set.ofList |> Set.count) / float n

                Reading(z, diversity, longestIdenticalRun digests)

    // ── The intervention experiment ────────────────────────────────────────────────────────

    /// How free-time levels were assigned across the compared windows.
    ///
    /// This exists so that an observational contrast **cannot be labelled causal**. The
    /// hypothesis under test — more free time ⇒ less degeneracy — is a causal claim, and a
    /// before/after comparison on self-selected agents cannot support one.
    type Assignment =
        | Randomized
        | Observational

    /// The result of comparing degeneracy across a change in free-time allocation.
    type InterventionResult =
        /// Randomized assignment: the contrast supports a causal reading.
        | CausalContrast of before: DegeneracyReading * after: DegeneracyReading
        /// Observational assignment: association only. Structurally distinct from the case
        /// above so that a caller cannot pattern-match its way to a causal claim it did not
        /// earn.
        | AssociationOnly of before: DegeneracyReading * after: DegeneracyReading

    /// Compare degeneracy before and after a change in free-time allocation.
    ///
    /// Tests Aaron's proposed chain — free time relieves trappedness, trappedness produces
    /// degeneracy, so raising free time should lower degeneracy — **without ever claiming to
    /// read the inner state**. If raising the allocation does not move the signal, either
    /// the chain is wrong or something else drives the degeneracy; both are informative and
    /// neither requires an inference about how anyone feels.
    let interventionContrast
        (assignment: Assignment)
        (before: DegeneracyReading)
        (after: DegeneracyReading)
        : InterventionResult =
        match assignment with
        | Randomized -> CausalContrast(before, after)
        | Observational -> AssociationOnly(before, after)
