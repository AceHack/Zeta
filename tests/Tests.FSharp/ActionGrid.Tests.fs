module Zeta.Tests.ActionGridTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module AG = Zeta.Core.ActionGrid

// ═══════════════════════════════════════════════════════════════════
// ActionGrid — the 4×4 keystone: NAVIGATION IS LABEL-INDEPENDENT.
// (docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md §B-frame, Layer 2 — the one open obligation.)
//
// "Directionality stays the same while labels change" is true IFF how-you-move depends only on grid
// coordinates and never peeks at a label. We make label-independence a discriminating PREDICATE over
// the space of possible navigations (Nav = World -> Position -> Direction -> Position option), prove the
// fixed geometry satisfies it for ALL world pairs, and add a NEGATIVE CONTROL (a label-peeking nav that
// the predicate correctly REJECTS) so the property is not vacuous. Plus the fixed-geometry laws
// (determinism, edge-closedness, interior invertibility, fixed color) that give navigation real content
// independent of the labels — and trajectory/relabel-commutation as the operational form of the keystone.
// ═══════════════════════════════════════════════════════════════════

let private genPos : Gen<AG.Position> =
    gen {
        let! r = Gen.choose (0, AG.size - 1)
        let! c = Gen.choose (0, AG.size - 1)
        return { AG.Row = r; AG.Col = c }
    }

let private genDir : Gen<AG.Direction> = Gen.elements [ AG.Up; AG.Down; AG.Left; AG.Right ]

// A world: an arbitrary labeling of some cells with arbitrary DynamicValues.
let private genWorld : Gen<AG.World> =
    gen {
        let! n = Gen.choose (0, 16)
        let! pairs =
            Gen.listOfLength n (
                gen {
                    let! p = genPos
                    let! tag = Gen.choose (0, 1000) |> Gen.map int64
                    return p, DynamicValue.Int tag
                })
        return Map.ofList pairs
    }

type GridArb() =
    static member P() = Arb.fromGen genPos
    static member D() = Arb.fromGen genDir
    static member W() = Arb.fromGen genWorld
    static member Ds() = Arb.fromGen (Gen.listOf genDir)

// ── THE KEYSTONE: navigation is label-independent ──

[<Property(Arbitrary = [| typeof<GridArb> |])>]
let ``KEYSTONE: the fixed geometry is label-independent across any two worlds`` (w1: AG.World) (w2: AG.World) =
    AG.labelIndependentOver w1 w2 AG.geomNav

[<Fact>]
let ``KEYSTONE negative control: a label-peeking nav is correctly REJECTED by the predicate`` () =
    // A deliberately broken navigation that changes behaviour based on whether the cell is labeled —
    // exactly the failure mode the keystone forbids. The predicate must catch it (else it is vacuous).
    let peekingNav : AG.Nav =
        fun w p d ->
            match AG.labelAt p w with
            | Some _ -> None // "blocked if labeled" — navigation depends on the label = the violation
            | None -> AG.move p d
    let labeled : AG.World = Map.ofList [ { AG.Row = 0; AG.Col = 0 }, DynamicValue.Int 1L ]
    let empty : AG.World = Map.empty
    // geometry passes; the peeking nav fails — the predicate discriminates.
    Assert.True(AG.labelIndependentOver labeled empty AG.geomNav)
    Assert.False(AG.labelIndependentOver labeled empty peekingNav)

// ── operational form: trajectory is independent of world; relabeling commutes with navigation ──

/// Fold a `Nav` along a direction list, mirroring `AG.navigate`'s stop-at-wall semantics. The world
/// is threaded in, which is the whole point: it lets a TRAJECTORY be compared ACROSS two worlds, so
/// the world-independence claim becomes a check over a pair of executions instead of a restatement
/// of `AG.navigate`'s signature. Instantiated at `AG.geomNav` it is exactly `AG.navigate`; the
/// negative control below instantiates it at a label-peeking nav and requires the pair to DIVERGE.
let rec private trajectoryUnder
    (nav: AG.Nav)
    (w: AG.World)
    (start: AG.Position)
    (dirs: AG.Direction list)
    : AG.Position list =
    match dirs with
    | [] -> [ start ]
    | d :: rest ->
        match nav w start d with
        | Some next -> start :: trajectoryUnder nav w next rest
        | None -> [ start ]

[<Property(Arbitrary = [| typeof<GridArb> |])>]
let ``navigate trajectory is identical regardless of world state`` (start: AG.Position) (dirs: AG.Direction list) (w1: AG.World) (w2: AG.World) =
    // REWRITTEN 2026-08-23 (Soraya), workitem 081M0RAX8AC087G0R003NQM7P9. This property used to read
    //     ignore (w1, w2)
    //     AG.navigate start dirs = AG.navigate start dirs
    // The two generated worlds — the ONLY variable the name quantifies over — were explicitly
    // discarded and one expression was compared to itself. World-independence is 2-SAFETY (Clarkson
    // & Schneider 2008): a predicate over PAIRS of executions differing in the world. Holding the
    // world fixed makes the pair degenerate, so the check had arity 1 against an arity-2 claim.
    //
    // The arity-2 form runs the trajectory through a `Nav`, the surface that CAN see a world, and
    // varies the world across the pair. `trajectoryUnder AG.geomNav w` IS `AG.navigate` (geomNav
    // discards its world), so nothing about the claim is weakened — it is finally stated over a pair.
    trajectoryUnder AG.geomNav w1 start dirs = trajectoryUnder AG.geomNav w2 start dirs

[<Fact>]
let ``negative control: a label-peeking nav gives DIFFERENT trajectories in two worlds`` () =
    // Without this, the property above would be a check nobody had shown could fail. A nav that
    // reads the label produces divergent trajectories across a labelled and an empty world; the
    // fixed geometry does not. Both directions exercised, which is what makes the pair discriminate.
    let peekingNav: AG.Nav =
        fun w p d ->
            match AG.labelAt p w with
            | Some _ -> None
            | None -> AG.move p d
    let labeled: AG.World = Map.ofList [ { AG.Row = 1; AG.Col = 1 }, DynamicValue.Int 1L ]
    let empty: AG.World = Map.empty
    let start = { AG.Row = 0; AG.Col = 1 }
    let dirs = [ AG.Down; AG.Down ]
    Assert.Equal<AG.Position list>(
        trajectoryUnder AG.geomNav labeled start dirs,
        trajectoryUnder AG.geomNav empty start dirs
    )
    Assert.NotEqual<AG.Position list>(
        trajectoryUnder peekingNav labeled start dirs,
        trajectoryUnder peekingNav empty start dirs
    )

[<Property(Arbitrary = [| typeof<GridArb> |])>]
let ``relabeling the world never changes any navigation step`` (w: AG.World) (p: AG.Position) (d: AG.Direction) =
    // apply an arbitrary relabel (overwrite every cell with a constant) — geometry is unaffected.
    let relabeled = w |> Map.map (fun _ _ -> DynamicValue.String "X")
    AG.geomNav w p d = AG.geomNav relabeled p d

// ── the fixed-geometry laws (navigation has real content, all label-independent) ──

[<Property(Arbitrary = [| typeof<GridArb> |])>]
let ``move is deterministic`` (p: AG.Position) (d: AG.Direction) =
    AG.move p d = AG.move p d

[<Property(Arbitrary = [| typeof<GridArb> |])>]
let ``move stays on the grid or returns None (edge-closed topology)`` (p: AG.Position) (d: AG.Direction) =
    match AG.move p d with
    | Some p' -> AG.inGrid p'
    | None -> true

[<Property(Arbitrary = [| typeof<GridArb> |])>]
let ``interior invertibility: a move can be undone by its opposite`` (p: AG.Position) (d: AG.Direction) =
    // the fixed topology is a symmetric graph: if you can step d, stepping back returns you home.
    match AG.move p d with
    | Some p' -> AG.move p' (AG.opposite d) = Some p
    | None -> true

[<Property(Arbitrary = [| typeof<GridArb> |])>]
let ``color is a fixed function of position, into [0,4)`` (p: AG.Position) =
    // CLAIM LOWERED 2026-08-23 (Soraya), workitem 081M0RAX8AC087G0R003NQM7P9. The name used to end
    // "(label-independent)" while the body compared `AG.color p` to itself. Label-independence is
    // 2-safety and this pair holds the label fixed, so the name claimed strictly more than the check
    // could witness. `AG.color : Position -> int` takes no `World` at all, so there is no in-process
    // pair that could vary the label here — the honest move is to stop claiming it on this test, not
    // to manufacture a pair. The world-varying claims that CAN be checked are the KEYSTONE property
    // and the trajectory property above, and both now vary the world across the pair.
    let c1 = AG.color p
    let c2 = AG.color p
    c1 = c2 && c1 >= 0 && c1 < 4

[<Fact>]
let ``frame and content are separate: same geometry, different labels`` () =
    let p = { AG.Row = 1; AG.Col = 1 }
    let game1 : AG.World = Map.ofList [ p, DynamicValue.String "Jump" ]
    let game2 : AG.World = Map.ofList [ p, DynamicValue.String "Shoot" ]
    // labels differ (content) ...
    Assert.NotEqual<DynamicValue option>(AG.labelAt p game1, AG.labelAt p game2)
    // ... but navigation and color are identical (frame) — the Xbox-controller invariant.
    // REWRITTEN 2026-08-23 (Soraya), workitem 081M0RAX8AC087G0R003NQM7P9. The navigation line used to
    // read `Assert.Equal(AG.move p AG.Up, AG.move p AG.Up)` — one expression compared to itself,
    // inside a test whose name promises "different labels". The two worlds it builds were never fed
    // to the navigation. `AG.move` takes no world, so the pair is stated at `AG.geomNav`, which does.
    Assert.Equal<AG.Position option>(AG.geomNav game1 p AG.Up, AG.geomNav game2 p AG.Up)
    Assert.True(AG.labelIndependentOver game1 game2 AG.geomNav)
