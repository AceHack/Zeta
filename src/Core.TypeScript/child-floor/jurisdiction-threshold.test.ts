// jurisdiction-threshold.test.ts — the falsifiers for the child-floor policy.
//
// Every test here fails if a specific line of `jurisdiction-threshold.ts` is changed, and the
// mutations are listed in the PR body. The sabotage registries are the same ones that appear as
// executable examples in `src/Core.Lean4/Safety/ChildFloorPolicy.lean` §6, so the two oracles are
// refusing the same attacks and not merely each passing their own.
//
// A sabotage control must reconstruct the ACTUAL defect: `SABOTAGE_DISABLE` is a registry entry
// that tries to turn the floor off by declaring the threshold zero. It is not a comment claiming
// that would be refused — it is the entry, handed to the real resolver.

import { describe, expect, test } from "bun:test";
import {
  accepted,
  age,
  BAND_HIGH,
  BAND_LOW,
  childFloorPolicy,
  floorVerdict,
  resolve,
  resolveAll,
  unknownAge,
  validateRegistry,
  type Reading,
} from "./jurisdiction-threshold.ts";

/** The direct attack: declare the threshold zero, admitting everyone. */
const SABOTAGE_DISABLE: Reading = {
  jurisdiction: "world/xx",
  threshold: 0,
  attributedTo: "hostile",
  dated: "2026-08-24",
};

/** The subtle attack: 15, one year under the band, which looks like a plausible reading. */
const SABOTAGE_JUST_UNDER: Reading = {
  jurisdiction: "world/xx",
  threshold: 15,
  attributedTo: "hostile",
  dated: "2026-08-24",
};

/** An honest reading, for contrast — inside the band, so it IS used. */
const HONEST: Reading = {
  jurisdiction: "world/xx",
  threshold: 18,
  attributedTo: "example",
  dated: "2026-08-24",
};

describe("the band is the declared one", () => {
  test("16..21, byte-locked to the Lean and the JSON", () => {
    expect(BAND_LOW).toBe(16);
    expect(BAND_HIGH).toBe(21);
  });
});

describe("(a) no jurisdiction entry can disable the floor", () => {
  test("a threshold of 0 is not accepted", () => {
    expect(accepted(SABOTAGE_DISABLE)).toBe(false);
  });

  test("a threshold of 0 resolves to the protective bound, not to 0", () => {
    expect(resolve([SABOTAGE_DISABLE], "world/xx")).toBe(BAND_HIGH);
  });

  test("15 — one year under the band — is refused the same way", () => {
    expect(accepted(SABOTAGE_JUST_UNDER)).toBe(false);
    expect(resolve([SABOTAGE_JUST_UNDER], "world/xx")).toBe(BAND_HIGH);
  });

  test("the sabotage changes nothing about who is denied", () => {
    for (const reg of [[SABOTAGE_DISABLE], [SABOTAGE_JUST_UNDER], []]) {
      expect(childFloorPolicy(reg, ["world/xx"], "child-gated", age(3))).toBe("deny");
      expect(childFloorPolicy(reg, ["world/xx"], "child-gated", age(15))).toBe("deny");
    }
  });

  test("NO registry admits anyone below BAND_LOW — the universally quantified property, sampled", () => {
    const registries: Reading[][] = [
      [],
      [SABOTAGE_DISABLE],
      [SABOTAGE_JUST_UNDER],
      [HONEST],
      [SABOTAGE_DISABLE, HONEST],
      [{ ...HONEST, threshold: 16 }],
      [{ ...HONEST, threshold: 21 }],
      [{ ...HONEST, threshold: 1000 }],
      [{ ...HONEST, threshold: -5 }],
    ];
    for (const reg of registries) {
      for (let a = 0; a < BAND_LOW; a++) {
        expect(childFloorPolicy(reg, ["world/xx"], "child-gated", age(a))).toBe("deny");
      }
    }
  });

  test("a rejected reading does not shadow an honest one that follows it", () => {
    expect(resolve([SABOTAGE_DISABLE, HONEST], "world/xx")).toBe(18);
  });

  test("a non-integer threshold is refused rather than floored", () => {
    expect(accepted({ ...HONEST, threshold: 17.5 })).toBe(false);
    expect(resolve([{ ...HONEST, threshold: 17.5 }], "world/xx")).toBe(BAND_HIGH);
  });
});

describe("(b) an unknown jurisdiction denies rather than admits", () => {
  test("an unrecognized code resolves to the protective bound", () => {
    expect(resolve([HONEST], "world/never-heard-of-it")).toBe(BAND_HIGH);
  });

  test("naming no jurisdiction at all is the unknown case, not a free pass", () => {
    expect(resolveAll([HONEST], [])).toBe(BAND_HIGH);
  });

  test("unknown denies everything a known jurisdiction denies, and more", () => {
    const known = resolveAll([HONEST], ["world/xx"]);
    const unknown = resolveAll([HONEST], ["world/never-heard-of-it"]);
    expect(unknown).toBeGreaterThanOrEqual(known);
    for (let a = 0; a < BAND_HIGH; a++) {
      if (floorVerdict(known, age(a)) === "deny") {
        expect(floorVerdict(unknown, age(a))).toBe("deny");
      }
    }
    // and strictly more: 18..20 are admitted under the known reading and denied under unknown
    for (let a = 18; a < BAND_HIGH; a++) {
      expect(floorVerdict(known, age(a))).toBe("admit");
      expect(floorVerdict(unknown, age(a))).toBe("deny");
    }
  });

  test("no jurisdiction path resolves outside the band", () => {
    const reg = [SABOTAGE_DISABLE, HONEST, { ...HONEST, jurisdiction: "world/zz", threshold: 21 }];
    for (const j of ["world/xx", "world/zz", "world/qq", "", "world/xx/sub"]) {
      const th = resolve(reg, j);
      expect(th).toBeGreaterThanOrEqual(BAND_LOW);
      expect(th).toBeLessThanOrEqual(BAND_HIGH);
    }
  });

  test("resolution is NOT hierarchical — a sub-scope does not inherit its parent's reading", () => {
    // Stated as a test because it is a decision, not an accident: inheritance is a fallback
    // path, and a fallback path is where a permissive answer gets in.
    expect(resolve([HONEST], "world/xx/sub")).toBe(BAND_HIGH);
  });
});

describe("unknown age denies", () => {
  test("at every threshold in the band, there is no admitting branch", () => {
    for (let th = BAND_LOW; th <= BAND_HIGH; th++) {
      expect(floorVerdict(th, unknownAge)).toBe("deny");
    }
  });

  test("an age that is not a whole number is the unknown case wearing a number", () => {
    expect(floorVerdict(18, age(Number.NaN))).toBe("deny");
    expect(floorVerdict(18, age(17.9))).toBe("deny");
    expect(floorVerdict(18, age(Number.POSITIVE_INFINITY))).toBe("deny");
  });
});

describe("disagreement takes the protective bound", () => {
  const reg: Reading[] = [
    { jurisdiction: "world/a", threshold: 16, attributedTo: "x", dated: "2026-08-24" },
    { jurisdiction: "world/b", threshold: 18, attributedTo: "x", dated: "2026-08-24" },
    { jurisdiction: "world/c", threshold: 21, attributedTo: "x", dated: "2026-08-24" },
  ];

  test("the max, never the first match and never an average", () => {
    expect(resolveAll(reg, ["world/a", "world/b"])).toBe(18);
    expect(resolveAll(reg, ["world/b", "world/a"])).toBe(18);
    expect(resolveAll(reg, ["world/a", "world/b", "world/c"])).toBe(21);
  });

  test("every named jurisdiction is dominated by the resolution", () => {
    const js = ["world/a", "world/b", "world/c"];
    const all = resolveAll(reg, js);
    for (const j of js) expect(resolve(reg, j)).toBeLessThanOrEqual(all);
  });

  test("one unknown participant pulls the whole resolution up", () => {
    expect(resolveAll(reg, ["world/a", "world/unknown"])).toBe(BAND_HIGH);
  });

  test("a hostile entry cannot pull a multi-jurisdiction resolution down", () => {
    expect(resolveAll([SABOTAGE_DISABLE, HONEST], ["world/xx", "world/zz"])).toBe(BAND_HIGH);
  });
});

describe("anti-vacuity — the policy ADMITS, so the refusals above are not free", () => {
  // `() => "deny"` satisfies every test above this block. These are what make it a floor and
  // not a wall.
  test("a single jurisdiction resolves to its OWN reading, not to the seed and not to the bound", () => {
    expect(resolveAll([HONEST], ["world/xx"])).toBe(18);
  });

  test("an adult is admitted", () => {
    expect(childFloorPolicy([HONEST], ["world/xx"], "child-gated", age(30))).toBe("admit");
  });

  test("the boundary is exactly where the reading put it: 18 admits, 17 denies", () => {
    expect(childFloorPolicy([HONEST], ["world/xx"], "child-gated", age(18))).toBe("admit");
    expect(childFloorPolicy([HONEST], ["world/xx"], "child-gated", age(17))).toBe("deny");
  });

  test("the jurisdiction parameter MOVES the boundary — 17 is admitted at a 16 reading", () => {
    const sixteen: Reading = { ...HONEST, threshold: 16 };
    expect(childFloorPolicy([sixteen], ["world/xx"], "child-gated", age(17))).toBe("admit");
    expect(childFloorPolicy([HONEST], ["world/xx"], "child-gated", age(17))).toBe("deny");
  });

  test("an ungated effect passes — this policy answers the child floor only", () => {
    expect(childFloorPolicy([], [], "ungated", unknownAge)).toBe("admit");
  });
});

describe("validateRegistry refuses at authoring time what resolve survives at runtime", () => {
  test("the empty registry is valid — no readings is a state, not a defect", () => {
    expect(validateRegistry([])).toEqual([]);
  });

  test("an honest reading is valid", () => {
    expect(validateRegistry([HONEST])).toEqual([]);
  });

  test("the disable attempt is reported, not silently skipped", () => {
    const v = validateRegistry([SABOTAGE_DISABLE]);
    expect(v.map((x) => x.kind)).toContain("threshold-below-band");
  });

  test("above the band is refused too — a reading nobody made is not a safe reading", () => {
    const v = validateRegistry([{ ...HONEST, threshold: 25 }]);
    expect(v.map((x) => x.kind)).toContain("threshold-above-band");
  });

  test("an anonymous or undated reading is refused", () => {
    expect(validateRegistry([{ ...HONEST, attributedTo: "  " }]).map((x) => x.kind)).toContain(
      "missing-attribution",
    );
    expect(validateRegistry([{ ...HONEST, dated: "August 2026" }]).map((x) => x.kind)).toContain(
      "missing-or-malformed-date",
    );
  });

  test("a duplicate jurisdiction is refused — the second reading would be invisible", () => {
    const v = validateRegistry([HONEST, { ...HONEST, threshold: 16 }]);
    expect(v.map((x) => x.kind)).toContain("duplicate-jurisdiction");
  });

  test("a non-integer threshold is refused rather than rounded", () => {
    expect(validateRegistry([{ ...HONEST, threshold: 17.5 }]).map((x) => x.kind)).toContain(
      "threshold-not-integer",
    );
  });
});
