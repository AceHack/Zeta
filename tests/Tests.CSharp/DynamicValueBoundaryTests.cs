using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.IO;
using System.Text;
using Apache.Arrow;
using Apache.Arrow.Ipc;
using Apache.Arrow.Types;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

public sealed class DynamicValueBoundaryTests
{
    // nest k wraps Null in k single-element arrays
    private static DynamicValue Nest(int k)
    {
        DynamicValue acc = new DynamicValue.Null();
        for (int i = 0; i < k; i++)
        {
            acc = new DynamicValue.Array(ImmutableArray.Create(acc));
        }
        return acc;
    }

    [Fact]
    public void DepthBoundValueAtMaxNestingEncodesOk()
    {
        var okJson = DynamicValues.ToCanonicalJson(Nest(256));
        Assert.True(okJson is Result<string, EncodeError>.Ok, "256 nesting JSON should be Ok");
    }

    [Fact]
    public void DepthBoundValueOneDeeperIsNestingTooDeep()
    {
        var errJson = DynamicValues.ToCanonicalJson(Nest(257));
        var errJsonCast = Assert.IsType<Result<string, EncodeError>.Err>(errJson);
        Assert.Equal(EncodeError.NestingTooDeep, errJsonCast.Error);

        var errXml = DynamicValuesXml.ToCanonicalXml(Nest(257));
        var errXmlCast = Assert.IsType<Result<string, EncodeError>.Err>(errXml);
        Assert.Equal(EncodeError.NestingTooDeep, errXmlCast.Error);

        var errCbor = DynamicValues.ToCanonicalCbor(Nest(257));
        var errCborCast = Assert.IsType<Result<byte[], EncodeError>.Err>(errCbor);
        Assert.Equal(EncodeError.NestingTooDeep, errCborCast.Error);

        var errArrow = DynamicValuesArrow.ToArrow(Nest(257));
        var errArrowCast = Assert.IsType<Result<byte[], EncodeError>.Err>(errArrow);
        Assert.Equal(EncodeError.NestingTooDeep, errArrowCast.Error);

        var errYaml = DynamicValues.ToYaml(Nest(257));
        var errYamlCast = Assert.IsType<Result<string, EncodeError>.Err>(errYaml);
        Assert.Equal(EncodeError.NestingTooDeep, errYamlCast.Error);
    }

    [Fact]
    public void DepthBoundDecodingPastMaxNestingIsNestingTooDeepJsonXml()
    {
        var json256 = new StringBuilder();
        for (int i = 0; i < 256; i++) json256.Append('[');
        json256.Append("null");
        for (int i = 0; i < 256; i++) json256.Append(']');

        var okJson = DynamicValues.FromCanonicalJson(json256.ToString());
        Assert.True(okJson is Result<DynamicValue, DecodeError>.Ok, "256 json decode should be Ok");

        var json257 = new StringBuilder();
        for (int i = 0; i < 257; i++) json257.Append('[');
        json257.Append("null");
        for (int i = 0; i < 257; i++) json257.Append(']');

        var errJson = DynamicValues.FromCanonicalJson(json257.ToString());
        var errJsonCast = Assert.IsType<Result<DynamicValue, DecodeError>.Err>(errJson);
        Assert.Equal(DecodeError.NestingTooDeep, errJsonCast.Error);

        var xml256 = new StringBuilder();
        for (int i = 0; i < 256; i++) xml256.Append("<arr>");
        xml256.Append("<null/>");
        for (int i = 0; i < 256; i++) xml256.Append("</arr>");

        var okXml = DynamicValuesXml.FromCanonicalXml(xml256.ToString());
        Assert.True(okXml is Result<DynamicValue, DecodeError>.Ok, "256 xml decode should be Ok");

        var xml257 = new StringBuilder();
        for (int i = 0; i < 257; i++) xml257.Append("<arr>");
        xml257.Append("<null/>");
        for (int i = 0; i < 257; i++) xml257.Append("</arr>");

        var errXml = DynamicValuesXml.FromCanonicalXml(xml257.ToString());
        var errXmlCast = Assert.IsType<Result<DynamicValue, DecodeError>.Err>(errXml);
        Assert.Equal(DecodeError.NestingTooDeep, errXmlCast.Error);
    }

    [Fact]
    public void DepthBoundDecodingPastMaxNestingIsNestingTooDeepCborArrow()
    {
        var cbor256Bytes = new byte[256 + 1];
        for (int i = 0; i < 256; i++) cbor256Bytes[i] = 0x81;
        cbor256Bytes[256] = 0xf6;

        var okCbor = DynamicValues.FromCanonicalCbor(cbor256Bytes);
        Assert.True(okCbor is Result<DynamicValue, DecodeError>.Ok, "256 cbor decode should be Ok");

        var cbor257Bytes = new byte[257 + 1];
        for (int i = 0; i < 257; i++) cbor257Bytes[i] = 0x81;
        cbor257Bytes[257] = 0xf6;

        var errCbor = DynamicValues.FromCanonicalCbor(cbor257Bytes);
        var errCborCast = Assert.IsType<Result<DynamicValue, DecodeError>.Err>(errCbor);
        Assert.Equal(DecodeError.NestingTooDeep, errCborCast.Error);

        var arrow256Bytes = BuildDeepArrowStream(256);
        var okArrow = DynamicValuesArrow.FromArrow(arrow256Bytes);
        Assert.True(okArrow is Result<DynamicValue, DecodeError>.Ok, "256 arrow decode should be Ok");

        var arrow257Bytes = BuildDeepArrowStream(257);
        var errArrow = DynamicValuesArrow.FromArrow(arrow257Bytes);
        var errArrowCast = Assert.IsType<Result<DynamicValue, DecodeError>.Err>(errArrow);
        Assert.Equal(DecodeError.NestingTooDeep, errArrowCast.Error);
    }

    private static byte[] BuildDeepArrowStream(int depth)
    {
        var kind = new Int8Array.Builder();
        var parent = new Int32Array.Builder();
        var key = new StringArray.Builder();
        var b = new BooleanArray.Builder();
        var i = new Int64Array.Builder();
        var f = new DoubleArray.Builder();
        var s = new StringArray.Builder();
        var by = new BinaryArray.Builder();

        for (int row = 0; row <= depth; row++)
        {
            kind.Append((sbyte)(row == depth ? 0 : 6));
            parent.Append(row - 1);
            key.AppendNull();
            b.AppendNull(); i.AppendNull(); f.AppendNull(); s.AppendNull(); by.AppendNull();
        }

        var columns = new IArrowArray[] { kind.Build(), parent.Build(), key.Build(), b.Build(), i.Build(), f.Build(), s.Build(), by.Build() };
        var schema = new Schema(new[]
        {
            new Field("kind", Int8Type.Default, false),
            new Field("parent", Int32Type.Default, false),
            new Field("key", StringType.Default, true),
            new Field("b", BooleanType.Default, true),
            new Field("i", Int64Type.Default, true),
            new Field("f", DoubleType.Default, true),
            new Field("s", StringType.Default, true),
            new Field("by", BinaryType.Default, true),
        }, metadata: null);

        var batch = new RecordBatch(schema, columns, depth + 1);
        using var ms = new MemoryStream();
        using (var writer = new ArrowStreamWriter(ms, schema))
        {
            writer.WriteRecordBatch(batch);
            writer.WriteEnd();
        }
        return ms.ToArray();
    }
}
