using System;
using System.Collections.Generic;
using System.Linq;

namespace Zeta.Core.CSharp;

/// <summary>
/// BFT quorum consensus decision core, C# oracle. Conforms to the F# canonical shape
/// (<c>src/Core/Consensus.fs</c>, <c>Consensus.quorumThreshold</c> / <c>decide</c>) by agreeing on the
/// shared seed (<c>src/Core.TypeScript/consensus/golden-vectors.json</c>) that the F#/TS/Rust oracles
/// also verify. Pure integer. The vote state machine is out of byte-lock scope.
/// </summary>
public static class Consensus
{
    /// <summary>The outcome of <see cref="Decide"/>.</summary>
    public sealed record Decision(bool Committed, string? Value, int Count, int Total);

    /// <summary>The classic BFT quorum threshold: <c>2*floor((n-1)/3) + 1</c> (i.e. 2f+1 for n=3f+1).</summary>
    public static int QuorumThreshold(int nodeCount) => (2 * ((nodeCount - 1) / 3)) + 1;

    /// <summary>
    /// Decide consensus over a list of vote values: group by value preserving first-occurrence order,
    /// stable-sort by descending count, commit the top iff its support reaches the quorum threshold.
    /// </summary>
    public static Decision Decide(IReadOnlyList<string> votes)
    {
        var total = votes.Count;
        if (total == 0)
        {
            return new Decision(false, null, 0, 0);
        }

        // GroupBy yields groups in first-occurrence order; OrderByDescending is a stable sort.
        var groups = votes
            .GroupBy(v => v, StringComparer.Ordinal)
            .Select(g => (Value: g.Key, Count: g.Count()))
            .OrderByDescending(x => x.Count)
            .ToList();

        var threshold = QuorumThreshold(total);
        var top = groups[0];
        return top.Count >= threshold
            ? new Decision(true, top.Value, top.Count, total)
            : new Decision(false, null, top.Count, total);
    }
}
