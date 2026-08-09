import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { findA1Violations, loadCoordinatesFromRegistries, scanRegistryField } from "./lint-a1-parent-key";

// Workitem 081KZHY9MVY — the A1 mechanical tripwire (Vera's signature note).
// Proofs:
//   1. The near-miss class (memory/role/persona/) is detected.
//   2. The conjunction guard: persona-below-non-coordinate and
//      coordinate-without-persona are both clean; ordinary words never trip.
//   3. Registry scan reads names/roles from the real registry shape.
//   4. LIVE TRIPWIRE: the current tracked tree has zero A1 violations —
//      this test IS the CI enforcement (check-bash-retirement pattern).

const personas = ["otto", "vera", "alexa"] as const;
const coords = ["Builder", "Operator", "cli", "kiro"] as const;

describe("findA1Violations", () => {
  test("the cancelled near-miss (memory/role/persona/) trips", () => {
    const v = findA1Violations(["memory/builder/vera/notes.md"], [...personas], [...coords]);
    expect(v).toHaveLength(1);
    expect(v[0]).toEqual({ path: "memory/builder/vera/notes.md", coordinate: "builder", persona: "vera" });
  });

  test("surface above persona trips too (Alexa's registry-description class)", () => {
    const v = findA1Violations(["cells/kiro/alexa/state.json"], [...personas], [...coords]);
    expect(v.map((x) => x.coordinate)).toEqual(["kiro"]);
  });

  test("persona ABOVE coordinate is lawful (hat under the hub)", () => {
    expect(findA1Violations(["memory/vera/builder-notes/x.md"], [...personas], [...coords])).toEqual([]);
    expect(findA1Violations(["memory/otto/cli/history.md"], [...personas], [...coords])).toEqual([]);
  });

  test("conjunction guard: ordinary words never trip", () => {
    const clean = [
      "docs/operator-manual.md", // coordinate-like word, no persona below
      "src/builder/factory.ts", // coordinate segment, no persona
      "docs/letters/to-vera.md", // persona-like in filename, not a segment under a coordinate
      "tools/cli/main.ts",
    ];
    expect(findA1Violations(clean, [...personas], [...coords])).toEqual([]);
  });
});

describe("scanRegistryField — real registry shape", () => {
  const reg = 'entries:\n  - id: 1\n    name: otto\n    role: Operator\n  - id: 2\n    name: vera\n    role: Builder\n';
  test("extracts names and roles, deduped", () => {
    expect(scanRegistryField(reg, "name")).toEqual(["otto", "vera"]);
    expect(scanRegistryField(reg, "role")).toEqual(["Operator", "Builder"]);
  });
});

describe("LIVE tripwire — the treaty article as a failing test", () => {
  test("current tracked tree has no coordinate above the hub", () => {
    const root = join(import.meta.dir, "..", "..", "..");
    const { personas: livePersonas, coordinates } = loadCoordinatesFromRegistries(
      readFileSync(join(root, "registry/personas.yaml"), "utf8"),
      readFileSync(join(root, "registry/cell-surfaces.yaml"), "utf8"),
    );
    expect(livePersonas.length).toBeGreaterThan(0);
    expect(coordinates.length).toBeGreaterThan(0);
    const paths = execSync("git ls-files", { cwd: root, maxBuffer: 64 * 1024 * 1024 })
      .toString("utf8")
      .split("\n")
      .filter((l) => l.trim() !== "");
    const violations = findA1Violations(paths, livePersonas, coordinates);
    expect(violations).toEqual([]);
  });
});
