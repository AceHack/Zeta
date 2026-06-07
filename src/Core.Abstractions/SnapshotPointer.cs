using System;

namespace Zeta.Core;

/// <summary>
/// A durable pointer to a snapshot: the store handle + the delta-log sequence the
/// snapshot covers. Recovery needs only this + the log to rebuild.
/// </summary>
public sealed class SnapshotPointer : IEquatable<SnapshotPointer>
{
    /// <summary>Store-specific handle (e.g., int64 in memory, stable filename on disk).</summary>
    public object Handle { get; }

    /// <summary>The sequence number at which the snapshot was taken.</summary>
    public long Seq { get; }

    /// <summary>Construct a new SnapshotPointer.</summary>
    public SnapshotPointer(object handle, long seq)
    {
        Handle = handle ?? throw new ArgumentNullException(nameof(handle));
        Seq = seq;
    }

    /// <summary>Value equality check.</summary>
    public bool Equals(SnapshotPointer? other)
    {
        if (other is null) return false;
        if (ReferenceEquals(this, other)) return true;
        return Handle.Equals(other.Handle) && Seq == other.Seq;
    }

    /// <summary>Equality check.</summary>
    public override bool Equals(object? obj) => obj is SnapshotPointer other && Equals(other);

    /// <summary>GetHashCode override.</summary>
    public override int GetHashCode() => HashCode.Combine(Handle, Seq);

    /// <summary>Equality operator.</summary>
    public static bool operator ==(SnapshotPointer? left, SnapshotPointer? right) => Equals(left, right);

    /// <summary>Inequality operator.</summary>
    public static bool operator !=(SnapshotPointer? left, SnapshotPointer? right) => !Equals(left, right);
}
