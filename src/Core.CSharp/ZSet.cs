// ZSet — signed-weight multiset (TOP rung of the algebra ladder: G-Set ⊂ Bag ⊂ Z-set).
// C# native parity oracle; mirrors src/Core.TypeScript/z-set, the F# engine src/Core/ZSet.fs, and
// the Rust twin (src/Core.Rust.Algebra/src/zset.rs). Native ladder oracle next to GSet.cs / Bag.cs;
// distinct from the DBSP Z-set binding (ZetaCircuitBuilder) — this is the cross-language treaty impl.

using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;

namespace Zeta.Core.CSharp;

/// <summary>
/// Factory methods for <see cref="ZSet{T}"/>. A non-generic companion class (the .NET convention,
/// e.g. <see cref="ImmutableArray"/> vs <see cref="ImmutableArray{T}"/>) so the constructors stay
/// static-member-free on the generic type (CA1000).
/// </summary>
public static class ZSet
{
    /// <summary>The empty Z-set (the <see cref="ZSet{T}.Union"/> identity).</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="comparer">Order on <typeparamref name="T"/>; defaults to <see cref="Comparer{T}.Default"/>.</param>
    /// <returns>An empty Z-set.</returns>
    public static ZSet<T> Empty<T>(IComparer<T>? comparer = null) =>
        new(ImmutableArray<ZSetEntry<T>>.Empty, comparer ?? Comparer<T>.Default);

    /// <summary>A one-key Z-set at weight <paramref name="w"/>; <paramref name="w"/> == 0 yields the empty Z-set. <paramref name="w"/> may be negative.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="x">The single key.</param>
    /// <param name="w">The signed weight (a no-op if 0).</param>
    /// <param name="comparer">Order on <typeparamref name="T"/>; defaults to <see cref="Comparer{T}.Default"/>.</param>
    /// <returns>A Z-set containing exactly <paramref name="x"/> at weight <paramref name="w"/> (or empty).</returns>
    public static ZSet<T> Singleton<T>(T x, long w = 1, IComparer<T>? comparer = null)
    {
        var cmp = comparer ?? Comparer<T>.Default;
        return w != 0
            ? new ZSet<T>(ImmutableArray.Create(new ZSetEntry<T>(x, w)), cmp)
            : new ZSet<T>(ImmutableArray<ZSetEntry<T>>.Empty, cmp);
    }

    /// <summary>
    /// Canonicalize arbitrary <c>(key, weight)</c> entries: sum weights per key, drop any whose
    /// summed weight is == 0 (retraction), sort ascending by key. Unlike the Bag (which drops
    /// &lt;= 0), the Z-set KEEPS negatives — the ℕ→ℤ widening.
    /// </summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="entries">The entries.</param>
    /// <param name="comparer">Order on the key; defaults to <see cref="Comparer{T}.Default"/>.</param>
    /// <returns>The canonical Z-set.</returns>
    public static ZSet<T> OfEntries<T>(IEnumerable<(T Key, long Weight)> entries, IComparer<T>? comparer = null)
    {
        var cmp = comparer ?? Comparer<T>.Default;
        return new ZSet<T>(Canonicalize(entries, cmp), cmp);
    }

    /// <summary>
    /// Build a Z-set by counting occurrences in a sequence — each occurrence adds weight 1. The
    /// ladder sibling of <see cref="GSet.OfSeq"/> / <see cref="Bag.OfSeq"/>.
    /// </summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="xs">The keys.</param>
    /// <param name="comparer">Order on the key; defaults to <see cref="Comparer{T}.Default"/>.</param>
    /// <returns>The canonical Z-set of occurrence weights.</returns>
    public static ZSet<T> OfSeq<T>(IEnumerable<T> xs, IComparer<T>? comparer = null)
    {
        ArgumentNullException.ThrowIfNull(xs);
        var cmp = comparer ?? Comparer<T>.Default;
        var entries = new List<(T, long)>();
        foreach (var x in xs)
        {
            entries.Add((x, 1L));
        }

        return new ZSet<T>(Canonicalize(entries, cmp), cmp);
    }

    /// <summary>
    /// Build a Z-set by counting occurrences in an array — the C# parity twin of the TypeScript
    /// oracle's <c>ofArray(compare, readonly T[])</c>. Takes a concrete <c>T[]</c> to match the TS
    /// golden-source shape; forwards to <see cref="OfSeq{T}"/>.
    /// </summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="xs">The keys.</param>
    /// <param name="comparer">Order on the key; defaults to <see cref="Comparer{T}.Default"/>.</param>
    /// <returns>The canonical Z-set of occurrence weights.</returns>
    public static ZSet<T> OfArray<T>(T[] xs, IComparer<T>? comparer = null) => OfSeq(xs, comparer);

    /// <summary>
    /// Sum per key, drop keys whose summed weight is == 0 (retraction — KEEP negatives), sort
    /// ascending under <paramref name="cmp"/>. The summed weight is <c>checked</c> so an int64
    /// overflow throws rather than silently wrapping (the C# analog of the TS safe-integer guard /
    /// Rust <c>checked_add</c>; both signs guarded).
    /// </summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="entries">The entries.</param>
    /// <param name="cmp">The key order.</param>
    /// <returns>The canonical ascending, key-unique, weight-nonzero run.</returns>
    internal static ImmutableArray<ZSetEntry<T>> Canonicalize<T>(IEnumerable<(T Key, long Weight)> entries, IComparer<T> cmp)
    {
        ArgumentNullException.ThrowIfNull(entries);
        var sorted = new List<(T Key, long Weight)>(entries);
        sorted.Sort((a, b) => cmp.Compare(a.Key, b.Key));
        var merged = ImmutableArray.CreateBuilder<ZSetEntry<T>>(sorted.Count);
        for (var k = 0; k < sorted.Count; k++)
        {
            if (merged.Count > 0 && cmp.Compare(merged[^1].Key, sorted[k].Key) == 0)
            {
                merged[^1] = merged[^1] with { Weight = checked(merged[^1].Weight + sorted[k].Weight) };
            }
            else
            {
                merged.Add(new ZSetEntry<T>(sorted[k].Key, sorted[k].Weight));
            }
        }

        // Drop keys that netted to weight 0 (retraction, e.g. +1 then -1), keeping negatives and
        // the rest in canonical order — drop rule is == 0, not <= 0 (the Bag/Z-set distinction).
        return merged.Where(e => e.Weight != 0).ToImmutableArray();
    }
}

/// <summary>
/// A Z-set (signed multiset): a canonical ascending-key-sorted, weight-nonzero, key-unique run
/// under an <see cref="IComparer{T}"/>. <see cref="Union"/> is the per-key SUM — commutative,
/// associative, with the empty Z-set as identity, and (unlike the Bag) every Z-set has an inverse
/// <see cref="Negate"/>, so this is an abelian GROUP: <c>Union(a, a.Negate())</c> is empty. It is
/// NOT idempotent (<c>Union(a, a)</c> doubles every weight). Parity with
/// <c>src/Core.TypeScript/z-set</c>, the F# engine <c>src/Core/ZSet.fs</c>, and
/// <c>src/Core.Rust.Algebra/src/zset.rs</c>. Construct via <see cref="ZSet"/>.
/// </summary>
/// <remarks>
/// The comparer is explicit (like the TS <c>compare</c> parameter) rather than baked to
/// <see cref="Comparer{T}.Default"/>: for <see cref="string"/> the default is culture-sensitive,
/// but the cross-language wire (TS UTF-16 code-unit order, Rust UTF-8 byte order, F# structural
/// ordinal) needs <see cref="StringComparer.Ordinal"/>. Pass it explicitly for cross-language parity.
/// </remarks>
/// <typeparam name="T">The key type.</typeparam>
public sealed class ZSet<T> : IEquatable<ZSet<T>>
{
    private readonly ImmutableArray<ZSetEntry<T>> _items;
    private readonly IComparer<T> _comparer;

    internal ZSet(ImmutableArray<ZSetEntry<T>> items, IComparer<T> comparer)
    {
        _items = items.IsDefault ? ImmutableArray<ZSetEntry<T>>.Empty : items;
        _comparer = comparer;
    }

    /// <summary>The number of DISTINCT keys with nonzero weight (the support size).</summary>
    public int Count => _items.Length;

    /// <summary>Whether the Z-set has no keys.</summary>
    public bool IsEmpty => _items.IsEmpty;

    /// <summary>The weight of <paramref name="x"/> (0 if absent — including a key retracted to 0). Binary search. O(log n).</summary>
    /// <param name="x">The key to look up.</param>
    /// <returns>The signed weight of <paramref name="x"/>, or 0 if absent.</returns>
    public long Weight(T x)
    {
        int lo = 0, hi = _items.Length - 1;
        while (lo <= hi)
        {
            var mid = lo + ((hi - lo) >> 1);
            var c = _comparer.Compare(_items[mid].Key, x);
            if (c == 0)
            {
                return _items[mid].Weight;
            }

            if (c < 0)
            {
                lo = mid + 1;
            }
            else
            {
                hi = mid - 1;
            }
        }

        return 0;
    }

    /// <summary>Membership: whether <paramref name="x"/> has a NONZERO weight (positive or negative).</summary>
    /// <param name="x">The key to test.</param>
    /// <returns><see langword="true"/> iff <paramref name="x"/> has nonzero weight.</returns>
    public bool Contains(T x) => Weight(x) != 0;

    /// <summary>The sum of all weights (may be negative or zero); throws on int64 overflow.</summary>
    /// <returns>The total weight.</returns>
    public long Total()
    {
        var s = 0L;
        foreach (var e in _items)
        {
            s = checked(s + e.Weight);
        }

        return s;
    }

    /// <summary>
    /// The combiner: the per-key SUM of two sorted Z-sets, kept sorted and weight-nonzero (a shared
    /// key whose weights cancel to 0 is DROPPED — that drop is retraction). Commutative,
    /// associative, empty-Z-set identity, with <see cref="Negate"/> the inverse (abelian group); NOT
    /// idempotent. Uses this Z-set's comparer; the summed weight is <c>checked</c> against overflow.
    /// </summary>
    /// <param name="other">The Z-set to merge with.</param>
    /// <returns>The per-key sum, in canonical order.</returns>
    public ZSet<T> Union(ZSet<T> other)
    {
        ArgumentNullException.ThrowIfNull(other);

        // Comparer is part of identity (mirrors GSet/Bag): same ⇒ linear merge; mismatched ⇒ fail fast.
        RequireSameComparer(other);
        if (_items.IsEmpty)
        {
            return other;
        }

        if (other._items.IsEmpty)
        {
            return this;
        }

        var a = _items;
        var b = other._items;
        var builder = ImmutableArray.CreateBuilder<ZSetEntry<T>>(a.Length + b.Length);
        int i = 0, j = 0;
        while (i < a.Length && j < b.Length)
        {
            var c = _comparer.Compare(a[i].Key, b[j].Key);
            if (c < 0)
            {
                builder.Add(a[i]);
                i++;
            }
            else if (c > 0)
            {
                builder.Add(b[j]);
                j++;
            }
            else
            {
                var sum = checked(a[i].Weight + b[j].Weight); // same key → weights add
                if (sum != 0)
                {
                    builder.Add(new ZSetEntry<T>(a[i].Key, sum)); // == 0 ⇒ retracted, dropped
                }

                i++;
                j++;
            }
        }

        while (i < a.Length)
        {
            builder.Add(a[i]);
            i++;
        }

        while (j < b.Length)
        {
            builder.Add(b[j]);
            j++;
        }

        return new ZSet<T>(builder.ToImmutable(), _comparer);
    }

    /// <summary>Increment <paramref name="x"/>'s weight by 1 (<see cref="Union"/> with a singleton). NOT idempotent.</summary>
    /// <param name="x">The key to increment.</param>
    /// <returns>The Z-set with <paramref name="x"/>'s weight raised by 1.</returns>
    public ZSet<T> Add(T x) =>
        Union(new ZSet<T>(ImmutableArray.Create(new ZSetEntry<T>(x, 1L)), _comparer));

    /// <summary>Add signed weight <paramref name="w"/> to <paramref name="x"/>; <paramref name="w"/> == 0 is a no-op, and a key driven to net 0 is retracted.</summary>
    /// <param name="x">The key to adjust.</param>
    /// <param name="w">The signed weight to add (may be negative; no-op if 0).</param>
    /// <returns>The Z-set with <paramref name="x"/>'s weight adjusted by <paramref name="w"/>.</returns>
    public ZSet<T> AddW(T x, long w) =>
        w != 0 ? Union(new ZSet<T>(ImmutableArray.Create(new ZSetEntry<T>(x, w)), _comparer)) : this;

    /// <summary>
    /// The abelian-group inverse: flip the sign of every weight. <c>Union(a, a.Negate())</c> is
    /// empty (the law the Bag's monoid cannot satisfy). Preserves the canonical invariant — a
    /// nonzero weight negates to a nonzero weight, key order unchanged. Weight negation is
    /// <c>checked</c> (mirrors the F# <c>ZSet.neg</c> <c>Checked.(-) 0L w</c>).
    /// </summary>
    /// <returns>The Z-set with every weight sign-flipped.</returns>
    public ZSet<T> Negate()
    {
        var builder = ImmutableArray.CreateBuilder<ZSetEntry<T>>(_items.Length);
        foreach (var e in _items)
        {
            builder.Add(new ZSetEntry<T>(e.Key, checked(0L - e.Weight)));
        }

        return new ZSet<T>(builder.ToImmutable(), _comparer);
    }

    /// <summary>Throw if <paramref name="other"/> uses a different comparer (the comparer is part of the Z-set's identity).</summary>
    /// <param name="other">The Z-set being combined.</param>
    private void RequireSameComparer(ZSet<T> other)
    {
        if (!_comparer.Equals(other._comparer))
        {
            throw new ArgumentException(
                "ZSet.Union requires both Z-sets to use the same comparer (the comparer is part of the Z-set's identity).",
                nameof(other));
        }
    }

    /// <summary>The canonical (ascending-key) entries as an immutable array.</summary>
    /// <returns>The canonical run.</returns>
    public ImmutableArray<ZSetEntry<T>> ToImmutableArray() => _items;

    /// <summary>The canonical (ascending-key) entries as a new array.</summary>
    /// <returns>A fresh array of the entries in canonical order.</returns>
    public ZSetEntry<T>[] ToArray() => _items.AsSpan().ToArray();

    /// <summary>
    /// Value equality: same entries (key + weight) in canonical order, with keys compared under the
    /// comparer. Because both Z-sets are canonical, this is Z-set equality.
    /// </summary>
    /// <param name="other">The Z-set to compare.</param>
    /// <returns><see langword="true"/> iff the Z-sets hold the same keys at the same weights.</returns>
    public bool Equals(ZSet<T>? other)
    {
        if (other is null)
        {
            return false;
        }

        if (ReferenceEquals(this, other))
        {
            return true;
        }

        // The comparer is part of the Z-set's identity (keeps Equals symmetric + GetHashCode
        // consistent — mirrors GSet/Bag, PR review 2026-06-01).
        if (!_comparer.Equals(other._comparer))
        {
            return false;
        }

        if (_items.Length != other._items.Length)
        {
            return false;
        }

        for (var k = 0; k < _items.Length; k++)
        {
            if (_comparer.Compare(_items[k].Key, other._items[k].Key) != 0
                || _items[k].Weight != other._items[k].Weight)
            {
                return false;
            }
        }

        return true;
    }

    /// <inheritdoc/>
    public override bool Equals(object? obj) => Equals(obj as ZSet<T>);

    /// <inheritdoc/>
    public override int GetHashCode()
    {
        // Consistent with Equals (comparer is part of identity): hash the comparer + the entries.
        // When the comparer is also an equality comparer (e.g. StringComparer.Ordinal) hash each
        // key through it so Compare==0 keys hash alike; always fold the weight. (Mirrors GSet/Bag.)
        var hash = default(HashCode);
        hash.Add(_comparer);
        hash.Add(_items.Length);
        var eq = _comparer as IEqualityComparer<T>;
        foreach (var e in _items)
        {
            if (eq is not null)
            {
                hash.Add(e.Key, eq);
            }

            hash.Add(e.Weight);
        }

        return hash.ToHashCode();
    }
}
