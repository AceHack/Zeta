namespace Zeta.Core

/// **Dependency graph + topological order over `ZetaCli` commands.**
///
/// A set of `ZetaCommand`s (#6983) is a graph: each command is a **node** keyed by its `Noun`; its `DependsOn`
/// entries are its **edges** (#6971). `topoOrder` derives execution order from those edges — **deps before
/// dependents** — so order comes from `dependson`, NOT from input/text order (#6975). The result is
/// **deterministic** (ordinal tie-break, culture-invariant) and **input-order-independent**.
///
/// Cycles: the assembly graph can be cyclic (#6969/#6975); a strict topological order exists only for the
/// acyclic case, so `topoOrder` **reports the cyclic nodes** (an `Error`) rather than guessing. Full
/// fixpoint-over-SCC resolution for cyclic deps is deferred (the #6975/#6977 work). `dependson` edges to nouns
/// NOT in the input set are treated as **external** (assumed already present — e.g. push-down/global #6977) and
/// don't constrain in-set ordering. F# reference oracle; C#/Rust/TS ports follow.
module ZetaGraph =

    open ZetaCli

    let private cmpOrdinal a b = System.String.CompareOrdinal(a, b)

    /// Topologically order commands so each comes AFTER the (in-set) commands it `dependson`. Nodes keyed by
    /// `Noun`; external deps (not in the set) are ignored for ordering. `Ok ordered` (deps first, deterministic)
    /// or `Error cycleNouns` (the nouns participating in a dependency cycle, sorted).
    let topoOrder (cmds: ZetaCommand list) : Result<ZetaCommand list, string list> =
        let byNoun = cmds |> List.map (fun c -> c.Noun, c) |> Map.ofList

        let depsOf (c: ZetaCommand) =
            c.DependsOn
            |> List.filter (fun d -> Map.containsKey d byNoun) // in-set only; external deps ignored
            |> List.distinct
            |> List.sortWith cmpOrdinal

        let order = ResizeArray<ZetaCommand>()
        let state = System.Collections.Generic.Dictionary<string, int>() // 1 = visiting (gray), 2 = done (black)
        let mutable cycle: string list option = None

        // DFS post-order = deps appended before the node. Back-edge to a gray node ⇒ cycle.
        let rec visit (path: string list) (n: string) =
            if cycle.IsNone then
                match state.TryGetValue n with
                | true, 2 -> () // done
                | true, 1 -> // gray ⇒ n is an ancestor ⇒ cycle: n + the path back down to n
                    cycle <- Some((n :: (path |> List.takeWhile (fun s -> s <> n))) |> List.distinct |> List.sortWith cmpOrdinal)
                | _ ->
                    state.[n] <- 1
                    for d in depsOf byNoun.[n] do
                        visit (n :: path) d
                    state.[n] <- 2
                    order.Add byNoun.[n]

        // Visit roots in ordinal order ⇒ deterministic, input-order-independent.
        byNoun
        |> Map.toSeq
        |> Seq.map fst
        |> Seq.sortWith cmpOrdinal
        |> Seq.iter (visit [])

        match cycle with
        | Some c -> Error c
        | None -> Ok(List.ofSeq order)

    /// The in-set nouns a command (transitively) is blocked by, and the direct dependents of a noun — small
    /// helpers over the same graph (kept minimal; the planner builds on `topoOrder`).
    let directDependents (cmds: ZetaCommand list) (noun: string) : string list =
        cmds
        |> List.filter (fun c -> List.contains noun c.DependsOn)
        |> List.map (fun c -> c.Noun)
        |> List.distinct
        |> List.sortWith cmpOrdinal
