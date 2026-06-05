using System;

namespace Zeta.Core.CSharp;

/// <summary>
/// Rate (∂) and curvature (∂²) over the clock — the C# oracle for the discrete DBSP D/I calculus
/// (canonical shape: <c>src/Core/Curve.fs</c>). A signal is values at consecutive clock ticks;
/// <see cref="Differentiate"/> is <c>D = 1 − z⁻¹</c> (the rate), <see cref="Integrate"/> its inverse,
/// <see cref="Curvature"/> the second difference. Agrees byte-for-byte with the F# oracle on the shared
/// seed (<c>src/Core.TypeScript/curve/golden-vectors.json</c>). Exact <c>long</c> arithmetic.
/// </summary>
public static class Curve
{
    /// <summary>Differentiate (<c>D = 1 − z⁻¹</c>): the per-tick rate of change.</summary>
    public static long[] Differentiate(long[] signal)
    {
        ArgumentNullException.ThrowIfNull(signal);
        var rate = new long[signal.Length];
        for (var i = 0; i < signal.Length; i++)
        {
            rate[i] = i == 0 ? signal[0] : signal[i] - signal[i - 1];
        }

        return rate;
    }

    /// <summary>Integrate (<c>I</c>): the running prefix sum — the inverse of <see cref="Differentiate"/>.</summary>
    public static long[] Integrate(long[] signal)
    {
        ArgumentNullException.ThrowIfNull(signal);
        var cumulative = new long[signal.Length];
        var acc = 0L;
        for (var i = 0; i < signal.Length; i++)
        {
            acc += signal[i];
            cumulative[i] = acc;
        }

        return cumulative;
    }

    /// <summary>Curvature (<c>D ∘ D</c>): the rate of the rate (second difference).</summary>
    public static long[] Curvature(long[] signal) => Differentiate(Differentiate(signal));
}
