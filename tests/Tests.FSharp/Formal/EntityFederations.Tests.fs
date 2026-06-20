module Zeta.Tests.Formal.EntityFederationsTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

module E = Zeta.Core.EntityFederations
module W = Zeta.Core.WikidataGraph

// fixture: Q42–Q5 (twice → 2 relations), Q5–Q1 (once). Knowledge-graph chain Q42–Q5–Q1.
let private triples =
    [ ({ Subject = "Q42"; Object = "Q5" }: W.Triple)
      { Subject = "Q5"; Object = "Q1" }
      { Subject = "Q42"; Object = "Q5" } ]

[<Fact>]
let ``reverse-mint rates each entity link by its relation count`` () =
    E.reverseMint triples
    |> should
        equal
        [ ({ Subject = "Q1"; Object = "Q5"; Relations = 1 }: E.EntityLink)
          { Subject = "Q42"; Object = "Q5"; Relations = 2 } ] // Q42–Q5 connected twice

[<Fact>]
let ``report carries federation health + degrees of separation from a source entity`` () =
    let r = E.report 4 7 "Q42" triples
    r.Links.Length |> should equal 2
    r.Hops.["Q42"] |> should equal 0
    r.Hops.["Q5"] |> should equal 1
    r.Hops.["Q1"] |> should equal 2 // Q42 → Q5 → Q1
    r.Health.Diversity |> should be (greaterThanOrEqualTo 1)

[<Fact>]
let ``the entity federation report is deterministic (DST)`` () =
    let a = E.report 4 7 "Q42" triples
    let b = E.report 4 7 "Q42" triples
    a.Links |> should equal b.Links
    a.Health |> should equal b.Health
