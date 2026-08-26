#!/usr/bin/env bun
// floor-live-remote-queries.ts — refuse a LIVE POPULATION QUERY inside the blocking floor.
//
// THE MEASURED DEFECT. PR #15308 added new files and touched nothing else. It went red in
// `cross-verify` because FOUR ARCHIVE RECORDS WERE STRANDED REPO-WIDE — a condition it
// neither caused nor could fix. It re-ran green with zero code change, because flush PRs
// landed in the interval. Two agents independently reported it, and both first read it as
// "the vectorisation broke the four-language oracles", because `cross-verify`'s headline
// step is the byte-lock. So: repo state a PR cannot touch, blocking that PR, wearing the
// costume of a correctness failure.
//
// A CHECK THAT CLEARS ITSELF ON RE-RUN IS ALREADY BEING ABSORBED AS FLAKE, and that is the
// sharpest reason this is not merely untidy. The only remedy available to the author was
// "press re-run until it passes" — which is the exact reflex that lets a genuine red be
// clicked away. The blocking placement was not buying enforcement; it was buying a
// re-run habit.
//
// THE PROPERTY, STATED SO IT IS CHECKABLE
// ---------------------------------------
// A pre-merge gate's verdict must be a function of the CANDIDATE (its diff, its tree, its
// commits) — never of the live population of everybody else's in-flight work. This is not a
// new policy: `registry/uncompensatable-floor.yaml` already says the floor "never blocks on
// pre-existing whole-repo drift (Vera review, #9601 P1)", and `gate.yml` already states the
// rule for a neighbouring case in its own words — the ArgoCD chart check is offline against
// a committed snapshot, "which is the only reason a resolvability check survives past its
// first outage."
//
// WHAT IS DETECTED, AND WHY IT IS ENUMERATION RATHER THAN "THE NETWORK"
// --------------------------------------------------------------------
// "No network in the floor" is too broad to be true here and would have to be exempted into
// meaninglessness: `gate-required` itself calls `gh api --paginate` to read THIS RUN'S OWN
// job list, which is a fact about the candidate and cannot be moved by anyone else's work.
//
// The discriminator that actually separates the good case from the bad one is ENUMERATION.
// A point lookup names an object; a population query asks "what is out there right now",
// and only a population query can make a candidate's verdict depend on other people's
// unlanded work. So the roster below is deliberately short and every entry is a
// *whole-population* read of a live remote.
//
// WHY ONE HOP WAS NOT ENOUGH — MEASURED, NOT ARGUED
// --------------------------------------------------
// This file shipped with the limit "ONE HOP: `bun x.ts` is resolved and x.ts is read; a
// query inside a module x.ts imports is NOT followed." That limit was honest and it was
// also a fuse. On 2026-08-26 `cross-verify` was restructured from 31 inline steps into a
// 31-leg matrix whose every leg runs `bun src/Core.TypeScript/ci/cross-verify-roster.ts
// --run <id>`; the roster then invokes each audit's own `bun …` command. That inserted a
// SECOND hop between `gate.yml` and `audit-orphaned-archive-refs.ts`, and the guard went
// from rc=1 to rc=0 — measured at both trees, with the tool's `git ls-remote` still sitting
// untouched at `audit-orphaned-archive-refs.ts:251`. Only the detector moved.
//
// That is the vacuity class arriving by STRUCTURAL CHANGE rather than by authoring: nobody
// edited this file, nobody edited the audit, and a floor check silently stopped checking.
// A refactor two files away must not be able to switch a falsifier off, so resolution now
// walks the graph transitively, bounded and cycle-guarded, and the bound is stated below
// as plainly as the old one-hop limit stated its own.
//
// HONEST LIMITS, stated because they bound the claim (same shape as derive-job-closure.ts):
//   * BOUNDED DEPTH, NOT UNBOUNDED. Resolution follows two edge kinds transitively from a
//     `run:` block — `bun <path>.ts` invocations (wherever they appear, including inside a
//     string in an already-visited file, which is exactly how the roster names its audits)
//     and RELATIVE local imports/re-exports (`./x`, `../y/z.ts`). It stops at
//     `MAX_RESOLUTION_HOPS` (see below) and never revisits a file, so a cycle terminates.
//     Bare specifiers (`node:fs`, npm packages) are not followed at all. This is a floor
//     with a stated reach, not a proof of absence.
//   * SHELL INDIRECTION IS STILL OPAQUE. A tool invoked as `bash foo.sh`, through `xargs`,
//     through a Makefile, or by a `run:` that sources a script is not followed. Neither is
//     a dynamic `import()` with a computed specifier, nor a path built at runtime.
//   * LITERALS ONLY. `spawnSync(bin, args)` with a computed command is unresolvable by
//     reading. Nothing here pretends otherwise.
//   * A ROSTER, NOT A DERIVATION. Population-query forms are enumerated by hand. It is
//     small, checkable, and its entries carry their reason — and it fails LOUD rather than
//     silently: a new form nobody added is simply not caught, which is a gap, not a
//     false clean bill of health for something it did examine.
//
// Usage:  bun src/Core.TypeScript/ci/floor-live-remote-queries.ts [--root <dir>] [--json]
// Exit 0 = the blocking floor's verdict cannot be moved by repo-wide state it can see.
// Exit 1 = it can, and the finding names the job, the tool, and the query.
// Exit 2 = the check could not run (unreadable workflow, missing root job).

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

export const GATE_WORKFLOW = ".github/workflows/gate.yml";

/** The roll-up the `CI Gate` ruleset requires. Its `needs:` closure IS the blocking floor. */
export const FLOOR_ROOT_JOB = "gate-required";

export interface WorkflowJob {
  readonly id: string;
  readonly needs: readonly string[];
  /** Shell text of every `run:` step, in order. */
  readonly runs: readonly string[];
}

/**
 * A form that enumerates a live remote population.
 *
 * `why` is not decoration — it is what a reviewer needs in order to REFUSE a future
 * addition, and what stops the roster growing into "things we happen to dislike".
 */
export interface PopulationQuery {
  readonly id: string;
  readonly why: string;
  readonly patterns: readonly RegExp[];
}

export const POPULATION_QUERIES: readonly PopulationQuery[] = [
  {
    id: "git ls-remote",
    why: "enumerates the remote's entire ref namespace — the answer is every branch every lane has pushed, so it changes under a candidate that touched none of them",
    patterns: [/\bls-remote\b/u],
  },
  {
    id: "gh pr list",
    why: "enumerates open pull requests — the answer is everybody else's in-flight work",
    patterns: [/\bgh\s+pr\s+list\b/u, /"pr",\s*"list"/u, /'pr',\s*'list'/u],
  },
  {
    id: "gh run list",
    why: "enumerates workflow runs across the repository — a population that moves every few seconds",
    patterns: [/\bgh\s+run\s+list\b/u, /"run",\s*"list"/u, /'run',\s*'list'/u],
  },
];

export interface Finding {
  readonly job: string;
  /** The tool the job invokes, or the workflow path when the query is inline in `run:`. */
  readonly site: string;
  readonly query: string;
  readonly why: string;
  readonly evidence: string;
  /**
   * The resolution chain from the `run:` block to `site`, exclusive of `site` itself.
   *
   * Empty for a query inline in the workflow or in a tool the `run:` names directly. When a
   * refactor puts a dispatcher in between, this is what says so in the red — the failure
   * that motivated the transitive walk read, before it, as no failure at all.
   */
  readonly via: readonly string[];
}

/**
 * How many resolution edges the scan will follow from a `run:` block.
 *
 * Hop 1 is the tool the shell names; each `bun <path>.ts` invocation or relative import
 * found inside a visited file costs one more. Four is not a magic number — it is the
 * measured depth of the deepest real chain here (`run:` → `cross-verify-roster.ts` →
 * an audit → that audit's helpers) plus one, and it is a BOUND, so a chain longer than
 * this is not examined and the check says so rather than implying it looked.
 */
export const MAX_RESOLUTION_HOPS = 4;

/**
 * Strip comment lines so PROSE ABOUT a query is not mistaken for the query.
 *
 * This matters more than it looks: the audit that motivated this file discusses `gh pr list`
 * at length in its own header, and half a dozen unrelated floor tools mention `gh api` in
 * comments. A scanner that counted those would be crying wolf on documentation, and a
 * check people learn to ignore is worth less than no check.
 *
 * Line-oriented and deliberately simple — it drops `//`, `#`, block-comment continuation
 * lines, and `/* ... *\/` spans. It does NOT try to understand string literals, so a query
 * form quoted inside a string still counts. That direction is the safe one.
 */
export function stripComments(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//gu, "");
  return withoutBlocks
    .split("\n")
    .filter((line) => !/^\s*(?:\/\/|\*|#)/u.test(line))
    .join("\n");
}

/**
 * Jobs of a GitHub Actions workflow: id, `needs:`, and the shell of every `run:` step.
 *
 * Hand-parsed rather than YAML-library-parsed for the same reason `derive-job-closure.ts`
 * is: `.claude/rules/clone-at-tag-stays-sufficient.md` wants this readable from a bare
 * checkout with no package manager present.
 */
export function parseWorkflowJobs(yamlText: string): readonly WorkflowJob[] {
  const jobs: { id: string; needs: string[]; runs: string[] }[] = [];
  let inJobs = false;
  let cur: { id: string; needs: string[]; runs: string[] } | null = null;
  let runBody: string[] | null = null;
  let runIndent = 0;
  let inNeedsBlock = false;

  for (const line of yamlText.split("\n")) {
    if (/^jobs:\s*$/u.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (/^[A-Za-z]/u.test(line)) break; // left the jobs: block entirely

    if (runBody !== null) {
      const indent = line.search(/\S/u);
      if (line.trim().length === 0 || indent >= runIndent) {
        runBody.push(line);
        continue;
      }
      cur?.runs.push(runBody.join("\n"));
      runBody = null;
    }

    const jobStart = /^ {2}([A-Za-z0-9_-]+):\s*$/u.exec(line);
    if (jobStart?.[1] !== undefined) {
      if (cur) jobs.push(cur);
      cur = { id: jobStart[1], needs: [], runs: [] };
      inNeedsBlock = false;
      continue;
    }
    if (!cur) continue;

    if (/^ {4}needs:\s*$/u.test(line)) {
      inNeedsBlock = true;
      continue;
    }
    const needsInline = /^ {4}needs:\s*\[(.+)\]\s*$/u.exec(line);
    if (needsInline?.[1] !== undefined) {
      cur.needs.push(...needsInline[1].split(",").map((s) => s.trim()).filter((s) => s.length > 0));
      continue;
    }
    const needsScalar = /^ {4}needs:\s*([A-Za-z0-9_-]+)\s*$/u.exec(line);
    if (needsScalar?.[1] !== undefined) {
      cur.needs.push(needsScalar[1]);
      continue;
    }
    if (inNeedsBlock) {
      const item = /^ {6}-\s*([A-Za-z0-9_-]+)\s*$/u.exec(line);
      if (item?.[1] !== undefined) {
        cur.needs.push(item[1]);
        continue;
      }
      if (line.trim().length > 0 && !/^ {6}/u.test(line)) inNeedsBlock = false;
    }

    const runBlock = /^(\s+)(?:-\s+)?run:\s*[|>][-+]?\s*$/u.exec(line);
    if (runBlock?.[1] !== undefined) {
      runBody = [];
      runIndent = runBlock[1].length + 1;
      continue;
    }
    const runInline = /^\s+(?:-\s+)?run:\s*(\S.*)$/u.exec(line);
    if (runInline?.[1] !== undefined) cur.runs.push(runInline[1]);
  }
  if (runBody !== null && cur !== null) cur.runs.push(runBody.join("\n"));
  if (cur) jobs.push(cur);
  return jobs;
}

/**
 * Every job the roll-up transitively depends on — i.e. every job that can block a merge.
 *
 * Derived from the workflow's own `needs:` graph rather than from a list kept beside it, so
 * a job added to the floor is in scope the moment it is added, not when someone remembers.
 */
export function floorClosure(jobs: readonly WorkflowJob[], rootId: string): ReadonlySet<string> {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    for (const need of byId.get(id)?.needs ?? []) stack.push(need);
  }
  return seen;
}

/**
 * `bun <path>.ts` arguments — one of the two edge kinds the scan follows.
 *
 * Applied to a workflow `run:` block AND to the text of every file already visited, because
 * a dispatcher names its targets in exactly this form: `cross-verify-roster.ts` holds
 * `command: "bun src/Core.TypeScript/hygiene/audit-orphaned-archive-refs.ts"` in a string,
 * and reading only the shell of `run:` is what made this guard blind on 2026-08-26.
 *
 * Paths are repo-root-relative, which is what both call sites produce.
 */
export function bunScriptTargets(shell: string): readonly string[] {
  const out: string[] = [];
  for (const m of shell.matchAll(/\bbun\s+(?:run\s+|test\s+)?([A-Za-z0-9_./-]+\.ts)\b/gu)) {
    if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}

/**
 * Import/re-export specifiers that are RELATIVE — bare ones are npm/node and not followed.
 *
 * Anchored per line (`m`) with HORIZONTAL whitespace only (`[^\S\n]`) rather than `\s`, so
 * no two parts of a pattern can both consume the same newline. That is not style: the
 * `(?:^|\n)\s*` form it replaces gives a regex engine overlapping ways to reach the same
 * position, which is the backtracking shape this repo's lint refuses — and this scanner
 * runs over every file the floor can reach.
 */
const RELATIVE_SPECIFIER_FORMS: readonly RegExp[] = [
  // import … from "./x";  export … from "../y";
  /^[^\S\n]*(?:import|export)\b[^\n;]*?\bfrom[^\S\n]*["'](\.[^"'\n]*)["']/gmu,
  // import "./z";  (side-effect import)
  /^[^\S\n]*import[^\S\n]*["'](\.[^"'\n]*)["']/gmu,
  // A STATIC dynamic import — `import("./x.ts")` with a literal. A computed specifier is
  // named in the honest-limits header as unresolvable, and it still is.
  /\bimport[^\S\n]*\([^\S\n]*["'](\.[^"'\n]*)["'][^\S\n]*\)/gu,
];

/**
 * Local relative imports of `fromFile`, resolved to repo-root-relative paths that exist.
 *
 * The second edge kind. `fromFile` is repo-root-relative; the result is too, so the caller
 * can keep one visited-set keyed the same way it keys `Finding.site`.
 */
export function localImportTargets(source: string, fromFile: string, root: string): readonly string[] {
  const dir = dirname(fromFile);
  const out: string[] = [];
  for (const form of RELATIVE_SPECIFIER_FORMS) {
    for (const m of source.matchAll(form)) {
      const spec = m[1];
      if (spec === undefined) continue;
      const base = normalizeSep(join(dir, spec));
      // Bun resolves an extensionless specifier several ways; try the ones this repo uses.
      const candidates = /\.[cm]?[jt]sx?$/u.test(base)
        ? [base]
        : [`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`];
      const hit = candidates.find((c) => existsSync(join(root, c)));
      if (hit !== undefined) out.push(hit);
    }
  }
  return out;
}

/** Repo-root-relative paths use `/` on every platform; `join` may hand back `\` on Windows. */
function normalizeSep(p: string): string {
  return p.split(sep).join("/");
}

/** First matching population query in already-comment-stripped text, with the matching line. */
export function findPopulationQuery(stripped: string): { query: PopulationQuery; evidence: string } | null {
  for (const query of POPULATION_QUERIES) {
    for (const pattern of query.patterns) {
      if (!pattern.test(stripped)) continue;
      const evidence = stripped.split("\n").find((l) => pattern.test(l))?.trim() ?? "";
      return { query, evidence: evidence.slice(0, 160) };
    }
  }
  return null;
}

/**
 * Read a file, or `null` when it is simply not there.
 *
 * One syscall, one answer. An `existsSync` gate ahead of the read would be check-then-use
 * (CWE-367) — the answer is stale before the read runs — and `lint-check-then-use-file-races.ts`
 * refuses it on the floor. A missing file is expected here (a `bun` argument may be a
 * directory, a flag, or a path only present in another checkout); anything else is a real
 * error and is rethrown rather than read as absence.
 */
function readOrNull(absPath: string): string | null {
  try {
    return readFileSync(absPath, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT" || (e as NodeJS.ErrnoException).code === "EISDIR") return null;
    throw e;
  }
}

/** One file a `run:` block can reach, with the chain that reached it (exclusive of itself). */
interface ReachedFile {
  readonly path: string;
  readonly via: readonly string[];
  /** Comment-stripped contents — read once here, so the caller does not re-read. */
  readonly stripped: string;
}

/**
 * Every file reachable from one shell block within `MAX_RESOLUTION_HOPS`, breadth-first.
 *
 * Two edge kinds: `bun <path>.ts` invocations (found in the shell AND in every file already
 * visited — a dispatcher names its targets that way) and relative local imports. `seen` is
 * the cycle guard, so a module cycle terminates and a diamond is examined once. Comment
 * text is stripped before edges are read, so a path mentioned in prose is not followed.
 */
function reachableFiles(root: string, shell: string): readonly ReachedFile[] {
  const seen = new Set<string>();
  const out: ReachedFile[] = [];
  let frontier: readonly { readonly path: string; readonly via: readonly string[] }[] = bunScriptTargets(shell).map(
    (path) => ({ path, via: [] as readonly string[] }),
  );

  for (let hop = 1; hop <= MAX_RESOLUTION_HOPS && frontier.length > 0; hop++) {
    const next: { readonly path: string; readonly via: readonly string[] }[] = [];
    for (const node of frontier) {
      if (seen.has(node.path)) continue;
      seen.add(node.path);
      const source = readOrNull(join(root, node.path));
      if (source === null) continue;
      const stripped = stripComments(source);
      out.push({ path: node.path, via: node.via, stripped });
      if (hop === MAX_RESOLUTION_HOPS) continue; // the bound: read, but do not expand
      const via = [...node.via, node.path];
      for (const target of bunScriptTargets(stripped)) next.push({ path: target, via });
      for (const target of localImportTargets(stripped, node.path, root)) next.push({ path: target, via });
    }
    frontier = next;
  }
  return out;
}

/**
 * Scan the blocking floor of one workflow for live population queries.
 *
 * Pure with respect to the network and the clock: it reads committed text only. That is
 * itself the point — a check on "may the floor depend on live state" that depended on live
 * state would be the defect it exists to name.
 */
export function scanFloor(
  root: string,
  workflowPath: string = GATE_WORKFLOW,
  rootJob: string = FLOOR_ROOT_JOB,
): { readonly findings: readonly Finding[]; readonly floor: readonly string[] } | { readonly error: string } {
  const workflowText = readOrNull(join(root, workflowPath));
  if (workflowText === null) return { error: `${workflowPath} not found under ${root}` };
  const jobs = parseWorkflowJobs(workflowText);
  const byId = new Map(jobs.map((j) => [j.id, j]));
  if (!byId.has(rootJob)) {
    return {
      error:
        `job '${rootJob}' is not in ${workflowPath}. Refusing a verdict: an empty floor would ` +
        "report clean while checking nothing, which is the vacuity class this scan exists to refuse.",
    };
  }

  const floor = [...floorClosure(jobs, rootJob)].sort();
  const findings: Finding[] = [];
  for (const jobId of floor) {
    const job = byId.get(jobId);
    if (job === undefined) continue;
    for (const shell of job.runs) {
      const strippedShell = stripComments(shell);
      const inline = findPopulationQuery(strippedShell);
      if (inline !== null) {
        findings.push({
          job: jobId,
          site: workflowPath,
          query: inline.query.id,
          why: inline.query.why,
          evidence: inline.evidence,
          via: [],
        });
      }

      // BOUNDED TRANSITIVE WALK — the reach that the one-hop version did not have.
      for (const reached of reachableFiles(root, shell)) {
        const hit = findPopulationQuery(reached.stripped);
        if (hit === null) continue;
        findings.push({
          job: jobId,
          site: reached.path,
          query: hit.query.id,
          why: hit.query.why,
          evidence: hit.evidence,
          via: reached.via,
        });
      }
    }
  }
  return { findings, floor };
}

export function main(argv: readonly string[]): number {
  const read = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = resolve(read("--root") ?? process.cwd());
  const scanned = scanFloor(root);
  if ("error" in scanned) {
    process.stderr.write(`floor-live-remote-queries: ${scanned.error}\n`);
    return 2;
  }
  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(scanned, null, 2)}\n`);
  }
  process.stdout.write(
    `[floor-scope] blocking floor = ${scanned.floor.length} job(s): ${scanned.floor.join(", ")}\n`,
  );
  if (scanned.findings.length === 0) {
    process.stdout.write("[floor-scope] OK — no live population query can move the floor's verdict\n");
    return 0;
  }
  for (const f of scanned.findings) {
    const chain = [f.job, ...f.via, f.site].join(" -> ");
    process.stderr.write(
      `floor-live-remote-queries: job '${f.job}' -> ${f.site} runs a LIVE POPULATION QUERY (${f.query}).\n` +
        `  resolved via: ${chain}\n` +
        `  why it does not belong on a pre-merge floor: ${f.why}\n` +
        `  evidence: ${f.evidence}\n` +
        "  A candidate's verdict must be a function of the candidate. Move the check to a lane\n" +
        "  that fails loudly on its own schedule (see .github/workflows/archive-strand-alarm.yml),\n" +
        "  or make it read a committed snapshot instead of the live remote.\n",
    );
  }
  return 1;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
