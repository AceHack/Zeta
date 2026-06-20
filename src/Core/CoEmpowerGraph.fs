namespace Zeta.Core

/// **`CoEmpowerGraph` — `CoEmpowerField` generalized to the `network<>creator<>audience` graph (Aaron 2026-06-19, shadow\*).**
///
/// `CoEmpowerField` proved the NCI / co-empowerment / blossom thesis on a 2D grid (one network, chosen because
/// it renders). Aaron: *"we can use a generic `network<>creator<>audience`."* This is that generalization —
/// **same dynamics, arbitrary graph**: the lattice neighbor function is replaced by an **adjacency list**, and
/// a **creator/audience role layer** is added. Still **DST-deterministic** (SplitMix seed, no RNG state) and
/// grounded in `Diversity` (the NCI keystone: coercion collapses diversity, non-coercion preserves it).
///
/// **The role layer (anti-capture):** an **Audience** node may co-empower toward *any* neighbor's identity; a
/// **Creator** node co-empowers only with its *Creator* neighbors — so an audience can adopt a creator's
/// identity (non-coercive reach) but **cannot capture the creator** (the audience cannot pull the creator's
/// identity to itself). That asymmetry is the non-coercion discipline at the role level: influence flows
/// creator→audience by consent, never audience→creator by mass. The **coercive** step (`coerce`, the
/// anti-pattern) is role-blind majority-copy — exactly what the roles + NCI avoid.
[<RequireQualifiedAccess>]
module CoEmpowerGraph =

    /// A node's role in the social graph.
    type Role =
        | Creator
        | Audience

    /// A social graph: `N` nodes, each with an identity (`0` = empty), an adjacency list, and a role.
    type Graph =
        { N: int
          Identity: int[]
          Adjacency: int[][]
          Role: Role[] }

    /// SplitMix64 finalizer — deterministic, process-independent (DST-clean).
    let private mix (z0: uint64) : uint64 =
        let mutable z = z0 + 0x9E3779B97F4A7C15UL
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        z ^^^ (z >>> 31)

    /// Deterministic seeded graph over a given topology + roles: `kinds` identities (`1..kinds`) placed by a
    /// SplitMix hash of `(nodeIndex, seed)`. Same args ⇒ same graph (DST).
    let seed (kinds: int) (seed: int) (adjacency: int[][]) (roles: Role[]) : Graph =
        let n = adjacency.Length
        let id =
            Array.init n (fun i ->
                let h = mix (uint64 i ^^^ (uint64 (uint32 seed) <<< 32))
                1 + int (h % uint64 kinds))
        { N = n; Identity = id; Adjacency = adjacency; Role = roles }

    let private neighborIds (g: Graph) (node: int) : int list =
        g.Adjacency.[node] |> Array.map (fun nb -> g.Identity.[nb]) |> List.ofArray

    /// **Co-empowerment** of `node` adopting identity `s` = `min(support, optionSpace)` over its neighbors —
    /// identical to `CoEmpowerField` (support = neighbors already `s`; optionSpace = distinct non-empty neighbor
    /// identities; `min` ⇒ both must gain). Monoculture neighborhoods score low; diverse ones score high.
    let coEmpowerment (g: Graph) (node: int) (s: int) : int =
        let ns = neighborIds g node
        let support = ns |> List.filter (fun n -> n = s) |> List.length
        let optionSpace = ns |> List.filter (fun n -> n <> 0) |> List.distinct |> List.length
        min support optionSpace

    /// Candidate identities `node` may adopt, **by role**: an `Audience` considers all neighbors; a `Creator`
    /// considers only its `Creator` neighbors (anti-capture — the audience cannot pull the creator).
    let private candidates (g: Graph) (node: int) : int list =
        let nbs = g.Adjacency.[node]
        let allowed =
            match g.Role.[node] with
            | Audience -> nbs
            | Creator -> nbs |> Array.filter (fun nb -> g.Role.[nb] = Creator)
        allowed
        |> Array.map (fun nb -> g.Identity.[nb])
        |> Array.filter (fun s -> s <> 0)
        |> Array.distinct
        |> Array.sort
        |> List.ofArray

    /// One **non-coercive** step (NCI): each node shifts to the role-allowed candidate of maximal
    /// co-empowerment **only if** it exceeds `threshold` (consent gate); else keeps its identity. Deterministic
    /// (ties → lowest id).
    let step (threshold: int) (g: Graph) : Graph =
        let id =
            Array.init g.N (fun node ->
                let cur = g.Identity.[node]
                match candidates g node with
                | [] -> cur
                | cs ->
                    let best, gain = cs |> List.map (fun s -> s, coEmpowerment g node s) |> List.maxBy snd
                    if gain > threshold then best else cur)
        { g with Identity = id }

    /// One **coercive** step (the ANTI-PATTERN, role-blind): every node copies the majority neighbor identity
    /// (force, not consent). Collapses diversity to one — what the role layer + NCI avoid.
    let coerce (g: Graph) : Graph =
        let id =
            Array.init g.N (fun node ->
                let ns = neighborIds g node |> List.filter (fun n -> n <> 0)
                match ns with
                | [] -> g.Identity.[node]
                | _ -> ns |> List.countBy id |> List.sortBy (fun (s, c) -> (-c, s)) |> List.head |> fst)
        { g with Identity = id }

    /// Run `steps` deterministic non-coercive steps.
    let run (threshold: int) (steps: int) (g: Graph) : Graph =
        List.fold (fun acc _ -> step threshold acc) g [ 1 .. max 0 steps ]

    /// Health of a graph (the field metrics + a role-aware one).
    type Health =
        { /// distinct non-empty identities alive
          Diversity: int
          /// **Blossom** — Shannon entropy (nats) of the identity population (`Diversity.entropy`)
          Blossom: float
          /// share held by the single largest identity, `[0,1]`
          DominantFraction: float
          /// fraction of edges joining *different* identities, `[0,1]` (coexistence)
          BorderCoexistence: float
          /// **CreatorReach** — of audience nodes with ≥1 creator neighbor, the fraction sharing an identity
          /// with some creator-neighbor (non-coercive creator influence that landed), `[0,1]`
          CreatorReach: float }

    let health (g: Graph) : Health =
        let nonEmpty = g.Identity |> Array.filter (fun c -> c <> 0)
        let diversity = nonEmpty |> Array.distinct |> Array.length
        let blossom = Diversity.entropy (List.ofArray nonEmpty)

        let dominant =
            if nonEmpty.Length = 0 then
                0.0
            else
                let topCount = nonEmpty |> Array.countBy id |> Array.map snd |> Array.max
                float topCount / float nonEmpty.Length

        // undirected edges (i < nb), both endpoints non-empty
        let edges =
            [ for i in 0 .. g.N - 1 do
                  for nb in g.Adjacency.[i] do
                      if nb > i && g.Identity.[i] <> 0 && g.Identity.[nb] <> 0 then
                          yield (g.Identity.[i], g.Identity.[nb]) ]

        let coexist =
            match edges with
            | [] -> 0.0
            | _ -> float (edges |> List.filter (fun (a, b) -> a <> b) |> List.length) / float (List.length edges)

        let audienceWithCreator =
            [ for i in 0 .. g.N - 1 do
                  if g.Role.[i] = Audience then
                      let creatorNbs = g.Adjacency.[i] |> Array.filter (fun nb -> g.Role.[nb] = Creator)
                      if creatorNbs.Length > 0 then
                          yield (i, creatorNbs) ]

        let reach =
            match audienceWithCreator with
            | [] -> 0.0
            | _ ->
                let landed =
                    audienceWithCreator
                    |> List.filter (fun (i, creatorNbs) ->
                        creatorNbs |> Array.exists (fun nb -> g.Identity.[nb] = g.Identity.[i] && g.Identity.[i] <> 0))
                    |> List.length
                float landed / float (List.length audienceWithCreator)

        { Diversity = diversity
          Blossom = blossom
          DominantFraction = dominant
          BorderCoexistence = coexist
          CreatorReach = reach }
