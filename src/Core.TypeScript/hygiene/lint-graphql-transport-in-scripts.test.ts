// src/Core.TypeScript/hygiene/lint-graphql-transport-in-scripts.test.ts
//
// FALSIFIERS FOR THE LINT.
//
// The organising problem, stated plainly because it decides the shape of this
// file: a linter that passes on a tree containing the defect is worthless, and
// "it found nothing" is exactly what a broken linter and a clean tree look
// like from the outside. So the load-bearing assertions here are the POSITIVE
// ones -- a fixture carrying each shape, and the lint refusing it.
//
// The last describe runs the REAL CLI over REAL directories on disk: one
// holding the defect (must exit 1) and one holding only the REST forms plus
// the permitted `gh pr merge --auto` (must exit 0). That pair is the
// end-to-end proof that the binary, not just the pure function, can fail.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  analyzeSource,
  auditFiles,
  baselineKey,
  commentStyleFor,
  exemptPaths,
  GRAPHQL_ROUTES,
  isScannable,
  main,
  maskComments,
  parseBaseline,
  routeAfterGh,
  SELF_TEST_FIXTURE,
  suppressions,
  tally,
  unbaselined,
  type Finding,
} from "./lint-graphql-transport-in-scripts.ts";

const rules = (fs: readonly Finding[]): string[] => fs.map((f) => f.rule);
const sigs = (fs: readonly Finding[]): string[] => fs.map((f) => f.signature);

// ═══════════════════════════════════════════════════════════════════════════
// THE TWO SPELLINGS -- both must be caught
//
// The argv form is the one a naive `grep "gh pr view"` misses, and it is 34 of
// the 39 real sites in this tree. A suite that only proved the shell form
// would let the lint ship half-blind and green.
// ═══════════════════════════════════════════════════════════════════════════

describe("shell form", () => {
  test("gh pr view in a workflow run: block is a finding", () => {
    const src = `      - run: |\n          STATE=$(gh pr view "$N" --json state)\n`;
    const found = analyzeSource(src, ".github/workflows/x.yml");
    expect(rules(found)).toEqual(["gh-shell-graphql"]);
    expect(sigs(found)).toEqual(["pr view@shell"]);
  });

  test("each of the four routes is recognised", () => {
    for (const route of GRAPHQL_ROUTES.keys()) {
      const found = analyzeSource(`gh ${route} 12\n`, "tools/x.sh");
      expect(sigs(found)).toEqual([`${route}@shell`]);
    }
  });

  test("global flags between gh and the subcommand do not defeat it", () => {
    // A lint a flag can walk around is a lint people learn to walk around.
    const found = analyzeSource(`gh --repo o/r pr list --state open\n`, "tools/x.sh");
    expect(sigs(found)).toEqual(["pr list@shell"]);
  });

  test("the refusal names the REST replacement", () => {
    const found = analyzeSource(`gh pr checks 12\n`, "tools/x.sh");
    expect(found[0]?.fix).toContain("gh api repos/{owner}/{repo}/commits/{sha}/check-runs");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE FLAG TOKENIZER
//
// This replaced a regex that scored 29 on sonarjs/regex-complexity AND had
// already been wrong once (it ate `--repo` but not `o/r`). A hand-written
// skipper is only an improvement if it is checked by cases rather than by
// confidence, so here are the cases.
// ═══════════════════════════════════════════════════════════════════════════

describe("routeAfterGh", () => {
  test("the bare form", () => {
    expect(routeAfterGh("pr list --state open")).toBe("pr list");
  });

  test("a flag with a SPACE-separated value is consumed whole", () => {
    // The exact case the regex got wrong.
    expect(routeAfterGh("--repo o/r pr list")).toBe("pr list");
  });

  test("a flag with an = value consumes nothing extra", () => {
    expect(routeAfterGh("--repo=o/r pr view 12")).toBe("pr view");
  });

  test("several flags in a row", () => {
    expect(routeAfterGh("--repo o/r -R x/y --json state pr checks")).toBe("pr checks");
  });

  test("it stops at the end of the statement, never pairing across one", () => {
    // THE LOAD-BEARING ASSERTION: a `gh api ...` on one line and a `pr list`
    // on the next must not pair into a `pr list` finding that exists nowhere.
    expect(routeAfterGh("api pulls\ngh pr list")).toBe("api pulls");
    expect(routeAfterGh("api pulls; gh pr list")).toBe("api pulls");
    expect(routeAfterGh("api pulls | jq .")).toBe("api pulls");
  });

  test("a verb that is not verb-shaped yields nothing, not a guess", () => {
    // `repos/o/r/pulls` is a REST path, not a subcommand verb.
    expect(routeAfterGh("api repos/o/r/pulls")).toBe("");
    expect(routeAfterGh("--json x")).toBe("");
    expect(routeAfterGh("")).toBe("");
  });

  test("a flag storm cannot walk the scanner off into the file", () => {
    expect(routeAfterGh("-a 1 -b 2 -c 3 -d 4 -e 5 -f 6 -g 7 pr list")).toBe("");
  });
});

describe("argv form", () => {
  test('spawnSync("gh", ["pr", "view", ...]) is a finding', () => {
    const src = `const r = spawnSync("gh", ["pr", "view", String(n), "--json", "state"]);\n`;
    const found = analyzeSource(src, "src/Core.TypeScript/x.ts");
    expect(sigs(found)).toEqual(["pr view@argv"]);
  });

  test("the pair may straddle a newline, as github-adapter.ts wraps it", () => {
    const src = `run("gh", [\n  "pr", "list",\n  "--repo", nwo,\n]);\n`;
    const found = analyzeSource(src, "src/Core.TypeScript/x.ts");
    expect(sigs(found)).toEqual(["pr list@argv"]);
  });

  test("single quotes count too", () => {
    const found = analyzeSource(`run('gh', ['pr', 'checks']);\n`, "src/Core.TypeScript/x.ts");
    expect(sigs(found)).toEqual(["pr checks@argv"]);
  });

  test("THE FALSIFIER THE SHELL-ONLY DRAFT WOULD HAVE FAILED", () => {
    // This source contains no substring "gh pr view" anywhere. A lint built
    // from the obvious grep reports nothing here and looks clean.
    const src = `spawnSync("gh", ["pr", "view", "1"]);\n`;
    expect(src.includes("gh pr view")).toBe(false);
    expect(analyzeSource(src, "a.ts")).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WHAT MUST NOT BE FLAGGED
//
// Each of these is a way the lint could become intolerable and get deleted.
// ═══════════════════════════════════════════════════════════════════════════

describe("permitted and out-of-scope", () => {
  test("gh pr merge --auto is NOT a finding -- it is GraphQL-only by necessity", () => {
    expect(analyzeSource(`gh pr merge 12 --auto --squash\n`, "tools/x.sh")).toEqual([]);
    expect(analyzeSource(`run("gh", ["pr", "merge", "--auto"]);\n`, "a.ts")).toEqual([]);
  });

  test("gh api REST calls are the remedy, never a finding", () => {
    expect(analyzeSource(`gh api repos/o/r/pulls/12 --jq .state\n`, "tools/x.sh")).toEqual([]);
    expect(analyzeSource(`run("gh", ["api", "repos/o/r/pulls/12"]);\n`, "a.ts")).toEqual([]);
  });

  test("other gh subcommands are untouched", () => {
    for (const line of ["gh pr create --fill\n", "gh pr merge 1 --squash\n", "gh run list\n", "gh repo view\n"]) {
      expect(analyzeSource(line, "tools/x.sh")).toEqual([]);
    }
  });

  test("non-workflow YAML is out of scope; workflow YAML is in", () => {
    expect(isScannable("charts/zeta/values.yml")).toBe(false);
    expect(isScannable(".github/workflows/gate.yml")).toBe(true);
    expect(isScannable("src/x.d.ts")).toBe(false);
    expect(isScannable("src/x.ts")).toBe(true);
  });

  test("EXACTLY ONE path is exempt, and it is this suite's own fixtures", () => {
    // The size assertion is the point. An exemption with room to grow is an
    // allowlist, and an allowlist drifts; this test is what makes adding a
    // second exemption a deliberate, visible act.
    expect(exemptPaths()).toEqual([SELF_TEST_FIXTURE]);
    expect(isScannable("src/Core.TypeScript/hygiene/" + SELF_TEST_FIXTURE)).toBe(false);
    expect(isScannable("src/Core.TypeScript/hygiene/lint-graphql-transport-in-scripts.ts")).toBe(true);
  });

  test("AN ERROR OR USAGE STRING IN TYPESCRIPT IS NOT A CALL SITE", () => {
    // The false-positive class that forced the shell matcher to be scoped to
    // shell-shaped files. Both of these are verbatim from the tree, and both
    // were reported as findings by the draft that ran the shell matcher
    // everywhere. Nineteen such strings; zero genuine `execSync("gh pr ...")`
    // invocations anywhere in src/Core.TypeScript.
    expect(
      analyzeSource(`process.stderr.write("required-check-started: gh pr list failed\\n");\n`, "src/a.ts"),
    ).toEqual([]);
    expect(analyzeSource(`  "usage: gh pr view N --json body --jq '.body' | bun x.ts\\n",\n`, "src/a.ts")).toEqual([]);
  });

  test("the same text IS a finding in a shell-shaped file", () => {
    // The control for the test above: the narrowing must be about the FILE
    // KIND, not about the matcher having quietly stopped working.
    expect(sigs(analyzeSource(`gh pr list --state open\n`, "tools/a.sh"))).toEqual(["pr list@shell"]);
    expect(analyzeSource(`gh pr list --state open\n`, "src/a.ts")).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COMMENT MASKING
//
// The single most important non-finding class. This lint's own header names
// all four commands repeatedly, and so does agent-heartbeat.yml -- five
// comment lines explaining why it uses REST, beside its four real call sites. A
// lint that reports its own documentation gets deleted, and the explanations
// go with it.
// ═══════════════════════════════════════════════════════════════════════════

describe("comments are masked, strings are not", () => {
  test("a // comment naming the command is not a finding", () => {
    expect(analyzeSource(`// never use gh pr view here\nconst x = 1;\n`, "a.ts")).toEqual([]);
  });

  test("a /* block */ comment naming the command is not a finding", () => {
    expect(analyzeSource(`/*\n * gh pr list is GraphQL.\n */\nconst x = 1;\n`, "a.ts")).toEqual([]);
  });

  test("a # comment in shell/YAML naming the command is not a finding", () => {
    expect(
      analyzeSource(`# REST, not gh pr list --json (GraphQL).\ngh api repos/o/r/pulls\n`, ".github/workflows/x.yml"),
    ).toEqual([]);
  });

  test("STRINGS ARE NOT MASKED -- masking them would blind the lint to argv form", () => {
    // The direction matters and is asserted, not assumed: `maskComments` must
    // leave string interiors intact.
    expect(maskComments(`const a = "pr";`, "c-like")).toBe(`const a = "pr";`);
  });

  test("a URL's // inside a string does not swallow the rest of the line", () => {
    const src = `const u = "https://x/y"; run("gh", ["pr", "list"]);\n`;
    expect(sigs(analyzeSource(src, "a.ts"))).toEqual(["pr list@argv"]);
  });

  test("a # inside a quoted shell string is not a comment", () => {
    const src = `echo "tag#1"; gh pr list --state open\n`;
    expect(sigs(analyzeSource(src, "tools/x.sh"))).toEqual(["pr list@shell"]);
  });

  test("masking preserves length, so offsets still index the original", () => {
    const src = `a\n// gh pr view\nb\nrun("gh", ["pr", "list"]);\n`;
    expect(maskComments(src, "c-like")).toHaveLength(src.length);
    expect(maskComments(src, "hash")).toHaveLength(src.length);
  });

  test("line numbers survive masking", () => {
    const src = `a\n# gh pr view\nb\ngh pr list\n`;
    expect(analyzeSource(src, "tools/x.sh")[0]?.line).toBe(4);
  });

  test("commentStyleFor routes by extension", () => {
    expect(commentStyleFor("a.ts")).toBe("c-like");
    expect(commentStyleFor("a.mjs")).toBe("c-like");
    expect(commentStyleFor("a.sh")).toBe("hash");
    expect(commentStyleFor(".github/workflows/a.yml")).toBe("hash");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUPPRESSION -- the hatch, and its own refusal
// ═══════════════════════════════════════════════════════════════════════════

describe("suppression", () => {
  test("a reasoned marker on the same line suppresses", () => {
    const src = `gh pr list --state open # graphql-transport-ok: paginated migration tracked in #15680\n`;
    expect(analyzeSource(src, "tools/x.sh")).toEqual([]);
  });

  test("a reasoned marker on the line above suppresses -- argv pairs wrap", () => {
    const src = `// graphql-transport-ok: adapter under migration\nrun("gh", ["pr", "list"]);\n`;
    expect(analyzeSource(src, "a.ts")).toEqual([]);
  });

  test("an EMPTY reason is itself a finding, never a silent pass", () => {
    const src = `gh pr list # graphql-transport-ok:\n`;
    expect(rules(analyzeSource(src, "tools/x.sh"))).toEqual(["empty-suppression"]);
  });

  test("suppressions are read from the ORIGINAL text, not the masked text", () => {
    // The marker lives in a comment, and comments are blanked before matching.
    // Reading it post-mask would make every hatch inert -- a hatch that never
    // fires is indistinguishable from a hatch that works, from the outside.
    expect(suppressions(`x\n// graphql-transport-ok: because\n`).get(2)).toBe("because");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE COUNTING BASELINE
//
// A SET-shaped baseline grandfathers a file's whole route, so a seventh
// `gh pr list` could land in a file already frozen at six and pass. The
// counting shape is the fix, and the test below is the proof that it is a fix
// rather than a preference.
// ═══════════════════════════════════════════════════════════════════════════

describe("baseline", () => {
  const f = (file: string, signature: string, line: number): Finding => ({
    rule: "gh-argv-graphql",
    file,
    line,
    signature,
    detail: "d",
    fix: "x",
  });

  const KEY = baselineKey(f("a.ts", "pr list@argv", 1));

  test("occurrences within the allowance are grandfathered", () => {
    const found = [f("a.ts", "pr list@argv", 1), f("a.ts", "pr list@argv", 9)];
    expect(unbaselined(found, new Map([[KEY, 2]]))).toEqual([]);
  });

  test("THE (n+1)th OCCURRENCE IS REPORTED -- the hole a set-baseline leaves", () => {
    const found = [f("a.ts", "pr list@argv", 1), f("a.ts", "pr list@argv", 9), f("a.ts", "pr list@argv", 40)];
    const left = unbaselined(found, new Map([[KEY, 2]]));
    // Only the EXCESS, so the refusal says "you added one" rather than
    // re-litigating a file somebody else froze.
    expect(left).toHaveLength(1);
    expect(left[0]?.line).toBe(40);
  });

  test("an unlisted key is fully reported", () => {
    const found = [f("new.ts", "pr view@argv", 3)];
    expect(unbaselined(found, new Map())).toEqual(found);
  });

  test("tally counts per key", () => {
    const found = [f("a.ts", "pr list@argv", 1), f("a.ts", "pr list@argv", 9), f("b.ts", "pr list@argv", 1)];
    expect(tally(found).get(KEY)).toBe(2);
    expect(tally(found).get(baselineKey(f("b.ts", "pr list@argv", 1)))).toBe(1);
  });

  test("a malformed baseline grandfathers NOTHING, rather than everything", () => {
    // Fail loud, not permissive. A baseline nobody can parse must not read as
    // a licence for the whole tree.
    expect(parseBaseline("[]").size).toBe(0);
    expect(parseBaseline('{"k": "many"}').size).toBe(0);
    expect(parseBaseline('{"k": 0}').size).toBe(0);
    expect(parseBaseline('{"k": 3}').get("k")).toBe(3);
  });

  test("the key is line-free, so an edit above a row does not thaw it", () => {
    expect(baselineKey(f("a.ts", "pr list@argv", 1))).toBe(baselineKey(f("a.ts", "pr list@argv", 900)));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A CHECK THAT DID NOT RUN MUST NOT LOOK LIKE ONE THAT PASSED
// ═══════════════════════════════════════════════════════════════════════════

describe("refusals about the audit itself", () => {
  test("an unreadable file is a finding, not a skip", () => {
    const found = auditFiles([{ path: "a.ts", text: "", readError: "EACCES" }]);
    expect(rules(found)).toEqual(["unreadable"]);
  });

  test("scanning below the floor fails, even with an otherwise clean tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "gql-floor-"));
    try {
      writeFileSync(join(dir, "a.ts"), `run("gh", ["api", "repos/o/r/pulls"]);\n`, "utf8");
      expect(main([dir, "--min-files", "500", "--quiet"])).toBe(1);
      expect(main([dir, "--min-files", "1", "--quiet"])).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// END TO END -- the binary, over real directories
// ═══════════════════════════════════════════════════════════════════════════

describe("CLI over real directories", () => {
  test("a tree with the defect exits 1; the corrected tree exits 0", () => {
    const root = mkdtempSync(join(tmpdir(), "gql-e2e-"));
    try {
      const red = join(root, "red");
      const green = join(root, "green");
      mkdirSync(join(red, "workflows"), { recursive: true });
      mkdirSync(green, { recursive: true });

      writeFileSync(
        join(red, "loop.ts"),
        `const r = spawnSync("gh", ["pr", "view", "1", "--json", "state"]);\n`,
        "utf8",
      );
      writeFileSync(
        join(red, "workflows", "w.yml"),
        `jobs:\n  x:\n    steps:\n      - run: |\n          # gh pr list here is prose, not a call\n          S=$(gh pr view "$N" --json state)\n`,
        "utf8",
      );

      writeFileSync(
        join(green, "loop.ts"),
        `const r = spawnSync("gh", ["api", "repos/o/r/pulls/1"]);\nspawnSync("gh", ["pr", "merge", "1", "--auto", "--squash"]);\n`,
        "utf8",
      );

      expect(main([red, "--min-files", "2", "--quiet"])).toBe(1);
      expect(main([green, "--min-files", "1", "--quiet"])).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a baseline written from a tree makes that same tree green, and one more call red", () => {
    const dir = mkdtempSync(join(tmpdir(), "gql-base-"));
    try {
      const src = join(dir, "src");
      mkdirSync(src, { recursive: true });
      const file = join(src, "a.ts");
      const baseline = join(dir, "b.json");
      writeFileSync(file, `run("gh", ["pr", "list"]);\n`, "utf8");

      expect(main([src, "--baseline", baseline, "--write-baseline", "--quiet"])).toBe(1);
      expect(main([src, "--baseline", baseline, "--quiet"])).toBe(0);

      writeFileSync(file, `run("gh", ["pr", "list"]);\nrun("gh", ["pr", "list"]);\n`, "utf8");
      expect(main([src, "--baseline", baseline, "--quiet"])).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
