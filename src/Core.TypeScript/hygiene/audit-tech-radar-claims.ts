#!/usr/bin/env bun
// audit-tech-radar-claims.ts — the tech radar is prose, and prose rots silently.
//
// WHY THIS EXISTS. On 2026-08-22 Soraya found two ring-drift items in
// `docs/TECH-RADAR.md` and both were the same defect wearing different clothes:
// the document asserted something about the repo that had stopped being true, and
// nothing anywhere could notice.
//
//   * `fast-check` was pinned in `package.json` and imported by five test files
//     and had NO ROW AT ALL. The only property-testing row was "FsCheck 3", which
//     is .NET, so the radar's Adopt ring silently stood in for a TypeScript tool
//     at a different maturity.
//   * The `tools/alloy/alloy.jar` and `tools/invariant-substrates/tally.ts` paths
//     cited by two rows did not exist; both files had moved.
//
// A radar row is a CLAIM. An unfalsifiable claim is the vacuity class -- the same
// defect as a green CI square for a check that never ran
// (`.claude/rules/toy-is-free-metered-must-be-earned.md`). This audit is the
// falsifier for the two subclasses that are mechanically decidable. It deliberately
// does not try to check the rest.
//
// ── CHECK A — every path the radar cites resolves ──────────────────────────────
// Any backticked token in TECH-RADAR.md that looks like a repo path (has a `/` and
// a file extension) must exist. Zero judgement, zero allowlist.
//
// Escape hatch for artifacts a row PROPOSES rather than reports: write
// `` `docs/research/thing.md` (planned) `` -- the marker must be on the same line.
// A planned path that later exists is fine (the marker is permissive, not an
// assertion), so this cannot go stale in the dangerous direction.
//
// ── CHECK B — a devDependency used to VERIFY must carry a ring ─────────────────
// Every dependency in the root `package.json`'s `devDependencies` that is
// statically imported by a tracked `*.test.ts` file must be named somewhere in
// TECH-RADAR.md.
//
// The scope is DERIVED, not hand-listed, and both halves of the derivation are
// load-bearing:
//
//   * `devDependencies` is the manifest's OWN declaration of "tooling, not shipped
//     product". It is not our category judgement.
//   * "imported by a test file" is the mechanical proxy for "part of how we verify",
//     which is exactly what the radar's Tools/infra section is about.
//
// Runtime `dependencies` are deliberately OUT of scope. A radar is an evaluation
// register, not an SBOM; demanding a row for `pg` and `@scure/bip39` would produce
// ~25 findings nobody intends to act on, and a check people route around is worse
// than no check. Naming that boundary is the point -- see
// `.claude/rules/anti-babel-preserve-reconcilability.md`: the guard cannot be a
// direction, it has to be an invariant somebody will keep.
//
// ── HONEST LIMITS (stated, not hidden) ────────────────────────────────────────
//  1. Check B sees STATIC imports only. `src/Core.TypeScript/ace/solver.z3.test.ts`
//     loads Z3 as `require('z3-solver/build/node.js')` inside a spawned Node
//     process, and this audit cannot see it. It UNDER-reports; it does not invent.
//  2. Root `package.json` only. The nested manifests under `demo/`, `genesis/`,
//     `full-ai-cluster/` and `agentic-organization/` are not scanned.
//  3. Check B matches a package NAME anywhere in the radar text. A row that merely
//     mentions a tool satisfies it. That is intentional -- deciding whether a row
//     is a GOOD row is a human call, and a lint that pretended otherwise would be
//     a check that cannot fail honestly.
//  4. Neither check can tell you a ring is WRONG. The TLA+ row was Adopt with a
//     dark lane for seven weeks and this audit would have stayed green throughout.
//     Lane liveness is a different measurement and belongs in a different check.
//
// Usage:  bun src/Core.TypeScript/hygiene/audit-tech-radar-claims.ts [--json]
// Exit:   0 = every claim resolves · 1 = findings · 2 = the audit could not run
//         (a check that inspected nothing must not report success).

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export const RADAR_PATH = "docs/TECH-RADAR.md";

/** Scan floor for check B. Below this the test corpus was not really scanned. */
export const MIN_TEST_FILES = 200;

export interface Finding {
  readonly check: "path" | "unringed-devdep";
  readonly line: number;
  readonly subject: string;
  readonly detail: string;
}

// ── Check A ───────────────────────────────────────────────────────────────────

/**
 * A backticked token that looks like a repo-relative path: at least one `/`,
 * a trailing extension, no whitespace, no URI scheme, no glob.
 */
const BACKTICKED = /`([^`\s]+)`/gu;
const LOOKS_LIKE_PATH = /^[A-Za-z0-9_.][A-Za-z0-9_./-]*\/[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,6}$/u;
const URI_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/u;

export function citedPaths(text: string): readonly { path: string; line: number; planned: boolean }[] {
  const out: { path: string; line: number; planned: boolean }[] = [];
  text.split("\n").forEach((line, i) => {
    const planned = line.includes("(planned)");
    for (const m of line.matchAll(BACKTICKED)) {
      const raw = m[1];
      if (raw === undefined) continue;
      if (URI_SCHEME.test(raw)) continue;
      if (raw.includes("*")) continue;
      if (!LOOKS_LIKE_PATH.test(raw)) continue;
      out.push({ path: raw, line: i + 1, planned });
    }
  });
  return out;
}

export function checkPaths(text: string, exists: (p: string) => boolean = existsSync): readonly Finding[] {
  const out: Finding[] = [];
  for (const c of citedPaths(text)) {
    if (c.planned) continue;
    if (exists(c.path)) continue;
    out.push({
      check: "path",
      line: c.line,
      subject: c.path,
      detail: "cited by a radar row and does not exist (moved, renamed, or deleted)",
    });
  }
  return out;
}

// ── Check B ───────────────────────────────────────────────────────────────────

/** Bare/scoped specifier -> package name. `@a/b/c` -> `@a/b`; `a/b` -> `a`. */
export function packageOf(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  if (specifier.startsWith("node:") || specifier === "bun" || specifier.startsWith("bun:")) return null;
  const parts = specifier.split("/");
  if (specifier.startsWith("@")) {
    const scope = parts[0];
    const name = parts[1];
    if (scope === undefined || name === undefined) return null;
    return `${scope}/${name}`;
  }
  const head = parts[0];
  return head === undefined || head === "" ? null : head;
}

/**
 * A module specifier reached by `from "x"` or a bare side-effect `import "x"`.
 *
 * Deliberately two SIMPLE alternatives rather than one clause spanning the whole
 * import statement. The obvious `import\s[^;]*?from` shape is super-linear under
 * backtracking (sonarjs/slow-regex) and buys nothing, because the package name is
 * recoverable from the specifier alone. This form also picks up multi-line imports
 * and `export … from` specifiers for free, which the statement-spanning one missed.
 */
const STATIC_IMPORT = /\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/gu;

/**
 * Blank out `//` and block comments so a package named in PROSE is not read as a
 * dependency.
 *
 * This audit does not parse TypeScript, it regexes — and to a regex a specifier in a
 * comment is identical to a real import. That is not hypothetical: this file's own
 * test suite is inside the corpus, and a header comment explaining a past false
 * positive re-created it, because the comment quoted `from "playwright"` verbatim.
 *
 * A character scanner rather than a regex, because `"https://…"` contains `//` inside
 * a string and a regex that strips it would corrupt real specifiers. String state is
 * tracked for all three quote forms; escapes are honoured. Comment bodies are replaced
 * with spaces rather than deleted so byte offsets — and therefore any future line
 * reporting — stay true.
 *
 * STATED LIMIT: regex literals are not tracked, so `/"/` could in principle open a
 * phantom string. No such construct exists in the corpus today and the failure mode is
 * to see FEWER imports, which keeps this audit's bias (under-report, never invent).
 */
/** Copy a quoted string verbatim from `i` (which points at the opening quote). */
function copyString(src: string, i: number): { readonly text: string; readonly next: number } {
  const quote = src[i] ?? "";
  let out = quote;
  let k = i + 1;
  while (k < src.length) {
    const c = src[k] ?? "";
    if (c === "\\") {
      out += c + (src[k + 1] ?? "");
      k += 2;
      continue;
    }
    out += c;
    k += 1;
    if (c === quote) break;
  }
  return { text: out, next: k };
}

/** Blank a region to spaces, keeping newlines, so byte offsets survive. */
function blank(src: string, from: number, to: number): string {
  let out = "";
  for (let k = from; k < to; k += 1) out += src[k] === "\n" ? "\n" : " ";
  return out;
}

/**
 * Blank out `//` and block comments so a package named in PROSE is not read as a
 * dependency.
 *
 * This audit does not parse TypeScript, it regexes — and to a regex a specifier in a
 * comment is identical to a real import. Not hypothetical: this file's own test suite
 * is inside the scanned corpus, and a header comment explaining a past false positive
 * RE-CREATED it, because the comment quoted the specifier verbatim.
 *
 * A character scanner rather than a regex, because `"https://…"` contains `//` inside
 * a string and a regex that stripped it would corrupt real specifiers. Comment bodies
 * become spaces rather than disappearing, so byte offsets stay true.
 *
 * TWO STATED LIMITS, both biased toward seeing FEWER imports (under-report, never
 * invent):
 *  1. Regex literals are not tracked, so `/"/` could open a phantom string.
 *  2. A specifier inside a STRING LITERAL is still indistinguishable from a real
 *     import — comments are handled, string fixtures are not and cannot be. That is
 *     why the test suite's fixtures must never name a real devDependency.
 */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i] ?? "";
    const next = source[i + 1] ?? "";
    if (c === '"' || c === "'" || c === "`") {
      const copied = copyString(source, i);
      out += copied.text;
      i = copied.next;
    } else if (c === "/" && next === "/") {
      const nl = source.indexOf("\n", i);
      const stop = nl === -1 ? source.length : nl;
      out += blank(source, i, stop);
      i = stop;
    } else if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += blank(source, i, stop);
      i = stop;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

export function importedPackages(source: string): readonly string[] {
  const out = new Set<string>();
  for (const m of stripComments(source).matchAll(STATIC_IMPORT)) {
    const spec = m[1] ?? m[2];
    if (spec === undefined) continue;
    const pkg = packageOf(spec);
    if (pkg !== null) out.add(pkg);
  }
  return [...out];
}

/** Whole-token match, so `pg` does not match "pgrep" and `semver` does not match "semverish". */
export function namedInRadar(radar: string, pkg: string): boolean {
  const escaped = pkg.replaceAll(/[.*+?^${}()|[\]\\/]/gu, String.raw`\$&`);
  return new RegExp(String.raw`(^|[^A-Za-z0-9@/_.-])${escaped}([^A-Za-z0-9@/_.-]|$)`, "u").test(radar);
}

export function trackedTestFiles(): readonly string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync("git", ["ls-files", "*.test.ts"], { encoding: "utf-8" });
  if (r.status !== 0) return [];
  return r.stdout.split("\n").filter((l) => l.length > 0);
}

export function checkUnringedDevDeps(
  radar: string,
  devDeps: readonly string[],
  testFiles: readonly string[],
  read: (p: string) => string = (p) => readFileSync(p, "utf-8"),
): readonly Finding[] {
  const dev = new Set(devDeps);
  const usedBy = new Map<string, string[]>();
  for (const f of testFiles) {
    let src: string;
    try {
      src = read(f);
    } catch {
      continue;
    }
    for (const pkg of importedPackages(src)) {
      if (!dev.has(pkg)) continue;
      const list = usedBy.get(pkg) ?? [];
      list.push(f);
      usedBy.set(pkg, list);
    }
  }
  const out: Finding[] = [];
  for (const [pkg, files] of [...usedBy.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (namedInRadar(radar, pkg)) continue;
    out.push({
      check: "unringed-devdep",
      line: 0,
      subject: pkg,
      detail:
        `pinned in package.json devDependencies and imported by ${String(files.length)} test file(s) ` +
        `(e.g. ${String(files[0])}) — a tool we verify with and have given no ring`,
    });
  }
  return out;
}

// ── main ──────────────────────────────────────────────────────────────────────

interface PackageJson {
  readonly devDependencies?: Record<string, string>;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const asJson = argv.includes("--json");

  // ATTEMPT, don't check-then-use. An `existsSync` guard in front of these reads is
  // CWE-367 (lint-check-then-use-file-races.ts caught exactly that here on the PR that
  // added this file), and it buys nothing: the read already tells you whether the file
  // is there, and it tells you the truth at the moment it matters.
  let radar: string;
  let pkg: PackageJson;
  try {
    radar = readFileSync(RADAR_PATH, "utf-8");
    pkg = JSON.parse(readFileSync("package.json", "utf-8")) as PackageJson;
  } catch (err) {
    console.error(
      `audit-tech-radar-claims: could not read ${RADAR_PATH} + package.json — run from the repo root. ` +
        `(${err instanceof Error ? err.message : String(err)})`,
    );
    return 2;
  }
  const devDeps = Object.keys(pkg.devDependencies ?? {});
  const testFiles = trackedTestFiles();

  if (testFiles.length < MIN_TEST_FILES) {
    console.error(
      `audit-tech-radar-claims: only ${String(testFiles.length)} tracked *.test.ts found ` +
        `(floor ${String(MIN_TEST_FILES)}). An audit that inspected nothing must not report success.`,
    );
    return 2;
  }

  const findings = [...checkPaths(radar), ...checkUnringedDevDeps(radar, devDeps, testFiles)];

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          radar: RADAR_PATH,
          citedPaths: citedPaths(radar).length,
          devDependencies: devDeps.length,
          testFiles: testFiles.length,
          findings,
        },
        null,
        2,
      ),
    );
    return findings.length === 0 ? 0 : 1;
  }

  if (findings.length === 0) {
    console.log(
      `tech-radar claims: OK — ${String(citedPaths(radar).length)} cited path(s) resolve, and every ` +
        `devDependency imported by one of ${String(testFiles.length)} test files is named in ${RADAR_PATH}.`,
    );
    return 0;
  }

  console.error(`tech-radar claims: ${String(findings.length)} claim(s) the repo cannot support:\n`);
  for (const f of findings) {
    const where = f.line > 0 ? `${RADAR_PATH}:${String(f.line)}` : RADAR_PATH;
    console.error(`  [${f.check}] ${where}  ${f.subject}\n      ${f.detail}`);
  }
  console.error(
    `\nFix by correcting the row, not by deleting the citation. A path that a row PROPOSES\n` +
      `rather than reports is marked \`(planned)\` on the same line. An in-use verification tool\n` +
      `with no ring is the radar failing at its one job — give it a row and an honest ring.`,
  );
  return 1;
}

if (import.meta.main) process.exit(main());
