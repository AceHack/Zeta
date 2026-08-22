/**
 * observe/composer.ts — L2 Composer backend for the Chooser. **UNMETERED.**
 *
 * Scores menu options without calling an LLM using cheap signals:
 * readiness, priority, mode coherence, forge boost, operator boost.
 *
 * ## Register: `unmetered` — implemented, called on the live tick, never falsified
 *
 * Per `.claude/rules/toy-is-free-metered-must-be-earned.md` the three states are
 * `toy` · `unmetered` · `metered`, and this module is the middle one, stated out
 * loud because unlabelled work reads as "real" by default. It is **not** `toy` —
 * `service/loop-tick.ts` calls it on every autonomous tick and
 * `observe/room/git/rooms.ts` calls it per backlog room. It is **not** `metered` —
 * the five weights below are hand-set, nothing refutes them, and no measurement
 * produced them.
 *
 * ## What was measured (2026-08-15), so the label is not a guess
 *
 * Over the 504-world enumeration in `composer-register.test.ts`, called exactly as
 * the live tick calls it (`choose(world, { composer: unmeteredDefaultComposer })` —
 * a composer, no deliberator, default thresholds):
 *
 * - `score()` IS invoked — in **156 of 504** worlds, on menus of **14–16** options.
 *   Never the ≤ 1 that would make the tier trivially skippable. The port is live.
 * - Its result is **adopted in 0 of them.** `chooser.ts` keeps the composer's pick
 *   only when `confidence >= composerThreshold` (0.7); at these weights the highest
 *   confidence anywhere in the escalated space is **0.4272**. Below threshold with
 *   no deliberator wired, `choose` falls back to the oracle pick and the scores are
 *   discarded.
 * - Setting **all five weights to zero** changes the action the loop takes in
 *   **0 of 504** worlds, and the reported tier in 0 of them.
 *
 * So at the shipped values these weights are decorative on the live path: they are
 * computed every escalated tick and thrown away. That is the honest reason there is
 * no falsifier for them here — **there is presently nothing to falsify.** A test
 * asserting "the scorer ranks X above Y" would be checking a value the system does
 * not use (`composer.test.ts` does exactly that against hand-built menus, which is
 * why it passes while the live path ignores the result).
 *
 * ## Not dead by construction — dead at these values
 *
 * The cascade is not broken. With `readiness = 1` and the other four at 0, the tier
 * fires in **28 of the same 504** worlds and overrides the oracle's pick in all 28.
 * The shipped vector is a dead point inside a live space, not a disabled feature.
 * Two mechanisms keep it there, both worth knowing before anyone tunes:
 *
 * 1. `buildMenu` always emits the four free modes plus grammar/cartography/time
 *    options, so the runner-up score is never small; a 70 % gap is hard to open.
 * 2. `scoreAction` clamps to `[0, 1]`. Large weights **saturate** — measured with
 *    `readiness = 1, modeCoherence = 1`, several options hit 1.0, the gap collapses,
 *    and the top confidence over the whole space falls to **0.0000**, adopted in 0
 *    worlds. Raising weights can make the tier *less* likely to fire, not more.
 *
 * Weights are deliberately NOT tuned here: changing values that nothing can refute
 * is motion, not progress, and it would destroy whatever accidental calibration the
 * current vector has.
 *
 * The tripwire lives in `composer-register.test.ts` — it pins both halves (the port
 * is live; its output is discarded) with a positive control proving the harness can
 * see adoption when adoption happens. If it goes red, an unmetered model just became
 * load-bearing and the metering conversation is owed.
 *
 * Composes with: observe/chooser.ts (Sequoia cascade), observe/observe.ts (types).
 */

import type { NextAction, World, Mode } from "./observe";
import type { ComposerBackend } from "./chooser";

interface ComposerWeights {
  readonly readiness: number;
  readonly priority: number;
  readonly modeCoherence: number;
  readonly forgeBoost: number;
  readonly operatorBoost: number;
}

/**
 * `unmetered` — five hand-set constants with no falsifier and no measurement
 * behind them. Named so the register travels with the value. See the module
 * header for what was measured about their (absent) effect on the live tick.
 */
const UNMETERED_DEFAULT_WEIGHTS: ComposerWeights = {
  readiness: 0.3,
  priority: 0.2,
  modeCoherence: 0.25,
  forgeBoost: 0.15,
  operatorBoost: 0.1,
};

function modeFamily(kind: string): "work" | "free" | "operator" | "meta" {
  switch (kind) {
    case "preserve_ferry": case "respond_to_operator": return "operator";
    case "do_item": case "decompose": return "work";
    case "explore": case "play": case "self_reflect": case "free_time": return "free";
    case "edit_grammar": return "meta";
    default: return "work";
  }
}

function currentModeFamily(mode: Mode | undefined): "work" | "free" | "operator" | "meta" {
  if (!mode) return "work";
  switch (mode) {
    case "explore": case "play": case "self_reflect": case "free_time": return "free";
    default: return "work";
  }
}

function scoreAction(action: NextAction, index: number, menuSize: number, world: World, weights: ComposerWeights): number {
  let score = 0;
  if (action.kind === "do_item" && action.item.ready && !action.item.ambiguous) score += weights.readiness;
  else if (action.kind === "decompose") score += weights.readiness * 0.5;
  else if (modeFamily(action.kind) === "free") score += weights.readiness * 0.3;

  score += weights.priority * (1 - (index / Math.max(menuSize - 1, 1)));

  const agentFamily = currentModeFamily(world.mode);
  const actionFamily = modeFamily(action.kind);
  if (agentFamily === actionFamily) score += weights.modeCoherence;
  else if (agentFamily === "free" && actionFamily === "work") score += weights.modeCoherence * 0.4;

  if (action.kind === "do_item" && action.item.id.startsWith("merge-pr-")) score += weights.forgeBoost;
  if (actionFamily === "operator") score += weights.operatorBoost;

  return Math.min(1, Math.max(0, score));
}

/**
 * `unmetered` scorer factory. The name carries the register to every call site,
 * because a reader of `choose(world, { composer: … })` cannot otherwise tell
 * whether the scorer behind the port has ever been checked. It has not.
 */
export function unmeteredHeuristicComposer(weights?: Partial<ComposerWeights>): ComposerBackend {
  const w: ComposerWeights = { ...UNMETERED_DEFAULT_WEIGHTS, ...weights };
  return {
    score: async (menu: readonly NextAction[], world: World): Promise<readonly number[]> => {
      return menu.map((action, index) => scoreAction(action, index, menu.length, world, w));
    },
  };
}

/** `unmetered` — the instance wired into the live tick and the git rooms. */
export const unmeteredDefaultComposer: ComposerBackend = unmeteredHeuristicComposer();
