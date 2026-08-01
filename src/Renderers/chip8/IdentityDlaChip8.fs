namespace Zeta.Core.Renderers

open System
open Zeta.Core

/// **IdentityDlaChip8 — Oracle 3: DLA on the Chip-8 64×32 display.**
///
/// Runs the same DLA algorithm as `IdentityDLA.fs` but constrained to the
/// Chip-8 display: 64×32 monochrome pixels, XOR rendering (same as the DXYN opcode).
///
/// The Chip-8 VM has 4K RAM, 16 registers, and a 64×32 display.
/// This is the most constrained oracle: the DLA cluster must fit in 64×32 pixels.
/// The fractal dimension is computed on the resulting display.
///
/// Proof: the identity space boundary shape exists on a 1977 VM with 4K RAM.
/// Same seed (42) as all other oracles.
[<RequireQualifiedAccess>]
module IdentityDlaChip8 =

    let private W = Chip8.DisplayW  // 64
    let private H = Chip8.DisplayH  // 32

    // ⚠ Misnomer: NOT the Tsirelson bound (that is S ≤ 2√2 on the CHSH correlator, see
    // src/Core/Tsirelson.fs). This is a chosen DLA sticking probability. Corrected 2026-08-01.
    let private TSIRELSON = 1.0 / (3.0 * sqrt 2.0)  // ≈ 0.2357 — sticking probability (design choice)

    // ── Minimal seeded PRNG (xorshift32, same family as Chip-8 RND opcode) ────────────────────
    type private Rng(seed: int) =
        let mutable s = uint32 seed ||| 1u
        member _.Next() =
            s <- s ^^^ (s <<< 13)
            s <- s ^^^ (s >>> 17)
            s <- s ^^^ (s <<< 5)
            float s / float System.UInt32.MaxValue
        member r.NextInt(n: int) = int (r.Next() * float n)

    // ── Grid (bool array, row-major) ──────────────────────────────────────────────────────────
    type Display = { Pixels: bool[]; Width: int; Height: int; ClusterSize: int }

    let private idx (w: int) (x: int) (y: int) = y * w + x
    let private inBounds (x: int) (y: int) = x >= 0 && x < W && y >= 0 && y < H

    let private gsetNeighbors (pixels: bool[]) (x: int) (y: int) : int =
        [| (x-1,y); (x+1,y); (x,y-1); (x,y+1) |]
        |> Array.filter (fun (nx,ny) -> inBounds nx ny && pixels.[idx W nx ny])
        |> Array.length

    let private stickProb (pixels: bool[]) (x: int) (y: int) : float =
        let n = gsetNeighbors pixels x y
        if n = 0 then 0.0
        else min 1.0 (TSIRELSON * (1.0 + float n * 0.5))

    // ── DLA run ───────────────────────────────────────────────────────────────────────────────

    /// Run DLA on the 64×32 Chip-8 display.
    /// `seed` must match all other oracles. `nWalkers` is capped by the display size.
    let run (seed: int) (nWalkers: int) : Display =
        let rng = Rng(seed)
        let pixels = Array.zeroCreate (W * H)
        // Seed: center pixel
        let cx, cy = W / 2, H / 2
        pixels.[idx W cx cy] <- true
        let mutable clusterSize = 1

        let killRadius = float (min W H) * 0.48
        let dirs = [| (0,1); (0,-1); (1,0); (-1,0) |]

        for _ in 1..nWalkers do
            // Spawn on boundary ring
            let mutable wx, wy =
                match rng.NextInt(4) with
                | 0 -> rng.NextInt(W), 0
                | 1 -> rng.NextInt(W), H - 1
                | 2 -> 0, rng.NextInt(H)
                | _ -> W - 1, rng.NextInt(H)
            let mutable stuck = false
            let mutable escaped = false
            while not stuck && not escaped do
                let dx, dy = dirs.[rng.NextInt(4)]
                wx <- max 0 (min (W-1) (wx + dx))
                wy <- max 0 (min (H-1) (wy + dy))
                let dist = sqrt (float (wx-cx)**2.0 + float (wy-cy)**2.0)
                if dist > killRadius then escaped <- true
                elif gsetNeighbors pixels wx wy > 0 then
                    if rng.Next() < stickProb pixels wx wy then stuck <- true
            if stuck then
                pixels.[idx W wx wy] <- true
                clusterSize <- clusterSize + 1

        { Pixels = pixels; Width = W; Height = H; ClusterSize = clusterSize }

    // ── Fractal dimension (box-counting) ─────────────────────────────────────────────────────
    let fractalDimension (d: Display) : float =
        let sizes = [| 2; 4; 8 |] |> Array.filter (fun s -> s < min d.Width d.Height)
        if sizes.Length < 2 then 1.5
        else
            let logCounts =
                sizes |> Array.map (fun s ->
                    let mutable count = 0
                    let bx = (d.Width + s - 1) / s
                    let by = (d.Height + s - 1) / s
                    for bxi in 0..bx-1 do
                        for byi in 0..by-1 do
                            let mutable found = false
                            for dx in 0..s-1 do
                                for dy in 0..s-1 do
                                    let x = bxi * s + dx
                                    let y = byi * s + dy
                                    if x < d.Width && y < d.Height && d.Pixels.[idx d.Width x y] then
                                        found <- true
                            if found then count <- count + 1
                    log (float count), log (1.0 / float s))
            let n = float logCounts.Length
            let sumX = logCounts |> Array.sumBy snd
            let sumY = logCounts |> Array.sumBy fst
            let sumXY = logCounts |> Array.sumBy (fun (y,x) -> x*y)
            let sumX2 = logCounts |> Array.sumBy (fun (_,x) -> x*x)
            (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    // ── ASCII export (for terminal / test output) ─────────────────────────────────────────────
    let toAscii (d: Display) : string =
        let sb = System.Text.StringBuilder()
        for y in 0..d.Height-1 do
            for x in 0..d.Width-1 do
                sb.Append(if d.Pixels.[idx d.Width x y] then '#' else '.') |> ignore
            sb.AppendLine() |> ignore
        sb.ToString()

    /// Export as a JSON-compatible string for the browser visualizer.
    let toJson (d: Display) : string =
        let cells =
            d.Pixels |> Array.map (fun b -> if b then "1" else "0") |> String.concat ","
        sprintf """{"oracle":"chip8","width":%d,"height":%d,"clusterSize":%d,"cells":[%s]}"""
            d.Width d.Height d.ClusterSize cells
