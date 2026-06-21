using System.Collections.Generic;
using System.Linq;

namespace Zeta.Core;

/// <summary>
/// Ring-generic soft-mix interpreter: folds IR ops over a weighted ensemble.
/// The ring IS the physics — swap it, change the behavior:
///   - real (double) → Bayesian (no interference)
///   - complex → Quantum (interference/cancellation)
///   - quaternion → future (non-commutative)
///
/// Port of src/Core.TypeScript/algebra/soft-mix.ts and src/Core/WSet.fs consolidate.
/// </summary>
public static class SoftMix
{
    /// <summary>A weighted entry: (key, weight) from a *-ring.</summary>
    public record struct WEntry<TWeight>(ulong Key, TWeight Weight);

    /// <summary>An IR operation (mul or xorshr).</summary>
    public record struct IrOp(string Kind, ulong Val);

    /// <summary>
    /// Consolidate: sum weights of identical keys via ring.Add, drop zeros.
    /// This is where interference (complex) or mixture (real) happens.
    /// </summary>
    public static IList<WEntry<TWeight>> Consolidate<TWeight>(
        IStarRing<TWeight> ring,
        IList<WEntry<TWeight>> entries,
        System.Func<TWeight, bool> isZero)
    {
        var grouped = new List<WEntry<TWeight>>();
        foreach (var entry in entries)
        {
            var idx = grouped.FindIndex(g => g.Key == entry.Key);
            if (idx >= 0)
            {
                grouped[idx] = new WEntry<TWeight>(entry.Key, ring.Add(grouped[idx].Weight, entry.Weight));
            }
            else
            {
                grouped.Add(entry);
            }
        }
        return grouped.Where(g => !isZero(g.Weight)).ToList();
    }

    /// <summary>
    /// Ring-generic soft mix: fold all IR ops over the ensemble.
    /// One function — works for any IStarRing instance.
    /// </summary>
    public static IList<WEntry<TWeight>> Mix<TWeight>(
        IStarRing<TWeight> ring,
        IReadOnlyList<IrOp> ops,
        int width,
        IList<WEntry<TWeight>> input,
        System.Func<TWeight, bool> isZero)
    {
        ulong mask = width >= 64 ? ulong.MaxValue : (1UL << width) - 1;
        var ensemble = input.ToList();

        foreach (var op in ops)
        {
            // flatMap: each frame can produce multiple output frames (fork).
            // mul/xorshr: deterministic (1→1). branch: 1→2 (grows by 1 bit of uncertainty).
            ensemble = ensemble.SelectMany(e =>
            {
                return op.Kind switch
                {
                    "mul" => new[] { new WEntry<TWeight>((e.Key * op.Val) & mask, e.Weight) },
                    "xorshr" => new[] { new WEntry<TWeight>((e.Key ^ (e.Key >> (int)op.Val)) & mask, e.Weight) },
                    "branch" => new[]
                    {
                        new WEntry<TWeight>(e.Key & mask, e.Weight),
                        new WEntry<TWeight>((e.Key ^ (1UL << (int)op.Val)) & mask, e.Weight),
                    },
                    _ => new[] { new WEntry<TWeight>(e.Key, e.Weight) },
                };
            }).ToList();

            ensemble = Consolidate(ring, ensemble, isZero).ToList();
        }

        return ensemble;
    }
}
