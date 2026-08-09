/**
 * agent-genome.ts — RGB/CMYK genetic codes for agent merging and reproduction.
 *
 * Based on: MeGA (2024), EvoMAS (2026), Genomebook (2026).
 *
 * ## The genetic encoding
 *
 * Each agent has a genome encoded as an RGB color:
 *   R = belief strength (0-255 → 0.0-1.0, maps to posterior precision)
 *   G = domain breadth (0-255 → 0.0-1.0, maps to number of active domains)
 *   B = exploration drive (0-255 → 0.0-1.0, maps to exploreBound k parameter)
 *
 * The CMYK extension adds a "Key" channel for domain specialisation:
 *   C = calibration weight (cyan = how much to trust calibration history)
 *   M = memory depth (magenta = how many past observations to retain)
 *   Y = yield threshold (yellow = when to defer to other agents)
 *   K = key domain (black = primary domain of expertise)
 *
 * ## Reproduction
 *
 * Asexual reproduction (cloning with mutation):
 *   child = mutate(parent, mutationRate)
 *
 * Sexual reproduction (crossover + mutation):
 *   child = mutate(crossover(parent1, parent2, crossoverPoint), mutationRate)
 *
 * ## Merging (MeGA-style)
 *
 * Two agents can merge their belief states by mixing their RGB genomes:
 *   merged = mix(agent1, agent2, weight)
 * where weight ∈ [0,1] is the mixing ratio (0 = agent1, 1 = agent2).
 *
 * The merged genome determines the merged agent's hyperparameters.
 *
 * ## Connection to the Zeta system
 *
 * The RGB genome maps directly to CalibrationLedger/TravelerRankLedger params:
 *   R → posterior precision (high R = high confidence, low variance)
 *   G → domain breadth (high G = generalist, low G = specialist)
 *   B → exploreBound k (high B = optimistic/exploratory, low B = conservative)
 *
 * The CMYK Key channel maps to the hat-domain in TravelerRankLedger.
 *
 * ## Honest scope boundary
 *
 * The neural alignment problem (permutation symmetry in weight-space crossover)
 * is NOT solved here. The genome encodes hyperparameters, not network weights.
 * For weight-space crossover, use the MeGA alignment algorithm (2024).
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** RGB genetic code (0-255 per channel). */
export interface RGBGenome {
  readonly r: number; // belief strength
  readonly g: number; // domain breadth
  readonly b: number; // exploration drive
}

/** CMYK extension for domain specialisation. */
export interface CMYKExtension {
  readonly c: number; // calibration weight
  readonly m: number; // memory depth
  readonly y: number; // yield threshold
  readonly k: number; // key domain index
}

/** Full agent genome: RGB + CMYK. */
export interface AgentGenome {
  readonly rgb: RGBGenome;
  readonly cmyk: CMYKExtension;
  /** Generation number (0 = founder). */
  readonly generation: number;
  /** Parent IDs (empty for founders, 1 for asexual, 2 for sexual). */
  readonly parentIds: string[];
}

/** The hyperparameters derived from the genome. */
export interface GenomeHyperparams {
  /** Posterior precision (R/255 * 10). High R = high confidence. */
  readonly posteriorPrecision: number;
  /** Domain breadth (G/255). 1.0 = generalist, 0.0 = narrow specialist. */
  readonly domainBreadth: number;
  /** Explore bound k (B/255 * 5). High B = optimistic. */
  readonly exploreBoundK: number;
  /** Calibration weight (C/255). */
  readonly calibrationWeight: number;
  /** Memory depth in ticks (M/255 * 1000). */
  readonly memoryDepth: number;
  /** Yield threshold (Y/255). Below this trustBand, defer to others. */
  readonly yieldThreshold: number;
  /** Key domain index. */
  readonly keyDomain: number;
}

// ── Constructors ───────────────────────────────────────────────────────────────

/** Create a founder genome from explicit RGB values. */
export function founderGenome(r: number, g: number, b: number): AgentGenome {
  return {
    rgb: { r: clamp8(r), g: clamp8(g), b: clamp8(b) },
    cmyk: { c: 128, m: 128, y: 128, k: 0 },
    generation: 0,
    parentIds: [],
  };
}

/** Create a genome from a hex color string (e.g. "#ff8040"). */
export function fromHex(hex: string): AgentGenome {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return founderGenome(r, g, b);
}

/** Convert genome to hex color string. */
export function toHex(genome: AgentGenome): string {
  const { r, g, b } = genome.rgb;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ── Hyperparameter derivation ──────────────────────────────────────────────────

export function toHyperparams(genome: AgentGenome): GenomeHyperparams {
  const { r, g, b } = genome.rgb;
  const { c, m, y, k } = genome.cmyk;
  return {
    posteriorPrecision: (r / 255) * 10,
    domainBreadth: g / 255,
    exploreBoundK: (b / 255) * 5,
    calibrationWeight: c / 255,
    memoryDepth: Math.round((m / 255) * 1000),
    yieldThreshold: y / 255,
    keyDomain: k,
  };
}

// ── Mutation ───────────────────────────────────────────────────────────────────

/**
 * Mutate a genome by adding Gaussian noise to each channel.
 * mutationRate ∈ [0,1]: 0 = no mutation, 1 = full random.
 */
export function mutate(
  genome: AgentGenome,
  parentId: string,
  mutationRate = 0.05,
  rng: () => number = Math.random
): AgentGenome {
  const noise = () => Math.round((rng() * 2 - 1) * mutationRate * 255);
  return {
    rgb: {
      r: clamp8(genome.rgb.r + noise()),
      g: clamp8(genome.rgb.g + noise()),
      b: clamp8(genome.rgb.b + noise()),
    },
    cmyk: {
      c: clamp8(genome.cmyk.c + noise()),
      m: clamp8(genome.cmyk.m + noise()),
      y: clamp8(genome.cmyk.y + noise()),
      k: genome.cmyk.k, // key domain is inherited, not mutated
    },
    generation: genome.generation + 1,
    parentIds: [parentId],
  };
}

// ── Crossover (sexual reproduction) ───────────────────────────────────────────

/**
 * Single-point crossover of two genomes.
 * crossoverPoint ∈ [0,7]: 0-2 = RGB channels, 3-6 = CMYK channels.
 */
export function crossover(
  parent1: AgentGenome,
  parent2: AgentGenome,
  parent1Id: string,
  parent2Id: string,
  crossoverPoint: number
): AgentGenome {
  // cp ∈ [0,7]: channels[0..cp-1] from parent1, channels[cp..6] from parent2.
  // cp=0: all from parent2. cp=7: all from parent1.
  // Bug fixed: was clamped to 6, making k (index 6) always come from parent2 and
  // "all from parent1" (cp=7) unreachable. Clamp to 7 to fix.
  const cp = Math.max(0, Math.min(7, Math.round(crossoverPoint)));
  const channels = [
    parent1.rgb.r, parent1.rgb.g, parent1.rgb.b,
    parent1.cmyk.c, parent1.cmyk.m, parent1.cmyk.y, parent1.cmyk.k,
  ];
  const channels2 = [
    parent2.rgb.r, parent2.rgb.g, parent2.rgb.b,
    parent2.cmyk.c, parent2.cmyk.m, parent2.cmyk.y, parent2.cmyk.k,
  ];
  // channels.map produces exactly 7 elements; channels2[i] is always defined (same-length map).
  const child = channels.map((v, i) => i < cp ? v : channels2[i]!);
  return {
    // Non-null: channels.map produces exactly 7 elements (same as input array length).
    // The element type is number|undefined due to noUncheckedIndexedAccess, but each
    // element is always assigned by the map callback — the assertion is safe.
    rgb: { r: child[0]!, g: child[1]!, b: child[2]! },
    cmyk: { c: child[3]!, m: child[4]!, y: child[5]!, k: child[6]! },
    generation: Math.max(parent1.generation, parent2.generation) + 1,
    parentIds: [parent1Id, parent2Id],
  };
}

// ── Merging (MeGA-style) ───────────────────────────────────────────────────────

/**
 * Mix two genomes by linear interpolation.
 * weight ∈ [0,1]: 0 = genome1, 1 = genome2.
 */
export function mix(
  genome1: AgentGenome,
  genome2: AgentGenome,
  id1: string,
  id2: string,
  weight = 0.5
): AgentGenome {
  const lerp = (a: number, b: number) => clamp8(Math.round(a * (1 - weight) + b * weight));
  return {
    rgb: {
      r: lerp(genome1.rgb.r, genome2.rgb.r),
      g: lerp(genome1.rgb.g, genome2.rgb.g),
      b: lerp(genome1.rgb.b, genome2.rgb.b),
    },
    cmyk: {
      c: lerp(genome1.cmyk.c, genome2.cmyk.c),
      m: lerp(genome1.cmyk.m, genome2.cmyk.m),
      y: lerp(genome1.cmyk.y, genome2.cmyk.y),
      k: weight < 0.5 ? genome1.cmyk.k : genome2.cmyk.k, // key domain from dominant parent
    },
    generation: Math.max(genome1.generation, genome2.generation) + 1,
    parentIds: [id1, id2],
  };
}

// ── Fitness ────────────────────────────────────────────────────────────────────

/**
 * Genetic distance between two genomes (Euclidean in RGB space).
 * 0 = identical, sqrt(3·255²) ≈ 441 = maximally different.
 */
export function geneticDistance(a: AgentGenome, b: AgentGenome): number {
  const dr = a.rgb.r - b.rgb.r;
  const dg = a.rgb.g - b.rgb.g;
  const db = a.rgb.b - b.rgb.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * The "hue" of a genome — the dominant trait direction.
 * Returns "red" (belief), "green" (breadth), or "blue" (exploration).
 */
export function dominantTrait(genome: AgentGenome): "belief" | "breadth" | "exploration" {
  const { r, g, b } = genome.rgb;
  if (r >= g && r >= b) return "belief";
  if (g >= r && g >= b) return "breadth";
  return "exploration";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function clamp8(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}
