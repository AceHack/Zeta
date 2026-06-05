module Zeta.Tests.PredicateTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Predicate kernel — Boolean-algebra LAWS over Predicate<int>.
// Two predicates are EXTENSIONALLY equal iff they agree on every input;
// we approximate that by sampling a generated list of inputs and checking
// they agree on all of them. Predicates are themselves generated as
// membership tests over a random Set<int> (the natural arbitrary predicate).
// ═══════════════════════════════════════════════════════════════════

// generate an arbitrary Predicate<int> as membership in a random int set
let private genPred: Gen<Predicate.Predicate<int>> =
    Gen.listOf (Gen.choose (-20, 20)) |> Gen.map (fun xs -> Predicate.ofSet (Set.ofList xs))

let private genInputs: Gen<int list> = Gen.listOf (Gen.choose (-25, 25))

type PredArb() =
    static member Pred() = Arb.fromGen genPred
    static member Inputs() = Arb.fromGen genInputs

// extensional equality over a sampled domain
let private agree (xs: int list) (p: Predicate.Predicate<int>) (q: Predicate.Predicate<int>) : bool =
    xs |> List.forall (fun x -> p x = q x)

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``andP idempotent`` (p: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.andP p p) p

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``andP commutative`` (p: Predicate.Predicate<int>) (q: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.andP p q) (Predicate.andP q p)

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``andP associative`` (p: Predicate.Predicate<int>) (q: Predicate.Predicate<int>) (r: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.andP (Predicate.andP p q) r) (Predicate.andP p (Predicate.andP q r))

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``orP idempotent`` (p: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.orP p p) p

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``orP commutative`` (p: Predicate.Predicate<int>) (q: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.orP p q) (Predicate.orP q p)

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``orP associative`` (p: Predicate.Predicate<int>) (q: Predicate.Predicate<int>) (r: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.orP (Predicate.orP p q) r) (Predicate.orP p (Predicate.orP q r))

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``De Morgan: not(p and q) = (not p) or (not q)`` (p: Predicate.Predicate<int>) (q: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.notP (Predicate.andP p q)) (Predicate.orP (Predicate.notP p) (Predicate.notP q))

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``De Morgan: not(p or q) = (not p) and (not q)`` (p: Predicate.Predicate<int>) (q: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.notP (Predicate.orP p q)) (Predicate.andP (Predicate.notP p) (Predicate.notP q))

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``distributivity: p and (q or r) = (p and q) or (p and r)`` (p: Predicate.Predicate<int>) (q: Predicate.Predicate<int>) (r: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.andP p (Predicate.orP q r)) (Predicate.orP (Predicate.andP p q) (Predicate.andP p r))

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``distributivity: p or (q and r) = (p or q) and (p or r)`` (p: Predicate.Predicate<int>) (q: Predicate.Predicate<int>) (r: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.orP p (Predicate.andP q r)) (Predicate.andP (Predicate.orP p q) (Predicate.orP p r))

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``complement: p and (not p) = never`` (p: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.andP p (Predicate.notP p)) Predicate.never

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``complement: p or (not p) = always`` (p: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.orP p (Predicate.notP p)) Predicate.always

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``identity: p and always = p`` (p: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.andP p Predicate.always) p

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``identity: p or never = p`` (p: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.orP p Predicate.never) p

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``implies = (not p) or q`` (p: Predicate.Predicate<int>) (q: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.implies p q) (Predicate.orP (Predicate.notP p) q)

[<Property(Arbitrary = [| typeof<PredArb> |])>]
let ``xorP = (p or q) and not(p and q)`` (p: Predicate.Predicate<int>) (q: Predicate.Predicate<int>) (xs: int list) =
    agree xs (Predicate.xorP p q) (Predicate.andP (Predicate.orP p q) (Predicate.notP (Predicate.andP p q)))

[<Fact>]
let ``ofSet is membership`` () =
    let p = Predicate.ofSet (set [ 1; 2; 3 ])
    Assert.True(p 2)
    Assert.False(p 4)
