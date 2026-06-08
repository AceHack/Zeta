namespace Zeta.Core

/// **`MemorySense` — senses for what the lens misses: ranges, seasons, Itron coincidence, anomalies (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"the lens can hide what kills you — we need senses for the things the lens misses, like triggers based
/// on alert thresholds on metrics, like in DevOps… find patterns in memory that have seasons or expected ranges…
/// then anomaly detection… once you find stable things… you are looking for coincidence patterns — Itron's
/// coincidence detection, where X and Y happen to occur on regular intervals."*
///
/// Where `MemoryLens` keeps only *controllable* cells, `MemorySense` watches **all** cells (covering the
/// autonomous-yet-lethal ones the control-lens drops — the doom timer). It is DevOps observability for memory:
///   - **expected ranges** (`ranges`) — the `[min,max]` a cell stayed within while stable (the baseline);
///   - **seasons** (`period`) — a cell whose value series repeats with a period is *seasonal*; one that never
///     repeats is *trending* (a counter);
///   - **coincidence (Itron)** (`coincidences`) — pairs of cells whose *change events* co-occur (high overlap of
///     the frames on which they change) — "X and Y on regular intervals"; the relational pattern the per-cell
///     senses miss;
///   - **anomaly detection** (`anomalies`) — a cell now outside its learned range = an alert (the trigger that
///     catches what the lens hid).
///
/// **Anchors (Beacon):** Itron coincidence detection (the maintainer's prior art — co-occurrence on intervals;
/// cf. `CoincidenceClock`); DevOps observability (baseline → threshold alerts → anomaly detection); time-series
/// seasonality/range baselining (Jaccard overlap of change-event sets for coincidence).
///
/// **Honest scope (peel):** baselines are *learned from the sampled trajectory* — an anomaly is "outside what we
/// saw", not provably-bad (a never-before-seen *safe* value also flags; precision improves with more sampling).
/// Coincidence here is *same-frame* co-change overlap (Jaccard); *lagged* coincidence (X then Y, k frames later)
/// is the next slice. Registers + I + timers + PC (not Mem cells). Deterministic (DST).
[<RequireQualifiedAccess>]
module MemorySense =

    let private cellsOf (f: Chip8Cow.Frame) : (string * int) list =
        [ "PC", int f.PC; "I", int f.I; "Delay", int f.Delay; "Sound", int f.Sound ]
        @ [ for i in 0..15 -> sprintf "V%X" i, int f.V.[i] ]

    /// Each named cell's value series over `n` frames under a held input (index 0 = start).
    let series (cyclesPerFrame: int) (keys: bool[]) (n: int) (f0: Chip8Cow.Frame) : Map<string, int list> =
        let frames =
            [ let mutable cur = f0
              yield f0
              for _ in 1 .. max 0 n do
                  cur <- Chip8Cow.frameStep cyclesPerFrame { cur with Keys = keys }
                  yield cur ]
        let valsAt f = cellsOf f |> Map.ofList
        cellsOf f0
        |> List.map (fun (nm, _) -> nm, frames |> List.map (fun f -> (valsAt f).[nm]))
        |> Map.ofList

    /// The expected `[min,max]` range per cell (the baseline).
    let ranges (s: Map<string, int list>) : Map<string, int * int> =
        s |> Map.map (fun _ vals -> List.min vals, List.max vals)

    /// **Season:** the smallest period at which a value series repeats, or `None` if it never does (trending). A
    /// cell with a period is seasonal/stable; `None` = a counter/clock that drifts.
    let period (vals: int list) : int option =
        let seen = System.Collections.Generic.Dictionary<int, int>()
        let mutable result = None
        let mutable i = 0
        for v in vals do
            if Option.isNone result then
                match seen.TryGetValue v with
                | true, j -> result <- Some(i - j)
                | _ -> seen.[v] <- i
            i <- i + 1
        result

    /// The frame indices at which each cell *changed* (its change-event set).
    let changeFrames (s: Map<string, int list>) : Map<string, Set<int>> =
        s
        |> Map.map (fun _ vals ->
            vals
            |> List.pairwise
            |> List.mapi (fun i (a, b) -> i + 1, a <> b)
            |> List.choose (fun (idx, changed) -> if changed then Some idx else None)
            |> Set.ofList)

    /// **Itron coincidence:** cell pairs whose change-events co-occur, ranked by Jaccard overlap of their
    /// change-frame sets (1.0 = always change together). Only pairs that actually change and overlap ≥ `minJaccard`.
    let coincidences (minJaccard: float) (s: Map<string, int list>) : ((string * string) * float) list =
        let cf = changeFrames s
        let active = cf |> Map.toList |> List.filter (fun (_, fs) -> not (Set.isEmpty fs))
        [ for i in 0 .. active.Length - 1 do
              for j in i + 1 .. active.Length - 1 do
                  let nx, sx = active.[i]
                  let ny, sy = active.[j]
                  let inter = Set.intersect sx sy |> Set.count |> float
                  let uni = Set.union sx sy |> Set.count |> float
                  let jac = if uni = 0.0 then 0.0 else inter / uni
                  if jac >= minJaccard then (nx, ny), jac ]
        |> List.sortByDescending snd

    /// **Anomaly detection:** cells whose value in `f` falls outside the learned `range` (the alert trigger that
    /// catches what the control-lens dropped).
    let anomalies (baseline: Map<string, int * int>) (f: Chip8Cow.Frame) : string list =
        cellsOf f
        |> List.choose (fun (nm, v) ->
            match Map.tryFind nm baseline with
            | Some(lo, hi) when v < lo || v > hi -> Some nm
            | _ -> None)
