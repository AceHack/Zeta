/**
 * rho-threshold-sweep.ts — pre-registered evaluator for YinYang reseed thresholds.
 *
 * This module deliberately does not simulate an agent, CHIP-8 game, or learning
 * result. It only analyzes independently recorded episode outcomes. A threshold
 * therefore cannot "win" by construction: missing, unbalanced, duplicated, or
 * out-of-contract observations return no verdict.
 *
 * The live 1/(3√2) value is a design choice from the rho=S/12 identification,
 * not a Tsirelson bound. 2√2 is a CHSH correlator bound and is not a valid rho
 * threshold because rho must lie in [0,1]. See the paired pre-registration.
 */

export const RHO_T_DESIGN = 1 / (3 * Math.SQRT2);

/** Fixed before outcome data are accepted. All values are rho-scale quantities. */
export const PREREGISTERED_RHO_THRESHOLDS = [
  0.1,
  1 / 6,
  RHO_T_DESIGN,
  0.28,
  1 / 3,
  0.45,
] as const;

export type PreregisteredThreshold = (typeof PREREGISTERED_RHO_THRESHOLDS)[number];

export interface RhoSweepEpisode {
  readonly threshold: number;
  readonly seed: string;
  readonly taskId: string;
  readonly episode: number;
  readonly solved: boolean;
  /** Positive action count consumed by the episode. */
  readonly actions: number;
  /** Immutable identity of the captured trajectory or receipt. */
  readonly sourceArtifact: string;
}

export interface ThresholdScore {
  readonly threshold: number;
  readonly solvedEpisodes: number;
  readonly totalEpisodes: number;
  readonly totalActions: number;
  /** Primary pre-registered metric: solved episodes per action. Higher is better. */
  readonly acquisitionEfficiency: number;
}

export type RhoSweepVerdict =
  | {
      readonly kind: "winner";
      readonly winner: number;
      readonly scores: readonly ThresholdScore[];
    }
  | {
      readonly kind: "tie";
      readonly tiedThresholds: readonly number[];
      readonly scores: readonly ThresholdScore[];
    }
  | {
      readonly kind: "no-verdict";
      readonly reason: string;
    };

const EPSILON = 1e-12;

function sameThreshold(left: number, right: number): boolean {
  return Math.abs(left - right) <= EPSILON;
}

function isRegisteredThreshold(threshold: number): boolean {
  return PREREGISTERED_RHO_THRESHOLDS.some((candidate) => sameThreshold(candidate, threshold));
}

function validateEpisode(episode: RhoSweepEpisode): string | undefined {
  if (!Number.isFinite(episode.threshold) || episode.threshold < 0 || episode.threshold > 1) {
    return `threshold ${episode.threshold} is outside the rho domain [0,1]`;
  }
  if (!isRegisteredThreshold(episode.threshold)) {
    return `threshold ${episode.threshold} is not in the pre-registered sweep`;
  }
  if (episode.seed.length === 0 || episode.taskId.length === 0 || episode.sourceArtifact.length === 0) {
    return "seed, taskId, and sourceArtifact must be non-empty";
  }
  if (!Number.isSafeInteger(episode.episode) || episode.episode < 0) {
    return `episode ${episode.episode} must be a non-negative safe integer`;
  }
  if (!Number.isSafeInteger(episode.actions) || episode.actions <= 0) {
    return `actions ${episode.actions} must be a positive safe integer`;
  }
  return undefined;
}

function scoreThreshold(threshold: number, episodes: readonly RhoSweepEpisode[]): ThresholdScore {
  const atThreshold = episodes.filter((episode) => sameThreshold(episode.threshold, threshold));
  const solvedEpisodes = atThreshold.filter((episode) => episode.solved).length;
  const totalActions = atThreshold.reduce((sum, episode) => sum + episode.actions, 0);
  return {
    threshold,
    solvedEpisodes,
    totalEpisodes: atThreshold.length,
    totalActions,
    acquisitionEfficiency: solvedEpisodes / totalActions,
  };
}

/**
 * Evaluate recorded outcomes against the fixed six-threshold protocol.
 *
 * Balance is a load-bearing requirement: every (seed, taskId, episode) cell must
 * appear exactly once at every threshold. This prevents an apparent winner from
 * receiving easier tasks, extra attempts, or a different episode horizon.
 */
export function evaluatePreregisteredRhoSweep(episodes: readonly RhoSweepEpisode[]): RhoSweepVerdict {
  if (episodes.length === 0) {
    return { kind: "no-verdict", reason: "no recorded CHIP-8/ARC episode outcomes were supplied" };
  }

  const seen = new Set<string>();
  const cells = new Map<string, Set<number>>();
  for (const episode of episodes) {
    const problem = validateEpisode(episode);
    if (problem !== undefined) return { kind: "no-verdict", reason: problem };

    const key = `${episode.threshold}|${episode.seed}|${episode.taskId}|${episode.episode}`;
    if (seen.has(key)) return { kind: "no-verdict", reason: `duplicate episode cell ${key}` };
    seen.add(key);

    const cellKey = `${episode.seed}|${episode.taskId}|${episode.episode}`;
    const thresholds = cells.get(cellKey) ?? new Set<number>();
    thresholds.add(episode.threshold);
    cells.set(cellKey, thresholds);
  }

  for (const [cell, thresholds] of cells) {
    if (thresholds.size !== PREREGISTERED_RHO_THRESHOLDS.length) {
      return {
        kind: "no-verdict",
        reason: `unbalanced cell ${cell}: expected ${PREREGISTERED_RHO_THRESHOLDS.length} thresholds, received ${thresholds.size}`,
      };
    }
  }

  const scores = PREREGISTERED_RHO_THRESHOLDS.map((threshold) => scoreThreshold(threshold, episodes));
  const best = Math.max(...scores.map((score) => score.acquisitionEfficiency));
  const tiedThresholds = scores
    .filter((score) => Math.abs(score.acquisitionEfficiency - best) <= EPSILON)
    .map((score) => score.threshold);

  if (tiedThresholds.length !== 1) return { kind: "tie", tiedThresholds, scores };
  return { kind: "winner", winner: tiedThresholds[0]!, scores };
}

/** The design threshold earns retention only by being the unique empirical winner. */
export function designThresholdRetained(verdict: RhoSweepVerdict): boolean {
  return verdict.kind === "winner" && sameThreshold(verdict.winner, RHO_T_DESIGN);
}
