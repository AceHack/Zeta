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
            let re, im = BoundaryLight.rotorOf 1 12 1100
            let curve = BoundaryLight.rotorCurve (BoundaryLight.p 32 16) 6.0 0.0 re im 36
            let d2 (pt: BoundaryLight.P) = (pt.X - 32) * (pt.X - 32) + (pt.Y - 16) * (pt.Y - 16)
            let ok = List.length curve = 37 && d2 (List.last curve) > d2 (List.head curve)
            ok, "37 rotor points; outward logarithmic growth (last farther than first)"
        | "shape-braid" ->
            let ok = Braid.equal 3 [ 1; 2; 1 ] [ 2; 1; 2 ] && not (Braid.isIdentity 3 [ 1; 1 ])
            ok, "word 1,2,1 = Artin twin 2,1,2; sigma^2 != identity (memory held)"
        | "shape-worldline" ->
            // cross-cartridge law: drift must not exceed the lightcone's slope (c = 1 court cell/tick)
            let drift = MediaLines.field "constant" "drift" d |> Option.map int |> Option.defaultValue 99
            drift <= 1, sprintf "drift %d <= lightcone slope 1/1 (stays inside the causal diamond)" drift
        | "shape-lightcone" ->
            let slope = MediaLines.field "constant" "slope" d
            slope = Some "1/1", "slope is exactly the rational 1/1 — c = 1 in court units, no float"
        | "shape-fourcorner" ->
            let declared =
                MediaLines.field "constant" "tsirelson-milli" d |> Option.map int |> Option.defaultValue 0
            let g = TimeGen.mk "acceptance" 1 4UL TimeGen.PhasorTsirelson
            let cl = TimeGen.mk "acceptance" 1 4UL TimeGen.ClassicalCommonCause
            let ok = int (TimeGen.chsh g 256 * 1000.0) = declared && TimeGen.chsh cl 256 <= 2.0 + 1e-9
            ok, sprintf "phasor S reaches exactly the declared %d milli; classical folds at 2" declared
        | "shape-buckyball" ->
            // Addison's solid checked by arithmetic, not trust: Euler characteristic, the
            // face/edge double-count, 3-regularity, and the meta room's door count (rooms + itself).
            let c name = MediaLines.field "constant" name d |> Option.map int |> Option.defaultValue -1
            let v', e, f = c "vertices", c "edges", c "faces"
            let ok =
                v' - e + f = 2 // Euler: a sphere, not a torus or a mistake
                && 12 * 5 + 20 * 6 = 2 * e // every edge borders exactly two rooms
                && 3 * v' = 2 * e // three edges at every corner (the soccer-ball stitch)
                && c "meta-doors" = f + 1 // a door to every room AND itself
            ok, sprintf "Euler %d-%d+%d=2; double-count and 3-regularity close; meta-doors = faces + itself" v' e f
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
        let geomOk, geomEv = geometryLaw shape d
        let travelers = MediaLines.treatiesOf d |> List.filter (fun (_, r, _) -> r = "meaning")
        let meaningEv =
            if List.isEmpty travelers then "no traveler has spoken yet (silence, not error — consent first)"
            else travelers |> List.map (fun (o, _, verdict) -> o + ":" + verdict) |> String.concat " "
        let lintOk = MediaLines.lint d |> List.isEmpty
        let labelsOk =
            lintOk
            && (shape <> "shape-fourcorner"
                || (TimeGen.label (TimeGen.mk "labels" 1 4UL TimeGen.StagedCoincidence)).Contains "STAGED")
        [ v shape Bytes bytesOk (if bytesOk then "a language oracle ratified the byte register" else "no byte-register ratification in the treaty block")
          v shape Geometry geomOk geomEv
          v shape Meaning true meaningEv // reported, never gated: dissent is data
          v shape HonestLabels labelsOk (if labelsOk then "lint clean (WHAT+WHY); shape-specific honesty obligations stand" else "lint findings or a missing honesty label") ]

    /// THE HARD GATE: accepted ⇔ bytes ∧ geometry ∧ honest-labels. Meaning is reported alongside,
    /// never counted — a shape cannot pass because travelers like it, nor fail because one dissents.
    let accepted (verdicts: Verdict list) : bool =
        verdicts
        |> List.forall (fun x -> x.Register = Meaning || x.Accepted)
