namespace Zeta.Core

/// **ActionGrid — the 4×4 universal action grammar (Layer-2 of the traveler frame).**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-frame, Layer 2; Aaron's Xbox-controller grid.)
///
/// The action grammar is **orthogonal** to the traveler frame: the frame answers *where/when things
/// are*; the action grammar answers *what you can do*. Aaron's structure: a 4×4 grid whose
/// **directionality / color / navigation stays fixed** while the **labels** (what each cell *means*)
/// change with world state — the same way an Xbox controller's button layout is fixed but what each
/// button does is per-game.
///
/// **FRAME** = the fixed geometry: `move` (navigation, pure on position) + `color` (a fixed per-cell
/// attribute). **CONTENT** = `World` = `Map<Position, DynamicValue>`, the world-state-dependent labels,
/// riding the proven DynamicValue carrier.
///
/// **The keystone this module proves** (the one open obligation for Layer 2, per the register):
/// *navigation is a pure function of position, NEVER of the labels.* "Directionality stays the same
/// while labels change" is true **iff** how-you-move depends only on grid coordinates and never peeks
/// at a label. We make this a real, discriminating predicate over the *space of possible navigations*
/// (`Nav = World -> Position -> Direction -> Position option`) — `labelIndependent` — and prove the
/// fixed geometry satisfies it (with a negative control: a label-peeking nav is correctly rejected).
/// This is the property that keeps frame and content cleanly separated — the cure for the "cram".
///
/// Anchors: fixed-topology graph (positions = nodes, `move` = edges, both invariant); the
/// frame-vs-content / coordinate-vs-occupant split; register-file / addressable-memory (fixed
/// addresses, mutable cells). Builds on the proven DynamicValue carrier for the label content.
[<RequireQualifiedAccess>]
module ActionGrid =

    /// The grid edge length. 4×4 = 16 cells (the action grammar; cube/tesseract mapping is §B).
    let size = 4

    /// A grid coordinate. Records give structural equality+comparison, so it is a valid `Map` key.
    type Position = { Row: int; Col: int }

    /// The four navigation directions (the d-pad — fixed directionality).
    type Direction =
        | Up
        | Down
        | Left
        | Right

    /// Is a coordinate on the grid?
    let inGrid (p: Position) : bool =
        p.Row >= 0 && p.Row < size && p.Col >= 0 && p.Col < size

    let opposite (d: Direction) : Direction =
        match d with
        | Up -> Down
        | Down -> Up
        | Left -> Right
        | Right -> Left

    /// **The fixed navigation** — a pure function of position + direction. Labels are NOT in scope, so
    /// movement *cannot* depend on world state by construction; the proofs below confirm it operationally.
    /// Returns `None` at a wall (the fixed topology is closed at the edges).
    let move (p: Position) (d: Direction) : Position option =
        let p' =
            match d with
            | Up -> { p with Row = p.Row - 1 }
            | Down -> { p with Row = p.Row + 1 }
            | Left -> { p with Col = p.Col - 1 }
            | Right -> { p with Col = p.Col + 1 }
        if inGrid p' then Some p' else None

    /// **The fixed color** — a per-cell attribute determined by position alone (a 4-colour wheel here;
    /// the specific colouring is not load-bearing, its *label-independence* is). Invariant under any
    /// relabeling, by construction.
    let color (p: Position) : int = ((p.Row * size) + p.Col) % 4

    /// Navigate a path of directions from a start, returning the trajectory of positions visited.
    /// Stops at a wall (a `None` move ends the path). Pure in (start, dirs) — no world in scope.
    let rec navigate (start: Position) (dirs: Direction list) : Position list =
        match dirs with
        | [] -> [ start ]
        | d :: rest ->
            match move start d with
            | Some next -> start :: navigate next rest
            | None -> [ start ]

    // ── CONTENT: the world-state-dependent labels (the ONLY place world state enters) ──

    /// The world state: a labeling of cells. The mutable content layer, on the proven DynamicValue carrier.
    type World = Map<Position, DynamicValue>

    /// Read the label at a position under a world state. This is the sole coupling of content to grid —
    /// kept entirely separate from `move`/`navigate` (which never receive a `World`).
    let labelAt (p: Position) (w: World) : DynamicValue option = Map.tryFind p w

    // ── the keystone predicate: a navigation is label-independent iff it ignores world state ──

    /// The *general* shape of a navigation that **could** peek at world state. The fixed geometry is the
    /// member of this space that ignores its `World` argument; a label-dependent design is one that does not.
    type Nav = World -> Position -> Direction -> Position option

    /// The fixed geometry as a `Nav`: it discards the world. (The thing we prove label-independent.)
    let geomNav : Nav = fun _w p d -> move p d

    /// **The keystone property** as a discriminating predicate, checked over a finite cell/direction
    /// space for a given pair of worlds: a `Nav` is label-independent across `w1`/`w2` iff it returns the
    /// same result at every cell and direction regardless of which world it is given. Quantifying over
    /// all `w1`/`w2` (the proofs do, via FsCheck) gives the full property.
    let labelIndependentOver (w1: World) (w2: World) (nav: Nav) : bool =
        let cells = [ for r in 0 .. size - 1 do for c in 0 .. size - 1 -> { Row = r; Col = c } ]
        let dirs = [ Up; Down; Left; Right ]
        cells |> List.forall (fun p -> dirs |> List.forall (fun d -> nav w1 p d = nav w2 p d))
