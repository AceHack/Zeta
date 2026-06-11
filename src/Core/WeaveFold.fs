namespace Zeta.Core

/// WeaveFold — **Amara's touch-metal proof for the fabric of time, built**: two streams, one
/// cross-repo edge, one derived view — *"folding over the joined causal cut produces the same V
/// regardless of valid replay order for the commutative part; and private/non-commutative residue is
/// preserved as SoftValue uncertainty, NOT erased."*
///
/// Her cleaned stack honored: the view is a STRUCTURE-PRESERVING FOLD over observable change; the
/// commutative part needs no coordination (CALM — order-free by construction: per-key value SETS,
/// union-folded); the non-commutative part (concurrent writes to one key with no causal order between
/// them) is the RESIDUE — surfaced as explicit uncertainty (all candidates kept) instead of silently
/// last-writer-wins'd. Different routes through the diagram must commute, or the system is lying —
/// here the commuting IS the test.
[<RequireQualifiedAccess>]
module WeaveFold =

    /// One event on a worldline: which stream, its local sequence number, the key it writes, the value.
    type Ev =
        { Stream: string
          Seq: int
          Key: string
          Value: string }

    /// The derived view: per key, the SET of causally-unordered candidate values. ONE candidate =
    /// certain (the commutative/public part); MORE = the residue, preserved as uncertainty.
    type View = Map<string, Set<string>>

    /// Fold a replay order into the view. Within one stream, later Seq SUPERSEDES earlier (causal
    /// order exists); across streams there is no order (unless the weave edge supplies one), so
    /// concurrent writes ACCUMULATE as candidates. Set-union semantics make the cross-stream part
    /// commutative by construction.
    let fold (events: Ev list) : View =
        // per stream+key keep only the latest Seq (the intra-stream causal order)
        let latestPerStream =
            events
            |> List.groupBy (fun e -> e.Stream, e.Key)
            |> List.map (fun (_, es) -> es |> List.maxBy (fun e -> e.Seq))

        latestPerStream
        |> List.fold
            (fun (v: View) e ->
                let cur = Map.tryFind e.Key v |> Option.defaultValue Set.empty
                Map.add e.Key (Set.add e.Value cur) v)
            Map.empty

    /// Resolve the weave EDGE: a causal edge "A's write supersedes B's for key k" — applied AFTER the
    /// fold (the edge is data, not code): the superseded candidate is removed where the superseding
    /// one is present. Residue without an edge stays uncertain — honestly.
    type Edge = { Key: string; Winner: string; Superseded: string }

    let resolve (edges: Edge list) (v: View) : View =
        // Kira r3: (a) a self-edge (Winner = Superseded) used to ANNIHILATE the only candidate —
        // refused now; (b) cyclic supersedes {A⊐B, B⊐A} were order-dependent in the module whose
        // thesis is order-independence — a pair that supersedes in both directions cancels (the
        // cycle stays residue, honestly uncertain), making resolve commutative again.
        let cyclic =
            edges
            |> List.filter (fun e ->
                edges |> List.exists (fun o -> o.Key = e.Key && o.Winner = e.Superseded && o.Superseded = e.Winner))
            |> List.map (fun e -> e.Key, e.Winner, e.Superseded)
            |> Set.ofList
        edges
        |> List.filter (fun e -> e.Winner <> e.Superseded && not (Set.contains (e.Key, e.Winner, e.Superseded) cyclic))
        |> List.fold
            (fun (acc: View) e ->
                match Map.tryFind e.Key acc with
                | Some s when Set.contains e.Winner s -> Map.add e.Key (Set.remove e.Superseded s) acc
                | _ -> acc)
            v

    /// Is a key CERTAIN (exactly one candidate — the public/commutative part) or RESIDUE (uncertain)?
    let certain (k: string) (v: View) : string option =
        match Map.tryFind k v with
        | Some s when Set.count s = 1 -> Some(Set.minElement s)
        | _ -> None
