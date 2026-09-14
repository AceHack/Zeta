import { describe, expect, it } from "bun:test";
import {
  applyMutationOnChangedLines,
  changedLinesFromDiff,
  mutationsOnChangedLines,
  scopeOf,
} from "./audit-pr-mutation-coverage.ts";
import { MUTATIONS, type Mutation } from "./mutation-runner.ts";

const GTE = MUTATIONS.find((m) => m.name === "gte-to-gt") as Mutation;

describe("changedLinesFromDiff — the hunk header is the whole input", () => {
  it("reads a single hunk's new-side range", () => {
    const d = ["--- a/x.ts", "+++ b/x.ts", "@@ -3,2 +3,4 @@", "+a", "+b"].join("\n");
    expect([...(changedLinesFromDiff(d).get("x.ts") ?? [])]).toEqual([3, 4, 5, 6]);
  });

  // `@@ -1 +7 @@` with no comma means a length of exactly 1. Defaulting it to 0 would silently
  // drop every single-line change -- the commonest kind -- and report NO-SITES on a real edit.
  it("treats a missing length as 1, not as 0", () => {
    const d = ["--- a/x.ts", "+++ b/x.ts", "@@ -1 +7 @@", "+a"].join("\n");
    expect([...(changedLinesFromDiff(d).get("x.ts") ?? [])]).toEqual([7]);
  });

  // A pure deletion has no NEW line to mutate. Recording one would send a mutation at a line the
  // PR removed, and the mutant would land on whatever now occupies that number.
  it("records nothing for a pure deletion (new length 0)", () => {
    const d = ["--- a/x.ts", "+++ b/x.ts", "@@ -4,3 +3,0 @@", "-gone"].join("\n");
    expect(changedLinesFromDiff(d).has("x.ts")).toBe(false);
  });

  it("keeps files apart and ignores a deleted file's /dev/null side", () => {
    const d = [
      "--- a/x.ts", "+++ b/x.ts", "@@ -1 +1 @@", "+x",
      "--- a/y.ts", "+++ /dev/null", "@@ -1 +0,0 @@", "-y",
      "--- a/z.ts", "+++ b/z.ts", "@@ -9 +9,2 @@", "+z",
    ].join("\n");
    const m = changedLinesFromDiff(d);
    expect([...(m.get("x.ts") ?? [])]).toEqual([1]);
    expect(m.has("/dev/null")).toBe(false);
    expect([...(m.get("z.ts") ?? [])]).toEqual([9, 10]);
  });

  it("returns an empty map for an empty diff rather than throwing", () => {
    expect(changedLinesFromDiff("").size).toBe(0);
  });
});

describe("applyMutationOnChangedLines — only lines this PR wrote", () => {
  const src = ["const a = x >= 1;", "const b = y >= 2;", "const c = z >= 3;"].join("\n");

  it("mutates the occurrence on a changed line, not the first in the file", () => {
    const out = applyMutationOnChangedLines(src, GTE, new Set([2]));
    expect(out.split("\n")[0]).toBe("const a = x >= 1;"); // untouched
    expect(out.split("\n")[1]).toBe("const b = y > 2;");  // the changed line
  });

  // THE WHOLE POINT OF DIFF SCOPING. A file-scoped mutant can land on a line the author never
  // touched and report a gap they neither introduced nor owe.
  it("returns the source UNCHANGED when no changed line carries a site", () => {
    expect(applyMutationOnChangedLines(src, GTE, new Set([99]))).toBe(src);
  });

  it("does not mutate a `//` comment, even on a changed line", () => {
    const s = ["// a >= b in prose", "const a = 1;"].join("\n");
    expect(applyMutationOnChangedLines(s, GTE, new Set([1, 2]))).toBe(s);
  });

  // THIS CASE IS LOAD-BEARING AND THE `//` ONE IS NOT, WHICH MUTATION TESTING IS HOW I FOUND OUT.
  //
  // Deleting the `isCommentLine` guard entirely left the whole suite green: a `//` line is caught
  // a SECOND time by the trailing-comment check below it (`indexOf("//")` is 0, which precedes the
  // match, so the occurrence is skipped anyway). The test passed because an EARLIER guard fired,
  // not because the guard under test worked.
  //
  // A block-comment line is the case only `isCommentLine` catches: there is no `//` on it, so the
  // trailing-comment check sees nothing and the mutation lands inside a docstring -- a mutant that
  // changes no behaviour, survives by construction, and reports a coverage gap that is not there.
  it("does not mutate a BLOCK comment line — the case only isCommentLine catches", () => {
    const s = ["/**", " * holds when a >= b", " */", "const a = 1;"].join("\n");
    expect(applyMutationOnChangedLines(s, GTE, new Set([1, 2, 3, 4]))).toBe(s);
  });

  it("does not mutate an occurrence sitting after a trailing //", () => {
    const s = "const a = 1; // guard when x >= y";
    expect(applyMutationOnChangedLines(s, GTE, new Set([1]))).toBe(s);
  });

  it("mutates live code on a line that also has a trailing comment", () => {
    const s = "const a = x >= 1; // fine";
    expect(applyMutationOnChangedLines(s, GTE, new Set([1]))).toBe("const a = x > 1; // fine");
  });

  it("uses 1-based line numbers, matching git", () => {
    const s = ["const a = x >= 1;", "const b = 2;"].join("\n");
    // Line 1 is the site. A 0-based reader would find nothing here and everything at index 0.
    expect(applyMutationOnChangedLines(s, GTE, new Set([1]))).toContain("x > 1");
    expect(applyMutationOnChangedLines(s, GTE, new Set([0]))).toBe(s);
  });
});

describe("mutationsOnChangedLines", () => {
  it("returns only mutations with a real site on a changed line", () => {
    const s = ["const a = x >= 1;", "const b = p && q;"].join("\n");
    expect(mutationsOnChangedLines(s, new Set([1])).map((m) => m.name)).toEqual(["gte-to-gt"]);
    expect(mutationsOnChangedLines(s, new Set([2])).map((m) => m.name)).toEqual(["and-to-or"]);
    expect(mutationsOnChangedLines(s, new Set([99]))).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE VACUITY GUARD, WHICH IS THE REASON THIS FILE EXISTS.
//
// `mutation-runner.ts` shipped with `--since=24h` -- invalid git approxidate, silently matching
// zero commits -- and would have reported "nothing to do" forever while looking healthy. A per-PR
// audit has the same shape available and more ways in. Every empty outcome must be NAMED, and none
// of them may read as a pass.
describe("empty outcomes are classified, and none of them is spelled 'clean'", () => {
  it("an unresolvable base ref is CANNOT-SEE, not an empty pass", () => {
    const s = scopeOf(process.cwd(), "refs/heads/definitely-not-a-branch-9f3a2", 12);
    expect(s.kind).toBe("cannot-see");
    if (s.kind === "cannot-see") expect(s.code).toBe("NO-MERGE-BASE");
  });

  it("comparing HEAD against itself is CANNOT-SEE — an empty diff is a tooling fact, not a verdict", () => {
    const s = scopeOf(process.cwd(), "HEAD", 12);
    expect(s.kind).toBe("cannot-see");
    if (s.kind === "cannot-see") expect(s.code).toBe("NO-CHANGED-FILES");
  });

  // The three empty codes must stay DISTINCT. Collapsing them is how "I could not look" starts
  // reading as "I looked and it was fine".
  it("the codes are distinguishable from each other", () => {
    const a = scopeOf(process.cwd(), "refs/heads/definitely-not-a-branch-9f3a2", 12);
    const b = scopeOf(process.cwd(), "HEAD", 12);
    expect(a.kind === "cannot-see" && b.kind === "cannot-see" && a.code !== b.code).toBe(true);
  });
});
