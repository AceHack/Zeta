namespace Zeta.Core

open System

/// **`CostarFederations` — the end-to-end IMDb pipeline (Aaron 2026-06-19, shadow\*).**
///
/// Ties the three slices into the through-line: **`ImdbDataset`** (co-star graph) → **reverse-mint** the
/// co-star links (objectively rated) → **`CoEmpowerGraph`** (characterize emergent clusters/federations) →
/// **`TtlCache`** (cache the reified graph on the soft-phase + UTC clock; source only on miss/expiry).
///
/// This realizes, on real public data, the carved thesis: an **NFT = an objectively-rateable remembered link
/// between travelers** (here, a co-star link rated by the number of titles two people share — the QPG analogue
/// from the actual record), and **reverse-mint → emergent federations** (neutral clusters, *characterized* by
/// the co-empowerment / diversity health, never hunted). Deterministic (DST), offline.
[<RequireQualifiedAccess>]
module CostarFederations =

    /// A reverse-minted co-star link — a *remembered link between two travelers* — objectively rated by the
    /// number of titles they share (`SharedTitles`: the link's quality on the real record). `A < B` (ordinal).
    type MintedLink =
        { A: string
          B: string
          SharedTitles: int }

    /// **Reverse-mint** every co-star link from the principals: each pair sharing ≥ 1 title becomes a
    /// `MintedLink` rated by its shared-title count. Deterministic (ordinal-sorted by `(A, B)`).
    let reverseMint (principals: ImdbDataset.Principal list) : MintedLink list =
        let pairCounts = System.Collections.Generic.Dictionary<struct (string * string), int>()

        principals
        |> List.groupBy (fun p -> p.Tconst)
        |> List.iter (fun (_, ps) ->
            let persons =
                ps
                |> List.map (fun p -> p.Nconst)
                |> List.distinct
                |> List.sortWith (fun a b -> String.CompareOrdinal(a, b))
                |> List.toArray

            for i in 0 .. persons.Length - 1 do
                for j in i + 1 .. persons.Length - 1 do
                    let key = struct (persons.[i], persons.[j])
                    let prev =
                        match pairCounts.TryGetValue key with
                        | true, v -> v
                        | _ -> 0
                    pairCounts.[key] <- prev + 1)

        [ for kv in pairCounts ->
              let struct (a, b) = kv.Key
              { A = a; B = b; SharedTitles = kv.Value } ]
        |> List.sortWith (fun x y ->
            let c = String.CompareOrdinal(x.A, y.A)
            if c <> 0 then c else String.CompareOrdinal(x.B, y.B))

    /// The full characterization: the minted links, the emergent-federation health, and Bacon numbers from a
    /// chosen source person.
    type Report =
        { Links: MintedLink list
          Health: CoEmpowerGraph.Health
          BaconFrom: Map<string, int> }

    let report (kinds: int) (seed: int) (baconSource: string) (principals: ImdbDataset.Principal list) : Report =
        let persons, adjacency = ImdbDataset.coStarAdjacency principals
        let _, graph = ImdbDataset.toCoEmpowerGraph kinds seed principals
        { Links = reverseMint principals
          Health = CoEmpowerGraph.health graph
          BaconFrom = ImdbDataset.baconNumber persons adjacency baconSource }

    /// Cache the reified co-star graph via `TtlCache` (injected soft-phase + UTC `now`): the reifier runs **only**
    /// on miss/expiry — respecting the source site. Returns the graph + the updated cache.
    let cachedGraph
        (now: int64)
        (ttl: int64)
        (sourceId: string)
        (kinds: int)
        (seed: int)
        (principals: ImdbDataset.Principal list)
        (cache: TtlCache.Cache<string, CoEmpowerGraph.Graph>)
        : CoEmpowerGraph.Graph * TtlCache.Cache<string, CoEmpowerGraph.Graph> =
        TtlCache.getOrSource now ttl sourceId (fun () -> snd (ImdbDataset.toCoEmpowerGraph kinds seed principals)) cache
