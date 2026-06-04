namespace Zeta.Core.CSharp;

/// <summary>
/// A versionstamp: a monotonic logical-clock value giving total order over the log.
/// C# oracle of the clock primitive (B-1016 floor #1); conforms to the F# canonical
/// shape (<c>src/Core/Clock.fs</c>) by agreeing on the shared seed. tick = +1 = one
/// scheduler step = z⁻¹ inverse. <c>long</c> = the int64 logical-clock value.
/// </summary>
public readonly record struct Versionstamp(long Version)
{
    public static readonly Versionstamp Zero = new(0L);

    /// <summary>Advance one tick — the forward unit step (inverse of z⁻¹ delay).</summary>
    public Versionstamp Tick() => new(checked(Version + 1L));

    /// <summary>The previous stamp (z⁻¹ delay): inverse of Tick. delay(tick v) = v.</summary>
    public Versionstamp Delay() => new(checked(Version - 1L));

    /// <summary>Total-order comparison (-1 / 0 / +1).</summary>
    public int Compare(Versionstamp other) => Version.CompareTo(other.Version);

    /// <summary>Strict happens-before (total order, single-writer).</summary>
    public bool IsBefore(Versionstamp other) => Version < other.Version;
}
