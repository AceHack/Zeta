#!/usr/bin/env bun
// audit-lean-ci-coverage.ts — which Lean files carry a `sorry` that NO CI step audits?
//
// The hole this closes
// --------------------
// `.github/workflows/lean-proof.yml` type-checks a HAND-MAINTAINED list of files
// and axiom-audits a second hand-maintained list. Both lists are correct for the
// files on them. The defect is structural: a file that is on NEITHER list is
// invisible — not type-checked, not audited, and not gated — and nothing in the
// repo notices that it is missing.
//
// Live instance (2026-08-10): `ImaginaryStack/PhaseClockErasure.lean` was absent
// from both lists, and `lakefile.toml`'s `defaultTargets = ["Lean4"]` means the
// bare `lake build` step does not reach `ImaginaryStack` either. It carried a
// `sorry` on a theorem that a separate computation later showed to be FALSE. The
// `sorryAx` audit already in that workflow would have flagged it on day one. It
// was never evaded — the file was simply never added to the list.
//
// So this is not a new gate. It is coverage telemetry for a gate we already own:
// it answers "what is the audit NOT looking at", which no existing check asks.
//
// Deliberately cheap: pure text analysis of the workflow plus a file walk. No
// Lean toolchain, no Mathlib cache, no `lake`. Runs in seconds, so it can live in
// the fast lane rather than behind the 30-minute Lean job.
//
// TELEMETRY, NOT A GATE — per `docs/DECISIONS/2026-07-09-drift-and-heal-…`. It
// reports a coverage gap; closing the gap may legitimately turn a proof job red,
// and THAT is a decision for a human, not a side effect of a hygiene script.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-lean-ci-coverage.ts
//   bun src/Core.TypeScript/hygiene/audit-lean-ci-coverage.ts --json
//
// Exit codes:
//   0   every `sorry`-carrying Lean file is axiom-audited
//   1   at least one `sorry`-carrying file is unaudited
//   2   configuration error (workflow or Lean root missing)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { stripLeanComments } from "./audit-proof-closure-claims";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

const WORKFLOW = ".github/workflows/lean-proof.yml";
const LEAN_ROOT = "src/Core.Lean4";
/** `.lake` holds Mathlib and every other fetched package — not our proofs. */
const SKIP_DIRS = new Set([".lake", "node_modules", ".git", "build"]);

/** `lake env lean ImaginaryStack/ToyModel.lean` → the type-checked set. */
const TYPECHECK_RE = /lake\s+env\s+lean\s+([A-Za-z0-9_./-]+\.lean)/g;
/**
 * The axiom-audit steps pipe `#print axioms …` onto a file:
 *   `| cat ImaginaryStack/ToyModel.lean - > /tmp/…`
 * The `cat <file> -` shape is what marks a file as axiom-audited. Matching the
 * `/tmp/` target instead would be wrong — several audits share a naming scheme
 * but not a source file.
 */
const AXIOM_AUDIT_RE = /cat\s+([A-Za-z0-9_./-]+\.lean)\s+-/g;

export interface CoverageRow {
  file: string;
  sorryLines: number[];
  typeChecked: boolean;
  axiomAudited: boolean;
}

export interface CoverageResult {
  leanFiles: number;
  withSorry: number;
  /** `sorry`-carrying and NOT axiom-audited — the actionable set. */
  unaudited: CoverageRow[];
  /** Carries `sorry`, IS audited — expected, listed for the denominator. */
  audited: CoverageRow[];
  /** No `sorry`, and never type-checked — weaker signal, reported separately. */
  untypecheckedClean: string[];
}

/** Collect every path captured by `re` from the workflow text. */
export function extractPaths(workflow: string, re: RegExp): Set<string> {
  const out = new Set<string>();
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(workflow)) !== null) {
    const p = m[1];
    if (p && !p.startsWith("/tmp/")) out.add(p);
  }
  return out;
}

/** Real `sorry` / `admit` tokens in CODE — comments stripped, constructors skipped. */
export function sorryLines(src: string): number[] {
  const lines = stripLeanComments(src).split("\n");
  const hits: number[] = [];
  for (let n = 0; n < lines.length; n++) {
    const text = lines[n] ?? "";
    if (/^\s*\|\s*[A-Za-z_]/.test(text)) continue; // inductive constructor
    if (/(?<![A-Za-z0-9_'.])(?:sorry|admit)(?![A-Za-z0-9_'])/.test(text)) hits.push(n + 1);
  }
  return hits;
}

function walkLean(dir: string, acc: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkLean(full, acc);
    else if (entry.endsWith(".lean")) acc.push(full);
  }
}

export function runAudit(): CoverageResult {
  const root = repoRoot();
  const workflow = readFileSync(resolve(root, WORKFLOW), "utf8");
  const typeChecked = extractPaths(workflow, TYPECHECK_RE);
  const axiomAudited = extractPaths(workflow, AXIOM_AUDIT_RE);

  const files: string[] = [];
  walkLean(resolve(root, LEAN_ROOT), files);
  files.sort();

  const unaudited: CoverageRow[] = [];
  const audited: CoverageRow[] = [];
  const untypecheckedClean: string[] = [];
  let withSorry = 0;

  for (const abs of files) {
    const rel = relative(root, abs);
    // Workflow paths are relative to `src/Core.Lean4` (its working-directory).
    const asWorkflowPath = relative(resolve(root, LEAN_ROOT), abs);
    const isTypeChecked = typeChecked.has(asWorkflowPath);
    const isAudited = axiomAudited.has(asWorkflowPath);

    let src: string;
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const hits = sorryLines(src);
    if (hits.length === 0) {
      if (!isTypeChecked) untypecheckedClean.push(rel);
      continue;
    }
    withSorry++;
    const row: CoverageRow = {
      file: rel,
      sorryLines: hits,
      typeChecked: isTypeChecked,
      axiomAudited: isAudited,
    };
    (isAudited ? audited : unaudited).push(row);
  }

  return { leanFiles: files.length, withSorry, unaudited, audited, untypecheckedClean };
}

function renderHuman(r: CoverageResult): string {
  const lines: string[] = [];
  const head = `lean-ci-coverage: ${r.leanFiles} Lean file(s), ${r.withSorry} carrying a real \`sorry\`/\`admit\`; ${r.audited.length} axiom-audited, ${r.unaudited.length} NOT.`;
  if (r.unaudited.length === 0) {
    lines.push(`OK — ${head}`);
  } else {
    lines.push(`GAP — ${head}`, "");
    lines.push("These files carry an incompleteness marker that NO axiom audit examines.");
    lines.push("`lake env lean` only WARNS on `sorry` (exit 0), so nothing else can see them.");
    lines.push("");
    for (const row of r.unaudited) {
      const tc = row.typeChecked ? "type-checked" : "NOT type-checked";
      lines.push(`  ${row.file}  (${tc}, not axiom-audited)`);
      lines.push(`    sorry/admit at line(s): ${row.sorryLines.join(", ")}`);
    }
    lines.push("");
    lines.push(
      "Closing a gap may legitimately turn the Lean job red — that is a human call,",
      "not something this script should do as a side effect.",
    );
  }
  if (r.untypecheckedClean.length > 0) {
    lines.push("", `Also: ${r.untypecheckedClean.length} sorry-free file(s) are not type-checked.`);
  }
  return lines.join("\n");
}

export function main(argv: string[]): number {
  const root = repoRoot();
  for (const p of [WORKFLOW, LEAN_ROOT]) {
    try {
      statSync(resolve(root, p));
    } catch {
      process.stderr.write(`error: missing ${p} under ROOT=${root}\n`);
      return 2;
    }
  }
  const r = runAudit();
  process.stdout.write(
    (argv.includes("--json") ? JSON.stringify(r, null, 2) : renderHuman(r)) + "\n",
  );
  return r.unaudited.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
