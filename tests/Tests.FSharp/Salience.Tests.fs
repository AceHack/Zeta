module Zeta.Tests.SalienceTests

open global.Xunit
open Zeta.Core

let private item name critical objs : Salience.Item<string> =
    { Payload = name; LivenessCritical = critical; Objectives = Map.ofList objs }

[<Fact>]
let ``score is the dot product of agent priority and item objectives`` () =
    let it = item "x" false [ "empowerment", 2.0; "uncertainty", 3.0 ]
    let priority = Map.ofList [ "empowerment", 1.0; "uncertainty", 10.0 ] // agent prioritizes uncertainty
    Assert.Equal(2.0 * 1.0 + 3.0 * 10.0, Salience.score priority it, 9)

[<Fact>]
let ``the agent's chosen priority changes what ranks highest`` () =
    let a = item "a" false [ "empowerment", 10.0; "uncertainty", 0.0 ]
    let b = item "b" false [ "empowerment", 0.0; "uncertainty", 10.0 ]
    let empFirst = Salience.display 1 (Map.ofList [ "empowerment", 1.0 ]) [ a; b ]
    let uncFirst = Salience.display 1 (Map.ofList [ "uncertainty", 1.0 ]) [ a; b ]
    Assert.Equal<string list>([ "a" ], empFirst) // prioritize empowerment -> a
    Assert.Equal<string list>([ "b" ], uncFirst) // prioritize uncertainty -> b

[<Fact>]
let ``liveness-critical items surface first regardless of score (subsumption)`` () =
    let danger = item "danger" true [ "empowerment", 0.0; "uncertainty", 0.0 ] // low score but liveness-critical
    let shiny = item "shiny" false [ "empowerment", 100.0; "uncertainty", 100.0 ] // high score, not critical
    let top = Salience.display 1 (Map.ofList [ "empowerment", 1.0; "uncertainty", 1.0 ]) [ shiny; danger ]
    Assert.Equal<string list>([ "danger" ], top) // liveness wins the display slot

[<Fact>]
let ``display reduces the whole window to top-k`` () =
    let items = [ for i in 1..10 -> item (string i) false [ "u", float i ] ]
    let top3 = Salience.display 3 (Map.ofList [ "u", 1.0 ]) items
    Assert.Equal<string list>([ "10"; "9"; "8" ], top3)

[<Fact>]
let ``an open objective set: a new objective just adds a priority weight`` () =
    let it = item "x" false [ "empowerment", 1.0; "score", 5.0; "novelty", 2.0 ]
    // agent adds a 'novelty' ladder with weight 3 — integrates with no code change
    let priority = Map.ofList [ "empowerment", 1.0; "score", 1.0; "novelty", 3.0 ]
    Assert.Equal(1.0 + 5.0 + 6.0, Salience.score priority it, 9)
