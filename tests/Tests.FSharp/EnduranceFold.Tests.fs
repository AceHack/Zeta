module Zeta.Tests.EnduranceFoldTests

// The two-timescale fold's first live caller — and the tests that decide whether the correspondence
// is real or merely asserted.
//
// The interesting result is NOT that the bridge compiles. It is that `SymmetricEndurance` already
// had the shared-layer property, independently: `Judges` is a `Set<int * int>`, so judgment
// accumulation is idempotent by construction and `netRate` is a function of the SET rather than of
// the delivery sequence. `BeliefConvergence.observe` — pointwise multiplication, a commutative
// monoid that is NOT idempotent — did not.
//
// So these tests establish a property about LIVE CODE that was not previously stated or tested:
// SymmetricEndurance is DELAY-FREE. Judgments may arrive reordered, batched, or redelivered and
// every frame reaches the same netRate.

open global.Xunit
open Zeta.Core

module SE = SymmetricEndurance
module TTF = TwoTimescaleFold
module EF = EnduranceFold

let private dim = 4

let private parties =
    [ for i in 0 .. dim - 1 -> { SE.Id = i; SE.HeartbeatRate = 1.0 } ]

let private frameOf (judges: (int * int) list) : SE.Frame =
    { Parties = parties
      Judges = Set.ofList judges }

// ── the load-bearing correspondence ────────────────────────────────────────────────────────────

[<Fact>]
let ``the fold's Applied key set is in BIJECTION with the frame's judgment set`` () =
    // If this fails the bridge is a coincidence of shapes rather than a correspondence: the join
    // semilattice would not BE the judgment set, it would merely resemble it.
    let judges = [ (0, 1); (2, 1); (3, 0) ]
    let frame = frameOf judges
    let shared = EF.sharedOf dim frame

    let expected = judges |> List.map (fun (o, p) -> EF.judgmentKey o p) |> Set.ofList
    Assert.Equal<Set<string>>(expected, shared.Applied)
    Assert.Equal(frame.Judges.Count, shared.Applied.Count)

[<Fact>]
let ``ANTI-VACUITY: judgments actually change netRate`` () =
    // Without this, "delay-free" below is trivially true for a system where judgments do nothing.
    let unjudged = frameOf []
    let judged = frameOf [ (0, 1); (2, 1) ]
    let p1 = parties.[1]
    Assert.NotEqual(SE.netRate unjudged p1, SE.netRate judged p1)

// ── THE NEW PROPERTY ABOUT LIVE CODE: SymmetricEndurance is delay-free ─────────────────────────

[<Fact>]
let ``HEADLINE: netRate is a function of the judgment SET — order and redelivery cannot change it`` () =
    // Delay-freeness for the live module, stated and checked for the first time. The natural key
    // (observer, observed) is what buys it — discipline #6 satisfied by construction rather than by
    // a dedup pass bolted on later.
    let judges = [ (0, 1); (2, 1); (3, 0) ]
    let forward = frameOf judges
    let reversed = frameOf (List.rev judges)
    let redelivered = frameOf (judges @ judges @ [ (0, 1); (0, 1) ])

    for p in parties do
        Assert.Equal(SE.netRate forward p, SE.netRate reversed p, 9)
        Assert.Equal(SE.netRate forward p, SE.netRate redelivered p, 9)

    // ... and the projection into the shared layer agrees, which is the correspondence doing work.
    Assert.Equal<int64[]>((EF.sharedOf dim forward).Belief, (EF.sharedOf dim redelivered).Belief)

[<Fact>]
let ``the shared projection is idempotent — re-applying a judgment is a no-op`` () =
    let frame = frameOf [ (0, 1) ]
    let once = EF.sharedOf dim frame
    let e = EF.judgmentEvidence dim 0 1
    let twice = TTF.apply e once
    Assert.Equal<int64[]>(once.Belief, twice.Belief)
    Assert.Equal<Set<string>>(once.Applied, twice.Applied)

// ── mergeFrames is the JOIN ────────────────────────────────────────────────────────────────────

[<Fact>]
let ``merging frames is set union: commutative, associative, idempotent`` () =
    let a = frameOf [ (0, 1); (2, 1) ]
    let b = frameOf [ (2, 1); (3, 0) ]
    let c = frameOf [ (1, 3) ]

    Assert.Equal<Set<int * int>>((EF.mergeFrames a b).Judges, (EF.mergeFrames b a).Judges)

    Assert.Equal<Set<int * int>>(
        (EF.mergeFrames (EF.mergeFrames a b) c).Judges,
        (EF.mergeFrames a (EF.mergeFrames b c)).Judges
    )

    Assert.Equal<Set<int * int>>(a.Judges, (EF.mergeFrames a a).Judges)
    // 2 judgments + 2 judgments = THREE, because (2,1) is in both and is counted once. That missing
    // fourth IS the idempotence: a count-based `Judges` would have said 4, and been wrong.
    Assert.Equal(2, a.Judges.Count)
    Assert.Equal(2, b.Judges.Count)
    Assert.Equal(3, (EF.mergeFrames a b).Judges.Count)

[<Fact>]
let ``two observers who saw different subsets reconcile to the union, whoever speaks first`` () =
    let alice = frameOf [ (0, 1) ]
    let bob = frameOf [ (3, 1) ]
    let ab = EF.mergeFrames alice bob
    let ba = EF.mergeFrames bob alice
    let p1 = parties.[1]
    Assert.Equal(SE.netRate ab p1, SE.netRate ba p1, 9)
    // Both judgments landed: party 1 is judged by two observers, not one.
    Assert.True(SE.netRate ab p1 < SE.netRate alice p1)

// ── the forced pair: the join cannot retract, the delta can ────────────────────────────────────

[<Fact>]
let ``THE FORCED PAIR: a judgment delta is invertible where the join is not`` () =
    // `a + a = a  =>  a = e`, so the idempotent join has no inverses and cannot un-cast a judgment.
    // The Z-set -1 that SymmetricEndurance's docstring describes needs a group to live in, and that
    // is what judgmentDelta supplies.
    let d = EF.judgmentDelta dim 0 1
    let v = [| 5L; 5L; 5L; 5L |]
    let applied = TTF.applyDelta d v
    Assert.Equal(4L, applied.[1]) // the -1 landed on the observed party
    Assert.Equal<int64[]>(v, TTF.applyDelta (TTF.invert d) applied) // and comes back exactly
    Assert.Equal<int64[]>(v, TTF.replay [ d; TTF.invert d ] v)

[<Fact>]
let ``the delta and the evidence agree on WHICH party is judged`` () =
    // A bridge whose two halves disagreed about the target would be worse than no bridge.
    let e = EF.judgmentEvidence dim 2 3
    let d = EF.judgmentDelta dim 2 3
    Assert.Equal(e.Id, d.Of)
    Assert.Equal(0L, e.Likelihood.[3]) // evidence withholds from party 3
    Assert.Equal(-1L, d.Change.[3]) // delta retracts from party 3
    Assert.Equal(0L, d.Change.[0])

// ── determinism, since Set iteration order is load-bearing for DST ─────────────────────────────

[<Fact>]
let ``DST: projecting the same frame twice yields the same evidence, in the same order`` () =
    let frame = frameOf [ (3, 0); (0, 1); (2, 1) ]
    let p1 = EF.projectFrame dim frame |> List.map (fun e -> e.Id)
    let p2 = EF.projectFrame dim frame |> List.map (fun e -> e.Id)
    Assert.Equal<string list>(p1, p2)
    // And a frame built in a different insertion order projects identically — the Set is the state.
    let shuffled = frameOf [ (0, 1); (2, 1); (3, 0) ]
    Assert.Equal<string list>(p1, EF.projectFrame dim shuffled |> List.map (fun e -> e.Id))

[<Fact>]
let ``the judgment key carries no local time — two nodes key the same judgment identically`` () =
    // If the key were clock- or arrival-derived, replicas would key the same judgment differently and
    // the merge would stop being idempotent across nodes.
    Assert.Equal("judge:0->1", EF.judgmentKey 0 1)
    Assert.NotEqual<string>(EF.judgmentKey 0 1, EF.judgmentKey 1 0) // direction is preserved
