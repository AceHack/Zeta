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
    match MediaLines.parse (File.ReadAllText(Path.Combine(repoRoot (), "shapes", "cartridges", name + ".lines"))) with
    | Ok d -> d
    | Error e -> failwith e

let private shapes = [ "spiral"; "braid"; "worldline"; "lightcone"; "fourcorner"; "seam"; "buckyball"; "shadow-loop"; "plait-move"; "adinkra"; "exchange-worldlines"; "kitaev-chain"; "crossing" ]

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
        let golden ext = File.ReadAllText(Path.Combine(repoRoot (), "shapes", "golden", s + "." + ext))
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
    Assert.Equal(2, List.length (MediaLines.ofKind "issue" d)) // schlegel projection + the owed tear-down
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
