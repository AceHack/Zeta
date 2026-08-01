// Bag — non-negative-weight multiset (middle rung of the algebra ladder: G-Set ⊂ Bag ⊂ Z-set).
// C# parity oracle; mirrors src/Core/Bag.fs, src/Core.TypeScript/bag, and
// src/Core.Rust.Algebra/src/bag.rs. Lives in the C# core next to GSet.cs + the Z-set binding
// (ZetaCircuitBuilder), mirroring how F# keeps Bag.fs in src/Core/.

using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Numerics;

namespace Zeta.Core.CSharp;

/// <summary>
/// Factory methods for <see cref="Bag{T}"/>. A non-generic companion class (the .NET convention,
/// e.g. <see cref="ImmutableArray"/> vs <see cref="ImmutableArray{T}"/>) so the constructors stay
/// static-member-free on the generic type (CA1000).
/// </summary>
public static class Bag
{
    /// <summary>The empty Bag (the <see cref="Bag{T}.Union"/> identity) with a named collation.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="collation">The named collation to use.</param>
    /// <returns>An empty bag.</returns>
    public static Bag<T> Empty<T>(string collation) =>
        new(ImmutableArray<BagEntry<T>>.Empty, Collation.ForKey<T>(collation), collation);

    /// <summary>The empty Bag (the <see cref="Bag{T}.Union"/> identity).</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="comparer">Order on <typeparamref name="T"/>; defaults to default collation.</param>
    /// <returns>An empty bag.</returns>
    public static Bag<T> Empty<T>(IComparer<T>? comparer = null) =>
        new(ImmutableArray<BagEntry<T>>.Empty, comparer ?? Collation.ForKey<T>(), comparer == null ? Collation.DefaultName : "custom");

    /// <summary>The empty Bag with a custom comparer and collation name.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="comparer">Order on <typeparamref name="T"/>.</param>
    /// <param name="collation">The name of the collation.</param>
    /// <returns>An empty bag.</returns>
    public static Bag<T> Empty<T>(IComparer<T> comparer, string collation) =>
        new(ImmutableArray<BagEntry<T>>.Empty, comparer ?? Collation.ForKey<T>(), collation);

    /// <summary>A one-key Bag at count <paramref name="n"/>; <paramref name="n"/> &lt;= 0 yields the empty Bag with a named collation.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="x">The single key.</param>
    /// <param name="n">The multiplicity (a no-op if &lt;= 0).</param>
    /// <param name="collation">The named collation to use.</param>
    /// <returns>A bag containing exactly <paramref name="x"/> at count <paramref name="n"/> (or empty).</returns>
    public static Bag<T> Singleton<T>(T x, long n = 1, string collation = Collation.DefaultName)
    {
        var cmp = Collation.ForKey<T>(collation);
        return n > 0
            ? new Bag<T>(ImmutableArray.Create(new BagEntry<T>(x, n)), cmp, collation)
            : new Bag<T>(ImmutableArray<BagEntry<T>>.Empty, cmp, collation);
    }

    /// <summary>A one-key Bag with a custom comparer and collation name.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="x">The single key.</param>
    /// <param name="n">The multiplicity (a no-op if &lt;= 0).</param>
    /// <param name="comparer">Order on <typeparamref name="T"/>.</param>
    /// <param name="collation">The name of the collation.</param>
    /// <returns>A bag containing exactly <paramref name="x"/> at count <paramref name="n"/> (or empty).</returns>
    public static Bag<T> Singleton<T>(T x, long n, IComparer<T> comparer, string collation = "custom")
    {
        var cmp = comparer ?? Collation.ForKey<T>();
        return n > 0
            ? new Bag<T>(ImmutableArray.Create(new BagEntry<T>(x, n)), cmp, collation)
            : new Bag<T>(ImmutableArray<BagEntry<T>>.Empty, cmp, collation);
    }

    /// <summary>Canonicalize arbitrary entries with a named collation.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="entries">The entries.</param>
    /// <param name="collation">The named collation to use.</param>
    /// <returns>The canonical Bag.</returns>
    public static Bag<T> OfEntries<T>(IEnumerable<(T Key, long Count)> entries, string collation)
    {
        var cmp = Collation.ForKey<T>(collation);
        return new Bag<T>(Canonicalize(entries, cmp), cmp, collation);
    }

    /// <summary>Canonicalize arbitrary entries.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="entries">The entries.</param>
    /// <param name="comparer">Order on the key; defaults to default collation.</param>
    /// <returns>The canonical Bag.</returns>
    public static Bag<T> OfEntries<T>(IEnumerable<(T Key, long Count)> entries, IComparer<T>? comparer = null)
    {
        var cmp = comparer ?? Collation.ForKey<T>();
        return new Bag<T>(Canonicalize(entries, cmp), cmp, comparer == null ? Collation.DefaultName : "custom");
    }

    /// <summary>Canonicalize arbitrary entries with a custom comparer and collation name.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="entries">The entries.</param>
    /// <param name="comparer">Order on the key.</param>
    /// <param name="collation">The name of the collation.</param>
    /// <returns>The canonical Bag.</returns>
    public static Bag<T> OfEntries<T>(IEnumerable<(T Key, long Count)> entries, IComparer<T> comparer, string collation)
    {
        var cmp = comparer ?? Collation.ForKey<T>();
        return new Bag<T>(Canonicalize(entries, cmp), cmp, collation);
    }

    /// <summary>Build a Bag by counting occurrences in a sequence with a named collation.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="xs">The keys.</param>
    /// <param name="collation">The named collation to use.</param>
    /// <returns>The canonical Bag of occurrence counts.</returns>
    public static Bag<T> OfSeq<T>(IEnumerable<T> xs, string collation)
    {
        ArgumentNullException.ThrowIfNull(xs);
        var cmp = Collation.ForKey<T>(collation);
        var entries = xs.Select(x => (x, 1L));
        return new Bag<T>(Canonicalize(entries, cmp), cmp, collation);
    }

    /// <summary>Build a Bag by counting occurrences in a sequence.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="xs">The keys.</param>
    /// <param name="comparer">Order on the key; defaults to default collation.</param>
    /// <returns>The canonical Bag of occurrence counts.</returns>
    public static Bag<T> OfSeq<T>(IEnumerable<T> xs, IComparer<T>? comparer = null)
    {
        ArgumentNullException.ThrowIfNull(xs);
        var cmp = comparer ?? Collation.ForKey<T>();
        var entries = xs.Select(x => (x, 1L));
        return new Bag<T>(Canonicalize(entries, cmp), cmp, comparer == null ? Collation.DefaultName : "custom");
    }

    /// <summary>Build a Bag by counting occurrences in a sequence with a custom comparer and collation name.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="xs">The keys.</param>
    /// <param name="comparer">Order on the key.</param>
    /// <param name="collation">The name of the collation.</param>
    /// <returns>The canonical Bag of occurrence counts.</returns>
    public static Bag<T> OfSeq<T>(IEnumerable<T> xs, IComparer<T> comparer, string collation)
    {
        ArgumentNullException.ThrowIfNull(xs);
        var cmp = comparer ?? Collation.ForKey<T>();
        var entries = xs.Select(x => (x, 1L));
        return new Bag<T>(Canonicalize(entries, cmp), cmp, collation);
    }

    /// <summary>Build a Bag by counting occurrences in an array with a named collation.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="xs">The keys.</param>
    /// <param name="collation">The named collation to use.</param>
    /// <returns>The canonical Bag of occurrence counts.</returns>
    public static Bag<T> OfArray<T>(T[] xs, string collation) => OfSeq(xs, collation);

    /// <summary>Build a Bag by counting occurrences in an array.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="xs">The keys.</param>
    /// <param name="comparer">Order on the key; defaults to default collation.</param>
    /// <returns>The canonical Bag of occurrence counts.</returns>
    public static Bag<T> OfArray<T>(T[] xs, IComparer<T>? comparer = null) => OfSeq(xs, comparer);

    /// <summary>Build a Bag by counting occurrences in an array with a custom comparer and collation name.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="xs">The keys.</param>
    /// <param name="comparer">Order on the key.</param>
    /// <param name="collation">The name of the collation.</param>
    /// <returns>The canonical Bag of occurrence counts.</returns>
    public static Bag<T> OfArray<T>(T[] xs, IComparer<T> comparer, string collation) => OfSeq(xs, comparer, collation);

    /// <summary>
    /// Sum per key, drop non-positive summed counts, sort ascending under <paramref name="cmp"/>
    /// (the canonical run). The summed count is <c>checked</c> so an int64 overflow throws rather
    /// than silently wrapping (the C# analog of the TS safe-integer guard / Rust <c>checked_add</c>).
    /// </summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="entries">The entries.</param>
    /// <param name="cmp">The key order.</param>
    /// <returns>The canonical ascending, key-unique, count-positive run.</returns>
    internal static ImmutableArray<BagEntry<T>> Canonicalize<T>(IEnumerable<(T Key, long Count)> entries, IComparer<T> cmp)
    {
        ArgumentNullException.ThrowIfNull(entries);
        var sorted = new List<(T Key, long Count)>(entries);
        sorted.Sort((a, b) => cmp.Compare(a.Key, b.Key));
        var merged = ImmutableArray.CreateBuilder<BagEntry<T>>(sorted.Count);
        for (var k = 0; k < sorted.Count; k++)
        {
            if (merged.Count > 0 && cmp.Compare(merged[^1].Key, sorted[k].Key) == 0)
            {
                merged[^1] = merged[^1] with { Count = checked(merged[^1].Count + sorted[k].Count) };
            }
            else
            {
                merged.Add(new BagEntry<T>(sorted[k].Key, sorted[k].Count));
            }
        }

        // Drop keys whose summed count netted to <= 0 (e.g. +1 then -1), keeping the rest in
        // canonical order. Explicit .Where filter (github-code-quality review 2026-06-01).
        return merged.Where(e => e.Count > 0).ToImmutableArray();
    }
}

/// <summary>
/// A Bag (multiset): a canonical ascending-key-sorted, count-positive, key-unique run under an
/// <see cref="IComparer{T}"/>. <see cref="Union"/> is the only combiner and is the per-key SUM —
/// commutative, associative, with the empty bag as identity, but <b>NOT</b> idempotent
/// (<c>Union(a, a)</c> doubles every count, the Bag/G-Set distinction). Parity with
/// <c>src/Core/Bag.fs</c>, <c>src/Core.TypeScript/bag</c>, and <c>src/Core.Rust.Algebra/src/bag.rs</c>.
/// Construct via <see cref="Bag"/>.
/// </summary>
/// <remarks>
/// The comparer is explicit (like the TS <c>compare</c> parameter) rather than baked to
/// <see cref="Comparer{T}.Default"/>: for <see cref="string"/> the default is culture-sensitive,
/// but the cross-language wire (TS UTF-16 code-unit order, Rust UTF-8 byte order, F# structural
/// ordinal) needs <see cref="StringComparer.Ordinal"/>. Pass it explicitly for cross-language parity.
/// </remarks>
/// <typeparam name="T">The key type.</typeparam>
public sealed class Bag<T> :
    IEquatable<Bag<T>>,
    IAdditiveIdentity<Bag<T>, Bag<T>>,
    IAdditionOperators<Bag<T>, Bag<T>, Bag<T>>
{
    private readonly ImmutableArray<BagEntry<T>> _items;
    private readonly IComparer<T> _comparer;

    /// <summary>Gets the name of the collation used by this bag.</summary>
    public string CollationName { get; }

    internal Bag(ImmutableArray<BagEntry<T>> items, IComparer<T> comparer, string collationName)
    {
        _items = items.IsDefault ? ImmutableArray<BagEntry<T>>.Empty : items;
        _comparer = comparer;
        CollationName = collationName;
    }

    /// <summary>The number of DISTINCT keys (the support size).</summary>
    public int Count => _items.Length;

    /// <summary>Whether the bag has no keys.</summary>
    public bool IsEmpty => _items.IsEmpty;

    /// <summary>The multiplicity of <paramref name="x"/> (0 if absent). Binary search on the sorted keys. O(log n).</summary>
    /// <param name="x">The key to look up.</param>
    /// <returns>The count of <paramref name="x"/>, or 0 if absent.</returns>
    public long Multiplicity(T x)
    {
        int lo = 0, hi = _items.Length - 1;
        while (lo <= hi)
        {
            var mid = lo + ((hi - lo) >> 1);
            var c = _comparer.Compare(_items[mid].Key, x);
            if (c == 0)
            {
                return _items[mid].Count;
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

    /// <summary>Membership: whether <paramref name="x"/> has a positive multiplicity.</summary>
    /// <param name="x">The key to test.</param>
    /// <returns><see langword="true"/> iff <paramref name="x"/> is present.</returns>
    public bool Contains(T x) => Multiplicity(x) > 0;

    /// <summary>The sum of all multiplicities (the total count across keys); throws on int64 overflow.</summary>
    /// <returns>The total count.</returns>
    public long Total()
    {
        var s = 0L;
        foreach (var e in _items)
        {
            s = checked(s + e.Count);
        }

        return s;
    }

    /// <summary>
    /// The combiner: the per-key SUM of two sorted bags, kept sorted and count-positive.
    /// Commutative, associative, empty-bag identity — but NOT idempotent. Uses this bag's comparer;
    /// the summed count is <c>checked</c> against int64 overflow.
    /// </summary>
    /// <param name="other">The bag to merge with.</param>
    /// <returns>The per-key sum, in canonical order.</returns>
    public Bag<T> Union(Bag<T> other)
    {
        ArgumentNullException.ThrowIfNull(other);

        // The comparer is part of a bag's identity: two bags with different comparers are not
        // union-compatible (silently recanonicalizing would break commutativity). Same comparer
        // ⇒ both runs are sorted alike ⇒ linear merge. (Mirrors GSet.Union, PR review 2026-06-01.)
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
        var builder = ImmutableArray.CreateBuilder<BagEntry<T>>(a.Length + b.Length);
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
                builder.Add(new BagEntry<T>(a[i].Key, checked(a[i].Count + b[j].Count))); // same key → counts add
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

        return new Bag<T>(builder.ToImmutable(), _comparer, CollationName);
    }

    /// <summary>
    /// The additive-monoid identity (generic-math <see cref="IAdditiveIdentity{TSelf, TResult}"/>):
    /// the empty bag (default comparer), cached so it allocates once per closed generic type (the
    /// empty bag is immutable). Bag is an additive, commutative monoid (identity + associative
    /// per-key-sum <see cref="Union"/>, NO inverse) — and, unlike a G-Set, NOT idempotent
    /// (<c>a + a</c> doubles counts) — so it surfaces only
    /// <see cref="IAdditiveIdentity{TSelf, TResult}"/> + <see cref="IAdditionOperators{TSelf, TOther, TResult}"/>,
    /// never <c>INumber</c> (the abelian-group step is the Z-set, where retraction is the inverse).
    /// </summary>
    [SuppressMessage(
        "Design",
        "CA1000:Do not declare static members on generic types",
        Justification = "IAdditiveIdentity<TSelf,TResult> requires a static AdditiveIdentity member on the generic type; CA1000 predates static-abstract interface members (IWSAM) and does not apply to generic-math interface implementations.")]
    public static Bag<T> AdditiveIdentity { get; } = Bag.Empty<T>();

    /// <summary>
    /// The additive operator (generic-math <c>+</c>): the per-key SUM <see cref="Union"/> merge.
    /// The empty bag acts as a comparer-agnostic identity (<c>empty + x = x</c>, <c>x + empty = x</c>)
    /// so <see cref="AdditiveIdentity"/> composes with a bag under any comparer; two NON-empty
    /// operands still delegate to <see cref="Union"/>, which enforces the comparer-identity match.
    /// </summary>
    /// <param name="left">The left bag.</param>
    /// <param name="right">The right bag.</param>
    /// <returns>The per-key sum, in canonical order.</returns>
    public static Bag<T> operator +(Bag<T> left, Bag<T> right)
    {
        ArgumentNullException.ThrowIfNull(left);
        ArgumentNullException.ThrowIfNull(right);

        // The additive identity is the empty bag; it must absorb under ANY comparer for the
        // monoid identity law to hold (AdditiveIdentity uses the default comparer, but a bag
        // may carry a custom one). Empty has no entries, so its ordering is irrelevant —
        // short-circuit before Union's deliberate same-comparer check (guards non-empty merges).
        if (left.IsEmpty)
        {
            return right;
        }

        if (right.IsEmpty)
        {
            return left;
        }

        return left.Union(right);
    }

    /// <summary>Increment <paramref name="x"/>'s count by 1 (<see cref="Union"/> with a singleton). NOT idempotent.</summary>
    /// <param name="x">The key to increment.</param>
    /// <returns>The bag with <paramref name="x"/>'s count raised by 1.</returns>
    public Bag<T> Add(T x) =>
        Union(new Bag<T>(ImmutableArray.Create(new BagEntry<T>(x, 1L)), _comparer, CollationName));

    /// <summary>Increment <paramref name="x"/>'s count by <paramref name="n"/>; <paramref name="n"/> &lt;= 0 is a no-op (grow-only over ℕ).</summary>
    /// <param name="x">The key to increment.</param>
    /// <param name="n">The amount to add (no-op if &lt;= 0).</param>
    /// <returns>The bag with <paramref name="x"/>'s count raised by <paramref name="n"/> (or unchanged).</returns>
    public Bag<T> AddN(T x, long n) =>
        n > 0 ? Union(new Bag<T>(ImmutableArray.Create(new BagEntry<T>(x, n)), _comparer, CollationName)) : this;

    /// <summary>Throw if <paramref name="other"/> uses a different comparer (the comparer is part of the bag's identity).</summary>
    /// <param name="other">The bag being combined.</param>
    private void RequireSameComparer(Bag<T> other)
    {
        var sameCollation = !string.Equals(CollationName, "custom", StringComparison.Ordinal) &&
                            string.Equals(CollationName, other.CollationName, StringComparison.Ordinal);

        if (!sameCollation && !_comparer.Equals(other._comparer))
        {
            throw new ArgumentException(
                $"Bag.Union requires both bags to use the same collation name or equivalent comparer (this: '{CollationName}', other: '{other.CollationName}').",
                nameof(other));
        }
    }

    /// <summary>The canonical (ascending-key) entries as an immutable array.</summary>
    /// <returns>The canonical run.</returns>
    public ImmutableArray<BagEntry<T>> ToImmutableArray() => _items;

    /// <summary>The canonical (ascending-key) entries as a new array.</summary>
    /// <returns>A fresh array of the entries in canonical order.</returns>
    public BagEntry<T>[] ToArray() => _items.AsSpan().ToArray();

    /// <summary>
    /// Value equality: same entries (key + count) in canonical order, with keys compared under
    /// the comparer. Because both bags are canonical, this is bag equality.
    /// </summary>
    /// <param name="other">The bag to compare.</param>
    /// <returns><see langword="true"/> iff the bags hold the same keys at the same counts.</returns>
    public bool Equals(Bag<T>? other)
    {
        if (other is null)
        {
            return false;
        }

        if (ReferenceEquals(this, other))
        {
            return true;
        }

        var sameCollation = !string.Equals(CollationName, "custom", StringComparison.Ordinal) &&
                            string.Equals(CollationName, other.CollationName, StringComparison.Ordinal);

        if (!sameCollation && !_comparer.Equals(other._comparer))
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
                || _items[k].Count != other._items[k].Count)
            {
                return false;
            }
        }

        return true;
    }

    /// <inheritdoc/>
    public override bool Equals(object? obj) => Equals(obj as Bag<T>);

    /// <inheritdoc/>
    public override int GetHashCode()
    {
        // Consistent with Equals (comparer is part of identity): hash the comparer + the entries.
        // When the comparer is also an equality comparer (e.g. StringComparer.Ordinal) hash each
        // key through it so Compare==0 keys hash alike; always fold the count. (Mirrors GSet.)
        var hash = default(HashCode);
        hash.Add(CollationName, StringComparer.Ordinal);
        hash.Add(_comparer);
        hash.Add(_items.Length);
        var eq = _comparer as IEqualityComparer<T>;
        foreach (var e in _items)
        {
            if (eq is not null)
            {
                hash.Add(e.Key, eq);
            }

            hash.Add(e.Count);
        }

        return hash.ToHashCode();
    }
}
