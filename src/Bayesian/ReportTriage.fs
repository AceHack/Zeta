namespace Zeta.Bayesian

open Zeta.Core

/// **`ReportTriage` — a multidimensional priority queue over incoming reports.**
///
/// ## This is TRIAGE, not judgement
///
/// Nobody — no person, no agent — is labelled defective by anything in this module. It computes an
/// *ordering*, and an ordering is not a verdict about whoever sent the report.
///
///   - **The ordering only bites under scarcity.** With enough capacity to examine every report,
///     every report is examined and the order changes nothing. This module is a response to a
///     resource constraint and has no meaning without one.
///   - **A low position states something about the queue's current information, never about the
///     reporter.** The same reporter's next report can sort first.
///   - Nothing here emits a per-reporter ranking as a product. The reporter-history term is an
///     *input to an ordering*, never an output about a person.
///
/// Anchor for the frame: Larrey's battlefield triage ordered treatment by severity of need and
/// explicitly irrespective of rank or nationality — the founding act of triage was removing a status
/// judgement from an ordering decision.
///
/// ## Register: `unmetered`
///
/// The composite ordering has **no falsifier** — no expert-labelled report set exists to check it
/// against, so nothing here can currently be shown wrong. Per `toy-is-free-metered-must-be-earned`
/// that makes the queue `unmetered`, and the `SeverityProxy` path below is `toy`. Only the KL
/// underneath (`InformationValue`, IV-1..IV-7 under FsCheck) is `metered`, and only on the
/// claim-typed path.
///
/// **Wired into nothing.** No gate, no heartbeat lane, no existing queue consumes this.
///
/// Design + derivation:
/// `docs/research/2026-08-16-report-triage-multidimensional-priority-queue-information-gain-primary-dynamic-weights-self-confirmation-guard.md`
[<RequireQualifiedAccess>]
module ReportTriage =

    // ── Dimensions, carrying their own computability label ─────────────────────────────────────────

    /// How much of a dimension is real today. Carried as data so a caller can ask the queue what
    /// its ordering actually rests on, rather than reading a doc and hoping.
    type Computability =
        /// Derived from something that exists and is tested today.
        | Computable
        /// A stand-in with no producer behind it. Ordering weight, not a measurement.
        | Placeholder
        /// The machinery exists but a prerequisite does not, so it is not implemented at all.
        | Blocked of missing: string

    type Dimension =
        /// Expected belief change — the primary dimension (see `InfoGain`).
        | InformationGain
        /// Claimed impact. `Placeholder`: Zeta has no blast-radius model.
        | Severity
        /// Reporter's *validity* record for this (area, jurisdiction) — "are your findings real".
        /// Deliberately NOT merged with severity calibration; see `SeverityAdjudication`.
        | ReporterValidity
        /// Age. Local-action only — see the local-time note on `score`.
        | Recency
        /// Marginal novelty against what is already queued/examined.
        | Novelty

    let computabilityOf (d: Dimension) : Computability =
        match d with
        | InformationGain -> Computable      // on the claim-typed path only; the proxy path is Placeholder
        | Severity        -> Placeholder     // no blast-radius model exists
        | ReporterValidity -> Computable     // TravelerRankLedger, keyed per (area, jurisdiction)
        | Recency         -> Computable
        | Novelty         -> Placeholder     // needs a similarity producer

    // ── Cry-wolf: a typed hole, not a stub ─────────────────────────────────────────────────────────

    /// **Severity-claim calibration ("cry-wolf") is BLOCKED, and this type is why.**
    ///
    /// Aaron's mechanism: watch for reporters in an area/jurisdiction who keep calling low-impact
    /// issues critical, and correct for the offset. It requires an **exact severity rubric that can
    /// be cross-checked valid** — without one, "you said critical and it was low" is two people
    /// disagreeing, and a meter built on a disagreement manufactures a false measurement.
    ///
    /// **Zeta has severity *labels* (`P0..P3`) and no severity *rubric*.** Nothing in the repo states
    /// the observable conditions under which a report *is* P0 rather than P1, so no severity claim
    /// here is currently falsifiable.
    ///
    /// So this type has exactly one inhabitant, and it names the blocker. It is a **typed hole**
    /// rather than a stub returning `0.0` silently: a stub would let a caller believe a correction
    /// was applied. Adding rubric-checked cases here is the follow-on work, and it belongs to the
    /// rubric, not to this queue.
    type SeverityAdjudication =
        /// The only inhabitant today. No rubric exists to adjudicate against.
        | NoRubricExists

    /// The cry-wolf correction to subtract from a claimed severity.
    /// Identically zero today, and the type above is the reason — not an accident.
    let severityCorrection (a: SeverityAdjudication) : float =
        match a with
        | NoRubricExists -> 0.0

    // ── The (area, jurisdiction) key — needs no change to TravelerRankLedger ────────────────────────

    /// ASCII Unit Separator: cannot collide with a human-authored area or jurisdiction name.
    let [<Literal>] private KeySeparator = ""

    /// Compose an (area, jurisdiction) pair into a `TravelerRankLedger` hatDomain.
    ///
    /// `TravelerRankLedger.Ledger` is already `Map<(travelerId, hatDomain), SkillBelief>`, so
    /// per-(area, jurisdiction) track record needs **no edit to that file** — the composite key
    /// gives it directly. Ordinal composition (`culture-invariant-by-default`).
    let domainKey (area: string) (jurisdiction: string) : string =
        System.String.Concat(area, KeySeparator, jurisdiction)

    // ── The validity discount λ, and the floor that is the anti-burial guarantee ────────────────────

    /// The floor on λ. **Load-bearing.** If λ may reach 0, a reporter with no history is silenced
    /// rather than merely discounted, and the design has quietly become the track-record-primary one
    /// it exists to avoid. Fresh identities sit at `trustBand = 0.5` (TravelerRankLedger's honest
    /// prior), so this floor only binds for reporters with a genuinely poor validity record — and
    /// even then it bounds, never zeroes.
    let [<Literal>] LambdaFloor = 0.15

    /// The reporter's validity discount for this (area, jurisdiction): `trustBand`, floored.
    /// Unknown reporter ⇒ 0.5 (honest prior), never 0.
    let validityLambda (reporter: string) (area: string) (jurisdiction: string)
                       (ledger: TravelerRankLedger.Ledger) : float =
        let band = TravelerRankLedger.trustBandOf reporter (domainKey area jurisdiction) ledger
        max LambdaFloor band

    // ── Information gain: the exact path and the labelled proxy, as distinct cases ──────────────────

    /// A claim typed well enough to measure belief movement against: a named variable, a point
    /// estimate, and the reporter's stated uncertainty.
    ///
    /// **No producer of these exists in Zeta today** — real inbound reports are free text. This is
    /// the single highest-value unblock for the design: the scoring machinery already exists and is
    /// proven; what is missing is a report format that carries a claim.
    type TypedClaim =
        { Variable: string
          Estimate: float
          /// The reporter's own stated variance. **Self-asserted, therefore discounted** by
          /// `validityLambda` before use — otherwise a reporter claiming σ→0 owns the queue.
          StatedVariance: float }

    /// The information-gain term, which knows which of the two paths produced it.
    /// Kept as a union rather than collapsed to a float so a proxy can never be mistaken for a
    /// measurement, and so a queue can report how much of its ordering rests on proxy.
    type InfoGain =
        /// Exact: `InformationValue.valueOfMessage` on a claim-typed report. `metered`.
        | ClaimTyped of nats: float
        /// Stand-in for free-text reports: corrected severity × validity. **`toy`.**
        | SeverityProxy of value: float

    /// Squash an unbounded KL (nats) into `[0, 1)` so dimensions are commensurable.
    /// `k / (1 + k)` is strictly monotone, so it **preserves the ordering** — the only property a
    /// queue needs from it. It is a normalisation, not a probability; do not read it as one.
    let private squash (k: float) : float =
        if System.Double.IsNaN k then 0.0
        elif System.Double.IsPositiveInfinity k then 1.0
        else let k = max 0.0 k in k / (1.0 + k)

    /// Exact information gain for a claim-typed report, against a prior over the same variable.
    ///
    /// The reporter's stated precision is discounted by λ *before* the KL is taken — track record
    /// enters as a discount on the likelihood rather than as a separate additive dimension, which is
    /// what produces Aaron's tiebreak ("who has been right in this area") automatically, and only
    /// where it belongs: when two reports would otherwise teach us about equally much.
    ///
    /// Because λ ≥ `LambdaFloor` > 0 and KL is monotone in message precision, a newcomer's claim is
    /// **scaled, never silenced**.
    let claimInfoGain (lambda: float) (prior: Gaussian) (claim: TypedClaim) : InfoGain =
        if not (System.Double.IsFinite claim.Estimate)
           || not (System.Double.IsFinite claim.StatedVariance)
           || claim.StatedVariance <= 0.0 then
            // A malformed claim is not evidence of anything; it teaches us nothing.
            ClaimTyped 0.0
        else
            let message = Gaussian.ofMeanVariance claim.Estimate (claim.StatedVariance / lambda)
            ClaimTyped (float (InformationValue.valueOfMessage prior message))

    /// The proxy for a report we cannot model: corrected severity, discounted by validity.
    ///
    /// *"A claim we cannot model is worth, in expectation, its asserted severity discounted by how
    /// much that reporter's assertions have been worth here before."* A stand-in and nothing more.
    /// Note the two ledgers appear as separate factors: `severityCorrection` is calibration
    /// (blocked), `lambda` is validity (computable). They must not be merged.
    let proxyInfoGain (lambda: float) (adjudication: SeverityAdjudication) (claimedSeverity: float) : InfoGain =
        let corrected = max 0.0 (claimedSeverity - severityCorrection adjudication)
        SeverityProxy (corrected * lambda)

    /// The `[0,1]` term either path contributes.
    let infoGainTerm (g: InfoGain) : float =
        match g with
        | ClaimTyped nats -> squash nats
        | SeverityProxy v -> min 1.0 (max 0.0 v)

    /// Is this score resting on a measurement or on a stand-in?
    let isProxy (g: InfoGain) : bool =
        match g with
        | SeverityProxy _ -> true
        | ClaimTyped _ -> false

    // ── A scored report ────────────────────────────────────────────────────────────────────────────

    /// One report's triage inputs. Every term is caller-supplied: this module reads **no clock, no
    /// RNG, and no ambient state** (§13 noninterference — entropy and time enter only through
    /// declared channels).
    type ReportSignal =
        { ReportId: string
          Reporter: string
          Area: string
          Jurisdiction: string
          /// Present only for claim-typed reports; `None` sends the score down the proxy path.
          Claim: TypedClaim option
          /// Claimed impact in `[0,1]`. **Self-asserted and uncorrected** — see `SeverityAdjudication`.
          ClaimedSeverity: float
          /// Age in caller-defined units. **Local-action only** — see `score`.
          Age: float
          /// Expected examiner effort. Divides the score (Smith's rule / WSPT), never subtracts.
          /// `Placeholder`: nothing meters this today, so callers pass 1.0.
          ExpectedCost: float
          /// `1 − similarity` to what is already queued or examined. `Placeholder`.
          Novelty: float }

    type ScoredReport =
        { Signal: ReportSignal
          InfoGain: InfoGain
          Score: float }

    /// Dimension weights. Dynamic by design — Aaron's requirement — which is exactly why the
    /// retuning guards below exist.
    type Weights = Map<Dimension, float>

    let defaultWeights : Weights =
        // Information gain dominates deliberately: a severe report from an unknown reporter must
        // sort high on its own merits. These numbers are `placeholder` — they have never been tuned
        // against anything, because nothing exists to tune them against (see the holdout note on
        // `clampWeightDelta`).
        Map.ofList
            [ InformationGain, 0.55
              Severity,        0.20
              ReporterValidity, 0.10
              Recency,         0.10
              Novelty,         0.05 ]

    let private weightOf (w: Weights) (d: Dimension) : float =
        Map.tryFind d w |> Option.defaultValue 0.0

    /// Recency term: monotone decreasing in age, in `[0,1]`.
    let private recencyTerm (age: float) : float =
        if System.Double.IsNaN age then 0.0
        else 1.0 / (1.0 + max 0.0 age)

    /// Score one report.
    ///
    /// **Local-time guard (`local-time-never-enters-the-shared-fold`).** The `Recency` dimension is
    /// admissible here *only* because a triage queue answers "which report do **I**, this examiner,
    /// read next" — a local action, which the rule explicitly permits. If this ordering is ever
    /// consumed by a **shared** fold — two nodes needing to agree on what was examined, or the
    /// ordering filtering evidence on its way into a commutative fold — local time has leaked, nodes
    /// will fold different evidence sets, and they will diverge. Drop `Recency` or replace it with
    /// agreed phase before that happens. This module reads no clock of its own; `Age` is supplied.
    let score (weights: Weights) (ledger: TravelerRankLedger.Ledger)
              (priorFor: string -> Gaussian option) (signal: ReportSignal) : ScoredReport =
        let lambda = validityLambda signal.Reporter signal.Area signal.Jurisdiction ledger
        let gain =
            match signal.Claim with
            | Some claim ->
                match priorFor claim.Variable with
                | Some prior -> claimInfoGain lambda prior claim
                // A claim about a variable we hold no prior over cannot have its belief movement
                // measured. Falling back is honest; pretending is not.
                | None -> proxyInfoGain lambda NoRubricExists signal.ClaimedSeverity
            | None -> proxyInfoGain lambda NoRubricExists signal.ClaimedSeverity
        let severityTerm =
            max 0.0 (min 1.0 (signal.ClaimedSeverity - severityCorrection NoRubricExists))
        let numerator =
            weightOf weights InformationGain * infoGainTerm gain
            + weightOf weights Severity * severityTerm
            + weightOf weights ReporterValidity * lambda
            + weightOf weights Recency * recencyTerm signal.Age
            + weightOf weights Novelty * (max 0.0 (min 1.0 signal.Novelty))
        // Smith's rule (1956): value per unit of the scarce resource. Cost DIVIDES.
        let cost = if signal.ExpectedCost > 0.0 then signal.ExpectedCost else 1.0
        { Signal = signal; InfoGain = gain; Score = numerator / cost }

    /// The fraction of a scored batch whose ordering rests on the **proxy** rather than on measured
    /// belief movement. This is the number that says how much of the intended design is actually
    /// running: 1.0 means the queue is severity + track record, which is the materially weaker
    /// construction. Today, for free-text reports, it is 1.0.
    let proxyFraction (scored: ScoredReport list) : float =
        match scored with
        | [] -> 0.0
        | _ ->
            let n = List.length scored
            let p = scored |> List.filter (fun s -> isProxy s.InfoGain) |> List.length
            float p / float n

    // ── Selection: scored draws and exploration draws ──────────────────────────────────────────────

    /// How a report came to be examined. The distinction is load-bearing: only the exploration
    /// draws form a sample the queue's own ordering did not select, so only they can keep successive
    /// evaluation sets unbiased.
    type DrawKind =
        | ScoreDraw
        | ExplorationDraw

    /// Pop the next report to examine.
    ///
    /// With probability `epsilon` the draw **ignores the score entirely** and takes a report
    /// uniformly at random (Robbins 1952; ε-greedy — Auer, Cesa-Bianchi & Fischer 2002). This is not
    /// primarily a tuning device: it is the sampling mechanism that keeps the evaluation set
    /// independent of the queue. Without it, refreshing that set quietly means resampling from what
    /// the queue already surfaces, and the queue's blind spots are inherited forever.
    ///
    /// `nextUniform` is **injected**, never ambient: no `Random()`, no clock (§13 noninterference,
    /// §7 DST). A triage decision you cannot replay is one you cannot debug.
    let drawNext (epsilon: float) (nextUniform: unit -> float) (queue: ScoredReport list)
                 : (ScoredReport * DrawKind * ScoredReport list) option =
        match queue with
        | [] -> None
        | _ ->
            let n = List.length queue
            let pick i kind =
                let chosen = List.item i queue
                let rest = queue |> List.mapi (fun j r -> (j, r))
                                 |> List.filter (fun (j, _) -> j <> i)
                                 |> List.map snd
                Some (chosen, kind, rest)
            if nextUniform () < max 0.0 epsilon then
                let i = min (n - 1) (max 0 (int (nextUniform () * float n)))
                pick i ExplorationDraw
            else
                // Highest score wins; ties broken by ReportId ordinally so the draw is deterministic.
                let bestIdx =
                    queue
                    |> List.mapi (fun i r -> (i, r))
                    |> List.sortWith (fun (_, a) (_, b) ->
                        let c = compare b.Score a.Score
                        if c <> 0 then c
                        else System.String.CompareOrdinal(a.Signal.ReportId, b.Signal.ReportId))
                    |> List.head
                    |> fst
                pick bestIdx ScoreDraw

    // ── Retuning guards (the tuner itself is deliberately NOT built) ───────────────────────────────

    /// What became of a report. **Three-valued on purpose.**
    ///
    /// Treating `Unexamined` as "examined and found nothing" is exactly how a dimension quietly
    /// self-confirms: a weight that pushes reports to the bottom prevents the evidence that would
    /// have corrected it from ever existing, and the dimension then looks calibrated *because it was
    /// never tested*. (Documented empirically for the same structure in predictive policing: Lum &
    /// Isaac 2016; Ensign et al. 2018. Selection bias generally: Heckman 1979.)
    type Outcome =
        /// Never looked at. **Not evidence.** Carried so the censoring is visible rather than folded
        /// silently into the sample.
        | Unexamined
        | ExaminedNoFinding
        | ExaminedFinding of severityAdjudicated: float

    /// Keep only outcomes that may inform a retune. `Unexamined` is dropped — it is an absence of
    /// evidence, and the whole failure mode is reading it as evidence of absence.
    let admissibleEvidence (outcomes: (string * Outcome) list) : (string * Outcome) list =
        outcomes |> List.filter (fun (_, o) -> match o with Unexamined -> false | _ -> true)

    /// The per-tick cap on weight movement (a trust region). Does not break a wrong feedback loop —
    /// a slow wrong loop is still wrong — but bounds the damage per tick and buys observation time
    /// before a weight runs away.
    let [<Literal>] MaxWeightDelta = 0.05

    /// Clamp a proposed weight vector to within `MaxWeightDelta` of the current one, per dimension.
    ///
    /// **No automatic tuner is provided here, and that is deliberate.** The principled way to retune
    /// these weights is Aaron's: evaluate against a **withheld, expert-labelled set of past reports**
    /// that the queue's ordering never selected — turn the knob, see how the queue splits the
    /// withheld reports into labels, measure how closely that matches the hand-drawn labels. Because
    /// the queue never influenced that set, evaluating against it cannot self-confirm; it is the
    /// train/holdout split, and it is the principled answer rather than the "heuristic hack" he
    /// modestly calls it. Automatic feedback is safe *provided* it is evaluated that way.
    ///
    /// No such labelled set exists in Zeta today, so a tuner built now would necessarily be trained
    /// on the queue's own selections — the exact circularity the design is guarding. The guards ship;
    /// the tuner waits for the data. Two caveats when it arrives: a holdout **goes stale** as the
    /// report mix changes, and **repeated evaluation against one holdout overfits it** (adaptive
    /// data analysis — Dwork et al. 2015), so it needs a refresh cadence and a consult budget.
    let clampWeightDelta (current: Weights) (proposed: Weights) : Weights =
        proposed
        |> Map.map (fun d p ->
            let c = weightOf current d
            let delta = max -MaxWeightDelta (min MaxWeightDelta (p - c))
            max 0.0 (c + delta))
