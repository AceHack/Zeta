import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { computeSeedTree, gitBlobSha, parseSeedManifest, resolveSeedFiles } from "./seed-test-repo.ts";

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
