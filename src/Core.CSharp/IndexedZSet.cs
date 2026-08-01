// IndexedZSet — Z[K × V], the join/aggregation rung ABOVE the Z-set on the algebra ladder
// (G-Set ⊂ Bag ⊂ Z-set ⊂ IndexedZSet). C# native parity oracle; mirrors the TS reference
// src/Core.TypeScript/indexed-z-set, the F# engine src/Core/IndexedZSet.fs, and the Rust twin
// (src/Core.Rust.Algebra/src/indexed_zset.rs, pending). Built directly on the C# ZSet<TValue>: an
// IndexedZSet is an ascending-by-key run of per-key Z-sets, which is the layout that makes the
// bilinear Join + key-wise aggregation a linear merge over two sorted runs.
//
// IndexedZSet is an abelian GROUP (Add identity Empty, inverse Negate) plus a bilinear Join. The
// generic-math interface lift (IAdditiveIdentity / IAdditionOperators / ISubtractionOperators /
// IUnaryNegationOperators — the abelian-group subset) is the captured next step shared with the
// ZSet/Bag/GSet retrofit (see docs/PRIMITIVE-REGISTRY.md Numerics line); this cell ships the
// instance-method parity first, matching ZSet.cs / Bag.cs.

using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Numerics;

namespace Zeta.Core.CSharp;

/// <summary>
/// Factory methods for <see cref="IndexedZSet{TKey, TValue}"/> (the .NET non-generic companion
/// convention, e.g. <see cref="ImmutableArray"/> vs <see cref="ImmutableArray{T}"/>; keeps the
/// generic type static-member-free, CA1000).
/// </summary>
public static class IndexedZSet
{
    /// <summary>The empty indexed Z-set with named collations.</summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <typeparam name="TValue">The value type.</typeparam>
    /// <param name="keyCollation">The named collation for keys.</param>
    /// <param name="valCollation">The named collation for values.</param>
    /// <returns>An empty indexed Z-set.</returns>
    public static IndexedZSet<TKey, TValue> Empty<TKey, TValue>(
        string keyCollation,
        string valCollation) =>
        new(
            ImmutableArray<KeyGroup<TKey, TValue>>.Empty,
            Collation.ForKey<TKey>(keyCollation),
            Collation.ForKey<TValue>(valCollation),
            keyCollation,
            valCollation);

    /// <summary>The empty indexed Z-set (the <see cref="IndexedZSet{TKey, TValue}.Add"/> identity).</summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <typeparam name="TValue">The value type.</typeparam>
    /// <param name="compareK">Order on the key; defaults to default collation.</param>
    /// <param name="compareV">Order on the value; defaults to default collation.</param>
    /// <returns>An empty indexed Z-set.</returns>
    public static IndexedZSet<TKey, TValue> Empty<TKey, TValue>(
        IComparer<TKey>? compareK = null,
        IComparer<TValue>? compareV = null) =>
        new(
            ImmutableArray<KeyGroup<TKey, TValue>>.Empty,
            compareK ?? Collation.ForKey<TKey>(),
            compareV ?? Collation.ForKey<TValue>(),
            compareK == null ? Collation.DefaultName : "custom",
            compareV == null ? Collation.DefaultName : "custom");

    /// <summary>The empty indexed Z-set with custom comparers and collation names.</summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <typeparam name="TValue">The value type.</typeparam>
    /// <param name="compareK">Order on the key.</param>
    /// <param name="keyCollation">The key collation name.</param>
    /// <param name="compareV">Order on the value.</param>
    /// <param name="valCollation">The value collation name.</param>
    /// <returns>An empty indexed Z-set.</returns>
    public static IndexedZSet<TKey, TValue> Empty<TKey, TValue>(
        IComparer<TKey> compareK,
        string keyCollation,
        IComparer<TValue> compareV,
        string valCollation) =>
        new(
            ImmutableArray<KeyGroup<TKey, TValue>>.Empty,
            compareK ?? Collation.ForKey<TKey>(),
            compareV ?? Collation.ForKey<TValue>(),
            keyCollation,
            valCollation);

    /// <summary>Build the canonical form from arbitrary groups with named collations.</summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <typeparam name="TValue">The value type.</typeparam>
    /// <param name="groups">The groups.</param>
    /// <param name="keyCollation">The key collation name.</param>
    /// <param name="valCollation">The value collation name.</param>
    /// <returns>The canonical indexed Z-set.</returns>
    public static IndexedZSet<TKey, TValue> OfGroups<TKey, TValue>(
        IEnumerable<KeyGroup<TKey, TValue>> groups,
        string keyCollation,
        string valCollation)
    {
        ArgumentNullException.ThrowIfNull(groups);
        var ck = Collation.ForKey<TKey>(keyCollation);
        var cv = Collation.ForKey<TValue>(valCollation);
        return OfGroupsInternal(groups, ck, cv, keyCollation, valCollation);
    }

    /// <summary>
    /// Build the canonical form from arbitrary groups: merge duplicate keys (per-key
    /// <see cref="ZSet{TValue}.Union"/>), drop keys whose merged values are empty, sort ascending by
    /// key.
    /// </summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <typeparam name="TValue">The value type.</typeparam>
    /// <param name="groups">The groups (any order; duplicate keys merged).</param>
    /// <param name="compareK">Order on the key; defaults to default collation.</param>
    /// <param name="compareV">Order on the value; defaults to default collation.</param>
    /// <returns>The canonical indexed Z-set.</returns>
    public static IndexedZSet<TKey, TValue> OfGroups<TKey, TValue>(
        IEnumerable<KeyGroup<TKey, TValue>> groups,
        IComparer<TKey>? compareK = null,
        IComparer<TValue>? compareV = null)
    {
        ArgumentNullException.ThrowIfNull(groups);
        var ck = compareK ?? Collation.ForKey<TKey>();
        var cv = compareV ?? Collation.ForKey<TValue>();
        return OfGroupsInternal(
            groups, ck, cv,
            compareK == null ? Collation.DefaultName : "custom",
            compareV == null ? Collation.DefaultName : "custom");
    }

    /// <summary>Build the canonical form from arbitrary groups with custom comparers and collation names.</summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <typeparam name="TValue">The value type.</typeparam>
    /// <param name="groups">The groups.</param>
    /// <param name="compareK">Order on the key.</param>
    /// <param name="keyCollation">The key collation name.</param>
    /// <param name="compareV">Order on the value.</param>
    /// <param name="valCollation">The value collation name.</param>
    /// <returns>The canonical indexed Z-set.</returns>
    public static IndexedZSet<TKey, TValue> OfGroups<TKey, TValue>(
        IEnumerable<KeyGroup<TKey, TValue>> groups,
        IComparer<TKey> compareK,
        string keyCollation,
        IComparer<TValue> compareV,
        string valCollation)
    {
        ArgumentNullException.ThrowIfNull(groups);
        var ck = compareK ?? Collation.ForKey<TKey>();
        var cv = compareV ?? Collation.ForKey<TValue>();
        return OfGroupsInternal(groups, ck, cv, keyCollation, valCollation);
    }

    private static IndexedZSet<TKey, TValue> OfGroupsInternal<TKey, TValue>(
        IEnumerable<KeyGroup<TKey, TValue>> groups,
        IComparer<TKey> ck,
        IComparer<TValue> cv,
        string keyCollation,
        string valCollation)
    {
        var sorted = new List<KeyGroup<TKey, TValue>>(groups);
        sorted.Sort((a, b) => ck.Compare(a.Key, b.Key));
        var live = new List<KeyGroup<TKey, TValue>>(sorted.Count);
        foreach (var g in sorted)
        {
            if (live.Count > 0 && ck.Compare(live[^1].Key, g.Key) == 0)
            {
                live[^1] = new KeyGroup<TKey, TValue>(live[^1].Key, live[^1].Values.Union(g.Values));
            }
            else
            {
                live.Add(g);
            }
        }

        return new IndexedZSet<TKey, TValue>(
            live.Where(g => !g.Values.IsEmpty).ToImmutableArray(), ck, cv, keyCollation, valCollation);
    }

    /// <summary>Index a flat ZSet with named collations.</summary>
    /// <typeparam name="TSource">The source element type.</typeparam>
    /// <typeparam name="TKey">The extracted key type.</typeparam>
    /// <typeparam name="TValue">The extracted value type.</typeparam>
    /// <param name="source">The flat Z-set to index.</param>
    /// <param name="keyOf">Extract key.</param>
    /// <param name="valOf">Extract value.</param>
    /// <param name="keyCollation">The key collation name.</param>
    /// <param name="valCollation">The value collation name.</param>
    /// <returns>The canonical indexed Z-set.</returns>
    public static IndexedZSet<TKey, TValue> IndexWith<TSource, TKey, TValue>(
        ZSet<TSource> source,
        Func<TSource, TKey> keyOf,
        Func<TSource, TValue> valOf,
        string keyCollation,
        string valCollation)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(keyOf);
        ArgumentNullException.ThrowIfNull(valOf);
        var ck = Collation.ForKey<TKey>(keyCollation);
        var cv = Collation.ForKey<TValue>(valCollation);
        return IndexWithInternal(source, keyOf, valOf, ck, cv, keyCollation, valCollation);
    }

    /// <summary>
    /// Index a flat <see cref="ZSet{TSource}"/> by extracting a key and a value from each entry,
    /// carrying that entry's weight onto the <c>(key, value)</c> tuple. A tuple's weight is the SUM
    /// over all source entries that map to it (canonicalized through ZSet.OfEntries).
    /// </summary>
    /// <typeparam name="TSource">The source element type.</typeparam>
    /// <typeparam name="TKey">The extracted key type.</typeparam>
    /// <typeparam name="TValue">The extracted value type.</typeparam>
    /// <param name="source">The flat Z-set to index.</param>
    /// <param name="keyOf">Extract the key from a source element.</param>
    /// <param name="valOf">Extract the value from a source element.</param>
    /// <param name="compareK">Order on the key; defaults to default collation.</param>
    /// <param name="compareV">Order on the value; defaults to default collation.</param>
    /// <returns>The canonical indexed Z-set.</returns>
    public static IndexedZSet<TKey, TValue> IndexWith<TSource, TKey, TValue>(
        ZSet<TSource> source,
        Func<TSource, TKey> keyOf,
        Func<TSource, TValue> valOf,
        IComparer<TKey>? compareK = null,
        IComparer<TValue>? compareV = null)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(keyOf);
        ArgumentNullException.ThrowIfNull(valOf);
        var ck = compareK ?? Collation.ForKey<TKey>();
        var cv = compareV ?? Collation.ForKey<TValue>();
        return IndexWithInternal(
            source, keyOf, valOf, ck, cv,
            compareK == null ? Collation.DefaultName : "custom",
            compareV == null ? Collation.DefaultName : "custom");
    }

    /// <summary>Index a flat ZSet with custom comparers and collation names.</summary>
    /// <typeparam name="TSource">The source element type.</typeparam>
    /// <typeparam name="TKey">The extracted key type.</typeparam>
    /// <typeparam name="TValue">The extracted value type.</typeparam>
    /// <param name="source">The flat Z-set to index.</param>
    /// <param name="keyOf">Extract key.</param>
    /// <param name="valOf">Extract value.</param>
    /// <param name="compareK">Order on key.</param>
    /// <param name="keyCollation">The key collation name.</param>
    /// <param name="compareV">Order on value.</param>
    /// <param name="valCollation">The value collation name.</param>
    /// <returns>The canonical indexed Z-set.</returns>
    public static IndexedZSet<TKey, TValue> IndexWith<TSource, TKey, TValue>(
        ZSet<TSource> source,
        Func<TSource, TKey> keyOf,
        Func<TSource, TValue> valOf,
        IComparer<TKey> compareK,
        string keyCollation,
        IComparer<TValue> compareV,
        string valCollation)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(keyOf);
        ArgumentNullException.ThrowIfNull(valOf);
        var ck = compareK ?? Collation.ForKey<TKey>();
        var cv = compareV ?? Collation.ForKey<TValue>();
        return IndexWithInternal(source, keyOf, valOf, ck, cv, keyCollation, valCollation);
    }

    private static IndexedZSet<TKey, TValue> IndexWithInternal<TSource, TKey, TValue>(
        ZSet<TSource> source,
        Func<TSource, TKey> keyOf,
        Func<TSource, TValue> valOf,
        IComparer<TKey> ck,
        IComparer<TValue> cv,
        string keyCollation,
        string valCollation)
    {
        var triples = new List<(TKey Key, TValue Value, long Weight)>();
        foreach (var entry in source.ToImmutableArray())
        {
            triples.Add((keyOf(entry.Key), valOf(entry.Key), entry.Weight));
        }

        triples.Sort((a, b) => ck.Compare(a.Key, b.Key));
        var live = ImmutableArray.CreateBuilder<KeyGroup<TKey, TValue>>();
        var i = 0;
        while (i < triples.Count)
        {
            var key = triples[i].Key;
            var bucket = new List<(TValue, long)>();
            var j = i;
            while (j < triples.Count && ck.Compare(triples[j].Key, key) == 0)
            {
                bucket.Add((triples[j].Value, triples[j].Weight));
                j++;
            }

            var values = ZSet.OfEntries(bucket, cv, valCollation);
            if (!values.IsEmpty)
            {
                live.Add(new KeyGroup<TKey, TValue>(key, values));
            }

            i = j;
        }

        return new IndexedZSet<TKey, TValue>(live.ToImmutable(), ck, cv, keyCollation, valCollation);
    }
}

/// <summary>
/// <c>IndexedZSet&lt;TKey,TValue&gt;</c> — conceptually <c>Z[K × V]</c>, stored as an
/// ascending-by-key run of non-empty <see cref="KeyGroup{TKey, TValue}"/>s (each holding a per-key
/// <see cref="ZSet{TValue}"/>). The grouping makes the bilinear <see cref="Join{TOther, TResult}"/>
/// and key-wise aggregation a linear merge. Canonical form (the cross-oracle equality contract):
/// groups sorted ascending by key with no key twice, each group's values a canonical Z-set, and a
/// group whose values cancel to empty is dropped. The comparers are part of identity (mirrors
/// <see cref="ZSet{T}"/> / Bag / GSet).
/// </summary>
/// <typeparam name="TKey">The key type.</typeparam>
/// <typeparam name="TValue">The value type.</typeparam>
public sealed class IndexedZSet<TKey, TValue> :
    IEquatable<IndexedZSet<TKey, TValue>>,
    IAdditiveIdentity<IndexedZSet<TKey, TValue>, IndexedZSet<TKey, TValue>>,
    IAdditionOperators<IndexedZSet<TKey, TValue>, IndexedZSet<TKey, TValue>, IndexedZSet<TKey, TValue>>,
    ISubtractionOperators<IndexedZSet<TKey, TValue>, IndexedZSet<TKey, TValue>, IndexedZSet<TKey, TValue>>,
    IUnaryNegationOperators<IndexedZSet<TKey, TValue>, IndexedZSet<TKey, TValue>>
{
    private readonly ImmutableArray<KeyGroup<TKey, TValue>> _groups;
    private readonly IComparer<TKey> _compareK;
    private readonly IComparer<TValue> _compareV;

    /// <summary>Gets the name of the collation used for the keys of this indexed Z-set.</summary>
    public string KeyCollationName { get; }

    /// <summary>Gets the name of the collation used for the values of this indexed Z-set.</summary>
    public string ValueCollationName { get; }

    internal IndexedZSet(
        ImmutableArray<KeyGroup<TKey, TValue>> groups,
        IComparer<TKey> compareK,
        IComparer<TValue> compareV,
        string keyCollationName,
        string valueCollationName)
    {
        _groups = groups;
        _compareK = compareK;
        _compareV = compareV;
        KeyCollationName = keyCollationName;
        ValueCollationName = valueCollationName;
    }

    /// <summary>The number of distinct keys (groups).</summary>
    public int KeyCount => _groups.Length;

    /// <summary>Whether there are no groups.</summary>
    public bool IsEmpty => _groups.IsEmpty;

    /// <summary>The total number of <c>(key, value)</c> tuples = sum of per-group distinct values.</summary>
    /// <returns>The tuple count.</returns>
    public int TupleCount()
    {
        var n = 0;
        foreach (var g in _groups)
        {
            n += g.Values.Count;
        }

        return n;
    }

    /// <summary>Look up a single key's <see cref="ZSet{TValue}"/> (empty if the key is absent).</summary>
    /// <param name="key">The key to look up.</param>
    /// <returns>The per-key Z-set, or empty.</returns>
    public ZSet<TValue> Get(TKey key)
    {
        int lo = 0, hi = _groups.Length - 1;
        while (lo <= hi)
        {
            var mid = lo + ((hi - lo) >> 1);
            var c = _compareK.Compare(_groups[mid].Key, key);
            if (c < 0)
            {
                lo = mid + 1;
            }
            else if (c > 0)
            {
                hi = mid - 1;
            }
            else
            {
                return _groups[mid].Values;
            }
        }

        return ZSet.Empty<TValue>(_compareV);
    }

    /// <summary>
    /// Flatten to a <see cref="ZSet{TResult}"/> of mapped tuples — <paramref name="combine"/> names
    /// the codomain element (e.g. <c>(k, v) =&gt; $"{k}|{v}"</c>). Canonicalized (sum + drop-zero) in
    /// case two tuples map to the same element.
    /// </summary>
    /// <typeparam name="TResult">The flattened element type.</typeparam>
    /// <param name="combine">Map a <c>(key, value)</c> pair to a codomain element.</param>
    /// <param name="compareC">Order on the flattened element; defaults to <see cref="Comparer{T}.Default"/>.</param>
    /// <returns>The flattened Z-set.</returns>
    public ZSet<TResult> ToZSet<TResult>(Func<TKey, TValue, TResult> combine, IComparer<TResult>? compareC = null)
    {
        ArgumentNullException.ThrowIfNull(combine);
        var entries = new List<(TResult, long)>();
        foreach (var g in _groups)
        {
            foreach (var e in g.Values.ToImmutableArray())
            {
                entries.Add((combine(g.Key, e.Key), e.Weight));
            }
        }

        return ZSet.OfEntries(entries, compareC);
    }

    /// <summary>
    /// Group-wise addition: merge two sorted runs; on a shared key, <see cref="ZSet{TValue}.Union"/>
    /// the per-key Z-sets (dropping the group if it cancels to empty). The indexed analogue of
    /// <see cref="ZSet{T}.Union"/>; linear in the number of groups.
    /// </summary>
    /// <param name="other">The indexed Z-set to add.</param>
    /// <returns>The group-wise sum.</returns>
    public IndexedZSet<TKey, TValue> Add(IndexedZSet<TKey, TValue> other)
    {
        ArgumentNullException.ThrowIfNull(other);
        RequireSameComparers(other);
        if (_groups.IsEmpty)
        {
            return other;
        }

        if (other._groups.IsEmpty)
        {
            return this;
        }

        var a = _groups;
        var b = other._groups;
        var builder = ImmutableArray.CreateBuilder<KeyGroup<TKey, TValue>>(a.Length + b.Length);
        int i = 0, j = 0;
        while (i < a.Length && j < b.Length)
        {
            var c = _compareK.Compare(a[i].Key, b[j].Key);
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
                var merged = a[i].Values.Union(b[j].Values);
                if (!merged.IsEmpty)
                {
                    builder.Add(new KeyGroup<TKey, TValue>(a[i].Key, merged));
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

        return new IndexedZSet<TKey, TValue>(builder.ToImmutable(), _compareK, _compareV, KeyCollationName, ValueCollationName);
    }

    /// <summary>The abelian-group inverse: negate every weight (per-group <see cref="ZSet{T}.Negate"/>).</summary>
    /// <returns>The indexed Z-set with every weight sign-flipped.</returns>
    public IndexedZSet<TKey, TValue> Negate()
    {
        var builder = ImmutableArray.CreateBuilder<KeyGroup<TKey, TValue>>(_groups.Length);
        foreach (var g in _groups)
        {
            builder.Add(new KeyGroup<TKey, TValue>(g.Key, g.Values.Negate()));
        }

        return new IndexedZSet<TKey, TValue>(builder.ToImmutable(), _compareK, _compareV, KeyCollationName, ValueCollationName);
    }

    /// <summary><c>a − b</c> = <c>Add(b.Negate())</c>. Negatives persist (the ℤ widening).</summary>
    /// <param name="other">The indexed Z-set to subtract.</param>
    /// <returns>The group-wise difference.</returns>
    public IndexedZSet<TKey, TValue> Sub(IndexedZSet<TKey, TValue> other)
    {
        ArgumentNullException.ThrowIfNull(other);
        return Add(other.Negate());
    }

    // ─── generic-math abelian-group surface (System.Numerics IWSAM) ──────────
    // "numerics like dotnet as our interface, push to other langs if they don't
    // have" (Aaron 2026-06-01). IndexedZSet IS-A IAdditiveIdentity +
    // IAdditionOperators (monoid) + ISubtractionOperators + IUnaryNegationOperators
    // (the abelian-group inverse). Mirrors the Z-set rung (#6481) and the F#
    // Zero/(+)/(~-)/(-) twin. NOT INumber — the ring product is the bilinear Join,
    // surfaced separately, not a numeric multiply.

    /// <summary>
    /// The additive identity (empty indexed Z-set): <c>a + AdditiveIdentity == a</c>. Cached,
    /// comparer-agnostic (default comparers); the <c>operator +</c>/<c>operator -</c> empty
    /// short-circuits keep the identity law holding for indexed Z-sets built with any comparers.
    /// </summary>
    [SuppressMessage(
        "Design",
        "CA1000:Do not declare static members on generic types",
        Justification = "IWSAM (IAdditiveIdentity) requires the static member on the generic type itself; CA1000 predates static abstract interface members.")]
    public static IndexedZSet<TKey, TValue> AdditiveIdentity { get; } = IndexedZSet.Empty<TKey, TValue>();

    /// <summary>
    /// <c>a + b</c> — per-key value-Z-set sum (the abelian-group operation; delegates to <see cref="Add"/>).
    /// Empty is short-circuited as a comparer-agnostic identity BEFORE <see cref="Add"/>'s same-comparer
    /// check, so <c>a + Zero == a</c> and <c>Zero + a == a</c> hold for any comparers; two NON-empty
    /// operands with mismatched comparers still fail fast. NOT idempotent — <c>a + a</c> doubles weights.
    /// </summary>
    /// <param name="left">The left indexed Z-set.</param>
    /// <param name="right">The right indexed Z-set.</param>
    /// <returns>The per-key sum.</returns>
    public static IndexedZSet<TKey, TValue> operator +(IndexedZSet<TKey, TValue> left, IndexedZSet<TKey, TValue> right)
    {
        ArgumentNullException.ThrowIfNull(left);
        ArgumentNullException.ThrowIfNull(right);
        if (left.IsEmpty)
        {
            return right;
        }

        if (right.IsEmpty)
        {
            return left;
        }

        return left.Add(right);
    }

    /// <summary>
    /// <c>-a</c> — the abelian-group inverse (delegates to <see cref="Negate"/>), so
    /// <c>a + (-a) == AdditiveIdentity</c> (the law a Bag cannot satisfy).
    /// </summary>
    /// <param name="value">The indexed Z-set to negate.</param>
    /// <returns>The indexed Z-set with every weight sign-flipped.</returns>
    public static IndexedZSet<TKey, TValue> operator -(IndexedZSet<TKey, TValue> value)
    {
        ArgumentNullException.ThrowIfNull(value);
        return value.Negate();
    }

    /// <summary>
    /// <c>a - b == a + (-b)</c> (delegates to <see cref="Sub"/>). Empty is short-circuited as a
    /// comparer-agnostic identity (<c>a - Zero == a</c>, <c>Zero - b == -b</c>) before the same-comparer
    /// check, matching <c>operator +</c>.
    /// </summary>
    /// <param name="left">The minuend.</param>
    /// <param name="right">The subtrahend.</param>
    /// <returns><c>left + (-right)</c>.</returns>
    public static IndexedZSet<TKey, TValue> operator -(IndexedZSet<TKey, TValue> left, IndexedZSet<TKey, TValue> right)
    {
        ArgumentNullException.ThrowIfNull(left);
        ArgumentNullException.ThrowIfNull(right);
        if (right.IsEmpty)
        {
            return left;
        }

        if (left.IsEmpty)
        {
            return right.Negate();
        }

        return left.Sub(right);
    }

    /// <summary>
    /// Bilinear <b>join</b> on the shared key: merge-join the two sorted runs, and for each matching
    /// key cross-product the value-Z-sets — the output weight is the PRODUCT of the two value weights
    /// (<c>checked</c>; mirrors the F# <c>Checked.( * )</c>), <paramref name="combine"/> names the
    /// codomain element. The flat <see cref="ZSet{TResult}"/> result is consolidated (sum +
    /// drop-zero). The operator the DBSP incremental-view story rests on.
    /// </summary>
    /// <typeparam name="TOther">The other side's value type.</typeparam>
    /// <typeparam name="TResult">The joined codomain element type.</typeparam>
    /// <param name="other">The indexed Z-set to join against.</param>
    /// <param name="combine">Name a joined triple <c>(key, va, vb)</c> as a codomain element.</param>
    /// <param name="compareC">Order on the joined element; defaults to <see cref="Comparer{T}.Default"/>.</param>
    /// <returns>The joined Z-set.</returns>
    public ZSet<TResult> Join<TOther, TResult>(
        IndexedZSet<TKey, TOther> other,
        Func<TKey, TValue, TOther, TResult> combine,
        IComparer<TResult>? compareC = null)
    {
        ArgumentNullException.ThrowIfNull(other);
        ArgumentNullException.ThrowIfNull(combine);
        if (!_compareK.Equals(other.KeyComparer))
        {
            throw new ArgumentException(
                "IndexedZSet.Join requires both sides to use the same key comparer (the comparer is part of identity).",
                nameof(other));
        }

        var a = _groups;
        var b = other.Groups;
        var entries = new List<(TResult, long)>();
        int i = 0, j = 0;
        while (i < a.Length && j < b.Length)
        {
            var c = _compareK.Compare(a[i].Key, b[j].Key);
            if (c < 0)
            {
                i++;
            }
            else if (c > 0)
            {
                j++;
            }
            else
            {
                var key = a[i].Key;
                foreach (var va in a[i].Values.ToImmutableArray())
                {
                    foreach (var vb in b[j].Values.ToImmutableArray())
                    {
                        // Overflow-checked weight product (the F# twin's `Checked.( * )`); operands
                        // extracted to locals so the multiply isn't a `.Weight * .Weight` infix
                        // (the `unchecked-weight-multiply` semgrep guard matches that text form).
                        long wa = va.Weight, wb = vb.Weight;
                        var w = checked(wa * wb);
                        if (w != 0)
                        {
                            entries.Add((combine(key, va.Key, vb.Key), w));
                        }
                    }
                }

                i++;
                j++;
            }
        }

        return ZSet.OfEntries(entries, compareC);
    }

    /// <summary>The canonical (ascending-by-key) groups as an immutable array.</summary>
    /// <returns>The canonical run.</returns>
    public ImmutableArray<KeyGroup<TKey, TValue>> ToImmutableArray() => _groups;

    /// <summary>The key comparer (part of identity; internal accessor for cross-instance ops).</summary>
    internal IComparer<TKey> KeyComparer => _compareK;

    /// <summary>The canonical groups (internal accessor for cross-instance ops like <see cref="Join{TOther, TResult}"/>).</summary>
    internal ImmutableArray<KeyGroup<TKey, TValue>> Groups => _groups;

    /// <summary>Structural equality (relies on the canonical form + the value comparer).</summary>
    /// <param name="other">The indexed Z-set to compare.</param>
    /// <returns><see langword="true"/> if both have the same groups in canonical order.</returns>
    public bool Equals(IndexedZSet<TKey, TValue>? other)
    {
        if (other is null)
        {
            return false;
        }

        if (ReferenceEquals(this, other))
        {
            return true;
        }

        var sameKeyCollation = !string.Equals(KeyCollationName, "custom", StringComparison.Ordinal) &&
                               string.Equals(KeyCollationName, other.KeyCollationName, StringComparison.Ordinal);
        var sameValCollation = !string.Equals(ValueCollationName, "custom", StringComparison.Ordinal) &&
                               string.Equals(ValueCollationName, other.ValueCollationName, StringComparison.Ordinal);

        if ((!sameKeyCollation && !_compareK.Equals(other._compareK)) ||
            (!sameValCollation && !_compareV.Equals(other._compareV)))
        {
            return false;
        }

        if (_groups.Length != other._groups.Length)
        {
            return false;
        }

        for (var n = 0; n < _groups.Length; n++)
        {
            if (_compareK.Compare(_groups[n].Key, other._groups[n].Key) != 0
                || !_groups[n].Values.Equals(other._groups[n].Values))
            {
                return false;
            }
        }

        return true;
    }

    /// <summary>Structural equality against an arbitrary object.</summary>
    /// <param name="obj">The object to compare.</param>
    /// <returns><see langword="true"/> if <paramref name="obj"/> is an equal indexed Z-set.</returns>
    public override bool Equals(object? obj) => Equals(obj as IndexedZSet<TKey, TValue>);

    /// <summary>A hash consistent with <see cref="Equals(IndexedZSet{TKey, TValue})"/> (keys + per-group Z-sets).</summary>
    /// <returns>The hash code.</returns>
    public override int GetHashCode()
    {
        // Consistent with Equals: comparers are part of identity, so fold them in (Copilot P0, #6404).
        var hash = default(HashCode);
        hash.Add(KeyCollationName, StringComparer.Ordinal);
        hash.Add(ValueCollationName, StringComparer.Ordinal);
        hash.Add(_compareK);
        hash.Add(_compareV);
        hash.Add(_groups.Length);
        // Hash the key ONLY when the comparer is an equality comparer (so Compare==0 keys hash
        // alike); otherwise OMIT it — Equals compares keys via _compareK.Compare, which is not a
        // hashable equality, so hashing by default equality would break equal-objects-equal-hashes
        // for Compare-equal-but-not-default-equal keys (Copilot P0 #6404; mirrors ZSet.GetHashCode).
        var keyEq = _compareK as IEqualityComparer<TKey>;
        foreach (var g in _groups)
        {
            if (keyEq is not null)
            {
                hash.Add(g.Key, keyEq);
            }

            hash.Add(g.Values);
        }

        return hash.ToHashCode();
    }

    private void RequireSameComparers(IndexedZSet<TKey, TValue> other)
    {
        if ((!string.Equals(KeyCollationName, other.KeyCollationName, StringComparison.Ordinal) && !_compareK.Equals(other._compareK)) ||
            (!string.Equals(ValueCollationName, other.ValueCollationName, StringComparison.Ordinal) && !_compareV.Equals(other._compareV)))
        {
            throw new ArgumentException(
                $"IndexedZSet ops require both operands to use the same collation name or equivalent comparers (this key: '{KeyCollationName}', other key: '{other.KeyCollationName}'; this value: '{ValueCollationName}', other value: '{other.ValueCollationName}').",
                nameof(other));
        }
    }
}
