module Zeta.Tests.MaybeTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Maybe — the value-level absence monad. Priority (Aaron): monad-compatibility over
// SQL-exactness — so these tests prove the MONAD LAWS (left id, right id, associativity) +
// functor/applicative laws, plus the propagation property (Nothing + 5 = Nothing) and the
// never-collapse distinction (Nothing ≠ a present sentinel). SQL 3VL is a future bridge ON
// TOP of this, not this type.
// ═══════════════════════════════════════════════════════════════════

let private genMaybe : Gen<Maybe<int>> =
    Gen.oneof [ Gen.constant Nothing; Gen.choose (-1000, 1000) |> Gen.map Just ]

type MaybeArb() =
    static member M() = Arb.fromGen genMaybe

// ── monad laws ──

[<Property>]
let ``Maybe monad: left identity — bind (ret a) f = f a`` (a: int) =
    let f x = if x % 2 = 0 then Just(x + 1) else Nothing
    Maybe.bind f (Maybe.ret a) = f a

[<Property(Arbitrary = [| typeof<MaybeArb> |])>]
let ``Maybe monad: right identity — bind m ret = m`` (m: Maybe<int>) =
    Maybe.bind Maybe.ret m = m

[<Property(Arbitrary = [| typeof<MaybeArb> |])>]
let ``Maybe monad: associativity — bind (bind m f) g = bind m (x -> bind (f x) g)`` (m: Maybe<int>) =
    let f x = if x > 0 then Just(x * 2) else Nothing
    let g x = if x < 500 then Just(x - 3) else Nothing
    Maybe.bind g (Maybe.bind f m) = Maybe.bind (fun x -> Maybe.bind g (f x)) m

// ── functor laws ──

[<Property(Arbitrary = [| typeof<MaybeArb> |])>]
let ``Maybe functor: map id = id`` (m: Maybe<int>) =
    Maybe.map id m = m

[<Property(Arbitrary = [| typeof<MaybeArb> |])>]
let ``Maybe functor: map (f >> g) = map f >> map g`` (m: Maybe<int>) =
    let f x = x + 7
    let g x = x * 3
    Maybe.map (f >> g) m = (Maybe.map g (Maybe.map f m))

// ── the propagation property (the point: Nothing + 5 = Nothing) ──

[<Fact>]
let ``Maybe: map2 propagates — Nothing combined with anything is Nothing, Just+Just computes`` () =
    let add = Maybe.map2 (+)
    Assert.Equal(Nothing, add Nothing (Just 5)) // Nothing + 5 = Nothing
    Assert.Equal(Nothing, add (Just 5) Nothing) // 5 + Nothing = Nothing
    Assert.Equal(Just 12, add (Just 5) (Just 7))
    Assert.Equal(Nothing, add Nothing Nothing)

[<Property(Arbitrary = [| typeof<MaybeArb> |])>]
let ``Maybe: map2 is Nothing iff either operand is Nothing (strict propagation)`` (a: Maybe<int>) (b: Maybe<int>) =
    let r = Maybe.map2 (+) a b
    Maybe.isNothing r = (Maybe.isNothing a || Maybe.isNothing b)

// ── never-collapse: Nothing is distinct from any present sentinel ──

[<Fact>]
let ``Maybe: Nothing is never equal to a present value (no collapse to 0/empty)`` () =
    Assert.NotEqual<Maybe<int>>(Nothing, Just 0)
    Assert.NotEqual<Maybe<string>>(Nothing, Just "")
    // option bridge round-trips both states distinctly
    Assert.Equal(Nothing, Maybe.ofOption None)
    Assert.Equal(Just 0, Maybe.ofOption (Some 0))
    Assert.Equal<int option>(None, Maybe.toOption Nothing)
    Assert.Equal<int option>(Some 0, Maybe.toOption (Just 0))

[<Property(Arbitrary = [| typeof<MaybeArb> |])>]
let ``Maybe: ofOption ∘ toOption = id (faithful bridge)`` (m: Maybe<int>) =
    Maybe.ofOption (Maybe.toOption m) = m
