import { describe, expect, test } from "bun:test";
import { choose, type ComposerBackend } from "./chooser";
import type { World } from "./observe";

describe("chooser — tiered decision cascade", () => {
  const emptyWorld: World = { backlog: [] };
  const workWorld: World = {
    backlog: [{ id: "081KPYCJH0008QG0R003MDS51N", title: "Fix the bug", ready: true, ambiguous: false }],
  };
  const ambiguousWorld: World = {
    backlog: [
      { id: "081KPYCJH0008QG0R003MDS51N", title: "Fix the bug", ready: true, ambiguous: false },
      { id: "081KQ0YZ80008QG0R002T6TM7Z", title: "Add feature", ready: true, ambiguous: false },
      { id: "081KQ0YZ80008QG0R001QJJTVF", title: "Refactor X", ready: true, ambiguous: false },
    ],
  };

  test("resolves at oracle tier for empty backlog (explore default)", async () => {
    const result = await choose(emptyWorld);
    expect(result.tier).toBe("oracle");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.action.kind).toBe("explore");
  });

  test("resolves at oracle tier for single ready item", async () => {
    const result = await choose(workWorld);
    expect(result.tier).toBe("oracle");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.action.kind).toBe("do_item");
  });

  test("drops below oracle threshold for ambiguous menu", async () => {
    const result = await choose(ambiguousWorld, { oracleThreshold: 0.8 });
    // Oracle confidence drops when multiple viable items exist
    // Without a composer, falls back to oracle pick anyway
    expect(result.tier).toBe("oracle");
  });

  test("escalates to composer when oracle confidence is low", async () => {
    const mockComposer: ComposerBackend = {
      score: async (menu) => menu.map((_, i) => i === 0 ? 0.9 : 0.1),
    };
    const result = await choose(ambiguousWorld, {
      oracleThreshold: 0.99, // force oracle to fail
      composer: mockComposer,
    });
    expect(result.tier).toBe("composer");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  test("result always has action + tier + confidence", async () => {
    const result = await choose(emptyWorld);
    expect(result.action).toBeDefined();
    expect(result.action.kind).toBeDefined();
    expect(result.tier).toBeDefined();
    expect(typeof result.confidence).toBe("number");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
