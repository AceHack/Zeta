namespace Zeta.Core

/// **Sppf — the Shared Packed Parse Forest (rung 3, the factor-graph prerequisite).**
/// (Aaron 2026-07-02, shadow*: "yes to both" — the SPPF; framed by his SSAS decision-forest
/// mental model.)
///
/// `Slr.glrForest` ENUMERATES parse trees; that has no shared structure to run inference over.
/// The **SPPF** (Billot–Lang; Scott 2008) is the *shared, packed* forest: every distinct
/// sub-parse `(symbol, i, j)` — "`symbol` derives `input[i..j)`" — is ONE node, memoized, so the
/// forest is polynomial even when the number of trees is exponential. A node with more than one
/// **family** (packing: a production + a way to split the span among children) is an **ambiguity
/// node** — and in Aaron's SSAS frame that is exactly a decision-tree node carrying a
/// **`NodeDistribution`**. Those ambiguity nodes are the **factor-graph variables** the
/// `Zeta.Bayesian.FactorGraph`/`Ep` inference rung will run BP over; the per-family weights become
/// the `NodeDistribution`; the resulting marginals feed `ParseSoft.ofWeightedForest`
/// (= `PredictProbability`).
///
/// Built by a memoized top-down recognizer over the (BNF) Grammar IR: `derive sym i j` gives the
/// families of node `(sym,i,j)`; `matchRhs` splits a production's RHS across the span. A same-span
/// re-entry is cut (cycle guard) so it is total; cyclic-grammar parses are lost in v1 (noted).
///
/// The whole forest projects to a `DynamicValue` (`toDynamicValue`) — homoiconic, so it byte-locks
/// and is queryable as data (the DMX-over-the-model analogue). Anchors: Tomita (GLR); Billot–Lang /
/// Scott (SPPF); SSAS `NodeDistribution` (the ambiguity-node distribution); ZetaParse (Amara).
[<RequireQualifiedAccess>]
module Sppf =

    type private Sym = GrammarIr.Symbol

    /// A forest node: `symbol` derives `input[i..j)`.
    type Node = Sym * int * int

    /// One way to derive a node: a production (`Prod`, or `-1` for a terminal leaf) and the child
    /// nodes covering the span in order. A node with >1 family is AMBIGUOUS.
    type Family = { Prod: int; Kids: Node list }

    /// A built SPPF: every reachable node → its families, plus the root.
    type Forest =
        { Nodes: Map<Node, Family list>
          Root: Node }

    /// Build the SPPF for `tokens` under `g`. Total (cycle-guarded).
    let build (g: GrammarIr.Grammar) (tokens: string list) : Forest =
        let input = List.toArray tokens
        let nn = input.Length
        let prods = g.Productions |> List.mapi (fun i p -> i, p) |> Array.ofList
        let memo = System.Collections.Generic.Dictionary<Node, Family list>(HashIdentity.Structural)
        let inProgress = System.Collections.Generic.HashSet<Node>(HashIdentity.Structural)

        let rec derive (sym: Sym) (i: int) (j: int) : Family list =
            let key: Node = (sym, i, j)
            match memo.TryGetValue key with
            | true, v -> v
            | _ ->
                if inProgress.Contains key then
                    [] // cycle guard: same-span re-entry
                else
                    inProgress.Add key |> ignore
                    let fams =
                        match sym with
                        | GrammarIr.Term t ->
                            if j = i + 1 && i < nn && System.String.Equals(input.[i], t, System.StringComparison.Ordinal) then
                                [ { Prod = -1; Kids = [] } ]
                            else
                                []
                        | GrammarIr.NonTerm nt ->
                            [ for (pi, p) in prods do
                                  if System.String.Equals(p.Lhs, nt, System.StringComparison.Ordinal) then
                                      for kids in matchRhs p.Rhs i j do
                                          yield { Prod = pi; Kids = kids } ]
                    inProgress.Remove key |> ignore
                    memo.[key] <- fams
                    fams

        and matchRhs (syms: Sym list) (i: int) (j: int) : Node list list =
            match syms with
            | [] -> if i = j then [ [] ] else []
            | x :: rest ->
                [ for k in i..j do
                      if not (List.isEmpty (derive x i k)) then
                          for tail in matchRhs rest k j do
                              yield (x, i, k) :: tail ]

        let root: Node = (GrammarIr.NonTerm g.Start, 0, nn)
        derive (GrammarIr.NonTerm g.Start) 0 nn |> ignore
        { Nodes = memo |> Seq.map (fun kv -> kv.Key, kv.Value) |> Map.ofSeq
          Root = root }

    /// The families of a node (empty ⇒ the node does not derive its span).
    let familiesOf (node: Node) (f: Forest) : Family list =
        Map.tryFind node f.Nodes |> Option.defaultValue []

    /// The AMBIGUITY nodes: nodes with more than one family (the `NodeDistribution` points / the
    /// factor-graph variables). Sub-parses shared across trees appear ONCE.
    let ambiguities (f: Forest) : Node list =
        f.Nodes
        |> Map.toList
        |> List.choose (fun (n, fams) -> if List.length fams > 1 then Some n else None)

    /// The number of parse trees the forest represents — computed over the SHARED structure
    /// (no enumeration): sum over families of the product over children. Cycle-guarded.
    let parseCount (f: Forest) : int =
        let memo = System.Collections.Generic.Dictionary<Node, int>(HashIdentity.Structural)
        let inProg = System.Collections.Generic.HashSet<Node>(HashIdentity.Structural)
        let rec count (node: Node) : int =
            match memo.TryGetValue node with
            | true, v -> v
            | _ ->
                if inProg.Contains node then
                    0
                else
                    inProg.Add node |> ignore
                    let total =
                        familiesOf node f
                        |> List.sumBy (fun fam -> fam.Kids |> List.fold (fun acc k -> acc * count k) 1)
                    inProg.Remove node |> ignore
                    memo.[node] <- total
                    total
        count f.Root

    /// Does the forest contain at least one parse of the whole input?
    let accepts (f: Forest) : bool = parseCount f > 0

    /// Project the forest to a `DynamicValue` — homoiconic, byte-lockable, queryable as data.
    let toDynamicValue (f: Forest) : DynamicValue =
        let symName (s: Sym) =
            match s with
            | GrammarIr.Term n
            | GrammarIr.NonTerm n -> n
        let nodeDv ((sym, i, j): Node) =
            DynamicValue.Object
                [ "sym", DynamicValue.String(symName sym)
                  "i", DynamicValue.Int(int64 i)
                  "j", DynamicValue.Int(int64 j) ]
        let famDv (fam: Family) =
            DynamicValue.Object
                [ "prod", DynamicValue.Int(int64 fam.Prod)
                  "kids", DynamicValue.Array(fam.Kids |> List.map nodeDv) ]
        DynamicValue.Object
            [ "root", nodeDv f.Root
              "nodes",
              DynamicValue.Array(
                  f.Nodes
                  |> Map.toList
                  |> List.filter (fun (_, fams) -> not (List.isEmpty fams))
                  |> List.map (fun (n, fams) ->
                      DynamicValue.Object [ "node", nodeDv n; "families", DynamicValue.Array(fams |> List.map famDv) ])
              ) ]
