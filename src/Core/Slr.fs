namespace Zeta.Core

/// **Slr — an SLR(1) parser backend for the Zeta Grammar IR (rung 3, the ZetaParse backend).**
/// (Aaron 2026-07-02, shadow*: "no pivot just continue" — the LR/GLR rung.)
///
/// The payoff of the parser/generator ladder: `Grammar IR → an executable parser`. This is the
/// classic LR-family construction (Knuth 1965 LR; DeRemer SLR) over the neutral `GrammarIr`:
/// augment the grammar, build the LR(0) item-set automaton, compute FIRST/FOLLOW (nullable-aware
/// — our desugared grammars have ε productions), fill the ACTION/GOTO tables (SLR uses FOLLOW to
/// place reductions), and run a shift/reduce driver. `build` reports shift/reduce and
/// reduce/reduce CONFLICTS rather than silently resolving them (a GLR fallback for genuinely
/// ambiguous grammars is the next extension). Deterministic (canonical item-set order) ⇒ DST-
/// replayable and byte-lockable like everything on the ladder.
///
/// Anchors: Knuth (*On the Translation of Languages Left to Right*, 1965); DeRemer (SLR/LALR);
/// Aho–Sethi–Ullman (the Dragon Book construction); ZetaParse (Amara). Consumes `GrammarIr`.
[<RequireQualifiedAccess>]
module Slr =

    type private Sym = GrammarIr.Symbol

    /// A parse-table action.
    type Action =
        | Shift of int
        | Reduce of int
        | Accept

    /// A built SLR(1) table over the augmented grammar. `Prods.[0]` is the augmenting
    /// production `S' → start`.
    type Tables =
        { Prods: (string * Sym list)[]
          Action: Map<int * string, Action>
          Goto: Map<int * string, int>
          Start: int
          Conflicts: string list }

    /// The end-of-input marker.
    [<Literal>]
    let endMarker = "$"

    let private symName (s: Sym) : string =
        match s with
        | GrammarIr.Term n
        | GrammarIr.NonTerm n -> n

    // Augment: prepend S' → start. `_S'` is a fresh name (grammars use lowercase rule names).
    let private augment (g: GrammarIr.Grammar) : (string * Sym list)[] =
        Array.append
            [| "_S'", [ GrammarIr.NonTerm g.Start ] |]
            (g.Productions |> List.map (fun p -> p.Lhs, p.Rhs) |> Array.ofList)

    // ── nullable / FIRST / FOLLOW (fixpoint) ──

    let private nonTermNames (prods: (string * Sym list)[]) : Set<string> =
        prods |> Array.map fst |> Set.ofArray

    let private isNullableSeq (nullable: Set<string>) (syms: Sym list) : bool =
        syms
        |> List.forall (fun s ->
            match s with
            | GrammarIr.NonTerm n -> nullable.Contains n
            | GrammarIr.Term _ -> false)

    let private computeNullable (prods: (string * Sym list)[]) : Set<string> =
        let mutable nullable = Set.empty
        let mutable changed = true
        while changed do
            changed <- false
            for (lhs, rhs) in prods do
                if not (nullable.Contains lhs) && isNullableSeq nullable rhs then
                    nullable <- nullable.Add lhs
                    changed <- true
        nullable

    let private firstOfSeq (firstNt: Map<string, Set<string>>) (nullable: Set<string>) (syms: Sym list) : Set<string> =
        let rec go acc =
            function
            | [] -> acc
            | s :: rest ->
                match s with
                | GrammarIr.Term n -> Set.add n acc
                | GrammarIr.NonTerm n ->
                    let acc = Set.union acc (Map.tryFind n firstNt |> Option.defaultValue Set.empty)
                    if nullable.Contains n then go acc rest else acc
        go Set.empty syms

    let private computeFirst (prods: (string * Sym list)[]) (nullable: Set<string>) : Map<string, Set<string>> =
        let nts = nonTermNames prods
        let mutable first = nts |> Set.toSeq |> Seq.map (fun n -> n, Set.empty) |> Map.ofSeq
        let mutable changed = true
        while changed do
            changed <- false
            for (lhs, rhs) in prods do
                let cur = Map.find lhs first
                let next = Set.union cur (firstOfSeq first nullable rhs)
                if next <> cur then
                    first <- Map.add lhs next first
                    changed <- true
        first

    let private computeFollow
        (prods: (string * Sym list)[])
        (nullable: Set<string>)
        (first: Map<string, Set<string>>)
        (startLhs: string)
        : Map<string, Set<string>> =
        let nts = nonTermNames prods
        let mutable follow = nts |> Set.toSeq |> Seq.map (fun n -> n, Set.empty) |> Map.ofSeq
        follow <- Map.add startLhs (Set.singleton endMarker) follow
        let mutable changed = true
        while changed do
            changed <- false
            for (lhs, rhs) in prods do
                let arr = List.toArray rhs
                for i in 0 .. arr.Length - 1 do
                    match arr.[i] with
                    | GrammarIr.Term _ -> ()
                    | GrammarIr.NonTerm b ->
                        let beta = arr.[i + 1 ..] |> List.ofArray
                        let cur = Map.find b follow
                        let mutable next = Set.union cur (firstOfSeq first nullable beta)
                        if isNullableSeq nullable beta then
                            next <- Set.union next (Map.find lhs follow)
                        if next <> cur then
                            follow <- Map.add b next follow
                            changed <- true
        follow

    // ── LR(0) items + closure + goto ──  (item = production index, dot position)

    let private closure (prods: (string * Sym list)[]) (items: Set<int * int>) : Set<int * int> =
        let rec loop (work: Set<int * int>) =
            let mutable added = work
            let mutable changed = false
            for (p, dot) in work do
                let (_, rhs) = prods.[p]
                let arr = List.toArray rhs
                if dot < arr.Length then
                    match arr.[dot] with
                    | GrammarIr.NonTerm b ->
                        prods
                        |> Array.iteri (fun pi (lhs, _) ->
                            if lhs = b then
                                let it = (pi, 0)
                                if not (added.Contains it) then
                                    added <- added.Add it
                                    changed <- true)
                    | GrammarIr.Term _ -> ()
            if changed then loop added else added
        loop items

    let private gotoSet (prods: (string * Sym list)[]) (items: Set<int * int>) (x: string) : Set<int * int> =
        let moved =
            items
            |> Set.toSeq
            |> Seq.choose (fun (p, dot) ->
                let (_, rhs) = prods.[p]
                let arr = List.toArray rhs
                if dot < arr.Length && symName arr.[dot] = x then Some(p, dot + 1) else None)
            |> Set.ofSeq
        if Set.isEmpty moved then Set.empty else closure prods moved

    let private allSymbols (prods: (string * Sym list)[]) : string list =
        prods
        |> Array.collect (fun (lhs, rhs) -> Array.append [| lhs |] (rhs |> List.map symName |> Array.ofList))
        |> Array.distinct
        |> List.ofArray

    /// Build the SLR(1) tables from a grammar. `Error` only on an empty grammar; genuine LR
    /// conflicts are reported in `Tables.Conflicts` (non-fatal — they surface, not silent).
    let build (g: GrammarIr.Grammar) : Result<Tables, string> =
        if List.isEmpty g.Productions then
            Error "slr: grammar has no productions"
        else
            let prods = augment g
            let nullable = computeNullable prods
            let first = computeFirst prods nullable
            let follow = computeFollow prods nullable first "_S'"
            let nts = nonTermNames prods
            let isTerm name = not (nts.Contains name)
            let syms = allSymbols prods

            let states = System.Collections.Generic.List<Set<int * int>>()
            let index = System.Collections.Generic.Dictionary<Set<int * int>, int>(HashIdentity.Structural)
            let start = closure prods (Set.singleton (0, 0))
            states.Add start
            index.[start] <- 0
            let mutable i = 0
            while i < states.Count do
                let st = states.[i]
                for x in syms do
                    let g2 = gotoSet prods st x
                    if not (Set.isEmpty g2) && not (index.ContainsKey g2) then
                        index.[g2] <- states.Count
                        states.Add g2
                i <- i + 1

            let mutable action = Map.empty
            let mutable gotoTbl = Map.empty
            let conflicts = System.Collections.Generic.List<string>()

            let setAction (s: int) (a: string) (act: Action) =
                match Map.tryFind (s, a) action with
                | Some existing when existing <> act -> conflicts.Add(sprintf "state %d on '%s': %A vs %A" s a existing act)
                | _ -> action <- Map.add (s, a) act action

            for si in 0 .. states.Count - 1 do
                let st = states.[si]
                for (p, dot) in st do
                    let (lhs, rhs) = prods.[p]
                    let arr = List.toArray rhs
                    if dot < arr.Length then
                        let x = symName arr.[dot]
                        let j = index.[gotoSet prods st x]
                        if isTerm x then setAction si x (Shift j) else gotoTbl <- Map.add (si, x) j gotoTbl
                    elif p = 0 then
                        setAction si endMarker Accept
                    else
                        for t in Map.find lhs follow do
                            setAction si t (Reduce p)

            Ok
                { Prods = prods
                  Action = action
                  Goto = gotoTbl
                  Start = 0
                  Conflicts = conflicts |> List.ofSeq }

    /// Run the shift/reduce driver over a token stream (terminal names). Returns the sequence of
    /// production indices reduced (the rightmost derivation in reverse) on accept, or an `Error`
    /// describing the first rejection. Total: never throws.
    let parse (t: Tables) (tokens: string list) : Result<int list, string> =
        let input = List.toArray (tokens @ [ endMarker ])
        let mutable ip = 0
        let mutable stack = [ t.Start ]
        let reductions = System.Collections.Generic.List<int>()
        let mutable result: Result<int list, string> option = None
        let mutable guard = 0
        while result.IsNone do
            guard <- guard + 1
            if guard > 1_000_000 then
                result <- Some(Error "slr: parse exceeded step budget (grammar loop?)")
            else
                let s = List.head stack
                let a = if ip < input.Length then input.[ip] else endMarker
                match Map.tryFind (s, a) t.Action with
                | Some(Shift j) ->
                    stack <- j :: stack
                    ip <- ip + 1
                | Some(Reduce p) ->
                    reductions.Add p
                    let (lhs, rhs) = t.Prods.[p]
                    let popped = List.skip (List.length rhs) stack
                    let top = List.head popped
                    match Map.tryFind (top, lhs) t.Goto with
                    | Some g -> stack <- g :: popped
                    | None -> result <- Some(Error(sprintf "slr: no GOTO for '%s' in state %d" lhs top))
                | Some Accept -> result <- Some(Ok(reductions |> List.ofSeq))
                | None -> result <- Some(Error(sprintf "slr: unexpected token '%s' in state %d" a s))
        result |> Option.defaultValue (Error "slr: unreachable")

    /// Parse into a concrete syntax TREE — itself a `DynamicValue`, so the parser's output rides
    /// the whole codec stack (homoiconic all the way through: grammar-as-data → parser →
    /// parse-tree-as-data). A leaf is `{ "term": <token> }`; an internal node is
    /// `{ "rule": <lhs>, "kids": [ … ] }` (children in source order). Total: never throws.
    let parseTree (t: Tables) (tokens: string list) : Result<DynamicValue, string> =
        let leaf (tok: string) = DynamicValue.Object [ "term", DynamicValue.String tok ]
        let node (lhs: string) (kids: DynamicValue list) =
            DynamicValue.Object [ "rule", DynamicValue.String lhs; "kids", DynamicValue.Array kids ]
        let input = List.toArray (tokens @ [ endMarker ])
        let mutable ip = 0
        let mutable stack = [ t.Start ]
        let mutable trees: DynamicValue list = [] // head = top; parallel to `stack` (minus start)
        let mutable result: Result<DynamicValue, string> option = None
        let mutable guard = 0
        while result.IsNone do
            guard <- guard + 1
            if guard > 1_000_000 then
                result <- Some(Error "slr: parse exceeded step budget (grammar loop?)")
            else
                let s = List.head stack
                let a = if ip < input.Length then input.[ip] else endMarker
                match Map.tryFind (s, a) t.Action with
                | Some(Shift j) ->
                    stack <- j :: stack
                    trees <- leaf a :: trees
                    ip <- ip + 1
                | Some(Reduce p) ->
                    let (lhs, rhs) = t.Prods.[p]
                    let n = List.length rhs
                    let popped = List.skip n stack
                    let top = List.head popped
                    let kids = trees |> List.truncate n |> List.rev
                    let restTrees = trees |> List.skip n
                    match Map.tryFind (top, lhs) t.Goto with
                    | Some g ->
                        stack <- g :: popped
                        trees <- node lhs kids :: restTrees
                    | None -> result <- Some(Error(sprintf "slr: no GOTO for '%s' in state %d" lhs top))
                | Some Accept ->
                    match trees with
                    | [ root ] -> result <- Some(Ok root)
                    | _ -> result <- Some(Ok(node "_S'" (List.rev trees))) // defensive: wrap
                | None -> result <- Some(Error(sprintf "slr: unexpected token '%s' in state %d" a s))
        result |> Option.defaultValue (Error "slr: unreachable")

    /// Convenience: does the grammar accept the token stream?
    let accepts (t: Tables) (tokens: string list) : bool =
        match parse t tokens with
        | Ok _ -> true
        | Error _ -> false
