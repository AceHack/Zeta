using System;
using System.Runtime.InteropServices;

namespace Zeta.Core.CSharp;

/// <summary>
/// UncertainClock — a Hybrid Logical Clock with an uncertainty window, C# oracle (#3 of TS/F#/C#/Rust).
/// Conforms to the F# canonical shape (<c>src/Core/UncertainClock.fs</c>) by agreeing on the shared seed
/// (<c>src/Core.TypeScript/uncertain-clock/golden-vectors.json</c>). All <c>long</c> arithmetic — no
/// floats, fully byte-lockable. An HLC is (physical, logical); an uncertain reading is (physical, eps)
/// with true time in [physical, physical + eps].
/// </summary>
public static class UncertainClock
{
    /// <summary>A Hybrid Logical Clock reading: physical time + logical tiebreak.</summary>
    [StructLayout(LayoutKind.Auto)]
    public readonly record struct Hlc(long Physical, long Logical);

    /// <summary>Lexicographic HLC comparison (-1 / 0 / +1): physical first, logical as tiebreak.</summary>
    public static int CompareHlc(Hlc a, Hlc b)
    {
        var c = a.Physical.CompareTo(b.Physical);
        return c != 0 ? Math.Sign(c) : Math.Sign(a.Logical.CompareTo(b.Logical));
    }

    /// <summary>HLC send: advance to at least <paramref name="nowPhysical"/>, bumping logical when physical doesn't move.</summary>
    public static Hlc Send(Hlc c, long nowPhysical)
    {
        var p = Math.Max(c.Physical, nowPhysical);
        return p == c.Physical ? new Hlc(p, c.Logical + 1) : new Hlc(p, 0);
    }

    /// <summary>HLC receive: the CockroachDB/HLC merge — the result dominates both inputs (bounded divergence).</summary>
    public static Hlc Receive(Hlc c, Hlc msg, long nowPhysical)
    {
        var p = Math.Max(Math.Max(c.Physical, msg.Physical), nowPhysical);
        long l;
        if (p == c.Physical && p == msg.Physical)
        {
            l = Math.Max(c.Logical, msg.Logical) + 1;
        }
        else if (p == c.Physical)
        {
            l = c.Logical + 1;
        }
        else if (p == msg.Physical)
        {
            l = msg.Logical + 1;
        }
        else
        {
            l = 0;
        }

        return new Hlc(p, l);
    }

    /// <summary>Definite happens-before: a's whole window ends strictly before b's begins.</summary>
    public static bool DefinitelyBefore(long aPhysical, long aEps, long bPhysical, long bEps) =>
        aPhysical + aEps < bPhysical;

    /// <summary>The uncertain zone: neither reading is definitely before the other (windows overlap).</summary>
    public static bool Uncertain(long aPhysical, long aEps, long bPhysical, long bEps) =>
        !DefinitelyBefore(aPhysical, aEps, bPhysical, bEps) && !DefinitelyBefore(bPhysical, bEps, aPhysical, aEps);
}
