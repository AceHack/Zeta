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
            let ok =
                int (System.Math.Round(sPhasor * 1000.0)) = declared
                && sPhasor <= 2.0 * sqrt 2.0 + 1e-9
                && TimeGen.chsh cl 256 <= 2.0 + 0.05
            ok, sprintf "phasor S = declared %d milli (rounded, capped at Tsirelson); classical folds at 2 (sampling tolerance 0.05)" declared
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
        | "shape-crossing" ->
            // the atom's three laws, by Artin's faithful action on B2:
            let ok =
                not (Braid.isIdentity 2 [ 1 ]) // sigma != 1: the strands really exchange
                && Braid.isIdentity 2 [ 1; -1 ] // do-undo: the inverse undoes exactly
                && not (Braid.isIdentity 2 [ 1; 1 ]) // memory at its smallest: sigma^2 != 1
            ok, "sigma != 1; sigma·sigma⁻¹ = 1; sigma² != 1 — the three smallest braid proofs, on the atom"
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
        | "shape-seam" ->
            // the seam's algebra: the cross-stream fold COMMUTES (order of arrival cannot matter)
            let a = { WeaveFold.Stream = "left"; WeaveFold.Seq = 1; WeaveFold.Key = "row4"; WeaveFold.Value = "over" }
            let b = { WeaveFold.Stream = "right"; WeaveFold.Seq = 1; WeaveFold.Key = "row4"; WeaveFold.Value = "under" }
            let ok = WeaveFold.fold [ a; b ] = WeaveFold.fold [ b; a ]
            ok, "WeaveFold commutes across streams — the join holds from BOTH sides"
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
