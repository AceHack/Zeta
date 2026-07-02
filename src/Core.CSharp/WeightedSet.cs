using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using Zeta.Core.Abstractions;

namespace Zeta.Core.CSharp;

/// <summary>
/// Semiring-generic sparse tensor — coordinate (<typeparamref name="TK"/>) → weight (<typeparamref name="TW"/> in an <see cref="ISemiring{T}"/>).
/// The C# implementation matching the F# canonical shape in <c>WeightedSet.fs</c>.
/// </summary>
/// <typeparam name="TK">The coordinate type.</typeparam>
/// <typeparam name="TW">The weight type.</typeparam>
public sealed class WeightedSet<TK, TW> : ITensor<TK, TW>
    where TK : notnull, IComparable<TK>
    where TW : notnull
{
    private readonly ImmutableSortedDictionary<TK, TW> _entries;

    /// <summary>
    /// The empty (all-Zero) sparse tensor.
    /// </summary>
    public static readonly WeightedSet<TK, TW> Empty = new(ImmutableSortedDictionary<TK, TW>.Empty);

    internal WeightedSet(ImmutableSortedDictionary<TK, TW> entries)
    {
        ArgumentNullException.ThrowIfNull(entries);
        _entries = entries;
    }

    /// <summary>
    /// Number of explicitly-stored entries in the support.
    /// </summary>
    public long StoredCount => _entries.Count;

    /// <summary>
    /// Always true as this is a sparse representation.
    /// </summary>
    public bool IsSparse => true;

    /// <summary>
    /// The explicitly-stored entries in ordinal order of coordinates.
    /// </summary>
    public IEnumerable<KeyValuePair<TK, TW>> StoredEntries => _entries;

    /// <summary>
    /// Gets a value indicating whether the tensor is empty.
    /// </summary>
    public bool IsEmpty => _entries.IsEmpty;

    /// <summary>
    /// Gets the number of non-zero entries in the tensor.
    /// </summary>
    public int Count => _entries.Count;

    /// <summary>
    /// Weight at a coordinate (semiring Zero if the coordinate is absent).
    /// </summary>
    /// <param name="sr">The semiring algebra.</param>
    /// <param name="key">The coordinate key.</param>
    /// <returns>The weight at the specified coordinate.</returns>
    public TW GetWeight(ISemiring<TW> sr, TK key)
    {
        ArgumentNullException.ThrowIfNull(sr);
        return _entries.TryGetValue(key, out var val) ? val : sr.Zero;
    }

    /// <summary>
    /// The nonzero coordinates (the support), ordinal-ordered.
    /// </summary>
    public IReadOnlyList<TK> Support => _entries.Keys.ToList();

    /// <summary>
    /// Union of two tensors; shared coordinates combine via Add, and Zero results are pruned.
    /// </summary>
    /// <param name="sr">The semiring algebra.</param>
    /// <param name="other">The other tensor.</param>
    /// <returns>A new combined tensor.</returns>
    public WeightedSet<TK, TW> Add(ISemiring<TW> sr, WeightedSet<TK, TW> other)
    {
        ArgumentNullException.ThrowIfNull(sr);
        ArgumentNullException.ThrowIfNull(other);

        if (this.IsEmpty) return other;
        if (other.IsEmpty) return this;

        var builder = _entries.ToBuilder();
        foreach (var kv in other._entries)
        {
            var k = kv.Key;
            var w = kv.Value;
            var cur = builder.TryGetValue(k, out var c) ? c : sr.Zero;
            var sum = sr.Add(cur, w);
            if (EqualityComparer<TW>.Default.Equals(sum, sr.Zero))
            {
                builder.Remove(k);
            }
            else
            {
                builder[k] = sum;
            }
        }
        return new WeightedSet<TK, TW>(builder.ToImmutable());
    }

    /// <summary>
    /// Negates every weight (additive inverse).
    /// </summary>
    /// <param name="sr">The ring algebra (additive inverse required — 081KWG9JQ9H).</param>
    /// <returns>A new negated tensor.</returns>
    public WeightedSet<TK, TW> Negate(IRing<TW> sr)
    {
        ArgumentNullException.ThrowIfNull(sr);
        if (this.IsEmpty) return this;

        var builder = ImmutableSortedDictionary.CreateBuilder<TK, TW>();
        foreach (var kv in _entries)
        {
            builder.Add(kv.Key, sr.Negate(kv.Value));
        }
        return new WeightedSet<TK, TW>(builder.ToImmutable());
    }

    /// <summary>
    /// Subtracts another tensor from the current one.
    /// </summary>
    /// <param name="sr">The ring algebra (additive inverse required — 081KWG9JQ9H).</param>
    /// <param name="other">The other tensor to subtract.</param>
    /// <returns>A new tensor representing the difference.</returns>
    public WeightedSet<TK, TW> Subtract(IRing<TW> sr, WeightedSet<TK, TW> other)
    {
        ArgumentNullException.ThrowIfNull(sr);
        ArgumentNullException.ThrowIfNull(other);
        return this.Add(sr, other.Negate(sr));
    }

    /// <summary>
    /// Scales every weight by a scalar factor; Zero results are pruned.
    /// </summary>
    /// <param name="sr">The semiring algebra.</param>
    /// <param name="scalar">The scalar multiplier.</param>
    /// <returns>A new scaled tensor.</returns>
    public WeightedSet<TK, TW> Scale(ISemiring<TW> sr, TW scalar)
    {
        ArgumentNullException.ThrowIfNull(sr);
        if (this.IsEmpty) return this;

        var builder = ImmutableSortedDictionary.CreateBuilder<TK, TW>();
        foreach (var kv in _entries)
        {
            var product = sr.Mul(scalar, kv.Value);
            if (!EqualityComparer<TW>.Default.Equals(product, sr.Zero))
            {
                builder.Add(kv.Key, product);
            }
        }
        return new WeightedSet<TK, TW>(builder.ToImmutable());
    }

    /// <summary>
    /// Contraction / inner product over shared coordinates.
    /// </summary>
    /// <param name="sr">The semiring algebra.</param>
    /// <param name="other">The other tensor.</param>
    /// <returns>The inner product result.</returns>
    public TW Inner(ISemiring<TW> sr, WeightedSet<TK, TW> other)
    {
        ArgumentNullException.ThrowIfNull(sr);
        ArgumentNullException.ThrowIfNull(other);

        var acc = sr.Zero;
        if (this.IsEmpty || other.IsEmpty) return acc;

        if (this.Count <= other.Count)
        {
            foreach (var kv in _entries)
            {
                if (other._entries.TryGetValue(kv.Key, out var wb))
                {
                    acc = sr.Add(acc, sr.Mul(kv.Value, wb));
                }
            }
        }
        else
        {
            foreach (var kv in other._entries)
            {
                if (this._entries.TryGetValue(kv.Key, out var wa))
                {
                    acc = sr.Add(acc, sr.Mul(wa, kv.Value));
                }
            }
        }
        return acc;
    }

    /// <summary>
    /// Maps coordinate keys to a new key type, combining collisions and pruning zeros.
    /// </summary>
    /// <typeparam name="TK2">The new coordinate type.</typeparam>
    /// <param name="sr">The semiring algebra.</param>
    /// <param name="f">The key mapping function.</param>
    /// <returns>A new mapped tensor.</returns>
    public WeightedSet<TK2, TW> MapKeys<TK2>(ISemiring<TW> sr, Func<TK, TK2> f)
        where TK2 : notnull, IComparable<TK2>
    {
        ArgumentNullException.ThrowIfNull(sr);
        ArgumentNullException.ThrowIfNull(f);
        if (this.IsEmpty) return WeightedSet<TK2, TW>.Empty;

        return WeightedSet.OfSeq(sr, _entries.Select(kv => new KeyValuePair<TK2, TW>(f(kv.Key), kv.Value)));
    }
}

/// <summary>
/// Companion static class for <see cref="WeightedSet{TK, TW}"/> offering non-generic inference for creation and aggregation methods.
/// </summary>
public static class WeightedSet
{
    /// <summary>
    /// Builds a tensor from a sequence of key-value pairs, combining duplicate coordinates and pruning zero weights.
    /// </summary>
    /// <typeparam name="TK">The coordinate type.</typeparam>
    /// <typeparam name="TW">The weight type.</typeparam>
    /// <param name="sr">The semiring algebra.</param>
    /// <param name="pairs">The sequence of coordinate-weight pairs.</param>
    /// <returns>A new sparse tensor.</returns>
    public static WeightedSet<TK, TW> OfSeq<TK, TW>(ISemiring<TW> sr, IEnumerable<KeyValuePair<TK, TW>> pairs)
        where TK : notnull, IComparable<TK>
        where TW : notnull
    {
        ArgumentNullException.ThrowIfNull(sr);
        ArgumentNullException.ThrowIfNull(pairs);

        var builder = ImmutableSortedDictionary.CreateBuilder<TK, TW>();
        foreach (var pair in pairs)
        {
            var k = pair.Key;
            var w = pair.Value;
            var cur = builder.TryGetValue(k, out var c) ? c : sr.Zero;
            var sum = sr.Add(cur, w);
            if (EqualityComparer<TW>.Default.Equals(sum, sr.Zero))
            {
                builder.Remove(k);
            }
            else
            {
                builder[k] = sum;
            }
        }
        return new WeightedSet<TK, TW>(builder.ToImmutable());
    }

    /// <summary>
    /// Builds a tensor from a sequence of tuples, combining duplicate coordinates and pruning zero weights.
    /// </summary>
    /// <typeparam name="TK">The coordinate type.</typeparam>
    /// <typeparam name="TW">The weight type.</typeparam>
    /// <param name="sr">The semiring algebra.</param>
    /// <param name="pairs">The sequence of coordinate-weight tuples.</param>
    /// <returns>A new sparse tensor.</returns>
    public static WeightedSet<TK, TW> OfSeq<TK, TW>(ISemiring<TW> sr, IEnumerable<(TK, TW)> pairs)
        where TK : notnull, IComparable<TK>
        where TW : notnull
    {
        ArgumentNullException.ThrowIfNull(sr);
        ArgumentNullException.ThrowIfNull(pairs);
        return OfSeq(sr, pairs.Select(p => new KeyValuePair<TK, TW>(p.Item1, p.Item2)));
    }

    /// <summary>
    /// Creates a tensor containing a single active coordinate.
    /// </summary>
    /// <typeparam name="TK">The coordinate type.</typeparam>
    /// <typeparam name="TW">The weight type.</typeparam>
    /// <param name="sr">The semiring algebra.</param>
    /// <param name="key">The coordinate key.</param>
    /// <param name="weight">The weight value.</param>
    /// <returns>A new single-element sparse tensor.</returns>
    public static WeightedSet<TK, TW> Singleton<TK, TW>(ISemiring<TW> sr, TK key, TW weight)
        where TK : notnull, IComparable<TK>
        where TW : notnull
    {
        ArgumentNullException.ThrowIfNull(sr);
        if (EqualityComparer<TW>.Default.Equals(weight, sr.Zero))
        {
            return WeightedSet<TK, TW>.Empty;
        }
        return new WeightedSet<TK, TW>(ImmutableSortedDictionary<TK, TW>.Empty.Add(key, weight));
    }

    /// <summary>
    /// Sums a sequence of tensors by combining them commutatively and associatively.
    /// </summary>
    /// <typeparam name="TK">The coordinate type.</typeparam>
    /// <typeparam name="TW">The weight type.</typeparam>
    /// <param name="sr">The semiring algebra.</param>
    /// <param name="sets">The collection of tensors to sum.</param>
    /// <returns>The accumulated sum tensor.</returns>
    public static WeightedSet<TK, TW> Sum<TK, TW>(ISemiring<TW> sr, IEnumerable<WeightedSet<TK, TW>> sets)
        where TK : notnull, IComparable<TK>
        where TW : notnull
    {
        ArgumentNullException.ThrowIfNull(sr);
        ArgumentNullException.ThrowIfNull(sets);

        var acc = WeightedSet<TK, TW>.Empty;
        foreach (var set in sets)
        {
            acc = acc.Add(sr, set);
        }
        return acc;
    }
}
