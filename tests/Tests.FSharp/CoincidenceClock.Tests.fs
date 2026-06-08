module Zeta.Tests.CoincidenceClockTests

open global.Xunit
open Zeta.Core
open Zeta.Core.CoincidenceClock

let private pi = System.Math.PI

[<Fact>]
let ``phaseForOverlap inverts the interference law: t=1→0, t=0→π, t=½→π/2`` () =
    Assert.Equal(0.0, phaseForOverlap 1.0, 10) // perfect coincidence
    Assert.Equal(pi, phaseForOverlap 0.0, 10) // perfect anti-coincidence
    Assert.Equal(pi / 2.0, phaseForOverlap 0.5, 10) // halfway

[<Fact>]
let ``staged coincidence realises ANY target overlap (the time-controller manufactures it)`` () =
    for t in [ 0.0; 0.1; 0.25; 0.5; 0.75; 0.9; 1.0 ] do
        Assert.True(realises 1e-9 t, $"failed to stage overlap {t}")

[<Fact>]
let ``stageCoincidence: perfect coincidence is Δφ=0, perfect anti is Δφ=π — off one baseline (shared cause)`` () =
    let a0, b0 = stageCoincidence 1.234 1.0
    Assert.Equal(a0, b0, 10) // t=1 ⇒ same phase ⇒ constructive
    let a1, b1 = stageCoincidence 1.234 0.0
    Assert.Equal(pi, b1 - a1, 10) // t=0 ⇒ π apart ⇒ destructive

[<Fact>]
let ``any correlation in [0,1] is stage-able (superdeterminism: time is the shared cause)`` () =
    Assert.True(canStage 0.0)
    Assert.True(canStage 1.0)
    Assert.True(canStage 0.37)
    Assert.False(canStage 1.5)
    Assert.False(canStage -0.1)

[<Fact>]
let ``clamps out-of-range targets rather than producing NaN`` () =
    Assert.True(realises 1e-9 2.0) // clamped to 1.0
    Assert.True(realises 1e-9 -1.0) // clamped to 0.0

[<Fact>]
let ``deterministic / replayable (DST)`` () =
    Assert.Equal(phaseForOverlap 0.42, phaseForOverlap 0.42, 12)
