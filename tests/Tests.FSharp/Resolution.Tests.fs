module Zeta.Tests.ResolutionTests

// Resolution — the self-budgeting cell ("the first bit that knows when it needs more bits",
// ferry 20 §5). Exercised over BOTH UniversalNumber adapters (bigInt: always exact; Ball: the
// inexact bound carrier) so the seed cell is port-generic, not bigint-specific.

open System.Numerics
open global.Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Core
open Zeta.Core.FSharp.TriBoolean

let private big (n: int) = BigInteger(n)
let private ball c r = match Ball.create (big c) (big r) with Ok b -> b | Error e -> failwith e

[<Fact>]
let ``read reports signal bits and exactness through the bigInt port`` () =
    let r = Resolution.read UniversalNumber.bigInt (big 0)
    Assert.Equal(0, r.SignalBits)
    Assert.True(r.IsExact)
    let r2 = Resolution.read UniversalNumber.bigInt (big 255) // 8 bits
    Assert.Equal(8, r2.SignalBits)
    Assert.True(r2.IsExact)

[<Fact>]
let ``sufficientFor is the "am I wide enough" question`` () =
    Assert.True(Resolution.sufficientFor 8 UniversalNumber.bigInt (big 255)) // 8 bits >= 8
    Assert.False(Resolution.sufficientFor 9 UniversalNumber.bigInt (big 255)) // 8 bits < 9

[<Fact>]
let ``deficit quantifies the demand for more bits and is never negative`` () =
    Assert.Equal(0, Resolution.deficit 4 UniversalNumber.bigInt (big 255)) // surplus -> 0, not -4
    Assert.Equal(2, Resolution.deficit 10 UniversalNumber.bigInt (big 255)) // short by 2

[<Fact>]
let ``decide returns Hold when sufficient and Widen by the deficit when short`` () =
    Assert.Equal(Resolution.Hold, Resolution.decide 8 UniversalNumber.bigInt (big 255))
    Assert.Equal(Resolution.Widen 2, Resolution.decide 10 UniversalNumber.bigInt (big 255))

[<Fact>]
let ``the cell is port-generic: Ball (inexact carrier) reads fewer signal bits as the radius grows`` () =
    // exact ball: full signal; widened ball: signal shrinks (radius eats low bits) -> needs more.
    let exact = Ball.exact (big 255)
    let fuzzy = ball 255 15 // radius 15 ~ 4 noise bits
    let sExact = Resolution.read Ball.universal exact
    let sFuzzy = Resolution.read Ball.universal fuzzy
    Assert.True(sExact.IsExact)
    Assert.False(sFuzzy.IsExact)
    Assert.True(sFuzzy.SignalBits < sExact.SignalBits, "noise must lower the signal-bit count")

[<Property>]
let ``deficit is exactly the shortfall: deficit r + min(bits, r) = r`` (required: int) =
    let req = abs required % 64
    let v = big 255 // 8 signal bits on the bigInt port
    let bits = UniversalNumber.bigInt.BitsUsed v
    Resolution.deficit req UniversalNumber.bigInt v + min bits req = req

[<Property>]
let ``decide agrees with sufficientFor`` (required: int) =
    let req = abs required % 64
    let v = big 1000
    match Resolution.decide req UniversalNumber.bigInt v with
    | Resolution.Hold -> Resolution.sufficientFor req UniversalNumber.bigInt v
    | Resolution.Widen n -> n > 0 && not (Resolution.sufficientFor req UniversalNumber.bigInt v)

[<Property>]
let ``ceiling is the max-monoid: idempotent and order-free`` (xs: int list) =
    let demands = xs |> List.map (fun x -> abs x % 1000)
    let c = Resolution.ceiling demands
    // idempotent: folding the result back in changes nothing
    Resolution.ceiling (c :: demands) = c
    // order-free: reversal agrees
    && Resolution.ceiling (List.rev demands) = c
