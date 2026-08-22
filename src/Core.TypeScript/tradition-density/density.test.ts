import { describe, expect, test } from "bun:test";
import { densityOf, evenness, fameVsUse, formatReport, nullRate, rankFrequency } from "./density";
import type { LedgerEntry, SelfReportedDepth } from "./ledger";

/** Index/find accessor that refuses `undefined` loudly — a missing element is a failed test, not a silent `!`. */
function must<T>(x: T | undefined): T {
  if (x === undefined) throw new Error("expected a value, got undefined");
  return x;
}


function row(iteration: number, code: string, targets: readonly (readonly [string, SelfReportedDepth | undefined])[]): LedgerEntry {
  return {
    corpus: "c",
    corpusVersion: "v",
    seed: "1",
    iteration,
    code,
    title: `title ${code}`,
    coupling: {
      kind: "coupled",
      targets: targets.map(([target, d]) => (d === undefined ? { target, claim: "k" } : { target, claim: "k", selfReportedDepth: d })),
    },
  };
}

function nullRow(iteration: number, code: string): LedgerEntry {
  return { corpus: "c", corpusVersion: "v", seed: "1", iteration, code, title: `title ${code}`, coupling: { kind: "null", note: "nothing" } };
}

describe("density — depth is recurrence across DISTINCT traditions", () => {
  test("two different traditions naming one target give it depth 2", () => {
    const r = densityOf([row(0, "11", [["t.ts", undefined]]), row(1, "68", [["t.ts", undefined]])]);
    expect(must(r.targets[0]).target).toBe("t.ts");
    expect(must(r.targets[0]).depth).toBe(2);
    expect(must(r.targets[0]).traditions).toEqual(["11", "68"]);
  });

  test("the SAME tradition drawn twice does not raise depth — only mentions", () => {
    const r = densityOf([row(0, "68", [["t.ts", undefined]]), row(1, "68", [["t.ts", undefined]])]);
    expect(must(r.targets[0]).depth).toBe(1);
    expect(must(r.targets[0]).mentions).toBe(2);
    expect(r.distinctTraditionsDrawn).toBe(1);
    expect(r.draws).toBe(2);
  });

  // MUTATION TARGET (b): let a single draw's self-reported confidence set depth.
  //
  // The Kevin Bacon guard, mechanised (.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md:
  // "the named hub and the actual hub are different nodes"). Flipping every self-report must leave
  // the depth ranking bit-identical; if depth ever consults `selfReportedDepth`, this fails.
  test("flipping every self-report leaves depth and the ranking unchanged", () => {
    const modest = [
      row(0, "11", [["deep-looking.ts", "shallow"]]),
      row(1, "68", [["deep-looking.ts", "shallow"]]),
      row(2, "22", [["famous.ts", "deep"]]),
    ];
    const boastful = [
      row(0, "11", [["deep-looking.ts", "deep"]]),
      row(1, "68", [["deep-looking.ts", "deep"]]),
      row(2, "22", [["famous.ts", "shallow"]]),
    ];
    const a = densityOf(modest);
    const b = densityOf(boastful);
    expect(a.targets.map((t) => [t.target, t.depth])).toEqual(b.targets.map((t) => [t.target, t.depth]));
    expect(rankFrequency(a)).toEqual(rankFrequency(b));
    // the fame counts DO differ — the self-report is captured, just never ranked on
    expect(a.targets.map((t) => t.selfReportedDeepMentions)).not.toEqual(b.targets.map((t) => t.selfReportedDeepMentions));
  });

  test("a single draw that calls itself deep still ranks below a twice-recurring target", () => {
    const r = densityOf([
      row(0, "22", [["shouted.ts", "deep"]]),
      row(1, "11", [["quiet.ts", "shallow"]]),
      row(2, "68", [["quiet.ts", "shallow"]]),
    ]);
    expect(must(r.targets[0]).target).toBe("quiet.ts");
    expect(must(r.targets[0]).depth).toBe(2);
    expect(must(r.targets[0]).selfReportedDeepMentions).toBe(0);
    // and the loud single draw stays at depth 1 — its own confidence buys it nothing
    expect(must(r.targets.find((t) => t.target === "shouted.ts")).depth).toBe(1);
  });

  test("ties break deterministically by target name, code-point order", () => {
    const r = densityOf([row(0, "11", [["b.ts", undefined]]), row(1, "12", [["a.ts", undefined]])]);
    expect(r.targets.map((t) => t.target)).toEqual(["a.ts", "b.ts"]);
  });
});

describe("density — nulls are in every denominator", () => {
  test("null draws count as draws", () => {
    const r = densityOf([nullRow(0, "13"), nullRow(1, "76"), row(2, "68", [["t.ts", undefined]])]);
    expect(r.draws).toBe(3);
    expect(r.nullDraws).toBe(2);
    expect(nullRate(r)).toBeCloseTo(2 / 3, 12);
  });

  test("an empty ledger has no rate rather than a rate of zero", () => {
    expect(nullRate(densityOf([]))).toBeNaN();
  });
});

describe("density — the distribution statistics, and what they refuse to say", () => {
  test("uniform depth reads as evenness 1 (the vacuity shape)", () => {
    const r = densityOf([
      row(0, "11", [["a.ts", undefined]]),
      row(1, "12", [["a.ts", undefined]]),
      row(2, "13", [["b.ts", undefined]]),
      row(3, "14", [["b.ts", undefined]]),
    ]);
    expect(evenness(r)).toBeCloseTo(1, 12);
  });

  test("a concentrated distribution reads below 1", () => {
    const r = densityOf([
      row(0, "11", [["hub.ts", undefined]]),
      row(1, "12", [["hub.ts", undefined]]),
      row(2, "13", [["hub.ts", undefined]]),
      row(3, "14", [["leaf.ts", undefined]]),
    ]);
    expect(evenness(r)).toBeLessThan(1);
  });

  test("fewer than two targets has no evenness — NaN, never a confident 1", () => {
    expect(evenness(densityOf([row(0, "11", [["a.ts", undefined]])]))).toBeNaN();
    expect(evenness(densityOf([]))).toBeNaN();
  });

  test("fame-vs-use tau is a display: perfectly anti-aligned reports -1 and changes nothing else", () => {
    const entries = [
      row(0, "11", [["quiet.ts", "shallow"]]),
      row(1, "12", [["quiet.ts", "shallow"]]),
      row(2, "22", [["loud.ts", "deep"]]),
    ];
    const r = densityOf(entries);
    const fu = fameVsUse(r);
    expect(fu.concordant).toBe(0);
    expect(fu.discordant).toBe(1);
    expect(fu.tau).toBe(-1);
    expect(must(r.targets[0]).target).toBe("quiet.ts");
  });

  test("tau is undefined below two targets", () => {
    expect(fameVsUse(densityOf([row(0, "11", [["a.ts", undefined]])])).tau).toBeNaN();
  });

  test("the report states no verdict", () => {
    const text = formatReport(densityOf([row(0, "11", [["a.ts", "deep"]]), row(1, "12", [["a.ts", undefined]])]));
    expect(text).toContain("No verdict is attached");
    expect(text).not.toMatch(/\b(PASS|FAIL|passes|fails|confirmed|refuted)\b/);
  });
});
