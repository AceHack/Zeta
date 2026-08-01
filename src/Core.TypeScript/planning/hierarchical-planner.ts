/**
 * hierarchical-planner.ts — 2-Level Coarse-to-Fine State Space Exploration Engine.
 *
 * Pre-registered Invariant:
 *   2-level hierarchical search (coarse region projection -> fine block exploration)
 *   explores < 50% of total state space vs flat BFS (R = N_hier / N_flat < 0.50).
 */

export interface SearchGraph<TState, TAction> {
  readonly states: readonly TState[];
  readonly stateCount: number;
  readonly truncated: boolean;
  readonly parentMap: ReadonlyMap<string, { readonly parentKey: string; readonly action: TAction }>;
}

export interface GridState {
  readonly row: number;
  readonly col: number;
}

export interface GridGistBoundary {
  readonly minRow: number;
  readonly maxRow: number;
  readonly minCol: number;
  readonly maxCol: number;
}

/**
 * Checks if a GridState falls within a Gist boundary.
 */
export function inGistBoundary(state: GridState, gist: GridGistBoundary): boolean {
  return (
    state.row >= gist.minRow &&
    state.row <= gist.maxRow &&
    state.col >= gist.minCol &&
    state.col <= gist.maxCol
  );
}

/**
 * Estimates optimal block size b that minimizes total exploration cost Cost(b) = (N/b)^2 + d * b.
 */
export function leastActionSelect(
  gridSize: number,
  distance: number,
  availableBlockSizes: readonly number[],
): number {
  if (availableBlockSizes.length === 0) return Math.max(1, Math.floor(Math.sqrt(gridSize)));

  let bestSize = availableBlockSizes[0]!;
  let minCost = Infinity;

  for (const b of availableBlockSizes) {
    let cost: number;
    if (b === gridSize) {
      cost = gridSize * gridSize;
    } else {
      const nb = Math.ceil(gridSize / b);
      cost = nb * nb + distance * b;
    }

    if (cost < minCost) {
      minCost = cost;
      bestSize = b;
    }
  }

  return bestSize;
}

/**
 * Generic BFS State Space Explorer bounded by a key predicate.
 */
export function exploreKeyed<TState, TAction>(
  keyOf: (s: TState) => string,
  inBoundary: (s: TState) => boolean,
  actions: readonly TAction[],
  step: (s: TState, a: TAction) => TState,
  initialState: TState,
  maxStates: number,
): SearchGraph<TState, TAction> {
  const visitedKeys = new Set<string>();
  const parentMap = new Map<string, { parentKey: string; action: TAction }>();
  const states: TState[] = [];
  const queue: TState[] = [];

  const startKey = keyOf(initialState);
  visitedKeys.add(startKey);
  states.push(initialState);
  queue.push(initialState);

  let truncated = false;

  while (queue.length > 0) {
    if (states.length >= maxStates) {
      truncated = true;
      break;
    }

    const current = queue.shift()!;
    const currentKey = keyOf(current);

    for (const action of actions) {
      const nextState = step(current, action);
      if (!inBoundary(nextState)) continue;

      const nextKey = keyOf(nextState);
      if (!visitedKeys.has(nextKey)) {
        visitedKeys.add(nextKey);
        parentMap.set(nextKey, { parentKey: currentKey, action });
        states.push(nextState);
        queue.push(nextState);

        if (states.length >= maxStates) {
          truncated = true;
          break;
        }
      }
    }
  }

  return {
    states,
    stateCount: states.length,
    truncated,
    parentMap,
  };
}

/**
 * Reconstructs path of actions from initial state to goal state using SearchGraph parent map.
 */
export function planTo<TState, TAction>(
  isGoal: (s: TState) => boolean,
  keyOf: (s: TState) => string,
  graph: SearchGraph<TState, TAction>,
): readonly TAction[] | null {
  const goalState = graph.states.find(isGoal);
  if (!goalState) return null;

  const goalKey = keyOf(goalState);
  const actions: TAction[] = [];
  let currKey = goalKey;

  while (graph.parentMap.has(currKey)) {
    const parentInfo = graph.parentMap.get(currKey)!;
    actions.unshift(parentInfo.action);
    currKey = parentInfo.parentKey;
  }

  return actions;
}

/**
 * Executes Flat BFS over grid space.
 */
export function flatGridSearch(
  gridSize: number,
  start: GridState,
  goal: GridState,
  actions: readonly string[],
  step: (s: GridState, a: string) => GridState,
  maxStates: number = 10000,
): { readonly stateCount: number; readonly plan: readonly string[] | null } {
  const keyOf = (s: GridState) => `${s.row},${s.col}`;
  const inBoundary = (s: GridState) =>
    s.row >= 0 && s.row < gridSize && s.col >= 0 && s.col < gridSize;

  const graph = exploreKeyed(keyOf, inBoundary, actions, step, start, maxStates);
  const isGoal = (s: GridState) => s.row === goal.row && s.col === goal.col;
  const plan = planTo(isGoal, keyOf, graph);

  return {
    stateCount: graph.stateCount,
    plan,
  };
}

/**
 * Helper to determine crossing action between two adjacent blocks.
 */
function getCrossingAction(
  currBlock: { br: number; bc: number },
  nextBlock: { br: number; bc: number },
): string {
  if (nextBlock.br > currBlock.br) return "down";
  if (nextBlock.br < currBlock.br) return "up";
  if (nextBlock.bc > currBlock.bc) return "right";
  return "left";
}

/**
 * Executes 2-Level Hierarchical Search over grid space with coarse obstacle replanning.
 */
export function hierarchicalGridSearch(
  gridSize: number,
  blockSize: number,
  start: GridState,
  goal: GridState,
  actions: readonly string[],
  step: (s: GridState, a: string) => GridState,
  maxStatesPerBlock: number = 1000,
): { readonly totalStatesExplored: number; readonly plan: readonly string[] | null } {
  const keyOf = (s: GridState) => `${s.row},${s.col}`;
  const isGoal = (s: GridState) => s.row === goal.row && s.col === goal.col;

  const startBlockRow = Math.floor(start.row / blockSize);
  const startBlockCol = Math.floor(start.col / blockSize);
  const goalBlockRow = Math.floor(goal.row / blockSize);
  const goalBlockCol = Math.floor(goal.col / blockSize);

  const numBlocks = Math.ceil(gridSize / blockSize);
  const blockedTransitions = new Set<string>();

  let totalStatesExplored = 0;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    attempts++;

    // Level 0: Coarse Block BFS avoiding blocked transitions
    const blockQueue: Array<{ br: number; bc: number; path: Array<{ br: number; bc: number }> }> = [
      { br: startBlockRow, bc: startBlockCol, path: [{ br: startBlockRow, bc: startBlockCol }] },
    ];
    const visitedBlocks = new Set<string>();
    visitedBlocks.add(`${startBlockRow},${startBlockCol}`);

    let coarseBlockPath: Array<{ br: number; bc: number }> | null = null;

    while (blockQueue.length > 0) {
      const curr = blockQueue.shift()!;
      if (curr.br === goalBlockRow && curr.bc === goalBlockCol) {
        coarseBlockPath = curr.path;
        break;
      }

      const neighbors = [
        { br: curr.br - 1, bc: curr.bc },
        { br: curr.br + 1, bc: curr.bc },
        { br: curr.br, bc: curr.bc - 1 },
        { br: curr.br, bc: curr.bc + 1 },
      ].filter(
        (b) => b.br >= 0 && b.br < numBlocks && b.bc >= 0 && b.bc < numBlocks,
      );

      for (const n of neighbors) {
        const key = `${n.br},${n.bc}`;
        const transKey = `${curr.br},${curr.bc}->${n.br},${n.bc}`;
        if (!visitedBlocks.has(key) && !blockedTransitions.has(transKey)) {
          visitedBlocks.add(key);
          blockQueue.push({ br: n.br, bc: n.bc, path: [...curr.path, n] });
        }
      }
    }

    if (!coarseBlockPath) {
      return { totalStatesExplored, plan: null }; // No coarse path available
    }

    // Level 1: Fine Search within each block along the coarse path
    let pathValid = true;
    const localPlan: string[] = [];
    let currState = { ...start };

    for (let i = 0; i < coarseBlockPath.length; i++) {
      const block = coarseBlockPath[i]!;
      const isLastBlock = i === coarseBlockPath.length - 1;

      const gist: GridGistBoundary = {
        minRow: block.br * blockSize,
        maxRow: Math.min(gridSize - 1, (block.br + 1) * blockSize - 1),
        minCol: block.bc * blockSize,
        maxCol: Math.min(gridSize - 1, (block.bc + 1) * blockSize - 1),
      };

      const inBlock = (s: GridState) => inGistBoundary(s, gist);

      let subGoalCheck: (s: GridState) => boolean;
      if (isLastBlock) {
        subGoalCheck = isGoal;
      } else {
        const nextBlock = coarseBlockPath[i + 1]!;
        // Target border cell towards next block
        subGoalCheck = (s: GridState) => {
          if (nextBlock.br > block.br) return s.row === gist.maxRow;
          if (nextBlock.br < block.br) return s.row === gist.minRow;
          if (nextBlock.bc > block.bc) return s.col === gist.maxCol;
          if (nextBlock.bc < block.bc) return s.col === gist.minCol;
          return false;
        };
      }

      const graph = exploreKeyed(
        keyOf,
        inBlock,
        actions,
        step,
        currState,
        maxStatesPerBlock,
      );

      totalStatesExplored += graph.stateCount;

      const subPlan = planTo(subGoalCheck, keyOf, graph);
      if (!subPlan) {
        pathValid = false;
        if (i < coarseBlockPath.length - 1) {
          const nextBlock = coarseBlockPath[i + 1]!;
          blockedTransitions.add(`${block.br},${block.bc}->${nextBlock.br},${nextBlock.bc}`);
        }
        break; // Trigger coarse replanning loop
      }

      localPlan.push(...subPlan);
      for (const a of subPlan) {
        currState = step(currState, a);
      }

      // Explicit boundary crossing step to enter next block
      if (!isLastBlock) {
        const nextBlock = coarseBlockPath[i + 1]!;
        const crossingAction = getCrossingAction(block, nextBlock);
        const entryState = step(currState, crossingAction);
        // Only take crossing action if state actually changes (not hitting outer wall)
        if (entryState.row !== currState.row || entryState.col !== currState.col) {
          localPlan.push(crossingAction);
          currState = entryState;
        }
      }
    }

    if (pathValid) {
      return {
        totalStatesExplored,
        plan: localPlan,
      };
    }
  }

  return {
    totalStatesExplored,
    plan: null,
  };
}
