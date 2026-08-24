// audit-linter-coverage-vs-invocation.test.ts — the falsifiers.
//
// A meta-check for the vacuity class that is itself vacuous would be the worst possible
// outcome here, so every check in the audit gets a fixture that must turn it RED, and the
// green cases are paired with the red ones rather than asserted alone. A test that only
// ever sees the passing input is the very thing the audit refuses in other people's code.
//
// R2 IN BOTH DIRECTIONS. Where a ledger is involved, the falsifier goes both ways: a new
// unrecorded gap fails, AND a recorded gap that has closed fails. A one-directional ledger
// check is a suppression list with a test suite.

import { describe, expect, test } from "bun:test";
import {
  canonicalizeExclude,
  checkCorpusFloors,
  checkDiscoveryClaimed,
  checkExclusionParity,
  checkRouteFloors,
  checkScriptParity,
  checkToolDispositions,
  discoverByConfigFile,
  discoverByDevDependency,
  discoverByScriptBinary,
  lintFamilyScripts,
  ROUTE_FLOORS,
  TOOLS,
  type Finding,
  type ToolRow,
} from "./audit-linter-coverage-vs-invocation.ts";

const red = (fs: readonly Finding[]): Finding[] => fs.filter((f) => !f.ok);

const row = (over: Partial<ToolRow> = {}): ToolRow => ({
  id: "fixture",
  coverage: "fixture coverage",
  configFiles: [],
  claims: ["fixture"],
  invokedBy: ["fixture-bin"],
  disposition: "gated",
  cost: "fixture",
  ...over,
});

describe("CHECK 2 — tool discovery (the instance-#4 catcher)", () => {
  test("a discovered linter no TOOLS row claims is RED", () => {
    const f = checkDiscoveryClaimed({ devDependency: ["oxlint"] }, [row({ claims: ["eslint"] })]);
    expect(red(f)).toHaveLength(1);
    expect(red(f)[0]!.message).toContain("oxlint");
  });

  test("the same discovery, once claimed, is GREEN", () => {
    expect(red(checkDiscoveryClaimed({ devDependency: ["oxlint"] }, [row({ claims: ["oxlint"] })]))).toHaveLength(0);
  });

  test("claims match case-insensitively, so a config-file spelling does not need a duplicate row", () => {
    expect(red(checkDiscoveryClaimed({ configFile: [".ESLintrc"] }, [row({ claims: [".eslintrc"] })]))).toHaveLength(0);
  });

  test("the route is NAMED in the failure, so a reader knows which recognizer fired", () => {
    const f = checkDiscoveryClaimed({ configFile: ["biome.json"] }, [row({ claims: [] })]);
    expect(red(f)[0]!.message).toContain("configFile");
  });
});

describe("CHECK 2 — discovery routes recognize tools nobody told them about", () => {
  test("devDependency route matches by SHAPE, not by an enumerated list of our tools", () => {
    // None of these four are in Zeta today. A name-list route would miss all of them.
    const got = discoverByDevDependency(["oxlint", "@biomejs/biome", "dprint", "some-lint-plugin", "left-pad"]);
    expect(got).toEqual(["@biomejs/biome", "dprint", "oxlint", "some-lint-plugin"]);
    expect(got).not.toContain("left-pad");
  });

  test("config-file route recognizes an unfamiliar linter's dotfile", () => {
    expect(discoverByConfigFile([".oxlintrc.json", "README.md", "biome.json"])).toEqual([".oxlintrc.json", "biome.json"]);
  });

  test("script-binary route extracts the THIRD-PARTY tool and skips our own bun scripts", () => {
    const got = discoverByScriptBinary({
      "lint:css": 'stylelint "**/*.css" --allow-empty-input',
      "lint:mine": "bun ./src/Core.TypeScript/hygiene/audit-something.ts",
      "hygiene:x": "bun ./src/Core.TypeScript/hygiene/x.ts",
      typecheck: "node node_modules/typescript/bin/tsc --noEmit",
      unrelated: "bun run build",
    });
    expect(got).toContain("stylelint");
    expect(got).toContain("tsc");
    expect(got).not.toContain("audit-something.ts");
    expect(got).not.toContain("x.ts");
    expect(got).not.toContain("unrelated"); // not in the lint family at all
  });

  test("lintFamilyScripts is the CHECK 1 corpus and keeps hygiene scripts that CHECK 2 drops", () => {
    expect(lintFamilyScripts(["hygiene:x", "lint:y", "format:z", "typecheck", "build"])).toEqual([
      "format:z",
      "hygiene:x",
      "lint:y",
      "typecheck",
    ]);
  });
});

describe("CHECK 2 — disposition parity, both directions", () => {
  test("declared GATED with no invocation is RED (the CI wiring vanished)", () => {
    const f = checkToolDispositions([row({ id: "eslint", disposition: "gated" })], new Map([["eslint", []]]));
    expect(red(f)).toHaveLength(1);
    expect(red(f)[0]!.message).toContain("declared GATED");
  });

  test("declared UNGATED that IS invoked is ALSO RED — good news the ledger lies about", () => {
    const f = checkToolDispositions([row({ id: "prettier", disposition: "ungated" })], new Map([["prettier", ["gate.yml"]]]));
    expect(red(f)).toHaveLength(1);
    expect(red(f)[0]!.message).toContain("declared UNGATED");
  });

  test("both dispositions matching reality are GREEN", () => {
    const f = checkToolDispositions(
      [row({ id: "a", disposition: "gated" }), row({ id: "b", disposition: "ungated" })],
      new Map([
        ["a", ["gate.yml"]],
        ["b", []],
      ]),
    );
    expect(red(f)).toHaveLength(0);
  });
});

describe("CHECK 1 — script parity, both directions", () => {
  const declared = { "format:check": "reason" };

  test("an uninvoked script that nobody declared is RED", () => {
    const f = checkScriptParity(["lint:new"], new Set(), declared);
    expect(red(f).some((x) => x.message.includes("lint:new"))).toBe(true);
  });

  test("a declared-uninvoked script that has STARTED being invoked is RED", () => {
    const f = checkScriptParity(["format:check"], new Set(["format:check"]), declared);
    expect(red(f).some((x) => x.message.includes("suppression list"))).toBe(true);
  });

  test("a declaration for a script that no longer exists is RED — a suppression cannot outlive its cause", () => {
    const f = checkScriptParity([], new Set(), { "lint:deleted": "reason" });
    expect(red(f).some((x) => x.message.includes("no longer a package.json script"))).toBe(true);
  });

  test("invoked, or declared-and-uninvoked, is GREEN", () => {
    expect(red(checkScriptParity(["format:check", "lint:run"], new Set(["lint:run"]), declared))).toHaveLength(0);
  });
});

describe("CHECK 3 — the examined-corpus floor (exit 0 over zero files)", () => {
  test("a tool that examined ZERO files is RED even though its linter would exit 0", () => {
    const f = checkCorpusFloors([row({ corpus: { floor: 10, how: "fixture" } })], new Map([["fixture", 0]]));
    expect(red(f)).toHaveLength(1);
    expect(red(f)[0]!.message).toContain("indistinguishable");
  });

  test("a corpus that collapsed but is not empty is RED too — zero is not the only blindness", () => {
    expect(red(checkCorpusFloors([row({ corpus: { floor: 1400, how: "f" } })], new Map([["fixture", 3]])))).toHaveLength(1);
  });

  test("a declared floor that NOTHING MEASURED is RED — an unmeasured floor is vacuity wearing a floor's clothes", () => {
    const f = checkCorpusFloors([row({ corpus: { floor: 10, how: "f" } })], new Map());
    expect(red(f)).toHaveLength(1);
    expect(red(f)[0]!.message).toContain("nothing measured");
  });

  test("at or above the floor is GREEN, and exactly-at-floor is not off-by-one RED", () => {
    expect(red(checkCorpusFloors([row({ corpus: { floor: 10, how: "f" } })], new Map([["fixture", 10]])))).toHaveLength(0);
  });
});

describe("CHECK 4 — exclusion-list parity", () => {
  test("canonical form collapses the any-depth prefix and the recursive suffix", () => {
    for (const p of ["bin", "bin/**", "**/bin", "**/bin/**", "bin/"]) expect(canonicalizeExclude(p)).toBe("bin");
  });

  test("canonicalization does NOT collapse genuinely different trees", () => {
    expect(canonicalizeExclude("src/wasm-dla/**")).not.toBe(canonicalizeExclude("src/wasm-dla/assemblyscript/**"));
  });

  test("a NEW tsconfig-only exclusion the ledger does not know is RED", () => {
    const f = checkExclusionParity(["node_modules", "src/brand-new/**"], ["node_modules"], []);
    expect(red(f).some((x) => x.message.includes("src/brand-new"))).toBe(true);
  });

  test("a declared divergence that has been REPAIRED is RED until the ledger admits it", () => {
    const f = checkExclusionParity(["node_modules"], ["node_modules"], ["src/old-gap"]);
    expect(red(f).some((x) => x.message.includes("no longer diverge"))).toBe(true);
  });

  test("an eslint-only ignore is RED — the same defect pointing the other way", () => {
    const f = checkExclusionParity(["node_modules"], ["node_modules", "src/only-eslint/**"], []);
    expect(red(f).some((x) => x.message.includes("src/only-eslint"))).toBe(true);
  });

  test("exact agreement with the declared divergence set is GREEN", () => {
    expect(red(checkExclusionParity(["node_modules", "db/**"], ["node_modules"], ["db"]))).toHaveLength(0);
  });
});

describe("the audit's own blindness — route floors", () => {
  test("a route that recognizes NOTHING fails naming itself", () => {
    const f = checkRouteFloors({ workflows: 0, scripts: 99, discoveryScripts: 99, discoveryDevDeps: 99, discoveryConfigFiles: 99 });
    expect(red(f)).toHaveLength(1);
    expect(red(f)[0]!.message).toContain("workflows");
    expect(red(f)[0]!.message).toContain("went");
  });

  test("a MISSING route counts as zero, not as absent — an unreported route is a dark route", () => {
    expect(red(checkRouteFloors({}))).toHaveLength(Object.keys(ROUTE_FLOORS).length);
  });
});

describe("the ledger itself is well-formed", () => {
  test("every tool id is unique", () => {
    const ids = TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every GATED tool carries a corpus floor — otherwise CHECK 3 is optional, which is CHECK 3's own failure mode", () => {
    for (const t of TOOLS.filter((t) => t.disposition === "gated")) {
      expect(t.corpus, `${t.id} is gated with no corpus floor`).toBeDefined();
      expect(t.corpus!.floor).toBeGreaterThan(0);
    }
  });

  test("every row states a measured cost, and no row leaves it as a placeholder", () => {
    for (const t of TOOLS) {
      expect(t.cost.length, `${t.id} cost`).toBeGreaterThan(40);
      expect(t.cost.toLowerCase()).not.toContain("tbd");
    }
  });

  test("every row declares at least one invocation recognizer, including ungated ones", () => {
    // An ungated row with no recognizer could never be promoted by CHECK 2's second
    // direction: it would stay 'ungated' forever no matter what CI started doing.
    for (const t of TOOLS) expect(t.invokedBy.length, `${t.id}`).toBeGreaterThan(0);
  });
});
