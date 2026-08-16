module Zeta.Tests.AggregationRuleTests

// Falsifiers for `src/Core/AggregationRule.fs`, plus the classification pass over PR #10955's
// inventory of 21 live aggregation sites.
//
// What these tests are for, and what they are NOT:
//
// * `classify`, `ofKOfN`, `dominanceAxes` and `toBooleanRule` are real functions and get real
//   falsifiers — including the one the brief demanded: **a wrong-direction pairing must be
//   detectable.** A DU that cannot express a mismatch has not made mismatches impossible, it has made
//   them invisible, so `classify Recall Veto` is asserted to be `MirrorMismatch` and NOT `Dominates`.
// * The INVENTORY below is repo-meta, not substrate: 21 rows, each a (site, purpose, rule) triple
//   read off PR #10955, which read them off the code. Its verdicts are LOCKED as text keys. The lock
//   is duplicated in `src/Core.TypeScript/society/aggregation-rule.test.ts`; if the two ever disagree
//   the two oracles have diverged on the classification, which is the whole point of keeping both.
// * The lock is a lock, not a proof. It says the classifier is stable and that F# and TypeScript
//   agree. It says NOTHING about whether a classified site behaves as classified — that was
//   established by reading the code in #10955 and is not re-established here.
// * Under `toy-is-free-metered-must-be-earned`: this promotes `classify` / `ofKOfN` /
//   `dominanceAxes` / `toBooleanRule` to `metered`. The inventory itself stays `unmetered`.

open global.Xunit
open FSharp.Reflection
open Zeta.Core

module AR = Zeta.Core.AggregationRule

// ── Shorthands, so the 21 rows read as a table ────────────────────────────────────────────────

let private unstated (note: string) = AR.Unstated note
let private thr (k: int) (why: AR.Justification) = AR.Threshold(k, why)

/// A row of the inventory. `Rule` is the rule at the site's DEFAULT configuration; where a site
/// computes `k` from `n` at runtime, the recorded `k` is illustrative and the verdict does not depend
/// on it (every `Threshold` dominates on nothing whatever `k` is — asserted below).
type private Site =
    { Id: string
      Path: string
      Purpose: AR.Purpose
      Rule: AR.Rule }

// ── §1 The inventory — PR #10955's 21 sites, each as exactly one DU case ──────────────────────

let private inventory: Site list =
    [
      // 1.1 does-not-qualify (3)
      { Id = "review-board"
        Path = "agentic-organization/packages/metrics/src/review-board.ts:115"
        Purpose = AR.Recall
        Rule =
          thr
              3
              (unstated
                  "module attributes its design to the constitution gate (legitimacy); no precision trade is named") }
      { Id = "workflow-consensus"
        Path = "src/Core.TypeScript/workflow-engine/consensus.ts:195"
        Purpose = AR.TwoSidedAccuracy
        Rule = thr 2 (unstated "Robin-architecture majority over an arbitrary analyzer array") }
      { Id = "rmo-target-median"
        Path = "agentic-organization/packages/application/src/rmo.ts:331-338"
        Purpose = AR.TwoSidedAccuracy
        Rule = thr 2 (unstated "median of approver targets: the k-th order statistic at k = ceil(n/2)") }

      // 1.2 weighted, but the weights are not competence (2)
      { Id = "thousand-brains"
        Path = "src/Bayesian/ThousandBrains.fs:73"
        Purpose = AR.TwoSidedAccuracy
        Rule = AR.Weighted(AR.ExperienceProxy "log(1 + accumulated information value)") }
      { Id = "quorum-algebra"
        Path = "src/Core/QuorumAlgebra.fs:151"
        Purpose = AR.TwoSidedAccuracy
        Rule = AR.Weighted(AR.SelfAsserted "complex amplitude") }

      // 1.3 qualifies (6 in #10955; 7 here — see the delta test)
      { Id = "society-useful-work"
        Path = "src/Core/SocietyUsefulWork.fs:32,82"
        Purpose = AR.Recall
        Rule = AR.Union }
      { Id = "belief-convergence"
        Path = "src/Core/BeliefConvergence.fs:33,63"
        Purpose = AR.TwoSidedAccuracy
        Rule = AR.Weighted(AR.EndogenousEvidence "likelihood ratio") }
      { Id = "society-bootstrap"
        Path = "src/Bayesian/SocietyBootstrap.fs:138 + SparseSocietyNetwork.fs:105,178"
        Purpose = AR.TwoSidedAccuracy
        Rule = AR.Weighted(AR.EndogenousEvidence "inverse variance") }
      { Id = "local-consensus"
        Path = "src/Bayesian/LocalConsensus.fs:52"
        Purpose = AR.TwoSidedAccuracy
        Rule = AR.Weighted(AR.EndogenousEvidence "inverse variance") }
      { Id = "mutual-falsification"
        Path = "src/Bayesian/MutualFalsification.fs:185"
        Purpose = AR.Recall
        Rule = AR.Union }
      { Id = "decorrelation-meter"
        Path = "src/Core/DecorrelationMeter.fs:136 + DecorrelationExcessFusion.fs:116,196"
        Purpose = AR.Recall
        Rule = AR.Union }

      // 1.4 not an accuracy aggregator (10 in #10955; 9 here — see the delta test)
      { Id = "bft-consensus"
        Path = "src/Core.CSharp/Consensus.cs:18,47 + src/Core/Consensus.fs"
        Purpose = AR.NonAccuracy(AR.FaultTolerance 1)
        Rule = thr 3 (AR.FaultTolerance 1) }
      { Id = "sybil-bft"
        Path = "src/Core/SybilBft.fs:82-95 + SybilBftProtocol.fs:91,107"
        Purpose = AR.NonAccuracy(AR.FaultTolerance 1)
        Rule = thr 3 (AR.FaultTolerance 1) }
      { Id = "nway-diff"
        Path = "tests/cross-verification/_harness/nway-diff.ts:407,456"
        Purpose = AR.NonAccuracy AR.IntegrityCheck
        Rule = AR.Plurality AR.IntegrityCheck }
      { Id = "constitution-gate"
        Path = "agentic-organization/packages/governance/src/constitution-gate.ts:93-110"
        Purpose = AR.NonAccuracy AR.Legitimacy
        Rule = AR.AllOf [ AR.Veto; thr 2 AR.Legitimacy ] }
      { Id = "change-control-security"
        Path = "agentic-organization/packages/application/src/change-control-policy.ts:35 + change-control-kernel.ts:142-145"
        Purpose = AR.Safety
        Rule = AR.Veto }
      { Id = "work-market"
        Path = "agentic-organization/packages/application/src/work-market.ts:625-645"
        Purpose = AR.NonAccuracy AR.Authorization
        Rule = thr 2 AR.Authorization }
      { Id = "mutual-repair"
        Path = "agentic-organization/packages/application/src/mutual-repair.ts:34-40"
        Purpose = AR.NonAccuracy AR.LivenessPrecondition
        Rule = thr 3 AR.LivenessPrecondition }
      { Id = "veridicality"
        Path = "src/Core/Veridicality.fs:200"
        Purpose = AR.NonAccuracy AR.IndependenceCheck
        Rule = thr 2 AR.IndependenceCheck }
      { Id = "diversity-coercive-step"
        Path = "src/Core/Diversity.fs:45"
        Purpose = AR.NonAccuracy AR.ModelNotMechanism
        Rule = AR.Plurality AR.ModelNotMechanism }
      { Id = "condorcet-boundary"
        Path = "src/Bayesian/CondorcetBoundary.fs"
        Purpose = AR.NonAccuracy AR.ModelNotMechanism
        Rule = thr 2 AR.ModelNotMechanism } ]

/// **Configuration-dependent regimes.** Several sites are one rule at their default configuration and
/// a DIFFERENT rule at another, because `ofKOfN` normalises at the endpoints. These are where the
/// mirror sweep actually lands, and they are kept separate from the inventory so the count of *sites*
/// stays #10955's 21.
let private regimes: Site list =
    [
      // The board convenes only when reviewerCount >= quorum (review-board.ts:146). At the MINIMUM
      // convening size the quorum IS every reviewer, so `k = n` and the rule normalises to Veto —
      // unanimity on a discovery task, the exact mirror of the dominant rule.
      { Id = "review-board@n=quorum"
        Path = "agentic-organization/packages/metrics/src/review-board.ts:146 + :115"
        Purpose = AR.Recall
        Rule = AR.ofKOfN 3 3 (unstated "quorum equals the convening minimum") }
      // Deployed default is requiredApprovals = 1 (deploy/run-org-cadence.ts:761), i.e. k = 1, which
      // normalises to Union.
      { Id = "work-market@k=1"
        Path = "agentic-organization/deploy/run-org-cadence.ts:761"
        Purpose = AR.NonAccuracy AR.Authorization
        Rule = AR.ofKOfN 1 3 AR.Authorization }
      // consensus.ts offers four mechanisms over the same analyzer array; three of them are different
      // rules, and two dominate on an axis the site's objective does not ask for.
      { Id = "workflow-consensus@unanimous"
        Path = "src/Core.TypeScript/workflow-engine/consensus.ts:200"
        Purpose = AR.TwoSidedAccuracy
        Rule = AR.ofKOfN 3 3 (unstated "mechanism = unanimous") }
      { Id = "workflow-consensus@first-1-agree"
        Path = "src/Core.TypeScript/workflow-engine/consensus.ts:204"
        Purpose = AR.TwoSidedAccuracy
        Rule = AR.ofKOfN 1 3 (unstated "mechanism = first-n-agree with n = 1") }
      { Id = "workflow-consensus@supermajority"
        Path = "src/Core.TypeScript/workflow-engine/consensus.ts:198"
        Purpose = AR.TwoSidedAccuracy
        Rule = AR.ofKOfN 3 4 (unstated "mechanism = supermajority; a higher unweighted bar") } ]

// ── §2 The lock — the classification, as text, byte-identical to the TypeScript twin ──────────

/// THE CROSS-ORACLE FIXTURE. Duplicated in `src/Core.TypeScript/society/aggregation-rule.test.ts`.
/// Order matters and is the inventory's order.
let private expectedInventoryKeys: (string * string) list =
    [ "review-board", "does-not-dominate:unstated"
      "workflow-consensus", "does-not-dominate:unstated"
      "rmo-target-median", "does-not-dominate:unstated"
      "thousand-brains", "deference-reachable-not-chosen:experience-proxy:log(1 + accumulated information value)"
      "quorum-algebra", "deference-reachable-not-chosen:self-asserted:complex amplitude"
      "society-useful-work", "dominates:recall"
      "belief-convergence", "dominates:accuracy"
      "society-bootstrap", "dominates:accuracy"
      "local-consensus", "dominates:accuracy"
      "mutual-falsification", "dominates:recall"
      "decorrelation-meter", "dominates:recall"
      "bft-consensus", "out-of-scope:fault-tolerance:1"
      "sybil-bft", "out-of-scope:fault-tolerance:1"
      "nway-diff", "out-of-scope:integrity-check"
      "constitution-gate", "out-of-scope:legitimacy"
      "change-control-security", "dominates:safety"
      "work-market", "out-of-scope:authorization"
      "mutual-repair", "out-of-scope:liveness-precondition"
      "veridicality", "out-of-scope:independence-check"
      "diversity-coercive-step", "out-of-scope:model-not-mechanism"
      "condorcet-boundary", "out-of-scope:model-not-mechanism" ]

/// THE CROSS-ORACLE FIXTURE, regimes half. Also duplicated in the TypeScript twin.
let private expectedRegimeKeys: (string * string) list =
    [ "review-board@n=quorum", "mirror-mismatch:recall:safety"
      "work-market@k=1", "out-of-scope:authorization"
      "workflow-consensus@unanimous", "wrong-axis:accuracy:safety"
      "workflow-consensus@first-1-agree", "wrong-axis:accuracy:recall"
      "workflow-consensus@supermajority", "does-not-dominate:unstated" ]

[<Fact>]
let ``inventory has PR #10955's 21 sites, no more and no fewer`` () = Assert.Equal(21, List.length inventory)

[<Fact>]
let ``every inventory site classifies to its locked verdict`` () =
    let actual = inventory |> List.map (fun s -> s.Id, AR.verdictKey (AR.classify s.Purpose s.Rule))
    Assert.Equal<(string * string) list>(expectedInventoryKeys, actual)

[<Fact>]
let ``every configuration regime classifies to its locked verdict`` () =
    let actual = regimes |> List.map (fun s -> s.Id, AR.verdictKey (AR.classify s.Purpose s.Rule))
    Assert.Equal<(string * string) list>(expectedRegimeKeys, actual)

[<Fact>]
let ``the classification's bucket counts, and the one delta from PR #10955`` () =
    let count predicate =
        inventory |> List.filter (fun s -> predicate (AR.classify s.Purpose s.Rule)) |> List.length

    let dominates =
        count (function
            | AR.Dominates _ -> true
            | _ -> false)

    let reachableNotChosen =
        count (function
            | AR.DeferenceReachableNotChosen _ -> true
            | _ -> false)

    let doesNotDominate =
        count (function
            | AR.DoesNotDominate _ -> true
            | _ -> false)

    let outOfScope =
        count (function
            | AR.OutOfScope _ -> true
            | _ -> false)

    // #10955: 3 does-not-qualify, 2 weights-not-competence, 6 qualifies, 10 not-an-accuracy-aggregator.
    Assert.Equal(3, doesNotDominate)
    Assert.Equal(2, reachableNotChosen)
    // THE DELTA, and it is a promotion not a demotion: `change-control-security` is 3-of-3, i.e.
    // k = n, i.e. Veto, on a stated SAFETY objective — so it does not merely fall outside the
    // accuracy theorem, it DOMINATES on the safety axis. #10955 filed it under
    // "not-an-accuracy-aggregator" because it is not accuracy; the triangle in that same doc already
    // says veto dominates on safety, so this is the doc agreeing with itself more precisely.
    Assert.Equal(7, dominates)
    Assert.Equal(9, outOfScope)
    Assert.Equal(21, dominates + reachableNotChosen + doesNotDominate + outOfScope)

// ── §3 The falsifier the brief asked for: a wrong-direction pairing is DETECTABLE ─────────────

[<Fact>]
let ``a safety rule on a recall task is a mirror mismatch, not a pass`` () =
    Assert.Equal<AR.Verdict>(AR.MirrorMismatch(AR.OnRecall, AR.OnSafety), AR.classify AR.Recall AR.Veto)

[<Fact>]
let ``a recall rule on a safety task is a mirror mismatch, not a pass`` () =
    Assert.Equal<AR.Verdict>(AR.MirrorMismatch(AR.OnSafety, AR.OnRecall), AR.classify AR.Safety AR.Union)

[<Fact>]
let ``the negative controls: the right-direction pairings are NOT mismatches`` () =
    // Without these, a classifier that returned `MirrorMismatch` for everything would pass the two
    // tests above. This is the half that makes them a falsifier rather than a slogan.
    Assert.Equal<AR.Verdict>(AR.Dominates AR.OnRecall, AR.classify AR.Recall AR.Union)
    Assert.Equal<AR.Verdict>(AR.Dominates AR.OnSafety, AR.classify AR.Safety AR.Veto)
    Assert.Equal<AR.Verdict>(
        AR.Dominates AR.OnAccuracy,
        AR.classify AR.TwoSidedAccuracy (AR.Weighted AR.LogOddsCompetence)
    )

[<Fact>]
let ``a two-sided rule on a one-sided task is wrong-axis, which is a weaker finding than a mirror`` () =
    Assert.Equal<AR.Verdict>(
        AR.WrongAxis(AR.OnRecall, AR.OnAccuracy),
        AR.classify AR.Recall (AR.Weighted AR.LogOddsCompetence)
    )
    Assert.Equal<AR.Verdict>(AR.WrongAxis(AR.OnAccuracy, AR.OnRecall), AR.classify AR.TwoSidedAccuracy AR.Union)

// ── §4 The generator, and why the mirror sweep falls out of it for free ───────────────────────

[<Fact>]
let ``ofKOfN normalises: k=1 is Union, k=n is Veto, only the strict middle is a Threshold`` () =
    let why = unstated "witness"
    Assert.Equal<AR.Rule>(AR.Union, AR.ofKOfN 1 5 why)
    Assert.Equal<AR.Rule>(AR.Union, AR.ofKOfN 0 5 why)
    Assert.Equal<AR.Rule>(AR.Union, AR.ofKOfN -3 5 why)
    Assert.Equal<AR.Rule>(AR.Veto, AR.ofKOfN 5 5 why)
    Assert.Equal<AR.Rule>(AR.Veto, AR.ofKOfN 9 5 why)
    Assert.Equal<AR.Rule>(AR.Threshold(3, why), AR.ofKOfN 3 5 why)
    // n clamped to at least 1: a rule over no units is not a rule.
    Assert.Equal<AR.Rule>(AR.Union, AR.ofKOfN 1 0 why)

[<Fact>]
let ``a quorum equal to the roll size IS a veto, which is how the review board's mirror defect surfaces`` () =
    // Nobody has to notice the coincidence: k = n normalises, and the pairing then reports itself.
    let rule = AR.ofKOfN 3 3 (unstated "DEFAULT_REVIEW_QUORUM at the minimum convening size")
    Assert.Equal<AR.Rule>(AR.Veto, rule)
    Assert.Equal<AR.Verdict>(AR.MirrorMismatch(AR.OnRecall, AR.OnSafety), AR.classify AR.Recall rule)

[<Fact>]
let ``the strict middle dominates on nothing, for every k and every purpose`` () =
    // The property that makes recording an illustrative `k` for a data-dependent site harmless.
    for k in 2..12 do
        let rule = AR.Threshold(k, unstated "any k")
        Assert.Empty(AR.dominanceAxes rule)

        for purpose in [ AR.Recall; AR.Safety; AR.TwoSidedAccuracy ] do
            match AR.classify purpose rule with
            | AR.DoesNotDominate _ -> ()
            | other -> failwithf "k=%d %A classified as %A" k purpose other

// ── §5 BFT and the integrity detectors stay honest — expressible, not mislabelled ─────────────

[<Fact>]
let ``a Byzantine quorum is out of scope, never a defect`` () =
    let bft = AR.Threshold(3, AR.FaultTolerance 1)
    Assert.Equal<AR.Verdict>(AR.OutOfScope(AR.FaultTolerance 1), AR.classify (AR.NonAccuracy(AR.FaultTolerance 1)) bft)
    // And the point of the whole design: the SAME k, at a site claiming an accuracy objective, is a
    // finding. The rule shape did not change; the purpose did.
    match AR.classify AR.TwoSidedAccuracy bft with
    | AR.DoesNotDominate(AR.FaultTolerance _) -> ()
    | other -> failwithf "expected a finding for fault-tolerance-k on an accuracy objective, got %A" other

[<Fact>]
let ``a bare quorum cannot be laundered by borrowing a comfortable justification`` () =
    // A site that says it is a fault-tolerance mechanism but whose threshold names something else is
    // reported, not accepted. Without this, `NonAccuracy` would be a universal escape hatch.
    let laundered = AR.Threshold(3, unstated "nothing at the site says why")

    match AR.classify (AR.NonAccuracy(AR.FaultTolerance 1)) laundered with
    | AR.JustificationDisagreesWithPurpose _ -> ()
    | other -> failwithf "expected a disagreement, got %A" other

[<Fact>]
let ``a priced precision trade is expressible and is not the same verdict as an unpriced one`` () =
    let priced = AR.Threshold(3, AR.PricedPrecisionTrade "suppresses noisy-reviewer spam at a measured recall cost")
    let unpriced = AR.Threshold(3, unstated "nothing names the trade")
    // Both dominate on nothing — the theorem does not care about intentions. But the verdicts are
    // distinguishable, which is what lets a defensible quorum exist without being called a defect.
    Assert.NotEqual<AR.Verdict>(AR.classify AR.Recall priced, AR.classify AR.Recall unpriced)

// ── §6 Weight basis is what decides whether the lift actually holds ───────────────────────────

[<Fact>]
let ``deference reachable but not chosen is distinguished from deference achieved`` () =
    let achieved = [ AR.LogOddsCompetence; AR.EndogenousEvidence "likelihood ratio" ]
    let reachable = [ AR.ExperienceProxy "tenure"; AR.SelfAsserted "amplitude" ]

    for basis in achieved do
        Assert.Equal<AR.Verdict>(AR.Dominates AR.OnAccuracy, AR.classify AR.TwoSidedAccuracy (AR.Weighted basis))

    for basis in reachable do
        Assert.Equal<AR.Verdict>(
            AR.DeferenceReachableNotChosen basis,
            AR.classify AR.TwoSidedAccuracy (AR.Weighted basis)
        )

// ── §7 Composition — earned by exactly one site, and its law is checked ───────────────────────

[<Fact>]
let ``conjunction keeps safety, disjunction keeps recall, and neither manufactures accuracy`` () =
    let quorum = AR.Threshold(2, AR.Legitimacy)
    Assert.Equal<AR.Dominance list>([ AR.OnSafety ], AR.dominanceAxes (AR.AllOf [ AR.Veto; quorum ]))
    Assert.Equal<AR.Dominance list>([ AR.OnRecall ], AR.dominanceAxes (AR.AnyOf [ AR.Union; quorum ]))
    Assert.Empty(AR.dominanceAxes (AR.AllOf [ AR.Union; quorum ]))
    Assert.Empty(AR.dominanceAxes (AR.AnyOf [ AR.Veto; quorum ]))
    Assert.Empty(AR.dominanceAxes (AR.AllOf [ AR.Weighted AR.LogOddsCompetence; quorum ]))
    // An empty composite is not a rule and must not read as accept-always / reject-always.
    Assert.Empty(AR.dominanceAxes (AR.AllOf []))
    Assert.Empty(AR.dominanceAxes (AR.AnyOf []))
    Assert.True((AR.toBooleanRule (AR.AllOf [])).IsNone)
    Assert.True((AR.toBooleanRule (AR.AnyOf [])).IsNone)

// ── §8 The boolean semantics agree with the k-of-n counting they claim to be ──────────────────

[<Fact>]
let ``Union, Veto and Threshold agree with counting, over every 4-vote input`` () =
    let inputs =
        [ for a in [ false; true ] do
              for b in [ false; true ] do
                  for c in [ false; true ] do
                      for d in [ false; true ] -> [ a; b; c; d ] ]

    let apply rule votes =
        match AR.toBooleanRule rule with
        | Some f -> f votes
        | None -> failwithf "%A has no boolean reading" rule

    for votes in inputs do
        let yes = votes |> List.filter id |> List.length
        Assert.Equal<bool>(yes >= 1, apply AR.Union votes)
        Assert.Equal<bool>(yes >= 4, apply AR.Veto votes)
        Assert.Equal<bool>(yes >= 3, apply (AR.Threshold(3, unstated "count")) votes)

// ── §9 The connection to `Levels.Aggregation.canImitateEveryProjection`, and its honest limit ──

let private boolEq (a: bool) (b: bool) = a = b

let private ruleAsFunction (rule: AR.Rule) =
    match AR.toBooleanRule rule with
    | Some f -> f
    | None -> failwithf "%A has no boolean reading" rule

[<Fact>]
let ``Union and Veto discharge the witness check with witnesses derived from the rule itself`` () =
    for rule in [ AR.Union; AR.Veto ] do
        match AR.imitationWitnesses 4 rule with
        | None -> failwithf "%A should derive its own witnesses" rule
        | Some witnesses ->
            Assert.True(
                Levels.Aggregation.canImitateEveryProjection boolEq (ruleAsFunction rule) id witnesses,
                sprintf "%A failed its own derived witnesses" rule
            )

[<Fact>]
let ``THE COUNTEREXAMPLE: unweighted 2-of-3 also discharges the witness check`` () =
    // This is why this module is not redundant with `canImitateEveryProjection`. That predicate asks
    // for pointwise agreement on ONE caller-chosen input per index, which is far weaker than "the
    // projection lies in the rule class" — and unweighted majority, the canonical NON-deferential
    // rule, passes it with cherry-picked witnesses.
    //
    // The helper's own docstring already forbids reading a discharge as a dominance result. This test
    // pins WHY that caveat is load-bearing rather than decorative, and locks the counterexample so a
    // future strengthening of the helper has something to be measured against.
    let majority2of3 = AR.Threshold(2, unstated "the canonical non-deferential rule")

    let cherryPicked =
        [ [ true; true; false ]; [ false; true; true ]; [ false; true; true ] ]

    Assert.True(
        Levels.Aggregation.canImitateEveryProjection boolEq (ruleAsFunction majority2of3) id cherryPicked,
        "the witness check was expected to be discharged here; if it no longer is, the helper was strengthened"
    )
    // And the structural verdict, which is the one that discriminates, says the opposite.
    Assert.Empty(AR.dominanceAxes majority2of3)

    match AR.classify AR.TwoSidedAccuracy majority2of3 with
    | AR.DoesNotDominate _ -> ()
    | other -> failwithf "expected a finding, got %A" other

// ── §10 Exhaustiveness — every case is used by a site or is DECLARED unpopulated ───────────────
//
// The point of this section: a taxonomy with a case nobody uses is either dead weight or a claim
// nobody checked. Adding a case to any DU below breaks compilation here (the hand-written matches
// are exhaustive) AND fails the reflection assertion unless the case is either exercised by the
// inventory or explicitly listed as unpopulated with a reason.

let private declaredCases (t: System.Type) =
    FSharpType.GetUnionCases t |> Array.map (fun c -> c.Name) |> Set.ofArray

let rec private ruleCases (rule: AR.Rule) : string list =
    match rule with
    | AR.Union -> [ "Union" ]
    | AR.Veto -> [ "Veto" ]
    | AR.Weighted _ -> [ "Weighted" ]
    | AR.Threshold _ -> [ "Threshold" ]
    | AR.Plurality _ -> [ "Plurality" ]
    | AR.AllOf rules -> "AllOf" :: (rules |> List.collect ruleCases)
    | AR.AnyOf rules -> "AnyOf" :: (rules |> List.collect ruleCases)

let private justificationCase (j: AR.Justification) =
    match j with
    | AR.FaultTolerance _ -> "FaultTolerance"
    | AR.IntegrityCheck -> "IntegrityCheck"
    | AR.IndependenceCheck -> "IndependenceCheck"
    | AR.Legitimacy -> "Legitimacy"
    | AR.Authorization -> "Authorization"
    | AR.LivenessPrecondition -> "LivenessPrecondition"
    | AR.ModelNotMechanism -> "ModelNotMechanism"
    | AR.PricedPrecisionTrade _ -> "PricedPrecisionTrade"
    | AR.Unstated _ -> "Unstated"

let private weightBasisCase (b: AR.WeightBasis) =
    match b with
    | AR.LogOddsCompetence -> "LogOddsCompetence"
    | AR.EndogenousEvidence _ -> "EndogenousEvidence"
    | AR.ExperienceProxy _ -> "ExperienceProxy"
    | AR.SelfAsserted _ -> "SelfAsserted"

let private purposeCase (p: AR.Purpose) =
    match p with
    | AR.Recall -> "Recall"
    | AR.Safety -> "Safety"
    | AR.TwoSidedAccuracy -> "TwoSidedAccuracy"
    | AR.NonAccuracy _ -> "NonAccuracy"

let private verdictCase (v: AR.Verdict) =
    match v with
    | AR.Dominates _ -> "Dominates"
    | AR.MirrorMismatch _ -> "MirrorMismatch"
    | AR.WrongAxis _ -> "WrongAxis"
    | AR.DeferenceReachableNotChosen _ -> "DeferenceReachableNotChosen"
    | AR.DoesNotDominate _ -> "DoesNotDominate"
    | AR.OutOfScope _ -> "OutOfScope"
    | AR.JustificationDisagreesWithPurpose _ -> "JustificationDisagreesWithPurpose"

let private allRows = inventory @ regimes

let private assertExhaustive (label: string) (declared: Set<string>) (used: Set<string>) (unpopulated: Set<string>) =
    let unknown = Set.difference unpopulated declared
    Assert.True(Set.isEmpty unknown, sprintf "%s: declared-unpopulated names no such case: %A" label unknown)
    let stale = Set.intersect used unpopulated
    Assert.True(Set.isEmpty stale, sprintf "%s: listed as unpopulated but actually used: %A" label stale)
    let missing = Set.difference declared (Set.union used unpopulated)
    Assert.True(Set.isEmpty missing, sprintf "%s: case neither used nor declared unpopulated: %A" label missing)

[<Fact>]
let ``every Rule case is exercised by a site or declared unpopulated`` () =
    let used = allRows |> List.collect (fun s -> ruleCases s.Rule) |> Set.ofList

    // `AnyOf` ships because its dominance law is the exact dual of `AllOf`'s and stating one half of a
    // lattice would misrepresent the algebra. No site in the repo composes disjunctively today. This
    // is a register label, not a hidden mechanism — if a site ever appears, delete this line.
    assertExhaustive "Rule" (declaredCases typeof<AR.Rule>) used (Set.ofList [ "AnyOf" ])

[<Fact>]
let ``every Justification case is exercised by a site or declared unpopulated`` () =
    let used =
        allRows
        |> List.collect (fun s ->
            let fromRule = AR.justificationsIn s.Rule |> List.map justificationCase

            let fromPurpose =
                match s.Purpose with
                | AR.NonAccuracy j -> [ justificationCase j ]
                | AR.Recall
                | AR.Safety
                | AR.TwoSidedAccuracy -> []

            fromRule @ fromPurpose)
        |> Set.ofList

    // `PricedPrecisionTrade` is the defence a quorum gate is ENTITLED to make: a deliberate,
    // priced precision-over-recall trade. PR #10955 looked for one at the review board and did not
    // find it. The case exists so that a legitimate quorum can be expressed WITHOUT being mislabelled
    // a defect — a taxonomy that cannot say "justified" turns every threshold into a finding, which
    // would make the finding worthless.
    assertExhaustive "Justification" (declaredCases typeof<AR.Justification>) used (Set.ofList [ "PricedPrecisionTrade" ])

[<Fact>]
let ``every WeightBasis case is exercised by a site or declared unpopulated`` () =
    let used =
        allRows
        |> List.choose (fun s ->
            match s.Rule with
            | AR.Weighted basis -> Some(weightBasisCase basis)
            | _ -> None)
        |> Set.ofList

    // THE FINDING IN THIS LINE: no site in this repo weights by a MEASURED competence. That is not an
    // oversight in the taxonomy, it is #10955's central recommendation restated as a type — the
    // log-odds route needs per-agent competence estimates and nobody has banked one, so the available
    // dominating rules today are the free ones (union, veto), not the weighted one.
    assertExhaustive "WeightBasis" (declaredCases typeof<AR.WeightBasis>) used (Set.ofList [ "LogOddsCompetence" ])

[<Fact>]
let ``every Purpose case is exercised by a site`` () =
    let used = allRows |> List.map (fun s -> purposeCase s.Purpose) |> Set.ofList
    assertExhaustive "Purpose" (declaredCases typeof<AR.Purpose>) used Set.empty

[<Fact>]
let ``every Verdict case is reached by a site or declared unreached`` () =
    let used =
        allRows |> List.map (fun s -> verdictCase (AR.classify s.Purpose s.Rule)) |> Set.ofList

    // `JustificationDisagreesWithPurpose` is a GUARD, not a classification: it fires only when a site
    // labels its threshold with a purpose the site does not claim. No site does that today, and that
    // is the good outcome. Its falsifier is `a bare quorum cannot be laundered…` above, which
    // constructs the disagreement deliberately.
    assertExhaustive
        "Verdict"
        (declaredCases typeof<AR.Verdict>)
        used
        (Set.ofList [ "JustificationDisagreesWithPurpose" ])
