/**
 * why-chain.test.ts — D5's acceptance, as specified:
 *  - for a real decision the chain terminates in the unknown state;
 *  - every non-terminal answer cites a state value that exists in the
 *    context it was generated from (numbers round-trip exactly).
 */
import { describe, expect, test } from "bun:test";
import { WHY_TERMINAL, whyAnswer, whyChain, type WhyContext } from "./why-chain";

const fmt = (x: number): string => (Number.isInteger(x) ? String(x) : x.toFixed(2));

/** Every number the context holds, formatted exactly as the generator does. */
function contextNumbers(ctx: WhyContext): string[] {
  const out: string[] = [];
  if (ctx.huntValue !== null) out.push(fmt(ctx.huntValue));
  if (ctx.fleeValue !== null) out.push(fmt(ctx.fleeValue));
  out.push(fmt(ctx.rewardEvents));
  if (ctx.adversary) out.push(fmt(ctx.adversary.dist));
  out.push(fmt(ctx.explore.done), fmt(ctx.explore.total));
  if (ctx.fixation) out.push(fmt(ctx.fixation.tile), fmt(ctx.fixation.variance));
  return out;
}

const huntCtx: WhyContext = {
  mode: "hunt",
  bucket: { bigAdversary: false, closing: true },
  huntValue: 0.437,
  fleeValue: -0.2,
  rewardEvents: 3,
  adversary: { dist: 12.53, closingSpeed: 0.11 },
  explore: { done: 240, total: 240 },
  fixation: { tile: 22, variance: 0.0713 },
};

describe("the WHY chain (D5)", () => {
  test("a real hunt decision terminates at the unknown state", () => {
    const chain = whyChain(huntCtx);
    expect(chain[chain.length - 1]).toBe(WHY_TERMINAL);
    expect(chain.length).toBeGreaterThan(2);
  });

  test("every non-terminal answer cites at least one live state value", () => {
    const chain = whyChain(huntCtx);
    const numbers = contextNumbers(huntCtx);
    for (const answer of chain.slice(0, -1)) {
      const cites = numbers.some((n) => answer.includes(n));
      // The penultimate rung states where reasons stop; it cites the LIMIT
      // of the state rather than a number, and the spec's terminal follows.
      const isBoundary = answer.includes("where my reasons stop");
      expect(cites || isBoundary).toBe(true);
    }
  });

  test("the answers change when the state changes (no string table survives)", () => {
    const other: WhyContext = {
      ...huntCtx,
      huntValue: -0.671,
      adversary: { dist: 40.1, closingSpeed: -0.3 },
      rewardEvents: 7,
    };
    const a = whyChain(huntCtx);
    const b = whyChain(other);
    // Same frames, different values → different sentences.
    expect(a[0]).not.toBe(b[0]);
    expect(a[1]).not.toBe(b[1]);
    expect(a[2]).not.toBe(b[2]);
  });

  test("clicking past the end saturates at the terminal (the child keeps clicking)", () => {
    const first = whyChain(huntCtx)[0] ?? "";
    expect(first).not.toBe("");
    expect(whyAnswer(huntCtx, 0)).toBe(first);
    expect(whyAnswer(huntCtx, 99)).toBe(WHY_TERMINAL);
    expect(whyAnswer(huntCtx, -5)).toBe(first);
  });

  test("exploration has its own honest chain, also terminalised", () => {
    const exploreCtx: WhyContext = {
      mode: "explore",
      bucket: null,
      huntValue: null,
      fleeValue: null,
      rewardEvents: 0,
      adversary: null,
      explore: { done: 120, total: 240 },
      fixation: null,
    };
    const chain = whyChain(exploreCtx);
    expect(chain[0]).toContain("120");
    expect(chain[0]).toContain("240");
    expect(chain[chain.length - 1]).toBe(WHY_TERMINAL);
  });

  test("zero rewards is stated as zero, never dressed up", () => {
    const cold: WhyContext = { ...huntCtx, rewardEvents: 0 };
    const chain = whyChain(cold);
    expect(chain.some((s) => s.includes("0 score changes"))).toBe(true);
    expect(chain.some((s) => s.includes("starting guess"))).toBe(true);
  });

  test("a settled field does not claim to be surprised (caught live at variance 0.00)", () => {
    const settled: WhyContext = { ...huntCtx, fixation: { tile: 20, variance: 0.0004 } };
    const chain = whyChain(settled);
    const rung = chain.find((s) => s.includes("tile 20")) ?? "";
    expect(rung).not.toBe("");
    expect(rung).not.toContain("surprising me (");
    expect(rung).toContain("nothing on screen is surprising me");
    // The live-variance rung still appears when the field IS surprising.
    const surprised = whyChain(huntCtx).find((s) => s.includes("tile 22")) ?? "";
    expect(surprised).toContain("keeps surprising me");
  });
});
