// Schema evolution golden vector conformance — C# oracle (#3 of 10).
// Parses schema-golden-vectors.json, replays deltas, asserts value-equality.

using System.Text.Json;

namespace Zeta.Core.SchemaEvolution;

public record SchemaField(string Name, string Type, bool Required);

public record SchemaEntry(SchemaField Field, int Weight);

public record SchemaEvolutionDelta(SchemaField[] Retract, SchemaField[] Insert);

public static class SchemaZSet
{
    /// <summary>
    /// Apply a delta: retract at -1, insert at +1, drop weight=0.
    /// This IS the schema evolution algebra — same as the TS reference.
    /// </summary>
    public static List<SchemaEntry> ApplyDelta(List<SchemaEntry> schema, SchemaEvolutionDelta delta)
    {
        var map = new Dictionary<string, (SchemaField Field, int Weight)>();

        foreach (var entry in schema)
        {
            if (map.TryGetValue(entry.Field.Name, out var existing))
                map[entry.Field.Name] = (entry.Field, existing.Weight + entry.Weight);
            else
                map[entry.Field.Name] = (entry.Field, entry.Weight);
        }

        foreach (var field in delta.Retract)
        {
            if (map.TryGetValue(field.Name, out var existing))
                map[field.Name] = (field, existing.Weight - 1);
            else
                map[field.Name] = (field, -1);
        }

        foreach (var field in delta.Insert)
        {
            if (map.TryGetValue(field.Name, out var existing))
                map[field.Name] = (field, existing.Weight + 1);
            else
                map[field.Name] = (field, 1);
        }

        return map.Values
            .Where(e => e.Weight != 0)
            .Select(e => new SchemaEntry(e.Field, e.Weight))
            .ToList();
    }

    public static List<SchemaField> ActiveFields(List<SchemaEntry> schema) =>
        schema.Where(e => e.Weight > 0).Select(e => e.Field).ToList();

    public static List<string> SortedFieldNames(List<SchemaEntry> schema) =>
        ActiveFields(schema).Select(f => f.Name).Order().ToList();
}

public static class GoldenVectorRunner
{
    public static int Run(string jsonPath)
    {
        var json = File.ReadAllText(jsonPath);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        // Parse initial fields
        var initialFields = root.GetProperty("initialFields").EnumerateArray()
            .Select(ParseField).ToList();

        // Parse deltas
        var deltas = root.GetProperty("deltas").EnumerateArray()
            .Select(d => new SchemaEvolutionDelta(
                d.GetProperty("retract").EnumerateArray().Select(ParseField).ToArray(),
                d.GetProperty("insert").EnumerateArray().Select(ParseField).ToArray()
            )).ToList();

        // Parse expected replay states
        var expectedStates = root.GetProperty("expectedReplayStates").EnumerateArray()
            .Select(s => s.GetProperty("activeFields").EnumerateArray().Select(ParseField).ToList())
            .ToList();

        // Parse expected final state
        var expectedFinalNames = root.GetProperty("expectedFinalState")
            .GetProperty("fieldNames").EnumerateArray()
            .Select(e => e.GetString()!).ToList();
        var expectedFinalCount = root.GetProperty("expectedFinalState")
            .GetProperty("fieldCount").GetInt32();

        // Parse commutativity pairs
        var commPairs = root.GetProperty("commutativePairs").EnumerateArray()
            .Select(c => (
                A: c.GetProperty("deltaA").GetInt32(),
                B: c.GetProperty("deltaB").GetInt32(),
                Commutes: c.GetProperty("commutes").GetBoolean()
            )).ToList();

        // Initialize schema
        var schema = initialFields.Select(f => new SchemaEntry(f, 1)).ToList();

        // Replay deltas
        Console.WriteLine("--- Replaying deltas ---");
        var replayStates = new List<List<SchemaEntry>>();
        foreach (var (delta, i) in deltas.Select((d, i) => (d, i)))
        {
            schema = SchemaZSet.ApplyDelta(schema, delta);
            replayStates.Add(schema);

            var active = SchemaZSet.ActiveFields(schema);
            var expectedActive = expectedStates[i];

            if (active.Count != expectedActive.Count)
            {
                Console.Error.WriteLine($"FAIL: Delta {i} field count mismatch: expected {expectedActive.Count}, got {active.Count}");
                return 1;
            }
            Console.WriteLine($"  Delta {i}: {active.Count} fields ✓");
        }

        // Assert final state
        Console.WriteLine("--- Final state ---");
        var finalNames = SchemaZSet.SortedFieldNames(schema);
        if (!finalNames.SequenceEqual(expectedFinalNames))
        {
            Console.Error.WriteLine($"FAIL: Final field names mismatch");
            Console.Error.WriteLine($"  Expected: [{string.Join(", ", expectedFinalNames)}]");
            Console.Error.WriteLine($"  Got:      [{string.Join(", ", finalNames)}]");
            return 1;
        }
        if (SchemaZSet.ActiveFields(schema).Count != expectedFinalCount)
        {
            Console.Error.WriteLine($"FAIL: Final count mismatch");
            return 1;
        }
        Console.WriteLine($"  Final: {expectedFinalCount} fields [{string.Join(", ", finalNames)}] ✓");

        // Assert commutativity
        Console.WriteLine("--- Commutativity ---");
        var initialSchema = initialFields.Select(f => new SchemaEntry(f, 1)).ToList();
        foreach (var (a, b, commutes) in commPairs)
        {
            var stateAB = SchemaZSet.ApplyDelta(SchemaZSet.ApplyDelta(initialSchema, deltas[a]), deltas[b]);
            var stateBA = SchemaZSet.ApplyDelta(SchemaZSet.ApplyDelta(initialSchema, deltas[b]), deltas[a]);

            var namesAB = SchemaZSet.SortedFieldNames(stateAB);
            var namesBA = SchemaZSet.SortedFieldNames(stateBA);

            if (!namesAB.SequenceEqual(namesBA))
            {
                Console.Error.WriteLine($"FAIL: Deltas {a},{b} do not commute");
                return 1;
            }
            Console.WriteLine($"  Deltas ({a},{b}) commute ✓");
        }

        Console.WriteLine("\nAll golden vectors passed! (C# oracle #3)");
        return 0;
    }

    private static SchemaField ParseField(JsonElement el) => new(
        el.GetProperty("name").GetString()!,
        el.GetProperty("type").GetString()!,
        el.GetProperty("required").GetBoolean()
    );

    public static int Main(string[] args)
    {
        if (args.Length == 0)
        {
            Console.Error.WriteLine("Usage: dotnet run -- <path-to-schema-golden-vectors.json>");
            return 1;
        }
        return Run(args[0]);
    }
}
