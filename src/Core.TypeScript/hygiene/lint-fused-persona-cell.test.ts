import { describe, expect, test } from "bun:test";

import {
  baselineKey,
  findFusedLiterals,
  isAllowlisted,
  isInScope,
  splitByBaseline,
  surfaceVocabulary,
} from "./lint-fused-persona-cell";

const FILE = "src/Core.TypeScript/example/module.ts";

describe("surfaceVocabulary", () => {
  test("is registry-derived (CELL_SURFACES), incl. the 2026-07-08 additions", () => {
    const v = surfaceVocabulary();
    for (const s of ["cli", "desktop", "kiro", "cursor", "codex", "verifier-node"]) {
      expect(v.has(s)).toBe(true);
    }
    // added to cell-surfaces.yaml 2026-07-08 (open finding 2026-07-04 closed)
    for (const s of ["cowork", "browser-tab", "chat"]) {
      expect(v.has(s)).toBe(true);
    }
  });
});

describe("findFusedLiterals — hyphen (legacy composite) form", () => {
  test.each([
    ['const sender = "otto-cli";', "otto-cli"],
    ["const s = 'alexa-kiro';", "alexa-kiro"],
    ["publish(`vera-codex`);", "vera-codex"],
  ])("flags %s", (line, token) => {
    const found = findFusedLiterals(line, FILE);
    expect(found).toHaveLength(1);
    expect(found[0].literal).toBe(token);
    expect(found[0].form).toBe("hyphen");
  });

  test("does not flag a composite embedded in a longer slug (doc filenames)", () => {
    const line =
      'const doc = "docs/research/2026-05-15-ferry-lior-gemini-cascade-close.md";';
    expect(findFusedLiterals(line, FILE)).toHaveLength(0);
  });

  test("does not flag persona followed by a non-surface word", () => {
    const line = 'const note = "aaron-correction banked";';
    expect(findFusedLiterals(line, FILE)).toHaveLength(0);
  });

  test("does not flag outside string literals (comments, identifiers)", () => {
    const line = "// legacy otto-cli sender ids are parsed via actor-ref";
    expect(findFusedLiterals(line, FILE)).toHaveLength(0);
  });
});

describe("findFusedLiterals — slash (canonical projection) form", () => {
  test.each([
    ['const a = "otto/cli";', "otto/cli"],
    ['const b = "vera/codex/2";', "vera/codex/2"],
    ['const c = "otto/cli/2@node7";', "otto/cli/2@node7"],
    ['const d = "soraya/verifier-node";', "soraya/verifier-node"],
  ])("flags %s", (line, token) => {
    const found = findFusedLiterals(line, FILE);
    expect(found).toHaveLength(1);
    expect(found[0].literal).toBe(token);
    expect(found[0].form).toBe("slash");
  });

  test("does not flag persona/branch-slug paths (surface vocabulary is closed)", () => {
    const line = 'const branch = "otto/persona-cell-identity-adr-treaty-phase1";';
    expect(findFusedLiterals(line, FILE)).toHaveLength(0);
  });

  test("does not flag SPIFFE URIs mid-path (preceded by /)", () => {
    // spiffe://zeta/persona/otto/cell/… — "otto/cell" has "/" before persona
    const line = 'const id = "spiffe://zeta/persona/otto/cell/cli";';
    expect(findFusedLiterals(line, FILE)).toHaveLength(0);
  });
});

describe("exemption marker", () => {
  test("fused-ok: comment suppresses the line", () => {
    const line = 'const fixture = "otto-cli"; // fused-ok: legacy round-trip fixture';
    expect(findFusedLiterals(line, FILE)).toHaveLength(0);
  });
});

describe("multi-line and multi-hit", () => {
  test("reports one finding per fused token with 1-based line numbers", () => {
    const src = [
      "const clean = 1;",
      'const pair = ["otto-cli", "riven-cursor"];',
      'const canonical = "otto/desktop";',
    ].join("\n");
    const found = findFusedLiterals(src, FILE);
    expect(found).toHaveLength(3);
    expect(found[0].line).toBe(2);
    expect(found[1].line).toBe(2);
    expect(found[2].line).toBe(3);
  });
});

describe("scope and allowlist", () => {
  test("the one parser module and its golden vectors are allowlisted", () => {
    expect(isAllowlisted("src/Core.TypeScript/identity/actor-ref.ts")).toBe(true);
    expect(isAllowlisted("src/Core.TypeScript/identity/actor-ref.test.ts")).toBe(true);
    expect(isAllowlisted("src/Core/ActorRef.fs")).toBe(true);
    expect(isAllowlisted("src/Core.TypeScript/bus/types.ts")).toBe(false);
  });

  test("scope is src/tools/tests source files", () => {
    expect(isInScope("src/Core.TypeScript/bus/types.ts")).toBe(true);
    expect(isInScope("tools/setup/persona-keys/ca-cli.ts")).toBe(true);
    expect(isInScope("docs/research/anything.md")).toBe(false);
    expect(isInScope("src/Core.TypeScript/identity/actor-ref.ts")).toBe(false); // allowlisted
    expect(isInScope("src/Core/GeneratorRegistry.fs")).toBe(true);
  });
});

describe("baseline ratchet", () => {
  test("splits grandfathered from new violations by file:literal key", () => {
    const findings = findFusedLiterals(
      ['const a = "otto-cli";', 'const b = "riven-cursor";'].join("\n"),
      FILE,
    );
    const baseline = new Set([baselineKey(findings[0])]);
    const { grandfathered, violations } = splitByBaseline(findings, baseline);
    expect(grandfathered).toHaveLength(1);
    expect(violations).toHaveLength(1);
    expect(violations[0].literal).toBe("riven-cursor");
  });
});
