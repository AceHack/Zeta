namespace Zeta.Tests

open System
open System.Globalization
open Xunit
open Zeta.Core

// ── DeclaredStanceLedger falsifiers ───────────────────────────────────────────────────────────────
//
// Work-item 081M0X49HBD087G0R001HM9VHF. Each test is written so that a stubbed or
// convenient implementation FAILS it; mutation results are recorded in the PR body.
//
// THE LINE (outcome record, never inner state)
//   DSL-1   declare refuses an observer attributing a stance to a counterparty
//   DSL-2   declare accepts a self-declaration
//   DSL-3   the subject check is ORDINAL: "Aaron" vs "aaron" is an observer attribution
//   DSL-4   a declaration at the same logical phase as the result is refused (boundary)
//   DSL-5   a declaration after the result is refused (an excuse, not a disclosure)
//   DSL-6   empty subject / empty domain refused
//   DSL-37  no hidden clock: two identical declare calls produce equal values
//
// THE RECIPROCAL OBLIGATION
//   DSL-7   openExchange refuses a domain mismatch
//   DSL-8   openExchange refuses a self-exchange (no self-manufactured confirmation)
//   DSL-9   a two-sided exchange opens
//
// THE OUTCOME RECORD
//   DSL-10  a fresh cell's holdRate is 0.5 (honest prior, not 0)
//   DSL-11  a held-up claim raises the cell's holdRate
//   DSL-12  a failed claim lowers it
//   DSL-13  stance isolation: outcomes under Eager do not move the Neutral cell
//   DSL-14  domain isolation
//   DSL-15  party isolation
//   DSL-16  obsCount counts resolutions
//   DSL-17  beneficiaryProfile counts allocations
//   DSL-20  idempotency (#6): the same claimId twice == once
//
// DECLARATION x POSTERIOR
//   DSL-21  below the evidence floor: InsufficientEvidence, never a manufactured number
//   DSL-22  separated cells: DeclarationDiscriminates
//   DSL-23  identical cells: DeclarationCarriesNoInformation
//   DSL-29  discriminating history puts the receiver on the declared cell
//   DSL-30  non-discriminating history pools, and the declaration STILL chose the cell
//
// COUNTERPARTY USE
//   DSL-24  EAGER IS NOT A DISCOUNT: identical records under Eager / Neutral weigh identically
//   DSL-25  Kish design effect: 5 supports from ONE source at rho=1 -> 1.0 effective
//   DSL-26  rho=0 -> n_eff = n (the control: the discount is not unconditional)
//   DSL-27  2 distinct sources at rho=1 -> 2.0, and no further confirmation required
//   DSL-28  one source with 5 supports STILL requires an independent confirmation
//
// THE TAILS (declined, and the decline is enforced)
//   DSL-31  weigh is invariant to Beneficiary — fails if a selfishness penalty is wired in
//
// THE OBSERVABLE SIGNATURE OF EARLY CONVERGENCE
//   DSL-32  below the history floor: InsufficientHistory, not a manufactured trend
//   DSL-33  improving history -> MarginalYieldRising
//   DSL-34  flat history -> MarginalYieldFlat
//   DSL-35  declining history -> MarginalYieldFalling
//
// DST
//   DSL-36  the same resolution sequence replays to the same ledger
//
// CHECK-ARITY ADJUDICATION (registry/check-arity-census.json, this file = 2)
//   `audit-check-arity.ts` R2 flags DSL-36 and DSL-37 as self-comparisons: after binding
//   substitution both sides normalize to one expression. That is CORRECT here and not
//   vacuous — both are DETERMINISM checks, and a determinism check has no other shape:
//   it asserts that constructing the same thing twice yields equal values, which is
//   exactly what fails when an ambient source is captured. Mutation M4 (an incrementing
//   ambient counter folded into the value) kills DSL-37, so the check demonstrably
//   discriminates. Census raised 0 -> 2 in the same commit, per R2.

module D = Zeta.Core.DeclaredStanceLedger

module DeclaredStanceLedgerTests =

    let private ok (r: Result<'a, 'e>) : 'a =
        match r with
        | Ok v -> v
        | Error e -> failwithf "expected success, got %A" e

    let private inv (fmt: string) ([<ParamArray>] args: obj[]) : string =
        String.Format(CultureInfo.InvariantCulture, fmt, args)

    /// A valid self-declaration at logical phase 1, result at phase 2.
    let private decl (party: string) (domain: string) (stance: D.Stance) : D.Declaration =
        D.declare party party domain stance 1L 2L "stake" |> ok

    /// A two-sided exchange in which `party` is the claimant.
    let private exch (party: string) (domain: string) (stance: D.Stance) : D.Exchange =
        D.openExchange (decl party domain stance) (decl "receiver" domain D.Neutral) |> ok

    let private held = D.resolution true D.AccruedToBoth
    let private missed = D.resolution false D.AccruedToBoth

    /// Fold `n` copies of `res` into `ledger` for `party` under `stance`.
    let private recordN n res (party: string) (domain: string) (stance: D.Stance) (ledger: D.Ledger) =
        let e = exch party domain stance
        [ 1..n ]
        |> List.fold (fun acc i -> D.record (inv "{0}-{1}-{2}" [| party; box stance; box i |]) e res acc) ledger

    /// Fold an explicit outcome sequence (oldest first) into `ledger`.
    let private recordSeq (outcomes: bool list) (party: string) (stance: D.Stance) (ledger: D.Ledger) =
        let e = exch party "bridge" stance
        outcomes
        |> List.indexed
        |> List.fold
            (fun acc (i, hit) ->
                D.record (inv "{0}-{1}" [| party; box i |]) e (D.resolution hit D.AccruedToBoth) acc)
            ledger

    // ── DSL-1: an observer may not attribute a stance ─────────────────────────────────────────────
    [<Fact>]
    let ``DSL-1 declare refuses an observer attributing a stance to a counterparty`` () =
        match D.declare "aaron" "otto" "bridge" D.Eager 1L 2L "otto thinks aaron is keen" with
        | Error(D.ObserverAttributedStance("aaron", "otto")) -> ()
        | other -> failwithf "expected an observer-attribution refusal, got %A" other

    // ── DSL-2: a self-declaration is accepted ─────────────────────────────────────────────────────
    [<Fact>]
    let ``DSL-2 declare accepts a self-declaration`` () =
        match D.declare "aaron" "aaron" "bridge" D.Eager 1L 2L "wants the bridge to exist" with
        | Ok d ->
            Assert.Equal(D.Eager, d.Stance)
            Assert.Equal<string>("aaron", d.Subject)
        | Error e -> failwithf "expected success, got %A" e

    // ── DSL-3: the subject check is ORDINAL, not culture-folded ───────────────────────────────────
    [<Fact>]
    let ``DSL-3 the subject check is ordinal so a case difference is observer attribution`` () =
        // Control: the exact string succeeds (DSL-2). This differs only in case, so a
        // culture-insensitive or case-folding comparison would let an observer declare
        // on a subject's behalf.
        match D.declare "Aaron" "aaron" "bridge" D.Eager 1L 2L "case-folded impostor" with
        | Error(D.ObserverAttributedStance _) -> ()
        | other -> failwithf "expected an observer-attribution refusal under ordinal comparison, got %A" other

    // ── DSL-4: at the result phase is already too late (boundary) ─────────────────────────────────
    [<Fact>]
    let ``DSL-4 a declaration at the same logical phase as the result is refused`` () =
        match D.declare "aaron" "aaron" "bridge" D.Eager 2L 2L "simultaneous" with
        | Error(D.DeclaredAfterResult(2L, 2L)) -> ()
        | other -> failwithf "expected a timing refusal, got %A" other

    // ── DSL-5: after the result it is an excuse, not a disclosure ─────────────────────────────────
    [<Fact>]
    let ``DSL-5 a declaration after the result is refused`` () =
        match D.declare "aaron" "aaron" "bridge" D.Eager 9L 2L "i was biased all along" with
        | Error(D.DeclaredAfterResult(9L, 2L)) -> ()
        | other -> failwithf "expected a timing refusal, got %A" other

    // ── DSL-6: an unusable cell key is refused ────────────────────────────────────────────────────
    [<Fact>]
    let ``DSL-6 an empty subject or domain is refused`` () =
        match D.declare "" "" "bridge" D.Eager 1L 2L "" with
        | Error(D.EmptyIdentifier "subject") -> ()
        | other -> failwithf "expected an empty-subject refusal, got %A" other

        match D.declare "aaron" "aaron" "  " D.Eager 1L 2L "" with
        | Error(D.EmptyIdentifier "domain") -> ()
        | other -> failwithf "expected an empty-domain refusal, got %A" other

    // ── DSL-37: no hidden wall clock ──────────────────────────────────────────────────────────────
    [<Fact>]
    let ``DSL-37 two identical declare calls produce equal values (no ambient clock captured)`` () =
        // If the implementation captured DateTime.UtcNow, these two would differ. Logical
        // phase ordinals are the only time in the type — local time never enters the fold.
        let a = D.declare "aaron" "aaron" "bridge" D.Eager 1L 2L "s" |> ok
        let b = D.declare "aaron" "aaron" "bridge" D.Eager 1L 2L "s" |> ok
        Assert.Equal(a, b)

    // ── DSL-7 / DSL-8 / DSL-9: the reciprocal obligation ──────────────────────────────────────────
    [<Fact>]
    let ``DSL-7 openExchange refuses a domain mismatch`` () =
        match D.openExchange (decl "aaron" "bridge" D.Eager) (decl "otto" "weather" D.Neutral) with
        | Error(D.DomainMismatch("bridge", "weather")) -> ()
        | other -> failwithf "expected a domain-mismatch refusal, got %A" other

    [<Fact>]
    let ``DSL-8 openExchange refuses an exchange a party holds with itself`` () =
        match D.openExchange (decl "aaron" "bridge" D.Eager) (decl "aaron" "bridge" D.Neutral) with
        | Error(D.SelfExchange "aaron") -> ()
        | other -> failwithf "expected a self-exchange refusal, got %A" other

    [<Fact>]
    let ``DSL-9 a two-sided exchange opens and carries both declarations`` () =
        let e = D.openExchange (decl "aaron" "bridge" D.Eager) (decl "otto" "bridge" D.Averse) |> ok
        Assert.Equal(D.Eager, e.ClaimantDeclaration.Stance)
        Assert.Equal(D.Averse, e.ReceiverDeclaration.Stance)

    // ── DSL-10..12: the posterior moves with outcomes ─────────────────────────────────────────────
    [<Fact>]
    let ``DSL-10 a fresh cell holds the honest prior 0.5`` () =
        Assert.InRange(D.holdRate "nobody" "bridge" D.Eager D.empty, 0.4999, 0.5001)

    [<Fact>]
    let ``DSL-11 a held-up claim raises the cell hold rate above the honest prior`` () =
        let l = D.empty |> recordN 3 held "aaron" "bridge" D.Eager
        Assert.True(D.holdRate "aaron" "bridge" D.Eager l > 0.5)

    [<Fact>]
    let ``DSL-12 a failed claim lowers the cell hold rate below the honest prior`` () =
        let l = D.empty |> recordN 3 missed "aaron" "bridge" D.Eager
        Assert.True(D.holdRate "aaron" "bridge" D.Eager l < 0.5)

    // ── DSL-13..16: isolation ─────────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``DSL-13 outcomes filed under Eager do not move the Neutral cell`` () =
        let l = D.empty |> recordN 5 held "aaron" "bridge" D.Eager
        Assert.InRange(D.holdRate "aaron" "bridge" D.Neutral l, 0.4999, 0.5001)
        Assert.True(D.holdRate "aaron" "bridge" D.Eager l > 0.5)

    [<Fact>]
    let ``DSL-14 domains are isolated`` () =
        let l = D.empty |> recordN 5 held "aaron" "bridge" D.Eager
        Assert.InRange(D.holdRate "aaron" "weather" D.Eager l, 0.4999, 0.5001)

    [<Fact>]
    let ``DSL-15 parties are isolated`` () =
        let l = D.empty |> recordN 5 held "aaron" "bridge" D.Eager
        Assert.InRange(D.holdRate "otto" "bridge" D.Eager l, 0.4999, 0.5001)

    [<Fact>]
    let ``DSL-16 obsCount counts resolutions in the cell`` () =
        let l = D.empty |> recordN 4 held "aaron" "bridge" D.Eager
        Assert.Equal(4, D.obsCount "aaron" "bridge" D.Eager l)
        Assert.Equal(0, D.obsCount "aaron" "bridge" D.Neutral l)

    // ── DSL-17: the allocation record is kept raw ─────────────────────────────────────────────────
    [<Fact>]
    let ``DSL-17 beneficiaryProfile reports raw allocation counts`` () =
        let e = exch "aaron" "bridge" D.Eager
        let l =
            D.empty
            |> D.record "c1" e (D.resolution true D.AccruedToClaimant)
            |> D.record "c2" e (D.resolution true D.AccruedToOthers)
            |> D.record "c3" e (D.resolution true D.AccruedToOthers)
            |> D.record "c4" e (D.resolution false D.AccruedToBoth)
        Assert.Equal((1, 1, 2), D.beneficiaryProfile "aaron" "bridge" D.Eager l)

    // ── DSL-20: idempotency (#6) ──────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``DSL-20 folding the same claim id twice equals folding it once`` () =
        let e = exch "aaron" "bridge" D.Eager
        let once = D.empty |> D.record "claim-1" e held
        let twice = once |> D.record "claim-1" e held
        Assert.True((once.Cells = twice.Cells))
        Assert.Equal(1, D.obsCount "aaron" "bridge" D.Eager twice)
        // Control: a DIFFERENT claim id does fold in, so the guard is a dedup key and not
        // a blanket refusal to accept anything after the first.
        let more = twice |> D.record "claim-2" e held
        Assert.Equal(2, D.obsCount "aaron" "bridge" D.Eager more)

    // ── DSL-21..23: does the declaration discriminate, for THIS party? ────────────────────────────
    [<Fact>]
    let ``DSL-21 below the evidence floor informativeness refuses to produce a number`` () =
        let l =
            D.empty
            |> recordN 4 held "aaron" "bridge" D.Eager
            |> recordN 4 missed "aaron" "bridge" D.Neutral

        match D.informativeness "aaron" "bridge" l with
        | D.InsufficientEvidence 0 -> ()
        | other -> failwithf "expected an insufficient-evidence refusal, got %A" other

    [<Fact>]
    let ``DSL-22 separated cells report that the declaration discriminates`` () =
        let l =
            D.empty
            |> recordN 5 missed "aaron" "bridge" D.Eager
            |> recordN 5 held "aaron" "bridge" D.Neutral

        match D.informativeness "aaron" "bridge" l with
        | D.DeclarationDiscriminates sep -> Assert.True(sep > D.SEPARATION_EPS)
        | other -> failwithf "expected a discriminating verdict, got %A" other

    [<Fact>]
    let ``DSL-23 identical cells report that the declaration carries no information`` () =
        // A party declaring Neutral whose neutral-declared claims resolve exactly like its
        // eager-declared ones. The record is evidence; it does NOT relabel the party.
        let l =
            D.empty
            |> recordN 5 held "aaron" "bridge" D.Eager
            |> recordN 5 held "aaron" "bridge" D.Neutral

        match D.informativeness "aaron" "bridge" l with
        | D.DeclarationCarriesNoInformation sep -> Assert.True(sep < D.SEPARATION_EPS)
        | other -> failwithf "expected a no-information verdict, got %A" other

    // ── DSL-29 / DSL-30: which prior the receiver ends up on ──────────────────────────────────────
    [<Fact>]
    let ``DSL-29 a discriminating history puts the receiver on the declared cell`` () =
        let l =
            D.empty
            |> recordN 5 missed "aaron" "bridge" D.Eager
            |> recordN 5 held "aaron" "bridge" D.Neutral

        let w = D.weighConservatively [ "aaron" ] (exch "aaron" "bridge" D.Eager) l
        Assert.Equal(D.DeclaredCell D.Eager, w.PriorBasis)
        Assert.True(w.PriorHoldRate < 0.5)

    [<Fact>]
    let ``DSL-30 a non-discriminating history pools, and the declaration still chose the cell`` () =
        let l =
            D.empty
            |> recordN 5 held "aaron" "bridge" D.Eager
            |> recordN 5 held "aaron" "bridge" D.Neutral

        let w = D.weighConservatively [ "aaron" ] (exch "aaron" "bridge" D.Neutral) l
        Assert.Equal(D.PooledAcrossStances, w.PriorBasis)
        // Pooling uses all ten outcomes, so it is sharper than either five-outcome cell.
        Assert.True(w.PriorHoldRate > D.holdRate "aaron" "bridge" D.Neutral l)
        // AND the party was NOT relabelled: its Neutral-declared claims are still filed
        // under Neutral. A design that reassigned the cell would show 0 here.
        Assert.Equal(5, D.obsCount "aaron" "bridge" D.Neutral l)

    // ── DSL-24: EAGER IS NOT A DISCOUNT ───────────────────────────────────────────────────────────
    [<Fact>]
    let ``DSL-24 identical records declared Eager and Neutral weigh identically`` () =
        // Two parties with identical outcome records, differing only in the stance they
        // declared. Any stance-conditional penalty makes declaring Eager costly, which
        // would kill the primitive. This test fails the moment one is wired in.
        //
        // The corroborations come from TWO DISTINCT sources on purpose. With only
        // self-corroboration the requirement is already true for both parties, and a
        // stance penalty is masked rather than caught — which is exactly what happened on
        // the first mutation pass: M9 survived this test and was killed only by DSL-27
        // until the sources here were made independent.
        let lEager = D.empty |> recordN 5 held "eagerparty" "bridge" D.Eager
        let lNeutral = D.empty |> recordN 5 held "neutralparty" "bridge" D.Neutral

        let wEager =
            D.weighConservatively [ "eagerparty"; "witness" ] (exch "eagerparty" "bridge" D.Eager) lEager

        let wNeutral =
            D.weighConservatively [ "neutralparty"; "witness" ] (exch "neutralparty" "bridge" D.Neutral) lNeutral

        // The control: absent a penalty both are already satisfied, so a penalty on either
        // side is observable rather than hidden behind an already-true requirement.
        Assert.False(wEager.RequiresIndependentConfirmation)
        Assert.Equal(wEager.PriorHoldRate, wNeutral.PriorHoldRate, 12)
        Assert.Equal(wEager.EffectiveCorroborations, wNeutral.EffectiveCorroborations, 12)
        Assert.Equal(wEager.RequiresIndependentConfirmation, wNeutral.RequiresIndependentConfirmation)

    // ── DSL-25..28: the Kish design effect, operationalised ───────────────────────────────────────
    [<Fact>]
    let ``DSL-25 five supports from one source at rho=1 are one effective corroboration`` () =
        // "An eager party producing five supporting arguments has produced approximately
        // one" — Kish (1965) deff; n_eff = n / (1 + (n-1)*rho) is exactly 1 at rho = 1.
        let eff = D.effectiveCorroborations 1.0 [ "aaron"; "aaron"; "aaron"; "aaron"; "aaron" ]
        Assert.Equal(1.0, eff, 12)

    [<Fact>]
    let ``DSL-26 at rho=0 five supports are five (the discount is not unconditional)`` () =
        let eff = D.effectiveCorroborations 0.0 [ "aaron"; "aaron"; "aaron"; "aaron"; "aaron" ]
        Assert.Equal(5.0, eff, 12)
        // And the intermediate case lies strictly between, so this is a formula and not a switch.
        let mid = D.effectiveCorroborations 0.5 [ "aaron"; "aaron"; "aaron"; "aaron"; "aaron" ]
        Assert.True(mid > 1.0 && mid < 5.0)

    [<Fact>]
    let ``DSL-27 two distinct sources give two effective corroborations and satisfy the receiver`` () =
        let w = D.weighConservatively [ "aaron"; "otto" ] (exch "aaron" "bridge" D.Eager) D.empty
        Assert.Equal(2.0, w.EffectiveCorroborations, 12)
        Assert.False(w.RequiresIndependentConfirmation)

    [<Fact>]
    let ``DSL-28 one source with five supports still requires an independent confirmation`` () =
        let sources = List.replicate 5 "aaron"
        let w = D.weighConservatively sources (exch "aaron" "bridge" D.Eager) D.empty
        Assert.Equal(1.0, w.EffectiveCorroborations, 12)
        Assert.True(w.RequiresIndependentConfirmation)

    // ── DSL-31: the tails are DECLINED, and the decline is enforced ───────────────────────────────
    [<Fact>]
    let ``DSL-31 weigh is invariant to who the resolved claims benefited`` () =
        // "mostly selfish but not always in the extremes" is recorded as an observable
        // allocation and is NOT read into any weighting. A monotone eager-implies-selfish
        // penalty — the shape Aaron's own statement contradicts — fails this test.
        let e = exch "aaron" "bridge" D.Eager

        let build (b: D.Beneficiary) (tag: string) =
            [ 1..6 ]
            |> List.fold
                (fun acc i -> D.record (inv "{0}{1}" [| tag; box i |]) e (D.resolution true b) acc)
                D.empty

        let selfServing = build D.AccruedToClaimant "s"
        let selfSacrificing = build D.AccruedToOthers "o"

        let a = D.weighConservatively [ "aaron"; "otto" ] e selfServing
        let b = D.weighConservatively [ "aaron"; "otto" ] e selfSacrificing

        Assert.Equal(a.PriorHoldRate, b.PriorHoldRate, 12)
        Assert.Equal(a.PriorBasis, b.PriorBasis)
        Assert.Equal(a.RequiresIndependentConfirmation, b.RequiresIndependentConfirmation)

        // Control: the allocation WAS recorded, so the invariance is a design choice and
        // not an accident of the data never reaching the ledger.
        Assert.Equal((6, 0, 0), D.beneficiaryProfile "aaron" "bridge" D.Eager selfServing)
        Assert.Equal((0, 0, 6), D.beneficiaryProfile "aaron" "bridge" D.Eager selfSacrificing)

    // ── DSL-32..35: the observable signature of early convergence ─────────────────────────────────
    [<Fact>]
    let ``DSL-32 a short history yields InsufficientHistory, not a manufactured trend`` () =
        let l = D.empty |> recordSeq [ true; false; true ] "aaron" D.Eager
        match D.searchProfile "aaron" "bridge" D.Eager l with
        | D.InsufficientHistory(3, 6) -> ()
        | other -> failwithf "expected an insufficient-history refusal, got %A" other

    [<Fact>]
    let ``DSL-33 an improving history reports rising marginal yield`` () =
        let l = D.empty |> recordSeq [ false; false; false; true; true; true ] "aaron" D.Eager
        match D.searchProfile "aaron" "bridge" D.Eager l with
        | D.MarginalYieldRising d -> Assert.True(d > 0.0)
        | other -> failwithf "expected rising marginal yield, got %A" other

    [<Fact>]
    let ``DSL-34 a flat history reports flat marginal yield`` () =
        // Consistent with early convergence — and equally consistent with a party that was
        // right from the start. The type names the fact, never the reading.
        let l = D.empty |> recordSeq [ true; true; true; true; true; true ] "aaron" D.Eager
        match D.searchProfile "aaron" "bridge" D.Eager l with
        | D.MarginalYieldFlat d -> Assert.Equal(0.0, d, 12)
        | other -> failwithf "expected flat marginal yield, got %A" other

    [<Fact>]
    let ``DSL-35 a declining history reports falling marginal yield`` () =
        let l = D.empty |> recordSeq [ true; true; true; false; false; false ] "aaron" D.Eager
        match D.searchProfile "aaron" "bridge" D.Eager l with
        | D.MarginalYieldFalling d -> Assert.True(d < 0.0)
        | other -> failwithf "expected falling marginal yield, got %A" other

    // ── DSL-36: DST replay ────────────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``DSL-36 the same resolution sequence replays to the same ledger`` () =
        let outcomes = [ true; false; true; true; false; true; false ]
        let a = D.empty |> recordSeq outcomes "aaron" D.Eager
        let b = D.empty |> recordSeq outcomes "aaron" D.Eager
        Assert.True((a.Cells = b.Cells))
        Assert.Equal(D.pooledHoldRate "aaron" "bridge" a, D.pooledHoldRate "aaron" "bridge" b, 12)
