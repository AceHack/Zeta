import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { audit, coveredBy, importsPlaywright, parseIgnorePatterns } from "./audit-playwright-specs-excluded-from-bun.ts";

const CONFIG = (patterns: readonly string[]): string =>
  `# a comment mentioning pathIgnorePatterns in prose, which must not be matched\n` +
  `# and a quoted "decoy pattern" inside a comment\n` +
  `[test]\npathIgnorePatterns = [\n${patterns.map((p) => `  "${p}",`).join("\n")}\n]\n`;

function tree(spec: string | null, base: readonly string[], herm: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), "pw-audit-"));
  writeFileSync(join(root, "bunfig.toml"), CONFIG(base), "utf-8");
  writeFileSync(join(root, "bunfig.hermetic.toml"), CONFIG(herm), "utf-8");
  if (spec !== null) {
    mkdirSync(join(root, "uat"), { recursive: true });
    writeFileSync(join(root, "uat", "x.spec.ts"), spec, "utf-8");
  }
  return root;
}

const PW = 'import { test } from "playwright/test";\n';

describe("THE MUTATION: it must actually fail", () => {
  test("an UNEXCLUDED playwright spec is a finding — in both configs", () => {
    const root = tree(PW, [], []);
    const f = audit(root, readFileSync(join(root, "bunfig.toml"), "utf-8"), readFileSync(join(root, "bunfig.hermetic.toml"), "utf-8"));
    expect(f.length).toBe(1);
    expect(f[0]?.file).toBe(join("uat", "x.spec.ts"));
    expect(f[0]?.missingFrom).toEqual(["bunfig.toml", "bunfig.hermetic.toml"]);
  });

  test("excluded from ONE config only is still a finding — the lists must stay set-equal", () => {
    const root = tree(PW, ["uat/**"], []);
    const f = audit(root, readFileSync(join(root, "bunfig.toml"), "utf-8"), readFileSync(join(root, "bunfig.hermetic.toml"), "utf-8"));
    expect(f.length).toBe(1);
    expect(f[0]?.missingFrom).toEqual(["bunfig.hermetic.toml"]);
  });

  test("excluded from BOTH is silent", () => {
    const root = tree(PW, ["uat/**"], ["uat/**"]);
    expect(audit(root, readFileSync(join(root, "bunfig.toml"), "utf-8"), readFileSync(join(root, "bunfig.hermetic.toml"), "utf-8"))).toEqual([]);
  });

  test("NEGATIVE CONTROL: a .spec.ts that does NOT import playwright is not a finding", () => {
    const root = tree('import { test } from "bun:test";\n', [], []);
    expect(audit(root, readFileSync(join(root, "bunfig.toml"), "utf-8"), readFileSync(join(root, "bunfig.hermetic.toml"), "utf-8"))).toEqual([]);
  });
});

describe("the parser defects this shipped with, pinned", () => {
  test("`pathIgnorePatterns` in a COMMENT does not become the key", () => {
    // The live bug: hermetic's prose mentions it 60 lines above the real key,
    // and the first draft returned ZERO patterns — which reads as "excludes
    // nothing" rather than as a parse failure, so it would have reported a
    // confident false positive against a correct repository.
    const pats = parseIgnorePatterns(CONFIG(["a/**", "b/**"]));
    expect(pats).toEqual(["a/**", "b/**"]);
  });

  test("quoted prose inside a comment is not captured as a pattern", () => {
    expect(parseIgnorePatterns(CONFIG(["a/**"]))).not.toContain("decoy pattern");
  });

  test("a file with no pathIgnorePatterns key yields none", () => {
    expect(parseIgnorePatterns("[test]\ncoverage = true\n")).toEqual([]);
  });
});

describe("coverage matching is conservative on purpose", () => {
  test("dir/** covers a file under it", () => {
    expect(coveredBy(["uat/**"], "uat/x.spec.ts")).toBe(true);
  });
  test("an exact path covers itself", () => {
    expect(coveredBy(["uat/x.spec.ts"], "uat/x.spec.ts")).toBe(true);
  });
  test("an unrelated prefix does not cover", () => {
    expect(coveredBy(["other/**"], "uat/x.spec.ts")).toBe(false);
  });
  test("an UNRECOGNISED pattern shape does NOT count as covering — fails toward reporting", () => {
    expect(coveredBy(["uat/*.spec.?s"], "uat/x.spec.ts")).toBe(false);
  });
});

describe("import detection", () => {
  test("both entry points, both quote styles", () => {
    expect(importsPlaywright('import { test } from "playwright/test";')).toBe(true);
    expect(importsPlaywright("import { test } from '@playwright/test';")).toBe(true);
  });
  test("bun:test is not playwright", () => {
    expect(importsPlaywright('import { test } from "bun:test";')).toBe(false);
  });
});
