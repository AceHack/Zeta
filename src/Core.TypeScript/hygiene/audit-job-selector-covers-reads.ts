#!/usr/bin/env bun
// audit-job-selector-covers-reads.ts — does the selector that RUNS a job cover the paths the
// job READS?
//
// DRIFT TIER. Reports; never blocks. It measures a number nobody has, and turning it into a
// gate is a separate decision with a threshold nobody has calibrated.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE GAP THIS EXISTS FOR, AND WHAT IT COST
//
// `audit-build-graph-completeness.ts` already checks that every job is CLAIMED by some target.
// That is direction C, and it holds. What nothing checks is whether the claiming target's
// SOURCES cover the paths the job's own commands actually read. A job can be fully claimed and
// still be unselectable by the very changes it exists to judge.
//
// MEASURED, 2026-09-14 (081M2F88XEA087G0R00056SE0V). `gate/lint-bash-retirement-inventory` is
// claimed by exactly one target, `ts:hygiene`, whose sources are `src/Core.TypeScript/hygiene/**`.
// One of that job's steps runs `lint-orphaned-doc-comments.ts src/Core.TypeScript/corporate`.
// The job SCANS corporate; nothing that SELECTS it covers corporate. PR #17403 changed 17 files,
// all under corporate, stranded a docstring, and the lint SKIPPED. The defect landed on `main`
// and surfaced only when an unrelated PR touched `hygiene/**`.
//
// Same shape as a check that did not run looking like one that passed, one level up: the check
// exists, is claimed, and is invisible to its own subject.
//
// ─────────────────────────────────────────────────────────────────────────────
// TWO CLASSES, AND ONLY ONE OF THEM IS THE DEFECT
//
// A first pass reported 11 "gaps", most of which were a job reading the `.ts` file that
// IMPLEMENTS it — `lint-go` reads `lint/lint-go.ts`, `lint-markdown` reads `scoped-lint.ts`.
// That is a different claim (should a job re-run when its own tool changes?) and folding it in
// would bury the real finding under noise it can never act on. So reads are classified:
//
//   SUBJECT   a path the job scans as DATA. Not covered => the defect above.
//   TOOL      the implementation the job executes. Reported separately, never as a gap.
//
// The discriminator is mechanical: a path that appears immediately after `bun`/`bun run`/`node`
// is being EXECUTED; anything else on the line is an ARGUMENT, which is the subject.
//
// ─────────────────────────────────────────────────────────────────────────────
// INDIRECTION THROUGH package.json IS FOLLOWED, because that is where the real gap hid
//
// 30 gate steps invoke `bun run <script>`, and `hygiene:no-orphaned-doc-comments` expands to
// `... lint-orphaned-doc-comments.ts src/Core.TypeScript/corporate`. A reader that stops at
// `bun run` sees no paths at all and reports the tree clean — the exact false negative this
// tool is about, reproduced inside the tool. Scripts are resolved one level.
//
// ─────────────────────────────────────────────────────────────────────────────
// HONEST LIMITS, stated rather than discovered later
//
//   * LITERAL PATHS ONLY. A job that computes a path at runtime is invisible here. So the
//     output is a LOWER BOUND on the gaps, never a proof of their absence.
//   * ONE LEVEL of `bun run` indirection. A script that shells to another script is not followed.
//   * A path is counted only if it EXISTS in the tree, so a typo reads as "no path" rather than
//     as a gap — conservative in the direction that under-reports.
//
// Usage:  bun src/Core.TypeScript/hygiene/audit-job-selector-covers-reads.ts [--json FILE]

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";

const WORKFLOW = ".github/workflows/gate.yml";
const GRAPH = "src/Core.TypeScript/ace/build-graph.json";
const PKG = "package.json";

/** Repo-root directories a path token may start with. Anchored so prose like "and/or" is not a path. */
const ROOTS = [
  "src", "docs", "db", "tools", "tests", "bench", "clis", "full-ai-cluster",
  "agentic-organization", "demo", "data", "registry", "genesis", "experiments", "vocab",
] as const;

export type ReadKind = "subject" | "tool";
export interface JobRead { readonly path: string; readonly kind: ReadKind; }
export interface Finding {
  readonly job: string;
  readonly leg: string;
  readonly sources: readonly string[];
  readonly uncovered: readonly string[];
}

/** Does a build-graph source glob cover this path? Deliberately permissive: a false "covered"
 *  under-reports, which is the safe direction for a drift report that must not cry wolf.
 *
 *  A SCANNED DIRECTORY IS NOT A SCANNED FILE, and conflating them was this tool's first false
 *  positive. `lint-yaml-k8s` scans the DIRECTORY `agentic-organization/deploy` and is selected
 *  by `**\/*.yaml`; comparing the directory's own name against an extension glob says "not
 *  covered", when in fact every yaml inside it selects the job perfectly well. So when the read
 *  is a directory, the question is whether the glob matches ANY file currently under it — which
 *  is measurable, not guessed. */
export function sourceCovers(source: string, path: string, filesUnder?: (dir: string) => readonly string[]): boolean {
  if (source === "**") return true;
  const prefix = source.replace(/\*+$/u, "").replace(/\/$/u, "");
  if (source.startsWith("**/*.")) {
    const ext = source.slice(4);
    if (path.endsWith(ext)) return true;
    // A directory is covered by an extension glob when it actually holds such a file.
    return filesUnder !== undefined && filesUnder(path).some((f) => f.endsWith(ext));
  }
  if (prefix.length > 0 && path.startsWith(prefix)) return true;
  // The read is a directory ABOVE the selector's prefix (e.g. reads `src/Core.TypeScript`,
  // selected by `src/Core.TypeScript/hygiene/**`). Covered only for the subtree the selector
  // names, which is exactly the partial coverage this audit exists to surface -- so: not covered.
  return false;
}

/** Every literal repo path in a shell fragment, split into the TOOL being executed and the
 *  SUBJECT arguments handed to it. `bun x.ts a b` => tool x.ts, subjects a and b. */
export function classifyReads(script: string, exists: (p: string) => boolean): readonly JobRead[] {
  const rootAlt = ROOTS.join("|");
  const token = new RegExp("(?:^|[\\s\"'`=])((?:" + rootAlt + ")\\/[A-Za-z0-9._\\/-]+)", "gu");
  const out = new Map<string, ReadKind>();
  for (const line of script.split("\n")) {
    // The first path on a line that begins an execution is the tool; the rest are its subject.
    const execAt = /\b(?:bun|node|bunx)\s+(?:run\s+)?(\.?\/?[A-Za-z0-9._/-]+)/u.exec(line);
    const toolPath = execAt === null ? null : execAt[1]!.replace(/^\.\//u, "");
    for (const m of line.matchAll(token)) {
      const p = m[1]!.replace(/[.,;:)'"`]+$/u, "").replace(/\/$/u, "");
      if (!exists(p)) continue;
      const kind: ReadKind = toolPath !== null && p === toolPath ? "tool" : "subject";
      // A path seen as a subject anywhere wins: being scanned is the stronger claim.
      if (out.get(p) !== "subject") out.set(p, kind);
    }
  }
  return [...out].map(([path, kind]) => ({ path, kind }));
}

/** `bun run <name>` expanded one level from package.json's scripts. Without this the real gap
 *  is invisible: the path that motivated this tool lives in a script, not in the workflow. */
export function expandScripts(script: string, scripts: Readonly<Record<string, string>>): string {
  return script.replace(/\bbun run\s+([A-Za-z0-9:._-]+)/gu, (whole, name: string) => {
    const body = scripts[name];
    return body === undefined ? whole : `${whole}\n${body}`;
  });
}

/** leg id -> union of the sources of every target claiming it. */
export function legSourceIndex(targets: readonly { legs?: readonly string[]; sources?: readonly string[] }[]): ReadonlyMap<string, readonly string[]> {
  const m = new Map<string, Set<string>>();
  for (const t of targets) {
    for (const leg of t.legs ?? []) {
      const s = m.get(leg) ?? new Set<string>();
      for (const src of t.sources ?? []) s.add(src);
      m.set(leg, s);
    }
  }
  return new Map([...m].map(([k, v]) => [k, [...v].sort()]));
}

/** gate.yml writes the leg as `fromJSON(...).gate_lint_x`; the graph writes `gate/lint-x`. */
export function slugOfLeg(leg: string): string {
  return leg.replace(/[/-]/gu, "_");
}

/** Files directly under a directory, bounded and non-recursive: enough to answer "does an
 *  extension glob match anything here" without walking a large tree. Non-directories and
 *  unreadable paths answer with nothing, which reads as NOT covered -- the loud direction. */
function filesUnder(dir: string, depth = 3): readonly string[] {
  try {
    // NO `statSync(...).isDirectory()` GATE. It was there and it prevented nothing: between the
    // stat and the readdir the path can be created, deleted or replaced, so the answer was
    // already stale when it was used (CWE-367). `readdirSync` throws ENOTDIR on a non-directory
    // by itself, which is one syscall, one answer, and no window — and the catch below already
    // interprets every failure as "nothing under here". Caught by
    // `lint-check-then-use-file-races` on this very PR, which is the right joke to record: a
    // check that constrains nothing, inside a tool about checks that do not cover their subject.
    const out: string[] = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isFile()) out.push(e.name);
      else if (e.isDirectory() && depth > 0 && e.name !== "node_modules") {
        // BOUNDED. `agentic-organization/deploy` holds its manifests one level down, so a
        // non-recursive look reported it uncovered by `**/*.yaml` -- a false positive in the
        // first version. Depth 3 reaches the real layouts without walking a large tree.
        out.push(...filesUnder(`${dir}/${e.name}`, depth - 1));
      }
    }
    return out;
  } catch {
    return [];
  }
}

function main(): number {
  const wf = parse(readFileSync(WORKFLOW, "utf8")) as { jobs?: Record<string, { if?: string; steps?: { run?: string }[] }> };
  const graph = JSON.parse(readFileSync(GRAPH, "utf8")) as { targets?: readonly { legs?: readonly string[]; sources?: readonly string[] }[] };
  const pkg = JSON.parse(readFileSync(PKG, "utf8")) as { scripts?: Record<string, string> };
  const scripts = pkg.scripts ?? {};

  const bySlug = new Map<string, { leg: string; sources: readonly string[] }>();
  for (const [leg, sources] of legSourceIndex(graph.targets ?? [])) bySlug.set(slugOfLeg(leg), { leg, sources });

  const findings: Finding[] = [];
  let jobsWithLeg = 0;
  let toolOnly = 0;

  for (const [job, def] of Object.entries(wf.jobs ?? {})) {
    const m = /fromJSON\(needs\.path-filter\.outputs\.legs\)\.([A-Za-z0-9_]+)/u.exec(String(def.if ?? ""));
    if (m === null) continue;
    const entry = bySlug.get(m[1]!);
    if (entry === undefined) continue;
    jobsWithLeg++;

    const raw = (def.steps ?? []).map((s) => String(s.run ?? "")).join("\n");
    const reads = classifyReads(expandScripts(raw, scripts), existsSync);
    const subjects = reads.filter((r) => r.kind === "subject").map((r) => r.path);
    if (subjects.length === 0) { toolOnly++; continue; }

    const uncovered = subjects.filter((p) => !entry.sources.some((s) => sourceCovers(s, p, filesUnder)));
    if (uncovered.length > 0) findings.push({ job, leg: entry.leg, sources: entry.sources, uncovered });
  }

  console.log(`[selector-covers-reads] jobs with a leg: ${String(jobsWithLeg)} | of those, tool-only reads: ${String(toolOnly)}`);
  for (const f of findings) {
    console.log(`\n  GAP  ${f.job}  (${f.leg})`);
    console.log(`       selected by: ${f.sources.slice(0, 4).join(", ")}${f.sources.length > 4 ? ` (+${String(f.sources.length - 4)})` : ""}`);
    for (const p of f.uncovered) console.log(`       SCANS but is not selected by: ${p}`);
  }

  if (findings.length === 0) {
    console.log("\n[selector-covers-reads] every job's selector covers the literal paths it scans.");
    console.log("  LOWER BOUND, not a proof: runtime-computed paths are invisible here.");
  } else {
    console.log(
      `\n[selector-covers-reads] ${String(findings.length)} job(s) scan a path their selector does not cover.\n` +
        "  Each is a change that can land WITHOUT the check that exists to judge it — the shape that\n" +
        "  put a stranded docstring on main via #17403. Drift tier: nothing is blocked.",
    );
  }
  const jsonAt = process.argv.indexOf("--json");
  if (jsonAt >= 0 && process.argv[jsonAt + 1] !== undefined) {
    // eslint-disable-next-line n/no-sync
    require("node:fs").writeFileSync(process.argv[jsonAt + 1]!, `${JSON.stringify({ findings }, null, 2)}\n`);
  }
  return 0; // DRIFT TIER
}

if (import.meta.main) process.exit(main());
