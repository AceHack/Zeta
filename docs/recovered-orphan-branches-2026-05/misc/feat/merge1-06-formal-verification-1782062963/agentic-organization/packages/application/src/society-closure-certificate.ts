/**
 * Finite-society closure certificate.
 *
 * Faithful port of `tools/formal-verification/society-finite-closure.ts`
 * (Merge1 §06). Proves that a finite society of N agents forms a complete graph
 * via pairwise bidirectional relations: for each unordered pair {a, b} the
 * federation adds the two directed edges a->b and b->a. After all C(N,2) pairs
 * are processed the graph has N*(N-1) directed edges — the formal guarantee
 * behind "harmonious division" (aperiodic proximity, full connectivity).
 *
 * Pure + deterministic (MP-1). Validation is Result-shaped (MP-7).
 */

export type DirectedEdge = `${string}->${string}`;

export type FiniteSocietyClosureStep = {
  readonly pair: readonly [string, string];
  readonly addedEdges: readonly [DirectedEdge, DirectedEdge];
  readonly edgeCountAfter: number;
};

export type FiniteSocietyClosureCertificate = {
  readonly agents: readonly string[];
  readonly unorderedPairCount: number;
  readonly steps: readonly FiniteSocietyClosureStep[];
  readonly finalEdges: readonly DirectedEdge[];
};

export type FiniteSocietyClosureValidation =
  | {
      readonly ok: true;
      readonly agentCount: number;
      readonly unorderedPairCount: number;
      readonly directedEdgeCount: number;
    }
  | { readonly ok: false; readonly reason: string };

function directedEdge(from: string, to: string): DirectedEdge {
  return `${from}->${to}`;
}

/** C(n, 2) = n*(n-1)/2 — the number of unordered pairs of n agents. */
function unorderedPairs(n: number): number {
  return (n * (n - 1)) / 2;
}

/**
 * Build the closure certificate for a finite society. Agents are deduplicated
 * (preserving first-seen order) so the certificate is canonical. Each unordered
 * pair contributes one step adding its two directed edges, in a deterministic
 * lexicographic-by-index order.
 */
export function finiteSocietyClosureCertificate(
  agents: readonly string[],
): FiniteSocietyClosureCertificate {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const a of agents) {
    if (!seen.has(a)) {
      seen.add(a);
      unique.push(a);
    }
  }

  const steps: FiniteSocietyClosureStep[] = [];
  const finalEdges: DirectedEdge[] = [];
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const a = unique[i]!;
      const b = unique[j]!;
      const addedEdges: readonly [DirectedEdge, DirectedEdge] = [directedEdge(a, b), directedEdge(b, a)];
      finalEdges.push(addedEdges[0], addedEdges[1]);
      steps.push({ pair: [a, b], addedEdges, edgeCountAfter: finalEdges.length });
    }
  }

  return {
    agents: unique,
    unorderedPairCount: unorderedPairs(unique.length),
    steps,
    finalEdges,
  };
}

/**
 * Validate a closure certificate: the pair count, step count, and directed-edge
 * count must all be internally consistent with a complete bidirectional graph.
 */
export function validateFiniteSocietyClosureCertificate(
  certificate: FiniteSocietyClosureCertificate,
): FiniteSocietyClosureValidation {
  const n = certificate.agents.length;
  const expectedPairs = unorderedPairs(n);
  if (certificate.unorderedPairCount !== expectedPairs) {
    return { ok: false, reason: `unorderedPairCount ${certificate.unorderedPairCount} != C(${n},2)=${expectedPairs}` };
  }
  if (certificate.steps.length !== expectedPairs) {
    return { ok: false, reason: `steps ${certificate.steps.length} != ${expectedPairs}` };
  }
  const expectedEdges = n * (n - 1);
  if (certificate.finalEdges.length !== expectedEdges) {
    return { ok: false, reason: `finalEdges ${certificate.finalEdges.length} != ${expectedEdges}` };
  }
  const distinct = new Set(certificate.finalEdges);
  if (distinct.size !== expectedEdges) {
    return { ok: false, reason: `finalEdges contains duplicates (${distinct.size} distinct of ${expectedEdges})` };
  }
  return { ok: true, agentCount: n, unorderedPairCount: expectedPairs, directedEdgeCount: expectedEdges };
}
