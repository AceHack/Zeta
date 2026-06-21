module Zeta.Tests.PolicyKindTests

open global.Xunit
open FsUnit.Xunit
open Zeta.Core
open Zeta.Core.PolicyKind

// 081KT7YW00008QG0R003N6PF8A #6 — typed policy kinds + validator-obligation compiled into the type.
// The keystone: a policy cannot go ACTIVE without a sign-off from its kind's REQUIRED
// validator. `Active` is private (only `activate` builds it), so "active-without-the-
// right-sign-off" is unreachable by construction. These tests pin the routing table,
// the activation gate (right validator succeeds; wrong fails), and that the obligation
// cannot be bypassed.

// a trivial decision policy for the tests (decision + feedback)
let private yesNo : Policy.Policy<int, bool, string> =
    Policy.ofPredicate (fun n -> n > 0) (true, "positive") (false, "non-positive")

[<Fact>]
let ``required-validator routing table (the router, total)`` () =
    requiredValidator Technical |> should equal Proof
    requiredValidator Legal |> should equal Counsel
    requiredValidator Governance |> should equal HumanReview

[<Fact>]
let ``activate with the matching validator succeeds and preserves kind + signoff`` () =
    let cases =
        [ Technical, { By = Proof; Evidence = "tests-green#123" }
          Legal, { By = Counsel; Evidence = "counsel-ref-A" }
          Governance, { By = HumanReview; Evidence = "review-record-7" } ]
    for kind, signoff in cases do
        match activate signoff (draft kind yesNo) with
        | Ok active ->
            kindOf active |> should equal kind
            signoffOf active |> should equal signoff
            // the active policy still decides (select-not-mutate)
            (decide 5 active).Decision |> should equal true
            (decide -1 active).Decision |> should equal false
        | Error e -> failwithf "expected activation for %A, got %A" kind e

[<Fact>]
let ``activate with the WRONG validator is rejected for every kind (obligation cannot be bypassed)`` () =
    // every (kind, validator) pair where the validator is NOT the required one must fail
    let allValidators = [ Proof; Counsel; HumanReview ]
    for kind in [ Technical; Legal; Governance ] do
        let required = requiredValidator kind
        for v in allValidators do
            if v <> required then
                match activate { By = v; Evidence = "x" } (draft kind yesNo) with
                | Error (WrongValidator(req, provided)) ->
                    req |> should equal required
                    provided |> should equal v
                | Ok _ -> failwithf "kind %A must NOT activate with validator %A" kind v

[<Fact>]
let ``a Governance policy cannot be activated by Proof (the proof-rigor-halo failure, blocked)`` () =
    // Kestrel's exact failure mode: a values/governance policy feeling settled because a
    // technical (Proof) layer signed it. The type refuses it.
    match activate { By = Proof; Evidence = "tests-green" } (draft Governance yesNo) with
    | Error (WrongValidator(HumanReview, Proof)) -> ()
    | other -> failwithf "Governance must require HumanReview, not Proof; got %A" other
