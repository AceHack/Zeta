module Zeta.Tests.PolicyTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Policy kernel — the typed decision-with-feedback register (081KT7YW00008QG0R003N6PF8A #1).
//   - ofPredicate selects the right branch (decision + feedback).
//   - firstMatch: order wins; dflt fires when nothing matches.
//   - map / mapFeedback / contramap: profunctor identity + composition laws.
//   - a policy is pure / total (same input → same result, never throws).
// Policies are compared by sampling inputs (extensional equality), since a
// Policy<'i,'d,'f> is a function.
// ═══════════════════════════════════════════════════════════════════

// a sample arbitrary policy over int: even → ("E","even-fb"); else ("O","odd-fb").
let private isEven: Predicate.Predicate<int> = fun n -> n % 2 = 0

let private samplePolicy: Policy.Policy<int, string, string> =
    Policy.ofPredicate isEven ("E", "even-fb") ("O", "odd-fb")

let private inputs = [ -5 .. 5 ]

// ── ofPredicate ──
[<Fact>]
let ``ofPredicate picks ifTrue branch with its feedback when predicate holds`` () =
    let r = samplePolicy 4
    Assert.Equal("E", r.Decision)
    Assert.Equal("even-fb", r.Feedback)

[<Fact>]
let ``ofPredicate picks ifFalse branch with its feedback when predicate fails`` () =
    let r = samplePolicy 3
    Assert.Equal("O", r.Decision)
    Assert.Equal("odd-fb", r.Feedback)

// ── firstMatch ──
[<Fact>]
let ``firstMatch: first matching predicate wins (order matters)`` () =
    let p: Policy.Policy<int, string, string> =
        Policy.firstMatch
            [ ((fun n -> n > 0), "pos", "is-positive")
              ((fun n -> n > 5), "big", "is-big") ]
            ("dflt", "default")
    // 10 satisfies both; the FIRST case wins.
    let r = p 10
    Assert.Equal("pos", r.Decision)
    Assert.Equal("is-positive", r.Feedback)

[<Fact>]
let ``firstMatch: dflt fires when no predicate matches`` () =
    let p: Policy.Policy<int, string, string> =
        Policy.firstMatch [ ((fun n -> n > 100), "big", "big") ] ("dflt", "none-matched")
    let r = p 3
    Assert.Equal("dflt", r.Decision)
    Assert.Equal("none-matched", r.Feedback)

[<Fact>]
let ``always: constant decision + feedback regardless of input`` () =
    let p: Policy.Policy<int, string, string> = Policy.always "K" "konst"
    for x in inputs do
        let r = p x
        Assert.Equal("K", r.Decision)
        Assert.Equal("konst", r.Feedback)

// ── profunctor laws (sampled extensional equality) ──
let private genPolicy: Gen<Policy.Policy<int, int, int>> =
    Gen.listOf (Gen.choose (-20, 20))
    |> Gen.map (fun xs ->
        let s = Set.ofList xs
        Policy.ofPredicate (Predicate.ofSet s) (1, 100) (0, 200))

type PolicyArb() =
    static member Policy() = Arb.fromGen genPolicy

let private agreeP (p: Policy.Policy<int, 'd, 'f>) (q: Policy.Policy<int, 'd, 'f>) : bool =
    inputs |> List.forall (fun x -> p x = q x)

// map identity:  map id = id
[<Property(Arbitrary = [| typeof<PolicyArb> |])>]
let ``map identity`` (p: Policy.Policy<int, int, int>) = agreeP (Policy.map id p) p

// map composition:  map (g << f) = map g << map f
[<Property(Arbitrary = [| typeof<PolicyArb> |])>]
let ``map composition`` (p: Policy.Policy<int, int, int>) =
    let f = (fun (d: int) -> d + 1)
    let g = (fun (d: int) -> d * 3)
    agreeP (Policy.map (f >> g) p) (Policy.map g (Policy.map f p))

// mapFeedback identity
[<Property(Arbitrary = [| typeof<PolicyArb> |])>]
let ``mapFeedback identity`` (p: Policy.Policy<int, int, int>) = agreeP (Policy.mapFeedback id p) p

// mapFeedback composition
[<Property(Arbitrary = [| typeof<PolicyArb> |])>]
let ``mapFeedback composition`` (p: Policy.Policy<int, int, int>) =
    let f = (fun (x: int) -> x - 2)
    let g = (fun (x: int) -> x * x)
    agreeP (Policy.mapFeedback (f >> g) p) (Policy.mapFeedback g (Policy.mapFeedback f p))

// contramap identity:  contramap id = id
[<Property(Arbitrary = [| typeof<PolicyArb> |])>]
let ``contramap identity`` (p: Policy.Policy<int, int, int>) = agreeP (Policy.contramap id p) p

// contramap composition:  contramap (f << g) = contramap g << contramap f
// (contravariant: order of composition flips relative to map)
[<Property(Arbitrary = [| typeof<PolicyArb> |])>]
let ``contramap composition`` (p: Policy.Policy<int, int, int>) =
    let f = (fun (x: int) -> x + 1)
    let g = (fun (x: int) -> x * 2)
    agreeP (Policy.contramap (f >> g) p) (Policy.contramap f (Policy.contramap g p))

// ── purity / totality ──
[<Property(Arbitrary = [| typeof<PolicyArb> |])>]
let ``policy is pure: same input yields the same result`` (p: Policy.Policy<int, int, int>) (x: int) =
    p x = p x

[<Property(Arbitrary = [| typeof<PolicyArb> |])>]
let ``policy is total: never throws on any int input`` (p: Policy.Policy<int, int, int>) (x: int) =
    let _ = p x
    true
