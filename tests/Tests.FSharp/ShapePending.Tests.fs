module Zeta.Tests.ShapePendingTests

// `db/shapes/cartridges/pending/` — cartridges written, not yet earned. Until today NOTHING in the
// suite read this directory: the catalog laws glob the top level only (deliberately — a pending file
// must not force a green tick it has not earned), so the README's claim that these are "complete,
// lint-clean" was true but UNCHECKED, and would have stayed true only until someone edited one.
//
// This file gates the pending shelf WITHOUT promoting anything:
//   * every pending cartridge parses, lints clean, and its in-file laws hold;
//   * its `meta shape-zetaid` IS the content-address registration produces (derivable, per the
//     README) — checked here for the first time;
//   * symmetric-vs-braided's known-answer geometry law is exercised, with falsifiers that show it
//     BITES (a law nobody has tried to break is a law nobody has checked);
//   * and THE CONSENT GATE is asserted to still refuse — on `bytes` and on nothing else.
//
// That last one is the point of the whole file. It is a tripwire pointing UP: the day an oracle
// writes its own treaty row, this test goes red and says so, and the file moves out of pending/.

open System.IO
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

let private pendingDir () =
    Path.Combine(repoRoot (), "db", "shapes", "cartridges", "pending")

let private pendingNames () =
    Directory.GetFiles(pendingDir (), "*.lines")
    |> Array.map Path.GetFileNameWithoutExtension
    |> Array.sort
    |> Array.toList

let private docOf (name: string) =
    match MediaLines.parse (File.ReadAllText(Path.Combine(pendingDir (), name + ".lines"))) with
    | Ok d -> d
    | Error e -> failwith (name + ": " + e)

// ── the pending shelf, gated as pending ──

[<Fact>]
let ``every pending cartridge parses, LINTS CLEAN, and no in-file law FAILS — "written, not yet earned" is checked, not asserted`` () =
    let names = pendingNames ()
    Assert.NotEmpty(names) // a vacuous sweep is not a gate (the empty-directory failure mode)
    for n in names do
        let d = docOf n
        Assert.Equal<MediaLines.LintFinding list>([], MediaLines.lint d)
        Assert.True(CartridgeLaw.allHold d, n + ": an in-file law FAILS")

[<Fact>]
let ``THE DERIVABLE ID: each pending cartridge's meta shape-zetaid IS idOf "shape.<name>" 1 — minted from the name, never minted-and-forgotten`` () =
    for n in pendingNames () do
        let d = docOf n
        let declared = MediaLines.field "meta" "shape-zetaid" d
        Assert.Equal(Some(GeneratorRegistry.idOf ("shape." + n) 1), declared)

[<Fact>]
let ``NOTHING IN pending/ IS IN THE CATALOG: the top-level glob and the pending glob are disjoint (the directory IS the gate)`` () =
    let catalog =
        Directory.GetFiles(Path.Combine(repoRoot (), "db", "shapes", "cartridges"), "*.lines")
        |> Array.map Path.GetFileNameWithoutExtension
        |> Set.ofArray
    for n in pendingNames () do
        Assert.False(Set.contains n catalog, n + " is in BOTH — promotion is a move, never a copy")

[<Fact>]
let ``NO GOLDEN MAY EXIST FOR A PENDING CARTRIDGE: an unlocked golden is a check that cannot fail`` () =
    // THE GOLDEN LOCK sweeps the top-level catalog only, so a golden committed for a pending file
    // would be locked by nothing and could drift from its cartridge silently — precisely the class
    // of dead artifact this repo keeps finding. `zeta shape render` already refuses to emit one
    // (it gates on FULL acceptance, `bytes` included); this makes the absence enforced, not lucky.
    for n in pendingNames () do
        for ext in [ "svg"; "html" ] do
            let g = Path.Combine(repoRoot (), "db", "shapes", "golden", n + "." + ext)
            Assert.False(File.Exists g, sprintf "%s: goldens land when the gate opens, and only then" g)

// ── symmetric-vs-braided: the known-answer geometry law, and the falsifiers that show it bites ──

let private symBraided () = docOf "symmetric-vs-braided"

[<Fact>]
let ``THE CONTRAST HOLDS: one word read twice — identical permutation, opposite occlusion register, checked by computation`` () =
    let d = symBraided ()
    let ok, evidence = ShapeAcceptance.geometryLaw "shape-symmetric-vs-braided" d
    Assert.True(ok, evidence)
    // the ink itself, counted: the symmetric panel is 2 unbroken strands, the braided one is those
    // same 2 strands broken once per crossing. That difference is the entire cartridge.
    let runs tag =
        ShapeRender.strokesOf d
        |> List.filter (fun s -> s.Name.StartsWith(tag + "-strand-", System.StringComparison.Ordinal))
        |> List.length
    Assert.Equal(2, runs "sym")
    Assert.Equal(4, runs "brd")

[<Fact>]
let ``ONE WORD, TWO PANELS: both panels' strands start and end in their OWN columns — the forgetful shadow cannot tell them apart`` () =
    let strokes = ShapeRender.strokesOf (symBraided ())
    for tag in [ "sym"; "brd" ] do
        for s in 0 .. 1 do
            let ownRuns =
                strokes
                |> List.filter (fun st -> st.Name.StartsWith(sprintf "%s-strand-%d" tag s, System.StringComparison.Ordinal))
            let firstX = (List.head ownRuns).Points |> List.head |> fst
            let lastX = (List.last ownRuns).Points |> List.last |> fst
            // the COLUMN is the claim (the row of course differs — that is just time passing):
            // in at column c, out at column c, in BOTH readings. That is perm = identity, drawn.
            Assert.Equal(firstX, lastX)

[<Fact>]
let ``THE COURT LAW holds for the pending render too: every point of every stroke is on the 640x320 court`` () =
    for n in pendingNames () do
        for s in ShapeRender.strokesOf (docOf n) do
            for (x, y) in s.Points do
                Assert.True(x >= 0 && x <= 640 && y >= 0 && y <= 320, sprintf "%s/%s (%d,%d) off court" n s.Name x y)

[<Fact>]
let ``BIDIRECTIONAL for the pending render: fromSvg(toSvg d) returns exactly the strokes — the treaty dialect holds before ratification too`` () =
    let d = symBraided ()
    match ShapeRender.fromSvg (ShapeRender.toSvg d) with
    | Error e -> Assert.True(false, e)
    | Ok parsed ->
        let expected = ShapeRender.strokesOf d |> List.map (fun st -> st.Name, st.Points)
        Assert.Equal<(string * (int * int) list) list>(expected, parsed)

[<Fact>]
let ``THE BEN LINE agrees with the shelf: the cartridge's own cost prediction matches the registry row`` () =
    let d = symBraided ()
    let checks = ComplexityRegistry.benCheck d
    Assert.NotEmpty(checks) // a vacuous sweep proves nothing
    for b in checks do
        Assert.True(b.Ok, b.Evidence)

// ── falsifiers: MUTANTS PLANTED AGAINST THIS GATE, each shown to die ──

let private mutateConstant (name: string) (value: string) (d: MediaLines.Doc) =
    { d with
        MediaLines.Entries =
            d.Entries
            |> List.map (fun e ->
                if e.Kind = "constant" && e.Name = name then { e with MediaLines.Fields = value :: List.tail e.Fields } else e) }

let private geomOf (d: MediaLines.Doc) = fst (ShapeAcceptance.geometryLaw "shape-symmetric-vs-braided" d)

[<Fact>]
let ``MUTANT — the do-undo word: sigma·sigma-inverse satisfies every integer line in the file and teaches NOTHING; the gate refuses it`` () =
    // THE mutant that matters. [1;-1] keeps 2 crossings, keeps the identity permutation, keeps both
    // panels' gap counts — and collapses in BOTH categories, so there is no contrast left to draw.
    // A gate that missed this would accept a cartridge whose whole thesis had evaporated.
    Assert.False(geomOf (mutateConstant "word" "1,-1" (symBraided ())))

[<Fact>]
let ``MUTANT — the file lies about which reading collapses: flipping right-square-id to 1 dies against Artin`` () =
    Assert.False(geomOf (mutateConstant "right-square-id" "1" (symBraided ())))

[<Fact>]
let ``MUTANT — the file lies about the ink: gaps-right = 1 dies against the strokes the renderer actually emits`` () =
    Assert.False(geomOf (mutateConstant "gaps-right" "1" (symBraided ())))

[<Fact>]
let ``MUTANT — a gap smuggled into the symmetric panel: gaps-left = 2 dies (a symmetric swap has no over/under to remember)`` () =
    Assert.False(geomOf (mutateConstant "gaps-left" "2" (symBraided ())))

[<Fact>]
let ``MUTANT — the word and the declared crossing count disagree: dropping a letter dies`` () =
    Assert.False(geomOf (mutateConstant "word" "1" (symBraided ())))

[<Fact>]
let ``MUTANT — the permutation claim is false: an odd word leaves the strands swapped and dies`` () =
    let d = mutateConstant "word" "1,1,1" (symBraided ()) |> mutateConstant "crossings" "3"
    Assert.False(geomOf d)

// ── traced: the refusal, and the falsifiers that show the refusal is a CHECK and not a wish ──

let private traced () = docOf "traced"

let private geomTraced (d: MediaLines.Doc) = fst (ShapeAcceptance.geometryLaw "shape-traced" d)

[<Fact>]
let ``A BEND IS NOT A CROSSING: the trace figure draws two wires that never meet, and the gate counts the intersections rather than trusting the names`` () =
    let d = traced ()
    let ok, evidence = ShapeAcceptance.geometryLaw "shape-traced" d
    Assert.True(ok, evidence)
    // the ink, counted independently of the gate: two wires, each ONE unbroken polyline (no runs ⇒
    // no occlusion gaps), four corner markers, one box.
    let strokes = ShapeRender.strokesOf d
    let byPrefix (p: string) = strokes |> List.filter (fun s -> s.Name.StartsWith(p, System.StringComparison.Ordinal))
    Assert.Equal(2, List.length (byPrefix "wire-"))
    Assert.Equal(4, List.length (byPrefix "corner-"))
    Assert.Equal(1, strokes |> List.filter (fun s -> s.Name = "box") |> List.length)
    // and the sign register: exactly one dashed wire, the -1 retraction (WSet.negate)
    Assert.Equal(1, byPrefix "wire-" |> List.filter (fun s -> s.Dash) |> List.length)

[<Fact>]
let ``THE LOOP LANDS ON THE FEEDBACK CORNER: the return path's ends ARE TOutFeedback and TInFeedback — a pipeline would land on TOut`` () =
    let strokes = ShapeRender.strokesOf (traced ())
    let center (n: string) =
        let s = strokes |> List.find (fun s -> s.Name = n)
        let xs, ys = s.Points |> List.map fst, s.Points |> List.map snd
        (List.min xs + List.max xs) / 2, (List.min ys + List.max ys) / 2
    let feedback = strokes |> List.find (fun s -> s.Name = "wire-feedback")
    Assert.Equal(center "corner-toutfeedback", List.head feedback.Points)
    Assert.Equal(center "corner-tinfeedback", List.last feedback.Points)
    // it bends in SPACE: the return leaves its own channel height in between (around the box),
    // so nothing in the figure reads as an arrow travelling back along a time axis.
    let ys = feedback.Points |> List.map snd
    Assert.True(List.max ys > snd (List.head feedback.Points))
    Assert.Equal(snd (List.head feedback.Points), snd (List.last feedback.Points))

[<Fact>]
let ``THE BEN LINE agrees with the shelf for traced too: the cartridge's own cost prediction matches the registry row`` () =
    let checks = ComplexityRegistry.benCheck (traced ())
    Assert.NotEmpty(checks) // a vacuous sweep proves nothing
    for b in checks do
        Assert.True(b.Ok, b.Evidence)

// The mutants below are planted against the ZERO-COUNT law the cartridge originally proposed
// ("count crossings and gaps, require both zero"). Every one of them satisfies it. That is the
// finding this gate work banks: the proposed law was mechanical, true, and unable to fail.

[<Fact>]
let ``MUTANT — THE VACUITY CLASS: an EMPTY picture has zero crossings and zero gaps and is passed by the proposed law; this gate refuses it`` () =
    // strokesOf returns [] for a cartridge outside the figure's vocabulary (wires <> 2). Zero
    // crossings, zero gaps, nothing drawn — the exact drawing the original law could not reject.
    let d = mutateConstant "wires" "3" (traced ())
    Assert.Empty(ShapeRender.strokesOf d)
    Assert.False(geomTraced d)

[<Fact>]
let ``MUTANT — the file lies about the ink: loop-crossings = 1 dies against the segment arithmetic (there is no crossing to find)`` () =
    Assert.False(geomTraced (mutateConstant "loop-crossings" "1" (traced ())))

[<Fact>]
let ``MUTANT — an occlusion gap claimed where none is drawn: gaps = 1 dies (a gap would import a braiding this structure does not have)`` () =
    Assert.False(geomTraced (mutateConstant "gaps" "1" (traced ())))

[<Fact>]
let ``MUTANT — the annihilation breaks: retract-weight = -2 leaves +1 and -2 failing to cancel, and the sign in the ink no longer matches the file`` () =
    Assert.False(geomTraced (mutateConstant "retract-weight" "-2" (traced ())))

[<Fact>]
let ``MUTANT — the retraction turned positive: retract-weight = 1 means nothing is un-emitted, and the dashed wire in the ink contradicts it`` () =
    let d = mutateConstant "retract-weight" "1" (traced ())
    Assert.False(geomTraced d)
    // and the drawing MOVES with the constant — the sign is read from the file, not hardcoded
    let dashes = ShapeRender.strokesOf d |> List.filter (fun s -> s.Dash) |> List.length
    Assert.Equal(0, dashes)

[<Fact>]
let ``MUTANT — the feedback claim withdrawn: feedback-on-input = 0 dies while the figure still lands the loop on TInFeedback`` () =
    Assert.False(geomTraced (mutateConstant "feedback-on-input" "0" (traced ())))

[<Fact>]
let ``MUTANT — the corner count drifts: corners = 6 dies (the ownership object the trace closes over is a FOUR-corner object)`` () =
    Assert.False(geomTraced (mutateConstant "corners" "6" (traced ())))

[<Fact>]
let ``THE GATE CAN SEE A CROSSING: hand a wrong drawing to the same arithmetic and it counts one — the zero is measured, not assumed`` () =
    // The falsifier that matters for a law made of zeroes. The cartridge is untouched; what is
    // perturbed is the DRAWING, by asking the gate to read a figure whose return path cuts straight
    // back across the pass-through wire — the exact renderer mistake ("quietly drew a braid") the
    // law exists to catch. Proved here by construction rather than asserted, because the geometry
    // law reads ShapeRender's output and a test cannot edit ShapeRender.
    let orient (ax, ay) (bx, by) (px, py) = sign ((bx - ax) * (py - ay) - (by - ay) * (px - ax))
    let onSeg a b p =
        let (ax, ay), (bx, by), (px, py) = a, b, p
        orient a b p = 0 && min ax bx <= px && px <= max ax bx && min ay by <= py && py <= max ay by
    let meet (a, b) (p, q) =
        (orient a b p * orient a b q < 0 && orient p q a * orient p q b < 0)
        || onSeg a b p || onSeg a b q || onSeg p q a || onSeg p q b
    // the real figure's two wires: no intersection anywhere
    let strokes = ShapeRender.strokesOf (traced ())
    let segsOf n =
        (strokes |> List.find (fun s -> s.Name = n)).Points |> List.pairwise
    let count a b = [ for x in segsOf a do for y in segsOf b do if meet x y then yield 1 ] |> List.length
    Assert.Equal(0, count "wire-through" "wire-feedback")
    // …and the SAME arithmetic on a return path drawn straight back through the channel finds it
    let badReturn = [ (425, 145 - 40); (425, 145 + 40) ] |> List.pairwise
    let through = segsOf "wire-through"
    Assert.Equal(1, [ for x in through do for y in badReturn do if meet x y then yield 1 ] |> List.length)

// ── THE CONSENT GATE — the one thing this work did not touch, asserted to still hold ──

[<Fact>]
let ``THE CONSENT GATE STANDS: symmetric-vs-braided passes geometry and honest-labels and is REFUSED on bytes alone — the treaty is nobody else's to write`` () =
    let verdicts = ShapeAcceptance.acceptOne (symBraided ())
    let reg r = verdicts |> List.find (fun v -> v.Register = r)
    Assert.True((reg ShapeAcceptance.Geometry).Accepted, "geometry must pass — gate 3 is closed")
    Assert.True((reg ShapeAcceptance.HonestLabels).Accepted, "honest labels must pass")
    Assert.False((reg ShapeAcceptance.Bytes).Accepted, "bytes must NOT pass: no oracle has been asked")
    Assert.False(
        ShapeAcceptance.accepted verdicts,
        "REFUSED, and correctly so. When this assertion fails it means an oracle wrote its own treaty row — "
        + "at that moment this cartridge should MOVE to db/shapes/cartridges/ (a move, not a copy), its goldens "
        + "should be generated with `zeta shape render`, ShapeCartridge.Tests' catalog count should go 19 -> 20, "
        + "and the pending-golden assertion above should stop covering it. Do not silence this test; promote the file."
    )

[<Fact>]
let ``THE CONSENT GATE STANDS FOR traced TOO: geometry and honest-labels pass, bytes is REFUSED, and the treaty is nobody else's to write`` () =
    let verdicts = ShapeAcceptance.acceptOne (traced ())
    let reg r = verdicts |> List.find (fun v -> v.Register = r)
    Assert.True((reg ShapeAcceptance.Geometry).Accepted, "geometry must pass — gate 3 is closed")
    Assert.True((reg ShapeAcceptance.HonestLabels).Accepted, "honest labels must pass")
    Assert.False((reg ShapeAcceptance.Bytes).Accepted, "bytes must NOT pass: no oracle has been asked")
    Assert.False(
        ShapeAcceptance.accepted verdicts,
        "REFUSED, and correctly so. When this assertion fails it means an oracle wrote its own treaty row — "
        + "promote the file then (a move, not a copy), generate its goldens, and step the catalog count. Do not silence this test."
    )

[<Fact>]
let ``twist IS STILL REFUSED ON GEOMETRY, and that is the honest state: no known-answer law exists for it yet`` () =
    // The third pending cartridge got NO gate work this pass, and saying so out loud is the point —
    // an untouched cartridge that quietly looked finished would be the failure pending/ exists to
    // prevent. `twist` has no registered generator, no stroke branch and no geometry case, so the
    // default refusal stands and names itself.
    let ok, evidence = ShapeAcceptance.geometryLaw "shape-twist" (docOf "twist")
    Assert.False(ok)
    Assert.Contains("no known-answer law", evidence)
    Assert.Empty(ShapeRender.strokesOf (docOf "twist"))
    Assert.True((GeneratorRegistry.byName "shape.twist").IsNone, "unregistered, and honestly so")

[<Fact>]
let ``NO CARTRIDGE IN pending/ CARRIES A TREATY ROW: consent is absent because nobody has been asked, not because nobody noticed`` () =
    for n in pendingNames () do
        Assert.Empty(MediaLines.treatiesOf (docOf n))
