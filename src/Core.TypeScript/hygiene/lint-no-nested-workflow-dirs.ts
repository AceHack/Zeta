#!/usr/bin/env bun
// lint-no-nested-workflow-dirs.ts — a workflow file GitHub will never read is not a check.
//
// The rule this enforces
// ----------------------
// GitHub Actions discovers workflows in exactly ONE place: the `.github/workflows/`
// directory at the repository ROOT. A `.yml` under any OTHER `.github/workflows/` path is
// never parsed, never scheduled, and never runs — while looking, to every reader and to
// every `grep`, exactly like a workflow that does.
//
// So this refuses any `.github/workflows/` directory that is not the root one.
//
// The vacuity this closes
// -----------------------
// This is the purest form of the class this repo keeps rediscovering: a check that did not
// run reading as a check that passed. It is worse than a missing check, because a missing
// check is visibly missing. A nested workflow answers "is this tested in CI?" with a file
// you can open and read, whose steps are correct, whose action pins are valid, and which
// has never executed once.
//
// Live instance (found 2026-08-25). `agentic-organization/.github/workflows/ci.yml` ran
// `npm run typecheck` and `npm test` over a 1,595-test suite. Nothing in the root
// `.github/workflows/` invoked that suite — `gate.yml` names `agentic-organization` three
// times and all three are yamllint/find over `agentic-organization/deploy`, the k8s
// manifests, never the code. The suite had constrained nothing since the directory landed.
// Its sibling `integration.yml` was in the same state. Both are now root workflows
// (`agentic-organization-tests.yml`, `agentic-organization-integration.yml`).
//
// THE ONE EXEMPTION: A TEMPLATE THAT WILL BE SOMEONE ELSE'S ROOT
// ---------------------------------------------------------------
// `src/Core.TypeScript/scaffold/<repo>/` is a tree of day-one governance files that
// `create-repo.ts` PUSHES INTO A NEW REPOSITORY. Inside that repository the file lands at
// `.github/workflows/scorecard.yml` -- the root -- and runs. It is nested only in transit.
// Flagging it would be the audit misreading a template as a promise.
//
// The exemption is DERIVED, never hand-listed, so it cannot drift from what is true:
// a nested workflow dir is exempt only when its path is exactly
// `<D>/<child>/.github/workflows` for some directory `D` that CONTAINS `create-repo.ts`.
// Delete or move that tool and the exemption evaporates on the next run rather than
// outliving its reason. An allowlist of directory names would have kept passing.
//
// What is NOT flagged, and why the scope is this narrow
// -----------------------------------------------------
// Only a directory literally named `workflows` under a directory literally named `.github`
// is refused, and only when it is not the root one. `.github/actions/` (composite actions),
// `.github/ISSUE_TEMPLATE/`, and vendored fixtures under `references/` or `node_modules/`
// are untouched: none of them claims to be a scheduled check. A nested `.github` directory
// on its own is legitimate — CODEOWNERS and templates nest fine. It is `workflows`
// specifically that makes a promise the platform will not keep.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/lint-no-nested-workflow-dirs.ts
//   bun src/Core.TypeScript/hygiene/lint-no-nested-workflow-dirs.ts --json
//
// Exit codes:
//   0   the only .github/workflows/ is the root one
//   1   at least one nested workflow directory exists
//   2   configuration error (root .github/workflows missing)

import { type Dirent, readdirSync, readFileSync, statSync } from "node:fs";

/**
 * List a directory WITH the kind of each entry.
 *
 * `{ withFileTypes: true }` is not a style preference here: `readdirSync` followed by
 * `statSync` is a check-then-use race (the listing already knew the kind, and the entry
 * can change between the two calls), and `lint-check-then-use-file-races.ts` refuses it
 * repo-wide. It caught the first draft of this very file, which is the kind of thing that
 * makes a lint worth having.
 */
function listKinds(abs: string): readonly Dirent[] {
  try {
    return readdirSync(abs, { withFileTypes: true });
  } catch {
    return []; // unreadable directory: not a finding, and not a reason to fail the lint
  }
}
import { join, relative, resolve } from "node:path";

export const DRIFT_CLASS = "AH004";

/** Directories never worth descending: vendored mirrors, caches, and the git object store. */
const PRUNE: ReadonlySet<string> = new Set([
  ".git",
  "node_modules",
  "references",
  "bin",
  "obj",
  "target",
  ".venv",
  "dist",
]);

export interface Finding {
  readonly dir: string;
  readonly files: readonly string[];
}

export interface LintResult {
  readonly dirsScanned: number;
  readonly findings: readonly Finding[];
  /** Nested dirs that ARE templates, named so the exemption is visible, not silent. */
  readonly exempt: readonly Finding[];
}

/** The tool whose presence defines a directory as a scaffold ROOT. */
export const SCAFFOLD_TOOL = "create-repo.ts";

/**
 * Directories that hold `create-repo.ts`, i.e. roots whose children are pushed elsewhere.
 *
 * Derived by walking, not configured. See "THE ONE EXEMPTION" in the header: the whole
 * point is that removing the tool removes the exemption.
 */
export function scaffoldRoots(root: string): readonly string[] {
  const found: string[] = [];
  const walk = (abs: string): void => {
    const entries = listKinds(abs);
    if (entries.some((e) => e.name === SCAFFOLD_TOOL && e.isFile())) found.push(resolve(abs));
    for (const e of entries) {
      if (!e.isDirectory() || PRUNE.has(e.name) || e.name === ".github") continue;
      walk(join(abs, e.name));
    }
  };
  walk(root);
  return found;
}

/** Is `wfDir` exactly `<scaffoldRoot>/<child>/.github/workflows` for some known root? */
export function isScaffoldTemplate(wfDirAbs: string, roots: readonly string[]): boolean {
  const repoDir = resolve(wfDirAbs, "..", "..");
  const parent = resolve(repoDir, "..");
  return roots.includes(parent);
}

/**
 * Walk for `<something>/.github/workflows` directories, skipping the root one.
 *
 * Exported so a test can drive it against a fixture tree rather than the live repo — a
 * lint whose only subject is the repo it lives in cannot be shown to fail.
 */
export function findNestedWorkflowDirs(root: string): LintResult {
  const rootWorkflows = resolve(root, ".github", "workflows");
  const roots = scaffoldRoots(root);
  const findings: Finding[] = [];
  const exempt: Finding[] = [];
  let dirsScanned = 0;

  const walk = (abs: string): void => {
    dirsScanned++;
    for (const e of listKinds(abs)) {
      // A broken symlink reports neither file nor directory here and is simply skipped;
      // audit-dangling-symlinks.ts owns that class.
      if (!e.isDirectory() || PRUNE.has(e.name)) continue;
      const child = join(abs, e.name);
      if (e.name !== ".github") {
        walk(child);
        continue;
      }
      // Never descend into a .github tree: nothing below it can nest again.
      const wf = listKinds(child).find((c) => c.name === "workflows" && c.isDirectory());
      if (wf === undefined) continue;
      const wfPath = join(child, "workflows");
      if (resolve(wfPath) === rootWorkflows) continue;
      const files = listKinds(wfPath)
        .filter((c) => c.isFile() && (c.name.endsWith(".yml") || c.name.endsWith(".yaml")))
        .map((c) => c.name)
        .sort();
      const entry = { dir: relative(root, wfPath), files };
      (isScaffoldTemplate(resolve(wfPath), roots) ? exempt : findings).push(entry);
    }
  };

  walk(root);
  const byDir = (a: Finding, b: Finding): number => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0);
  findings.sort(byDir);
  exempt.sort(byDir);
  return { dirsScanned, findings, exempt };
}

/** `name:` of a workflow, for the report. Absent is fine — the path is the finding. */
export function workflowName(source: string): string | null {
  const m = /^name:\s*(.+?)\s*$/m.exec(source);
  return m === null ? null : (m[1] ?? null);
}

export function renderHuman(root: string, r: LintResult): string {
  const exemptNote =
    r.exempt.length === 0
      ? ""
      : `\n  exempt (scaffold templates pushed to another repo, where they become the root):\n` +
        r.exempt.map((e) => `    ${e.dir}/  [${e.files.join(", ")}]`).join("\n");
  if (r.findings.length === 0) {
    return (
      `no-nested-workflow-dirs: OK — ${r.dirsScanned} director(ies) scanned; ` +
      `the only .github/workflows/ that GitHub reads is the root one.` +
      exemptNote
    );
  }
  const total = r.findings.reduce((n, f) => n + f.files.length, 0);
  const lines = [
    `no-nested-workflow-dirs: NEVER RUNS — ${r.findings.length} nested workflow director(ies) holding ${total} file(s).`,
    "",
    "GitHub Actions reads workflows ONLY from the repository root .github/workflows/.",
    "Every file below has valid syntax, pinned actions, and has never executed once — it",
    "answers 'is this covered by CI?' with a file that constrains nothing.",
    "",
    "Fix: move it to .github/workflows/ (renaming so the name stays unique), give it a",
    "path filter scoped to its subtree, and delete the nested copy in the same commit.",
    "",
  ];
  for (const f of r.findings) {
    lines.push(`  ${f.dir}/`);
    for (const file of f.files) {
      let nm: string | null = null;
      try {
        nm = workflowName(readFileSync(resolve(root, f.dir, file), "utf8"));
      } catch {
        nm = null;
      }
      lines.push(`    ${file}${nm === null ? "" : `  (name: ${nm})`}`);
    }
  }
  if (exemptNote.length > 0) lines.push(exemptNote);
  return lines.join("\n");
}

export function main(argv: readonly string[]): number {
  const root = resolve(process.env["REPO_ROOT"] ?? process.cwd());
  try {
    if (!statSync(resolve(root, ".github", "workflows")).isDirectory()) throw new Error("not a dir");
  } catch {
    process.stderr.write(`error: .github/workflows not found under ROOT=${root}\n`);
    return 2;
  }
  const r = findNestedWorkflowDirs(root);
  process.stdout.write((argv.includes("--json") ? JSON.stringify(r, null, 2) : renderHuman(root, r)) + "\n");
  return r.findings.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
