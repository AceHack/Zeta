namespace Zeta.Tests

open System
open System.Text
open System.Text.Json
open System.Text.Json.Nodes
open Xunit
open Zeta.Research.MetadataProbe

module HiddenSwitchMetadataTests =
    let private pin file : Admission.FilePin = { File = "/owned/" + file; Bytes = 128L; Sha256 = String('A', 64) }
    let private input () : Admission.Input =
        { Dump = pin "graph.core"; Dac = pin "libmscordaccore.dylib"
          Runtime = { Image = pin "libcoreclr.dylib"; ImageBase = 0x100000UL; Version = "10.0.1126.37416"; BuildId = String('A', 32) }
          Module = { Original = pin "live.dll"; Copy = pin "copied.dll"; Mvid = "ebe82744-476c-4d60-628a-d8b9bd27252d" }
          Methods = [| for index, role in Array.indexed [|"predict"; "condition"; "select"|] ->
                           { Role = role; Address = 0x200000UL + uint64 (index * 1024); Bytes = 252u
                             Token = 0x06000495 + index; Signature = "Zeta.Research.HiddenSwitchPolicy." + role + "()"
                             BodySha256 = String('B', 64) } |] }
    let private raw value = JsonSerializer.SerializeToUtf8Bytes value
    let private refused value =
        match value with Ok _ -> failwith "fixture must refuse" | Error reason -> reason

    [<Fact>]
    let ``metadata input admits one finite roster and refuses omitted or duplicate defaults`` () =
        Assert.True(Result.isOk (Admission.parse (raw (input()))))
        let node = JsonNode.Parse(raw (input()))
        node.["Methods"].[0].AsObject().Remove("Token") |> ignore
        Assert.Equal("shape", (Admission.parse(Encoding.UTF8.GetBytes(node.ToJsonString())) |> refused).Code)
        let text = JsonSerializer.Serialize(input())
        let duplicate = text.Replace("\"Token\":100664469", "\"Token\":100664469,\"Token\":100664469", StringComparison.Ordinal)
        Assert.NotEqual<string>(text, duplicate)
        Assert.Equal("shape", (Admission.parse(Encoding.UTF8.GetBytes duplicate) |> refused).Code)

    [<Fact>]
    let ``metadata roster refuses changed role overlapping ranges and reused custody path`` () =
        let baseline = input()
        let wrong = { baseline with Methods = Array.rev baseline.Methods }
        Assert.True(Result.isError (Admission.parse(raw wrong)))
        let overlap = { baseline with Methods = Array.copy baseline.Methods }
        overlap.Methods.[1] <- { overlap.Methods.[1] with Address = overlap.Methods.[0].Address + 4UL }
        Assert.True(Result.isError (Admission.parse(raw overlap)))
        let reused = { baseline with Module = { baseline.Module with Copy = baseline.Module.Original } }
        Assert.True(Result.isError (Admission.parse(raw reused)))

    [<Fact>]
    let ``DAC extent must describe the queried current body with exact complete hot size`` () =
        let expected = (input()).Methods.[0]
        Assert.True(Result.isOk (Admission.extents expected expected.Address expected.Address expected.Bytes 0UL 0u))
        Assert.Equal("candidate-mismatch", (Admission.extents expected (expected.Address + 4UL) expected.Address expected.Bytes 0UL 0u |> refused).Code)
        Assert.Equal("candidate-mismatch", (Admission.extents expected expected.Address expected.Address (expected.Bytes + 4u) 0UL 0u |> refused).Code)

    [<Fact>]
    let ``cold zero unaligned and overflowing DAC ranges never authorize extra reads`` () =
        let expected = (input()).Methods.[0]
        Assert.Equal("unexpected-cold", (Admission.extents expected expected.Address expected.Address expected.Bytes 0UL 4u |> refused).Code)
        Assert.Equal("unexpected-cold", (Admission.extents expected expected.Address expected.Address expected.Bytes 0x300000UL 4u |> refused).Code)
        Assert.Equal("range", (Admission.extents expected expected.Address expected.Address 0u 0UL 0u |> refused).Code)
        Assert.Equal("range", (Admission.extents expected expected.Address (expected.Address + 1UL) expected.Bytes 0UL 0u |> refused).Code)
        Assert.Equal("range", (Admission.extents expected expected.Address (UInt64.MaxValue - 3UL) 8u 0UL 0u |> refused).Code)

    [<Fact>]
    let ``metadata manifest refuses fractional fields and oversized input`` () =
        let text = JsonSerializer.Serialize(input()).Replace("\"Bytes\":252", "\"Bytes\":252.5", StringComparison.Ordinal)
        Assert.True(Result.isError (Admission.parse(Encoding.UTF8.GetBytes text)))
        Assert.Equal("size", (Admission.parse(Array.create 65537 32uy) |> refused).Code)

    [<Fact>]
    let ``journal ceiling counts newline and refuses arithmetic overflow`` () =
        Assert.Equal(Ok(1024 * 1024), Admission.journalSize (1024 * 1024 - 2) 1)
        Assert.Equal("size", (Admission.journalSize (1024 * 1024 - 1) 1 |> refused).Code)
        Assert.Equal("size", (Admission.journalSize Int32.MaxValue Int32.MaxValue |> refused).Code)
        Assert.Equal("size", (Admission.journalSize 0 -1 |> refused).Code)

    [<Fact>]
    let ``dependency admission binds actual manifest and refuses duplicate replacement rows`` () =
        let path = IO.Path.Combine(AppContext.BaseDirectory, "MetadataProbe.dependencies.json")
        let actual = IO.File.ReadAllBytes path
        Assert.True(Result.isOk (Admission.dependencyManifest actual))
        let node = JsonNode.Parse actual
        let rows = node.["Records"].AsArray()
        Assert.Equal(13, rows.Count)
        rows.[1] <- rows.[0].DeepClone()
        Assert.Equal("manifest-identity", (Admission.dependencyManifest(Encoding.UTF8.GetBytes(node.ToJsonString())) |> refused).Code)
        Assert.Equal("manifest-identity", (Admission.dependencyManifest(Array.create 65537 32uy) |> refused).Code)

    [<Fact>]
    let ``dyld observation publishes copied rows before changed-count refusal`` () =
        let records = ResizeArray<string>()
        let mutable counts = 0
        let count () = counts <- counts + 1; if counts = 1 then 2u else 3u
        let read index = Ok({ Index = index; Name = "/owned/" + string index; Header = int64(index + 1u); Slide = 0L }: NativeImages.Row)
        let reason = NativeImages.observe count read (fun row -> records.Add(JsonSerializer.Serialize row)) |> refused
        Assert.Equal("count-changed", reason.Code)
        Assert.Equal(4, records.Count)
        Assert.Contains("dyld-count-before", records.[0])
        Assert.Contains("dyld-raw-image", records.[1])
        Assert.Contains("dyld-raw-image", records.[2])
        Assert.Contains("dyld-count-after", records.[3])

    [<Fact>]
    let ``dyld bounded roster and established invalid row survive reporting failure`` () =
        let mutable reads = 0
        let read index = reads <- reads + 1; Ok({ Index = index; Name = "/owned/dac"; Header = 0L; Slide = 0L }: NativeImages.Row)
        Assert.Equal("count-bound", (NativeImages.observe (fun () -> 1025u) read ignore |> refused).Code)
        Assert.Equal(0, reads)
        let failRaw value =
            if (JsonSerializer.Serialize value).Contains("dyld-raw-image", StringComparison.Ordinal) then
                raise (IO.IOException "owned fixture journal failure")
        Assert.Equal("row", (NativeImages.observe (fun () -> 1u) read failRaw |> refused).Code)
        Assert.Equal(1, reads)


    [<Fact>]
    let ``oversized method diagnostic has a bounded explicit final refusal preserving first error`` () =
        let primary = Some(Admission.failure "method-query" "identity" "actual signature differed")
        let report = {| Complete = false; Methods = [| {| Signature = String('X', 1024 * 1024) |} |] |}
        let bytes, first = Admission.finalOutput (raw report) primary 1
        Assert.Equal(primary, first)
        Assert.True(bytes.Length + 1 <= 1024 * 1024)
        use compact = JsonDocument.Parse bytes
        Assert.False(compact.RootElement.GetProperty("Complete").GetBoolean())
        Assert.True(compact.RootElement.GetProperty("MethodMetadataOmitted").GetBoolean())
        Assert.Equal(1, compact.RootElement.GetProperty("AvailableMethodCount").GetInt32())
        Assert.Equal("size", compact.RootElement.GetProperty("OutputFailure").GetProperty("Code").GetString())
        let _, absent = Admission.finalOutput (raw report) None 1
        Assert.Equal("final-output", absent.Value.Stage)
