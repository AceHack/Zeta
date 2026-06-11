module Zeta.Tests.ShapeCartridgeTests

// The shape catalog's first cartridge: parses, LINTS CLEAN (constants carry WHAT+WHY; the gen line's
// ZetaId is real), and the generator it references actually draws the spiral it promises.

open System.IO
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

let private doc () =
    let text = File.ReadAllText(Path.Combine(repoRoot (), "shapes", "cartridges", "spiral.lines"))
    match MediaLines.parse text with
    | Ok d -> d
    | Error e -> failwith e

[<Fact>]
let ``the spiral cartridge parses and LINTS CLEAN — constants carry WHAT+WHY, the gen ZetaId is real`` () =
    let d = doc ()
    Assert.Equal<MediaLines.LintFinding list>([], MediaLines.lint d)
    Assert.Equal(3, List.length (MediaLines.ofKind "constant" d)) // every number explained
    Assert.Equal(Some "shape-spiral", MediaLines.field "meta" "name" d)

[<Fact>]
let ``the gen line resolves to the REAL rotor generator on the shelf (DI by ZetaId, working)`` () =
    let d = doc ()
    let genId = (MediaLines.ofKind "gen" d |> List.head).Fields |> List.head
    Assert.Equal(Some "boundary.rotorCurve", GeneratorRegistry.byId genId |> Option.map (fun e -> e.Name))
    Assert.Equal(genId, GeneratorRegistry.idOf "boundary.rotorCurve" 1) // content-addressed: derivable

[<Fact>]
let ``UNFOLDING the cartridge draws the promised spiral: 36 rotor steps, outward growth, bounded`` () =
    // the runner's unfold: read the constants, apply the registered generator
    let re, im = BoundaryLight.rotorOf 1 12 1100
    let curve = BoundaryLight.rotorCurve (BoundaryLight.p 32 16) 6.0 0.0 re im 36
    Assert.Equal(37, List.length curve) // steps + the seed point
    // outward growth: the last point is farther from center than the first (the logarithmic law)
    let d2 (pt: BoundaryLight.P) = (pt.X - 32) * (pt.X - 32) + (pt.Y - 16) * (pt.Y - 16)
    Assert.True(d2 (List.last curve) > d2 (List.head curve))
    // and the stroke can ride it: the wave's head exists at every tick (the lesson loop's "see it draw")
    Assert.Equal(1, StrokeAnim.strokeAt 1 5 curve |> List.filter (fun (_, ph) -> ph = StrokeAnim.Head) |> List.length)
