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
    /// Decide consensus over a list of vote values: group by value, take the highest support, commit
    /// it iff it reaches the quorum threshold. The tie-break among values sharing the highest support
    /// is the <b>ordinal minimum</b> — deliberately order-INDEPENDENT, so two nodes that received the
    /// same votes in different orders decide identically. (It was first-occurrence, which read
    /// arrival order and diverged at n in {2,3,6}; see <c>src/Core/Consensus.fs</c> and the shared
    /// seed <c>golden-vectors.json</c>. Do not change it in one oracle.)
    /// </summary>
    public static Decision Decide(IReadOnlyList<string> votes)
    {
        var total = votes.Count;
        if (total == 0)
        {
            return new Decision(false, null, 0, 0);
        }

        var groups = votes
            .GroupBy(v => v, StringComparer.Ordinal)
            .Select(g => (Value: g.Key, Count: g.Count()))
            .ToList();

        var best = groups.Max(x => x.Count);
        // Order-independent tie-break: the ordinal minimum among the values tied at `best`.
        // Ordinal, never culture-sensitive (.claude/rules/culture-invariant-by-default.md).
        var value = groups.Where(x => x.Count == best).Select(x => x.Value).Min(StringComparer.Ordinal)!;

        var threshold = QuorumThreshold(total);
        return best >= threshold
            ? new Decision(true, value, best, total)
            : new Decision(false, null, best, total);
    }
}
