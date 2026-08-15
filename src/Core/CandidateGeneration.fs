namespace Zeta.Core

open System
open System.Globalization
open System.Numerics

/// **CandidateGeneration — the missing INPUT to the posterior path: something that
/// theorizes alternative futures instead of being handed them.**
///
/// **What was already there, and what was not.** The F# path from a posterior to the
/// scheduler is complete and predates this module:
/// `PredictionInference.Candidate {Prior; Likelihood; Cost}` → exact rational posterior →
/// `rankWithPriority` → `Vision.predictBranches` (board the affordable prefix, DEFER the
/// rest) → `PredictionScheduler`. The scheduler already takes a **distribution**, not a
/// scalar. What did not exist is anything that **produces the alternatives**:
/// `PredictionScheduler.CandidateEstimator` is caller-supplied at every site, so every
/// prior, likelihood and cost in the tree is hand-written. This module supplies that input
/// and changes nothing downstream of it.
///
/// **The distinction this module exists to honour — and must not be read as collapsing.**
///
/// - **Cost-bound pruning** drops a branch whose predicted cost blows up. It prunes *within
///   one plan* and needs only a cost model. `BonsaiCost` + `Vision.predictBranches` do this
///   already, and doing it better never turns it into the next thing.
/// - **Possibility-space pruning (Rodney's Razor)** chooses *among alternative plans that do
///   not exist yet*. It requires representing counterfactual futures, which is inference,
///   not bookkeeping. A scheduler with a *perfect* cost model still cannot do it, because it
///   has nothing to compare against.
///
/// This module closes the second by generating the alternatives. It does **not** claim the
/// first was ever sufficient, and `BonsaiCost` is used here only to *price* candidates this
/// module invented.
///
/// **The generative model, stated plainly so it can be argued with.** The hypothesis space
/// is the set of `Bonsai.Expr` programs a `Grammar` can build up to a depth. Over that set:
///
/// - **Prior — MDL / Occam, unnormalized.** `prior(e) ∝ 2^(−size e)`, carried as the exact
///   integer `2^(maxSize − size e)` so denominators stay 1 and nothing rounds. Shorter
///   programs are more probable a priori. **This is a CHOSEN prior, not a measured fact** —
///   it is the standard description-length prior (Solomonoff 1964; Rissanen 1978, MDL;
///   Wallace & Boulton 1968, MML), and choosing it is ordinary Bayesian practice, but no
///   test in this repo can falsify "2^−size is the right prior." What the tests falsify is
///   everything downstream of it.
/// - **Likelihood — actual soft evaluation against actual observations.** For each
///   `Observation {Env; Observed}`, run `BonsaiSoft.evalSoft`, and take the probability mass
///   the resulting `SoftValue` places on the observed value. Independent observations
///   multiply. A hypothesis that puts **zero** mass on something observed is **refuted by
///   the evidence** and its posterior is exactly zero. That is the falsifier the work item
///   asked for: theorized futures and an observed outcome can disagree, and `infer` reports
///   it (`AllCandidatesRefuted` when every hypothesis dies).
/// - **Cost — `BonsaiCost`, unchanged.** Each surviving hypothesis is priced by the shipped
///   static cost model, so `Vision` can board the affordable prefix of the *posterior* order.
///
/// So the prune that comes out the far end is over **alternatives that did not exist before
/// this function ran**, ordered by posterior and cut by budget. That is the mechanism the
/// work item is about. Whether it *schedules well* is a separate, unmeasured claim — see
/// `CandidateGenerationMeasure`, which reports spread and held-out agreement and gates
/// neither.
///
/// **Register (`toy-is-free-metered-must-be-earned.md`).**
///
/// | claim | register | falsifier |
/// |---|---|---|
/// | every generated candidate's cost bounds its actual `evalSoft` width | **metered** | `BonsaiCostMeasure.measureWith` over the generated corpus; `Unsound` non-empty is the defect |
/// | the generator produces genuinely *different* alternatives | **metered** | `Spread.Vacuous` — one candidate, or N with one posterior, is the vacuity class |
/// | the posterior-best hypothesis predicts a held-out observation | **metered** | `heldOut` returns `Agrees = false`, and a test exhibits a case where it does |
/// | `2^−size` is the right prior | **unmetered — a choice with an anchor** | none in repo |
/// | this improves real scheduling decisions | **unmetered** | none yet; needs a workload |
///
/// **Enumeration order is Occam order, and truncation is therefore principled.** Levels are
/// built by increasing depth, and the cap keeps the *shortest* programs — which is exactly
/// the highest-prior prefix under the MDL prior. Truncation is reported (`Truncated`) rather
/// than hidden, because a truncated hypothesis space can silently exclude the true one.
///
/// **Anchors (Beacon).** Solomonoff, *A Formal Theory of Inductive Inference* (1964) —
/// prior weighted by program length. Rissanen, *Modeling by Shortest Data Description*
/// (1978) — MDL. Wallace & Boulton (1968) — MML. Lake, Salakhutdinov & Tenenbaum,
/// *Human-level concept learning through probabilistic program induction* (Science, 2015) —
/// generation over a program space scored by a prior × likelihood, which is the shape used
/// here. Kemp & Tenenbaum (2008) on structure search over a grammar of hypotheses.
[<RequireQualifiedAccess>]
module CandidateGeneration =

    open Bonsai

    module PS = ProbabilitySemiring

    /// The hypothesis space's shape. Small on purpose: enumeration is exponential in depth,
    /// and an honest generator says what it can reach rather than pretending to reach all
    /// programs.
    type Grammar =
        { /// Parameter names the generator may reference. Must appear in every observation.
          Params: string list
          /// Literals the generator may use.
          Constants: ConstValue list
          /// Binary operators the generator may use.
          Ops: BinOp list
          /// Whether `Cond(test, then, else)` is in the space.
          UseCond: bool
          /// Levels of composition above the leaves. 0 = leaves only.
          MaxDepth: int
          /// Hard ceiling on the enumerated set, applied at WHOLE-LEVEL granularity so that
          /// what survives is "all programs of length <= k" — the MDL prefix — rather than
          /// an arbitrary slice of one level. See the note on `enumerate`.
          MaxCandidates: int }

    /// One piece of evidence: an environment, and the value actually seen for it.
    type Observation =
        { Env: BonsaiSoft.Env
          Observed: DynamicValue }

    /// Everything the estimator needs to theorize. This is the `'Inner` a
    /// `PredictionScheduler.Planned` carries when the generator is the estimator.
    type Situation =
        { Grammar: Grammar
          Observations: Observation list
          /// Caller-owned unit prices, exactly as `BonsaiCost` requires — a deployment fact,
          /// not something this module is entitled to invent.
          BytesPerCandidate: int64
          BytesPerPair: int64 }

    /// The typed reasons generation declines. Named *Feedback* not *Error* per the repo
    /// convention: a decline is scheduling input.
    type GenFeedback =
        /// No parameters and no constants — there are no leaves, so no programs.
        | EmptyGrammar
        /// No operators and no `Cond` — the space is leaves only and depth is wasted.
        | NoComposition
        /// Evidence is required: without it every hypothesis has likelihood 1 and the
        /// posterior is the prior, which is not inference.
        | NoObservations
        | NegativeDepth of depth: int
        | NonPositiveCandidateCap of cap: int
        /// The cap cannot even hold the leaves, so no level could ever be taken whole.
        /// Distinct from `NonPositiveCandidateCap`: the cap is well-formed, just too small
        /// for this grammar.
        | CapBelowLeaves of cap: int * leaves: int
        /// A grammar parameter is missing from an observation's environment. Widths (and
        /// therefore costs) would be undefined, and `evalSoft` would decline for a reason
        /// that is a caller mistake rather than evidence.
        | ParamNotObserved of param: string * observationIndex: int
        /// Every enumerated program's cost declined, so nothing can be budgeted.
        | EmptyHypothesisSpace
        /// The prior's integer weight left `int64`. Not capped — a capped prior is a wrong
        /// prior. Reduce `MaxDepth` or the constant set.
        | PriorOverflow of label: string * bits: int
        /// The exact likelihood did not fit `PS.Rational` after reduction. Use fewer
        /// observations or a coarser scale; do not round, because a rounded likelihood
        /// silently changes which hypothesis wins.
        | LikelihoodOverflow of label: string * observations: int

    /// Quantization scale for a soft weight into an exact rational. `2^12` keeps
    /// `scale^|observations|` inside `int64` for up to five observations, which is checked
    /// rather than assumed (`LikelihoodOverflow`).
    [<Literal>]
    let LikelihoodScale = 4096L

    let private maxI64 = BigInteger Int64.MaxValue

    // ── the hypothesis space ────────────────────────────────────────────────

    /// Description length: node count. The `size` in `2^−size`.
    let rec size (expr: Expr) : int =
        match expr with
        | Const _
        | Param _ -> 1
        | Binary(_, l, r) -> 1 + size l + size r
        | Cond(t, a, b) -> 1 + size t + size a + size b
        | Lambda(_, body) -> 1 + size body
        | Call(_, args) -> 1 + List.sumBy size args

    let private renderConst (c: ConstValue) : string =
        match c with
        | CInt i -> i.ToString(CultureInfo.InvariantCulture)
        | CStr s -> "\"" + s + "\""
        | CBool b -> if b then "true" else "false"
        | CNull -> "null"

    let private renderOp (op: BinOp) : string =
        match op with
        | Add -> "+"
        | Sub -> "-"
        | Mul -> "*"
        | Eq -> "=="
        | Lt -> "<"
        | And -> "&&"
        | Or -> "||"

    /// A total, fully-parenthesized rendering used as the candidate's label. Deliberately
    /// NOT `Bonsai.serialize`: a label is a human-facing name and must not become a second
    /// consumer of the wire format. Injective over the fragment this module generates, so
    /// distinct programs get distinct labels and `PredictionInference`'s ordinal tie-break
    /// stays deterministic.
    let rec render (expr: Expr) : string =
        match expr with
        | Const c -> renderConst c
        | Param p -> p
        | Binary(op, l, r) -> "(" + render l + " " + renderOp op + " " + render r + ")"
        | Cond(t, a, b) -> "(if " + render t + " then " + render a + " else " + render b + ")"
        | Lambda(ps, body) -> "(fun " + String.Join(" ", ps) + " -> " + render body + ")"
        | Call(f, args) -> f + "(" + String.Join(", ", args |> List.map render) + ")"

    /// Enumerate the grammar's programs shortest-first, deduplicated, capped.
    /// Returns the set and whether the cap truncated it.
    ///
    /// Shortest-first is not a convenience: under the MDL prior it is descending-prior
    /// order, so a truncated space is the highest-prior prefix rather than an arbitrary
    /// subset. The truncation flag still travels, because "the true hypothesis was past the
    /// cap" is a real failure and must not be silent.
    let enumerate (grammar: Grammar) : Result<Expr list * bool, GenFeedback> =
        if grammar.MaxDepth < 0 then Error(NegativeDepth grammar.MaxDepth)
        elif grammar.MaxCandidates < 1 then Error(NonPositiveCandidateCap grammar.MaxCandidates)
        elif List.isEmpty grammar.Params && List.isEmpty grammar.Constants then Error EmptyGrammar
        elif List.isEmpty grammar.Ops && not grammar.UseCond then Error NoComposition
        else
            let leaves =
                (grammar.Constants |> List.map Const) @ (grammar.Params |> List.map Param)
                |> List.distinct

            let cap = grammar.MaxCandidates

            // The cap is applied at WHOLE-LEVEL granularity: a level is taken entirely or
            // not at all.
            //
            // **This was a defect, found by running it (2026-08-15) rather than by reading
            // it.** The first version truncated *inside* a level, and the effect was not
            // subtle: on the reference situation the cap fell partway through the `Mul`
            // block, so `x * y` — the hypothesis that actually generated the evidence —
            // was never enumerated, every remaining hypothesis was refuted, and the whole
            // path returned `AllCandidatesRefuted`. The claim "shortest-first is Occam
            // order, so a truncated space is the highest-prior prefix" is only true
            // BETWEEN levels; within a level every program has the same size and therefore
            // the same prior, so the cut order was the order of the `for op in ...` loop.
            // A cap that quietly prefers `Add` over `Mul` is not a prior, it is a bug
            // wearing one.
            //
            // Whole-level truncation makes the claim true again: what survives is exactly
            // "all programs of description length <= k", which IS the MDL prefix.
            //
            // **A level combines over EVERYTHING enumerated so far, not just the previous
            // level.** The first version fed only `previous` forward, which quietly
            // restricted the space to balanced trees: `(x + 1) + 1` was unreachable while
            // `(x + 1) + (x + 1)` was, because a leaf could never meet a depth-1 node. That
            // is not "programs up to depth d" — it is a different, smaller space that looks
            // like it. Caught by a test asking for `((x < 1) + 1)` and not finding it.
            //
            // The cost of the correction is that the input set grows, so a level is
            // `|acc|^2` (or `|acc|^3` with `Cond`). The size is therefore PROJECTED
            // arithmetically before anything is built, and a level that cannot fit is
            // refused without materializing it — otherwise the estimator becomes the
            // resource exhaustion it exists to prevent. The projection is pre-dedup and so
            // conservative: it can refuse a level that would have fitted after duplicates
            // were removed. That is deliberate (over-refusing is reported as `Truncated`;
            // over-building is unbounded work), and it is the honest reading of the flag.
            //
            // **There is exactly ONE cap check, and that is deliberate.** An earlier version
            // also re-checked `|acc| + |fresh| > cap` after building. Mutation testing kept
            // that branch alive with no test able to kill it, and the reason is that it is
            // UNREACHABLE: `|fresh| <= |combined| = projected` by construction, and control
            // only reaches the build when `|acc| + projected <= cap`, so `|acc| + |fresh| <=
            // cap` always. An unreachable guard is the vacuity class wearing a safety net —
            // it reads as defence-in-depth and can never fire — so it was deleted rather
            // than left in to look careful.
            let rec levels (depth: int) (acc: Expr list) (truncated: bool) =
                if depth >= grammar.MaxDepth || truncated then
                    acc, truncated
                else
                    let n = int64 (List.length acc)
                    let ops = int64 (List.length grammar.Ops)
                    let projected = ops * n * n + (if grammar.UseCond then n * n * n else 0L)

                    if n + projected > int64 cap then
                        acc, true
                    else
                        let combined =
                            [ for op in grammar.Ops do
                                  for l in acc do
                                      for r in acc do
                                          Binary(op, l, r)
                              if grammar.UseCond then
                                  for t in acc do
                                      for a in acc do
                                          for b in acc do
                                              if a <> b then Cond(t, a, b) ]

                        let seen = Set.ofList acc

                        let fresh =
                            combined |> List.distinct |> List.filter (fun e -> not (Set.contains e seen))

                        if List.isEmpty fresh then
                            acc, truncated
                        else
                            levels (depth + 1) (acc @ fresh) truncated

            if List.length leaves > cap then
                Error(CapBelowLeaves(cap, List.length leaves))
            else
                let all, truncated = levels 0 leaves false
                if List.isEmpty all then Error EmptyHypothesisSpace else Ok(all, truncated)

    // ── prior, likelihood, cost ─────────────────────────────────────────────

    /// Pointwise-maximum candidate width per parameter across the observations. The max is
    /// what keeps the cost bound SOUND: a per-observation width would under-price every
    /// other observation.
    let private widthsOf (grammar: Grammar) (observations: Observation list) : Result<BonsaiCost.Widths, GenFeedback> =
        let rec loop (index: int) (acc: BonsaiCost.Widths) rest =
            match rest with
            | [] -> Ok acc
            | (obs: Observation) :: tail ->
                let rec perParam (accP: BonsaiCost.Widths) ps =
                    match ps with
                    | [] -> Ok accP
                    | p :: pTail ->
                        match Map.tryFind p obs.Env with
                        | None -> Error(ParamNotObserved(p, index))
                        | Some sv ->
                            let w = int64 (List.length (SoftValue.candidates sv))
                            let next =
                                match Map.tryFind p accP with
                                | Some existing when existing >= w -> accP
                                | _ -> Map.add p w accP
                            perParam next pTail

                match perParam acc grammar.Params with
                | Error feedback -> Error feedback
                | Ok next -> loop (index + 1) next tail

        loop 0 Map.empty observations

    /// `2^(maxSize − size e)`, the exact integer form of `∝ 2^−size e` over a finite set.
    /// Integer, so the prior contributes denominator 1 and cannot round.
    let private priorOf (maxSize: int) (expr: Expr) : Result<PS.Rational, GenFeedback> =
        let bits = maxSize - size expr
        if bits > 62 then Error(PriorOverflow(render expr, bits))
        else Ok(PS.ofInt (1L <<< bits))

    /// The exact likelihood `Π_obs P(observed | hypothesis)`.
    ///
    /// Two honesty details that decide which hypothesis wins:
    ///
    /// - **A declined evaluation is likelihood ZERO, not a dropped candidate.** An
    ///   ill-typed program (`Add` over a `Bool` a `Lt` produced) is a hypothesis the
    ///   evidence *refutes*, and refutation is a result. Dropping it would quietly shrink
    ///   the possibility space instead of pruning it.
    /// - **A positive-but-tiny weight quantizes to `1/scale`, never to 0.** Refuted must
    ///   mean *no support*, not *rounded away*; collapsing the two would manufacture
    ///   certainty the evidence does not contain.
    let private likelihoodOf (observations: Observation list) (expr: Expr) : Result<PS.Rational, GenFeedback> =
        let rec loop (num: BigInteger) (den: BigInteger) rest =
            match rest with
            | [] ->
                let g = BigInteger.GreatestCommonDivisor(num, den)
                let g = if g.IsZero then BigInteger.One else g
                let n = num / g
                let d = den / g
                if n > maxI64 || d > maxI64 then
                    Error(LikelihoodOverflow(render expr, List.length observations))
                else
                    Ok(PS.rat (int64 n) (int64 d))
            | (obs: Observation) :: tail ->
                let weight =
                    match BonsaiSoft.evalSoft obs.Env expr with
                    | Error _ -> 0.0
                    | Ok sv -> SoftValue.weightOf obs.Observed sv

                let quantized =
                    if weight <= 0.0 then 0L
                    else max 1L (int64 (Math.Round(weight * float LikelihoodScale)))

                loop (num * BigInteger quantized) (den * BigInteger LikelihoodScale) tail

        loop BigInteger.One BigInteger.One observations

    // ── generation ──────────────────────────────────────────────────────────

    /// What generation produced, including the parts that did not survive. The counts are
    /// the point: a generator that silently drops most of its space looks identical to one
    /// that never had it.
    type Generated =
        { Candidates: PredictionInference.Candidate<Expr> list
          /// Programs enumerated before pricing.
          Enumerated: int
          /// Programs whose cost `BonsaiCost` could not bound — the cost-bound prune, which
          /// happens BEFORE the posterior order and is a different mechanism from it.
          CostDeclined: int
          /// Programs the evidence refuted outright (likelihood exactly 0).
          Refuted: int
          /// The cap cut the space; the true hypothesis may lie past it.
          Truncated: bool
          Widths: BonsaiCost.Widths }

    /// **Theorize the alternative futures.** Enumerate the space, price each program with
    /// the shipped cost model, score it against the evidence, and hand back exactly the
    /// `PredictionInference.Candidate` list the existing posterior path already consumes.
    /// Nothing downstream is rebuilt or rerouted.
    let generate (situation: Situation) : Result<Generated, GenFeedback> =
        if List.isEmpty situation.Observations then
            Error NoObservations
        else
            match widthsOf situation.Grammar situation.Observations with
            | Error feedback -> Error feedback
            | Ok widths ->
                match enumerate situation.Grammar with
                | Error feedback -> Error feedback
                | Ok(exprs, truncated) ->
                    let maxSize = exprs |> List.map size |> List.max

                    let rec loop acc declined refuted rest =
                        match rest with
                        | [] -> Ok(List.rev acc, declined, refuted)
                        | expr :: tail ->
                            match
                                BonsaiCost.branchCost
                                    situation.BytesPerCandidate
                                    situation.BytesPerPair
                                    widths
                                    expr
                                with
                            | Error _ ->
                                // Cannot bound it ⇒ cannot budget it. This is the cost-bound
                                // prune, and it is deliberately kept distinct from refutation.
                                loop acc (declined + 1) refuted tail
                            | Ok cost ->
                                match priorOf maxSize expr with
                                | Error feedback -> Error feedback
                                | Ok prior ->
                                    match likelihoodOf situation.Observations expr with
                                    | Error feedback -> Error feedback
                                    | Ok likelihood ->
                                        let candidate: PredictionInference.Candidate<Expr> =
                                            { Label = render expr
                                              State = expr
                                              Prior = prior
                                              Likelihood = likelihood
                                              Cost = cost }

                                        let refuted' =
                                            if PS.compare likelihood PS.zero = 0 then refuted + 1 else refuted

                                        loop (candidate :: acc) declined refuted' tail

                    match loop [] 0 0 exprs with
                    | Error feedback -> Error feedback
                    | Ok(candidates, declined, refuted) ->
                        if List.isEmpty candidates then
                            Error EmptyHypothesisSpace
                        else
                            Ok
                                { Candidates = candidates
                                  Enumerated = List.length exprs
                                  CostDeclined = declined
                                  Refuted = refuted
                                  Truncated = truncated
                                  Widths = widths }

    let feedbackText (feedback: GenFeedback) : string =
        match feedback with
        | EmptyGrammar -> "grammar has no leaves (no params, no constants)"
        | NoComposition -> "grammar has no operators and no Cond — the space is leaves only"
        | NoObservations -> "no observations: the posterior would be the prior, which is not inference"
        | NegativeDepth depth -> sprintf "negative max depth: %d" depth
        | NonPositiveCandidateCap cap -> sprintf "candidate cap must be >= 1, got %d" cap
        | CapBelowLeaves(cap, leaves) -> sprintf "candidate cap %d is below the grammar's %d leaves" cap leaves
        | ParamNotObserved(param, index) -> sprintf "param '%s' absent from observation %d" param index
        | EmptyHypothesisSpace -> "no program in the space could be priced"
        | PriorOverflow(label, bits) -> sprintf "prior 2^%d overflows int64 for %s" bits label
        | LikelihoodOverflow(label, count) ->
            sprintf "exact likelihood over %d observations does not fit a rational for %s" count label

    // ── the scheduler seam ──────────────────────────────────────────────────

    /// **The `CandidateEstimator` the scheduler has been missing.** Same signature the seam
    /// always had; the difference is that the candidates are now theorized rather than
    /// handed in. `PredictionScheduler.plan` / `policyHandler` / `wrapHandlerK` take this
    /// unchanged.
    let estimator: PredictionScheduler.CandidateEstimator<Situation, Expr> =
        fun _intr situation ->
            match generate situation with
            | Ok generated -> Ok generated.Candidates
            | Error feedback ->
                // The inference channel gained ONE case for this (`GenerationFeedback`)
                // rather than borrowing `NegativePrior` with a fabricated -1: a generation
                // decline is not a value defect, and reporting it as one would put a wrong
                // number in a diagnostic a human reads to find out what happened.
                Error(PredictionInference.GenerationFeedback(feedbackText feedback))

    /// Generate, infer, and budget in one step — the whole possibility-space prune.
    /// `Prediction.Budget.Boarded` is the set of alternative futures worth funding;
    /// `Deferred` is the set this tick declined to explore. Both are alternatives that did
    /// not exist before the call.
    let prune
        (tank: SoftThrottle.Tank)
        (situation: Situation)
        : Result<PredictionInference.Prediction<Expr>, PredictionInference.Feedback> =
        match generate situation with
        | Error feedback -> Error(PredictionInference.GenerationFeedback(feedbackText feedback))
        | Ok generated -> PredictionInference.inferAndPredict tank generated.Candidates


/// **CandidateGenerationMeasure — the instruments. One is a gate, two are records.**
///
/// The split is deliberate and is not the same judgement in three places:
///
/// - **Vacuity is GATED.** A generator that emits one candidate, or N candidates carrying
///   one posterior, satisfies every type in the path and performs no inference. There is
///   nothing to get better at — it is the vacuity class in generative clothing, and
///   `Spread.Vacuous` is asserted false in the tests.
/// - **Soundness is GATED**, via `BonsaiCostMeasure.measureWith` over the *generated*
///   corpus: `actual > predicted` is a wrong model. (`actual < predicted` is a loose bound
///   and is fine.)
/// - **Discrimination and held-out agreement are RECORDED, NOT gated.** Aaron 2026-08-15 on
///   whether predictions must actually discriminate: *"yes exactly — most probably won't at
///   first, until we get better at it."* A quality bar here would either block honest work
///   or invite tuning the model until the number looks good, which inverts the instrument
///   into a target. **Do not optimise against these numbers.**
[<RequireQualifiedAccess>]
module CandidateGenerationMeasure =

    open Bonsai

    module PS = ProbabilitySemiring

    /// Does the generator produce alternatives that actually DIFFER? Every field exists to
    /// make a specific way of faking it visible.
    type Spread =
        { Generated: int
          /// Structurally distinct programs. `1` is the crudest vacuity.
          DistinctExprs: int
          /// Distinct posterior weights. `1` means the ranking carries no information even
          /// though N candidates exist — the subtler vacuity.
          DistinctPosteriors: int
          /// Distinct predicted `SpaceBytes`. `1` means the budget cannot separate them.
          DistinctCosts: int
          /// Candidates the evidence refuted outright.
          Refuted: int
          MinSize: int
          MaxSize: int
          /// max/min over strictly-positive posteriors. `1.0` is a flat posterior.
          PosteriorRatio: float
          /// max/min over positive predicted space costs. `1.0` is a flat cost model.
          CostRatio: float
          /// The gate: one candidate, or one posterior, is no inference at all.
          Vacuous: bool }

    let private ratioOf (values: float list) : float =
        let positive = values |> List.filter (fun v -> v > 0.0)
        match positive with
        | [] -> 1.0
        | _ -> List.max positive / List.min positive

    let spread (generated: CandidateGeneration.Generated) : Spread =
        let candidates = generated.Candidates

        let posteriors =
            candidates |> List.map (fun c -> PS.mul c.Prior c.Likelihood)

        let posteriorFloats =
            posteriors |> List.map (fun r -> float r.Num / float r.Den)

        let costs = candidates |> List.map (fun c -> float c.Cost.SpaceBytes)
        let sizes = candidates |> List.map (fun c -> CandidateGeneration.size c.State)
        let distinctExprs = candidates |> List.map _.State |> List.distinct |> List.length
        let distinctPosteriors = posteriors |> List.distinct |> List.length

        { Generated = List.length candidates
          DistinctExprs = distinctExprs
          DistinctPosteriors = distinctPosteriors
          DistinctCosts = costs |> List.distinct |> List.length
          Refuted = posteriors |> List.filter (fun r -> PS.compare r PS.zero = 0) |> List.length
          MinSize = List.min sizes
          MaxSize = List.max sizes
          PosteriorRatio = ratioOf posteriorFloats
          CostRatio = ratioOf costs
          Vacuous = distinctExprs <= 1 || distinctPosteriors <= 1 }

    /// The generated corpus as `BonsaiCostMeasure` cases, so the SAME instrument that scored
    /// the hand-built `standardCorpus` scores programs nobody wrote.
    ///
    /// Cases whose evaluation declines are **excluded and counted**: an unevaluable program
    /// has no observable width, so scoring it would be scoring nothing. The count travels so
    /// the exclusion is not a way to make the corpus flattering.
    let soundnessCases
        (env: BonsaiSoft.Env)
        (generated: CandidateGeneration.Generated)
        : BonsaiCostMeasure.Case list * int =
        let evaluable =
            generated.Candidates
            |> List.filter (fun c ->
                match BonsaiSoft.evalSoft env c.State with
                | Ok _ -> true
                | Error _ -> false)

        let cases =
            evaluable
            |> List.map (fun c ->
                { BonsaiCostMeasure.Label = c.Label
                  BonsaiCostMeasure.Widths = generated.Widths
                  BonsaiCostMeasure.Env = env
                  BonsaiCostMeasure.Expr = c.State })

        cases, List.length generated.Candidates - List.length evaluable

    /// **The held-out falsifier.** Fit the posterior on one evidence set, then ask the
    /// winner about an observation it never saw. `Agrees = false` is the theorized future
    /// disagreeing with the observed outcome — which is precisely the case the work item
    /// required to exist and be reported.
    ///
    /// RECORDED, not gated: at this stage of the model a disagreement is information about
    /// the generator, not a reason to fail a build.
    type HeldOut =
        { WinnerLabel: string
          /// Probability mass the winner places on the held-out observed value.
          MassOnObserved: float
          Agrees: bool }

    let heldOut
        (situation: CandidateGeneration.Situation)
        (unseen: CandidateGeneration.Observation)
        : Result<HeldOut, CandidateGeneration.GenFeedback> =
        match CandidateGeneration.generate situation with
        | Error feedback -> Error feedback
        | Ok generated ->
            match PredictionInference.infer generated.Candidates with
            | Error _ ->
                // Every hypothesis refuted by the FITTING evidence. That is itself a
                // disagreement, reported as one rather than as an absence.
                Ok
                    { WinnerLabel = "<all refuted>"
                      MassOnObserved = 0.0
                      Agrees = false }
            | Ok inference ->
                let winner = inference.Best

                let mass =
                    match BonsaiSoft.evalSoft unseen.Env winner.Candidate.State with
                    | Error _ -> 0.0
                    | Ok sv -> SoftValue.weightOf unseen.Observed sv

                Ok
                    { WinnerLabel = winner.Candidate.Label
                      MassOnObserved = mass
                      Agrees = mass > 0.0 }

    // ── the reference situation ─────────────────────────────────────────────
    //
    // In Core, not the test project, for the same reason `BonsaiCostMeasure.standardCorpus`
    // is: the numbers are meant to be re-run and compared across DATES, which means the
    // instrument must be callable outside the test harness. DELIBERATELY FIXED — editing it
    // changes what the score means and makes a later reading incomparable. Append with a
    // date if it must grow; never rewrite to improve a number.

    let private certainInt (v: int64) : SoftValue.SoftValue =
        SoftValue.certain (DynamicValue.Int v)

    let private softInts (values: (int64 * float) list) : SoftValue.SoftValue =
        values
        |> List.map (fun (v, w) -> DynamicValue.Int v, w)
        |> SoftValue.ofWeighted
        |> Option.defaultValue (SoftValue.certain (DynamicValue.Int 0L))

    /// The stable reference: the evidence is generated by `x * y` at three points, one of
    /// them under genuine uncertainty in `x`. The hypothesis space contains `x * y` but also
    /// `x + y`, `x - y`, `x`, `y`, constants, and every depth-1 composition of them — so the
    /// posterior has real competition to sort through, which is the entire point.
    let referenceSituation: CandidateGeneration.Situation =
        { Grammar =
            { Params = [ "x"; "y" ]
              Constants = [ CInt 0L; CInt 1L; CInt 2L ]
              Ops = [ Add; Sub; Mul ]
              UseCond = false
              MaxDepth = 1
              MaxCandidates = 256 }
          Observations =
            [ { Env = Map.ofList [ "x", certainInt 3L; "y", certainInt 4L ]
                Observed = DynamicValue.Int 12L }
              { Env = Map.ofList [ "x", certainInt 5L; "y", certainInt 2L ]
                Observed = DynamicValue.Int 10L }
              { Env = Map.ofList [ "x", softInts [ 6L, 0.75; 7L, 0.25 ]; "y", certainInt 3L ]
                Observed = DynamicValue.Int 18L } ]
          BytesPerCandidate = 8L
          BytesPerPair = 1L }

    /// The held-out point for `referenceSituation`: `x * y = 72`, never seen while fitting.
    let referenceHeldOut: CandidateGeneration.Observation =
        { Env = Map.ofList [ "x", certainInt 8L; "y", certainInt 9L ]
          Observed = DynamicValue.Int 72L }

    /// **The second reference: where the PRIOR decides, not the likelihood.**
    ///
    /// `referenceSituation` is settled entirely by evidence — 78 of 80 hypotheses are
    /// refuted outright and the two survivors are equivalent, so the MDL prior never has to
    /// choose anything. That makes it a poor demonstration of the generative half, and
    /// shipping only it would let "the prior is load-bearing" go unchecked.
    ///
    /// Here the evidence is generated by `x` alone, so `x`, `(x + 0)`, `(0 + x)`, `(x * 1)`,
    /// `(1 * x)`, `(x - 0)` and `(x + y)` (with `y = 0`) are **observationally
    /// indistinguishable** — identical likelihood, every one of them. Only description
    /// length separates them, and the shortest wins by `2^(3−1) = 4`.
    ///
    /// That is Rodney's Razor doing the actual work: choosing among alternatives that the
    /// data cannot separate, on a criterion that is not cost. A cost model cannot make this
    /// choice — every one of these programs costs the same here, which the recorded
    /// `CostRatio = 1.0` shows directly.
    let occamSituation: CandidateGeneration.Situation =
        { Grammar =
            { Params = [ "x"; "y" ]
              Constants = [ CInt 0L; CInt 1L ]
              Ops = [ Add; Sub; Mul ]
              UseCond = false
              MaxDepth = 1
              MaxCandidates = 256 }
          Observations =
            [ { Env = Map.ofList [ "x", certainInt 3L; "y", certainInt 0L ]
                Observed = DynamicValue.Int 3L }
              { Env = Map.ofList [ "x", certainInt 5L; "y", certainInt 0L ]
                Observed = DynamicValue.Int 5L } ]
          BytesPerCandidate = 8L
          BytesPerPair = 1L }

    /// One fixed-format line so two runs on different dates are diffable by eye.
    /// Invariant-culture throughout — this line is compared across machines.
    let report (s: Spread) : string =
        String.Format(
            CultureInfo.InvariantCulture,
            "CandidateGeneration spread: generated={0} distinctExprs={1} distinctPosteriors={2} distinctCosts={3} refuted={4} size={5}..{6} posteriorRatio={7:F3} costRatio={8:F3} vacuous={9}",
            s.Generated,
            s.DistinctExprs,
            s.DistinctPosteriors,
            s.DistinctCosts,
            s.Refuted,
            s.MinSize,
            s.MaxSize,
            s.PosteriorRatio,
            s.CostRatio,
            s.Vacuous
        )
