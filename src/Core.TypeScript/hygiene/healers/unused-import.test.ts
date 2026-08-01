import { describe, test, expect } from "bun:test";
import { certify, tree, type Fixture } from "../healer-harness";
import { unusedImportHealer, unusedImportDetector } from "./unused-import";

const fixtures: Fixture[] = [
  {
    name: "one unused import",
    tree: tree({
      "src/main.ts": `import { used } from "./lib";\nimport { unused } from "./other";\n\nconsole.log(used);\n`,
    }),
  },
  {
    name: "all imports used (no-op)",
    tree: tree({
      "src/clean.ts": `import { foo } from "./lib";\n\nexport const x = foo();\n`,
    }),
  },
  {
    name: "multiple unused in one import",
    tree: tree({
      "src/multi.ts": `import { a, b, c } from "./lib";\n\nconsole.log("none used");\n`,
    }),
  },
  {
    name: "default import unused",
    tree: tree({
      "src/def.ts": `import React from "react";\n\nexport const x = 1;\n`,
    }),
  },
  {
    name: "type import unused",
    tree: tree({
      "src/types.ts": `import type { MyType } from "./types";\n\nexport const x = 1;\n`,
    }),
  },
  {
    name: "empty tree",
    tree: tree({}),
  },
];

describe("unused-import healer — Tier 0 certification", () => {
  test("passes all three laws (idempotence, closure, convergence)", () => {
    const verdict = certify(unusedImportHealer, [unusedImportDetector], fixtures);
    if (!verdict.pass) {
      console.error("Violations:", verdict.violations);
    }
    expect(verdict.pass).toBe(true);
    expect(verdict.violations).toHaveLength(0);
  });

  test("removes unused imports", () => {
    const input = tree({
      "src/main.ts": `import { used } from "./lib";\nimport { unused } from "./other";\n\nconsole.log(used);\n`,
    });
    const healed = unusedImportHealer.heal(input);
    const content = healed.get("src/main.ts")!;
    expect(content).not.toContain("unused");
    expect(content).toContain("used");
  });

  test("leaves clean files untouched", () => {
    const input = tree({
      "src/clean.ts": `import { foo } from "./lib";\n\nexport const x = foo();\n`,
    });
    const healed = unusedImportHealer.heal(input);
    expect(healed.get("src/clean.ts")).toBe(input.get("src/clean.ts"));
  });

  test("detector finds unused imports", () => {
    const input = tree({
      "src/main.ts": `import { unused } from "./lib";\n\nconsole.log("hello");\n`,
    });
    const findings = unusedImportDetector.detect(input);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.rule).toBe("TS6133");
  });

  test("detector produces zero findings on clean code", () => {
    const input = tree({
      "src/clean.ts": `import { foo } from "./lib";\n\nexport const x = foo();\n`,
    });
    const findings = unusedImportDetector.detect(input);
    expect(findings).toHaveLength(0);
  });
});
