namespace Zeta.Core

/// **`PhasePortrait` — rasterize a dynamical orbit into a character grid (shadow*, Aaron 2026-07-31).**
///
/// A phase portrait is the geometric object the visual cortex reads. Poincaré *discovered* the homoclinic
/// tangle by drawing the stable/unstable manifolds and seeing they had to cross infinitely often — the
/// tangle was seen before it was formalized. So visualizing an orbit is not a shortcut for this class of
/// object; it is the native method that found it.
///
/// This renders the orbit of a map `step` (projected to 2D by `proj`) as an ASCII grid, auto-scaled to the
/// visited points. It is **faithful by construction**: it plots the ACTUAL iterated map — never a stylized
/// curve fitted to please the eye. That faithfulness is the whole point: the human check verifies the
/// *dynamics*, not whether the picture matched a prior. Pairs with `Orbit.classifyDynamics`
/// (`Fixed`/`Crystal`/`Quasiperiodic`/`Chaotic λ`): the portrait shows the shape, the classifier states λ.
[<RequireQualifiedAccess>]
module PhasePortrait =

    let private clamp lo hi v = max lo (min hi v)

    /// Rasterize `steps` points of the orbit of `step` from `s0` (after discarding `warmup` transient
    /// steps), projected to 2D by `proj`, into a `w × h` grid auto-scaled to the point bounding box.
    /// `mark` is drawn at each visited cell, `blank` elsewhere; rows are newline-joined, row 0 at the top
    /// (larger y is higher). Degenerate/empty inputs return "".
    let renderWith
        (mark: char) (blank: char)
        (proj: 'S -> float * float) (step: 'S -> 'S)
        (warmup: int) (steps: int) (w: int) (h: int) (s0: 'S) : string =
        let w = max 1 w
        let h = max 1 h
        let mutable s = s0
        for _ in 1 .. max 0 warmup do
            s <- step s
        let pts = ResizeArray<float * float>()
        for _ in 1 .. max 1 steps do
            pts.Add(proj s)
            s <- step s
        if pts.Count = 0 then ""
        else
            let minX = pts |> Seq.map fst |> Seq.min
            let maxX = pts |> Seq.map fst |> Seq.max
            let minY = pts |> Seq.map snd |> Seq.min
            let maxY = pts |> Seq.map snd |> Seq.max
            let spanX = if maxX - minX <= 0.0 then 1.0 else maxX - minX
            let spanY = if maxY - minY <= 0.0 then 1.0 else maxY - minY
            let grid = Array.init h (fun _ -> Array.create w blank)
            for (x, y) in pts do
                let cx = clamp 0 (w - 1) (int (float (w - 1) * (x - minX) / spanX))
                let cy = clamp 0 (h - 1) (int (float (h - 1) * (maxY - y) / spanY)) // invert: larger y up
                grid.[cy].[cx] <- mark
            grid |> Array.map System.String |> String.concat "\n"

    /// The orbit of `step` from `s0` as a `w × h` ASCII grid ('#' = visited, ' ' = empty). See `renderWith`.
    let render (proj: 'S -> float * float) (step: 'S -> 'S) (warmup: int) (steps: int) (w: int) (h: int) (s0: 'S) : string =
        renderWith '#' ' ' proj step warmup steps w h s0

    /// Two nearby orbits overlaid on ONE shared, co-scaled grid — the visual signature of sensitive
    /// dependence: for a chaotic map `a` and `b` start together and visibly peel apart; for an ordered map
    /// they stay locked. `a` is drawn '#', `b` is 'o', a cell hit by both is '@'. The scale is the union
    /// bounding box of both orbits so the divergence is honestly to-scale (not stretched apart).
    let renderPair
        (proj: 'S -> float * float) (step: 'S -> 'S)
        (warmup: int) (steps: int) (w: int) (h: int) (a0: 'S) (b0: 'S) : string =
        let w = max 1 w
        let h = max 1 h
        let collect s0 =
            let mutable s = s0
            for _ in 1 .. max 0 warmup do
                s <- step s
            let pts = ResizeArray<float * float>()
            for _ in 1 .. max 1 steps do
                pts.Add(proj s)
                s <- step s
            pts
        let pa = collect a0
        let pb = collect b0
        let all = Seq.append pa pb
        if Seq.isEmpty all then ""
        else
            let minX = all |> Seq.map fst |> Seq.min
            let maxX = all |> Seq.map fst |> Seq.max
            let minY = all |> Seq.map snd |> Seq.min
            let maxY = all |> Seq.map snd |> Seq.max
            let spanX = if maxX - minX <= 0.0 then 1.0 else maxX - minX
            let spanY = if maxY - minY <= 0.0 then 1.0 else maxY - minY
            let grid = Array.init h (fun _ -> Array.create w ' ')
            let plot ch (pts: ResizeArray<float * float>) =
                for (x, y) in pts do
                    let cx = clamp 0 (w - 1) (int (float (w - 1) * (x - minX) / spanX))
                    let cy = clamp 0 (h - 1) (int (float (h - 1) * (maxY - y) / spanY))
                    grid.[cy].[cx] <- (if grid.[cy].[cx] = ' ' then ch elif grid.[cy].[cx] = ch then ch else '@')
            plot '#' pa
            plot 'o' pb
            grid |> Array.map System.String |> String.concat "\n"
