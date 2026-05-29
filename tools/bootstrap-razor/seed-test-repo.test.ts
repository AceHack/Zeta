import { describe, expect, test } from "bun:test";

import { parseSeedManifest, resolveSeedFiles } from "./seed-test-repo.ts";

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
