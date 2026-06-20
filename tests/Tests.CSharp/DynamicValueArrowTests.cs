using System.Collections.Immutable;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// DynamicValue ↔ Apache Arrow IPC codec — the C# oracle (<see cref="DynamicValuesArrow"/>) under the
/// shredded node-table encoding. Proves: the round-trip LAW (<c>FromArrow(ToArrow(v)) == v</c>) over
/// the 47 shared vectors (NaN by bit-equality); never-collapse distinctness; non-finite floats; AND
/// the F#↔C# / cross-vector byte-lock against the shared interop fixture
/// <c>src/Core.TypeScript/dynamic-value/golden-vectors-arrow.json</c> — Arrow Phase 2, option c: F#
/// (<c>Zeta.Core.DynamicValueArrow.toArrow</c>) and C# (<see cref="DynamicValuesArrow.ToArrow"/>)
/// both use the .NET <c>Apache.Arrow</c> lib and so emit BYTE-IDENTICAL Arrow IPC.
/// </summary>
public class DynamicValueArrowTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(DynamicValueArrowTests).Assembly.Location)!);
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

    /// <summary>Build a DynamicValue from the seed's language-neutral tagged form { t, v }.</summary>
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
                            if (parts.Length != 2)
                            {
                                throw new InvalidOperationException(
                                    $"seed object pair must have exactly 2 elements [key, value], got {parts.Length}");
                            }

                            string key = parts[0].GetString()
                                ?? throw new InvalidOperationException("object key is not a string");
                            return new KeyValuePair<string, DynamicValue>(key, BuildValue(parts[1]));
                        })
                        .ToImmutableArray());
            default:
                throw new InvalidOperationException($"unsupported tag in seed: {tag}");
        }
    }

    // The 47-value set comes from the locked XML golden vectors (shared value seed across codecs).
    private static JsonElement[] LoadXmlVectors()
    {
        string path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "dynamic-value", "golden-vectors-xml.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        JsonElement[] vectors = doc.RootElement.GetProperty("vectors")
            .EnumerateArray().Select(e => e.Clone()).ToArray();
        Assert.NotEmpty(vectors);
        return vectors;
    }

    private static JsonElement[] LoadArrowVectors()
    {
        string path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "dynamic-value", "golden-vectors-arrow.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        JsonElement[] vectors = doc.RootElement.GetProperty("vectors")
            .EnumerateArray().Select(e => e.Clone()).ToArray();
        Assert.NotEmpty(vectors);
        return vectors;
    }

    private static DynamicValue Decode(byte[] bytes)
    {
        var ok = Assert.IsType<Result<DynamicValue, DecodeError>.Ok>(DynamicValuesArrow.FromArrow(bytes));
        return ok.Value;
    }

    // Structural equality that treats NaN floats as equal BY BIT PATTERN (double.NaN != double.NaN).
    private static bool BitEqual(DynamicValue a, DynamicValue b)
    {
        switch (a, b)
        {
            case (DynamicValue.Float fa, DynamicValue.Float fb):
                return BitConverter.DoubleToInt64Bits(fa.Value) == BitConverter.DoubleToInt64Bits(fb.Value);
            case (DynamicValue.Array aa, DynamicValue.Array ab):
                return aa.Items.Length == ab.Items.Length
                    && aa.Items.Zip(ab.Items, BitEqual).All(x => x);
            case (DynamicValue.Object oa, DynamicValue.Object ob):
                return oa.Pairs.Length == ob.Pairs.Length
                    && oa.Pairs.Zip(ob.Pairs, (pa, pb) =>
                        string.Equals(pa.Key, pb.Key, StringComparison.Ordinal) && BitEqual(pa.Value, pb.Value))
                        .All(x => x);
            default:
                return a.Equals(b);
        }
    }

    [Fact]
    public void RoundTripLawOverSharedVectors()
    {
        var failures = new List<string>();
        foreach (JsonElement v in LoadXmlVectors())
        {
            string name = Str(v, "name");
            DynamicValue value = BuildValue(v.GetProperty("value"));
            DynamicValue back = Decode(DynamicValuesArrow.ToArrowOk(value));
            if (!BitEqual(value, back))
            {
                failures.Add($"{name}: round-trip mismatch");
            }
        }

        Assert.Empty(failures);
    }

    [Fact]
    public void NeverCollapseGivesFiveDistinctArrowStreams()
    {
        byte[] nullA = DynamicValuesArrow.ToArrowOk(new DynamicValue.Null());
        byte[] emptyArr = DynamicValuesArrow.ToArrowOk(new DynamicValue.Array(ImmutableArray<DynamicValue>.Empty));
        byte[] emptyObj = DynamicValuesArrow.ToArrowOk(
            new DynamicValue.Object(ImmutableArray<KeyValuePair<string, DynamicValue>>.Empty));
        byte[] emptyStr = DynamicValuesArrow.ToArrowOk(new DynamicValue.String(string.Empty));
        byte[] emptyBytes = DynamicValuesArrow.ToArrowOk(new DynamicValue.Bytes(ImmutableArray<byte>.Empty));

        var distinct = new HashSet<string>(StringComparer.Ordinal)
        {
            Convert.ToHexString(nullA),
            Convert.ToHexString(emptyArr),
            Convert.ToHexString(emptyObj),
            Convert.ToHexString(emptyStr),
            Convert.ToHexString(emptyBytes),
        };
        Assert.Equal(5, distinct.Count);

        // and each decodes back to the distinct empty shape.
        Assert.IsType<DynamicValue.Null>(Decode(nullA));
        Assert.IsType<DynamicValue.Array>(Decode(emptyArr));
        Assert.IsType<DynamicValue.Object>(Decode(emptyObj));
        Assert.IsType<DynamicValue.String>(Decode(emptyStr));
        Assert.IsType<DynamicValue.Bytes>(Decode(emptyBytes));
    }

    [Theory]
    [InlineData(0x7ff8000000000000UL)] // canonical NaN
    [InlineData(0xfff8000000000000UL)] // negative NaN
    [InlineData(0x7ff0000000000000UL)] // +Inf
    [InlineData(0xfff0000000000000UL)] // -Inf
    [InlineData(0x8000000000000000UL)] // -0.0
    [InlineData(0x0000000000000001UL)] // smallest subnormal
    public void NonFiniteAndCornerFloatsPreserveBits(ulong bits)
    {
        double d = BitConverter.UInt64BitsToDouble(bits);
        DynamicValue back = Decode(DynamicValuesArrow.ToArrowOk(new DynamicValue.Float(d)));
        var f = Assert.IsType<DynamicValue.Float>(back);
        Assert.Equal(bits, BitConverter.DoubleToInt64Bits(f.Value) is long l ? unchecked((ulong)l) : 0UL);
    }

    [Fact]
    public void MalformedBytesSurfaceAsError()
    {
        var err = Assert.IsType<Result<DynamicValue, DecodeError>.Err>(
            DynamicValuesArrow.FromArrow(new byte[] { 0x00, 0x01, 0x02, 0x03 }));
        Assert.Equal(DecodeError.MalformedArrow, err.Error);
    }

    [Fact]
    public void GoldenByteLockEncodeAndDecode()
    {
        var failures = new List<string>();
        foreach (JsonElement v in LoadArrowVectors())
        {
            string name = Str(v, "name");
            DynamicValue value = BuildValue(v.GetProperty("value"));
            string expectedHex = Str(v, "arrowHex");

            string actualHex = Convert.ToHexString(DynamicValuesArrow.ToArrowOk(value)).ToLowerInvariant();
            if (!string.Equals(actualHex, expectedHex, StringComparison.Ordinal))
            {
                failures.Add($"{name}: encode hex mismatch");
            }

            byte[] fixtureBytes = Convert.FromHexString(expectedHex);
            if (!BitEqual(value, Decode(fixtureBytes)))
            {
                failures.Add($"{name}: decode-from-fixture mismatch");
            }
        }

        Assert.Empty(failures);
    }

    /// <summary>
    /// The Arrow Phase 2 option-c byte-lock: C# <see cref="DynamicValuesArrow.ToArrow"/> bytes MUST
    /// equal F# <c>Zeta.Core.DynamicValueArrow.toArrow</c> bytes for every shared vector (both use the
    /// same .NET Apache.Arrow). This is the proof that the two oracles produce byte-identical IPC.
    /// </summary>
    [Fact]
    public void FSharpAndCSharpArrowBytesAreByteIdentical()
    {
        var failures = new List<string>();
        foreach (JsonElement v in LoadXmlVectors())
        {
            string name = Str(v, "name");
            DynamicValue value = BuildValue(v.GetProperty("value"));

            byte[] cs = DynamicValuesArrow.ToArrowOk(value);
            byte[] fs = FSharpToArrow(value);

            if (!cs.AsSpan().SequenceEqual(fs))
            {
                failures.Add($"{name}: F#/C# Arrow bytes differ (cs={cs.Length}B fs={fs.Length}B)");
            }
        }

        Assert.Empty(failures);
    }

    // Calls the F# reference codec on the SAME DynamicValue value. The C# DynamicValue and the F#
    // DynamicValue are distinct CLR types, so translate the tree across the boundary, then invoke
    // Zeta.Core.DynamicValueArrow.toArrow.
    private static byte[] FSharpToArrow(DynamicValue value) =>
        Zeta.Core.DynamicValueArrow.toArrowOk(ToFSharp(value));

    private static Zeta.Core.DynamicValue ToFSharp(DynamicValue v)
    {
        switch (v)
        {
            case DynamicValue.Null:
                return Zeta.Core.DynamicValue.Null;
            case DynamicValue.Bool b:
                return Zeta.Core.DynamicValue.NewBool(b.Value);
            case DynamicValue.Int i:
                return Zeta.Core.DynamicValue.NewInt(i.Value);
            case DynamicValue.Float f:
                return Zeta.Core.DynamicValue.NewFloat(f.Value);
            case DynamicValue.String s:
                return Zeta.Core.DynamicValue.NewString(s.Value);
            case DynamicValue.Bytes by:
                return Zeta.Core.DynamicValue.NewBytes(by.Value);
            case DynamicValue.Array arr:
                return Zeta.Core.DynamicValue.NewArray(
                    Microsoft.FSharp.Collections.ListModule.OfSeq(arr.Items.Select(ToFSharp)));
            case DynamicValue.Object obj:
                return Zeta.Core.DynamicValue.NewObject(
                    Microsoft.FSharp.Collections.ListModule.OfSeq(
                        obj.Pairs.Select(p => System.Tuple.Create(p.Key, ToFSharp(p.Value)))));
            default:
                throw new InvalidOperationException($"unhandled C# DynamicValue shape: {v.Type}");
        }
    }
}
