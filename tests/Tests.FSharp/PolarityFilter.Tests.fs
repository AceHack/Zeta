module Zeta.Tests.PolarityFilterTests

open global.Xunit
open Zeta.Core

let private pi = System.Math.PI

[<Fact>]
let ``Malus: aligned transmits all, crossed blocks all, 45deg halves (= Born projection)`` () =
    Assert.Equal(1.0, PolarityFilter.transmit 0.0 0.0, 10) // aligned
    Assert.Equal(0.0, PolarityFilter.transmit (pi / 2.0) 0.0, 10) // crossed (90deg)
    Assert.Equal(0.5, PolarityFilter.transmit (pi / 4.0) 0.0, 10) // 45deg -> half

[<Fact>]
let ``findOrientation recovers the signal's orientation (the lens) by sweeping filters`` () =
    let signal = 0.9 // radians
    let best, thru = PolarityFilter.findOrientation 180 signal
    Assert.True(abs (best - signal) < (pi / 180.0) + 1e-9 || abs (best - signal) > pi - (pi / 180.0)) // within sweep res (mod pi)
    Assert.True(thru > 0.999) // near-perfect transmission at alignment

[<Fact>]
let ``dominantOrientation finds the field's lens from a ray bundle`` () =
    // a bundle clustered near 0.5 rad (+ a couple of outliers)
    let rays = [ 0.50; 0.52; 0.48; 0.51; 0.49; 2.0 ]
    let dom = PolarityFilter.dominantOrientation 180 rays
    Assert.True(abs (dom - 0.5) < 0.1) // recovers the dominant orientation
