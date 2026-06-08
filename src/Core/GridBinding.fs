namespace Zeta.Core

/// **`GridBinding` — the homoiconic 4×4 controller: constant cells, context-dependent labels (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"our meta-action grammar and our action grammar are **homoiconic** — just like the Xbox dashboard vs
/// games, they both use the **same controller layout (4×4 grid)** where the **cells have constant meaning but the
/// labels change**."*
///
/// One physical controller, two grammars. The **4×4 grid** (`ActionGrammar` geometry) is the *invariant
/// structure*; what each of the 16 cells *means* is a **context-dependent label**:
///   - **game** (object level): cell → a CHIP-8 key (`GridBinding<int>` of key indices);
///   - **dashboard / meta** (observe.ts): cell → a `MetaController.MetaAction` (a traversal or a map move).
/// Same `GridBinding<'label>` type both ways. **Where the homoiconicity lives (Aaron):** it is the **index into
/// the 4×4 grid and its *transforms*** — the `ActionGrammar` grid algebra (`ofGrid`/`toGrid` geometry, the lattice
/// `join`/`meet`, neighbour/directional moves, the superposition) — that is *identical* in game space and meta/
/// dashboard space. The same index transforms the same way regardless of what's labelled: "up is up", a cell's
/// neighbours are its neighbours, whether the label is a game key or a meta-action. **Consistent like an Xbox
/// controller** (the layout and how you move through it never change; only the labels do). The deeper sameness is
/// that the index+transforms are shared — homoiconic at the *grammar* level, not just a shared type.
/// **observe.ts populates the dashboard labels** by binding the **top-k salient** items (`Salience.display`) onto
/// the cells — so the agent always faces the *same 16-slot controller*, re-labelled per context with what matters
/// now (`bindSalient`).
///
/// **Honest scope (peel):** a fixed 16-cell grid (the CHIP-8 keypad shape); larger action sets must page/scroll
/// or re-route via salience (top-16). `bind` returns a new grid (immutable copy). Geometry is row-major via
/// `ActionGrammar.ofGrid`/`toGrid`. Deterministic (DST).
[<RequireQualifiedAccess>]
module GridBinding =

    /// The grid is the 4×4 = 16-cell CHIP-8 keypad layout (the invariant structure).
    [<Literal>]
    let Size = 16

    /// A binding of the 16 grid cells to labels of type `'label` (None = unbound). Cell index = the
    /// `ActionGrammar` key index (row-major). Homoiconic: `'label` = key (game) or meta-action (dashboard).
    type GridBinding<'label> = { Cells: 'label option[] }

    /// The empty binding (no cell labelled).
    let empty<'label> : GridBinding<'label> = { Cells = Array.create Size None }

    /// Bind one cell to a label (returns a new grid). Out-of-range cell is ignored.
    let bind (cell: int) (label: 'label) (g: GridBinding<'label>) : GridBinding<'label> =
        if cell < 0 || cell >= Size then g
        else
            let c = Array.copy g.Cells
            c.[cell] <- Some label
            { Cells = c }

    /// The label at a cell (None if unbound / out of range).
    let labelAt (cell: int) (g: GridBinding<'label>) : 'label option =
        if cell < 0 || cell >= Size then None else g.Cells.[cell]

    /// The label at grid coord (row, col) — the 4×4 view.
    let atGrid (row: int) (col: int) (g: GridBinding<'label>) : 'label option =
        labelAt (ActionGrammar.ofGrid row col) g

    /// Bind labels onto cells 0..15 in order (truncated to 16). The general "set the controller's labels".
    let ofLabels (labels: 'label list) : GridBinding<'label> =
        let c = Array.create Size None
        labels |> List.truncate Size |> List.iteri (fun i l -> c.[i] <- Some l)
        { Cells = c }

    /// The bound cells as (cell, label) pairs.
    let bound (g: GridBinding<'label>) : (int * 'label) list =
        [ for i in 0 .. Size - 1 do
              match g.Cells.[i] with
              | Some l -> yield i, l
              | None -> () ]

    /// How many cells are labelled.
    let count (g: GridBinding<'label>) : int = g.Cells |> Array.sumBy (fun c -> if Option.isSome c then 1 else 0)

    /// **observe.ts populates the dashboard:** bind the top-k salient items (`Salience.display` under the agent's
    /// `priority`) onto the grid cells — the same 16-slot controller, re-labelled with what matters now.
    let bindSalient (k: int) (priority: Map<string, float>) (items: Salience.Item<'label> list) : GridBinding<'label> =
        ofLabels (Salience.display (min k Size) priority items)
