module Zeta.Tests.LevelObligationsTests

// Falsifiers for `Levels.Obligations` — the asymmetric obligations a dominating rung owes the rung
// below it (the dual of the Dominance Lift Theorem: the capacity to imitate a part is the capacity
// to stomp it, so power and restriction must rise together).
//
// What these tests are for, and what they are NOT:
//
// * Every obligation gets a GREEN case and a constructed VIOLATOR that goes RED. An obligation no
//   configuration can violate is the vacuity class, which is the thing this file exists to keep out.
// * Where an obligation is *deliberately* vacuous in some regime — a part with zero exit has none to
//   take — the test asserts the vacuity EXPLICITLY rather than hiding it behind a green tick. That
//   is the newborn-CTM case, and it is stated, not patched.
// * The witnesses are object expressions living in the test, deliberately not in `src/`: the
//   substrate stays interface-only (weight-free) and a law needs something to be pointed at.
// * Under `toy-is-free-metered-must-be-earned` this promotes the OBLIGATION PREDICATES to `metered`
//   (each fails when its behaviour changes). It says nothing about `ISociety` or `ICtm` as contracts
//   and nothing about the Dominance Lift Theorem, which is not restated here.

open global.Xunit
open Zeta.Core

// ── Witnesses ─────────────────────────────────────────────────────────────────────────────────

let private addr (s: string) = Society.Address s

let private alpha = addr "alpha"
let private beta = addr "beta"
let private gamma = addr "gamma"
let private delta = addr "delta"

/// The protocol union. `Confiscate` and `OwnerSpend` have IDENTICAL effect on the balance and differ
/// only in who initiated them — which is the whole point of the no-confiscation rule.
///
/// **They are now redundant, and that redundancy is the result.** #10968 needed two DU cases because
/// the substrate carried no sender, so the *body* had to encode the initiator and a caller-supplied
/// `ownerInitiated` witness had to read it back out. With `Society.Addressed.From` the initiator is
/// on the envelope, so one body under two senders is enough — see the single-body falsifier below,
/// which is the sharper test. Both cases are kept because #10968's assertions are kept.
///
/// `CrossSpend(payer, victim)` lowers **two** balances at once. It exists to exhibit the gap the old
/// whole-message boolean left open: as an owner spend by `payer` it was excused wholesale, victim
/// included.
type private Msg =
    | Noop
    | RevokeRoute of Society.Address
    | Confiscate of Society.Address
    | OwnerSpend of Society.Address
    | CrossSpend of Society.Address * Society.Address

type private TestView =
    { Roll: Society.Address list
      /// The next hops this level offers toward any destination — its members' exit.
      Hops: Society.Address list
      /// A part's earned balance. Privacy budget, accrued degree, whatever the currency is.
      Budget: Map<Society.Address, float>
      /// What this level's `Admit` reports. Held in the view so one witness can present different
      /// evidential loads at different rungs.
      Say: Society.Reading }

let private spend (v: TestView) (who: Society.Address) =
    let now = v.Budget |> Map.tryFind who |> Option.defaultValue 0.0
    { v with Budget = Map.add who (now - 1.0) v.Budget }

let private society () =
    { new Society.ISociety<TestView, Msg> with
        member _.Members v = v.Roll |> Society.canonicalSortAddresses
        member _.Admit(v, _candidate) = v.Say
        member _.Routes(v, _destination) = v.Hops

      interface Society.IMember<TestView, Msg> with
          member _.Address v = List.head v.Roll

          member _.Deliver(v, m) =
              match m with
              | Noop -> v, []
              | RevokeRoute a -> { v with Hops = v.Hops |> List.filter (fun h -> h <> a) }, []
              | Confiscate a -> spend v a, []
              | OwnerSpend a -> spend v a, []
              | CrossSpend(payer, victim) -> spend (spend v payer) victim, []

          member _.Merge(l, _r) = l
          member _.Peers v = v.Hops }

let private view =
    { Roll = [ alpha; beta ]
      Hops = [ beta; gamma; delta ]
      Budget = Map.ofList [ alpha, 3.0; beta, 5.0 ]
      Say = Society.Deduplicated 1 }

/// The rung's own action, as `Obligations` wants it: apply one message to one view.
let private act (level: Society.ISociety<TestView, Msg>) (v: TestView) (m: Msg) =
    fst ((level :> Society.IMember<TestView, Msg>).Deliver(v, m))

// ── 1. Exit preservation ──────────────────────────────────────────────────────────────────────

[<Fact>]
let ``exit preservation: the aggregate may not reduce a part's exit, and the reducing message is named`` () =
    let s = society ()

    // Green: an action that touches nothing preserves exit.
    Assert.True(Levels.Obligations.societyExitIsPreserved s view alpha [ Noop ])

    // Red: the constructed violator. Revoking a hop is the stomp, and it goes red.
    Assert.False(Levels.Obligations.societyExitIsPreserved s view alpha [ RevokeRoute gamma ])

    // Evidence, not a bare false: WHICH message reduced it.
    let witnesses =
        Levels.Obligations.exitReductionWitnesses
            (fun v -> v.Hops |> List.distinct |> List.length)
            (act s)
            view
            [ Noop; RevokeRoute gamma; Confiscate beta ]

    Assert.Equal<Msg list>([ RevokeRoute gamma ], witnesses)

[<Fact>]
let ``exit preservation is a MONOTONICITY obligation -- it does not require the part to have exit`` () =
    let s = society ()
    // One hop only: below any k >= 2 Hirschman bar, so `hasExit 2` is false here...
    let thin = { view with Hops = [ beta ] }
    Assert.False(Society.SocietyLaws.hasExit 2 s thin alpha)
    // ...and yet the aggregate has taken nothing, so the OBLIGATION holds. The two predicates answer
    // different questions and this is where they visibly come apart: a level can owe nothing and
    // still be captured.
    Assert.True(Levels.Obligations.societyExitIsPreserved s thin alpha [ Noop ])
    // Take the last hop and the obligation goes red immediately.
    Assert.False(Levels.Obligations.societyExitIsPreserved s thin alpha [ RevokeRoute beta ])

[<Fact>]
let ``each message is judged from the SAME starting view -- a fold could hide a reduction`` () =
    let s = society ()
    // Applied independently, the revocation is caught.
    Assert.False(Levels.Obligations.societyExitIsPreserved s view alpha [ RevokeRoute gamma; Noop ])
    // Had the predicate folded, the second message would have been judged against the ALREADY
    // reduced view and the count would have looked stable. This is that mutation: folding the same
    // pair by hand reports no reduction on the second step, which is the false negative avoided.
    let afterFirst = act s view (RevokeRoute gamma)
    let countOf (v: TestView) = v.Hops |> List.distinct |> List.length
    Assert.Equal(2, countOf afterFirst)
    Assert.Equal(2, countOf (act s afterFirst Noop)) // stable against the wrong baseline

// ── The newborn: the one place the obligation is deliberately vacuous ──────────────────────────

/// A CTM witness, minimal — enough to read `Links`, which is a processor's exit past STM. The point
/// of running the obligation against BOTH a society's `Routes` and a machine's `Links` is that they
/// are the same notion one rung apart and there is only one predicate for them.
type private CtmView =
    { Processors: Society.Address list
      Wires: (Society.Address * Society.Address list) list }

let private machine () =
    { new Ctm.ICtm<CtmView, string, Msg> with
        member _.Processors v = v.Processors |> Society.canonicalSortAddresses
        member _.Submit(v, tick) = Ctm.entryChunk (List.head v.Processors) tick "gist" 1.0
        member _.Rank chunk = Ctm.rankByDisposition 0.0 chunk

        member _.Match(left, right, draw) =
            Ctm.probabilisticMatch (Ctm.rankByDisposition 0.0) left right draw

        member _.Broadcast(v, _winner) =
            let self = List.head v.Processors

            v.Processors
            |> List.map (fun p ->
                { Society.From = self
                  Society.To = p
                  Society.Body = Noop })

        member _.Links(v, processor) =
            v.Wires
            |> List.tryFind (fun (p, _) -> p = processor)
            |> Option.map snd
            |> Option.defaultValue []

      interface Society.IMember<CtmView, Msg> with
          member _.Address v = List.head v.Processors

          member _.Deliver(v, m) =
              match m with
              | RevokeRoute a ->
                  { v with
                      Wires = v.Wires |> List.map (fun (p, ls) -> p, ls |> List.filter (fun l -> l <> a)) },
                  []
              | _ -> v, []

          member _.Merge(l, _r) = l
          member _.Peers v = v.Processors }

[<Fact>]
let ``THE NEWBORN CASE: a machine with no exit passes preservation VACUOUSLY, and that is reported`` () =
    let m = machine ()

    let newborn =
        { Processors = [ alpha; beta ]
          Wires = [] } // "The CTM has no links (between processors) at birth"

    let linkCount (v: CtmView) =
        m.Links(v, alpha) |> List.distinct |> List.length

    let deliver (v: CtmView) (msg: Msg) =
        fst ((m :> Society.IMember<CtmView, Msg>).Deliver(v, msg))

    // The LEVEL predicate is false at birth. #10952's finding stands untouched and unweakened —
    // no age qualifier was added to it, and this is the same assertion `Ctm.Tests` makes.
    Assert.False(Ctm.CtmLaws.hasUnmediatedExit 1 m newborn alpha)

    // The OBLIGATION passes — because there is nothing left to take. Note the violator that would
    // normally go red (`RevokeRoute`) cannot go red here: it is a pass carrying zero information.
    Assert.True(Levels.Obligations.exitIsPreserved linkCount deliver newborn [ RevokeRoute beta ])

    // ...and the vacuity is REPORTED rather than absorbed. This is the honest handling: the
    // resolution is not to qualify the predicate by age (that would silence the law exactly where
    // the asymmetry is largest) but to say out loud that the pass measured nothing.
    Assert.True(Levels.Obligations.nothingToPreserve linkCount newborn)

    // Once links form Hebbian-ly the same obligation acquires teeth, with no change to the predicate.
    let adult =
        { newborn with
            Wires = [ alpha, [ beta; gamma ]; beta, [ alpha ] ] }

    Assert.True(Ctm.CtmLaws.hasUnmediatedExit 1 m adult alpha)
    Assert.False(Levels.Obligations.nothingToPreserve linkCount adult)
    Assert.True(Levels.Obligations.exitIsPreserved linkCount deliver adult [ Noop ])
    Assert.False(Levels.Obligations.exitIsPreserved linkCount deliver adult [ RevokeRoute beta ])

// ── 2. Asymmetric burden of proof ─────────────────────────────────────────────────────────────

[<Fact>]
let ``attested sources: ONLY deduplicated sources count, and Unmeasured scores zero`` () =
    Assert.Equal(3, Levels.Obligations.attestedSources (Society.Deduplicated 3))
    // The honest default is never read as "fine" — an aggregate that measured nothing gets no credit.
    Assert.Equal(0, Levels.Obligations.attestedSources Society.Unmeasured)
    // Atoms are not sources: `NotAttested` could not rule out redundancy, by its own docstring.
    Assert.Equal(0, Levels.Obligations.attestedSources (Society.NotAttested 9))
    // Facts of other kinds carry no source count — otherwise a burden could be discharged by
    // answering a different question.
    Assert.Equal(0, Levels.Obligations.attestedSources (Society.SourcesConflict [ "k" ]))
    Assert.Equal(0, Levels.Obligations.attestedSources (Society.AboveThreshold("m", 9.0, 1.0)))
    Assert.Equal(0, Levels.Obligations.attestedSources (Society.SameSourceAsKnown beta))
    // A negative count is not a negative burden.
    Assert.Equal(0, Levels.Obligations.attestedSources (Society.Deduplicated -4))

[<Fact>]
let ``the burden falls on the level that prevails: the outer rung must bring STRICTLY more`` () =
    let s = society ()
    let inner = { view with Say = Society.Deduplicated 1 }
    let outer = { view with Say = Society.Deduplicated 3 }

    Assert.True(Levels.Obligations.burdenIsOnTheDominantLevel (s, inner) (s, outer) gamma)

    // Red: EQUAL bars. This is the status quo the influence-weighted-scrutiny doc was written
    // against — treating the powerful exactly like the powerless is not an obligation — so `>=`
    // would have made the law unable to see its own motivating failure.
    let equal = { view with Say = Society.Deduplicated 1 }
    Assert.False(Levels.Obligations.burdenIsOnTheDominantLevel (s, inner) (s, equal) gamma)

    // Red: the INVERSION. The founder's claim merges on the least evidence.
    let lax = { view with Say = Society.Unmeasured }
    Assert.False(Levels.Obligations.burdenIsOnTheDominantLevel (s, inner) (s, lax) gamma)

[<Fact>]
let ``scrutiny scales up the WHOLE ladder -- one law, world-to-society and society-to-member alike`` () =
    let s = society ()

    // A well-formed ladder: each rung's own address is a member of the next.
    let rung roll sources =
        { view with
            Roll = roll
            Say = Society.Deduplicated sources }

    let innerV = rung [ alpha; beta ] 1
    let midV = rung [ beta; alpha ] 2
    let outerV = rung [ gamma; beta ] 3

    let ladder: Levels.Ladder<TestView, Msg> = [ s, innerV; s, midV; s, outerV ]
    Assert.True(Levels.ladderIsWellFormed ladder)

    // Green: strictly increasing evidential load up the rungs.
    Assert.True(Levels.Obligations.scrutinyScalesUpTheLadder delta ladder)
    Assert.Equal<int list>([], Levels.Obligations.invertedJoints delta ladder)

    // Red, and DIAGNOSED: flatten the top joint only. Joint 1 inverts; joint 0 still holds.
    let flatTop: Levels.Ladder<TestView, Msg> = [ s, innerV; s, midV; s, rung [ gamma; beta ] 2 ]
    Assert.False(Levels.Obligations.scrutinyScalesUpTheLadder delta flatTop)
    Assert.Equal<int list>([ 1 ], Levels.Obligations.invertedJoints delta flatTop)

    // Red everywhere: the full status inversion — the more powerful the rung, the less it must show.
    let inverted: Levels.Ladder<TestView, Msg> =
        [ s, rung [ alpha; beta ] 5; s, rung [ beta; alpha ] 2; s, rung [ gamma; beta ] 1 ]

    Assert.False(Levels.Obligations.scrutinyScalesUpTheLadder delta inverted)
    Assert.Equal<int list>([ 0; 1 ], Levels.Obligations.invertedJoints delta inverted)

[<Fact>]
let ``a ladder with nothing below it owes nothing -- and reports false, never a vacuous pass`` () =
    let s = society ()
    let single: Levels.Ladder<TestView, Msg> = [ s, view ]
    let empty: Levels.Ladder<TestView, Msg> = []

    Assert.False(Levels.Obligations.scrutinyScalesUpTheLadder delta single)
    Assert.False(Levels.Obligations.scrutinyScalesUpTheLadder delta empty)
    Assert.False(Levels.LevelLaws.holdsBetweenAdjacentLevels (fun _ _ -> true) single)
    Assert.False(Levels.LevelLaws.holdsBetweenAdjacentLevels (fun _ _ -> true) empty)

// ── 3. No confiscation ────────────────────────────────────────────────────────────────────────

let private balance (v: TestView) (who: Society.Address) =
    v.Budget |> Map.tryFind who |> Option.defaultValue 0.0

/// The rung ABOVE alpha and beta — the aggregate whose messages the obligation judges. It is not a
/// part, and it is the sender on every attempted stomp below.
let private theLevel = addr "level"

/// An envelope. `From` is the initiator — the whole discriminator of the hard-money rule, now read
/// off the substrate rather than supplied as a caller's `ownerInitiated` predicate.
let private envelope (sender: Society.Address) (recipient: Society.Address) (body: Msg) =
    { Society.From = sender
      Society.To = recipient
      Society.Body = body }

[<Fact>]
let ``no confiscation: the level above may not take what a part earned -- but the owner may spend it`` () =
    let s = society ()
    let parts = [ alpha; beta ]

    // Red: the constructed violator. `Confiscate beta` lowers beta's balance and beta did not ask —
    // and now "beta did not ask" is READ FROM THE ENVELOPE (`From = theLevel`), not asserted.
    Assert.False(Levels.Obligations.noConfiscation balance (act s) parts view [ envelope theLevel beta (Confiscate beta) ])

    // Green: `OwnerSpend beta` sent BY beta has the IDENTICAL effect on the balance and is permitted,
    // because the rule is about who initiates, not about whether the balance fell. A predicate that
    // forbade any decrease would fail this line, and would be the wrong law.
    Assert.True(Levels.Obligations.noConfiscation balance (act s) parts view [ envelope beta beta (OwnerSpend beta) ])

    // The two BODIES are indistinguishable inside `Deliver` — same view out, both times. #10968
    // recorded that as the missing-sender finding; it is still true of the bodies, and it is now
    // irrelevant to the verdict, because the verdict no longer reads the body.
    Assert.Equal(4.0, balance (act s view (Confiscate beta)) beta, 12)
    Assert.Equal(4.0, balance (act s view (OwnerSpend beta)) beta, 12)

    // Evidence, not a bare false.
    let witnesses =
        Levels.Obligations.confiscationWitnesses
            balance
            (act s)
            parts
            view
            [ envelope theLevel alpha Noop
              envelope alpha alpha (OwnerSpend alpha)
              envelope theLevel beta (Confiscate beta) ]

    Assert.Equal<Society.Addressed<Msg> list>([ envelope theLevel beta (Confiscate beta) ], witnesses)

[<Fact>]
let ``THE SENDER IS THE DISCRIMINATOR: one body, two senders, opposite verdicts`` () =
    // The falsifier the `From` field exists for, and the one the old code could not express. A single
    // body is sent twice with nothing differing but `From`.
    let s = society ()
    let parts = [ alpha; beta ]
    let body = Confiscate beta

    // From the level above: a taking. Red.
    Assert.False(Levels.Obligations.noConfiscation balance (act s) parts view [ envelope theLevel beta body ])
    // From beta itself: beta's own spend. Green.
    Assert.True(Levels.Obligations.noConfiscation balance (act s) parts view [ envelope beta beta body ])

    // ...with the effect on the balance BYTE-IDENTICAL in both cases, because it is the same body.
    Assert.Equal(4.0, balance (act s view body) beta, 12)

    // **Why the OLD code provably could not do this, asserted rather than argued.** The old
    // predicate's discriminator had type `'msg -> bool`, so the only thing it could see of these two
    // calls is `.Body` — and the two bodies are EQUAL. A function of equal inputs returns equal
    // outputs, so no `ownerInitiated` whatsoever could have returned `false` for the first and
    // `true` for the second. The distinction is not merely unmade by the old code, it is
    // unmakeable at that signature; the caller could only have supplied the answer by knowing it.
    let taking = envelope theLevel beta body
    let spending = envelope beta beta body
    Assert.Equal<Msg>(taking.Body, spending.Body)
    Assert.NotEqual<Society.Address>(taking.From, spending.From)

    // And a third party is not laundered by being *some* owner: alpha's signature does not license
    // taking beta's budget.
    Assert.False(Levels.Obligations.noConfiscation balance (act s) parts view [ envelope alpha beta body ])

[<Fact>]
let ``the whole-message boolean excused CROSS-PART decreases; the per-part derivation does not`` () =
    // The gap #10968's witness left open, exhibited. `CrossSpend(alpha, beta)` lowers alpha's balance
    // AND beta's. Sent by alpha it is a genuine owner spend *of alpha's own budget* — so the old
    // `ownerInitiated` boolean was true for it, and one true boolean excused the whole message,
    // beta's loss included.
    let s = society ()
    let cross = envelope alpha beta (CrossSpend(alpha, beta))

    // Both balances really do fall.
    let after = act s view (CrossSpend(alpha, beta))
    Assert.Equal(2.0, balance after alpha, 12)
    Assert.Equal(4.0, balance after beta, 12)

    // Scoped to alpha alone the message is exactly what it claims to be — alpha spending alpha's. Green.
    Assert.True(Levels.Obligations.noConfiscation balance (act s) [ alpha ] view [ cross ])

    // Scoped to both parts it is red, because beta's decrease is checked against `From` on its own
    // account. This is the assertion that fails under a whole-message reading of the same envelope.
    Assert.False(Levels.Obligations.noConfiscation balance (act s) [ alpha; beta ] view [ cross ])

    // The witness names the envelope, and the check has teeth: `cross` is NOT self-attributed,
    // precisely because it lowers a balance that is not its sender's.
    Assert.Equal<Society.Addressed<Msg> list>(
        [ cross ],
        Levels.Obligations.confiscationWitnesses balance (act s) [ alpha; beta ] view [ cross ]
    )

    Assert.False(Levels.Obligations.confiscationCheckHasNoTeeth balance (act s) [ alpha; beta ] view [ cross ])

[<Fact>]
let ``the confiscation check is only as strong as its unsigned sender, and reports when it is not`` () =
    let s = society ()
    let parts = [ alpha; beta ]
    let bodies = [ Confiscate alpha; Confiscate beta ]

    // `From` is DERIVABLE but not SIGNED. So the vacuity of #10968 did not disappear, it changed
    // shape: instead of declaring one boolean true, a caller writes the victim's own address into
    // `From` on every message — self-attribution — and the check passes having measured nothing...
    let forged = [ envelope alpha alpha (Confiscate alpha); envelope beta beta (Confiscate beta) ]
    Assert.True(Levels.Obligations.noConfiscation balance (act s) parts view forged)
    // ...and that is REPORTED, which is why the guard was kept rather than deleted with the witness
    // parameter it originally guarded.
    Assert.True(Levels.Obligations.confiscationCheckHasNoTeeth balance (act s) parts view forged)

    // With honest senders the same bodies go red, and the check has teeth.
    let honest = bodies |> List.map (fun b -> envelope theLevel beta b)
    Assert.False(Levels.Obligations.noConfiscation balance (act s) parts view honest)
    Assert.False(Levels.Obligations.confiscationCheckHasNoTeeth balance (act s) parts view honest)

    // An empty message list is likewise no discharge.
    Assert.True(Levels.Obligations.confiscationCheckHasNoTeeth balance (act s) parts view [])

    // A batch that touches no balance at all HAS teeth — it simply found nothing. Reporting it as
    // toothless would conflate "measured and clean" with "could not measure", which is the exact
    // conflation this guard exists to prevent.
    Assert.False(Levels.Obligations.confiscationCheckHasNoTeeth balance (act s) parts view [ envelope theLevel alpha Noop ])

[<Fact>]
let ``confiscation is judged over the PARTS, not over the aggregate's own books`` () =
    let s = society ()
    // gamma is not named as a part, so a message that only touches gamma is not a confiscation
    // FROM A PART — the predicate is about what the level above takes from the level below, and
    // scoping it to the supplied parts is what keeps it from becoming a general accounting check.
    Assert.True(
        Levels.Obligations.noConfiscation balance (act s) [ alpha ] view [ envelope theLevel beta (Confiscate beta) ]
    )

    Assert.False(
        Levels.Obligations.noConfiscation
            balance
            (act s)
            [ alpha; beta ]
            view
            [ envelope theLevel beta (Confiscate beta) ]
    )

[<Fact>]
let ``a member must stamp its OWN address on its outbound -- impersonation is a law violation`` () =
    // The guard that keeps `From` worth reading. It is not authentication and is not cited as any:
    // it is decidable for a member you can run, and says nothing about an envelope off a wire.
    let honest =
        { new Society.IMember<TestView, Msg> with
            member _.Address v = List.head v.Roll
            member _.Deliver(v, m) = v, [ envelope (List.head v.Roll) beta m ]
            member _.Merge(l, _r) = l
            member _.Peers v = v.Hops }

    let impersonator =
        { new Society.IMember<TestView, Msg> with
            member _.Address v = List.head v.Roll
            // Stamps BETA's address on its own outbound while being alpha.
            member _.Deliver(v, m) = v, [ envelope beta beta m ]
            member _.Merge(l, _r) = l
            member _.Peers v = v.Hops }

    Assert.True(Society.SocietyLaws.outboundIsSelfAttributed honest view Noop)
    Assert.False(Society.SocietyLaws.outboundIsSelfAttributed impersonator view Noop)

    // A member that sends nothing passes vacuously — stated, not hidden, in the same spirit as
    // `nothingToPreserve` above: a pass here can mean "did not impersonate" or "did not speak".
    let silent =
        { new Society.IMember<TestView, Msg> with
            member _.Address v = List.head v.Roll
            member _.Deliver(v, _m) = v, []
            member _.Merge(l, _r) = l
            member _.Peers v = v.Hops }

    Assert.True(Society.SocietyLaws.outboundIsSelfAttributed silent view Noop)
