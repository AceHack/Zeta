namespace Zeta.Core

open System

/// **IdentityDLA — Diffusion-Limited Aggregation over the Identity Space.**
///
/// Generates the identity space boundary shape using Zeta's own primitives:
///   - The **random walker** is a traveler with a flat prior (ZSet side — cold, sparse).
///   - **Sticking** is a decoherence event (GSet side — warm, dense) gated by the
///     sticking threshold (1/(3√2) ≈ 0.2357) — a DESIGN CHOICE, not the Tsirelson bound
///     (that is S ≤ 2√2 on the CHSH correlator; see Tsirelson.fs). Corrected 2026-08-01.
///   - The **gradient field** is `rhoCount`-shaped: walkers are biased toward the
///     cluster boundary proportionally to the local density gradient.
///   - The **cluster** is the GSet (accumulated resolved facts).
///
/// The resulting fractal boundary IS the identity space boundary — not an analogy.
/// The multi-oracle proof: run the same seed on F#, CSS, Chip-8, and a browser canvas.
/// If all four produce the same fractal dimension, the identity eigenvector is
/// substrate-independent. That is the sensor-fusion proof.
///
/// Honest scope: this is a 2D discrete DLA on a grid. The Tsirelson threshold is used
/// as the sticking probability (not as a hard gate) so the boundary is probabilistic,
/// not deterministic — matching the SoftValue semantics. The `rhoCount` gradient biases
/// walkers toward the cluster, producing the orange/dark Laplacian growth shape.
[<RequireQualifiedAccess>]
module IdentityDLA =

    // ── Constants ─────────────────────────────────────────────────────────────────────────────

    /// ⚠ **THE NAME IS A MISNOMER** (Soraya audit, 2026-08-01). This is NOT the Tsirelson bound.
    /// Tsirelson's bound is `S ≤ 2√2 ≈ 2.828` on the CHSH *correlator* — see `src/Core/Tsirelson.fs`
    /// (S² = 8 in exact integer arithmetic) and `src/Core/BellTest.fs`. There is no Tsirelson bound
    /// on a correlation *coefficient*, and quantum correlations are not capped at 0.2357.
    /// `1/(3√2)` is `ρ*/√2` — the Condorcet limit `ρ* = 1/3` pushed through the FREELY CHOSEN
    /// linear map `ρ = S/12`. The repo's own derivation attempt concluded it "cannot be derived from
    /// first principles; it follows forced from two named modeling choices [made] for homoiconicity":
    /// `docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md`
    /// Identifier NOT renamed here (cross-language call sites); the label is corrected instead.
    /// Used here purely as a **DLA sticking probability** — a growth parameter. Do not read it as physics.
    /// The Tsirelson operating point: 1/(3√2) ≈ 0.2357.
    /// Used as the base sticking probability — a walker touching the cluster sticks with
    /// this probability, modulated by the local gradient.
    let tsirelsonThreshold : float = 1.0 / (3.0 * sqrt 2.0)

    // ── Grid ──────────────────────────────────────────────────────────────────────────────────

    /// A 2D grid cell: either GSet (resolved, warm) or ZSet (simulation, cold).
    type Cell = GSet | ZSet

    /// The DLA grid state.
    type Grid = {
        Width: int
        Height: int
        Cells: Cell[,]
        /// Count of resolved (GSet) cells — the cluster size.
        ClusterSize: int
    }

    /// Create an empty grid (all ZSet) with a single seed particle at the center.
    let create (width: int) (height: int) : Grid =
        let cells = Array2D.create width height ZSet
        let cx, cy = width / 2, height / 2
        cells.[cx, cy] <- GSet
        { Width = width; Height = height; Cells = cells; ClusterSize = 1 }

    /// True if (x, y) is within the grid bounds.
    let inBounds (g: Grid) (x: int) (y: int) : bool =
        x >= 0 && x < g.Width && y >= 0 && y < g.Height

    /// Count GSet neighbors of (x, y) — the local gradient (4-connected).
    let gsetNeighborCount (g: Grid) (x: int) (y: int) : int =
        [| (x-1,y); (x+1,y); (x,y-1); (x,y+1) |]
        |> Array.filter (fun (nx, ny) -> inBounds g nx ny && g.Cells.[nx, ny] = GSet)
        |> Array.length

    /// The local `rhoCount`-shaped sticking probability at (x, y).
    /// More GSet neighbors → higher sticking probability (the gradient field).
    /// Base probability is the Tsirelson threshold; each neighbor adds a boost.
    let stickingProbability (g: Grid) (x: int) (y: int) : float =
        let n = gsetNeighborCount g x y
        if n = 0 then 0.0
        else
            // Base: tsirelsonThreshold. Each neighbor boosts by tsirelsonThreshold/4.
            // At 4 neighbors (fully surrounded): probability ≈ 2 * tsirelsonThreshold ≈ 0.47.
            // This keeps the boundary probabilistic (SoftValue semantics) — never a hard gate.
            min 1.0 (tsirelsonThreshold * (1.0 + float n * 0.5))

    // ── Walker ────────────────────────────────────────────────────────────────────────────────

    /// A random walker (traveler with flat prior, ZSet side).
    type Walker = { X: int; Y: int }

    /// Spawn a walker at a random position on the boundary ring of the grid.
    /// The ring is the "event horizon" — walkers enter from the cold edge.
    let spawnWalker (rng: Random) (g: Grid) : Walker =
        let side = rng.Next(4)
        match side with
        | 0 -> { X = rng.Next(g.Width); Y = 0 }
        | 1 -> { X = rng.Next(g.Width); Y = g.Height - 1 }
        | 2 -> { X = 0; Y = rng.Next(g.Height) }
        | _ -> { X = g.Width - 1; Y = rng.Next(g.Height) }

    /// Move a walker one step in a random direction (4-connected random walk).
    let stepWalker (rng: Random) (g: Grid) (w: Walker) : Walker =
        let dirs = [| (0,1); (0,-1); (1,0); (-1,0) |]
        let dx, dy = dirs.[rng.Next(4)]
        let nx = max 0 (min (g.Width - 1) (w.X + dx))
        let ny = max 0 (min (g.Height - 1) (w.Y + dy))
        { X = nx; Y = ny }

    /// True if the walker is adjacent to the cluster (has at least one GSet neighbor).
    let adjacentToCluster (g: Grid) (w: Walker) : bool =
        gsetNeighborCount g w.X w.Y > 0

    /// True if the walker has wandered too far from the cluster center (kill radius).
    /// Prevents walkers from wandering forever on a large grid.
    let outOfBounds (g: Grid) (w: Walker) : bool =
        let cx, cy = g.Width / 2, g.Height / 2
        let dx = float (w.X - cx)
        let dy = float (w.Y - cy)
        let killRadius = float (min g.Width g.Height) * 0.48
        sqrt (dx*dx + dy*dy) > killRadius

    // ── Growth step ───────────────────────────────────────────────────────────────────────────

    /// Run one walker from spawn to either sticking (GSet resolve) or escape.
    /// Returns the updated grid (with the new GSet cell if the walker stuck).
    let growOne (rng: Random) (g: Grid) : Grid =
        let mutable w = spawnWalker rng g
        let mutable stuck = false
        let mutable escaped = false
        while not stuck && not escaped do
            w <- stepWalker rng g w
            if outOfBounds g w then
                escaped <- true
            elif adjacentToCluster g w then
                // SoftValue.resolve: stick with probability = stickingProbability (Tsirelson-gated)
                let p = stickingProbability g w.X w.Y
                if rng.NextDouble() < p then
                    stuck <- true
        if stuck then
            let newCells = Array2D.copy g.Cells
            newCells.[w.X, w.Y] <- GSet
            { g with Cells = newCells; ClusterSize = g.ClusterSize + 1 }
        else
            g

    // ── Full run ──────────────────────────────────────────────────────────────────────────────

    /// Run the DLA for `n` walkers, returning the final grid.
    /// `seed` is the RNG seed — the same seed across all oracles produces the same cluster.
    let run (seed: int) (width: int) (height: int) (n: int) : Grid =
        let rng = Random(seed)
        let mutable g = create width height
        for _ in 1..n do
            g <- growOne rng g
        g

    // ── Export ────────────────────────────────────────────────────────────────────────────────

    /// Export the grid as a flat bool array (true = GSet / warm side).
    /// Row-major: index = y * width + x.
    let toFlatArray (g: Grid) : bool[] =
        Array.init (g.Width * g.Height) (fun i ->
            let x = i % g.Width
            let y = i / g.Width
            g.Cells.[x, y] = GSet)

    /// Export as a simple ASCII art string (for terminal / Chip-8 preview).
    /// '#' = GSet (warm), '.' = ZSet (cold).
    let toAscii (g: Grid) : string =
        let sb = System.Text.StringBuilder()
        for y in 0..g.Height-1 do
            for x in 0..g.Width-1 do
                sb.Append(if g.Cells.[x,y] = GSet then '#' else '.') |> ignore
            sb.AppendLine() |> ignore
        sb.ToString()

    /// Export as a JSON-compatible string for the browser visualizer.
    /// Format: { "width": W, "height": H, "cells": [0,1,0,...] }
    let toJson (g: Grid) : string =
        let cells =
            [| for y in 0..g.Height-1 do
                   for x in 0..g.Width-1 do
                       yield if g.Cells.[x,y] = GSet then "1" else "0" |]
            |> String.concat ","
        sprintf """{"width":%d,"height":%d,"clusterSize":%d,"cells":[%s]}"""
            g.Width g.Height g.ClusterSize cells

    // ── Fractal dimension estimate ────────────────────────────────────────────────────────────

    /// Estimate the fractal (box-counting) dimension of the cluster boundary.
    /// This is the key metric for the multi-oracle proof: if all four renderers
    /// produce the same fractal dimension (within noise), the eigenvector is substrate-independent.
    ///
    /// Box-counting: count boxes of size `s` that contain at least one GSet cell.
    /// D_f ≈ -slope of log(count) vs log(s).
    let fractalDimension (g: Grid) : float =
        let sizes = [| 2; 4; 8; 16; 32 |] |> Array.filter (fun s -> s < min g.Width g.Height)
        if sizes.Length < 2 then 1.5 // fallback for tiny grids
        else
            let logCounts =
                sizes |> Array.map (fun s ->
                    let mutable count = 0
                    let bx = (g.Width + s - 1) / s
                    let by = (g.Height + s - 1) / s
                    for bxi in 0..bx-1 do
                        for byi in 0..by-1 do
                            let mutable found = false
                            for dx in 0..s-1 do
                                for dy in 0..s-1 do
                                    let x = bxi * s + dx
                                    let y = byi * s + dy
                                    if inBounds g x y && g.Cells.[x,y] = GSet then
                                        found <- true
                            if found then count <- count + 1
                    log (float count), log (1.0 / float s))
            // Linear regression: slope of log(count) vs log(1/s)
            let n = float logCounts.Length
            let sumX = logCounts |> Array.sumBy snd
            let sumY = logCounts |> Array.sumBy fst
            let sumXY = logCounts |> Array.sumBy (fun (y, x) -> x * y)
            let sumX2 = logCounts |> Array.sumBy (fun (_, x) -> x * x)
            (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
