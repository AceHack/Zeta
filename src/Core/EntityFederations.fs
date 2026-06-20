namespace Zeta.Core

open System

/// **`EntityFederations` — the Wikidata analog of `CostarFederations` (Aaron 2026-06-19, shadow\*).**
///
/// Brings the Wikipedia/Wikidata entity graph to parity with the IMDb co-star leg: **reverse-mint** the
/// entity-relation links (each unordered pair rated by how many relations connect them — the objective rating,
/// the QPG analogue on the knowledge graph), characterize the **emergent federations** (`CoEmpowerGraph.health`
/// — neutral, measured by co-empowerment/diversity, not hunted), and compute **degrees of separation** (the
/// entity-graph analogue of the Bacon number, reusing the generic `ImdbDataset.baconNumber` BFS). Pure,
/// offline, DST-deterministic.
[<RequireQualifiedAccess>]
module EntityFederations =

    /// A reverse-minted entity link — a remembered relation between two entities — rated by `Relations` (the
    /// number of relations connecting the unordered pair). `Subject < Object` (ordinal).
    type EntityLink =
        { Subject: string
          Object: string
          Relations: int }

    /// **Reverse-mint** every entity link from the relation triples: each unordered pair sharing ≥ 1 relation
    /// becomes an `EntityLink` rated by its relation count. Deterministic (ordinal-sorted).
    let reverseMint (triples: WikidataGraph.Triple list) : EntityLink list =
        let pairs = System.Collections.Generic.Dictionary<struct (string * string), int>()

        for t in triples do
            let a, b =
                if String.CompareOrdinal(t.Subject, t.Object) <= 0 then t.Subject, t.Object else t.Object, t.Subject

            if not (String.Equals(a, b, StringComparison.Ordinal)) then
                let key = struct (a, b)
                let prev =
                    match pairs.TryGetValue key with
                    | true, v -> v
                    | _ -> 0
                pairs.[key] <- prev + 1

        [ for kv in pairs ->
              let struct (a, b) = kv.Key
              { Subject = a; Object = b; Relations = kv.Value } ]
        |> List.sortWith (fun x y ->
            let c = String.CompareOrdinal(x.Subject, y.Subject)
            if c <> 0 then c else String.CompareOrdinal(x.Object, y.Object))

    /// The full characterization: the minted entity links, the emergent-federation health, and degrees of
    /// separation from a chosen source entity (Q-id).
    type Report =
        { Links: EntityLink list
          Health: CoEmpowerGraph.Health
          Hops: Map<string, int> }

    let report (kinds: int) (seed: int) (source: string) (triples: WikidataGraph.Triple list) : Report =
        let entities, adjacency = WikidataGraph.adjacency triples
        let _, graph = WikidataGraph.toCoEmpowerGraph kinds seed triples
        { Links = reverseMint triples
          Health = CoEmpowerGraph.health graph
          Hops = ImdbDataset.baconNumber entities adjacency source }
