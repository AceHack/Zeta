/**
 * composer-register.test.ts — the tripwire for an `unmetered` model on the live tick.
 *
 * `service/loop-tick.ts` and `observe/room/git/rooms.ts` both call
 * `choose(world, { composer: unmeteredDefaultComposer })` — a real pluggable port
 * (`ComposerBackend`) backed by five hand-set weights that nothing refutes.
 * `.claude/rules/toy-is-free-metered-must-be-earned.md` puts that in the `unmetered`
 * state and asks for the register to be said out loud.
 *
 * This file does NOT assert that the weights are right — nothing here could, because
 * the measurement below is that **the live path throws the scores away**. What it
 * pins is the pair of facts that make "unmetered" the honest label rather than a
 * guess, in a form that goes red if either half stops being true:
 *
 *   1. THE PORT IS LIVE. `score()` really is invoked by the cascade on the config
 *      the tick uses. Without this half, someone could turn (2) green by disabling
 *      the composer, which would be the vacuity class — a check that cannot fail.
 *   2. AT THE SHIPPED WEIGHTS THE RESULT IS DISCARDED. `chooser.ts` keeps the
 *      composer's pick only when `confidence >= 0.7`; these weights never get there,
 *      and with no deliberator wired `choose` falls back to the oracle's pick.
 *
 * A RED HERE IS NOT NECESSARILY A REGRESSION. If (2) fails, the composer has started
 * deciding what the loop does — which may well be an improvement, and is exactly the
 * moment the model stops being decorative and owes a falsifier. Read the failure as
 * "an unmetered model just became load-bearing", not as "put it back".
 *
 * The positive control (last test) is load-bearing: it shows this harness CAN observe
 * adoption when adoption happens, so the zero in (2) is a measurement and not a blind
 * spot.
 */
import { describe, expect, test } from "bun:test";
import { choose, type ComposerBackend } from "./chooser";
import { unmeteredDefaultComposer, unmeteredHeuristicComposer } from "./composer";
import { observe, type BacklogItem, type Mode, type NextAction, type World } from "./observe";

const ready: BacklogItem = { id: "081M0AAA0008QG0R000READY0", title: "ready", ready: true, ambiguous: false };
const ambiguous: BacklogItem = { id: "081M0BBB0008QG0R000AMBIG0", title: "ambiguous", ready: true, ambiguous: true };
const needsAction: BacklogItem = {
  id: "081M0CCC0008QG0R000EXTEND",
  title: "needs new action",
  ready: false,
  ambiguous: false,
  needsNewAction: true,
};

const backlogs: readonly (readonly BacklogItem[])[] = [
  [],
  [ready],
  [ambiguous],
  [needsAction],
  [ready, ambiguous],
  [ambiguous, needsAction],
  [ready, ambiguous, needsAction],
];
const modes: readonly (Mode | undefined)[] = [undefined, "work", "explore", "play", "self_reflect", "free_time"];
const operators: readonly (World["operator"] | undefined)[] = [
  undefined,
  { pendingMessage: false, pendingFerry: false },
  { pendingMessage: true, pendingFerry: false },
  { pendingMessage: false, pendingFerry: true },
];
const sessions: readonly (World["nodeSession"] | undefined)[] = [
  undefined,
  { credentials: {}, complete: false, cloudHelpersOffered: false } as World["nodeSession"],
  { credentials: {}, complete: true, cloudHelpersOffered: true } as World["nodeSession"],
];

/** The reachable `World` space, enumerated over the channels `observe`/`buildMenu` read. */
function enumerateWorlds(): World[] {
  const out: World[] = [];
  for (const backlog of backlogs)
    for (const mode of modes)
      for (const operator of operators)
        for (const nodeSession of sessions)
          out.push({
            backlog,
            ...(mode ? { mode } : {}),
            ...(operator ? { operator } : {}),
            ...(nodeSession ? { nodeSession } : {}),
          });
  return out;
}

/** Identity of a chosen action, for comparing two picks. */
const actionKey = (a: NextAction): string =>
  `${a.kind}:${"item" in a ? (a.item?.id ?? "") : ""}:${"direction" in a ? a.direction : ""}`;

/** Counts the cascade's behaviour over the whole space for one backend. */
async function survey(backend: ComposerBackend) {
  const worlds = enumerateWorlds();
  let scoreCalls = 0;
  let composerTier = 0;
  let flippedFromOracle = 0;
  const spy: ComposerBackend = {
    score: async (menu, world) => {
      scoreCalls++;
      return backend.score(menu, world);
    },
  };
  for (const world of worlds) {
    // EXACTLY the live tick's config: a composer, no deliberator, default thresholds.
    const result = await choose(world, { composer: spy });
    if (result.tier === "composer") {
      composerTier++;
      if (actionKey(result.action) !== actionKey(observe(world))) flippedFromOracle++;
    }
  }
  return { worlds: worlds.length, scoreCalls, composerTier, flippedFromOracle };
}

describe("composer register — an `unmetered` model on the live tick", () => {
  test("the port is LIVE: the cascade really calls score() on the tick's own config", async () => {
    const s = await survey(unmeteredDefaultComposer);
    // Guards against making the next test pass by unplugging the composer.
    expect(s.scoreCalls).toBeGreaterThan(0);
  });

  test("at the shipped weights the composer's result is ADOPTED IN NO WORLD", async () => {
    const s = await survey(unmeteredDefaultComposer);
    // If this goes red the composer has started deciding: meter it, do not revert it.
    expect(s.composerTier).toBe(0);
  });

  test("all five weights set to ZERO changes nothing the loop does", async () => {
    const zeroed = unmeteredHeuristicComposer({
      readiness: 0,
      priority: 0,
      modeCoherence: 0,
      forgeBoost: 0,
      operatorBoost: 0,
    });
    const worlds = enumerateWorlds();
    let differs = 0;
    for (const world of worlds) {
      const base = await choose(world, { composer: unmeteredDefaultComposer });
      const zero = await choose(world, { composer: zeroed });
      if (actionKey(base.action) !== actionKey(zero.action) || base.tier !== zero.tier) differs++;
    }
    // The maximally-wrong weight vector is indistinguishable from the shipped one at
    // the only place that matters: the action taken. That IS the unmetered finding.
    expect(differs).toBe(0);
  });

  test("POSITIVE CONTROL — the harness can see adoption, so the zeros above are a measurement", async () => {
    // Not a proposal and not a tuning: `readiness` alone is simply a vector that
    // clears the 0.7 gap, proving the tier is reachable and the cascade is not broken.
    const readinessOnly = unmeteredHeuristicComposer({
      readiness: 1,
      priority: 0,
      modeCoherence: 0,
      forgeBoost: 0,
      operatorBoost: 0,
    });
    const s = await survey(readinessOnly);
    expect(s.composerTier).toBeGreaterThan(0);
    // And when it is adopted it genuinely overrides the oracle — so "adopted" is not
    // a distinction without a difference.
    expect(s.flippedFromOracle).toBeGreaterThan(0);
  });
});
