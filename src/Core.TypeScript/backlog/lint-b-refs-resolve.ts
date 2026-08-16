#!/usr/bin/env bun
/**
 * lint-b-refs-resolve.ts — every legacy `B-NNNN` reference on an authored
 * surface must RESOLVE to something a reader can open.
 *
 * Replaces `lint-no-b-refs.ts`, which banned the reference outright. The ban
 * was vacuous by construction: forbidding the mention means a *stale* mention
 * can never exist, so the check could never fire on rot — it achieved
 * compliance by eliminating its own subject. Its one observable effect was
 * authors bending prose (writing `B0747` hyphenless) to get past it.
 *
 * Aaron 2026-08-15: *"if the gate is too restrictive I'd rather change it and
 * do better drift checks."*
 *
 * Two failure classes, both real:
 *
 *   DANGLING      the ref resolves to nothing — no live row, no archive
 *                 artifact. A typo, a fabricated id, or a target that was
 *                 deleted out from under the reference. The ban could see
 *                 none of these.
 *   KEY POSITION  a legacy id inside a work-item row's FRONTMATTER. Naming a
 *                 closed-series id in prose is lineage; using it as `id:` /
 *                 `depends_on:` is minting with it. Still forbidden — this
 *                 gate loosens references, never keys.
 *
 * Usage:
 *   bun src/Core.TypeScript/backlog/lint-b-refs-resolve.ts
 *   bun src/Core.TypeScript/backlog/lint-b-refs-resolve.ts --report
 *
 * Exit: 0 = every ref resolves and none sits in a key position · 1 = otherwise.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { SKIP_DIR_NAMES, SCAN_EXTENSIONS, shouldSkipDir } from "./b-ref-scope";
import {
  B_ID_RE,
  buildIndex,
  resolveBRef,
  isRowFile,
  frontmatterOf,
  type BRefIndex,
  type BRefResolution,
} from "./b-ref-resolve";

/**
 * Files that carry legacy ids as DATA rather than as references: the alias
 * maps, the tools that read/write them, and the tests that plant a legacy id
 * as a fixture (a falsifiability harness must be able to write a dangling id).
 */
const ALLOWED_FILES = new Set([
  "b-to-zetaid-map.json",
  "b-id-renumber-aliases.json",
  "rebuild-legacy-b-id-aliases.ts",
  "legacy-b-id-zetaid.ts",
  "b-ref-scope.ts",
  "b-ref-resolve.ts",
  "b-ref-resolve.test.ts",
  "lint-b-refs-resolve.ts",
  "lint-b-refs-resolve.test.ts",
  "lint-no-new-bnnnn.ts",
]);

interface Violation {
  readonly file: string;
  readonly ref: string;
  readonly reason: string;
}

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : process.cwd();
}

function describe(res: BRefResolution): string {
  switch (res.kind) {
    case "live":
      return `live row ${res.path}`;
    case "archive":
      return `archive ${res.path}`;
    default:
      return res.zetaId === null
        ? "DANGLING — no alias-map entry and no archive artifact; this id names nothing"
        : `DANGLING — maps to ${res.zetaId}, which names no row in tree and has no archive artifact`;
  }
}

function main(argv: readonly string[]): number {
  const report = argv.includes("--report");
  const root = repoRoot();
  const index: BRefIndex = buildIndex(root);

  const violations: Violation[] = [];
  const resolved: { file: string; ref: string; where: string }[] = [];

  /**
   * Entry kind comes from the directory read (`withFileTypes`), so there is no
   * per-entry `statSync` to race against, and the file read is itself the check
   * (`js/file-system-race` — a stat-then-read guard proves nothing, because the
   * file can vanish in between). Symlinks are skipped: `universal/*.md` points
   * into `db/shapes/`, which the walk already visits directly, and
   * `tests/…/link_to_parent → ..` is a cycle a symlink-following walk recursed
   * into until PATH_MAX stopped it.
   */
  function walk(dir: string) {
    const rel = dir.slice(root.length + 1);
    if (shouldSkipDir(rel)) return;

    let entries: readonly import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const dirent of entries) {
      const entry = dirent.name;
      if (SKIP_DIR_NAMES.has(entry)) continue;
      const full = join(dir, entry);
      if (dirent.isDirectory()) {
        walk(full);
        continue;
      }
      if (!dirent.isFile()) continue;
      if (!SCAN_EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) continue;
      if (ALLOWED_FILES.has(entry)) continue;

      let text: string;
      try {
        text = readFileSync(full, "utf8");
      } catch {
        continue;
      }
      const refs = [...new Set(text.match(B_ID_RE) ?? [])];
      if (refs.length === 0) continue;

      const relFile = full.slice(root.length + 1);
      const frontmatter = isRowFile(relFile) ? frontmatterOf(text) : "";

      for (const ref of refs) {
        if (frontmatter.length > 0 && frontmatter.includes(ref)) {
          violations.push({
            file: relFile,
            ref,
            reason:
              "KEY POSITION — a closed-series id in row frontmatter is minting with it, not referencing it",
          });
          continue;
        }
        const res = resolveBRef(ref, index);
        if (res.kind === "unresolved") {
          violations.push({ file: relFile, ref, reason: describe(res) });
        } else {
          resolved.push({ file: relFile, ref, where: describe(res) });
        }
      }
    }
  }

  walk(root);

  if (report) {
    console.log(
      `index: ${index.aliases.size} alias entries · ${index.liveRows.size} live rows · ${index.archived.size} archived ids`,
    );
    for (const r of resolved) console.log(`  ok  ${r.file}: ${r.ref} → ${r.where}`);
  }

  if (violations.length === 0) {
    console.log(
      `ok: ${resolved.length} legacy B-NNNN reference(s) on authored surfaces, all resolving`,
    );
    return 0;
  }

  console.error(`FAIL: ${violations.length} legacy B-NNNN reference(s) do not hold up\n`);
  for (const v of violations.slice(0, 40)) {
    console.error(`  ${v.file}: ${v.ref} — ${v.reason}`);
  }
  if (violations.length > 40) console.error(`  … and ${violations.length - 40} more`);
  console.error(
    "\nA legacy id may be NAMED in prose — it must point at something real.\n" +
      "  · dangling: cite the ZetaId of the row that carries the work, or drop the id.\n" +
      "  · key position: mint a ZetaId (src/Core.TypeScript/backlog/new-workitem.ts).\n" +
      "Inspect what does resolve: bun src/Core.TypeScript/backlog/lint-b-refs-resolve.ts --report\n",
  );
  return 1;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
