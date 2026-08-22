#!/usr/bin/env bun
// lint-clone-at-tag-is-sufficient.ts — `ace` may be the good path; never the only one.
//
// THE INVARIANT (manifesto §1, stated for repo topology):
//
//   `git clone` at a pinned tag must remain SUFFICIENT to build and check a repo,
//   forever -- never merely transitional.
//
// WHY IT IS A LINT AND NOT A PARAGRAPH. The 2026-04-22 three-repo ADR says the
// version-pin glue is "replaced by `ace pull forge@<version>`". If that lands, `ace`
// becomes the only path by which repos resolve each other -- and per
// `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` the discriminator
// is EXIT, not degree:
//
//   * Can a consumer resolve without it?  -> `ace` is an ORACLE. Deference chosen,
//     however popular it becomes. Fine, and good.
//   * Must a consumer route through it?   -> `ace` is a HUB in the strict sense,
//     and "we wrote it ourselves" is no comfort. Hirschman: where exit is absent,
//     the concentration holds you.
//
// A dependency-driven repo split makes the mistake MORE tempting, not less: the
// whole argument for splitting on dependency closure is that resolution should be
// subset-aware, and the obvious next thought is "so let `ace` resolve the subsets."
// That is precisely how a good tool becomes a mandatory one. The guard costs nothing
// while `ace` is optional and cannot be retrofitted once the fleet depends on it.
//
// WHAT THIS CHECKS. `ace` must not appear as a PREREQUISITE in any bootstrap or
// provisioning path -- the places a fresh `git clone` has to execute before it can
// build. Using, testing, or publishing `ace` is untouched; only *depending on it to
// get the tree buildable* is refused.
//
// This is a proxy, and the honest limit is stated rather than hidden: the real
// falsifier is "clone repo X at tag T with no ace on PATH and build it", which
// cannot run until a second repo exists. Until then the reachable check is that no
// bootstrap surface acquires the dependency. When the split lands, this file is
// where the real cross-repo build test replaces the proxy.
//
// Usage:  bun src/Core.TypeScript/hygiene/lint-clone-at-tag-is-sufficient.ts
// Exit:   0 = clone-at-tag still sufficient; 1 = a bootstrap path now needs `ace`.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export type Violation = { readonly file: string; readonly line: number; readonly text: string };

/**
 * Surfaces a fresh clone must be able to run BEFORE anything is built.
 *
 * Deliberately narrow. A wide net here would flag `ace`'s own suite and the CI step
 * that tests it, which are not dependencies -- and a lint that cries wolf is one
 * somebody disables.
 */
export const BOOTSTRAP_SURFACES: readonly string[] = [
  "tools/setup",
  ".github/workflows",
  "Directory.Build.props",
  "Directory.Packages.props",
  "global.json",
  "flake.nix",
  // A cloud-agent environment provisions a fresh clone before anything is built, which
  // makes it a bootstrap surface by definition. It is listed here because the list
  // PRE-DATES it: `.cursor/` held only prompts and an MCP config when this lint was
  // written, and the omission was therefore an accident rather than a decision. The
  // newest provisioning path is exactly where `ace` could quietly become mandatory
  // without any older surface changing -- so it is enumerated before that can happen,
  // not after. A surface that does not exist yet costs nothing: `walk` returns [] for a
  // missing path (see `existsSync` below), so an absent `.cursor` neither fires nor
  // silences the lint.
  ".cursor",
];

/**
 * `ace` invoked as a RESOLVER: fetching, installing, or pinning a dependency.
 *
 * `bun test src/Core.TypeScript/ace/` and `bun .../ace-cli.ts --help` are not
 * resolution and must not match, so the verbs are enumerated rather than matching
 * the bare word.
 */
export const RESOLVER_INVOCATION =
  /\bace\s+(pull|install|restore|resolve|fetch|sync|add|bootstrap)\b|\bace\.toml\b/u;

/** Lines that are comments in yml/sh/ts — prose about the rule is not a violation. */
function isComment(line: string): boolean {
  return /^\s*(#|\/\/|\*|<!--)/u.test(line);
}

export function scanText(file: string, text: string): readonly Violation[] {
  const out: Violation[] = [];
  text.split("\n").forEach((line, i) => {
    if (isComment(line)) return;
    if (RESOLVER_INVOCATION.test(line)) out.push({ file, line: i + 1, text: line.trim() });
  });
  return out;
}

function walk(p: string, acc: string[] = []): string[] {
  if (!existsSync(p)) return acc;
  if (statSync(p).isFile()) { acc.push(p); return acc; }
  for (const e of readdirSync(p)) {
    if (e === "node_modules" || e.startsWith(".git")) continue;
    walk(join(p, e), acc);
  }
  return acc;
}

export function scanSurfaces(
  surfaces: readonly string[] = BOOTSTRAP_SURFACES,
  read: (p: string) => string = (p) => readFileSync(p, "utf-8"),
): readonly Violation[] {
  const out: Violation[] = [];
  for (const s of surfaces) {
    for (const f of walk(s)) {
      if (!/\.(ya?ml|sh|ps1|ts|json|props|nix)$/u.test(f)) continue;
      out.push(...scanText(f, read(f)));
    }
  }
  return out;
}

function main(): number {
  const found = scanSurfaces();
  const scanned = BOOTSTRAP_SURFACES.filter((s) => existsSync(s));
  if (scanned.length === 0) {
    console.error("lint-clone-at-tag-is-sufficient: no bootstrap surface found — run from the repo root.");
    return 2;
  }
  if (found.length === 0) {
    console.log(
      `clone-at-tag: OK — no bootstrap surface requires \`ace\` to resolve dependencies ` +
      `(${String(scanned.length)} surface(s) scanned). \`git clone\` at a pinned tag is still sufficient.`,
    );
    return 0;
  }
  console.error(`clone-at-tag: ${String(found.length)} bootstrap path(s) now require \`ace\` to resolve:`);
  for (const v of found) console.error(`  ${v.file}:${String(v.line)}  ${v.text}`);
  console.error(
    "\n`ace` may be the good path; it may never be the ONLY path. A repo that cannot be\n" +
    "built from `git clone` at a tag has made `ace` an APPOINTED HUB (manifesto §1;\n" +
    ".claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md — the discriminator\n" +
    "is exit, not degree). Keep a plain-git resolution path alongside whatever `ace` adds.",
  );
  return 1;
}

if (import.meta.main) process.exit(main());
