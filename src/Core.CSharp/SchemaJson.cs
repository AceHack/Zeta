using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;

namespace Zeta.Core.CSharp;

/// <summary>
/// Serialize / parse a <see cref="TypeSchema"/> as a <c>.zetaschema.json</c> file — the shared,
/// language-neutral IR file that every codegen leg consumes from ONE source of truth: the C#
/// <see cref="SchemaCodegen"/> / <see cref="RustSchemaCodegen"/>, the TypeScript leg, and the
/// Roslyn source generator (approach A) all read this same format
/// (<c>{ "namespace", "typeName", "fields": [ { "name", "csType" } ] }</c>).
/// <para>
/// <see cref="ToJson"/> emits a deterministic, byte-stable layout (2-space indent, explicit
/// <c>\n</c>) so committed schema files are diffable + byte-lockable; <see cref="FromJson"/>
/// parses tolerantly via <c>System.Text.Json</c>.
/// </para>
/// </summary>
public static class SchemaJson
{
    /// <summary>Serialize a schema to the canonical, byte-stable <c>.zetaschema.json</c> text.</summary>
    /// <param name="schema">The schema (IR) to serialize.</param>
    /// <returns>Deterministic JSON with a trailing newline.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="schema"/> is null.</exception>
    public static string ToJson(TypeSchema schema)
    {
        ArgumentNullException.ThrowIfNull(schema);

        var sb = new StringBuilder();
        sb.Append("{\n");
        sb.Append("  \"namespace\": ").Append(JsonString(schema.Namespace)).Append(",\n");
        sb.Append("  \"typeName\": ").Append(JsonString(schema.TypeName)).Append(",\n");
        sb.Append("  \"fields\": [\n");
        for (var i = 0; i < schema.Fields.Count; i++)
        {
            SchemaField field = schema.Fields[i];
            sb.Append("    { \"name\": ").Append(JsonString(field.Name))
              .Append(", \"csType\": ").Append(JsonString(field.CsType)).Append(" }");
            sb.Append(i < schema.Fields.Count - 1 ? ",\n" : "\n");
        }

        sb.Append("  ]\n");
        sb.Append("}\n");
        return sb.ToString();
    }

    /// <summary>Parse a <c>.zetaschema.json</c> document into a <see cref="TypeSchema"/>.</summary>
    /// <param name="json">The schema JSON text.</param>
    /// <returns>The parsed schema.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="json"/> is null.</exception>
    /// <exception cref="FormatException">A required property is missing or malformed.</exception>
    public static TypeSchema FromJson(string json)
    {
        ArgumentNullException.ThrowIfNull(json);

        using var doc = JsonDocument.Parse(json);
        JsonElement root = doc.RootElement;

        string ns = RequireString(root, "namespace");
        string typeName = RequireString(root, "typeName");

        if (!root.TryGetProperty("fields", out JsonElement fieldsEl) || fieldsEl.ValueKind != JsonValueKind.Array)
        {
            throw new FormatException("zetaschema: missing or non-array 'fields'.");
        }

        var fields = new List<SchemaField>(fieldsEl.GetArrayLength());
        foreach (JsonElement f in fieldsEl.EnumerateArray())
        {
            fields.Add(new SchemaField(RequireString(f, "name"), RequireString(f, "csType")));
        }

        return new TypeSchema(ns, typeName, fields);
    }

    private static string RequireString(JsonElement el, string name)
    {
        if (!el.TryGetProperty(name, out JsonElement prop) || prop.ValueKind != JsonValueKind.String)
        {
            throw new FormatException($"zetaschema: missing or non-string '{name}'.");
        }

        return prop.GetString() ?? throw new FormatException($"zetaschema: null '{name}'.");
    }

    private static string JsonString(string value) => JsonSerializer.Serialize(value);
}
