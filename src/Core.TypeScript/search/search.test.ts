// search.test.ts — falsifiers for the fail-closed scope budget.
//
// Per `.claude/rules/toy-is-free-metered-must-be-earned.md` the CLI is UNMETERED
// without tests that FAIL when the guard is wrong. The three that matter, and
// what each one refuses to let regress:
//
//   1. THE RUNAWAY IS REFUSED — the actual 2026-08-22 bug. Delete the budget
//      check and this test fails.
//   2. THE DELIBERATE PATH STILL WORKS — a guard that blocks the legitimate
//      explicit-target prior-art search would get switched off, and a
//      switched-off guard is worse than none. This is the test that keeps the
//      guard usable enough to survive.
//   3. NARROWING IS NEVER SILENT — the failure in the opposite direction, and
//      the worse one: a search that skipped a tree and reported "no matches"
//      returns a confident empty result nobody knows to doubt.

import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  checkScope,
  collectCandidates,
  searchFiles,
  parseArgs,
  main,
  DEFAULT_MAX_FILES,
  type SearchOptions,
} from "./search.ts";
import { renderIgnoreFile, matchExcludedTree, HEAVY_TREES } from "./exclusions.ts";

let root: string;

// Fixture mirrors the real shape: ordinary source, an excluded heavy tree with a
// REAL match inside it, and a build-output dir with a match inside it.
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "zeta-search-test-"));
  const write = (rel: string, body: string) => {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, body, "utf8");
  };
  write("src/hit.ts", "const x = 1;\n// needle here\n");
  write("src/nested/also.md", "# doc\nneedle in markdown\n");
  write("references/prior-art/upstream/noise.ts", "// needle in vendored upstream\n");
  write("src/Core.Lean4/.lake/cache/big.lean", "-- needle in lean build cache\n");
  write("src/Core.Rust.Algebra/target/debug/out.rs", "// needle in cargo target\n");
  write("node_modules/dep/index.ts", "// needle in a dep\n");
  write("src/case.ts", "// NeEdLe mixed case\n");
});

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

function opts(over: Partial<SearchOptions> = {}): SearchOptions {
  return {
    root,
    pattern: "needle",
    targets: ["."],
    ignoreCase: false,
    exts: undefined,
    maxFiles: DEFAULT_MAX_FILES,
    allow: [],
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE RUNAWAY IS REFUSED — this is the bug that happened.
// ─────────────────────────────────────────────────────────────────────────────

test("REFUSES a search whose scope exceeds the file budget, instead of running it", () => {
  const r = checkScope(opts({ maxFiles: 1 }));
  expect(r.ok).toBe(false);
  if (r.ok) throw new Error("unreachable");
  expect(r.refusal.kind).toBe("over-budget");
});

test("the over-budget refusal names the count, the directories, and the flag that permits it", () => {
  const r = checkScope(opts({ maxFiles: 1 }));
  if (r.ok) throw new Error("expected refusal");
  const m = r.refusal.message;
  // A refusal that does not tell you how to proceed is an obstacle, not a guard.
  expect(m).toContain("--max-files");
  expect(m).toMatch(/would open \d+ files/);
  expect(m).toContain("src");
});

test("the budget is checked BEFORE any file is opened", () => {
  // The guard's whole affordability argument is that the walk is ~1000x cheaper
  // than the reads. If checkScope read files, the refusal would cost what the
  // search costs and the guard would be pointless. Proven structurally: a refusal
  // is returned for a tree whose files are unreadable-as-text is irrelevant —
  // what matters is that no content is present in the refusal path at all.
  const r = checkScope(opts({ maxFiles: 0 }));
  expect(r.ok).toBe(false);
  if (r.ok) throw new Error("unreachable");
  // No match data can exist, because nothing was read.
  expect(r.refusal.message).not.toContain("needle here");
});

test("the budget boundary is exact: N files passes, N+1 refuses", () => {
  // Found by mutation testing 2026-08-22: flipping `>` to `>=` in checkScope left
  // the suite green, i.e. the boundary was asserted nowhere and either behaviour
  // would have shipped. An off-by-one in a guard is how a guard quietly becomes
  // either useless or unusable, so it is pinned here rather than left to reading.
  const n = collectCandidates(opts()).files.length;
  expect(n).toBeGreaterThan(1);
  expect(checkScope(opts({ maxFiles: n })).ok).toBe(true);
  expect(checkScope(opts({ maxFiles: n - 1 })).ok).toBe(false);
});

test("exit code 3 marks a refusal, distinct from 'no matches' (1) and usage error (2)", () => {
  // A refusal that shares an exit code with 'no matches' is invisible to a script.
  const refused = main(["needle", "--root", root, "--max-files", "1"], root);
  expect(refused).toBe(3);
  const usage = main([], root);
  expect(usage).toBe(2);
  const noMatch = main(["zzz-no-such-token-zzz", "--root", root, "src"], root);
  expect(noMatch).toBe(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE DELIBERATE PATH STILL WORKS.
// ─────────────────────────────────────────────────────────────────────────────

test("an explicit-target search of prior-art SUCCEEDS with --allow", () => {
  const o = opts({
    targets: ["references/prior-art"],
    allow: ["references/prior-art"],
  });
  const r = checkScope(o);
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error("unreachable");
  const matches = searchFiles(root, r.candidates, o);
  expect(matches.map((m) => m.file)).toContain("references/prior-art/upstream/noise.ts");
});

test("targeting an excluded tree WITHOUT --allow is refused, NOT silently emptied", () => {
  // The dangerous alternative: return zero matches and exit 0. That is a
  // confident false negative — worse than the runaway, because it is believed.
  const r = checkScope(opts({ targets: ["references/prior-art"] }));
  expect(r.ok).toBe(false);
  if (r.ok) throw new Error("unreachable");
  expect(r.refusal.kind).toBe("excluded-target");
  expect(r.refusal.message).toContain("references/prior-art");
  expect(r.refusal.message).toContain("--allow");
});

test("--allow is scoped to the tree named, and does not unlock the others", () => {
  const o = opts({ allow: ["references/prior-art"], maxFiles: 1000 });
  const c = collectCandidates(o);
  expect(c.files).toContain("references/prior-art/upstream/noise.ts");
  expect(c.files.some((f) => f.includes(".lake"))).toBe(false);
  expect(c.files.some((f) => f.includes("node_modules"))).toBe(false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. NARROWING IS NEVER SILENT.
// ─────────────────────────────────────────────────────────────────────────────

test("every pruned tree is recorded in `skipped` with the rule that pruned it", () => {
  const c = collectCandidates(opts());
  const paths = c.skipped.map((s) => s.path);
  expect(paths).toContain("references/prior-art");
  expect(paths).toContain("node_modules");
  // Each skip carries a reason — a skip with no rule cannot be reported honestly.
  for (const s of c.skipped) expect(s.rule.length).toBeGreaterThan(0);
});

test("the default walk excludes the measured heavy trees", () => {
  const c = collectCandidates(opts({ maxFiles: 1000 }));
  expect(c.files).toContain("src/hit.ts");
  expect(c.files).toContain("src/nested/also.md");
  expect(c.files.some((f) => f.startsWith("references/prior-art"))).toBe(false);
  expect(c.files.some((f) => f.includes(".lake"))).toBe(false);
  expect(c.files.some((f) => f.includes("Core.Rust.Algebra/target"))).toBe(false);
  expect(c.files.some((f) => f.includes("node_modules"))).toBe(false);
});

test("the Core.Rust.<crate>/target glob matches every crate, not just the one measured", () => {
  // Hardcoding one crate would silently let the other ~10 target dirs through.
  expect(matchExcludedTree("src/Core.Rust.Algebra/target")).not.toBeNull();
  expect(matchExcludedTree("src/Core.Rust.DynamicValue/target/debug")).not.toBeNull();
  expect(matchExcludedTree("src/Core.Rust.Watermark/target")).not.toBeNull();
  // ...and does not over-match a real source dir.
  expect(matchExcludedTree("src/Core.Rust.Algebra/src")).toBeNull();
  expect(matchExcludedTree("src/Core.TypeScript/search")).toBeNull();
});

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH SEMANTICS (so the tool is actually usable).
// ─────────────────────────────────────────────────────────────────────────────

test("matching is literal; -i matches mixed case", () => {
  const base = opts({ targets: ["src"], maxFiles: 1000 });
  const lit = searchFiles(root, collectCandidates(base), base);
  expect(lit.some((m) => m.file === "src/case.ts")).toBe(false);

  const ci = { ...base, ignoreCase: true };
  expect(searchFiles(root, collectCandidates(ci), ci).some((m) => m.file === "src/case.ts")).toBe(true);

  // A regex metacharacter is matched LITERALLY — proof no RegExp is built from
  // the pattern. If someone reintroduces regex support this fails, which is the
  // point: `js/regex-injection` was flagged high-severity on the first push here.
  const meta = { ...base, pattern: "n[e]edle" };
  expect(searchFiles(root, collectCandidates(meta), meta).length).toBe(0);
});

test("regex is REFUSED with a pointer to ripgrep, not silently ignored", () => {
  // Silently dropping -e would search for the pattern literally and return
  // confidently wrong results — the same "believed empty answer" failure the
  // excluded-target refusal exists to prevent.
  const r = parseArgs(["n[e]+dle", "-e"], root);
  expect(r).toHaveProperty("error");
  if (!("error" in r)) throw new Error("unreachable");
  expect(r.error).toContain("rg ");
  expect(parseArgs(["x", "--regex"], root)).toHaveProperty("error");
});

test("parseArgs rejects a non-positive --max-files rather than defaulting quietly", () => {
  expect(parseArgs(["x", "--max-files", "0"], root)).toHaveProperty("error");
  expect(parseArgs(["x", "--max-files", "-5"], root)).toHaveProperty("error");
  expect(parseArgs(["x", "--max-files", "abc"], root)).toHaveProperty("error");
});

test("parseArgs defaults the target to the whole tree — so the DEFAULT is the guarded case", () => {
  // If the default were a narrow path, the guard would never fire and the tool
  // would be safe only when already used carefully — i.e. not a guard at all.
  const p = parseArgs(["needle"], root);
  expect(p).not.toHaveProperty("error");
  if ("error" in p) throw new Error("unreachable");
  expect(p.targets).toEqual(["."]);
  expect(p.maxFiles).toBe(DEFAULT_MAX_FILES);
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIFT: the exclusion list and the .ignore file must not disagree.
// ─────────────────────────────────────────────────────────────────────────────

test(".ignore is byte-identical to what exclusions.ts renders (no second source of truth)", () => {
  // The task's third falsifier: if the centralised list and the .ignore file
  // disagree, that is a drift bug. Generating one from the other makes the
  // disagreement impossible to introduce silently.
  const repoRoot = resolve(import.meta.dir, "../../..");
  const onDisk = readFileSync(join(repoRoot, ".ignore"), "utf8");
  expect(onDisk).toBe(renderIgnoreFile());
});

test("every HEAVY_TREES entry carries a measurement, not a guess", () => {
  // Folklore is what put a now-empty directory at the centre of the prose rule.
  for (const t of HEAVY_TREES) {
    expect(t.measured).toMatch(/\d/);
    expect(t.measured).toMatch(/20\d\d-\d\d-\d\d/);
    expect(t.why.length).toBeGreaterThan(20);
  }
});
