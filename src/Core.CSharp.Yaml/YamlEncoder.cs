using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Zeta.Core.CSharp.Yaml;

/// <summary>
/// Canonical YAML encoder — C# oracle, an exact mirror of the F#/TS encoders so all
/// three produce BYTE-IDENTICAL canonical YAML (cross-language byte-lock; YAML is the
/// storage of record). Round-trips with the parser: <c>YamlDom.Parse(Encode(v))</c>
/// yields <c>v</c> for compound values. Block style; 2-space indent; map keys keep
/// insertion order; strings + keys always double-quoted (escapes \\ \" \n \t \r \0);
/// null/bool/int plain; float invariant "R" with a forced "." . Culture-invariant.
/// </summary>
public static class YamlEncoder
{
    private static string Quote(string s)
    {
        var sb = new StringBuilder();
        sb.Append('"');
        foreach (var ch in s)
        {
            _ = ch switch
            {
                '\\' => sb.Append("\\\\"),
                '"' => sb.Append("\\\""),
                '\n' => sb.Append("\\n"),
                '\t' => sb.Append("\\t"),
                '\r' => sb.Append("\\r"),
                '\0' => sb.Append("\\0"),
                _ => sb.Append(ch),
            };
        }

        sb.Append('"');
        return sb.ToString();
    }

    private static string ForceFloat(double d)
    {
        var r = d.ToString("R", CultureInfo.InvariantCulture);
        return r.IndexOfAny(['.', 'e', 'E']) >= 0 ? r : r + ".0";
    }

    private static string? Scalar(YamlValue v) => v switch
    {
        YamlValue.YNull => "null",
        YamlValue.YBool b => b.Value ? "true" : "false",
        YamlValue.YInt i => i.Value.ToString(CultureInfo.InvariantCulture),
        YamlValue.YFloat f => ForceFloat(f.Value),
        YamlValue.YStr s => Quote(s.Value),
        _ => null, // YSeq / YMap
    };

    private static void Emit(int indent, YamlValue v, List<string> lines)
    {
        var pad = new string(' ', indent);
        switch (v)
        {
            case YamlValue.YMap m:
                foreach (var kv in m.Entries)
                {
                    var key = Quote(kv.Key);
                    var s = Scalar(kv.Value);
                    if (s is not null)
                    {
                        lines.Add($"{pad}{key}: {s}");
                    }
                    else
                    {
                        lines.Add($"{pad}{key}:");
                        Emit(indent + 2, kv.Value, lines);
                    }
                }

                break;
            case YamlValue.YSeq seq:
                foreach (var child in seq.Items)
                {
                    var s = Scalar(child);
                    if (s is not null)
                    {
                        lines.Add($"{pad}- {s}");
                    }
                    else
                    {
                        lines.Add($"{pad}-");
                        Emit(indent + 2, child, lines);
                    }
                }

                break;
            default:
                lines.Add(pad + Scalar(v));
                break;
        }
    }

    /// <summary>Canonical YAML rendering — byte-identical to the F#/TS encoders.</summary>
    public static string Encode(YamlValue v)
    {
        var lines = new List<string>();
        Emit(0, v, lines);
        return string.Join("\n", lines) + "\n";
    }
}
