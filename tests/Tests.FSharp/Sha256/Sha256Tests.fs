module Zeta.Tests.FSharp.Sha256.Sha256Tests

open System.Text
open Xunit
open Zeta.Core.FSharp.Sha256

[<Fact>]
let ``sha256 of empty string`` () =
    let input = Encoding.UTF8.GetBytes ""
    let hex = sha256Hex input
    Assert.Equal("e3b0c44298fc1c149afbf4c8996fb924" +
                 "27ae41e4649b934ca495991b7852b855", hex)

[<Fact>]
let ``sha256 of abc`` () =
    let input = Encoding.UTF8.GetBytes "abc"
    let hex = sha256Hex input
    Assert.Equal("ba7816bf8f01cfea414140de5dae2223" +
                 "b00361a396177a9cb410ff61f20015ad", hex)

[<Fact>]
let ``sha256 of nist two-block`` () =
    let input = Encoding.UTF8.GetBytes "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
    let hex = sha256Hex input
    Assert.Equal("248d6a61d20638b8e5c026930c3e6039" +
                 "a33ce45964ff2167f6ecedd419db06c1", hex)

[<Fact>]
let ``sha256 returns 32 bytes`` () =
    let input = Encoding.UTF8.GetBytes "test"
    let hash = sha256 input
    Assert.Equal(32, hash.Length)
