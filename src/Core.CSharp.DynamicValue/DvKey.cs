using System;
using System.Buffers;
using System.Collections.Generic;

namespace Zeta.Core.CSharp;

/// <summary>
/// Content-addressed, COMPARABLE key for a <see cref="DynamicValue"/> row.
/// </summary>
public sealed class DvKey : IEquatable<DvKey>, IComparable<DvKey>, IComparable
{
    /// <summary>Gets the underlying dynamic value.</summary>
    public DynamicValue Value { get; }

    /// <summary>Gets the canonical CBOR byte representation.</summary>
    public byte[] Canonical { get; }

    private DvKey(DynamicValue value, byte[] canonical)
    {
        Value = value;
        Canonical = canonical;
    }

    /// <summary>Wrap a DynamicValue as a comparable, content-addressed row key.</summary>
    public static DvKey OfValue(DynamicValue value)
    {
        var result = DynamicValues.ToCanonicalCbor(value);
        if (result is not Result<byte[], EncodeError>.Ok ok)
        {
            var err = (Result<byte[], EncodeError>.Err)result;
            throw new InvalidOperationException($"Failed to encode value to canonical CBOR: {err.Error}");
        }
        return new DvKey(value, ok.Value);
    }

    private static int CompareBytes(byte[] a, byte[] b)
    {
        int n = Math.Min(a.Length, b.Length);
        for (int i = 0; i < n; i++)
        {
            int cmp = a[i].CompareTo(b[i]);
            if (cmp != 0) return cmp;
        }
        return a.Length.CompareTo(b.Length);
    }

    /// <inheritdoc/>
    public override bool Equals(object? obj) =>
        obj is DvKey other && Equals(other);

    /// <inheritdoc/>
    public bool Equals(DvKey? other) =>
        other is not null && CompareBytes(Canonical, other.Canonical) == 0;

    /// <inheritdoc/>
    public override int GetHashCode()
    {
        // 32-bit FNV-1a over canonical bytes.
        uint h = 2166136261u;
        foreach (byte b in Canonical)
        {
            h = (h ^ b) * 16777619u;
        }
        return (int)h;
    }

    /// <inheritdoc/>
    public int CompareTo(DvKey? other)
    {
        if (other is null) return 1;
        return CompareBytes(Canonical, other.Canonical);
    }

    /// <inheritdoc/>
    public int CompareTo(object? obj)
    {
        if (obj is null) return 1;
        if (obj is not DvKey other)
        {
            throw new ArgumentException("Object must be of type DvKey", nameof(obj));
        }
        return CompareTo(other);
    }

    /// <summary>Equality operator.</summary>
    public static bool operator ==(DvKey? left, DvKey? right) =>
        left?.Equals(right) ?? right is null;

    /// <summary>Inequality operator.</summary>
    public static bool operator !=(DvKey? left, DvKey? right) =>
        !(left == right);

    /// <summary>Less-than operator.</summary>
    public static bool operator <(DvKey? left, DvKey? right) =>
        left is null ? right is not null : left.CompareTo(right) < 0;

    /// <summary>Less-than-or-equal operator.</summary>
    public static bool operator <=(DvKey? left, DvKey? right) =>
        left is null || left.CompareTo(right) <= 0;

    /// <summary>Greater-than operator.</summary>
    public static bool operator >(DvKey? left, DvKey? right) =>
        left is not null && left.CompareTo(right) > 0;

    /// <summary>Greater-than-or-equal operator.</summary>
    public static bool operator >=(DvKey? left, DvKey? right) =>
        left is null ? right is null : left.CompareTo(right) >= 0;
}
