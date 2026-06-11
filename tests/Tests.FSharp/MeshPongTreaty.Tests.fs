module Zeta.Tests.MeshPongTreatyTests

// The GAME-STATE TREATY — the F# oracle replays the shared session and byte-locks the checkpoints
// (src/Core.TypeScript/mesh-pong/golden-vectors.lines). C#/TS/Rust replay the SAME file through their
// own pure `step` and must hit identical lines: four compilers, one match, one world.

open System.IO
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

let private goldenPath =
    Path.Combine(repoRoot (), "src", "Core.TypeScript", "mesh-pong", "golden-vectors.lines")

/// Parse the golden: `i<TAB>tick<TAB>payload` inputs + `c<TAB>tick<TAB>state-line` checkpoints.
/// (The state line itself contains tabs — split on the FIRST TWO tabs only.)
let private parseGolden () =
    let split2 (line: string) =
        let i1 = line.IndexOf '\t'
        let i2 = line.IndexOf('\t', i1 + 1)
        line.Substring(0, i1), line.Substring(i1 + 1, i2 - i1 - 1), line.Substring(i2 + 1)

    File.ReadAllLines goldenPath
    |> Array.filter (fun l -> not (l.StartsWith "#") && l.Length > 0)
    |> Array.map split2

[<Fact>]
let ``BYTE-LOCK: replaying the golden session hits every checkpoint state exactly`` () =
    let mutable g = MeshPong.create ()
    let mutable inputs = 0
    let mutable checks = 0

    for kind, _tick, rest in parseGolden () do
        match kind with
        | "i" ->
            match MeshPong.parseInputs rest with
            | Some (a, b) ->
                g <- MeshPong.step a b g
                inputs <- inputs + 1
            | None -> Assert.Fail(sprintf "bad input line: %s" rest)
        | "c" ->
            Assert.Equal(rest, MeshPong.gameToLine g)
            checks <- checks + 1
        | other -> Assert.Fail(sprintf "unknown line kind: %s" other)

    Assert.Equal(300, inputs)
    Assert.Equal(5, checks)

[<Fact>]
let ``the state codec round-trips and refuses malformed lines`` () =
    let g = MeshPong.create ()
    match MeshPong.gameOfLine (MeshPong.gameToLine g) with
    | Some g2 -> Assert.Equal(g, g2)
    | None -> Assert.Fail "canonical line must parse"
    Assert.True((MeshPong.gameOfLine "garbage").IsNone)
    Assert.True((MeshPong.gameOfLine "ponggame2\t1\t2\t3\t4\t5\t6\t7\t8").IsNone)
    Assert.True((MeshPong.gameOfLine "ponggame1\t1\t2\t3\t4\t5\t6\t7").IsNone)
    Assert.True((MeshPong.gameOfLine "ponggame1\t1\t2\t3\t4\t5\t6\t7\tx").IsNone)
