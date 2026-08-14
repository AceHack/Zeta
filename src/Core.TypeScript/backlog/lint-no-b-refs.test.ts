import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { shouldSkipDir } from "./b-ref-scope";

/**
 * Falsifiability harness for lint-no-b-refs.ts.
 *
 * This lint went red on `main` for an extended period because it scanned the
 * generated GitHub PR mirror (`docs/github/prs/**`) — 1548 of 1551 offenders
 * were verbatim PR titles, records of what a merged PR actually said. A
 * permanently-red check trains everyone to ignore the signal, so the fix
 * narrowed the scan to authored surfaces.
 *
 * Narrowing a lint's scope is the single easiest way to make it unfalsifiable.
 * These tests exist so that can never happen silently: they pin BOTH halves —
 * the surfaces the lint must still police, and the exclusions it may make —
 * and they pin the boundary between them at prefix granularity.
 *
 * If a future change widens SKIP_DIR_PREFIXES over a live authored surface,
 * the "still fires" cases below go red. That is the intent.
 */

const TOOL = join(import.meta.dir, "lint-no-b-refs.ts");

/** A real legacy id, in the exact shape the lint's regex targets. */
const PLANTED = "planted legacy ref B-0744 in prose\n";

/**
 * The lint resolves its scan root via `git rev-parse --show-toplevel`, so the
 * fixture must be a git repo of its own — otherwise it would walk the real
 * repository and the test would depend on live tree contents.
 */
function fixture(files: string[]): string {
  const base = mkdtempSync(join(tmpdir(), "lint-no-b-refs-"));
  spawnSync("git", ["init", "-q"], { cwd: base, encoding: "utf8" });
  for (const rel of files) {
    mkdirSync(join(base, dirname(rel)), { recursive: true });
    writeFileSync(join(base, rel), PLANTED, "utf8");
  }
  return base;
}

function runIn(base: string) {
  const r = spawnSync("bun", [TOOL], { cwd: base, encoding: "utf8" });
  rmSync(base, { recursive: true, force: true });
  return r;
}

/** The lint must FLAG a planted legacy id at this path. */
function expectFires(rel: string) {
  const r = runIn(fixture([rel]));
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("B-NNNN refs");
}

/** The lint must IGNORE a planted legacy id at this path (archival/generated). */
function expectIgnored(rel: string) {
  const r = runIn(fixture([rel]));
  expect(r.status).toBe(0);
  expect(r.stdout).toContain("zero B-NNNN refs");
}

test("PASSES on a tree with no legacy refs (exit 0)", () => {
  const r = runIn(fixture([]));
  expect(r.status).toBe(0);
});

// ── The lint's core purpose: live work-item substrate ───────────────────────
// If either of these stops firing, the check has become decorative.

test("FIRES on a legacy ref in docs/backlog/ (the frozen legacy substrate)", () => {
  expectFires("docs/backlog/P1/some-row.md");
});

test("FIRES on a legacy ref in workitems/ (the live ZetaId substrate)", () => {
  expectFires("workitems/081KSE6WT0008QG0R000SH6E0R-a-row.md");
});

// ── Authored surfaces that carried real offenders when this was fixed ───────
// docs/research, docs/handoffs, and src/ each held a genuine catch; the fix
// resolved them to ZetaIds rather than excluding them.

test("FIRES on a legacy ref in docs/research/", () => {
  expectFires("docs/research/2026-01-01-a-note.md");
});

test("FIRES on a legacy ref in docs/handoffs/", () => {
  expectFires("docs/handoffs/2026-01-01-a-handoff.md");
});

test("FIRES on a legacy ref in source under src/", () => {
  expectFires("src/Core.TypeScript/somewhere/module.ts");
});

// ── The exclusions, asserted as behaviour rather than as a list ─────────────

test("IGNORES the generated PR mirror (verbatim PR titles; regenerated on merge)", () => {
  expectIgnored("docs/github/prs/shards/007/08000000000000007803000000001edc.json");
});

test("IGNORES the PR mirror manifest", () => {
  expectIgnored("docs/github/prs/manifest.jsonl");
});

test("IGNORES dist/ build output (gitignored; never present in CI)", () => {
  expectIgnored("dist/docs/recovered-orphan-branches-2026-05/a-file.md");
});

test("IGNORES the recovered orphan-branch archive", () => {
  expectIgnored("docs/recovered-orphan-branches-2026-05/misc/backlog/a-file.md");
});

// ── Boundary precision ─────────────────────────────────────────────────────
// A skip prefix must exclude exactly its own subtree. These catch the classic
// widening bug where "dist/" silently swallows "distributed/".

test("boundary: FIRES one level ABOVE the PR-mirror exclusion (docs/github/)", () => {
  expectFires("docs/github/a-hand-written-note.md");
});

test("boundary: 'docs/github/prs/' does not swallow the sibling 'docs/github/prs-notes/'", () => {
  expectFires("docs/github/prs-notes/a-note.md");
});

test("boundary: 'dist/' does not swallow the sibling 'distributed/'", () => {
  expectFires("distributed/a-note.md");
});

test("boundary: 'docs/history/' does not swallow the sibling 'docs/history-of-x/'", () => {
  expectFires("docs/history-of-x/a-note.md");
});

// ── Check and remedy must agree about scope ────────────────────────────────
// `lint-no-b-refs.ts` prints "Run: rebuild-legacy-b-id-aliases.ts". That remedy
// used to skip only node_modules/.git, so it rewrote four archival trees the
// linter refuses to police (~1,700 files). A remedy with a larger blast radius
// than its own check is the bug; these pin the shared scope.
//
// Asserted structurally rather than by executing the remedy: a full run mines
// git history and takes >10 minutes, which is a separate unfixed problem.

const REMEDY_SRC = readFileSync(join(import.meta.dir, "rebuild-legacy-b-id-aliases.ts"), "utf8");

test("the remedy imports the shared scope module", () => {
  expect(REMEDY_SRC).toContain('from "./b-ref-scope"');
});

test("the remedy's REWRITE walk is guarded by shouldSkipDir", () => {
  const applyWalk = REMEDY_SRC.slice(REMEDY_SRC.indexOf("function applyWalk"));
  expect(applyWalk.slice(0, 200)).toContain("shouldSkipDir");
});

test("shouldSkipDir is prefix-precise (unit)", () => {
  // inside the exempt trees
  expect(shouldSkipDir("dist")).toBe(true);
  expect(shouldSkipDir("dist/docs")).toBe(true);
  expect(shouldSkipDir("docs/github/prs")).toBe(true);
  expect(shouldSkipDir("docs/github/prs/shards/007")).toBe(true);
  // siblings that merely share a textual prefix must NOT be skipped
  expect(shouldSkipDir("distributed")).toBe(false);
  expect(shouldSkipDir("docs/github")).toBe(false);
  expect(shouldSkipDir("docs/github/prs-notes")).toBe(false);
  expect(shouldSkipDir("docs/history-of-x")).toBe(false);
  // the surfaces the lint exists to police
  expect(shouldSkipDir("docs/backlog")).toBe(false);
  expect(shouldSkipDir("workitems")).toBe(false);
  expect(shouldSkipDir("")).toBe(false);
});
