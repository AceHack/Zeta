import { expect, test } from "bun:test";
import { symbolize, seededShuffle, TYPES } from "./run-otto-trace";

test("symbolize: conventional-commit types map to stable symbols; unknown -> other", () => {
  const syms = symbolize(["feat(x): a", "docs: b", "fix!: c", "wip stuff", "refactor(core): d"]);
  expect(syms).toEqual([TYPES.indexOf("feat"), TYPES.indexOf("docs"), TYPES.indexOf("fix"), TYPES.length - 1, TYPES.indexOf("refactor")]);
});

test("seededShuffle: deterministic (same seed same order), preserves multiset, destroys order", () => {
  const trace = Array.from({ length: 200 }, (_, i) => i % 5);
  const a = seededShuffle(trace, 0xE66n);
  const b = seededShuffle(trace, 0xE66n);
  expect(a).toEqual(b); // DST
  expect([...a].sort()).toEqual([...trace].sort()); // same symbols
  expect(a).not.toEqual(trace); // but not the same sequence
});
