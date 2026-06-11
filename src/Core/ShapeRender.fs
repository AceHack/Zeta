namespace Zeta.Core

/// ShapeRender — **cartridge → SVG / HTML+CSS, as a BIDIRECTIONAL treaty in a strict dialect**
/// (Aaron 2026-06-12: "a command line to generate SVG or HTML/CSS or both from the cartridge so
/// it's easy to keep in sync — in all oracle languages" / "bidirectional, to and from — but we
/// didn't pick up any of their bad habits").
///
/// The treaty stance: we SPEAK the external formats without inheriting their habits. The emitter
/// produces a STRICT DIALECT of SVG — integers only (no floats anywhere in the bytes), a fixed
/// element vocabulary (polyline/rect/circle), deterministic attribute order, no script, no style
/// soup — and the parser ACCEPTS ONLY that dialect back (anything outside it is a refusal, not a
/// best-effort read). So the round-trip is exact (`fromSvg (toSvg d) = points of d`), the renders
/// are TEXT (byte-lockable golden vectors per the no-binary-in-proof-lineage law — an SVG golden
/// is a diffable treaty surface the other oracle languages conform to first-run), and the
/// cartridge stays the single source: SVG/HTML are pure projections, regenerated, never edited.
///
/// Geometry is read FROM the cartridge constants (the same numbers acceptance gates on) at scale
/// 10 sub-pixels per court cell on the 64×32 court → viewBox 0 0 640 320, all integer.
[<RequireQualifiedAccess>]
module ShapeRender =

    let private scale = 10

    /// One drawable element of the strict dialect: a named polyline with a palette mask.
    type Stroke = { Name: string; Mask: byte; Points: (int * int) list }

    let private pt (x: int) (y: int) = x * scale + scale / 2, y * scale + scale / 2

    /// The ZetaMax Spectrum palette as hex (mask 0..7) — display-edge only; the math never sees it.
    let colorHex (mask: byte) : string =
        match mask &&& 7uy with
        | 0uy -> "#000000" | 1uy -> "#d62828" | 2uy -> "#2a9d2a" | 3uy -> "#d6c828"
        | 4uy -> "#2828d6" | 5uy -> "#d628d6" | 6uy -> "#28c8d6" | _ -> "#f0f0f0"

    /// The strokes a cartridge generates — the SAME constants ShapeAcceptance gates on (sync by
    /// construction: one source, two readers).
    let strokesOf (d: MediaLines.Doc) : Stroke list =
        let shape = MediaLines.field "meta" "name" d |> Option.defaultValue "?"
        let constInt name dflt =
            MediaLines.field "constant" name d |> Option.bind (fun s ->
                match System.Int32.TryParse(s, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture) with
                | true, v -> Some v | _ -> None) |> Option.defaultValue dflt
        match shape with
        | "shape-spiral" ->
            let re, im = BoundaryLight.rotorOf 1 12 (constInt "growth-milli" 1100)
            let curve = BoundaryLight.rotorCurve (BoundaryLight.p 32 16) 6.0 0.0 re im (constInt "steps" 36)
            [ { Name = "curve"; Mask = 6uy; Points = curve |> List.map (fun p -> pt p.X p.Y) } ]
        | "shape-worldline" ->
            let drift = constInt "drift" 1
            let rows = constInt "rows" 28
            [ { Name = "path"; Mask = 2uy; Points = [ for t in 0 .. rows - 1 -> pt (8 + t * drift % 64) (30 - t) ] } ]
        | "shape-lightcone" ->
            let ext = constInt "extent" 14
            let ex, ey = 32, 16
            [ { Name = "future-left"; Mask = 4uy; Points = [ pt ex ey; pt (ex - ext) (ey - ext) ] }
              { Name = "future-right"; Mask = 4uy; Points = [ pt ex ey; pt (ex + ext) (ey - ext) ] }
              { Name = "past-left"; Mask = 1uy; Points = [ pt ex ey; pt (ex - ext) (ey + ext) ] }
              { Name = "past-right"; Mask = 1uy; Points = [ pt ex ey; pt (ex + ext) (ey + ext) ] } ]
        | "shape-fourcorner" ->
            let sMilli = constInt "tsirelson-milli" 2828
            let half = sMilli / 100 / 2 // S in court cells, centered (2828 -> 14 half-width)
            [ { Name = "corners"; Mask = 3uy; Points = [ pt 10 6; pt 54 6; pt 54 26; pt 10 26; pt 10 6 ] }
              { Name = "s-width"; Mask = 6uy; Points = [ pt (32 - half) 16; pt (32 + half) 16 ] } ]
        | "shape-seam" ->
            let pitch = constInt "pitch" 4
            let stitches =
                [ for k in 0 .. (31 / pitch) ->
                      let y = k * pitch
                      // over-under alternation: even stitches cross left-over-right, odd the reverse
                      let pts = if k % 2 = 0 then [ pt 27 y; pt 36 (y + 1) ] else [ pt 36 y; pt 27 (y + 1) ]
                      { Name = sprintf "stitch-%d" k; Mask = 5uy; Points = pts } ]
            { Name = "left-cloth"; Mask = 2uy; Points = [ pt 0 0; pt 27 0; pt 27 31; pt 0 31; pt 0 0 ] }
            :: { Name = "right-cloth"; Mask = 4uy; Points = [ pt 36 0; pt 63 0; pt 63 31; pt 36 31; pt 36 0 ] }
            :: stitches
        | "shape-braid" ->
            // 3 strands at columns 20/32/44; each crossing in the word swaps two strands over 2
            // rows. THE OVER-UNDER REGISTER (the braid's memory, drawn): at every crossing the
            // UNDER strand's diagonal carries an occlusion GAP around the midpoint, so the picture
            // says WHO crossed OVER whom — sigma^2 != identity is visible, not just provable.
            // A gapped strand becomes several polylines (runs), each its own stroke.
            let word =
                MediaLines.field "constant" "word" d
                |> Option.defaultValue "1,2,1"
                |> fun s -> s.Split(',') |> Array.map int |> Array.toList
            let cols = [| 20; 32; 44 |]
            let mutable perm = [| 0; 1; 2 |] // strand index occupying each column slot
            let rows = 12
            let rowsPerCross = rows / (List.length word + 1)
            // per strand: the list of runs; a gap closes the current run and opens the next
            let runs = Array.init 3 (fun _ -> ResizeArray<ResizeArray<int * int>>())
            for slot in 0 .. 2 do
                let r = ResizeArray<int * int>()
                r.Add(pt cols.[slot] 0)
                runs.[perm.[slot]].Add r
            word
            |> List.iteri (fun i c ->
                let y = (i + 1) * rowsPerCross
                let a = abs c - 1
                // positive crossing: the strand in slot a goes OVER; the slot a+1 strand goes UNDER
                // (negative reverses it) — Artin's sign carried into the ink.
                let overSlot, underSlot = (if c > 0 then a, a + 1 else a + 1, a)
                let under = perm.[underSlot]
                let x0, y0 = List.last (List.ofSeq (runs.[under].[runs.[under].Count - 1]))
                let x1, y1 = pt cols.[(if underSlot = a then a + 1 else a)] y
                // occlusion gap: break the under diagonal at 2/5 and 3/5 of its length (integers)
                let cur = runs.[under].[runs.[under].Count - 1]
                cur.Add(x0 + (x1 - x0) * 2 / 5, y0 + (y1 - y0) * 2 / 5)
                let next = ResizeArray<int * int>()
                next.Add(x0 + (x1 - x0) * 3 / 5, y0 + (y1 - y0) * 3 / 5)
                runs.[under].Add next
                let t = perm.[a] in perm.[a] <- perm.[a + 1]; perm.[a + 1] <- t
                ignore overSlot
                for slot in 0 .. 2 do
                    runs.[perm.[slot]].[runs.[perm.[slot]].Count - 1].Add(pt cols.[slot] y))
            for slot in 0 .. 2 do
                runs.[perm.[slot]].[runs.[perm.[slot]].Count - 1].Add(pt cols.[slot] rows)
            [ for s in 0 .. 2 do
                  for r in 0 .. runs.[s].Count - 1 ->
                      { Name = (if r = 0 then sprintf "strand-%d" s else sprintf "strand-%d-r%d" s r)
                        Mask = byte (1 <<< s)
                        Points = List.ofSeq runs.[s].[r] } ]
        | "shape-shadow-loop" ->
            // the lemniscate of Gerono: x = cos t, y = sin t * cos t — sampled so the crossing is
            // EXACT (steps % 4 = 0 puts t = pi/2 and 3pi/2 on the integer center). Floats stay
            // inside the generator; every emitted coordinate is an integer (the dialect law).
            let span = constInt "span" 24
            let steps = constInt "steps" 48
            let cx, cy = pt 32 16
            let loop =
                [ for k in 0 .. steps ->
                      let t = 2.0 * System.Math.PI * float k / float steps
                      cx + int (System.Math.Round(float (span * scale) * cos t)),
                      cy + int (System.Math.Round(float (span * scale / 2) * sin t * cos t)) ]
            [ { Name = "loop"; Mask = 7uy; Points = loop }
              // the catch point: a small diamond on the crossing (the door used twice)
              { Name = "catch"; Mask = 5uy; Points = [ cx, cy - 6; cx + 6, cy; cx, cy + 6; cx - 6, cy; cx, cy - 6 ] } ]
        | "shape-buckyball" ->
            // Addison's two views, schematic and honest: INSIDE reads like a soccer ball (central
            // pentagon room, hexagon ring, a bounding circle); OUTSIDE is almost the same drawing
            // except the boundary is gone and the edge lines run to the bounds ("to infinity or
            // the bounds"). The meta-debug room sits at the inside view's center: a door line to
            // each visible room and a small SELF-LOOP ("and itself."). Floats live only inside the
            // generator (cos/sin); every emitted coordinate is an integer (the dialect law).
            let ring (cx: int) (cy: int) (r: int) (n: int) (rot: float) =
                [ for k in 0 .. n ->
                      let a = rot + 2.0 * System.Math.PI * float k / float n
                      cx * scale + scale / 2 + int (System.Math.Round(float (r * scale) * cos a)),
                      cy * scale + scale / 2 + int (System.Math.Round(float (r * scale) * sin a)) ]
            let half = -System.Math.PI / 2.0
            let insidePent = ring 16 16 5 5 half
            let insideBound = ring 16 16 14 24 half
            let outsidePent = ring 48 16 5 5 half
            let doorTargets = ring 16 16 11 5 (half + System.Math.PI / 5.0) |> List.take 5
            let center = pt 16 16
            let doors =
                doorTargets
                |> List.mapi (fun i tgt -> { Name = sprintf "door-%d" i; Mask = 3uy; Points = [ center; tgt ] })
            let rays =
                ring 48 16 5 5 half
                |> List.take 5
                |> List.mapi (fun i (vx, vy) ->
                    let cx, cy = pt 48 16
                    // extend the pentagon vertex direction to the court bounds (the "infinity" leg)
                    let dx, dy = vx - cx, vy - cy
                    { Name = sprintf "ray-%d" i; Mask = 7uy; Points = [ (vx, vy); (cx + dx * 4, cy + dy * 4) ] })
            [ { Name = "inside-room"; Mask = 6uy; Points = insidePent }
              { Name = "inside-bound"; Mask = 4uy; Points = insideBound }
              yield! doors
              { Name = "self-door"; Mask = 5uy; Points = [ center; pt 17 15; pt 17 17; center ] }
              { Name = "outside-room"; Mask = 6uy; Points = outsidePent }
              yield! rays ]
        | _ -> []

    let private pointsAttr (pts: (int * int) list) =
        pts |> List.map (fun (x, y) -> sprintf "%d,%d" x y) |> String.concat " "

    /// The strict-dialect SVG: integers only, fixed attribute order, polylines only, no script.
    let toSvg (d: MediaLines.Doc) : string =
        let body =
            strokesOf d
            |> List.map (fun s ->
                sprintf "  <polyline id=\"%s\" fill=\"none\" stroke=\"%s\" stroke-width=\"4\" points=\"%s\" />"
                    s.Name (colorHex s.Mask) (pointsAttr s.Points))
            |> String.concat "\n"
        let name = MediaLines.field "meta" "name" d |> Option.defaultValue "shape"
        sprintf "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 640 320\" data-cartridge=\"%s\">\n%s\n</svg>\n" name body

    /// The HTML+CSS projection: the SVG inline in a dark court, palette as CSS custom properties,
    /// NO JavaScript ever (the HtmlCssBinding law) — pure static, kid-viewable, diffable.
    let toHtml (d: MediaLines.Doc) : string =
        let name = MediaLines.field "meta" "name" d |> Option.defaultValue "shape"
        let vars = [ for m in 0uy .. 7uy -> sprintf "      --c%d: %s;" m (colorHex m) ] |> String.concat "\n"
        sprintf "<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\" />\n  <title>%s</title>\n  <style>\n    :root {\n%s\n    }\n    body { background: #101418; margin: 0; display: grid; place-items: center; min-height: 100vh; }\n    svg { width: min(96vw, 960px); image-rendering: pixelated; }\n  </style>\n</head>\n<body>\n%s</body>\n</html>\n" name vars (toSvg d)

    /// READ BACK the strict dialect (the bidirectional half) — refuses anything outside it:
    /// script, floats in points, foreign elements. We read their format; we do not import its habits.
    let fromSvg (svg: string) : Result<(string * (int * int) list) list, string> =
        if svg.Contains "<script" then Error "refused: script is not in the treaty dialect"
        elif svg.Contains "<svg" |> not then Error "refused: not an svg document"
        else
            let lines = svg.Replace("\r\n", "\n").Split('\n')
            let mutable err = None
            let parsed =
                [ for l in lines do
                      let t = l.Trim()
                      if t.StartsWith "<polyline" then
                          let attr (name: string) =
                              let key = name + "=\""
                              match t.IndexOf key with
                              | -1 -> None
                              | i ->
                                  let s = i + key.Length
                                  match t.IndexOf('"', s) with
                                  | -1 -> None
                                  | e -> Some(t.Substring(s, e - s))
                          match attr "id", attr "points" with
                          | Some id, Some pts when not (pts.Contains ".") ->
                              yield
                                  id,
                                  [ for p in pts.Split(' ') do
                                        match p.Split(',') with
                                        | [| x; y |] -> yield int x, int y
                                        | _ -> err <- Some "refused: malformed point" ]
                          | _, Some pts when pts.Contains "." ->
                              err <- Some "refused: float coordinates are not in the treaty dialect"
                          | _ -> err <- Some "refused: polyline missing id/points"
                      elif t.StartsWith "<" && not (t.StartsWith "<svg") && not (t.StartsWith "</svg") && t.Length > 1 then
                          err <- Some(sprintf "refused: foreign element outside the dialect: %s" (t.Substring(0, min 24 t.Length))) ]
            match err with
            | Some e -> Error e
            | None -> Ok parsed
