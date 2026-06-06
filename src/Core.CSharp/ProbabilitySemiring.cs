using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace Zeta.Core.CSharp;

/// <summary>
/// Exact-rational probability <c>(+,×)</c> and Viterbi <c>(max,×)</c> semirings, C# oracle. Conforms to
/// the F# canonical shape (<c>src/Core/ProbabilitySemiring.fs</c>) by agreeing on the shared seed
/// (<c>src/Core.TypeScript/probability-semiring/golden-vectors.json</c>) that the F#/TS/Rust oracles also
/// verify. Exact rational ℚ (lowest terms, positive denominator) — no floats, byte-lockable.
/// </summary>
public static class ProbabilitySemiring
{
    /// <summary>An exact rational <c>N/D</c> in lowest terms with <c>D &gt; 0</c> (structural equality).</summary>
    [StructLayout(LayoutKind.Auto)]
    public readonly record struct Rational(long N, long D);

    private static long Gcd(long a, long b) => b == 0 ? a : Gcd(b, a % b);

    /// <summary>Construct a normalized rational (lowest terms, positive denominator). <c>den == 0</c> throws.</summary>
    public static Rational Rat(long num, long den)
    {
        if (den == 0)
        {
            throw new ArgumentException("rational denominator is zero", nameof(den));
        }

        var s = den < 0 ? -1L : 1L;
        var n = s * num;
        var d = s * den;
        var g = Gcd(Math.Abs(n), d);
        if (g == 0)
        {
            g = 1;
        }

        return new Rational(n / g, d / g);
    }

    /// <summary>Additive identity <c>0/1</c>.</summary>
    public static readonly Rational Zero = new(0, 1);

    /// <summary>Probability-semiring ⊕: exact <c>a + b</c>.</summary>
    public static Rational Add(Rational a, Rational b) => Rat((a.N * b.D) + (b.N * a.D), a.D * b.D);

    /// <summary>⊗ of both semirings: exact <c>a * b</c>.</summary>
    public static Rational Mul(Rational a, Rational b) => Rat(a.N * b.N, a.D * b.D);

    /// <summary>Sign of <c>a - b</c> (-1 / 0 / +1); denominators are positive after normalization.</summary>
    public static int Compare(Rational a, Rational b) => Math.Sign((a.N * b.D) - (b.N * a.D));

    /// <summary>Viterbi-semiring ⊕: exact <c>max(a, b)</c>.</summary>
    public static Rational Max(Rational a, Rational b) => Compare(a, b) >= 0 ? a : b;

    /// <summary>Exact reciprocal <c>1/a</c> (ℚ is a field). <c>a = 0</c> is invalid.</summary>
    public static Rational Recip(Rational a) =>
        a.N == 0 ? throw new ArgumentException("reciprocal of zero", nameof(a)) : Rat(a.D, a.N);

    /// <summary>Exact division <c>a / b</c> (<c>b = 0</c> invalid) — used by the relative-observer reconciliation.</summary>
    public static Rational Div(Rational a, Rational b) => Mul(a, Recip(b));

    /// <summary>Relative-observer 3-way merge over the Merkle ancestor: <c>merged(i) = a(i)·b(i)/ancestor(i)</c>.</summary>
    public static IReadOnlyList<Rational> Merge3(IReadOnlyList<Rational> ancestor, IReadOnlyList<Rational> a, IReadOnlyList<Rational> b)
    {
        var n = ancestor.Count;
        var outp = new List<Rational>(n);
        for (var i = 0; i < n; i++)
        {
            outp.Add(Div(Mul(a[i], b[i]), ancestor[i]));
        }

        return outp;
    }

    /// <summary>One forward step over <c>(+,×)</c>: <c>π'(j) = Σ_i π(i)·P(i,j)</c>.</summary>
    public static IReadOnlyList<Rational> ForwardStep(IReadOnlyList<Rational> pi, IReadOnlyList<IReadOnlyList<Rational>> p)
    {
        var n = p.Count;
        var outp = new List<Rational>(n);
        for (var j = 0; j < n; j++)
        {
            var acc = Zero;
            for (var i = 0; i < pi.Count; i++)
            {
                acc = Add(acc, Mul(pi[i], p[i][j]));
            }

            outp.Add(acc);
        }

        return outp;
    }

    /// <summary>One Viterbi step over <c>(max,×)</c>: <c>v'(j) = max_i v(i)·P(i,j)</c>.</summary>
    public static IReadOnlyList<Rational> ViterbiStep(IReadOnlyList<Rational> v, IReadOnlyList<IReadOnlyList<Rational>> p)
    {
        var n = p.Count;
        var outp = new List<Rational>(n);
        for (var j = 0; j < n; j++)
        {
            var acc = Zero;
            for (var i = 0; i < v.Count; i++)
            {
                acc = Max(acc, Mul(v[i], p[i][j]));
            }

            outp.Add(acc);
        }

        return outp;
    }
}
