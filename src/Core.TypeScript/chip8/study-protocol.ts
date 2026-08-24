/**
 * study-protocol.ts — the deterministic core of D6's prediction falsifier
 * (?study=1 in twitch-ai; spec #14503).
 *
 * D6 decides whether D1–D5 worked: if watching the overlay does not raise a
 * viewer's ability to predict the agent's next move, the overlay is
 * decoration and the honest move is to cut it. Comprehensibility asserted is
 * not comprehensibility measured.
 *
 * The spec named accuracy-with vs accuracy-without. Two control conditions
 * were missing and are added here (the refutation the spec's author asked
 * for):
 *
 *  - **placebo** — the same frost/fixation VISUALS driven by deterministic
 *    noise decoupled from the screen. Without it, "overlay helps" cannot be
 *    told apart from "any overlay engages the viewer more". Δ(full − placebo)
 *    is the field's informational value; Δ(placebo − none) is the engagement
 *    effect.
 *  - **arrow-only** — mode + intent arrow, no boxes, no field. The
 *    upstream-dominance test: if this condition predicts as well as full,
 *    the density claim is dominated by something upstream of the field.
 *
 * Everything here is a pure function of its arguments — counterbalancing by
 * Latin square over the trial index, scoring by dominant-axis displacement,
 * placebo pixels by an integer hash of (cycle, tile). No wall clock, no
 * Math.random (noninterference: the study must replay).
 */

export type StudyCondition = "full" | "none" | "placebo" | "arrow-only";

export const STUDY_CONDITIONS: readonly StudyCondition[] = [
  "full",
  "none",
  "placebo",
  "arrow-only",
];

/**
 * Latin-square counterbalancing: within each block of four trials every
 * condition appears once, and the block index rotates the order so every
 * condition also visits every position across four consecutive blocks.
 */
export function conditionFor(trialIx: number): StudyCondition {
  const block = Math.floor(trialIx / STUDY_CONDITIONS.length);
  const pos = trialIx % STUDY_CONDITIONS.length;
  return STUDY_CONDITIONS[(pos + block) % STUDY_CONDITIONS.length] ?? "full";
}

export type StudyDirection = "up" | "down" | "left" | "right";

/**
 * The answer key: net displacement over the horizon → its dominant axis.
 * A move under `minPx` on both axes is "the agent held still" — the trial
 * is unanswerable and must be DISCARDED (returning null), never scored as
 * a miss; a discarded trial is reported, not hidden. Axis ties break to
 * the horizontal (stated, so the key is deterministic).
 */
export function actualDirection(dx: number, dy: number, minPx = 1): StudyDirection | null {
  if (Math.abs(dx) < minPx && Math.abs(dy) < minPx) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "down" : "up";
}

export interface StudyTrial {
  readonly condition: StudyCondition;
  readonly guess: StudyDirection;
  /** null = the agent held still over the horizon; the trial is discarded. */
  readonly actual: StudyDirection | null;
}

export interface ConditionScore {
  readonly n: number;
  readonly correct: number;
}

export interface StudyTally {
  readonly byCondition: Readonly<Record<StudyCondition, ConditionScore>>;
  readonly discarded: number;
  readonly total: number;
}

export function tallyTrials(trials: readonly StudyTrial[]): StudyTally {
  const byCondition: Record<StudyCondition, { n: number; correct: number }> = {
    full: { n: 0, correct: 0 },
    none: { n: 0, correct: 0 },
    placebo: { n: 0, correct: 0 },
    "arrow-only": { n: 0, correct: 0 },
  };
  let discarded = 0;
  for (const t of trials) {
    if (t.actual === null) {
      discarded += 1;
      continue;
    }
    const cell = byCondition[t.condition];
    cell.n += 1;
    if (t.guess === t.actual) cell.correct += 1;
  }
  return { byCondition, discarded, total: trials.length };
}

/** One line for the page: "full 3/4 · none 1/4 · placebo 2/4 · arrow 2/3 · 1 held still". */
export function summarizeTally(t: StudyTally): string {
  const cell = (c: StudyCondition): string => {
    const s = t.byCondition[c];
    return `${String(s.correct)}/${String(s.n)}`;
  };
  const parts = [
    `full ${cell("full")}`,
    `none ${cell("none")}`,
    `placebo ${cell("placebo")}`,
    `arrow ${cell("arrow-only")}`,
  ];
  if (t.discarded > 0) parts.push(`${String(t.discarded)} held still`);
  return parts.join(" · ");
}

/** Chance level for the 4-way probe — printed beside the tallies. */
export const STUDY_CHANCE = 0.25;

// ── The placebo field ─────────────────────────────────────────────────────

/** 32-bit integer mix (xorshift-multiply); pure, replayable. */
function hash2(a: number, b: number): number {
  let h = (a | 0) ^ ((b | 0) * 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** hash2 scaled to [0, 1). */
function unit(a: number, b: number): number {
  return hash2(a, b) / 0x100000000;
}

export interface PlaceboField {
  /** Fake per-tile "variance" in [0,1] — same visual dynamic range as a live field. */
  readonly variance: readonly number[];
  /** Fake attended set (visual parity with the top-K ring count). */
  readonly attended: readonly number[];
  /** Fake fixation tile, dwelling several ticks like the real latch does. */
  readonly fixation: number;
}

/**
 * The placebo attention field: LOOKS like a live field (a few frosted tiles,
 * an attended ring set, a fixation that dwells and saccades), but its content
 * is a pure function of the cycle counter — decoupled from the screen, so it
 * carries zero information about the game. Changing slowly (epoch = cycle/24)
 * matches the real field's settle-and-move rhythm rather than flickering.
 */
export function placeboAttention(cycle: number, tileCount = 32, topK = 8): PlaceboField {
  const epoch = Math.floor(cycle / 24);
  const variance: number[] = [];
  for (let t = 0; t < tileCount; t++) {
    const u = unit(epoch, t);
    // Most tiles clear, a few frosted — the live field's usual silhouette.
    variance.push(u > 0.72 ? (u - 0.72) / 0.28 : 0);
  }
  const order = variance
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v || a.i - b.i)
    .map((e) => e.i);
  const attended = order.slice(0, topK);
  const fixation = attended[hash2(epoch, 0xbeef) % Math.max(1, attended.length)] ?? 0;
  return { variance, attended, fixation };
}
