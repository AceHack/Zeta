using System;
using System.Collections.Generic;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// Tests for <see cref="ImdbSchemas"/> — the IR grounded in the real IMDb dataset. The schema is
/// derived from the actual TSV header, then the same schema renders to C# / Rust surfaces.
/// </summary>
public class ImdbSchemasTests
{
    [Fact]
    public void FromTsvHeaderDerivesSchemaFromRealHeaderLine()
    {
        // The actual name.basics.tsv header row, split on tab — the IR driven by the dataset.
        string[] header = "nconst\tprimaryName\tbirthYear\tdeathYear\tprimaryProfession\tknownForTitles".Split('\t');
        TypeSchema schema = ImdbSchemas.FromTsvHeader(
            "Zeta.Generated.Imdb",
            "ImdbName",
            header,
            new Dictionary<string, string>(StringComparer.Ordinal) { ["birthYear"] = "int?", ["deathYear"] = "int?" });

        Assert.Equal("ImdbName", schema.TypeName);
        Assert.Equal(6, schema.Fields.Count);
        Assert.Equal("PrimaryName", schema.Fields[1].Name);
        Assert.Equal("int?", schema.Fields[2].CsType);
        Assert.Equal("KnownForTitles", schema.Fields[5].Name);
    }

    [Fact]
    public void RealNameBasicsGeneratesCSharpRecordWithRealColumns()
    {
        string cs = SchemaCodegen.Generate(ImdbSchemas.NameBasics);
        Assert.Contains(
            "public sealed record ImdbName(string Nconst, string PrimaryName, int? BirthYear, int? DeathYear, string PrimaryProfession, string KnownForTitles);",
            cs,
            StringComparison.Ordinal);
    }

    [Fact]
    public void RealNameBasicsGeneratesRustStructWithIdioms()
    {
        string rust = RustSchemaCodegen.Generate(ImdbSchemas.NameBasics);
        Assert.Contains("pub birth_year: Option<i32>,", rust, StringComparison.Ordinal);
        Assert.Contains("pub known_for_titles: String,", rust, StringComparison.Ordinal);
    }

    [Fact]
    public void TitleBasicsAndPrincipalsAreGrounded()
    {
        Assert.Contains("public sealed record ImdbTitle(", SchemaCodegen.Generate(ImdbSchemas.TitleBasics), StringComparison.Ordinal);
        Assert.Contains("bool IsAdult", SchemaCodegen.Generate(ImdbSchemas.TitleBasics), StringComparison.Ordinal);
        Assert.Contains("int Ordering", SchemaCodegen.Generate(ImdbSchemas.TitlePrincipals), StringComparison.Ordinal);
    }

    [Fact]
    public void AlignsWithImdbDatasetParsedSubset()
    {
        // ImdbDataset.fs parses a subset (Nconst, PrimaryName) — both must exist in the full real schema.
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (SchemaField field in ImdbSchemas.NameBasics.Fields)
        {
            names.Add(field.Name);
        }

        Assert.Contains("Nconst", names);
        Assert.Contains("PrimaryName", names);
    }
}
