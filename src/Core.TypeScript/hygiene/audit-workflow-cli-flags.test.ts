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
  stripWorkflowComments,
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

/**
 * The PR #10853 instance, reduced to two fixtures that differ by ONE thing:
 * whether the refusal exists in code or only in the prose explaining it.
 *
 * `TOOL_BODY` always carries the comment. The parameter is the guard itself, so
 * `GUARD_IN_PROSE_ONLY` is a tool with a doc comment about unknown arguments and
 * no rejection at all — which is precisely the file shape that fooled the old
 * detector: the explanation of the guard satisfied the guard-detector.
 */
const TOOL_BODY = (guard: string): string => `
function parseArgs(argv) {
  for (const a of argv) {
    if (a === "--repo-root") continue;
    // Anything else is refused. The phrase "unknown arg" appears in this
    // comment because it is what the diagnostic below prints.
    ${guard}
  }
}
`;
const GUARD_IN_CODE = TOOL_BODY('process.stderr.write("unknown arg: " + a); process.exit(2);');
const GUARD_IN_PROSE_ONLY = TOOL_BODY("");

describe("hasClosedFlagSet", () => {
  test("true only when the parser rejects unknown args", () => {
    expect(hasClosedFlagSet(CLOSED_TOOL)).toBe(true);
    expect(hasClosedFlagSet("const x = 1;")).toBe(false);
  });

  test("the two fixtures really do differ only in WHERE the phrase sits", () => {
    // Fails-for-the-right-reason control. Without this, a fixture that silently
    // lost the phrase altogether would make the test below pass while proving
    // nothing — the same vacuity class the lint exists to close, committed in
    // the lint's own harness.
    expect(/unknown arg/i.test(GUARD_IN_PROSE_ONLY)).toBe(true);
    expect(/unknown arg/i.test(stripComments(GUARD_IN_PROSE_ONLY))).toBe(false);
    expect(/unknown arg/i.test(stripComments(GUARD_IN_CODE))).toBe(true);
  });

  test("a guard that exists only in a comment does NOT read as a closed flag set", () => {
    expect(hasClosedFlagSet(GUARD_IN_PROSE_ONLY)).toBe(false);
  });

  test("POSITIVE CONTROL: the same tool with the guard in code does", () => {
    expect(hasClosedFlagSet(GUARD_IN_CODE)).toBe(true);
  });

  test("a block comment fools it no more than a line comment does", () => {
    const src = "/**\n * Rejects an unknown argument before writing.\n */\nconst x = 1;\n";
    expect(/unknown argument/i.test(src)).toBe(true);
    expect(hasClosedFlagSet(src)).toBe(false);
  });
});

describe("stripWorkflowComments", () => {
  test("blanks whole-line # comments and preserves the line count", () => {
    expect(stripWorkflowComments("#  bun src/tools/demo.ts --owner X\nlive\n")).toBe("\nlive\n");
    const body = "a\n#  b\n   # c\nd\n";
    expect(stripWorkflowComments(body).split("\n").length).toBe(body.split("\n").length);
  });

  test("keeps a # that is inside a live line's arguments", () => {
    // Guards the over-strip direction: `#` appears in quoted arguments, URL
    // fragments and colour literals, and eating from the first `#` on a live
    // line would silently truncate real invocations.
    const line = '          bun src/tools/demo.ts --title "fix #10853"\n';
    expect(stripWorkflowComments(line)).toBe(line);
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

  test("a commented-out invocation is not scanned as if it ran", () => {
    // The same raw-vs-stripped inconsistency, other direction: the tool side was
    // read with comments stripped, the workflow side was not. Real instances on
    // this repo: scaffold-stage1-create-repos.yml documents three `--dry-run`
    // invocations in its header, agent-heartbeat.yml names a tool in prose.
    expect(extractInvocations("#   bun src/tools/demo.ts --owner X --batch 3\n")).toEqual([]);
  });

  test("POSITIVE CONTROL: the identical line uncommented IS scanned", () => {
    // Without this the test above would pass against a regex that matches
    // nothing at all.
    const got = extractInvocations("    bun src/tools/demo.ts --owner X --batch 3\n");
    expect(got.length).toBe(1);
    expect(got[0]?.flags).toEqual(["--owner", "--batch"]);
  });

  test("a commented-out invocation spanning continuations is not spliced", () => {
    // Order is load-bearing: joining continuations before dropping comment lines
    // would weld the second line's flags onto the first and leave `--limit`
    // looking live.
    const body = "# bun src/tools/demo.ts --owner X \\\n#   --limit 3\nsteps: []\n";
    expect(extractInvocations(body)).toEqual([]);
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

  test("END TO END: a tool guarded only in prose is skipped, not policed", () => {
    // The payoff of the whole fix. Old detector: reads the comment, enrols the
    // tool, and reports `--batch` as a guaranteed-fatal invocation — against a
    // parser that does not exist. The tool in fact ignores `--batch` entirely,
    // so the "violation" was a lint failing a workflow that works.
    const workflow =
      "jobs:\n  a:\n    steps:\n      - run: |\n          bun src/tools/demo.ts --repo-root . --batch 3\n";
    const result = auditWorkflowCliFlags(fixture(GUARD_IN_PROSE_ONLY, workflow));
    expect(result.violations).toEqual([]);
    expect(result.toolsSkippedOpenParser).toContain("src/tools/demo.ts");
    expect(result.toolsChecked).not.toContain("src/tools/demo.ts");
  });

  test("POSITIVE CONTROL: move the guard into code and the same flag IS caught", () => {
    // Same workflow, same tool, one difference — the guard is real. This is what
    // stops the test above from passing against a lint that checks nothing.
    const workflow =
      "jobs:\n  a:\n    steps:\n      - run: |\n          bun src/tools/demo.ts --repo-root . --batch 3\n";
    const result = auditWorkflowCliFlags(fixture(GUARD_IN_CODE, workflow));
    expect(result.toolsChecked).toContain("src/tools/demo.ts");
    expect(result.violations.map((v) => v.flag)).toEqual(["--batch"]);
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
