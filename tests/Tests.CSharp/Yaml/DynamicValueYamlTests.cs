using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp.Yaml;

public class DynamicValueYamlTests
{
    private static DynamicValue.Bytes Bytes(params byte[] xs) => new(ImmutableArray.Create(xs));
    private static DynamicValue.Array Arr(params DynamicValue[] xs) => new(ImmutableArray.Create(xs));
    private static DynamicValue.Object Obj(params (string Key, DynamicValue Value)[] kvs) =>
        new(kvs.Select(kv => new KeyValuePair<string, DynamicValue>(kv.Key, kv.Value)).ToImmutableArray());

    [Fact]
    public void DynamicValueToYamlAndFromYamlRoundTrips()
    {
        var sample = Obj(
            ("a", new DynamicValue.Int(10L)),
            ("b", new DynamicValue.String("hello")),
            ("n", new DynamicValue.Null()),
            ("nested", Arr(new DynamicValue.Int(1L), new DynamicValue.Bool(true)))
        );

        var toRes = DynamicValues.ToYaml(sample);
        Assert.True(toRes is Result<string, EncodeError>.Ok);
        var yaml = ((Result<string, EncodeError>.Ok)toRes).Value;

        var fromRes = DynamicValues.FromYaml(yaml);
        Assert.True(fromRes is Result<DynamicValue, DecodeError>.Ok);
        var decoded = ((Result<DynamicValue, DecodeError>.Ok)fromRes).Value;

        Assert.Equal(sample, decoded);
    }

    [Fact]
    public void FromYamlRejectsNonCanonical()
    {
        var nonCanonical = "a: 10\n";
        var res = DynamicValues.FromYaml(nonCanonical);
        Assert.True(res is Result<DynamicValue, DecodeError>.Err);
        Assert.Equal(DecodeError.NonCanonical, ((Result<DynamicValue, DecodeError>.Err)res).Error);
    }

    [Fact]
    public void MarkdownTreatyParsesAndSerializes()
    {
        var metadata = Obj(
            ("title", new DynamicValue.String("Zeta C# Treaty")),
            ("version", new DynamicValue.Int(1L))
        );
        var body = "This is the document body.\nLine 2.\n";

        var serRes = MarkdownTreaty.Serialize(metadata, body);
        var serialized = ((Result<string, EncodeError>.Ok)serRes).Value;
        Assert.StartsWith("---", serialized, System.StringComparison.Ordinal);

        var parseRes = MarkdownTreaty.Parse(serialized);
        Assert.True(parseRes is Result<(DynamicValue Metadata, string Body), string>.Ok);
        var parsed = ((Result<(DynamicValue Metadata, string Body), string>.Ok)parseRes).Value;

        Assert.Equal(metadata, parsed.Metadata);
        Assert.Equal(body, parsed.Body);
    }

    [Fact]
    public void MarkdownTreatyHandlesEmptyMetadata()
    {
        var metadata = Obj();
        var body = "Pure markdown document with no frontmatter.\n";

        var serRes = MarkdownTreaty.Serialize(metadata, body);
        Assert.True(serRes is Result<string, EncodeError>.Ok);
        var serialized = ((Result<string, EncodeError>.Ok)serRes).Value;

        Assert.Equal(body, serialized);

        var parseRes = MarkdownTreaty.Parse(serialized);
        Assert.True(parseRes is Result<(DynamicValue Metadata, string Body), string>.Ok);
        var parsed = ((Result<(DynamicValue Metadata, string Body), string>.Ok)parseRes).Value;

        Assert.Equal(metadata, parsed.Metadata);
        Assert.Equal(body, parsed.Body);
    }
}
