module Zeta.Tests.Operators.ResidualMaxTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


[<Fact>]
let ``ResidualMax emits ValueNone on empty input`` () =
    let c = Circuit()
    let _input = c.ZSetInput<int>()
    let m = c.ResidualMax(_input.Stream, Func<_, _>(id))
    let out = OutputHandle m.Op
    c.Build()
    c.Step()
    out.Current |> should equal (ValueNone : int voption)


[<Fact>]
let ``ResidualMax tracks running max under pure inserts`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let m = c.ResidualMax(input.Stream, Func<_, _>(id))
    let out = OutputHandle m.Op
    c.Build()
    input.Send (ZSet.singleton 5 1L)
    c.Step()
    out.Current |> should equal (ValueSome 5)
    input.Send (ZSet.singleton 17 1L)
    c.Step()
    out.Current |> should equal (ValueSome 17)
    input.Send (ZSet.singleton 3 1L)
    c.Step()
    out.Current |> should equal (ValueSome 17)


[<Fact>]
let ``ResidualMax retracts top and falls back to next (O(log k) path)`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let m = c.ResidualMax(input.Stream, Func<_, _>(id))
    let out = OutputHandle m.Op
    c.Build()
    input.Send (ZSet.ofSeq [ 5, 1L; 17, 1L; 3, 1L ])
    c.Step()
    out.Current |> should equal (ValueSome 17)
    // Retract the top (negative weight).
    input.Send (ZSet.singleton 17 -1L)
    c.Step()
    out.Current |> should equal (ValueSome 5)
    // Retract the new top.
    input.Send (ZSet.singleton 5 -1L)
    c.Step()
    out.Current |> should equal (ValueSome 3)
    // Retract the last.
    input.Send (ZSet.singleton 3 -1L)
    c.Step()
    out.Current |> should equal (ValueNone : int voption)
