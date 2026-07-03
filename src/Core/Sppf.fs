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

    /// **Weighted INSIDE pass** — the forward half of inside–outside, which IS belief propagation
    /// on the parse forest (Baker 1979; Lari–Young 1990). `inside node` = Σ over families of
    /// [ production-weight × Π over children of `inside child` ]; a terminal leaf = 1. `weight`
    /// maps a production index → its potential (a `NodeDistribution` factor); the SSAS
    /// `PredictProbability` numerator lives here. With uniform weights (`fun _ -> 1.0`),
    /// `inside root = parseCount` (each tree weighs 1). Self-contained, exact, cycle-guarded ⇒
    /// total; the loopy / EP / emotional-propagation extension is the `Zeta.Bayesian.FactorGraph`
    /// rung. Returns the inside value of every node; `insideOf f.Root` is the total weight (the
    /// grammar's likelihood of the input under the weights).
    let inside (weight: int -> float) (f: Forest) : Map<Node, float> =
        let memo = System.Collections.Generic.Dictionary<Node, float>(HashIdentity.Structural)
        let inProg = System.Collections.Generic.HashSet<Node>(HashIdentity.Structural)
        let rec ins (node: Node) : float =
            match memo.TryGetValue node with
            | true, v -> v
            | _ ->
                if inProg.Contains node then
                    0.0
                else
                    inProg.Add node |> ignore
                    let total =
                        familiesOf node f
                        |> List.sumBy (fun fam ->
                            let childProduct = fam.Kids |> List.fold (fun acc k -> acc * ins k) 1.0
                            // Prod = -1 is a terminal leaf (weight 1); otherwise the production potential.
                            let w = if fam.Prod < 0 then 1.0 else weight fam.Prod
                            w * childProduct)
                    inProg.Remove node |> ignore
                    memo.[node] <- total
                    total
        ins f.Root |> ignore
        memo |> Seq.map (fun kv -> kv.Key, kv.Value) |> Map.ofSeq

    /// The total inside weight of the forest under `weight` (the input's likelihood). Uniform
    /// weights ⇒ this equals `parseCount`.
    let insideTotal (weight: int -> float) (f: Forest) : float =
        inside weight f |> Map.tryFind f.Root |> Option.defaultValue 0.0

    /// **Weighted OUTSIDE pass** — the backward half of inside–outside (Baker; Lari–Young).
    /// `outside(root) = 1`; each node accumulates, from every parent-family it appears in,
    /// `outside(parent) × production-weight × Π inside(sibling children)`. Computed to a fixpoint
    /// (a DAG; damped by a round cap for same-span unit chains). Together with `inside`, this is
    /// full belief propagation on the parse forest — no cross-subsystem coupling.
    let outside (weight: int -> float) (f: Forest) : Map<Node, float> =
        let ins = inside weight f
        let insideOf (n: Node) = Map.tryFind n ins |> Option.defaultValue 0.0
        // contributions.[child] = (parent, coefficient) for every place child appears; coefficient
        // = production-weight × Π inside(other siblings) (the child's own inside is excluded).
        let contributions = System.Collections.Generic.Dictionary<Node, ResizeArray<Node * float>>(HashIdentity.Structural)
        let add (child: Node) (parent: Node) (coef: float) =
            match contributions.TryGetValue child with
            | true, lst -> lst.Add((parent, coef))
            | _ ->
                let lst = ResizeArray<Node * float>()
                lst.Add((parent, coef))
                contributions.[child] <- lst
        for KeyValue(parent, fams) in (f.Nodes |> Map.toSeq |> dict) do
            for fam in fams do
                let w = if fam.Prod < 0 then 1.0 else weight fam.Prod
                let kids = List.toArray fam.Kids
                for i in 0 .. kids.Length - 1 do
                    let siblingProduct =
                        kids
                        |> Array.mapi (fun j k -> if j = i then 1.0 else insideOf k)
                        |> Array.fold (*) 1.0
                    add kids.[i] parent (w * siblingProduct)
        // fixpoint iteration: root fixed at 1, others = Σ over parents of outside(parent)·coef.
        let out = System.Collections.Generic.Dictionary<Node, float>(HashIdentity.Structural)
        for KeyValue(n, _) in (f.Nodes |> Map.toSeq |> dict) do
            out.[n] <- 0.0
        out.[f.Root] <- 1.0
        let maxRounds = f.Nodes.Count + 2
        let mutable round = 0
        let mutable changed = true
        while changed && round < maxRounds do
            round <- round + 1
            changed <- false
            let snapshot = System.Collections.Generic.Dictionary<Node, float>(out)
            for KeyValue(child, contribs) in contributions do
                if child <> f.Root then
                    let s = contribs |> Seq.sumBy (fun (p, coef) -> (match snapshot.TryGetValue p with | true, v -> v | _ -> 0.0) * coef)
                    if abs (s - out.[child]) > 1e-12 then changed <- true
                    out.[child] <- s
        out |> Seq.map (fun kv -> kv.Key, kv.Value) |> Map.ofSeq

    /// The **marginal** probability mass passing through a sub-parse node — `inside(node) ×
    /// outside(node) / inside(root)`. This is the node's `NodeDistribution` weight (SSAS) / its
    /// `PredictProbability` share: 1.0 for a node in every parse, a fraction for an ambiguous one.
    /// `inside(root) = 0` (no parse) ⇒ 0.
    let marginals (weight: int -> float) (f: Forest) : Map<Node, float> =
        let ins = inside weight f
        let out = outside weight f
        let z = Map.tryFind f.Root ins |> Option.defaultValue 0.0
        if z = 0.0 then
            f.Nodes |> Map.map (fun _ _ -> 0.0)
        else
            f.Nodes
            |> Map.map (fun node _ ->
                let i = Map.tryFind node ins |> Option.defaultValue 0.0
                let o = Map.tryFind node out |> Option.defaultValue 0.0
                i * o / z)

    /// **Expected production counts** (the EM E-step): for each production, the expected number of
    /// times it is used across all parses of this input, under `weight`. Computed from
    /// inside–outside: a family's posterior = `weight(prod) · Π inside(kids) · outside(node) /
    /// inside(root)`; the expected count of a production is the sum of its families' posteriors over
    /// the whole forest (Baker 1979; Lari–Young 1990). This is exactly the E-step of PCFG EM.
    /// Returns `Map<prodIndex, expectedCount>`; empty if the input has no parse.
    let expectedCounts (weight: int -> float) (f: Forest) : Map<int, float> =
        let ins = inside weight f
        let out = outside weight f
        let z = Map.tryFind f.Root ins |> Option.defaultValue 0.0
        if z <= 0.0 then
            Map.empty
        else
            let mutable acc = Map.empty
            for (node, fams) in Map.toList f.Nodes do
                let o = Map.tryFind node out |> Option.defaultValue 0.0
                for fam in fams do
                    if fam.Prod >= 0 then
                        let kidsInside =
                            fam.Kids |> List.fold (fun a k -> a * (Map.tryFind k ins |> Option.defaultValue 0.0)) 1.0
                        let posterior = weight fam.Prod * kidsInside * o / z
                        acc <- Map.add fam.Prod ((Map.tryFind fam.Prod acc |> Option.defaultValue 0.0) + posterior) acc
            acc

    /// Enumerate the parse trees WITH their weights — each tree a `DynamicValue` (leaf `{term}`,
    /// internal `{rule,kids}`, matching `Slr.parseTree`), weight = product of the production
    /// weights along it (its inside weight). Feeds `ParseSoft.ofWeightedForest` → a `SoftValue`
    /// = `PredictProbability` over parses. Capped at `maxTrees` (enumeration is exponential;
    /// the polynomial marginals are `marginals`). Cycle-guarded ⇒ total.
    let weightedTrees (weight: int -> float) (maxTrees: int) (f: Forest) : (DynamicValue * float) list =
        let symName (s: Sym) =
            match s with
            | GrammarIr.Term n
            | GrammarIr.NonTerm n -> n
        let memo = System.Collections.Generic.Dictionary<Node, (DynamicValue * float) list>(HashIdentity.Structural)
        let inProg = System.Collections.Generic.HashSet<Node>(HashIdentity.Structural)
        let rec enum (node: Node) : (DynamicValue * float) list =
            match memo.TryGetValue node with
            | true, v -> v
            | _ ->
                if inProg.Contains node then
                    []
                else
                    inProg.Add node |> ignore
                    let (sym, _, _) = node
                    let result =
                        familiesOf node f
                        |> List.collect (fun fam ->
                            if fam.Prod < 0 then
                                [ DynamicValue.Object [ "term", DynamicValue.String(symName sym) ], 1.0 ]
                            else
                                // cartesian product of the children's (tree, weight) enumerations
                                let combos =
                                    fam.Kids
                                    |> List.fold
                                        (fun acc kid ->
                                            [ for (kidsSoFar, wAcc) in acc do
                                                  for (t, w) in enum kid do
                                                      yield (kidsSoFar @ [ t ], wAcc * w) ])
                                        [ ([], 1.0) ]
                                [ for (kids, wKids) in combos ->
                                      DynamicValue.Object
                                          [ "rule", DynamicValue.String(symName sym)
                                            "kids", DynamicValue.Array kids ],
                                      weight fam.Prod * wKids ])
                        |> List.truncate maxTrees
                    inProg.Remove node |> ignore
                    memo.[node] <- result
                    result
        enum f.Root |> List.truncate maxTrees

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
