module Zeta.Tests.DecorrelationMeterTests

open global.Xunit
open Zeta.Core
open Zeta.Core.AntiSybil // ChshRound

module DMeter = Zeta.Core.DecorrelationMeter

// ═══════════════════════════════════════════════════════════════════
// DecorrelationMeter — the FUSION layer. These tests prove the fusion LOGIC (spacelike-only,
// calibrated-bound conviction, finite-sample honesty, order-independence, missing-probe skip) — the
// exact CHSH S values are AntiSybil.chshS's own concern. Verdicts name the FACT, never "sovereignty".
// ═══════════════════════════════════════════════════════════════════

let private r (s: int) (o: int) : ChshRound = { Setting = s; Outcome = o }

// A SIGNALING pair with CHSH S = 4 (the algebraic max): per 4-round cycle the outcome-products are
// E(0,0)=+1, E(0,1)=-1, E(1,0)=+1, E(1,1)=+1 ⇒ S = 1 -(-1) +1 +1 = 4. Repeated `m` times ⇒ n = 4m.
let private s4pair (m: int) : ChshRound list * ChshRound list =
    let aCycle = [ r 0 1; r 0 1; r 1 1; r 1 1 ]
    let bCycle = [ r 0 1; r 1 -1; r 0 1; r 1 1 ]
    [ for _ in 1..m do yield! aCycle ], [ for _ in 1..m do yield! bCycle ]

// ── classifyPair ─────────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``a strong signaling pair at ample n is convicted (above the calibrated bound)`` () =
    let a, b = s4pair 25 // n = 100 ⇒ ε(0.05,100) ≈ 0.98 ⇒ bound ≈ 2.98 < |S|=4
    Assert.Equal(DMeter.AboveClassicalBound, DMeter.classifyPair 0.05 a b)

[<Fact>]
let ``finite-sample honesty - the SAME S=4 pair at tiny n is NOT convicted (margin absorbs it)`` () =
    let a, b = s4pair 1 // n = 4 ⇒ ε(0.05,4) ≈ 4.9 ⇒ bound ≈ 6.9 > |S|=4 : cannot convict on 4 rounds
    Assert.Equal(DMeter.WithinClassicalBound, DMeter.classifyPair 0.05 a b)

[<Fact>]
let ``an identical (S=2) pair sits within the classical bound`` () =
    let a, _ = s4pair 25
    Assert.Equal(DMeter.WithinClassicalBound, DMeter.classifyPair 0.05 a a) // identical ⇒ S = 2

// ── fuse: spacelike-only, counting, order-independence, missing-probe skip ──────────────────────────

// Fork DAG: R root; X,Y both children of R ⇒ X,Y are SPACELIKE.
let private forkDag = Map.ofList [ "R", []; "X", [ "R" ]; "Y", [ "R" ] ]
// Chain DAG: Y is a child of X ⇒ X,Y are TIMELIKE (ancestor-related), CHSH-invalid.
let private chainDag = Map.ofList [ "X", []; "Y", [ "X" ] ]

[<Fact>]
let ``fuse convicts a spacelike S=4 pair`` () =
    let a, b = s4pair 25
    let probes = Map.ofList [ "X", a; "Y", b ]
    let reading = DMeter.fuse 0.05 forkDag probes [ "X"; "Y" ]
    Assert.Equal(1, reading.SpacelikePairs)
    Assert.Equal(1, reading.AboveBound)
    Assert.Equal(0, reading.WithinBound)

// The load-bearing tie: CHSH is fused ONLY over spacelike pairs. A timelike pair (even a screaming
// S=4 one) is NOT metered — signaling is allowed there, so |S|>2 is not a valid conviction.
[<Fact>]
let ``fuse meters spacelike pairs ONLY - a timelike pair is excluded`` () =
    let a, b = s4pair 25
    let probes = Map.ofList [ "X", a; "Y", b ]
    let reading = DMeter.fuse 0.05 chainDag probes [ "X"; "Y" ]
    Assert.Equal(0, reading.SpacelikePairs) // X,Y are timelike ⇒ no CHSH-valid pair
    Assert.Equal(0, reading.AboveBound)

[<Fact>]
let ``fuse is order-independent (commutative count-fold over canonical pairs)`` () =
    let a, b = s4pair 25
    let probes = Map.ofList [ "X", a; "Y", b ]
    Assert.Equal(DMeter.fuse 0.05 forkDag probes [ "X"; "Y" ], DMeter.fuse 0.05 forkDag probes [ "Y"; "X" ])

[<Fact>]
let ``fuse skips a pair missing a probe on either end (no reading, no conviction)`` () =
    let a, _ = s4pair 25
    let probes = Map.ofList [ "X", a ] // Y has no probe
    let reading = DMeter.fuse 0.05 forkDag probes [ "X"; "Y" ]
    Assert.Equal(0, reading.SpacelikePairs)

// WithinBoundFraction = fraction with NO channel/superdeterminism detected (NOT a decorrelation
// measure — renamed from the false-green DecorrelatedFraction; see the module SOUNDNESS block).
[<Fact>]
let ``WithinBoundFraction is nan with no pairs and 1.0 when all within the classical bound`` () =
    let empty = DMeter.fuse 0.05 forkDag Map.empty [ "X"; "Y" ]
    Assert.True(System.Double.IsNaN empty.WithinBoundFraction)
    let a, _ = s4pair 25
    let probes = Map.ofList [ "X", a; "Y", a ] // identical ⇒ S=2 ⇒ within bound (NOT proof of independence)
    let reading = DMeter.fuse 0.05 forkDag probes [ "X"; "Y" ]
    Assert.Equal(1, reading.WithinBound)
    Assert.Equal(1.0, reading.WithinBoundFraction)
