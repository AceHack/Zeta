/**
 * Unit tests for the scorer in ISOLATION, over hand-built menus.
 *
 * Read the scope honestly: every menu below is written by hand, so these tests
 * describe what `score` computes and say nothing about what the loop does with
 * it. Measured 2026-08-15: the live cascade discards this scorer's output in
 * every enumerated world, so a green suite here is compatible with the weights
 * having zero effect on any decision. That is not a defect in these tests — it
 * is the reason they are not a falsifier for the weights, and it is why
 * `composer-register.test.ts` exists alongside them.
 */
import { describe, expect, test } from "bun:test";
import { unmeteredHeuristicComposer, unmeteredDefaultComposer } from "./composer";
import type { World, NextAction } from "./observe";

describe("composer — L2 heuristic scorer (unmetered; hand-built menus only)", () => {
  const readyItem = { id: "081KPYCJH0008QG0R003MDS51N", title: "Fix bug", ready: true, ambiguous: false };
  const ambiguousItem = { id: "081KQ0YZ80008QG0R002T6TM7Z", title: "Big refactor", ready: true, ambiguous: true };
  const workWorld: World = { backlog: [readyItem, ambiguousItem] };
  const freeWorld: World = { backlog: [], mode: "explore" };

  test("scores ready do_item higher than decompose", async () => {
    const menu: NextAction[] = [
      { kind: "do_item", item: readyItem },
      { kind: "decompose", item: ambiguousItem },
      { kind: "explore", reason: "nothing else" },
    ];
    const scores = await unmeteredDefaultComposer.score(menu, workWorld);
    expect(scores[0]).toBeGreaterThan(scores[1]!);
    expect(scores[0]).toBeGreaterThan(scores[2]!);
  });

  test("scores free modes higher when agent is in free mode", async () => {
    const menu: NextAction[] = [
      { kind: "do_item", item: readyItem },
      { kind: "explore", reason: "curiosity" },
    ];
    const scores = await unmeteredDefaultComposer.score(menu, freeWorld);
    expect(scores[1]).toBeGreaterThan(0.3);
  });

  test("forge boost lifts merge-pr items", async () => {
    const mergeItem = { id: "merge-pr-42", title: "Merge PR #42", ready: true, ambiguous: false };
    const regularItem = { id: "081KQB8J40008QG0R002PEP2A2", title: "Some task", ready: true, ambiguous: false };
    const menu: NextAction[] = [
      { kind: "do_item", item: regularItem },
      { kind: "do_item", item: mergeItem },
    ];
    const composer = unmeteredHeuristicComposer({ forgeBoost: 0.5, priority: 0.05 });
    const scores = await composer.score(menu, workWorld);
    expect(scores[1]).toBeGreaterThan(scores[0]!);
  });

  test("all scores between 0 and 1", async () => {
    const menu: NextAction[] = [
      { kind: "do_item", item: readyItem },
      { kind: "decompose", item: ambiguousItem },
      { kind: "explore", reason: "x" },
      { kind: "play", reason: "y" },
      { kind: "free_time", reason: "z" },
    ];
    const scores = await unmeteredDefaultComposer.score(menu, workWorld);
    for (const s of scores) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  test("custom weights shift scoring", async () => {
    const freeFirst = unmeteredHeuristicComposer({ modeCoherence: 0.9, readiness: 0.05 });
    const menu: NextAction[] = [
      { kind: "do_item", item: readyItem },
      { kind: "explore", reason: "curiosity" },
    ];
    const scores = await freeFirst.score(menu, freeWorld);
    expect(scores[1]).toBeGreaterThan(scores[0]!);
  });
});
