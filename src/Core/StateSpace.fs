namespace Zeta.Core

open System.Collections.Generic

/// **`StateSpace` — indexed reachable-state search; the content hash detects cycles (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"our whole game eventually becomes indexing state-space search, so one of our two content hashes can
/// detect cycles in branching when we run in soft mode."* This is that index. Soft mode forks on input (RND is
/// seed-deterministic → input is the only branching); we BFS the reachable frames and key each by its **content
/// hash** (`contentKey`) in a **transposition table** (`Dictionary<key,id>`). A revisit of an existing key is a
/// **transposition** (a different input path reaching the same state — merge the edge, don't re-expand); a child
/// whose key equals its parent's is a **self-loop** (a fixed-point cycle). This is exactly a chess engine's
/// Zobrist transposition table + cycle detection, and it is what bounds the DAG (reconverging paths dedup) and
/// makes the search the *omniscient ground-truth solve* while the state space is small enough to exhaust.
///
/// **The two hashes (Aaron):** (1) the **state-content hash** here = identity → cycle/transposition detection +
/// dedup; (2) a **path/Merkle hash** over the `(parent,input)` edges = backward plan recovery + verifiable
/// provenance (the edges are recorded here; the Merkle layer is a later slice).
///
/// **Honest scope (peel):** `Revisits` counts *all* re-encounters of an indexed state (transpositions, which
/// include cycles); `SelfLoops` is the strict fixed-point case (child key = parent key). True back-edge cycle
/// detection (revisit of an *ancestor on the current path*, vs a sideways transposition) needs path tracking —
/// not done here; `Revisits` is the superset. `maxStates` bounds the search (`Truncated` reports when hit) — for
/// a small ROM the full space fits (omniscient); for a large one this is a *bounded* frontier, not exhaustive.
/// Deterministic (DST). `contentKey` is structural (the index key); a hex/Merkle *hash* of it is the verifiable form.
[<RequireQualifiedAccess>]
module StateSpace =

    /// The content key of a frame = its identity for indexing (the "content hash", structural form). `Frame`
    /// itself isn't comparable (byte[] fields), so this projects to a fully-comparable, hashable tuple.
    let contentKey (f: Chip8Cow.Frame) =
        (int f.PC,
         [ for v in f.V -> int v ],
         int f.I,
         Map.toList f.Mem,
         Map.toList f.Display,
         f.Stack,
         int f.Delay,
         int f.Sound,
         [ for k in f.Keys -> k ],
         f.Rng)

    /// The reachable-state graph: `Frames.[id]` is the state, `Edges` are `(fromId, input, toId)`.
    type Graph =
        { Frames: Chip8Cow.Frame[]
          Edges: (int * bool[] * int) list
          /// Transpositions: edges that re-reached an already-indexed state (includes cycles).
          Revisits: int
          /// Self-loops: a child whose content equals its parent's (a fixed-point cycle).
          SelfLoops: int
          /// Hit `maxStates` before the space was exhausted.
          Truncated: bool }

        member g.StateCount = g.Frames.Length

    /// **Explore the reachable state space** from `f0` by BFS, forking over `actions` each frame
    /// (`Chip8Cow.frameStep cyclesPerFrame`), indexing states by `contentKey`. Bounded by `maxStates`.
    let explore (cyclesPerFrame: int) (maxStates: int) (actions: bool[] list) (f0: Chip8Cow.Frame) : Graph =
        let index = Dictionary<_, int>(HashIdentity.Structural)
        let frames = ResizeArray<Chip8Cow.Frame>()
        let edges = ResizeArray<int * bool[] * int>()
        let queue = Queue<int>()
        let mutable revisits = 0
        let mutable selfLoops = 0
        let mutable truncated = false

        let addNew (f: Chip8Cow.Frame) =
            let id = frames.Count
            frames.Add f
            index.[contentKey f] <- id
            queue.Enqueue id
            id

        addNew f0 |> ignore

        while queue.Count > 0 do
            let fromId = queue.Dequeue()
            let parent = frames.[fromId]
            let pk = contentKey parent
            for a in actions do
                let child = Chip8Cow.frameStep cyclesPerFrame { parent with Keys = a }
                let ck = contentKey child
                if ck = pk then selfLoops <- selfLoops + 1
                match index.TryGetValue ck with
                | true, toId ->
                    revisits <- revisits + 1
                    edges.Add(fromId, a, toId)
                | false, _ ->
                    if frames.Count >= maxStates then truncated <- true
                    else edges.Add(fromId, a, addNew child)

        { Frames = frames.ToArray()
          Edges = List.ofSeq edges
          Revisits = revisits
          SelfLoops = selfLoops
          Truncated = truncated }

    /// Was any cycle detected (a transposition/revisit or a self-loop)? — branching converges/loops in soft mode.
    let hasCycle (g: Graph) : bool = g.Revisits > 0 || g.SelfLoops > 0

    /// **Generic guarded explore** — like `exploreGuarded`, but indexes states by an arbitrary `keyOf` projection
    /// (not just the full `contentKey`). Pass `contentKey` for the exact (sound, conservative) state; pass
    /// `MemoryLens.lensKey classes` for the lens-reduced state (finite where exact is infinite).
    ///
    /// **Soundness caveat (load-bearing):** `keyOf` must retain every cell the `invariant` depends on. If `keyOf`
    /// drops a cell that is *autonomous yet lethal* (a doom timer), a cycle in key-space can be **spurious** — it
    /// merges states differing only in the hidden lethal cell → a false "loops forever". The `invariant` is still
    /// checked on the *full* child frame (so a violating step is pruned), but the *cycle* is only meaningful if the
    /// key separates survival-relevant states. Use `contentKey` when in doubt.
    let exploreKeyed (keyOf: Chip8Cow.Frame -> 'k) (invariant: Chip8Cow.Frame -> bool) (cyclesPerFrame: int) (maxStates: int) (actions: bool[] list) (f0: Chip8Cow.Frame) : Graph =
        let index = Dictionary<'k, int>(HashIdentity.Structural)
        let frames = ResizeArray<Chip8Cow.Frame>()
        let edges = ResizeArray<int * bool[] * int>()
        let queue = Queue<int>()
        let mutable revisits = 0
        let mutable selfLoops = 0
        let mutable truncated = false

        let addNew (f: Chip8Cow.Frame) =
            let id = frames.Count
            frames.Add f
            index.[keyOf f] <- id
            queue.Enqueue id
            id

        if invariant f0 then addNew f0 |> ignore

        while queue.Count > 0 do
            let fromId = queue.Dequeue()
            let parent = frames.[fromId]
            let pk = keyOf parent
            for a in actions do
                let child = Chip8Cow.frameStep cyclesPerFrame { parent with Keys = a }
                if invariant child then
                    let ck = keyOf child
                    if ck = pk then selfLoops <- selfLoops + 1
                    match index.TryGetValue ck with
                    | true, toId ->
                        revisits <- revisits + 1
                        edges.Add(fromId, a, toId)
                    | false, _ ->
                        if frames.Count >= maxStates then truncated <- true
                        else edges.Add(fromId, a, addNew child)

        { Frames = frames.ToArray()
          Edges = List.ofSeq edges
          Revisits = revisits
          SelfLoops = selfLoops
          Truncated = truncated }

    /// **Guarded explore — the invariant constraint** (the don't-die ≡ no-downtime guard, #7119). Same BFS as
    /// `explore`, but a child that **violates `invariant`** is *never entered* (not indexed, not expanded) — it's
    /// a forbidden state, pruned (dropped, not indexed). `Revisits`/`SelfLoops`/`Truncated` carry their usual
    /// meaning over the *safe* subspace. The resulting `Graph` therefore contains **only invariant-satisfying
    /// states** — every path through it is safe by construction (a winning game line that never dies / a deploy
    /// sequence that never goes down).
    let exploreGuarded (invariant: Chip8Cow.Frame -> bool) (cyclesPerFrame: int) (maxStates: int) (actions: bool[] list) (f0: Chip8Cow.Frame) : Graph =
        let index = Dictionary<_, int>(HashIdentity.Structural)
        let frames = ResizeArray<Chip8Cow.Frame>()
        let edges = ResizeArray<int * bool[] * int>()
        let queue = Queue<int>()
        let mutable revisits = 0
        let mutable selfLoops = 0
        let mutable truncated = false

        let addNew (f: Chip8Cow.Frame) =
            let id = frames.Count
            frames.Add f
            index.[contentKey f] <- id
            queue.Enqueue id
            id

        // The root must itself be safe; if not, the safe subspace is empty.
        if invariant f0 then
            addNew f0 |> ignore

        while queue.Count > 0 do
            let fromId = queue.Dequeue()
            let parent = frames.[fromId]
            let pk = contentKey parent
            for a in actions do
                let child = Chip8Cow.frameStep cyclesPerFrame { parent with Keys = a }
                if invariant child then // forbidden states are pruned (don't-die / no-downtime)
                    let ck = contentKey child
                    if ck = pk then selfLoops <- selfLoops + 1
                    match index.TryGetValue ck with
                    | true, toId ->
                        revisits <- revisits + 1
                        edges.Add(fromId, a, toId)
                    | false, _ ->
                        if frames.Count >= maxStates then truncated <- true
                        else edges.Add(fromId, a, addNew child)

        { Frames = frames.ToArray()
          Edges = List.ofSeq edges
          Revisits = revisits
          SelfLoops = selfLoops
          Truncated = truncated }


    /// **Backward plan recovery:** the shortest input sequence from state 0 to `goal`, by BFS over the edges
    /// (the `(parent,input)` back-trace). `None` if `goal` is unreachable from the root in the explored graph.
    let recoverPlan (goal: int) (g: Graph) : (bool[] list) option =
        if goal < 0 || goal >= g.StateCount then None
        elif goal = 0 then Some []
        else
            // BFS from 0, recording the (predecessor, input) that first reaches each state.
            let pred = Dictionary<int, int * bool[]>()
            let seen = HashSet<int>([ 0 ])
            let q = Queue<int>([ 0 ])
            let adj = g.Edges |> List.groupBy (fun (f, _, _) -> f) |> dict
            let mutable found = false
            while q.Count > 0 && not found do
                let u = q.Dequeue()
                match adj.TryGetValue u with
                | true, outs ->
                    for (_, input, v) in outs do
                        if seen.Add v then
                            pred.[v] <- (u, input)
                            if v = goal then found <- true
                            q.Enqueue v
                | _ -> ()
            if not (pred.ContainsKey goal) then None
            else
                let rec back (node: int) (acc: bool[] list) =
                    if node = 0 then acc
                    else
                        let p, input = pred.[node]
                        back p (input :: acc)
                Some(back goal [])

    /// **Goal-directed plan:** the shortest input sequence from the root to *any* explored state satisfying
    /// `goal` (a winning/deployed predicate), by BFS over the edges. `None` if no explored state satisfies it.
    /// Compose with `exploreGuarded` so the recovered plan is safe by construction (every step held the invariant).
    let planTo (goal: Chip8Cow.Frame -> bool) (g: Graph) : (bool[] list) option =
        match g.Frames |> Array.tryFindIndex goal with
        | None -> None
        | Some t -> recoverPlan t g
