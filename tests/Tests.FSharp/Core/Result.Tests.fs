module Zeta.Tests.ResultTests

open global.Xunit
open Zeta.Core

type private Feedback =
    | MissingInput
    | BadNumber

let private parseInt (s: string) =
    match System.Int32.TryParse s with
    | true, value -> Ok value
    | false, _ -> Error BadNumber

[<Fact>]
let ``result computation expression composes the success value channel`` () =
    let actual =
        result {
            let! a = parseInt "2"
            let! b = parseInt "40"
            return a + b
        }

    Assert.Equal<Result<int, Feedback>>(Ok 42, actual)

[<Fact>]
let ``result computation expression short-circuits on the authored feedback channel`` () =
    let mutable ranAfterError = false

    let actual =
        result {
            let! _ = Error MissingInput
            ranAfterError <- true
            let! n = parseInt "40"
            return n
        }

    Assert.False(ranAfterError)
    Assert.Equal<Result<int, Feedback>>(Error MissingInput, actual)

[<Fact>]
let ``result computation expression propagates return-from feedback without translation`` () =
    let actual =
        result {
            let! _ = parseInt "nope"
            return! Ok 1
        }

    Assert.Equal<Result<int, Feedback>>(Error BadNumber, actual)
