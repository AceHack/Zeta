using System;
using System.Collections.Generic;
using System.Linq;

namespace Zeta.Core.CSharp;

/// <summary>
/// Braid — Artin's action of B_n on the free group F_n (Artin 1925, faithful) — C# oracle.
/// Port of <c>src/Core/Braid.fs</c> (the F# shelf); agreement locked by the shared seed
/// <c>src/Core.TypeScript/braid/golden-vectors.json</c>, which the F#/TS/Rust oracles also replay.
/// A braid word: nonzero ints, +k = sigma_k (1-based), -k = its inverse; applied left-to-right.
/// A free-group word: (generator, exponent) letters (0-based strand, ±1), kept reduced.
/// </summary>
public static class Braid
{
    /// <summary>Cancel adjacent inverse pairs until none remain (confluent, terminating).</summary>
    public static IReadOnlyList<(int G, int E)> Reduce(IEnumerable<(int G, int E)> w)
    {
        var acc = new List<(int G, int E)>();
        foreach (var (g, e) in w)
        {
            if (acc.Count > 0 && acc[^1].G == g && acc[^1].E + e == 0)
            {
                acc.RemoveAt(acc.Count - 1);
            }
            else
            {
                acc.Add((g, e));
            }
        }

        return acc;
    }

    /// <summary>The inverse word.</summary>
    public static IReadOnlyList<(int G, int E)> Inv(IEnumerable<(int G, int E)> w) =>
        w.Reverse().Select(l => (l.G, -l.E)).ToList();

    /// <summary>One generator as a word.</summary>
    public static IReadOnlyList<(int G, int E)> Gen(int i) => new[] { (i, 1) };

    private static IReadOnlyList<(int G, int E)> ApplyCrossingToLetter(int c, int g, int e)
    {
        var i = Math.Abs(c) - 1; // the crossing acts on strands i, i+1
        IReadOnlyList<(int G, int E)> image;
        if (c > 0)
        {
            // sigma_i: x_i -> x_i x_{i+1} x_i^{-1} ; x_{i+1} -> x_i
            image = g == i ? new[] { (i, 1), (i + 1, 1), (i, -1) }
                : g == i + 1 ? new[] { (i, 1) }
                : new[] { (g, 1) };
        }
        else
        {
            // sigma_i^{-1}: x_i -> x_{i+1} ; x_{i+1} -> x_{i+1}^{-1} x_i x_{i+1}
            image = g == i ? new[] { (i + 1, 1) }
                : g == i + 1 ? new[] { (i + 1, -1), (i, 1), (i + 1, 1) }
                : new[] { (g, 1) };
        }

        return e == 1 ? image : Inv(image);
    }

    /// <summary>Apply one crossing to a word (homomorphic extension), reduced.</summary>
    public static IReadOnlyList<(int G, int E)> ApplyCrossing(int c, IEnumerable<(int G, int E)> w) =>
        Reduce(w.SelectMany(l => ApplyCrossingToLetter(c, l.G, l.E)));

    /// <summary>Apply a braid word (crossings left-to-right) to a free-group word.</summary>
    public static IReadOnlyList<(int G, int E)> Act(IEnumerable<int> braid, IEnumerable<(int G, int E)> w)
    {
        IReadOnlyList<(int G, int E)> acc = w.ToList();
        foreach (var c in braid)
        {
            acc = ApplyCrossing(c, acc);
        }

        return acc;
    }

    /// <summary>The writhe: exponent sum — the unique homomorphism B_n → ℤ.</summary>
    public static int Writhe(IEnumerable<int> b) => b.Sum(c => c > 0 ? 1 : -1);

    /// <summary>Writhe parity — the character B_n → ℤ/2 (= word length mod 2 = the permutation's sign).</summary>
    public static int WritheParity(IReadOnlyCollection<int> b) => b.Count % 2;

    /// <summary>The underlying permutation (position → strand id): the order-forgetting quotient B_n ↠ S_n.</summary>
    public static IReadOnlyList<int> Permutation(int n, IEnumerable<int> b)
    {
        var arr = Enumerable.Range(0, n).ToArray();
        foreach (var c in b)
        {
            var i = Math.Abs(c) - 1;
            if (i + 1 < n)
            {
                (arr[i], arr[i + 1]) = (arr[i + 1], arr[i]);
            }
        }

        return arr;
    }
}
