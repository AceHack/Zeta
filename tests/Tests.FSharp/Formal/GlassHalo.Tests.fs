module Zeta.Tests.Formal.GlassHaloTests

open FsCheck.Xunit
open global.Xunit
open Zeta.Core

// The glass-halo visibility model: visible by DEFAULT, privacy is the EARNED exception (spend
// privacy budget to frost). The load-bearing correction (#8777, #8784) — encoded so it can't
// re-invert to opaque-by-default.

[<Fact>]
let ``default is visible (glass halo)`` () =
    Assert.True(GlassHalo.isVisible GlassHalo.initial)
    Assert.Equal(GlassHalo.Clear, GlassHalo.initial)

[<Fact>]
let ``frosting costs budget and makes the surface opaque`` () =
    match GlassHalo.frost 10 100 GlassHalo.initial with
    | Ok(v, remaining) ->
        Assert.False(GlassHalo.isVisible v)
        Assert.Equal(90, remaining)
        Assert.Equal(GlassHalo.Frosted 10, v)
    | Error e -> failwith e

[<Fact>]
let ``privacy is earned: frosting with zero or negative cost is refused`` () =
    Assert.True(match GlassHalo.frost 0 100 GlassHalo.initial with Error _ -> true | _ -> false)
    Assert.True(match GlassHalo.frost -5 100 GlassHalo.initial with Error _ -> true | _ -> false)

[<Fact>]
let ``insufficient budget cannot buy privacy`` () =
    Assert.True(match GlassHalo.frost 50 10 GlassHalo.initial with Error _ -> true | _ -> false)

[<Fact>]
let ``clearing is free and returns to the transparent default`` () =
    let frosted = GlassHalo.Frosted 10
    Assert.Equal(GlassHalo.Clear, GlassHalo.clear frosted)
    Assert.True(GlassHalo.isVisible (GlassHalo.clear frosted))

[<Fact>]
let ``re-frosting is idempotent: no double-charge, no refund`` () =
    match GlassHalo.frost 10 100 GlassHalo.initial with
    | Ok(once, rem1) ->
        match GlassHalo.frost 10 rem1 once with
        | Ok(twice, rem2) ->
            Assert.Equal(once, twice) // still opaque, unchanged
            Assert.Equal(rem1, rem2) // budget not touched the second time
        | Error e -> failwith e
    | Error e -> failwith e

[<Fact>]
let ``observe shows content when clear, placeholder when frosted`` () =
    Assert.Equal("secret", GlassHalo.observe "private" "secret" GlassHalo.Clear)
    Assert.Equal("private", GlassHalo.observe "private" "secret" (GlassHalo.Frosted 10))

[<Property>]
let ``frosting then clearing is always back to visible, and never overspends`` (cost: int) (avail: int) =
    let c = 1 + (abs cost % 1000)
    let a = abs avail % 5000
    match GlassHalo.frost c a GlassHalo.initial with
    | Ok(v, remaining) ->
        // success requires we could afford it; remaining is non-negative and exactly debited
        remaining >= 0 && remaining = a - c && not (GlassHalo.isVisible v)
        && GlassHalo.isVisible (GlassHalo.clear v)
    | Error _ ->
        // failure only when we couldn't afford it (budget unchanged conceptually)
        a < c
