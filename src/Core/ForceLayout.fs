namespace Zeta.Core

/// **`ForceLayout` — the metaspace physics engine: a force-directed (spring-electrical) layout.**
///
/// Relaxes node positions (`Viewport.Vec3`, in the z=0 plane for 2D-now) toward the energy minimum of
/// a force field (Eades 1984; Fruchterman–Reingold 1991 — a literal physical simulation). Two forces:
/// **attraction** along graph edges (a spring pulling connected nodes together) and **repulsion**
/// between every pair (an electrical charge pushing them apart). The metaspace wires these to the real
/// SocietalDora metrics — **attraction = coupled-empowerment, repulsion = capture/diversity-collapse**
/// (see the design note) — so the resting layout IS the field's energy minimum, not decorative gravity.
/// The module is the pure physics; the metric-wiring (edge weights) is the caller's.
///
/// Pure + deterministic (no RNG, no ambient state) ⇒ DST-replayable + byte-lockable: same positions +
/// edges + params ⇒ same step. Repulsion is softened (`+ epsilon`) so coincident nodes don't blow up.
[<RequireQualifiedAccess>]
module ForceLayout =

    /// Tuning for one relaxation step.
    type Params =
        { /// Ideal edge length (the spring's rest length `k`).
          IdealLength: float
          /// Repulsion strength (electrical constant).
          Repulsion: float
          /// Attraction strength (spring constant) along edges.
          Attraction: float
          /// Step size (how far a node moves per displacement unit), and the per-step cap (`MaxStep`).
          Step: float
          MaxStep: float }

    /// Sensible defaults for a screen-scale layout.
    let defaults : Params =
        { IdealLength = 50.0; Repulsion = 1.0; Attraction = 1.0; Step = 0.1; MaxStep = 10.0 }

    let private epsilon = 1e-6

    /// One Fruchterman–Reingold relaxation step over `positions` with undirected `edges`
    /// `(i, j, weight)` (weight scales attraction — e.g. coupled-empowerment). Returns new positions;
    /// length preserved. Operates in the x/y plane (z carried through unchanged) for the 2D viewport.
    let step (p: Params) (edges: (int * int * float)[]) (positions: Viewport.Vec3[]) : Viewport.Vec3[] =
        let n = positions.Length
        let dispX = Array.zeroCreate<float> n
        let dispY = Array.zeroCreate<float> n

        // Repulsion: every distinct pair pushes apart, ~ k^2 / distance.
        for i in 0 .. n - 1 do
            for j in i + 1 .. n - 1 do
                let dx = positions.[i].X - positions.[j].X
                let dy = positions.[i].Y - positions.[j].Y
                let dist = sqrt (dx * dx + dy * dy) + epsilon
                let force = p.Repulsion * p.IdealLength * p.IdealLength / (dist * dist)
                let ux, uy = dx / dist, dy / dist
                dispX.[i] <- dispX.[i] + ux * force
                dispY.[i] <- dispY.[i] + uy * force
                dispX.[j] <- dispX.[j] - ux * force
                dispY.[j] <- dispY.[j] - uy * force

        // Attraction: each edge pulls its endpoints together, ~ weight * dist^2 / k.
        for (i, j, w) in edges do
            if i >= 0 && i < n && j >= 0 && j < n && i <> j then
                let dx = positions.[i].X - positions.[j].X
                let dy = positions.[i].Y - positions.[j].Y
                let dist = sqrt (dx * dx + dy * dy) + epsilon
                let force = p.Attraction * w * dist * dist / p.IdealLength
                let ux, uy = dx / dist, dy / dist
                dispX.[i] <- dispX.[i] - ux * force
                dispY.[i] <- dispY.[i] - uy * force
                dispX.[j] <- dispX.[j] + ux * force
                dispY.[j] <- dispY.[j] + uy * force

        // Apply, capping the per-step move (cooling/stability).
        Array.init n (fun i ->
            let mvx = dispX.[i] * p.Step
            let mvy = dispY.[i] * p.Step
            let mag = sqrt (mvx * mvx + mvy * mvy)
            let scale = if mag > p.MaxStep then p.MaxStep / mag else 1.0
            { positions.[i] with
                X = positions.[i].X + mvx * scale
                Y = positions.[i].Y + mvy * scale })

    /// Run `iters` relaxation steps (a fixed schedule — deterministic; no random restarts).
    let relax (p: Params) (iters: int) (edges: (int * int * float)[]) (positions: Viewport.Vec3[]) : Viewport.Vec3[] =
        let mutable acc = positions
        for _ in 1 .. iters do
            acc <- step p edges acc
        acc

    /// Total layout energy: spring + repulsion potential. Strictly decreases toward the rest state
    /// under relaxation (the metric the layout minimizes) — used to assert convergence.
    let energy (p: Params) (edges: (int * int * float)[]) (positions: Viewport.Vec3[]) : float =
        let n = positions.Length
        let mutable e = 0.0
        for i in 0 .. n - 1 do
            for j in i + 1 .. n - 1 do
                let dx = positions.[i].X - positions.[j].X
                let dy = positions.[i].Y - positions.[j].Y
                let dist = sqrt (dx * dx + dy * dy) + epsilon
                e <- e + p.Repulsion * p.IdealLength * p.IdealLength / dist // repulsion potential
        for (i, j, w) in edges do
            if i >= 0 && i < n && j >= 0 && j < n && i <> j then
                let dx = positions.[i].X - positions.[j].X
                let dy = positions.[i].Y - positions.[j].Y
                let dist = sqrt (dx * dx + dy * dy)
                e <- e + p.Attraction * w * dist * dist * dist / (3.0 * p.IdealLength) // spring potential
        e
