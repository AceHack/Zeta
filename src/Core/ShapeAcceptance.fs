namespace Zeta.Core

/// ShapeAcceptance — **the renderer acceptance suite: no shape is accepted because it looks good**
/// (Amara 2026-06-12, her named next move: "for each .lines cartridge: parse constants, invoke
/// generator, render shape, overlay known-answer truth, emit verdict: bytes / geometry / meaning /
/// honest-labels. And the first hard gate: no shape is accepted because it looks good — it is
/// accepted because its generated geometry satisfies its known-answer checks.").
///
/// Four registers per cartridge, each a separate verdict:
/// - **Bytes** — a language oracle ratified the byte register in the cartridge's own treaty block.
/// - **Geometry** — THE GATE: the cartridge's generator is INVOKED and its known-answer law checked
///   by computation (the spiral grows; the braid word equals its Artin twin; the worldline stays
///   inside the lightcone; the fourcorner reaches exactly its declared Tsirelson width; the seam's
///   algebra commutes). A shape with no known-answer law CANNOT pass geometry — looks are not a law.
/// - **Meaning** — REPORTED, never gated: which travelers ratified or dissented (dissent is a
///   verdict, not a failure; meaning is negotiated, not enforced — the traveler register).
/// - **HonestLabels** — the lint holds (every constant carries WHAT+WHY) and the shape's specific
///   honesty obligations stand (the fourcorner's staged regime must SAY it is staged).
[<RequireQualifiedAccess>]
module ShapeAcceptance =

    type Register =
        | Bytes
        | Geometry
        | Meaning
        | HonestLabels

    type Verdict =
        { Shape: string
          Register: Register
          Accepted: bool
          Evidence: string }

    let private v shape reg ok ev =
        { Shape = shape; Register = reg; Accepted = ok; Evidence = ev }

    /// THE GEOMETRY GATE: invoke the generator, check the known-answer law by computation.
    /// Unknown shape ⇒ (false, …): geometry can never be accepted on looks.
    let geometryLaw (shape: string) (d: MediaLines.Doc) : bool * string =
        match shape with
        | "shape-spiral" ->
            let growth = MediaLines.constIntOr "growth-milli" 1025 d
            let steps = MediaLines.constIntOr "steps" 36 d
            let re, im = BoundaryLight.rotorOf 1 12 growth
            let curve = BoundaryLight.rotorCurve (BoundaryLight.p 32 16) 6.0 0.0 re im steps
            let d2 (pt: BoundaryLight.P) = (pt.X - 32) * (pt.X - 32) + (pt.Y - 16) * (pt.Y - 16)
            // bounds joined the law after Aaron's eye caught the 1100 escape — growth alone was
            // never the whole claim; "visibly logarithmic ON THE COURT" is.
            let inCourt = curve |> List.forall (fun p -> p.X >= 0 && p.X < 64 && p.Y >= 0 && p.Y < 32)
            let ok = List.length curve = steps + 1 && d2 (List.last curve) > d2 (List.head curve) && inCourt
            ok, "rotor points complete; outward growth; every point ON the court (the escape class, gated)"
        | "shape-braid" ->
            // Artin holds; memory holds; and THE LOCK: the drawn word's permutation is identity
            // (every strand returns to its own column — Aaron's lock-in-place, checked).
            let word =
                MediaLines.field "constant" "word" d
                |> Option.defaultValue ""
                |> fun s -> s.Split(',') |> Array.filter (fun x -> x.Length > 0) |> Array.map int |> Array.toList
            let valid = Braid.validWord 3 word
            let perm = Array.init 3 id
            if valid then
                for c in word do
                    let a = abs c - 1
                    let t = perm.[a] in perm.[a] <- perm.[a + 1]; perm.[a + 1] <- t
            let locked = valid && perm = [| 0; 1; 2 |]
            // THE STUCK LAW (Aaron 2026-06-12, reaching for Majorana-style topology: "trying to
            // see if I can get a configuration where they are stuck together"): the drawn word
            // must be permutation-IDENTITY (every strand home — locked) yet NOT the identity
            // BRAID (cannot be pulled apart — stuck). Strands home + braid un-undoable is the
            // pure-braid-group memory that topological qubits bank on (Kitaev; Microsoft's
            // Majorana 1; (s1·s2^-1) is the figure-eight braid word). Artin's faithful action decides.
            let stuck = locked && not (Braid.isIdentity 3 word)
            let ok = Braid.equal 3 [ 1; 2; 1 ] [ 2; 1; 2 ] && not (Braid.isIdentity 3 [ 1; 1 ]) && locked && stuck
            ok, "Artin holds; memory holds; ends LOCKED (perm = id) and braid STUCK (≠ identity braid — cannot be pulled apart)"
        | "shape-worldline" ->
            // cross-cartridge law: drift must not exceed the lightcone's slope (c = 1 court cell/tick)
            let drift = MediaLines.constIntOr "drift" 99 d
            drift <= 1, sprintf "drift %d <= lightcone slope 1/1 (stays inside the causal diamond)" drift
        | "shape-lightcone" ->
            let slope = MediaLines.field "constant" "slope" d
            let extent = MediaLines.constIntOr "extent" 14 d
            // extent bound joins the law (Kira round-2 #12: extent 9999 drew off-court while the
            // string-compare gate smiled) — THE COURT LAW catches it catalog-wide; the gate now
            // refuses at the source too.
            let ok = slope = Some "1/1" && extent >= 1 && extent <= 15
            ok, sprintf "slope exactly 1/1; extent %d within the court's half-height" extent
        | "shape-fourcorner" ->
            let declared =
                MediaLines.constIntOr "tsirelson-milli" 0 d
            let g = TimeGen.mk "acceptance" 1 4UL TimeGen.PhasorTsirelson
            let cl = TimeGen.mk "acceptance" 1 4UL TimeGen.ClassicalCommonCause
            // P0 fix (Kira): the classical HV model's true S at these corners is exactly 2.0, and a
            // 256-sample estimator carries ~0.06 sampling error — the old `<= 2.0 + 1e-9` gate
            // passed by SEED LUCK (any change to the mixer or seed flips it with no bug present).
            // The suite's honest tolerance (0.05) is the gate's tolerance now. P2 fix: the milli
            // comparison rounds to nearest (truncation accepted S up to 2828.99 — past Tsirelson);
            // the phasor value is analytic, so round-equality at 2828 is exact-by-construction.
            let sPhasor = TimeGen.chsh g 256
            // classifyS wired here (BipartiteMachZehnder, 2026-08-04):
            // - SupraQuantum (|S| > 2√2) is physically impossible for real QM and signals
            //   superdeterminism or a clone attempt — HARD REJECT regardless of declared value.
            // - Quantum (2 < |S| ≤ 2√2) is the valid range for a genuine fourcorner shape.
            // - Classical (|S| ≤ 2) means the phasor is not entangled — shape is wrong.
            let phasorRegime = BipartiteMachZehnder.classifyAnalyticS (BipartiteMachZehnder.AnalyticS sPhasor)
            let ok =
                phasorRegime = BipartiteMachZehnder.ChshRegime.Quantum
                && int (System.Math.Round(sPhasor * 1000.0)) = declared
                && TimeGen.chsh cl 256 <= 2.0 + 0.05
            ok, sprintf "phasor S = declared %d milli (regime=%A, must be Quantum); classical folds at 2 (sampling tolerance 0.05)" declared phasorRegime
        | "shape-buckyball" ->
            // Addison's solid checked by arithmetic, not trust: Euler characteristic, the
            // face/edge double-count, 3-regularity, and the meta room's door count (rooms + itself).
            let c name = MediaLines.constIntOr name -1 d
            let v', e, f = c "vertices", c "edges", c "faces"
            let ok =
                v' - e + f = 2 // Euler: a sphere, not a torus or a mistake
                && 12 * 5 + 20 * 6 = 2 * e // every edge borders exactly two rooms
                && 3 * v' = 2 * e // three edges at every corner (the soccer-ball stitch)
                && c "meta-doors" = f + 1 // a door to every room AND itself
            ok, sprintf "Euler %d-%d+%d=2; double-count and 3-regularity close; meta-doors = faces + itself" v' e f
        | "shape-plait-move" ->
            // the unit move: the drawn word's permutation must be the OUTER SWAP (02) — ends
            // exchanged, middle home — and NOT identity (the move moves; odd parity proves no
            // 3-crossing word can lock). The locked braid is this move repeated to its period.
            let word =
                MediaLines.field "constant" "word" d
                |> Option.defaultValue ""
                |> fun s -> s.Split(',') |> Array.filter (fun x -> x.Length > 0) |> Array.map int |> Array.toList
            let valid = Braid.validWord 3 word
            let perm = Array.init 3 id
            if valid then
                for c in word do
                    let a = abs c - 1
                    let t = perm.[a] in perm.[a] <- perm.[a + 1]; perm.[a + 1] <- t
            let ok = valid && perm = [| 2; 1; 0 |] && not (Braid.isIdentity 3 word)
            ok, "perm = outer swap (02), middle home; not the identity braid — the move MOVES (odd parity: lock impossible here)"
        | "shape-shadow-loop" ->
            // otto's own: the sampled lemniscate must CLOSE (first = last) and pass through the
            // center exactly center-visits times (the crossing, hit structurally — steps % 4 = 0).
            let c name = MediaLines.constIntOr name -1 d
            let pts = ShapeRender.strokesOf d |> List.collect (fun s -> if s.Name = "loop" then s.Points else [])
            let cx, cy = 32 * 10 + 5, 16 * 10 + 5
            let visits = pts |> List.filter (fun (x, y) -> x = cx && y = cy) |> List.length
            let closed = not (List.isEmpty pts) && List.head pts = List.last pts
            // closure lands at t=0 (span,0), never on the center — so the visit count is exact.
            let ok = closed && visits = c "center-visits"
            ok, sprintf "closed loop; %d center visits (the catch, used twice as one door)" visits
        | "shape-exchange-worldlines" ->
            // CAUSAL ORDER: consecutive exchange events must be timelike-separated at slope 1/1 —
            // |Δcolumn| <= Δtime-rows between events i and i+1 (each event inside the next's past
            // cone). Plus SAME-BRAID: the word is the locked+stuck word (one object, two registers).
            let word =
                MediaLines.field "constant" "word" d
                |> Option.defaultValue ""
                |> fun s -> s.Split(',') |> Array.filter (fun x -> x.Length > 0) |> Array.map int |> Array.toList
            let rows = MediaLines.constIntOr "rows" 21 d
            let gap = MediaLines.constIntOr "strand-gap" 3 d
            let cols = [| 32 - gap; 32; 32 + gap |]
            let rowsPerCross = rows / (List.length word + 1)
            let eventPts = word |> List.mapi (fun i c -> (cols.[abs c - 1] + cols.[abs c]) / 2, (i + 1) * rowsPerCross)
            let causal =
                eventPts
                |> List.pairwise
                |> List.forall (fun ((x0, t0), (x1, t1)) -> abs (x1 - x0) <= (t1 - t0)) // slope 1/1
            let valid = Braid.validWord 3 word
            let perm = Array.init 3 id
            if valid then
                for c in word do
                    let a = abs c - 1
                    let t' = perm.[a] in perm.[a] <- perm.[a + 1]; perm.[a + 1] <- t'
            let lockedStuck = valid && perm = [| 0; 1; 2 |] && not (Braid.isIdentity 3 word)
            causal && lockedStuck,
            "exchanges causally ordered (|Δx| <= Δt at slope 1/1); the word is the locked+stuck braid — one object, two registers"
        | "shape-symmetric-vs-braided" ->
            // THE CONTRAST, COMPUTED. The claim is not "these two panels look different" — looks
            // are not a law. It is: read ONE word in two categories and the two readings disagree
            // in a way an integer can state. Every conjunct below is recomputed here from the
            // file's own constants and from the STROKES THE RENDERER ACTUALLY EMITS (drawn =
            // gated), so a drawing that stops matching its own arithmetic fails the gate.
            let word =
                MediaLines.field "constant" "word" d
                |> Option.defaultValue ""
                |> fun s ->
                    // total by construction: garbage is DROPPED here and then caught by the
                    // `List.length word = crossings` conjunct, never thrown out of the gate
                    s.Split(',')
                    |> Array.choose (fun x ->
                        match System.Int32.TryParse(x.Trim(), System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture) with
                        | true, v -> Some v
                        | _ -> None)
                    |> Array.toList
            let c name = MediaLines.constIntOr name -1 d
            let strands, crossings = c "strands", c "crossings"
            let valid = strands >= 2 && Braid.validWord strands word
            // THE TRAP, computed: the permutation of the SAME word, which is the identity in BOTH
            // readings. Grade by where the ends landed and the panels are indistinguishable —
            // that is what "the shadow B_n -> S_n is forgetful" means, checked rather than said.
            let perm = Array.init (max strands 2) id
            if valid then
                for x in word do
                    let a = abs x - 1
                    let t = perm.[a] in perm.[a] <- perm.[a + 1]; perm.[a + 1] <- t
            let permIdentity = valid && perm = Array.init (max strands 2) id
            // the braid group's verdict on the same word, by Artin's faithful action
            let braidedCollapses = valid && Braid.isIdentity strands word
            // the ink: an unbroken strand is ONE run; every occlusion gap splits its strand into
            // one more. So run-count minus strand-count IS the number of gaps drawn in that panel.
            let strokes = ShapeRender.strokesOf d
            let runsOf (tag: string) =
                strokes |> List.filter (fun s -> s.Name.StartsWith(tag + "-strand-", System.StringComparison.Ordinal)) |> List.length
            let symRuns, brdRuns = runsOf "sym", runsOf "brd"
            // ONE WORD, READ TWICE — made checkable, and this is the conjunct that carries the
            // cartridge's actual thesis. Strip each panel's strands down to the sequence of COLUMNS
            // they occupy (a gap's interpolated points sit BETWEEN columns and drop out of this
            // projection), and the two panels must agree strand for strand. Identical itinerary,
            // opposite occlusion register: that is "the panels differ only in the CATEGORY", in ink.
            //
            // Planted mutant that this exists to kill (2026-08-14): drawing the symmetric panel as
            // two STRAIGHT lines. It is a plausible mistake — σ² really is the identity there, so
            // "draw the collapsed form" sounds right — and it survives every count above (2 runs,
            // 0 gaps, ends home). It is also a different and much weaker cartridge: straight lines
            // beside a braid show that a braid is not nothing; they do not show that the SAME WORD
            // reads two ways. The itinerary check refuses it.
            let panelsN = c "panels"
            let bayW = if panelsN >= 2 then 64 / panelsN else 64
            let colIndexOf (panel: int) (x: int) =
                [ 0 .. (max strands 2) - 1 ]
                |> List.tryFindIndex (fun i -> (panel * bayW + bayW * (i + 1) / (strands + 1)) * 10 + 5 = x)
            let itinerary (tag: string) (panel: int) (s: int) =
                strokes
                |> List.filter (fun st -> st.Name.StartsWith(sprintf "%s-strand-%d" tag s, System.StringComparison.Ordinal))
                |> List.collect (fun st -> st.Points)
                |> List.choose (fun (x, _) -> colIndexOf panel x)
            let strandIdx = [ 0 .. (max strands 2) - 1 ]
            let sameItinerary = strandIdx |> List.forall (fun s -> itinerary "sym" 0 s = itinerary "brd" 1 s)
            // …and both panels must really CROSS: on 2 strands every letter moves both strands, so
            // each strand changes column exactly `crossings` times. Straight lines score 0.
            let crossesInBoth =
                [ "sym", 0; "brd", 1 ]
                |> List.forall (fun (tag, p) ->
                    strandIdx
                    |> List.forall (fun s ->
                        let it = itinerary tag p s
                        (it |> List.pairwise |> List.filter (fun (a, b) -> a <> b) |> List.length) = crossings))
            // WHICH strand breaks, not merely HOW MANY breaks — Artin's sign, read back off the ink.
            // Second planted mutant (2026-08-14): invert the under/over choice. It keeps the gap
            // COUNT, the itinerary, and the per-strand run totals all identical (for σ·σ the flip is
            // count-symmetric), so everything above smiles at a picture that now draws σ⁻¹·σ⁻¹ while
            // the file still says word = 1,1. The cartridge's own WHY for `gaps-right` says "the sign
            // decides which strand breaks"; a gate that cannot say WHICH is not checking the sign.
            let expectedUnder =
                let p = Array.init (max strands 2) id
                [ for x in word do
                      let a = abs x - 1
                      let u = p.[if x > 0 then a + 1 else a] // read BEFORE the swap, as the renderer does
                      let t = p.[a] in p.[a] <- p.[a + 1]; p.[a + 1] <- t
                      yield u ]
            let observedUnder =
                strandIdx
                |> List.collect (fun s ->
                    let runs =
                        strokes
                        |> List.filter (fun st -> st.Name.StartsWith(sprintf "brd-strand-%d" s, System.StringComparison.Ordinal))
                    // every run but the last one ENDS at an occlusion gap; its final y dates the crossing
                    runs
                    |> List.truncate (max 0 (List.length runs - 1))
                    |> List.map (fun st -> (List.last st.Points |> snd), s))
                |> List.sortBy fst
                |> List.map snd
            let ok =
                valid
                && List.length word = crossings
                && sameItinerary
                && crossesInBoth
                && (valid && observedUnder = expectedUnder)
                && permIdentity && c "perm-identity" = 1 // both panels end home, and the file says so
                // LEFT collapses / RIGHT does not — the declared bits must equal the COMPUTED ones
                && c "left-square-id" = (if permIdentity then 1 else 0)
                && c "right-square-id" = (if braidedCollapses then 1 else 0)
                // …and the contrast must be REAL: a do-undo word (σ·σ⁻¹) would satisfy every line
                // above with both readings collapsing, and would draw a cartridge that teaches
                // nothing. σ² ≠ 1 is the whole right panel.
                && not braidedCollapses
                // DRAWN = GATED: the register in the ink equals the register in the constants
                && symRuns - strands = c "gaps-left"
                && brdRuns - strands = c "gaps-right"
                && symRuns = strands // the symmetric panel carries NO over/under register at all
                && brdRuns = strands + crossings // the braided panel remembers every crossing
                // the atom's known answer, held here too (the anchor: if Braid ever stops being
                // faithful on B2, this cartridge's whole right panel is a lie)
                && not (Braid.isIdentity 2 [ 1; 1 ])
            ok,
            sprintf
                "one word (%d letters) read twice: permutation identity in BOTH panels (the forgetful shadow cannot separate them); σ² ≠ 1 in the braid group so the right panel does NOT collapse; ink matches the register — %d runs left (%d gaps), %d runs right (%d gaps, one per crossing)"
                (List.length word) symRuns (symRuns - strands) brdRuns (brdRuns - strands)
        | "shape-traced" ->
            // THE REFUSAL, COMPUTED — and the law is deliberately NOT the one the cartridge's own
            // `geometry-law` issue proposed. That issue says: "count the drawn crossings and
            // occlusion gaps and require BOTH to be zero", and calls it "mechanical and strong".
            // It is mechanical, it is TRUE, and on its own it is worthless: AN EMPTY PICTURE HAS
            // ZERO CROSSINGS AND ZERO GAPS. So does a single dot. A law whose every conjunct is an
            // absence is satisfied by absence — the vacuity class, which is exactly what a
            // known-answer gate exists to refuse. The zero-counts below are kept, because they are
            // the cartridge's thesis; what is added is everything that makes them MEAN something:
            // the figure must exist, the loop must actually return, and it must return to the
            // corner this cartridge stakes its honesty on (TInFeedback, not TOut).
            //
            // Sentinel 99999, not -1: `retract-weight` is legitimately -1, so -1 as "missing" would
            // let an ABSENT constant read as a present one. A missing constant must fail every
            // comparison it appears in, and 99999 is outside every range this figure can draw.
            let c name = MediaLines.constIntOr name 99999 d
            let strokes = ShapeRender.strokesOf d
            let named (prefix: string) =
                strokes |> List.filter (fun s -> s.Name.StartsWith(prefix, System.StringComparison.Ordinal))
            let wireRuns = named "wire-"
            // an occlusion gap splits a wire into runs named "<wire>-rN" (the braid family's
            // convention, held here so the two families count the same thing the same way). Distinct
            // base names = wires actually drawn; the excess over that = gaps drawn.
            let baseName (n: string) =
                let i = n.LastIndexOf "-r"
                if i > 0 && n.Length > i + 2 && n.Substring(i + 2) |> Seq.forall System.Char.IsAsciiDigit then n.Substring(0, i) else n
            let wireNames = wireRuns |> List.map (fun s -> baseName s.Name) |> List.distinct
            let gapsDrawn = List.length wireRuns - List.length wireNames
            // A BEND IS NOT A CROSSING, counted by integer segment intersection — not by trusting the
            // renderer's naming and not by eye. Collinear touching counts as meeting: in a figure
            // whose entire claim is "this wire passes over nothing", grazing is not innocent.
            let orient (ax, ay) (bx, by) (px, py) = sign ((bx - ax) * (py - ay) - (by - ay) * (px - ax))
            let onSeg a b p =
                let (ax, ay), (bx, by), (px, py) = a, b, p
                orient a b p = 0 && min ax bx <= px && px <= max ax bx && min ay by <= py && py <= max ay by
            let meet (a, b) (p, q) =
                (orient a b p * orient a b q < 0 && orient p q a * orient p q b < 0)
                || onSeg a b p || onSeg a b q || onSeg p q a || onSeg p q b
            let segs =
                wireRuns
                |> List.collect (fun s -> s.Points |> List.pairwise |> List.mapi (fun i sg -> s.Name, i, sg))
                |> List.toArray
            let mutable crossings = 0
            for i in 0 .. segs.Length - 1 do
                for j in i + 1 .. segs.Length - 1 do
                    let n1, k1, s1 = segs.[i]
                    let n2, k2, s2 = segs.[j]
                    // consecutive segments of one polyline share an endpoint BY CONSTRUCTION; every
                    // other pair meeting is a crossing, self-crossings of the return path included.
                    if not (n1 = n2 && abs (k1 - k2) = 1) && meet s1 s2 then crossings <- crossings + 1
            // THE PORTS, read back off the ink. This is the conjunct the zero-counts cannot supply:
            // a straight line drawn in an empty corner of the court crosses nothing and is no trace.
            let centerOf (s: ShapeRender.Stroke) =
                let xs, ys = s.Points |> List.map fst, s.Points |> List.map snd
                (List.min xs + List.max xs) / 2, (List.min ys + List.max ys) / 2
            let cornerStrokes = named "corner-"
            let cornerAt n = cornerStrokes |> List.tryFind (fun s -> s.Name = n) |> Option.map centerOf
            let wireAt n = wireRuns |> List.tryFind (fun s -> s.Name = n)
            let boxes = strokes |> List.filter (fun s -> s.Name = "box")
            let onWire (w: ShapeRender.Stroke) (p: int * int) =
                w.Points |> List.pairwise |> List.exists (fun (a, b) -> onSeg a b p)
            let portsOk, loopOk, boxOk =
                match wireAt "wire-through", wireAt "wire-feedback", boxes with
                | Some through, Some feedback, [ box ] ->
                    let fPts = feedback.Points
                    let head, tail' = List.head fPts, List.last fPts
                    // (a) the loop's two ends ARE the two feedback corners — TOutFeedback out,
                    //     TInFeedback back in. `feedback-on-input` is the cartridge's honest
                    //     mechanism (the standard monadic loop feeds the OUTPUT channel only), so a
                    //     figure that lands the return on TOut has drawn a pipeline and must fail.
                    let ports =
                        cornerAt "corner-toutfeedback" = Some head
                        && cornerAt "corner-tinfeedback" = Some tail'
                        && (match cornerAt "corner-tin", cornerAt "corner-tout" with
                            | Some a, Some b -> onWire through a && onWire through b
                            | _ -> false)
                    // (b) the loop RETURNS, and returns THE LONG WAY. Same channel height at both
                    //     ends (it lands where it left), right-to-left (output side back to input
                    //     side), on a channel that is not the pass-through one, and leaving that
                    //     channel's height in between — i.e. it goes AROUND the box in SPACE. A
                    //     return drawn flat along the channel it left would read as travelling back
                    //     along a time axis, which is the strong claim src/Core/WSet.fs refuses.
                    let loop =
                        snd head = snd tail'
                        && fst head > fst tail'
                        && snd head <> (List.head through.Points |> snd)
                        && (fPts |> List.map snd |> List.max) > snd head
                    // (c) the box is a closed rectangle the pass-through wire really goes THROUGH.
                    let bx = box.Points |> List.map fst
                    let bo =
                        List.head box.Points = List.last box.Points
                        && List.length box.Points = 5
                        && (through.Points |> List.map fst |> List.min) < List.min bx
                        && (through.Points |> List.map fst |> List.max) > List.max bx
                    ports, loop, bo
                | _ -> false, false, false
            // THE SIGN AS INK: exactly one wire is dashed, and it is dashed iff the file declares a
            // negative weight for it (WSet.negate — the retraction IS the mechanism, not bookkeeping
            // around it). Dash is the sign register here and never occlusion; the gap count above is
            // what measures occlusion, and the two must not be allowed to stand in for each other.
            let dashed = wireRuns |> List.filter (fun s -> s.Dash) |> List.length
            // NOT gated here, and this is a finding rather than an omission: the in-file law
            // `only-the-ring-corners` reads `rings-with-a-trace + inverse-free-corners = corners`,
            // which adds the FOUR-CORNER RING FAMILY (ℤ, ℂ, ℝ≥0, Boolean) to a total taken from
            // FourCornerOwnership's TIn/TOut/TInFeedback/TOutFeedback. Two unrelated objects that
            // both happen to count 4 — the file's own `differs-from shape-fourcorner` edge records
            // that this name collides, and then the law crosses it anyway. The arithmetic holds by
            // coincidence of counts, which is numerology, not an identification. Left standing and
            // named; changing the file's claims is its author's call, not the gate's.
            let ok =
                List.length wireNames = c "wires"
                && List.length cornerStrokes = c "corners"
                && List.length boxes = 1
                && boxOk
                && portsOk
                && loopOk
                && gapsDrawn = c "gaps"
                && gapsDrawn = 0 // nothing passes over anything: a gap would import a braiding
                && crossings = c "loop-crossings"
                && crossings = 0 // TRACED ⇏ BRAIDED, measured rather than promised
                && c "feedback-on-input" = 1
                && c "emit-weight" + c "retract-weight" = 0 // +w and -w annihilate in consolidate
                && dashed = (if c "retract-weight" < 0 then 1 else 0)
            ok,
            sprintf
                "the bend is not a crossing, counted: %d wire-wire intersections and %d occlusion gaps over %d wires (both must be 0 — and the figure must EXIST, which is why %d corners, a closed box the through-wire spans, and a return path landing on TOutFeedback→TInFeedback are conjuncts too); %d dashed wire carries the -1 retraction"
                crossings gapsDrawn (List.length wireNames) (List.length cornerStrokes) dashed
        | "shape-crossing" ->
            // the atom's three laws, by Artin's faithful action on B2:
            let ok =
                not (Braid.isIdentity 2 [ 1 ]) // sigma != 1: the strands really exchange
                && Braid.isIdentity 2 [ 1; -1 ] // do-undo: the inverse undoes exactly
                && not (Braid.isIdentity 2 [ 1; 1 ]) // memory at its smallest: sigma^2 != 1
            ok, "sigma != 1; sigma·sigma⁻¹ = 1; sigma² != 1 — the three smallest braid proofs, on the atom"
        | "shape-triboolean" ->
            // the resolution law, live: same sampleProgressive as the renderer — partial budget
            // leaves Unknowns (honesty), full budget leaves ZERO (uncertainty fully reduced).
            let grid = MediaLines.constIntOr "grid" 8 d
            let partial = MediaLines.constIntOr "budget-partial" 20 d
            let full = MediaLines.constIntOr "budget-full" 64 d
            let curve = [ BoundaryLight.p 1 1; BoundaryLight.p (grid * 2 - 2) (grid * 2 - 2) ]
            let unknowns budget =
                BoundaryLight.sampleProgressive BoundaryLight.MiddleOut budget 3.0 0.4 grid grid 2 curve
                |> Map.toList
                |> List.filter (fun (_, t) -> t = BoundaryLight.Unknown)
                |> List.length
            let atPartial = unknowns partial
            let atFull = unknowns full
            (atPartial > 0 && atFull = 0),
            sprintf "partial budget leaves %d Unknown (must be > 0); full budget leaves %d (must be 0)" atPartial atFull
        | "shape-softvalue" ->
            // the ladder's code laws, run LIVE on PixelLens (the rungs in code):
            // (a) quantize: floor(confidence * levels / 1000) = the declared coarse level;
            // (b) colorize: a confident cell keeps its color, an uncertain one collapses to mono.
            let conf = MediaLines.constIntOr "confidence-milli" 850 d
            let levels = MediaLines.constIntOr "rung2-levels" 4 d
            let quantized = MediaLines.constIntOr "rung2-quantized" 3 d
            let uncertainty = 1000 - conf
            let confident = PixelLens.pack 6uy 28 uncertainty
            let uncertain = PixelLens.pack 6uy 28 900
            let ok =
                conf * levels / 1000 = quantized
                && PixelLens.colorize 500 confident = 6uy
                && PixelLens.colorize 500 uncertain = (6uy &&& 1uy)
            ok, sprintf "quantize floor = %d; colorize keeps the confident cell and collapses the 900-milli one (the ladder, live)" quantized
        | "shape-dynamicvalue" ->
            // the engine law: the SAME treemap call the renderer draws must tile EXACTLY —
            // widths equal the declared slices, X contiguous, total = the court (area conservation).
            let wa = MediaLines.constIntOr "weight-a" 5 d
            let wb = MediaLines.constIntOr "weight-b" 3 d
            let wc = MediaLines.constIntOr "weight-c" 2 d
            let court = MediaLines.constIntOr "court-cells" 60 d
            // same call as the renderer: treemap(x=2, y=8, w=court, h=16, horizontal) — drawn = gated
            let tiles = LayoutEngine.treemap 2 8 court 16 true [ "a", wa; "b", wb; "c", wc ]
            let widths = tiles |> List.map (fun r -> r.W)
            let contiguous =
                tiles |> List.pairwise |> List.forall (fun (p, q) -> p.X + p.W = q.X)
            let ok =
                widths = [ MediaLines.constIntOr "slice-a" 30 d; MediaLines.constIntOr "slice-b" 18 d; MediaLines.constIntOr "slice-c" 12 d ]
                && List.sum widths = court
                && contiguous
            ok, sprintf "treemap tiles %A, contiguous, summing exactly to the %d-cell court" widths court
        | "shape-kitaev-chain" ->
            // the render's own accounting must equal the in-file laws: trivial arcs = sites,
            // topological arcs = sites − 1, unpaired end diamonds = 2 (the memory, drawn).
            let c name = MediaLines.constIntOr name -1 d
            let strokes = ShapeRender.strokesOf d
            let count prefix = strokes |> List.filter (fun s -> s.Name.StartsWith(prefix: string)) |> List.length
            let ok =
                count "t-pair-" = c "sites"
                && count "k-pair-" = c "sites" - 1
                && count "end-mode-" = c "end-modes"
                && c "end-modes" = 2
            ok, sprintf "drawn accounting holds: %d trivial pairs, %d topological pairs, %d unpaired end modes (the memory)" (count "t-pair-") (count "k-pair-") (count "end-mode-")
        | "shape-adinkra" ->
            // the two laws run live: Gates condition on the standard dashing, and the gauge lemma
            // (a deterministic vertex walk changes the dashing, never the face parity).
            let walked = [ 0; 5; 10; 15 ] |> List.fold (fun d v -> AdinkraViz.flipVertex v d) AdinkraViz.standardDashing
            let ok =
                AdinkraViz.allFacesOdd AdinkraViz.standardDashing
                && AdinkraViz.allFacesOdd walked
                && walked <> AdinkraViz.standardDashing
            ok, "Gates condition holds; gauge walk changed the dashing but no face went even (the twist is global)"
        | "shape-gc" ->
            // THE TRACE LAW runs the SAME ray trace the renderer draws: BFS from the roots over
            // the gen line's refs. Counted live, never asserted on faith: reached/garbage match
            // the constants; THE ISLAND is a real cycle inside the garbage (the case refcounting
            // can never free); and no live object points at garbage (else the trace would have
            // lit it — reachability is from roots, the only direction that matters).
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
            let objects = MediaLines.constIntOr "objects" 0 d
            let reachedC = MediaLines.constIntOr "reached" 0 d
            let garbageC = MediaLines.constIntOr "garbage" 0 d
            let islandC = MediaLines.constIntOr "island-size" 0 d
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
            let garbage = Set.ofList [ 0 .. objects - 1 ] - reached
            let island =
                garbage
                |> Set.filter (fun g -> refs |> List.exists (fun (a, b) -> a = g && Set.contains b garbage)
                                        && refs |> List.exists (fun (a, b) -> b = g && Set.contains a garbage))
            let liveToGarbage = refs |> List.exists (fun (a, b) -> Set.contains a reached && Set.contains b garbage)
            let ok =
                Set.count reached = reachedC
                && Set.count garbage = garbageC
                && Set.count island = islandC
                && not liveToGarbage
            ok, sprintf "the trace counted: reached %d, garbage %d, island %d — the cycle no refcount frees, no live->garbage edge (rays from roots are the whole law)" (Set.count reached) (Set.count garbage) (Set.count island)
        | "shape-seam" ->
            // the seam's algebra: the cross-stream fold COMMUTES (order of arrival cannot matter)
            let a = { WeaveFold.Stream = "left"; WeaveFold.Seq = 1; WeaveFold.Key = "row4"; WeaveFold.Value = "over" }
            let b = { WeaveFold.Stream = "right"; WeaveFold.Seq = 1; WeaveFold.Key = "row4"; WeaveFold.Value = "under" }
            let ok = WeaveFold.fold [ a; b ] = WeaveFold.fold [ b; a ]
            ok, "WeaveFold commutes across streams — the join holds from BOTH sides"
        | "shape-refraction" ->
            // integer Snell, tangent dialect: the bend ratio equals the declared index
            // EXACTLY (dx-out * 1000 = dy-out * index-milli), incidence is the unit slope,
            // and every endpoint stays on the court. Same constants the renderer draws.
            let c name dflt = MediaLines.constIntOr name dflt d
            let membraneRow, impactCol = c "membrane-row" 16, c "impact-col" 22
            let dxIn, dyIn, dxOut, dyOut, indexMilli = c "dx-in" 14, c "dy-in" 14, c "dx-out" 24, c "dy-out" 12, c "index-milli" 2000
            let onCourt x y = x >= 0 && x < 64 && y >= 0 && y < 32
            let ok =
                dxOut * 1000 = dyOut * indexMilli
                && dxIn = dyIn
                && indexMilli >= 1000
                && onCourt (impactCol - dxIn) (membraneRow - dyIn)
                && onCourt (impactCol + dxOut) (membraneRow + dyOut)
                && onCourt (impactCol + dxIn) (membraneRow + dyIn)
            ok, sprintf "tangent-Snell exact: %d*1000 = %d*%d; unit incidence; ray, bend, and ghost all on the court" dxOut dyOut indexMilli
        | "shape-sybil-verdict" ->
            // the CHSH oracle's laws, run LIVE (Addendum 4 made instrument, PR #9117):
            // AntiSybil.chshSybil is both this gate's check and the renderer's stroke source —
            // drawn = gated by the SAME computation (ShapeRender.sybilProbesOf, one source).
            let a, b, c, threshold, verdict = ShapeRender.sybilProbesOf d
            let sPair = AntiSybil.chshS a b
            let sIndep = AntiSybil.chshS a c
            let wantDistinct = MediaLines.constIntOr "distinct" 2 d
            // THE CONDUCTED PAIR IS A PR-BOX BY CONSTRUCTION, and that is the point.
            // Claim 1's outcomes read claim 0's settings (the cartridge's own PR-box rule), so
            // S = 4 exactly — the no-signalling maximum, ABOVE Tsirelson's 2√2. Supra-quantum is
            // what a conductor LOOKS like; it is the thing this shape convicts, not a forgery of it.
            //
            // An EVE clone-gate (`not (classifyS sPair = SupraQuantum)`) was wired here on
            // 2026-08-04, copied from the fourcorner use above where it is CORRECT — a genuine
            // entangled phasor must land in Quantum. Here it contradicted the very next conjunct:
            // `sPair = 4.0` FORCES SupraQuantum (BipartiteMachZehnder.Tests pins
            // `classifyS 4.0 = SupraQuantum`), so `ok` was unsatisfiable and this cartridge could
            // never be accepted — it failed THE HARD GATE on every run from the day it landed.
            //
            // The regime is REPORTED in the evidence and not gated on: detection is neutral, the
            // reading belongs to the caller (dual-use-detection-is-neutral-oracle-decides). The
            // renegotiation gate the comment described belongs on a renegotiation INPUT, of which
            // there is none in this known-answer law.
            let pairRegime = BipartiteMachZehnder.classifyAnalyticS (BipartiteMachZehnder.AnalyticS sPair)
            let ok =
                verdict.DistinctCount = wantDistinct
                && sPair = 4.0
                && abs sIndep <= threshold
                && AntiSybil.coordinationBandwidth sPair = 1.0
            ok,
            sprintf
                "CHSH oracle live: conducted pair S = %d/1000 (regime=%A — PR-box by construction, above Tsirelson: that IS the conductor, reported not gated; bandwidth %d/1000), convicted; independent |S| = %d/1000 <= threshold %d/1000 (not convicted — and never ACQUITTED: low S proves nothing); %d distinct sources among %d claims (the forgery-cost floor)"
                (int (sPair * 1000.0))
                pairRegime
                (int (AntiSybil.coordinationBandwidth sPair * 1000.0))
                (int (abs sIndep * 1000.0))
                (int (threshold * 1000.0))
                verdict.DistinctCount
                verdict.ClaimedCount
        | _ -> false, "no known-answer law for this shape — geometry cannot be accepted on looks"

    /// All four verdicts for one cartridge (name = its meta name).
    let acceptOne (d: MediaLines.Doc) : Verdict list =
        let shape = MediaLines.field "meta" "name" d |> Option.defaultValue "?"
        let bytesOk = MediaLines.ratifiedBy "bytes" "ratified" d |> List.isEmpty |> not
        let codeOk, codeEv = geometryLaw shape d
        // HOMOICONIC HALF: the cartridge's OWN `law` lines must also hold (the file states its
        // checks; module code carries only what integers cannot say). Both halves gate.
        let fileLaws = CartridgeLaw.check d
        // Delegated laws do not vouch and do not block (the delegation's proof is the named
        // tool's own treaty line); only a Fails blocks geometry here.
        let geomOk = codeOk && not (fileLaws |> List.exists CartridgeLaw.blocks)
        let geomEv =
            codeEv
            + (if List.isEmpty fileLaws then ""
               else
                   " | in-file: "
                   + (fileLaws
                      |> List.map (fun l ->
                          l.Law
                          + (match l.Status with
                             | CartridgeLaw.Holds -> " holds"
                             | CartridgeLaw.Delegated tool -> sprintf " delegated:%s" tool
                             | CartridgeLaw.Fails -> " FAILS"))
                      |> String.concat ", "))
        let travelers = MediaLines.treatiesOf d |> List.filter (fun (_, r, _) -> r = "meaning")
        let meaningEv =
            if List.isEmpty travelers then "no traveler has spoken yet (silence, not error — consent first)"
            else travelers |> List.map (fun (o, _, verdict) -> o + ":" + verdict) |> String.concat " "
        let lintOk = MediaLines.lint d |> List.isEmpty
        // P1 fix (Kira): the old fourcorner extra check asserted a STRING CONSTANT in TimeGen.label
        // contained "STAGED" — vacuous per-cartridge (it could never fail for the artifact under
        // review). Honest-labels = the lint (structure: WHAT+WHY on every constant); artifact-
        // specific honesty obligations belong in the cartridge's own law lines, where they can fail.
        let labelsOk = lintOk
        [ v shape Bytes bytesOk (if bytesOk then "a byte-register ATTESTATION is present (the PROOF is THE GOLDEN LOCK in CI — an in-file line can claim, never verify; Kira round-2 #6)" else "no byte-register ratification in the treaty block")
          v shape Geometry geomOk geomEv
          v shape Meaning true meaningEv // reported, never gated: dissent is data
          v shape HonestLabels labelsOk (if labelsOk then "lint clean (WHAT+WHY); shape-specific honesty obligations stand" else "lint findings or a missing honesty label") ]

    /// THE HARD GATE: accepted ⇔ bytes ∧ geometry ∧ honest-labels. Meaning is reported alongside,
    /// never counted — a shape cannot pass because travelers like it, nor fail because one dissents.
    let accepted (verdicts: Verdict list) : bool =
        verdicts
        |> List.forall (fun x -> x.Register = Meaning || x.Accepted)
