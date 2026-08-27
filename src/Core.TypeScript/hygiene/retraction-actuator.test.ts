import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  ACTUATOR_WORKFLOW,
  bd001OpenTicks,
  git,
  grantedScopes,
  isAttributable,
  isolateBreak,
  isSha,
  missingScopes,
  redRunSubjectPaths,
  reportIncapacity,
  touchesVectors,
} from "./retraction-actuator";

// The edge's pure fact-computations. All DECISIONS are episode-protocol's
// (12 laws there); these tests cover only what the edge computes for it.

const sweep = (tick: number, rules: string[]) => ({ tick, findings: rules.map((rule) => ({ rule })) });

describe("bd001OpenTicks — trailing consecutive open sweeps", () => {
  test("counts only the trailing run", () => {
    expect(bd001OpenTicks([sweep(1, ["BD001"]), sweep(2, []), sweep(3, ["BD001"]), sweep(4, ["BD001"])])).toBe(2);
  });
  test("zero when the latest sweep is clean", () => {
    expect(bd001OpenTicks([sweep(1, ["BD001"]), sweep(2, ["MD022"])])).toBe(0);
  });
  test("order-independent input (ledger files sort by tick)", () => {
    expect(bd001OpenTicks([sweep(3, ["BD001"]), sweep(1, []), sweep(2, ["BD001"])])).toBe(2);
  });
});

describe("isolateBreak — first red after last green", () => {
  test("clean picture: newest red walks back to the first red, paired with its green predecessor", () => {
    expect(
      isolateBreak([
        { headSha: "r2", conclusion: "failure" },
        { headSha: "r1", conclusion: "failure" },
        { headSha: "g1", conclusion: "success" },
      ]),
    ).toEqual({ redHead: "r1", greenHead: "g1" });
  });
  test("newest completed run green ⇒ no break to isolate", () => {
    expect(isolateBreak([{ headSha: "g2", conclusion: "success" }, { headSha: "r1", conclusion: "failure" }])).toBeNull();
  });
  test("running runs are ignored for the picture; no green in window ⇒ null", () => {
    expect(isolateBreak([{ headSha: "x", conclusion: null }, { headSha: "r1", conclusion: "failure" }])).toBeNull();
  });
});

describe("touchesVectors — the byte-lock contract patterns", () => {
  test("golden vectors and cross-verification paths refuse", () => {
    expect(touchesVectors(["src/Core/golden-vectors-cbor.json"])).toBe(true);
    expect(touchesVectors(["tests/cross-verification/run.ts"])).toBe(true);
  });
  test("ordinary paths pass", () => {
    expect(touchesVectors(["src/Core.TypeScript/hygiene/x.ts", "docs/a.md"])).toBe(false);
  });
});

// ── The edge's ARGUMENTS are arguments, never a command line ─────────────────
//
// CodeQL `js/command-line-injection` (critical) on the old `execSync` wrapper: `head_sha`
// from the Actions API was concatenated into a shell command line in a job holding a
// `GH_TOKEN` with push access to `main`. The fix is `execFileSync` -- no shell at all --
// plus `isSha` on every value that reaches `git` as data, because removing the shell
// closes COMMAND injection and not ARGUMENT injection.

describe("git — no shell, so a metacharacter is data", () => {
  test("a `;` cannot start a second command; git rejects it as a revision", () => {
    // `execSync("git rev-parse HEAD; echo pwned")` returned "<sha>\npwned". With no shell
    // the whole string is one (invalid) revision, so git exits non-zero and this throws.
    expect(() => git("rev-parse", "HEAD; echo pwned")).toThrow();
  });
  test("an ordinary invocation is unaffected", () => {
    expect(git("rev-parse", "--is-inside-work-tree")).toBe("true");
  });
});

describe("isSha — the gate on every value that becomes a git argument", () => {
  test("accepts sha1 and sha256 shapes, and an abbreviation", () => {
    expect(isSha("3168e5411a2b3c4d5e6f708192a3b4c5d6e7f809")).toBe(true);
    expect(isSha("a".repeat(64))).toBe(true);
    expect(isSha("abcdef1")).toBe(true);
  });
  test("refuses what argument injection is made of", () => {
    // Each of these is a git OPTION or a shell fragment, not a revision. Under the old
    // code every one of them reached the command line for `git revert --no-edit <x>`.
    expect(isSha("--upload-pack=/tmp/evil")).toBe(false);
    expect(isSha("HEAD; echo pwned")).toBe(false);
    expect(isSha("$(id)")).toBe(false);
    expect(isSha("3168E5411A2B3C4D5E6F708192A3B4C5D6E7F809")).toBe(false); // ordinal: lowercase only
    expect(isSha("abcdef")).toBe(false); // shorter than any abbreviation git will resolve
    expect(isSha("")).toBe(false);
  });
});

// ── ATTRIBUTION + CAPABILITY (added 2026-08-26) ──────────────────────────────

describe("isAttributable — the asymmetry is the safety property", () => {
  test("an underivable subject (empty) WITHHOLDS the remedy", () => {
    // Flip this to true and an infrastructure outage licenses a revert.
    expect(isAttributable([], ["src/anything.ts"])).toBe(false);
  });

  test("a non-empty subject that does not intersect the diff is NOT attributable", () => {
    expect(isAttributable(["tools/setup/install.sh"], ["src/Core.TypeScript/x.ts"])).toBe(false);
  });

  test("intersection makes it attributable", () => {
    expect(isAttributable(["src/a.ts", "src/b.ts"], ["src/b.ts"])).toBe(true);
  });

  test("matching is EXACT repo-relative equality, not prefix or directory containment", () => {
    // Pinned deliberately: `stalled-pr-classifier.ts` (#15698) uses Set.has,
    // and two copies of one rule must not drift into two different rules.
    expect(isAttributable(["src/x/y.ts"], ["src/x/"])).toBe(false);
  });

  test("an empty candidate diff is never attributable", () => {
    expect(isAttributable(["src/a.ts"], [])).toBe(false);
  });
});

describe("redRunSubjectPaths — no deriver is wired, and it says so honestly", () => {
  test("returns the empty set, which makes every candidate unattributable", () => {
    // This is the CURRENT, correct state: the actuator never fetches job,
    // step, or annotation data for the red run, so there is no evidence from
    // which a subject could be derived. If someone wires a deriver, this test
    // is the one that should change — and its change is the review signal.
    expect(redRunSubjectPaths()).toEqual([]);
    expect(isAttributable(redRunSubjectPaths(), ["src/Core.TypeScript/hygiene/anything.ts"])).toBe(false);
  });
});

describe("capability preflight — incapacity must be LOUD on every run", () => {
  test("the live workflow does NOT grant pull-requests: write", () => {
    // The measurement this whole guard exists for. If someone grants the
    // scope, this test goes red and that is correct: the claim below about
    // never having fired stops being true and the comments must be revisited.
    const yaml = readFileSync(ACTUATOR_WORKFLOW, "utf8");
    expect(missingScopes(grantedScopes(yaml))).toContain("pull-requests: write");
  });

  test("grantedScopes reads the TOP-LEVEL block only", () => {
    const yaml = ["permissions:", "  contents: write", "  actions: read", "", "jobs:"].join("\n");
    expect(grantedScopes(yaml)).toEqual(["contents: write", "actions: read"]);
  });

  test("grantedScopes does not read a JOB-level block as the effective grant", () => {
    // Over-reporting here would silence the annotation for the wrong reason.
    const yaml = ["jobs:", "  sweep:", "    permissions:", "      pull-requests: write"].join("\n");
    expect(grantedScopes(yaml)).toEqual([]);
  });

  test("reportIncapacity emits a ::error annotation naming the missing scope", () => {
    const lines: string[] = [];
    const emitted = reportIncapacity(["pull-requests: write"], (s) => lines.push(s));
    expect(emitted).toBe(true);
    expect(lines).toHaveLength(1);
    expect(lines[0]!).toStartWith("::error ");
    expect(lines[0]!).toContain("pull-requests: write");
  });

  test("reportIncapacity is SILENT when nothing is missing — no crying wolf", () => {
    const lines: string[] = [];
    expect(reportIncapacity([], (s) => lines.push(s))).toBe(false);
    expect(lines).toHaveLength(0);
  });

  test("the failure path emits ::error rather than a bare log", () => {
    // Source-level, because the push branch lives inside the un-exported entry
    // block and cannot be reached by import. Before 2026-08-26 this branch
    // printed `actuator: push failed → ...` and exited 0.
    const src = readFileSync(new URL("./retraction-actuator.ts", import.meta.url), "utf8");
    expect(src).toContain("::error title=Retraction actuator failed to push::");
    expect(src).not.toContain("`actuator: push failed → ${machine.kind}");
  });
});
