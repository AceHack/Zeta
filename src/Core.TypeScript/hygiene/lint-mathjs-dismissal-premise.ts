#!/usr/bin/env bun
// lint-mathjs-dismissal-premise.ts — the premise under Dependabot alert #15, enforced.
//
// A DISMISSAL WHOSE PREMISE NOTHING CHECKS IS THE VACUITY CLASS. It looks like a
// disposition and constrains nothing; the day the premise stops being true,
// nothing says so. This file is the check.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT WAS DISMISSED, AND ON WHAT GROUNDS.
//
// Alert #15 — GHSA-x2fc-mxcx-w4mf, HIGH, "Prototype Pollution in mathjs". The
// advisory's own words: *vulnerable via the deepExtend function that runs upon
// CONFIGURATION UPDATES*. It rides on `quantum-circuit`, which the maintainer has
// ruled STAYS: it is a declared `role=second-oracle` cross-verify oracle and that
// standing outweighs an alert count.
//
// THE FIRST PREMISE OFFERED FOR THIS DISMISSAL WAS FALSE, and saying so is the
// point of writing the check before writing the dismissal. It was proposed that
// "nothing imports it". MEASURED 2026-09-09 — four files import it:
//
//     src/Core.QSharp.ReferenceOracle/quantum-circuit.test.ts
//     src/Core.QSharp.ReferenceOracle/generate-treaty-transcript.ts
//     src/Core.TypeScript/quantum-observable/oracle.ts
//     src/Core.TypeScript/quantum-observable/generate-circuit-svgs.ts
//
// It is a LIVE oracle, used on purpose. A `not_used` dismissal resting on
// "nothing imports it" would have been refuted by its own first check.
//
// THE PREMISE THAT IS ACTUALLY TRUE, in four measured parts:
//
//   1. THERE IS NO VERSION FIX, EVER. `quantum-circuit` has 240 published
//      releases; `latest` is 0.9.250; the declared `mathjs` range across ALL 240
//      is one of ^3.8.0 / ^3.20.2 / ^6.0.3 / ^6.6.5. A caret range never crosses a
//      major, so the highest major any release has EVER admitted is 6. The
//      advisory's first patched version is 7.5.1. Upgrading cannot help, and
//      neither can waiting. (npm registry, 2026-09-09.)
//   2. THE VULNERABLE FUNCTION IS NOT REACHED. `deepExtend` runs on a mathjs
//      configuration update. `quantum-circuit`'s package `main`,
//      `lib/quantum-circuit.js`, contains ZERO call sites for `math.config`,
//      `math.create` or `deepExtend` (measured over the published 0.9.250 tarball).
//   3. WE NEVER TOUCH mathjs OURSELVES. No file in this tree imports it, so no
//      Zeta code can reach a configuration update through any path.
//   4. IT CANNOT REACH A CONSUMER. `quantum-circuit` is a devDependency of a
//      package marked `private: true`, so it is never published and never
//      installed by anyone depending on us.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE CHECKS, AND WHAT IT HONESTLY CANNOT.
//
//   (3) and (4) are checked OFFLINE and every run — they are about this tree, so
//       they are always answerable and a failure is a hard refusal.
//   (2) is checked ONLY when node_modules is installed. When it is not, this
//       reports UNKNOWN and says so out loud. UNKNOWN IS NOT A PASS: a probe that
//       could not run carries zero information about its subject.
//   (1) is NOT checked here, because it is a claim about UPSTREAM and needs the
//       network. It is a row in `tools/setup/manifests/pinned-refs`
//       (`npm:quantum-circuit!mathjs@7`) and `refresh-pins.ts --report` re-resolves
//       it: the day a release admits mathjs 7.x, the row goes `moved` and the
//       dismissal gets revisited instead of aging into a permanent silence.
//
// Usage:  bun src/Core.TypeScript/hygiene/lint-mathjs-dismissal-premise.ts
// Exit:   0 = every runnable part of the premise holds
//         1 = a part of the premise is FALSE — reopen the dismissal
//         2 = the check could not run (not at the repo root)
//
// 081M23NT5VX087G0R000KAFE45

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const PACKAGE = "quantum-circuit";
export const VULNERABLE_DEP = "mathjs";

/**
 * The only file exempt from the import scan, and the reason is that it must
 * contain example import lines in order to test the matcher at all.
 *
 * Enumerated rather than pattern-matched so it cannot quietly grow: a test below
 * asserts this list has exactly one entry and names it. An exclusion nobody
 * counts is how a scan becomes decorative.
 */
export const IMPORT_SCAN_EXEMPT: readonly string[] = [
  "src/Core.TypeScript/hygiene/lint-mathjs-dismissal-premise.test.ts",
];

const SOURCE_EXT = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/u;
const SKIP_DIR = new Set(["node_modules", "prior-art", "dist", "build", "out", "obj", "bin"]);

/**
 * Strip comments so the guard reads CODE, not prose about code.
 *
 * This file's own header names `mathjs` a dozen times. Without stripping, the
 * scanner's first act would be to refuse its own documentation — a failure this
 * repo has hit repeatedly, and one that its sibling `refresh-pins.ts` hit on its
 * very first run.
 */
export function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//gu, " ")
    .split("\n")
    .map((l) => {
      const t = l.trimStart();
      if (t.startsWith("//") || t.startsWith("#") || t.startsWith("*")) return "";
      const idx = l.indexOf("//");
      return idx >= 0 ? l.slice(0, idx) : l;
    })
    .join("\n");
}

/** An `import ... from "<mod>"` / `import("<mod>")` / `require("<mod>")` of `mod`. */
export function importsModule(text: string, mod: string): boolean {
  const m = mod.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const re = new RegExp(`(?:from|import|require)\\s*\\(?\\s*['"\`]${m}['"\`]`, "u");
  return re.test(stripComments(text));
}

function isMissing(err: unknown): boolean {
  return (err as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

/**
 * Read a file, or null when it simply is not there.
 *
 * NOT `existsSync` then `readFileSync`. That is two syscalls asking one question
 * and getting two answers, with a window between them in which the path can be
 * created, deleted or replaced — CWE-367, and a check that reads as defensive
 * while preventing nothing. `lint-check-then-use-file-races.ts` caught exactly
 * this shape in the first draft of this file and was right to.
 */
export function readOrNull(p: string, read: (q: string) => string): string | null {
  try {
    return read(p);
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

export function walk(p: string, acc: string[] = []): string[] {
  // ONE syscall, one answer, no window. `readdirSync(..., withFileTypes)` returns
  // each entry's kind with the listing, so nothing needs a second `statSync` that
  // could disagree with it (CWE-367). A directory read that fails with ENOTDIR
  // tells us `p` is itself a file; ENOENT means the root simply is not there,
  // which is not an error — callers pass optional roots.
  //
  // SYMLINKS ARE SKIPPED, and that is not tidiness: `tests/cross-verification/
  // experience/fixtures/tree1/subdir1/link_to_parent` is a deliberate symlink LOOP
  // fixture, and following it recurses until ELOOP. The first draft of this
  // function crashed there the moment `main()` walked `tests/`.
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(p, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOTDIR") {
      if (SOURCE_EXT.test(p)) acc.push(p);
      return acc;
    }
    if (code === "ENOENT") return acc;
    throw err;
  }
  for (const e of entries) {
    if (SKIP_DIR.has(e.name) || e.name.startsWith(".") || e.isSymbolicLink()) continue;
    const child = join(p, e.name);
    if (e.isDirectory()) walk(child, acc);
    else if (e.isFile() && SOURCE_EXT.test(child)) acc.push(child);
  }
  return acc;
}

export interface PremiseResult {
  readonly failures: readonly string[];
  readonly unknowns: readonly string[];
  readonly passes: readonly string[];
}

/** Part 4 — dev-scoped, and inside a package that is never published. */
export function checkScope(packageJsonText: string): { failures: string[]; passes: string[] } {
  const failures: string[] = [];
  const passes: string[] = [];
  const doc = JSON.parse(packageJsonText) as {
    private?: unknown;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  if (doc.dependencies !== undefined && PACKAGE in doc.dependencies)
    failures.push(
      `${PACKAGE} is now a RUNTIME dependency. The dismissal rests on it being dev-only, ` +
        `so it no longer holds — move it back or reopen alert #15.`,
    );
  else if (doc.devDependencies !== undefined && PACKAGE in doc.devDependencies)
    passes.push(`${PACKAGE} is a devDependency`);
  else
    failures.push(
      `${PACKAGE} is in neither dependencies nor devDependencies. The dismissal names it as a ` +
        `declared second oracle; if it was removed, remove the dismissal and this check with it.`,
    );

  if (doc.private === true) passes.push("the package is private:true and is never published");
  else
    failures.push(
      "the package is no longer private:true, so a devDependency chain could now reach a consumer. " +
        "Reopen alert #15.",
    );
  return { failures, passes };
}

/** Part 3 — nothing in this tree imports the vulnerable module. */
export function checkNoDirectImport(
  files: readonly string[],
  read: (p: string) => string,
): { failures: string[]; passes: string[] } {
  const hits: string[] = [];
  for (const f of files) {
    if (IMPORT_SCAN_EXEMPT.includes(f)) continue;
    if (importsModule(read(f), VULNERABLE_DEP)) hits.push(f);
  }
  if (hits.length === 0)
    return { failures: [], passes: [`no file in the tree imports ${VULNERABLE_DEP} directly`] };
  return {
    failures: [
      `${String(hits.length)} file(s) now import ${VULNERABLE_DEP} directly:\n` +
        hits.map((h) => `      ${h}`).join("\n") +
        `\n    The dismissal of alert #15 rests on the configuration path being unreachable from ` +
        `Zeta code. It is now reachable. Reopen it.`,
    ],
    passes: [],
  };
}

const CONFIG_SURFACE = /\bmath\s*\.\s*(config|create)\s*\(|\bdeepExtend\b/u;

/**
 * Part 2 — the upstream half, and the only one that can come back UNKNOWN.
 *
 * `installedMain` is the text of `node_modules/quantum-circuit/lib/quantum-circuit.js`,
 * or null when the package is not installed.
 */
export function checkUpstreamConfigSurface(
  installedMain: string | null,
): { failures: string[]; unknowns: string[]; passes: string[] } {
  if (installedMain === null)
    return {
      failures: [],
      unknowns: [
        `${PACKAGE} is not installed, so its call sites could not be read. UNKNOWN — not a pass. ` +
          `Run \`npm ci\` (or \`bun install\`) and re-run to check this part of the premise.`,
      ],
      passes: [],
    };
  if (CONFIG_SURFACE.test(stripComments(installedMain)))
    return {
      failures: [
        `${PACKAGE}'s main now reaches ${VULNERABLE_DEP}'s CONFIGURATION surface ` +
          `(math.config / math.create / deepExtend). That is the exact function GHSA-x2fc-mxcx-w4mf ` +
          `names, and the dismissal assumed it was never called. Reopen alert #15.`,
      ],
      unknowns: [],
      passes: [],
    };
  return {
    failures: [],
    unknowns: [],
    passes: [`${PACKAGE}'s main has no ${VULNERABLE_DEP} configuration call sites`],
  };
}

export function runPremise(
  packageJsonText: string,
  files: readonly string[],
  read: (p: string) => string,
  installedMain: string | null,
): PremiseResult {
  const scope = checkScope(packageJsonText);
  const imports = checkNoDirectImport(files, read);
  const upstream = checkUpstreamConfigSurface(installedMain);
  return {
    failures: [...scope.failures, ...imports.failures, ...upstream.failures],
    unknowns: [...upstream.unknowns],
    passes: [...scope.passes, ...imports.passes, ...upstream.passes],
  };
}

const INSTALLED_MAIN = "node_modules/quantum-circuit/lib/quantum-circuit.js";

function main(): number {
  const read = (p: string): string => readFileSync(p, "utf-8");
  const pkg = readOrNull("package.json", read);
  if (pkg === null) {
    console.error("lint-mathjs-dismissal-premise: no package.json — run from the repo root.");
    return 2;
  }
  const files = [...walk("src"), ...walk("tools"), ...walk("tests")];
  if (files.length === 0) {
    console.error("lint-mathjs-dismissal-premise: scanned zero source files — run from the repo root.");
    return 2;
  }
  // Absent is the ORDINARY case (no node_modules), and it is UNKNOWN rather than
  // a pass — see checkUpstreamConfigSurface.
  const installedMain = readOrNull(INSTALLED_MAIN, read);
  const r = runPremise(pkg, files, read, installedMain);

  for (const p of r.passes) console.log(`  ok      ${p}`);
  for (const u of r.unknowns) console.log(`  UNKNOWN ${u}`);
  for (const f of r.failures) console.error(`  FAIL    ${f}`);

  if (r.failures.length > 0) {
    console.error(
      `\nThe premise under the dismissal of Dependabot alert #15 (GHSA-x2fc-mxcx-w4mf) no longer holds.\n` +
        `The dismissal must be reopened — a dismissal whose premise nothing checks is the vacuity class,\n` +
        `and this is the check saying so.`,
    );
    return 1;
  }
  console.log(
    `\nmathjs dismissal premise holds over ${String(files.length)} scanned file(s)` +
      (r.unknowns.length > 0 ? ` — with ${String(r.unknowns.length)} part(s) UNKNOWN (see above; unknown is not a pass).` : "."),
  );
  return 0;
}

if (import.meta.main) process.exit(main());
