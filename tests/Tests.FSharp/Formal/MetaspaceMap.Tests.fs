module Zeta.Tests.Formal.MetaspaceMapTests

open FsCheck.Xunit
open global.Xunit
open Zeta.Core

// The Tier-0 navigable metaspace map: vaults at Vec3 → projected via Viewport → static no-JS SVG
// with <a href> warp-links. The CSS-only conformance floor — navigation works with zero JS.

let private demoVaults : MetaspaceMap.Vault list =
    [ MetaspaceMap.vault (Viewport.vec3 0.0 0.0 0.0) "home" "/vault/home"
      MetaspaceMap.vault (Viewport.vec3 30.0 0.0 0.0) "economy" "/vault/economy"
      MetaspaceMap.vault (Viewport.vec3 0.0 -30.0 0.0) "nursery" "/vault/nursery" ]

[<Fact>]
let ``renders a self-contained no-JS svg`` () =
    let svg = MetaspaceMap.render 400 (Viewport.camera 1.0) demoVaults
    Assert.StartsWith("<svg", svg, System.StringComparison.Ordinal)
    Assert.Contains("</svg>", svg, System.StringComparison.Ordinal)
    // Tier-0 floor: NO script anywhere.
    Assert.DoesNotContain("<script", svg, System.StringComparison.OrdinalIgnoreCase)
    Assert.DoesNotContain("onclick", svg, System.StringComparison.OrdinalIgnoreCase)

[<Fact>]
let ``every on-screen vault is an anchor warp-link to its href`` () =
    let svg = MetaspaceMap.render 400 (Viewport.camera 1.0) demoVaults
    // each vault centered enough to be on-screen → its href appears in an <a>
    Assert.Contains("href=\"/vault/home\"", svg, System.StringComparison.Ordinal)
    Assert.Contains("href=\"/vault/economy\"", svg, System.StringComparison.Ordinal)
    Assert.Contains("href=\"/vault/nursery\"", svg, System.StringComparison.Ordinal)
    // anchor count == vault count (all three on-screen at this zoom)
    let anchors = (svg.Split("<a ").Length) - 1
    Assert.Equal(3, anchors)

[<Fact>]
let ``labels are rendered and escaped`` () =
    let vaults = [ MetaspaceMap.vault (Viewport.vec3 0.0 0.0 0.0) "A & <B>" "/v/x" ]
    let svg = MetaspaceMap.render 200 (Viewport.camera 1.0) vaults
    Assert.Contains("A &amp; &lt;B&gt;", svg, System.StringComparison.Ordinal)
    Assert.DoesNotContain("A & <B>", svg, System.StringComparison.Ordinal)

[<Fact>]
let ``off-screen vaults are culled (no anchor)`` () =
    // place a vault far outside the 200px viewport at zoom 1 (world 99999 → screen ~99999+100)
    let vaults = [ MetaspaceMap.vault (Viewport.vec3 99999.0 0.0 0.0) "faraway" "/v/far" ]
    let svg = MetaspaceMap.render 200 (Viewport.camera 1.0) vaults
    Assert.DoesNotContain("/v/far", svg, System.StringComparison.Ordinal)

[<Property>]
let ``deterministic: same vaults + camera => same svg`` (cxn: int) (czoomn: int) =
    let cam = Viewport.cameraAt (float (cxn % 50)) 0.0 (1.0 + float (abs (czoomn % 8)))
    MetaspaceMap.render 400 cam demoVaults = MetaspaceMap.render 400 cam demoVaults

[<Fact>]
let ``zooming in brings a distant vault on-screen (enter-by-approach)`` () =
    // a vault outside at zoom 1, but a wider camera (smaller zoom) pulls it into view
    let vaults = [ MetaspaceMap.vault (Viewport.vec3 300.0 0.0 0.0) "edge" "/v/edge" ]
    let zoomedOut = MetaspaceMap.render 400 (Viewport.camera 0.1) vaults // 300*0.1=30 → on-screen
    let zoomedIn = MetaspaceMap.render 400 (Viewport.camera 1.0) vaults // 300*1=300 → off (half=200)
    Assert.Contains("/v/edge", zoomedOut, System.StringComparison.Ordinal)
    Assert.DoesNotContain("/v/edge", zoomedIn, System.StringComparison.Ordinal)
