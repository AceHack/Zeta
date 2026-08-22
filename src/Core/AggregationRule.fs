namespace Zeta.Core

/// **`AggregationRule` — the building blocks, typed so the non-dominating choice has to say its name.**
///
/// Sibling results this depends on and does not re-derive:
///
/// - **PR #10945, the Dominance Lift Theorem.** An aggregation rule beats its best part **iff it can
///   imitate that part** — the rule class it is optimal over contains every projection. Union
///   qualifies; log-odds-weighted majority qualifies (Nitzan-Paroush 1982); **unweighted k-of-n does
///   not**, and loses to its best member in 58.8% of 20 000 exact draws at rho = 0. Heterogeneity, not
///   correlation, is what kills it.
/// - **PR #10955, the inventory.** Twenty-one live aggregation sites classified by reading the
///   aggregation expression. The classification table for those sites is a fixture in
///   `tests/Tests.FSharp/AggregationRule.Tests.fs` and its TypeScript twin, not in this module: this
///   module ships the algebra, the tests ship the repo-meta.
/// - **`Levels.Aggregation.canImitateEveryProjection`** (PR #10952) — the witness-level check. This
///   module hands rules to it rather than duplicating it; see `imitationWitnesses`, and see the
///   honest limit recorded under "What the witness check cannot do" below.
///
/// ## The structural fact the type exists to carry
///
/// **k-of-n is the generator and the dominating rules are its endpoints.** `Union` is `k = 1`, `Veto`
/// is `k = n`, unweighted majority is `k = ceil(n/2)`. One parameterised building block produces all
/// three, which is `only-the-irreducible-is-primitive-generate-the-rest` — so the generator is
/// shipped, as `ofKOfN`, and it *normalises*: hand it `k = 1` and you get `Union` back, hand it
/// `k = n` and you get `Veto`.
///
/// **But the family is smooth in `k` and the dominance property is not.** It holds at both endpoints
/// and fails everywhere strictly between them. A DU of `KOfN of int` would be a faithful
/// parameterisation that silently hides the one fact a caller needs, so the strict middle is a
/// *different case* and it **carries a `Justification`**. There is no way to write down a
/// non-dominating rule here without saying why it is nonetheless the right rule — and
/// `Justification.Unstated` is a legal, and damning, answer.
///
/// That field is what keeps **BFT honest**. `k = 2f+1` is correct in a Byzantine quorum, justified by
/// **fault tolerance**, not by accuracy over heterogeneous competences. Without the field the type
/// would be calling BFT a defect, which PR #10955 verified it is not. Same for an n-way diff, whose
/// majority is an **integrity detector** over units that are supposed to be byte-identical.
///
/// This is the earned-privilege pattern (`interfaces-free-classes-earned-under-rules`) at the value
/// level: the dominating rules are **free**, the non-dominating one must be **justified at the point
/// of use**.
///
/// ## Order statistics — the same generator on a totally ordered codomain
///
/// The generator is not restricted to booleans. On a totally ordered result the k-of-n family is the
/// **order statistics**: `max` is `k = 1`, `min` is `k = n`, and the median is `k = ceil(n/2)` — "the
/// largest value at least `k` members are at or above". So a median-of-estimates is the same strict
/// middle as an unweighted majority, wearing a different statistic, and it inherits the same verdict.
/// The prediction is checkable and it was checked: PR #10955 independently recommended replacing a
/// median of staffing targets with the **max** where under-staffing is the expensive error. That is
/// exactly `ofKOfN 1 n`, i.e. `Union`, arrived at from the code rather than from the algebra.
///
/// ## What is deliberately absent
///
/// **No correlation threshold, anywhere.** PR #10945 showed `rho` is not a sufficient statistic for
/// the verdict — a counterexample at `m = 9`, `rho = 0.2495` sits *inside* the published safe
/// `rho*(9) = 0.25` and still loses over 40M trials. A rule predicated on `rho` below `rho*` would be
/// unsound, so nothing here takes a correlation parameter and nothing should be added that does.
///
/// **No behaviour.** Nothing in this module aggregates anything. It classifies rules that already
/// exist. Changing how the society reaches verdicts is architectural and is Aaron's call.
///
/// ## What the witness check cannot do (measured, and it is why this module is not redundant)
///
/// `Levels.Aggregation.canImitateEveryProjection` asks the caller for one input per index on which
/// the rule reproduces that index's answer. That is **pointwise agreement on a chosen input**, which
/// is much weaker than "the projection lies in the rule class", and unweighted majority discharges it
/// with cherry-picked witnesses: for 2-of-3, the family
/// `[[true; true; false]; [false; true; true]; [false; true; true]]` passes for all three indices.
/// The counterexample is a locked test. So a discharge of the witness check must never be read as a
/// dominance result — the structural verdict below is the one that discriminates, and the witness
/// check is used here only where a witness family is *derivable from the rule itself*.
///
/// ## Register
///
/// **`unmetered`** (`toy-is-free-metered-must-be-earned`): this is a classification, and nothing in
/// the repo yet consumes it to change a decision. It earns `metered` when a rule change is blocked or
/// admitted because of it, not before. The tests are falsifiers for `classify` and for `ofKOfN`; they
/// are not evidence that any classified site behaves as classified.
[<RequireQualifiedAccess>]
module AggregationRule =

    /// **Where a set of weights comes from** — the half of "weighted majority" that decides whether the
    /// Dominance Lift hypothesis is actually discharged. The rule class of weighted rules contains
    /// every projection (put weight 1 on `i`, 0 elsewhere) no matter what the weights are; the
    /// theorem additionally needs the rule to be **optimal** in that class, and that is a fact about
    /// the weights, not about the shape.
    type WeightBasis =
        /// Nitzan-Paroush: `w_i = log(c_i / (1 - c_i))` from a measured per-unit competence. Optimal in
        /// the weighted class under conditional independence, so the rule is deferential and the lift
        /// holds. **No site in this repo has one** — nobody has measured a competence.
        | LogOddsCompetence
        /// The weight is read off the evidence itself rather than estimated from a track record: a
        /// likelihood ratio, an inverse variance. This is the log-odds quantity computed per
        /// observation, so it is deferential *and* needs nothing estimated — an uninformative unit
        /// contributes a near-flat factor and drops out; a sharp one dictates. The `quantity` names
        /// what is read.
        | EndogenousEvidence of quantity: string
        /// The weight measures exposure, tenure, or accumulated evidence seen — something that accrues
        /// **without the unit having been right**. Deference is reachable and is not chosen.
        | ExperienceProxy of quantity: string
        /// The claimant sets its own weight. Deference is reachable, is not chosen, and the failure
        /// mode is the theorem's cost 2: deferring to a unit *believed* best but which is not.
        | SelfAsserted of quantity: string

    /// **Why a strict-middle threshold is nonetheless the right rule** — or the admission that nothing
    /// says so. Also doubles as the statement of what a site is *for* when it is not aggregating
    /// competences at all (see `Purpose.NonAccuracy`), because those are the same question.
    type Justification =
        /// A Byzantine quorum, `k = 2f+1` for `f` tolerated faulty units. Safety against adversarial
        /// nodes; unweighted is correct and deliberate. Not an accuracy claim.
        | FaultTolerance of toleratedFaults: int
        /// The units are supposed to produce identical output; disagreement is corruption, not
        /// competence. An n-way byte-lock diff. A unanimous-but-wrong result still fails, by design.
        | IntegrityCheck
        /// The site counts **independent sources**, not votes — it exists to refuse pseudo-consensus
        /// (fifty claims tracing to one upstream are one piece of evidence). It checks the theorem's
        /// own independence hypothesis rather than aggregating under it.
        | IndependenceCheck
        /// Consent / ratification. What is being established is that a decision was made properly, not
        /// that it is true.
        | Legitimacy
        /// Permission for an act, not assertion of a claim. "May this proceed", not "is this so".
        | Authorization
        /// Enough participants to proceed at all. A precondition, not a verdict.
        | LivenessPrecondition
        /// The rule is implemented in order to be **studied**, not to decide anything — a model of a
        /// pathology, or the artifact whose defect is the subject.
        | ModelNotMechanism
        /// A **deliberate, priced** precision-over-recall trade: recall is knowingly sacrificed to
        /// suppress noise, and the rationale says what is being bought. This is the defence a quorum
        /// gate is entitled to make. **No site in this repo makes it** — PR #10955 looked.
        | PricedPrecisionTrade of rationale: string
        /// **Nothing at the site names a reason.** The finding case. A threshold carrying this is a
        /// non-dominating rule whose trade-off is being made without being priced.
        | Unstated of note: string

    /// **The rule.** `Union` and `Veto` are the endpoints of the k-of-n generator and are free;
    /// `Threshold` is its strict middle and must be justified; `Weighted` is a different family whose
    /// standing depends entirely on its `WeightBasis`.
    ///
    /// `AllOf` / `AnyOf` are conjunction and disjunction of rules over the same parts. They are here
    /// because the constitution gate is genuinely `AllOf [Veto; Threshold(quorum, Legitimacy)]` — "any
    /// objection vetoes, and k distinct agreements are needed" — and without them that site would have
    /// to be mislabelled as one arm or the other. Their dominance laws are exact duals, which is why
    /// both ship even though `AnyOf` currently has **no site in the inventory**: stating one half of a
    /// lattice would misrepresent the algebra. That `AnyOf` is unpopulated is a register label, not a
    /// hidden mechanism.
    type Rule =
        /// `k = 1`. Accept if any unit accepts. Dominates on **recall** by set monotonicity — the union
        /// of what everyone found contains what the best finder found, on every sample path.
        | Union
        /// `k = n`. Accept only if every unit accepts. Dominates on **safety** by the mirror argument —
        /// any single unit can stop it, so the aggregate never passes what the most-suspicious unit
        /// would block.
        | Veto
        /// A weighted rule. Deferential in *shape*; whether the lift actually holds is the basis.
        | Weighted of basis: WeightBasis
        /// The strict middle of the generator: `1 &lt; k &lt; n`. **Dominates on nothing** — it defers toward
        /// neither accept nor reject and it cannot imitate a projection, whatever `k` is. The
        /// justification is mandatory because that is the whole point of the type.
        | Threshold of k: int * why: Justification
        /// **Argmax over a tally with no floor** — "the most-supported value wins", whatever its
        /// support. Not a k-of-n threshold: a threshold at least *refuses* when unmet, and plurality
        /// never refuses. Over more than two candidates it can return a value backed by a minority of
        /// a minority. Dominates on nothing, for the same reason the strict middle does and then some,
        /// so it carries a justification too.
        ///
        /// The case exists because two sites use it and neither is a threshold: `Diversity.coerciveStep`
        /// (`countBy` then `maxBy snd`), and the n-way diff's reference fallback — whose helper is
        /// **named** `majority` and is in fact plurality, returning the most common value with no
        /// absolute-majority test.
        | Plurality of why: Justification
        /// Conjunction: accept only if every listed rule accepts. Safety-dominance survives if any
        /// member has it (the accept set only shrinks). An empty list is not a rule.
        | AllOf of rules: Rule list
        /// Disjunction: accept if any listed rule accepts. Recall-dominance survives if any member has
        /// it (the accept set only grows). An empty list is not a rule.
        | AnyOf of rules: Rule list

    /// **The axis a rule can dominate its best part on.** A property of the rule alone — no site, no
    /// objective, no data.
    type Dominance =
        /// Accept side: the aggregate finds everything the best finder found.
        | OnRecall
        /// Block side: the aggregate blocks everything the most-suspicious unit would block.
        | OnSafety
        /// Two-sided: the projection lies in the class and the rule is optimal in it.
        | OnAccuracy

    /// **What a site is trying to be right about.** The axis the site *needs*, which is what makes a
    /// mirror defect visible: a safety-shaped task carrying an accept-dominant rule is a pairing, and
    /// a pairing can be wrong in a way a rule alone cannot.
    type Purpose =
        /// A miss is the expensive error and a false positive costs nearly nothing. Discovery,
        /// bug-finding, refutation.
        | Recall
        /// A false pass is the expensive error and a false block costs nearly nothing.
        | Safety
        /// Both errors cost. This is the objective the theorem is stated for, and the only one that
        /// needs the full projection property.
        | TwoSidedAccuracy
        /// The site is not aggregating competences at all. Carries what it *is* doing, which is the
        /// same vocabulary a threshold uses to justify itself.
        | NonAccuracy of what: Justification

    /// **The classification of a (purpose, rule) pairing.**
    type Verdict =
        /// The rule dominates on the axis the purpose needs.
        | Dominates of axis: Dominance
        /// **The mirror defect.** The rule dominates, on the *opposite one-sided axis* to the one
        /// needed: a veto on a discovery task, or a union on a safety task. Never previously swept
        /// for, because nothing named it.
        | MirrorMismatch of needed: Dominance * offered: Dominance
        /// The rule dominates on an axis that is neither the needed one nor its mirror — most often a
        /// two-sided rule on a one-sided objective, or the reverse.
        | WrongAxis of needed: Dominance * offered: Dominance
        /// A weighted rule whose weights are not a competence estimate. The projection is in the class,
        /// so deference is **reachable**; optimality is not established, so it is **not chosen**.
        | DeferenceReachableNotChosen of basis: WeightBasis
        /// The rule dominates on no axis. Carries the reason the site gives; `Unstated` is the finding.
        | DoesNotDominate of why: Justification
        /// The site is not an accuracy aggregator. The theorem has nothing to say about it, and saying
        /// so is not a euphemism for a pass.
        | OutOfScope of what: Justification
        /// A threshold inside a non-accuracy site names a *different* purpose than the site does. The
        /// guard against relabelling a defect by picking a comfortable-sounding justification.
        | JustificationDisagreesWithPurpose of purpose: Purpose * found: Justification

    /// **The generator, and it normalises.** `k` at or below 1 is `Union`, `k` at or above `n` is
    /// `Veto`, and only the strict middle is a `Threshold` — so the two dominating rules are not
    /// special cases bolted on beside the family, they are the family's endpoints, recovered.
    ///
    /// `why` is consumed only by the middle case; at an endpoint no justification is required because
    /// nothing needs justifying. `n` is clamped to at least 1: a rule over no units is not a rule, and
    /// returning something accept-always for it would be a check that cannot fail.
    ///
    /// This is the function that makes the mirror sweep fall out for free. A gate configured with
    /// `k = n` on a discovery task normalises to `Veto`, and `classify Recall Veto` is
    /// `MirrorMismatch` — nobody has to notice the coincidence.
    let ofKOfN (k: int) (n: int) (why: Justification) : Rule =
        let n = max 1 n
        if k <= 1 then Union
        elif k >= n then Veto
        else Threshold(k, why)

    /// The axes a rule dominates on — structural, from the rule alone.
    ///
    /// `AllOf` keeps only safety (an intersection of accept sets can only shrink, so a veto arm still
    /// blocks everything the strictest unit blocks; but conjoining anything onto an optimal rule
    /// destroys its optimality, so accuracy does not survive). `AnyOf` keeps only recall, dually. An
    /// empty composite dominates on nothing, because it is not a rule.
    let rec dominanceAxes (rule: Rule) : Dominance list =
        match rule with
        | Union -> [ OnRecall ]
        | Veto -> [ OnSafety ]
        | Weighted LogOddsCompetence -> [ OnAccuracy ]
        | Weighted(EndogenousEvidence _) -> [ OnAccuracy ]
        | Weighted(ExperienceProxy _) -> []
        | Weighted(SelfAsserted _) -> []
        | Threshold _ -> []
        | Plurality _ -> []
        | AllOf [] -> []
        | AnyOf [] -> []
        | AllOf rules ->
            rules
            |> List.collect dominanceAxes
            |> List.filter (fun a -> a = OnSafety)
            |> List.distinct
        | AnyOf rules ->
            rules
            |> List.collect dominanceAxes
            |> List.filter (fun a -> a = OnRecall)
            |> List.distinct

    /// Every justification named anywhere inside a rule, outermost first.
    let rec justificationsIn (rule: Rule) : Justification list =
        match rule with
        | Union
        | Veto
        | Weighted _ -> []
        | Threshold(_, why) -> [ why ]
        | Plurality why -> [ why ]
        | AllOf rules
        | AnyOf rules -> rules |> List.collect justificationsIn

    /// **The full, ordinal, culture-invariant key of a justification, free text included.** Identity
    /// for justifications runs through this in both oracles, so that "does this threshold name the
    /// same purpose the site names" is decided the same way in F# and in TypeScript. F#'s structural
    /// equality would have given the same answer here; TypeScript has no structural equality, so the
    /// shared decision procedure is the string, and the string is the treaty.
    let justificationKey (j: Justification) : string =
        match j with
        | FaultTolerance f -> sprintf "fault-tolerance:%d" f
        | IntegrityCheck -> "integrity-check"
        | IndependenceCheck -> "independence-check"
        | Legitimacy -> "legitimacy"
        | Authorization -> "authorization"
        | LivenessPrecondition -> "liveness-precondition"
        | ModelNotMechanism -> "model-not-mechanism"
        | PricedPrecisionTrade rationale -> "priced-precision-trade:" + rationale
        | Unstated note -> "unstated:" + note

    /// The coarse tag — the case name with the free text dropped. This is what the cross-oracle
    /// verdict lock compares, so that rewording a `note` does not churn a golden table while a change
    /// of *case* still does.
    let justificationTag (j: Justification) : string =
        match j with
        | FaultTolerance f -> sprintf "fault-tolerance:%d" f
        | IntegrityCheck -> "integrity-check"
        | IndependenceCheck -> "independence-check"
        | Legitimacy -> "legitimacy"
        | Authorization -> "authorization"
        | LivenessPrecondition -> "liveness-precondition"
        | ModelNotMechanism -> "model-not-mechanism"
        | PricedPrecisionTrade _ -> "priced-precision-trade"
        | Unstated _ -> "unstated"

    /// The two one-sided axes are each other's mirror. Accuracy has no mirror.
    let private isMirror (needed: Dominance) (offered: Dominance) : bool =
        (needed = OnRecall && offered = OnSafety) || (needed = OnSafety && offered = OnRecall)

    let private classifyAgainstAxis (needed: Dominance) (rule: Rule) : Verdict =
        let axes = dominanceAxes rule

        if List.contains needed axes then
            Dominates needed
        else
            match axes with
            | offered :: _ when isMirror needed offered -> MirrorMismatch(needed, offered)
            | offered :: _ -> WrongAxis(needed, offered)
            | [] ->
                match rule with
                | Weighted basis -> DeferenceReachableNotChosen basis
                | Threshold(_, why) -> DoesNotDominate why
                | Plurality why -> DoesNotDominate why
                | Union
                | Veto
                | AllOf _
                | AnyOf _ ->
                    DoesNotDominate(
                        Unstated "composite rule, no arm of which dominates on the axis this purpose needs"
                    )

    /// **Classify a pairing.** Total, pure, and it is the only place a verdict is produced.
    ///
    /// A non-accuracy site is `OutOfScope` — but only after checking that every justification written
    /// inside its rule agrees with what the site says it is for. That check is what stops a defect
    /// being laundered by labelling a bare quorum `FaultTolerance`.
    let classify (purpose: Purpose) (rule: Rule) : Verdict =
        match purpose with
        | Recall -> classifyAgainstAxis OnRecall rule
        | Safety -> classifyAgainstAxis OnSafety rule
        | TwoSidedAccuracy -> classifyAgainstAxis OnAccuracy rule
        | NonAccuracy stated ->
            match
                justificationsIn rule
                |> List.tryFind (fun j -> justificationKey j <> justificationKey stated)
            with
            | Some found -> JustificationDisagreesWithPurpose(purpose, found)
            | None -> OutOfScope stated

    /// The boolean reading of a rule, for the rules that have one. `Weighted` has none — it needs
    /// numbers, not votes — and an empty composite has none, because it is not a rule.
    let rec toBooleanRule (rule: Rule) : (bool list -> bool) option =
        match rule with
        | Union -> Some(fun votes -> List.exists id votes)
        | Veto -> Some(fun votes -> not (List.isEmpty votes) && List.forall id votes)
        | Threshold(k, _) -> Some(fun votes -> (votes |> List.filter id |> List.length) >= k)
        | Weighted _ -> None
        | Plurality _ -> None
        | AllOf [] -> None
        | AnyOf [] -> None
        | AllOf rules ->
            let parts = rules |> List.map toBooleanRule

            if List.exists Option.isNone parts then
                None
            else
                let fs = parts |> List.map Option.get
                Some(fun votes -> fs |> List.forall (fun f -> f votes))
        | AnyOf rules ->
            let parts = rules |> List.map toBooleanRule

            if List.exists Option.isNone parts then
                None
            else
                let fs = parts |> List.map Option.get
                Some(fun votes -> fs |> List.exists (fun f -> f votes))

    /// **The witness family a rule derives from itself**, for handing to
    /// `Levels.Aggregation.canImitateEveryProjection`.
    ///
    /// For `Union`, the witness for index `i` is the input in which only `i` accepts: the rule returns
    /// `true`, which is exactly `i`'s answer. For `Veto`, only `i` rejects. Both are read off the
    /// rule's own definition, not constructed to pass.
    ///
    /// `None` for everything else — and `None` here is **not** a proof that no witness family exists.
    /// It cannot be: the witness check is weak enough that unweighted 2-of-3 passes it (see the module
    /// header, and the locked counterexample in the tests). The structural verdict from `classify` is
    /// what discriminates; this function only supplies witnesses where they are derivable.
    let imitationWitnesses (memberCount: int) (rule: Rule) : bool list list option =
        if memberCount <= 0 then
            None
        else
            match rule with
            | Union -> Some [ for i in 0 .. memberCount - 1 -> [ for j in 0 .. memberCount - 1 -> j = i ] ]
            | Veto -> Some [ for i in 0 .. memberCount - 1 -> [ for j in 0 .. memberCount - 1 -> j <> i ] ]
            | Weighted _
            | Threshold _
            | Plurality _
            | AllOf _
            | AnyOf _ -> None

    /// A canonical, ordinal, culture-invariant text key for a verdict. Exists so the F# and TypeScript
    /// classifications can be compared as text across the oracle boundary, per
    /// `no-binary-in-proof-lineage` — the byte-lock is a readable string, not a structure.
    let verdictKey (verdict: Verdict) : string =
        let dom (d: Dominance) =
            match d with
            | OnRecall -> "recall"
            | OnSafety -> "safety"
            | OnAccuracy -> "accuracy"

        let basis (b: WeightBasis) =
            match b with
            | LogOddsCompetence -> "log-odds-competence"
            | EndogenousEvidence q -> "endogenous-evidence:" + q
            | ExperienceProxy q -> "experience-proxy:" + q
            | SelfAsserted q -> "self-asserted:" + q

        let why = justificationTag

        let purposeKey (p: Purpose) =
            match p with
            | Recall -> "recall"
            | Safety -> "safety"
            | TwoSidedAccuracy -> "two-sided-accuracy"
            | NonAccuracy j -> "non-accuracy:" + why j

        match verdict with
        | Dominates axis -> "dominates:" + dom axis
        | MirrorMismatch(needed, offered) -> "mirror-mismatch:" + dom needed + ":" + dom offered
        | WrongAxis(needed, offered) -> "wrong-axis:" + dom needed + ":" + dom offered
        | DeferenceReachableNotChosen b -> "deference-reachable-not-chosen:" + basis b
        | DoesNotDominate j -> "does-not-dominate:" + why j
        | OutOfScope j -> "out-of-scope:" + why j
        | JustificationDisagreesWithPurpose(p, j) -> "justification-disagrees:" + purposeKey p + ":" + why j
