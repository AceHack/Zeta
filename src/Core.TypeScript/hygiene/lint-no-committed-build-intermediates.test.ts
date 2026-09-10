/**
 * Falsifiers for lint-no-committed-build-intermediates.
 *
 * The point of these is the MUTATION property: each names a path that must be
 * caught, so dropping a suffix from the watched set turns a test red. A linter
 * whose green run proves nothing is the vacuity class, and this file is what
 * keeps this one out of it.
 */
import { describe, expect, test } from "bun:test";
import { findIntermediates } from "./lint-no-committed-build-intermediates.ts";

// The file this linter was written for: compiled from a committed
// AlloyRunner.java, tracked because .gitignore still named the old
// tools/alloy/classes/ path. Scorecard BinaryArtifactsID alert 244.
const ALLOY_CLASS = "src/Core.Alloy/classes/AlloyRunner.class";

// The rule's own text cites .rcgu.o as the stray that turned the byte-lock
// enforcer red the day it was written.
const RUSTC_INTERMEDIATE = "src/wasm-dla/bytelock/dla.rcgu.o";

// The adjudicated artifact-under-test exception. A linter that flagged these
// would be arguing with a decision already on file in the rule.
const BYTELOCK_WASM = [
  "src/wasm-dla/bytelock/dla-canonical-wat.wasm",
  "src/wasm-dla/bytelock/dla-canonical-llvm.wasm",
  "src/wasm-dla/bytelock/dla-canonical-emcc.wasm",
  "src/wasm-dla/bytelock/dla-canonical-rust.wasm",
  "src/wasm-dla/bytelock/dla-canonical-asc.wasm",
  "src/wasm-dla/bytelock/dla-canonical-zig.wasm",
];

// Suffix matching is on the dot-extension, never the last character:
// AlloyRunner.java ends in "a" and must not read as the ".a" archive.
const SOURCES = [
  "src/Core.Alloy/AlloyRunner.java",
  "src/Core.Alloy/schema_evolution.als",
  "src/Core.TypeScript/hygiene/lint.ts",
  "docs/NOTES.md",
];

const EVERY_WATCHED = ["a/x.class", "a/x.o", "a/x.obj", "a/x.a", "a/x.bc", "a/x.pyc", "a/x.pdb"];

describe("findIntermediates", () => {
  test("catches the regression that motivated the linter", () => {
    const found = findIntermediates([ALLOY_CLASS]);
    expect(found.length).toBe(1);
    expect(found[0]?.suffix).toBe(".class");
  });

  test("catches the rustc intermediate the rule names by name", () => {
    const found = findIntermediates([RUSTC_INTERMEDIATE]);
    expect(found.length).toBe(1);
    expect(found[0]?.suffix).toBe(".o");
  });

  test("catches every watched suffix, so none can be dropped silently", () => {
    expect(findIntermediates(EVERY_WATCHED).length).toBe(EVERY_WATCHED.length);
  });

  test("does NOT flag the six byte-lock wasm modules under test", () => {
    expect(findIntermediates(BYTELOCK_WASM)).toEqual([]);
  });

  test("does NOT flag sources whose names merely end in a watched letter", () => {
    expect(findIntermediates(SOURCES)).toEqual([]);
  });

  test("empty input yields no findings", () => {
    expect(findIntermediates([])).toEqual([]);
  });
});
