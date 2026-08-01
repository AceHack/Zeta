// G-Set — grow-only set CRDT (bottom rung of the algebra ladder: G-Set ⊂ Bag ⊂ Z-set).
// C# parity oracle; mirrors src/Core/GSet.fs, src/Core.TypeScript/g-set, and
// src/Core.Rust.Algebra/src/gset.rs. Lives in the C# core next to the Z-set binding
// (ZetaCircuitBuilder), mirroring how F# keeps GSet.fs in src/Core/.

using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Diagnostics.CodeAnalysis;
using System.Numerics;

namespace Zeta.Core.CSharp;

/// <summary>
/// Factory methods for <see cref="GSet{T}"/>. A non-generic companion class (the .NET
/// convention, e.g. <see cref="ImmutableArray"/> vs <see cref="ImmutableArray{T}"/>) so
/// the constructors stay static-member-free on the generic type (CA1000).
/// </summary>
public static class GSet
{
    /// <summary>The empty G-Set (the <see cref="GSet{T}.Union"/> identity) with a named collation.</summary>
    /// <typeparam name="T">The element type.</typeparam>
    /// <param name="collation">The named collation to use.</param>
    /// <returns>An empty set.</returns>
    public static GSet<T> Empty<T>(string collation) =>
        new(ImmutableArray<T>.Empty, Collation.ForKey<T>(collation), collation);

    /// <summary>The empty G-Set (the <see cref="GSet{T}.Union"/> identity).</summary>
    /// <typeparam name="T">The element type.</typeparam>
    /// <param name="comparer">Order on <typeparamref name="T"/>; defaults to default collation.</param>
    /// <returns>An empty set.</returns>
    public static GSet<T> Empty<T>(IComparer<T>? comparer = null) =>
        new(ImmutableArray<T>.Empty, comparer ?? Collation.ForKey<T>(), comparer == null ? Collation.DefaultName : "custom");

    /// <summary>The empty G-Set with a custom comparer and collation name.</summary>
    /// <typeparam name="T">The element type.</typeparam>
    /// <param name="comparer">Order on <typeparamref name="T"/>.</param>
    /// <param name="collation">The name of the collation.</param>
    /// <returns>An empty set.</returns>
    public static GSet<T> Empty<T>(IComparer<T> comparer, string collation) =>
        new(ImmutableArray<T>.Empty, comparer ?? Collation.ForKey<T>(), collation);

    /// <summary>A one-element G-Set with a named collation.</summary>
    /// <typeparam name="T">The element type.</typeparam>
    /// <param name="x">The single element.</param>
    /// <param name="collation">The named collation to use.</param>
    /// <returns>A set containing exactly <paramref name="x"/>.</returns>
    public static GSet<T> Singleton<T>(T x, string collation) =>
        new(ImmutableArray.Create(x), Collation.ForKey<T>(collation), collation);

    /// <summary>A one-element G-Set.</summary>
    /// <typeparam name="T">The element type.</typeparam>
    /// <param name="x">The single element.</param>
    /// <param name="comparer">Order on <typeparamref name="T"/>; defaults to default collation.</param>
    /// <returns>A set containing exactly <paramref name="x"/>.</returns>
    public static GSet<T> Singleton<T>(T x, IComparer<T>? comparer = null) =>
        new(ImmutableArray.Create(x), comparer ?? Collation.ForKey<T>(), comparer == null ? Collation.DefaultName : "custom");

    /// <summary>A one-element G-Set with a custom comparer and collation name.</summary>
    /// <typeparam name="T">The element type.</typeparam>
    /// <param name="x">The single element.</param>
    /// <param name="comparer">Order on <typeparamref name="T"/>.</param>
    /// <param name="collation">The name of the collation.</param>
    /// <returns>A set containing exactly <paramref name="x"/>.</returns>
    public static GSet<T> Singleton<T>(T x, IComparer<T> comparer, string collation) =>
        new(ImmutableArray.Create(x), comparer ?? Collation.ForKey<T>(), collation);

    /// <summary>Canonicalize arbitrary input with a named collation.</summary>
    /// <typeparam name="T">The element type.</typeparam>
    /// <param name="xs">The elements.</param>
    /// <param name="collation">The named collation to use.</param>
    /// <returns>The canonical G-Set of the distinct elements.</returns>
    public static GSet<T> OfSeq<T>(IEnumerable<T> xs, string collation)
    {
        var cmp = Collation.ForKey<T>(collation);
        return new GSet<T>(Canonicalize(xs, cmp), cmp, collation);
    }

    /// <summary>Canonicalize arbitrary input.</summary>
    /// <typeparam name="T">The element type.</typeparam>
    /// <param name="xs">The elements.</param>
    /// <param name="comparer">Order on <typeparamref name="T"/>; defaults to default collation.</param>
    /// <returns>The canonical G-Set of the distinct elements.</returns>
    public static GSet<T> OfSeq<T>(IEnumerable<T> xs, IComparer<T>? comparer = null)
    {
        var cmp = comparer ?? Collation.ForKey<T>();
        return new GSet<T>(Canonicalize(xs, cmp), cmp, comparer == null ? Collation.DefaultName : "custom");
    }

    /// <summary>Canonicalize arbitrary input with a custom comparer and collation name.</summary>
    /// <typeparam name="T">The element type.</typeparam>
    /// <param name="xs">The elements.</param>
    /// <param name="comparer">Order on <typeparamref name="T"/>.</param>
    /// <param name="collation">The name of the collation.</param>
    /// <returns>The canonical G-Set of the distinct elements.</returns>
    public static GSet<T> OfSeq<T>(IEnumerable<T> xs, IComparer<T> comparer, string collation)
    {
        var cmp = comparer ?? Collation.ForKey<T>();
        return new GSet<T>(Canonicalize(xs, cmp), cmp, collation);
    }

    /// <summary>Sort ascending + drop duplicates under <paramref name="cmp"/> (the canonical run).</summary>
    /// <typeparam name="T">The element type.</typeparam>
    /// <param name="xs">The elements.</param>
    /// <param name="cmp">The order.</param>
    /// <returns>The canonical ascending, duplicate-free run.</returns>
    internal static ImmutableArray<T> Canonicalize<T>(IEnumerable<T> xs, IComparer<T> cmp)
    {
        var sorted = new List<T>(xs);
        sorted.Sort(cmp);
        var builder = ImmutableArray.CreateBuilder<T>(sorted.Count);
        for (var k = 0; k < sorted.Count; k++)
        {
            if (k == 0 || cmp.Compare(sorted[k - 1], sorted[k]) != 0)
            {
                builder.Add(sorted[k]);
            }
        }

        return builder.ToImmutable();
    }
}

/// <summary>
/// A grow-only set (G-Set CRDT): a canonical ascending-sorted, duplicate-free run under
/// an <see cref="IComparer{T}"/>. <see cref="Union"/> is the only combiner and is
/// idempotent, commutative, and associative (the three CRDT convergence laws), so
/// replicas that have seen the same elements — in any order — converge with no
/// coordination. Parity with <c>src/Core/GSet.fs</c>, <c>src/Core.TypeScript/g-set</c>,
/// and <c>src/Core.Rust.Algebra/src/gset.rs</c>. Construct via <see cref="GSet"/>.
/// </summary>
/// <remarks>
/// The comparer is explicit (like the TS <c>compare</c> parameter) rather than baked to
/// <see cref="Comparer{T}.Default"/>: for <see cref="string"/> the default is
/// culture-sensitive, but the cross-language wire needs the project binary collation
/// (Unicode code-point / UTF-8 byte order). Pass it explicitly for cross-language parity.
/// </remarks>
/// <typeparam name="T">The element type.</typeparam>
public sealed class GSet<T> :
    IEquatable<GSet<T>>,
    IAdditiveIdentity<GSet<T>, GSet<T>>,
    IAdditionOperators<GSet<T>, GSet<T>, GSet<T>>
{
    private readonly ImmutableArray<T> _items;
    private readonly IComparer<T> _comparer;

    /// <summary>Gets the name of the collation used by this set.</summary>
    public string CollationName { get; }

    internal GSet(ImmutableArray<T> items, IComparer<T> comparer, string collationName)
    {
        _items = items.IsDefault ? ImmutableArray<T>.Empty : items;
        _comparer = comparer;
        CollationName = collationName;
    }

    /// <summary>The number of elements.</summary>
    public int Count => _items.Length;

    /// <summary>Whether the set is empty.</summary>
    public bool IsEmpty => _items.IsEmpty;

    /// <summary>Membership via binary search on the sorted run. O(log n).</summary>
    /// <param name="x">The element to test.</param>
    /// <returns><see langword="true"/> iff <paramref name="x"/> is present.</returns>
    public bool Contains(T x)
    {
        int lo = 0, hi = _items.Length - 1;
        while (lo <= hi)
        {
            var mid = lo + ((hi - lo) >> 1);
            var c = _comparer.Compare(_items[mid], x);
            if (c == 0)
            {
                return true;
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

        return false;
    }

    /// <summary>
    /// The CRDT merge: the union of two sorted-unique runs, kept sorted-unique.
    /// Idempotent, commutative, associative. Uses this set's comparer.
    /// </summary>
    /// <param name="other">The set to merge with.</param>
    /// <returns>The union, in canonical order.</returns>
    public GSet<T> Union(GSet<T> other)
    {
        ArgumentNullException.ThrowIfNull(other);

        // The comparer is part of a set's identity: two sets with different comparers are
        // not union-compatible. Silently recanonicalizing would break commutativity
        // (a∪b under a's order ≠ b∪a under b's order), so fail fast on mismatch
        // (PR review 2026-06-01). Same comparer ⇒ both runs are sorted alike ⇒ linear merge.
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
        var builder = ImmutableArray.CreateBuilder<T>(a.Length + b.Length);
        int i = 0, j = 0;
        while (i < a.Length && j < b.Length)
        {
            var c = _comparer.Compare(a[i], b[j]);
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
                builder.Add(a[i]); // duplicate → keep one
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

        return new GSet<T>(builder.ToImmutable(), _comparer, CollationName);
    }

    /// <summary>
    /// The additive-monoid identity (generic-math <see cref="IAdditiveIdentity{TSelf, TResult}"/>):
    /// the empty set (default comparer). G-Set is an additive, commutative + idempotent monoid
    /// (identity + associative <see cref="Union"/>, NO inverse), so it surfaces only
    /// <see cref="IAdditiveIdentity{TSelf, TResult}"/> + <see cref="IAdditionOperators{TSelf, TOther, TResult}"/>
    /// — never <c>INumber</c> (no negation / order / multiplication).
    /// </summary>
    [SuppressMessage(
        "Design",
        "CA1000:Do not declare static members on generic types",
        Justification = "IAdditiveIdentity<TSelf,TResult> requires a static AdditiveIdentity member on the generic type; CA1000 predates static-abstract interface members (IWSAM) and does not apply to generic-math interface implementations.")]
    public static GSet<T> AdditiveIdentity { get; } = GSet.Empty<T>();

    /// <summary>
    /// The additive operator (generic-math <c>+</c>): the CRDT <see cref="Union"/> merge.
    /// The empty set acts as a comparer-agnostic identity (<c>empty + x = x</c>, <c>x + empty = x</c>)
    /// so <see cref="AdditiveIdentity"/> composes with a set under any comparer; two NON-empty
    /// operands still delegate to <see cref="Union"/>, which enforces the comparer-identity match.
    /// </summary>
    /// <param name="left">The left set.</param>
    /// <param name="right">The right set.</param>
    /// <returns>The union, in canonical order.</returns>
    public static GSet<T> operator +(GSet<T> left, GSet<T> right)
    {
        ArgumentNullException.ThrowIfNull(left);
        ArgumentNullException.ThrowIfNull(right);

        // The additive identity is the empty set; it must absorb under ANY comparer for the
        // monoid identity law to hold (AdditiveIdentity uses the default comparer, but a set
        // may carry a custom one). Empty has no elements, so its ordering is irrelevant —
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

    /// <summary>Add one element (<see cref="Union"/> with a singleton); idempotent if already present.</summary>
    /// <param name="x">The element to add.</param>
    /// <returns>The set with <paramref name="x"/> present.</returns>
    public GSet<T> Add(T x) =>
        Contains(x) ? this : Union(new GSet<T>(ImmutableArray.Create(x), _comparer, CollationName));

    private void RequireSameComparer(GSet<T> other)
    {
        var sameCollation = !string.Equals(CollationName, "custom", StringComparison.Ordinal) &&
                            string.Equals(CollationName, other.CollationName, StringComparison.Ordinal);

        if (!sameCollation && !_comparer.Equals(other._comparer))
        {
            throw new ArgumentException(
                $"GSet.Union requires both sets to use the same collation name or equivalent comparer (this: '{CollationName}', other: '{other.CollationName}').",
                nameof(other));
        }
    }

    /// <summary>The canonical (ascending) elements as an immutable array.</summary>
    /// <returns>The canonical run.</returns>
    public ImmutableArray<T> ToImmutableArray() => _items;

    /// <summary>The canonical (ascending) elements as a new array.</summary>
    /// <returns>A fresh array of the elements in canonical order.</returns>
    public T[] ToArray() => _items.AsSpan().ToArray();

    /// <summary>
    /// Value equality: same elements in canonical order (element-wise under the
    /// comparer). Because both sets are canonical, this is set equality.
    /// </summary>
    /// <param name="other">The set to compare.</param>
    /// <returns><see langword="true"/> iff the sets hold the same elements.</returns>
    public bool Equals(GSet<T>? other)
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
            if (_comparer.Compare(_items[k], other._items[k]) != 0)
            {
                return false;
            }
        }

        return true;
    }

    /// <inheritdoc/>
    public override bool Equals(object? obj) => Equals(obj as GSet<T>);

    /// <inheritdoc/>
    public override int GetHashCode()
    {
        // Consistent with Equals (which includes the comparer in identity): hash the
        // comparer + the elements. When the comparer is also an equality comparer (e.g.
        // StringComparer.Ordinal) hash each element through it so Compare==0 values hash
        // alike; otherwise count-only for the element part (still consistent with the
        // comparer-based Equals). (PR review 2026-06-01.)
        var hash = default(HashCode);
        hash.Add(CollationName, StringComparer.Ordinal);
        hash.Add(_comparer);
        hash.Add(_items.Length);
        if (_comparer is IEqualityComparer<T> eq)
        {
            foreach (var x in _items)
            {
                hash.Add(x, eq);
            }
        }

        return hash.ToHashCode();
    }
}
