#!/usr/bin/env bun
// audit-cache-key-namespace-parity.ts — one cache key FAMILY, one key EXPRESSION.
//
// THE DEFECT THIS CLOSES (measured 2026-08-26, not hypothesised).
//   `gate.yml` caches NuGet under
//       nuget-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('Directory.Packages.props') }}
//   while `low-memory.yml` and `codeql.yml` used
//       nuget-${{ runner.os }}-${{ hashFiles('Directory.Packages.props') }}
//   — the same content, the same hash inputs, under TWO KEY NAMESPACES that can
//   never restore each other. Same split on `elan`. Both halves were measured:
//
//     * the itemised `actions/caches` endpoint held the SAME
//       `Directory.Packages.props` digest twice — `nuget-Linux-c922cac0…` (357 MB)
//       and `nuget-Linux-ARM64-c922cac0…` (358 MB). Charged twice, ~3.7% of a
//       ~9.31 GiB ceiling, for one dependency set.
//     * the slim lane's own restore logs across 7 consecutive `main` runs:
//       `nuget-Linux-<hash>` missed 5 of 7, `elan-Linux-<hash>` missed 5 of 7,
//       while gate.yml's copies sat in the cache under the arch-qualified key
//       the whole time.
//
//   A save whose restore key never matches is a save that does nothing: it looks
//   like a working cache, costs a full upload every run, and is never read. That
//   is the vacuity class wearing a green checkmark, which is the shape this repo
//   has been bitten by repeatedly.
//
// WHY A CHECK AND NOT A COMMENT. The convention was ALREADY WRITTEN DOWN, twice,
// and still drifted:
//   * gate.yml: "Cache keys include `runner.arch` … so Linux x64 (ubuntu-24.04,
//     ubuntu-slim) and Linux arm64 (ubuntu-24.04-arm) do not share entries" —
//     it names `ubuntu-slim`, the lane that was violating it.
//   * codeql.yml: "Keys on Directory.Packages.props - same as gate.yml" — a
//     comment asserting a parity the code did not have.
//   * lean-proof.yml got it RIGHT ("Same key shape as gate.yml's elan cache so
//     the two workflows share cache space efficiently"), which proves the
//     convention was understood and simply not enforced.
//   Prose rots; a check does not.
//
// WHAT IT CHECKS. Group every `actions/cache*` key by its FAMILY — the literal
// (non-`${{ }}`) text of the key, which is the part that carves the namespace.
// Within a family, every occurrence must use the IDENTICAL key expression.
//
//   nuget-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles(…) }}  ─┐ family "nuget"
//   nuget-${{ runner.os }}-${{ hashFiles(…) }}                     ─┘ DIFFERENT expr → VIOLATION
//
//   install-${{ … }}-${{ … }}-base-${{ … }}   family "install|base"  ─┐ different
//   install-${{ … }}-${{ … }}-full-${{ … }}   family "install|full"  ─┘ families, both fine
//
// NOT "every key must contain runner.arch". That proxy would flag `lake-…` in
// lean-proof.yml, which is used in exactly ONE workflow and therefore cannot
// disagree with anything — forcing either a pointless cold rebuild of the
// Mathlib olean cache or a hand-written allowlist that drifts from the code.
// This audit needs NO allowlist: a single-use family is consistent by
// construction, and consistency is the property that actually matters.
//
// Exit 0 = every family uses one expression · 1 = lists the divergent families
//        · 2 = the scan itself failed (missing dir, or implausibly few keys).

import { readdirSync, readFileSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join } from "node:path";

const WORKFLOW_DIRS = [".github/workflows", ".github/actions"] as const;

// Scan floor — a check that inspects nothing passes vacuously. The repo had 39
// cache keys across 21 workflows when this was written; refuse to report success
// on a scan that found implausibly few. This is the guard that stops a future
// refactor of the parser from turning the audit green by finding nothing.
export const MIN_KEYS_EXPECTED = 25;

// The placeholder `familyOf` substitutes for each `${{ ... }}` before splitting.
// Written as an explicit escape, never as a literal control byte in source: NUL is
// invisible in a diff and turns the file "binary" to grep/sed. Any character that
// cannot occur in a GitHub Actions cache key works; NUL is the safest such value.
const EXPR_SENTINEL = "\u0000";

export interface CacheKey {
  readonly file: string;
  readonly line: number;
  /** The raw `key:` value, verbatim. */
  readonly key: string;
  /** Whitespace inside `${{ … }}` collapsed, so formatting is not a difference. */
  readonly normalized: string;
  /** The literal (non-expression) text — the part that carves the namespace. */
  readonly family: string;
}

/** `${{  runner.os  }}` and `${{ runner.os }}` are the same expression. */
export function normalizeKey(key: string): string {
  return key
    .replace(/\$\{\{([\s\S]*?)\}\}/g, (_m, inner: string) => `\${{ ${inner.trim().replace(/\s+/g, " ")} }}`)
    .trim();
}

/**
 * The namespace a key carves, which is exactly its LITERAL segments: everything
 * outside `${{ … }}`. Two keys whose literals match are competing to name the
 * same cache; two keys whose literals differ are deliberately separate caches.
 */
export function familyOf(key: string): string {
  return normalizeKey(key)
    .replace(/\$\{\{[\s\S]*?\}\}/g, EXPR_SENTINEL)
    .split(EXPR_SENTINEL)
    .map((seg) => seg.replace(/-+/g, "-").replace(/^-|-$/g, "").trim())
    .filter((seg) => seg.length > 0)
    .join("|");
}

function listYamlFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: Dirent[];
  try {
    // `withFileTypes` so the entry KIND arrives with the listing. Calling
    // `statSync` per name would ask the filesystem a second time about something
    // the listing already knew, and an entry can vanish or change kind in
    // between -- the check-then-use race `lint-check-then-use-file-races.ts`
    // refuses. Sorted ORDINALLY (never `localeCompare`, which is culture-
    // sensitive) so the report order is byte-stable across machines.
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  const ordered = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of ordered) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listYamlFiles(full));
      continue;
    }
    if (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")) out.push(full);
  }
  return out;
}

/**
 * Every `key:` under a cache step. Deliberately textual rather than a YAML parse:
 * the value must be compared VERBATIM (a YAML loader would happily normalise the
 * very whitespace and quoting differences that distinguish two key expressions),
 * and `restore-keys:` blocks must not be swept in as keys.
 */
export function scanCacheKeys(dirs: readonly string[]): CacheKey[] {
  const keys: CacheKey[] = [];
  for (const dir of dirs) {
    for (const file of listYamlFiles(dir)) {
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i] ?? "";
        // `key: <value>` as a mapping entry. Excludes `restore-keys:` (different
        // key name) and any `- key:` list item.
        const m = raw.match(/^\s{2,}key:\s*(\S.*?)\s*$/);
        if (m === null) continue;
        const value = (m[1] ?? "").replace(/\s+#.*$/, "").trim();
        if (value.length === 0) continue;
        // A key that is ONE bare expression carves no namespace of its own (it is
        // whatever the action computes, e.g. setup-bun's). Nothing to compare.
        if (familyOf(value).length === 0) continue;
        keys.push({
          file,
          line: i + 1,
          key: value,
          normalized: normalizeKey(value),
          family: familyOf(value),
        });
      }
    }
  }
  return keys;
}

export interface FamilyViolation {
  readonly family: string;
  readonly variants: readonly { readonly normalized: string; readonly sites: readonly string[] }[];
}

export function findViolations(keys: readonly CacheKey[]): FamilyViolation[] {
  const byFamily = new Map<string, CacheKey[]>();
  for (const k of keys) {
    const list = byFamily.get(k.family);
    if (list === undefined) byFamily.set(k.family, [k]);
    else list.push(k);
  }
  const out: FamilyViolation[] = [];
  for (const [family, group] of [...byFamily.entries()].sort()) {
    const byExpr = new Map<string, string[]>();
    for (const k of group) {
      const sites = byExpr.get(k.normalized);
      const site = `${k.file}:${k.line}`;
      if (sites === undefined) byExpr.set(k.normalized, [site]);
      else sites.push(site);
    }
    if (byExpr.size < 2) continue;
    out.push({
      family,
      variants: [...byExpr.entries()].map(([normalized, sites]) => ({ normalized, sites })),
    });
  }
  return out;
}

function main(): number {
  const keys = scanCacheKeys(WORKFLOW_DIRS);
  if (keys.length < MIN_KEYS_EXPECTED) {
    process.stderr.write(
      `audit-cache-key-namespace-parity: SCAN FLOOR NOT MET — found ${keys.length} cache keys, expected >= ${MIN_KEYS_EXPECTED}.\n` +
        `This is reported as a FAILURE, not a pass: a scan that finds nothing proves nothing.\n` +
        `Either the workflow directories moved, or the parser stopped matching. Fix the scan, not the floor.\n`,
    );
    return 2;
  }

  const violations = findViolations(keys);
  if (violations.length === 0) {
    process.stdout.write(
      `audit-cache-key-namespace-parity: OK — ${keys.length} cache keys, ` +
        `${new Set(keys.map((k) => k.family)).size} families, every family on one key expression.\n`,
    );
    return 0;
  }

  process.stderr.write(
    `audit-cache-key-namespace-parity: ${violations.length} cache key FAMILY(IES) split across more than one key expression.\n\n`,
  );
  for (const v of violations) {
    process.stderr.write(`FAMILY "${v.family}" — ${v.variants.length} competing key expressions:\n`);
    for (const variant of v.variants) {
      process.stderr.write(`    ${variant.normalized}\n`);
      for (const site of variant.sites) process.stderr.write(`        at ${site}\n`);
    }
    process.stderr.write("\n");
  }
  process.stderr.write(
    "Why this is a bug: two key expressions sharing one literal prefix are two\n" +
      "NAMESPACES for the same cache. Neither can restore what the other saved, so the\n" +
      "content is stored twice against the repo ceiling and every lane pays a full\n" +
      "upload for an entry no other lane will ever read. A save whose restore key never\n" +
      "matches is a save that does nothing.\n\n" +
      "How to fix: make every occurrence of the family use the SAME key expression —\n" +
      "normally the one the lane that genuinely maintains the cache already uses. If a\n" +
      "second lane then becomes a co-writer of a key it should not write (a reduced-tier\n" +
      "runner writing a SUBSET over a full-tier superset), make that lane restore-only\n" +
      "with `actions/cache/restore` rather than giving it a private namespace.\n\n" +
      "If two caches are genuinely meant to be separate, say so IN THE LITERAL TEXT of\n" +
      "the key (`install-…-base-` vs `install-…-full-`), which is what makes them\n" +
      "different families here and is legible to a reader of the key alone.\n",
  );
  return 1;
}

if (import.meta.main) process.exit(main());
