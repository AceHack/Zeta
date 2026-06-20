using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

public class CloudEventsTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(CloudEventsTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }
        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static string Str(JsonElement el, string prop) =>
        el.GetProperty(prop).GetString()
            ?? throw new InvalidOperationException($"fixture property '{prop}' is not a string");

    private static string? TryStr(JsonElement el, string prop)
    {
        if (el.TryGetProperty(prop, out var p) && p.ValueKind == JsonValueKind.String)
        {
            return p.GetString();
        }
        return null;
    }

    private static DynamicValue BuildValue(JsonElement el)
    {
        string tag = Str(el, "t");
        switch (tag)
        {
            case "null":
                return new DynamicValue.Null();
            case "bool":
                return new DynamicValue.Bool(el.GetProperty("v").GetBoolean());
            case "int":
                return new DynamicValue.Int(long.Parse(Str(el, "v"), CultureInfo.InvariantCulture));
            case "float":
                return new DynamicValue.Float(
                    BitConverter.UInt64BitsToDouble(
                        ulong.Parse(Str(el, "v"), NumberStyles.HexNumber, CultureInfo.InvariantCulture)));
            case "str":
                return new DynamicValue.String(Str(el, "v"));
            case "bytes":
                return new DynamicValue.Bytes(Convert.FromHexString(Str(el, "v")).ToImmutableArray());
            case "arr":
                return new DynamicValue.Array(
                    el.GetProperty("v").EnumerateArray().Select(BuildValue).ToImmutableArray());
            case "obj":
                return new DynamicValue.Object(
                    el.GetProperty("v").EnumerateArray()
                        .Select(pair =>
                        {
                            JsonElement[] parts = pair.EnumerateArray().ToArray();
                            string key = parts[0].GetString() ?? "";
                            return new KeyValuePair<string, DynamicValue>(key, BuildValue(parts[1]));
                        })
                        .ToImmutableArray());
            default:
                throw new InvalidOperationException($"unsupported tag: {tag}");
        }
    }

    [Fact]
    public void CreateYieldsAValidEventAndValidateCatchesAMissingRequiredAttribute()
    {
        var e = CloudEvents.Create("id-1", "/zeta/source", "com.zeta.change", new DynamicValue.Int(7L));
        Assert.Equal("1.0", e.SpecVersion);
        Assert.True(CloudEvents.Validate(e) is Result<bool, string>.Ok);

        var missingId = e with { Id = string.Empty };
        var validationResult = CloudEvents.Validate(missingId);
        Assert.True(validationResult is Result<bool, string>.Err);
        var err = (Result<bool, string>.Err)validationResult;
        Assert.Contains("id", err.Error, StringComparison.Ordinal);
    }

    [Fact]
    public void ToDynamicOfDynamicRoundTrips()
    {
        var extensions = ImmutableArray.Create(
            new KeyValuePair<string, string>("iodebeziumop", "c"),
            new KeyValuePair<string, string>("traceparent", "abc")
        );

        var e = CloudEvents.Create("id-2", "/s", "t", new DynamicValue.String("payload")) with
        {
            Time = "2026-06-07T00:00:00Z",
            DataSchema = "schema://v2",
            Extensions = extensions
        };

        var dynamicVal = CloudEvents.ToDynamic(e);
        var ofDynamicResult = CloudEvents.OfDynamic(dynamicVal);
        Assert.True(ofDynamicResult is Result<CloudEvent, string>.Ok);
        var ok = (Result<CloudEvent, string>.Ok)ofDynamicResult;
        Assert.Equal(e, ok.Value);
    }

    [Fact]
    public void OfDynamicRejectsNonObjectAndObjectMissingRequiredAttributes()
    {
        Assert.True(CloudEvents.OfDynamic(new DynamicValue.Int(1L)) is Result<CloudEvent, string>.Err);

        var pairs = ImmutableArray.Create(new KeyValuePair<string, DynamicValue>("id", new DynamicValue.String("x")));
        var missingAttrs = new DynamicValue.Object(pairs);
        Assert.True(CloudEvents.OfDynamic(missingAttrs) is Result<CloudEvent, string>.Err);
    }

    [Fact]
    public void UnknownStringKeysBecomeExtensionAttributesAndCoreKeysDoNot()
    {
        var pairs = ImmutableArray.Create(
            new KeyValuePair<string, DynamicValue>("specversion", new DynamicValue.String("1.0")),
            new KeyValuePair<string, DynamicValue>("id", new DynamicValue.String("i")),
            new KeyValuePair<string, DynamicValue>("source", new DynamicValue.String("s")),
            new KeyValuePair<string, DynamicValue>("type", new DynamicValue.String("t")),
            new KeyValuePair<string, DynamicValue>("myext", new DynamicValue.String("v")),
            new KeyValuePair<string, DynamicValue>("data", new DynamicValue.Int(5L))
        );

        var dv = new DynamicValue.Object(pairs);
        var ofDynamicResult = CloudEvents.OfDynamic(dv);
        Assert.True(ofDynamicResult is Result<CloudEvent, string>.Ok);
        var ok = (Result<CloudEvent, string>.Ok)ofDynamicResult;

        Assert.Single(ok.Value.Extensions);
        Assert.Equal("myext", ok.Value.Extensions[0].Key);
        Assert.Equal("v", ok.Value.Extensions[0].Value);
        Assert.Equal(new DynamicValue.Int(5L), ok.Value.Data);
    }

    [Fact]
    public void CrossVerifyCloudEventVectorsMatchExpected()
    {
        var root = RepoRoot();
        var jsonPath = Path.Combine(root, "tests", "cross-verification", "dv-key-cloud-events", "vectors.json");
        Assert.True(File.Exists(jsonPath), $"vectors.json not found: {jsonPath}");

        using var doc = JsonDocument.Parse(File.ReadAllText(jsonPath));
        var vectors = doc.RootElement.GetProperty("cloud_event_vectors").EnumerateArray();

        foreach (var v in vectors)
        {
            var expectedJson = Str(v, "expected_json");
            var expectedCborHex = Str(v, "expected_cbor_hex");

            var evtEl = v.GetProperty("event");
            var evtId = Str(evtEl, "id");
            var evtSource = Str(evtEl, "source");
            var evtType = Str(evtEl, "type");
            var specversion = Str(evtEl, "specversion");

            DynamicValue? dataVal = null;
            if (evtEl.TryGetProperty("data", out var dEl) && dEl.ValueKind != JsonValueKind.Null)
            {
                dataVal = BuildValue(dEl);
            }

            var extensionsBuilder = ImmutableArray.CreateBuilder<KeyValuePair<string, string>>();
            if (evtEl.TryGetProperty("extensions", out var extEl))
            {
                foreach (var pair in extEl.EnumerateArray())
                {
                    JsonElement[] parts = pair.EnumerateArray().ToArray();
                    string extKey = parts[0].GetString() ?? "";
                    string extVal = parts[1].GetString() ?? "";
                    extensionsBuilder.Add(new KeyValuePair<string, string>(extKey, extVal));
                }
            }

            var ce = CloudEvents.Create(evtId, evtSource, evtType, dataVal) with
            {
                SpecVersion = specversion,
                Time = TryStr(evtEl, "time"),
                Subject = TryStr(evtEl, "subject"),
                DataContentType = TryStr(evtEl, "datacontenttype"),
                DataSchema = TryStr(evtEl, "dataschema"),
                Extensions = extensionsBuilder.ToImmutable()
            };

            var dynamicVal = CloudEvents.ToDynamic(ce);

            var jsonResult = DynamicValues.ToCanonicalJson(dynamicVal);
            Assert.True(jsonResult is Result<string, EncodeError>.Ok);
            var actualJson = ((Result<string, EncodeError>.Ok)jsonResult).Value;
            Assert.Equal(expectedJson, actualJson);

            var cborResult = DynamicValues.ToCanonicalCbor(dynamicVal);
            Assert.True(cborResult is Result<byte[], EncodeError>.Ok);
            var actualCborHex = Convert.ToHexString(((Result<byte[], EncodeError>.Ok)cborResult).Value).ToLowerInvariant();
            Assert.Equal(expectedCborHex, actualCborHex);
        }
    }
}
