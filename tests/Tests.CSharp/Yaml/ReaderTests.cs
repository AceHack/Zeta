// C# oracle (oracle #4) unit tests for YamlReader (L1).
//
// One [Fact] per canonical vector hard-coding the expected event list, plus decline-path
// facts (TabIndentation, UnterminatedQuote, UnsupportedConstruct).

namespace Zeta.Tests.CSharp.Yaml;

using Xunit;
using Zeta.Core.CSharp.Yaml;

// Shorthands to keep test bodies compact.
file static class E
{
    public static YamlEvent SS => new YamlEvent.StreamStart();
    public static YamlEvent SE => new YamlEvent.StreamEnd();
    public static YamlEvent MS => new YamlEvent.MappingStart();
    public static YamlEvent ME => new YamlEvent.MappingEnd();
    public static YamlEvent SQS => new YamlEvent.SequenceStart();
    public static YamlEvent SQE => new YamlEvent.SequenceEnd();
    public static YamlEvent Plain(string raw, ScalarKind kind) =>
        new YamlEvent.Scalar(raw, kind, ScalarStyle.Plain);
    public static YamlEvent Key(string raw) =>
        Plain(raw, ScalarKind.Str);
    public static YamlEvent DQ(string raw) =>
        new YamlEvent.Scalar(raw, ScalarKind.Str, ScalarStyle.DoubleQuoted);
    public static YamlEvent SQ(string raw) =>
        new YamlEvent.Scalar(raw, ScalarKind.Str, ScalarStyle.SingleQuoted);
}

file static class Helper
{
    public static IReadOnlyList<YamlEvent> Ok(string yaml)
    {
        ReadResult r = YamlReader.ReadEvents(yaml);
        Assert.True(r.Ok, $"Expected Ok but got feedback={r.Feedback}");
        return r.Events!;
    }

    public static YamlFeedback Fail(string yaml)
    {
        ReadResult r = YamlReader.ReadEvents(yaml);
        Assert.False(r.Ok, "Expected failure but got Ok");
        return r.Feedback!.Value;
    }

    public static void AssertEvents(string yaml, YamlEvent[] expected)
    {
        IReadOnlyList<YamlEvent> actual = Ok(yaml);
        Assert.Equal(expected.Length, actual.Count);
        for (int i = 0; i < expected.Length; i++)
            Assert.Equal(expected[i], actual[i]);
    }
}

public class ReaderTests
{
    // --- Canonical vectors -------------------------------------------------------

    [Fact]
    public void EmptyMapValueEmitsNullScalar()
    {
        Helper.AssertEvents("a:\n", [
            E.SS, E.MS,
            E.Key("a"), E.Plain("", ScalarKind.Null),
            E.ME, E.SE,
        ]);
    }

    [Fact]
    public void FlatScalarsResolveKindsCorrectly()
    {
        Helper.AssertEvents("name: zeta\ncount: 42\nratio: 3.14\nok: true\ngone: null\n", [
            E.SS, E.MS,
            E.Key("name"),  E.Plain("zeta",  ScalarKind.Str),
            E.Key("count"), E.Plain("42",    ScalarKind.Int),
            E.Key("ratio"), E.Plain("3.14",  ScalarKind.Float),
            E.Key("ok"),    E.Plain("true",  ScalarKind.Bool),
            E.Key("gone"),  E.Plain("null",  ScalarKind.Null),
            E.ME, E.SE,
        ]);
    }

    [Fact]
    public void QuotedScalarsForcesStrKind()
    {
        Helper.AssertEvents("a: \"42\"\nb: '3.14'\n", [
            E.SS, E.MS,
            E.Key("a"), E.DQ("42"),
            E.Key("b"), E.SQ("3.14"),
            E.ME, E.SE,
        ]);
    }

    [Fact]
    public void DoubleQuoteEscapesDecoded()
    {
        // JSON-embedded: msg: "he said \"hi\"\nbye"
        Helper.AssertEvents("msg: \"he said \\\"hi\\\"\\nbye\"\n", [
            E.SS, E.MS,
            E.Key("msg"), E.DQ("he said \"hi\"\nbye"),
            E.ME, E.SE,
        ]);
    }

    [Fact]
    public void SingleQuoteDoublingUnescaped()
    {
        Helper.AssertEvents("a: 'it''s'\n", [
            E.SS, E.MS,
            E.Key("a"), E.SQ("it's"),
            E.ME, E.SE,
        ]);
    }

    [Fact]
    public void NestedMapEmitsTwoMappingStartEnd()
    {
        Helper.AssertEvents("outer:\n  inner: 1\n", [
            E.SS, E.MS,
            E.Key("outer"),
            E.MS,
            E.Key("inner"), E.Plain("1", ScalarKind.Int),
            E.ME,
            E.ME, E.SE,
        ]);
    }

    [Fact]
    public void TopLevelSequenceEmitsItems()
    {
        Helper.AssertEvents("- a\n- b\n", [
            E.SS, E.SQS,
            E.Plain("a", ScalarKind.Str),
            E.Plain("b", ScalarKind.Str),
            E.SQE, E.SE,
        ]);
    }

    [Fact]
    public void SequenceOfMapsEmitsCompactItems()
    {
        Helper.AssertEvents("items:\n  - id: x\n    n: 1\n  - id: y\n    n: 2\n", [
            E.SS, E.MS,
            E.Key("items"),
            E.SQS,
            E.MS,
            E.Key("id"), E.Plain("x", ScalarKind.Str),
            E.Key("n"),  E.Plain("1", ScalarKind.Int),
            E.ME,
            E.MS,
            E.Key("id"), E.Plain("y", ScalarKind.Str),
            E.Key("n"),  E.Plain("2", ScalarKind.Int),
            E.ME,
            E.SQE,
            E.ME, E.SE,
        ]);
    }

    [Fact]
    public void CommentsAreDropped()
    {
        Helper.AssertEvents("# top\na: 1  # trail\nb: 2\n", [
            E.SS, E.MS,
            E.Key("a"), E.Plain("1", ScalarKind.Int),
            E.Key("b"), E.Plain("2", ScalarKind.Int),
            E.ME, E.SE,
        ]);
    }

    [Fact]
    public void NullFormsAndStringsResolveCorrectly()
    {
        Helper.AssertEvents("a: ~\nb:\nc: 12abc\nd: -2.5\n", [
            E.SS, E.MS,
            E.Key("a"), E.Plain("~",     ScalarKind.Null),
            E.Key("b"), E.Plain("",      ScalarKind.Null),
            E.Key("c"), E.Plain("12abc", ScalarKind.Str),
            E.Key("d"), E.Plain("-2.5",  ScalarKind.Float),
            E.ME, E.SE,
        ]);
    }

    // --- Decline-path facts -----------------------------------------------------

    [Fact]
    public void TabInIndentationDeclines()
    {
        YamlFeedback fb = Helper.Fail("\tx: 1\n");
        Assert.Equal(YamlFeedback.TabIndentation, fb);
    }

    [Fact]
    public void UnterminatedDoubleQuoteDeclines()
    {
        YamlFeedback fb = Helper.Fail("a: \"unterminated\n");
        Assert.Equal(YamlFeedback.UnterminatedQuote, fb);
    }

    [Fact]
    public void AnchorValueDeclinesAsUnsupported()
    {
        YamlFeedback fb = Helper.Fail("a: &anchor\n");
        Assert.Equal(YamlFeedback.UnsupportedConstruct, fb);
    }
}
