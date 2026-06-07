module Zeta.Tests.SagaSnapshotTests

open global.Xunit
open Zeta.Core

module SS = Zeta.Core.SagaSnapshot

// a small pattern: fun x -> if x then 1 else 2   (exercises Lambda/Cond/Const/Var)
let private pattern () =
    Bonsai.Expr.Lambda(
        [ "x" ],
        Bonsai.Expr.Cond(
            Bonsai.Expr.Param "x",
            Bonsai.Expr.Const(Bonsai.ConstValue.CInt 1L),
            Bonsai.Expr.Const(Bonsai.ConstValue.CInt 2L)
        )
    )

let private state () =
    DynamicValue.Object [ "step", DynamicValue.Int 3L; "acc", DynamicValue.String "partial" ]

[<Fact>]
let ``resume restores pattern and state directly (resume-not-replay)`` () =
    let snap = SS.create (pattern ()) (state ()) 7L
    let p, s = SS.resume snap
    Assert.Equal<Bonsai.Expr>(pattern (), p) // pattern restored as-is
    Assert.Equal<DynamicValue>(state (), s) // state restored as-is, not recomputed

[<Fact>]
let ``toDynamic then ofDynamic round-trips the whole snapshot`` () =
    let snap = SS.create (pattern ()) (state ()) 7L

    match SS.toDynamic snap with
    | Ok dv ->
        match SS.ofDynamic dv with
        | Ok back ->
            Assert.Equal<Bonsai.Expr>(snap.Pattern, back.Pattern)
            Assert.Equal<DynamicValue>(snap.State, back.State)
            Assert.Equal(snap.Seq, back.Seq)
        | Error f -> Assert.Fail $"ofDynamic declined: {f}"
    | Error f -> Assert.Fail $"toDynamic declined: {f}"

[<Fact>]
let ``advance bumps the cursor and updates state, pattern unchanged`` () =
    let snap = SS.create (pattern ()) (state ()) 7L
    let next = SS.advance (DynamicValue.Object [ "step", DynamicValue.Int 4L ]) snap
    Assert.Equal(8L, next.Seq)
    Assert.Equal<DynamicValue>(DynamicValue.Object [ "step", DynamicValue.Int 4L ], next.State)
    Assert.Equal<Bonsai.Expr>(pattern (), next.Pattern) // pattern survives a state advance

[<Fact>]
let ``evolvePattern swaps the pattern in flight (pattern-as-data) while state persists`` () =
    let snap = SS.create (pattern ()) (state ()) 7L
    // the replay family cannot do this: change the PATTERN mid-saga without losing accumulated state
    let newPattern = Bonsai.Expr.Const(Bonsai.ConstValue.CInt 99L)
    let evolved = SS.evolvePattern newPattern snap
    Assert.Equal<Bonsai.Expr>(newPattern, evolved.Pattern) // pattern evolved
    Assert.Equal<DynamicValue>(state (), evolved.State) // state preserved across pattern change
    Assert.Equal(7L, evolved.Seq)

[<Fact>]
let ``ofDynamic declines a malformed snapshot object`` () =
    match SS.ofDynamic (DynamicValue.Object [ "pattern", DynamicValue.String "not-bonsai" ]) with
    | Error _ -> () // missing state/seq (and/or unparseable pattern) -> clean Error, no throw
    | Ok _ -> Assert.Fail "expected a malformed snapshot to decline"
