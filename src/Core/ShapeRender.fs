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

    /// Escape cartridge-supplied text for the XML/HTML sinks (Kira round-2 P0: an unescaped meta
    /// name could put live JS inside the "no JavaScript ever" HTML — the emitter violated its own
    /// dialect). Every interpolation of cartridge text goes through THIS.
    let escapeXml (s: string) : string =
        s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;")

    /// One drawable element of the strict dialect: a named polyline with a palette mask.
    /// `Dash = true` renders dashed (the adinkra's retraction register — a MINUS sign as ink);
    /// dashes are TEXT in the dialect (stroke-dasharray "8 6", exact), so goldens stay diffable.
    type Stroke = { Name: string; Mask: byte; Dash: bool; Points: (int * int) list }

    let private pt (x: int) (y: int) = x * scale + scale / 2, y * scale + scale / 2

    /// The ZetaMax Spectrum palette as hex (mask 0..7) — display-edge only; the math never sees it.
    let colorHex (mask: byte) : string =
        match mask &&& 7uy with
        | 0uy -> "#000000" | 1uy -> "#d62828" | 2uy -> "#2a9d2a" | 3uy -> "#d6c828"
        | 4uy -> "#2828d6" | 5uy -> "#d628d6" | 6uy -> "#28c8d6" | _ -> "#f0f0f0"

    /// shape-sybil-verdict — the probe streams, threshold, and verdict that BOTH the render draws
    /// and the gate checks (one source, two readers; drawn = gated by the same computation).
    /// Claims 0 and 1 are CONDUCTED from one cause: claim 1's outcomes read claim 0's settings —
    /// the PR-box rule, phased to the CHSH minus term, S = 4 exactly. Claim 2 is independent:
    /// its settings AND outcomes come from its own seed only. Deterministic LCG — DST §7.
    let sybilProbesOf (d: MediaLines.Doc) =
        let constInt name dflt = MediaLines.constIntOr name dflt d
        let rounds = constInt "rounds" 256
        let seedA = constInt "seed-conductor-a" 149
        let seedB = constInt "seed-conductor-b" 151
        let seedC = constInt "seed-independent" 157
        let threshold = float (constInt "threshold-milli" 2000) / 1000.0
        let bits (seed: int) =
            let mutable s = uint64 seed * 2862933555777941757UL + 3037000493UL
            [ for _ in 1 .. rounds ->
                  s <- s * 6364136223846793005UL + 1442695040888963407UL
                  int ((s >>> 33) &&& 1UL) ]
        let sa = bits seedA
        let sb = bits seedB
        let round s o : AntiSybil.ChshRound = { Setting = s; Outcome = o }
        let a = sa |> List.map (fun s -> round s 1)
        let b =
            List.zip sa sb
            |> List.map (fun (xa, xb) -> round xb (if xa = 0 && xb = 1 then -1 else 1))
        let c =
            List.zip (bits seedC) (bits (seedC * 7 + 1))
            |> List.map (fun (s, o) -> round s (if o = 1 then 1 else -1))
        a, b, c, threshold, AntiSybil.chshSybil threshold [ a; b; c ]

    /// The strokes a cartridge generates — the SAME constants ShapeAcceptance gates on (sync by
    /// construction: one source, two readers).
    let strokesOf (d: MediaLines.Doc) : Stroke list =
        let shape = MediaLines.field "meta" "name" d |> Option.defaultValue "?"
        let constInt name dflt = MediaLines.constIntOr name dflt d // the ONE reader (Kira #5)
        match shape with
        | "shape-spiral" ->
            let re, im = BoundaryLight.rotorOf 1 12 (constInt "growth-milli" 1100)
            let curve = BoundaryLight.rotorCurve (BoundaryLight.p 32 16) 6.0 0.0 re im (constInt "steps" 36)
            [ { Dash = false; Name = "curve"; Mask = 6uy; Points = curve |> List.map (fun p -> pt p.X p.Y) } ]
        | "shape-worldline" ->
            let drift = constInt "drift" 1
            let rows = constInt "rows" 28
            [ { Dash = false; Name = "path"; Mask = 2uy; Points = [ for t in 0 .. rows - 1 -> pt (8 + t * drift % 64) (30 - t) ] } ]
        | "shape-lightcone" ->
            let ext = constInt "extent" 14
            let ex, ey = 32, 16
            [ { Dash = false; Name = "future-left"; Mask = 4uy; Points = [ pt ex ey; pt (ex - ext) (ey - ext) ] }
              { Dash = false; Name = "future-right"; Mask = 4uy; Points = [ pt ex ey; pt (ex + ext) (ey - ext) ] }
              { Dash = false; Name = "past-left"; Mask = 1uy; Points = [ pt ex ey; pt (ex - ext) (ey + ext) ] }
              { Dash = false; Name = "past-right"; Mask = 1uy; Points = [ pt ex ey; pt (ex + ext) (ey + ext) ] } ]
        | "shape-fourcorner" ->
            let sMilli = constInt "tsirelson-milli" 2828
            let half = sMilli / 100 / 2 // S in court cells, centered (2828 -> 14 half-width)
            [ { Dash = false; Name = "corners"; Mask = 3uy; Points = [ pt 10 6; pt 54 6; pt 54 26; pt 10 26; pt 10 6 ] }
              { Dash = false; Name = "s-width"; Mask = 6uy; Points = [ pt (32 - half) 16; pt (32 + half) 16 ] } ]
        | "shape-seam" ->
            let pitch = constInt "pitch" 4
            let stitches =
                [ for k in 0 .. (31 / pitch) ->
                      let y = k * pitch
                      // over-under alternation: even stitches cross left-over-right, odd the reverse
                      let pts = if k % 2 = 0 then [ pt 27 y; pt 36 (y + 1) ] else [ pt 36 y; pt 27 (y + 1) ]
                      { Dash = false; Name = sprintf "stitch-%d" k; Mask = 5uy; Points = pts } ]
            { Dash = false; Name = "left-cloth"; Mask = 2uy; Points = [ pt 0 0; pt 27 0; pt 27 31; pt 0 31; pt 0 0 ] }
            :: { Dash = false; Name = "right-cloth"; Mask = 4uy; Points = [ pt 36 0; pt 63 0; pt 63 31; pt 36 31; pt 36 0 ] }
            :: stitches
        | "shape-braid"
        | "shape-plait-move" ->
            // 3 strands at columns 20/32/44; each crossing in the word swaps two strands over 2
            // rows. THE OVER-UNDER REGISTER (the braid's memory, drawn): at every crossing the
            // UNDER strand's diagonal carries an occlusion GAP around the midpoint, so the picture
            // says WHO crossed OVER whom — sigma^2 != identity is visible, not just provable.
            // A gapped strand becomes several polylines (runs), each its own stroke.
            let word =
                MediaLines.field "constant" "word" d
                |> Option.defaultValue "1,2,1"
                |> fun s ->
                    s.Split(',')
                    |> Array.choose (fun x ->
                        match System.Int32.TryParse(x.Trim(), System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture) with
                        | true, v -> Some v
                        | _ -> None)
                    |> Array.toList
            // drawn-vs-gated parity (Kira round-2 #4): the renderer guards like the gate — an
            // invalid word draws NOTHING instead of crashing on perm indexing (the wired gate
            // refuses such a cartridge before render anyway).
            if not (Braid.validWord 3 word) then [] else
            let cols = [| 20; 32; 44 |]
            let mutable perm = [| 0; 1; 2 |] // strand index occupying each column slot
            let rows = constInt "rows" 21
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
                      { Dash = false; Name = (if r = 0 then sprintf "strand-%d" s else sprintf "strand-%d-r%d" s r)
                        Mask = byte (1 <<< s)
                        Points = List.ofSeq runs.[s].[r] } ]
        | "shape-gc" ->
            // RAY-TRACED REACHABILITY: pointers drawn blue; what the rays light is green (mark);
            // what stays dark is garbage — drawn DASHED red (condemned; the dash is the register
            // of uncertainty-about-staying, as in softvalue's tails).
            let gcPos =
                [| 6, 8; 6, 24; 18, 8; 18, 24; 30, 8; 30, 24; 42, 16; 54, 16; 50, 4; 58, 4; 50, 28; 58, 28 |]
            let refs =
                MediaLines.ofKind "gen" d
                |> List.tryHead
                |> Option.bind (fun e -> e.Fields |> List.tryLast)
                |> Option.defaultValue ""
                |> fun s -> s.Replace("refs:", "")
                |> fun s ->
                    s.Split(',')
                    |> Array.choose (fun pr ->
                        match pr.Split('>') with
                        | [| a; b |] -> Some(int a, int b)
                        | _ -> None)
                    |> Array.toList
            let reached =
                let mutable r = Set.ofList [ 0; 1 ]
                let mutable changed = true
                while changed do
                    changed <- false
                    for (a, b) in refs do
                        if Set.contains a r && not (Set.contains b r) then
                            r <- Set.add b r
                            changed <- true
                r
            let cell i =
                let x, y = gcPos.[i]
                [ x - 2, y - 2; x + 2, y - 2; x + 2, y + 2; x - 2, y + 2; x - 2, y - 2 ]
            [ // the pointers (one stroke per edge, blue): a ray follows these forward from roots
              for (a, b) in refs do
                  let ax, ay = gcPos.[a]
                  let bx, by = gcPos.[b]
                  yield { Dash = false; Name = sprintf "ref-%d-%d" a b; Mask = 4uy; Points = [ ax, ay; bx, by ] }
              // the mark: every reached object lit green
              for i in 0 .. gcPos.Length - 1 do
                  if Set.contains i reached then
                      yield { Dash = false; Name = sprintf "live-%d" i; Mask = 2uy; Points = cell i }
              // the garbage: never lit — dashed red, condemned (incl. THE ISLAND 8⇄9)
              for i in 0 .. gcPos.Length - 1 do
                  if not (Set.contains i reached) then
                      yield { Dash = true; Name = sprintf "garbage-%d" i; Mask = 1uy; Points = cell i } ]
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
            [ { Dash = false; Name = "loop"; Mask = 7uy; Points = loop }
              // the catch point: a small diamond on the crossing (the door used twice)
              { Dash = false; Name = "catch"; Mask = 5uy; Points = [ cx, cy - 6; cx + 6, cy; cx, cy + 6; cx - 6, cy; cx, cy - 6 ] } ]
        | "shape-exchange-worldlines" ->
            // the anyon picture: the braid's strands drawn as worldlines with TIME RUNNING UP
            // (y = rows − braid-row), each crossing marked by a small causal diamond at the
            // exchange event (slope 1/1 — the lightcone's constant, worn locally). Same word, same
            // runs, same occlusion gaps as shape-braid — one object, the spacetime register.
            let word =
                MediaLines.field "constant" "word" d
                |> Option.defaultValue "1,-2,1,-2,1,-2"
                |> fun s ->
                    s.Split(',')
                    |> Array.choose (fun x ->
                        match System.Int32.TryParse(x.Trim(), System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture) with
                        | true, v -> Some v
                        | _ -> None)
                    |> Array.toList
            if not (Braid.validWord 3 word) then [] else
            let rows = constInt "rows" 21
            let gap = constInt "strand-gap" 3 // causality-bounded: see the cartridge constant's WHY
            let cols = [| 32 - gap; 32; 32 + gap |]
            let flip (x: int, y: int) = x, (rows * scale + scale) - y // time runs UP
            let mutable perm = [| 0; 1; 2 |]
            let rowsPerCross = rows / (List.length word + 1)
            let runs = Array.init 3 (fun _ -> ResizeArray<ResizeArray<int * int>>())
            for slot in 0 .. 2 do
                let r = ResizeArray<int * int>()
                r.Add(flip (pt cols.[slot] 0))
                runs.[perm.[slot]].Add r
            let events = ResizeArray<int * int>()
            word
            |> List.iteri (fun i c ->
                let y = (i + 1) * rowsPerCross
                let a = abs c - 1
                let under = perm.[if c > 0 then a + 1 else a]
                let x0, y0 = List.last (List.ofSeq (runs.[under].[runs.[under].Count - 1]))
                let x1, y1 = flip (pt cols.[(if perm.[if c > 0 then a + 1 else a] = perm.[a] then a + 1 else a)] y)
                // event diamond center: midpoint of the swapped columns at this row
                events.Add(((cols.[a] + cols.[a + 1]) / 2) * scale + scale / 2, (flip (pt 0 y)) |> snd)
                let cur = runs.[under].[runs.[under].Count - 1]
                cur.Add(x0 + (x1 - x0) * 2 / 5, y0 + (y1 - y0) * 2 / 5)
                let next = ResizeArray<int * int>()
                next.Add(x0 + (x1 - x0) * 3 / 5, y0 + (y1 - y0) * 3 / 5)
                runs.[under].Add next
                let t' = perm.[a] in perm.[a] <- perm.[a + 1]; perm.[a + 1] <- t'
                for slot in 0 .. 2 do
                    runs.[perm.[slot]].[runs.[perm.[slot]].Count - 1].Add(flip (pt cols.[slot] y)))
            for slot in 0 .. 2 do
                runs.[perm.[slot]].[runs.[perm.[slot]].Count - 1].Add(flip (pt cols.[slot] rows))
            [ for s in 0 .. 2 do
                  for r in 0 .. runs.[s].Count - 1 ->
                      { Dash = false
                        Name = (if r = 0 then sprintf "worldline-%d" s else sprintf "worldline-%d-r%d" s r)
                        Mask = byte (1 <<< s)
                        Points = List.ofSeq runs.[s].[r] }
              for i in 0 .. events.Count - 1 ->
                  let ex, ey = events.[i]
                  let r = 8 // the event diamond: slope-1 edges (a tiny lightcone, worn locally)
                  { Dash = true
                    Name = sprintf "event-%d" i
                    Mask = 7uy
                    Points = [ ex, ey - r; ex + r, ey; ex, ey + r; ex - r, ey; ex, ey - r ] } ]
        | "shape-symmetric-vs-braided" ->
            // THE CONTRAST: ONE word, read TWICE. The word is parsed ONCE and handed to both
            // panels — a panel carrying its own word would prove nothing (the cartridge's
            // stroke-generator issue says exactly that), so the two calls below differ in EXACTLY
            // one argument: `gapped`. The braided reading carries an occlusion gap at every
            // crossing (who went over whom is in the ink — shape-braid's over-under register); the
            // symmetric reading carries NONE, because a symmetric swap has no over/under to
            // remember, and a gap drawn there would be the picture lying about the category.
            // Same input, same geometry, different REGISTER — and the register IS the category.
            let word =
                MediaLines.field "constant" "word" d
                |> Option.defaultValue "1,1"
                |> fun s ->
                    s.Split(',')
                    |> Array.choose (fun x ->
                        match System.Int32.TryParse(x.Trim(), System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture) with
                        | true, v -> Some v
                        | _ -> None)
                    |> Array.toList
            let strands = constInt "strands" 2
            let panels = constInt "panels" 2
            let rows = constInt "rows" 24
            // drawn-vs-gated parity (the braid family's guard): an out-of-range cartridge draws
            // NOTHING rather than crashing on perm indexing — the gate refuses it either way.
            if strands < 2 || panels < 2 || rows < List.length word + 1 || not (Braid.validWord strands word) then [] else
            let top = 4
            let bayW = 64 / panels
            // columns are DERIVED from the file's own declared constants (panels, strands) — there
            // are no bare positions here to go stale behind a constant change (shape-braid's
            // stale-gen-args lesson, applied to the layout itself).
            let colsOf (panel: int) = Array.init strands (fun i -> panel * bayW + bayW * (i + 1) / (strands + 1))
            let rowsPerCross = rows / (List.length word + 1)
            let strandMask = [| 1uy; 4uy; 2uy |] // the atom's own palette (shape-crossing: red over/under blue)
            let panelStrokes (panel: int) (gapped: bool) (tag: string) =
                let cols = colsOf panel
                let perm = Array.init strands id // strand index occupying each column slot
                let runs = Array.init strands (fun _ -> ResizeArray<ResizeArray<int * int>>())
                for slot in 0 .. strands - 1 do
                    let r = ResizeArray<int * int>()
                    r.Add(pt cols.[slot] top)
                    runs.[perm.[slot]].Add r
                word
                |> List.iteri (fun i c ->
                    let y = top + (i + 1) * rowsPerCross
                    let a = abs c - 1
                    // Artin's sign decides who goes under; in the SYMMETRIC panel nobody does,
                    // because there is no under to be — the swap keeps no record of the passage.
                    let underSlot = if c > 0 then a + 1 else a
                    let under = perm.[underSlot]
                    if gapped then
                        let x0, y0 = List.last (List.ofSeq runs.[under].[runs.[under].Count - 1])
                        let x1, y1 = pt cols.[(if underSlot = a then a + 1 else a)] y
                        // occlusion gap: break the under diagonal at 2/5 and 3/5 of its length
                        let cur = runs.[under].[runs.[under].Count - 1]
                        cur.Add(x0 + (x1 - x0) * 2 / 5, y0 + (y1 - y0) * 2 / 5)
                        let next = ResizeArray<int * int>()
                        next.Add(x0 + (x1 - x0) * 3 / 5, y0 + (y1 - y0) * 3 / 5)
                        runs.[under].Add next
                    let t = perm.[a] in perm.[a] <- perm.[a + 1]; perm.[a + 1] <- t
                    for slot in 0 .. strands - 1 do
                        runs.[perm.[slot]].[runs.[perm.[slot]].Count - 1].Add(pt cols.[slot] y))
                for slot in 0 .. strands - 1 do
                    runs.[perm.[slot]].[runs.[perm.[slot]].Count - 1].Add(pt cols.[slot] (top + rows))
                [ for s in 0 .. strands - 1 do
                      for r in 0 .. runs.[s].Count - 1 ->
                          { Dash = false
                            Name = (if r = 0 then sprintf "%s-strand-%d" tag s else sprintf "%s-strand-%d-r%d" tag s r)
                            Mask = strandMask.[s % 3]
                            Points = List.ofSeq runs.[s].[r] } ]
            // LEFT = the symmetric reading (no register), RIGHT = the braided one (every crossing
            // remembered). Both from `word`, which is bound once, above.
            panelStrokes 0 false "sym" @ panelStrokes 1 true "brd"
        | "shape-traced" ->
            // THE TRACE (Joyal-Street-Verity 1996), drawn so it CANNOT be read as a braid: a wire
            // leaves the generator's output-feedback port, routes AROUND the box, and re-enters the
            // input-feedback port. It passes over nothing. A bend is not a crossing — that refusal is
            // the whole cartridge, so this branch draws exactly two wires and the gate counts the
            // intersections between them (`ShapeAcceptance`, "shape-traced").
            //
            // TWO REGISTERS THAT LOOK ALIKE AND ARE NOT, kept apart on purpose:
            //   * an OCCLUSION GAP is a wire BROKEN into runs (shape-braid's over-under memory).
            //     There is none here: each wire is one unbroken polyline, so runs = wires.
            //   * a DASH is the SIGN (the adinkra/gc convention in this module — a minus as ink).
            //     The feedback wire is dashed because its weight is -1 (WSet.negate: the superseded
            //     row is un-emitted, and +w/-w annihilate in consolidate). Dashing is not occlusion.
            //
            // NO TIME AXIS, per the cartridge's retrocausality-register issue: the return leg bends
            // in SPACE, around and below the box. Nothing here runs backwards along a time axis,
            // because there is no time axis to run backwards along — the history is immutable and
            // only its READING moves.
            let wires = constInt "wires" 2
            let corners = constInt "corners" 4
            let retractWeight = constInt "retract-weight" -1
            // out of this figure's vocabulary ⇒ draw NOTHING (the drawn-vs-gated parity the braid
            // family established: a cartridge the gate would refuse must not half-draw either).
            if wires <> 2 || corners <> 4 || corners % 2 <> 0 then [] else
            let boxL, boxR, boxTop, boxBot = 22, 42, 10, 22
            // the ports are DERIVED from the declared corner count: `corners` corners over two sides
            // is corners/2 channels, spread evenly down the box face. corners = 4 ⇒ the main channel
            // and the feedback channel, and nothing bare to go stale behind a constant change.
            let perSide = corners / 2
            let channelY i = boxTop + (boxBot - boxTop) * (i + 1) / (perSide + 1)
            let mainY, feedbackY = channelY 0, channelY (perSide - 1)
            let diamond (x: int) (y: int) (name: string) (mask: byte) =
                let cx, cy = pt x y
                { Dash = false; Name = name; Mask = mask
                  Points = [ cx, cy - 5; cx + 5, cy; cx, cy + 5; cx - 5, cy; cx, cy - 5 ] }
            [ // the generator box — a MORPHISM, not a wire: the gate counts crossings between wires
              // only, because a wire meeting a box is a PORT and a wire meeting a wire is a crossing.
              { Dash = false; Name = "box"; Mask = 6uy
                Points = [ pt boxL boxTop; pt boxR boxTop; pt boxR boxBot; pt boxL boxBot; pt boxL boxTop ] }
              // wire 1 — the pass-through channel: in at TIn, out at TOut. The emission, weight +1.
              { Dash = false; Name = "wire-through"; Mask = 2uy; Points = [ pt 2 mainY; pt 62 mainY ] }
              // wire 2 — THE TRACE: out of TOutFeedback, around the box, back into TInFeedback. One
              // unbroken polyline (no runs ⇒ no occlusion gaps) whose every turn is a right angle in
              // SPACE. Dashed iff its declared weight is negative — the sign, read from the file.
              { Dash = retractWeight < 0; Name = "wire-feedback"; Mask = 1uy
                Points =
                  [ pt boxR feedbackY
                    pt (boxR + 8) feedbackY
                    pt (boxR + 8) (boxBot + 6)
                    pt (boxL - 8) (boxBot + 6)
                    pt (boxL - 8) feedbackY
                    pt boxL feedbackY ] }
              // the four corners of FourCornerOwnership. TIn/TOut carry the standard channel;
              // TInFeedback/TOutFeedback are the CO-OWNED pair the loop lands on — marked apart,
              // because "the feedback arrives on the INPUT channel" is the cartridge's honest
              // mechanism and a figure that lands the loop on TOut has drawn a pipeline instead.
              diamond boxL mainY "corner-tin" 3uy
              diamond boxR mainY "corner-tout" 3uy
              diamond boxL feedbackY "corner-tinfeedback" 5uy
              diamond boxR feedbackY "corner-toutfeedback" 5uy ]
        | "shape-crossing" ->
            // THE ATOM: two strands, one crossing. Drawn big and alone — the whole figure is the
            // lesson (over keeps its line; under carries the gap; the sign decides which).
            let c = MediaLines.field "constant" "word" d |> Option.bind (fun s -> match System.Int32.TryParse s with | true, v -> Some v | _ -> None) |> Option.defaultValue 1
            let xL, xR = 24, 40
            let top, bot = 6, 26
            let overLeft = c > 0 // positive: the LEFT strand crosses over
            let diag (x0: int) (y0: int) (x1: int) (y1: int) (gapped: bool) (name: string) (mask: byte) =
                let p0, p1 = pt x0 y0, pt x1 y1
                if not gapped then
                    [ { Dash = false; Name = name; Mask = mask; Points = [ p0; p1 ] } ]
                else
                    let (ax, ay), (bx, by) = p0, p1
                    [ { Dash = false; Name = name; Mask = mask; Points = [ p0; (ax + (bx - ax) * 2 / 5, ay + (by - ay) * 2 / 5) ] }
                      { Dash = false; Name = name + "-r1"; Mask = mask; Points = [ (ax + (bx - ax) * 3 / 5, ay + (by - ay) * 3 / 5); p1 ] } ]
            diag xL top xR bot (not overLeft) "strand-0" 1uy
            @ diag xR top xL bot overLeft "strand-1" 4uy
        | "shape-triboolean" ->
            // two panels, one generator: LEFT = partial budget (dash = Unknown, the unearned
            // claim), RIGHT = full budget (zero Unknown — the third state gone structurally).
            // DRAWN = GATED: same sampleProgressive call as the acceptance law.
            let grid = constInt "grid" 8
            let partial = constInt "budget-partial" 20
            let full = constInt "budget-full" 64
            let curve = [ BoundaryLight.p 1 1; BoundaryLight.p (grid * 2 - 2) (grid * 2 - 2) ] // a diagonal glow source
            let panel (x0: int) (budget: int) (tag: string) =
                BoundaryLight.sampleProgressive BoundaryLight.MiddleOut budget 3.0 0.4 grid grid 2 curve
                |> Map.toList
                |> List.collect (fun ((gx, gy), tri) ->
                    let cx, cy = x0 + gx * 3, 6 + gy * 3
                    match tri with
                    | BoundaryLight.Lit -> [ { Dash = false; Name = sprintf "%s-lit-%d-%d" tag gx gy; Mask = 2uy; Points = [ pt cx cy; pt (cx + 1) cy ] } ]
                    | BoundaryLight.Unlit -> [ { Dash = false; Name = sprintf "%s-unlit-%d-%d" tag gx gy; Mask = 1uy; Points = [ pt cx cy; pt cx cy ] } ]
                    | BoundaryLight.Unknown -> [ { Dash = true; Name = sprintf "%s-unk-%d-%d" tag gx gy; Mask = 4uy; Points = [ pt cx cy; pt (cx + 1) cy ] } ])
            panel 4 partial "partial" @ panel 36 full "full"
        | "shape-softvalue" ->
            // the ladder: three panels, one value. A value bar per rung; a confidence bar where
            // the rung HAS a channel (rung 1 = none — absent, not zero); the dashed tail is the
            // uncertainty the rung admits. Coarse (rung 2) is visibly shorter than fine (rung 3).
            let barCells = constInt "bar-cells" 40
            let valueLen = constInt "value-len" 28
            let confLen = constInt "conf-len" 34
            let levels = constInt "rung2-levels" 4
            let quantized = constInt "rung2-quantized" 3
            let coarseLen = quantized * barCells / levels
            let x0 = 8
            let bar (name: string) (y: int) (len: int) (mask: byte) (dash: bool) =
                { Dash = dash; Name = name; Mask = mask; Points = [ pt x0 y; pt (x0 + len) y ] }
            [ // rung 1 — CHIP-8 mono: the value ONLY (no confidence bar exists at this rung)
              bar "r1-value" 5 valueLen 1uy false
              // rung 2 — CHIP-9 planes: value + COARSE confidence (solid to the quantized level, dashed tail = uncertainty)
              bar "r2-value" 13 valueLen 2uy false
              bar "r2-conf" 15 coarseLen 2uy false
              { Dash = true; Name = "r2-uncertainty"; Mask = 2uy; Points = [ pt (x0 + coarseLen) 15; pt (x0 + barCells) 15 ] }
              // rung 3 — deep pixel: value + FINE confidence + its (smaller) dashed tail
              bar "r3-value" 23 valueLen 6uy false
              bar "r3-conf" 25 confLen 6uy false
              { Dash = true; Name = "r3-uncertainty"; Mask = 6uy; Points = [ pt (x0 + confLen) 25; pt (x0 + barCells) 25 ] } ]
        | "shape-dynamicvalue" ->
            // DRAWN = GATED: the same LayoutEngine.treemap call the acceptance law verifies.
            let wa = constInt "weight-a" 5
            let wb = constInt "weight-b" 3
            let wc = constInt "weight-c" 2
            let court = constInt "court-cells" 60
            // treemap(x=2, y=8, w=court, h=16, horizontal) — outlines below inset 1 cell at shared edges (no double-draw); the LAW gates true contiguity
            let tiles = LayoutEngine.treemap 2 8 court 16 true [ "a", wa; "b", wb; "c", wc ]
            tiles
            |> List.mapi (fun i r ->
                { Dash = false
                  Name = sprintf "tile-%s" r.Name
                  Mask = byte (1 <<< i)
                  Points = [ pt r.X r.Y; pt (r.X + r.W - 1) r.Y; pt (r.X + r.W - 1) (r.Y + r.H - 1); pt r.X (r.Y + r.H - 1); pt r.X r.Y ] })
        | "shape-kitaev-chain" ->
            // two panels of the same chain: TOP = trivial (intra-site pairing — tidy, unprotected),
            // BOTTOM = topological (inter-site pairing — two END MODES left unpaired: the memory,
            // drawn bright). A site is two Majorana-mode dots (left/right); a pairing is a chevron
            // arc joining two dots; the unpaired end modes get small bright diamonds.
            let sites = constInt "sites" 8
            let dotX site mode = 6 + site * 7 + mode * 3 // mode 0 = left, 1 = right (court cells)
            let modeDot (x: int) (y: int) (name: string) (mask: byte) =
                { Dash = false; Name = name; Mask = mask; Points = [ pt x y; pt x (y + 1) ] }
            let arc (x0: int) (x1: int) (y: int) (name: string) (mask: byte) =
                { Dash = false; Name = name; Mask = mask
                  Points = [ pt x0 y; pt ((x0 + x1) / 2) (y - 2); pt x1 y ] }
            [ // trivial panel (rows ~8): each site pairs its OWN two modes
              for s in 0 .. sites - 1 do
                  yield modeDot (dotX s 0) 8 (sprintf "t-mode-%d-l" s) 2uy
                  yield modeDot (dotX s 1) 8 (sprintf "t-mode-%d-r" s) 2uy
                  yield arc (dotX s 0) (dotX s 1) 8 (sprintf "t-pair-%d" s) 6uy
              // topological panel (rows ~22): right mode of site s pairs LEFT mode of site s+1
              for s in 0 .. sites - 1 do
                  yield modeDot (dotX s 0) 22 (sprintf "k-mode-%d-l" s) 4uy
                  yield modeDot (dotX s 1) 22 (sprintf "k-mode-%d-r" s) 4uy
              for s in 0 .. sites - 2 do
                  yield arc (dotX s 1) (dotX (s + 1) 0) 22 (sprintf "k-pair-%d" s) 6uy
              // THE MEMORY: the two unpaired end modes, marked with bright diamonds
              for (name, x) in [ "end-mode-left", dotX 0 0; "end-mode-right", dotX (sites - 1) 1 ] do
                  let cx, cy = pt x 22
                  yield
                      { Dash = true; Name = name; Mask = 7uy
                        Points = [ cx, cy - 6; cx + 6, cy; cx, cy + 6; cx - 6, cy; cx, cy - 6 ] } ]
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
                |> List.mapi (fun i tgt -> { Dash = false; Name = sprintf "door-%d" i; Mask = 3uy; Points = [ center; tgt ] })
            let rays =
                ring 48 16 5 5 half
                |> List.take 5
                |> List.mapi (fun i (vx, vy) ->
                    let cx, cy = pt 48 16
                    // "lines go to infinity OR THE BOUNDS" (Addison) — THE BOUNDS it is: extend the
                    // vertex direction exactly to the court edge, never past it (THE COURT LAW
                    // caught the old *4 overshoot at (485,-35); her definition already knew).
                    let dx, dy = vx - cx, vy - cy
                    let kFor (delta: int) (pos: int) (lo: int) (hi: int) =
                        if delta > 0 then (hi - pos) * 8 / delta
                        elif delta < 0 then (lo - pos) * 8 / delta
                        else System.Int32.MaxValue
                    let k = min (kFor dx vx 0 640) (kFor dy vy 0 320) // eighths: integer, never out
                    { Dash = false
                      Name = sprintf "ray-%d" i
                      Mask = 7uy
                      Points = [ (vx, vy); (vx + dx * k / 8, vy + dy * k / 8) ] })
            [ { Dash = false; Name = "inside-room"; Mask = 6uy; Points = insidePent }
              { Dash = false; Name = "inside-bound"; Mask = 4uy; Points = insideBound }
              yield! doors
              { Dash = false; Name = "self-door"; Mask = 5uy; Points = [ center; pt 17 15; pt 17 17; center ] }
              { Dash = false; Name = "outside-room"; Mask = 6uy; Points = outsidePent }
              yield! rays ]
        | "shape-adinkra" ->
            // the N=4 adinkra on the court: 4x4 gray-code grid, 24/32 edges (honest flat subset),
            // each edge colored by its bit and DASHED per the standard Clifford dashing — the
            // sign register as ink. Node parity shown as tiny diamonds (boson) / crosses omitted.
            let nx col = 12 + col * 13
            let ny row = 4 + row * 8
            let edges =
                [ // horizontal edges (bit = gray flip between columns)
                  for row in 0 .. 3 do
                      for col in 0 .. 2 do
                          let v1 = AdinkraViz.nodeAt col row
                          let v2 = AdinkraViz.nodeAt (col + 1) row
                          yield v1, v2, (nx col, ny row), (nx (col + 1), ny row)
                  // vertical edges (bit = gray flip between rows)
                  for row in 0 .. 2 do
                      for col in 0 .. 3 do
                          let v1 = AdinkraViz.nodeAt col row
                          let v2 = AdinkraViz.nodeAt col (row + 1)
                          yield v1, v2, (nx col, ny row), (nx col, ny (row + 1)) ]
            [ for (v1, v2, (x1, y1), (x2, y2)) in edges ->
                  let bit = AdinkraViz.flippedBit v1 v2
                  { Dash = AdinkraViz.isDashed AdinkraViz.standardDashing (min v1 v2) bit
                    Name = sprintf "edge-%d-%d" (min v1 v2) bit
                    Mask = byte (AdinkraViz.colorOfBit bit)
                    Points = [ pt x1 y1; pt x2 y2 ] } ]
        | "shape-refraction" ->
            // THE MEMBRANE CROSSING DRAWN (the ferry's "C refracts", given its Beacon body):
            // a value's worldline meets a membrane (ring projection / soft->hard snap /
            // clear->frost) and BENDS; the bend ratio IS the declared index. Integer Snell in
            // the TANGENT dialect (tan = run/rise; exact in tan, approximates sin-Snell at
            // small angles — the honest bound lives in the cartridge). The dashed GHOST
            // continues the unbent line: the gap between ghost and ray is the refraction,
            // visible. Membrane dashed = the frost register (a boundary, deliberately
            // translucent). Strokes derive from the SAME constants the gate checks.
            let membraneRow = constInt "membrane-row" 16
            let impactCol = constInt "impact-col" 22
            let dxIn = constInt "dx-in" 14
            let dyIn = constInt "dy-in" 14
            let dxOut = constInt "dx-out" 24
            let dyOut = constInt "dy-out" 12
            [ { Dash = true; Name = "membrane"; Mask = 6uy; Points = [ pt 2 membraneRow; pt 60 membraneRow ] }
              { Dash = false; Name = "ray-in"; Mask = 3uy; Points = [ pt (impactCol - dxIn) (membraneRow - dyIn); pt impactCol membraneRow ] }
              { Dash = false; Name = "ray-out"; Mask = 3uy; Points = [ pt impactCol membraneRow; pt (impactCol + dxOut) (membraneRow + dyOut) ] }
              { Dash = true; Name = "ghost-unbent"; Mask = 3uy; Points = [ pt impactCol membraneRow; pt (impactCol + dxIn) (membraneRow + dyIn) ] } ]
        | "shape-sybil-verdict" ->
            // THE VERDICT AS INK (Addendum 4 → glyph): three claimed identities descend as
            // strands; the CHSH oracle (AntiSybil.chshSybil — the gate's own computation) decides
            // which pair collapses, and the render draws EXACTLY that verdict: a convicted pair
            // PLAITS into one braid (left-over-right at every crossing; the under strand carries
            // the braid family's occlusion gap), an unconvicted claim descends straight and
            // separate. Strokes derive FROM the verdict, never hardcoded — drawn = gated.
            let _, _, _, _, verdict = sybilProbesOf d
            let crossings = constInt "crossings" 5
            let cols = [| 20; 32; 44 |]
            let rowTop, rowBot = 2, 29
            let comps =
                verdict.SourceOf
                |> Map.toList
                |> List.groupBy snd
                |> List.map (fun (_, xs) -> xs |> List.map fst |> List.sort)
            [ for comp in comps do
                  match comp with
                  | [ i ] ->
                      // unconvicted: straight and separate. NOT an acquittal — see the cartridge.
                      yield
                          { Dash = false
                            Name = sprintf "claim-%d" i
                            Mask = 2uy
                            Points = [ pt cols.[i % 3] rowTop; pt cols.[i % 3] rowBot ] }
                  | [ i; j ] ->
                      // convicted pair: a plait of `crossings` positive crossings (σ^n — the
                      // braid remembers). Gaps split the under strand into runs.
                      let cA, cB = cols.[i % 3], cols.[j % 3]
                      let cM = (cA + cB) / 2
                      let runs = System.Collections.Generic.Dictionary<int, ResizeArray<ResizeArray<int * int>>>()
                      for s in [ i; j ] do
                          let outer = ResizeArray<ResizeArray<int * int>>()
                          outer.Add(ResizeArray())
                          runs.[s] <- outer
                      let addPt s p = runs.[s].[runs.[s].Count - 1].Add p
                      let breakRun s = runs.[s].Add(ResizeArray())
                      let mutable atA = i
                      let mutable atB = j
                      addPt atA (pt cA rowTop)
                      addPt atB (pt cB rowTop)
                      for k in 0 .. crossings - 1 do
                          let r0 = rowTop + 1 + k * 5
                          addPt atA (pt cA r0)
                          addPt atB (pt cB r0)
                          // left crosses OVER right: the A-side strand runs the full diagonal;
                          // the B-side strand breaks around the midpoint (the occlusion gap).
                          addPt atA (pt cM (r0 + 1))
                          addPt atA (pt cB (r0 + 2))
                          breakRun atB
                          addPt atB (pt cA (r0 + 2))
                          let t = atA
                          atA <- atB
                          atB <- t
                      addPt atA (pt cA rowBot)
                      addPt atB (pt cB rowBot)
                      for s in [ i; j ] do
                          let mask = if s = i then 1uy else 4uy
                          for ri in 0 .. runs.[s].Count - 1 do
                              let ptsList = runs.[s].[ri] |> List.ofSeq
                              if ptsList.Length >= 2 then
                                  yield
                                      { Dash = false
                                        Name = sprintf "claim-%d-r%d" s ri
                                        Mask = mask
                                        Points = ptsList }
                  | many ->
                      // 3+ collapsed into one source: out of this glyph's plait vocabulary; state
                      // it honestly as dashed same-mask strands (one cause wearing many faces).
                      for s in many do
                          yield
                              { Dash = true
                                Name = sprintf "claim-%d" s
                                Mask = 1uy
                                Points = [ pt cols.[s % 3] rowTop; pt cols.[s % 3] rowBot ] } ]
        | _ -> []

    let private pointsAttr (pts: (int * int) list) =
        pts |> List.map (fun (x, y) -> sprintf "%d,%d" x y) |> String.concat " "

    /// The strict-dialect SVG: integers only, fixed attribute order, polylines only, no script.
    let toSvg (d: MediaLines.Doc) : string =
        let body =
            strokesOf d
            |> List.map (fun s ->
                sprintf "  <polyline id=\"%s\" fill=\"none\" stroke=\"%s\" stroke-width=\"4\"%s points=\"%s\" />"
                    s.Name (colorHex s.Mask)
                    (if s.Dash then " stroke-dasharray=\"8 6\"" else "")
                    (pointsAttr s.Points))
            |> String.concat "\n"
        let name = MediaLines.field "meta" "name" d |> Option.defaultValue "shape"
        sprintf "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 640 320\" data-cartridge=\"%s\">\n%s\n</svg>\n" (escapeXml name) body

    /// The HTML+CSS projection: the SVG inline in a dark court, palette as CSS custom properties,
    /// NO JavaScript ever (the HtmlCssBinding law) — pure static, kid-viewable, diffable.
    let toHtml (d: MediaLines.Doc) : string =
        let name = MediaLines.field "meta" "name" d |> Option.defaultValue "shape"
        let vars = [ for m in 0uy .. 7uy -> sprintf "      --c%d: %s;" m (colorHex m) ] |> String.concat "\n"
        // THE DRAW-ON ANIMATION (Aaron 2026-06-12: "animation on our shapes — being drawn tick by
        // tick — in the html and the svg"): pure CSS, zero JavaScript (the HtmlCssBinding law).
        // Solid strokes draw themselves via stroke-dashoffset keyframes (StrokeAnim's see-it-draw,
        // as CSS); strokes are SEQUENCED by per-stroke integer delays (tick by tick — the order is
        // the document's stroke order, which is the generator's order). Semantically-DASHED
        // strokes (the sign register) must keep their dasharray, so they FADE in instead — the
        // two animations never fight over one attribute. Interactivity, also JS-free: hovering a
        // stroke brightens it and dims nothing else (inspect by eye). The SVG golden stays the
        // STATIC truth; animation is the HTML projection's layer.
        let strokes = strokesOf d
        let perStroke =
            strokes
            |> List.mapi (fun i s ->
                let delay = i * 180 // ms per tick: deterministic, integer, sequential
                if s.Dash then
                    sprintf "    #%s { opacity: 0; animation: appear 400ms linear %dms forwards; }" s.Name delay
                else
                    // dash length = the stroke's own Manhattan length (>= euclidean, so the draw
                    // always completes; Kira #11: a hardcoded 2000 left long polylines stuck in the gap)
                    let len =
                        s.Points
                        |> List.pairwise
                        |> List.sumBy (fun ((x0, y0), (x1, y1)) -> abs (x1 - x0) + abs (y1 - y0))
                        |> max 1
                    sprintf "    #%s { stroke-dasharray: %d; stroke-dashoffset: %d; animation: draw 600ms linear %dms forwards; }" s.Name len len delay)
            |> String.concat "\n"
        let anim =
            "    @keyframes draw { to { stroke-dashoffset: 0; } }\n"
            + "    @keyframes appear { to { opacity: 1; } }\n"
            + "    polyline:hover { stroke-width: 7; filter: brightness(1.6); }\n"
            + "    @media (prefers-reduced-motion: reduce) { polyline { animation: none !important; stroke-dashoffset: 0 !important; opacity: 1 !important; } }\n"
            + perStroke
        sprintf "<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\" />\n  <title>%s</title>\n  <style>\n    :root {\n%s\n    }\n    body { background: #101418; margin: 0; display: grid; place-items: center; min-height: 100vh; }\n    svg { width: min(96vw, 960px); image-rendering: pixelated; }\n%s\n  </style>\n</head>\n<body>\n%s</body>\n</html>\n" (escapeXml name) vars anim (toSvg d)

    /// READ BACK the strict dialect (the bidirectional half) — refuses anything outside it:
    /// script, floats in points, foreign elements. We read their format; we do not import its habits.
    let fromSvg (svg: string) : Result<(string * (int * int) list) list, string> =
        let lower = svg.ToLowerInvariant() // case-insensitive scan (Kira #7c: <SCRIPT defeated Contains)
        if lower.Contains "<script" then Error "refused: script is not in the treaty dialect"
        elif lower.Contains "<svg" |> not then Error "refused: not an svg document"
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
                          if t.Contains "stroke-dasharray" && not (t.Contains "stroke-dasharray=\"8 6\"") then
                              err <- Some "refused: only stroke-dasharray=\"8 6\" (double-quoted, exact) is in the treaty dialect" // Kira #7a: single quotes were invisible to attr
                          match attr "id", attr "points" with
                          | Some id, Some pts when not (pts.Contains ".") ->
                              yield
                                  id,
                                  [ for p in pts.Split(' ') do
                                        match p.Split(',') with
                                        | [| x; y |] ->
                                            match System.Int32.TryParse(x, System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture),
                                                  System.Int32.TryParse(y.TrimStart('-'), System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture) with
                                            | (true, xv), (true, _) ->
                                                // y may be negative in transit only via a leading '-'; re-parse signed but refuse exponents/garbage (Kira #2: 1e3 crashed through the Result)
                                                match System.Int32.TryParse(y, System.Globalization.NumberStyles.AllowLeadingSign, System.Globalization.CultureInfo.InvariantCulture) with
                                                | true, yv -> yield xv, yv
                                                | _ -> err <- Some "refused: non-integer coordinate"
                                            | _ -> err <- Some "refused: non-integer coordinate (exponents and garbage are not in the dialect)"
                                        | _ -> err <- Some "refused: malformed point" ]
                          | _, Some pts when pts.Contains "." ->
                              err <- Some "refused: float coordinates are not in the treaty dialect"
                          | _ -> err <- Some "refused: polyline missing id/points"
                      else
                          // every '<' token on the line is checked, not just the line prefix
                          // (Kira #7b: a one-line document smuggled <image> past the prefix scan)
                          for seg in t.Split('<') |> Array.skip (if t.StartsWith "<" then 0 else 1) do
                              let tag = seg.TrimStart('/').ToLowerInvariant()
                              if seg.Length > 0
                                 && not (tag.StartsWith "svg")
                                 && not (tag.StartsWith "polyline")
                                 && not (tag.StartsWith "!--") then
                                  err <- Some(sprintf "refused: foreign element outside the dialect: <%s" (seg.Substring(0, min 20 seg.Length))) ]
            match err with
            | Some e -> Error e
            | None -> Ok parsed
