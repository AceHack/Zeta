using System.Collections.Immutable;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// DynamicValue canonical-JSON DECODE byte-lock — <see cref="DynamicValues.FromCanonicalJson"/> is
/// the inverse of <see cref="DynamicValues.ToCanonicalJson"/>, completing the text↔value round-trip
/// for the six locked shapes (Float + Bytes are DEFERRED in JSON — they lock under CBOR). Primary
/// check is the round-trip <c>ToCanonicalJson(FromCanonicalJson(s)) == s</c> over the shared seed
/// (sound because canonical encode is bijective). A direct structural <c>decode == value</c> check
/// runs too (C# DynamicValue has structural equality). int64 precision is preserved by parsing the
/// number token as text. "The compilers don't lie."
/// </summary>
public class DynamicValueJsonDecodeTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(DynamicValueJsonDecodeTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    private static string Str(JsonElement el, string prop) =>
        el.GetProperty(prop).GetString()
            ?? throw new InvalidOperationException($"fixture property '{prop}' is not a string: {el.GetRawText()}");

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
            case "str":
                return new DynamicValue.String(Str(el, "v"));
            case "arr":
                return new DynamicValue.Array(
                    el.GetProperty("v").EnumerateArray().Select(BuildValue).ToImmutableArray());
            case "obj":
                return new DynamicValue.Object(
                    el.GetProperty("v").EnumerateArray()
                        .Select(pair =>
                        {
                            JsonElement[] parts = pair.EnumerateArray().ToArray();
                            string key = parts[0].GetString()
                                ?? throw new InvalidOperationException("object key is not a string");
                            return new KeyValuePair<string, DynamicValue>(key, BuildValue(parts[1]));
                        })
                        .ToImmutableArray());
            default:
                throw new InvalidOperationException($"unsupported tag in JSON seed: {tag}");
        }
    }

    [Fact]
    public void CSharpJsonDecodeRoundTripsSeed()
    {
        string path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "dynamic-value", "golden-vectors.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        JsonElement[] vectors = doc.RootElement.GetProperty("vectors").EnumerateArray().ToArray();
        Assert.NotEmpty(vectors);

        var failures = new List<string>();
        foreach (JsonElement v in vectors)
        {
            string name = Str(v, "name");
            string json = Str(v, "json");

            switch (DynamicValues.FromCanonicalJson(json))
            {
                case Result<DynamicValue, DecodeError>.Ok ok:
                    // (a) round-trip: re-encoding the decoded value reproduces the canonical JSON
                    string reEncoded = DynamicValues.ToCanonicalJson(ok.Value) is Result<string, EncodeError>.Ok e
                        ? e.Value
                        : "<encode-error>";
                    if (!string.Equals(reEncoded, json, StringComparison.Ordinal))
                    {
                        failures.Add($"{name}: re-encode {reEncoded} != {json}");
                    }

                    // (b) structural: the decoded value equals the expected value
                    DynamicValue expected = BuildValue(v.GetProperty("value"));
                    if (!ok.Value.Equals(expected))
                    {
                        failures.Add($"{name}: decoded value != expected");
                    }

                    break;
                case Result<DynamicValue, DecodeError>.Err err:
                    failures.Add($"{name}: decode failed with {err.Error}");
                    break;
                default:
                    failures.Add($"{name}: unexpected Result shape");
                    break;
            }
        }

        Assert.Empty(failures);
    }

    [Theory]
    [InlineData("", DecodeError.UnexpectedEnd)] // empty
    [InlineData("tru", DecodeError.UnexpectedEnd)] // truncated literal
    [InlineData("[1,", DecodeError.UnexpectedEnd)] // unterminated array
    [InlineData("{\"a\"", DecodeError.UnexpectedEnd)] // object missing colon+value
    [InlineData("\"unterminated", DecodeError.UnexpectedEnd)] // unterminated string
    [InlineData("\"\\u00gg\"", DecodeError.UnexpectedEnd)] // \uXXXX with non-hex digits
    [InlineData("\"\\q\"", DecodeError.UnexpectedEnd)] // invalid escape
    [InlineData("1.", DecodeError.UnexpectedEnd)] // no digit after '.'
    [InlineData("1e", DecodeError.UnexpectedEnd)] // no exponent digits
    [InlineData("1e+", DecodeError.UnexpectedEnd)] // exponent sign without digits
    [InlineData("-", DecodeError.UnexpectedEnd)] // sign without digits
    [InlineData("null x", DecodeError.TrailingData)] // value + trailing token
    [InlineData("nullnull", DecodeError.TrailingData)] // two values
    [InlineData("1.5", DecodeError.Unsupported)] // Float deferred
    [InlineData("1e10", DecodeError.Unsupported)] // Float (exponent) deferred
    [InlineData("-0.0", DecodeError.Unsupported)] // Float deferred
    [InlineData("9223372036854775808", DecodeError.IntegerOverflow)] // i64::MAX + 1
    [InlineData("-9223372036854775809", DecodeError.IntegerOverflow)] // i64::MIN - 1
    [InlineData(" null", DecodeError.NonCanonical)] // leading whitespace
    [InlineData("[1, 2]", DecodeError.NonCanonical)] // space after comma
    [InlineData("01", DecodeError.NonCanonical)] // leading zero (parses to 1 → "1")
    [InlineData("\"\\u0041\"", DecodeError.NonCanonical)] // A; canonical emits raw "A"
    [InlineData("{ \"a\":1}", DecodeError.NonCanonical)] // whitespace inside object
    public void JsonDecodeRejects(string json, DecodeError expected)
    {
        var result = DynamicValues.FromCanonicalJson(json);
        var err = Assert.IsType<Result<DynamicValue, DecodeError>.Err>(result);
        Assert.Equal(expected, err.Error);
    }
}
