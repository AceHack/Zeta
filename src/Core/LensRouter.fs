namespace Zeta.Core

/// **`LensRouter` — multi-lens selection (Mixture-of-Experts over lenses) (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"we could also do multi-lens selection — my multiple lenses feel like background threads in my head,
/// but I can only have so many in context at one time, like MoE."* Many candidate **lenses** (each a reduction of
/// memory to a subset of cells — `MemoryLens` view, a `MemorySense` baseline, a hand-named slice) sit in the
/// background; a **gate** scores each lens's relevance for the current state from a per-cell **signal**
/// (controllability, change-rate, anomaly pressure…); **top-k** are made active (the bounded working set / context
/// budget — sparse gating, Shazeer et al. MoE). The active lenses compose into one working world-state key (the
/// union of their cells). Only k experts attend at once; the rest stay background threads until the gate promotes
/// them.
///
/// **Honest scope (peel):** the gate is a relevance *heuristic* over a caller-supplied signal — it does not learn
/// the gating (no trained router; that's the next slice). Top-k is a hard cutoff (no soft mixture weights yet).
/// `composeKey` unions cells (a datum in two active lenses appears once). Deterministic (DST). The signal is where
/// the intelligence lives — feed it `MemoryLens` controllability and/or `MemorySense` change-rate/anomaly.
[<RequireQualifiedAccess>]
module LensRouter =

    /// A lens = a named reduction of memory to the cells it attends to.
    type Lens = { Name: string; Cells: string list }

    let private cellsOf (f: Chip8Cow.Frame) : Map<string, int> =
        ([ "PC", int f.PC; "I", int f.I; "Delay", int f.Delay; "Sound", int f.Sound ]
         @ [ for i in 0..15 -> sprintf "V%X" i, int f.V.[i] ])
        |> Map.ofList

    /// **The gate:** a lens's relevance = the mean of the per-cell `signal` over the cells it attends to (a cell
    /// absent from `signal` scores 0). Higher = more worth attending to now.
    let gate (signal: Map<string, float>) (lens: Lens) : float =
        match lens.Cells with
        | [] -> 0.0
        | cells ->
            (cells |> List.sumBy (fun c -> Map.tryFind c signal |> Option.defaultValue 0.0))
            / float (List.length cells)

    /// **Select the top-`k` lenses** by the gate (the bounded active working set — MoE sparse gating). Ties broken
    /// by name for determinism.
    let select (k: int) (signal: Map<string, float>) (lenses: Lens list) : Lens list =
        lenses
        |> List.sortByDescending (fun l -> gate signal l, l.Name)
        |> List.truncate (max 0 k)

    /// The union of cells attended to by the active lenses (the working world-state's footprint).
    let activeCells (active: Lens list) : string list =
        active |> List.collect (fun l -> l.Cells) |> List.distinct |> List.sort

    /// **Compose the active lenses into one working world-state key** — the values of the union of their cells
    /// (sorted, comparable). The bounded reduced state the controller/predictor sees this tick.
    let composeKey (active: Lens list) (f: Chip8Cow.Frame) : (string * int) list =
        let vals = cellsOf f
        activeCells active
        |> List.choose (fun c -> Map.tryFind c vals |> Option.map (fun v -> c, v))

    /// One-shot: select top-`k` lenses for `f` under `signal`, then compose their working key.
    let route (k: int) (signal: Map<string, float>) (lenses: Lens list) (f: Chip8Cow.Frame) : (string * int) list =
        composeKey (select k signal lenses) f
