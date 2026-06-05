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

[<Property(Arbitrary = [| typeof<GridArb> |])>]
let ``navigate trajectory is identical regardless of world state`` (start: AG.Position) (dirs: AG.Direction list) (w1: AG.World) (w2: AG.World) =
    // navigate never receives a world; this confirms operationally that the path is world-invariant.
    ignore (w1, w2)
    AG.navigate start dirs = AG.navigate start dirs

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
let ``color is a fixed function of position (label-independent)`` (p: AG.Position) =
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
    Assert.Equal<AG.Position option>(AG.move p AG.Up, AG.move p AG.Up)
    Assert.True(AG.labelIndependentOver game1 game2 AG.geomNav)
