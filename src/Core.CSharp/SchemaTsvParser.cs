using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Globalization;

namespace Zeta.Core.CSharp;

/// <summary>
/// Schema-driven TSV row parser — the live-data counterpart to <see cref="SchemaCodegen"/>. Given a
/// <see cref="TypeSchema"/> (the same IR the codegens consume) and a raw IMDb TSV row, it produces a
/// typed <see cref="DynamicValue"/> object whose fields are coerced per the schema's neutral types
/// (<c>int?</c> → Int/Null, <c>bool</c> → Bool from <c>0</c>/<c>1</c>, <c>string</c> → String), with
/// IMDb's <c>\N</c> null marker mapped to <see cref="DynamicValue.Null"/>. So one schema both
/// <i>generates</i> the types and <i>parses</i> the rows into them — symmetric and dataset-grounded.
/// All numeric parsing is <see cref="CultureInfo.InvariantCulture"/>.
/// </summary>
public static class SchemaTsvParser
{
    /// <summary>Parse one tab-separated row into a typed <see cref="DynamicValue.Object"/> per the schema.</summary>
    /// <param name="schema">Schema describing field order + neutral types.</param>
    /// <param name="tsvRow">A tab-separated data row (no header), matching the schema's field count.</param>
    /// <returns>An object value keyed by schema field name, each cell coerced to its typed shape.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="schema"/> or <paramref name="tsvRow"/> is null.</exception>
    /// <exception cref="FormatException">Column count mismatches the schema, or a typed cell fails to parse.</exception>
    public static DynamicValue ParseRow(TypeSchema schema, string tsvRow)
    {
        ArgumentNullException.ThrowIfNull(schema);
        ArgumentNullException.ThrowIfNull(tsvRow);

        string[] cells = tsvRow.Split('\t');
        if (cells.Length != schema.Fields.Count)
        {
            throw new FormatException(
                $"TSV row has {cells.Length} columns; schema '{schema.TypeName}' expects {schema.Fields.Count}.");
        }

        var pairs = ImmutableArray.CreateBuilder<KeyValuePair<string, DynamicValue>>(schema.Fields.Count);
        for (var i = 0; i < schema.Fields.Count; i++)
        {
            SchemaField field = schema.Fields[i];
            pairs.Add(new KeyValuePair<string, DynamicValue>(field.Name, Coerce(field, cells[i])));
        }

        return new DynamicValue.Object(pairs.ToImmutable());
    }

    private static DynamicValue Coerce(SchemaField field, string cell)
    {
        // IMDb's null marker is the two characters backslash-N.
        if (string.Equals(cell, "\\N", StringComparison.Ordinal))
        {
            return new DynamicValue.Null();
        }

        string baseType = field.CsType.EndsWith('?') ? field.CsType[..^1] : field.CsType;
        switch (baseType)
        {
            case "string":
                return new DynamicValue.String(cell);
            case "bool":
                return new DynamicValue.Bool(
                    string.Equals(cell, "1", StringComparison.Ordinal)
                    || string.Equals(cell, "true", StringComparison.OrdinalIgnoreCase));
            case "int":
            case "long":
                return long.TryParse(cell, NumberStyles.Integer, CultureInfo.InvariantCulture, out long n)
                    ? new DynamicValue.Int(n)
                    : throw new FormatException($"field '{field.Name}': '{cell}' is not a valid {baseType}.");
            case "double":
                return double.TryParse(cell, NumberStyles.Float, CultureInfo.InvariantCulture, out double d)
                    ? new DynamicValue.Float(d)
                    : throw new FormatException($"field '{field.Name}': '{cell}' is not a valid double.");
            default:
                throw new NotSupportedException($"field '{field.Name}': unknown type token '{field.CsType}'.");
        }
    }
}
