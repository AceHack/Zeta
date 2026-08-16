#!/usr/bin/env bun
/**
 * rebuild-legacy-b-id-aliases.ts — rebuild the frozen B-NNNN → ZetaId alias map, then
 * replace every remaining legacy reference in the repo.
 *
 * Sources (priority order):
 *   1. Existing b-to-zetaid-map.json
 *   2. Git rename commits (B-<slug>.md → <zetaid>-<slug>.md)
 *   3. Pre-migration backlog frontmatter (id + zetaid pairs)
 *   4. Manual renumber aliases (b-id-renumber-aliases.json)
 *   5. Git history: first `id: B-NNNN` file with zetaid or zetaid filename
 *   6. Deterministic legacyZetaIdFromBId for never-merged rows
 *   7. Sub-item inheritance (B-0620.4 → B-0620)
 *
 * Usage:
 *   bun src/Core.TypeScript/backlog/rebuild-legacy-b-id-aliases.ts            # dry run (default)
 *   bun src/Core.TypeScript/backlog/rebuild-legacy-b-id-aliases.ts --write    # rewrite ~1,700 files
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { legacyZetaIdFromBId, parentBId, timestampForLegacyBId } from "./legacy-b-id-zetaid";
import { SKIP_DIR_NAMES, shouldSkipDir } from "./b-ref-scope";

const USAGE = `rebuild-legacy-b-id-aliases.ts — rebuild the B-NNNN → ZetaId alias map and rewrite stragglers.

  --write      APPLY the rewrite (writes the alias map and edits files in place)
  --dry-run    report only; the DEFAULT, accepted for explicitness
  --verbose    print alias conflicts and residual B-ids
  --help, -h   this text

Writing is opted INTO by name. Absence of a flag is never a write run.`;

/**
 * Argument parsing — FAIL CLOSED, and the destructive mode must be NAMED.
 *
 * Two properties, and the second is the load-bearing one:
 *
 *   1. An unrecognised argument is an error: print, exit 2, BEFORE any filesystem
 *      write. This tool previously derived intent from flag ABSENCE
 *      (`DRY_RUN = argv.includes("--dry-run")`), so `--help` — which it did not
 *      have — was read as "go" and began a full ~1,700-file rewrite of the repo
 *      (PR #10832, killed before any file changed). A rewriting tool that treats an
 *      unknown flag as consent has no way to distinguish a typo from an intention.
 *
 *   2. Writing requires `--write`. Property 1 alone still leaves a tool that
 *      rewrites the repo when you FORGET a flag; only an explicit opt-in makes the
 *      safe mode the default. `--dry-run` is still accepted — it is now a no-op
 *      that says out loud what the default already is — so every previously-safe
 *      invocation stays safe and every previously-writing invocation (bare) becomes
 *      safe rather than silently changing meaning.
 *
 * Parsed at module scope, above every `writeFileSync` in this file, so the exit
 * cannot be reached after a partial rewrite.
 */
const ARGS = process.argv.slice(2);
const KNOWN_FLAGS = new Set(["--write", "--dry-run", "--verbose", "--help", "-h"]);

if (ARGS.includes("--help") || ARGS.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}

const UNKNOWN = ARGS.filter((a) => !KNOWN_FLAGS.has(a));
if (UNKNOWN.length > 0) {
  process.stderr.write(`unknown arg: ${UNKNOWN.join(" ")}\n\n${USAGE}\n`);
  process.exit(2);
}

const WRITE = ARGS.includes("--write");
if (WRITE && ARGS.includes("--dry-run")) {
  process.stderr.write(`--write and --dry-run are contradictory; refusing to guess\n`);
  process.exit(2);
}

const REPO_ROOT = process.cwd();
const MAP_PATH = join(REPO_ROOT, "src", "Core.TypeScript", "backlog", "b-to-zetaid-map.json");
const MANUAL_PATH = join(REPO_ROOT, "src", "Core.TypeScript", "backlog", "b-id-renumber-aliases.json");
const DRY_RUN = !WRITE;
const VERBOSE = ARGS.includes("--verbose");

const SKIP_FILES = new Set([
  "b-to-zetaid-map.json",
  "b-id-renumber-aliases.json",
  "rebuild-legacy-b-id-aliases.ts",
  "legacy-b-id-zetaid.ts",
  "autonomous-pickup.test.ts",
  "backlog-ready-notifier.test.ts",
]);

const SCAN_EXTENSIONS = new Set([".md", ".ts", ".tsx", ".js", ".json", ".yaml", ".yml", ".jsonc", ".sh", ".fs", ".fsx"]);
const APPLY_EXTENSIONS = SCAN_EXTENSIONS;

const B_ID_RE = /\b(B-[0-9]{4}(?:\.[0-9]+)*)\b/g;

function git(args: string[]): string {
  const r = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return "";
  return r.stdout;
}

function zetaFromFilename(path: string): string | null {
  const stem = basename(path).replace(/\.md$/, "");
  const dash = stem.indexOf("-");
  const prefix = dash === -1 ? stem : stem.slice(0, dash);
  return /^[0-9A-Z]{10,}$/.test(prefix) ? prefix : null;
}

function loadJsonMap(path: string): Map<string, string> {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
    return new Map(Object.entries(raw));
  } catch {
    return new Map();
  }
}

function addMapping(map: Map<string, string>, bId: string, zetaId: string, source: string): void {
  const existing = map.get(bId);
  if (existing && existing !== zetaId) {
    if (VERBOSE) console.warn(`  conflict ${bId}: keep ${existing}, skip ${zetaId} (${source})`);
    return;
  }
  map.set(bId, zetaId);
}

function fromGitRenames(map: Map<string, string>): void {
  const commits = git(["log", "--all", "--oneline", "--grep=zetaid-slug", "--format=%H"]).split("\n").filter(Boolean);
  for (const commit of commits) {
    const ns = git(["show", commit, "--name-status", "--format="]);
    for (const line of ns.split("\n")) {
      if (!line.startsWith("R")) continue;
      const parts = line.split("\t");
      if (parts.length < 3) continue;
      const [, oldPath, newPath] = parts;
      const m = oldPath!.match(/\/B-([0-9]{4}(?:\.[0-9]+)*)-/);
      if (!m) continue;
      const bId = `B-${m[1]}`;
      const zeta = zetaFromFilename(newPath!);
      if (zeta) addMapping(map, bId, zeta, `rename ${commit.slice(0, 8)}`);
    }
  }
}

function fromPreMigrationFrontmatter(map: Map<string, string>, commit: string): void {
  for (const tier of ["P0", "P1", "P2", "P3"]) {
    const files = git(["ls-tree", "-r", "--name-only", commit, `docs/backlog/${tier}`]).split("\n").filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const content = git(["show", `${commit}:${file}`]);
      if (!content) continue;
      const idM = content.match(/^id:\s*(\S+)/m);
      const zM = content.match(/^zetaid:\s*(\S+)/m);
      if (idM?.[1]?.startsWith("B-") && zM?.[1]) {
        addMapping(map, idM[1], zM[1], `frontmatter ${file}`);
      }
    }
  }
}

function fromGitHistory(map: Map<string, string>, bId: string): void {
  if (map.has(bId)) return;
  const commits = git(["log", "--all", "-S", `id: ${bId}`, "--format=%H", "--", "docs/backlog"]).split("\n").filter(Boolean);
  for (const commit of commits.slice(0, 5)) {
    const hits = git(["grep", "-l", `^id: ${bId}$`, commit, "--", "docs/backlog"]).split("\n").filter(Boolean);
    for (const hit of hits) {
      const file = hit.split(":").slice(1).join(":");
      const content = git(["show", `${commit}:${file}`]);
      if (!content) continue;
      const zM = content.match(/^zetaid:\s*(\S+)/m);
      if (zM?.[1]) {
        addMapping(map, bId, zM[1], `history zetaid ${file}`);
        return;
      }
      const zeta = zetaFromFilename(file);
      if (zeta) {
        addMapping(map, bId, zeta, `history filename ${file}`);
        return;
      }
      const created = content.match(/^created:\s*(\S+)/m)?.[1] ?? null;
      addMapping(map, bId, legacyZetaIdFromBId(bId, timestampForLegacyBId(bId, created)), `history synthetic ${file}`);
      return;
    }
  }
}

function inheritSubItems(map: Map<string, string>): void {
  for (const bId of [...map.keys()]) {
    if (!bId.includes(".")) continue;
    let cur: string | null = bId;
    while (cur && !map.has(cur)) cur = parentBId(cur);
    if (cur && map.has(cur) && !map.has(bId)) map.set(bId, map.get(cur)!);
  }
}

/**
 * Discovery walk — intentionally WIDE, including archival trees.
 *
 * This is read-only, and the alias map exists precisely so that a legacy id
 * found in an archive can still be resolved. Narrowing this would shrink the
 * map's coverage of exactly the history it is meant to resolve. The narrowing
 * belongs on `applyWalk` below, which writes.
 */
function scanRemainingBIds(): Set<string> {
  const found = new Set<string>();
  function walk(dir: string) {
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
      if (dirent.isDirectory()) walk(full);
      else if (dirent.isFile() && APPLY_EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) {
        if (SKIP_FILES.has(entry)) continue;
        // Let the read BE the check: a stat-then-read is check-then-act, and the
        // file can vanish in between (js/file-system-race).
        let text: string;
        try {
          text = readFileSync(full, "utf8");
        } catch {
          continue;
        }
        for (const m of text.matchAll(B_ID_RE)) found.add(m[1]!);
      }
    }
  }
  walk(REPO_ROOT);
  return found;
}

function replaceReferences(content: string, map: Map<string, string>): string {
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  let result = content;
  for (const bId of keys) {
    const zetaId = map.get(bId)!;
    const escaped = bId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "g"), zetaId);
  }
  return result;
}

function cleanFrontmatter(content: string): string {
  const lines = content.split("\n");
  if (lines[0] !== "---") return content;
  const endIdx = lines.indexOf("---", 1);
  if (endIdx === -1) return content;
  const fm = lines.slice(1, endIdx);
  const cleaned: string[] = [];
  let hasZetaId = false;
  let dropped = false;
  for (const line of fm) {
    if (/^id:\s*[0-9A-Z]{10,}/.test(line) && fm.some((l) => /^zetaid:/.test(l))) {
      dropped = true;
      continue;
    }
    if (/^zetaid:\s*/.test(line)) {
      hasZetaId = true;
      cleaned.push(line.replace(/^zetaid:/, "id:"));
      continue;
    }
    cleaned.push(line);
  }
  if (!hasZetaId && !dropped) return content;
  return ["---", ...cleaned, "---", ...lines.slice(endIdx + 1)].join("\n");
}

// --- main ---
const map = loadJsonMap(MAP_PATH);
fromGitRenames(map);
fromPreMigrationFrontmatter(map, "28c8c867d");
for (const [bId, zetaId] of loadJsonMap(MANUAL_PATH)) addMapping(map, bId, zetaId, "manual");

const remaining = scanRemainingBIds();
for (const bId of remaining) {
  if (!map.has(bId)) fromGitHistory(map, bId);
}
for (const bId of remaining) {
  if (!map.has(bId)) {
    addMapping(map, bId, legacyZetaIdFromBId(bId, timestampForLegacyBId(bId, null)), "synthetic fallback");
  }
}
inheritSubItems(map);

const sorted = Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })));
if (!DRY_RUN) {
  writeFileSync(MAP_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
}
console.log(`Alias map: ${Object.keys(sorted).length} entries (${remaining.size} unique B-ids seen in repo)`);

let changed = 0;
/**
 * Rewrite walk — scoped to the SAME trees `lint-b-refs-resolve.ts` polices.
 *
 * Previously this skipped only `node_modules`/`.git`, so the remedy the linter
 * advertises was strictly wider than the linter itself: it rewrote the recovered
 * orphan-branch archive, `docs/history/`, `memory/`, `.claude/rules.bak/`, and
 * the generated PR mirror — all trees the linter deliberately refuses to police.
 * Observed live: ~1,700 files modified, and the run exceeded 500s and was killed
 * mid-rewrite. A remedy must not have a larger blast radius than its check.
 *
 * Symlinks are NOT followed (`Dirent.isFile()` is false for a symlink), and for
 * a REWRITING tool that is the safer reading rather than a regression: writing
 * through `universal/*.md → db/shapes/*.md` would apply the rewrite twice to one
 * file, and `statSync` used to follow `tests/…/link_to_parent → ..`, a genuine
 * cycle that recursed until PATH_MAX stopped it.
 */
function applyWalk(dir: string) {
  if (shouldSkipDir(dir.slice(REPO_ROOT.length + 1))) return;
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
    if (dirent.isDirectory()) applyWalk(full);
    else if (
      dirent.isFile() &&
      APPLY_EXTENSIONS.has(entry.slice(entry.lastIndexOf("."))) &&
      !SKIP_FILES.has(entry)
    ) {
      // Let the read BE the check (js/file-system-race): a stat-then-read is
      // check-then-act, and a rewriting tool must not act on a stale check.
      let original: string;
      try {
        original = readFileSync(full, "utf8");
      } catch {
        continue;
      }
      let modified = replaceReferences(original, map);
      if (full.includes("docs/backlog/") && entry.endsWith(".md")) modified = cleanFrontmatter(modified);
      if (modified !== original) {
        if (!DRY_RUN) {
          try {
            writeFileSync(full, modified);
          } catch {
            continue;
          }
        }
        changed++;
      }
    }
  }
}
applyWalk(REPO_ROOT);

console.log(
  DRY_RUN
    ? `[DRY RUN] Would change: ${changed} files (nothing written — pass --write to apply)`
    : `Changed: ${changed} files`,
);
const still = scanRemainingBIds().size;
console.log(`Remaining B-ids in repo (excl. skip files): ${still}`);
if (still > 0 && VERBOSE) {
  for (const b of [...scanRemainingBIds()].slice(0, 20)) console.log(`  ${b}`);
}
