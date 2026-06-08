module Zeta.Tests.ActionGrammarTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``grid geometry roundtrips (4x4)`` () =
    for k in 0..15 do
        let r, c = ActionGrammar.toGrid k
        Assert.Equal(k, ActionGrammar.ofGrid r c)

[<Fact>]
let ``bottom is empty, top is the full superposition`` () =
    Assert.Equal(0, ActionGrammar.weight ActionGrammar.bottom)
    Assert.Equal(16, ActionGrammar.weight ActionGrammar.top)

[<Fact>]
let ``lattice: join with bottom is identity, join with top is top, idempotent`` () =
    let a = ActionGrammar.ofKeys [ 1; 5; 9 ]
    Assert.Equal<bool[]>(a, ActionGrammar.join a ActionGrammar.bottom)
    Assert.Equal<bool[]>(ActionGrammar.top, ActionGrammar.join a ActionGrammar.top)
    Assert.Equal<bool[]>(a, ActionGrammar.join a a)

[<Fact>]
let ``lattice order: bottom <= a <= top, single key <= top`` () =
    let a = ActionGrammar.ofKeys [ 2; 7 ]
    Assert.True(ActionGrammar.leq ActionGrammar.bottom a)
    Assert.True(ActionGrammar.leq a ActionGrammar.top)
    Assert.True(ActionGrammar.leq (ActionGrammar.single 5) ActionGrammar.top)
    Assert.False(ActionGrammar.leq ActionGrammar.top a)

[<Fact>]
let ``meet and complement are De Morgan duals`` () =
    let a = ActionGrammar.ofKeys [ 0; 3; 8 ]
    let b = ActionGrammar.ofKeys [ 3; 8; 15 ]
    // ¬(a ∧ b) = ¬a ∨ ¬b
    let lhs = ActionGrammar.complement (ActionGrammar.meet a b)
    let rhs = ActionGrammar.join (ActionGrammar.complement a) (ActionGrammar.complement b)
    Assert.Equal<bool[]>(lhs, rhs)

[<Fact>]
let ``keys and holds agree`` () =
    let a = ActionGrammar.ofKeys [ 4; 11 ]
    Assert.Equal<int list>([ 4; 11 ], ActionGrammar.keys a)
    Assert.True(ActionGrammar.holds 4 a)
    Assert.False(ActionGrammar.holds 5 a)

[<Fact>]
let ``words are action sequences (the grammar)`` () =
    let w = ActionGrammar.concat (ActionGrammar.wordOf (ActionGrammar.single 1)) (ActionGrammar.wordOf (ActionGrammar.single 2))
    Assert.Equal(2, ActionGrammar.wordLength w)
    Assert.Equal(0, ActionGrammar.wordLength ActionGrammar.emptyWord)
