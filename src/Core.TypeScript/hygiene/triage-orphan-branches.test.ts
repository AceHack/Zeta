import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  absentByContent,
  archiveTagBranch,
  classifyContainment,
  type ContainmentInput,
  indexOpenPrs,
  isProtectedRef,
  mainContentIndex,
  openPrFor,
  orphanedArchiveTags,
  parseCherry,
  parseLsTree,
  parseOpenPrTsv,
  positionalArg,
  renderPartials,
  summarizeSweep,
  type SweepOutcome,
} from "./triage-orphan-branches";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const NO_PROBE = { ran: false as const, why: "probe did not run" };

function input(over: Partial<ContainmentInput> = {}): ContainmentInput {
  return {
    branch: "agent/example",
    sha: "abcdef012345",
    cherry: { ran: true, value: { landed: 0, unlanded: ["deadbeef"] } },
    branchAdds: { ran: true, value: [] },
    mainOids: new Set<string>(),
    openPr: null,
    protectedRef: false,
    ...over,
  };
}

function outcome(over: Partial<SweepOutcome> = {}): SweepOutcome {
  return {
    branch: "agent/example",
    sha: "abcdef012345",
    tag: "archive/2026-09-09-branch-sweep/agent/example",
    reached: "deleted",
    error: null,
    ...over,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// DEFECT 1 — an OPEN PR's head ref must never classify SAFE
// ═════════════════════════════════════════════════════════════════════════════

describe("DEFECT 1 — open-PR branches are never prunable", () => {
  // THE FALSIFIER. Before the fix the gate was content-only, so this exact
  // input — a branch whose content IS all on main, and which happens to be a
  // live PR's head — returned SAFE and `--prune` would have deleted the head
  // ref of PR #17184. Remove the OPEN_PR branch from classifyContainment and
  // this test fails.
  test("a branch with fully-landed content is still withheld when its PR is OPEN", () => {
    const t = classifyContainment(input({ openPr: 17184, branchAdds: { ran: true, value: [] } }));
    expect(t.klass).toBe("OPEN_PR");
    expect(t.openPr).toBe(17184);
  });

  test("the same branch with NO open PR is SAFE — so the test above is not vacuous", () => {
    const t = classifyContainment(input({ openPr: null, branchAdds: { ran: true, value: [] } }));
    expect(t.klass).toBe("SAFE");
  });

  test("OPEN_PR outranks even a branch carrying unlanded content", () => {
    const t = classifyContainment(
      input({
        openPr: 17187,
        branchAdds: { ran: true, value: [{ path: "src/new.ts", oid: "aaa" }] },
      }),
    );
    expect(t.klass).toBe("OPEN_PR");
  });

  test("an open PR's BASE is protected too — deleting it breaks the stacked PR", () => {
    const index = indexOpenPrs([{ number: 5, head: "agent/top", base: "agent/bottom" }]);
    expect(openPrFor("agent/bottom", index)).toBe(5);
    expect(openPrFor("agent/top", index)).toBe(5);
    expect(openPrFor("agent/unrelated", index)).toBeNull();
  });

  test("preservation and telemetry namespaces are never swept", () => {
    for (const b of ["heartbeat/otto", "liveness/observations", "archive/x", "preserve/y", "main"]) {
      expect(isProtectedRef(b)).toBe(true);
    }
    expect(isProtectedRef("agent/ordinary")).toBe(false);
    expect(classifyContainment(input({ protectedRef: true })).klass).toBe("PROTECTED");
  });

  test("parseOpenPrTsv REFUSES a malformed row rather than dropping its protection", () => {
    const bad = parseOpenPrTsv("12\tagent/a\tmain\nthis-row-has-one-field\n");
    expect(bad).toHaveProperty("error");
  });

  test("parseOpenPrTsv reads a well-formed page", () => {
    const ok = parseOpenPrTsv("12\tagent/a\tmain\n13\tagent/b\tagent/a\n");
    expect(ok).toEqual({
      ok: [
        { number: 12, head: "agent/a", base: "main" },
        { number: 13, head: "agent/b", base: "agent/a" },
      ],
    });
  });

  test("a non-numeric PR number is refused, not coerced to NaN", () => {
    expect(parseOpenPrTsv("not-a-number\tagent/a\tmain\n")).toHaveProperty("error");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DEFECT 2 — containment is decided on CONTENT, never on basename
// ═════════════════════════════════════════════════════════════════════════════

describe("DEFECT 2 — basename collision must not read as landed", () => {
  // THE FALSIFIER, built from the measured case. The branch adds
  // docs/custody/2026-09-07/log.json; main holds an unrelated docs/other/log.json.
  // The BASENAMES are identical ("log.json") and the CONTENTS are not. The old
  // gate said SAFE. Reintroduce basename comparison and this test fails.
  test("same basename, different bytes ⇒ the file is ABSENT", () => {
    const mainTree = parseLsTree("100644 blob 1111111111111111111111111111111111111111\tdocs/other/log.json");
    const oids = mainContentIndex(mainTree);
    const branchAdds = [{ path: "docs/custody/2026-09-07/log.json", oid: "2222222222222222222222222222222222222222" }];
    expect(absentByContent(branchAdds, oids)).toEqual(["docs/custody/2026-09-07/log.json"]);

    const t = classifyContainment(
      input({ mainOids: oids, branchAdds: { ran: true, value: branchAdds }, cherry: NO_PROBE }),
    );
    expect(t.klass).toBe("UNLANDED");
    expect(t.absent).toContain("docs/custody/2026-09-07/log.json");
  });

  test("same bytes at a DIFFERENT path is contained — a landed file that moved is not lost", () => {
    const oids = mainContentIndex(
      parseLsTree("100644 blob 3333333333333333333333333333333333333333\tsrc/moved/thing.ts"),
    );
    expect(
      absentByContent([{ path: "src/old/thing.ts", oid: "3333333333333333333333333333333333333333" }], oids),
    ).toEqual([]);
  });

  test("ephemera are excluded, and only ephemera", () => {
    const oids = mainContentIndex([]);
    expect(
      absentByContent(
        [
          { path: "docs/hygiene-history/run.json", oid: "a" },
          { path: "docs/pr-discussions/x.md", oid: "b" },
          { path: "docs/real/thing.md", oid: "c" },
        ],
        oids,
      ),
    ).toEqual(["docs/real/thing.md"]);
  });

  test("absent files confined to the pr-review archive classify ARCHIVE, not UNLANDED", () => {
    const t = classifyContainment(
      input({
        cherry: NO_PROBE,
        branchAdds: { ran: true, value: [{ path: "docs/history/pr-reviews/1.md", oid: "z" }] },
      }),
    );
    expect(t.klass).toBe("ARCHIVE");
  });

  test("parseLsTree keeps blobs and drops trees, with the OID intact", () => {
    const entries = parseLsTree(
      [
        "040000 tree 4444444444444444444444444444444444444444\tsrc",
        "100644 blob 5555555555555555555555555555555555555555\tsrc/a.ts",
        "100755 blob 6666666666666666666666666666666666666666\ttools/run.sh",
      ].join("\n"),
    );
    expect(entries).toEqual([
      { path: "src/a.ts", oid: "5555555555555555555555555555555555555555" },
      { path: "tools/run.sh", oid: "6666666666666666666666666666666666666666" },
    ]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DEFECT 3 — a real containment predicate, and never ancestry
// ═════════════════════════════════════════════════════════════════════════════

describe("DEFECT 3 — containment proofs", () => {
  test("patch-id equivalence alone proves containment", () => {
    const t = classifyContainment(
      input({
        cherry: { ran: true, value: { landed: 3, unlanded: [] } },
        // Deliberately NOT contained by blob presence: the patch-id proof stands alone.
        branchAdds: { ran: true, value: [{ path: "src/x.ts", oid: "nope" }] },
        mainOids: new Set<string>(),
      }),
    );
    expect(t.klass).toBe("SAFE");
    expect(t.proof).toBe("patch-id");
  });

  // A squash-merged branch is the repo's normal case: its commits are NOT
  // ancestors of main and their patch ids do NOT match, yet its bytes are on
  // main. Only the blob proof sees this.
  test("blob presence proves containment where patch-id cannot — the squash case", () => {
    const oids = mainContentIndex(parseLsTree("100644 blob 7777777777777777777777777777777777777777\tsrc/x.ts"));
    const t = classifyContainment(
      input({
        cherry: { ran: true, value: { landed: 0, unlanded: ["c1", "c2", "c3"] } },
        branchAdds: { ran: true, value: [{ path: "src/x.ts", oid: "7777777777777777777777777777777777777777" }] },
        mainOids: oids,
      }),
    );
    expect(t.klass).toBe("SAFE");
    expect(t.proof).toBe("blob-presence");
  });

  test("cherry reporting ZERO landed commits is not a containment proof", () => {
    // An empty `git cherry` output means "nothing compared", which is exactly
    // what a broken invocation looks like. It must not read as full containment.
    const t = classifyContainment(
      input({
        cherry: { ran: true, value: parseCherry("") },
        branchAdds: { ran: true, value: [{ path: "src/x.ts", oid: "absent" }] },
      }),
    );
    expect(t.klass).toBe("UNLANDED");
  });

  test("parseCherry splits landed (-) from unlanded (+)", () => {
    const v = parseCherry(["- 1111111", "+ 2222222", "- 3333333"].join("\n"));
    expect(v.landed).toBe(2);
    expect(v.unlanded).toEqual(["2222222"]);
  });

  // THE FAIL-CLOSED FALSIFIER. Both probes errored. The pre-fix code swallowed a
  // failed `git diff` with allowFail and returned "", so an ERRORED gate produced
  // an EMPTY absent list and the branch read SAFE. Make classifyContainment
  // treat a failed probe as "nothing absent" and this test fails.
  test("BOTH probes failing is UNCHECKABLE, never SAFE", () => {
    const t = classifyContainment(input({ cherry: NO_PROBE, branchAdds: NO_PROBE }));
    expect(t.klass).toBe("UNCHECKABLE");
    expect(t.klass).not.toBe("SAFE");
  });

  test("a failed diff with a failed cherry cannot be rescued into SAFE by an empty main tree", () => {
    const t = classifyContainment(input({ cherry: NO_PROBE, branchAdds: NO_PROBE, mainOids: new Set<string>() }));
    expect(t.klass).toBe("UNCHECKABLE");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DEFECT 4 — preserve-then-delete is one transaction; a partial is loud
// ═════════════════════════════════════════════════════════════════════════════

describe("DEFECT 4 — a half-run sweep cannot report success", () => {
  // THE FALSIFIER. This is 2026-09-03 in miniature: the tag went up, the branch
  // never went away. Anything that treats "tagged" as success — or that folds
  // partials into `complete` — makes this fail.
  test("tagged-but-not-deleted is a PARTIAL and exits 3", () => {
    const s = summarizeSweep([
      outcome({ branch: "a", reached: "deleted" }),
      outcome({ branch: "b", reached: "tag-verified", error: "branch delete failed" }),
    ]);
    expect(s.complete.map((o) => o.branch)).toEqual(["a"]);
    expect(s.partial.map((o) => o.branch)).toEqual(["b"]);
    expect(s.exitCode).toBe(3);
  });

  test("an all-deleted sweep exits 0 — so the test above is not vacuous", () => {
    const s = summarizeSweep([outcome({ branch: "a" }), outcome({ branch: "b" })]);
    expect(s.partial).toEqual([]);
    expect(s.exitCode).toBe(0);
  });

  test("`tagged` without verification is ALSO a partial, not an untouched branch", () => {
    const s = summarizeSweep([outcome({ reached: "tagged", error: "tag not present on the remote after push" })]);
    expect(s.partial).toHaveLength(1);
    expect(s.untouched).toEqual([]);
    expect(s.exitCode).toBe(3);
  });

  test("a branch that never got tagged changed nothing and is untouched, not partial", () => {
    const s = summarizeSweep([outcome({ reached: "none", error: "tag push failed" })]);
    expect(s.untouched).toHaveLength(1);
    expect(s.partial).toEqual([]);
    expect(s.exitCode).toBe(0);
  });

  test("the partial report NAMES the branches — a count alone is not a report", () => {
    const s = summarizeSweep([outcome({ branch: "claim/task-x", reached: "tag-verified" })]);
    const text = renderPartials(s);
    expect(text).toContain("PARTIAL SWEEP");
    expect(text).toContain("claim/task-x");
  });

  test("renderPartials is silent when there is nothing to report", () => {
    expect(renderPartials(summarizeSweep([outcome()]))).toBe("");
  });
});

describe("DEFECT 4 — the residue check: an archive tag whose branch still lives", () => {
  // THE FALSIFIER for the audit half. 2026-09-03 left tags whose branches were
  // still there and no check said so. Break the intersection and this fails.
  test("a tag whose branch is still a live head is reported", () => {
    const found = orphanedArchiveTags(
      [
        "archive/2026-09-03-branch-sweep/claim/task-browser-checkpoint-port",
        "archive/2026-09-03-branch-sweep/feat/already-gone",
      ],
      ["claim/task-browser-checkpoint-port", "main"],
    );
    expect(found).toEqual([
      {
        tag: "archive/2026-09-03-branch-sweep/claim/task-browser-checkpoint-port",
        branch: "claim/task-browser-checkpoint-port",
      },
    ]);
  });

  test("a fully reconciled tag set reports nothing — so the test above is not vacuous", () => {
    expect(
      orphanedArchiveTags(["archive/2026-09-03-branch-sweep/feat/gone"], ["main", "agent/other"]),
    ).toEqual([]);
  });

  test("the branch name's own slashes survive the tag-namespace strip", () => {
    expect(archiveTagBranch("archive/2026-09-03-branch-sweep/claim/081ktqx-otto-2026-08-24")).toBe(
      "claim/081ktqx-otto-2026-08-24",
    );
  });

  test("non-archive and undated refs are out of scope, not guessed at", () => {
    expect(archiveTagBranch("preserve/local-only-abc")).toBeNull();
    expect(archiveTagBranch("archive/not-a-date/foo")).toBeNull();
    expect(archiveTagBranch("archive/2026-09-03-branch-sweep")).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Argument scan — the bug the first draft of this rewrite shipped
// ═════════════════════════════════════════════════════════════════════════════

describe("positionalArg", () => {
  test("a flag's value is never mistaken for the namespace", () => {
    expect(positionalArg(["--remote", "origin", "claim/"])).toBe("claim/");
    expect(positionalArg(["--limit", "5", "agent"])).toBe("agent");
  });

  test("a repeated token does not confuse the scan (indexOf would have)", () => {
    expect(positionalArg(["--remote", "origin", "origin"])).toBe("origin");
  });

  test("no positional at all is undefined, not a flag", () => {
    expect(positionalArg(["--audit-archive-tags", "--remote", "origin"])).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SOURCE GUARDS
//
// These grep the subject's own source, which is a shape that has bitten roughly
// seven agents here in one specific way: a guard matching a BARE IDENTIFIER is
// satisfied by the comment that explains the ban. So both guards below
//   (a) STRIP COMMENTS FIRST — line and block — and
//   (b) MATCH THE CALL FORM `name(` / the argv spelling, never the bare word.
// The subject file's header talks about `gh pr list` and about basenames at
// length; a naive guard would read those sentences as the code and pass.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Source with `//` line comments and block comments removed.
 *
 * Deliberately simple and deliberately CONSERVATIVE about what it removes: it
 * strips nothing that is inside a string literal because the guards below match
 * call syntax, which cannot occur in prose. A guard that reads a file's own
 * explanation of a ban as a violation of it is a guard that measures nothing.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
}

const SUBJECT_PATH = join(import.meta.dir, "triage-orphan-branches.ts");
const SUBJECT_SOURCE = readFileSync(SUBJECT_PATH, "utf8");
const SUBJECT_CODE = stripComments(SUBJECT_SOURCE);

describe("source guards", () => {
  test("the comment stripper actually removes both comment forms", () => {
    // Control: without this the two guards below could pass vacuously.
    expect(stripComments("a // gone\nb\n/* also\ngone */\nc")).not.toContain("gone");
    expect(stripComments("keep me // gone")).toContain("keep me");
  });

  test("the subject's PROSE does mention the banned forms — so the guards are load-bearing", () => {
    // If this ever fails, the guards below have become vacuous for a different
    // reason (nothing to be confused by) and must be re-read.
    expect(SUBJECT_SOURCE).toContain("gh pr list");
  });

  test("no GraphQL transport: the subject never CALLS `gh pr list` / `gh pr view`", () => {
    // Match the two spellings a call can take: the shell string and the argv
    // array. The bare words `pr list` appear in the header prose and are
    // correctly ignored because comments were stripped.
    expect(SUBJECT_CODE).not.toMatch(/["'`]gh\s+pr\s+(list|view)/);
    expect(SUBJECT_CODE).not.toMatch(/["']pr["']\s*,\s*["'](list|view)["']/);
  });

  test("the REST call the fix depends on is actually present, as a call", () => {
    expect(SUBJECT_CODE).toMatch(/repos\/\$\{repo\}\/pulls\?state=open/);
    expect(SUBJECT_CODE).toMatch(/spawnSync\(\s*\n?\s*"gh"/);
  });

  test("no basename comparison: the subject never CALLS a basename gate", () => {
    // `basenamesOnMain(` was the removed function. Matching the call form means
    // the header's discussion of basenames cannot satisfy this guard, and
    // re-adding the function would.
    expect(SUBJECT_CODE).not.toMatch(/\bbasenamesOnMain\s*\(/);
    expect(SUBJECT_CODE).not.toMatch(/\bmainBases\s*\./);
  });

  test("no ancestry gate: the subject never CALLS merge-base --is-ancestor", () => {
    expect(SUBJECT_CODE).not.toMatch(/["']--is-ancestor["']/);
  });

  test("the diff probe asks for OIDs (`--raw`), not just paths (`--name-only`)", () => {
    // `--name-only` is what made a basename gate the only option available.
    expect(SUBJECT_CODE).toMatch(/["']--raw["']/);
    expect(SUBJECT_CODE).not.toMatch(/["']--name-only["']/);
  });
});
