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
 *   ADJUDICATION  an annotation claiming a ref is dangling-and-accounted-for
 *                 that does not hold up: missing/self-cited evidence, a
 *                 disposition outside the vocabulary, an annotation not on the
 *                 line it excuses, or one that is STALE because the id now
 *                 resolves.
 *
 * That third class is the 2026-08-16 correction. A document whose SUBJECT is a
 * set of dangling ids — `docs/research/2026-08-15-the-archive-tag-corpus-…md`
 * is one — could satisfy neither remedy this gate offered: there is no row to
 * cite (that IS the finding) and dropping the ids would delete the audit to
 * turn a linter green. The gate's four facts about that file were all correct;
 * only its verdict was wrong. So a mention may carry its own disposition, and the
 * disposition is checked rather than trusted. Full derivation and the five
 * conditions: `b-ref-resolve.ts`, "The fourth rung".
 *
 * Usage:
 *   bun src/Core.TypeScript/backlog/lint-b-refs-resolve.ts
 *   bun src/Core.TypeScript/backlog/lint-b-refs-resolve.ts --report
 *
 * Exit: 0 = every ref resolves and none sits in a key position · 1 = otherwise.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { SKIP_DIR_NAMES, SCAN_EXTENSIONS, shouldSkipDir } from "./b-ref-scope";
import {
  B_ID_RE,
  buildIndex,
  resolveBRef,
  isRowFile,
  frontmatterOf,
  parseAdjudications,
  checkAdjudication,
  type Adjudication,
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
  const adjudicated: { file: string; ref: string; disposition: string; evidence: string }[] = [];

  /**
   * Does `relPath` name something in this tree?
   *
   * `statSync` is check-then-act only when a read follows it. Here the
   * existence IS the assertion under test — an adjudication claiming evidence
   * at a path that is not there is a violation whatever the file contains — so
   * there is nothing to race with.
   */
  function evidenceExists(relPath: string): boolean {
    try {
      statSync(join(root, relPath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Adjudication outcome for one ref: `null` when the file declares none (the
   * ordinary case), otherwise the check's verdict.
   */
  function adjudicate(
    ref: string,
    relFile: string,
    declared: readonly Adjudication[],
    res: BRefResolution,
  ): { ok: true; disposition: string; evidence: string } | { ok: false; reason: string } | null {
    const mine = declared.filter((a) => a.bId === ref.toUpperCase());
    if (mine.length === 0) return null;
    let firstFailure = "";
    for (const adj of mine) {
      const verdict = checkAdjudication(ref, relFile, adj, res, evidenceExists);
      if (verdict.ok) return { ok: true, disposition: verdict.disposition, evidence: verdict.evidence };
      if (firstFailure.length === 0) firstFailure = verdict.reason;
    }
    return { ok: false, reason: firstFailure };
  }

  /** Judge every distinct legacy ref in one authored file. */
  function judgeFile(relFile: string, text: string): void {
    const refs = [...new Set(text.match(B_ID_RE) ?? [])];
    if (refs.length === 0) return;

    const frontmatter = isRowFile(relFile) ? frontmatterOf(text) : "";
    const declared = parseAdjudications(text);

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
      const verdict = adjudicate(ref, relFile, declared, res);

      // No annotation: the ordinary ladder decides, unchanged.
      if (verdict === null) {
        if (res.kind === "unresolved") violations.push({ file: relFile, ref, reason: describe(res) });
        else resolved.push({ file: relFile, ref, where: describe(res) });
        continue;
      }

      // Annotated: the annotation must earn its escape. A failed check is a
      // violation even when the id resolves — a false disposition recorded in a
      // document is drift of exactly the kind this gate exists to report.
      if (verdict.ok) {
        adjudicated.push({
          file: relFile,
          ref,
          disposition: verdict.disposition,
          evidence: verdict.evidence,
        });
      } else {
        violations.push({ file: relFile, ref, reason: verdict.reason });
      }
    }
  }

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
      judgeFile(full.slice(root.length + 1), text);
    }
  }

  walk(root);

  if (report) {
    console.log(
      `index: ${index.aliases.size} alias entries · ${index.liveRows.size} live rows · ${index.archived.size} archived ids`,
    );
    for (const r of resolved) console.log(`  ok  ${r.file}: ${r.ref} → ${r.where}`);
    for (const a of adjudicated) {
      console.log(`  adj ${a.file}: ${a.ref} → ${a.disposition}, evidence ${a.evidence}`);
    }
  }

  if (violations.length === 0) {
    const tail =
      adjudicated.length === 0
        ? ""
        : ` · ${adjudicated.length} adjudicated as dangling with checked evidence`;
    console.log(
      `ok: ${resolved.length} legacy B-NNNN reference(s) on authored surfaces, all resolving${tail}`,
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
      "  · REPORTING that an id is dangling (an audit) is the third case: annotate the\n" +
      "    mention on its own line with the disposition and a path that backs it —\n" +
      "      <!-- b-ref-adjudicated: B-0282 landed-as-code src/…/autonomous-pickup.ts -->\n" +
      "    dispositions: landed-as-code · superseded · abandoned · never-a-row.\n" +
      "    The evidence path must exist, may not be the annotating file, and the id must\n" +
      "    genuinely not resolve — a resolving id with an annotation fails as STALE.\n" +
      "Inspect what does resolve: bun src/Core.TypeScript/backlog/lint-b-refs-resolve.ts --report\n",
  );
  return 1;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
