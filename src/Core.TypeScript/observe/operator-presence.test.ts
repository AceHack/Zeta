// Tests for operator presence. The two properties that matter pull in OPPOSITE directions and
// both must hold: the signal FAILS SAFE TO SLOW (never to fast), and it CANNOT SILENCE the
// society (speed is modulated, existence is guaranteed).

import { describe, it, expect } from "bun:test";
import {
  decideTick,
  makeBurst,
  minutesBetween,
  MAX_IDLE_MIN,
  DEFAULT_IDLE_MIN,
  DEFAULT_BURST_MIN,
} from "./operator-presence.ts";

const NOW = "2026-08-01T18:00:00.000Z";
const ago = (min: number) => new Date(Date.parse(NOW) - min * 60000).toISOString();

describe("fails safe to SLOW — never to fast", () => {
  it("no presence file ⇒ idle cadence", () => {
    const d = decideTick(null, NOW, ago(30));
    expect(d.cadence).toBe("idle");
    expect(d.proceed).toBe(false); // 30m elapsed < 240m idle
  });

  it("MALFORMED json ⇒ idle, not burst (a corrupt file must not pin the society at full speed)", () => {
    const d = decideTick("{ this is not json", NOW, ago(30));
    expect(d.cadence).toBe("idle");
    expect(d.proceed).toBe(false);
  });

  it("EXPIRED burst window ⇒ idle, with no cleanup required", () => {
    const expired = JSON.stringify({ burstUntil: ago(60) });
    expect(decideTick(expired, NOW, ago(30)).cadence).toBe("idle");
  });

  it("UNPARSEABLE burstUntil ⇒ idle (only a valid FUTURE instant counts as a claim)", () => {
    expect(decideTick(JSON.stringify({ burstUntil: "soon" }), NOW, ago(30)).cadence).toBe("idle");
    expect(decideTick(JSON.stringify({ burstUntil: "" }), NOW, ago(30)).cadence).toBe("idle");
  });

  it("NEGATIVE CONTROL: a VALID future window really does grant burst — the tests above are not vacuous", () => {
    const live = JSON.stringify(makeBurst(NOW, 4));
    const d = decideTick(live, NOW, ago(20));
    expect(d.cadence).toBe("burst");
    expect(d.intervalMin).toBe(DEFAULT_BURST_MIN);
    expect(d.proceed).toBe(true); // 20m elapsed >= 15m burst
  });
});

describe("cannot SILENCE the society — speed is modulated, existence is guaranteed", () => {
  it("an absurd idleIntervalMin is CLAMPED to the 6h ceiling, not honoured", () => {
    // Without the clamp this parseable config would mute every member indefinitely —
    // fail-closed on EXISTENCE, which is the one direction that must never happen.
    const d = decideTick(JSON.stringify({ idleIntervalMin: 999999 }), NOW, ago(MAX_IDLE_MIN + 1));
    expect(d.intervalMin).toBe(MAX_IDLE_MIN);
    expect(d.proceed).toBe(true); // it STILL ticks
  });

  it("a zero or negative interval is clamped UP to 1m (no busy-spin)", () => {
    expect(decideTick(JSON.stringify({ idleIntervalMin: 0 }), NOW, ago(2)).intervalMin).toBe(1);
    expect(decideTick(JSON.stringify({ idleIntervalMin: -5 }), NOW, ago(2)).intervalMin).toBe(1);
  });

  it("GUARANTEED TICK: however hostile the config, waiting past the ceiling always proceeds", () => {
    const hostile = [
      null,
      "garbage",
      JSON.stringify({ idleIntervalMin: Number.MAX_SAFE_INTEGER }),
      JSON.stringify({ idleIntervalMin: "not a number" }),
      JSON.stringify({ burstUntil: "1999-01-01T00:00:00Z", idleIntervalMin: 1e12 }),
    ];
    for (const cfg of hostile) {
      const d = decideTick(cfg, NOW, ago(MAX_IDLE_MIN + 1));
      expect(d.proceed).toBe(true);
      expect(d.intervalMin).toBeLessThanOrEqual(MAX_IDLE_MIN);
    }
  });

  it("a missing last-tick proceeds — an unknown history must not wedge the society silent", () => {
    // NOTE the deliberate asymmetry: doubt about PRESENCE fails to slow; doubt about the LAST
    // TICK fails to proceed. The two unknowns fail in opposite directions on purpose.
    expect(decideTick(null, NOW, null).proceed).toBe(true);
    expect(minutesBetween(null, NOW)).toBe(Number.POSITIVE_INFINITY);
    expect(minutesBetween("not-a-date", NOW)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("cadence arithmetic", () => {
  it("idle default is 4h and burst default is 15m", () => {
    expect(DEFAULT_IDLE_MIN).toBe(240);
    expect(DEFAULT_BURST_MIN).toBe(15);
  });

  it("within a burst, a too-recent tick is skipped (the cron is a clock, not a trigger)", () => {
    const live = JSON.stringify(makeBurst(NOW, 4));
    expect(decideTick(live, NOW, ago(5)).proceed).toBe(false); // 5m < 15m
    expect(decideTick(live, NOW, ago(16)).proceed).toBe(true);
  });

  it("makeBurst produces a window that expires on its own", () => {
    const p = makeBurst(NOW, 4);
    expect(Date.parse(p.burstUntil!)).toBe(Date.parse(NOW) + 4 * 3600_000);
    // one second after expiry it is already idle — no cleanup step anywhere
    const after = new Date(Date.parse(p.burstUntil!) + 1000).toISOString();
    expect(decideTick(JSON.stringify(p), after, ago(30)).cadence).toBe("idle");
  });
});
