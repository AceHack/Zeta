import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, symlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { shouldSkipDir } from "./b-ref-scope";

/**
 * Falsifiability harness for lint-b-refs-resolve.ts.
 *
 * ## Why this file is written the way it is
 *
 * The predecessor gate BANNED hyphenated legacy ids on authored surfaces. That
 * is the vacuity class in its purest form: if the mention is forbidden, a
 * *stale* mention cannot exist, so the check had no subject left to catch. It
 * was green because it had removed everything it could have failed on.
 *
 * The replacement permits the mention and checks that it RESOLVES. That is a
 * strictly larger claim, so it needs a strictly larger harness. These tests pin
 * four things, and the check is worthless if any of them stops holding:
 *
 *   1. it FIRES on a reference that points at nothing (the new catch);
 *   2. it PASSES a reference that points at something real (the new permission
 *      — without this, the change bought nothing);
 *   3. presence in the alias map is NOT sufficient (otherwise the resolver is
 *      just a second spelling of the map, and rot is invisible again);
 *   4. it still refuses a legacy id in a row's frontmatter, and
 *      `lint-no-new-bnnnn.ts` still refuses a B-named FILE — so this loosening
 *      cannot be read as re-opening B-NNNN minting.
 *
 * The scope/boundary tests carried over from the predecessor are kept: a lint's
 * scan scope is the other easy route to unfalsifiability, and widening a skip
 * prefix over a live authored surface must still go red.
 */

const TOOL = join(import.meta.dir, "lint-b-refs-resolve.ts");
const NO_NEW_TOOL = join(import.meta.dir, "lint-no-new-bnnnn.ts");

/**
 * The B-0732 trap, verbatim from `main`: these read like orphaned legacy
 * numbers, and they are live ZetaId rows. An agent nearly minted duplicates of
 * them. The resolver must land a legacy ref on the MIGRATED row.
 */
const MIGRATED_B = "B-0732";
const MIGRATED_ZID = "081KSE6WT0008QG0R002YBWBB1";

/** Mapped to a ZetaId that names no row anywhere — the rot the ban could not see. */
const ROTTED_B = "B-0601";
const ROTTED_ZID = "081KDWG1RV008QG0R00180WEJT";

/** Never landed on main; survives only in the recovered-orphan-branch archive. */
const ARCHIVED_B = "B-0747";

/** In no map and in no archive: a typo or a fabrication. */
const FABRICATED_B = "B-4242";

const ALIAS_MAP = JSON.stringify({ [MIGRATED_B]: MIGRATED_ZID, [ROTTED_B]: ROTTED_ZID }, null, 2);

/**
 * The lint resolves its scan root via `git rev-parse --show-toplevel`, so the
 * fixture must be a git repo of its own — otherwise it would walk the real
 * repository and the test would depend on live tree contents.
 *
 * `substrate` seeds the resolution index (alias map, one live row, one archive
 * artifact); `files` are the authored surfaces under test.
 */
function fixture(files: Record<string, string>, withSubstrate = true): string {
  const base = mkdtempSync(join(tmpdir(), "lint-b-refs-resolve-"));
  spawnSync("git", ["init", "-q"], { cwd: base, encoding: "utf8" });

  const all: Record<string, string> = { ...files };
  if (withSubstrate) {
    all["src/Core.TypeScript/backlog/b-to-zetaid-map.json"] = ALIAS_MAP;
    all[`docs/backlog/P1/${MIGRATED_ZID}-runbook-as-executable-reality.md`] =
      "---\nid: " + MIGRATED_ZID + "\n---\n\nthe migrated row\n";
    all[
      `docs/recovered-orphan-branches-2026-05/misc/backlog/${ARCHIVED_B}-git-native-per-machine-state/row.md`
    ] = "the row that never landed\n";
  }
  for (const [rel, content] of Object.entries(all)) {
    mkdirSync(join(base, dirname(rel)), { recursive: true });
    writeFileSync(join(base, rel), content, "utf8");
  }
  return base;
}

function runIn(base: string, tool = TOOL, args: string[] = []) {
  const r = spawnSync("bun", [tool, ...args], { cwd: base, encoding: "utf8" });
  rmSync(base, { recursive: true, force: true });
  return r;
}

/** The gate must FLAG a planted reference at this path. */
function expectFires(rel: string, ref = FABRICATED_B) {
  const r = runIn(fixture({ [rel]: `planted legacy ref ${ref} in prose\n` }));
  expect(r.status).toBe(1);
  expect(r.stderr).toContain(ref);
}

/** The gate must IGNORE a planted reference at this path (archival/generated). */
function expectIgnored(rel: string) {
  const r = runIn(fixture({ [rel]: `planted legacy ref ${FABRICATED_B} in prose\n` }));
  expect(r.status).toBe(0);
}

// ── 1. It fires: the catch the ban could never make ────────────────────────

test("PASSES on a tree with no legacy refs (exit 0)", () => {
  expect(runIn(fixture({})).status).toBe(0);
});

test("FIRES on a fabricated id — in no map, in no archive", () => {
  const r = runIn(fixture({ "docs/research/a-note.md": `cites ${FABRICATED_B}\n` }));
  expect(r.status).toBe(1);
  expect(r.stderr).toContain(FABRICATED_B);
  expect(r.stderr).toContain("names nothing");
});

test("FIRES on a mapped id whose ZetaId names no row — map presence is NOT resolution", () => {
  const r = runIn(fixture({ "docs/research/a-note.md": `cites ${ROTTED_B}\n` }));
  expect(r.status).toBe(1);
  expect(r.stderr).toContain(ROTTED_B);
  expect(r.stderr).toContain(ROTTED_ZID);
  // This case is the whole reason the resolver checks disk rather than the map.
  // If it ever passes, the gate has become a restatement of b-to-zetaid-map.json.
});

// ── 2. It permits: without this the change bought nothing ──────────────────

test("PASSES a ref that resolves to a MIGRATED live row (the B-0732 trap)", () => {
  const r = runIn(fixture({ "docs/research/a-note.md": `lineage: ${MIGRATED_B}\n` }));
  expect(r.status).toBe(0);
  expect(r.stdout).toContain("all resolving");
});

test("PASSES a ref that resolves only to a recovered-branch archive artifact", () => {
  const r = runIn(fixture({ "docs/research/a-note.md": `lineage: ${ARCHIVED_B}\n` }));
  expect(r.status).toBe(0);
});

test("--report names the resolution target so a reader can follow the ref", () => {
  const r = runIn(fixture({ "docs/research/a-note.md": `lineage: ${MIGRATED_B}\n` }), TOOL, [
    "--report",
  ]);
  expect(r.status).toBe(0);
  expect(r.stdout).toContain(MIGRATED_ZID);
});

test("a dotted sub-item falls back to its parent row", () => {
  const r = runIn(fixture({ "docs/research/a-note.md": `slice ${MIGRATED_B}.3\n` }));
  expect(r.status).toBe(0);
});

test("with NO substrate present, even a real id is unresolved (the index is load-bearing)", () => {
  const r = runIn(fixture({ "docs/research/a-note.md": `cites ${MIGRATED_B}\n` }, false));
  expect(r.status).toBe(1);
});

// ── 3. Minting stays shut: reference ≠ key ─────────────────────────────────

test("FIRES on a resolving legacy id in a work-item row's FRONTMATTER (key position)", () => {
  const r = runIn(
    fixture({
      "workitems/081KSE6WT0008QG0R00102H071-a-row.md": `---\nid: ${MIGRATED_B}\nstatus: open\n---\n\nbody\n`,
    }),
  );
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("KEY POSITION");
});

test("PASSES the SAME id in the same row's BODY — the guard is about position, not the id", () => {
  const r = runIn(
    fixture({
      "workitems/081KSE6WT0008QG0R00102H071-a-row.md": `---\nid: 081KSE6WT0008QG0R00102H071\n---\n\nsupersedes ${MIGRATED_B}\n`,
    }),
  );
  expect(r.status).toBe(0);
});

test("lint-no-new-bnnnn STILL rejects a B-named file — this change licenses no minting", () => {
  const base = fixture({ "src/Core.TypeScript/backlog/frozen-bnnnn-ids.json": "[]" });
  mkdirSync(join(base, "workitems"), { recursive: true });
  writeFileSync(join(base, "workitems", "B-1300-a-brand-new-row.md"), "---\nid: B-1300\n---\n", "utf8");
  const r = runIn(base, NO_NEW_TOOL);
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("B-1300");
});

// ── 3b. Walk shape: symlinks are skipped, deliberately ─────────────────────
// The walk takes entry kind from `readdirSync(withFileTypes)` rather than a
// per-entry `statSync`, which removes the check-then-act race (js/file-system-race)
// AND stops following symlinks. That second effect is a behaviour decision, so it
// is pinned here rather than left to be rediscovered.
//
// It loses no coverage in this repo: every tracked symlink target
// (`universal/*.md → db/shapes/`, `db/hy → ../hygiene`,
// `db/products/glomotion.md → ../../universal/gamepad.md`) is inside the tree and
// visited directly. What it removes is a duplicate visit — and, for the rewriting
// remedy that shares this scope, a double-application through the link.

test("a symlink to a file is NOT walked; the real file still is", () => {
  const base = fixture({ "docs/research/real-note.md": `cites ${FABRICATED_B}\n` });
  symlinkSync(join(base, "docs/research/real-note.md"), join(base, "docs/research/link.md"));
  const r = runIn(base);
  expect(r.status).toBe(1);
  // Reported once, from the real path — not twice, and not via the link.
  expect(r.stderr).toContain("docs/research/real-note.md");
  expect(r.stderr).not.toContain("docs/research/link.md");
});

/**
 * A symlinked DIRECTORY is not descended into either — asserted by pointing one
 * at a tree the walk cannot otherwise reach, so the assertion discriminates.
 *
 * A first draft of this test asserted "a symlink cycle does not hang the walk"
 * with a wall-clock bound. That check could not fail: a cycle under the old
 * `statSync` walk terminates at PATH_MAX in milliseconds, so the bound held both
 * before and after the fix. It was the exact defect this PR is about, written
 * into the PR's own harness, and it was replaced rather than kept.
 *
 * The no-cycle property is a consequence of this test, not a separate one: a
 * walk that never descends through a link cannot enter a loop made of links.
 */
test("a symlinked DIRECTORY is not descended into", () => {
  const outside = mkdtempSync(join(tmpdir(), "lint-b-refs-outside-"));
  mkdirSync(join(outside, "hidden"), { recursive: true });
  writeFileSync(join(outside, "hidden", "planted.md"), `cites ${FABRICATED_B}\n`, "utf8");

  const base = fixture({ "docs/research/a-note.md": `lineage: ${MIGRATED_B}\n` });
  symlinkSync(join(outside, "hidden"), join(base, "docs/elsewhere"));

  const r = runIn(base);
  rmSync(outside, { recursive: true, force: true });
  // A symlink-following walk would reach planted.md and go red on a ref that is
  // not in the scanned tree at all.
  expect(r.status).toBe(0);
});

// ── 3c. Adjudication: a document REPORTING a dangling id ───────────────────
//
// The escape hatch is the most dangerous thing in this file, so it gets the
// densest harness. The property under test is NOT "the annotation works" — it
// is that **every way of misusing the annotation still goes red**. If any of
// the negative tests below stops firing, the gate has acquired a licence and
// the whole check is back to being decorative.
//
// The positive test alone would be the vacuity class: an escape that always
// succeeds is an exclusion with extra syntax.

const ADJ = (id: string, disp: string, ev: string) =>
  `<!-- b-ref-adjudicated: ${id} ${disp} ${ev} -->`;

/** The evidence path every adjudication fixture below cites; it exists. */
const EVIDENCE = "src/Core.TypeScript/backlog/autonomous-pickup.ts";
const WITH_EVIDENCE = { [EVIDENCE]: "// the code the work landed as\n" };

test("PASSES a dangling id whose mention carries a checked adjudication", () => {
  const r = runIn(
    fixture({
      ...WITH_EVIDENCE,
      "docs/research/audit.md": `| ${ROTTED_B} | landed as code | ${ADJ(ROTTED_B, "landed-as-code", EVIDENCE)} |\n`,
    }),
  );
  expect(r.status).toBe(0);
  expect(r.stdout).toContain("adjudicated as dangling with checked evidence");
});

// ── the four ways to abuse it, each still red ─────────────────────────────

test("FIRES when the adjudication's evidence path does not exist", () => {
  const r = runIn(
    fixture({
      "docs/research/audit.md": `${ROTTED_B} ${ADJ(ROTTED_B, "landed-as-code", "src/does/not/exist.ts")}\n`,
    }),
  );
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("ADJUDICATION EVIDENCE MISSING");
});

test("FIRES when the disposition is outside the closed vocabulary", () => {
  const r = runIn(
    fixture({
      ...WITH_EVIDENCE,
      "docs/research/audit.md": `${ROTTED_B} ${ADJ(ROTTED_B, "it-is-fine-honestly", EVIDENCE)}\n`,
    }),
  );
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("ADJUDICATION DISPOSITION UNKNOWN");
});

test("FIRES when the document cites ITSELF as the evidence", () => {
  const r = runIn(
    fixture({
      "docs/research/audit.md": `${ROTTED_B} ${ADJ(ROTTED_B, "abandoned", "docs/research/audit.md")}\n`,
    }),
  );
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("ADJUDICATION SELF-CITED");
});

test("FIRES when the annotation is not on a line that mentions the id (no blanket footer)", () => {
  const r = runIn(
    fixture({
      ...WITH_EVIDENCE,
      "docs/research/audit.md": `a paragraph naming ${ROTTED_B}\n\n${ADJ(ROTTED_B, "landed-as-code", EVIDENCE)}\n`,
    }),
  );
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("ADJUDICATION MISPLACED");
});

test("FIRES as STALE when the adjudicated id actually RESOLVES", () => {
  // The clause that stops the escape rotting into a permanent exemption: the
  // moment a row lands for the id, the recorded "it names nothing" is false.
  const r = runIn(
    fixture({
      ...WITH_EVIDENCE,
      "docs/research/audit.md": `${MIGRATED_B} ${ADJ(MIGRATED_B, "landed-as-code", EVIDENCE)}\n`,
    }),
  );
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("ADJUDICATION STALE");
});

test("an adjudication for ONE id does not excuse a DIFFERENT dangling id in the same file", () => {
  const r = runIn(
    fixture({
      ...WITH_EVIDENCE,
      "docs/research/audit.md":
        `${ROTTED_B} ${ADJ(ROTTED_B, "landed-as-code", EVIDENCE)}\nand also ${FABRICATED_B}\n`,
    }),
  );
  expect(r.status).toBe(1);
  expect(r.stderr).toContain(FABRICATED_B);
  expect(r.stderr).not.toContain(ROTTED_B);
});

test("the adjudication escape does NOT open the KEY-POSITION door", () => {
  // Frontmatter is judged before resolution, so an annotation cannot buy a
  // legacy id a place as a row key. Minting stays shut.
  const r = runIn(
    fixture({
      ...WITH_EVIDENCE,
      "workitems/081KSE6WT0008QG0R00102H071-a-row.md":
        `---\nid: ${ROTTED_B} ${ADJ(ROTTED_B, "landed-as-code", EVIDENCE)}\n---\n\nbody\n`,
    }),
  );
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("KEY POSITION");
});

test("--report names the disposition and the evidence, so a reader can check it", () => {
  const r = runIn(
    fixture({
      ...WITH_EVIDENCE,
      "docs/research/audit.md": `${ROTTED_B} ${ADJ(ROTTED_B, "superseded", EVIDENCE)}\n`,
    }),
    TOOL,
    ["--report"],
  );
  expect(r.status).toBe(0);
  expect(r.stdout).toContain(`${ROTTED_B} → superseded, evidence ${EVIDENCE}`);
});

// ── 4. Scope: the surfaces the gate must still police ──────────────────────
// If any of these stops firing, the check has become decorative by narrowing
// rather than by banning — the same defect wearing different clothes.

test("FIRES on a dangling ref in docs/backlog/ (the frozen legacy substrate)", () => {
  expectFires("docs/backlog/P1/some-row.md");
});

test("FIRES on a dangling ref in workitems/ (the live ZetaId substrate)", () => {
  expectFires("workitems/081KSE6WT0008QG0R000SH6E0R-a-row.md");
});

test("FIRES on a dangling ref in docs/research/", () => {
  expectFires("docs/research/2026-01-01-a-note.md");
});

test("FIRES on a dangling ref in docs/handoffs/", () => {
  expectFires("docs/handoffs/2026-01-01-a-handoff.md");
});

test("FIRES on a dangling ref in source under src/", () => {
  expectFires("src/Core.TypeScript/somewhere/module.ts");
});

// ── The exclusions, asserted as behaviour rather than as a list ────────────

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

// ── Boundary precision ────────────────────────────────────────────────────
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

// ── Check and remedy must agree about scope ───────────────────────────────
// `rebuild-legacy-b-id-aliases.ts` used to skip only node_modules/.git, so it
// rewrote four archival trees the linter refuses to police (~1,700 files). A
// remedy with a larger blast radius than its own check is the bug; these pin
// the shared scope. Asserted structurally rather than by executing the remedy:
// a full run mines git history and takes >10 minutes (a separate filed problem).

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
  // the surfaces the gate exists to police
  expect(shouldSkipDir("docs/backlog")).toBe(false);
  expect(shouldSkipDir("workitems")).toBe(false);
  expect(shouldSkipDir("")).toBe(false);
});
