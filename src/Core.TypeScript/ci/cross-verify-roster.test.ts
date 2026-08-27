// cross-verify-roster.test.ts -- the falsifiers for the 31-way `cross-verify` split.
//
// Two things have to be true for the split to be an improvement rather than a hole:
//
//   1. THE ROSTER AND THE MATRIX CANNOT DIVERGE. As of 2026-08-26 the matrix is not a
//      second list at all: it is GENERATED from the roster into a delimited region of
//      `gate.yml`, and the same command is the drift check and the fix. §"generation"
//      proves the round trip is byte-identical, that a hand-edit is caught and named,
//      that one command moves both views, and — the mutation — that a generator reading
//      an EMPTY roster cannot pass. §"parity" keeps the id-level diagnosis honest.
//   2. THE FLOOR IS NOT WEAKENED. A decomposition that quietly makes 31 audits
//      non-blocking is a silent floor removal — the worst available outcome and the
//      easiest to reach by accident. §"the floor is not weakened" runs the aggregate
//      job's OWN committed shell against every result GitHub can produce.
//
// The second is deliberately not a test of a TypeScript function. The thing that has to
// hold is a property of `gate.yml`, so `gate.yml` is what is read and what is executed.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
import { classifyFloorResult, parseDecls } from "./gate-skip-verdict.ts";
import {
  CROSS_VERIFY_AUDITS,
  CROSS_VERIFY_ROSTER_PATH,
  checkName,
  compareRosterToMatrix,
  CHECK_NAMES_DOC_PATH,
  CHECK_NAMES_DOC_REGION,
  deriveGateYml,
  deriveRegion,
  DERIVE_FIX_COMMAND,
  GATE_MATRIX_REGION,
  GENERATED_BEGIN,
  GENERATED_END,
  GENERATED_REGIONS,
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

  test("every leg checks that the matrix is derived before running its own audit", () => {
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

  test("--derive passes against the real gate.yml", () => {
    const out = spawnSync("bun", [ROSTER_SCRIPT, "--derive"], { encoding: "utf8" });
    expect(out.status).toBe(0);
  });
});

describe("generation — gate.yml's matrix is DERIVED, so there is nothing to keep in sync", () => {
  // The redesign Aaron asked for on #15666, and its falsifiers. Every assertion below
  // reads the committed `gate.yml`; none takes the generator's word for anything.

  const derivedNow = deriveGateYml(GATE_YML);

  test("the committed workflow IS what the roster generates, byte for byte", () => {
    // The round trip. If this ever fails the generator is not deterministic, and nothing
    // else in this section means anything.
    expect(derivedNow.ok).toBe(true);
    if (derivedNow.ok) expect(derivedNow.next).toBe(GATE_YML);
  });

  test("generating twice is generating once — the region is a fixed point", () => {
    expect(derivedNow.ok).toBe(true);
    if (!derivedNow.ok) return;
    const twice = deriveGateYml(derivedNow.next);
    expect(twice.ok).toBe(true);
    if (twice.ok) expect(twice.next).toBe(derivedNow.next);
  });

  test("a hand-edit inside the region is caught, and the drift is NAMED", () => {
    // The whole point: the region stays hand-editable — it is a text file — so the guard
    // has to be a check rather than an impossibility. Deleting a leg by hand must not
    // read as agreement.
    const mutated = GATE_YML.replace("          - ace-suite\n", "");
    expect(mutated).not.toBe(GATE_YML);
    const d = deriveGateYml(mutated);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.next).not.toBe(mutated);
    // ...and the id-level diagnosis says which one, rather than "the bytes differ".
    const diag = compareRosterToMatrix(ROSTER_IDS, parseMatrixAudits(mutated));
    expect(diag.ok).toBe(false);
    expect(diag.problems.join("\n")).toContain("ace-suite");
  });

  test("ONE command moves both views — adding an audit", () => {
    const added = [...CROSS_VERIFY_AUDITS, { id: "a-brand-new-audit", title: "t", command: "true" }];
    const d = deriveGateYml(GATE_YML, added);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(parseMatrixAudits(d.next)).toEqual([...ROSTER_IDS, "a-brand-new-audit"]);
    // Nothing outside the region moved.
    expect(d.next.split("\n").length).toBe(GATE_YML.split("\n").length + 1);
  });

  test("ONE command moves both views — removing an audit", () => {
    const removed = CROSS_VERIFY_AUDITS.filter((a) => a.id !== "ace-suite");
    const d = deriveGateYml(GATE_YML, removed);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(parseMatrixAudits(d.next)).not.toContain("ace-suite");
    expect(parseMatrixAudits(d.next)).toEqual(ROSTER_IDS.filter((i) => i !== "ace-suite"));
  });

  test("MUTATION — a generator that reads an empty roster cannot pass", () => {
    // The vacuity control. If `renderMatrixRegion` were broken to emit nothing, an
    // equality-only test could still pass by comparing two empty lists. It cannot pass
    // this one: the empty render must differ from the committed workflow.
    const d = deriveGateYml(GATE_YML, []);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.next).not.toBe(GATE_YML);
      expect(parseMatrixAudits(d.next)).toBeNull();
    }
    expect(GATE_MATRIX_REGION.render([], "        ")).not.toContain("- ace-suite");
    expect(GATE_MATRIX_REGION.render(CROSS_VERIFY_AUDITS, "        ")).toContain("- ace-suite");
  });

  test("missing or duplicated markers FAIL CLOSED rather than deriving nothing", () => {
    // The markers are the only thing that tells the generator what it owns. Deleting them
    // must not read as "no drift"; duplicating them must not let it silently pick one.
    for (const broken of [
      GATE_YML.replace(GENERATED_BEGIN, "# gone"),
      GATE_YML.replace(GENERATED_END, "# gone"),
      GATE_YML.replace(GENERATED_BEGIN, `${GENERATED_BEGIN}\n        ${GENERATED_BEGIN}`),
    ]) {
      const d = deriveGateYml(broken);
      expect(d.ok).toBe(false);
      if (!d.ok) expect(d.problems.join("\n")).toContain("marker");
    }
  });

  test("the region carries its own fix, runnable as printed", () => {
    // A drift gate whose message does not name the fix is a drift gate people work around.
    expect(GATE_YML).toContain(DERIVE_FIX_COMMAND);
    expect(DERIVE_FIX_COMMAND).toBe(`bun ${CROSS_VERIFY_ROSTER_PATH} --derive --write`);
  });

  test("--derive reports drift with rc=1 and --write clears it, on a real file", () => {
    // End to end, through the CLI, on a copy — the ergonomic claim measured rather than
    // asserted: check says 1, fix says 0, check then says 0.
    const tmp = `${process.env.TMPDIR ?? "/tmp"}/cross-verify-derive-${process.pid}.yml`;
    writeFileSync(tmp, GATE_YML.replace("          - mumps-zeta-id\n", ""));

    const before = spawnSync("bun", [ROSTER_SCRIPT, "--derive", "--gate-yml", tmp], { encoding: "utf8" });
    expect(before.status).toBe(1);
    expect(`${before.stdout}${before.stderr}`).toContain("mumps-zeta-id");

    const fix = spawnSync("bun", [ROSTER_SCRIPT, "--derive", "--write", "--gate-yml", tmp], { encoding: "utf8" });
    expect(fix.status).toBe(0);

    const after = spawnSync("bun", [ROSTER_SCRIPT, "--derive", "--gate-yml", tmp], { encoding: "utf8" });
    expect(after.status).toBe(0);
    expect(readFileSync(tmp, "utf8")).toBe(GATE_YML);
    rmSync(tmp, { force: true });
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

describe("a failing audit ANNOTATES — an exit code is not a diagnosis", () => {
  // Actions' own annotation for a failing `run:` step is `Process completed with exit
  // code 1`. It names no audit, no command and no leg, and with 31 legs sharing one
  // script it does not even narrow the failure to one of them. On 2026-08-27
  // `cross-verify (ace-suite)` went red on `main` carrying exactly that one sentence and
  // nothing else, and the actual cause (two drift-gate tests over Bun's default 5000 ms
  // cap, with nothing drifted) was readable only by downloading the job log.

  test("a non-zero audit emits an ::error:: naming the audit and the exit code", () => {
    // Reuses the one audit with a reachable non-zero exit that needs no fixture:
    // `task-zetaid-resolves` exits 2 on empty stdin, on its own event.
    const out = spawnSync("bun", [ROSTER_SCRIPT, "--run", "task-zetaid-resolves"], {
      encoding: "utf8",
      env: { ...process.env, GITHUB_EVENT_NAME: "pull_request", PR_BODY: "" },
    });
    expect(out.status).toBe(2);
    const text = `${out.stdout}${out.stderr}`;
    expect(text).toContain("::error title=cross-verify (task-zetaid-resolves)::");
    // The exit code must be carried, not just the fact of failure: a 2 is a check that
    // never ran and a 1 is a check that failed, and the annotation must let a reader tell
    // them apart without opening the log.
    expect(text).toContain("(exit 2)");
  });

  test("a PASSING audit emits no ::error:: (the annotation is not unconditional)", () => {
    // The control. Without it, an annotation printed on every run would satisfy the
    // assertion above while telling a reader nothing — a reporter that always reports a
    // failure is the vacuity class pointed at diagnostics.
    const out = spawnSync("bun", [ROSTER_SCRIPT, "--run", "task-zetaid-resolves"], {
      encoding: "utf8",
      env: { ...process.env, GITHUB_EVENT_NAME: "push" },
    });
    expect(out.status).toBe(0);
    expect(`${out.stdout}${out.stderr}`).not.toContain("::error");
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

  test("the floor is non-vacuous, every audit on it has a leg, and a removal stays a DECISION", () => {
    // This was `expect(ROSTER_IDS).toHaveLength(31)`, then `toHaveLength(30)` — a THIRD
    // place encoding the count, which went red on #15666's legitimate removal of one audit.
    // #15666's argument for keeping a number is real and is kept here: that red is what
    // made the removal a DECISION rather than a disappearance. But the number is not what
    // records the decision — the NAME is. `not.toContain` pins exactly the claim ("that
    // audit is deliberately absent") and costs nothing on every unrelated add, whereas the
    // count is a falsifier for "nobody changed the number", a different and much weaker
    // claim that goes stale on every routine add.
    //
    // What actually has to hold is DERIVED here: every roster entry has a leg (the
    // `parseMatrixAudits` equality, read independently of the generator), and the floor is
    // not empty. The bound is a NON-VACUITY FLOOR, not a count: it exists so a roster that
    // read as `[]` cannot satisfy this section, and it needs revisiting only if the floor
    // genuinely shrinks by a third — which is a decision, not a routine add.
    expect(ROSTER_IDS.length).toBeGreaterThanOrEqual(20);
    expect(parseMatrixAudits(GATE_YML)).toEqual(ROSTER_IDS);
    // Removed from the floor ON PURPOSE (AH003); it now runs, still fatal, on a schedule in
    // `.github/workflows/archive-strand-alarm.yml`. Naming it is the decision record.
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
  // Whoever performs the ruleset promotion copies strings out of that doc, so a doc that
  // stops covering the roster is how a promotion drops a context. It used to be a third
  // hand-maintained copy of the same list, kept honest by the containment test below; the
  // table is now a generated region, so it cannot go stale in the first place. Both are
  // kept: containment is what the promoter actually needs, derivation is what makes it
  // free.
  const DOC = readFileSync(CHECK_NAMES_DOC_PATH, "utf8");

  test("it names every check", () => {
    for (const id of ROSTER_IDS) {
      expect(DOC).toContain(checkName(id));
    }
  });

  test("its table IS what the roster generates, byte for byte", () => {
    const d = deriveRegion(CHECK_NAMES_DOC_REGION, DOC);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.next).toBe(DOC);
  });

  test("a hand-edited cell is caught rather than absorbed", () => {
    const mutated = DOC.replace("Ace package-manager suite", "something else entirely");
    expect(mutated).not.toBe(DOC);
    const d = deriveRegion(CHECK_NAMES_DOC_REGION, mutated);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.next).toBe(DOC); // regeneration restores it exactly
  });

  test("removing an audit moves the table too — one command, every view", () => {
    const removed = CROSS_VERIFY_AUDITS.filter((a) => a.id !== "ace-suite");
    const d = deriveRegion(CHECK_NAMES_DOC_REGION, DOC, removed);
    expect(d.ok).toBe(true);
    if (d.ok) {
      // Scoped to the REGION, not the whole document: `cross-verify (ace-suite)` also
      // appears in the prose recounting a real failure, and a whole-file containment
      // assertion would have been testing that prose instead of the generator.
      const table = d.next.slice(
        d.next.indexOf(CHECK_NAMES_DOC_REGION.begin),
        d.next.indexOf(CHECK_NAMES_DOC_REGION.end),
      );
      expect(table).not.toContain(checkName("ace-suite"));
      for (const id of ROSTER_IDS.filter((i) => i !== "ace-suite")) expect(table).toContain(checkName(id));
    }
  });

  test("every derived view is reachable from one roster, and each one is in sync", () => {
    // The roster of rosters. A new generated region added to `GENERATED_REGIONS` is
    // checked here without anyone remembering to write a test for it; a region added
    // anywhere ELSE is exactly the duplicate this change removed.
    expect(GENERATED_REGIONS.length).toBeGreaterThanOrEqual(2);
    for (const region of GENERATED_REGIONS) {
      const text = readFileSync(region.path, "utf8");
      const d = deriveRegion(region, text);
      expect(d.ok).toBe(true);
      if (d.ok) expect(d.next).toBe(text);
      // ...and it is not vacuously in sync: an empty roster must NOT reproduce it.
      const empty = deriveRegion(region, text, []);
      expect(empty.ok).toBe(true);
      if (empty.ok) expect(empty.next).not.toBe(text);
    }
  });
});
