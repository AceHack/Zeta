namespace Zeta.Core

open System

/// **DeclaredStanceLedger — the OUTCOME RECORD of Eve Protocol pre-declared bias.**
///
/// Work-item `081M0X49HBD087G0R001HM9VHF`. Composes with the Eve Protocol primitive
/// *pre-declared bias* (`docs/backlog/P2/081KRW63S0008QG0R0030F8ZXA-eve-protocol-*.md`),
/// which is the **per-exchange** half: a party states, before a result arrives, that it
/// wants a particular answer to be true. This module is the **across-exchange** half:
/// the posterior a counterparty uses when no declaration is offered, or when it wants to
/// know whether this party's declarations have historically meant anything.
///
/// ## THE LINE THIS MODULE HOLDS — read before extending it
///
/// > **The outcome record is trackable. The inner state is not.**
///
/// *"This party's claims declared under `Eager` have held up 40% of the time"* is a
/// measurement of **results**. *"This party is an eager person"* is an inference about
/// their **inner life**, which `.claude/rules/engagement-profiles-public-work-only-not-
/// surveillance-dossiers.md` forbids (ask, never infer, about internal states) and which
/// contradicts pigeonhole-by-self-claim (the subject supplies the category, the evidence
/// supplies the truth value).
///
/// The line is held **structurally**, not by convention:
///
/// 1. `Stance` has exactly one introduction form — `declare` — and it **refuses** when the
///    declarer is not the subject (`ObserverAttributedStance`). There is no function
///    anywhere in this module with signature `... -> Stance`; the stance is always an
///    input, never an output. An observer cannot compute one.
/// 2. The stance is a **key**, not a value: it selects which cell an outcome is filed
///    under. Nothing in the module updates, corrects, or re-derives it.
/// 3. Everything the module *produces* is a statistic over resolved claims —
///    `holdRate`, `informativeness`, `searchProfile`, `beneficiaryProfile`. Each is a
///    property of published claims and their published resolutions.
///
/// ## Composition: declaration (per-exchange) with posterior (across-exchange)
///
/// The declaration is an **observation** that selects a cell; the resolution is the
/// observation that updates it. When a counterparty must weigh a claim:
///
/// - **Declaration present, and it discriminates for this party** → use that cell's
///   posterior (`DeclaredCell`).
/// - **Declaration present, but this party's cells are indistinguishable** → the
///   declaration carries no information *for this party*, so pool across stances
///   (`PooledAcrossStances`). Note what does **not** happen: the party is not relabelled.
///   A party declaring `Neutral` whose record matches its `Eager` record is **still
///   filed under `Neutral`** — its declaration remains authority over its *intent*. It
///   is simply not authority over *accuracy*, and the record is the evidence about that.
/// - **Not enough evidence** → 0.5, the honest prior (TrueSkill convention; a fresh
///   identity is never clamped to 0).
///
/// ## What is NOT modelled, and why
///
/// Aaron 2026-08-25: *"eager is also aggressive and reaches local optima quicker and gets
/// stuck, it's mostly selfish but not always in the extremes."*
///
/// - The **dynamics** ("reaches local optima quicker and gets stuck") is characterised as
///   a *temperature* (a variance), not a *rate* — argued in
///   `docs/research/2026-08-25-declared-stance-posterior-eagerness-is-a-temperature-not-a-rate.md`.
///   Its only in-code consequence is `searchProfile`, which measures the **observable
///   signature** the characterisation predicts (marginal yield stops improving) from the
///   resolution record. The generating model itself is a **toy** and is not fitted to
///   anybody here.
/// - The **tails** ("mostly selfish but not always in the extremes") is **declined**.
///   Selfishness is a motivation — the exact object the ask-don't-infer rule protects —
///   so no function maps a declared stance to self-interest, and `Stance` deliberately
///   carries **no continuous intensity**, because an intensity is precisely what would
///   invite the monotone curve Aaron's own statement contradicts. What is recorded
///   instead is `Beneficiary`: who the resolved claim's value actually accrued to, which
///   is an allocation you can observe. The shape relating the two is **UNKNOWN** and is
///   left unknown. `weigh` is invariant to `Beneficiary` by construction — see falsifier
///   `DSL-31`, which fails if anyone wires a selfishness penalty in.
///
/// ## References (checked, not gestured at)
///
/// - Herbrich, Minka, Graepel (2006). *TrueSkill™: A Bayesian Skill Rating System*.
///   NIPS 2006. — the EP/ADF posterior reused here via `TravelerRankLedger`.
/// - Kish, L. (1965). *Survey Sampling*, Wiley, §8.2 — the **design effect**
///   `deff = 1 + (m-1)·ρ`, hence `n_eff = n / (1 + (n-1)·ρ)`. This is the identity that
///   makes *"an eager party producing five supporting arguments has produced
///   approximately one"* a quantity rather than a slogan: at ρ = 1, `n_eff = 1` for any
///   `n`. The same identity already appears in `src/Bayesian/CondorcetBoundary.fs`
///   (`effectiveN`) for correlated jurors; it is restated here rather than referenced
///   because `Zeta.Core` does not depend on `Zeta.Bayesian`.
///
/// ## Disciplines
///
/// - **Idempotency (#6):** `record` is keyed by `claimId`; re-applying a resolution is an
///   upsert, not a double count (`DSL-20`).
/// - **DST (#4/§7):** no wall clock. Declaration timing is a **logical phase ordinal**, so
///   `local-time-never-enters-the-shared-fold` holds: two nodes with different receive
///   times fold the same set.
/// - **Culture-invariant:** party/domain identifiers are compared with
///   `StringComparison.Ordinal`; `Map` keys use F# structural comparison, which is
///   `String.CompareOrdinal` for strings.
/// - **Result-over-exception:** every constructor that can refuse returns `Result`.
[<RequireQualifiedAccess>]
module DeclaredStanceLedger =

    // ── Hyperparameters ────────────────────────────────────────────────────────────────────────────

    /// Minimum resolved claims in EACH cell before the two cells may be compared at all.
    /// Below this, `informativeness` returns `InsufficientEvidence` rather than a number.
    let [<Literal>] MIN_OBS_FOR_DISCRIMINATION = 5

    /// Two cells whose hold rates differ by less than this are reported as
    /// indistinguishable. It is a **resolution floor on the statement**, not a fitted
    /// threshold: below it we decline to claim the declaration discriminated.
    let [<Literal>] SEPARATION_EPS = 0.05

    /// Effective independent corroborations a receiver requires before it may act on a
    /// claim without seeking a further source. 2.0 = "the claimant, plus one genuinely
    /// independent confirmation".
    let [<Literal>] REQUIRED_EFFECTIVE_CORROBORATIONS = 2.0

    /// Within-source correlation used when the caller supplies none.
    ///
    /// **1.0 is a bound, not a fit.** It says: everything one source says about its own
    /// claim counts once. Any smaller value would be an invented number asserting that a
    /// party's self-corroborations are partly independent of each other, which nothing
    /// here has measured. Choosing the bound keeps this metered rather than toy.
    let [<Literal>] CONSERVATIVE_WITHIN_SOURCE_RHO = 1.0

    /// Minimum resolved claims before `searchProfile` will split a history in half.
    let [<Literal>] MIN_OBS_FOR_SEARCH_PROFILE = 6

    /// Half-over-half hold-rate change below which marginal yield is reported flat.
    let [<Literal>] YIELD_FLAT_EPS = 0.10

    // ── Stance: self-claimed, never inferred ───────────────────────────────────────────────────────

    /// A party's **self-claimed** position on what it wants the result to be.
    ///
    /// There is no inference path to this type. `declare` is the only introduction form,
    /// and it refuses an observer attributing a stance to a counterparty. Deliberately
    /// three-valued and ordinal-free: see the module header on why no intensity exists.
    type Stance =
        | Eager
        | Neutral
        | Averse

    /// Canonical stance order — used to make pooling a deterministic fold (DST).
    let private allStances = [ Eager; Neutral; Averse ]

    /// Refusals from `declare`. Each one is a falsifier of the primitive it protects.
    type StanceError =
        /// An observer tried to set a stance about someone else. This is the exact move
        /// the Eve row names as reimplementing the bias it was built to disclose.
        | ObserverAttributedStance of subject: string * declaredBy: string
        /// Declared at or after the result phase. Before the result it is a disclosure;
        /// after it, an excuse. Only the first position carries any weight.
        | DeclaredAfterResult of declaredAtPhase: int64 * resultPhase: int64
        /// Empty subject or domain — a cell key that cannot identify anything.
        | EmptyIdentifier of field: string

    /// A pre-declaration of bias, bound to one claim in one domain.
    ///
    /// `DeclaredAtPhase` / `ResultPhase` are **logical ordinals** on the exchange, not
    /// wall clocks: a receiver's local clock must never decide whether a declaration was
    /// timely, or two receivers would fold different evidence sets.
    [<Struct>]
    type Declaration =
        { Subject: string
          Domain: string
          Stance: Stance
          DeclaredAtPhase: int64
          ResultPhase: int64
          StakeDescription: string }

    /// The only way to build a `Declaration`.
    ///
    /// Refuses when `declaredBy <> subject` (ordinal), and when the declaration is not
    /// strictly earlier in logical phase than the result.
    let declare
        (subject: string)
        (declaredBy: string)
        (domain: string)
        (stance: Stance)
        (declaredAtPhase: int64)
        (resultPhase: int64)
        (stakeDescription: string)
        : Result<Declaration, StanceError> =
        if String.IsNullOrWhiteSpace subject then Error(EmptyIdentifier "subject")
        elif String.IsNullOrWhiteSpace domain then Error(EmptyIdentifier "domain")
        elif not (String.Equals(subject, declaredBy, StringComparison.Ordinal)) then
            Error(ObserverAttributedStance(subject, declaredBy))
        elif declaredAtPhase >= resultPhase then
            Error(DeclaredAfterResult(declaredAtPhase, resultPhase))
        else
            Ok
                { Subject = subject
                  Domain = domain
                  Stance = stance
                  DeclaredAtPhase = declaredAtPhase
                  ResultPhase = resultPhase
                  StakeDescription = stakeDescription }

    // ── Exchange: the reciprocal obligation, made structural ───────────────────────────────────────

    /// Refusals from `openExchange`.
    type ExchangeError =
        /// The two declarations are not about the same domain.
        | DomainMismatch of claimantDomain: string * receiverDomain: string
        /// Claimant and receiver are the same party — an exchange with itself discloses
        /// nothing and would let a party manufacture its own confirmation.
        | SelfExchange of party: string

    /// A two-sided exchange. The Eve row: *"The receiving party must declare its own stake
    /// in the same exchange, or the disclosure has simply transferred the advantage rather
    /// than removed it. A one-sided disclosure is not neutrality; it is a handicap accepted
    /// by one side."*
    ///
    /// That obligation is enforced by making the receiver's declaration a **required
    /// field**: a one-sided exchange is not representable, so `weigh` cannot be reached
    /// from one.
    [<Struct>]
    type Exchange =
        { ClaimantDeclaration: Declaration
          ReceiverDeclaration: Declaration }

    let openExchange (claimant: Declaration) (receiver: Declaration) : Result<Exchange, ExchangeError> =
        if not (String.Equals(claimant.Domain, receiver.Domain, StringComparison.Ordinal)) then
            Error(DomainMismatch(claimant.Domain, receiver.Domain))
        elif String.Equals(claimant.Subject, receiver.Subject, StringComparison.Ordinal) then
            Error(SelfExchange claimant.Subject)
        else
            Ok { ClaimantDeclaration = claimant; ReceiverDeclaration = receiver }

    // ── Resolution: the observable outcome ─────────────────────────────────────────────────────────

    /// Who the resolved claim's realised value accrued to.
    ///
    /// This is an **allocation you can observe**, never an attribution of motive. It exists
    /// so that Aaron's tail claim has somewhere honest to be checked against later; nothing
    /// in this module reads it into a weighting. See `DSL-31`.
    type Beneficiary =
        | AccruedToClaimant
        | AccruedToBoth
        | AccruedToOthers

    /// One resolved claim.
    [<Struct>]
    type Resolution =
        { /// Did the claim hold up when checked by someone other than the claimant?
          HeldUp: bool
          Beneficiary: Beneficiary }

    /// Build a resolution. (This module is `RequireQualifiedAccess`, so this spares callers
    /// from qualifying record labels at every construction site.)
    let resolution (heldUp: bool) (beneficiary: Beneficiary) : Resolution =
        { HeldUp = heldUp; Beneficiary = beneficiary }

    // ── Ledger ─────────────────────────────────────────────────────────────────────────────────────

    /// The cell key: (party, domain, **declared** stance). The stance is part of the key
    /// precisely so the module never has to decide what a party "is" — it only ever
    /// reports how claims filed under a self-chosen label turned out.
    [<Struct>]
    type CellKey =
        { Party: string
          Domain: string
          Stance: Stance }

    /// The outcome record for one cell.
    type Cell =
        { /// TrueSkill/ADF posterior over "does a claim from this cell hold up".
          Belief: TravelerRankLedger.SkillBelief
          /// Resolution outcomes, **newest first**. Used by `searchProfile` and pooling.
          History: bool list
          ToClaimant: int
          ToBoth: int
          ToOthers: int }

    let freshCell : Cell =
        { Belief = TravelerRankLedger.freshBelief
          History = []
          ToClaimant = 0
          ToBoth = 0
          ToOthers = 0 }

    /// A ledger of cells plus the idempotency key set.
    type Ledger =
        { Cells: Map<CellKey, Cell>
          /// Claim ids already folded in. `record` is an upsert keyed by this set.
          Applied: Set<string> }

    let empty : Ledger = { Cells = Map.empty; Applied = Set.empty }

    let cellOf (party: string) (domain: string) (stance: Stance) (ledger: Ledger) : Cell =
        ledger.Cells
        |> Map.tryFind { Party = party; Domain = domain; Stance = stance }
        |> Option.defaultValue freshCell

    /// Fold one resolved claim into the ledger, filed under the **claimant's own declared
    /// stance**.
    ///
    /// Idempotent in `claimId`: re-recording the same claim returns the ledger unchanged,
    /// so replay and redelivery are safe (discipline #6).
    let record (claimId: string) (exchange: Exchange) (resolution: Resolution) (ledger: Ledger) : Ledger =
        if ledger.Applied |> Set.contains claimId then
            ledger
        else
            let d = exchange.ClaimantDeclaration
            let key = { Party = d.Subject; Domain = d.Domain; Stance = d.Stance }
            let current = cellOf d.Subject d.Domain d.Stance ledger

            let updated =
                { Belief = TravelerRankLedger.update resolution.HeldUp current.Belief
                  History = resolution.HeldUp :: current.History
                  ToClaimant =
                    current.ToClaimant + (if resolution.Beneficiary = AccruedToClaimant then 1 else 0)
                  ToBoth = current.ToBoth + (if resolution.Beneficiary = AccruedToBoth then 1 else 0)
                  ToOthers = current.ToOthers + (if resolution.Beneficiary = AccruedToOthers then 1 else 0) }

            { Cells = ledger.Cells |> Map.add key updated
              Applied = ledger.Applied |> Set.add claimId }

    /// Posterior probability that the **next claim this party files under this stance**
    /// holds up. A statistic over resolved claims; not a property of the party.
    /// Returns 0.5 (honest prior) for a cell with no history.
    let holdRate (party: string) (domain: string) (stance: Stance) (ledger: Ledger) : float =
        cellOf party domain stance ledger |> _.Belief |> TravelerRankLedger.trustBand

    /// Number of resolved claims in a cell.
    let obsCount (party: string) (domain: string) (stance: Stance) (ledger: Ledger) : int =
        (cellOf party domain stance ledger).Belief.ObsCount

    /// Observed allocation counts for a cell: (to claimant, to both, to others).
    /// Reported raw. There is deliberately no scalar derived from it.
    let beneficiaryProfile (party: string) (domain: string) (stance: Stance) (ledger: Ledger) : int * int * int =
        let c = cellOf party domain stance ledger
        c.ToClaimant, c.ToBoth, c.ToOthers

    // ── Does the declaration discriminate, for this party? ─────────────────────────────────────────

    /// Whether this party's declared stance has historically separated the outcome.
    ///
    /// Names the **fact**, never a verdict (`dual-use-detection-is-neutral-oracle-decides`):
    /// a declaration that carries no information is not a lie, and this type must not be
    /// read as one. It is exactly as consistent with a party that is uniformly reliable.
    type Informativeness =
        /// Fewer than `MIN_OBS_FOR_DISCRIMINATION` resolutions in at least two cells.
        | InsufficientEvidence of cellsWithEnough: int
        /// Max pairwise hold-rate separation across comparable cells, above the floor.
        | DeclarationDiscriminates of separation: float
        /// Comparable cells exist and their hold rates agree within `SEPARATION_EPS`.
        | DeclarationCarriesNoInformation of separation: float

    let informativeness (party: string) (domain: string) (ledger: Ledger) : Informativeness =
        let comparable =
            allStances
            |> List.choose (fun s ->
                if obsCount party domain s ledger >= MIN_OBS_FOR_DISCRIMINATION then
                    Some(holdRate party domain s ledger)
                else
                    None)

        if List.length comparable < 2 then
            InsufficientEvidence(List.length comparable)
        else
            let separation = List.max comparable - List.min comparable
            if separation >= SEPARATION_EPS then
                DeclarationDiscriminates separation
            else
                DeclarationCarriesNoInformation separation

    // ── Pooling ────────────────────────────────────────────────────────────────────────────────────

    /// The party's hold rate ignoring the stance label — a deterministic fold of every
    /// cell's history in canonical stance order, oldest-first within a cell.
    /// Deterministic given the ledger, so it replays under DST.
    let pooledHoldRate (party: string) (domain: string) (ledger: Ledger) : float =
        let outcomes =
            allStances
            |> List.collect (fun s -> (cellOf party domain s ledger).History |> List.rev)

        outcomes
        |> List.fold (fun b hit -> TravelerRankLedger.update hit b) TravelerRankLedger.freshBelief
        |> TravelerRankLedger.trustBand

    // ── Counterparty use ───────────────────────────────────────────────────────────────────────────

    /// Which posterior the receiver ended up using, and why.
    type PriorBasis =
        /// No comparable history — 0.5, the honest prior.
        | HonestPrior
        /// The declaration discriminates for this party; the declared cell's posterior.
        | DeclaredCell of Stance
        /// The declaration does not discriminate for this party; pooled across stances.
        /// The party is **not** relabelled — its declaration still chose the cell.
        | PooledAcrossStances

    /// What a receiver does with a claim.
    type Weighting =
        { PriorHoldRate: float
          PriorBasis: PriorBasis
          /// Corroborations discounted by the Kish design effect: sources are independent
          /// of each other, a source is correlated with itself at `rhoWithinSource`.
          EffectiveCorroborations: float
          /// True until the claim has `REQUIRED_EFFECTIVE_CORROBORATIONS` effective
          /// independent supports. **Stance-blind by construction** — see `DSL-24`.
          RequiresIndependentConfirmation: bool }

    /// Kish (1965) design effect, inverted: `n_eff = n / (1 + (n-1)·ρ)`.
    /// At ρ = 1 this is 1 for every n — five arguments from one source are one argument.
    let effectiveIndependentCount (n: int) (rho: float) : float =
        if n <= 0 then
            0.0
        else
            let r = max 0.0 (min 1.0 rho)
            float n / (1.0 + float (n - 1) * r)

    /// Effective corroboration count over a list of **source party ids**: grouped by
    /// source (ordinal), discounted within a source, summed across sources.
    let effectiveCorroborations (rhoWithinSource: float) (sources: string list) : float =
        sources
        |> List.countBy id
        |> List.sumBy (fun (_, n) -> effectiveIndependentCount n rhoWithinSource)

    /// The prior a receiver should use for the claimant of this exchange.
    let priorFor (exchange: Exchange) (ledger: Ledger) : float * PriorBasis =
        let d = exchange.ClaimantDeclaration
        match informativeness d.Subject d.Domain ledger with
        | DeclarationDiscriminates _ -> holdRate d.Subject d.Domain d.Stance ledger, DeclaredCell d.Stance
        | DeclarationCarriesNoInformation _ -> pooledHoldRate d.Subject d.Domain ledger, PooledAcrossStances
        | InsufficientEvidence _ ->
            if obsCount d.Subject d.Domain d.Stance ledger > 0 then
                holdRate d.Subject d.Domain d.Stance ledger, DeclaredCell d.Stance
            else
                0.5, HonestPrior

    /// Weigh a claim: *"weight the evidence, not the enthusiasm."*
    ///
    /// `corroborationSources` is the list of party ids supplying support for the claim —
    /// with the claimant's own supports listed once each, so that a claimant offering five
    /// of its own arguments appears five times and is discounted to one.
    ///
    /// **`RequiresIndependentConfirmation` never reads the stance.** Declaring `Eager`
    /// costs a party nothing, which is what keeps the primitive worth using — the Eve
    /// row's *"EAGER IS NOT A DISCOUNT"* refinement, made mechanical.
    let weigh
        (rhoWithinSource: float)
        (corroborationSources: string list)
        (exchange: Exchange)
        (ledger: Ledger)
        : Weighting =
        let prior, basis = priorFor exchange ledger
        let eff = effectiveCorroborations rhoWithinSource corroborationSources

        { PriorHoldRate = prior
          PriorBasis = basis
          EffectiveCorroborations = eff
          RequiresIndependentConfirmation = eff < REQUIRED_EFFECTIVE_CORROBORATIONS }

    /// `weigh` with the conservative bound ρ = 1: every source counts once.
    let weighConservatively (corroborationSources: string list) (exchange: Exchange) (ledger: Ledger) : Weighting =
        weigh CONSERVATIVE_WITHIN_SOURCE_RHO corroborationSources exchange ledger

    // ── The observable signature of early convergence ──────────────────────────────────────────────

    /// Marginal yield across a cell's history: the hold rate of the later half minus the
    /// hold rate of the earlier half.
    ///
    /// Names the **fact**. *"Stuck"* is a reading a caller's oracle may attach; flat
    /// marginal yield is equally consistent with a party that was simply right from the
    /// start. The characterisation this measures against — eagerness as a low temperature
    /// that freezes the search early — is a **toy model** and is argued, with its anchors,
    /// in `docs/research/2026-08-25-declared-stance-posterior-eagerness-is-a-temperature-not-a-rate.md`.
    type SearchProfile =
        | InsufficientHistory of have: int * need: int
        | MarginalYieldRising of delta: float
        | MarginalYieldFlat of delta: float
        | MarginalYieldFalling of delta: float

    let searchProfile (party: string) (domain: string) (stance: Stance) (ledger: Ledger) : SearchProfile =
        let chronological = (cellOf party domain stance ledger).History |> List.rev
        let n = List.length chronological

        if n < MIN_OBS_FOR_SEARCH_PROFILE then
            InsufficientHistory(n, MIN_OBS_FOR_SEARCH_PROFILE)
        else
            let half = n / 2
            let rate (xs: bool list) =
                match List.length xs with
                | 0 -> 0.0
                | len -> float (xs |> List.filter id |> List.length) / float len

            let early = chronological |> List.take half
            let late = chronological |> List.skip (n - half)
            let delta = rate late - rate early

            if delta > YIELD_FLAT_EPS then MarginalYieldRising delta
            elif delta < -YIELD_FLAT_EPS then MarginalYieldFalling delta
            else MarginalYieldFlat delta
