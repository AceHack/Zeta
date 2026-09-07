namespace Zeta.Tests

open System
open System.Security.Cryptography
open System.Text
open System.Text.Json.Nodes
open Xunit
open Zeta.Research

module HiddenSwitchCompiledCertificateTests =
    let private get = function Ok value -> value | Error error -> failwithf "unexpected refusal: %A" error
    let private bindings =
        Map.ofList [ "ProtocolSha256", "8BBDFE44A0844DD8CE4F6C5DD77B060A56E5B84EA94EA7A6FDBB482AEC9D738A"
                     "hand-validation", String.replicate 64 "0" ]
    let private proof () = HiddenSwitchCompiledCertificate.build bindings |> get
    let private admitted () = HiddenSwitchCompiledCertificate.verify (proof()) bindings |> get
    let private refusal raw = HiddenSwitchCompiledCertificate.verify raw bindings |> Result.isError |> Assert.True

    [<Fact>]
    let ``entire independently reconstructed numeric certificate has the retained Python identity`` () =
        let raw = proof()
        Assert.Equal(62458, raw.Length)
        let digest = Convert.ToHexString(SHA256.HashData raw)
        Assert.Equal("8883D8C91C18F5D53360C64579D6F5241A606E0907E57E06C0CD69941BC1CA7F", digest)
        let verified = HiddenSwitchCompiledCertificate.verify raw bindings |> get
        Assert.Equal(digest, HiddenSwitchCompiledCertificate.numericSha256 verified)

    [<Fact>]
    let ``malformed Unicode and JSON refuse without escaping the certificate boundary`` () =
        let valid = Encoding.UTF8.GetString(proof())
        for raw in [ null; [||]; [| 0xFFuy |]; Encoding.UTF8.GetBytes "{"; Encoding.UTF8.GetBytes(valid + " null")
                     Encoding.UTF8.GetBytes(valid.Replace("zeta.hidden-switch.compiled.numeric.v1", "\\uD800", StringComparison.Ordinal))
                     Encoding.UTF8.GetBytes(valid.Replace("zeta.hidden-switch.compiled.numeric.v1", "\\uDC00", StringComparison.Ordinal))
                     Encoding.UTF8.GetBytes(valid.Replace("hand-validation", "\\uD800", StringComparison.Ordinal)) ] do
            refusal raw
        let corrupted = Encoding.UTF8.GetBytes valid
        let marker = Encoding.UTF8.GetBytes "zeta.hidden-switch.compiled.numeric.v1"
        let offset = corrupted.AsSpan().IndexOf(marker.AsSpan())
        Assert.True(offset >= 0)
        corrupted.[offset] <- 0xFFuy
        refusal corrupted

    [<Fact>]
    let ``duplicate extra and missing keys do not become an admitted certificate`` () =
        let valid = Encoding.UTF8.GetString(proof())
        refusal (Encoding.UTF8.GetBytes("{\"Schema\":\"zeta.hidden-switch.compiled.numeric.v1\"," + valid.Substring 1))
        let extra = JsonNode.Parse valid
        extra.["Passed"] <- JsonValue.Create true
        refusal (Encoding.UTF8.GetBytes(extra.ToJsonString()))
        let missing = JsonNode.Parse valid
        Assert.True(missing.AsObject().Remove "Bounds")
        refusal (Encoding.UTF8.GetBytes(missing.ToJsonString()))
        let nested = valid.Replace("\"Horizon\":16", "\"Horizon\":16,\"Horizon\":16", StringComparison.Ordinal)
        Assert.NotEqual<string>(valid, nested)
        refusal (Encoding.UTF8.GetBytes nested)

    [<Theory>]
    [<InlineData("candidate")>]
    [<InlineData("candidate-count")>]
    [<InlineData("candidate-order")>]
    [<InlineData("margin")>]
    [<InlineData("rho")>]
    [<InlineData("guard")>]
    [<InlineData("binding")>]
    [<InlineData("bool")>]
    let ``every numeric proof component is recomputed`` mutation =
        let node = JsonNode.Parse(proof())
        match mutation with
        | "candidate" -> node.["Models"].[5].["Candidates"].[127].["Values"].[1].["Num"] <- JsonValue.Create "0"
        | "candidate-count" -> node.["Models"].[2].["Candidates"].AsArray().RemoveAt 127
        | "candidate-order" ->
            let candidates = node.["Models"].[2].["Candidates"].AsArray()
            let first, second = candidates.[0].DeepClone(), candidates.[1].DeepClone()
            candidates.[0] <- second
            candidates.[1] <- first
        | "margin" -> node.["Models"].[2].["Envelopes"].[0].["EndpointMargins"].[0].["Num"] <- JsonValue.Create "01"
        | "rho" -> node.["Bounds"].["Depths"].[2].["Rho"].["Num"] <- JsonValue.Create "1"
        | "guard" -> node.["Guards"].[1].["HminBits"] <- JsonValue.Create "3FF0000000000000"
        | "binding" -> node.["Bindings"].["hand-validation"] <- JsonValue.Create(String.replicate 64 "1")
        | _ -> node.["Model"].["Horizon"] <- JsonValue.Create true
        refusal (Encoding.UTF8.GetBytes(node.ToJsonString()))

    [<Fact>]
    let ``integer fields cannot be replaced by floating JSON tokens`` () =
        let valid = Encoding.UTF8.GetString(proof())
        for replacement in ["16.0"; "16e0"] do
            let changed = valid.Replace("\"Horizon\":16", "\"Horizon\":" + replacement, StringComparison.Ordinal)
            Assert.NotEqual<string>(valid, changed)
            refusal (Encoding.UTF8.GetBytes changed)

    [<Fact>]
    let ``expected binding roster is exact and requires the frozen protocol`` () =
        let raw = proof()
        for expected in [Map.empty; Map.remove "ProtocolSha256" bindings; Map.add "ProtocolSha256" (String.replicate 64 "0") bindings
                         Map.add "unlisted" (String.replicate 64 "0") bindings; Map.add "hand-validation" (String.replicate 64 "1") bindings] do
            Assert.True(HiddenSwitchCompiledCertificate.verify raw expected |> Result.isError)

    [<Fact>]
    let ``compiled fast paths and fallback retain actual work and inclusive boundaries`` () =
        let verified = admitted()
        let guards = HiddenSwitchCompiledCertificate.guards verified
        let node = JsonNode.Parse(proof())
        for index in 0 .. 1 do
            let depth = index + 2
            let row = node.["Guards"].[index]
            let switch = HiddenSwitchCompiledReceipt.parseFiniteBits (row.["SmaxBits"].GetValue<string>()) |> get
            let harvest = HiddenSwitchCompiledReceipt.parseFiniteBits (row.["HminBits"].GetValue<string>()) |> get
            let interior = Double.BitIncrement switch
            Assert.True(interior < harvest)
            let s = HiddenSwitchCompiledSelector.choose guards true switch depth |> get
            Assert.Equal(1uy, s.Action)
            Assert.Equal(1uy, s.Path)
            Assert.Equal(1u, s.GuardComparisons)
            Assert.Equal(0u, s.Nodes)
            Assert.Equal(0u, s.RecursiveCalls)
            let h = HiddenSwitchCompiledSelector.choose guards true harvest depth |> get
            Assert.Equal(0uy, h.Action)
            Assert.Equal(2uy, h.Path)
            Assert.Equal(2u, h.GuardComparisons)
            Assert.Equal(0u, h.ActionValues)
            Assert.Equal(0u, h.RecursiveCalls)
            let recursive = HiddenSwitchCompiledPolicy.native true interior depth |> get
            let fallback = HiddenSwitchCompiledSelector.choose guards true interior depth |> get
            Assert.True(({ recursive with Path = 4uy; GuardComparisons = 2u } = fallback))
            Assert.Equal(1u, fallback.RecursiveCalls)
            Assert.True(fallback.Nodes > 1u)

    [<Fact>]
    let ``trivial normal choices avoid recursion but unsupported runtime always executes it`` () =
        let guards = admitted() |> HiddenSwitchCompiledCertificate.guards
        for effect in [false; true] do
            for depth in 1 .. 3 do
                for belief in [0.0; BitConverter.UInt64BitsToDouble 0x8000000000000000UL; 0.5; 1.0] do
                    let native = HiddenSwitchCompiledPolicy.native effect belief depth |> get
                    let unsupported = HiddenSwitchCompiledSelector.unsupportedRuntime effect belief depth |> get
                    Assert.True(({ native with Path = 4uy; GuardComparisons = 0u } = unsupported))
                    Assert.Equal(1u, unsupported.RecursiveCalls)
                    if not effect || depth = 1 then
                        let normal = HiddenSwitchCompiledSelector.choose guards effect belief depth |> get
                        Assert.Equal(0uy, normal.Action)
                        Assert.Equal(3uy, normal.Path)
                        Assert.Equal(0u, normal.GuardComparisons)
                        Assert.Equal(0u, normal.RecursiveCalls)
                        Assert.Equal(0u, normal.Nodes)

    [<Fact>]
    let ``invalid selector inputs refuse before a choice`` () =
        let guards = admitted() |> HiddenSwitchCompiledCertificate.guards
        for belief, depth in [Double.NaN, 3; Double.PositiveInfinity, 3; -0.1, 3; 1.1, 3; 0.5, 0; 0.5, 4] do
            Assert.True(HiddenSwitchCompiledSelector.choose guards true belief depth |> Result.isError)
            Assert.True(HiddenSwitchCompiledSelector.unsupportedRuntime true belief depth |> Result.isError)
        Assert.True(HiddenSwitchCompiledSelector.choose Unchecked.defaultof<_> true 0.5 3 |> Result.isError)
