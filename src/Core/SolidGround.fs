namespace Zeta.Core

/// **`SolidGround` — the navigable landmarks in memory: constants + monotonic cells (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"without a map and navigation of recurrence, everything looks like random noise in memory other than
/// the **monotonically increasing digits** — we should keep track of those, they're like **solid ground**… also
/// some memory **never changes ever** — these are solid **constants**, another type of solid ground… solid ground
/// is often used as **input to lens parameters**."*
///
/// Where `MemoryLens` asks "is it controllable?" and drops the rest as nuisance, `SolidGround` rescues the
/// *reliable* part of that "rest": a cell whose value series is **constant** (never changes) or **monotonic** (a
/// counter/clock/odometer — always up, or always down) is **solid ground** — a dependable landmark you can
/// navigate by even when everything else is noise. The remainder (non-monotonic drift) is **erratic** (RNG-like
/// noise). Solid ground is the **coordinate frame**: constants are fixed reference points; monotonic cells are the
/// clock/odometer that tells you *where you are in the trajectory*. Both feed **lens parameters** (a constant base
/// address configures a lens; a monotonic frame-counter indexes/phases it).
///
/// **Honest scope (peel):** classification is over the *sampled* series (a cell monotonic in the window may not be
/// globally; a constant may change off-sample). Monotonic = pairwise diffs all ≥0 or all ≤0 (and ≥1 change);
/// "noise vs monotonic" is the navigable/non-navigable cut, not a proof of RNG. Deterministic (DST). Complements
/// `MemoryLens` (controllable) and `MemorySense` (ranges/seasons/anomaly) — this is the *stable* substrate they
/// build on. Anchors: dead-reckoning / odometry (navigate by a monotonic count); fixed landmarks; loop invariants.
[<RequireQualifiedAccess>]
module SolidGround =

    /// What kind of solid ground (if any) a cell's value series is.
    type Ground =
        | Constant of int // never changes — a fixed reference point
        | Monotonic of int // always moves one way: +1 = up (counter), -1 = down (countdown clock)
        | Erratic // non-monotonic drift — noise, not navigable

    /// Classify a cell's value series.
    let classifySeries (vals: int list) : Ground =
        match vals with
        | [] -> Constant 0
        | [ v ] -> Constant v
        | first :: _ ->
            let diffs = vals |> List.pairwise |> List.map (fun (a, b) -> b - a)
            if diffs |> List.forall ((=) 0) then Constant first
            elif diffs |> List.forall (fun d -> d >= 0) then Monotonic 1
            elif diffs |> List.forall (fun d -> d <= 0) then Monotonic -1
            else Erratic

    /// Is this ground solid (navigable) — a constant or a monotonic landmark?
    let isSolid (g: Ground) : bool =
        match g with
        | Constant _
        | Monotonic _ -> true
        | Erratic -> false

    /// Classify every cell of a series map (e.g. from `MemorySense.series`).
    let classify (s: Map<string, int list>) : Map<string, Ground> = s |> Map.map (fun _ vals -> classifySeries vals)

    /// The solid-ground cells (constants + monotonic) — the navigable landmarks / lens-parameter inputs.
    let solidCells (s: Map<string, int list>) : (string * Ground) list =
        classify s |> Map.toList |> List.filter (fun (_, g) -> isSolid g)

    /// Just the constant cells (fixed reference points).
    let constants (s: Map<string, int list>) : (string * int) list =
        solidCells s
        |> List.choose (fun (n, g) ->
            match g with
            | Constant v -> Some(n, v)
            | _ -> None)

    /// Just the monotonic cells with direction (+1 up / -1 down) — the clocks/odometers to navigate by.
    let monotonic (s: Map<string, int list>) : (string * int) list =
        solidCells s
        |> List.choose (fun (n, g) ->
            match g with
            | Monotonic dir -> Some(n, dir)
            | _ -> None)

    /// The amount of solid ground: count of navigable (constant/monotonic) cells.
    let solidCount (s: Map<string, int list>) : int = solidCells s |> List.length

    /// The solid-ground fraction (navigable cells / all cells) — how much of memory is dependable.
    let solidFraction (s: Map<string, int list>) : float =
        if Map.isEmpty s then 0.0 else float (solidCount s) / float (Map.count s)

    /// **Solid-ground GAIN of a transform/lens** (Aaron 2026-06-08): solid cells *after* minus *before*. Positive
    /// = the lens turned noise into navigable landmarks. **This is how you judge a lens** other than the stay-alive
    /// one — by how much new solid ground it produces (a compression / predictability gain; the bootstrap where
    /// lenses + solid ground produce more solid ground). The `LensRouter` gate signal for non-survival lenses.
    let gain (before: Map<string, int list>) (after: Map<string, int list>) : int =
        solidCount after - solidCount before
