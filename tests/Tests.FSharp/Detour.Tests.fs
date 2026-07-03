module Zeta.Tests.DetourTests

open global.Xunit
open Zeta.Core

// A concrete target under instrumentation: our own pure function.
let private priceWithTax (cents: int) : int = cents + (cents / 10)

[<Fact>]
let ``identity attaches nothing`` () =
    let hooked = Detour.attach Detour.identity priceWithTax
    Assert.Equal(priceWithTax 100, hooked 100)

[<Fact>]
let ``before observes the argument without changing the result`` () =
    let seen = ResizeArray<int>()
    let hooked = Detour.attach (Detour.before seen.Add) priceWithTax
    let result = hooked 200
    Assert.Equal(priceWithTax 200, result) // behaviour preserved
    Assert.Equal<int list>([ 200 ], List.ofSeq seen) // observed the input

[<Fact>]
let ``after observes the result without changing it`` () =
    let seen = ResizeArray<int>()
    let hooked = Detour.attach (Detour.after seen.Add) priceWithTax
    let result = hooked 100
    Assert.Equal(110, result)
    Assert.Equal<int list>([ 110 ], List.ofSeq seen)

[<Fact>]
let ``around reports find-what-writes pairs (arg, result)`` () =
    let ledger = ResizeArray<int * int>()
    let hooked = Detour.attach (Detour.around ledger.Add) priceWithTax
    hooked 100 |> ignore
    hooked 50 |> ignore
    Assert.Equal<(int * int) list>([ (100, 110); (50, 55) ], List.ofSeq ledger)

[<Fact>]
let ``mapArg and mapResult are the improve half (they DO change behaviour)`` () =
    let doubledIn = Detour.attach (Detour.mapArg (fun a -> a * 2)) priceWithTax
    Assert.Equal(priceWithTax 200, doubledIn 100)
    let bumpedOut = Detour.attach (Detour.mapResult (fun b -> b + 1)) priceWithTax
    Assert.Equal(priceWithTax 100 + 1, bumpedOut 100)

[<Fact>]
let ``compose is associative and head is outermost`` () =
    let trace = ResizeArray<string>()
    let a : Detour.Detour<int -> int> = fun t x -> trace.Add "a"; t x
    let b : Detour.Detour<int -> int> = fun t x -> trace.Add "b"; t x
    let c : Detour.Detour<int -> int> = fun t x -> trace.Add "c"; t x
    // associativity of the value
    let left = Detour.compose (Detour.compose a b) c
    let right = Detour.compose a (Detour.compose b c)
    trace.Clear()
    (Detour.attach left priceWithTax) 100 |> ignore
    let leftOrder = List.ofSeq trace
    trace.Clear()
    (Detour.attach right priceWithTax) 100 |> ignore
    let rightOrder = List.ofSeq trace
    Assert.Equal<string list>(leftOrder, rightOrder)
    // head outermost: a runs first on the way in
    Assert.Equal<string list>([ "a"; "b"; "c" ], leftOrder)

[<Fact>]
let ``composeAll stacks observe probes; observe never alters the result`` () =
    let log = ResizeArray<string>()
    let probes =
        [ Detour.before (fun (a: int) -> log.Add(sprintf "in:%d" a))
          Detour.after (fun (b: int) -> log.Add(sprintf "out:%d" b)) ]
    let hooked = Detour.attach (Detour.composeAll probes) priceWithTax
    let result = hooked 100
    Assert.Equal(110, result) // observe->report loop left behaviour untouched
    Assert.Equal<string list>([ "in:100"; "out:110" ], List.ofSeq log)

[<Fact>]
let ``identity is the composition unit`` () =
    let d : Detour.Detour<int -> int> = Detour.mapResult (fun b -> b + 7)
    let viaLeft = Detour.attach (Detour.compose Detour.identity d) priceWithTax
    let viaRight = Detour.attach (Detour.compose d Detour.identity) priceWithTax
    Assert.Equal(viaLeft 100, viaRight 100)
    Assert.Equal(priceWithTax 100 + 7, viaLeft 100)
