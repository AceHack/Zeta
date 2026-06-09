module Zeta.Tests.DiversityTests

open System
open global.Xunit
open Zeta.Core

[<Fact>]
let ``distinct and entropy: uniform is max diversity, all-equal is zero`` () =
    Assert.Equal(3, Diversity.distinct [ "a"; "b"; "c" ])
    Assert.Equal(1, Diversity.distinct [ "a"; "a"; "a" ])
    Assert.Equal(0.0, Diversity.entropy [ "a"; "a"; "a" ], 9) // collapsed -> 0
    Assert.Equal(log 3.0, Diversity.entropy [ "a"; "b"; "c" ], 9) // uniform over 3 -> ln 3

[<Fact>]
let ``coercive observability collapses the population to ONE (entropy -> 0)`` () =
    let pop = [ "a"; "a"; "b"; "c" ] // majority a
    let collapsed = Diversity.coerciveConverge 1 pop
    Assert.Equal(1, Diversity.distinct collapsed) // one round of copy-the-majority -> monoculture
    Assert.Equal(0.0, Diversity.entropy collapsed, 9)
    Assert.True(Diversity.entropy pop > Diversity.entropy collapsed) // diversity strictly destroyed

[<Fact>]
let ``private state preserves diversity even after public state fully converges (NCI)`` () =
    // publics collapse to one; privates stay distinct -> combined population stays diverse
    let publics = Diversity.coerciveConverge 5 [ "x"; "y"; "z" ] // -> all the same public
    Assert.Equal(1, Diversity.distinct publics)
    let privates = [ 1; 2; 3 ] // each agent's private encryption budget — distinct
    Assert.Equal(3, Diversity.combinedDistinct publics privates) // diversity preserved by NCI
    Assert.True(Diversity.combinedDistinct publics privates > Diversity.distinct publics)

[<Fact>]
let ``without private state, combined distinct = public distinct (collapse stands)`` () =
    let publics = [ "a"; "a"; "a" ]
    let noPrivate = [ (); (); () ] // no distinguishing private component
    Assert.Equal(1, Diversity.combinedDistinct publics noPrivate) // still collapsed

// ---- the NCI-floor theorem, proven by a thorough deterministic sweep (the "bulletproof" math) ----

// deterministic family of populations: n agents, d distinct states, cycled — covers many shapes, no RNG (DST)
let private population (n: int) (d: int) : int list =
    [ for i in 0 .. n - 1 -> i % (max 1 d) ]

[<Fact>]
let ``THEOREM 1: coercion is diversity-monotone-non-increasing (entropy never rises) over a wide sweep`` () =
    for n in 1..12 do
        for d in 1..n do
            let p = population n d
            Assert.True(Diversity.entropy (Diversity.coerciveStep p) <= Diversity.entropy p + 1e-12)
            Assert.True(Diversity.distinct (Diversity.coerciveStep p) <= Diversity.distinct p)

[<Fact>]
let ``THEOREM 2: collapse is the fixed point / attractor (entropy 0, stays collapsed)`` () =
    for n in 1..12 do
        for d in 1..n do
            let collapsed = Diversity.coerciveConverge n (population n d) // enough rounds to collapse
            Assert.True(Diversity.collapsed collapsed)
            Assert.Equal(0.0, Diversity.entropy collapsed, 9)
            // fixed point: coercing again changes nothing
            Assert.Equal<int list>(collapsed, Diversity.coerciveStep collapsed)

[<Fact>]
let ``THEOREM 3: private state is a STRICT diversity floor (combined >= distinct privates), even vs collapsed publics`` () =
    for n in 2..12 do
        for kp in 1..n do
            let publics = List.replicate n 0 // fully collapsed publics (worst case)
            let privates = population n kp // kp distinct private budgets
            Assert.True(Diversity.combinedDistinct publics privates >= Diversity.diversityFloor privates)
            Assert.Equal(kp, Diversity.combinedDistinct publics privates) // exactly the private diversity survives

[<Fact>]
let ``COROLLARY: with >= 2 distinct private budgets, collapse is impossible (off the heat-death attractor)`` () =
    let publics = List.replicate 8 "same" // maximal coercion of the public state
    let privates = [ for i in 0..7 -> i % 3 ] // 3 distinct private budgets
    Assert.True(Diversity.combinedDistinct publics privates >= 2) // never collapses -> learning gradient preserved
