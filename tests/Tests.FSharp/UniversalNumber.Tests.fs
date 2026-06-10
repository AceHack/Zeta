module Zeta.Tests.UniversalNumberTests

open System.Numerics
open global.Xunit
open Zeta.Core

let private n = UniversalNumber.bigInt

[<Fact>]
let ``bigint adapter: zero/one identities`` () =
    Assert.Equal(BigInteger.Zero, n.Zero)
    Assert.Equal(BigInteger.One, n.One)
    let x = BigInteger 42
    Assert.Equal(x, n.Add x n.Zero) // additive identity
    Assert.Equal(x, n.Mul x n.One) // multiplicative identity
    Assert.Equal(BigInteger.Zero, n.Mul x n.Zero) // annihilator

[<Fact>]
let ``bigint adapter: add and mul are exact + arbitrary precision`` () =
    let big = BigInteger.Pow(BigInteger 2, 200) // way past int64
    Assert.Equal(BigInteger.Pow(BigInteger 2, 201), n.Add big big) // 2^200 + 2^200 = 2^201
    Assert.Equal(BigInteger.Pow(BigInteger 2, 400), n.Mul big big) // 2^200 * 2^200 = 2^400

[<Fact>]
let ``bigint adapter: BitsUsed = bit length (resolution accounting)`` () =
    Assert.Equal(0, n.BitsUsed BigInteger.Zero)
    Assert.Equal(1, n.BitsUsed BigInteger.One)
    Assert.Equal(8, n.BitsUsed (BigInteger 255)) // 0b1111_1111
    Assert.Equal(9, n.BitsUsed (BigInteger 256)) // 0b1_0000_0000
    Assert.Equal(201, n.BitsUsed (BigInteger.Pow(BigInteger 2, 200))) // 2^200 → 201 bits

[<Fact>]
let ``bigint adapter: BitsUsed handles negatives by magnitude`` () =
    Assert.Equal(8, n.BitsUsed (BigInteger -255))

[<Fact>]
let ``bigint adapter: integers are always exact (no ULP loss)`` () =
    Assert.True(n.IsExact BigInteger.Zero)
    Assert.True(n.IsExact (BigInteger.Pow(BigInteger 2, 500)))
