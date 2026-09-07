namespace Zeta.Tests

open System
open System.IO
open System.Security.Cryptography
open System.Text
open System.Text.Json
open Xunit
open Zeta.Core
open Zeta.Research

module HiddenSwitchCompiledCertificateCheckTests =
    let private hash (bytes: byte[]) = bytes |> SHA256.HashData |> Convert.ToHexString
    let private scratch action =
        let path = Path.Combine(Path.GetTempPath(), "zeta-compiled-certificate-check-" + Guid.NewGuid().ToString("N"))
        Directory.CreateDirectory path |> ignore
        try
            action path
            Directory.Delete(path, true)
        with _ ->
            Console.Error.WriteLine("failed certificate-check fixture retained at " + path)
            reraise()
    let private get = function Ok value -> value | Error reason -> failwithf "unexpected refusal: %A" reason
    let private bindingText = "{\"ProtocolSha256\":\"" + String.replicate 64 "0" + "\"}"

    [<Fact>]
    let ``binding bytes refuse duplicates nonfinite and wrong kinds before map construction`` () =
        let admitted = HiddenSwitchCompiledCertificateCheck.admitBindings (Encoding.UTF8.GetBytes bindingText) |> get
        Assert.Equal(String.replicate 64 "0", admitted.["ProtocolSha256"])
        for invalid in ["{}"; "[]"; "{\"a\":true}"; "{\"a\":NaN}"; "{\"a\":null}"; "{\"a\":\"bad\"}"
                        "{\"a\":\"" + String.replicate 64 "0" + "\",\"a\":\"" + String.replicate 64 "0" + "\"}"] do
            Assert.True(HiddenSwitchCompiledCertificateCheck.admitBindings (Encoding.UTF8.GetBytes invalid) |> Result.isError)

    [<Fact>]
    let ``actual verifier refusal is a completed command with one call and exact raw hashes`` () = scratch (fun directory ->
        let input, bindings, output = Path.Combine(directory, "input.json"), Path.Combine(directory, "bindings.json"), Path.Combine(directory, "output.json")
        let raw = Encoding.UTF8.GetBytes "{}"
        File.WriteAllBytes(input, raw)
        File.WriteAllText(bindings, bindingText, UTF8Encoding(false))
        HiddenSwitchCompiledCertificateCheck.run bindings input output |> get
        use document = JsonDocument.Parse(File.ReadAllBytes output)
        let root = document.RootElement
        Assert.True(root.GetProperty("Complete").GetBoolean())
        Assert.Equal(JsonValueKind.Null, root.GetProperty("Failure").ValueKind)
        Assert.Equal(1, root.GetProperty("VerifyCalls").GetInt32())
        Assert.Equal(hash raw, root.GetProperty("InputSha256").GetString())
        Assert.Equal(hash (File.ReadAllBytes bindings), root.GetProperty("BindingsSha256").GetString())
        let actual = root.GetProperty("Outcome")
        Assert.Equal("refused", actual.GetProperty("Kind").GetString())
        Assert.Equal(9, actual.GetProperty("Failure").EnumerateObject() |> Seq.length)
        Assert.Equal(JsonValueKind.Null, actual.GetProperty("Failure").GetProperty("Episode").ValueKind)
        Assert.Contains("certificate-verify-enter", File.ReadAllText(output + ".checkpoint.jsonl")))

    [<Fact>]
    let ``input hash survives later missing bindings with no verifier call`` () = scratch (fun directory ->
        let input, bindings, output = Path.Combine(directory, "input.json"), Path.Combine(directory, "missing.json"), Path.Combine(directory, "output.json")
        File.WriteAllText(input, "{}", UTF8Encoding(false))
        match HiddenSwitchCompiledCertificateCheck.run bindings input output with
        | Ok () -> Assert.Fail("missing second input must refuse")
        | Error reason -> Assert.Equal("certificate-bindings-read", reason.Stage)
        use document = JsonDocument.Parse(File.ReadAllBytes output)
        let root = document.RootElement
        Assert.False(root.GetProperty("Complete").GetBoolean())
        Assert.Equal(0, root.GetProperty("VerifyCalls").GetInt32())
        Assert.Equal(hash (File.ReadAllBytes input), root.GetProperty("InputSha256").GetString())
        Assert.Equal(JsonValueKind.Null, root.GetProperty("BindingsSha256").ValueKind)
        Assert.Equal(JsonValueKind.Null, root.GetProperty("Outcome").ValueKind)
        Assert.Contains("certificate-check-finished", File.ReadAllText(output + ".checkpoint.jsonl")))

    [<Fact>]
    let ``existing final or journal refuses before certificate input reads`` () = scratch (fun directory ->
        let missing = Path.Combine(directory, "missing")
        let output = Path.Combine(directory, "output.json")
        File.WriteAllText(output, "owned-before", UTF8Encoding(false))
        Assert.True(HiddenSwitchCompiledCertificateCheck.run missing missing output |> Result.isError)
        Assert.Equal("owned-before", File.ReadAllText output)
        Assert.False(File.Exists(output + ".checkpoint.jsonl"))
        let second = Path.Combine(directory, "second.json")
        File.WriteAllText(second + ".checkpoint.jsonl", "prior-journal", UTF8Encoding(false))
        Assert.True(HiddenSwitchCompiledCertificateCheck.run missing missing second |> Result.isError)
        Assert.Equal(0L, FileInfo(second).Length)
        Assert.Equal("prior-journal", File.ReadAllText(second + ".checkpoint.jsonl")))

    [<Fact>]
    let ``duplicate caller bindings retain both raw hashes and never call certificate verify`` () = scratch (fun directory ->
        let input, bindings, output = Path.Combine(directory, "input.json"), Path.Combine(directory, "bindings.json"), Path.Combine(directory, "output.json")
        File.WriteAllText(input, "{}", UTF8Encoding(false))
        File.WriteAllText(bindings, "{\"x\":\"" + String.replicate 64 "0" + "\",\"x\":\"" + String.replicate 64 "0" + "\"}", UTF8Encoding(false))
        match HiddenSwitchCompiledCertificateCheck.run bindings input output with
        | Ok () -> Assert.Fail("duplicate binding names must refuse")
        | Error reason -> Assert.Equal("duplicate-or-empty-key", reason.Code)
        use document = JsonDocument.Parse(File.ReadAllBytes output)
        let root = document.RootElement
        Assert.False(root.GetProperty("Complete").GetBoolean())
        Assert.Equal(0, root.GetProperty("VerifyCalls").GetInt32())
        Assert.Equal(hash (File.ReadAllBytes bindings), root.GetProperty("BindingsSha256").GetString())
        Assert.Equal(hash (File.ReadAllBytes input), root.GetProperty("InputSha256").GetString()))
