namespace Zeta.Tests

open System
open System.Text
open System.Text.Json
open System.Text.Json.Nodes
open Xunit
open Zeta.Research.MetadataProbe

module HiddenSwitchMetadataTests =
    /// Custody paths must be FULLY QUALIFIED (`Admission.filePin` ->
    /// `Path.IsPathFullyQualified`), and that predicate is platform-dependent:
    /// on Windows a leading `/` is drive-RELATIVE, so `/owned/x` is rooted but
    /// NOT fully qualified -- the fixture itself was refused before any
    /// assertion under test could run. The production rule is the one we want
    /// (an unambiguous absolute custody path); only the fixture was Unix-shaped.
    let private owned = if OperatingSystem.IsWindows() then @"C:\owned\" else "/owned/"

    let private pin file : Admission.FilePin = { File = owned + file; Bytes = 128L; Sha256 = String('A', 64) }
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
        let read index = Ok({ Index = index; Name = owned + string index; Header = int64(index + 1u); Slide = 0L }: NativeImages.Row)
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
        let read index = reads <- reads + 1; Ok({ Index = index; Name = (owned + "dac"); Header = 0L; Slide = 0L }: NativeImages.Row)
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

    let private mappedFixture () =
        use file = IO.File.OpenRead(IO.Path.Combine(AppContext.BaseDirectory, "MetadataProbe.mapping.json.gz"))
        use gzip = new IO.Compression.GZipStream(file, IO.Compression.CompressionMode.Decompress)
        use buffer = new IO.MemoryStream()
        gzip.CopyTo buffer
        let bytes = buffer.ToArray()
        use document = JsonDocument.Parse bytes
        let original = input()
        let rows = document.RootElement.GetProperty("Rows").EnumerateArray()
                   |> Seq.filter (fun row -> row.GetProperty("Outcome").GetProperty("Kind").GetString() = "mapped-candidate") |> Seq.toArray
        let methods : Admission.MappedMethod[] =
            rows |> Array.mapi (fun position row ->
                let observed, compiler = row.GetProperty("Input"), row.GetProperty("Outcome")
                let index = row.GetProperty("Index").GetInt32()
                { Index = index; Role = "method-" + index.ToString("D3", Globalization.CultureInfo.InvariantCulture)
                  Address = 0x200000UL + uint64(position * 4096); Bytes = compiler.GetProperty("Bytes").GetUInt32()
                  Token = observed.GetProperty("Token").GetInt32(); DeclaringType = observed.GetProperty("Type").GetString()
                  Name = observed.GetProperty("Name").GetString(); ReflectionSignature = observed.GetProperty("Signature").GetString()
                  IlHex = observed.GetProperty("IlHex").GetString(); BodySha256 = compiler.GetProperty("Sha256").GetString()
                  CompilerBlockIndex = compiler.GetProperty("CompilerBlockIndex").GetInt32(); CompilerName = compiler.GetProperty("CompilerName").GetString() })
        let result : Admission.MappedInput =
            { Dump = original.Dump; Dac = original.Dac; Runtime = original.Runtime
              Module = { original.Module with Mvid = rows.[0].GetProperty("Input").GetProperty("Mvid").GetString() }
              Mapping = { File = (owned + "mapping.json"); Bytes = Admission.mappingBytes; Sha256 = Admission.mappingSha256 }; Methods = methods }
        bytes, result

    [<Fact>]
    let ``mapped admission binds every exact reviewed row and refuses changed definition or compiler identity`` () =
        let bytes, baseline = mappedFixture()
        Assert.True(Result.isOk (Admission.parseMapped(raw baseline)))
        Assert.True(Result.isOk (Admission.bindMapped bytes baseline))
        for mutate in [ (fun row -> { row with Admission.MappedMethod.DeclaringType = row.DeclaringType + "+wrong" })
                        (fun row -> { row with Name = "wrong" })
                        (fun row -> { row with ReflectionSignature = "wrong" })
                        (fun row -> { row with IlHex = "00" })
                        (fun row -> { row with CompilerBlockIndex = row.CompilerBlockIndex + 1 })
                        (fun row -> { row with BodySha256 = String('C', 64) }) ] do
            let changed = { baseline with Methods = Array.copy baseline.Methods }
            changed.Methods.[0] <- mutate changed.Methods.[0]
            Assert.Equal("row", (Admission.bindMapped bytes changed |> refused).Code)
        let changedBytes = Array.copy bytes
        changedBytes.[0] <- 32uy
        Assert.Equal("identity", (Admission.bindMapped changedBytes baseline |> refused).Code)

    [<Fact>]
    let ``mapped admission rejects reordered repeated overlapping and malformed inputs`` () =
        let _, baseline = mappedFixture()
        for methods in [ Array.rev baseline.Methods; baseline.Methods.[0..128]; Array.create 130 baseline.Methods.[0]
                         baseline.Methods |> Array.mapi (fun index row -> if index = 1 then { row with Address = baseline.Methods.[0].Address } else row) ] do
            Assert.True(Result.isError (Admission.parseMapped(raw { baseline with Methods = methods })))
        let node = JsonNode.Parse(raw baseline)
        node.["Methods"].[0].AsObject().Remove("Token") |> ignore
        Assert.Equal("shape", (Admission.parseMapped(Encoding.UTF8.GetBytes(node.ToJsonString())) |> refused).Code)
        Assert.Equal("size", (Admission.parseMapped(Array.create (256 * 1024 + 1) 32uy) |> refused).Code)
        Assert.True(Result.isError (Admission.parse(raw baseline)))

    [<Fact>]
    let ``mapped DAC identity uses exact nested names without signature grammar guesses`` () =
        let _, baseline = mappedFixture()
        let expected = baseline.Methods.[0]
        Assert.True(Result.isOk (Admission.mappedIdentity expected expected.Token expected.DeclaringType expected.Name (owned + "live.dll") (owned + "live.dll")))
        for token, declaringType, name, moduleName in
            [expected.Token + 1, expected.DeclaringType, expected.Name, (owned + "live.dll")
             expected.Token, expected.DeclaringType + "+wrong", expected.Name, (owned + "live.dll")
             expected.Token, expected.DeclaringType, "wrong", (owned + "live.dll")
             expected.Token, expected.DeclaringType, expected.Name, "/elsewhere/live.dll"] do
            Assert.Equal("method-identity", (Admission.mappedIdentity expected token declaringType name moduleName (owned + "live.dll") |> refused).Code)
