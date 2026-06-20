namespace Zeta.Core

open System

/// **`ImdbDataset` — typed, OFFLINE, deterministic binding over the IMDb non-commercial datasets (Aaron 2026-06-19, shadow\*).**
///
/// The first slice of the **IMDb/Wikipedia type provider** — the external **grounding** for NFT links + the
/// `network<>creator<>audience` graph. It parses the public **IMDb non-commercial TSV dumps** (`name.basics`,
/// `title.principals`) into typed records, projects the **co-star graph** (persons linked by a shared title —
/// the *remembered links between travelers*), computes the **Bacon number** (six-degrees), and projects into a
/// `CoEmpowerGraph.Graph` so the reverse-mint → cluster/federation pipeline runs on real public data.
///
/// **Why offline / dataset (not a live-API design-time provider):** a type provider that hit IMDb/TMDB at
/// *compile time* would inject **ambient network entropy** (violates noninterference §13 — entropy only through
/// declared metered channels) and would not be **DST-replayable**. So this slice consumes **declared, local
/// dataset text** — deterministic, byte-lockable, replayable. IMDb has no free official API (licensed); the
/// non-commercial TSV datasets are the sanctioned source.
///
/// **Honest scope (peel):** this is the **typed binding + graph projection** a provider surfaces — parsing the
/// dataset shape, not the design-time `ProvidedTypes` wrapper (a follow-on slice), nor live **TMDB/OMDb** /
/// **Wikidata/DBpedia** (the other legs). It deliberately models only the co-star subset (`name.basics` +
/// `title.principals`) needed for the Kevin-Bacon demo. Anchors: IMDb non-commercial datasets; Oracle of Bacon
/// (Tjaden); Milgram six-degrees; Erdős number. Ties: `CoEmpowerGraph`, the NFT-grounding / reverse-mint scope.
[<RequireQualifiedAccess>]
module ImdbDataset =

    /// A person row (subset of `name.basics.tsv`).
    type Name = { Nconst: string; PrimaryName: string }

    /// A credited contribution (subset of `title.principals.tsv`): person `Nconst` on title `Tconst`.
    type Principal =
        { Tconst: string
          Nconst: string
          Category: string }

    let private cols (line: string) : string[] = line.Split('\t')

    /// IMDb encodes a missing field as the literal `\N`; normalize it to empty.
    let private denull (s: string) : string =
        if String.Equals(s, "\\N", StringComparison.Ordinal) then "" else s

    /// Parse `name.basics.tsv` lines (header auto-skipped). Columns: nconst, primaryName, …
    let parseNames (lines: string seq) : Name list =
        [ for line in lines do
              let c = cols line
              if c.Length >= 2 && not (String.Equals(c.[0], "nconst", StringComparison.Ordinal)) then
                  yield { Nconst = c.[0]; PrimaryName = denull c.[1] } ]

    /// Parse `title.principals.tsv` lines (header auto-skipped). Columns: tconst, ordering, nconst, category, …
    let parsePrincipals (lines: string seq) : Principal list =
        [ for line in lines do
              let c = cols line
              if c.Length >= 4 && not (String.Equals(c.[0], "tconst", StringComparison.Ordinal)) then
                  yield
                      { Tconst = c.[0]
                        Nconst = c.[2]
                        Category = denull c.[3] } ]

    /// The **co-star graph**: distinct persons (nconst, ordinal-sorted) + undirected adjacency where two persons
    /// share at least one title. Deterministic (ordinal sort + sorted neighbor lists).
    let coStarAdjacency (principals: Principal list) : string[] * int[][] =
        let persons =
            principals
            |> List.map (fun p -> p.Nconst)
            |> List.distinct
            |> List.sortWith (fun a b -> String.CompareOrdinal(a, b))
            |> List.toArray

        let idx = persons |> Array.mapi (fun i n -> n, i) |> Map.ofArray
        let adj = Array.init persons.Length (fun _ -> System.Collections.Generic.SortedSet<int>())

        principals
        |> List.groupBy (fun p -> p.Tconst)
        |> List.iter (fun (_, ps) ->
            let ids = ps |> List.map (fun p -> idx.[p.Nconst]) |> List.distinct
            for a in ids do
                for b in ids do
                    if a <> b then adj.[a].Add(b) |> ignore)

        persons, adj |> Array.map Seq.toArray

    /// **Bacon number:** BFS shortest-hop distance from `source` (an nconst) to every person; `-1` if
    /// unreachable, empty map if the source is absent.
    let baconNumber (persons: string[]) (adjacency: int[][]) (source: string) : Map<string, int> =
        match persons |> Array.tryFindIndex (fun n -> String.Equals(n, source, StringComparison.Ordinal)) with
        | None -> Map.empty
        | Some s ->
            let dist = Array.create persons.Length -1
            dist.[s] <- 0
            let q = System.Collections.Generic.Queue<int>()
            q.Enqueue s

            while q.Count > 0 do
                let u = q.Dequeue()
                for v in adjacency.[u] do
                    if dist.[v] < 0 then
                        dist.[v] <- dist.[u] + 1
                        q.Enqueue v

            persons |> Array.mapi (fun i n -> n, dist.[i]) |> Map.ofArray

    /// Project the co-star graph into a `CoEmpowerGraph.Graph` (for reverse-mint → cluster/federation). Identities
    /// are seeded deterministically; every person is a **Creator** (IMDb persons are creators; the *audience* is
    /// the social-media layer, a separate provider leg). Returns the person index (`nconst` per node) + the graph.
    let toCoEmpowerGraph (kinds: int) (seed: int) (principals: Principal list) : string[] * CoEmpowerGraph.Graph =
        let persons, adjacency = coStarAdjacency principals
        let roles = Array.create persons.Length CoEmpowerGraph.Creator
        persons, CoEmpowerGraph.seed kinds seed adjacency roles
