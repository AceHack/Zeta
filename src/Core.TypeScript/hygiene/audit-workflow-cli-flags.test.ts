/**
 * Tests for audit-workflow-cli-flags — the lint that closes the
 * "workflow passes a flag the tool rejects" vacuity class.
 *
 * Two of these tests are regressions against false positives this lint itself
 * produced while being written. Both are recorded deliberately: a guard that
 * cries wolf gets switched off, and a switched-off guard is worse than none.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  auditWorkflowCliFlags,
  extractAcceptedFlags,
  extractInvocations,
  hasClosedFlagSet,
  stripComments,
} from "./audit-workflow-cli-flags.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

/** Build a throwaway repo with one workflow and one tool. */
function fixture(toolSource: string, workflowBody: string): string {
  const root = mkdtempSync(join(tmpdir(), "wf-cli-flags-"));
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
  mkdirSync(join(root, "src", "tools"), { recursive: true });
  writeFileSync(join(root, "src", "tools", "demo.ts"), toolSource);
  writeFileSync(join(root, ".github", "workflows", "demo.yml"), workflowBody);
  return root;
}

const CLOSED_TOOL = `
function parseArgs(argv) {
  for (const arg of argv) {
    if (arg === "--owner") {}
    else if (arg === "--limit") {}
    else { process.stderr.write("unknown arg: " + arg); process.exit(1); }
  }
}
`;

describe("extractAcceptedFlags", () => {
  test("reads plain equality comparisons", () => {
    expect([...extractAcceptedFlags(CLOSED_TOOL)].sort()).toEqual(["--limit", "--owner"]);
  });

  test("REGRESSION: reads table-driven flag sets", () => {
    // False positive #1. An earlier draft matched only `arg === "--x"` shapes and
    // reported --dry-run/--run in k8s-argocd-health-test.yml as violations, because
    // argocd-health-test.ts accepts them via a lookup table and a Set.
    const src = `
      const MODE_FLAGS = { "--dry-run": "dry-run", "--run": "run" };
      const STRING_FLAGS = new Set(["--git-ref", "--cluster-name"]);
      if (arg === "--existing") {}
      // unknown argument
    `;
    const flags = extractAcceptedFlags(src);
    for (const f of ["--dry-run", "--run", "--git-ref", "--cluster-name", "--existing"]) {
      expect(flags.has(f)).toBe(true);
    }
  });
});

describe("stripComments", () => {
  test("REGRESSION: a glob inside a line comment does not open a block comment", () => {
    // False positive #2. Stripping block comments FIRST let the `/*` inside
    // `// ... .claude/rules/*.md` swallow 6915 bytes of audit-rule-cross-refs.ts,
    // taking the "--report" literal with it and reporting an accepted flag as a
    // violation. Line comments must be removed first.
    const src = ['// see `.claude/rules/*.md` for detail', 'if (a === "--report") {}'].join("\n");
    expect(stripComments(src)).toContain('"--report"');
    expect(extractAcceptedFlags(src).has("--report")).toBe(true);
  });

  test("a flag mentioned only in prose is not counted as accepted", () => {
    expect(extractAcceptedFlags('// we never supported "--batch" here\n').has("--batch")).toBe(
      false,
    );
  });
});

describe("hasClosedFlagSet", () => {
  test("true only when the parser rejects unknown args", () => {
    expect(hasClosedFlagSet(CLOSED_TOOL)).toBe(true);
    expect(hasClosedFlagSet("const x = 1;")).toBe(false);
  });
});

describe("extractInvocations", () => {
  test("joins shell line-continuations", () => {
    const got = extractInvocations(
      "bun src/tools/demo.ts \\\n  --owner X --limit 3 \\\n  --extra\n",
    );
    expect(got[0]?.flags).toEqual(["--owner", "--limit", "--extra"]);
  });

  test("stops at a pipe so the next command's flags are not attributed", () => {
    const got = extractInvocations("bun src/tools/demo.ts --owner X | tail --lines 10\n");
    expect(got[0]?.flags).toEqual(["--owner"]);
  });

  test("ignores interpolated tokens it cannot resolve", () => {
    const got = extractInvocations("bun src/tools/demo.ts --owner $OWNER ${{ inputs.x }}\n");
    expect(got[0]?.flags).toEqual(["--owner"]);
  });
});

describe("auditWorkflowCliFlags — mutation proof", () => {
  test("clean invocation produces no violation", () => {
    const root = fixture(CLOSED_TOOL, "jobs:\n  a:\n    steps:\n      - run: |\n          bun src/tools/demo.ts --owner X --limit 3\n");
    expect(auditWorkflowCliFlags(root).violations).toEqual([]);
  });

  test("PLANTED MUTATION: an unaccepted flag is caught", () => {
    // This is the proof the lint is not itself vacuous. Same tool, same workflow
    // shape, one bogus flag — exactly the real `--batch 3` defect in miniature.
    const root = fixture(CLOSED_TOOL, "jobs:\n  a:\n    steps:\n      - run: |\n          bun src/tools/demo.ts --owner X --batch 3\n");
    const violations = auditWorkflowCliFlags(root).violations;
    expect(violations.length).toBe(1);
    expect(violations[0]?.flag).toBe("--batch");
  });

  test("a tool that tolerates unknown flags is skipped, not guessed at", () => {
    const open = 'for (const a of argv) { if (a === "--owner") {} }';
    const root = fixture(open, "jobs:\n  a:\n    steps:\n      - run: |\n          bun src/tools/demo.ts --whatever\n");
    const result = auditWorkflowCliFlags(root);
    expect(result.violations).toEqual([]);
    expect(result.toolsSkippedOpenParser).toContain("src/tools/demo.ts");
  });
});

describe("the real repository", () => {
  test("no workflow passes a flag its tool would reject", () => {
    const result = auditWorkflowCliFlags(REPO_ROOT);
    const rendered = result.violations
      .map((v) => `${v.workflow} -> ${v.tool} ${v.flag}`)
      .join("\n");
    expect(rendered).toBe("");
  });

  test("the audit actually inspected something (guards against a silent zero-scan)", () => {
    // Without this, a broken glob or a moved workflow directory would make the
    // test above pass by examining nothing at all — the same vacuity class.
    const result = auditWorkflowCliFlags(REPO_ROOT);
    expect(result.invocationsScanned).toBeGreaterThan(50);
    expect(result.toolsChecked.length).toBeGreaterThan(5);
  });
});
