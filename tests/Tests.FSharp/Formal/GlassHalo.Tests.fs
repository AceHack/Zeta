module Zeta.Tests.Formal.GlassHaloTests

open FsCheck
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

// ─────────────────────────────────────────────────────────────────────────────────────────
// CHANGED TEST — READ THIS BEFORE TRUSTING THE DIFF.
//
// This test used to read:
//
//     let ``clearing is free and returns to the transparent default`` () =
//         let frosted = GlassHalo.Frosted 10
//         Assert.Equal(GlassHalo.Clear, GlassHalo.clear frosted)
//         Assert.True(GlassHalo.isVisible (GlassHalo.clear frosted))
//
// It PASSED, and it was changed anyway. Changing a passing test so new behaviour goes green is
// normally the exact move this repo forbids, so the justification has to be on the record:
//
// The test pinned behaviour that contradicted its own governing rule. `GlassHalo.clear` took no
// principal, so *anyone* could defrost *anyone* and the call could not fail — while
// `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` says "there is no `defrost`
// that another party can force — only the owner may reveal", and lists **confiscate — anyone
// else — never** as the one prohibited operation of three. Two surfaces in the repo disagreed;
// the rule is the governing one, so the test moved rather than the rule.
//
// What is preserved: clearing is still FREE IN BUDGET and still returns to the transparent
// default. Only the "anyone may do it" half is gone. See work-item 081M0X23R19087G0R003XHGB2B.
// ─────────────────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``the owner clearing is free and returns to the transparent default`` () =
    let frosted = GlassHalo.Frosted 10

    match GlassHalo.clear "amara" "amara" frosted with
    | Ok cleared ->
        Assert.Equal(GlassHalo.Clear, cleared)
        Assert.True(GlassHalo.isVisible cleared)
    | Error e -> failwith e

[<Fact>]
let ``a NON-OWNER cannot defrost: confiscation is refused`` () =
    let frosted = GlassHalo.Frosted 10

    match GlassHalo.clear "otto" "amara" frosted with
    | Ok _ -> failwith "a non-owner defrosted a frosted surface: privacy budget was confiscated"
    | Error reason ->
        Assert.Contains("only the owner may defrost", reason)
        // And the surface is genuinely untouched — the refusal is not cosmetic.
        Assert.False(GlassHalo.isVisible frosted)

[<Property>]
let ``no principal other than the owner can ever defrost`` (requester: NonNull<string>) (owner: NonNull<string>) =
    let r = requester.Get
    let o = owner.Get

    match GlassHalo.clear r o (GlassHalo.Frosted 10) with
    | Ok _ -> System.String.Equals(r, o, System.StringComparison.Ordinal)
    | Error _ -> not (System.String.Equals(r, o, System.StringComparison.Ordinal))

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
        && (match GlassHalo.clear "owner" "owner" v with
            | Ok cleared -> GlassHalo.isVisible cleared
            | Error _ -> false)
    | Error _ ->
        // failure only when we couldn't afford it (budget unchanged conceptually)
        a < c
