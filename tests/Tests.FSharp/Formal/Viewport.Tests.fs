module Zeta.Tests.Formal.ViewportTests

open FsCheck.Xunit
open global.Xunit
open Zeta.Core

// The 2D-viewport-over-3D-frame primitive (metaspace navigation floor): project / unproject /
// pan / zoomAbout. 2D-now, 3D-ready — the projection laws that let the same world frame render to
// a 2D screen and (later) a 3D viewport without model change.

/// Relative+absolute tolerance (orthographic project/unproject is FP, magnitude-scaled).
let private approx (a: float) (b: float) : bool = abs (a - b) <= 1e-6 * (1.0 + abs a + abs b)

/// Strictly-positive, not-tiny zoom from a generated int.
let private zoomOf (n: int) : float = 1.0 + float (abs (n % 1000))

/// Bounded exact-float coordinate from a generated int (keeps the FP round-trip stable).
let private coord (n: int) : float = float (n % 100000)

[<Property>]
let ``project sends the camera center to the screen origin`` (cx: int) (cy: int) (z: int) (zn: int) =
    let cam = Viewport.cameraAt (coord cx) (coord cy) (zoomOf zn)
    let s = Viewport.project cam (Viewport.vec3 cam.CenterX cam.CenterY (coord z))
    approx s.Sx 0.0 && approx s.Sy 0.0

[<Property>]
let ``unproject inverts project on the z=0 plane (click-to-enter hit-test)`` (x: int) (y: int) (cx: int) (cy: int) (zn: int) =
    let cam = Viewport.cameraAt (coord cx) (coord cy) (zoomOf zn)
    let p = Viewport.vec3 (coord x) (coord y) 0.0
    let back = Viewport.unproject cam (Viewport.project cam p)
    approx back.X p.X && approx back.Y p.Y && approx back.Z 0.0

[<Property>]
let ``zoomAbout keeps the focus point fixed on screen (zoom toward cursor)`` (fx: int) (fy: int) (cx: int) (cy: int) (zn: int) (fn: int) =
    let cam = Viewport.cameraAt (coord cx) (coord cy) (zoomOf zn)
    let focus = Viewport.vec3 (coord fx) (coord fy) 0.0
    let factor = 1.0 + float (abs (fn % 50)) // factor >= 1, strictly nonzero
    let before = Viewport.project cam focus
    let after = Viewport.project (Viewport.zoomAbout focus factor cam) focus
    approx before.Sx after.Sx && approx before.Sy after.Sy

[<Property>]
let ``pan is invertible`` (dx: int) (dy: int) (cx: int) (cy: int) (zn: int) =
    let cam = Viewport.cameraAt (coord cx) (coord cy) (zoomOf zn)
    let ddx = coord dx
    let ddy = coord dy
    let back = Viewport.pan (-ddx) (-ddy) (Viewport.pan ddx ddy cam)
    approx back.CenterX cam.CenterX && approx back.CenterY cam.CenterY

[<Fact>]
let ``zoom scales screen distance by the zoom factor`` () =
    let cam = Viewport.camera 2.0
    let s = Viewport.project cam (Viewport.vec3 1.0 0.0 0.0)
    Assert.Equal(2.0, s.Sx, 9)
    Assert.Equal(0.0, s.Sy, 9)

[<Fact>]
let ``zoomAbout the origin with the origin centered only scales zoom`` () =
    let cam = Viewport.camera 1.0
    let zoomed = Viewport.zoomAbout (Viewport.vec3 0.0 0.0 0.0) 3.0 cam
    Assert.Equal(3.0, zoomed.Zoom, 9)
    Assert.Equal(0.0, zoomed.CenterX, 9)
    Assert.Equal(0.0, zoomed.CenterY, 9)
