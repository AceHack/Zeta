module Zeta.Tests.FastCdcCrossVerifyTests

open System
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// FastCDC cross-language agreement — the F# oracle uses the REAL canonical FastCdcChunker and replays
// the shared seed (src/Core.TypeScript/fastcdc/golden-vectors.json) that the C#/TS/Rust oracles also
// verify. Each oracle regenerates the byte stream deterministically (byte[i] = SplitMix64.mix(i) & 0xFF)
// and the chunk LENGTHS are cross-verified; the 200000-byte stream exercises genuine content-defined
// cuts (variable lengths, not just max-forced). The private Gear table is locked directly by the
// C#/TS/Rust oracles and transitively here (matching lengths imply a matching table).
// ═══════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private genBytes (count: int) : byte[] =
    Array.init count (fun i -> byte (SplitMix64.mix (uint64 i) &&& 0xFFUL))

[<Fact>]
let ``F# FastCdcChunker agrees with the shared golden seed`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "fastcdc", "golden-vectors.json")
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let chunks = doc.RootElement.GetProperty("chunk").EnumerateArray() |> Seq.toArray

    for v in chunks do
        let count = (v.GetProperty "count").GetInt32()
        let min = (v.GetProperty "min").GetInt32()
        let avg = (v.GetProperty "avg").GetInt32()
        let max = (v.GetProperty "max").GetInt32()
        let expected = [| for l in (v.GetProperty "lengths").EnumerateArray() -> l.GetInt32() |]

        let chunker = FastCdcChunker(min, avg, max)
        chunker.Push(ReadOnlySpan<byte>(genBytes count))
        chunker.Flush()
        let got = chunker.DrainChunks() |> Array.map (fun c -> c.Length)
        Assert.Equal<int[]>(expected, got)
