// DynamicValue — the C# oracle (#3 of TS/F#/C#/Rust) for the universal self-describing-payload
// primitive. Conforms to the F# canonical shape (the F# `DynamicValue` DU + `DynamicValue` module,
// landed in PR #6492): a self-describing runtime value tree for shapes NOT known at compile time.
// The case set Null | Bool | Int | Float | String | Bytes | Array | Object is exactly the common
// self-describing core shared by CBOR / msgpack / JSON / YAML; schema-required formats join via a
// runtime schema registry (schema-id -> lookup -> current shape at runtime), producing the SAME
// runtime DynamicValue. Distinct from the static serializers (known types) and from a JSON-only
// tree (Int is split from Float; Bytes is native, not base64-in-a-string).
//
// This file is the value tree (the eight shapes + the runtime tag + structural equality). The
// accessors / navigation live on the `DynamicValues` static companion (the F# module +
// `RangeSets`/`ZSets` convention) so they test a parameter, not `this`.

using System.Collections.Immutable;

namespace Zeta.Core.CSharp;

/// <summary>
/// The format-agnostic dynamic / self-describing-payload primitive — the C# oracle conforming to
/// the F# canonical shape. A closed record hierarchy of eight shapes; <see cref="Type"/> is the
/// runtime tag (QueryInterface). The lazy-bind accessors and property-path navigation are on the
/// <see cref="DynamicValues"/> companion. Equality is structural and hand-written for the
/// collection shapes: <see cref="Bytes"/> compares CONTENTS (not the
/// <see cref="ImmutableArray{T}"/> reference); <see cref="Array"/> / <see cref="Object"/> recurse;
/// <see cref="Object"/> is order-sensitive (insertion order is preserved; the canonical wire
/// encoder PRESERVES that order when byte-locking — a key-sorting form would be lossy /
/// non-bijective for an order-significant value; see <see cref="DynamicValues.ToCanonicalJson"/>).
/// </summary>
public abstract record DynamicValue
{
    // private (not private protected): only the eight nested records can derive — no other
    // in-assembly subtype can be introduced, so the hierarchy is genuinely closed.
    private DynamicValue() { }

    /// <summary>The runtime tag — QueryInterface ("what shape are you?").</summary>
    public abstract DynamicValueType Type { get; }

    // -- the eight shapes (a closed hierarchy: only these nested records derive) --

    /// <summary>The explicit null shape.</summary>
    public sealed record Null : DynamicValue
    {
        /// <inheritdoc/>
        public override DynamicValueType Type => DynamicValueType.Null;
    }

    /// <summary>A boolean.</summary>
    /// <param name="Value">the bool.</param>
    public sealed record Bool(bool Value) : DynamicValue
    {
        /// <inheritdoc/>
        public override DynamicValueType Type => DynamicValueType.Bool;
    }

    /// <summary>A 64-bit signed integer.</summary>
    /// <param name="Value">the integer.</param>
    public sealed record Int(long Value) : DynamicValue
    {
        /// <inheritdoc/>
        public override DynamicValueType Type => DynamicValueType.Int;
    }

    /// <summary>A 64-bit IEEE-754 float.</summary>
    /// <param name="Value">the float.</param>
    public sealed record Float(double Value) : DynamicValue
    {
        /// <inheritdoc/>
        public override DynamicValueType Type => DynamicValueType.Float;
    }

    /// <summary>A UTF-16 string.</summary>
    /// <param name="Value">the string.</param>
    public sealed record String(string Value) : DynamicValue
    {
        /// <inheritdoc/>
        public override DynamicValueType Type => DynamicValueType.String;
    }

    /// <summary>A raw byte payload. Equality compares CONTENTS, not the
    /// <see cref="ImmutableArray{T}"/> reference; a default (uninitialized) array normalizes to
    /// empty.</summary>
    public sealed record Bytes : DynamicValue
    {
        /// <summary>Initializes the byte payload (a default array normalizes to empty).</summary>
        /// <param name="value">the bytes.</param>
        public Bytes(ImmutableArray<byte> value) => Value = value.IsDefault ? ImmutableArray<byte>.Empty : value;

        /// <summary>The raw bytes.</summary>
        public ImmutableArray<byte> Value { get; }

        /// <inheritdoc/>
        public override DynamicValueType Type => DynamicValueType.Bytes;

        /// <summary>Structural equality: same length and same bytes.</summary>
        /// <param name="other">the other byte payload.</param>
        public bool Equals(Bytes? other) =>
            other is not null && Value.AsSpan().SequenceEqual(other.Value.AsSpan());

        /// <inheritdoc/>
        public override int GetHashCode()
        {
            var hash = default(HashCode);
            foreach (var b in Value)
            {
                hash.Add(b);
            }

            return hash.ToHashCode();
        }
    }

    /// <summary>An ordered array of values. Equality recurses element-wise, in order; a default
    /// (uninitialized) array normalizes to empty.</summary>
    public sealed record Array : DynamicValue
    {
        /// <summary>Initializes the array (a default array normalizes to empty).</summary>
        /// <param name="items">the items, in order.</param>
        public Array(ImmutableArray<DynamicValue> items) => Items = items.IsDefault ? ImmutableArray<DynamicValue>.Empty : items;

        /// <summary>The items, in order.</summary>
        public ImmutableArray<DynamicValue> Items { get; }

        /// <inheritdoc/>
        public override DynamicValueType Type => DynamicValueType.Array;

        /// <summary>Structural equality: same length, element-wise equal in order.</summary>
        /// <param name="other">the other array.</param>
        public bool Equals(Array? other) => other is not null && Items.SequenceEqual(other.Items);

        /// <inheritdoc/>
        public override int GetHashCode()
        {
            var hash = default(HashCode);
            foreach (var item in Items)
            {
                hash.Add(item);
            }

            return hash.ToHashCode();
        }
    }

    /// <summary>An ordered key → value object. Equality is order-sensitive and recurses (the value
    /// tree preserves insertion order; the canonical wire encoder PRESERVES that order when
    /// byte-locking — key-sorting would be lossy / non-bijective); a default (uninitialized) array
    /// normalizes to empty.</summary>
    public sealed record Object : DynamicValue
    {
        /// <summary>Initializes the object (a default array normalizes to empty).</summary>
        /// <param name="pairs">the key → value pairs, in order.</param>
        public Object(ImmutableArray<KeyValuePair<string, DynamicValue>> pairs) =>
            Pairs = pairs.IsDefault ? ImmutableArray<KeyValuePair<string, DynamicValue>>.Empty : pairs;

        /// <summary>The key → value pairs, in order.</summary>
        public ImmutableArray<KeyValuePair<string, DynamicValue>> Pairs { get; }

        /// <inheritdoc/>
        public override DynamicValueType Type => DynamicValueType.Object;

        /// <summary>Structural, order-sensitive equality — explicit pairwise comparison: ordinal
        /// keys, recursive values.</summary>
        /// <param name="other">the other object.</param>
        public bool Equals(Object? other)
        {
            if (other is null || Pairs.Length != other.Pairs.Length)
            {
                return false;
            }

            for (int k = 0; k < Pairs.Length; k++)
            {
                if (!string.Equals(Pairs[k].Key, other.Pairs[k].Key, StringComparison.Ordinal)
                    || !Pairs[k].Value.Equals(other.Pairs[k].Value))
                {
                    return false;
                }
            }

            return true;
        }

        /// <inheritdoc/>
        public override int GetHashCode()
        {
            var hash = default(HashCode);
            foreach (var kv in Pairs)
            {
                hash.Add(kv.Key, StringComparer.Ordinal);
                hash.Add(kv.Value);
            }

            return hash.ToHashCode();
        }
    }
}
