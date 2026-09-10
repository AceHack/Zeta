namespace Zeta.E8Render

open System
open System.Numerics
open System.Threading

/// **`E8Raytracer` — nearest-hit occlusion for a surface that interpenetrates, on the CPU,
/// with real SIMD.**
///
/// **Why a ray tracer and not a rasteriser.** Rung 6 declined occlusion and said exactly
/// why: every edge of 4_21 carries 27 incident 2-faces, so the projected shell has no
/// inside, and a painter's-algorithm depth sort is *wrong* on interpenetrating geometry —
/// it would be a silent lie. Ray tracing's nearest-hit is the correct occlusion method for
/// precisely that case, so this is the principled repair of a limitation that was already
/// measured, not a luxury.
///
/// **What rung 6 hands the tracer for free.** Intensity is computed in the 8-dimensional
/// integer coordinates BEFORE the projection, and it takes exactly five values. So a ray hit
/// does not evaluate lighting: it reads one byte. The per-hit cost that dominates an
/// ordinary tracer is already gone, which is what makes a CPU-only answer plausible.
///
/// **The SIMD contract.** The scalar and vector paths must produce byte-identical images.
/// That is the falsifier for the vector kernel: a lane mask that silently drops a hit is the
/// classic defect here, and it is invisible unless something insists the two agree exactly.
/// `E8RaytracerTests` insists.
///
/// Width is `Vector<float32>.Count` — the platform's native width, which is 4 on ARM NEON,
/// 8 with AVX2 and 16 with AVX-512, from ONE code path with no special cases. This is
/// `async-all-the-way`'s scale-free knob applied to lanes: the same kernel runs at width 1
/// (the scalar reference) and at width N.
///
/// Anchors (Beacon), cited because they are used:
///   - **Tomas Moeller & Ben Trumbore**, *Fast, Minimum Storage Ray/Triangle Intersection*
///     (Journal of Graphics Tools 2(1), 1997) — the intersection kernel, in its two-sided
///     form (no backface cull, because the surface has no inside).
///   - **Timothy Kay & James Kajiya**, *Ray tracing complex scenes* (SIGGRAPH 1986) — the
///     slab test the BVH traversal uses.
///   - **Ingo Wald, Solomon Boulos & Peter Shirley**, *Ray Tracing Deformable Scenes using
///     Dynamic Bounding Volume Hierarchies* (ACM TOG 26(1), 2007) — the binned
///     surface-area-heuristic BVH build and ordered traversal used here.
///   - **Jeffrey Goldsmith & John Salmon**, *Automatic Creation of Object Hierarchies for
///     Ray Tracing* (IEEE CG&A 7(5), 1987) and **J. David MacDonald & Kellogg Booth**,
///     *Heuristics for ray tracing using space subdivision* (The Visual Computer 6, 1990) —
///     the surface-area heuristic itself and its cost model.
///   - **Amy Williams, Steve Barrus, R. Keith Morley & Peter Shirley**, *An Efficient and
///     Robust Ray-Box Intersection Algorithm* (Journal of Graphics Tools 10(1), 2005) — the
///     reciprocal-direction slab form used below.
///
/// Register: the geometry and the equality between the two paths are **metered**. The
/// throughput numbers are **metered on the named hardware only** — a frame time without a
/// named machine is not a measurement, so every reported number carries its machine.
[<RequireQualifiedAccess>]
module E8Raytracer =

    /// Lanes the platform gives us. 4 on ARM NEON, 8 on AVX2, 16 on AVX-512.
    let lanes = Vector<float32>.Count

    /// Whether `Vector<float32>` is backed by hardware SIMD on this machine. A vector path
    /// on a machine where this is false is measuring the software fallback, and a number
    /// reported without it is not interpretable.
    let isHardwareAccelerated = Vector.IsHardwareAccelerated

    /// Triangles in structure-of-arrays form, in BVH leaf order, each leaf padded out to a
    /// whole number of lanes with degenerate triangles that always miss.
    type Scene =
        { /// First vertex, per slot.
          Ax: float32[]
          Ay: float32[]
          Az: float32[]
          /// `b - a`, per slot.
          E1x: float32[]
          E1y: float32[]
          E1z: float32[]
          /// `c - a`, per slot.
          E2x: float32[]
          E2y: float32[]
          E2z: float32[]
          /// Brightness LEVEL index, 0..4, computed in exact 8D integers before projection.
          Level: byte[]
          /// Slots that are real triangles rather than padding.
          Live: bool[]
          /// The ORIGINAL face index of each slot, `-1` for padding.
          ///
          /// This is the tie-break that makes nearest-hit a TOTAL order. Rung 6's shading is
          /// order-independent by construction; occlusion is not, because a surface with 27
          /// faces per edge produces rays whose two nearest hits land at a bit-identical
          /// float `t` on faces of DIFFERENT brightness. Measured: 6 of 1,024 pixels at
          /// 32x32. Without a tie-break the winner is whichever triangle the traversal
          /// happened to reach first, so the BVH and the exhaustive scan legitimately
          /// disagree — which would have made the brute-force falsifier unusable. Breaking
          /// on the lowest original face index restores rung 6's order-independence at the
          /// occlusion layer: the answer is a pure function of (scene, ray).
          FaceIndex: int[]
          /// Real triangles, excluding padding.
          TriangleCount: int
          /// Flattened BVH; see `BvhNode`.
          Nodes: BvhNode[]
          /// The five exact two-sided Lambert numerators, ascending: `Level` indexes this.
          BrightnessNumerators: int[] }

    /// A flattened BVH node. `Count = 0` marks an interior node, whose children are the node
    /// indices `LeftOrStart` and `Right`.
    ///
    /// BOTH child indices are stored. A depth-first build does not place siblings next to
    /// each other — the whole left subtree lies between them — so the usual `left + 1`
    /// shortcut is wrong here. It was written that way first, guarded by an assertion, and
    /// the assertion fired on the first real scene. Keeping the guard would have been
    /// keeping a check whose only possible report is the same defect; storing the index
    /// removes the defect.
    and [<Struct>] BvhNode =
        { MinX: float32
          MinY: float32
          MinZ: float32
          MaxX: float32
          MaxY: float32
          MaxZ: float32
          LeftOrStart: int
          Right: int
          Count: int }

    /// A pinhole camera. `Forward`, `Right` and `Up` are orthonormal.
    type Camera =
        { OriginX: float32
          OriginY: float32
          OriginZ: float32
          ForwardX: float32
          ForwardY: float32
          ForwardZ: float32
          RightX: float32
          RightY: float32
          RightZ: float32
          UpX: float32
          UpY: float32
          UpZ: float32
          /// `tan(fov / 2)` on the vertical axis.
          TanHalfFov: float32 }

    /// Triangles per BVH leaf before padding. Chosen so a leaf is a small whole number of
    /// vector loads at every supported width.
    [<Literal>]
    let LeafSize = 16

    // ── build ───────────────────────────────────────────────────────────────

    /// Build the ray-traceable scene from the exact substrate: the 3D positions come from
    /// `E8Embedding` (the declared float boundary) and the per-triangle brightness comes
    /// from `E8Shading` (exact integers, never projected).
    let buildScene (rs: int[][]) (faces: E8Exact.Face[]) (light: int[]) : Scene =
        let layers = E8Embedding.eigenLayers ()
        let points = E8Embedding.embed3d rs layers
        let shaded = E8Shading.shadeFaces light faces rs
        let numerators = E8Shading.intensityHistogram shaded |> Array.map fst

        let levelOf (s: E8Shading.ShadedFace) =
            match Array.tryFindIndex (fun n -> n = s.TwoSided.Numerator) numerators with
            | Some i -> byte i
            | None -> failwith "shaded face carries a numerator outside the measured census"

        let n = faces.Length
        // Per-triangle AABB and centroid, so the build never re-walks vertices.
        let bx0, by0, bz0 = Array.zeroCreate<float32> n, Array.zeroCreate<float32> n, Array.zeroCreate<float32> n
        let bx1, by1, bz1 = Array.zeroCreate<float32> n, Array.zeroCreate<float32> n, Array.zeroCreate<float32> n
        let cx, cy, cz = Array.zeroCreate<float32> n, Array.zeroCreate<float32> n, Array.zeroCreate<float32> n

        for i in 0 .. n - 1 do
            let pa = points.[faces.[i].A]
            let pb = points.[faces.[i].B]
            let pc = points.[faces.[i].C]
            let ax, ay, az = float32 pa.X, float32 pa.Y, float32 pa.Z
            let bxv, byv, bzv = float32 pb.X, float32 pb.Y, float32 pb.Z
            let cxv, cyv, czv = float32 pc.X, float32 pc.Y, float32 pc.Z
            bx0.[i] <- min ax (min bxv cxv)
            by0.[i] <- min ay (min byv cyv)
            bz0.[i] <- min az (min bzv czv)
            bx1.[i] <- max ax (max bxv cxv)
            by1.[i] <- max ay (max byv cyv)
            bz1.[i] <- max az (max bzv czv)
            cx.[i] <- (ax + bxv + cxv) / 3.0f
            cy.[i] <- (ay + byv + cyv) / 3.0f
            cz.[i] <- (az + bzv + czv) / 3.0f

        let order = Array.init n id
        let nodes = ResizeArray<BvhNode>()

        let boundsOf (lo: int) (hi: int) =
            let mutable mnx = Single.PositiveInfinity
            let mutable mny = Single.PositiveInfinity
            let mutable mnz = Single.PositiveInfinity
            let mutable mxx = Single.NegativeInfinity
            let mutable mxy = Single.NegativeInfinity
            let mutable mxz = Single.NegativeInfinity

            for k in lo .. hi - 1 do
                let t = order.[k]
                if bx0.[t] < mnx then mnx <- bx0.[t]
                if by0.[t] < mny then mny <- by0.[t]
                if bz0.[t] < mnz then mnz <- bz0.[t]
                if bx1.[t] > mxx then mxx <- bx1.[t]
                if by1.[t] > mxy then mxy <- by1.[t]
                if bz1.[t] > mxz then mxz <- bz1.[t]

            struct (mnx, mny, mnz, mxx, mxy, mxz)

        /// Bins per axis for the surface-area-heuristic sweep.
        let bins = 16

        let surfaceArea (mnx: float32) mny mnz (mxx: float32) mxy mxz =
            let dx = max 0.0f (mxx - mnx)
            let dy = max 0.0f (mxy - mny)
            let dz = max 0.0f (mxz - mnz)
            2.0f * (dx * dy + dy * dz + dz * dx)

        // **Binned surface-area-heuristic build** (Wald 2007; Goldsmith & Salmon 1987 for the
        // heuristic itself; MacDonald & Booth 1990 for the cost model). Object median was
        // tried first and measured: on THIS geometry it produced leaves whose total surface
        // area was ~1000x the root's, because 4_21's 2-faces project to triangles roughly a
        // fifth of the model across, so their boxes all overlap. The SAH does better and is
        // still not good — that limit is a property of the object and is reported rather
        // than hidden.
        let rec build (lo: int) (hi: int) : int =
            let struct (mnx, mny, mnz, mxx, mxy, mxz) = boundsOf lo hi
            let index = nodes.Count

            nodes.Add
                { MinX = mnx
                  MinY = mny
                  MinZ = mnz
                  MaxX = mxx
                  MaxY = mxy
                  MaxZ = mxz
                  LeftOrStart = lo
                  Right = -1
                  Count = hi - lo }

            if hi - lo > LeafSize then
                let count = hi - lo
                let mutable bestCost = Single.PositiveInfinity
                let mutable bestAxis = -1
                let mutable bestBin = -1

                for axis in 0 .. 2 do
                    let c = if axis = 0 then cx elif axis = 1 then cy else cz
                    let mutable cmn = Single.PositiveInfinity
                    let mutable cmx = Single.NegativeInfinity

                    for k in lo .. hi - 1 do
                        let v = c.[order.[k]]
                        if v < cmn then cmn <- v
                        if v > cmx then cmx <- v

                    if cmx > cmn then
                        let scale = float32 bins / (cmx - cmn)
                        let counts = Array.zeroCreate<int> bins
                        let b0 = Array.create (bins * 3) Single.PositiveInfinity
                        let b1 = Array.create (bins * 3) Single.NegativeInfinity

                        for k in lo .. hi - 1 do
                            let t = order.[k]
                            let b = min (bins - 1) (int ((c.[t] - cmn) * scale))
                            counts.[b] <- counts.[b] + 1
                            if bx0.[t] < b0.[b * 3] then b0.[b * 3] <- bx0.[t]
                            if by0.[t] < b0.[b * 3 + 1] then b0.[b * 3 + 1] <- by0.[t]
                            if bz0.[t] < b0.[b * 3 + 2] then b0.[b * 3 + 2] <- bz0.[t]
                            if bx1.[t] > b1.[b * 3] then b1.[b * 3] <- bx1.[t]
                            if by1.[t] > b1.[b * 3 + 1] then b1.[b * 3 + 1] <- by1.[t]
                            if bz1.[t] > b1.[b * 3 + 2] then b1.[b * 3 + 2] <- bz1.[t]

                        // Sweep right to left, then left to right, so each split's two
                        // half-costs are known in one pass each.
                        let rightArea = Array.zeroCreate<float32> bins
                        let rightCount = Array.zeroCreate<int> bins
                        let mutable rx0, ry0, rz0 = Single.PositiveInfinity, Single.PositiveInfinity, Single.PositiveInfinity
                        let mutable rx1, ry1, rz1 = Single.NegativeInfinity, Single.NegativeInfinity, Single.NegativeInfinity
                        let mutable acc = 0

                        for b in bins - 1 .. -1 .. 1 do
                            if counts.[b] > 0 then
                                rx0 <- min rx0 b0.[b * 3]
                                ry0 <- min ry0 b0.[b * 3 + 1]
                                rz0 <- min rz0 b0.[b * 3 + 2]
                                rx1 <- max rx1 b1.[b * 3]
                                ry1 <- max ry1 b1.[b * 3 + 1]
                                rz1 <- max rz1 b1.[b * 3 + 2]
                                acc <- acc + counts.[b]

                            rightArea.[b] <- surfaceArea rx0 ry0 rz0 rx1 ry1 rz1
                            rightCount.[b] <- acc

                        let mutable lx0, ly0, lz0 = Single.PositiveInfinity, Single.PositiveInfinity, Single.PositiveInfinity
                        let mutable lx1, ly1, lz1 = Single.NegativeInfinity, Single.NegativeInfinity, Single.NegativeInfinity
                        let mutable leftAcc = 0

                        for b in 0 .. bins - 2 do
                            if counts.[b] > 0 then
                                lx0 <- min lx0 b0.[b * 3]
                                ly0 <- min ly0 b0.[b * 3 + 1]
                                lz0 <- min lz0 b0.[b * 3 + 2]
                                lx1 <- max lx1 b1.[b * 3]
                                ly1 <- max ly1 b1.[b * 3 + 1]
                                lz1 <- max lz1 b1.[b * 3 + 2]
                                leftAcc <- leftAcc + counts.[b]

                            if leftAcc > 0 && rightCount.[b + 1] > 0 then
                                let cost =
                                    surfaceArea lx0 ly0 lz0 lx1 ly1 lz1 * float32 leftAcc
                                    + rightArea.[b + 1] * float32 rightCount.[b + 1]

                                if cost < bestCost then
                                    bestCost <- cost
                                    bestAxis <- axis
                                    bestBin <- b

                let mid =
                    if bestAxis < 0 then
                        // Every centroid coincides on every axis: fall back to an object
                        // median so the recursion still terminates.
                        lo + count / 2
                    else
                        let c = if bestAxis = 0 then cx elif bestAxis = 1 then cy else cz
                        let mutable cmn = Single.PositiveInfinity
                        let mutable cmx = Single.NegativeInfinity

                        for k in lo .. hi - 1 do
                            let v = c.[order.[k]]
                            if v < cmn then cmn <- v
                            if v > cmx then cmx <- v

                        let scale = float32 bins / (cmx - cmn)
                        let mutable i = lo
                        let mutable j = hi - 1

                        while i <= j do
                            let t = order.[i]

                            if min (bins - 1) (int ((c.[t] - cmn) * scale)) <= bestBin then
                                i <- i + 1
                            else
                                order.[i] <- order.[j]
                                order.[j] <- t
                                j <- j - 1

                        if i = lo || i = hi then lo + count / 2 else i

                let left = build lo mid
                let right = build mid hi

                nodes.[index] <-
                    { nodes.[index] with
                        LeftOrStart = left
                        Right = right
                        Count = 0 }

            index

        if n > 0 then build 0 n |> ignore

        // Emit SoA in leaf order, padding each leaf out to a whole number of lanes.
        let slots = ResizeArray<int>()

        for i in 0 .. nodes.Count - 1 do
            let node = nodes.[i]

            if node.Count > 0 then
                let start = slots.Count

                for k in node.LeftOrStart .. node.LeftOrStart + node.Count - 1 do
                    slots.Add order.[k]

                let padded = ((node.Count + lanes - 1) / lanes) * lanes

                for _ in node.Count .. padded - 1 do
                    slots.Add -1

                nodes.[i] <-
                    { node with
                        LeftOrStart = start
                        Count = padded }

        let m = slots.Count
        let mk () = Array.zeroCreate<float32> m

        let ax, ay, az = mk (), mk (), mk ()
        let e1x, e1y, e1z = mk (), mk (), mk ()
        let e2x, e2y, e2z = mk (), mk (), mk ()
        let level = Array.zeroCreate<byte> m
        let faceIndex = Array.create m -1
        let live = Array.zeroCreate<bool> m

        for s in 0 .. m - 1 do
            let t = slots.[s]

            if t >= 0 then
                let f = faces.[t]
                let pa = points.[f.A]
                let pb = points.[f.B]
                let pc = points.[f.C]
                ax.[s] <- float32 pa.X
                ay.[s] <- float32 pa.Y
                az.[s] <- float32 pa.Z
                e1x.[s] <- float32 (pb.X - pa.X)
                e1y.[s] <- float32 (pb.Y - pa.Y)
                e1z.[s] <- float32 (pb.Z - pa.Z)
                e2x.[s] <- float32 (pc.X - pa.X)
                e2y.[s] <- float32 (pc.Y - pa.Y)
                e2z.[s] <- float32 (pc.Z - pa.Z)
                level.[s] <- levelOf shaded.[t]
                live.[s] <- true
                faceIndex.[s] <- t
        // Padding slots keep all-zero edges, so `det` is 0, `u` is NaN and every comparison
        // below is false: a padded lane can never win a nearest-hit. That is the whole
        // reason padding is safe, and it is asserted in the sibling test.

        { Ax = ax
          Ay = ay
          Az = az
          E1x = e1x
          E1y = e1y
          E1z = e1z
          E2x = e2x
          E2y = e2y
          E2z = e2z
          Level = level
          Live = live
          FaceIndex = faceIndex
          TriangleCount = n
          Nodes = nodes.ToArray()
          BrightnessNumerators = numerators }

    /// A camera framing the whole scene from `(1, 0.35, 0.6)`, normalised, at a distance
    /// that fits the bounding sphere. Derived from the geometry, not authored.
    let frameCamera (scene: Scene) : Camera =
        let root = scene.Nodes.[0]
        let cx = (root.MinX + root.MaxX) * 0.5f
        let cy = (root.MinY + root.MaxY) * 0.5f
        let cz = (root.MinZ + root.MaxZ) * 0.5f

        let radius =
            let dx = root.MaxX - cx
            let dy = root.MaxY - cy
            let dz = root.MaxZ - cz
            sqrt (dx * dx + dy * dy + dz * dz)

        let dx, dy, dz = 1.0f, 0.35f, 0.6f
        let dn = sqrt (dx * dx + dy * dy + dz * dz)
        let fx, fy, fz = -dx / dn, -dy / dn, -dz / dn
        let tanHalf = 0.5f
        let dist = radius / tanHalf * 1.05f
        // Right = normalise(forward x worldUp), Up = right x forward. World up is +Y.
        let rx = fy * 0.0f - fz * 1.0f
        let ry = fz * 0.0f - fx * 0.0f
        let rz = fx * 1.0f - fy * 0.0f
        let rn = sqrt (rx * rx + ry * ry + rz * rz)
        let rx, ry, rz = rx / rn, ry / rn, rz / rn
        let ux = ry * fz - rz * fy
        let uy = rz * fx - rx * fz
        let uz = rx * fy - ry * fx

        { OriginX = cx - fx * dist
          OriginY = cy - fy * dist
          OriginZ = cz - fz * dist
          ForwardX = fx
          ForwardY = fy
          ForwardZ = fz
          RightX = rx
          RightY = ry
          RightZ = rz
          UpX = ux
          UpY = uy
          UpZ = uz
          TanHalfFov = tanHalf }

    // ── intersection ────────────────────────────────────────────────────────

    /// Distance below which a hit is rejected, keeping the camera out of its own geometry.
    [<Literal>]
    let RayEpsilon = 1e-4f

    /// Slab test. Returns the near distance, or infinity on a miss.
    let inline private hitBox
        (node: BvhNode)
        (ox: float32)
        (oy: float32)
        (oz: float32)
        (ix: float32)
        (iy: float32)
        (iz: float32)
        (tMax: float32)
        : float32 =
        let t1 = (node.MinX - ox) * ix
        let t2 = (node.MaxX - ox) * ix
        let t3 = (node.MinY - oy) * iy
        let t4 = (node.MaxY - oy) * iy
        let t5 = (node.MinZ - oz) * iz
        let t6 = (node.MaxZ - oz) * iz
        let tmin = max (max (min t1 t2) (min t3 t4)) (min t5 t6)
        let tmax = min (min (max t1 t2) (max t3 t4)) (max t5 t6)
        if tmax >= max tmin 0.0f && tmin <= tMax then max tmin 0.0f else Single.PositiveInfinity

    /// SCALAR Moeller-Trumbore over one leaf. The reference the vector kernel must match.
    let inline private leafScalar
        (scene: Scene)
        (start: int)
        (count: int)
        (ox: float32)
        (oy: float32)
        (oz: float32)
        (dx: float32)
        (dy: float32)
        (dz: float32)
        (bestT: byref<float32>)
        (bestSlot: byref<int>)
        =
        for s in start .. start + count - 1 do
            let e1x = scene.E1x.[s]
            let e1y = scene.E1y.[s]
            let e1z = scene.E1z.[s]
            let e2x = scene.E2x.[s]
            let e2y = scene.E2y.[s]
            let e2z = scene.E2z.[s]
            let px = dy * e2z - dz * e2y
            let py = dz * e2x - dx * e2z
            let pz = dx * e2y - dy * e2x
            let det = e1x * px + e1y * py + e1z * pz
            // Two-sided: no backface cull. The shell has 27 faces per edge and no inside.
            let inv = 1.0f / det
            let tx = ox - scene.Ax.[s]
            let ty = oy - scene.Ay.[s]
            let tz = oz - scene.Az.[s]
            let u = (tx * px + ty * py + tz * pz) * inv
            let qx = ty * e1z - tz * e1y
            let qy = tz * e1x - tx * e1z
            let qz = tx * e1y - ty * e1x
            let v = (dx * qx + dy * qy + dz * qz) * inv
            let t = (e2x * qx + e2y * qy + e2z * qz) * inv

            let closer =
                t < bestT
                || (t = bestT && bestSlot >= 0 && scene.FaceIndex.[s] < scene.FaceIndex.[bestSlot])

            if abs det > 1e-12f && u >= 0.0f && v >= 0.0f && u + v <= 1.0f && t > RayEpsilon && closer then
                bestT <- t
                bestSlot <- s

    /// VECTOR Moeller-Trumbore over one leaf, `lanes` triangles at a time.
    let inline private leafVector
        (scene: Scene)
        (start: int)
        (count: int)
        (ox: float32)
        (oy: float32)
        (oz: float32)
        (dx: float32)
        (dy: float32)
        (dz: float32)
        (bestT: byref<float32>)
        (bestSlot: byref<int>)
        =
        let vdx = Vector<float32>(dx)
        let vdy = Vector<float32>(dy)
        let vdz = Vector<float32>(dz)
        let vox = Vector<float32>(ox)
        let voy = Vector<float32>(oy)
        let voz = Vector<float32>(oz)
        let zero = Vector<float32>.Zero
        let one = Vector<float32>.One
        let eps = Vector<float32>(1e-12f)
        let rayEps = Vector<float32>(RayEpsilon)
        let inf = Vector<float32>(Single.PositiveInfinity)
        let mutable s = start

        while s < start + count do
            let e1x = Vector<float32>(scene.E1x, s)
            let e1y = Vector<float32>(scene.E1y, s)
            let e1z = Vector<float32>(scene.E1z, s)
            let e2x = Vector<float32>(scene.E2x, s)
            let e2y = Vector<float32>(scene.E2y, s)
            let e2z = Vector<float32>(scene.E2z, s)

            let px = Vector.Subtract(Vector.Multiply(vdy, e2z), Vector.Multiply(vdz, e2y))
            let py = Vector.Subtract(Vector.Multiply(vdz, e2x), Vector.Multiply(vdx, e2z))
            let pz = Vector.Subtract(Vector.Multiply(vdx, e2y), Vector.Multiply(vdy, e2x))

            let det =
                Vector.Add(Vector.Add(Vector.Multiply(e1x, px), Vector.Multiply(e1y, py)), Vector.Multiply(e1z, pz))

            let inv = Vector.Divide(one, det)
            let tx = Vector.Subtract(vox, Vector<float32>(scene.Ax, s))
            let ty = Vector.Subtract(voy, Vector<float32>(scene.Ay, s))
            let tz = Vector.Subtract(voz, Vector<float32>(scene.Az, s))

            let u =
                Vector.Multiply(
                    Vector.Add(Vector.Add(Vector.Multiply(tx, px), Vector.Multiply(ty, py)), Vector.Multiply(tz, pz)),
                    inv
                )

            let qx = Vector.Subtract(Vector.Multiply(ty, e1z), Vector.Multiply(tz, e1y))
            let qy = Vector.Subtract(Vector.Multiply(tz, e1x), Vector.Multiply(tx, e1z))
            let qz = Vector.Subtract(Vector.Multiply(tx, e1y), Vector.Multiply(ty, e1x))

            let v =
                Vector.Multiply(
                    Vector.Add(Vector.Add(Vector.Multiply(vdx, qx), Vector.Multiply(vdy, qy)), Vector.Multiply(vdz, qz)),
                    inv
                )

            let t =
                Vector.Multiply(
                    Vector.Add(Vector.Add(Vector.Multiply(e2x, qx), Vector.Multiply(e2y, qy)), Vector.Multiply(e2z, qz)),
                    inv
                )

            let mask =
                Vector.BitwiseAnd(
                    Vector.BitwiseAnd(Vector.GreaterThan(Vector.Abs det, eps), Vector.GreaterThanOrEqual(u, zero)),
                    Vector.BitwiseAnd(
                        Vector.BitwiseAnd(
                            Vector.GreaterThanOrEqual(v, zero),
                            Vector.LessThanOrEqual(Vector.Add(u, v), one)
                        ),
                        Vector.GreaterThan(t, rayEps)
                    )
                )

            // A missed lane becomes +infinity, so the reduction below cannot select it and
            // no NaN ever reaches the comparison.
            let candidate = Vector.ConditionalSelect(mask, t, inf)

            for lane in 0 .. lanes - 1 do
                let ct = candidate.[lane]

                // Padded lanes carry `+infinity`, and `bestSlot < 0` only while `bestT` is
                // also `+infinity`, so the tie-break can never select one.
                if ct < bestT
                   || (ct = bestT
                       && bestSlot >= 0
                       && scene.FaceIndex.[s + lane] < scene.FaceIndex.[bestSlot]) then
                    bestT <- ct
                    bestSlot <- s + lane

            s <- s + lanes

    /// Traverse the BVH for one ray. `useVector` picks the kernel; everything else is shared,
    /// which is what makes the byte-identical-image comparison a test of the kernel alone.
    ///
    /// **Ordered, front-to-back.** The nearer child is descended first, so `bestT` tightens
    /// as early as possible and the far child is often culled without being opened. An
    /// unordered traversal is correct and measurably slower on this scene; the ordering
    /// cannot change the ANSWER, which is why the scalar/vector image equality still tests
    /// only the kernel.
    let private trace
        (scene: Scene)
        (useVector: bool)
        (ox: float32)
        (oy: float32)
        (oz: float32)
        (dx: float32)
        (dy: float32)
        (dz: float32)
        (stack: int[])
        : int =
        let ix = 1.0f / dx
        let iy = 1.0f / dy
        let iz = 1.0f / dz
        let mutable bestT = Single.PositiveInfinity
        let mutable bestSlot = -1
        let mutable sp = 0
        stack.[sp] <- 0
        sp <- sp + 1

        while sp > 0 do
            sp <- sp - 1
            let node = scene.Nodes.[stack.[sp]]

            if hitBox node ox oy oz ix iy iz bestT < Single.PositiveInfinity then
                if node.Count > 0 then
                    if useVector then
                        leafVector scene node.LeftOrStart node.Count ox oy oz dx dy dz &bestT &bestSlot
                    else
                        leafScalar scene node.LeftOrStart node.Count ox oy oz dx dy dz &bestT &bestSlot
                else
                    let nearLeft =
                        hitBox scene.Nodes.[node.LeftOrStart] ox oy oz ix iy iz bestT

                    let nearRight = hitBox scene.Nodes.[node.Right] ox oy oz ix iy iz bestT
                    // Push the FAR child first so the near one pops first.
                    let struct (first, second) =
                        if nearLeft <= nearRight then
                            struct (node.Right, node.LeftOrStart)
                        else
                            struct (node.LeftOrStart, node.Right)

                    if (if nearLeft <= nearRight then nearRight else nearLeft) < Single.PositiveInfinity then
                        stack.[sp] <- first
                        sp <- sp + 1

                    if (if nearLeft <= nearRight then nearLeft else nearRight) < Single.PositiveInfinity then
                        stack.[sp] <- second
                        sp <- sp + 1

        bestSlot

    /// The normalised direction of the primary ray through pixel `(px, py)`.
    ///
    /// ONE implementation, used by both the accelerated renderer and the brute-force
    /// reference below. A second copy would make the two agree about the geometry for a
    /// reason unrelated to the traversal they exist to compare.
    let private rayFor (camera: Camera) (width: int) (height: int) (px: int) (py: int) =
        let aspect = float32 width / float32 height
        let sy = (1.0f - 2.0f * ((float32 py + 0.5f) / float32 height)) * camera.TanHalfFov
        let sx = (2.0f * ((float32 px + 0.5f) / float32 width) - 1.0f) * camera.TanHalfFov * aspect
        let dx = camera.ForwardX + camera.RightX * sx + camera.UpX * sy
        let dy = camera.ForwardY + camera.RightY * sx + camera.UpY * sy
        let dz = camera.ForwardZ + camera.RightZ * sx + camera.UpZ * sy
        let dn = sqrt (dx * dx + dy * dy + dz * dz)
        struct (dx / dn, dy / dn, dz / dn)

    /// Render one frame: `width * height` primary rays, one per pixel, nearest hit.
    ///
    /// The returned buffer holds `level + 1` on a hit and `0` on a miss, so a caller can
    /// tell background from the darkest of the five brightness levels. **No lighting is
    /// evaluated here**: the level was computed in exact 8D integers before projection and
    /// is read out of a byte array.
    ///
    /// `degreeOfParallelism` is the knob `async-all-the-way-truthful-signatures` asks for,
    /// not a thread spawn: **DoP = 1 is a single cooperative loop** — deterministic, one
    /// stack, DST-replayable — and DoP = N is N workers draining the same row range, on the
    /// SAME code path with no special case. A pixel's value is a pure function of
    /// `(scene, camera, pixel)`, so the two produce byte-identical images, and the sibling
    /// test asserts that rather than trusting it.
    let render
        (scene: Scene)
        (camera: Camera)
        (width: int)
        (height: int)
        (useVector: bool)
        (degreeOfParallelism: int)
        : byte[] =
        let image = Array.zeroCreate<byte> (width * height)

        let renderRow (py: int) (stack: int[]) =
            for px in 0 .. width - 1 do
                let struct (dx, dy, dz) = rayFor camera width height px py

                let slot =
                    trace scene useVector camera.OriginX camera.OriginY camera.OriginZ dx dy dz stack

                image.[py * width + px] <- if slot < 0 then 0uy else scene.Level.[slot] + 1uy

        if degreeOfParallelism <= 1 then
            let stack = Array.zeroCreate<int> 128

            for py in 0 .. height - 1 do
                renderRow py stack
        else
            let options = Tasks.ParallelOptions(MaxDegreeOfParallelism = degreeOfParallelism)

            Tasks.Parallel.For(
                0,
                height,
                options,
                (fun () -> Array.zeroCreate<int> 128),
                (fun py _ (stack: int[]) ->
                    renderRow py stack
                    stack),
                (fun _ -> ())
            )
            |> ignore

        image

    /// **The unaccelerated reference: every triangle, every ray, no BVH at all.**
    ///
    /// A BVH is an *accelerator*, so its only obligation is to produce the answer the
    /// exhaustive scan produces. Without this, every ray-tracer falsifier in the suite is
    /// RELATIVE — scalar against vector, DoP 1 against DoP N — and a traversal that visits
    /// the wrong nodes changes both sides identically and stays invisible.
    ///
    /// That is not hypothetical: mutating the traversal to push only the NEAR child (so the
    /// far subtree is never opened) survived the whole suite before this function existed.
    /// The mutation run is what found it, and this is the falsifier it was missing.
    ///
    /// Padding slots always miss, so the scan runs over every slot with no special case.
    /// Quadratic in the obvious way — use it on small frames.
    let renderBruteForce (scene: Scene) (camera: Camera) (width: int) (height: int) (useVector: bool) : byte[] =
        let image = Array.zeroCreate<byte> (width * height)

        for py in 0 .. height - 1 do
            for px in 0 .. width - 1 do
                let struct (dx, dy, dz) = rayFor camera width height px py
                let mutable bestT = Single.PositiveInfinity
                let mutable bestSlot = -1

                if useVector then
                    leafVector
                        scene
                        0
                        scene.Ax.Length
                        camera.OriginX
                        camera.OriginY
                        camera.OriginZ
                        dx
                        dy
                        dz
                        &bestT
                        &bestSlot
                else
                    leafScalar
                        scene
                        0
                        scene.Ax.Length
                        camera.OriginX
                        camera.OriginY
                        camera.OriginZ
                        dx
                        dy
                        dz
                        &bestT
                        &bestSlot

                image.[py * width + px] <- if bestSlot < 0 then 0uy else scene.Level.[bestSlot] + 1uy

        image

    /// Wavefront-free, text-only image handoff: an ASCII PGM (`P2`).
    ///
    /// Text, so a rendered frame stays diffable and reviewable exactly like every other
    /// artifact in the proof lineage (`no-binary-in-proof-lineage`).
    let asciiPgm (image: byte[]) (width: int) (height: int) : string =
        let sb = Text.StringBuilder()
        sb.Append("P2\n").Append(width).Append(' ').Append(height).Append("\n255\n") |> ignore

        for py in 0 .. height - 1 do
            for px in 0 .. width - 1 do
                let v = image.[py * width + px]
                // 0 = background; levels 1..5 map to an even ramp over the visible range.
                let grey = if v = 0uy then 0 else 30 + 45 * int (v - 1uy)
                sb.Append(grey) |> ignore
                sb.Append(if px = width - 1 then '\n' else ' ') |> ignore

        sb.ToString()
