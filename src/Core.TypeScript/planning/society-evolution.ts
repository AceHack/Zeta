/**
 * society-evolution.ts — Evolutionary loop wiring CalibrationLedger × AgentGenome × ThousandBrains.
 *
 * This is the missing bridge between the genome layer and the society layer.
 * It implements a generational evolutionary algorithm over a population of agents,
 * where fitness is calibration score (coverage-at-τ from CalibrationLedger) and
 * reproduction uses AgentGenome crossover + mutation.
 *
 * ## Architecture
 *
 * ```
 * observe.ts ──→ CalibrationLedger ──→ fitness score per agent
 *                                          ↓
 * AgentGenome ←── crossover + mutate ←── selection (top-k survive)
 *      ↓
 * ThousandBrains columns ←── genome → hyperparams → column prior
 *      ↓
 * SocietyBootstrap EP consensus ──→ joint posterior over shared latent
 *      ↓
 * GossipSalon ──→ transport-agnostic broadcast (Reticulum / WebSocket / Git)
 * ```
 *
 * ## Connection to reservoir computing
 *
 * The society IS a reservoir computer in the Echo State Network sense:
 * - Each ThousandBrains column is a reservoir node with a local state (Gaussian belief).
 * - The EP message passing is the reservoir dynamics (fixed, not trained).
 * - The readout layer is the joint posterior — the "output" of the reservoir.
 * - The genome encodes the reservoir's input weights (column priors).
 * - Evolution trains the input weights, not the reservoir dynamics.
 * This is the key insight: we get reservoir computing for free from the EP society,
 * and evolution trains the input projection without touching the dynamics.
 *
 * ## Connection to Clifford / Adinkra / hexagonal math
 *
 * The Adinkra [8,4,4] ECC code (adinkra-ecc-prototype.ts) provides:
 * - Error-correcting codes for genome transmission over noisy gossip channels.
 * - The 8-bit codeword maps to the 7-channel genome (RGB + CMYK) + 1 parity bit.
 * - The doubly-even self-dual property ensures the genome is recoverable from 1-bit errors.
 * The hexagonal quantum arithmetic (quantum-arith.ts) provides:
 * - Blaschke maps for the HL conformal amplitude (Z-2 falsifier).
 * - Born probabilities for the ThousandBrains column voting weights.
 * - The tsirelsonS constant (2√2) as the CHSH bound for the society's decorrelation meter.
 *
 * ## Connection to bidirectional audio with interruption
 *
 * The StudentTBnn (heavy-tail EP) handles audio amplitude measurements:
 * - Audio is heavy-tailed (clicks, pops, room noise are outliers).
 * - The robustness weight w = (ν+1)/(ν+z²) downweights audio outliers automatically.
 * - Interruption is modelled as a sudden large residual z → w → 0 (observation ignored).
 * - The BNN posterior survives interruption: it simply doesn't update on the outlier frame.
 * This is "interruption as first-class" in the Bayesian sense: no special case needed,
 * the heavy-tail likelihood handles it algebraically.
 *
 * ## Connection to GitHub agent society
 *
 * The evolutionary loop can run as a GitHub Actions cron job:
 * 1. Each agent is a GitHub identity (Manus session / bot account).
 * 2. Calibration scores are read from the CalibrationLedger JSON in the repo.
 * 3. Crossover produces new agent configs committed to the repo.
 * 4. The GossipSalon broadcasts the new generation via the Git transport.
 * The language adapter needed: a Git-transport gossip relay that maps
 * GossipSalon rumors to Git commits (already partially in place via the
 * heartbeat/metrics commit pattern in pages-deploy.yml).
 *
 * ## References
 *
 * - Jaeger (2001) "The echo state approach to analysing and training RNNs"
 * - Maass (2002) "Real-time computing without stable states: A new framework for neural computation"
 * - Friedkin & Johnsen (1990) "Social influence and opinions" (affective propagation)
 * - Hawkins (2021) "A Thousand Brains" (column voting)
 * - Minka (2001) "EP for approximate Bayesian inference" (society consensus)
 * - Gneiting & Raftery (2007) "Strictly proper scoring rules" (calibration fitness)
 * - MeGA (2024) "Model merging by Gaussian elimination" (genome crossover)
 */

import { type AgentGenome, crossover, mutate, geneticDistance } from "./agent-genome";
import { type CalibrationPosterior, trustBound } from "./calibration-ledger";

// ── Types ──────────────────────────────────────────────────────────────────────

/** A single agent in the evolutionary society. */
export interface SocietyAgent {
  readonly id: string;
  readonly genome: AgentGenome;
  /** The agent's calibration posterior (per-hat). */
  readonly calibration: CalibrationPosterior;
  /** The agent's fitness score (trustBound from calibration). */
  readonly fitness: number;
}

/** The evolutionary society: a population of agents + generation counter. */
export interface Society {
  readonly agents: readonly SocietyAgent[];
  readonly generation: number;
  /** The mean fitness of the population. */
  readonly meanFitness: number;
  /** The spread (max − min) of fitness scores. */
  readonly fitnessSpread: number;
  /** The mean genetic distance between all agent pairs (diversity metric). */
  readonly geneticDiversity: number;
}

/** Parameters for one evolutionary step. */
export interface EvolutionParams {
  /** Fraction of population that survives (top-k selection). */
  readonly survivalRate: number;
  /** Mutation rate for offspring. */
  readonly mutationRate: number;
  /** Whether to use sexual reproduction (crossover) or asexual (clone + mutate). */
  readonly sexual: boolean;
  /** Optional RNG for deterministic testing. */
  readonly rng?: () => number;
}

export const DEFAULT_EVOLUTION_PARAMS: EvolutionParams = {
  survivalRate: 0.5,
  mutationRate: 0.05,
  sexual: true,
};

// ── Construction ───────────────────────────────────────────────────────────────

/**
 * Create a new society agent with a given genome and calibration state.
 * Fitness is computed from the calibration's trustBound (μ − kσ).
 */
export function createAgent(
  id: string,
  genome: AgentGenome,
  calibration: CalibrationPosterior,
): SocietyAgent {
  const fitness = trustBound(calibration);
  return { id, genome, calibration, fitness };
}

/**
 * Create a new society from a list of agents.
 * Computes population statistics (mean fitness, spread, diversity).
 */
export function createSociety(agents: readonly SocietyAgent[], generation: number): Society {
  if (agents.length === 0) {
    return { agents, generation, meanFitness: 0, fitnessSpread: 0, geneticDiversity: 0 };
  }
  const fitnesses = agents.map(a => a.fitness);
  const meanFitness = fitnesses.reduce((s, f) => s + f, 0) / fitnesses.length;
  const maxF = Math.max(...fitnesses);
  const minF = Math.min(...fitnesses);
  const fitnessSpread = maxF - minF;

  // Mean pairwise genetic distance (diversity)
  let totalDist = 0;
  let pairs = 0;
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      totalDist += geneticDistance(agents[i]!.genome, agents[j]!.genome);
      pairs++;
    }
  }
  const geneticDiversity = pairs > 0 ? totalDist / pairs : 0;

  return { agents, generation, meanFitness, fitnessSpread, geneticDiversity };
}

// ── Evolutionary step ──────────────────────────────────────────────────────────

/**
 * Run one generation of evolution:
 * 1. Sort agents by fitness (descending).
 * 2. Keep top-k survivors (k = ceil(n * survivalRate)).
 * 3. Fill the remaining slots with offspring:
 *    - Sexual: crossover two random survivors + mutate.
 *    - Asexual: clone a random survivor + mutate.
 * 4. Return the new society with generation + 1.
 *
 * The calibration state of offspring is reset to the prior (Beta(2,2) / fresh start).
 * This is correct: offspring have not yet made predictions.
 *
 * ## Honest scope boundary
 *
 * This implements the simplest possible evolutionary algorithm (µ+λ selection).
 * It does NOT implement:
 * - Niching / speciation (to prevent premature convergence)
 * - Elitism beyond top-k (e.g. hall of fame)
 * - Fitness sharing (to maintain diversity)
 * - Multi-objective optimisation (e.g. fitness + diversity simultaneously)
 * These are all valid extensions; the current implementation is the minimal
 * working loop that closes the genome → calibration → selection → reproduction cycle.
 */
export function evolve(society: Society, params: EvolutionParams = DEFAULT_EVOLUTION_PARAMS): Society {
  const { agents, generation } = society;
  if (agents.length === 0) return { ...society, generation: generation + 1 };

  const rng = params.rng ?? Math.random;

  // 1. Sort by fitness (descending)
  const sorted = [...agents].sort((a, b) => b.fitness - a.fitness);

  // 2. Select survivors
  const k = Math.max(1, Math.ceil(agents.length * params.survivalRate));
  const survivors = sorted.slice(0, k);

  // 3. Generate offspring to fill remaining slots
  const offspring: SocietyAgent[] = [];
  const needed = agents.length - k;

  for (let i = 0; i < needed; i++) {
    const parentIdx = Math.floor(rng() * survivors.length);
    const parent1 = survivors[parentIdx]!;

    let childGenome: AgentGenome;
    if (params.sexual && survivors.length >= 2) {
      // Sexual: pick a different parent2
      let parent2Idx = Math.floor(rng() * (survivors.length - 1));
      if (parent2Idx >= parentIdx) parent2Idx++;
      const parent2 = survivors[parent2Idx]!;
      const crossoverPoint = Math.floor(rng() * 8); // 0-7 (7 channels + 1 for all-from-p1)
      childGenome = mutate(
        crossover(parent1.genome, parent2.genome, parent1.id, parent2.id, crossoverPoint),
        `${parent1.id}×${parent2.id}`,
        params.mutationRate,
        rng,
      );
    } else {
      // Asexual: clone + mutate
      childGenome = mutate(parent1.genome, parent1.id, params.mutationRate, rng);
    }

    const childId = `gen${generation + 1}-${i}`;
    // Fresh calibration prior for offspring (Beta(2,2) → μ=0.5, σ≈0.22, no observations)
    const freshCalibration: CalibrationPosterior = {
      zid: childId,
      hatId: "default",
      mu: 0.5,          // Beta(2,2) mean
      sigma: 0.2236,    // Beta(2,2) σ = sqrt(2·2/(4·4·5)) ≈ 0.2236
      settledCount: 0,
    };
    offspring.push(createAgent(childId, childGenome, freshCalibration));
  }

  const newAgents = [...survivors, ...offspring];
  return createSociety(newAgents, generation + 1);
}

// ── Reservoir computing view ───────────────────────────────────────────────────

/**
 * The "reservoir readout" of the society: the mean genome vector.
 * In Echo State Network terms, this is the readout layer's input.
 * The reservoir dynamics (EP message passing) are fixed; only the
 * input projection (genome) is trained by evolution.
 *
 * Returns the mean RGB + CMYK channels across all agents.
 */
export function reservoirReadout(society: Society): {
  r: number; g: number; b: number; c: number; m: number; y: number; k: number;
} {
  const n = society.agents.length;
  if (n === 0) return { r: 0, g: 0, b: 0, c: 0, m: 0, y: 0, k: 0 };
  const sum = society.agents.reduce(
    (acc, a) => ({
      r: acc.r + a.genome.rgb.r,
      g: acc.g + a.genome.rgb.g,
      b: acc.b + a.genome.rgb.b,
      c: acc.c + a.genome.cmyk.c,
      m: acc.m + a.genome.cmyk.m,
      y: acc.y + a.genome.cmyk.y,
      k: acc.k + a.genome.cmyk.k,
    }),
    { r: 0, g: 0, b: 0, c: 0, m: 0, y: 0, k: 0 },
  );
  return {
    r: sum.r / n, g: sum.g / n, b: sum.b / n,
    c: sum.c / n, m: sum.m / n, y: sum.y / n, k: sum.k / n,
  };
}

/**
 * Adinkra ECC encoding of a genome for gossip transport.
 * Maps the 7-channel genome (RGB + CMYK) to an 8-bit codeword
 * using the [8,4,4] extended Hamming code structure.
 *
 * The 8th bit is a parity bit derived from the XOR of all 7 channels' MSBs.
 * This gives 1-bit error detection over the gossip channel.
 *
 * For full [8,4,4] ECC (1-bit error correction), use adinkra-ecc-prototype.ts.
 */
export function genomeToAdinkraByte(genome: AgentGenome): number {
  const channels = [
    genome.rgb.r, genome.rgb.g, genome.rgb.b,
    genome.cmyk.c, genome.cmyk.m, genome.cmyk.y, genome.cmyk.k,
  ];
  // Take MSB of each channel (bit 7)
  const bits = channels.map(c => (c >> 7) & 1);
  // Parity bit = XOR of all 7 bits
  const parity = bits.reduce((a, b) => a ^ b, 0);
  return (bits.reduce((acc, b, i) => acc | (b << i), 0)) | (parity << 7);
}
