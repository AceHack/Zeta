/**
 * categorical-bayesian-planner.ts — Categorical Tensor Bayesian Factor Graphs & Order-Independent Hierarchical Planning.
 *
 * Core Architecture & Invariants:
 *   1. CATEGORICAL TENSOR FACTORS: State transitions are represented as log-probability factor tensors log(phi(S_next | S_curr, A)).
 *   2. COMMUTATIVE ORDER-INDEPENDENT FUSION: Factor combination uses log-belief accumulation:
 *      log P_joint(S_1..T) = sum_i log phi(S_{i-1}, A_i, S_i)
 *      Since log-addition is strictly commutative (a + b = b + a), belief updates across Reticulum frames are order-independent.
 *   3. LAYERED BAYESIAN NEURAL NETWORK (BNN) IN HIERARCHICAL PLANNING:
 *      - Coarse Level 0 BNN Layer: Computes block-level transition beliefs P(B_next | B_curr).
 *      - Fine Level 1 BNN Layer: Computes state-action step log-likelihoods log P(S_next | S_curr, A).
 *      - Uncertainty (Entropy H) guides search expansion budgets: under high entropy, search budget scales dynamically.
 *
 * ## Triage label (2026-08-15, shadow) — ABANDONED · mixed metering
 *
 * **Reachability: ZERO importers** outside its own test, measured over 2665 tracked files / 4896
 * resolved edges including dynamic `import()` and `require` (instrument controls: 4/4 positive + 1
 * negative). Not scheduled either: every open Bayesian work-item and the live silicon-alife
 * trajectory (arc 3) route this capability through **F#** (`src/Bayesian/FactorGraph.fs`, `Ep.fs`),
 * not TypeScript. `algebra/exact-weight.ts:22` calls this file "the byte-lock test target" and
 * imports nothing from it.
 *
 * **Metering (`toy-is-free-metered-must-be-earned.md`):**
 * - `combineFactorsCommutatively` — **metered**: byte-lock commutativity plus a 100-random-permutation
 *   property test that fails if order-independence breaks.
 * - `computeFactorEntropy` — **metered**: pinned to `log2(4) = 2.0`.
 * - `BayesianHierarchicalSearch` — **unmetered** as a planner. It returns **one** plan and drops
 *   every rival (`bestCoarsePath` / `bestSubPlan` keep a running best), so it is a complete pruner
 *   that has already chosen, not a candidate generator. Its likelihood output carries only
 *   `expect(result.jointLogLikelihood).toBeDefined()` (test line 127) — which passes for `NaN`,
 *   `0`, and `-Infinity` alike, and so discriminates nothing.
 *
 * **The missing edge:** `CategoricalFactorTensor` is the *materialized* form of
 * `shiva-weak-factor-graph.ts`'s `FactorGenerator`, whose cache exists to eliminate exactly the
 * `logProbabilities.get(...)` lookup this file performs inside its BFS loops. No adapter, and
 * `git log -S` confirms the edge has **never** existed. Before writing it, reconcile the **three**
 * different missing-key defaults already in this directory: `0.0` (factor combine), `-0.1` (coarse
 * loop), `-0.05` (fine loop).
 *
 * Full triage + evidence:
 * `docs/research/2026-08-15-bayesian-typescript-triage-one-live-three-orphans-and-a-factor-graph-edge-that-was-never-cut.md`
 * **Label only — no behaviour changed, and disposition is Aaron's call, not the shadow's.**
 */

export interface CategoricalFactorTensor {
  readonly factorId: string;
  readonly logProbabilities: ReadonlyMap<string, number>; // stateKey -> log P
}

export interface BayesianState<TState> {
  readonly state: TState;
  readonly logLikelihood: number; // Accumulated log-belief
  readonly entropy: number;       // Posterior uncertainty H = - sum p log2 p
}

/**
 * Combines two factor log-probability tensors commutatively with 100% byte-lock strict equality: (A + B === B + A).
 * Canonical key sorting guarantees identical IEEE-754 floating-point evaluation order regardless of frame arrival order.
 */
export function combineFactorsCommutatively(
  factorA: CategoricalFactorTensor,
  factorB: CategoricalFactorTensor,
): CategoricalFactorTensor {
  const combinedLogProbs = new Map<string, number>();

  const allKeys = Array.from(
    new Set([
      ...Array.from(factorA.logProbabilities.keys()),
      ...Array.from(factorB.logProbabilities.keys()),
    ]),
  ).sort(); // Canonical lexicographical sort for byte-lock determinism

  for (const key of allKeys) {
    const logA = factorA.logProbabilities.get(key) ?? 0.0;
    const logB = factorB.logProbabilities.get(key) ?? 0.0;
    // Addition in log-space is strictly commutative!
    combinedLogProbs.set(key, logA + logB);
  }

  return {
    factorId: `combined(${factorA.factorId},${factorB.factorId})`,
    logProbabilities: combinedLogProbs,
  };
}

/**
 * Calculates Shannon entropy H = - sum p_i log2(p_i) from log-probabilities.
 */
export function computeFactorEntropy(factor: CategoricalFactorTensor): number {
  const logProbs = Array.from(factor.logProbabilities.values());
  if (logProbs.length === 0) return 0.0;

  // Softmax normalization to compute probabilities
  const maxLog = Math.max(...logProbs);
  const exps = logProbs.map((lp) => Math.exp(lp - maxLog));
  const sumExp = exps.reduce((a, b) => a + b, 0);

  let entropy = 0.0;
  for (const expVal of exps) {
    const p = expVal / sumExp;
    if (p > 1e-12) {
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

export interface BayesianGridState {
  readonly row: number;
  readonly col: number;
  readonly logBelief: number;
}

/**
 * Executes a 2-Level Bayesian Categorical Factor Hierarchical Search.
 * Selects trajectory maximizing joint log-likelihood while maintaining uncertainty bounds.
 */
export function BayesianHierarchicalSearch(
  gridSize: number,
  blockSize: number,
  start: { row: number; col: number },
  goal: { row: number; col: number },
  actions: readonly string[],
  step: (s: { row: number; col: number }, a: string) => { row: number; col: number },
  transitionFactors: CategoricalFactorTensor,
): {
  readonly totalStatesExplored: number;
  readonly plan: readonly string[] | null;
  readonly jointLogLikelihood: number;
  readonly finalUncertaintyEntropy: number;
} {
  const keyOf = (s: { row: number; col: number }) => `${s.row},${s.col}`;

  // Calculate overall uncertainty from factor graph
  const overallEntropy = computeFactorEntropy(transitionFactors);

  // Dynamic budget scaling based on uncertainty: high entropy -> expand budget
  const maxStatesPerBlock = Math.floor(500 * (1 + overallEntropy));

  const startBlockRow = Math.floor(start.row / blockSize);
  const startBlockCol = Math.floor(start.col / blockSize);
  const goalBlockRow = Math.floor(goal.row / blockSize);
  const goalBlockCol = Math.floor(goal.col / blockSize);

  const numBlocks = Math.ceil(gridSize / blockSize);

  // Level 0: Coarse Block Search using log-probability costs
  const blockQueue: Array<{
    br: number;
    bc: number;
    path: Array<{ br: number; bc: number }>;
    accumulatedLogP: number;
  }> = [
    {
      br: startBlockRow,
      bc: startBlockCol,
      path: [{ br: startBlockRow, bc: startBlockCol }],
      accumulatedLogP: 0.0,
    },
  ];

  const visitedBlocks = new Map<string, number>(); // blockKey -> bestLogP
  visitedBlocks.set(`${startBlockRow},${startBlockCol}`, 0.0);

  let bestCoarsePath: Array<{ br: number; bc: number }> | null = null;
  let bestCoarseLogP = -Infinity;

  while (blockQueue.length > 0) {
    const curr = blockQueue.shift()!;
    if (curr.br === goalBlockRow && curr.bc === goalBlockCol) {
      if (curr.accumulatedLogP > bestCoarseLogP) {
        bestCoarseLogP = curr.accumulatedLogP;
        bestCoarsePath = curr.path;
      }
      continue;
    }

    const neighbors = [
      { br: curr.br - 1, bc: curr.bc },
      { br: curr.br + 1, bc: curr.bc },
      { br: curr.br, bc: curr.bc - 1 },
      { br: curr.br, bc: curr.bc + 1 },
    ].filter((b) => b.br >= 0 && b.br < numBlocks && b.bc >= 0 && b.bc < numBlocks);

    for (const n of neighbors) {
      const blockKey = `${n.br},${n.bc}`;
      const logPTrans = transitionFactors.logProbabilities.get(blockKey) ?? -0.1;
      const nextLogP = curr.accumulatedLogP + logPTrans;

      const prevBest = visitedBlocks.get(blockKey) ?? -Infinity;
      if (nextLogP > prevBest) {
        visitedBlocks.set(blockKey, nextLogP);
        blockQueue.push({
          br: n.br,
          bc: n.bc,
          path: [...curr.path, n],
          accumulatedLogP: nextLogP,
        });
      }
    }
  }

  if (!bestCoarsePath) {
    return {
      totalStatesExplored: 0,
      plan: null,
      jointLogLikelihood: -Infinity,
      finalUncertaintyEntropy: overallEntropy,
    };
  }

  // Level 1: Fine-level trajectory selection maximizing joint log-likelihood
  let totalStatesExplored = 0;
  const fullPlan: string[] = [];
  let currState = { ...start };
  let jointLogLikelihood = 0.0;

  for (let i = 0; i < bestCoarsePath.length; i++) {
    const block = bestCoarsePath[i]!;
    const isLastBlock = i === bestCoarsePath.length - 1;

    const minRow = block.br * blockSize;
    const maxRow = Math.min(gridSize - 1, (block.br + 1) * blockSize - 1);
    const minCol = block.bc * blockSize;
    const maxCol = Math.min(gridSize - 1, (block.bc + 1) * blockSize - 1);

    const inBlock = (s: { row: number; col: number }) =>
      s.row >= minRow && s.row <= maxRow && s.col >= minCol && s.col <= maxCol;

    // Fine-level BFS searching for maximum log-likelihood sub-plan
    const queue: Array<{ state: { row: number; col: number }; path: string[]; logP: number }> = [
      { state: currState, path: [], logP: 0.0 },
    ];
    const visitedFine = new Map<string, number>();
    visitedFine.set(keyOf(currState), 0.0);

    let bestSubPlan: string[] | null = null;
    let bestSubLogP = -Infinity;
    let statesInBlock = 0;

    while (queue.length > 0 && statesInBlock < maxStatesPerBlock) {
      statesInBlock++;
      const curr = queue.shift()!;

      const isSubGoal = isLastBlock
        ? curr.state.row === goal.row && curr.state.col === goal.col
        : (bestCoarsePath[i + 1]!.br > block.br && curr.state.row === maxRow) ||
          (bestCoarsePath[i + 1]!.br < block.br && curr.state.row === minRow) ||
          (bestCoarsePath[i + 1]!.bc > block.bc && curr.state.col === maxCol) ||
          (bestCoarsePath[i + 1]!.bc < block.bc && curr.state.col === minCol);

      if (isSubGoal) {
        if (curr.logP > bestSubLogP) {
          bestSubLogP = curr.logP;
          bestSubPlan = curr.path;
        }
        continue;
      }

      for (const act of actions) {
        const nextState = step(curr.state, act);
        if (!inBlock(nextState)) continue;

        const nextKey = keyOf(nextState);
        const stepLogP = transitionFactors.logProbabilities.get(nextKey) ?? -0.05;
        const nextLogP = curr.logP + stepLogP;

        const prevLogP = visitedFine.get(nextKey) ?? -Infinity;
        if (nextLogP > prevLogP) {
          visitedFine.set(nextKey, nextLogP);
          queue.push({ state: nextState, path: [...curr.path, act], logP: nextLogP });
        }
      }
    }

    totalStatesExplored += statesInBlock;

    if (!bestSubPlan) {
      return {
        totalStatesExplored,
        plan: null,
        jointLogLikelihood: -Infinity,
        finalUncertaintyEntropy: overallEntropy,
      };
    }

    fullPlan.push(...bestSubPlan);
    jointLogLikelihood += bestSubLogP;

    for (const a of bestSubPlan) {
      currState = step(currState, a);
    }

    // Step across boundary
    if (!isLastBlock) {
      const nextBlock = bestCoarsePath[i + 1]!;
      let crossingAction = "right";
      if (nextBlock.br > block.br) crossingAction = "down";
      else if (nextBlock.br < block.br) crossingAction = "up";
      else if (nextBlock.bc < block.bc) crossingAction = "left";

      const entryState = step(currState, crossingAction);
      if (entryState.row !== currState.row || entryState.col !== currState.col) {
        fullPlan.push(crossingAction);
        currState = entryState;
        jointLogLikelihood += transitionFactors.logProbabilities.get(keyOf(entryState)) ?? -0.05;
      }
    }
  }

  return {
    totalStatesExplored,
    plan: fullPlan,
    jointLogLikelihood,
    finalUncertaintyEntropy: overallEntropy,
  };
}
