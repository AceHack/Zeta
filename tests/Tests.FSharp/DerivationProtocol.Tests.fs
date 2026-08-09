module Zeta.Tests.DerivationProtocolTests

open global.Xunit
open Zeta.Core
open Zeta.Core.DerivationProtocol

// The fixtures below are the ACTUAL shapes from the key-custody run (2026-08-09), not invented
// examples: derivation A deferred R10 and said so; derivation B claimed it and supplied a literal.

// ───────────────── evidence that does not earn a claim ─────────────────

[<Fact>]
let ``a surviving mutant is a hole in the tests and never supports a claim`` () =
    Assert.False(supportsClaim (MutantSurvived "removed the rotation dedup guard"))
    Assert.True(supportsClaim (MutantKilled "expiry boundary < to <="))

[<Fact>]
let ``a mutant that produced no signal is neither a kill nor evidence`` () =
    // Three of A's mutants failed to compile under TreatWarningsAsErrors. Counting those as kills
    // would have inflated its verification claim.
    Assert.False(supportsClaim (NotConfirmed("ceiling not enforced", "did not compile")))

[<Fact>]
let ``an asserted-only property does not support a claim — the vacuity class`` () =
    // B's `priorCustodianRetainsPreFork: true`: a field typed as the literal true.
    Assert.False(supportsClaim (AssertedOnly "field is typed as the literal true; no test can fail"))

// ───────────────── coverage cannot be rounded up ─────────────────

[<Fact>]
let ``partial is never done, however much of it is verified`` () =
    // A's R6: the fold and idempotency verified, GrantRetracted not.
    let r6 = Partial([ "append-only fold"; "idempotency"; "PreviousRetracted" ], [ "GrantRetracted" ])
    Assert.False(isDone r6)

[<Fact>]
let ``implemented backed ONLY by an assertion is not done`` () =
    Assert.False(isDone (Implemented [ AssertedOnly "literal field" ]))
    Assert.True(isDone (Implemented [ Executed "rejects at phase 108, accepts at 107" ]))

[<Fact>]
let ``implemented with no evidence at all is not done`` () =
    Assert.False(isDone (Implemented []))

[<Fact>]
let ``a claim whose evidence is mixed is only as good as its weakest item`` () =
    // One genuine test plus one assertion does not make the requirement covered.
    Assert.False(isDone (Implemented [ Executed "boundary test"; AssertedOnly "the rest is a literal" ]))

[<Fact>]
let ``unearnedClaims names exactly the requirements claimed but not paid for`` () =
    let claims =
        [ { Requirement = "R5"; Declared = Implemented [ Executed "rotation refuses without next" ] }
          { Requirement = "AC3"; Declared = Implemented [ AssertedOnly "literal true" ] }
          { Requirement = "R10"; Declared = Deferred "not in this slice" } ]

    let unearned = unearnedClaims claims
    Assert.Equal<string list>([ "AC3" ], unearned |> List.map fst)

// ───────────────── a divergence is a spec defect by default ─────────────────

[<Fact>]
let ``every divergence is a spec defect unless it is an argued implementation defect`` () =
    Assert.True(isSpecDefect (SpecAmbiguity("R9", [ "observed causal frame"; "opaque scalar" ])))
    Assert.True(isSpecDefect (NoNormativeText "R9"))
    Assert.True(
        isSpecDefect (
            NonDiscriminating("AC6", ConformingInputs, ReducesTo("self-negating universal", SelfClaimed "no clock to skew"))
        )
    )
    Assert.True(isSpecDefect (RequirementsInTension("R8", "R9", "partition: phase freezes, grant never expires")))
    Assert.True(isSpecDefect (ConventionUnstated "Result-over-exception"))

    Assert.False(
        isSpecDefect (ImplementationDefect("B", "R6", Executed "removing retractions leaves state byte-identical"))
    )

// ───────────────── the finding that started this ─────────────────

[<Fact>]
let ``ACCEPTANCE — a requirement one derivation defers and another asserts is UNMET by both`` () =
    // This is the key-custody result in miniature, and the reason the protocol exists: with only B in
    // hand, AC3 reads as covered. It is not.
    let a =
        { Name = "A"
          Wall = Cleanroom
          Claims = [ { Requirement = "AC3"; Declared = Deferred "custody fork not in this slice" } ]
          ResolvedByChoosing = [] }

    let b =
        { Name = "B"
          Wall = Cleanroom
          Claims = [ { Requirement = "AC3"; Declared = Implemented [ AssertedOnly "priorCustodianRetainsPreFork: true" ] } ]
          ResolvedByChoosing = [] }

    Assert.Equal<string list>([ "AC3" ], unmetBy [ "AC3" ] [ a; b ])

    // …and the combine reports B's claim as unearned rather than silently accepting it.
    let _, unearned = combine [ a; b ] []
    Assert.Equal<(string * string) list>([ "B", "AC3" ], unearned |> List.map (fun (d, r, _) -> d, r))

[<Fact>]
let ``a requirement genuinely met by ONE derivation is not in the unmet list`` () =
    // B implemented R11 and A deferred it — one honest implementation is enough.
    let a =
        { Name = "A"
          Wall = Cleanroom
          Claims = [ { Requirement = "R11"; Declared = Deferred "not in this slice" } ]
          ResolvedByChoosing = [] }

    let b =
        { Name = "B"
          Wall = Cleanroom
          Claims = [ { Requirement = "R11"; Declared = Implemented [ Executed "selfIssueCredential round-trips" ] } ]
          ResolvedByChoosing = [] }

    Assert.Empty(unmetBy [ "R11" ] [ a; b ])

// ───────────────── the whitebox wall ─────────────────

[<Fact>]
let ``an unknown license blocks a whitebox derivation — unknown is not permissive`` () =
    let unknown =
        { Author = "someone"
          Work = "some prior implementation"
          License = None
          ContributesBack = true
          SharesProfit = true }

    // Good intentions do not substitute for an established license.
    Assert.False(whiteboxPermitted unknown)
    Assert.True(whiteboxPermitted { unknown with License = Some "Apache-2.0" })

// ───────────────── reduction is by SELF-CLAIM, never by inference ─────────────────

[<Fact>]
let ``a reduction the observer inferred is not admissible — only a self-claim is`` () =
    // The guard on the pigeonhole: the observer checks whether a self-claim was delivered, it does
    // not choose the bin. Today's C1 is the live case — my review inferred A's R6 was implemented;
    // A's own self-claim said partial, and the self-claim was the accurate one.
    Assert.False(admissible (ReducesTo("self-negating universal", Inferred "looked similar to me")))
    Assert.True(admissible (ReducesTo("self-negating universal", SelfClaimed "preaches no preachers")))

[<Fact>]
let ``does-not-reduce is a first-class outcome, not a fallthrough`` () =
    // A registry that always finds a match is the vacuity class wearing a lookup table.
    Assert.True(admissible (DoesNotReduce "phase freezes under partition"))

[<Fact>]
let ``the two discrimination failures differ only by input set`` () =
    // Vacuous and unfalsifiable were three cases; they are one case and a parameter.
    let vacuous = NonDiscriminating("AC3", AllInputs, DoesNotReduce "literal-typed field")
    let circular = NonDiscriminating("AC6", ConformingInputs, DoesNotReduce "obeying R9 removes the clock")
    Assert.True(isSpecDefect vacuous)
    Assert.True(isSpecDefect circular)
    Assert.NotEqual<Divergence>(vacuous, circular)
