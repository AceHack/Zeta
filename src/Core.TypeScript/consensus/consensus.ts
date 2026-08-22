// BFT quorum consensus decision core, TypeScript oracle.
// Conforms to the F# canonical shape (src/Core/Consensus.fs, quorumThreshold / decide) by agreeing on
// the shared seed (./golden-vectors.json) that the C#/F#/Rust oracles also verify. Pure integer.
// The vote state machine (transition) carries timestamps and is out of byte-lock scope.

export interface Decision {
  committed: boolean;
  value: string | null;
  count: number;
  total: number;
}

/** The classic BFT quorum threshold: 2*floor((n-1)/3) + 1 (i.e. 2f+1 for n=3f+1). */
export function quorumThreshold(nodeCount: number): number {
  return 2 * Math.trunc((nodeCount - 1) / 3) + 1;
}

/**
 * Decide consensus over a list of vote VALUES: group by value preserving first-occurrence order,
 * stable-sort by descending count, commit the top iff its support reaches quorumThreshold(total).
 */
export function decide(votes: string[]): Decision {
  const total = votes.length;
  if (total === 0) return { committed: false, value: null, count: 0, total: 0 };

  // First-occurrence-ordered (value, count) groups.
  const groups: { value: string; count: number }[] = [];
  for (const v of votes) {
    const g = groups.find((x) => x.value === v);
    if (g) g.count++;
    else groups.push({ value: v, count: 1 });
  }
  // Stable sort by descending count (JS Array.sort is stable; ties keep first-occurrence order).
  groups.sort((a, b) => b.count - a.count);

  const threshold = quorumThreshold(total);
  const top = groups[0]!;
  return top.count >= threshold
    ? { committed: true, value: top.value, count: top.count, total }
    : { committed: false, value: null, count: top.count, total };
}
