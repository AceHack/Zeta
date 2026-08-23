// lint-tsirelson-constant-caveat.test.ts
//
// A guard that cannot fire is not a guard, so the firing cases are the point — and so are the
// SILENCE cases, because the fastest way to kill this lint is to have it shout at every doc that
// legitimately discusses Tsirelson's actual 2√2 bound.
//
// Two of these tests exist because an earlier draft got them WRONG on the real tree, and they are
// kept as the regression pins:
//   - "vocabulary alone is not a caveat": a bare /homoiconic/i marker passed
//     `sensor-fusion-oracle.ts`, a file that carries the defect and merely uses the word elsewhere.
//   - "an incidental negation is not a caveat": a "negation near the number" marker passed
//     `cpt-symmetry-emergent-c-rho-lightcone.md` — the worst offender in the tree — on the
//     unrelated sentence "not ρ* = 1/3 … but ρ_T ≈ 0.236".
// Both are the vacuity class: a marker that green-lights the very file it was written for.

import { describe, expect, test } from "bun:test";
import {
  carriesCaveat,
  collidingLines,
  deriveCaveatMarkers,
  discoverProvenanceDoc,
  flatten,
  isFrozenRecord,
  PROXIMITY_LINES,
  scanText,
  type CaveatMarkers,
} from "./lint-tsirelson-constant-caveat.ts";

/** Markers derived from a stand-in doc, so the suite does not depend on the real one's wording. */
const FAKE_PROVENANCE = "docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md";
const FAKE_DOC = [
  "# ρ_T = 1/(3√2): derivation attempt → it is a DESIGN CHOICE, chosen for homoiconicity",
  "",
  "ρ(S) = (ρ* / 4) · S = (1/3)/4 · S = S / 12",
  "",
  "So we **name it a design choice** — the **homoiconic** linear identification.",
].join("\n");

const markers: CaveatMarkers = deriveCaveatMarkers(FAKE_PROVENANCE, FAKE_DOC);

describe("marker derivation", () => {
  test("derives citation, verdict vocabulary, the map and the negation", () => {
    const names = markers.patterns.map((p) => p.name);
    expect(names.some((n) => n.startsWith("cite:"))).toBe(true);
    expect(names).toContain("vocab:design choice");
    expect(names).toContain("vocab:homoiconic");
    expect(names).toContain("map:S/12");
    expect(names).toContain("negation:not-a-tsirelson-bound");
  });

  test("refuses to run rather than pass vacuously when the doc yields too few markers", () => {
    expect(() => deriveCaveatMarkers("docs/research/x.md", "")).toThrow(/lost its grip/u);
  });

  test("the real provenance doc is discoverable and unambiguous", () => {
    expect(discoverProvenanceDoc()).toMatch(/rho-t.*design-choice.*homoiconic/u);
  });

  test("discovery fails loudly when the doc is missing — never a silent pass", () => {
    expect(() => discoverProvenanceDoc(() => ["unrelated.md"])).toThrow(/expected exactly 1/u);
  });

  test("discovery fails loudly when the doc is ambiguous", () => {
    const two = ["a-rho-t-design-choice-homoiconic.md", "b-rho-t-design-choice-homoiconic.md"];
    expect(() => discoverProvenanceDoc(() => two)).toThrow(/found 2/u);
  });
});

describe("fires on the name attached to the number", () => {
  const cases: readonly [string, string][] = [
    ["identifier assignment", "const TSIRELSON = 1 / (3 * Math.sqrt(2)); // 0.2357"],
    ["SQRT2 spelling", "const TSIRELSON = 1 / (3 * Math.SQRT2);"],
    ["prose threshold", "The Tsirelson threshold (1/(3√2) ≈ 0.2357) is the sticking probability."],
    ["table cell", "| **S = 2√2** | ρ ≈ 1/(3√2) ≈ 0.236 | Tsirelson bound / quantum entanglement |"],
    ["three-decimal form", "r < 0.236 (Tsirelson threshold) → incoherent"],
    ["F# spelling", "/// Tsirelson threshold: 1.0 / (3.0 * sqrt 2.0)"],
  ];
  for (const [name, line] of cases) {
    test(`fires on ${name}`, () => {
      expect(scanText("src/x.ts", line, markers)).toHaveLength(1);
    });
  }

  test("fires across the proximity window", () => {
    const text = ["The Tsirelson point.", "", "", "p = 0.2357"].join("\n");
    expect(scanText("src/x.ts", text, markers).length).toBeGreaterThan(0);
  });
});

describe("stays silent where it should", () => {
  test("the real bound alone is not a defect — 2√2 is what Tsirelson actually proved", () => {
    expect(scanText("src/Core/Tsirelson.fs", "/// ‖C‖ = 2√2 — Tsirelson's bound on CHSH.", markers)).toHaveLength(0);
  });

  test("the number alone, with no name attached, is not a defect", () => {
    const text = "const STICK = 1 / (3 * Math.sqrt(2)); // chosen sticking probability";
    expect(scanText("src/x.ts", text, markers)).toHaveLength(0);
  });

  test("the Condorcet limit ρ* = 1/3 is a DIFFERENT number and must not be flagged", () => {
    // Fired on `cpt-symmetry-emergent-c-rho-lightcone.md:39` before the trailing √2 was made
    // mandatory. Flagging ρ* = 1/3 would make the guard noise, and noise gets a lint deleted.
    const text = "Tsirelson regimes.\nρ* = 1/3 is the event horizon of independent thought.";
    expect(scanText("docs/x.md", text, markers)).toHaveLength(0);
  });

  test("name and number far apart are not a collision", () => {
    const text = ["Tsirelson proved S ≤ 2√2.", ...Array<string>(PROXIMITY_LINES + 3).fill(""), "p = 0.2357"].join("\n");
    expect(scanText("src/x.ts", text, markers)).toHaveLength(0);
  });

  test("the standing caveat silences it", () => {
    const text = [
      "The Tsirelson threshold (ρ* = 1/(3√2) ≈ 0.2357) is the regime boundary.",
      "",
      "> `1/(3√2)` is **NOT** the Tsirelson bound. Tsirelson's bound is `S ≤ 2√2` on the CHSH correlator.",
    ].join("\n");
    expect(scanText("docs/research/x.md", text, markers)).toHaveLength(0);
  });

  test("a caveat wrapped across comment lines still counts", () => {
    // The line-wrapped form is how `src/Bayesian/BusDelayTick.fs` writes it, and an earlier
    // draft flagged that file because it tested the caveat line-by-line.
    const text = [
      "///   - `1.0` at the chosen operating point ρ_T ≈ 0.2357 (a design parameter, NOT the",
      "///     Tsirelson bound — that is S ≤ 2√2 on the CHSH correlator; corrected 2026-08-01)",
    ].join("\n");
    expect(scanText("src/x.fs", text, markers)).toHaveLength(0);
  });

  test("citing the provenance doc discharges the caveat by reference", () => {
    const text = [
      "Tsirelson threshold 1/(3√2) as sticking probability.",
      "See `docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md`.",
    ].join("\n");
    expect(scanText("docs/x.md", text, markers)).toHaveLength(0);
  });

  test("writing the map ρ = S/12 discharges it — that is the number's actual origin", () => {
    const text = "Tsirelson threshold 1/(3√2): the image of S = 2√2 under the chosen map ρ = S / 12.";
    expect(scanText("docs/x.md", text, markers)).toHaveLength(0);
  });
});

describe("the vacuity regressions — markers that green-lit the files they were written for", () => {
  test("vocabulary alone is NOT a caveat", () => {
    // `sensor-fusion-oracle.ts` shape: the defect, plus "homoiconic" used elsewhere unrelated.
    const text = [
      "// The oracle is homoiconic with the renderer.",
      "const TSIRELSON = 1 / (3 * Math.SQRT2);",
    ].join("\n");
    expect(scanText("src/x.ts", text, markers)).toHaveLength(1);
  });

  test("the verdict vocabulary counts only when predicated of the NAME", () => {
    const text = "The Tsirelson threshold 1/(3√2) is a design choice, not a physical bound.";
    expect(scanText("docs/x.md", text, markers)).toHaveLength(0);
  });

  test("an incidental negation near the number is NOT a caveat", () => {
    // `cpt-symmetry-emergent-c-rho-lightcone.md` shape — the worst offender in the tree.
    const text = [
      "The reseed point is not ρ* = 1/3 (the hard event horizon) but ρ_T ≈ 0.236.",
      "The **Tsirelson bound** at ρ_T = 1/(3√2) ≈ 0.236 is the optimal operating point.",
    ].join("\n");
    expect(scanText("docs/x.md", text, markers).length).toBeGreaterThan(0);
  });
});

describe("frozen records are read, never rewritten", () => {
  const frozen = [
    "docs/history/pr-reviews/PR-9872-fix-register-demote-z-3.md",
    "docs/github/prs/manifest.jsonl",
    "docs/letters/from-soraya-drunk-session-discharge.md",
    "memory/lumen/NOTEBOOK.md",
    "docs/research/void-discharges-2026-08-01/z5-ico-reticulum-discharge.ts.void",
  ];
  for (const f of frozen) {
    test(`exempt: ${f}`, () => {
      expect(isFrozenRecord(f)).not.toBeNull();
      expect(scanText(f, "const TSIRELSON = 1 / (3 * Math.sqrt(2)); // 0.2357", markers)).toHaveLength(0);
    });
  }

  test("a live research doc is NOT exempt", () => {
    expect(isFrozenRecord("docs/research/cpt-symmetry-emergent-c-rho-lightcone.md")).toBeNull();
  });
});

describe("helpers", () => {
  test("flatten joins wrapped comment lines into one span", () => {
    expect(flatten("/// NOT the\n///  Tsirelson bound")).toMatch(/NOT the\s+Tsirelson bound/u);
  });

  test("carriesCaveat is false on an empty file", () => {
    expect(carriesCaveat("", markers)).toBe(false);
  });

  test("collidingLines reports the line carrying the number", () => {
    const hits = collidingLines("Tsirelson threshold\np = 0.2357");
    expect(hits[0]?.line).toBe(2);
  });
});
