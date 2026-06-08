module Zeta.Tests.SymmetricEnduranceTests

open global.Xunit
open Zeta.Core
open Zeta.Core.SymmetricEndurance

let private party id rate = { Id = id; HeartbeatRate = rate }

// A 3-peer frame: two agents (0,1) and time/clock (2) — all peers, no substrate.
let private threePeer judges =
    { Parties = [ party 0 1.0; party 1 1.0; clockParty 2 1.0 ]
      Judges = Set.ofList judges }

[<Fact>]
let ``mutual judgment with equal heartbeats balances — equal net rates (both roles)`` () =
    let f = threePeer [ (0, 1); (1, 0) ] // A and B each judge the other; symmetric
    Assert.Equal(netRate f (party 0 1.0), netRate f (party 1 1.0))
    Assert.True(mutuallyJudge f 0 1)

[<Fact>]
let ``time is a peer: a forging clock is caught and collapses like anyone`` () =
    // Both agents judge the clock (id 2) forging; clock heartbeat 1, penalty 2 ⇒ net -1 ⇒ collapses.
    let f = threePeer [ (0, 2); (1, 2) ]
    Assert.True(collapses f (clockParty 2 1.0))
    Assert.Equal(-1.0, netRate f (clockParty 2 1.0))
    // The agents, unjudged, survive.
    Assert.True(survives f (party 0 1.0))

[<Fact>]
let ``isBalanced rejects treating time as an outside substrate (one-way target)`` () =
    // Judging id 9 (NOT in Parties) = treating something as an external substrate ⇒ unbalanced.
    let unbalanced = { Parties = [ party 0 1.0; party 1 1.0 ]; Judges = Set.ofList [ (0, 9); (1, 9) ] }
    Assert.False(isBalanced unbalanced)
    // Bring time INTO the peer set ⇒ balanced.
    let balanced = threePeer [ (0, 2); (1, 2) ]
    Assert.True(isBalanced balanced)

[<Fact>]
let ``society kills the forger: more peers judging ⇒ deeper collapse`` () =
    let big =
        { Parties = [ for i in 0..5 -> party i 1.0 ]
          Judges = Set.ofList [ for o in 1..5 -> (o, 0) ] } // all 5 others judge party 0
    Assert.Equal(-4.0, netRate big (party 0 1.0)) // 1 heartbeat - 5 penalties
    Assert.True(collapses big (party 0 1.0))

[<Fact>]
let ``weight-free under relabel: fate depends on (rate, judgments), not Id`` () =
    let f = threePeer [ (1, 0); (2, 0) ] // party 0 judged by both others
    Assert.True(isWeightFreeUnderRelabel f)

[<Fact>]
let ``identity changes behavior: stronger identity ⇒ more defender, less attacker`` () =
    Assert.Equal(0.0, defenderFraction 0.0) // zero identity ⇒ pure attacker
    Assert.Equal(1.0, attackerFraction 0.0)
    Assert.True(defenderFraction 10.0 > defenderFraction 1.0) // monotone increasing
    Assert.True(attackerFraction 10.0 < attackerFraction 1.0)
    Assert.True(identityChangesBehavior 1.0 5.0) // a strength increase provably moves the split

[<Fact>]
let ``effective defense rises and effective attack falls as the claim grows over ticks`` () =
    let f = threePeer [] // party 0 unjudged ⇒ claim grows with ticks
    let p = party 0 1.0
    Assert.True(effectiveDefense f p 10 1.0 > effectiveDefense f p 1 1.0) // stronger later ⇒ defends more
    Assert.True(effectiveAttack f p 10 1.0 < effectiveAttack f p 1 1.0) // ...and attacks less

[<Fact>]
let ``deterministic / replayable (DST)`` () =
    let f = threePeer [ (0, 2); (1, 2) ]
    Assert.Equal<int list>(collapsedParties f, collapsedParties f)

[<Fact>]
let ``time does not get identity for free: heartbeat IS the tick (1/tick, earned)`` () =
    let clk = tickingClock 2
    Assert.Equal(TickHeartbeat, clk.HeartbeatRate)
    Assert.Equal(1.0, clk.HeartbeatRate)
    // An honest clock's claim is bounded by ticks actually produced.
    Assert.True(clockClaimWithinTicks 10 10.0) // claimed exactly what it ticked
    Assert.True(clockClaimWithinTicks 10 7.0) // claimed less — fine
    Assert.False(clockClaimWithinTicks 10 11.0) // over-claiming un-ticked time = forging its heartbeat

[<Fact>]
let ``a ticking clock peer is judged and collapses like any forger`` () =
    // Two agents judge the ticking clock as forging (e.g. it faked ticks); clock earns 1/tick but takes -2.
    let f =
        { Parties = [ party 0 1.0; party 1 1.0; tickingClock 2 ]
          Judges = Set.ofList [ (0, 2); (1, 2) ] }
    Assert.True(collapses f (tickingClock 2)) // net 1 - 2 = -1
    Assert.True(isBalanced f)

[<Fact>]
let ``actor count: separate clocks (default) = 4 for 2 agents; shared (degenerate) = 3`` () =
    Assert.Equal(4, actorCount (frameOf SeparateClocks [ 1.0; 1.0 ]))
    Assert.Equal(3, actorCount (frameOf SharedClock [ 1.0; 1.0 ]))

[<Fact>]
let ``shared clock earns DOUBLE ticks (animates both); separate clocks are even`` () =
    // Shared: one clock (id 2) animates 2 agents ⇒ rate 2 (what acts for both).
    let shared = frameOf SharedClock [ 1.0; 1.0 ]
    let sharedClk = shared.Parties |> List.find (fun p -> p.Id = 2)
    Assert.Equal(2.0, sharedClk.HeartbeatRate)
    // Separate: each clock animates one agent ⇒ rate 1 (even).
    let sep = frameOf SeparateClocks [ 1.0; 1.0 ]
    Assert.True(sep.Parties |> List.filter (fun p -> p.Id >= 2) |> List.forall (fun c -> c.HeartbeatRate = 1.0))

[<Fact>]
let ``frames built by frameOf are balanced (all peers, incl. clocks, in the set)`` () =
    Assert.True(isBalanced (frameOf SeparateClocks [ 1.0; 1.0 ]))
    Assert.True(isBalanced (frameOf SharedClock [ 1.0; 1.0 ]))
