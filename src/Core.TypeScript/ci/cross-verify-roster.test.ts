// cross-verify-roster.test.ts -- the falsifiers for the 31-way `cross-verify` split.
//
// Two things have to be true for the split to be an improvement rather than a hole:
//
//   1. THE ROSTER AND THE MATRIX CANNOT DIVERGE. Two views of one list is fine only if
//      something refuses the moment they disagree. §"parity" mutates each direction and
//      requires a named refusal for each.
//   2. THE FLOOR IS NOT WEAKENED. A decomposition that quietly makes 31 audits
//      non-blocking is a silent floor removal — the worst available outcome and the
//      easiest to reach by accident. §"the floor is not weakened" runs the aggregate
//      job's OWN committed shell against every result GitHub can produce.
//
// The second is deliberately not a test of a TypeScript function. The thing that has to
// hold is a property of `gate.yml`, so `gate.yml` is what is read and what is executed.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { classifyFloorResult, parseDecls } from "./gate-skip-verdict.ts";
import {
  CROSS_VERIFY_AUDITS,
  CROSS_VERIFY_ROSTER_PATH,
  checkName,
  compareRosterToMatrix,
  MATRIX_JOB_ID,
  parseMatrixAudits,
} from "./cross-verify-roster.ts";

const GATE_YML_PATH = ".github/workflows/gate.yml";
const GATE_YML = readFileSync(GATE_YML_PATH, "utf8");
const GATE = parse(GATE_YML) as {
  jobs: Record<
    string,
    { name?: string; needs?: string | string[]; if?: string; strategy?: unknown; steps?: unknown[] }
  >;
};
const ROSTER_IDS = CROSS_VERIFY_AUDITS.map((a) => a.id);
const ROSTER_SCRIPT = "src/Core.TypeScript/ci/cross-verify-roster.ts";

describe("the roster is a roster", () => {
  test("ids are unique, kebab-case, and safe in a check name", () => {
    expect(new Set(ROSTER_IDS).size).toBe(ROSTER_IDS.length);
    for (const id of ROSTER_IDS) {
      // A ruleset may come to reference `cross-verify (<id>)`. Spaces and parentheses in
      // an id would make that string ambiguous to read and to match.
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  test("every entry has something to run", () => {
    for (const a of CROSS_VERIFY_AUDITS) {
      expect(a.command.trim().length).toBeGreaterThan(0);
      expect(a.title.trim().length).toBeGreaterThan(0);
    }
  });

  test("the check name is the string a ruleset would reference", () => {
    expect(checkName("ace-suite")).toBe("cross-verify (ace-suite)");
  });

  test("an empty roster is refused rather than reported as agreement", () => {
    // The vacuity case: 0 audits and 0 matrix legs "agree" on nothing. `parseMatrixAudits`
    // returns null for an empty list and `compareRosterToMatrix` blocks on null, so a
    // gate.yml whose matrix was emptied cannot pass parity.
    expect(parseMatrixAudits("  cross-verify-audit:\n    strategy:\n      matrix:\n        audit:\n")).toBeNull();
    expect(compareRosterToMatrix([], null).ok).toBe(false);
  });
});

describe("parity — the roster and gate.yml are two views of one list", () => {
  test("they agree today, as sequences", () => {
    const matrix = parseMatrixAudits(GATE_YML);
    expect(matrix).not.toBeNull();
    expect(matrix).toEqual(ROSTER_IDS);
    expect(compareRosterToMatrix(ROSTER_IDS, matrix).ok).toBe(true);
  });

  test("a roster entry with no matrix leg is refused BY NAME", () => {
    // The dangerous direction: the audit exists, nothing runs it, and the checks list
    // looks complete. This is the shape that let `audit-dep-currency.ts` hide a root
    // flake for months.
    const r = compareRosterToMatrix([...ROSTER_IDS, "an-audit-nothing-runs"], ROSTER_IDS);
    expect(r.ok).toBe(false);
    expect(r.problems.join("\n")).toContain("an-audit-nothing-runs");
  });

  test("a matrix leg with no roster entry is refused BY NAME", () => {
    const r = compareRosterToMatrix(ROSTER_IDS, [...ROSTER_IDS, "a-leg-with-nothing-to-run"]);
    expect(r.ok).toBe(false);
    expect(r.problems.join("\n")).toContain("a-leg-with-nothing-to-run");
  });

  test("the same ids in a different order is refused", () => {
    const shuffled = [...ROSTER_IDS].reverse();
    const r = compareRosterToMatrix(ROSTER_IDS, shuffled);
    expect(r.ok).toBe(false);
    expect(r.problems.join("\n")).toContain("DIFFERENT ORDER");
  });

  test("an unreadable matrix blocks rather than passing", () => {
    const r = compareRosterToMatrix(ROSTER_IDS, null);
    expect(r.ok).toBe(false);
  });

  test("every leg checks parity before running its own audit", () => {
    // Not a claim about intent: `--run` with a good id but a gate.yml whose matrix has
    // been mutated must fail, and it must fail for the PARITY reason rather than because
    // the audit itself broke.
    const mutated = GATE_YML.replace("          - ace-suite\n", "");
    const tmp = `${process.env.TMPDIR ?? "/tmp"}/cross-verify-parity-mutant-${process.pid}.yml`;
    Bun.write(tmp, mutated);
    const out = spawnSync("bun", [ROSTER_SCRIPT, "--run", "no-raw-nul-in-source", "--gate-yml", tmp], {
      encoding: "utf8",
    });
    expect(out.status).toBe(1);
    expect(`${out.stdout}${out.stderr}`).toContain("ace-suite");
  });

  test("an unknown id fails loudly instead of passing as a no-op", () => {
    const out = spawnSync("bun", [ROSTER_SCRIPT, "--run", "not-an-audit"], { encoding: "utf8" });
    expect(out.status).toBe(1);
    expect(`${out.stdout}${out.stderr}`).toContain("unknown audit id");
  });

  test("--check-parity passes against the real gate.yml", () => {
    const out = spawnSync("bun", [ROSTER_SCRIPT, "--check-parity"], { encoding: "utf8" });
    expect(out.status).toBe(0);
  });
});

describe("event gating — a NOT-APPLICABLE leg says so out loud", () => {
  // `task-zetaid-resolves` reads the PR body and exits 2 on empty input, so it must not
  // run on push. Before the split that was a grey step nobody read; the replacement has
  // to be visibly a non-run, not a silent pass.
  const prOnly = CROSS_VERIFY_AUDITS.filter((a) => a.events !== undefined);

  test("at least one audit is event-restricted (otherwise this section is vacuous)", () => {
    expect(prOnly.length).toBeGreaterThan(0);
    expect(prOnly.map((a) => a.id)).toContain("task-zetaid-resolves");
  });

  test("a restricted audit on the wrong event exits 0 and prints NOT APPLICABLE", () => {
    const out = spawnSync("bun", [ROSTER_SCRIPT, "--run", "task-zetaid-resolves"], {
      encoding: "utf8",
      env: { ...process.env, GITHUB_EVENT_NAME: "push" },
    });
    expect(out.status).toBe(0);
    expect(`${out.stdout}${out.stderr}`).toContain("NOT APPLICABLE");
  });

  test("on its own event it actually runs — and refuses empty input", () => {
    // The control for the test above: if the event check swallowed the run entirely, this
    // would also be 0 and the previous test would prove nothing. `audit-task-zetaid-resolves`
    // exits 2 on empty stdin, so a 2 here is proof the audit executed.
    const out = spawnSync("bun", [ROSTER_SCRIPT, "--run", "task-zetaid-resolves"], {
      encoding: "utf8",
      env: { ...process.env, GITHUB_EVENT_NAME: "pull_request", PR_BODY: "" },
    });
    expect(out.status).toBe(2);
  });
});

describe("the floor is not weakened", () => {
  // The split's one genuinely dangerous failure mode. `cross-verify` is a floor job; a
  // decomposition that made its 31 audits non-blocking would look exactly like a success
  // and would be found by nobody. Every assertion here reads `gate.yml` or runs the real
  // verdict logic against it — none of them takes this file's word for anything.
  const DECLS = parseDecls(GATE_YML);

  test("`gate (required)` still names `cross-verify` — the floor list is untouched", () => {
    const needs = GATE.jobs["gate-required"]?.needs;
    expect(Array.isArray(needs)).toBe(true);
    expect(needs as string[]).toContain(MATRIX_JOB_ID);
  });

  test("the job holding that id IS the matrix — so `needs.<job>.result` is the aggregate", () => {
    // GitHub collapses a matrix into one needs-result, `success` only when every leg
    // succeeded. Keeping the floor's job id ON the matrix is what makes the aggregate
    // verdict a property of the platform rather than of a roll-up someone could break.
    const job = GATE.jobs[MATRIX_JOB_ID];
    expect(job).toBeDefined();
    const matrix = (job?.strategy as { matrix?: { audit?: string[] } } | undefined)?.matrix?.audit;
    expect(matrix).toEqual(ROSTER_IDS);
  });

  test("the matrix does not fail fast — a red must name EVERY defect, not the first", () => {
    const strategy = GATE.jobs[MATRIX_JOB_ID]?.strategy as { "fail-fast"?: boolean } | undefined;
    expect(strategy?.["fail-fast"]).toBe(false);
  });

  test("every non-success result BLOCKS, judged by `gate (required)`'s own verdict logic", () => {
    // Not a restatement of the rule: this calls the function the roll-up actually runs,
    // against the committed gate.yml, for all four values GitHub documents plus a missing
    // one. `skipped` is the subtle case — it is only acceptable for a job with a job-level
    // `if:`, and `cross-verify` deliberately declares none.
    for (const bad of ["failure", "cancelled", "skipped", "<missing>"]) {
      const v = classifyFloorResult(MATRIX_JOB_ID, new Map([[MATRIX_JOB_ID, bad]]), DECLS);
      expect(v.kind).toBe("block");
    }
    const ok = classifyFloorResult(MATRIX_JOB_ID, new Map([[MATRIX_JOB_ID, "success"]]), DECLS);
    expect(ok.kind).toBe("pass");
  });

  test("`cross-verify` declares no job-level `if:` — a skip has no licence", () => {
    // The control for the `skipped` case above: if someone gives this job an `if:`, a
    // skipped floor job silently becomes a legitimate one, and this test says so.
    expect(GATE.jobs[MATRIX_JOB_ID]?.if).toBeUndefined();
    expect(DECLS.ifOf.has(MATRIX_JOB_ID)).toBe(false);
  });

  test("no audit can be added to the job except through the roster", () => {
    // The structural half of parity. The job has exactly one `run:` step that is an audit,
    // and it is the generic runner, so there is nowhere to paste a 32nd audit the roster
    // would not see. A new `run:` step here fails this test.
    const steps = GATE.jobs[MATRIX_JOB_ID]?.steps as Array<{ run?: string; uses?: string }> | undefined;
    expect(steps).toBeDefined();
    const runs = (steps ?? []).map((s) => s.run).filter((r): r is string => typeof r === "string");
    expect(runs).toHaveLength(2); // `bun install --frozen-lockfile`, and the runner
    expect(runs.some((r) => r.includes("cross-verify-roster.ts --run"))).toBe(true);
    expect(runs.every((r) => !r.includes("${{"))).toBe(true); // no template-injection surface
  });

  test("every audit that ran before the split still has a leg, minus the one deliberately removed", () => {
    // The migration's own falsifier: the pre-split job ran 31 audit steps, and losing one
    // in the move would be invisible — the checks list would simply be one name shorter.
    //
    // It is 30 as of 2026-08-26: `orphaned-archive-refs` (AH003) was removed from the floor
    // ON PURPOSE and now runs, still fatal, on a schedule in
    // `.github/workflows/archive-strand-alarm.yml`. This assertion is what made that a
    // DECISION rather than a disappearance — it went red on the removal, which is the whole
    // reason the number is written down. Lower it only alongside the two lines below.
    expect(ROSTER_IDS).toHaveLength(30);
    expect(ROSTER_IDS).not.toContain("orphaned-archive-refs");
  });
});

describe("the roster is a CI invocation surface, and other audits must see it as one", () => {
  // `audit-linter-coverage-vs-invocation.ts` refuses a package.json check that no workflow
  // invokes, on the ground that a check wired to nothing reads exactly like a check that
  // passed. Moving 31 commands out of `run:` bodies made five of them LOOK unwired to it —
  // `hygiene:dotnet-pin-parity`, `mise-toolchain-couplings`, `no-check-then-use-file-races`,
  // `stage0-independence`, `tech-radar-claims` — and that report would have been exactly
  // backwards: all five run on the required floor of every PR. It went red on this branch's
  // first CI run and named all five.
  const COMMANDS = CROSS_VERIFY_AUDITS.map((a) => a.command).join("\n");

  test("the five package.json scripts the refactor moved are still invoked, from here", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    for (const script of [
      "hygiene:dotnet-pin-parity",
      "hygiene:mise-toolchain-couplings",
      "hygiene:no-check-then-use-file-races",
      "hygiene:stage0-independence",
      "hygiene:tech-radar-claims",
    ]) {
      const cmd = pkg.scripts[script] ?? "";
      const path = /([\w./-]+\.ts)/.exec(cmd)?.[1]?.replace(/^\.\//, "");
      const named = COMMANDS.includes(`run ${script}`) || (path !== undefined && COMMANDS.includes(path));
      expect(named).toBe(true);
    }
  });

  // NOT duplicated here: running `audit-linter-coverage-vs-invocation.ts` end to end. It
  // costs ~20 s (it asks markdownlint to resolve its own corpus) and it already runs, on
  // every PR, in `lint (bash retirement inventory + hygiene unit tests)`. What is tested
  // above is the matching rule that audit applies, restated against the roster — a
  // deliberate duplication, and the reason it is safe is that the real audit going red is
  // what put this section here in the first place.

  test("only COMMANDS count as invocation, never the roster's prose", () => {
    // The roster carries every replaced step's rationale verbatim, and those paragraphs
    // name scripts and tools they do not invoke. If the audit ever grepped the whole file
    // instead of the command strings, a mention would launder into an invocation — the
    // vacuity class, arriving through the fix for the vacuity class.
    const wholeFile = readFileSync(CROSS_VERIFY_ROSTER_PATH, "utf8");
    expect(wholeFile).toContain("audit-dep-currency.ts");
    expect(COMMANDS).not.toContain("audit-dep-currency.ts");
  });
});

describe("the promotion doc lists the exact strings", () => {
  test("docs/ci/CROSS-VERIFY-CHECK-NAMES.md names every check", () => {
    // Whoever performs the ruleset promotion copies strings out of that doc. A doc that
    // silently stops covering the roster is how a promotion drops a context.
    const doc = readFileSync("docs/ci/CROSS-VERIFY-CHECK-NAMES.md", "utf8");
    for (const id of ROSTER_IDS) {
      expect(doc).toContain(checkName(id));
    }
  });
});
