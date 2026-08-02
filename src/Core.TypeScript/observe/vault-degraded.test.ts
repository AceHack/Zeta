/**
 * vault-degraded.test.ts — the render path that never runs in development.
 *
 * With both files present locally the degraded branches never execute, so nothing catches them
 * being wrong until a fetch actually fails — which is the day it matters most. That is why Iris
 * put this BEFORE the happy path in the build order, and why the logic is a pure function: every
 * branch is reachable here instead of requiring devtools and a blocked request.
 */

import { describe, expect, test } from "bun:test";
import {
  type FetchOutcome,
  type FetchState,
  MAX_SPINNER_MS,
  NOT_OBSERVED,
  regionPlan,
  renderMode,
} from "./vault-degraded.ts";

const ok: FetchOutcome = { kind: "ok" };
const gone: FetchOutcome = { kind: "unreachable" };
const wrongShape: FetchOutcome = { kind: "schema-mismatch", saw: "zeta.vault-state.v0" };
const cached = (ageMs: number): FetchOutcome => ({ kind: "cached", ageMs });
const fetches = (roster: FetchOutcome, state: FetchOutcome): FetchState => ({ roster, state });

describe("THE MODE THE SPLIT EXISTS FOR: roster survives, state does not", () => {
  test("roster ok + state unreachable is roster-only, not a blank page", () => {
    // The entire benefit of the hub/satellite split. A page that blanks here has thrown it away.
    expect(renderMode(fetches(ok, gone))).toBe("roster-only");
  });

  test("roster-only still draws the topology", () => {
    // Rooms and vaults are real and known — the roster IS that knowledge. Refusing to draw them
    // because their state is unknown discards information we actually have.
    expect(regionPlan("roster-only").drawTopology).toBe(true);
  });

  test("roster-only draws NO confidence bars", () => {
    // Not zero-length bars — no bars. A zero-length bar is a measurement of zero; the absence of
    // a bar is the honest absence. This is the distinction the whole withheld register rests on.
    const plan = regionPlan("roster-only");
    expect(plan.drawConfidenceBars).toBe(false);
    expect(plan.drawActivityLogs).toBe(false);
  });

  test("roster-only says WHY it cannot see", () => {
    const plan = regionPlan("roster-only");
    expect(plan.provenance).toContain("state unreachable");
    expect(plan.provenance).toContain("not observed");
  });
});

describe("a failed fetch is OUR blindness, not the society's failure", () => {
  test("chips go to the withheld register, never the status register", () => {
    // Red means `heat` — actively failing. Colouring an unreachable fetch red would accuse the
    // dwellers of our own inability to observe them.
    expect(regionPlan("roster-only").chipRegister).toBe("withheld");
    expect(regionPlan("nothing-to-draw").chipRegister).toBe("withheld");
  });

  test("a healthy render uses the status register", () => {
    // The negative control: if everything were withheld, "withheld" would carry no information.
    expect(regionPlan("full").chipRegister).toBe("status");
  });
});

describe("schema mismatch is a failure, not a parsing opportunity", () => {
  test("an unrecognised state schema degrades to roster-only", () => {
    // Half-reading an unknown shape into a confident render is worse than saying we cannot read
    // it. Better to draw the topology and admit the state is unreadable.
    expect(renderMode(fetches(ok, wrongShape))).toBe("roster-only");
  });

  test("an unrecognised ROSTER schema leaves nothing to draw", () => {
    expect(renderMode(fetches(wrongShape, ok))).toBe("nothing-to-draw");
  });
});

describe("nothing-to-draw requires the HUB to be gone", () => {
  test("no roster means no topology — there is genuinely nothing to render", () => {
    expect(renderMode(fetches(gone, ok))).toBe("nothing-to-draw");
    expect(renderMode(fetches(gone, gone))).toBe("nothing-to-draw");
    expect(regionPlan("nothing-to-draw").drawTopology).toBe(false);
  });

  test("it is the ONLY mode that draws no topology", () => {
    // A guard against the failure mode where every degraded path collapses to a blank page.
    for (const mode of ["full", "cached", "roster-only"] as const) {
      expect(regionPlan(mode).drawTopology).toBe(true);
    }
  });
});

describe("cache is surfaced, never presented as the present", () => {
  test("a cached state renders, and says so", () => {
    expect(renderMode(fetches(ok, cached(4 * 60 * 60 * 1000)))).toBe("cached");
    expect(regionPlan("cached").provenance).toContain("cache");
  });

  test("cached still draws bars — the data is real, merely old", () => {
    // Freshness comes from the frame timestamp, not from fetch success, so an old cache renders
    // cold on its own. Withholding the bars too would double-count the staleness.
    expect(regionPlan("cached").drawConfidenceBars).toBe(true);
  });
});

describe("dwellers are never invented", () => {
  test("roster-only does not place dwellers in rooms", () => {
    // Placement needs `room_id` / `default_agent_id` on roster hats, which are not on main yet.
    // Drawing dwellers from a hardcoded page-side map would be the page asserting a fact the data
    // did not give it — the exact over-claim this whole contract exists to prevent. They render in
    // an unplaced tray instead. FLIP THIS when the roster carries placement.
    expect(regionPlan("roster-only").drawDwellersInRooms).toBe(false);
  });

  test("a full render does place them", () => {
    expect(regionPlan("full").drawDwellersInRooms).toBe(true);
  });
});

describe("the page commits rather than spinning", () => {
  test("the spinner ceiling is five seconds", () => {
    // An indefinite spinner is a page refusing to say what it knows — and after five seconds what
    // it knows is "I cannot reach this", which the reader is entitled to.
    expect(MAX_SPINNER_MS).toBe(5000);
  });

  test("the withheld marker is a mark, not a number", () => {
    // Never `0`, never `-`, never an empty string: each of those is a claim about a value.
    expect(NOT_OBSERVED).toContain("not observed");
    expect(NOT_OBSERVED).not.toMatch(/^[0\-—–]/);
  });
});

describe("every mode has a plan — no undefined regions", () => {
  test("all four modes return a complete plan", () => {
    // A mode with an undefined region is a region that renders however the framework defaults,
    // which is the shape that produces a blank panel nobody can explain.
    for (const mode of ["full", "cached", "roster-only", "nothing-to-draw"] as const) {
      const plan = regionPlan(mode);
      expect(typeof plan.drawTopology).toBe("boolean");
      expect(typeof plan.drawConfidenceBars).toBe("boolean");
      expect(typeof plan.drawActivityLogs).toBe("boolean");
      expect(typeof plan.drawDwellersInRooms).toBe("boolean");
      expect(["status", "withheld"]).toContain(plan.chipRegister);
    }
  });

  test("bars are never drawn without the state that fills them", () => {
    // The invariant across modes: a bar implies readable state. Violating it is how a zero-value
    // bar appears in the first place.
    for (const mode of ["roster-only", "nothing-to-draw"] as const) {
      expect(regionPlan(mode).drawConfidenceBars).toBe(false);
    }
  });
});
