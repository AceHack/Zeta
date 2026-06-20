namespace Zeta.Core

/// **2D viewport over a 3D-capable world frame** — the projection floor of the metaspace navigation
/// (the "outside / meta-vault" homepage; see
/// `docs/research/2026-06-20-metaspace-navigation-physics-engine-2d-viewport-over-3d-clifford-frame-zoom-is-level-traversal.md`).
///
/// Positions live in a 3D frame (`Vec3`, Cl3-compatible) so the model is **3D-READY**; the current
/// render projects **orthographically** to a 2D screen (`Vec2`) through a pan/zoom `Camera`. This is
/// the graphics MVP pipeline (model → view/projection → screen) and the GIS pattern (geographic CRS
/// → projected CRS → screen): **2D-now, 3D-ready by construction** — flip to perspective later by
/// changing `project` (using `Z`), not the model. "Real depends on the renderer": the `Camera` IS
/// the renderer; the world frame is invariant under it.
///
/// Pure + deterministic (no ambient state, no culture-sensitive ops) — DST-replayable and composable
/// under the metaspace force-directed layout + enter/exit frame changes.
[<RequireQualifiedAccess>]
module Viewport =

    /// A point in the 3D world frame. Orthographic render uses `X`,`Y`; `Z` is reserved for depth /
    /// the future perspective projection (kept so the model is 3D-ready).
    type Vec3 = { X: float; Y: float; Z: float }

    /// A point on the 2D screen (world units × zoom, relative to the camera center).
    type Vec2 = { Sx: float; Sy: float }

    /// The camera: world-space center (pan) and `Zoom` (screen units per world unit, `> 0`).
    type Camera = { CenterX: float; CenterY: float; Zoom: float }

    /// A 3D world point.
    let vec3 (x: float) (y: float) (z: float) : Vec3 = { X = x; Y = y; Z = z }

    /// A camera centered at the origin with the given zoom.
    let camera (zoom: float) : Camera = { CenterX = 0.0; CenterY = 0.0; Zoom = zoom }

    /// A camera centered at `(cx, cy)` in world space with the given zoom.
    let cameraAt (cx: float) (cy: float) (zoom: float) : Camera = { CenterX = cx; CenterY = cy; Zoom = zoom }

    /// Orthographic world → screen: `(worldXY − center) × zoom`. (Perspective later folds in `Z`.)
    let project (cam: Camera) (p: Vec3) : Vec2 =
        { Sx = (p.X - cam.CenterX) * cam.Zoom
          Sy = (p.Y - cam.CenterY) * cam.Zoom }

    /// Inverse on the `z = 0` plane: screen → world — for click-to-enter hit-testing. Requires
    /// `cam.Zoom <> 0`.
    let unproject (cam: Camera) (s: Vec2) : Vec3 =
        { X = s.Sx / cam.Zoom + cam.CenterX
          Y = s.Sy / cam.Zoom + cam.CenterY
          Z = 0.0 }

    /// Pan the camera by a world-space delta.
    let pan (dx: float) (dy: float) (cam: Camera) : Camera =
        { cam with CenterX = cam.CenterX + dx; CenterY = cam.CenterY + dy }

    /// Zoom by `factor` (`> 1` zooms in) **about a world-space focus** — the "zoom toward the cursor"
    /// gesture: the focus point stays fixed on screen across the zoom. Adjusts the center so
    /// `project (zoomAbout focus factor cam) focus = project cam focus`.
    let zoomAbout (focus: Vec3) (factor: float) (cam: Camera) : Camera =
        { Zoom = cam.Zoom * factor
          CenterX = focus.X - (focus.X - cam.CenterX) / factor
          CenterY = focus.Y - (focus.Y - cam.CenterY) / factor }
