// lint-child-floor-registry.test.ts — the falsifiers for the child-floor registry lint.
//
// `readings` ships empty, so the lint's per-entry loop iterates zero times on the real file.
// A check that iterates nothing cannot fail, and a green result from one is worth nothing. This
// file is where the lint is actually exercised: hostile registries go in, refusals come out, and
// the SHIPPED file is checked too so the two cannot drift.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  checkRegistry,
  LEAN_PATH,
  readLeanBand,
  REGISTRY_PATH,
  type BandClaim,
  type RegistryFile,
} from "./lint-child-floor-registry.ts";
import { BAND_HIGH, BAND_LOW } from "../child-floor/jurisdiction-threshold.ts";

const AGREEING: BandClaim[] = [
  { source: "lean", low: 16, high: 21 },
  { source: "ts", low: 16, high: 21 },
  { source: "json", low: 16, high: 21 },
];

describe("the shipped registry passes", () => {
  const file = JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) as RegistryFile;
  const lean = readLeanBand(readFileSync(LEAN_PATH, "utf8"));

  test("no problems", () => {
    expect(
      checkRegistry(file, [
        { source: "lean", low: lean.low, high: lean.high },
        { source: "ts", low: BAND_LOW, high: BAND_HIGH },
        { source: "json", low: file.band?.low ?? -1, high: file.band?.high ?? -1 },
      ]),
    ).toEqual([]);
  });

  test("and the band really is [16, 21] in all three — not merely self-consistent", () => {
    expect([lean.low, lean.high]).toEqual([16, 21]);
    expect([BAND_LOW, BAND_HIGH]).toEqual([16, 21]);
    expect([file.band?.low, file.band?.high]).toEqual([16, 21]);
  });
});

describe("SABOTAGE: an entry that tries to turn the floor off", () => {
  test("threshold 0 is refused, and the message says why", () => {
    const problems = checkRegistry(
      {
        readings: [
          { jurisdiction: "world/xx", threshold: 0, attributedTo: "hostile", dated: "2026-08-24" },
        ],
      },
      AGREEING,
    );
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain("threshold-below-band");
  });

  test("threshold 15 — one under the band — is refused the same way", () => {
    const problems = checkRegistry(
      {
        readings: [
          { jurisdiction: "world/xx", threshold: 15, attributedTo: "hostile", dated: "2026-08-24" },
        ],
      },
      AGREEING,
    );
    expect(problems.join("\n")).toContain("threshold-below-band");
  });

  test("16 — the lowest legal reading — is ACCEPTED, so the refusal above is about the band and not about hostility", () => {
    expect(
      checkRegistry(
        {
          readings: [
            { jurisdiction: "world/xx", threshold: 16, attributedTo: "someone", dated: "2026-08-24" },
          ],
        },
        AGREEING,
      ),
    ).toEqual([]);
  });
});

describe("SABOTAGE: moving the band in one oracle only", () => {
  test("a Lean band of [0, 21] against a TS band of [16, 21] is refused", () => {
    const problems = checkRegistry({ readings: [] }, [
      { source: "lean", low: 0, high: 21 },
      { source: "ts", low: 16, high: 21 },
    ]);
    expect(problems.join("\n")).toContain("band disagreement");
  });

  test("a JSON band of [16, 99] is refused", () => {
    const problems = checkRegistry({ readings: [] }, [
      { source: "lean", low: 16, high: 21 },
      { source: "json", low: 16, high: 99 },
    ]);
    expect(problems.join("\n")).toContain("band disagreement");
  });

  test("an empty band is refused", () => {
    const problems = checkRegistry({ readings: [] }, [{ source: "lean", low: 22, high: 21 }]);
    expect(problems.join("\n")).toContain("band is empty");
  });
});

describe("SABOTAGE: a candidate wearing a threshold", () => {
  test("a number under `candidates` is refused — it would be silently inert", () => {
    const problems = checkRegistry(
      { readings: [], candidates: [{ jurisdiction: "world/us", threshold: 18 }] },
      AGREEING,
    );
    expect(problems.join("\n")).toContain("carries a threshold");
  });

  test("a candidate without a threshold is fine", () => {
    expect(
      checkRegistry({ readings: [], candidates: [{ jurisdiction: "world/us" }] }, AGREEING),
    ).toEqual([]);
  });
});

describe("authoring hygiene", () => {
  test("an anonymous reading is refused", () => {
    const problems = checkRegistry(
      { readings: [{ jurisdiction: "world/xx", threshold: 18, attributedTo: "", dated: "2026-08-24" }] },
      AGREEING,
    );
    expect(problems.join("\n")).toContain("missing-attribution");
  });

  test("an undated reading is refused", () => {
    const problems = checkRegistry(
      { readings: [{ jurisdiction: "world/xx", threshold: 18, attributedTo: "a", dated: "" }] },
      AGREEING,
    );
    expect(problems.join("\n")).toContain("missing-or-malformed-date");
  });

  test("two readings for one jurisdiction are refused", () => {
    const problems = checkRegistry(
      {
        readings: [
          { jurisdiction: "world/xx", threshold: 18, attributedTo: "a", dated: "2026-08-24" },
          { jurisdiction: "world/xx", threshold: 16, attributedTo: "b", dated: "2026-08-24" },
        ],
      },
      AGREEING,
    );
    expect(problems.join("\n")).toContain("duplicate-jurisdiction");
  });
});

describe("readLeanBand does not invent a band it cannot find", () => {
  test("a source with no bandLow throws rather than defaulting", () => {
    expect(() => readLeanBand("def somethingElse : Nat := 3\n")).toThrow();
  });

  test("and it reads the real numbers rather than matching any digits nearby", () => {
    expect(readLeanBand("def bandLow : Nat := 7\ndef bandHigh : Nat := 9\n")).toEqual({
      low: 7,
      high: 9,
    });
  });
});
