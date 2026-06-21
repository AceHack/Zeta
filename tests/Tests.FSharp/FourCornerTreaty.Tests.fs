module Zeta.Tests.FourCornerTreatyTests

// The FourCorner TREATY byte-lock (081KTQD8A0008QG0R0005EFYPV trigger fired: "we are the consumer for our treaties — this is
// how we know we are done; without it who knows if things are correct"). The F# oracle locks the golden
// lines; C#/TS/Rust must produce/consume the SAME bytes.

open System.IO
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

let private goldenPath =
    Path.Combine(repoRoot (), "src", "Core.TypeScript", "four-corner", "golden-vectors.lines")

let private goldenLines () =
    File.ReadAllLines goldenPath
    |> Array.filter (fun l -> not (l.StartsWith "#") && l.Length > 0)
    |> Array.toList

let private mk tIn tOut oFb iFb : FourCorner.FourCornerOwnership<string, string, string, string> =
    { TIn = tIn; TOut = tOut; TOutFeedback = oFb; TInFeedback = iFb }

/// The vectors, as constructed values — MUST serialize to the golden lines byte-for-byte.
let private vectors =
    [ mk "operator-message" (Some "emitted") (Some "conv-feedback") (Some "co-owned-ack")
      mk "only-input" None None None
      mk "tab\there\nand-newline" (Some "back\\slash") None (Some "ends-with-tab\t")
      mk "" (Some "") None None
      mk "héllo-wörld-⊕-unicode" None (Some "反馈") None ]

[<Fact>]
let ``BYTE-LOCK: every vector serializes to its golden line exactly`` () =
    let lines = goldenLines ()
    Assert.Equal(vectors.Length, lines.Length)
    for v, expected in List.zip vectors lines do
        Assert.Equal(expected, FourCorner.toLine v)

[<Fact>]
let ``round-trip: every golden line parses back to its vector (ofLine ∘ toLine = id)`` () =
    for v, line in List.zip vectors (goldenLines ()) do
        match FourCorner.ofLine line with
        | Some parsed ->
            Assert.Equal(v.TIn, parsed.TIn)
            Assert.Equal(v.TOut, parsed.TOut)
            Assert.Equal(v.TOutFeedback, parsed.TOutFeedback)
            Assert.Equal(v.TInFeedback, parsed.TInFeedback)
        | None -> Assert.Fail(sprintf "golden line failed to parse: %s" line)

[<Fact>]
let ``malformed lines are refused honestly (None, never a guess)`` () =
    Assert.True((FourCorner.ofLine "garbage").IsNone)
    Assert.True((FourCorner.ofLine "fourcorner1\tonly-three\t-\t-").IsNone)
    Assert.True((FourCorner.ofLine "fourcorner2\ta\t-\t-\t-").IsNone) // wrong version tag
    Assert.True((FourCorner.ofLine "fourcorner1\ta\t?\t-\t-").IsNone) // malformed opt