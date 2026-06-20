namespace Zeta.Core

open System
open System.Globalization

/// **`CoEmpowerGraphSvg` — a deterministic SVG render of the `CoEmpowerGraph` (Aaron 2026-06-19, shadow\*).**
///
/// `CoEmpowerField` (the grid) had `renderField`; the graph generalization had no viz. This fills it: a
/// **circular-layout** render — nodes evenly on a circle (colored by identity; **Creators ringed**, Audiences
/// plain), undirected edges as lines — so the demo can *show the federations*, not just the dials. Pure, **no
/// script**, **integer coordinates** ⇒ deterministic + byte-lockable (same graph ⇒ same SVG). Feeds the demo
/// UX/UI alongside `SocietalDoraSvg` and `CoEmpowerField.renderField`.
[<RequireQualifiedAccess>]
module CoEmpowerGraphSvg =

    let private si (i: int) : string = i.ToString(CultureInfo.InvariantCulture)

    let private palette =
        [| "#222831"; "#3399cc"; "#e0563f"; "#54b894"; "#d9a441"; "#9b6bd6"; "#cc6699"; "#5fa8d3" |]

    /// Render the graph as pure SVG (circular layout). `size` = the square viewport edge in px.
    let render (size: int) (g: CoEmpowerGraph.Graph) : string =
        let cx, cy = size / 2, size / 2
        let r = max 1 (size / 2 - 24)
        let n = max 1 g.N

        let pos (i: int) : int * int =
            let theta = 2.0 * Math.PI * float i / float n
            cx + int (round (float r * cos theta)), cy + int (round (float r * sin theta))

        let edges =
            [ for i in 0 .. g.N - 1 do
                  for j in g.Adjacency.[i] do
                      if j > i then
                          let x1, y1 = pos i
                          let x2, y2 = pos j

                          yield
                              String.Concat(
                                  "<line x1=\"", si x1, "\" y1=\"", si y1, "\" x2=\"", si x2, "\" y2=\"", si y2,
                                  "\" stroke=\"#888\" stroke-width=\"1\"/>"
                              ) ]
            |> String.concat ""

        let nodes =
            [ for i in 0 .. g.N - 1 do
                  let x, y = pos i
                  let fill = palette.[g.Identity.[i] % palette.Length]

                  let radius, ring =
                      match g.Role.[i] with
                      | CoEmpowerGraph.Creator ->
                          9,
                          String.Concat(
                              "<circle cx=\"", si x, "\" cy=\"", si y, "\" r=\"", si 12,
                              "\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"1\"/>"
                          )
                      | CoEmpowerGraph.Audience -> 5, ""

                  yield
                      String.Concat(ring, "<circle cx=\"", si x, "\" cy=\"", si y, "\" r=\"", si radius, "\" fill=\"", fill, "\"/>") ]
            |> String.concat ""

        String.Concat(
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ", si size, " ", si size, "\" width=\"", si size,
            "\" height=\"", si size, "\">", edges, nodes, "</svg>"
        )
