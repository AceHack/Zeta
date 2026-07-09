using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;

namespace Zeta.Core.CSharp;

/// <summary>
/// Schema evolution over DynamicValue — C# oracle implementing total migration algebra and stashing.
/// </summary>
public static class SchemaEvolution
{
    /// <summary>
    /// Adjacent-version migration record.
    /// </summary>
    public record Migration(
        int From,
        int To,
        Func<DynamicValue, DynamicValue> Up,
        Func<DynamicValue, DynamicValue>? Down
    );

    /// <summary>
    /// Reserved key for stashed values in the garbage dump.
    /// </summary>
    public const string DumpKey = "__evo_dump__";

    /// <summary>
    /// Ensure key is present, supplying def when absent. Idempotent; preserves existing value + order.
    /// </summary>
    public static DynamicValue AddField(string key, DynamicValue def, DynamicValue v)
    {
        if (v is DynamicValue.Object obj)
        {
            if (obj.Pairs.Any(p => string.Equals(p.Key, key, StringComparison.Ordinal)))
            {
                return v;
            }
            return new DynamicValue.Object(obj.Pairs.Add(new KeyValuePair<string, DynamicValue>(key, def)));
        }
        return v;
    }

    /// <summary>
    /// Drop key if present. Preserves order of the rest.
    /// </summary>
    public static DynamicValue RemoveField(string key, DynamicValue v)
    {
        if (v is DynamicValue.Object obj)
        {
            var newPairs = obj.Pairs.Where(p => !string.Equals(p.Key, key, StringComparison.Ordinal)).ToImmutableArray();
            return new DynamicValue.Object(newPairs);
        }
        return v;
    }

    /// <summary>
    /// Rename oldKey to newKey in place; preserves value + order.
    /// </summary>
    public static DynamicValue RenameField(string oldKey, string newKey, DynamicValue v)
    {
        if (v is DynamicValue.Object obj)
        {
            var newPairs = obj.Pairs.Select(p => string.Equals(p.Key, oldKey, StringComparison.Ordinal)
                ? new KeyValuePair<string, DynamicValue>(newKey, p.Value)
                : p).ToImmutableArray();
            return new DynamicValue.Object(newPairs);
        }
        return v;
    }

    /// <summary>
    /// Project to only the keys an old reader knows (drops everything else).
    /// </summary>
    public static DynamicValue Project(ISet<string> knownKeys, DynamicValue v)
    {
        if (v is DynamicValue.Object obj)
        {
            var newPairs = obj.Pairs.Where(p => knownKeys.Contains(p.Key)).ToImmutableArray();
            return new DynamicValue.Object(newPairs);
        }
        return v;
    }

    /// <summary>
    /// addField is lossless-invertible: the inverse is removeField key.
    /// </summary>
    public static Migration AddFieldMigration(int fromV, string key, DynamicValue def)
    {
        return new Migration(
            fromV,
            fromV + 1,
            v => AddField(key, def, v),
            v => RemoveField(key, v)
        );
    }

    /// <summary>
    /// renameField is lossless-invertible: the inverse is renameField newKey oldKey.
    /// </summary>
    public static Migration RenameFieldMigration(int fromV, string oldKey, string newKey)
    {
        return new Migration(
            fromV,
            fromV + 1,
            v => RenameField(oldKey, newKey, v),
            v => RenameField(newKey, oldKey, v)
        );
    }

    /// <summary>
    /// removeField is lossy: the down-migration restores only downDefault.
    /// </summary>
    public static Migration RemoveFieldMigration(int fromV, string key, DynamicValue downDefault)
    {
        return new Migration(
            fromV,
            fromV + 1,
            v => RemoveField(key, v),
            v => AddField(key, downDefault, v)
        );
    }

    private static DynamicValue.Object DumpEntry(int idx, DynamicValue value)
    {
        return new DynamicValue.Object(ImmutableArray.Create(
            new KeyValuePair<string, DynamicValue>("idx", new DynamicValue.Int(idx)),
            new KeyValuePair<string, DynamicValue>("val", value)
        ));
    }

    private static (ImmutableArray<KeyValuePair<string, DynamicValue>> NonDump, ImmutableArray<KeyValuePair<string, DynamicValue>> Dump) SplitDump(ImmutableArray<KeyValuePair<string, DynamicValue>> pairs)
    {
        var nonDump = pairs.Where(p => !string.Equals(p.Key, DumpKey, StringComparison.Ordinal)).ToImmutableArray();
        var dumpVal = pairs.FirstOrDefault(p => string.Equals(p.Key, DumpKey, StringComparison.Ordinal)).Value;
        var dump = dumpVal is DynamicValue.Object d ? d.Pairs : ImmutableArray<KeyValuePair<string, DynamicValue>>.Empty;
        return (nonDump, dump);
    }

    /// <summary>
    /// Move key's value INTO the dump (lossless stash).
    /// </summary>
    public static DynamicValue StashToDump(string key, DynamicValue v)
    {
        if (v is DynamicValue.Object obj)
        {
            var (nonDump, dump) = SplitDump(obj.Pairs);
            var idx = -1;
            for (int i = 0; i < nonDump.Length; i++)
            {
                if (string.Equals(nonDump[i].Key, key, StringComparison.Ordinal))
                {
                    idx = i;
                    break;
                }
            }
            if (idx == -1)
            {
                return v;
            }
            var removed = nonDump[idx].Value;
            var newNonDump = nonDump.RemoveAt(idx);
            var newDump = dump.Where(p => !string.Equals(p.Key, key, StringComparison.Ordinal)).ToImmutableArray()
                .Add(new KeyValuePair<string, DynamicValue>(key, DumpEntry(idx, removed)));
            return new DynamicValue.Object(newNonDump.Add(new KeyValuePair<string, DynamicValue>(DumpKey, new DynamicValue.Object(newDump))));
        }
        return v;
    }

    /// <summary>
    /// Restore key FROM the dump (position-exact).
    /// </summary>
    public static DynamicValue RestoreFromDump(string key, DynamicValue v)
    {
        if (v is DynamicValue.Object obj)
        {
            var (nonDump, dump) = SplitDump(obj.Pairs);
            var entryVal = dump.FirstOrDefault(p => string.Equals(p.Key, key, StringComparison.Ordinal)).Value;
            if (entryVal is DynamicValue.Object entry)
            {
                var idxVal = entry.Pairs.FirstOrDefault(p => string.Equals(p.Key, "idx", StringComparison.Ordinal)).Value;
                var idx = idxVal is DynamicValue.Int i ? (int)i.Value : nonDump.Length;
                var value = entry.Pairs.FirstOrDefault(p => string.Equals(p.Key, "val", StringComparison.Ordinal)).Value ?? new DynamicValue.Null();

                var clamped = Math.Max(0, Math.Min(idx, nonDump.Length));
                var restored = nonDump.Insert(clamped, new KeyValuePair<string, DynamicValue>(key, value));
                var remaining = dump.Where(p => !string.Equals(p.Key, key, StringComparison.Ordinal)).ToImmutableArray();

                if (remaining.Length == 0)
                {
                    return new DynamicValue.Object(restored);
                }
                else
                {
                    return new DynamicValue.Object(restored.Add(new KeyValuePair<string, DynamicValue>(DumpKey, new DynamicValue.Object(remaining))));
                }
            }
            return v;
        }
        return v;
    }

    /// <summary>
    /// Drop the whole dump.
    /// </summary>
    public static DynamicValue DropDump(DynamicValue v)
    {
        return RemoveField(DumpKey, v);
    }

    /// <summary>
    /// removeField made windowed-lossless.
    /// </summary>
    public static Migration RemoveFieldWithDumpMigration(int fromV, string key)
    {
        return new Migration(
            fromV,
            fromV + 1,
            v => StashToDump(key, v),
            v => RestoreFromDump(key, v)
        );
    }

    /// <summary>
    /// Migrate forward.
    /// </summary>
    public static Result<DynamicValue, string> Migrate(IEnumerable<Migration> migrations, int fromV, int toV, DynamicValue value)
    {
        if (toV < fromV)
        {
            return new Result<DynamicValue, string>.Err($"downgrade {fromV} -> {toV} not supported by migrate; use migrateDown");
        }

        var list = migrations.ToList();
        var cur = fromV;
        var v = value;
        while (cur < toV)
        {
            var m = list.FirstOrDefault(mig => mig.From == cur && mig.To == cur + 1);
            if (m == null)
            {
                return new Result<DynamicValue, string>.Err($"no migration registered from version {cur} to {cur + 1}");
            }
            v = m.Up(v);
            cur++;
        }
        return new Result<DynamicValue, string>.Ok(v);
    }

    /// <summary>
    /// Migrate backward.
    /// </summary>
    public static Result<DynamicValue, string> MigrateDown(IEnumerable<Migration> migrations, int fromV, int toV, DynamicValue value)
    {
        if (toV > fromV)
        {
            return new Result<DynamicValue, string>.Err($"migrateDown requires toV <= fromV, got {fromV} -> {toV}");
        }

        var list = migrations.ToList();
        var cur = fromV;
        var v = value;
        while (cur > toV)
        {
            var m = list.FirstOrDefault(mig => mig.To == cur && mig.From == cur - 1);
            if (m == null)
            {
                return new Result<DynamicValue, string>.Err($"no migration registered from version {cur - 1} to {cur}");
            }
            if (m.Down == null)
            {
                return new Result<DynamicValue, string>.Err($"migration {m.From} -> {m.To} is non-invertible (rollback needs compensation, not an inverse)");
            }
            v = m.Down(v);
            cur--;
        }
        return new Result<DynamicValue, string>.Ok(v);
    }
}
