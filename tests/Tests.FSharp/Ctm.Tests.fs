module Zeta.Tests.CtmTests

// Falsifiers for `src/Core/Ctm.fs` and `src/Core/Levels.fs`.
//
// What these tests are for, and what they are NOT:
//
// * `Ctm.probabilisticMatch` and `Ctm.tournament` are real functions with real behaviour, so they
//   get real falsifiers — additivity, selection, entropy refusal, and one FIXED fixture whose
//   winner is pinned by value. That fixture is duplicated byte-for-byte in
//   `src/Core.TypeScript/society/ctm.test.ts`; it is the cross-oracle lock on the two things that
//   can diverge silently between the languages (the draw convention and the bracket order).
// * The interfaces themselves are declarations. The witnesses below are OBJECT EXPRESSIONS living
//   in the test, deliberately not in `src/` — the substrate stays interface-only (weight-free), and
//   a law needs something to be pointed at.
// * Under `toy-is-free-metered-must-be-earned`: this promotes `probabilisticMatch` / `tournament` /
//   the closure predicate to `metered` (each test fails if the behaviour changes). It says nothing
//   about `ICtm` or `ISociety` as contracts, and must not be cited as if it did.

open global.Xunit
open Zeta.Core

// ── Witnesses ─────────────────────────────────────────────────────────────────────────────────

/// Membership plus the link graph. A plain record handed to every call; nothing holds it.
type private TestView =
    { Roll: Society.Address list
      Wires: (Society.Address * Society.Address list) list }

let private addr (s: string) = Society.Address s

/// A CTM witness. `Rank` is the paper's simple natural choice, `f = intensity` (disposition d = 0),
/// and `Match` is `probabilisticMatch` verbatim — so the laws are being checked against the rule the
/// paper states, not against a convenience.
let private machine (view0: TestView) =
    { new Ctm.ICtm<TestView, string, Society.Address> with
        member _.Processors v = v.Roll |> Society.canonicalSortAddresses
        member _.Submit(v, tick) = Ctm.entryChunk (List.head v.Roll) tick "gist" 1.0
        member _.Rank chunk = Ctm.rankByDisposition 0.0 chunk

        member _.Match(left, right, draw) =
            Ctm.probabilisticMatch (Ctm.rankByDisposition 0.0) left right draw

        // The Down-Tree broadcasts FROM the machine itself, so every envelope is self-attributed to
        // the machine's own address (`SocietyLaws.outboundIsSelfAttributed`).
        member _.Broadcast(v, _winner) =
            let self = List.head view0.Roll

            v.Roll
            |> List.map (fun p ->
                { Society.From = self
                  Society.To = p
                  Society.Body = p })

        member _.Links(v, processor) =
            v.Wires
            |> List.tryFind (fun (p, _) -> p = processor)
            |> Option.map snd
            |> Option.defaultValue []

      interface Society.IMember<TestView, Society.Address> with
          member _.Address _ = List.head view0.Roll
          member _.Deliver(v, _m) = v, []
          member _.Merge(l, _r) = l
          member _.Peers v = v.Roll }

/// A society witness whose `Deliver` addresses the message itself — so a message naming a member is
/// closed traffic and a message naming an outsider is the witness that the level is open.
let private society () =
    { new Society.ISociety<TestView, Society.Address> with
        member _.Members v = v.Roll |> Society.canonicalSortAddresses
        member _.Admit(_v, _candidate) = Society.Unmeasured
        member _.Routes(v, _destination) = v.Roll

      interface Society.IMember<TestView, Society.Address> with
          member _.Address v = List.head v.Roll
          member _.Deliver(v, m) =
              v,
              [ { Society.From = List.head v.Roll
                  Society.To = m
                  Society.Body = m } ]
          member _.Merge(l, _r) = l
          member _.Peers v = v.Roll }

// ── The fixture that is byte-locked against the TypeScript oracle ─────────────────────────────

let private alpha = Ctm.entryChunk (addr "alpha") 1L "a" 3.0
let private beta = Ctm.entryChunk (addr "beta") 1L "b" -1.0
let private gamma = Ctm.entryChunk (addr "gamma") 1L "c" 2.0

let private view =
    { Roll = [ addr "alpha"; addr "beta"; addr "gamma" ]
      Wires = [] }

// ── Tests ─────────────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``a match selects a competitor and carries the SUMMED aux -- the paper's winner-take-all policy`` () =
    // f(alpha) = 3, f(beta) = 1, so p(alpha) = 0.75. draw 0.9 is above it: beta wins.
    let w = Ctm.probabilisticMatch (Ctm.rankByDisposition 0.0) alpha beta 0.9
    Assert.Equal<Society.Address>(addr "beta", w.Address)
    Assert.Equal(4.0, w.Intensity, 12)
    Assert.Equal(2.0, w.Mood, 12)
    // draw 0.1 is below 0.75: alpha wins. Same aux either way -- winner-take-all is about WHOSE
    // address and gist survive, never about how much mass is carried.
    let w2 = Ctm.probabilisticMatch (Ctm.rankByDisposition 0.0) alpha beta 0.1
    Assert.Equal<Society.Address>(addr "alpha", w2.Address)
    Assert.Equal(4.0, w2.Intensity, 12)

[<Fact>]
let ``rank is ADDITIVE under a match -- the property the location-independence theorem rests on`` () =
    let m = machine view
    Assert.True(Ctm.CtmLaws.rankIsAdditiveUnderMatch 1e-12 m alpha beta 0.9)
    Assert.True(Ctm.CtmLaws.rankIsAdditiveUnderMatch 1e-12 m beta gamma 0.4)
    Assert.True(Ctm.CtmLaws.matchSelectsACompetitor m alpha beta 0.9)
    // Mirror symmetry: swapping the competitors and reflecting the draw picks the same winner.
    Assert.True(Ctm.CtmLaws.matchIsMirrorSymmetric m alpha gamma 0.3)

[<Fact>]
let ``the aux invariant |mood| <= intensity holds at entry and survives a match`` () =
    Assert.True(Ctm.CtmLaws.intensityDominatesMood beta) // value -1: mood -1, intensity 1
    let w = Ctm.probabilisticMatch (Ctm.rankByDisposition 0.0) alpha beta 0.9
    Assert.True(Ctm.CtmLaws.intensityDominatesMood w)
    // Which is what keeps every disposition's rank non-negative, as the paper requires of f.
    for d in [ -1.0; -0.5; 0.0; 0.5; 1.0 ] do
        Assert.True(Ctm.rankByDisposition d w >= 0.0)

[<Fact>]
let ``THE CROSS-ORACLE FIXTURE -- same submissions, same draws, same winner as ctm.test.ts`` () =
    let m = machine view
    let draws = [ 0.9; 0.1 ]

    match Ctm.tournament m draws [ gamma; alpha; beta ] with // deliberately out of order on input
    | None -> Assert.Fail "the tournament refused a well-formed input"
    | Some w ->
        // Canonical bracket is alpha, beta, gamma regardless of submission order.
        Assert.Equal<Society.Address>(addr "beta", w.Address)
        Assert.Equal(6.0, w.Intensity, 12) // 3 + 1 + 2
        Assert.Equal(4.0, w.Mood, 12) // 3 + (-1) + 2

[<Fact>]
let ``the tournament conserves rank mass and never invents a chunk`` () =
    let m = machine view
    let draws = [ 0.9; 0.1 ]
    Assert.True(Ctm.CtmLaws.tournamentConservesRankMass 1e-12 m draws [ alpha; beta; gamma ])
    Assert.True(Ctm.CtmLaws.tournamentWinnerWasSubmitted m draws [ alpha; beta; gamma ])

[<Fact>]
let ``running out of entropy REFUSES -- it does not reach for an ambient draw`` () =
    let m = machine view
    // Two matches are needed for three submissions; only one draw is supplied.
    Assert.True((Ctm.tournament m [ 0.5 ] [ alpha; beta; gamma ]).IsNone)
    Assert.True((Ctm.tournament m [] ([]: Ctm.Chunk<string> list)).IsNone)

[<Fact>]
let ``the Down-Tree reaches every processor, and links stay inside the machine`` () =
    let m = machine view
    Assert.True(Ctm.CtmLaws.broadcastReachesEveryProcessor m view alpha)
    Assert.True(Ctm.CtmLaws.processorsAreCanonicallyOrdered m view)
    Assert.True(Ctm.CtmLaws.linksStayInsideTheMachine m view (addr "alpha"))

[<Fact>]
let ``a NEWBORN CTM has no exit -- the paper's own construction, stated not patched`` () =
    let newborn = machine view // Wires = [], i.e. no links at birth
    Assert.False(Ctm.CtmLaws.hasUnmediatedExit 1 newborn view (addr "alpha"))

    // Links form Hebbian-ly between processors that broadcast on consecutive ticks. Once two have,
    // the exit is real -- and it is symmetric, because the paper's links are bi-directional.
    let grown =
        { view with
            Wires = [ addr "alpha", [ addr "beta" ]; addr "beta", [ addr "alpha" ] ] }

    let adult = machine grown
    Assert.True(Ctm.CtmLaws.hasUnmediatedExit 1 adult grown (addr "alpha"))
    Assert.True(Ctm.CtmLaws.linksAreSymmetric adult grown (addr "alpha") (addr "beta"))
    // An asymmetric wiring is caught, which is what makes the law a falsifier rather than a label.
    let broken = { view with Wires = [ addr "alpha", [ addr "beta" ] ] }
    Assert.False(Ctm.CtmLaws.linksAreSymmetric (machine broken) broken (addr "alpha") (addr "beta"))

[<Fact>]
let ``WORLD = CLOSED SOCIETY -- one predicate separates the two, and no third interface exists`` () =
    let s = society ()
    let insiders = [ addr "alpha"; addr "beta" ]
    let outsider = addr "delta"

    // Closed: every message names a member, so nothing leaves. This level IS a world.
    Assert.True(Levels.WorldLaws.isWorld s view insiders insiders)
    // Open: one message names an outsider, so traffic escapes. Same interface, same object -- only
    // the predicate differs, which is the whole finding.
    Assert.False(Levels.WorldLaws.isWorld s view (outsider :: insiders) insiders)
    // And the openness is reported as EVIDENCE (which message escaped), not as a bare false.
    Assert.Equal<Society.Address list>([ outsider ], Levels.WorldLaws.openWitnesses s view (outsider :: insiders))

[<Fact>]
let ``the level-generic lift: one predicate, every rung, with the failing rungs named`` () =
    let s = society ()
    let ladder: Levels.Ladder<TestView, Society.Address> = [ s, view; s, view ]

    Assert.True(Levels.LevelLaws.canonicalOrderAtEveryLevel ladder)
    Assert.True(Levels.LevelLaws.exitAtEveryLevel 3 (addr "alpha") ladder) // 3 distinct routes
    Assert.False(Levels.LevelLaws.exitAtEveryLevel 4 (addr "alpha") ladder)

    // The diagnosis, not just the verdict: a ladder whose second rung has an unordered roll reports
    // rung 1 and only rung 1.
    let unordered = { view with Roll = [ addr "gamma"; addr "alpha" ] }
    let mixed: Levels.Ladder<TestView, Society.Address> = [ s, view; s, unordered ]

    Assert.Equal<int list>(
        [ 1 ],
        Levels.LevelLaws.failingLevels
            (fun level v -> level.Members v = v.Roll) // is the roll ALREADY canonical, unsorted?
            mixed
    )

[<Fact>]
let ``an empty ladder is not a world -- a check that cannot fail is not a check`` () =
    let empty: Levels.Ladder<TestView, Society.Address> = []
    Assert.False(Levels.WorldLaws.ladderTerminatesInAWorld empty [] [])

[<Fact>]
let ``the CTM tournament discharges the Dominance Lift HYPOTHESIS -- it can imitate every projection`` () =
    let m = machine view
    let submissions = [ alpha; beta; gamma ]
    let draws = [ 0.9; 0.1 ]

    // The rule: the tournament, reported by the winning chunk's address. The projection: "just take
    // this part". The witness for index i concentrates all rank mass on part i, which -- because f is
    // additive and win probability is proportional to f -- makes the tournament return part i with
    // probability 1, for EVERY draw. The witness is derived from the paper's competition rule, not
    // constructed to pass.
    let rule (chunks: Ctm.Chunk<string> list) =
        Ctm.tournament m draws chunks |> Option.map (fun c -> c.Address)

    let project (c: Ctm.Chunk<string>) = Some c.Address

    let witnesses =
        [ for c in submissions -> Levels.Aggregation.concentrateMassOn c.Address submissions ]

    Assert.True(Levels.Aggregation.canImitateEveryProjection (=) rule project witnesses)

    // The predicate is a falsifier, not a label: an input that does NOT concentrate the mass fails
    // for at least one index, so the check can distinguish.
    let notWitnesses = [ for _ in submissions -> submissions ]
    Assert.False(Levels.Aggregation.canImitateEveryProjection (=) rule project notWitnesses)

    // And an empty witness list is NOT a discharge -- vacuous truth is the failure mode this guards.
    Assert.False(Levels.Aggregation.canImitateEveryProjection (=) rule project [])
