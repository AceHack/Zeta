import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildSeedCommitRequest,
  buildSeedTreeRequest,
  computeSeedTree,
  diffSeedTree,
  gitBlobSha,
  parseGitTreeResponse,
  parseSeedManifest,
  resolveSeedFiles,
  seedCommitMessage,
} from "./seed-test-repo.ts";

describe("parseSeedManifest", () => {
  test("extracts include and exclude entries from fenced yaml", () => {
    const manifest = parseSeedManifest([
      "intro",
      "```yaml",
      "include:",
      "  - openspec/specs/**/spec.md",
      "  - src/Core/README.md          # if exists",
      "",
      "exclude:",
      "  - AGENTS.md",
      "  - docs/**  # except bootstrap-razor/ itself",
      "```",
      "outro",
    ].join("\n"));

    expect(manifest).toEqual({
      include: ["openspec/specs/**/spec.md", "src/Core/README.md"],
      exclude: ["AGENTS.md", "docs/**"],
    });
  });
});

describe("resolveSeedFiles", () => {
  const manifest = {
    include: ["openspec/specs/**/spec.md", "tools/tla/specs/*.tla", "src/Core/README.md"],
    exclude: ["src/**/*.fs", "docs/**"],
  };

  test("keeps include-matched paths and drops non-matches", () => {
    const candidates = [
      "openspec/specs/foo/spec.md",
      "tools/tla/specs/Bar.tla",
      "src/Core/README.md",
      "tools/hygiene/audit.ts", // matches no include
    ];
    expect(resolveSeedFiles(candidates, manifest)).toEqual([
      "openspec/specs/foo/spec.md",
      "src/Core/README.md",
      "tools/tla/specs/Bar.tla",
    ]);
  });

  test("a path matching no include pattern never appears", () => {
    const candidates = [
      "src/Core/README.md", // included, not excluded → kept
      "src/Core/Engine.fs", // matches no include → dropped
    ];
    expect(resolveSeedFiles(candidates, manifest)).toEqual(["src/Core/README.md"]);
  });

  test("exclude wins over include (include ∧ ¬exclude)", () => {
    const overlap = {
      include: ["src/**/*.md"],
      exclude: ["src/Core/**"],
    };
    const candidates = ["src/Core/README.md", "src/Other/README.md"];
    expect(resolveSeedFiles(candidates, overlap)).toEqual(["src/Other/README.md"]);
  });

  test("result is sorted", () => {
    const candidates = ["tools/tla/specs/Z.tla", "tools/tla/specs/A.tla"];
    expect(resolveSeedFiles(candidates, manifest)).toEqual([
      "tools/tla/specs/A.tla",
      "tools/tla/specs/Z.tla",
    ]);
  });

  test("empty candidate list resolves to empty set", () => {
    expect(resolveSeedFiles([], manifest)).toEqual([]);
  });
});

describe("gitBlobSha", () => {
  // Canonical `git hash-object` values: `git hash-object --stdin < /dev/null`
  // and `printf 'hello\n' | git hash-object --stdin`. Hardcoding them proves the
  // implementation matches git's own blob identity (which GitHub's API returns).
  test("empty content matches git's empty-blob SHA", () => {
    expect(gitBlobSha(new Uint8Array(0))).toBe("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
  });

  test("'hello\\n' matches git hash-object", () => {
    expect(gitBlobSha(Buffer.from("hello\n", "utf8"))).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
  });

  test("uses raw byte length, not character count, for multi-byte content", () => {
    // "é" is 2 bytes in UTF-8; the header must read `blob 2\0`, not `blob 1\0`.
    // `printf 'é' | git hash-object --stdin` → this SHA.
    expect(gitBlobSha(Buffer.from("é", "utf8"))).toBe("4b04fff51468d8ab5201ab02b725dc477bc7cb45");
  });
});

describe("computeSeedTree", () => {
  test("pairs each resolved path with the git blob SHA of its bytes, canonically sorted by path", () => {
    const root = mkdtempSync(join(tmpdir(), "b0343-seed-tree-"));
    writeFileSync(join(root, "a.txt"), "hello\n");
    writeFileSync(join(root, "b.txt"), "");

    // Intentionally UNSORTED input: the documented contract is that output is
    // canonically sorted by path regardless of caller order. Asserting against
    // sorted output means this test fails if `computeSeedTree` ever reverts to
    // preserving input order.
    expect(computeSeedTree(["b.txt", "a.txt"], root)).toEqual([
      { path: "a.txt", sha: "ce013625030ba8dba906f756967f9e9ca394464a" },
      { path: "b.txt", sha: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391" },
    ]);
  });

  test("empty resolved set produces empty tree", () => {
    expect(computeSeedTree([], tmpdir())).toEqual([]);
  });
});

describe("diffSeedTree", () => {
  const a = { path: "a.txt", sha: "aaa" };
  const b = { path: "b.txt", sha: "bbb" };
  const c = { path: "c.txt", sha: "ccc" };

  test("empty target → every desired path is a create, not idempotent", () => {
    expect(diffSeedTree([b, a], [])).toEqual({
      entries: [
        { path: "a.txt", action: "create", desiredSha: "aaa", existingSha: null },
        { path: "b.txt", action: "create", desiredSha: "bbb", existingSha: null },
      ],
      extraneous: [],
      idempotent: false,
    });
  });

  test("identical target → all unchanged and idempotent", () => {
    expect(diffSeedTree([a, b], [a, b])).toEqual({
      entries: [
        { path: "a.txt", action: "unchanged", desiredSha: "aaa", existingSha: "aaa" },
        { path: "b.txt", action: "unchanged", desiredSha: "bbb", existingSha: "bbb" },
      ],
      extraneous: [],
      idempotent: true,
    });
  });

  test("differing blob SHA → update, not idempotent", () => {
    const diff = diffSeedTree([a], [{ path: "a.txt", sha: "OLD" }]);
    expect(diff.entries).toEqual([
      { path: "a.txt", action: "update", desiredSha: "aaa", existingSha: "OLD" },
    ]);
    expect(diff.idempotent).toBe(false);
  });

  test("extraneous target file is reported but does NOT break idempotency", () => {
    // Target has the desired file (matching) plus an extra file (e.g. auto-README).
    const diff = diffSeedTree([a], [a, c]);
    expect(diff.entries).toEqual([
      { path: "a.txt", action: "unchanged", desiredSha: "aaa", existingSha: "aaa" },
    ]);
    expect(diff.extraneous).toEqual([c]);
    expect(diff.idempotent).toBe(true);
  });

  test("mixed create/update/unchanged → not idempotent, entries path-sorted", () => {
    // desired: a (matches), b (differs → update), c (absent → create); given unsorted.
    const diff = diffSeedTree([c, b, a], [a, { path: "b.txt", sha: "OLD" }]);
    expect(diff.entries).toEqual([
      { path: "a.txt", action: "unchanged", desiredSha: "aaa", existingSha: "aaa" },
      { path: "b.txt", action: "update", desiredSha: "bbb", existingSha: "OLD" },
      { path: "c.txt", action: "create", desiredSha: "ccc", existingSha: null },
    ]);
    expect(diff.idempotent).toBe(false);
  });

  test("empty desired and empty target → vacuously idempotent", () => {
    expect(diffSeedTree([], [])).toEqual({ entries: [], extraneous: [], idempotent: true });
  });
});

describe("parseGitTreeResponse", () => {
  // Shape mirrors GitHub's GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1.
  test("keeps blobs as {path, sha}, drops tree + commit entries, sorts by path", () => {
    const response = {
      sha: "root",
      truncated: false,
      tree: [
        { path: "z.txt", mode: "100644", type: "blob", sha: "zzz", size: 3, url: "..." },
        { path: "sub", mode: "040000", type: "tree", sha: "treeSha", url: "..." },
        { path: "a.txt", mode: "100644", type: "blob", sha: "aaa", size: 1, url: "..." },
        { path: "vendored", mode: "160000", type: "commit", sha: "submoduleSha" },
      ],
    };
    expect(parseGitTreeResponse(response)).toEqual([
      { path: "a.txt", sha: "aaa" },
      { path: "z.txt", sha: "zzz" },
    ]);
  });

  test("the parsed blob set feeds diffSeedTree directly (end-to-end bridge)", () => {
    const existing = parseGitTreeResponse({
      truncated: false,
      tree: [{ path: "a.txt", type: "blob", sha: "aaa" }],
    });
    // Narrow off the error branch so the diff call type-checks.
    if (typeof existing === "string") throw new Error(existing);
    expect(diffSeedTree([{ path: "a.txt", sha: "aaa" }], existing).idempotent).toBe(true);
  });

  test("empty tree → empty blob set", () => {
    expect(parseGitTreeResponse({ truncated: false, tree: [] })).toEqual([]);
  });

  test("truncated response is rejected (unsafe idempotency basis)", () => {
    const result = parseGitTreeResponse({
      truncated: true,
      tree: [{ path: "a.txt", type: "blob", sha: "aaa" }],
    });
    expect(typeof result).toBe("string");
    expect(result).toContain("truncated");
  });

  test("non-object response is rejected", () => {
    expect(typeof parseGitTreeResponse(null)).toBe("string");
    expect(typeof parseGitTreeResponse("oops")).toBe("string");
  });

  test("missing tree array is rejected", () => {
    expect(typeof parseGitTreeResponse({ truncated: false })).toBe("string");
  });

  test("tree entry missing string path/type/sha is rejected", () => {
    const result = parseGitTreeResponse({
      truncated: false,
      tree: [{ path: "a.txt", type: "blob" }], // no sha
    });
    expect(typeof result).toBe("string");
  });
});

describe("buildSeedTreeRequest", () => {
  const a = { path: "a.txt", sha: "aaa" };
  const b = { path: "b.txt", sha: "bbb" };

  test("create + update become 100644 blob entries carrying the DESIRED sha", () => {
    // desired: a (matches → unchanged, dropped), b (differs → update), c (absent → create)
    const diff = diffSeedTree(
      [a, b, { path: "c.txt", sha: "ccc" }],
      [a, { path: "b.txt", sha: "OLD" }],
    );
    expect(buildSeedTreeRequest(diff)).toEqual([
      // b.txt update carries desiredSha "bbb", NOT the existing "OLD"
      { path: "b.txt", mode: "100644", type: "blob", sha: "bbb" },
      { path: "c.txt", mode: "100644", type: "blob", sha: "ccc" },
    ]);
  });

  test("idempotent diff → empty write plan (no tree to submit)", () => {
    expect(buildSeedTreeRequest(diffSeedTree([a, b], [a, b]))).toEqual([]);
  });

  test("fresh (empty) repo → every desired path is a create entry", () => {
    expect(buildSeedTreeRequest(diffSeedTree([b, a], []))).toEqual([
      { path: "a.txt", mode: "100644", type: "blob", sha: "aaa" },
      { path: "b.txt", mode: "100644", type: "blob", sha: "bbb" },
    ]);
  });

  test("output stays path-sorted (inherits diffSeedTree's canonical order)", () => {
    const plan = buildSeedTreeRequest(
      diffSeedTree([{ path: "z.txt", sha: "zzz" }, { path: "a.txt", sha: "aaa" }], []),
    );
    expect(plan.map((e) => e.path)).toEqual(["a.txt", "z.txt"]);
  });

  test("extraneous target files never enter the write plan (seed is add/update only)", () => {
    // Target has the desired file (matching) plus an extra auto-README.
    const diff = diffSeedTree([a], [a, { path: "README.md", sha: "readme" }]);
    expect(diff.extraneous).toEqual([{ path: "README.md", sha: "readme" }]);
    expect(buildSeedTreeRequest(diff)).toEqual([]); // a.txt unchanged, README extraneous → nothing to write
  });
});

describe("seedCommitMessage", () => {
  test("subject names the file count, body cites the manifest + B-0193/B-0343 lineage", () => {
    const message = seedCommitMessage(7);
    const [subject, ...rest] = message.split("\n");
    expect(subject).toBe("chore(B-0343): seed bootstrap-razor recreation test repo (7 files)");
    const body = rest.join("\n");
    expect(body).toContain("docs/bootstrap-razor/SEED-MANIFEST.md");
    expect(body).toContain("B-0193");
    expect(body).toContain("B-0343");
  });

  test("pluralizes the count noun (1 file vs N files)", () => {
    expect(seedCommitMessage(1)).toContain("(1 file)");
    expect(seedCommitMessage(2)).toContain("(2 files)");
  });

  test("subject and body are separated by a blank line (git convention)", () => {
    // git treats the first blank-line-delimited block as the subject; assert the
    // second line is empty so tools that render subject/body split correctly.
    expect(seedCommitMessage(3).split("\n")[1]).toBe("");
  });
});

describe("buildSeedCommitRequest", () => {
  test("existing ref → parent SHA wrapped in a one-element array", () => {
    expect(buildSeedCommitRequest("treeSha", "parentSha", 2)).toEqual({
      message: seedCommitMessage(2),
      tree: "treeSha",
      parents: ["parentSha"],
    });
  });

  test("brand-new repo (null parent) → empty parents array (root commit)", () => {
    const request = buildSeedCommitRequest("treeSha", null, 5);
    expect(request.parents).toEqual([]);
    expect(request.tree).toBe("treeSha");
  });

  test("carries the provenance message for the given file count", () => {
    expect(buildSeedCommitRequest("t", "p", 1).message).toBe(seedCommitMessage(1));
  });
});
