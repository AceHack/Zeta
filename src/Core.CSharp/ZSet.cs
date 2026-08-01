// ZSet — signed-weight multiset (TOP rung of the algebra ladder: G-Set ⊂ Bag ⊂ Z-set).
// C# native parity oracle; mirrors src/Core.TypeScript/z-set, the F# engine src/Core/ZSet.fs, and
// the Rust twin (src/Core.Rust.Algebra/src/zset.rs). Native ladder oracle next to GSet.cs / Bag.cs;
// distinct from the DBSP Z-set binding (ZetaCircuitBuilder) — this is the cross-language treaty impl.

using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Numerics;

namespace Zeta.Core.CSharp;

/// <summary>
/// Factory methods for <see cref="ZSet{T}"/>. A non-generic companion class (the .NET convention,
/// e.g. <see cref="ImmutableArray"/> vs <see cref="ImmutableArray{T}"/>) so the constructors stay
/// static-member-free on the generic type (CA1000).
/// </summary>
public static class ZSet
{
    /// <summary>The empty Z-set (the <see cref="ZSet{T}.Union"/> identity) with a named collation.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="collation">The named collation to use.</param>
    /// <returns>An empty Z-set.</returns>
    public static ZSet<T> Empty<T>(string collation) =>
        new(ImmutableArray<ZSetEntry<T>>.Empty, Collation.ForKey<T>(collation), collation);

    /// <summary>The empty Z-set (the <see cref="ZSet{T}.Union"/> identity).</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="comparer">Order on <typeparamref name="T"/>; defaults to default collation.</param>
    /// <returns>An empty Z-set.</returns>
    public static ZSet<T> Empty<T>(IComparer<T>? comparer = null) =>
        new(ImmutableArray<ZSetEntry<T>>.Empty, comparer ?? Collation.ForKey<T>(), comparer == null ? Collation.DefaultName : "custom");

    /// <summary>The empty Z-set with a custom comparer and collation name.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="comparer">Order on <typeparamref name="T"/>.</param>
    /// <param name="collation">The name of the collation.</param>
    /// <returns>An empty Z-set.</returns>
    public static ZSet<T> Empty<T>(IComparer<T> comparer, string collation) =>
        new(ImmutableArray<ZSetEntry<T>>.Empty, comparer ?? Collation.ForKey<T>(), collation);

    /// <summary>A one-key Z-set at weight <paramref name="w"/>; <paramref name="w"/> == 0 yields the empty Z-set with a named collation.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="x">The single key.</param>
    /// <param name="w">The signed weight (a no-op if 0).</param>
    /// <param name="collation">The named collation to use.</param>
    /// <returns>A Z-set containing exactly <paramref name="x"/> at weight <paramref name="w"/> (or empty).</returns>
    public static ZSet<T> Singleton<T>(T x, long w = 1, string collation = Collation.DefaultName)
    {
        var cmp = Collation.ForKey<T>(collation);
        return w != 0
            ? new ZSet<T>(ImmutableArray.Create(new ZSetEntry<T>(x, w)), cmp, collation)
            : new ZSet<T>(ImmutableArray<ZSetEntry<T>>.Empty, cmp, collation);
    }

    /// <summary>A one-key Z-set with a custom comparer and collation name.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="x">The single key.</param>
    /// <param name="w">The signed weight (a no-op if 0).</param>
    /// <param name="comparer">Order on <typeparamref name="T"/>.</param>
    /// <param name="collation">The name of the collation.</param>
    /// <returns>A Z-set containing exactly <paramref name="x"/> at weight <paramref name="w"/> (or empty).</returns>
    public static ZSet<T> Singleton<T>(T x, long w, IComparer<T> comparer, string collation = "custom")
    {
        var cmp = comparer ?? Collation.ForKey<T>();
        return w != 0
            ? new ZSet<T>(ImmutableArray.Create(new ZSetEntry<T>(x, w)), cmp, collation)
            : new ZSet<T>(ImmutableArray<ZSetEntry<T>>.Empty, cmp, collation);
    }

    /// <summary>Canonicalize arbitrary entries with a named collation.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="entries">The entries.</param>
    /// <param name="collation">The named collation to use.</param>
    /// <returns>The canonical Z-set.</returns>
    public static ZSet<T> OfEntries<T>(IEnumerable<(T Key, long Weight)> entries, string collation)
    {
        var cmp = Collation.ForKey<T>(collation);
        return new ZSet<T>(Canonicalize(entries, cmp), cmp, collation);
    }

    /// <summary>Canonicalize arbitrary entries.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="entries">The entries.</param>
    /// <param name="comparer">Order on the key; defaults to default collation.</param>
    /// <returns>The canonical Z-set.</returns>
    public static ZSet<T> OfEntries<T>(IEnumerable<(T Key, long Weight)> entries, IComparer<T>? comparer = null)
    {
        var cmp = comparer ?? Collation.ForKey<T>();
        return new ZSet<T>(Canonicalize(entries, cmp), cmp, comparer == null ? Collation.DefaultName : "custom");
    }

    /// <summary>Canonicalize arbitrary entries with a custom comparer and collation name.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="entries">The entries.</param>
    /// <param name="comparer">Order on the key.</param>
    /// <param name="collation">The name of the collation.</param>
    /// <returns>The canonical Z-set.</returns>
    public static ZSet<T> OfEntries<T>(IEnumerable<(T Key, long Weight)> entries, IComparer<T> comparer, string collation)
    {
        var cmp = comparer ?? Collation.ForKey<T>();
        return new ZSet<T>(Canonicalize(entries, cmp), cmp, collation);
    }

    /// <summary>Build a Z-set by counting occurrences in a sequence with a named collation.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="xs">The keys.</param>
    /// <param name="collation">The named collation to use.</param>
    /// <returns>The canonical Z-set of occurrence weights.</returns>
    public static ZSet<T> OfSeq<T>(IEnumerable<T> xs, string collation)
    {
        ArgumentNullException.ThrowIfNull(xs);
        var cmp = Collation.ForKey<T>(collation);
        var entries = xs.Select(x => (x, 1L));
        return new ZSet<T>(Canonicalize(entries, cmp), cmp, collation);
    }

    /// <summary>Build a Z-set by counting occurrences in a sequence.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="xs">The keys.</param>
    /// <param name="comparer">Order on the key; defaults to default collation.</param>
    /// <returns>The canonical Z-set of occurrence weights.</returns>
    public static ZSet<T> OfSeq<T>(IEnumerable<T> xs, IComparer<T>? comparer = null)
    {
        ArgumentNullException.ThrowIfNull(xs);
        var cmp = comparer ?? Collation.ForKey<T>();
        var entries = xs.Select(x => (x, 1L));
        return new ZSet<T>(Canonicalize(entries, cmp), cmp, comparer == null ? Collation.DefaultName : "custom");
    }

    /// <summary>Build a Z-set by counting occurrences in a sequence with a custom comparer and collation name.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="xs">The keys.</param>
    /// <param name="comparer">Order on the key.</param>
    /// <param name="collation">The name of the collation.</param>
    /// <returns>The canonical Z-set of occurrence weights.</returns>
    public static ZSet<T> OfSeq<T>(IEnumerable<T> xs, IComparer<T> comparer, string collation)
    {
        ArgumentNullException.ThrowIfNull(xs);
        var cmp = comparer ?? Collation.ForKey<T>();
        var entries = xs.Select(x => (x, 1L));
        return new ZSet<T>(Canonicalize(entries, cmp), cmp, collation);
    }

    /// <summary>Build a Z-set by counting occurrences in an array with a named collation.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="xs">The keys.</param>
    /// <param name="collation">The named collation to use.</param>
    /// <returns>The canonical Z-set of occurrence weights.</returns>
    public static ZSet<T> OfArray<T>(T[] xs, string collation) => OfSeq(xs, collation);

    /// <summary>Build a Z-set by counting occurrences in an array.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="xs">The keys.</param>
    /// <param name="comparer">Order on the key; defaults to default collation.</param>
    /// <returns>The canonical Z-set of occurrence weights.</returns>
    public static ZSet<T> OfArray<T>(T[] xs, IComparer<T>? comparer = null) => OfSeq(xs, comparer);

    /// <summary>Build a Z-set by counting occurrences in an array with a custom comparer and collation name.</summary>
    /// <typeparam name="T">The key type.</typeparam>
    /// <param name="xs">The keys.</param>
    /// <param name="comparer">Order on the key.</param>
    /// <param name="collation">The name of the collation.</param>
    /// <returns>The canonical Z-set of occurrence weights.</returns>
    public static ZSet<T> OfArray<T>(T[] xs, IComparer<T> comparer, string collation) => OfSeq(xs, comparer, collation);

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
public sealed class ZSet<T> :
    IEquatable<ZSet<T>>,
    IAdditiveIdentity<ZSet<T>, ZSet<T>>,
    IAdditionOperators<ZSet<T>, ZSet<T>, ZSet<T>>,
    ISubtractionOperators<ZSet<T>, ZSet<T>, ZSet<T>>,
    IUnaryNegationOperators<ZSet<T>, ZSet<T>>
{
    private readonly ImmutableArray<ZSetEntry<T>> _items;
    private readonly IComparer<T> _comparer;

    /// <summary>Gets the name of the collation used by this Z-set.</summary>
    public string CollationName { get; }

    internal ZSet(ImmutableArray<ZSetEntry<T>> items, IComparer<T> comparer, string collationName)
    {
        _items = items.IsDefault ? ImmutableArray<ZSetEntry<T>>.Empty : items;
        _comparer = comparer;
        CollationName = collationName;
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

        return new ZSet<T>(builder.ToImmutable(), _comparer, CollationName);
    }

    /// <summary>Increment <paramref name="x"/>'s weight by 1 (<see cref="Union"/> with a singleton). NOT idempotent.</summary>
    /// <param name="x">The key to increment.</param>
    /// <returns>The Z-set with <paramref name="x"/>'s weight raised by 1.</returns>
    public ZSet<T> Add(T x) =>
        Union(new ZSet<T>(ImmutableArray.Create(new ZSetEntry<T>(x, 1L)), _comparer, CollationName));

    /// <summary>Add signed weight <paramref name="w"/> to <paramref name="x"/>; <paramref name="w"/> == 0 is a no-op, and a key driven to net 0 is retracted.</summary>
    /// <param name="x">The key to adjust.</param>
    /// <param name="w">The signed weight to add (may be negative; no-op if 0).</param>
    /// <returns>The Z-set with <paramref name="x"/>'s weight adjusted by <paramref name="w"/>.</returns>
    public ZSet<T> AddW(T x, long w) =>
        w != 0 ? Union(new ZSet<T>(ImmutableArray.Create(new ZSetEntry<T>(x, w)), _comparer, CollationName)) : this;

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

        return new ZSet<T>(builder.ToImmutable(), _comparer, CollationName);
    }

    // ─── generic-math abelian-group surface (System.Numerics IWSAM) ──────────
    // "numerics like dotnet as our interface, push to other langs if they don't
    // have" (Aaron 2026-06-01). The dotnet-native form: Z-set IS-A
    // IAdditiveIdentity + IAdditionOperators (monoid) + ISubtractionOperators +
    // IUnaryNegationOperators (the abelian-group inverse). NOT INumber (no total
    // order; the ring scalar is per-element, not a numeric product). Mirrors the
    // F# `Zero`/`(+)`/`(~-)`/`(-)` rung and the GSet/Bag IWSAM twins.

    /// <summary>
    /// The additive identity (empty Z-set): <c>a + AdditiveIdentity == a</c>. Cached, comparer-agnostic
    /// (built with <see cref="Comparer{T}.Default"/>); the <c>operator +</c>/<c>operator -</c> empty
    /// short-circuits keep the identity law holding for Z-sets built with any comparer.
    /// </summary>
    [SuppressMessage(
        "Design",
        "CA1000:Do not declare static members on generic types",
        Justification = "IWSAM (IAdditiveIdentity) requires the static member on the generic type itself; CA1000 predates static abstract interface members.")]
    public static ZSet<T> AdditiveIdentity { get; } = ZSet.Empty<T>();

    /// <summary>
    /// <c>a + b</c> — per-key signed sum (the abelian-group operation; delegates to <see cref="Union"/>).
    /// Empty is short-circuited as a comparer-agnostic identity BEFORE <see cref="Union"/>'s
    /// same-comparer check, so <c>a + Zero == a</c> and <c>Zero + a == a</c> hold for any comparer; two
    /// NON-empty Z-sets with mismatched comparers still fail fast (the comparer is part of identity).
    /// NOT idempotent — <c>a + a</c> doubles every weight.
    /// </summary>
    /// <param name="left">The left Z-set.</param>
    /// <param name="right">The right Z-set.</param>
    /// <returns>The per-key sum.</returns>
    public static ZSet<T> operator +(ZSet<T> left, ZSet<T> right)
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

        return left.Union(right);
    }

    /// <summary>
    /// <c>-a</c> — the abelian-group inverse (flip every sign; delegates to <see cref="Negate"/>), so
    /// <c>a + (-a) == AdditiveIdentity</c> (the law a Bag cannot satisfy).
    /// </summary>
    /// <param name="value">The Z-set to negate.</param>
    /// <returns>The Z-set with every weight sign-flipped.</returns>
    public static ZSet<T> operator -(ZSet<T> value)
    {
        ArgumentNullException.ThrowIfNull(value);
        return value.Negate();
    }

    /// <summary>
    /// <c>a - b == a + (-b)</c> — retraction expressed directly. Empty is short-circuited as a
    /// comparer-agnostic identity (<c>a - Zero == a</c>, <c>Zero - b == -b</c>) before the same-comparer
    /// check, matching <c>operator +</c>.
    /// </summary>
    /// <param name="left">The minuend.</param>
    /// <param name="right">The subtrahend.</param>
    /// <returns><c>left + (-right)</c>.</returns>
    public static ZSet<T> operator -(ZSet<T> left, ZSet<T> right)
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

        return left.Union(right.Negate());
    }

    /// <summary>Throw if <paramref name="other"/> uses a different comparer (the comparer is part of the Z-set's identity).</summary>
    /// <param name="other">The Z-set being combined.</param>
    private void RequireSameComparer(ZSet<T> other)
    {
        var sameCollation = !string.Equals(CollationName, "custom", StringComparison.Ordinal) &&
                            string.Equals(CollationName, other.CollationName, StringComparison.Ordinal);

        if (!sameCollation && !_comparer.Equals(other._comparer))
        {
            throw new ArgumentException(
                $"ZSet.Union requires both Z-sets to use the same collation name or equivalent comparer (this: '{CollationName}', other: '{other.CollationName}').",
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

            hash.Add(e.Weight);
        }

        return hash.ToHashCode();
    }
}
