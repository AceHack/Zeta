namespace Zeta.Core

open System

/// **`MetaspaceGraphRender` — the end-to-end metaspace wire: graph → physics → navigable map.**
///
/// Composes the three metaspace slices into one pipeline:
/// `CoEmpowerGraph` → `ForceLayout.relax` (edge weights = **coupled-empowerment**) → relaxed
/// `Viewport.Vec3` positions → `MetaspaceMap.render` (Tier-0 no-JS SVG with warp-links). The resting
/// layout IS the SocietalDora field's energy minimum (forces = the real metrics, not decorative
/// gravity), and the output is the navigable "outside" you warp through.
///
/// Pure + deterministic (circle-seeded initial positions by node index — no RNG; fixed relax
/// schedule) ⇒ DST-replayable + byte-lockable: same graph + params ⇒ same SVG.
[<RequireQualifiedAccess>]
module MetaspaceGraphRender =

    /// Per-edge attraction weight = the **binding** coupled-empowerment of the pair:
    /// `min(coEmpowerment i→id(j), coEmpowerment j→id(i))` (the SocietalDora `min(self, other)` shape —
    /// can't be faked by one side). Floored to a small positive so every edge still springs.
    ///
    /// **Self-knowledge, not a forcing function (Aaron, 2026-06-20):** a monoculture neighbourhood
    /// scores *low* on co-empowerment (low diversity ⇒ low `optionSpace`) — but a low score is a
    /// *known measurement about itself*, NOT a signal to remove or penalize it. Monocultures are
    /// allowed to exist; that is how a culture finds all the nuance *within* its specificity. The
    /// floor (`+ 0.25`) makes this concrete in the physics: even a zero-coupled-empowerment edge still
    /// attracts (the cluster stays laid out together, never expelled) — the score informs, it does not
    /// coerce. Characterize, don't condemn.
    let edgeWeight (g: CoEmpowerGraph.Graph) (i: int) (j: int) : float =
        let ei = CoEmpowerGraph.coEmpowerment g i g.Identity.[j]
        let ej = CoEmpowerGraph.coEmpowerment g j g.Identity.[i]
        0.25 + float (min ei ej)

    /// Deterministic initial positions: nodes evenly on a circle (radius from `size`), by index.
    let private seedPositions (size: int) (n: int) : Viewport.Vec3[] =
        let r = float (max 1 (size / 3))
        let m = max 1 n
        Array.init n (fun i ->
            let theta = 2.0 * Math.PI * float i / float m
            Viewport.vec3 (r * cos theta) (r * sin theta) 0.0)

    /// The weighted undirected edge list (i < j) of the graph, weighted by coupled-empowerment.
    let edges (g: CoEmpowerGraph.Graph) : (int * int * float)[] =
        [| for i in 0 .. g.N - 1 do
               for j in g.Adjacency.[i] do
                   if j > i then
                       yield (i, j, edgeWeight g i j) |]

    /// Lay the graph out: seed on a circle, then relax under the coupled-empowerment force field.
    /// Returns one world position per node (the metaspace coordinates).
    let layout (p: ForceLayout.Params) (size: int) (iters: int) (g: CoEmpowerGraph.Graph) : Viewport.Vec3[] =
        ForceLayout.relax p iters (edges g) (seedPositions size g.N)

    /// Full pipeline: graph → laid-out, navigable Tier-0 SVG. `labelHref i` supplies each node's
    /// vault label + warp href. Camera centers the world origin at the viewport center (zoom 1).
    let render
        (p: ForceLayout.Params)
        (size: int)
        (iters: int)
        (labelHref: int -> string * string)
        (g: CoEmpowerGraph.Graph)
        : string =
        let positions = layout p size iters g
        let vaults =
            [ for i in 0 .. g.N - 1 do
                  let label, href = labelHref i
                  yield MetaspaceMap.vault positions.[i] label href ]
        MetaspaceMap.render size (Viewport.camera 1.0) vaults
