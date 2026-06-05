using System;
using System.Collections.Generic;
using System.Linq;

namespace Zeta.Core.CSharp;

/// <summary>
/// SoftValue — the "how-sure" value axis, C# oracle (#3 of TS/F#/C#/Rust) of the DECISION semantics.
/// Conforms to the F# canonical shape (<c>src/Core/SoftValue.fs</c>). SoftValue is float-valued and floats
/// do not byte-lock across languages, so only the EXACT decision behavior is cross-verified (the shared
/// seed <c>src/Core.TypeScript/soft-value/golden-vectors.json</c>): <see cref="Resolve"/> (argmax candidate
/// returned iff confidence ≥ threshold) and <see cref="ObserveResolve"/> (Bayesian multiply then decide).
/// Weights are exact <c>long</c>; the threshold is a rational num/den. The float confidence/entropy VALUES
/// are F#-only and out of scope here.
/// </summary>
public static class SoftValue
{
    // Argmax: max weight, ties broken by ascending key (deterministic across languages).
    private static string? Argmax(IReadOnlyDictionary<string, long> candidates) =>
        candidates.Count == 0
            ? null
            : candidates.OrderByDescending(kv => kv.Value).ThenBy(kv => kv.Key, StringComparer.Ordinal).First().Key;

    /// <summary>
    /// The terminal decision: the argmax candidate iff its confidence (best_weight / total) is ≥ the
    /// rational threshold <paramref name="num"/>/<paramref name="den"/>; otherwise <c>null</c> (never
    /// falsely certain). Empty ⇒ null.
    /// </summary>
    public static string? Resolve(IReadOnlyDictionary<string, long> candidates, long num, long den)
    {
        ArgumentNullException.ThrowIfNull(candidates);
        if (candidates.Count == 0)
        {
            return null;
        }

        var total = candidates.Values.Sum();
        var best = Argmax(candidates)!;
        var bestWeight = candidates[best];
        // confidence ≥ num/den  ⟺  bestWeight·den ≥ num·total
        return bestWeight * den >= num * total ? best : null;
    }

    /// <summary>
    /// Bayesian observe (pointwise-multiply the likelihood into the prior; candidates that zero out are
    /// dropped — no fabricated certainty) followed by <see cref="Resolve"/>. If every candidate zeroes,
    /// the result is <c>null</c>.
    /// </summary>
    public static string? ObserveResolve(
        IReadOnlyDictionary<string, long> prior,
        IReadOnlyDictionary<string, long> likelihood,
        long num,
        long den)
    {
        ArgumentNullException.ThrowIfNull(prior);
        ArgumentNullException.ThrowIfNull(likelihood);
        var posterior = prior
            .Select(kv => new KeyValuePair<string, long>(kv.Key, kv.Value * (likelihood.TryGetValue(kv.Key, out var l) ? l : 0L)))
            .Where(kv => kv.Value > 0L)
            .ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.Ordinal);
        return Resolve(posterior, num, den);
    }
}
