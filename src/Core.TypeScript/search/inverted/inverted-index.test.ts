// inverted-index.test.ts — the falsifiers.
// 081M0QTXTR3087G0R002R439FH
//
// Per `.claude/rules/toy-is-free-metered-must-be-earned.md` this index is
// UNMETERED without tests that FAIL when the guard is wrong. Each test below
// was proven to discriminate by breaking the thing it guards, watching it go
// red, and restoring it — the proofs are recorded in the PR body.
//
// The four that carry the work-item:
//
//   1. STALENESS IS REFUSED, NOT ANSWERED. Build at rev N-1, query at rev N for
//      a term that entered at rev N. Without the guard the index reports "no
//      matches" — the 2026-08-22 landauer failure with an index in place of
//      grep. It must exit 3, never 1.
//   2. STALENESS IS REPAIRED WHEN IT CAN BE. The same query with verification
//      on returns the EXACT answer, because the changed set is bounded and gets
//      re-read from git. A guard that only refuses would be switched off.
//   3. RETRACTION IS SEEN. A file that no longer contains the term must LOSE
//      its hit. An index that only ever adds is the same silent-wrongness in
//      the opposite direction, and it is the easier half to get wrong.
//   4. REBUILDING AT A REV IS BYTE-IDENTICAL. Discipline #6. Without it the
//      artifact is not a function of the rev and its diffs mean nothing.

import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { tokenize, decompose, analyzeQueryTerm, isStopWord, STOP_WORDS, MAX_RUN_LENGTH } from "./tokenize.ts";
import {
  EXCLUDED_TREES,
  isIndexablePath,
  isExcluded,
  shardOf,
  compareTerms,
  documentFrequencyCap,
  MIN_DOCUMENT_FREQUENCY_CAP,
  parseTermRow,
  parseFileRow,
  renderTermRow,
} from "./format.ts";
import { buildIndex } from "./build.ts";
import { runQuery, classifyFreshness, VERIFY_FILE_BUDGET } from "./query.ts";

// ─────────────────────────────────────────────────────────────────────────────
// A tiny real git repo. Not a stub: the whole point is that the corpus is read
// through git, so a mocked git would test nothing that matters (#10913's
// lesson — a stub models control flow and says nothing about what git does).
// ─────────────────────────────────────────────────────────────────────────────

let repo = "";
let revA = "";
let revB = "";
let revFork = "";

function git(args: string[], cwd = repo): string {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

function commit(files: Record<string, string | null>, message: string): string {
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(repo, rel);
    if (content === null) {
      rmSync(abs, { force: true });
      continue;
    }
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content, "utf8");
  }
  git(["add", "-A"]);
  git(["commit", "-q", "-m", message]);
  return git(["rev-parse", "HEAD"]).trim();
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "zeta-invidx-"));
  git(["init", "-q", "-b", "main"], repo);
  git(["config", "user.email", "t@example.invalid"]);
  git(["config", "user.name", "test"]);
  git(["config", "commit.gpgsign", "false"]);

  revA = commit(
    {
      "docs/alpha.md": "The Landauer limit is thermodynamic.\nsecond mention: landauer.\n",
      "docs/beta.md": "Nothing relevant here, only filler prose about widgets.\n",
      "docs/gamma.md": "A doomed mention of quarkonium lives here.\n",
    },
    "A",
  );

  // rev B: a NEW term appears, and an OLD term is retracted from gamma.md.
  revB = commit(
    {
      "docs/delta.md": "A brandnewterm arrives, alongside Landauer.\n",
      "docs/gamma.md": "The mention was removed at rev B.\n",
    },
    "B",
  );

  // a sibling branch off A, so `revFork` is NOT an ancestor of revB.
  git(["checkout", "-q", "-b", "fork", revA]);
  revFork = commit({ "docs/eps.md": "divergent branch content\n" }, "fork");
  git(["checkout", "-q", "main"]);
});

afterAll(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
});

function build(rev: string, out: string): void {
  buildIndex({ repoRoot: repo, rev, outDir: out, quiet: true });
}

function tmpDir(tag: string): string {
  return mkdtempSync(join(tmpdir(), `zeta-invidx-${tag}-`));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE STALE-INDEX FALSIFIER — the reason this work-item exists.
// ─────────────────────────────────────────────────────────────────────────────

test("REFUSES rather than reporting 'no matches' when the corpus moved under a --no-verify query", () => {
  const dir = tmpDir("stale");
  build(revA, dir);

  // `brandnewterm` did not exist at revA. An unguarded index answers "0 files",
  // which is a confident claim of absence about a corpus it never read.
  const outcome = runQuery({
    repoRoot: repo,
    indexDir: dir,
    terms: ["brandnewterm"],
    targetRev: revB,
    verify: false,
    limit: 0,
    filesOnly: false,
  });

  expect(outcome.kind).toBe("refused");
  if (outcome.kind !== "refused") throw new Error("unreachable");
  expect(outcome.reason).toContain("empty result");
  // The refusal must name the repair, or it is just an error message.
  expect(outcome.detail).toContain("--no-verify");
  rmSync(dir, { recursive: true, force: true });
});

test("a NON-empty stale answer is returned rather than refused — the guard stays usable", () => {
  const dir = tmpDir("stale-nonempty");
  build(revA, dir);
  const outcome = runQuery({
    repoRoot: repo,
    indexDir: dir,
    terms: ["landauer"],
    targetRev: revB,
    verify: false,
    limit: 0,
    filesOnly: false,
  });
  // Incomplete is not the same failure as absent: you can see what you got.
  expect(outcome.kind).toBe("ok");
  if (outcome.kind !== "ok") throw new Error("unreachable");
  expect(outcome.hits.map((h) => h.path)).toContain("docs/alpha.md");
  expect(outcome.freshness.kind).toBe("behind");
  rmSync(dir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. STALENESS IS REPAIRED WHEN IT CAN BE.
// ─────────────────────────────────────────────────────────────────────────────

test("verification against the target rev turns a stale index into an EXACT answer", () => {
  const dir = tmpDir("verify");
  build(revA, dir);
  const outcome = runQuery({
    repoRoot: repo,
    indexDir: dir,
    terms: ["brandnewterm"],
    targetRev: revB,
    verify: true,
    limit: 0,
    filesOnly: false,
  });
  expect(outcome.kind).toBe("ok");
  if (outcome.kind !== "ok") throw new Error("unreachable");
  expect(outcome.hits.map((h) => h.path)).toEqual(["docs/delta.md"]);
  expect(outcome.hits[0]!.verified).toBe(true);
  rmSync(dir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. RETRACTION IS SEEN. The half that is easy to get wrong.
// ─────────────────────────────────────────────────────────────────────────────

test("a hit is WITHDRAWN when the target rev no longer contains the term", () => {
  const dir = tmpDir("retract");
  build(revA, dir);
  const stale = runQuery({
    repoRoot: repo,
    indexDir: dir,
    terms: ["quarkonium"],
    targetRev: revA,
    verify: true,
    limit: 0,
    filesOnly: false,
  });
  expect(stale.kind).toBe("ok");
  if (stale.kind !== "ok") throw new Error("unreachable");
  expect(stale.hits.map((h) => h.path)).toEqual(["docs/gamma.md"]);

  // Same index, later rev: gamma.md changed and no longer says it.
  const now = runQuery({
    repoRoot: repo,
    indexDir: dir,
    terms: ["quarkonium"],
    targetRev: revB,
    verify: true,
    limit: 0,
    filesOnly: false,
  });
  expect(now.kind).toBe("ok");
  if (now.kind !== "ok") throw new Error("unreachable");
  expect(now.hits).toEqual([]);
  rmSync(dir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. IDEMPOTENCY — discipline #6.
// ─────────────────────────────────────────────────────────────────────────────

test("rebuilding at the same rev produces byte-identical files", () => {
  const one = tmpDir("idem1");
  const two = tmpDir("idem2");
  build(revB, one);
  build(revB, two);

  const namesOne = readdirSync(one).sort(compareTerms);
  const namesTwo = readdirSync(two).sort(compareTerms);
  expect(namesTwo).toEqual(namesOne);
  expect(namesOne.length).toBeGreaterThan(2);

  for (const name of namesOne) {
    const a = readFileSync(join(one, name));
    const b = readFileSync(join(two, name));
    // Buffer comparison, not string: the claim is BYTES.
    expect(Buffer.compare(a, b)).toBe(0);
  }
  rmSync(one, { recursive: true, force: true });
  rmSync(two, { recursive: true, force: true });
});

test("the manifest carries no timestamp — a clock in the artifact would make idempotency false", () => {
  const dir = tmpDir("notime");
  build(revB, dir);
  const raw = readFileSync(join(dir, "manifest.json"), "utf8");
  expect(raw).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  for (const key of ["generated", "builtAt", "timestamp", "date"]) {
    expect(raw).not.toContain(`"${key}"`);
  }
  rmSync(dir, { recursive: true, force: true });
});

test("doc ids are derived from the path, so they survive a corpus that grew", () => {
  const one = tmpDir("docid1");
  const two = tmpDir("docid2");
  build(revA, one);
  build(revB, two);
  const idAt = (dir: string, path: string) => {
    for (const line of readFileSync(join(dir, "files.txt"), "utf8").split("\n")) {
      if (line.length === 0) continue;
      const r = parseFileRow(line);
      if (r.path === path) return r.docId;
    }
    return null;
  };
  // delta.md sorts BEFORE gamma.md, so a positional id would have shifted
  // gamma.md when delta.md was added. That shift is what rewrote 279k lines
  // per cadence tick in the measurement recorded in format.ts.
  expect(idAt(two, "docs/delta.md")).not.toBeNull();
  expect(idAt(one, "docs/gamma.md")).toBe(idAt(two, "docs/gamma.md")!);
  rmSync(one, { recursive: true, force: true });
  rmSync(two, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// FRESHNESS CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

test("a diverged index rev is refused — its changed set is not a bounded 'since'", () => {
  const dir = tmpDir("fork");
  build(revFork, dir);
  const f = classifyFreshness(repo, revFork, revB);
  expect(f.kind).toBe("divergent");
  const outcome = runQuery({
    repoRoot: repo,
    indexDir: dir,
    terms: ["landauer"],
    targetRev: revB,
    verify: true,
    limit: 0,
    filesOnly: false,
  });
  expect(outcome.kind).toBe("refused");
  rmSync(dir, { recursive: true, force: true });
});

test("commits that touched no indexable file leave the index effectively fresh", () => {
  const before = git(["rev-parse", "HEAD"]).trim();
  const after = commit({ "notes.unindexed-ext": "irrelevant\n" }, "non-indexable churn");
  expect(classifyFreshness(repo, before, after).kind).toBe("fresh");
  git(["reset", "-q", "--hard", before]);
});

test("the verify budget is a refusal, not a silent unbounded scan", () => {
  // The constant is what stands between this tool and the runaway its sibling
  // ../search.ts exists to prevent. Pin that it is finite and non-trivial.
  expect(Number.isFinite(VERIFY_FILE_BUDGET)).toBe(true);
  expect(VERIFY_FILE_BUDGET).toBeGreaterThan(100);
});

// ─────────────────────────────────────────────────────────────────────────────
// "CANNOT ANSWER" IS NEVER "NO MATCHES" — the other three refusal classes.
// ─────────────────────────────────────────────────────────────────────────────

test("a stop-word query is refused with the reason, not answered with zero", () => {
  const dir = tmpDir("stop");
  build(revB, dir);
  const outcome = runQuery({
    repoRoot: repo,
    indexDir: dir,
    terms: ["the"],
    targetRev: revB,
    verify: true,
    limit: 0,
    filesOnly: false,
  });
  expect(outcome.kind).toBe("refused");
  if (outcome.kind !== "refused") throw new Error("unreachable");
  expect(outcome.detail).toContain("stop word");
  rmSync(dir, { recursive: true, force: true });
});

test("a multi-word phrase is refused with the reason it cannot be answered", () => {
  const a = analyzeQueryTerm("the end of error");
  expect("rejected" in a).toBe(true);
  if (!("rejected" in a)) throw new Error("unreachable");
  // The message must say WHY — no positions — or the next agent files it as a bug.
  expect(a.rejected).toContain("no positions");
});

test("a term above the df cap is refused WITH ITS COUNT, never reported absent", () => {
  const dir = tmpDir("cap");
  // 40 files all containing `ubiquitous`, with a cap of 5.
  const many: Record<string, string> = {};
  for (let i = 0; i < 40; i++) many[`bulk/f${i}.md`] = "ubiquitous filler\n";
  const rev = commit(many, "bulk");
  buildIndex({ repoRoot: repo, rev, outDir: dir, quiet: true, maxDf: 5 });
  const outcome = runQuery({
    repoRoot: repo,
    indexDir: dir,
    terms: ["ubiquitous"],
    targetRev: rev,
    verify: true,
    limit: 0,
    filesOnly: false,
  });
  expect(outcome.kind).toBe("refused");
  if (outcome.kind !== "refused") throw new Error("unreachable");
  expect(outcome.detail).toContain("40");
  expect(outcome.detail).toContain("not an empty result");
  git(["reset", "-q", "--hard", revB]);
  git(["clean", "-qfd"]);
  rmSync(dir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// TOKENIZER — the two misses that were found by diffing against `git grep`.
// ─────────────────────────────────────────────────────────────────────────────

test("typographic punctuation SEPARATES words (the Landauer-en-dash-Bennett miss)", () => {
  // U+2013 EN DASH. v1 treated every codepoint >= U+0080 as a token character,
  // welding this into one token, and a real file went missing from the index.
  expect(tokenize("Landauer–Bennett")).toContain("landauer");
  expect(tokenize("Landauer–Bennett")).toContain("bennett");
  expect(tokenize("Mirror → Beacon")).toEqual(["mirror", "beacon"]);
  expect(tokenize("a b cd")).toEqual(["cd"]);
});

test("compound identifiers index as their parts AND whole (the verifyLandauer miss)", () => {
  expect(tokenize("verifyLandauer")).toEqual(["verifylandauer", "verify", "landauer"]);
  expect(tokenize("feedback_landauer_bounded")).toContain("landauer");
  expect(decompose("chip8Emulator")).toEqual(["chip", "8", "Emulator"]);
});

test("stop words are dropped, and the list stays small enough not to eat real terms", () => {
  expect(tokenize("the end of error")).toEqual(["end", "error"]);
  expect(isStopWord("the")).toBe(true);
  // `no`, `on`, `if`, `for`, `in` are stop words in published lists and
  // load-bearing tokens in this repo's YAML and F#. Keeping them is deliberate.
  for (const keep of ["no", "on", "if", "for", "in", "not", "all", "new"]) {
    expect(isStopWord(keep)).toBe(false);
  }
  expect(STOP_WORDS.length).toBeLessThan(60);
});

test("case folding is ASCII-only and does not depend on a Unicode table", () => {
  expect(tokenize("HELLO World")).toEqual(["hello", "world"]);
  // Documented cost of the choice: non-ASCII case is NOT folded. Pinned so the
  // README's claim is checked rather than asserted.
  expect(tokenize("Über")).toEqual(["Über"]);
});

test("a pathological run is dropped whole rather than decomposed into junk", () => {
  const blob = "a".repeat(MAX_RUN_LENGTH + 1);
  expect(tokenize(blob)).toEqual([]);
  expect(tokenize("a".repeat(MAX_RUN_LENGTH)).length).toBe(0); // still > MAX_TOKEN_LENGTH
});

// ─────────────────────────────────────────────────────────────────────────────
// COLLATION — the culture-invariant treaty, proven to DISCRIMINATE.
// ─────────────────────────────────────────────────────────────────────────────

test("terms are ordered by the collation treaty, which DIVERGES from locale order", () => {
  const dir = tmpDir("order");
  build(revB, dir);
  for (const name of readdirSync(dir)) {
    if (!name.startsWith("terms-")) continue;
    const rows = readFileSync(join(dir, name), "utf8").split("\n").filter(Boolean).map(parseTermRow);
    for (let i = 1; i < rows.length; i++) {
      expect(compareTerms(rows[i - 1]!.t, rows[i]!.t)).toBeLessThan(0);
    }
  }
  // The divergence IS the assertion: byte order puts every uppercase letter
  // before every lowercase one; `en` locale order interleaves them. If these
  // agreed, the ordering test above would pin nothing.
  expect(compareTerms("Z", "a")).toBeLessThan(0);
  expect("Z".localeCompare("a", "en")).toBeGreaterThan(0);
  rmSync(dir, { recursive: true, force: true });
});

test("postings inside a row are ordered, so a row is a function of its SET", () => {
  const dir = tmpDir("porder");
  build(revB, dir);
  const rows = readFileSync(join(dir, "terms-l.jsonl"), "utf8").split("\n").filter(Boolean).map(parseTermRow);
  for (const row of rows) {
    for (let i = 1; i < row.p.length; i++) {
      expect(compareTerms(row.p[i - 1]![0], row.p[i]![0])).toBeLessThan(0);
    }
  }
  rmSync(dir, { recursive: true, force: true });
});

test("a term row renders with pinned key order, not object-construction order", () => {
  expect(
    renderTermRow({
      t: "x",
      p: [
        ["ab", 2],
        ["cd", 1],
      ],
    }),
  ).toBe('{"t":"x","p":[["ab",2],["cd",1]]}');
});

// ─────────────────────────────────────────────────────────────────────────────
// CORPUS POLICY — declared, measured, never silent.
// ─────────────────────────────────────────────────────────────────────────────

test("every excluded tree carries a dated measurement", () => {
  // The precedent is ../exclusions.ts: the prose that named `references/prior-art`
  // as the heavy tree was wrong by three orders of magnitude because nobody had
  // measured it. An exclusion without a number is folklore.
  expect(EXCLUDED_TREES.length).toBeGreaterThan(0);
  for (const t of EXCLUDED_TREES) {
    expect(t.prefix.endsWith("/")).toBe(true);
    expect(t.measurement.length).toBeGreaterThan(40);
    expect(t.measurement).toMatch(/\d/);
  }
});

test("the corpus predicate is an allowlist, and exclusions beat it", () => {
  expect(isIndexablePath("docs/x.md")).toBe(true);
  expect(isIndexablePath("src/a/b.ts")).toBe(true);
  expect(isIndexablePath("img/logo.png")).toBe(false);
  expect(isExcluded("docs/github/prs/shards/002/x.json")).toBe(true);
  expect(isIndexablePath("docs/github/prs/shards/002/x.json")).toBe(false);
});

test("the df cap scales with the corpus and has a floor", () => {
  expect(documentFrequencyCap(10)).toBe(MIN_DOCUMENT_FREQUENCY_CAP);
  expect(documentFrequencyCap(32936)).toBe(659);
  // The cap that shipped must not refuse the query this work-item exists for:
  // `landauer` was in 447 of 32,936 files at rev 6426eacf.
  expect(documentFrequencyCap(32936)).toBeGreaterThan(447);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE TWO DEFECTS FOUND BY READING THE FIRST POST-MERGE QUERY ON main.
// ─────────────────────────────────────────────────────────────────────────────

test("the index does not index ITSELF — a feedback loop, not a corpus", () => {
  // 7 of the artifact's own files sit under the blob-size cap, so without this
  // exclusion the next rebuild indexes the previous one: every term in the index
  // becomes a term in the index, and every path in files.txt becomes a hit for
  // itself. The large shards were excluded only by the size cap, which is luck.
  expect(isIndexablePath("db/search-index/inverted/files.txt")).toBe(false);
  expect(isIndexablePath("db/search-index/inverted/manifest.json")).toBe(false);
  expect(isIndexablePath("db/search-index/inverted/high-df.jsonl")).toBe(false);
  expect(isIndexablePath("db/search-index/inverted/terms-z.jsonl")).toBe(false);
});

test("a REPAIRED stale index agrees with a FRESH one — the two paths cannot disagree", () => {
  // The bug this pins: `isIndexablePath` answers from the path alone, but the
  // builder ALSO applies a blob-size cap. So the changed set admitted files the
  // index would never contain, the verifier grepped them, and a stale query
  // returned a hit a fresh query did not. Same question, two answers, decided by
  // how stale the index happened to be.
  const dir = tmpDir("agree");
  build(revA, dir);

  const oversize = "docs/huge.md";
  const rev = commit(
    { [oversize]: "landauer ".repeat(80_000), "docs/small.md": "landauer here\n" },
    "add an oversize blob and a small one",
  );

  const repaired = runQuery({
    repoRoot: repo,
    indexDir: dir,
    terms: ["landauer"],
    targetRev: rev,
    verify: true,
    limit: 0,
    filesOnly: false,
  });

  const freshDir = tmpDir("agree-fresh");
  build(rev, freshDir);
  const fresh = runQuery({
    repoRoot: repo,
    indexDir: freshDir,
    terms: ["landauer"],
    targetRev: rev,
    verify: true,
    limit: 0,
    filesOnly: false,
  });

  expect(repaired.kind).toBe("ok");
  expect(fresh.kind).toBe("ok");
  if (repaired.kind !== "ok" || fresh.kind !== "ok") throw new Error("unreachable");
  const paths = (o: typeof fresh) => o.hits.map((h) => h.path).sort(compareTerms);
  // The oversize blob is in NEITHER answer, and the small one is in both.
  expect(paths(repaired)).toEqual(paths(fresh));
  expect(paths(fresh)).toContain("docs/small.md");
  expect(paths(fresh)).not.toContain(oversize);

  git(["reset", "-q", "--hard", revB]);
  git(["clean", "-qfd"]);
  rmSync(dir, { recursive: true, force: true });
  rmSync(freshDir, { recursive: true, force: true });
});

test("the retraction set stays WIDER than the verify set — a file that grew past the cap loses its hit", () => {
  const dir = tmpDir("wider");
  build(revA, dir);
  // alpha.md is in the index with `landauer`. Grow it past the cap: a fresh index
  // would drop it, so the repaired answer must drop it too — and it must not be
  // grepped, because the builder would not have read it either.
  const rev = commit({ "docs/alpha.md": "landauer ".repeat(80_000) }, "alpha grows past the cap");
  const f = classifyFreshness(repo, revA, rev);
  expect(f.kind).toBe("behind");
  if (f.kind !== "behind") throw new Error("unreachable");
  expect(f.changed).toContain("docs/alpha.md");
  expect(f.verifiable).not.toContain("docs/alpha.md");

  const out = runQuery({
    repoRoot: repo,
    indexDir: dir,
    terms: ["landauer"],
    targetRev: rev,
    verify: true,
    limit: 0,
    filesOnly: false,
  });
  expect(out.kind).toBe("ok");
  if (out.kind !== "ok") throw new Error("unreachable");
  expect(out.hits.map((h) => h.path)).not.toContain("docs/alpha.md");

  git(["reset", "-q", "--hard", revB]);
  git(["clean", "-qfd"]);
  rmSync(dir, { recursive: true, force: true });
});

test("shard placement is a pure function of the term", () => {
  expect(shardOf("landauer")).toBe("l");
  expect(shardOf("2026")).toBe("2");
  expect(shardOf("Über")).toBe("_");
});
