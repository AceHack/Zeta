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
