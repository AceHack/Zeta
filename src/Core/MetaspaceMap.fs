namespace Zeta.Core

open System
open System.Globalization

/// **`MetaspaceMap` — the Tier-0 navigable "outside / meta-vault" map (static, no-JS).**
///
/// The CSS-only conformance floor of the metaspace navigation
/// (`docs/research/2026-06-20-metaspace-navigation-physics-engine-2d-viewport-over-3d-clifford-frame-zoom-is-level-traversal.md`):
/// vaults live at 3D-capable world positions (`Viewport.Vec3`), are projected through a `Viewport.Camera`
/// to the 2D screen, and render as a **static SVG whose vault markers are `<a href>` warp-links** — so you
/// can navigate between vaults with **zero JavaScript** (Tier 0). Richer tiers add the live force-directed
/// physics + pan/zoom camera on top of this same projection.
///
/// Pure + deterministic (integer screen coords, `InvariantCulture`, escaped text, no script) ⇒
/// byte-lockable: the same vaults + camera render the same SVG.
[<RequireQualifiedAccess>]
module MetaspaceMap =

    /// A vault as a navigable landmark in the outside: a world position, a label, and the href you warp to
    /// on click (entering the vault = leaving the outside frame; see the design note's enter = frame-change).
    type Vault =
        { Pos: Viewport.Vec3
          Label: string
          Href: string }

    let private si (i: int) : string = i.ToString(CultureInfo.InvariantCulture)

    /// Minimal XML/attribute escaping (text + href). No script, so this is the whole surface.
    let private esc (s: string) : string =
        s
            .Replace("&", "&amp;", StringComparison.Ordinal)
            .Replace("<", "&lt;", StringComparison.Ordinal)
            .Replace(">", "&gt;", StringComparison.Ordinal)
            .Replace("\"", "&quot;", StringComparison.Ordinal)

    /// Make a vault landmark.
    let vault (pos: Viewport.Vec3) (label: string) (href: string) : Vault =
        { Pos = pos; Label = label; Href = href }

    /// Render the outside as a pure, no-JS SVG of `size`×`size` px. Vaults are projected through `cam`
    /// (screen origin = viewport center) and drawn as `<a href>`-wrapped markers — clickable warp-links.
    /// Off-screen vaults (outside the square) are culled. `size` should be positive.
    let render (size: int) (cam: Viewport.Camera) (vaults: Vault list) : string =
        let half = size / 2

        // Project a world point to integer screen pixels with the viewport center at (half, half).
        let toScreen (p: Viewport.Vec3) : int * int =
            let s = Viewport.project cam p
            half + int (round s.Sx), half + int (round s.Sy)

        let onScreen (x: int) (y: int) : bool = x >= 0 && x <= size && y >= 0 && y <= size

        let markers =
            [ for v in vaults do
                  let x, y = toScreen v.Pos
                  if onScreen x y then
                      yield
                          String.Concat(
                              "<a xlink:href=\"", esc v.Href, "\" href=\"", esc v.Href, "\">",
                              "<circle cx=\"", si x, "\" cy=\"", si y,
                              "\" r=\"10\" fill=\"#3399cc\" stroke=\"#ffffff\" stroke-width=\"1\"/>",
                              "<text x=\"", si x, "\" y=\"", si (y + 24),
                              "\" text-anchor=\"middle\" font-family=\"monospace\" font-size=\"12\" fill=\"#cdd6e0\">",
                              esc v.Label, "</text></a>"
                          ) ]
            |> String.concat ""

        String.Concat(
            "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" ",
            "width=\"", si size, "\" height=\"", si size, "\" viewBox=\"0 0 ", si size, " ", si size,
            "\" role=\"img\" aria-label=\"Metaspace — the outside; vaults are warp-links\">",
            "<rect width=\"", si size, "\" height=\"", si size, "\" fill=\"#0e1116\"/>",
            markers,
            "</svg>"
        )
