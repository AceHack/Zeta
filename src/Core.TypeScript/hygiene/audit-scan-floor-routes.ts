// src/Core.TypeScript/hygiene/audit-scan-floor-routes.ts
//
// THE INVENTORY OF SCAN FLOORS, AND THE PER-ROUTE FLOOR ON THE INVENTORY ITSELF.
//
// A scan floor is a guard that fails when a check inspected fewer items than a
// stated minimum -- the guard against a check silently becoming a no-op. Two of
// them have already earned their keep here: one caught a guard shelling `rg`,
// which is not installed on the CI runner, inspecting zero files; another caught
// `lint:markdown` linting nothing for months (#10712).
//
// THE DEFECT THIS FILE IS PART OF FIXING. A floor over a TOTAL is itself a
// partially-blind instrument when the corpus arrives by several independent
// routes -- several roots, several extraction patterns, several substrates. An
// aggregate floor sums independent instruments, so it cannot detect the failure
// of any one: redundancy in the numerator hides a zero. The fix is a per-route
// floor -- every named route must contribute at least one item.
//
// IMPORTANT QUALIFICATION, measured rather than assumed (see the work-item):
// the blindness is a property of UNION aggregation, not of multi-route corpora
// as such. A corpus built by INTERSECTION -- audit-schema-key-set-parity.ts
// compares only schema ids bound in two oracles at once -- collapses to zero
// when any one route goes dark, so its aggregate floor already detects a route
// blackout. Likewise an aggregate floor whose VALUE equals the number of
// mandatory routes is per-route in effect. Neither needs converting, and
// converting them would be churn.
//
// WHAT THIS FILE DOES. It enumerates the scan-floor sites in the repo through
// four INDEPENDENT recognizer routes and requires each route to contribute at
// least one site. An enumerating check is exactly the shape that goes blind, so
// this one carries the discipline it audits: if one recognizer stops matching --
// a rename, a reformat, a moved surface -- the run fails NAMING that recognizer,
// instead of reporting a shorter inventory as though the class had shrunk.
//
// WHY THE FLOOR IS 1 PER ROUTE AND NOT A TUNED NUMBER. One is the only value
// that is not a guess. It is the non-vacuity boundary -- "this recognizer still
// recognizes something" -- and every value above it would be a claim about how
// many floors the repo ought to contain, which nobody knows. An arbitrary floor
// that never fires is another blind instrument, so this file declines to pick
// one.
//
// SELF-EXCLUSION IS LOAD-BEARING, AND THE MEASURED NUMBER IS SMALLER THAN THE
// FIRST GUESS. This source and its test are excluded from the corpus. The first
// draft of the comment here claimed the pair would satisfy all four floors from
// their own text; the test written to pin that claim FAILED, and the measurement
// is: this source contributes 13 `floor-prose` hits, and the test contributes
// named-min-constant 2, floor-prose 1, count-assertion 3. So THREE of the four
// routes are self-satisfiable and `cli-min-flag` is not -- which still means
// three of the four floors could never go dark without the exclusion. The claim
// is recorded at its measured size rather than at the size that sounded better.
//
// DST: pure function of the tracked file tree. No clock, no network, no
// randomness. Output is ordinal-sorted throughout.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-scan-floor-routes.ts
//   bun src/Core.TypeScript/hygiene/audit-scan-floor-routes.ts --json
//
// Exit codes:
//   0  every recognizer route contributed at least one site
//   1  usage error
//   3  route floor breach -- a named recognizer found nothing

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** A recognizer route: an independent way a scan floor makes itself visible. */
export interface Route {
  readonly id: string;
  /** What kind of floor this recognizer finds, and why it can go dark on its own. */
  readonly why: string;
  readonly pattern: RegExp;
  /**
   * Whether a hit only counts in a file that also gathers a corpus from the
   * tree. Without this, `MIN_ISO_BYTES` in a USB flasher reads as a scan floor.
   */
  readonly requiresCorpusGather: boolean;
}

/** A site: one recognizer hit, attributed to the route that found it. */
export interface Site {
  readonly route: string;
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

export interface AuditReport {
  readonly sites: readonly Site[];
  readonly perRoute: ReadonlyMap<string, number>;
  readonly darkRoutes: readonly string[];
  readonly filesScanned: number;
  /** Files whose corpus visibly arrives by more than one route -- informational. */
  readonly multiRouteCandidates: readonly string[];
}

/**
 * A file GATHERS a corpus when it walks the tree rather than reading a fixture.
 * This is what separates a scan floor from an ordinary numeric threshold.
 */
export const CORPUS_GATHER =
  /ls-files|readdirSync|readdir\(|new Glob\(|globSync|Bun\.Glob|execFileSync\(\s*"rg"|spawnSync\(\s*"rg"/;

/**
 * The four recognizer routes. Each is an independent surface: a floor can be
 * written in any one of these forms without the others, so any one of them
 * dying leaves the other three still returning a plausible-looking inventory.
 * That is precisely why each carries its own floor.
 */
export const ROUTES: readonly Route[] = [
  {
    id: "named-min-constant",
    why: "a count compared against a MIN_-named threshold; dies if the naming convention changes",
    // `MIN_` anywhere, or a camelCase identifier that STARTS with `min`. Deliberately not
    // a bare `Min` anywhere: that matched `thirtyMinAgo` (a timestamp) and
    // `wasmMinDataAddr` (vendored Go runtime), neither of which is a scan floor. A
    // recognizer that reports non-floors makes the inventory a thing people stop reading.
    pattern: /(?:<|>=)\s*(?:[A-Za-z_$][\w$]*\.)?(?:[\w$]*MIN_[\w$]*|min[A-Z][\w$]*)/g,
    requiresCorpusGather: true,
  },
  {
    id: "cli-min-flag",
    why: "a floor exposed as a --min-* operand; dies if the flag is renamed or the CLI is dropped",
    pattern: /--min-[a-z][a-z-]*/g,
    requiresCorpusGather: false,
  },
  {
    id: "floor-prose",
    why: "the failure text a floor prints; dies if the wording is rewritten",
    pattern:
      /scan floor|scanned only|vacuous pass|checked nothing|inspected nothing|LIVENESS FAILURE|covers something/gi,
    requiresCorpusGather: false,
  },
  {
    id: "count-assertion",
    why: "a test-side non-vacuity assertion on a gathered corpus; dies if the assertion style changes",
    pattern:
      /expect\(([^()]*(?:\([^()]*\))?[^()]*)\)\s*\.toBeGreaterThan(?:OrEqual)?\(\s*([1-9][0-9]*)\s*\)/g,
    requiresCorpusGather: true,
  },
];

/**
 * Excluded from the corpus. This file states all four patterns as literals, so
 * including it would satisfy all four floors from its own text -- a check that
 * cannot fail. The test file quotes them too.
 */
export const SELF_EXCLUDED: readonly string[] = [
  "src/Core.TypeScript/hygiene/audit-scan-floor-routes.ts",
  "src/Core.TypeScript/hygiene/audit-scan-floor-routes.test.ts",
];

const SCANNABLE = /\.(?:ts|mts|cts|mjs|js)$/;
const SKIP_PREFIX = /^(?:references\/|node_modules\/)|\/node_modules\//;

/**
 * THE CORPUS, READ ONCE PER PROCESS PER ROOT.
 *
 * This audit is a pure function of the tracked file tree (stated at the top of this
 * file), so reading the same 2,896 sources once per `runAudit` call was pure waste: the
 * test file alone calls `runAudit` ELEVEN times -- four single-route runs, two runs with
 * an extra impossible route, two self-exclusion runs, three live-inventory runs -- and
 * re-read all 29 MB every time.
 *
 * WHY IT WAS WORTH FIXING, which is not the obvious reason. On a CI runner each read
 * costs ~100 ms and eleven of them are merely untidy. The cost that mattered is that the
 * FIRST read in a fresh process is not the same price as the tenth. MEASURED 2026-08-22
 * on the fleet's own machine, same 2,896 files, same warm page cache, one bun process:
 *
 *     read-only pass0: 17472 ms     pass1: 352 ms     pass2: 342 ms
 *
 * -- a ~50x first-pass penalty per process, reproduced identically in a months-old
 * checkout and a minutes-old clone, so it is a property of the host and not of either
 * tree. Against bun's 5,000 ms per-test cap that turns the first `runAudit` in the file
 * into a coin flip, and a lost flip is reported as
 *
 *     (fail) route named-min-constant contributes at least one site by itself
 *
 * which is this file's DARK ROUTE message -- the one whose own instruction is "Fix the
 * recognizer, never the floor." A timeout wearing that name asks a reader to retire a
 * live recognizer. That happened on 2026-08-22 and cost several agents a morning.
 *
 * The cache does NOT make the audit see stale content within a process, because nothing
 * mutates the tree while it runs; a caller that ever needs to re-read must call
 * `clearCorpusCache()` and say why. `corpusReadsFromDisk()` exists so a test can prove
 * the second call read nothing -- delete the memo and that test fails.
 */
const corpusCache = new Map<string, ReadonlyMap<string, string>>();
let filesReadFromDisk = 0;

/** Total files this process has actually read from disk. The memo's falsifier. */
export function corpusReadsFromDisk(): number {
  return filesReadFromDisk;
}

/** Drop the memo. For a caller that genuinely needs to observe a changed tree. */
export function clearCorpusCache(): void {
  corpusCache.clear();
}

/**
 * Read (or reuse) every tracked source under `root`. Unreadable entries -- symlinks,
 * submodules -- are absent from the map rather than present-and-empty, which keeps
 * `filesScanned` counting what it says: files whose text was actually inspected.
 */
export function corpus(root: string): ReadonlyMap<string, string> {
  const cached = corpusCache.get(root);
  if (cached !== undefined) return cached;
  const built = new Map<string, string>();
  for (const file of trackedSources(root)) {
    try {
      built.set(file, readFileSync(join(root, file), "utf8"));
      filesReadFromDisk++;
    } catch {
      continue; // symlink, submodule, unreadable: not a floor site
    }
  }
  corpusCache.set(root, built);
  return built;
}

export function trackedSources(root: string): readonly string[] {
  const out = execFileSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  return out
    .split("\n")
    .filter((f) => f.length > 0 && SCANNABLE.test(f) && !SKIP_PREFIX.test(f))
    .sort();
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

/** Two or more independent gather calls unioned into one corpus -- informational. */
const UNION_OF_WALKS = /\[\s*\.\.\.\w+\([^)]*\)\s*,\s*\.\.\.\w+\(/;
const ROOT_LIST = /(?:SEARCH_)?ROOTS\s*(?::[^=]*)?=\s*\[/;

export function auditText(
  file: string,
  text: string,
  routes: readonly Route[] = ROUTES,
): readonly Site[] {
  const gathers = CORPUS_GATHER.test(text);
  const sites: Site[] = [];
  for (const route of routes) {
    if (route.requiresCorpusGather && !gathers) continue;
    for (const m of text.matchAll(route.pattern)) {
      sites.push({
        route: route.id,
        file,
        line: lineOf(text, m.index),
        text: m[0].replace(/\s+/g, " ").slice(0, 100),
      });
    }
  }
  return sites;
}

export function runAudit(
  root: string,
  excluded: readonly string[] = SELF_EXCLUDED,
  routes: readonly Route[] = ROUTES,
): { readonly report: AuditReport; readonly exitCode: 0 | 3 } {
  const sites: Site[] = [];
  const multiRouteCandidates: string[] = [];
  let filesScanned = 0;

  for (const [file, text] of corpus(root)) {
    if (excluded.includes(file)) continue;
    filesScanned++;
    const found = auditText(file, text, routes);
    sites.push(...found);
    if (found.length > 0 && (UNION_OF_WALKS.test(text) || ROOT_LIST.test(text))) {
      multiRouteCandidates.push(file);
    }
  }

  sites.sort((a, b) =>
    a.route === b.route
      ? a.file === b.file
        ? a.line - b.line
        : a.file < b.file
          ? -1
          : 1
      : a.route < b.route
        ? -1
        : 1,
  );

  const perRoute = new Map<string, number>();
  for (const route of routes) perRoute.set(route.id, 0);
  for (const site of sites) perRoute.set(site.route, (perRoute.get(site.route) ?? 0) + 1);

  const darkRoutes = routes.filter((r) => (perRoute.get(r.id) ?? 0) === 0).map((r) => r.id);

  const report: AuditReport = {
    sites,
    perRoute,
    darkRoutes,
    filesScanned,
    multiRouteCandidates: [...new Set(multiRouteCandidates)].sort(),
  };
  return { report, exitCode: darkRoutes.length > 0 ? 3 : 0 };
}

export function renderReport(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(`scan-floor route audit -- ${String(report.filesScanned)} tracked sources scanned`);
  lines.push("");
  lines.push("Per-route contribution (floor: 1 each -- the non-vacuity boundary):");
  for (const route of ROUTES) {
    const n = report.perRoute.get(route.id) ?? 0;
    lines.push(`  ${n === 0 ? "DARK" : "  ok"}  ${route.id.padEnd(20)} ${String(n).padStart(4)}  ${route.why}`);
  }
  lines.push("");
  lines.push(`Sites (${String(report.sites.length)}):`);
  for (const site of report.sites) {
    lines.push(`  [${site.route}] ${site.file}:${String(site.line)}  ${site.text}`);
  }
  if (report.multiRouteCandidates.length > 0) {
    lines.push("");
    lines.push(
      "Corpus visibly gathered by more than one route (INFORMATIONAL -- a union corpus here",
    );
    lines.push("wants a per-route floor; an intersection corpus does not):");
    for (const f of report.multiRouteCandidates) lines.push(`  ${f}`);
  }
  return lines.join("\n");
}

function main(argv: readonly string[]): number {
  const asJson = argv.includes("--json");
  const rootIdx = argv.indexOf("--root");
  const root =
    rootIdx >= 0 ? resolve(argv[rootIdx + 1] ?? ".") : resolve(import.meta.dir, "..", "..", "..");
  for (const arg of argv) {
    if (arg.startsWith("--") && !["--json", "--root"].includes(arg) && !argv.includes("--root")) {
      process.stderr.write(`unknown flag ${arg}\n`);
      return 1;
    }
  }

  const { report, exitCode } = runAudit(root);

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify(
        {
          filesScanned: report.filesScanned,
          perRoute: Object.fromEntries(report.perRoute),
          darkRoutes: report.darkRoutes,
          sites: report.sites,
          multiRouteCandidates: report.multiRouteCandidates,
        },
        null,
        2,
      )}\n`,
    );
  } else {
    process.stdout.write(`${renderReport(report)}\n`);
  }

  if (exitCode === 3) {
    process.stderr.write(
      `\nROUTE FLOOR BREACH: recognizer(s) ${report.darkRoutes.join(", ")} found nothing.\n` +
        "A shorter inventory is not evidence the class shrank -- it is evidence a recognizer\n" +
        "stopped recognizing. Fix the recognizer, never the floor.\n",
    );
  }
  return exitCode;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
