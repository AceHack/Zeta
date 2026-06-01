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
using System.Linq;

namespace Zeta.Core.CSharp;

/// <summary>
/// Factory methods for <see cref="IndexedZSet{TKey, TValue}"/> (the .NET non-generic companion
/// convention, e.g. <see cref="ImmutableArray"/> vs <see cref="ImmutableArray{T}"/>; keeps the
/// generic type static-member-free, CA1000).
/// </summary>
public static class IndexedZSet
{
    /// <summary>The empty indexed Z-set (the <see cref="IndexedZSet{TKey, TValue}.Add"/> identity).</summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <typeparam name="TValue">The value type.</typeparam>
    /// <param name="compareK">Order on the key; defaults to <see cref="Comparer{T}.Default"/>.</param>
    /// <param name="compareV">Order on the value; defaults to <see cref="Comparer{T}.Default"/>.</param>
    /// <returns>An empty indexed Z-set.</returns>
    public static IndexedZSet<TKey, TValue> Empty<TKey, TValue>(
        IComparer<TKey>? compareK = null,
        IComparer<TValue>? compareV = null) =>
        new(
            ImmutableArray<KeyGroup<TKey, TValue>>.Empty,
            compareK ?? Comparer<TKey>.Default,
            compareV ?? Comparer<TValue>.Default);

    /// <summary>
    /// Build the canonical form from arbitrary groups: merge duplicate keys (per-key
    /// <see cref="ZSet{TValue}.Union"/>), drop keys whose merged values are empty, sort ascending by
    /// key.
    /// </summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <typeparam name="TValue">The value type.</typeparam>
    /// <param name="groups">The groups (any order; duplicate keys merged).</param>
    /// <param name="compareK">Order on the key; defaults to <see cref="Comparer{T}.Default"/>.</param>
    /// <param name="compareV">Order on the value; defaults to <see cref="Comparer{T}.Default"/>.</param>
    /// <returns>The canonical indexed Z-set.</returns>
    public static IndexedZSet<TKey, TValue> OfGroups<TKey, TValue>(
        IEnumerable<KeyGroup<TKey, TValue>> groups,
        IComparer<TKey>? compareK = null,
        IComparer<TValue>? compareV = null)
    {
        ArgumentNullException.ThrowIfNull(groups);
        var ck = compareK ?? Comparer<TKey>.Default;
        var cv = compareV ?? Comparer<TValue>.Default;

        // Sort + merge adjacent equal-by-COMPARER keys (mirrors ZSet.Canonicalize) — never key by
        // TKey.Equals/GetHashCode, so the merge respects ck even when ck-equivalence differs from
        // the type's default equality (Copilot P0, #6404).
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

        // Drop any group whose values are empty (a supplied-empty group, or one cancelled by merge)
        // — explicit Where filter, mirroring ZSet.Canonicalize's drop-zero (CodeQL quality, #6404).
        return new IndexedZSet<TKey, TValue>(
            live.Where(g => !g.Values.IsEmpty).ToImmutableArray(), ck, cv);
    }

    /// <summary>
    /// Index a flat <see cref="ZSet{TSource}"/> by extracting a key and a value from each entry,
    /// carrying that entry's weight onto the <c>(key, value)</c> tuple. A tuple's weight is the SUM
    /// over all source entries that map to it (canonicalized through <see cref="ZSet.OfEntries{T}"/>).
    /// </summary>
    /// <typeparam name="TSource">The source element type.</typeparam>
    /// <typeparam name="TKey">The extracted key type.</typeparam>
    /// <typeparam name="TValue">The extracted value type.</typeparam>
    /// <param name="source">The flat Z-set to index.</param>
    /// <param name="keyOf">Extract the key from a source element.</param>
    /// <param name="valOf">Extract the value from a source element.</param>
    /// <param name="compareK">Order on the key; defaults to <see cref="Comparer{T}.Default"/>.</param>
    /// <param name="compareV">Order on the value; defaults to <see cref="Comparer{T}.Default"/>.</param>
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
        var ck = compareK ?? Comparer<TKey>.Default;
        var cv = compareV ?? Comparer<TValue>.Default;

        // Extract (key, value, weight) triples, sort by COMPARER, then group adjacent equal-by-ck
        // runs — never bucket by TKey.Equals/GetHashCode, so grouping respects ck (Copilot P0, #6404).
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

            var values = ZSet.OfEntries(bucket, cv); // per-key sum + drop-zero by cv
            if (!values.IsEmpty)
            {
                live.Add(new KeyGroup<TKey, TValue>(key, values));
            }

            i = j;
        }

        return new IndexedZSet<TKey, TValue>(live.ToImmutable(), ck, cv);
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
public sealed class IndexedZSet<TKey, TValue> : IEquatable<IndexedZSet<TKey, TValue>>
{
    private readonly ImmutableArray<KeyGroup<TKey, TValue>> _groups;
    private readonly IComparer<TKey> _compareK;
    private readonly IComparer<TValue> _compareV;

    internal IndexedZSet(
        ImmutableArray<KeyGroup<TKey, TValue>> groups,
        IComparer<TKey> compareK,
        IComparer<TValue> compareV)
    {
        _groups = groups;
        _compareK = compareK;
        _compareV = compareV;
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

        return new IndexedZSet<TKey, TValue>(builder.ToImmutable(), _compareK, _compareV);
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

        return new IndexedZSet<TKey, TValue>(builder.ToImmutable(), _compareK, _compareV);
    }

    /// <summary><c>a − b</c> = <c>Add(b.Negate())</c>. Negatives persist (the ℤ widening).</summary>
    /// <param name="other">The indexed Z-set to subtract.</param>
    /// <returns>The group-wise difference.</returns>
    public IndexedZSet<TKey, TValue> Sub(IndexedZSet<TKey, TValue> other)
    {
        ArgumentNullException.ThrowIfNull(other);
        return Add(other.Negate());
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

        // The comparers are part of identity (mirrors ZSet/Bag/GSet; keeps Equals symmetric +
        // consistent with RequireSameComparers/Join, and with GetHashCode) — Copilot P0, #6404.
        if (!_compareK.Equals(other._compareK) || !_compareV.Equals(other._compareV))
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

    /// <summary>Throw if <paramref name="other"/> uses different comparers (comparers are part of identity).</summary>
    /// <param name="other">The indexed Z-set being combined.</param>
    private void RequireSameComparers(IndexedZSet<TKey, TValue> other)
    {
        if (!_compareK.Equals(other._compareK) || !_compareV.Equals(other._compareV))
        {
            throw new ArgumentException(
                "IndexedZSet ops require both operands to use the same comparers (the comparers are part of identity).",
                nameof(other));
        }
    }
}
