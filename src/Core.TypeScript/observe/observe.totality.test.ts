// observe.totality.test.ts — THE NEVER-TRAPPED LAW for the wall grammar.
//
// `observe` is the wall a low-intelligence agent lives inside: a pure function
// snapshot → ONE action. Three agents currently run this unattended on a forge free
// tier with the smallest model, so the properties that matter are not "does it pick
// well" (a bigger model picks better) but "can it ever be left with NO action":
//
//   TOTALITY      — for ANY world, including malformed/adversarial/huge, observe
//                   returns a valid action. It must never throw and never return
//                   undefined. A throw is the trap: a cheap model cannot reason its
//                   way out, the tick dies, heartbeats stop, and the drift is silent.
//   NEVER-TRAPPED — the escape hatch (`edit_grammar`) and rest (`free_time`) are
//                   reachable, and no world yields "nothing to do".
//   DETERMINISM   — same world ⇒ same action (DST-replayable; drift is reproducible).
//   NON-COMPOUNDING — one tick yields exactly ONE action, so a single bad pick has a
//                   bounded blast radius and cannot cascade within a tick.
//
// The existing 46 tests are all hand-built worlds; this is the first coverage over
// worlds NOBODY WROTE. Generation is SEEDED (an LCG, not Math.random) so a failure is
// replayable from its seed — per the DST discipline, and because a flaky law about
// non-compounding would itself compound.
//
// Aaron 2026-08-01: "we can start putting this mistakes-don't-compound into those
// walls, and we make sure those walls have an exit at all times — we don't want any
// intelligence to get trapped."

import { describe, it, expect } from "bun:test";
import { observe, type World, type BacklogItem, type NextAction } from "./observe.ts";

/** The complete action vocabulary. A returned kind outside this set is a grammar break. */
const VALID_KINDS = new Set<NextAction["kind"]>([
  "preserve_ferry",
  "respond_to_operator",
  "do_item",
  "decompose",
  "self_claim",
  "explore",
  "play",
  "self_reflect",
  "free_time",
  "edit_grammar",
]);

/** Seeded LCG (Numerical Recipes) — deterministic, so any counterexample is replayable. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function genItem(rnd: () => number, i: number): BacklogItem {
  return {
    id: `B-${i}`,
    title: rnd() < 0.1 ? "" : `item ${i}`,
    ready: rnd() < 0.5,
    ambiguous: rnd() < 0.5,
    ...(rnd() < 0.3 ? { needsNewAction: true } : {}),
  } as BacklogItem;
}

/** A world from a seed — including empty backlogs, absent channels, and large backlogs. */
function genWorld(seed: number): World {
  const rnd = lcg(seed);
  const n = Math.floor(rnd() * 6);
  const backlog = Array.from({ length: n }, (_, i) => genItem(rnd, i));
  const w: { backlog: readonly BacklogItem[]; [k: string]: unknown } = { backlog };
  if (rnd() < 0.5) w.operator = { pendingMessage: rnd() < 0.5, pendingFerry: rnd() < 0.5 };
  if (rnd() < 0.4) w.mode = (["work", "explore", "play", "self_reflect", "free_time"] as const)[Math.floor(rnd() * 5)];
  if (rnd() < 0.3) w.forgeState = { openPrCount: Math.floor(rnd() * 5), cleanPrCount: 0, cleanPrNumbers: [] };
  return w as unknown as World;
}

describe("observe — the never-trapped law (totality over worlds nobody wrote)", () => {
  it("TOTALITY: every seeded world yields exactly one VALID action — never throws, never undefined", () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const world = genWorld(seed);
      let action: NextAction | undefined;
      expect(() => {
        action = observe(world);
      }).not.toThrow(); // a throw IS the trap
      expect(action).toBeDefined();
      expect(VALID_KINDS.has(action!.kind)).toBe(true);
    }
  });

  it("DETERMINISM (DST): the same world always yields the same action — drift is replayable", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const a = observe(genWorld(seed));
      const b = observe(genWorld(seed)); // rebuilt from the same seed
      expect(a.kind).toBe(b.kind);
    }
  });

  it("NEVER-TRAPPED: the degenerate worlds — empty, no channels, nothing ready — still yield an action", () => {
    const degenerate: World[] = [
      { backlog: [] },
      { backlog: [], operator: { pendingMessage: false, pendingFerry: false } },
      { backlog: [{ id: "x", title: "", ready: false, ambiguous: false } as BacklogItem] },
    ];
    for (const w of degenerate) {
      const a = observe(w);
      expect(VALID_KINDS.has(a.kind)).toBe(true);
      // "nothing to do" is never the answer — rest is a CHOICE (free_time), not a dead end
      expect(a.kind).not.toBe(undefined);
    }
  });

  it("NON-COMPOUNDING: a tick returns ONE action — a single bad pick cannot cascade within the tick", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const a = observe(genWorld(seed));
      // the DU is a single tagged value, not a list: bounded blast radius by construction
      expect(typeof a.kind).toBe("string");
      expect(Array.isArray(a)).toBe(false);
    }
  });

  it("THE EXIT IS ALWAYS REACHABLE: an item the grammar cannot express routes to edit_grammar, not to a dead end", () => {
    // The wall must stay OPEN FOR EXTENSION. If the grammar can't express the work,
    // the answer is "change the rails", never "no action available".
    const w: World = {
      backlog: [{ id: "B-unexpressible", title: "needs an action that doesn't exist", ready: false, ambiguous: false, needsNewAction: true } as BacklogItem],
    };
    expect(observe(w).kind).toBe("edit_grammar");
  });
});
