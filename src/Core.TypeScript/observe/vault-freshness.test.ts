/**
 * vault-freshness.test.ts — the page-side half of "a stopped society can never render live".
 *
 * The adapter has this property and it is tested there. This is the OTHER end: the adapter can be
 * perfectly honest and the page still lie, by computing freshness once at load and never again.
 * Verified against the shipped snapshot earlier today — `status: "live"` sat above dwellers whose
 * newest `last_seen` was seven hours old. The page must not repeat that, and monotonicity is what
 * stops it.
 *
 * Time is injected everywhere. No mocked globals, no ambient clock — same discipline as the
 * adapter, so these replay deterministically.
 */

import { describe, expect, test } from "bun:test";
import {
  type Status,
  LIVE_WITHIN_MS,
  RETICK_MS,
  STALE_WITHIN_MS,
  combine,
  freshness,
  hasHeat,
  statusOf,
  worst,
} from "./vault-freshness.ts";

const NOW = Date.parse("2026-08-02T12:00:00.000Z");
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const ago = (ms: number): string => new Date(NOW - ms).toISOString();

describe("THE LOAD-BEARING PROPERTY: age can only ever make the reading worse", () => {
  test("live → stale → cold as the timestamp ages", () => {
    expect(freshness(ago(1 * MIN), NOW)).toBe("live");
    expect(freshness(ago(90 * MIN), NOW)).toBe("stale");
    expect(freshness(ago(30 * HOUR), NOW)).toBe("cold");
  });

  test("the measured real cadence (~65min) reads STALE, not live", () => {
    // Grounded in the actual system, not a round number: the heartbeat declares */15 but ran at
    // 63/71/65/86/66-minute intervals. Under the contract that is honestly "stale" — running, but
    // not at declared cadence. A threshold that called this live would hide the exact gap that
    // motivated self-hosted runners.
    expect(freshness(ago(65 * MIN), NOW)).toBe("stale");
  });

  test("a seven-hour-old timestamp is cold — the case the shipped snapshot got wrong", () => {
    expect(freshness(ago(7 * HOUR), NOW)).toBe("cold");
  });
});

describe("boundaries are pinned on both sides", () => {
  test("just under 30 minutes is live; just over is not", () => {
    expect(freshness(ago(LIVE_WITHIN_MS - MIN), NOW)).toBe("live");
    expect(freshness(ago(LIVE_WITHIN_MS + MIN), NOW)).not.toBe("live");
  });

  test("just under 2 hours is stale; just over is cold", () => {
    expect(freshness(ago(STALE_WITHIN_MS - MIN), NOW)).toBe("stale");
    expect(freshness(ago(STALE_WITHIN_MS + MIN), NOW)).toBe("cold");
  });
});

describe("absence is not a measurement", () => {
  test("null, undefined and empty are UNOBSERVED, never cold", () => {
    // "We have no measurement" differs from "we measured and it is cold", and the page renders
    // them differently (hatched violet vs dim). Collapsing them would be the over-claim the
    // withheld register exists to prevent.
    for (const missing of [null, undefined, ""]) {
      expect(freshness(missing, NOW)).toBe("unobserved");
    }
  });

  test("unparseable input is unobserved, not a reading", () => {
    // An unparseable timestamp must not become a confident status — that is the shape that lets a
    // malformed feed render as healthy.
    for (const junk of ["not-a-date", "2026-13-45T99:99:99Z", "{}"]) {
      expect(freshness(junk, NOW)).toBe("unobserved");
    }
  });

  test("input that PARSES to something ancient reads cold — the fail-safe direction", () => {
    // `Date.parse("0")` is 946702800000 (year 2000) — JS reads a bare "0" as a year. So it is not
    // unparseable, and claiming otherwise would be a test asserting a fiction. What matters is
    // that it lands on the SAFE side: ancient reads cold, never live.
    expect(freshness("0", NOW)).toBe("cold");
  });

  test("NOTHING malformed can ever read as live — the property that actually matters", () => {
    // The generalisation. Whether a junk value parses is a JS detail; what the page cannot afford
    // is any of them rendering as alive.
    for (const junk of ["not-a-date", "2026-13-45T99:99:99Z", "{}", "0", "", null, undefined]) {
      expect(freshness(junk, NOW)).not.toBe("live");
    }
  });
});

describe("monotonicity — a parent never renders fresher than its evidence", () => {
  test("combine takes the LEAST alive", () => {
    expect(combine("live", "cold")).toBe("cold");
    expect(combine("live", "stale")).toBe("stale");
    expect(combine("stale", "cold")).toBe("cold");
    expect(combine("live", "live")).toBe("live");
  });

  test("combine is commutative — order of evidence cannot change the verdict", () => {
    const all: Status[] = ["live", "stale", "cold", "heat"];
    for (const a of all) for (const b of all) {
      expect(combine(a, b)).toBe(combine(b, a));
    }
  });

  test("worst over no candidates is cold — unknown never reads alive", () => {
    expect(worst([])).toBe("cold");
  });

  test("one cold child drags a live parent down", () => {
    // The snapshot bug in one line: a fresh pipeline frame must not paint a silent society green.
    expect(worst(["live", "live", "cold"])).toBe("cold");
  });
});

describe("heat is absorbing, and it ages out", () => {
  test("a recent failure reads heat even beside a fresh frame", () => {
    const status = statusOf([ago(1 * MIN)], [{ at: ago(10 * MIN), kind: "heartbeat.failure" }], NOW);
    expect(status).toBe("heat");
  });

  test("heat survives combine from either side", () => {
    expect(combine("heat", "live")).toBe("heat");
    expect(combine("live", "heat")).toBe("heat");
  });

  test("an OLD failure does not scar permanently", () => {
    // Recovery has to be observable or the signal dies and nobody reads it.
    const status = statusOf([ago(1 * MIN)], [{ at: ago(6 * HOUR), kind: "heartbeat.failure" }], NOW);
    expect(status).toBe("live");
  });

  test("only failure-shaped kinds count as heat", () => {
    expect(hasHeat([{ at: ago(1 * MIN), kind: "commit" }], NOW)).toBe(false);
    expect(hasHeat([{ at: ago(1 * MIN), kind: "build.error" }], NOW)).toBe(true);
    expect(hasHeat([{ at: ago(1 * MIN), kind: "TEST.FAILED" }], NOW)).toBe(true);
  });
});

describe("statusOf — unobserved candidates are dropped, not counted as cold", () => {
  test("one live timestamp beside an absent one stays live", () => {
    // A scope that is live-but-incompletely-observed should say so; the absence is marked
    // separately by the withheld register rather than dragging the whole scope down.
    expect(statusOf([ago(1 * MIN), null], [], NOW)).toBe("live");
  });

  test("all-unobserved falls back to cold", () => {
    expect(statusOf([null, undefined], [], NOW)).toBe("cold");
  });
});

describe("time is genuinely an input", () => {
  test("advancing only nowMs changes the reading", () => {
    // The negative control for the whole module. If output were constant under a moving clock,
    // the page could compute once at load and still pass — which is the exact bug this prevents.
    const stamp = ago(10 * MIN);
    expect(freshness(stamp, NOW)).toBe("live");
    expect(freshness(stamp, NOW + 5 * HOUR)).toBe("cold");
  });

  test("the re-tick interval is one minute", () => {
    // Exported so the page and the tests agree on one number, and so "did anyone wire the timer"
    // is answerable by grep. A tab open at 09:00 must not still read live at 17:00.
    expect(RETICK_MS).toBe(60 * 1000);
  });
});
