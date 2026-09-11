#!/usr/bin/env bun
// src/Core.TypeScript/hygiene/audit-playwright-specs-excluded-from-bun.ts
//
// A PLAYWRIGHT SPEC MUST NOT BE COLLECTABLE BY `bun test`.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE INSTANCE THAT COMMISSIONED THIS
// ═══════════════════════════════════════════════════════════════════════════
//
// PR #17249 added `uat/shortener.spec.ts`, a `playwright/test` acceptance spec
// that drives a real HTTP server. `bun test` collects `*.spec.ts` exactly as
// readily as `*.test.ts`, so adding one Playwright file silently enrolled it in
// the hermetic bun suite, where it threw at module load:
//
//   APP_DIR is not set: acceptance has no service to run against,
//   which is not a pass
//
// That refusal is CORRECT -- failing closed beats passing silently, and the
// message says so. What was wrong is that bun collected it at all. The cost was
// a 24-minute hermetic run reporting `1 error` for a reason unrelated to
// anything the suite exists to check, and `gate (required)` red behind it.
//
// The instance was fixed by excluding `uat/**` from both bun configs. This
// audit exists because THE INSTANCE IS NOT THE CLASS: the next Playwright spec
// anyone adds, anywhere, is enrolled the same way, and nothing would say so
// until a 24-minute job went red.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY THIS IS OFFLINE AND TREE-ONLY
// ═══════════════════════════════════════════════════════════════════════════
//
// The property is decidable from the repository alone: a file that imports a
// Playwright entry point, and whose path is not covered by a
// `pathIgnorePatterns` entry in BOTH bun configs, will be collected. No network,
// no bun invocation, no runner state -- so this check's verdict is a function of
// the tree and nothing else, which is the property the hermetic tier is named
// for and the one a check about hermeticity had better have itself.
//
// WHY BOTH CONFIGS. `bunfig.hermetic.toml`'s exclusions are compared as a set
// against `bunfig.toml`'s plus a registry of environment-dependent files, by
// `environment-dependent-test-files.ts`. A Playwright spec is not a TIER split
// -- no bun lane should run it -- so it belongs in both lists, and checking
// only one would let a file be excluded from the hermetic tier while the
// ordinary `bun test` still collected it.
//
// Usage: bun src/Core.TypeScript/hygiene/audit-playwright-specs-excluded-from-bun.ts [root]
// Exit 0 clean, 1 finding(s), 2 could not run.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Entry points that mean "Playwright runs this, not bun". */
const PLAYWRIGHT_IMPORTS: readonly string[] = ["playwright/test", "@playwright/test"];

const SKIP_DIRS: ReadonlySet<string> = new Set([
  "node_modules", ".git", "bin", "obj", "artifacts", "TestResults", ".lake",
  "prior-art", "docs", "references",
]);

export interface Finding {
  readonly file: string;
  readonly missingFrom: readonly string[];
}

/** Does this source import a Playwright entry point? */
export function importsPlaywright(src: string): boolean {
  return PLAYWRIGHT_IMPORTS.some(
    (m) => src.includes(`"${m}"`) || src.includes(`'${m}'`),
  );
}

/**
 * Does a `pathIgnorePatterns` entry cover this path?
 *
 * Deliberately conservative: only the forms this repo actually writes are
 * understood — an exact path, a `dir/**` prefix, and a `**\/name` suffix. An
 * entry shaped in some other way is treated as NOT covering, which fails toward
 * reporting rather than toward silence. A clever glob matcher that guessed
 * wrong would make this check quietly permissive, which is the failure mode it
 * exists to prevent.
 */
export function coveredBy(patterns: readonly string[], relPath: string): boolean {
  const p = relPath.split(sep).join("/");
  return patterns.some((raw) => {
    const pat = raw.trim();
    if (pat === p) return true;
    if (pat.endsWith("/**")) return p.startsWith(pat.slice(0, -2));
    if (pat.startsWith("**/")) return p.endsWith(pat.slice(3)) || p.includes(`/${pat.slice(3)}`);
    return false;
  });
}

/**
 * `pathIgnorePatterns` entries from a bunfig, as written.
 *
 * COMMENTS ARE STRIPPED FIRST, and both bunfigs prove why. The first draft
 * scanned the raw text and got both possible errors at once:
 *
 *   - In `bunfig.hermetic.toml` it matched the words `pathIgnorePatterns`
 *     inside a PROSE COMMENT sixty lines above the real key, then took the next
 *     `[`/`]` it found and returned ZERO patterns — reporting `uat/**` missing
 *     from a file that contains it.
 *   - In `bunfig.toml` it returned `"a deletion wearing a split's face"` as a
 *     pattern: quoted prose from a comment INSIDE the array.
 *
 * Zero patterns is the dangerous one. It does not look like a parse failure, it
 * looks like a file that excludes nothing — so the audit would have reported a
 * confident false positive against a correctly-configured repository. Both
 * bugs were found by running this against a tree whose answer was already
 * known, which is the only reason the check is trustworthy at all.
 */
export function parseIgnorePatterns(toml: string): readonly string[] {
  const code = toml
    .split("\n")
    .filter((l) => !/^\s*#/u.test(l))
    .join("\n");
  const key = /^\s*pathIgnorePatterns\s*=\s*\[/mu.exec(code);
  if (key === null) return [];
  const open = code.indexOf("[", key.index);
  const close = code.indexOf("]", open);
  if (open < 0 || close < 0) return [];
  return [...code.slice(open + 1, close).matchAll(/"([^"]+)"/gu)].map((m) => m[1] ?? "");
}

function walk(dir: string, root: string, out: string[]): void {
  let entries: readonly { name: string; isDirectory: () => boolean }[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // an unreadable directory contributes nothing; it is not a finding
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
      walk(full, root, out);
      continue;
    }
    if (e.name.endsWith(".spec.ts") || e.name.endsWith(".spec.tsx")) out.push(relative(root, full));
  }
}

export function audit(root: string, bunfig: string, hermetic: string): readonly Finding[] {
  const base = parseIgnorePatterns(bunfig);
  const herm = parseIgnorePatterns(hermetic);
  const specs: string[] = [];
  walk(root, root, specs);

  const findings: Finding[] = [];
  for (const rel of specs) {
    let src: string;
    try {
      src = readFileSync(join(root, rel), "utf-8");
    } catch {
      continue;
    }
    if (!importsPlaywright(src)) continue;
    const missingFrom: string[] = [];
    if (!coveredBy(base, rel)) missingFrom.push("bunfig.toml");
    if (!coveredBy(herm, rel)) missingFrom.push("bunfig.hermetic.toml");
    if (missingFrom.length > 0) findings.push({ file: rel, missingFrom });
  }
  // Ordinal, never localeCompare -- collation must not vary by machine.
  return [...findings].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

export function main(argv: readonly string[]): number {
  const root = argv[0] ?? ".";
  let bunfig: string;
  let hermetic: string;
  try {
    bunfig = readFileSync(join(root, "bunfig.toml"), "utf-8");
    hermetic = readFileSync(join(root, "bunfig.hermetic.toml"), "utf-8");
  } catch (e) {
    process.stderr.write(`could not run: ${String(e)}\n`);
    return 2;
  }
  const findings = audit(root, bunfig, hermetic);
  if (findings.length === 0) {
    process.stdout.write("playwright-specs-excluded: no Playwright spec is collectable by `bun test`.\n");
    return 0;
  }
  for (const f of findings) {
    process.stdout.write(
      `  ${f.file}\n      imports a Playwright entry point but is NOT excluded from ${f.missingFrom.join(" and ")}.\n` +
      "      `bun test` collects *.spec.ts, so this file will be run by the wrong runner and fail\n" +
      "      at module load for reasons unrelated to the suite.\n",
    );
  }
  process.stdout.write(
    `\n${String(findings.length)} finding(s). Add the path (or its directory as \`dir/**\`) to pathIgnorePatterns in\n` +
    "BOTH bunfig.toml and bunfig.hermetic.toml — a Playwright spec is a wrong-runner exclusion, not a\n" +
    "tier split, so the two lists stay set-equal and no registry entry is needed.\n",
  );
  return 1;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
