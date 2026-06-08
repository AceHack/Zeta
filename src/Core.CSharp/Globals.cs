// Globals — Caché / MUMPS-style hierarchical-"global" navigation over DynamicValue.
// C# parity oracle; mirrors src/Core/Globals.fs.

using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;

namespace Zeta.Core.CSharp;

/// <summary>
/// Caché / MUMPS-style hierarchical-"global" navigation — the canonical MUMPS verbs over
/// <see cref="DynamicValue"/> directly. A "global" is a node in a <see cref="DynamicValue"/>
/// tree at a subscript path. Ordinal-sorted, DST-stable, and 4-language-portable.
/// </summary>
public static class Globals
{
    /// <summary>The empty global — Null (an undefined root).</summary>
    public static readonly DynamicValue Empty = new DynamicValue.Null();

    /// <summary>
    /// Ordinal-sorted, de-duplicated child subscripts of an Object; empty list for any non-object.
    /// </summary>
    private static IReadOnlyList<string> ObjKeys(DynamicValue dv)
    {
        if (dv is DynamicValue.Object obj)
        {
            return obj.Pairs
                .Select(kv => kv.Key)
                .Distinct(StringComparer.Ordinal)
                .OrderBy(k => k, StringComparer.Ordinal)
                .ToList();
        }
        return Array.Empty<string>();
    }

    /// <summary>
    /// $GET(^G(path)) — the DynamicValue at path, or null if undefined.
    /// </summary>
    public static DynamicValue? Get(IReadOnlyList<string> path, DynamicValue root)
    {
        ArgumentNullException.ThrowIfNull(path);
        ArgumentNullException.ThrowIfNull(root);
        return Get(path, 0, root);
    }

    private static DynamicValue? Get(IReadOnlyList<string> path, int index, DynamicValue root)
    {
        if (index >= path.Count)
        {
            return root is DynamicValue.Null ? null : root;
        }

        var k = path[index];
        if (root is DynamicValue.Object obj)
        {
            foreach (var kv in obj.Pairs)
            {
                if (string.Equals(kv.Key, k, StringComparison.Ordinal))
                {
                    return Get(path, index + 1, kv.Value);
                }
            }
        }

        return null;
    }

    /// <summary>
    /// SET ^G(path) = v — functional upsert of v at path, creating intermediate Object nodes
    /// as needed. The empty path replaces the whole root with v.
    /// </summary>
    public static DynamicValue Set(IReadOnlyList<string> path, DynamicValue v, DynamicValue root)
    {
        ArgumentNullException.ThrowIfNull(path);
        ArgumentNullException.ThrowIfNull(v);
        ArgumentNullException.ThrowIfNull(root);
        return Set(path, 0, v, root);
    }

    private static DynamicValue Set(IReadOnlyList<string> path, int index, DynamicValue v, DynamicValue root)
    {
        if (index >= path.Count)
        {
            return v;
        }

        var k = path[index];
        var existing = root is DynamicValue.Object obj ? obj.Pairs : ImmutableArray<KeyValuePair<string, DynamicValue>>.Empty;

        DynamicValue child = new DynamicValue.Null();
        foreach (var kv in existing)
        {
            if (string.Equals(kv.Key, k, StringComparison.Ordinal))
            {
                child = kv.Value;
                break;
            }
        }

        var newChild = Set(path, index + 1, v, child);

        var builder = ImmutableArray.CreateBuilder<KeyValuePair<string, DynamicValue>>();
        foreach (var kv in existing)
        {
            if (!string.Equals(kv.Key, k, StringComparison.Ordinal))
            {
                builder.Add(kv);
            }
        }
        builder.Add(new KeyValuePair<string, DynamicValue>(k, newChild));

        return new DynamicValue.Object(builder.ToImmutable());
    }

    /// <summary>
    /// KILL ^G(path) — delete the node at path and its whole subtree. Killing the empty path
    /// clears the global to Null.
    /// </summary>
    public static DynamicValue Kill(IReadOnlyList<string> path, DynamicValue root)
    {
        ArgumentNullException.ThrowIfNull(path);
        ArgumentNullException.ThrowIfNull(root);
        return Kill(path, 0, root);
    }

    private static DynamicValue Kill(IReadOnlyList<string> path, int index, DynamicValue root)
    {
        if (index >= path.Count)
        {
            return new DynamicValue.Null();
        }

        var k = path[index];

        if (index == path.Count - 1)
        {
            if (root is DynamicValue.Object obj)
            {
                var builder = ImmutableArray.CreateBuilder<KeyValuePair<string, DynamicValue>>();
                foreach (var kv in obj.Pairs)
                {
                    if (!string.Equals(kv.Key, k, StringComparison.Ordinal))
                    {
                        builder.Add(kv);
                    }
                }
                return new DynamicValue.Object(builder.ToImmutable());
            }
            return root;
        }

        if (root is DynamicValue.Object obj2)
        {
            KeyValuePair<string, DynamicValue>? found = null;
            foreach (var kv in obj2.Pairs)
            {
                if (string.Equals(kv.Key, k, StringComparison.Ordinal))
                {
                    found = kv;
                    break;
                }
            }

            if (found.HasValue)
            {
                var killed = Kill(path, index + 1, found.Value.Value);
                var builder = ImmutableArray.CreateBuilder<KeyValuePair<string, DynamicValue>>();
                foreach (var kv in obj2.Pairs)
                {
                    if (!string.Equals(kv.Key, k, StringComparison.Ordinal))
                    {
                        builder.Add(kv);
                    }
                }
                builder.Add(new KeyValuePair<string, DynamicValue>(k, killed));
                return new DynamicValue.Object(builder.ToImmutable());
            }
            return root;
        }

        return root;
    }

    /// <summary>
    /// The immediate-child subscripts of the node at path, ordinal-ordered.
    /// </summary>
    public static IReadOnlyList<string> Children(IReadOnlyList<string> path, DynamicValue root)
    {
        var dv = Get(path, root);
        return dv != null ? ObjKeys(dv) : Array.Empty<string>();
    }

    /// <summary>
    /// $DATA(^G(path)) — node status: 0 undefined, 1 scalar leaf, 10 object node.
    /// </summary>
    public static int Data(IReadOnlyList<string> path, DynamicValue root)
    {
        var dv = Get(path, root);
        if (dv == null)
        {
            return 0;
        }
        if (dv is DynamicValue.Object)
        {
            return 10;
        }
        return 1;
    }

    /// <summary>
    /// $ORDER(^G(path, after)) — the next immediate child subscript of path in ordinal order.
    /// </summary>
    public static string? NextChild(IReadOnlyList<string> path, string? after, DynamicValue root)
    {
        var kids = Children(path, root);
        if (after == null)
        {
            return kids.Count > 0 ? kids[0] : null;
        }

        foreach (var c in kids)
        {
            if (string.Compare(c, after, StringComparison.Ordinal) > 0)
            {
                return c;
            }
        }
        return null;
    }

    /// <summary>
    /// All leaf (path, value) pairs in depth-first ordinal-path order.
    /// </summary>
    public static IEnumerable<KeyValuePair<IReadOnlyList<string>, DynamicValue>> ToEnumerable(DynamicValue root)
    {
        ArgumentNullException.ThrowIfNull(root);
        return Walk(ImmutableList<string>.Empty, root);
    }

    private static IEnumerable<KeyValuePair<IReadOnlyList<string>, DynamicValue>> Walk(ImmutableList<string> prefix, DynamicValue dv)
    {
        if (dv is DynamicValue.Null)
        {
            yield break;
        }
        else if (dv is DynamicValue.Object obj && obj.Pairs.Length > 0)
        {
            var ordered = obj.Pairs
                .GroupBy(kv => kv.Key, StringComparer.Ordinal)
                .Select(g => g.First())
                .OrderBy(kv => kv.Key, StringComparer.Ordinal);

            foreach (var kv in ordered)
            {
                foreach (var leaf in Walk(prefix.Add(kv.Key), kv.Value))
                {
                    yield return leaf;
                }
            }
        }
        else
        {
            yield return new KeyValuePair<IReadOnlyList<string>, DynamicValue>(prefix, dv);
        }
    }

    /// <summary>
    /// $QUERY(^G(path)) — the next defined leaf node after path in depth-first ordinal-path order.
    /// </summary>
    public static IReadOnlyList<string>? NextNode(IReadOnlyList<string> path, DynamicValue root)
    {
        ArgumentNullException.ThrowIfNull(path);
        foreach (var entry in ToEnumerable(root))
        {
            if (ComparePaths(entry.Key, path) > 0)
            {
                return entry.Key;
            }
        }
        return null;
    }

    /// <summary>
    /// The number of defined leaf nodes.
    /// </summary>
    public static int Count(DynamicValue root) => ToEnumerable(root).Count();

    /// <summary>
    /// Compare two paths in depth-first ordinal-path order.
    /// </summary>
    private static int ComparePaths(IReadOnlyList<string> a, IReadOnlyList<string> b)
    {
        int minLen = Math.Min(a.Count, b.Count);
        for (int i = 0; i < minLen; i++)
        {
            int c = string.Compare(a[i], b[i], StringComparison.Ordinal);
            if (c != 0)
            {
                return c;
            }
        }
        return a.Count.CompareTo(b.Count);
    }
}
