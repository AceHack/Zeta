using System;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// Tests for <see cref="SchemaTsvParser"/> — the same IMDb schema that generates the types also
/// parses real TSV rows into typed <see cref="DynamicValue"/> values, with <c>\N</c> → Null.
/// </summary>
public class SchemaTsvParserTests
{
    private static DynamicValue Field(DynamicValue v, string key) =>
        DynamicValues.TryField(v, key) ?? throw new InvalidOperationException($"missing field {key}");

    [Fact]
    public void ParsesRealNameBasicsRowIntoTypedObject()
    {
        // Real name.basics shape: nconst, primaryName, birthYear, deathYear, professions, knownForTitles.
        const string Row = "nm0000001\tFred Astaire\t1899\t1987\tactor,miscellaneous\ttt0072308,tt0050419";
        DynamicValue v = SchemaTsvParser.ParseRow(ImdbSchemas.NameBasics, Row);

        Assert.Equal("nm0000001", DynamicValues.TryString(Field(v, "Nconst")));
        Assert.Equal("Fred Astaire", DynamicValues.TryString(Field(v, "PrimaryName")));
        Assert.Equal((long?)1899, DynamicValues.TryInt(Field(v, "BirthYear")));
        Assert.Equal((long?)1987, DynamicValues.TryInt(Field(v, "DeathYear")));
    }

    [Fact]
    public void MapsImdbNullMarkerToNull()
    {
        // Living person → deathYear is the IMDb null marker \N.
        const string Row = "nm0000002\tLauren Bacall\t1924\t\\N\tactress\ttt0038355";
        DynamicValue v = SchemaTsvParser.ParseRow(ImdbSchemas.NameBasics, Row);

        Assert.True(DynamicValues.IsNull(Field(v, "DeathYear")));
        Assert.Equal((long?)1924, DynamicValues.TryInt(Field(v, "BirthYear")));
    }

    [Fact]
    public void ParsesBoolAndNullableIntColumns()
    {
        // title.basics: tconst, titleType, primaryTitle, originalTitle, isAdult, startYear, endYear, runtimeMinutes, genres.
        const string Row = "tt0000001\tshort\tCarmencita\tCarmencita\t0\t1894\t\\N\t1\tDocumentary,Short";
        DynamicValue v = SchemaTsvParser.ParseRow(ImdbSchemas.TitleBasics, Row);

        Assert.Equal((bool?)false, DynamicValues.TryBool(Field(v, "IsAdult")));
        Assert.Equal((long?)1894, DynamicValues.TryInt(Field(v, "StartYear")));
        Assert.True(DynamicValues.IsNull(Field(v, "EndYear")));
        Assert.Equal((long?)1, DynamicValues.TryInt(Field(v, "RuntimeMinutes")));
    }

    [Fact]
    public void ThrowsOnColumnCountMismatch()
    {
        Assert.Throws<FormatException>(() => SchemaTsvParser.ParseRow(ImdbSchemas.NameBasics, "too\tfew\tcols"));
    }
}
