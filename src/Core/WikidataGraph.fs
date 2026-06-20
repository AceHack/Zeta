namespace Zeta.Core

open System

/// **`WikidataGraph` — the entity-graph leg (Aaron 2026-06-19, shadow\*).**
///
/// The Wikipedia/Wikidata half of *"everything grows from IMDb and Wikipedia."* `LiveLegs.Wikidata` yields
/// SPARQL `var → value` rows; this projects them into an **entity-relation graph** — entities (Q-ids) as nodes,
/// relations as edges — **parallel to `ImdbDataset`'s co-star graph**, so the entity graph flows into the *same*
/// `CoEmpowerGraph` / federation-characterization machinery. Pure (consumes parsed bindings), offline-testable,
/// DST-deterministic.
[<RequireQualifiedAccess>]
module WikidataGraph =

    /// A directed relation edge between two entities (Q-ids).
    type Triple = { Subject: string; Object: string }

    /// The Q-id (last path segment) of a Wikidata entity URI; pass-through if already bare.
    let qid (uri: string) : string =
        let i = uri.LastIndexOf('/')
        if i >= 0 && i < uri.Length - 1 then uri.Substring(i + 1) else uri

    /// Extract relation edges from SPARQL bindings given the subject/object variable names (rows missing either
    /// var are skipped). Q-ids extracted; distinct.
    let edges (subjectVar: string) (objectVar: string) (bindings: Map<string, string> list) : Triple list =
        [ for row in bindings do
              match Map.tryFind subjectVar row, Map.tryFind objectVar row with
              | Some s, Some o when s <> "" && o <> "" -> { Subject = qid s; Object = qid o }
              | _ -> () ]
        |> List.distinct

    /// Entity labels (`Q-id → label`) from an id var + a label var.
    let labels (idVar: string) (labelVar: string) (bindings: Map<string, string> list) : Map<string, string> =
        [ for row in bindings do
              match Map.tryFind idVar row, Map.tryFind labelVar row with
              | Some i, Some l when i <> "" -> qid i, l
              | _ -> () ]
        |> Map.ofList

    /// Entity nodes (ordinal-sorted) + undirected adjacency from the relation edges (related entities = linked).
    let adjacency (triples: Triple list) : string[] * int[][] =
        let entities =
            triples
            |> List.collect (fun t -> [ t.Subject; t.Object ])
            |> List.distinct
            |> List.sortWith (fun a b -> String.CompareOrdinal(a, b))
            |> List.toArray

        let idx = entities |> Array.mapi (fun i e -> e, i) |> Map.ofArray
        let adj = Array.init entities.Length (fun _ -> System.Collections.Generic.SortedSet<int>())

        for t in triples do
            match Map.tryFind t.Subject idx, Map.tryFind t.Object idx with
            | Some a, Some b when a <> b ->
                adj.[a].Add(b) |> ignore
                adj.[b].Add(a) |> ignore
            | _ -> ()

        entities, adj |> Array.map Seq.toArray

    /// Project the entity graph into a `CoEmpowerGraph` (all `Audience` by default; the federation machinery then
    /// characterizes the entity clusters). Identities seeded deterministically.
    let toCoEmpowerGraph (kinds: int) (seed: int) (triples: Triple list) : string[] * CoEmpowerGraph.Graph =
        let entities, adj = adjacency triples
        let roles = Array.create entities.Length CoEmpowerGraph.Audience
        entities, CoEmpowerGraph.seed kinds seed adj roles
