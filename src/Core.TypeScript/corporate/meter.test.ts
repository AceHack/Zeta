/**
 * meter.test.ts — the difference between "free" and "we never measured it".
 *
 * Every dollar figure this organization has ever shown was invented. The property under test is
 * that it cannot be again: a total exists only where a price was configured, and where one was not
 * the answer is an ABSENCE that a caller has to handle, never a zero it can render.
 */

import { describe, expect, test } from "bun:test";

import {
  addSpend,
  meterCall,
  NO_SPEND,
  priceOf,
  spendLabel,
  spendOf,
  type PortMeter,
  type Pricing,
} from "./meter";
import { Fidelity, Port, type PortResult } from "./providers";

const PRICES: Pricing = { "claude-opus-5": { inPerMillion: 15, outPerMillion: 75 } };

const CTX = {
  port: Port.WorkExecution,
  provider: "test",
  fidelity: Fidelity.Real,
} as const;

/** A clock that advances a fixed amount per read, so a duration is a decision not a race. */
function clock(steps: readonly number[]): () => number {
  let i = 0;
  return () => steps[Math.min(i++, steps.length - 1)] ?? 0;
}

const ok = (usage?: { tokensIn?: number; tokensOut?: number; model?: string }): PortResult<string> => ({
  ok: true,
  value: "done",
  evidence: [],
  ...(usage === undefined ? {} : { usage }),
});

describe("A COST EXISTS ONLY WHERE A PRICE WAS CONFIGURED", () => {
  test("no price table means tokens are recorded and no cost is invented", async () => {
    const { meter } = await meterCall({ ...CTX, now: clock([0, 250]) }, async () =>
      ok({ tokensIn: 1000, tokensOut: 500, model: "claude-opus-5" }),
    );
    expect(meter.tokensIn).toBe(1000);
    expect(meter.tokensOut).toBe(500);
    // The whole point. A run with no price table still records everything needed to price it later.
    expect(meter.costUsd).toBeUndefined();
  });

  test("a configured price produces a cost from the tokens actually reported", async () => {
    const { meter } = await meterCall({ ...CTX, pricing: PRICES, now: clock([0, 250]) }, async () =>
      ok({ tokensIn: 1_000_000, tokensOut: 1_000_000, model: "claude-opus-5" }),
    );
    expect(meter.costUsd).toBeCloseTo(90, 6);
  });

  test("a price for a DIFFERENT model does not leak onto this one", () => {
    expect(priceOf({ tokensIn: 100, tokensOut: 100, model: "some-other-model" }, PRICES)).toBeUndefined();
  });

  test("a priced model that reported no tokens is unmeasured, not free", () => {
    // Zero is a measurement — it says the call cost nothing. Nothing was measured here.
    expect(priceOf({ model: "claude-opus-5" }, PRICES)).toBeUndefined();
    expect(priceOf({ tokensIn: 0, tokensOut: 0, model: "claude-opus-5" }, PRICES)).toBeUndefined();
  });

  test("no model reported means no price can apply", () => {
    expect(priceOf({ tokensIn: 500, tokensOut: 500 }, PRICES)).toBeUndefined();
  });
});

describe("THE MEASUREMENT MUST NOT ALTER WHAT IT MEASURES", () => {
  test("the port result comes back unchanged, refusals included", async () => {
    const refusal: PortResult<string> = { ok: false, reason: "the build is missing" };
    const { result } = await meterCall({ ...CTX, now: clock([0, 10]) }, async () => refusal);
    expect(result).toEqual(refusal);
  });

  test("a refusal is still metered — a run that failed expensively is not free", async () => {
    const { meter } = await meterCall({ ...CTX, pricing: PRICES, now: clock([0, 4000]) }, async () => ({
      ok: false as const,
      reason: "timed out",
    }));
    expect(meter.ok).toBe(false);
    expect(meter.durationMs).toBe(4000);
  });

  test("the meter names the adapter, so two adapters on one port stay distinguishable", async () => {
    const { meter } = await meterCall(
      { port: Port.Review, provider: "auto-approve", fidelity: Fidelity.Simulated, now: clock([0, 1]) },
      async () => ok(),
    );
    expect(meter.provider).toBe("auto-approve");
    expect(meter.fidelity).toBe(Fidelity.Simulated);
    expect(meter.port).toBe(Port.Review);
  });
});

describe("A TOTAL CARRIES ITS DENOMINATOR — otherwise it is a claim, not a sum", () => {
  const priced = (cost: number): PortMeter => ({
    port: Port.WorkExecution,
    provider: "p",
    fidelity: Fidelity.Real,
    startedMs: 0,
    durationMs: 100,
    ok: true,
    tokensIn: 10,
    tokensOut: 10,
    model: "claude-opus-5",
    costUsd: cost,
  });
  const unpriced: PortMeter = {
    port: Port.ChangeControl,
    provider: "git",
    fidelity: Fidelity.Real,
    startedMs: 0,
    durationMs: 50,
    ok: true,
  };

  test("a partly-priced run says how much of itself it priced", () => {
    const spend = spendOf([priced(1), priced(2), unpriced]);
    expect(spend.calls).toBe(3);
    expect(spend.priced).toBe(2);
    expect(spend.costUsd).toBeCloseTo(3, 6);
    // Without this a run where one call in fourteen was priced renders as one where all were.
    expect(spendLabel(spend)).toBe("$3.00 over 2 of 3 calls");
  });

  test("a fully-priced run says the number and nothing else", () => {
    expect(spendLabel(spendOf([priced(1), priced(2)]))).toBe("$3.00");
  });

  test("nothing priced is NOT zero dollars", () => {
    const spend = spendOf([unpriced, unpriced]);
    expect(spend.costUsd).toBeUndefined();
    expect(spendLabel(spend)).toBe("not priced · 2 calls");
    // The failure this whole module exists to prevent: an unmetered run rendering as a free one.
    expect(spendLabel(spend)).not.toContain("$0.00");
  });

  test("duration accumulates over every call, priced or not", () => {
    expect(spendOf([priced(1), unpriced]).durationMs).toBe(150);
  });

  test("token totals carry their own denominator too", () => {
    const spend = spendOf([priced(1), unpriced]);
    expect(spend.withTokens).toBe(1);
    expect(spend.tokensIn).toBe(10);
  });

  test("an empty set is no calls, not free work", () => {
    expect(spendOf([])).toEqual(NO_SPEND);
    expect(spendLabel(NO_SPEND)).toBe("no calls");
  });

  test("adding spends keeps the denominators, so a roll-up cannot claim more than it priced", () => {
    const a = spendOf([priced(1), unpriced]);
    const b = spendOf([unpriced]);
    const sum = addSpend(a, b);
    expect(sum.calls).toBe(3);
    expect(sum.priced).toBe(1);
    expect(sum.costUsd).toBeCloseTo(1, 6);
  });

  test("adding two unpriced spends stays unpriced rather than becoming zero", () => {
    expect(addSpend(spendOf([unpriced]), spendOf([unpriced])).costUsd).toBeUndefined();
  });
});
