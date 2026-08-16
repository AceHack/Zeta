// gen-layout-drift.test.ts — proves the drift check can FAIL.
//
// A check nobody has watched fail is a check nobody knows works. Each case below
// mutates one thing and asserts the finding, and each one passes on the unmutated
// tree — so the guard discriminates rather than merely agreeing.
//
// The mutations are applied to a COPY under a fresh mkdtemp directory; the real
// worktree is never written to.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  LANES,
  LAYOUT_YAML_PATH,
  checkLayoutDrift,
  findRepoRoot,
  normaliseKey,
  parseLayoutFields,
} from "./gen-layout-drift";

const REPO_ROOT = findRepoRoot(import.meta.dir);

/**
 * The single finding a mutant is expected to produce.
 *
 * Throws when there is not exactly one — so a mutant that produced zero findings can
 * never be read as "the assertion about findings[0] was skipped".
 */
function only<T>(xs: readonly T[]): T {
  if (xs.length !== 1) throw new Error(`expected exactly 1 finding, got ${xs.length}`);
  const x = xs[0];
  if (x === undefined) throw new Error("finding at index 0 is undefined");
  return x;
}

/** Copy just the files this check reads into a throwaway root, then run `mutate` over it. */
function withMutatedTree(mutate: (root: string) => void): ReturnType<typeof checkLayoutDrift> {
  const root = mkdtempSync(join(tmpdir(), "zeta-gen-layout-drift-"));
  try {
    for (const rel of [LAYOUT_YAML_PATH, ...LANES.map((l) => l.path)]) {
      const dest = join(root, rel);
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(join(REPO_ROOT, rel), dest);
    }
    mutate(root);
    return checkLayoutDrift(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("zeta-id generated-layout drift check", () => {
  test("the real worktree agrees — 6 lanes, 9 fields, no findings", () => {
    const { fields, findings } = checkLayoutDrift(REPO_ROOT);
    expect(fields.length).toBe(9);
    expect(findings).toEqual([]);
  });

  test("an untouched copy also agrees (the harness itself introduces no drift)", () => {
    const { findings } = withMutatedTree(() => {});
    expect(findings).toEqual([]);
  });

  // ── the mutants ──────────────────────────────────────────────────────────────

  test("a wrong constant in a generated lane is caught, and named", () => {
    // Go and Rust are the two lanes CI never re-executes, so they are the ones a
    // wrong constant could otherwise hide in. Mutate Go.
    const { findings } = withMutatedTree((root) => {
      const p = join(root, "src/Core.Go/zeta_id/zeta_id.gen.go");
      // gofmt aligns the value column, so match the spacing instead of assuming it.
      const before = readFileSync(p, "utf-8");
      const after = before.replace(/PersonaOffset(\s+)Bits = 51/, "PersonaOffset$1Bits = 52");
      expect(after).not.toBe(before); // the mutation must actually land
      writeFileSync(p, after);
    });
    expect(findings.length).toBe(1);
    expect(only(findings).language).toBe("Go");
    expect(only(findings).detail).toContain("personaoffset");
    expect(only(findings).detail).toContain("52");
  });

  test("a wrong constant in the Rust lane is caught", () => {
    const { findings } = withMutatedTree((root) => {
      const p = join(root, "src/Core.Rust.ZetaId/src/bit_layout.gen.rs");
      const before = readFileSync(p, "utf-8");
      const after = before.replace("TIMESTAMP_WIDTH: Bits = Bits(48)", "TIMESTAMP_WIDTH: Bits = Bits(47)");
      expect(after).not.toBe(before);
      writeFileSync(p, after);
    });
    expect(findings.length).toBe(1);
    expect(only(findings).language).toBe("Rust");
    expect(only(findings).detail).toContain("timestampwidth");
  });

  test("a layout edit with NO regeneration turns every lane red at once", () => {
    // The README's stated invariant: there is no green intermediate state.
    const { findings } = withMutatedTree((root) => {
      const p = join(root, LAYOUT_YAML_PATH);
      const before = readFileSync(p, "utf-8");
      const after = before.replace("    offset: 35\n    width: 8", "    offset: 34\n    width: 8");
      expect(after).not.toBe(before);
      writeFileSync(p, after);
    });
    expect(new Set(findings.map((f) => f.language))).toEqual(new Set(LANES.map((l) => l.language)));
  });

  // ── the vacuity guards ───────────────────────────────────────────────────────

  test("a lane whose constants no longer parse FAILS — it does not silently agree", () => {
    // This is the defect class the check exists inside of: an extractor that matches
    // nothing yields an empty set, and an empty set agrees with every file.
    const { findings } = withMutatedTree((root) => {
      const p = join(root, "src/Core.Python/src/zeta/zeta_id_gen.py");
      writeFileSync(p, "# emptied\n");
    });
    expect(findings.length).toBe(1);
    expect(only(findings).language).toBe("Python");
    expect(only(findings).detail).toContain("DID NOT RUN");
  });

  test("a lane short by ONE constant fails (not just a wholly-empty file)", () => {
    const { findings } = withMutatedTree((root) => {
      const p = join(root, "src/Core.CSharp.ZetaId/GeneratedBitLayout.cs");
      const before = readFileSync(p, "utf-8");
      const after = before.replace(/^\s*public static readonly Bits RandomnessWidth = new Bits\(32\);\n/m, "");
      expect(after).not.toBe(before);
      writeFileSync(p, after);
    });
    expect(findings.length).toBe(1);
    expect(only(findings).detail).toContain("parsed 17 constants, expected 18");
  });

  test("a missing generated file FAILS — absence is not agreement", () => {
    const { findings } = withMutatedTree((root) => {
      rmSync(join(root, "src/Core.FSharp.ZetaId/GeneratedBitLayout.fs"));
    });
    expect(findings.length).toBe(1);
    expect(only(findings).language).toBe("F#");
    expect(only(findings).detail).toContain("verified nothing");
  });

  test("a layout yielding zero fields FAILS rather than passing vacuously", () => {
    const { fields, findings } = withMutatedTree((root) => {
      writeFileSync(join(root, LAYOUT_YAML_PATH), "version: 1\ntotal_bits: 128\n");
    });
    expect(fields.length).toBe(0);
    expect(findings.length).toBe(1);
    expect(only(findings).detail).toContain("0 fields");
  });

  test("a missing layout file FAILS", () => {
    const { findings } = withMutatedTree((root) => {
      rmSync(join(root, LAYOUT_YAML_PATH));
    });
    expect(findings.length).toBe(1);
    expect(only(findings).detail).toContain("source of truth is absent");
  });

  // ── the parts the mutants lean on ────────────────────────────────────────────

  test("normaliseKey folds all six naming conventions onto one key", () => {
    for (const spelling of ["VERSION_OFFSET", "VersionOffset", "versionOffset", "version_offset"]) {
      expect(normaliseKey(spelling)).toBe("versionoffset");
    }
  });

  test("parseLayoutFields stops at reserved_bits — reserved bits are not named fields", () => {
    const fields = parseLayoutFields(readFileSync(join(REPO_ROOT, LAYOUT_YAML_PATH), "utf-8"));
    expect(fields.map((f) => f.name)).toEqual([
      "Version",
      "Timestamp",
      "Chromosome",
      "Category",
      "Authority",
      "Persona",
      "Momentum",
      "Location",
      "Randomness",
    ]);
    // The reserved-bit stanzas carry `offset:`/`width:` too; picking them up would
    // inflate the anti-vacuity floor and make every lane look short.
    expect(fields.reduce((n, f) => n + f.width, 0)).toBe(123);
  });

  test("every lane path this check names actually exists in the worktree", () => {
    for (const lane of LANES) {
      expect(existsSync(join(REPO_ROOT, lane.path))).toBe(true);
    }
  });
});
