module Zeta.Tests.PhasorEnduranceTests

open global.Xunit
open Zeta.Core
open Zeta.Core.PhasorEndurance

let private pi = System.Math.PI

[<Fact>]
let ``the Z-set delta lives on the unit circle: +1 = (1,0), -1 = (-1,0) = e^iπ`` () =
    Assert.Equal(1.0, genuineDelta.Real, 10)
    Assert.Equal(0.0, genuineDelta.Imag, 10)
    Assert.Equal(-1.0, retractionDelta.Real, 10)
    Assert.Equal(0.0, retractionDelta.Imag, 10)

[<Fact>]
let ``a -1 retraction IS a 180° rotation: retract(+1) = -1`` () =
    let r = retract genuineDelta
    Assert.Equal(retractionDelta.Real, r.Real, 10)
    Assert.Equal(retractionDelta.Imag, r.Imag, 10)

[<Fact>]
let ``retraction is an involution: retract∘retract = id (the +1/-1 round trip)`` () =
    let z = phasor 1.0 (pi / 3.0)
    let rr = retract (retract z)
    Assert.Equal(z.Real, rr.Real, 10)
    Assert.Equal(z.Imag, rr.Imag, 10)

[<Fact>]
let ``Born rule: |unit phasor|² = 1; probability is the squared amplitude`` () =
    Assert.Equal(1.0, bornProbability (heartbeat 0.0), 10)
    Assert.Equal(1.0, bornProbability (heartbeat (pi / 4.0)), 10)
    Assert.Equal(4.0, bornProbability (phasor 2.0 1.23), 10) // |2·e^{iφ}|² = 4

[<Fact>]
let ``overlap from phasor sum = cos²(Δφ/2): 1 in-phase, ½ at 90°, 0 anti-phase`` () =
    Assert.Equal(1.0, overlap 0.0 0.0, 10)
    Assert.Equal(0.5, overlap 0.0 (pi / 2.0), 10)
    Assert.Equal(0.0, overlap 0.0 pi, 10)

[<Fact>]
let ``phasor overlap equals the Bayesian-free phase model (same number, two derivations)`` () =
    for dphi in [ 0.0; pi / 6.0; pi / 2.0; 2.0 * pi / 3.0; pi ] do
        Assert.Equal(SymmetricEndurance.phaseOverlap dphi, overlap 0.0 dphi, 10)

[<Fact>]
let ``superposition: in-phase magnitude 2 (constructive), anti-phase 0 (destructive)`` () =
    Assert.Equal(2.0, magnitude (combine (heartbeat 0.0) (heartbeat 0.0)), 10)
    Assert.Equal(0.0, magnitude (combine (heartbeat 0.0) (heartbeat pi)), 10)

[<Fact>]
let ``deterministic / replayable (DST)`` () =
    Assert.Equal(overlap 0.3 1.7, overlap 0.3 1.7, 12)
