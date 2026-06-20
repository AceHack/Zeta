module Zeta.Tests.Formal.WikidataGraphTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

module W = Zeta.Core.WikidataGraph
module L = Zeta.Core.LiveLegs

// ═══════════════════════════════════════════════════════════════════
// WikidataGraph — SPARQL bindings → entity-relation graph (parallel to
// ImdbDataset's co-star graph). Fixture chain: Q42 – Q5 – Q1.
// ═══════════════════════════════════════════════════════════════════

let private bindings =
    [ Map.ofList
          [ "item", "http://www.wikidata.org/entity/Q42"
            "related", "http://www.wikidata.org/entity/Q5"
            "itemLabel", "Douglas Adams" ]
      Map.ofList
          [ "item", "http://www.wikidata.org/entity/Q5"
            "related", "http://www.wikidata.org/entity/Q1" ] ]

[<Fact>]
let ``qid extracts the Q-id from a Wikidata URI (and passes bare ids through)`` () =
    W.qid "http://www.wikidata.org/entity/Q42" |> should equal "Q42"
    W.qid "Q5" |> should equal "Q5"

[<Fact>]
let ``edges extracts qid relation triples from the chosen subject/object vars`` () =
    let es = W.edges "item" "related" bindings
    es
    |> should
        equal
        [ { W.Subject = "Q42"; W.Object = "Q5" }
          { W.Subject = "Q5"; W.Object = "Q1" } ]

[<Fact>]
let ``labels maps Q-id to label`` () =
    let ls = W.labels "item" "itemLabel" bindings
    ls.["Q42"] |> should equal "Douglas Adams"

[<Fact>]
let ``adjacency builds the undirected entity graph (Q42–Q5–Q1)`` () =
    let entities, adj = W.adjacency (W.edges "item" "related" bindings)
    entities |> should equal [| "Q1"; "Q42"; "Q5" |] // ordinal-sorted
    adj.[0] |> should equal [| 2 |] // Q1 — Q5
    adj.[1] |> should equal [| 2 |] // Q42 — Q5
    adj.[2] |> should equal [| 0; 1 |] // Q5 — Q1, Q42

[<Fact>]
let ``toCoEmpowerGraph projects entities to an all-Audience CoEmpowerGraph, deterministically`` () =
    let _, g1 = W.toCoEmpowerGraph 4 7 (W.edges "item" "related" bindings)
    let entities, g2 = W.toCoEmpowerGraph 4 7 (W.edges "item" "related" bindings)
    g1.Identity |> should equal g2.Identity
    g2.N |> should equal 3
    entities |> should equal [| "Q1"; "Q42"; "Q5" |]
    g2.Role |> Array.forall (fun r -> r = CoEmpowerGraph.Audience) |> should equal true

[<Fact>]
let ``the full Wikidata leg: recorded SPARQL fetch → bindings → entity graph (DST, no network)`` () =
    let query = "SELECT ?item ?related WHERE {}"
    let url = L.Wikidata.sparqlUrl query
    let json =
        """{"results":{"bindings":[{"item":{"value":"http://www.wikidata.org/entity/Q42"},"related":{"value":"http://www.wikidata.org/entity/Q5"}}]}}"""
    let fetch = L.recordedFetch (Map.ofList [ url, json ])
    let rows = L.Wikidata.fetchBindings fetch query |> Async.RunSynchronously
    let entities, _ = W.adjacency (W.edges "item" "related" rows)
    entities |> should equal [| "Q42"; "Q5" |]
