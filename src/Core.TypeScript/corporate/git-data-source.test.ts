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
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  DEFAULT_TEXT_EXTENSIONS,
  gitDataSource,
  MAX_DOCUMENT_BYTES,
  simulatedDataSource,
  unionOf,
} from "./git-data-source";
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

describe("TEXT ONLY", () => {
  test("the default extension list holds no binary formats", () => {
    // `no-binary-in-proof-lineage`: a grooming artifact citing a `.png` cites something nobody can
    // check, and decoding one would put replacement characters into an agent's context.
    //
    // The claim rides on a POSITIVE exact-equality pin, not an absence check. An `not.toContain`
    // per binary extension only witnesses the six renderings we happened to name; a seventh binary
    // format silently added to the allowlist would pass every one of them. Pinning the whole list
    // makes ANY addition — binary or otherwise — fail here until the maintainer restates the set.
    expect([...DEFAULT_TEXT_EXTENSIONS]).toEqual([".md", ".txt", ".json", ".yml", ".yaml", ".toml", ".csv"]);

    // And, redundantly but explicitly: the intersection with a known binary set is empty. Expressed
    // as an equality on the computed intersection so the check itself can fail rather than assert an
    // absence.
    const binary = [".png", ".jpg", ".pdf", ".wasm", ".zip", ".exe"];
    const leaked = DEFAULT_TEXT_EXTENSIONS.filter((e) => binary.includes(e));
    expect(leaked).toEqual([]);
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
