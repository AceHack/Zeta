/**
 * src/Core.TypeScript/workflow-engine/consensus.ts
 *
 * 081KSNY2Z0008QG0R001YK61JQ.3 — n-parallel analyzer + consensus mechanism substrate at
 * per-data-analysis-task scope.
 *
 * Per Sakana Robin closed-loop architecture (Nature 2026): launches 8
 * independent instances of Finch agent to analyze the same raw data;
 * accepts conclusion only if majority agree. Generalized to N parallel
 * analyzers with configurable consensus mechanism.
 *
 * Composes with:
 *   - 081KSNY2Z0008QG0R001YK61JQ.3 backlog row (n-parallel-consensus extension target)
 *   - 081KS3X9Y0008QG0R00218150M multi-oracle BFT substrate (governance-scope consensus;
 *     this extends to per-data-analysis-task scope)
 *   - 081KSNY2Z0008QG0R001YK61JQ.2 PR #5769 closed-loop orchestrator (dispatchCi callback
 *     can use this substrate to run N parallel analyzers + consensus)
 *   - 081KSNY2Z0008QG0R001YK61JQ.4 PR #5768 pairing tracker (verifier-side: N parallel
 *     verifiers + consensus determines verdict)
 *   - .claude/rules/monad-propagation-pattern (Result<T, TFeedback>)
 *   - .claude/rules/asymmetric-authorship (each parallel instance
 *     authors its own TFeedback channel; consensus aggregates per
 *     substrate-entity-defined channel)
 *   - .claude/rules/m-acc-multi-oracle-end-user-moral-invariants (the
 *     framework's multi-oracle substrate at consensus-mechanism scope)
 *
 * PoC scope: pure-TS substrate with configurable consensus mechanism +
 * generic analyzer callbacks. Real parallel execution via Promise.all
 * (concurrent within single process; multi-machine parallelism via
 * caller wiring).
 */

/**
 * Consensus mechanism — how N parallel analyzers' outputs are
 * aggregated into a single verdict.
 */
export type ConsensusMechanism =
  | { kind: "majority" } // > 50% must agree
  | { kind: "supermajority"; threshold: number } // > threshold (e.g., 0.67 for 2/3)
  | { kind: "unanimous" } // 100% must agree
  | { kind: "first-n-agree"; n: number }; // first N agreeing analyzers' verdict wins

/**
 * Consensus feedback per asymmetric-authorship + monad-propagation rules.
 */
export type ConsensusFeedback =
  | { kind: "InsufficientAnalyzers"; required: number; provided: number }
  | { kind: "NoConsensus"; majorityCount: number; required: number }
  | { kind: "AllAnalyzersFailed"; failures: ReadonlyArray<string> }
  | { kind: "InvalidThreshold"; threshold: number };

/**
 * Result-shape per monad-propagation rule.
 */
export type ConsensusResult<T> =
  | { ok: true; verdict: T; agreement: AgreementMetrics<T> }
  | { ok: false; feedback: ConsensusFeedback };

/**
 * Agreement metrics — captures the consensus distribution for
 * substrate-honest dashboards. Type parameter `T` is reserved for
 * future extensions that surface verdict-typed substrate (e.g., topVerdict
 * field) without breaking the public-API shape.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface AgreementMetrics<T> {
  readonly totalAnalyzers: number;
  readonly successfulAnalyzers: number;
  readonly failedAnalyzers: number;
  readonly verdictCounts: ReadonlyMap<string, number>; // keyed by verdict-id
  readonly winnerCount: number;
  readonly winnerFraction: number; // winnerCount / successfulAnalyzers
  readonly _typeHint?: T; // type-anchor; never set at runtime
}

/**
 * Per-analyzer result discriminated union.
 *
 * Each analyzer authors its own TFeedback channel (per asymmetric-
 * authorship); consensus aggregates per substrate-entity-defined
 * channel.
 */
export type AnalyzerOutput<T> = { ok: true; verdict: T } | { ok: false; reason: string };

/**
 * Run N parallel analyzers + compute consensus.
 *
 * Caller provides:
 *   - `analyzers`: array of async functions each producing an
 *     AnalyzerOutput<T>
 *   - `mechanism`: consensus mechanism (majority / supermajority /
 *     unanimous / first-n-agree)
 *   - `verdictKey`: function that produces a stable key for a verdict
 *     (used for grouping; default: JSON.stringify)
 *
 * Per Robin's 8-parallel-Finch consensus: all analyzers run
 * concurrently (Promise.all); consensus computed across completed
 * outputs.
 */
export interface ConsensusContext<T> {
  readonly analyzers: ReadonlyArray<() => Promise<AnalyzerOutput<T>>>;
  readonly mechanism: ConsensusMechanism;
  readonly verdictKey?: (verdict: T) => string;
}

export async function runConsensus<T>(context: ConsensusContext<T>): Promise<ConsensusResult<T>> {
  if (context.analyzers.length === 0) {
    return {
      ok: false,
      feedback: { kind: "InsufficientAnalyzers", required: 1, provided: 0 },
    };
  }

  // Validate threshold for supermajority
  if (context.mechanism.kind === "supermajority") {
    if (
      context.mechanism.threshold <= 0.5 ||
      context.mechanism.threshold > 1.0 ||
      !Number.isFinite(context.mechanism.threshold)
    ) {
      return {
        ok: false,
        feedback: { kind: "InvalidThreshold", threshold: context.mechanism.threshold },
      };
    }
  }

  // first-n-agree requires at least N analyzers
  if (context.mechanism.kind === "first-n-agree" && context.analyzers.length < context.mechanism.n) {
    return {
      ok: false,
      feedback: {
        kind: "InsufficientAnalyzers",
        required: context.mechanism.n,
        provided: context.analyzers.length,
      },
    };
  }

  // Run all analyzers concurrently
  const outputs = await Promise.all(
    context.analyzers.map(async (analyzer): Promise<AnalyzerOutput<T>> => {
      try {
        return await analyzer();
      } catch (err) {
        return { ok: false, reason: err instanceof Error ? err.message : String(err) };
      }
    }),
  );

  const successful = outputs.filter((o): o is { ok: true; verdict: T } => o.ok);
  const failed = outputs.filter((o): o is { ok: false; reason: string } => !o.ok);

  if (successful.length === 0) {
    return {
      ok: false,
      feedback: {
        kind: "AllAnalyzersFailed",
        failures: failed.map((f) => f.reason),
      },
    };
  }

  // Group successful verdicts by key
  const keyFn = context.verdictKey ?? ((v: T): string => JSON.stringify(v));
  const verdictCounts = new Map<string, number>();
  const verdictsByKey = new Map<string, T>();
  for (const { verdict } of successful) {
    const key = keyFn(verdict);
    verdictCounts.set(key, (verdictCounts.get(key) ?? 0) + 1);
    if (!verdictsByKey.has(key)) {
      verdictsByKey.set(key, verdict);
    }
  }

  // Find winner — highest count
  let winnerKey = "";
  let winnerCount = 0;
  for (const [key, count] of verdictCounts.entries()) {
    if (count > winnerCount) {
      winnerCount = count;
      winnerKey = key;
    }
  }

  const totalAnalyzers = context.analyzers.length;
  const successfulCount = successful.length;
  const winnerFraction = winnerCount / successfulCount;

  // Check consensus per mechanism
  const required = computeRequired(context.mechanism, successfulCount);
  let consensusReached = false;
  switch (context.mechanism.kind) {
    case "majority":
      consensusReached = winnerCount > successfulCount / 2;
      break;
    case "supermajority":
      consensusReached = winnerFraction > context.mechanism.threshold;
      break;
    case "unanimous":
      consensusReached = winnerCount === successfulCount;
      break;
    case "first-n-agree":
      consensusReached = winnerCount >= context.mechanism.n;
      break;
  }

  if (!consensusReached) {
    return {
      ok: false,
      feedback: { kind: "NoConsensus", majorityCount: winnerCount, required },
    };
  }

  const verdict = verdictsByKey.get(winnerKey)!;
  return {
    ok: true,
    verdict,
    agreement: {
      totalAnalyzers,
      successfulAnalyzers: successfulCount,
      failedAnalyzers: failed.length,
      verdictCounts,
      winnerCount,
      winnerFraction,
    },
  };
}

/**
 * Helper: compute required threshold count for consensus mechanism +
 * successful analyzer count.
 */
function computeRequired(mechanism: ConsensusMechanism, successfulCount: number): number {
  switch (mechanism.kind) {
    case "majority":
      return Math.floor(successfulCount / 2) + 1;
    case "supermajority":
      return Math.ceil(successfulCount * mechanism.threshold) + 1;
    case "unanimous":
      return successfulCount;
    case "first-n-agree":
      return mechanism.n;
  }
}

/**
 * Convenience: launch N identical instances of a single analyzer
 * function. Per Robin's pattern: 8 independent Finch instances analyzing
 * the same raw data. Each instance gets a different seed for
 * non-determinism within the analyzer.
 */
export function nIdenticalAnalyzers<T>(
  n: number,
  analyzer: (instanceId: number) => Promise<AnalyzerOutput<T>>,
): ReadonlyArray<() => Promise<AnalyzerOutput<T>>> {
  const result: Array<() => Promise<AnalyzerOutput<T>>> = [];
  for (let i = 0; i < n; i++) {
    const instanceId = i;
    result.push(() => analyzer(instanceId));
  }
  return result;
}
