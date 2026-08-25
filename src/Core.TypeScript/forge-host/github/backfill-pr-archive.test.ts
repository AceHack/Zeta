// Falsifiers for backfill-pr-archive.ts.
//
// The pacing and backoff logic is what stands between this tool and a secondary
// rate limit that locks the shared token for the whole factory, and it is the
// part that CANNOT be tested by running it. So it is pure, injected-clock, and
// pinned here.

import { describe, expect, it } from "bun:test";

import {
  backoffSeconds,
  CALLS_PER_PR,
  isThrottled,
  pacingDelayMs,
  parseRateLimit,
  RATE_RESERVE,
} from "./backfill-pr-archive.ts";

const NOW_MS = 1_787_644_000_000;

describe("parseRateLimit", () => {
  it("reads the core resource from a real gh api rate_limit payload", () => {
    const raw = JSON.stringify({
      resources: { core: { limit: 5000, remaining: 4810, reset: 1_787_644_204 } },
    });
    expect(parseRateLimit(raw)).toEqual({ remaining: 4810, limit: 5000, reset: 1_787_644_204 });
  });

  it("throws rather than defaulting when the shape is unexpected", () => {
    // A silent default here would be a budget we invented, and the tool would
    // pace against a fiction. Fail loudly: an unreadable budget is not a
    // generous one.
    expect(() => parseRateLimit(JSON.stringify({ resources: {} }))).toThrow();
    expect(() => parseRateLimit("not json")).toThrow();
  });
});

describe("pacingDelayMs", () => {
  const reset = Math.floor(NOW_MS / 1000) + 600; // 10 minutes out

  it("paces normally while the budget is healthy", () => {
    expect(pacingDelayMs({ remaining: 4000, limit: 5000, reset }, NOW_MS, 1200)).toBe(1200);
  });

  it("SLEEPS TO RESET once the budget falls under the reserve", () => {
    // The budget does not refill gradually, so waiting anything less than the
    // full time-to-reset just burns the reserve the other agents need.
    const d = pacingDelayMs({ remaining: RATE_RESERVE - 1, limit: 5000, reset }, NOW_MS, 1200);
    expect(d).toBeGreaterThan(600_000);
    expect(d).toBeLessThan(610_000);
  });

  it("brackets the reserve boundary from both sides", () => {
    // A single-sided test would pass against a function that always sleeps.
    const below = { remaining: RATE_RESERVE + CALLS_PER_PR - 1, limit: 5000, reset };
    const above = { remaining: RATE_RESERVE + CALLS_PER_PR, limit: 5000, reset };
    expect(pacingDelayMs(below, NOW_MS, 1200)).toBeGreaterThan(1200);
    expect(pacingDelayMs(above, NOW_MS, 1200)).toBe(1200);
  });

  it("never returns a negative delay when the reset is already past", () => {
    // A stale reset must not produce a negative sleep that silently becomes an
    // unpaced burst — which is exactly how a secondary limit is hit.
    const past = Math.floor(NOW_MS / 1000) - 3600;
    expect(pacingDelayMs({ remaining: 0, limit: 5000, reset: past }, NOW_MS, 1200)).toBe(5_000);
  });
});

describe("isThrottled", () => {
  it("recognises GitHub's throttle responses", () => {
    expect(isThrottled("HTTP 403: You have exceeded a secondary rate limit")).toBe(true);
    expect(isThrottled("HTTP 429: API rate limit exceeded")).toBe(true);
    expect(isThrottled("gh: 403 retry-after: 60")).toBe(true);
  });

  it("does NOT treat an ordinary permission or not-found error as a throttle", () => {
    // Retrying a 404 forever is how a drain wedges. The distinction is
    // load-bearing: throttles are retried on the SAME PR, everything else
    // advances the cursor and is recorded as failed.
    expect(isThrottled("HTTP 404: Not Found")).toBe(false);
    expect(isThrottled("HTTP 403: Resource not accessible by integration")).toBe(false);
    expect(isThrottled("connection reset")).toBe(false);
  });
});

describe("backoffSeconds", () => {
  it("honours Retry-After verbatim when GitHub sends it", () => {
    // GitHub is telling us exactly how long. Guessing shorter is how a
    // secondary limit becomes a longer one.
    expect(backoffSeconds("HTTP 403\nretry-after: 120\n", 1, 0)).toBe(120);
    expect(backoffSeconds("Retry-After: 47", 5, 0.9)).toBe(47);
  });

  it("backs off exponentially and monotonically without the header", () => {
    const a = backoffSeconds("403 secondary rate", 1, 0);
    const b = backoffSeconds("403 secondary rate", 2, 0);
    const c = backoffSeconds("403 secondary rate", 3, 0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it("caps the wait so a drain cannot sleep forever", () => {
    expect(backoffSeconds("403 secondary rate", 99, 1)).toBeLessThanOrEqual(900 * 1.25);
  });

  it("adds jitter — synchronised retries across agents re-hit the limit", () => {
    // Several agents share this token. Identical backoff means they all return
    // at the same instant, which is the burst that got them throttled.
    expect(backoffSeconds("403 secondary rate", 3, 0)).not.toBe(backoffSeconds("403 secondary rate", 3, 1));
  });
});
