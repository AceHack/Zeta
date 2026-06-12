module Zeta.Tests.ShapeAcceptanceTests

// Amara's renderer acceptance suite + the bidirectional strict-dialect treaty (SVG/HTML):
// no shape is accepted because it looks good — geometry must satisfy its known-answer law;
// renders are TEXT goldens (the cross-oracle treaty surface); the parser refuses foreign habits.

open System.IO
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

let private docOf (name: string) =
    match MediaLines.parse (File.ReadAllText(Path.Combine(repoRoot (), "db", "shapes", "cartridges", name + ".lines"))) with
    | Ok d -> d
    | Error e -> failwith e

// derived from the directory (test-gap audit #3: the hand list let a 14th cartridge bypass every
// gate here until someone remembered to add it — now a new cartridge is gated the moment it lands)
let private shapes =
    Directory.GetFiles(Path.Combine(repoRoot (), "db", "shapes", "cartridges"), "*.lines")
    |> Array.map Path.GetFileNameWithoutExtension
    |> Array.sort
    |> Array.toList

[<Fact>]
let ``THE HARD GATE: every catalog shape is accepted on bytes+geometry+honest-labels — never on looks, never on meaning`` () =
    for s in shapes do
        let verdicts = ShapeAcceptance.acceptOne (docOf s)
        Assert.True(ShapeAcceptance.accepted verdicts, s)
        // geometry was computed, not eyeballed: its evidence names a law
        let geom = verdicts |> List.find (fun x -> x.Register = ShapeAcceptance.Geometry)
        Assert.True(geom.Accepted, s + ": " + geom.Evidence)

[<Fact>]
let ``meaning is reported, never gated: a dissenting traveler changes the report, not the acceptance`` () =
    let d = docOf "spiral"
    let dissent = { MediaLines.Kind = "treaty"; MediaLines.Name = "amara"; MediaLines.Fields = [ "meaning"; "dissent"; "galaxy not clock" ] }
    let d' = { d with MediaLines.Entries = d.Entries @ [ dissent ] }
    Assert.True(ShapeAcceptance.accepted (ShapeAcceptance.acceptOne d'))
    let meaning = ShapeAcceptance.acceptOne d' |> List.find (fun x -> x.Register = ShapeAcceptance.Meaning)
    Assert.Contains("amara:dissent", meaning.Evidence)

[<Fact>]
let ``a shape with NO known-answer law cannot pass geometry — looks are not a law`` () =
    let txt = "meta\tname\tshape-vibes\ntreaty\tfsharp\tbytes\tratified\ttrust me\n"
    let d = MediaLines.parse txt |> Result.toOption |> Option.get
    Assert.False(ShapeAcceptance.accepted (ShapeAcceptance.acceptOne d))

[<Fact>]
let ``THE GOLDEN LOCK: every committed SVG and HTML golden is byte-identical to the cartridge's regenerated projection`` () =
    for s in shapes do
        let d = docOf s
        let golden ext = File.ReadAllText(Path.Combine(repoRoot (), "db", "shapes", "golden", s + "." + ext))
        Assert.Equal<string>(golden "svg", ShapeRender.toSvg d)
        Assert.Equal<string>(golden "html", ShapeRender.toHtml d)

[<Fact>]
let ``BIDIRECTIONAL: fromSvg(toSvg d) returns exactly the strokes' points — the round-trip is the treaty`` () =
    for s in shapes do
        let d = docOf s
        match ShapeRender.fromSvg (ShapeRender.toSvg d) with
        | Error e -> Assert.True(false, s + ": " + e)
        | Ok parsed ->
            let expected = ShapeRender.strokesOf d |> List.map (fun st -> st.Name, st.Points)
            Assert.Equal<(string * (int * int) list) list>(expected, parsed)

[<Fact>]
let ``their habits stay outside: script, floats, and foreign elements are REFUSED, not best-effort read`` () =
    Assert.True(ShapeRender.fromSvg "<svg><script>alert(1)</script></svg>" |> Result.isError)
    Assert.True(ShapeRender.fromSvg "<svg>\n<polyline id=\"a\" points=\"1.5,2 3,4\" />\n</svg>" |> Result.isError)
    Assert.True(ShapeRender.fromSvg "<svg>\n<image href=\"x\" />\n</svg>" |> Result.isError)
    // and the HTML projection never carries JavaScript (the HtmlCssBinding law, held here too)
    for s in shapes do
        Assert.DoesNotContain("<script", ShapeRender.toHtml (docOf s))

[<Fact>]
let ``same shape, several ways, different O: a shape is parametrized over its cost — both spiral strategies are tagged`` () =
    let strategies = ComplexityRegistry.strategiesOf "shape.spiral" |> Map.ofList
    Assert.Equal(2, Map.count strategies)
    Assert.Equal("O(steps)", strategies.["draw"].Time)
    Assert.Equal("O(w·h·steps)", strategies.["draw-grid"].Time)
    Assert.NotEqual<string>(strategies.["draw"].Time, strategies.["draw-grid"].Time) // a real tradeoff, not a duplicate tag
    // and the budget lint still holds shelf-wide: every strategy is still a stated cost
    Assert.Empty(ComplexityRegistry.unstated ())

[<Fact>]
let ``HOMOICONIC LAWS: the buckyball's own law lines check from its own constants — and a broken law fails the gate`` () =
    let d = docOf "buckyball"
    let verdicts = CartridgeLaw.check d
    Assert.Equal(4, List.length verdicts) // euler, double-count, three-regular, self-door
    Assert.True(CartridgeLaw.allHold d)
    Assert.True(ShapeAcceptance.accepted (ShapeAcceptance.acceptOne d))
    // sabotage: a wrong constant breaks the IN-FILE law and the geometry gate with it
    let broken =
        { d with
            MediaLines.Entries =
                d.Entries
                |> List.map (fun e ->
                    if e.Kind = "constant" && e.Name = "edges" then { e with MediaLines.Fields = "89" :: List.tail e.Fields } else e) }
    Assert.False(CartridgeLaw.allHold broken)
    Assert.False(ShapeAcceptance.accepted (ShapeAcceptance.acceptOne broken))

[<Fact>]
let ``the self-description kinds carry: prereqs point somewhere, edges name the graph, issues are owned, math sign-off is PENDING not assumed`` () =
    let d = docOf "buckyball"
    Assert.Equal(3, List.length (MediaLines.ofKind "prereq" d))
    Assert.Equal(3, List.length (MediaLines.ofKind "edge" d))
    Assert.Equal(3, List.length (MediaLines.ofKind "issue" d)) // schlegel (open) + tear-down (closed) + ray-overshoot (closed, THE COURT LAW's second catch)
    Assert.Contains(("math-team", "math", "pending"), MediaLines.treatiesOf d)
    Assert.Empty(MediaLines.lint d) // all of it lints clean (structure checked, future kinds silent)

[<Fact>]
let ``delegated laws name their checker: tool-prefixed laws are documented here, checked there — and Aaron's ratification is in the treaty block`` () =
    let txt = "meta\tname\tdemo\nconstant\tn\t4\twhat\twhy\nlaw\tarith\tn = 4\nlaw\tliveness\ttla:SpineSpec.EventuallyDrains\nlaw\tsat\tz3:fourcorner-bound\n"
    let d = MediaLines.parse txt |> Result.toOption |> Option.get
    let verdicts = CartridgeLaw.check d
    Assert.True(CartridgeLaw.allHold d)
    Assert.Contains(verdicts, fun v -> v.Law = "liveness" && v.Evidence.Contains "checked by tla")
    Assert.Contains(verdicts, fun v -> v.Law = "sat" && v.Evidence.Contains "checked by z3")
    // the first human-traveler render-loop ratification, recorded by his own words
    Assert.Contains(("aaron", "meaning", "ratified"), MediaLines.treatiesOf (docOf "buckyball"))

[<Fact>]
let ``BRUNNIAN AT THE BRAID LEVEL: delete ANY strand from the locked plait and the survivors comb straight — the stuckness lives in all three jointly`` () =
    let locked = [ 1; -2; 1; -2; 1; -2 ]
    for s in 0 .. 2 do
        let survivors = Braid.deleteStrand 3 s locked
        Assert.True(Braid.isIdentity 2 survivors, sprintf "deleting strand %d must trivialize the rest" s)
    // the falsifier: sigma1^2 with a bystander deleted is STILL a nontrivial 2-braid (not Brunnian)
    Assert.False(Braid.isIdentity 2 (Braid.deleteStrand 3 2 [ 1; 1 ]))
    // and the whole locked braid itself is NOT trivial (stuck) — the joint twist, restated
    Assert.False(Braid.isIdentity 3 locked)

[<Fact>]
let ``the writhe-parity character is a homomorphism: parity(ab) = parity(a) XOR parity(b); every generator maps to 1 (Soraya's mod2, in code)`` () =
    let words = [ []; [ 1 ]; [ -2 ]; [ 1; -2; 1 ]; [ 1; -2; 1; -2; 1; -2 ]; [ 2; 2 ]; [ 1; 2; 1 ] ]
    for a in words do
        for b in words do
            Assert.Equal((Braid.writheParity a + Braid.writheParity b) % 2, Braid.writheParity (a @ b))
    Assert.Equal(1, Braid.writheParity [ 1 ])
    Assert.Equal(1, Braid.writheParity [ -2 ]) // sigma inverse ALSO maps to 1 (not a signed count)
    Assert.Equal(0, Braid.writheParity [ 1; -1 ]) // do-undo is even — consistent with identity

// ── round-2 tear-down regression gates (Kira + the silent-failure hunter, 2026-06-12) ──

[<Fact>]
let ``INJECTION REFUSED: a hostile cartridge name cannot break out of the SVG attribute or smuggle script into the HTML`` () =
    let hostile = "meta\tname\tx</title><script>alert(1)</script>\"<svg\nconstant\tn\t1\twhat\twhy\n"
    let d = MediaLines.parse hostile |> Result.toOption |> Option.get
    let svg = ShapeRender.toSvg d
    let html = ShapeRender.toHtml d
    Assert.DoesNotContain("<script", svg)
    Assert.DoesNotContain("<script", html)
    Assert.DoesNotContain("alert(1)</title>", html) // the payload arrives escaped, not live
    Assert.Contains("&lt;script&gt;", html)

[<Fact>]
let ``FROMSVG IS TOTAL: exponents, garbage, overflow, case-tricks, single-quoted dashes, and smuggled one-liners are REFUSALS, not crashes`` () =
    let refused (s: string) =
        match ShapeRender.fromSvg s with
        | Error _ -> true
        | Ok _ -> false
    Assert.True(refused "<svg>\n<polyline id=\"a\" points=\"1,1e3\" />\n</svg>") // exponent
    Assert.True(refused "<svg>\n<polyline id=\"a\" points=\"1,abc\" />\n</svg>") // garbage
    Assert.True(refused "<svg>\n<polyline id=\"a\" points=\"1,99999999999999999999\" />\n</svg>") // overflow
    Assert.True(refused "<svg>\n<SCRIPT>alert(1)</SCRIPT>\n</svg>") // case trick
    Assert.True(refused "<svg>\n<polyline id=\"a\" stroke-dasharray='9 9' points=\"1,2 3,4\" />\n</svg>") // single quotes
    Assert.True(refused "<svg><polyline id=\"a\" points=\"1,2 3,4\" /><image href=\"x\" /></svg>") // one-line smuggle

[<Fact>]
let ``DELEGATION TO NOWHERE IS EVASION: an unknown tool prefix FAILS the law and the gate with it`` () =
    let txt = "meta\tname\tdemo\nconstant\tn\t4\twhat\twhy\nlaw\thonesty\tmadeuptool:nothing\n"
    let d = MediaLines.parse txt |> Result.toOption |> Option.get
    Assert.False(CartridgeLaw.allHold d)
    // and a KNOWN tool delegates without vouching: not Fails, not Holds
    let txt2 = "meta\tname\tdemo\nconstant\tn\t4\twhat\twhy\nlaw\tliveness\ttla:Spec.Drains\n"
    let d2 = MediaLines.parse txt2 |> Result.toOption |> Option.get
    let v = CartridgeLaw.check d2 |> List.head
    Assert.Equal(CartridgeLaw.Delegated "tla", v.Status)
    Assert.True(CartridgeLaw.allHold d2)

[<Fact>]
let ``LAW ARITHMETIC NEVER WRAPS: an overflowing product is a refusal, not a zero that holds`` () =
    let txt = "meta\tname\tdemo\nlaw\twrap\t1000000 * 1000000 * 1000000 * 1000000 = 0\n"
    let d = MediaLines.parse txt |> Result.toOption |> Option.get
    Assert.False(CartridgeLaw.allHold d)

[<Fact>]
let ``THE LINT CATCHES TYPO'D KINDS AND ODD HEX: 'constent' is a near-miss finding, a dangling nibble is corruption`` () =
    let d = MediaLines.parse "meta\tname\tdemo\nconstent\tn\t4\twhat\twhy\n" |> Result.toOption |> Option.get
    Assert.Contains(MediaLines.lint d, fun f -> f.Problem.Contains "one letter from 'constant'")
    let d2 = MediaLines.parse "meta\tname\tdemo\nframe\tf\tabc\n" |> Result.toOption |> Option.get
    Assert.Contains(MediaLines.lint d2, fun f -> f.Problem.Contains "odd length")

[<Fact>]
let ``THE RED LIGHT: every io binding visible — REC for live/adapted/injected, off for mock (no agent recorded without knowledge)`` () =
    let want = GeneratorRegistry.idOf "algebra.z2-parity" 1
    let have = GeneratorRegistry.idOf "algebra.braid-memory" 1
    let txt = sprintf "meta\tname\tdemo\nio\tmic\t%s\nio\ttape\t%s\n" want have
    let d = MediaLines.parse txt |> Result.toOption |> Option.get
    let report = MediaLines.bindingsReport (MediaLines.resolveIo (Set.ofList [ have ]) Set.empty) d
    let lights = report |> List.map MediaLines.bindingLight
    Assert.Contains(lights, fun (l: string) -> l.Contains "[off ○] mic MOCK")
    Assert.Contains(lights, fun (l: string) -> l.Contains "[REC ●] tape LIVE")
    // an adapter sourced from a GRANTED capability now binds Adapted (the ladder's missing rung)
    match MediaLines.resolveIoWith [ have, want, "mod2" ] Set.empty (Set.ofList [ have ]) { MediaLines.Kind = "io"; MediaLines.Name = "mic"; MediaLines.Fields = [ want ] } with
    | MediaLines.Adapted _ -> ()
    | other -> Assert.True(false, sprintf "expected Adapted via granted capability, got %A" other)

// ── round-3 regression gates (Kira r3 + the test-gap audit, 2026-06-13) ──

[<Fact>]
let ``TREEMAP CONSERVES AREA even with negative weights: no box ever exceeds the boundary (Kira r3 P0)`` () =
    let tiles = LayoutEngine.treemap 0 0 100 10 true [ "a", 10; "b", -5 ]
    for r in tiles do
        Assert.True(r.X >= 0 && r.X + r.W <= 100, "a tile escaped the boundary")

[<Fact>]
let ``VF IS THE FLAG, EVEN WHEN VF IS AN OPERAND: 8F05 with x=F keeps the flag write (both machines agree)`` () =
    // V[F]=200, V[1]=50; 8F15 (VF = VF - V1): result 150 but the FLAG write wins per spec -> VF=1
    let rom = [| 0x6Fuy; 200uy; 0x61uy; 50uy; 0x8Fuy; 0x15uy |]
    let cow = Chip8Cow.create 7UL |> Chip8Cow.loadRom rom
    let f = [ 1..3 ] |> List.fold (fun s _ -> Chip8Cow.step s) cow
    Assert.Equal(1uy, f.V.[0xF]) // the flag, not the difference


[<Fact>]
let ``HTMLCSSBINDING INJECTION FALSIFIER: a hostile motto cannot smuggle script through render (test-gap #2)`` () =
    let hostile = "meta\tname\tx\nmeta\tmotto\t</style><script>alert(1)</script>\nframe\tidle\tff\nanim\tbreathe\tidle\npalette\t1\tred\n"
    match MediaLines.parse hostile with
    | Error e -> Assert.True(false, e)
    | Ok d ->
        let html = HtmlCssBinding.render d
        Assert.DoesNotContain("<script", html)

[<Fact>]
let ``the generator shelf has ZERO ZetaId collisions (distinct names never share an id — byId shadowing surfaced, not silent)`` () =
    Assert.Equal<(string * string list) list>([], GeneratorRegistry.collisions ())

[<Fact>]
let ``THE BEN LINE: every cartridge's in-file cost prediction agrees with the registry — the shelf sweep is the gate`` () =
    for s in shapes do
        let d = docOf s
        for b in ComplexityRegistry.benCheck d do
            Assert.True(b.Ok, sprintf "%s ben %s/%s: %s" s b.Artifact b.Op b.Evidence)
    // the three new rooms actually CARRY the line (the sweep must not be vacuous shelf-wide)
    for named in [ "softvalue"; "dynamicvalue"; "triboolean" ] do
        Assert.NotEmpty(ComplexityRegistry.benCheck (docOf named))

[<Fact>]
let ``BEN FALSIFIERS: garbage O, a missing registry row, and a lying prediction all REFUSE — and a bare ben line is a lint finding`` () =
    let docFrom (benLine: string) =
        MediaLines.parse ("meta\tname\tshape-test\n" + benLine + "\n") |> Result.toOption |> Option.get
    // garbage O: refusal, never a guess
    let garbage = ComplexityRegistry.benCheck (docFrom "ben\tdraw\tshape.dynamicvalue\tO(vibes^^)")
    Assert.False((List.exactlyOne garbage).Ok)
    // no registry row: a prediction must point at a stated shelf cost
    let missing = ComplexityRegistry.benCheck (docFrom "ben\tdraw\tshape.never-registered\tO(n)")
    Assert.False((List.exactlyOne missing).Ok)
    Assert.Contains("no registry row", (List.exactlyOne missing).Evidence)
    // the lie: registry says O(children) (degree 1); the cartridge claims O(children²)
    let lying = ComplexityRegistry.benCheck (docFrom "ben\tdraw\tshape.dynamicvalue\tO(children²)")
    Assert.False((List.exactlyOne lying).Ok)
    Assert.Contains("DISAGREES", (List.exactlyOne lying).Evidence)
    // agreement passes (same shape, written differently is NOT required — exact parse equality is)
    let honest = ComplexityRegistry.benCheck (docFrom "ben\tdraw\tshape.dynamicvalue\tO(children)")
    Assert.True((List.exactlyOne honest).Ok)
    Assert.True(ComplexityRegistry.benHolds (docFrom "ben\tdraw\tshape.dynamicvalue\tO(children)"))
    // structural honesty: a ben line without its two fields is a lint finding, not a silent pass
    let bare = docFrom "ben\tdraw\tshape.only-artifact"
    Assert.NotEmpty(MediaLines.lint bare)
