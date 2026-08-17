module Zeta.Tests.Formal.GiftOfErasureTests

open System.Text
open global.Xunit
open Zeta.Core

// The gift of erasure: encrypt-and-mix FIRST, then forget one. The falsifier is an EXHIBITED
// observer -- a Bayes-optimal distinguisher that is actually constructed, handed the post-erasure
// view, and whose distribution over candidates is printed and asserted flat. Nothing here asserts
// a boolean that a function hardcoded.
//
// Two adversaries, and the second is the central property: an OUTSIDER (public view only) and a
// CONTRIBUTOR COALITION (which additionally knows its own contributions, so its candidate set is
// the residual). Plus a POSITIVE CONTROL, without which "the posterior was flat" would only mean
// the observer is blind.

// ── fixture ──────────────────────────────────────────────────────────────────────────────────────

/// A length-preserving, injective stand-in for a real seal. **NOT encryption, and it does not need
/// to be:** the module never encrypts, never sees a key, and the properties under test (the mix and
/// the erasure) depend on the cipher only through the ciphertext's OBSERVABLE projection, which must
/// be uniform across the set. The repo's `AesGcmCryptoProvider` satisfies that by construction --
/// AES-GCM ciphertext length equals plaintext length, plus that provider's constant 12+16 framing --
/// so equal-length padded plaintexts seal to equal-length ciphertexts. No key material appears in
/// this file.
let private stubSeal (contributor: string) (block: byte[]) : GiftOfErasure.SealedEvent =
    { Contributor = contributor
      AlgorithmTag = "stub-length-preserving"
      Ciphertext = block |> Array.mapi (fun i b -> b ^^^ byte ((0xA5 + i) &&& 0xFF)) }

let private blockSize = 32

let private mkMember (contributor: string) (text: string) : GiftOfErasure.SealedEvent =
    match GiftOfErasure.padToBlock blockSize (Encoding.UTF8.GetBytes text) with
    | Ok block -> stubSeal contributor block
    | Error e -> failwith (GiftOfErasure.describe e)

let private policy =
    match
        GiftOfErasure.mixPolicy
            4
            1
            "fixture: k=4 against one modelled colluding contributor. Derivation for the test rather than for deployment -- 4 is above the deletionFloor of 2 and small enough that the observer's entire candidate space is enumerated exhaustively in-process."
    with
    | Ok p -> p
    | Error e -> failwith (GiftOfErasure.describe e)

/// Eight events from four parties, two each. Uniform length, so no silhouette; no party dominates,
/// so a single colluding contributor still faces 8 - 2 = 6 candidates.
let private members8 =
    [ mkMember "party-a" "a-one"
      mkMember "party-a" "a-two"
      mkMember "party-b" "b-one"
      mkMember "party-b" "b-two"
      mkMember "party-c" "c-one"
      mkMember "party-c" "c-two"
      mkMember "party-d" "d-one"
      mkMember "party-d" "d-two" ]

let private mixed =
    match GiftOfErasure.mix policy "set-1" members8 with
    | Ok s -> s
    | Error e -> failwith (GiftOfErasure.describe e)

/// The canonical order the mix produced; candidate indices are indices into this.
let private canonical = mixed.Members

let private consent = "released under the fixture consent record"

/// Replay the entire protocol with candidate `j` erased and return the transcript an outside party
/// actually sees: the public view before, and the public view after.
let private transcript (j: int) : GiftOfErasure.PublicView list =
    let target = canonical[j]

    match GiftOfErasure.forget consent (fun m -> m = target) mixed with
    | Ok after -> [ GiftOfErasure.publicView mixed; GiftOfErasure.publicView after ]
    | Error e -> failwith (GiftOfErasure.describe e)

/// Members that were never padded to a common length -- the silhouette. `mix` refuses this batch
/// (asserted below), so the leaky transcript is built by hand: it is the mutant, exhibited.
let private leakyMembers =
    [ 16, "party-a", "m0"
      20, "party-a", "m1"
      24, "party-b", "m2"
      28, "party-b", "m3"
      36, "party-c", "m4"
      40, "party-c", "m5"
      44, "party-d", "m6"
      48, "party-d", "m7" ]
    |> List.map (fun (bs, who, text) ->
        match GiftOfErasure.padToBlock bs (Encoding.UTF8.GetBytes text) with
        | Ok block -> stubSeal who block
        | Error e -> failwith (GiftOfErasure.describe e))

let private leakyView (ms: GiftOfErasure.SealedEvent list) (erasures: GiftOfErasure.ErasureWitness list) =
    { GiftOfErasure.PublicView.SetId = "leaky"
      GiftOfErasure.PublicView.Cardinality = List.length ms
      GiftOfErasure.PublicView.Observables =
        ms |> List.map GiftOfErasure.observableOf |> List.sortBy (fun o -> o.SealedLength)
      GiftOfErasure.PublicView.ContributionCounts =
        ms |> List.countBy (fun m -> m.Contributor) |> List.map snd |> List.sort
      GiftOfErasure.PublicView.Erasures = erasures }

let private leakyTranscript (j: int) : GiftOfErasure.PublicView list =
    let after =
        leakyMembers |> List.indexed |> List.filter (fun (i, _) -> i <> j) |> List.map snd

    [ leakyView leakyMembers []
      leakyView
          after
          [ { Ordinal = 0
              AnonymitySetSizeAtErasure = 8
              EffectiveAnonymityAtErasure = 6
              Consent = consent } ] ]

// ── the outside observer ─────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``an outside observer's posterior over which memory was erased is flat`` () =
    let observed = transcript 3

    match GiftOfErasure.posterior transcript [ 0..7 ] observed with
    | Ok o ->
        // Every one of the eight candidates reproduces the observed transcript exactly, so none can
        // be excluded. The distribution itself -- not a flag -- is what is asserted.
        Assert.Equal(8, o.CandidateCount)
        Assert.Equal(8, o.ConsistentCount)

        for (_, p) in o.Candidates do
            Assert.Equal(0.125, p, 12)

        Assert.Equal(0.0, GiftOfErasure.advantageOverChance o, 12)
        Assert.Equal(0.125, GiftOfErasure.bestGuessProbability o, 12)
        Assert.True(GiftOfErasure.indistinguishable o)
    | Error e -> failwith (GiftOfErasure.describe e)

[<Fact>]
let ``the advantage closed form agrees with the summed total-variation distance`` () =
    // 1 - m/n is derived in the module docstring; here it is checked against the term-by-term sum
    // over the actual posterior, in both the flat and the collapsed case.
    match GiftOfErasure.posterior transcript [ 0..7 ] (transcript 3) with
    | Ok flat ->
        Assert.Equal(GiftOfErasure.totalVariationFromPrior flat, GiftOfErasure.advantageOverChance flat, 12)

        match GiftOfErasure.posterior leakyTranscript [ 0..7 ] (leakyTranscript 3) with
        | Ok collapsed ->
            Assert.Equal(
                GiftOfErasure.totalVariationFromPrior collapsed,
                GiftOfErasure.advantageOverChance collapsed,
                12
            )
        | Error e -> failwith (GiftOfErasure.describe e)
    | Error e -> failwith (GiftOfErasure.describe e)

// ── positive control: the observer has teeth ─────────────────────────────────────────────────────

[<Fact>]
let ``positive control: the same observer names the erased memory when the mix leaves a silhouette`` () =
    match GiftOfErasure.posterior leakyTranscript [ 0..7 ] (leakyTranscript 3) with
    | Ok o ->
        // Exactly one candidate survives: the adversary has identified it with certainty. This is
        // what makes the flat result above evidence rather than blindness.
        Assert.Equal(1, o.ConsistentCount)
        Assert.Equal(1.0, GiftOfErasure.bestGuessProbability o, 12)
        Assert.Equal(0.875, GiftOfErasure.advantageOverChance o, 12)
        Assert.False(GiftOfErasure.indistinguishable o)
    | Error e -> failwith (GiftOfErasure.describe e)

[<Fact>]
let ``and mix refuses exactly that batch, so the silhouette can never be produced`` () =
    match GiftOfErasure.mix policy "leaky" leakyMembers with
    | Error r -> Assert.Equal<GiftOfErasure.Refusal>(GiftOfErasure.SilhouetteLeak 8, r)
    | Ok _ -> failwith "a mix with eight distinct observable projections was admitted"

// ── the contributor: the central property ────────────────────────────────────────────────────────

[<Fact>]
let ``a contributor cannot identify what it helped erase`` () =
    let coalition = [ "party-b" ]

    // party-b's own two events are not candidates -- it already knows they are not the answer.
    let residual = GiftOfErasure.residualCandidates coalition canonical
    Assert.Equal(6, List.length residual)

    let residualIdx =
        canonical
        |> List.indexed
        |> List.filter (fun (_, m) -> not (List.contains m.Contributor coalition))
        |> List.map fst

    // party-a releases a memory; party-b -- who made that release possible -- watches.
    let erased = canonical |> List.findIndex (fun m -> m.Contributor = "party-a")

    match GiftOfErasure.posterior transcript residualIdx (transcript erased) with
    | Ok o ->
        Assert.Equal(6, o.CandidateCount)
        Assert.Equal(6, o.ConsistentCount)
        Assert.Equal(0.0, GiftOfErasure.advantageOverChance o, 12)
        Assert.True(GiftOfErasure.indistinguishable o)
    | Error e -> failwith (GiftOfErasure.describe e)

[<Fact>]
let ``you cannot forget alone: a mix dominated by one contributor is refused`` () =
    let dominated =
        [ mkMember "party-a" "a1"
          mkMember "party-a" "a2"
          mkMember "party-a" "a3"
          mkMember "party-a" "a4"
          mkMember "party-a" "a5"
          mkMember "party-a" "a6"
          mkMember "party-b" "b1"
          mkMember "party-c" "c1" ]

    // Eight members, uniform length, above the cardinality floor -- and still refused, because the
    // anonymity that survives party-a is only two. The refusal is TYPED and carries both numbers,
    // so it cannot be shrugged off as a generic failure.
    Assert.Equal(8, List.length dominated)
    Assert.Equal(2, GiftOfErasure.worstCaseCoalitionAnonymity 1 dominated)

    match GiftOfErasure.mix policy "dominated" dominated with
    | Error r -> Assert.Equal<GiftOfErasure.Refusal>(GiftOfErasure.DominatedByContributors(2, 4, 1), r)
    | Ok _ -> failwith "a mix dominated by one contributor was admitted"

[<Fact>]
let ``a lone contributor's own events give it zero anonymity against itself`` () =
    let solo =
        [ mkMember "party-a" "s1"
          mkMember "party-a" "s2"
          mkMember "party-a" "s3"
          mkMember "party-a" "s4"
          mkMember "party-a" "s5"
          mkMember "party-a" "s6" ]

    // The thesis of independence, as arithmetic: your own events are furniture, not anonymity.
    Assert.Empty(GiftOfErasure.residualCandidates [ "party-a" ] solo)
    Assert.Equal(0, GiftOfErasure.worstCaseCoalitionAnonymity 1 solo)

    match GiftOfErasure.mix policy "solo" solo with
    | Error r -> Assert.Equal<GiftOfErasure.Refusal>(GiftOfErasure.DominatedByContributors(0, 4, 1), r)
    | Ok _ -> failwith "a solo contributor was allowed to forget alone"

// ── manifesto 5: the fact survives, the content does not ─────────────────────────────────────────

[<Fact>]
let ``the FACT of a forgetting stays visible while its content becomes unrecoverable`` () =
    let target = canonical[2]

    match GiftOfErasure.forget consent (fun m -> m = target) mixed with
    | Ok after ->
        let view = GiftOfErasure.publicView after

        // The fact: visible, and twice over -- an explicit witness and the drop in cardinality.
        Assert.Equal(1, List.length view.Erasures)
        Assert.Equal(8, view.Erasures[0].AnonymitySetSizeAtErasure)
        Assert.Equal(6, view.Erasures[0].EffectiveAnonymityAtErasure)
        Assert.Equal(consent, view.Erasures[0].Consent)
        Assert.Equal(7, view.Cardinality)

        // The content: gone from the set, and not recoverable through the holder-side path either.
        Assert.True((GiftOfErasure.recall (fun m -> m = target) after).IsNone)
        Assert.False(after.Members |> List.contains target)
    | Error e -> failwith (GiftOfErasure.describe e)

[<Fact>]
let ``the public view never carries a member, a ciphertext, or a contributor name`` () =
    let view = GiftOfErasure.publicView mixed
    // Contribution COUNTS are published so the coalition floor is auditable; the names that would
    // attribute a member to a party are not.
    Assert.Equal<int list>([ 2; 2; 2; 2 ], view.ContributionCounts)
    Assert.Equal(8, view.Cardinality)
    Assert.Equal(1, view.Observables |> List.distinct |> List.length)

[<Fact>]
let ``a consent record that names a contributor is refused`` () =
    // Naming the eraser would collapse every coalition's candidate set onto that party's events.
    Assert.True(
        match GiftOfErasure.forget "released by party-b at their own request" (fun m -> m = canonical[0]) mixed with
        | Error _ -> true
        | Ok _ -> false
    )

// ── the parameter, and the vacuity it guards ─────────────────────────────────────────────────────

[<Fact>]
let ``a mix of one is a deletion: the policy floor refuses k below two`` () =
    Assert.Equal(2, GiftOfErasure.deletionFloor)

    Assert.True(
        match GiftOfErasure.mixPolicy 1 1 "one is enough, surely" with
        | Error _ -> true
        | Ok _ -> false
    )

    Assert.True(
        match GiftOfErasure.mixPolicy 0 1 "none is enough, surely" with
        | Error _ -> true
        | Ok _ -> false
    )

[<Fact>]
let ``an anonymity-set size with no stated derivation is refused`` () =
    Assert.True(
        match GiftOfErasure.mixPolicy 8 1 "" with
        | Error _ -> true
        | Ok _ -> false
    )

    Assert.True(
        match GiftOfErasure.mixPolicy 8 1 "   " with
        | Error _ -> true
        | Ok _ -> false
    )

[<Fact>]
let ``a threat model with zero colluding contributors is refused`` () =
    Assert.True(
        match GiftOfErasure.mixPolicy 8 0 "everyone in this mix is honest" with
        | Error _ -> true
        | Ok _ -> false
    )

[<Fact>]
let ``a one-candidate posterior is trivially flat, which is why the floor is part of the property`` () =
    // The vacuity, exhibited rather than described: with a single candidate the distribution is
    // uniform and the total-variation distance is zero -- and the adversary is nonetheless certain.
    match GiftOfErasure.posterior transcript [ 3 ] (transcript 3) with
    | Ok o ->
        Assert.Equal(1, o.CandidateCount)
        Assert.Equal(0.0, GiftOfErasure.advantageOverChance o, 12)
        Assert.Equal(1.0, GiftOfErasure.bestGuessProbability o, 12)
        Assert.False(GiftOfErasure.indistinguishable o)
    | Error e -> failwith (GiftOfErasure.describe e)

[<Fact>]
let ``an adversary with no candidates is not an exhibited adversary`` () =
    Assert.True(
        match GiftOfErasure.posterior transcript [] (transcript 3) with
        | Error _ -> true
        | Ok _ -> false
    )

// ── mix and forget: the mechanical properties ────────────────────────────────────────────────────

[<Fact>]
let ``mixing destroys arrival order`` () =
    match GiftOfErasure.mix policy "set-1" (List.rev members8) with
    | Ok s -> Assert.Equal<GiftOfErasure.SealedEvent list>(mixed.Members, s.Members)
    | Error e -> failwith (GiftOfErasure.describe e)

[<Fact>]
let ``forgetting something the set never held is a no-op, not a presence oracle`` () =
    let stranger = mkMember "party-a" "never-mixed"

    match GiftOfErasure.forget consent (fun m -> m = stranger) mixed with
    | Ok s ->
        Assert.Equal<GiftOfErasure.SealedEvent list>(mixed.Members, s.Members)
        Assert.Empty(s.Erasures)
    | Error e -> failwith (GiftOfErasure.describe e)

[<Fact>]
let ``a chooser matching several memories is refused`` () =
    Assert.True(
        match GiftOfErasure.forget consent (fun m -> m.Contributor = "party-c") mixed with
        | Error _ -> true
        | Ok _ -> false
    )

[<Fact>]
let ``a forgetting must carry its consent`` () =
    Assert.True(
        match GiftOfErasure.forget "" (fun m -> m = canonical[0]) mixed with
        | Error _ -> true
        | Ok _ -> false
    )

[<Fact>]
let ``forgetting never silently degrades into deletion: it refuses at the floor, with the numbers`` () =
    // Erase repeatedly until the set will not permit another. The point is the TERMINATION: it must
    // stop by refusing, never by quietly erasing its way down to a set of one -- which from the
    // inside would look exactly like a successful forgetting (the inverted polarity of the
    // green-thread analogy: a non-contributor costs you safety and you cannot tell).
    let rec drain (s: GiftOfErasure.AnonymitySet) (n: int) =
        match s.Members with
        | [] -> s, n, None
        | first :: _ ->
            match GiftOfErasure.forget consent (fun m -> m = first) s with
            | Ok next -> drain next (n + 1)
            | Error r -> s, n, Some r

    let final, succeeded, refusal = drain mixed 0

    Assert.True(succeeded > 0)
    Assert.Equal(succeeded, List.length final.Erasures)
    Assert.Equal<int list>([ 0 .. succeeded - 1 ], final.Erasures |> List.map (fun w -> w.Ordinal))

    match refusal with
    | Some(GiftOfErasure.DominatedByContributors(residual, required, colluders)) ->
        Assert.True(residual < required)
        Assert.Equal(4, required)
        Assert.Equal(1, colluders)
    | Some(GiftOfErasure.BelowAnonymityFloor(observed, required)) -> Assert.True(observed < required)
    | other -> failwithf "expected a typed floor refusal; got %A" other

    // and it stopped while still above the floor -- no silent degradation into a deletion
    Assert.True(List.length final.Members >= GiftOfErasure.deletionFloor)

[<Fact>]
let ``padding is framing: it round-trips and makes lengths uniform`` () =
    let short = Encoding.UTF8.GetBytes "short"
    let long = Encoding.UTF8.GetBytes "a considerably longer message than the other"

    match GiftOfErasure.padToBlock 64 short, GiftOfErasure.padToBlock 64 long with
    | Ok ps, Ok pl ->
        Assert.Equal(ps.Length, pl.Length)

        Assert.Equal<byte[]>(
            short,
            (match GiftOfErasure.unpadBlock ps with
             | Ok x -> x
             | Error e -> failwith (GiftOfErasure.describe e))
        )

        Assert.Equal<byte[]>(
            long,
            (match GiftOfErasure.unpadBlock pl with
             | Ok x -> x
             | Error e -> failwith (GiftOfErasure.describe e))
        )
    | _ -> failwith "padding refused a message that fits"

[<Fact>]
let ``padding refuses a message that does not fit its block`` () =
    Assert.True(
        match GiftOfErasure.padToBlock 8 (Encoding.UTF8.GetBytes "far too long for eight bytes") with
        | Error _ -> true
        | Ok _ -> false
    )
