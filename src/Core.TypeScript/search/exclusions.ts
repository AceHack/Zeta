#!/usr/bin/env bun
// src/Core.TypeScript/search/exclusions.ts — the ONE place the repo says which
// trees a search must not walk, and the renderer that projects that list into
// the `.ignore` file external tools read.
//
// WHY THIS FILE EXISTS (the measured failure, 2026-08-22):
// `CLAUDE.md` has carried "references/prior-art — explicit-target searches ONLY;
// a naive `grep -r .` is a 2-hour runaway" in EVERY agent's startup context for
// months. An agent read it, then opened its investigation with an unconstrained
// `grep -rn ... .` from the repo root; two jobs ran over an hour and burned host
// I/O. The rule was written, correct, and resident — and it still failed, because
// prose is not a mechanism. A constraint that only exists as text is a constraint
// that did not run (the vacuity class, applied to guidance instead of to tests).
//
// TWO THINGS THIS FILE FIXES THAT THE PROSE GOT WRONG
//
// 1. THE NAMED DIRECTORY IS NOT THE HEAVY ONE — measured, not inferred.
//    On the operator's machine 2026-08-22, `references/prior-art` is 8.0K: a
//    `.gitignore` and a `README.md`, nothing mirrored into it. The 24G shared
//    checkout is `src/Core.Lean4/.lake` (6.9G), `.git` (4.1G), the
//    `src/Core.Rust.*/target` dirs (~700M), `node_modules` (222M). An exclusion
//    set that named only `prior-art` would have prevented NOTHING today. So this
//    list is maintained by measurement, and `HEAVY_TREES` carries the measured
//    size beside each entry so a future reader can check it rather than trust it.
//
// 2. THE COST IS PER-FILE-OPEN, NOT PER-BYTE AND NOT PER-DIRECTORY.
//    Measured on the same host: `rg --files` walks 40,984 files in 0.33s
//    (metadata only, no opens), while `rg -c <pattern>` over the same tree had
//    not finished at 180s — 0.53s user, 3% CPU, i.e. blocked on I/O, not
//    computing. `ps` showed Microsoft Defender's on-access scanner at 464% CPU
//    and a load average of 36.6: every file OPEN is being scanned. That is why
//    the guard in `search.ts` budgets the number of files it will open, and why
//    it can do so cheaply — the walk that counts them is ~1000x cheaper than the
//    reads it is deciding whether to perform.
//
// Consumed by:
//   - `search.ts`      — the guarded CLI (fail-closed scope budget)
//   - `grep.ts`        — the older literal-substring wrapper, re-exports from here
//   - `.ignore`        — rendered by `renderIgnoreFile()`, checked by the test
//
// Regenerate `.ignore` after editing this file:
//   bun src/Core.TypeScript/search/exclusions.ts --write-ignore

import { readFileSync, writeFileSync } from "node:fs";
import { relative, sep } from "node:path";

/** A tree excluded from default search scope, with the evidence for why. */
export interface HeavyTree {
  /** Repo-relative POSIX path, or a glob for the `.ignore` file. */
  readonly path: string;
  /** Measured size on the operator's shared checkout, with the date measured. */
  readonly measured: string;
  /** Why it is not our source. */
  readonly why: string;
}

/**
 * Repo-relative trees skipped by default. ORDER IS LOAD-BEARING for the rendered
 * `.ignore` (the file is byte-compared against this list by the test), so append
 * rather than reshuffle.
 *
 * Every entry carries a MEASUREMENT, not a guess. If you add one without
 * measuring it you have added folklore, which is what this file exists to end.
 */
export const HEAVY_TREES: readonly HeavyTree[] = [
  {
    path: "references/prior-art",
    measured: "8.0K on 2026-08-22 (EMPTY — .gitignore + README only)",
    why:
      "mirror of OTHER repos, not our code. Currently empty on this machine; " +
      "kept because the convention is repo-wide and it refills on demand.",
  },
  {
    path: "src/Core.Lean4/.lake",
    measured: "6.9G on 2026-08-22 — the single largest tree in the checkout",
    why: "Lean 4 + Mathlib build cache. Regeneratable by `lake build`; not source.",
  },
  {
    path: "src/Core.Rust.*/target",
    measured: "~700M on 2026-08-22 (240M Algebra, 157M DynamicValue, 83M Durability, ...)",
    why: "cargo build outputs across the Rust crates. Regeneratable; not source.",
  },
];

/**
 * Directory BASENAMES pruned anywhere in the walk. These are the names that are
 * build output or vendored dependency wherever they appear, so a path-prefix
 * rule would have to enumerate every crate/project to catch them.
 */
export const EXCLUDE_BASENAMES: ReadonlySet<string> = new Set([
  ".git",
  "node_modules",
  "bin",
  "obj",
  "target",
  ".playwright-mcp",
  "db/drop",
  // .NET / Lean / benchmark build outputs (regeneratable; not source).
  "artifacts",
  "TestResults",
  "BenchmarkDotNet.Artifacts",
  ".lake",
]);

/** Repo-relative POSIX prefixes skipped wholesale (the non-glob HEAVY_TREES). */
export const EXCLUDE_RELPATHS: readonly string[] = HEAVY_TREES.map((t) => t.path).filter(
  (p) => !p.includes("*"),
);

/** Header the rendered `.ignore` carries, so a human opening it finds the source. */
export const IGNORE_HEADER = [
  "# .ignore — GENERATED. Do not hand-edit.",
  "#",
  "# Source of truth: src/Core.TypeScript/search/exclusions.ts",
  "# Regenerate:      bun src/Core.TypeScript/search/exclusions.ts --write-ignore",
  "# Checked by:      src/Core.TypeScript/search/exclusions.test.ts (drift fails CI)",
  "#",
  "# ripgrep, fd, and rga honour this file, so a BARE `rg foo` is safe here for",
  "# free — no flag to remember, no rule to have read.",
  "#",
  "# HONEST LIMIT, and it is the whole reason a CLI exists beside this file:",
  "# `grep -r` honours NONE of this. POSIX grep has no ignore-file concept, so the",
  "# exact tool that caused the 2026-08-22 runaway is untouched by this file. You",
  "# can make SOME external tools carry a constraint; you can never make all of",
  "# them. That asymmetry is the argument for the dogfooded tool, not against it.",
  "# Safe path that IS enforced:  bun src/Core.TypeScript/search/search.ts <pattern>",
  "",
];

/** Render the `.ignore` file content from HEAVY_TREES. Pure — testable. */
export function renderIgnoreFile(trees: readonly HeavyTree[] = HEAVY_TREES): string {
  const lines = [...IGNORE_HEADER];
  for (const t of trees) {
    lines.push(`# ${t.measured}`);
    lines.push(`# ${t.why}`);
    lines.push(`${t.path}/`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Normalise an absolute path to a repo-relative POSIX path. */
export function relPosix(root: string, abs: string): string {
  return relative(root, abs).split(sep).join("/");
}

/**
 * True if `relPath` (repo-relative POSIX) lies inside an excluded tree.
 * Handles the `src/Core.Rust.<crate>/target` glob shape as well as plain prefixes.
 *
 * Returns the MATCHING RULE, not just a boolean, because every refusal in
 * `search.ts` must be able to name the rule that produced it. A guard that
 * cannot say why it refused gets switched off, and a switched-off guard is
 * worse than none.
 */
export function matchExcludedTree(relPath: string): HeavyTree | null {
  for (const t of HEAVY_TREES) {
    if (t.path.includes("*")) {
      const rx = new RegExp("^" + t.path.split("*").map(escapeRe).join("[^/]*") + "(/|$)");
      if (rx.test(relPath)) return t;
    } else if (relPath === t.path || relPath.startsWith(t.path + "/")) {
      return t;
    }
  }
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if a directory basename is pruned anywhere in the tree. */
export function isExcludedBasename(base: string): boolean {
  return EXCLUDE_BASENAMES.has(base);
}

export function main(argv: string[]): number {
  if (argv.includes("--write-ignore")) {
    writeFileSync(".ignore", renderIgnoreFile(), "utf8");
    console.log("wrote .ignore from HEAVY_TREES");
    return 0;
  }
  if (argv.includes("--check-ignore")) {
    let actual: string;
    try {
      actual = readFileSync(".ignore", "utf8");
    } catch {
      console.error(".ignore is missing — run with --write-ignore");
      return 1;
    }
    if (actual !== renderIgnoreFile()) {
      console.error(".ignore has DRIFTED from exclusions.ts — run with --write-ignore");
      return 1;
    }
    console.log(".ignore agrees with exclusions.ts");
    return 0;
  }
  console.log(renderIgnoreFile());
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
