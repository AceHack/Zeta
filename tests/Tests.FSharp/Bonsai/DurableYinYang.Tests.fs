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


// ── Soft-Remains evolution (maintainer's "soft version of persistence", 2026-06-07) ──────
// Remains is a SoftValue (distribution), persisted soft; evolveSoft folds the soft input
// through Acts WITHOUT snapping (holds the superposition); readSharp snaps only at read.

module SV = Zeta.Core.SoftValue

let private softShould (expected: (DynamicValue * float) list) (sv: SV.SoftValue) =
    let norm xs = xs |> List.sortBy (fun (d, _) -> sprintf "%A" d)
    let a = norm (SV.candidates sv)
    let e = norm expected
    if List.length a <> List.length e then failwithf "distribution size: expected %A got %A" e a
    List.iter2
        (fun (d1, w1) (d2, w2) ->
            if d1 <> d2 || abs (w1 - w2) > 1e-9 then failwithf "expected %A got %A" e a)
        a e

[<Fact>]
let ``SoftValue <-> DynamicValue round-trips`` () =
    let sv = SV.ofWeighted [ DynamicValue.Int 1L, 0.25; DynamicValue.Int 2L, 0.75 ] |> Option.get
    match DurableYinYang.softOfDynamicValue (DurableYinYang.softToDynamicValue sv) with
    | Ok back -> back |> softShould [ DynamicValue.Int 1L, 0.25; DynamicValue.Int 2L, 0.75 ]
    | Error e -> failwithf "round-trip failed: %s" e

[<Fact>]
let ``evolveSoft folds a soft input through Acts and HOLDS the distribution (no snap)`` () =
    // remains = certain 0; input ~ {1:0.5, 2:0.5}; Acts = remains + input -> {1:0.5, 2:0.5}
    let remains = SV.certain (DynamicValue.Int 0L)
    let input = SV.ofWeighted [ DynamicValue.Int 1L, 0.5; DynamicValue.Int 2L, 0.5 ] |> Option.get
    match DurableYinYang.evolveSoft accumulate remains input with
    | Ok next ->
        next |> softShould [ DynamicValue.Int 1L, 0.5; DynamicValue.Int 2L, 0.5 ]
        // held under uncertainty: confidence 0.5
        DurableYinYang.readSharp 0.6 next |> ignore
        if DurableYinYang.readSharp 0.6 next <> None then failwith "expected None (held) above confidence"
        if DurableYinYang.readSharp 0.5 next = None then failwith "expected Some at/below confidence"
    | Error e -> failwithf "evolveSoft failed: %s" e

[<Fact>]
let ``readSharp snaps a certain soft Remains`` () =
    let remains = SV.certain (DynamicValue.Int 5L)
    let input = SV.certain (DynamicValue.Int 7L)
    match DurableYinYang.evolveSoft accumulate remains input with
    | Ok next ->
        if DurableYinYang.readSharp 1.0 next <> Some(DynamicValue.Int 12L) then failwith "expected Some(Int 12)"
    | Error e -> failwithf "evolveSoft failed: %s" e
