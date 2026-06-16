module Zeta.Tests.HierarchicalPlanningTests

open global.Xunit
open System.Collections.Generic

// ═══════════════════════════════════════════════════════════════════════════
// MVP discharge of the §B hierarchical-planning row (#8467) — the open problem
// LeCun names ("nobody has proved they know how to do this").
//
// THE CLAIM (worked, here): a 2-level planner — coarse BFS over regions, then
// fine BFS within each region, concatenated — REACHES the same goal as a flat
// BFS while exploring FAR FEWER states, and replays DETERMINISTICALLY.
// That is the scheduler-of-schedulers + gist-abstraction-ladder bet, reduced to
// its load-bearing core: abstraction beats flat search.
//
// HONEST SCOPE (peel): this is the ALGORITHM-LEVEL discharge on a clean
// parameterized grid. The production wiring — ActionGrid (fixed 4×4, too small
// to "explode") as the nav space, and `StateSpace.exploreKeyed` (CHIP-8 frames;
// the `keyOf` projection IS the region-coarsening) as the search — is the next
// slice, per docs/research/2026-06-16-hierarchical-planning-discharge-scoping-…md.
// Liveness (does it terminate, not just not-explode) routes via observe.ts.
// ═══════════════════════════════════════════════════════════════════════════

type private Cell = int * int // (row, col)

let private neighbors (inSpace: Cell -> bool) ((r, c): Cell) : Cell list =
    [ (r - 1, c); (r + 1, c); (r, c - 1); (r, c + 1) ] |> List.filter inSpace

/// BFS over `inSpace` from `start` to the first cell satisfying `isGoal`.
/// Returns (statesExplored, path) with path = start..goal inclusive.
/// DETERMINISTIC: fixed neighbour order (U,D,L,R) + FIFO queue ⇒ same input,
/// same output. `statesExplored` = distinct cells dequeued (the search cost).
let private bfs (inSpace: Cell -> bool) (start: Cell) (isGoal: Cell -> bool) : int * Cell list =
    let pred = Dictionary<Cell, Cell>()
    let seen = HashSet<Cell>()
    let q = Queue<Cell>()
    seen.Add start |> ignore
    q.Enqueue start
    let mutable explored = 0
    let mutable goal: Cell option = None
    while q.Count > 0 && goal.IsNone do
        let u = q.Dequeue()
        explored <- explored + 1
        if isGoal u then
            goal <- Some u
        else
            for v in neighbors inSpace u do
                if seen.Add v then
                    pred.[v] <- u
                    q.Enqueue v
    match goal with
    | None -> explored, []
    | Some g ->
        let rec back node acc =
            if node = start then start :: acc else back pred.[node] (node :: acc)
        explored, back g []

// ── the task: an N×N open grid, start corner → goal corner (worst case: the
//    goal is the farthest cell, so flat BFS must explore ~the whole grid) ──
let private N = 64
let private B = 8 // block edge; the coarse super-grid is (N/B)×(N/B) = 8×8
let private inGrid ((r, c): Cell) = r >= 0 && r < N && c >= 0 && c < N
let private start: Cell = (0, 0)
let private goal: Cell = (N - 1, N - 1)

/// FLAT planner — one BFS over the whole grid.
let private flatPlan () : int * Cell list = bfs inGrid start (fun u -> u = goal)

let private blockOf ((r, c): Cell) : Cell = (r / B, c / B)
let private inBlock (br, bc) ((r, c): Cell) = r / B = br && c / B = bc && inGrid (r, c)

/// HIERARCHICAL planner — coarse BFS over B-blocks (the abstraction level), then
/// a fine BFS within each block from entry to exit. Returns
/// (statesExplored, segments) where segments concatenate to a start→goal path.
let private hierPlan () : int * (Cell list) list =
    let nb = N / B
    let inSuper ((r, c): Cell) = r >= 0 && r < nb && c >= 0 && c < nb
    let coarseExplored, coarsePath = bfs inSuper (blockOf start) (fun b -> b = blockOf goal)
    let mutable fineExplored = 0
    let segments = ResizeArray<Cell list>()
    let mutable cur = start
    let rec walk (blocks: Cell list) =
        match blocks with
        | [] -> ()
        | [ _last ] ->
            // final block: fine BFS from the current cell to the real goal
            let e, seg = bfs (inBlock (blockOf cur)) cur (fun u -> u = goal)
            fineExplored <- fineExplored + e
            segments.Add seg
        | bi :: (binext :: _ as rest) ->
            let (br, bc) = bi
            let (nbr, nbc) = binext
            let (cr, cc) = cur
            // crossing is to an adjacent block (super-grid BFS ⇒ ±1 in one axis);
            // pick the aligned border cells so exit & entry are 4-neighbours.
            let exitCell, entryNext =
                if nbc = bc + 1 then (cr, bc * B + B - 1), (cr, nbc * B) // right
                elif nbc = bc - 1 then (cr, bc * B), (cr, nbc * B + B - 1) // left
                elif nbr = br + 1 then (br * B + B - 1, cc), (nbr * B, cc) // down
                else (br * B, cc), (nbr * B + B - 1, cc) // up
            let e, seg = bfs (inBlock bi) cur (fun u -> u = exitCell)
            fineExplored <- fineExplored + e
            segments.Add seg
            cur <- entryNext
            walk rest
    walk coarsePath
    coarseExplored + fineExplored, List.ofSeq segments

let private step1 ((r1, c1): Cell) ((r2, c2): Cell) = abs (r1 - r2) + abs (c1 - c2) = 1
let private contiguous (xs: Cell list) = List.pairwise xs |> List.forall (fun (a, b) -> step1 a b)

[<Fact>]
let ``hierarchical planner reaches the goal AND explores far fewer states than flat`` () =
    let flatExplored, flatPath = flatPlan ()
    let hierExplored, segs = hierPlan ()

    // flat plan is a valid start→goal path
    Assert.Equal(start, List.head flatPath)
    Assert.Equal(goal, List.last flatPath)
    Assert.True(contiguous flatPath)

    // hierarchical plan: segments chain into a valid start→goal path
    Assert.Equal(start, List.head (List.head segs))
    Assert.Equal(goal, List.last (List.last segs))
    Assert.True(segs |> List.forall contiguous) // each segment internally valid
    Assert.True( // consecutive segments link across the block border (4-neighbour)
        List.pairwise segs
        |> List.forall (fun (a, b) -> step1 (List.last a) (List.head b))
    )

    // THE CLAIM: abstraction beats flat — hierarchical explores ≪ flat.
    Assert.True(
        hierExplored * 2 < flatExplored,
        sprintf "expected hier ≪ flat; got hier=%d flat=%d" hierExplored flatExplored
    )

[<Fact>]
let ``both planners replay deterministically (byte-identical)`` () =
    let a1, p1 = flatPlan ()
    let a2, p2 = flatPlan ()
    Assert.Equal(a1, a2)
    Assert.Equal<Cell list>(p1, p2)
    let h1, s1 = hierPlan ()
    let h2, s2 = hierPlan ()
    Assert.Equal(h1, h2)
    Assert.Equal<(Cell list) list>(s1, s2)
