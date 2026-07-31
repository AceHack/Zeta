namespace Zeta.Core

/// **`OrbitBraid` — extract the geometric braid of a moving point-set (the orbit→braid half of the
/// Thurston bridge) (shadow*, Aaron 2026-07-31, forger-map rung 081KYWE8Q4V08QG0R003NNTK15).**
///
/// The second half the Thurston–Nielsen–Boyland bridge was missing. `BraidEntropy` takes a braid word to
/// the topological entropy it forces (`h ≥ log λ`); this takes a *trajectory* to its braid word — so the
/// two compose into **trajectory → braid → entropy**, and `Orbit.largestLyapunov` (entropy from the
/// dynamics) can be cross-checked against `BraidEntropy.growthRate` (entropy the extracted braid forces)
/// on the SAME motion. Run a 2-D map on a set of periodic points over one period, collect the frames,
/// extract the braid, and you have measured whether that dynamics carries a pseudo-Anosov (positive-
/// entropy, homoclinic-tangle) braid — the forger-map question, made runnable.
///
/// **The construction (Boyland).** The k points trace worldlines in (position × time). Project positions
/// to the x-axis; each time two points swap x-order they **cross** (a braid generator σᵢ at that lane),
/// and the **sign** (over/under) is set by which strand is higher in y at the crossing — the point rising
/// in x passing **over** (higher y) is σᵢ⁺, under is σᵢ⁻. Crossings compose left-to-right into the braid
/// word (`Braid`/`BraidEntropy` encoding: c = lane+1, negative = inverse).
///
/// **Honest scope (peel):**
///   - The over/under sign is the standard planar convention (rising strand over ⇒ positive). A different
///     projection axis or convention gives the mirror/inverse braid — the DILATATION (hence entropy) is a
///     conjugacy invariant and is unchanged, but the exact word is convention-dependent.
///   - Assumes **fine time-steps** — at most one adjacent-lane swap per pair per frame. Coarse steps that
///     jump non-adjacent lanes are decomposed by a bubble pass (a valid factorization), but then the
///     per-swap y is read at one frame, so multi-swap signs are a first-pass approximation. Feed dense
///     frames for a faithful word.
///   - x-ties (two equal x) are broken by list order; perturb the projection if a trajectory has them.
///   - This extracts the braid of a GIVEN trajectory; whether that braid is pseudo-Anosov (→ genuine
///     homoclinic tangle) is exactly what `BraidEntropy` then decides. Orbit→braid (here) + braid→entropy
///     (BraidEntropy) = the full bridge.
[<RequireQualifiedAccess>]
module OrbitBraid =

    /// Extract the geometric braid word of k points across a sequence of frames. Each frame is the k point
    /// positions indexed by point-id (list index = id). Returns crossings in `Braid` encoding.
    let braidFromFrames (frames: (float * float) list list) : int list =
        match frames with
        | [] -> []
        | first :: rest ->
            let k = List.length first
            if k < 2 then []
            else
                // point-ids sorted by x = the lane order (order.[lane] = id occupying that lane)
                let xOrder (frame: (float * float) list) =
                    let a = Array.ofList frame
                    [| 0 .. k - 1 |] |> Array.sortBy (fun id -> fst a.[id])
                let out = ResizeArray<int>()
                let mutable order = xOrder first
                for frame in rest do
                    let fa = Array.ofList frame
                    let target = xOrder frame
                    // rank of each id in the target order (its destination lane)
                    let rankInTarget = Array.zeroCreate k
                    for lane in 0 .. k - 1 do
                        rankInTarget.[target.[lane]] <- lane
                    // bubble `order` toward `target`; each adjacent swap is a crossing, signed by y
                    let cur = Array.copy order
                    let mutable swapped = true
                    while swapped do
                        swapped <- false
                        for i in 0 .. k - 2 do
                            if rankInTarget.[cur.[i]] > rankInTarget.[cur.[i + 1]] then
                                let pRight = cur.[i] // currently left, moving to the right lane
                                let pLeft = cur.[i + 1] // currently right, moving to the left lane
                                let sign = if snd fa.[pRight] > snd fa.[pLeft] then 1 else -1 // rising strand over?
                                out.Add(sign * (i + 1)) // σ at lane i = c (i+1); negative = inverse
                                let t = cur.[i]
                                cur.[i] <- cur.[i + 1]
                                cur.[i + 1] <- t
                                swapped <- true
                    order <- target
                List.ofSeq out

    /// Run a 2-D `map` on `points` for `steps` iterations, collecting the trajectory frames (including the
    /// start), then extract the braid. The orbit→braid pipeline for a dynamical system; compose with
    /// `BraidEntropy.growthRate` to get the topological entropy the orbit forces.
    let braidOfTrajectory (map: (float * float) -> (float * float)) (steps: int) (points: (float * float) list) : int list =
        let frames =
            [ let mutable cur = points
              yield cur
              for _ in 1 .. max 0 steps do
                  cur <- cur |> List.map map
                  yield cur ]
        braidFromFrames frames
