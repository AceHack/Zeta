using System;
using System.Collections.Generic;

namespace Zeta.Core.CSharp;

/// <summary>
/// The real IMDb non-commercial dataset schemas, as zeta <see cref="TypeSchema"/> values — the
/// grounding step ("everything grows from IMDb and Wikipedia"). Each schema is derived from the
/// actual IMDb TSV column header via <see cref="FromTsvHeader"/> with IMDb's documented column
/// types, so the generated C# / Rust / TS surfaces reflect the real dataset, not a toy. IMDb
/// columns are camelCase; the neutral field names are PascalCase (the codegen baseline), and each
/// codegen re-idiomizes (C# PascalCase records, Rust <c>snake_case</c> structs, TS camelCase
/// interfaces). The subset <c>ImdbDataset.fs</c> currently parses (Nconst, PrimaryName; Tconst,
/// Category) is a subset of these full schemas.
/// </summary>
public static class ImdbSchemas
{
    private const string Ns = "Zeta.Generated.Imdb";

    private static readonly string[] NameBasicsColumns =
        ["nconst", "primaryName", "birthYear", "deathYear", "primaryProfession", "knownForTitles"];

    private static readonly string[] TitleBasicsColumns =
        ["tconst", "titleType", "primaryTitle", "originalTitle", "isAdult", "startYear", "endYear", "runtimeMinutes", "genres"];

    private static readonly string[] TitlePrincipalsColumns =
        ["tconst", "ordering", "nconst", "category", "job", "characters"];

    /// <summary>
    /// Build a <see cref="TypeSchema"/> from a real TSV header's columns — the IR driven by the
    /// dataset itself. Each column becomes a field (name PascalCased to the neutral baseline);
    /// its type comes from <paramref name="typeHints"/> or falls back to <paramref name="defaultType"/>
    /// (TSV is text, so unhinted columns are <c>string</c>).
    /// </summary>
    /// <param name="ns">Target namespace for the emitted type.</param>
    /// <param name="typeName">Emitted type name (PascalCase).</param>
    /// <param name="headerColumns">The dataset's actual column names (camelCase, from the TSV header row).</param>
    /// <param name="typeHints">Column-name → neutral type token; columns absent here use <paramref name="defaultType"/>.</param>
    /// <param name="defaultType">Neutral type token for columns without a hint.</param>
    /// <returns>A schema whose fields mirror the dataset's columns in order.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="headerColumns"/> or <paramref name="typeHints"/> is null.</exception>
    public static TypeSchema FromTsvHeader(
        string ns,
        string typeName,
        IReadOnlyList<string> headerColumns,
        IReadOnlyDictionary<string, string> typeHints,
        string defaultType = "string")
    {
        ArgumentNullException.ThrowIfNull(headerColumns);
        ArgumentNullException.ThrowIfNull(typeHints);

        var fields = new List<SchemaField>(headerColumns.Count);
        foreach (string column in headerColumns)
        {
            string csType = typeHints.TryGetValue(column, out string? hint) ? hint : defaultType;
            fields.Add(new SchemaField(Pascalize(column), csType));
        }

        return new TypeSchema(ns, typeName, fields);
    }

    /// <summary><c>name.basics.tsv</c> — people: nconst, primaryName, birth/death years, professions, known-for titles.</summary>
    public static TypeSchema NameBasics { get; } = FromTsvHeader(
        Ns,
        "ImdbName",
        NameBasicsColumns,
        new Dictionary<string, string>(StringComparer.Ordinal) { ["birthYear"] = "int?", ["deathYear"] = "int?" });

    /// <summary><c>title.basics.tsv</c> — works: tconst, types, titles, adult flag, years, runtime, genres.</summary>
    public static TypeSchema TitleBasics { get; } = FromTsvHeader(
        Ns,
        "ImdbTitle",
        TitleBasicsColumns,
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["isAdult"] = "bool",
            ["startYear"] = "int?",
            ["endYear"] = "int?",
            ["runtimeMinutes"] = "int?",
        });

    /// <summary><c>title.principals.tsv</c> — credited contributions: title, ordering, person, category, job, characters.</summary>
    public static TypeSchema TitlePrincipals { get; } = FromTsvHeader(
        Ns,
        "ImdbPrincipal",
        TitlePrincipalsColumns,
        new Dictionary<string, string>(StringComparer.Ordinal) { ["ordering"] = "int" });

    /// <summary>camelCase IMDb column to PascalCase neutral field name (e.g. <c>primaryName</c> → <c>PrimaryName</c>).</summary>
    private static string Pascalize(string column) =>
        column.Length == 0 ? column : char.ToUpperInvariant(column[0]) + column[1..];
}
