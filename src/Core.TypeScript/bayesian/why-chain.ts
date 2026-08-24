/**
 * why-chain.ts — the WHY button's answer generator (D5 of #14503).
 *
 * Click the agent, get one sentence; click again, get the next one down;
 * the chain MUST reach "I don't know."
 *
 * The hard constraint, quoted from the spec because it is the whole value
 * of the feature: every answer must be GENERATED FROM THE STATE THAT
 * ACTUALLY DROVE THE DECISION — the variance field, the attended tile, the
 * latch that fired — and never from a hand-written string table. A canned
 * explanation is the vacuity class wearing a teaching voice: it looks like
 * an explanation and it cannot be wrong, therefore it cannot be right.
 *
 * What that means mechanically here: the SENTENCE FRAMES below are
 * necessarily words, but every frame INTERPOLATES live values from the
 * WhyContext (positions, posterior means, counts, the fixation tile), and
 * the acceptance test asserts that each non-terminal answer cites at least
 * one numeric value that round-trips exactly to the context it was
 * generated from. Change the state and the answers change; a stale or
 * fabricated answer cannot survive the test.
 *
 * The reachable "I don't know." is the FEATURE, not the failure: every
 * chain bottoms out (the mode values rest on a seeded prior whose own
 * justification the agent does not hold), which is the four-register
 * discipline in a UI — let unknown be unknown.
 *
 * Disclosure discipline (spec §8): every answer describes what the agent's
 * own state IS — never an inferred why about someone else.
 */

import type { ModeChoice } from "./mode-value-learner";

/** The numbers that drove the tick's decision, trimmed for the wire. */
export interface WhyContext {
  /** "explore" | "hunt" | "flee" (the latch's current output). */
  readonly mode: string;
  /** The context bucket the mode decision was made in, if one existed. */
  readonly bucket: { readonly bigAdversary: boolean; readonly closing: boolean } | null;
  /** Learned value of each mode in that bucket (posterior means). */
  readonly huntValue: number | null;
  readonly fleeValue: number | null;
  /** Score-change events the learner has eaten so far. */
  readonly rewardEvents: number;
  /** Adversary relation, if one is tracked. */
  readonly adversary: { readonly dist: number; readonly closingSpeed: number } | null;
  /** Exploration progress, ticks done over the total. */
  readonly explore: { readonly done: number; readonly total: number };
  /** The fixation tile and its predictive variance (what is being watched). */
  readonly fixation: { readonly tile: number; readonly variance: number } | null;
}

/** The terminal answer — reachable from every chain, by construction. */
export const WHY_TERMINAL = "I don't know.";

const fmt = (x: number): string => (Number.isInteger(x) ? String(x) : x.toFixed(2));

function exploreChain(ctx: WhyContext): string[] {
  const chain = [
    `I am still probing which shape answers to my keys — probe tick ${fmt(ctx.explore.done)} of ${fmt(ctx.explore.total)}.`,
    `Until something moves when I press, no aim is mine to explain.`,
  ];
  return chain;
}

/** The steering rung: what the agent is doing about the adversary right now. */
function steeringAnswer(ctx: WhyContext, mode: ModeChoice): string {
  if (!ctx.adversary) {
    return `I hold ${mode} with no adversary in track — nothing to steer against.`;
  }
  const size = ctx.bucket?.bigAdversary ? "big" : "small";
  const closing = ctx.adversary.closingSpeed > 0 ? "shrinking" : "not shrinking";
  const gap = fmt(ctx.adversary.dist);
  if (mode === "hunt") {
    return `I am closing on the ${size} shape — the gap is ${gap} pixels and ${closing}.`;
  }
  return `I am opening the gap from the ${size} shape — it is ${gap} pixels away and the gap is ${closing}.`;
}

function modeChain(ctx: WhyContext, mode: ModeChoice): string[] {
  const chain: string[] = [steeringAnswer(ctx, mode)];
  if (ctx.huntValue !== null && ctx.fleeValue !== null) {
    chain.push(
      `In this context, hunting has been worth ${fmt(ctx.huntValue)} to me and fleeing ${fmt(ctx.fleeValue)} — I take the better one.`,
    );
  }
  chain.push(
    ctx.rewardEvents > 0
      ? `Those worths come from ${fmt(ctx.rewardEvents)} score changes I read off the board myself.`
      : `Those worths are still my starting guess — I have read 0 score changes off the board so far.`,
  );
  if (ctx.fixation) {
    // The frame is conditional ON THE STATE: a settled field must not claim
    // to be surprised (caught live — "keeps surprising me (variance 0.00)").
    const v = fmt(ctx.fixation.variance);
    chain.push(
      v === "0.00"
        ? `My gaze rests on tile ${fmt(ctx.fixation.tile)} — nothing on screen is surprising me right now (variance ${v}).`
        : `I watch where I predict worst — tile ${fmt(ctx.fixation.tile)} keeps surprising me (variance ${v}).`,
    );
  }
  chain.push(`Why the score should matter to me at all — that is where my reasons stop.`);
  return chain;
}

/**
 * The full chain for one decision, terminalised. Index it with the click
 * count; past the end, the answer stays the terminal.
 */
export function whyChain(ctx: WhyContext): readonly string[] {
  const body =
    ctx.mode === "hunt" || ctx.mode === "flee"
      ? modeChain(ctx, ctx.mode)
      : exploreChain(ctx);
  return [...body, WHY_TERMINAL];
}

/** The answer for the Nth click (0-based); saturates at the terminal. */
export function whyAnswer(ctx: WhyContext, depth: number): string {
  const chain = whyChain(ctx);
  const clamped = Math.max(0, Math.min(chain.length - 1, depth));
  return chain[clamped] ?? WHY_TERMINAL;
}
