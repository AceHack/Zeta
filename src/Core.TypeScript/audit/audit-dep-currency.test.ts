// src/Core.TypeScript/audit/audit-dep-currency.test.ts
//
// Falsifier for the flake-input half of the dep-pin inventory.
//
// WHAT WENT WRONG, AND WHY A TEST RATHER THAN A FIX. `scanFlakeInputs`
// read exactly one hardcoded path, `full-ai-cluster/flake.nix`. The
// repo's OTHER flake — the 239-line root `flake.nix` with four inputs —
// was invisible to the entire dep-currency apparatus, which is the same
// divergence that left the root flake unlocked for months, showing up on
// a second surface. Replacing one hardcoded path with two would have been
// the same defect with a longer list.
//
// So the assertions below are chosen to fail on BOTH regressions:
//
//   1. Re-hardcoding — `trackedFlakeFiles` must derive its roster from
//      `git ls-files`, so every tracked flake is covered the moment it
//      exists. Asserted by requiring the ROOT flake (the one that was
//      missing) to appear, by name, in the real repo's output.
//   2. Silent zero — a scan that reads the new source and extracts
//      nothing looks identical to a pass. So the root flake's inputs are
//      asserted BY NAME with their pin VALUES, not merely counted.
//
// The value assertions are deliberately STRUCTURAL (`nixos-` prefix, not
// `nixos-24.11`): the point is that the audit reads the live file, and a
// version-locked assertion would fail the moment the EOL upgrade lands,
// which would make this test an obstacle to the very work it exists to
// surface.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  collectPins,
  parseFlakeInputs,
  trackedFlakeFiles,
  type DepPin,
} from "./audit-dep-currency.ts";

function repoRoot(): string {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  expect(r.status).toBe(0);
  return r.stdout.trim();
}

const ROOT = repoRoot();

function nixInputs(pins: readonly DepPin[]): DepPin[] {
  return pins.filter((p) => p.category === "nix-input");
}

describe("flake discovery is derived, not hardcoded", () => {
  test("git ls-files finds BOTH tracked flakes, root included", () => {
    const flakes = trackedFlakeFiles(ROOT);
    // The root flake is the one the hardcoded path missed.
    expect(flakes).toContain("flake.nix");
    expect(flakes).toContain("full-ai-cluster/flake.nix");
  });

  test("every discovered path really is a flake.nix", () => {
    for (const f of trackedFlakeFiles(ROOT)) {
      expect(f.split("/").at(-1)).toBe("flake.nix");
    }
  });

  test("the roster is not a two-element literal — it tracks the repo", () => {
    // A hardcoded pair would still pass the two `toContain` assertions
    // above. This one does not: it re-derives the roster from git
    // independently and requires the audit's roster to equal it exactly.
    const viaGit = spawnSync("git", ["ls-files", "--", "*flake.nix"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(viaGit.status).toBe(0);
    const expected = viaGit.stdout
      .split("\n")
      .filter((p) => p.length > 0 && p.split("/").at(-1) === "flake.nix")
      .sort();
    expect(trackedFlakeFiles(ROOT)).toEqual(expected);
  });
});

describe("the ROOT flake's inputs reach the audit output BY NAME", () => {
  // This is the assertion the task turns on: a scan that silently found
  // zero inputs from the root flake would look identical to a pass.
  const rootPins = nixInputs(collectPins(ROOT)).filter((p) => p.file === "flake.nix");

  test("all four root inputs are present", () => {
    expect(rootPins.map((p) => p.name).sort()).toEqual([
      "flake-utils",
      "nix-darwin",
      "nixos-hardware",
      "nixpkgs",
    ]);
  });

  test("each carries the live pin value read from the file, not a placeholder", () => {
    const byName = new Map(rootPins.map((p) => [p.name, p]));
    const nixpkgs = byName.get("nixpkgs")!;
    const darwin = byName.get("nix-darwin")!;
    // Structural, not version-locked — see the header note.
    expect(nixpkgs.currentPin).toStartWith("github:NixOS/nixpkgs/nixos-");
    expect(darwin.currentPin).toStartWith("github:nix-darwin/nix-darwin/nix-darwin-");
    expect(byName.get("nixos-hardware")!.currentPin).toStartWith("github:NixOS/nixos-hardware/");
    expect(byName.get("flake-utils")!.currentPin).toStartWith("github:numtide/flake-utils");

    // The pin the audit reports must be the pin the file actually
    // contains at the line the audit names. This is what makes the two
    // assertions above non-vacuous: it proves the value was READ rather
    // than reconstructed.
    const lines = readFileSync(join(ROOT, "flake.nix"), "utf8").split("\n");
    for (const p of rootPins) {
      expect(lines[p.line - 1]).toContain(p.currentPin);
    }
  });

  test("nix-darwin proves the ATTRSET form is parsed", () => {
    // `nix-darwin = { url = "..."; inputs.nixpkgs.follows = "nixpkgs"; };`
    // has no `nix-darwin.url` line anywhere. The old `name.url`-only
    // regex dropped it even in the file it did read.
    const darwin = rootPins.find((p) => p.name === "nix-darwin");
    expect(darwin).toBeDefined();
    expect(readFileSync(join(ROOT, "flake.nix"), "utf8")).not.toContain("nix-darwin.url");
  });
});

describe("both flakes contribute; neither crowds the other out", () => {
  const pins = nixInputs(collectPins(ROOT));

  test("pins come from at least two distinct flake files", () => {
    expect(new Set(pins.map((p) => p.file)).size).toBeGreaterThanOrEqual(2);
  });

  test("full-ai-cluster's inputs did not regress", () => {
    const cluster = pins.filter((p) => p.file === "full-ai-cluster/flake.nix");
    // Three the old regex caught, plus the two attrset-form inputs
    // (nix-darwin, disko) it silently dropped in the file it DID read.
    expect(cluster.map((p) => p.name).sort()).toEqual([
      "disko",
      "flake-utils",
      "nix-darwin",
      "nixos-hardware",
      "nixpkgs",
    ]);
  });
});

describe("parseFlakeInputs — fixture-level behaviour", () => {
  test("parses both declaration forms", () => {
    const pins = parseFlakeInputs(
      [
        "{",
        "  inputs = {",
        '    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";',
        "    nix-darwin = {",
        '      url = "github:nix-darwin/nix-darwin/nix-darwin-26.05";',
        '      inputs.nixpkgs.follows = "nixpkgs";',
        "    };",
        "  };",
        "}",
      ].join("\n"),
      "fixture/flake.nix",
    );
    expect(pins).toEqual([
      {
        category: "nix-input",
        file: "fixture/flake.nix",
        line: 3,
        name: "nixpkgs",
        currentPin: "github:NixOS/nixpkgs/nixos-26.05",
      },
      {
        category: "nix-input",
        file: "fixture/flake.nix",
        line: 5,
        name: "nix-darwin",
        currentPin: "github:nix-darwin/nix-darwin/nix-darwin-26.05",
      },
    ]);
  });

  test("a `url` outside the inputs block is NOT an input pin", () => {
    // Guards the widening: now that the bare `url = "..."` form counts,
    // an unscoped match would report `outputs`-side strings as dep pins.
    const pins = parseFlakeInputs(
      [
        "{",
        "  inputs = {",
        '    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";',
        "  };",
        "  outputs = { self, nixpkgs }: {",
        "    packages.x = {",
        '      url = "https://example.invalid/not-an-input";',
        "    };",
        "  };",
        "}",
      ].join("\n"),
      "fixture/flake.nix",
    );
    expect(pins.map((p) => p.name)).toEqual(["nixpkgs"]);
  });

  test("a flake with no inputs block yields nothing", () => {
    expect(parseFlakeInputs('{ outputs = { self }: { }; }\n', "fixture/flake.nix")).toEqual([]);
  });

  test("follows-only inputs are reported as no pin, not a fake one", () => {
    // `inputs.nixpkgs.follows` declares a relationship, not a version
    // pin. Reporting it as one would be an invented pin.
    const pins = parseFlakeInputs(
      ["{", "  inputs = {", "    disko = {", '      inputs.nixpkgs.follows = "nixpkgs";', "    };", "  };", "}"].join(
        "\n",
      ),
      "fixture/flake.nix",
    );
    expect(pins).toEqual([]);
  });
});
