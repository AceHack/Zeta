module Zeta.Tests.DurableYinYangTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Core.Bonsai


// ═══════════════════════════════════════════════════════════════════
// DurableYinYang.evolve — apply a cell's Acts to (remains, input) and snap.
// Binding convention: Param "remains" = yin state, Param "input" = shadow input.
// Held / malformed Acts ⇒ keep prior Remains (the cell holds; never corrupts).
// ═══════════════════════════════════════════════════════════════════

// Acts: remains + input  (the cell accumulates its shadow inputs)
let private accumulate = Binary(Add, Param "remains", Param "input")

let private dvShould (expected: DynamicValue) (actual: DynamicValue) =
    if actual = expected then () else failwithf "expected %A, got %A" expected actual


[<Fact>]
let ``evolve binds remains+input and moves the state when confident`` () =
    DurableYinYang.evolve accumulate 1.0 (DynamicValue.Int 10L) (DynamicValue.Int 5L)
    |> dvShould (DynamicValue.Int 15L)


[<Fact>]
let ``evolve folds a sequence of inputs through Acts`` () =
    let final =
        [ 1L; 2L; 3L; 4L ]
        |> List.fold (fun remains i -> DurableYinYang.evolve accumulate 1.0 remains (DynamicValue.Int i)) (DynamicValue.Int 0L)
    final |> dvShould (DynamicValue.Int 10L)


[<Fact>]
let ``a malformed Acts holds the prior Remains (never corrupts)`` () =
    // Lambda is unsupported by BonsaiSoft v1 -> Error -> cell holds.
    DurableYinYang.evolve (Lambda([ "x" ], Param "x")) 1.0 (DynamicValue.Int 7L) (DynamicValue.Int 99L)
    |> dvShould (DynamicValue.Int 7L)


[<Fact>]
let ``the input param is the shadow channel — Acts may ignore it`` () =
    // Acts that ignores input entirely (identity on remains): the shadow proposes, the cell decides.
    DurableYinYang.evolve (Param "remains") 1.0 (DynamicValue.Int 42L) (DynamicValue.Int 99L)
    |> dvShould (DynamicValue.Int 42L)
