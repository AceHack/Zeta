// lint-no-nested-workflow-dirs.test.ts — falsifiers for the never-runs workflow lint.
//
// Driven against fixture TREES, not against the repo it lives in. A lint whose only
// subject is its own repository cannot be shown to fail once that repository is clean —
// which is the vacuity class this whole file exists to refuse.

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  findNestedWorkflowDirs,
  isScaffoldTemplate,
  renderHuman,
  SCAFFOLD_TOOL,
  scaffoldRoots,
  workflowName,
} from "./lint-no-nested-workflow-dirs.ts";

/** A tree with a root `.github/workflows` and whatever else the test asks for. */
function tree(build: (root: string) => void): string {
  const root = mkdtempSync(join(tmpdir(), "nwd-"));
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
  writeFileSync(join(root, ".github", "workflows", "gate.yml"), "name: gate\n");
  build(root);
  return root;
}

function put(root: string, rel: string, body: string): void {
  const abs = join(root, rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, body);
}

describe("the measured specimen", () => {
  test("a nested .github/workflows is a finding, named with its files", () => {
    // agentic-organization/.github/workflows/{ci,integration}.yml, 2026-08-25: a
    // 1,595-test suite whose only invoker was a workflow GitHub never reads.
    const root = tree((r) => {
      put(r, "agentic-organization/.github/workflows/ci.yml", "name: ci\n");
      put(r, "agentic-organization/.github/workflows/integration.yml", "name: integration\n");
    });
    const res = findNestedWorkflowDirs(root);
    expect(res.findings).toHaveLength(1);
    expect(res.findings[0]?.dir).toBe("agentic-organization/.github/workflows");
    expect(res.findings[0]?.files).toEqual(["ci.yml", "integration.yml"]);
    expect(renderHuman(root, res)).toContain("NEVER RUNS");
  });

  test("the ROOT .github/workflows is never a finding", () => {
    const root = tree(() => {});
    expect(findNestedWorkflowDirs(root).findings).toEqual([]);
    expect(renderHuman(root, findNestedWorkflowDirs(root))).toContain("OK");
  });

  test("a nested .github WITHOUT workflows is fine — templates and CODEOWNERS nest legally", () => {
    const root = tree((r) => {
      put(r, "sub/.github/CODEOWNERS", "* @someone\n");
      put(r, "sub/.github/ISSUE_TEMPLATE/bug.md", "---\nname: bug\n---\n");
    });
    expect(findNestedWorkflowDirs(root).findings).toEqual([]);
  });
});

describe("the exemption is DERIVED, so it can expire", () => {
  const scaffolded = (withTool: boolean): string =>
    tree((r) => {
      if (withTool) put(r, "src/scaffold/create-repo.ts", "// pushes each child dir into a new repo\n");
      put(r, "src/scaffold/ace/.github/workflows/scorecard.yml", "name: scorecard\n");
      put(r, "src/scaffold/forge/.github/workflows/scorecard.yml", "name: scorecard\n");
    });

  test("a template beside create-repo.ts is exempt — and SAID SO, not silently dropped", () => {
    const root = scaffolded(true);
    const res = findNestedWorkflowDirs(root);
    expect(res.findings).toEqual([]);
    expect(res.exempt.map((e) => e.dir).sort()).toEqual([
      "src/scaffold/ace/.github/workflows",
      "src/scaffold/forge/.github/workflows",
    ]);
    // An exemption nobody can see is an allowlist. It is printed on the OK path too.
    expect(renderHuman(root, res)).toContain("src/scaffold/ace/.github/workflows");
  });

  test("DELETE create-repo.ts and the exemption evaporates — the whole point of deriving it", () => {
    const root = scaffolded(false);
    const res = findNestedWorkflowDirs(root);
    expect(res.exempt).toEqual([]);
    expect(res.findings.map((e) => e.dir).sort()).toEqual([
      "src/scaffold/ace/.github/workflows",
      "src/scaffold/forge/.github/workflows",
    ]);
  });

  test("the exemption is depth-exact: a GRANDCHILD of the scaffold root is not a template", () => {
    // create-repo.ts pushes `<root>/<repo>/**`. Anything one level deeper is not what it
    // ships, so it must not inherit the exemption by being underneath it.
    const root = tree((r) => {
      put(r, "src/scaffold/create-repo.ts", "//\n");
      put(r, "src/scaffold/ace/nested/.github/workflows/x.yml", "name: x\n");
    });
    const res = findNestedWorkflowDirs(root);
    expect(res.exempt).toEqual([]);
    expect(res.findings.map((e) => e.dir)).toEqual(["src/scaffold/ace/nested/.github/workflows"]);
  });

  test("scaffoldRoots finds a root by the TOOL, not by a directory name", () => {
    const root = tree((r) => {
      put(r, "anywhere/at/all/" + SCAFFOLD_TOOL, "//\n");
    });
    const roots = scaffoldRoots(root);
    expect(roots).toHaveLength(1);
    expect(roots[0]?.endsWith(join("anywhere", "at", "all"))).toBe(true);
    expect(isScaffoldTemplate(join(roots[0] ?? "", "repo", ".github", "workflows"), roots)).toBe(true);
    expect(isScaffoldTemplate(join(root, "other", ".github", "workflows"), roots)).toBe(false);
  });
});

describe("reporting", () => {
  test("the workflow's own name: is surfaced when present, and absence is not an error", () => {
    expect(workflowName("name: integration\non:\n")).toBe("integration");
    expect(workflowName("on:\n  push:\n")).toBeNull();
  });

  test("node_modules and references are pruned — a vendored mirror is not our CI claim", () => {
    const root = tree((r) => {
      put(r, "node_modules/pkg/.github/workflows/ci.yml", "name: vendored\n");
      put(r, "references/prior-art/other-repo/.github/workflows/ci.yml", "name: theirs\n");
    });
    expect(findNestedWorkflowDirs(root).findings).toEqual([]);
  });
});
