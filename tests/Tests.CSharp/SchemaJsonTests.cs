using System;
using System.IO;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// Tests for <see cref="SchemaJson"/> and the committed shared <c>.zetaschema.json</c> IR files —
/// one source of truth consumed by every codegen leg. The committed files are golden-locked to
/// <see cref="ImdbSchemas"/> so the file and the code-defined schema can never drift.
/// </summary>
public class SchemaJsonTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(SchemaJsonTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln).");
    }

    private static string SchemaFile(string name) =>
        File.ReadAllText(Path.Join(RepoRoot(), "schemas", "imdb", name));

    [Theory]
    [InlineData("name-basics.zetaschema.json")]
    [InlineData("title-basics.zetaschema.json")]
    [InlineData("title-principals.zetaschema.json")]
    public void CommittedFileRoundTripsThroughFromJsonAndToJson(string file)
    {
        string text = SchemaFile(file);
        TypeSchema schema = SchemaJson.FromJson(text);
        // ToJson is byte-stable, so re-serializing the parsed schema reproduces the committed file.
        Assert.Equal(text, SchemaJson.ToJson(schema));
    }

    [Fact]
    public void CommittedNameBasicsIsGoldenLockedToImdbSchemas()
    {
        // The committed file MUST equal the code-defined schema — single source of truth, no drift.
        Assert.Equal(SchemaFile("name-basics.zetaschema.json"), SchemaJson.ToJson(ImdbSchemas.NameBasics));
        Assert.Equal(SchemaFile("title-basics.zetaschema.json"), SchemaJson.ToJson(ImdbSchemas.TitleBasics));
        Assert.Equal(SchemaFile("title-principals.zetaschema.json"), SchemaJson.ToJson(ImdbSchemas.TitlePrincipals));
    }

    [Fact]
    public void LoadedSchemaFeedsCSharpAndRustCodegen()
    {
        // The shared IR file → the same typed surfaces the in-code schema produces.
        TypeSchema fromFile = SchemaJson.FromJson(SchemaFile("name-basics.zetaschema.json"));
        Assert.Contains(
            "public sealed record ImdbName(string Nconst, string PrimaryName, int? BirthYear, int? DeathYear, string PrimaryProfession, string KnownForTitles);",
            SchemaCodegen.Generate(fromFile),
            StringComparison.Ordinal);
        Assert.Contains("pub birth_year: Option<i32>,", RustSchemaCodegen.Generate(fromFile), StringComparison.Ordinal);
    }

    [Fact]
    public void FromJsonRejectsMissingFields()
    {
        Assert.Throws<FormatException>(() => SchemaJson.FromJson("{ \"namespace\": \"X\", \"typeName\": \"Y\" }"));
    }
}
