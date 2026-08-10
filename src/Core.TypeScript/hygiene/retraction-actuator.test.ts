import { describe, expect, test } from "bun:test";

import { bd001OpenTicks, isolateBreak, touchesVectors } from "./retraction-actuator";

// The edge's pure fact-computations. All DECISIONS are episode-protocol's
// (12 laws there); these tests cover only what the edge computes for it.

const sweep = (tick: number, rules: string[]) => ({ tick, findings: rules.map((rule) => ({ rule })) });

describe("bd001OpenTicks — trailing consecutive open sweeps", () => {
  test("counts only the trailing run", () => {
    expect(bd001OpenTicks([sweep(1, ["BD001"]), sweep(2, []), sweep(3, ["BD001"]), sweep(4, ["BD001"])])).toBe(2);
  });
  test("zero when the latest sweep is clean", () => {
    expect(bd001OpenTicks([sweep(1, ["BD001"]), sweep(2, ["MD022"])])).toBe(0);
  });
  test("order-independent input (ledger files sort by tick)", () => {
    expect(bd001OpenTicks([sweep(3, ["BD001"]), sweep(1, []), sweep(2, ["BD001"])])).toBe(2);
  });
});

describe("isolateBreak — first red after last green", () => {
  test("clean picture: newest red walks back to the first red, paired with its green predecessor", () => {
    expect(
      isolateBreak([
        { headSha: "r2", conclusion: "failure" },
        { headSha: "r1", conclusion: "failure" },
        { headSha: "g1", conclusion: "success" },
      ]),
    ).toEqual({ redHead: "r1", greenHead: "g1" });
  });
  test("newest completed run green ⇒ no break to isolate", () => {
    expect(isolateBreak([{ headSha: "g2", conclusion: "success" }, { headSha: "r1", conclusion: "failure" }])).toBeNull();
  });
  test("running runs are ignored for the picture; no green in window ⇒ null", () => {
    expect(isolateBreak([{ headSha: "x", conclusion: null }, { headSha: "r1", conclusion: "failure" }])).toBeNull();
  });
});

describe("touchesVectors — the byte-lock contract patterns", () => {
  test("golden vectors and cross-verification paths refuse", () => {
    expect(touchesVectors(["src/Core/golden-vectors-cbor.json"])).toBe(true);
    expect(touchesVectors(["tests/cross-verification/run.ts"])).toBe(true);
  });
  test("ordinary paths pass", () => {
    expect(touchesVectors(["src/Core.TypeScript/hygiene/x.ts", "docs/a.md"])).toBe(false);
  });
});
