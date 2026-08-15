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
 * Decide consensus over a list of vote VALUES: group by value, take the highest support, and commit
 * it iff it reaches quorumThreshold(total).
 *
 * The tie-break among values sharing the highest support is the ORDINAL MINIMUM, deliberately
 * order-INDEPENDENT: two nodes that received the same votes in different orders must decide
 * identically. It used to be first-occurrence, which read arrival order and diverged at
 * n in {2,3,6}. See src/Core/Consensus.fs and the shared seed ./golden-vectors.json — do NOT
 * change the rule in one oracle.
 */
export function decide(votes: string[]): Decision {
  const total = votes.length;
  if (total === 0) return { committed: false, value: null, count: 0, total: 0 };

  const groups: { value: string; count: number }[] = [];
  for (const v of votes) {
    const g = groups.find((x) => x.value === v);
    if (g) g.count++;
    else groups.push({ value: v, count: 1 });
  }

  const best = groups.reduce((m, g) => (g.count > m ? g.count : m), 0);
  // Order-independent tie-break: ordinal minimum among the values tied at `best`. `<` on strings is
  // UTF-16 code-unit (ordinal) comparison — NEVER localeCompare, which is culture-sensitive
  // (.claude/rules/culture-invariant-by-default.md).
  let value = groups.find((g) => g.count === best)!.value;
  for (const g of groups) {
    if (g.count === best && g.value < value) value = g.value;
  }

  const threshold = quorumThreshold(total);
  const top = { value, count: best };
  return top.count >= threshold
    ? { committed: true, value: top.value, count: top.count, total }
    : { committed: false, value: null, count: top.count, total };
}
