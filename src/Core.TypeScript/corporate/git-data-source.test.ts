/**
 * git-data-source.test.ts — a repository that could not be read is not an empty repository.
 *
 * The disagreement with the pattern this borrows from is the load-bearing test here.
 * `agent-bus/subscribe.ts` ends its git call with `catch { return []; }`, which for a bus folder
 * that legitimately does not exist yet is defensible. For a data source it would make an
 * unreachable repository indistinguishable from one holding nothing — so an agent would groom
 * against silence while reporting it had consulted the source.
 *
 * These tests run against THIS repository, because a git adapter tested against a mock of git tests
 * the mock. The assertions are chosen to hold for any commit: counts and shapes, never contents.
 */

import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DEFAULT_TEXT_EXTENSIONS, MAX_DOCUMENT_BYTES, directoryDataSource, gitDataSource, simulatedDataSource, unionOf, readBlobs } from "./git-data-source";
import { Fidelity, Port, type SourceDocument } from "./providers";

const REPO = process.cwd();
const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf-8" }).trim();

/** A small, stable subtree of this repository, so the tests stay quick. */
const source = () =>
  gitDataSource({ repoDir: REPO, ref: "HEAD", subdir: "docs/DECISIONS", extensions: [".md"] });

describe("A MISSING REF REFUSES — the deliberate departure from the bus reader", () => {
  test("an unresolvable ref is a refusal, NOT an empty document set", async () => {
    // If this returned `{ ok: true, value: [] }` an agent would groom against silence and report
    // that it had read the repository. "Unreachable" and "holds nothing" are the two sentences that
    // must never be confused, and only one of them means it is safe to proceed.
    const r = await gitDataSource({ repoDir: REPO, ref: "no-such-ref-xyz" }).read();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("could not resolve");
  });

  test("a directory that is not a repository refuses", async () => {
    const r = await gitDataSource({ repoDir: `${REPO}/does-not-exist-here`, ref: "HEAD" }).read();
    expect(r.ok).toBe(false);
  });

  test("a query over an unreadable source refuses too, rather than finding nothing", async () => {
    // The subtler half: `query` folds over `read`, so a refusal has to propagate. Returning zero
    // hits would read as "the organization has no prior art on this", which is a claim.
    const r = await gitDataSource({ repoDir: REPO, ref: "no-such-ref-xyz" }).query("anything");
    expect(r.ok).toBe(false);
  });

  test("an EMPTY BUT READABLE subtree is an empty answer, not a refusal", async () => {
    // The other direction, and the reason the refusal above is not simply pessimism: a real subtree
    // with nothing matching is a genuine empty result.
    const r = await gitDataSource({
      repoDir: REPO,
      ref: "HEAD",
      subdir: "docs/DECISIONS",
      extensions: [".no-such-extension"],
    }).read();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([]);
  });
});

describe("documents are CITABLE — read at a resolved commit, not at a moving name", () => {
  test("every document carries the resolved sha, never the ref it was asked for", async () => {
    // A ref is a moving name: `origin/main` means something else tomorrow, so a citation naming it
    // rots. Resolving once also makes the whole read consistent — every document from one commit.
    const r = await source().read();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.length).toBeGreaterThan(0);
    for (const d of r.value.slice(0, 5)) {
      expect(d.revision).toBe(HEAD);
      expect(d.ref).toBe(`git:${HEAD}:${d.path}`);
      expect(d.ref).not.toContain("HEAD:");
    }
  });

  test("the ref points at something a reviewer can actually open", async () => {
    // The property that makes grooming falsifiable: `git show <sha>:<path>` has to work.
    const r = await source().read();
    if (!r.ok) throw new Error(r.reason);
    const first = r.value[0];
    expect(first).toBeDefined();
    const shown = execFileSync("git", ["show", `${first!.revision}:${first!.path}`], {
      cwd: REPO,
      encoding: "utf-8",
    });
    expect(shown.slice(0, 200)).toBe(first!.content.slice(0, 200));
  });

  test("paths are ordered ORDINALLY, not by locale", async () => {
    // Two machines reading one commit must produce the same order, or a fold over the same history
    // yields different results.
    const r = await source().read();
    if (!r.ok) throw new Error(r.reason);
    const paths = r.value.map((d) => d.path);
    expect([...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(paths);
    expect("B" < "a").toBe(true);
  });

  test("reading the same commit twice yields identical documents — idempotent", async () => {
    const a = await source().read();
    const b = await source().read();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("THE BATCHED READ IS BYTE-EXACT", () => {
  const KNOWN = "docs/DECISIONS/2026-09-06-the-delivery-lifecycle-audited-against-what-was-asked-for.md";

  test("a blob matches `git show` exactly, to the byte", () => {
    // `cat-file --batch` gives a BYTE length and the stream is parsed as a Buffer for that reason:
    // decoding as UTF-8 first puts every offset after the first non-ASCII character out by one,
    // and these documents are full of em-dashes. An off-by-one here silently truncates every
    // document in the repository by one character, which nothing else would notice.
    const viaShow = execFileSync("git", ["show", `${HEAD}:${KNOWN}`], {
      cwd: REPO,
      encoding: "utf-8",
      maxBuffer: 32 * 1024 * 1024,
    });
    const viaBatch = readBlobs(REPO, HEAD, [KNOWN]).get(KNOWN);
    expect(viaBatch).toBe(viaShow);
  });

  test("several blobs in one call are each byte-exact, so the offsets carry", () => {
    // The failure mode a single-file test cannot see: the cursor must advance past each blob AND
    // the newline git writes after it, or every document after the first is shifted.
    const listing = execFileSync("git", ["ls-tree", "-r", "--name-only", HEAD, "--", "docs/DECISIONS"], {
      cwd: REPO,
      encoding: "utf-8",
      maxBuffer: 32 * 1024 * 1024,
    });
    const paths = listing.split("\n").filter((p) => p.endsWith(".md")).slice(0, 6);
    expect(paths.length).toBeGreaterThan(1);

    const batch = readBlobs(REPO, HEAD, paths);
    for (const path of paths) {
      const viaShow = execFileSync("git", ["show", `${HEAD}:${path}`], {
        cwd: REPO,
        encoding: "utf-8",
        maxBuffer: 32 * 1024 * 1024,
      });
      expect(batch.get(path)).toBe(viaShow);
    }
  });

  test("a path that does not exist at that revision is ABSENT, not empty", () => {
    // Absent and empty are the two answers that must never be confused: an empty string would let
    // the caller hand an agent a document that does not exist, and the caller's refusal — which
    // turns a missing blob into a failed read rather than a shorter document set — depends on
    // telling them apart.
    const got = readBlobs(REPO, HEAD, ["docs/DECISIONS/no-such-file-xyz.md"]);
    expect(got.has("docs/DECISIONS/no-such-file-xyz.md")).toBe(false);
  });

  test("a missing path does not shift the blobs asked for alongside it", () => {
    const got = readBlobs(REPO, HEAD, ["docs/DECISIONS/no-such-file-xyz.md", KNOWN]);
    const viaShow = execFileSync("git", ["show", `${HEAD}:${KNOWN}`], {
      cwd: REPO,
      encoding: "utf-8",
      maxBuffer: 32 * 1024 * 1024,
    });
    expect(got.get(KNOWN)).toBe(viaShow);
  });

  test("asking for nothing runs no subprocess and returns nothing", () => {
    expect(readBlobs(REPO, HEAD, []).size).toBe(0);
  });
});

describe("TEXT ONLY", () => {
  test("the default extension list holds no binary formats", () => {
    // `no-binary-in-proof-lineage`: a grooming artifact citing a `.png` cites something nobody can
    // check, and decoding one would put replacement characters into an agent's context.
    for (const bad of [".png", ".jpg", ".pdf", ".wasm", ".zip", ".exe"]) {
      expect(DEFAULT_TEXT_EXTENSIONS).not.toContain(bad);
    }
  });

  test("a file outside the extension list is not read at all", async () => {
    const r = await gitDataSource({ repoDir: REPO, ref: "HEAD", subdir: "docs/DECISIONS", extensions: [".md"] }).read();
    if (!r.ok) throw new Error(r.reason);
    for (const d of r.value) expect(d.path.endsWith(".md")).toBe(true);
  });

  test("AN OVERSIZED FILE IS CITED AND NOT INLINED — a third state, not a failure", async () => {
    // Found by running this against the repository rather than by reading the code: the first
    // draft truncated only AFTER `git show` returned, so one multi-megabyte document blew past the
    // subprocess buffer and refused the whole read. Sizes now come from `ls-tree -l`, so an
    // oversized blob is cited with a marker and the other four hundred documents still arrive.
    const r = await gitDataSource({
      repoDir: REPO,
      ref: "HEAD",
      subdir: "docs/amara-full-conversation",
      extensions: [".md"],
    }).read();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const big = r.value.filter((d) => d.content.startsWith("[not inlined:"));
    expect(big.length).toBeGreaterThan(0);
    // The citation still points at real bytes a reviewer can open.
    for (const d of big.slice(0, 2)) {
      expect(d.ref).toBe(`git:${HEAD}:${d.path}`);
      expect(() =>
        execFileSync("git", ["cat-file", "-e", `${d.revision}:${d.path}`], { cwd: REPO }),
      ).not.toThrow();
    }
  });

  test("nothing is inlined beyond the limit without saying so", async () => {
    const r = await source().read();
    if (!r.ok) throw new Error(r.reason);
    for (const d of r.value) {
      expect(d.content.length <= MAX_DOCUMENT_BYTES || d.content.startsWith("[not inlined:")).toBe(true);
    }
  });
});

describe("query", () => {
  test("it matches on content as well as path", async () => {
    const r = await source().query("promotion gate");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.length).toBeGreaterThan(0);
  });

  test("a term nobody has written about finds nothing, and that is a real answer", async () => {
    const r = await source().query("zzz-no-such-term-in-any-document-zzz");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([]);
  });
});

describe("the UNION is a G-Set — grow-only, commutative, idempotent", () => {
  const doc = (path: string, revision: string): SourceDocument => ({
    path,
    revision,
    content: `body of ${path}`,
    ref: `s:${revision}:${path}`,
  });

  test("the same document from two sources is counted ONCE", async () => {
    // Keyed by ref, which contains the revision — the idempotence half of the CRDT laws.
    const a = simulatedDataSource([doc("x.md", "r1")], "a");
    const b = simulatedDataSource([doc("x.md", "r1")], "b");
    const r = await unionOf([a, b]).read();
    if (!r.ok) throw new Error(r.reason);
    expect(r.value.length).toBe(1);
  });

  test("the same file at two revisions is TWO documents", async () => {
    // The revision is part of the key on purpose: the same path at two commits is two different
    // things to cite, and collapsing them would make a citation ambiguous.
    const r = await unionOf([
      simulatedDataSource([doc("x.md", "r1")], "a"),
      simulatedDataSource([doc("x.md", "r2")], "b"),
    ]).read();
    if (!r.ok) throw new Error(r.reason);
    expect(r.value.length).toBe(2);
  });

  test("MERGE ORDER DOES NOT MATTER — commutativity, visible in the output", async () => {
    const a = simulatedDataSource([doc("b.md", "r1")], "a");
    const b = simulatedDataSource([doc("a.md", "r1")], "b");
    const ab = await unionOf([a, b]).read();
    const ba = await unionOf([b, a]).read();
    if (!ab.ok || !ba.ok) throw new Error("union refused");
    // Asserted on the VALUES, not just the counts: a union whose order depended on the argument
    // order would still have equal lengths, and commutativity has to be visible to be worth having.
    expect(ab.value).toEqual(ba.value);
  });

  test("ONE SOURCE REFUSING REFUSES THE WHOLE UNION", async () => {
    // A merged view is the most likely place for a missing repository to hide: unioning only the
    // sources that answered produces a context that looks complete.
    const broken = gitDataSource({ repoDir: REPO, ref: "no-such-ref-xyz", name: "broken" });
    const r = await unionOf([simulatedDataSource([doc("x.md", "r1")], "ok"), broken]).read();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("broken");
  });

  test("A UNION IS ONLY AS REAL AS ITS LEAST-REAL MEMBER", async () => {
    // Otherwise a union containing one fixture reports as a real reading of the world, which is
    // how a fidelity report starts overstating what a run touched.
    const mixed = unionOf([source(), simulatedDataSource([doc("x.md", "r1")], "fixture")]);
    expect(mixed.meta.fidelity).toBe(Fidelity.Simulated);
    expect(unionOf([source(), source()]).meta.fidelity).toBe(Fidelity.Real);
  });

  test("the union is labelled as a data-source port", () => {
    expect(unionOf([source()]).meta.port).toBe(Port.DataSource);
  });
});

describe("the simulated source is LABELLED simulated", () => {
  test("so a run that groomed against a fixture cannot report reading a repository", () => {
    expect(simulatedDataSource([]).meta.fidelity).toBe(Fidelity.Simulated);
    expect(source().meta.fidelity).toBe(Fidelity.Real);
  });
});

/**
 * A REAL temporary repository, built for the properties this repo's own tree cannot distinguish.
 *
 * `docs/DECISIONS` is all lowercase `.md`, so ordinal and locale ordering agree there and dropping
 * the extension filter changes nothing — three mutants survived against it for exactly that reason.
 * A purpose-built repo with mixed case, mixed extensions and a movable branch separates them. It is
 * still a real repository, so this is a fixture rather than a mock of git.
 */
function tempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-gds-"));
  const run = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf-8" });
  run("init", "-q", "-b", "main");
  run("config", "user.email", "t@example.com");
  run("config", "user.name", "T");
  writeFileSync(join(dir, "Beta.md"), "uppercase beta");
  writeFileSync(join(dir, "alpha.md"), "lowercase alpha");
  writeFileSync(join(dir, "notes.txt"), "a text note");
  writeFileSync(join(dir, "data.bin"), "binary-ish payload");
  run("add", "-A");
  run("commit", "-q", "-m", "one");
  return dir;
}

describe("properties this repository's own tree cannot distinguish", () => {
  test("ORDER IS ORDINAL — uppercase sorts before lowercase, as `localeCompare` would not", () => {
    // `"Beta.md" < "alpha.md"` ordinally (uppercase first); most locales order them the other way.
    // Zeta's own docs are uniformly lowercase, so the two agree there and the difference is
    // invisible — which is how a locale-sensitive comparator would have survived review.
    const dir = tempRepo();
    try {
      expect("Beta.md" < "alpha.md").toBe(true);
      expect("Beta.md".localeCompare("alpha.md") > 0).toBe(true);
      const r = gitDataSource({ repoDir: dir, ref: "main", extensions: [".md"] });
      return r.read().then((out) => {
        if (!out.ok) throw new Error(out.reason);
        expect(out.value.map((d) => d.path)).toEqual(["Beta.md", "alpha.md"]);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("THE EXTENSION FILTER IS LOAD-BEARING — other files are not read", async () => {
    const dir = tempRepo();
    try {
      const r = await gitDataSource({ repoDir: dir, ref: "main", extensions: [".md"] }).read();
      if (!r.ok) throw new Error(r.reason);
      const paths = r.value.map((d) => d.path);
      expect(paths).toEqual(["Beta.md", "alpha.md"]);
      expect(paths).not.toContain("data.bin");
      expect(paths).not.toContain("notes.txt");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("A MOVED REF MISSES THE CACHE — stale documents are never served", async () => {
    // The cache is keyed by the RESOLVED revision and the ref is re-resolved every call, so a
    // caller pointing at a moving branch sees the move. Keying on presence alone would pin the
    // source to the first commit it ever read, which for `origin/main` is exactly wrong.
    const dir = tempRepo();
    try {
      const source = gitDataSource({ repoDir: dir, ref: "main", extensions: [".md"] });
      const before = await source.read();
      if (!before.ok) throw new Error(before.reason);
      expect(before.value.length).toBe(2);

      writeFileSync(join(dir, "gamma.md"), "a third document");
      execFileSync("git", ["add", "-A"], { cwd: dir });
      execFileSync("git", ["commit", "-q", "-m", "two"], { cwd: dir });

      const after = await source.read();
      if (!after.ok) throw new Error(after.reason);
      expect(after.value.length).toBe(3);
      expect(after.value[0]!.revision).not.toBe(before.value[0]!.revision);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("...and an UNMOVED ref is served from the cache, identically", async () => {
    const dir = tempRepo();
    try {
      const source = gitDataSource({ repoDir: dir, ref: "main", extensions: [".md"] });
      const a = await source.read();
      const b = await source.read();
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("THE ORGANIZATION'S OWN RECORD IS A SOURCE, AND THE CORPUS IS READ-ONLY", () => {
  const scratch = () => mkdtempSync(join(tmpdir(), "orgrec-"));

  test("it reads the documents the organization wrote, with a citable revision", async () => {
    const dir = scratch();
    mkdirSync(join(dir, "task-011"), { recursive: true });
    writeFileSync(join(dir, "task-011", "brd_approval.md"), "# BRD\n1. archival writes to blob", "utf-8");
    const source = directoryDataSource({ dir });
    const read = await source.read();
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value).toHaveLength(1);
      const doc = read.value[0]!;
      expect(doc.path).toBe("task-011/brd_approval.md");
      // A citation with no revision is not a citation.
      expect(doc.revision).not.toBe("");
      expect(doc.ref).toContain(doc.revision);
      expect(doc.ref).toContain("task-011/brd_approval.md");
    }
  });

  test("a record that does not exist yet is EMPTY, not a refusal", async () => {
    // The first run has written nothing. Refusing here would make `unionOf` refuse, and take the
    // real corpus down with it — the organization would lose its wiki because it had no history.
    const source = directoryDataSource({ dir: join(tmpdir(), "definitely-not-here-" + String(Date.now())) });
    const read = await source.read();
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value).toEqual([]);
  });

  test("query finds by path OR content, so a later phase can reach an earlier conclusion", async () => {
    const dir = scratch();
    writeFileSync(join(dir, "architecture_design.md"), "the archival orchestrator owns this", "utf-8");
    writeFileSync(join(dir, "cost_approval.md"), "no cost implication", "utf-8");
    const source = directoryDataSource({ dir });
    const byContent = await source.query("orchestrator");
    const byPath = await source.query("cost");
    expect(byContent.ok && byContent.value).toHaveLength(1);
    expect(byPath.ok && byPath.value).toHaveLength(1);
  });

  test("THE PORT CANNOT WRITE. The corpus it reads is not something it can edit", () => {
    // This is the guarantee, and it is structural rather than a promise: an organization that
    // rewrites the company wiki as a side effect of grooming a defect is doing damage, and "we will
    // be careful" is not a control. The port surface is read and query. There is nowhere to put a
    // write, so no adapter can grow one without changing this interface in front of a reviewer.
    const source = directoryDataSource({ dir: tmpdir() });
    expect(Object.keys(source).sort()).toEqual(["meta", "query", "read"]);
  });

  test("ordering is ORDINAL, so two runs see the same corpus in the same order", async () => {
    const dir = scratch();
    for (const n of ["c.md", "a.md", "b.md"]) writeFileSync(join(dir, n), n, "utf-8");
    const read = await directoryDataSource({ dir }).read();
    expect(read.ok && read.value.map((d) => d.path)).toEqual(["a.md", "b.md", "c.md"]);
  });
});
