using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Core.CSharp.Tests;

public class SchemaEvolutionTests
{
    private static DynamicValue ParseVal(JsonElement el)
    {
        var t = el.GetProperty("t").GetString();
        switch (t)
        {
            case "null":
                return new DynamicValue.Null();
            case "bool":
                return new DynamicValue.Bool(el.GetProperty("v").GetBoolean());
            case "int":
                return new DynamicValue.Int(long.Parse(el.GetProperty("v").GetString()!, CultureInfo.InvariantCulture));
            case "float":
                return new DynamicValue.Float(double.Parse(el.GetProperty("v").GetString()!, CultureInfo.InvariantCulture));
            case "str":
                return new DynamicValue.String(el.GetProperty("v").GetString()!);
            case "arr":
                var items = el.GetProperty("v").EnumerateArray().Select(ParseVal).ToImmutableArray();
                return new DynamicValue.Array(items);
            case "obj":
                var pairs = el.GetProperty("v").EnumerateArray().Select(item =>
                {
                    var key = item[0].GetString()!;
                    var val = ParseVal(item[1]);
                    return new KeyValuePair<string, DynamicValue>(key, val);
                }).ToImmutableArray();
                return new DynamicValue.Object(pairs);
            default:
                throw new NotSupportedException($"Unknown type {t}");
        }
    }

    private static SchemaEvolution.Migration ParseOp(JsonElement el)
    {
        var op = el.GetProperty("op").GetString();
        switch (op)
        {
            case "add":
                return SchemaEvolution.AddFieldMigration(0, el.GetProperty("key").GetString()!, ParseVal(el.GetProperty("default")));
            case "rename":
                return SchemaEvolution.RenameFieldMigration(0, el.GetProperty("from").GetString()!, el.GetProperty("to").GetString()!);
            case "remove":
                return SchemaEvolution.RemoveFieldMigration(0, el.GetProperty("key").GetString()!, ParseVal(el.GetProperty("default")));
            case "remove_with_dump":
                return SchemaEvolution.RemoveFieldWithDumpMigration(0, el.GetProperty("key").GetString()!);
            default:
                throw new NotSupportedException($"Unknown op {op}");
        }
    }

    [Fact]
    public void ReplaysGoldenVectorsSchemaEvolution()
    {
        var path = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../src/Core.TypeScript/dynamic-value/golden-vectors-schema-evolution.json"));
        if (!File.Exists(path))
        {
            path = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../src/Core.TypeScript/dynamic-value/golden-vectors-schema-evolution.json"));
        }
        var json = File.ReadAllText(path);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var vectors = root.GetProperty("vectors").EnumerateArray();

        foreach (var vec in vectors)
        {
            var name = vec.GetProperty("name").GetString();
            var input = ParseVal(vec.GetProperty("input"));
            var expectedUp = ParseVal(vec.GetProperty("expected_up"));
            var expectedDown = ParseVal(vec.GetProperty("expected_down"));
            var ops = vec.GetProperty("ops").EnumerateArray().Select(ParseOp).ToList();

            // Run Up migrations
            var val = input;
            foreach (var op in ops)
            {
                val = op.Up(val);
            }
            Assert.True(expectedUp.Equals(val), $"Vector {name}: Up migration output mismatch");

            // Run Down migrations
            var backVal = val;
            for (int i = ops.Count - 1; i >= 0; i--)
            {
                var op = ops[i];
                Assert.NotNull(op.Down);
                backVal = op.Down(backVal);
            }
            Assert.True(expectedDown.Equals(backVal), $"Vector {name}: Down migration output mismatch");
        }
    }
}
