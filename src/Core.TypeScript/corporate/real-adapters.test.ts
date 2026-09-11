/**
 * real-adapters.test.ts — the same organization, against a real repository.
 *
 * ── WHY THIS FILE EXISTS SEPARATELY FROM `end-to-end.test.ts` ────────────────
 * That file runs the whole organization over SIMULATED ports and says so about itself: every
 * assertion there is evidence about the organization's wiring, and none of it is evidence that any
 * work was performed. The distinction is the one this register is built around, and a suite that
 * blurred it would be the vacuity class at the top of the stack — a green end-to-end file cited
 * later as proof of something it never measured.
 *
 * So this file does the other half. A real `git init` in a temp directory, a real inbox on disk, a
 * real command as the work executor, real change control — and the assertion is on the REPOSITORY,
 * read back with `git log` after the run. Not the report's opinion of what it did.
 *
 * ── WHAT IT PINS ─────────────────────────────────────────────────────────────
 * That the real path still works. It is the path that rots: every change in this register is made
 * and verified against simulated adapters, because they are fast and deterministic, and the run
 * that touches a repository is the one nobody re-runs. This test is that re-run.
 */

import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { agentsFromChart, runOrgRuntime, type OrgRuntimeDeps } from "./org-runtime";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import {
  autoApproveReview,
  commandReview,
  commandTestRunner,
  commandWorkExecutor,
  directoryIntake,
  gitChangeControl,
  gitWorktreeChangeControl,
  revisionOf,
} from "./adapters";
import { gitDataSource } from "./git-data-source";
import { foldLandedChanges } from "./org-fold";
import { Fidelity, Port } from "./providers";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

/** A real repository with one commit on `main`. */
function realRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-real-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf-8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "T");
  writeFileSync(join(dir, "README.md"), "# checkout\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  return dir;
}

/**
 * A real inbox holding one complete ticket.
 *
 * COMPLETE is load-bearing: the first version of this fixture had no `evidenceRefs` and intake
 * refused it — *"a defect needs at least one piece of evidence"*. That refusal is the register
 * working, and it is worth naming here so the fixture is not later "fixed" by weakening triage.
 */
function realInbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-inbox-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "PROJ-9.json"),
    JSON.stringify({
      source: "jira",
      externalId: "PROJ-9",
      title: "checkout double-charges when a coupon is applied twice",
      body: "apply the same coupon twice at checkout and the order is billed twice",
      kind: "defect",
      severity: "high",
      reproduction: "apply the same coupon twice at checkout",
      evidenceRefs: ["log:order-88213-double-charge"],
    }),
  );
  return dir;
}

async function runAgainst(
  repo: string,
  inbox: string,
  over: { readonly work?: unknown; readonly change?: unknown } = {},
  runtime: Record<string, unknown> = {},
  worktreeRoot?: string,
) {
  let n = 0;
  return runOrgRuntime({
    chart,
    agents: agentsFromChart(chart),
    observations: [],
    externalEvents: [],
    acceptingHatId: "cto",
    resourceAuthorityHatId: "rmo_office",
    priorityDeciderHatId: "cto",
    createId: (p: string) => `${p}-${String(++n).padStart(3, "0")}`,
    nowMs: 0,
    workBlockMs: 3_600_000,
    leaseMs: 300_000,
    // The ORGANIZATION'S OWN MERGE is what this suite exercises, so it is stated - a real
    // repository is otherwise never merged into (see `ProcessSetting.Delivery`).
    settings: [{ setting: "delivery", value: "merge", why: "this suite exercises the organization's own merge" }],
    ...runtime,
    dataSource: gitDataSource({ repoDir: repo, ref: "main", extensions: [".md"] }),
    providers: {
      intake: directoryIntake(inbox),
      // `argsFor` builds the WHOLE argument list, node included — the executor appends nothing.
      // (The CLI reads the same way: its own `argsFor` is what puts the work id on the end.) A
      // command told nothing about the item it is working on would produce the same commit for
      // every task, so the id lands as the commit message here.
      work: commandWorkExecutor({
        command: "git",
        argsFor: (node) => ["commit", "--allow-empty", "-m", node.workId],
        cwd: repo,
      }),
      tests: commandTestRunner({ command: "git", argsFor: () => ["--version"], cwd: repo }),
      review: autoApproveReview(),
      // ISOLATED ON REQUEST. The shared-checkout adapter leaves `handle.workdir` absent to mark
      // that a change has no checkout of its own, and bound checks refuse in that state rather
      // than run somewhere arbitrary — so a test about checks has to ask for a worktree.
      change:
        worktreeRoot === undefined
          ? gitChangeControl({ cwd: repo, baseBranch: "main" })
          : gitWorktreeChangeControl({ cwd: repo, baseBranch: "main", worktreeRoot }),
      ...over,
    },
    priorityInputsFor: () => ({
      executivePriority: 0.5,
      customerImpact: 1,
      severity: 1,
      releaseRisk: 0.2,
      blockedDownstreamCount: 2,
      dependencyFanOut: 1,
      queueAgeMs: 0,
      hatScarcity: 0,
      budgetBurn: 0,
      estimatedEffort: 0.2,
    }),
  } as unknown as OrgRuntimeDeps);
}

describe("THE ORGANIZATION AGAINST A REAL REPOSITORY", () => {
  test("a ticket on disk becomes merge commits in git", async () => {
    const repo = realRepo();
    const inbox = realInbox();
    try {
      const report = await runAgainst(repo, inbox);

      // THE REPOSITORY, not the report. `git log` after the fact is the only reading that cannot
      // be produced by an organization that merely believed it delivered.
      const merges = execFileSync("git", ["log", "--merges", "--oneline", "main"], {
        cwd: repo,
        encoding: "utf-8",
      })
        .split("\n")
        .filter((l) => l.trim() !== "");

      expect(merges.length).toBeGreaterThan(0);
      expect(report.changesLanded.length).toBe(merges.length);
      // And the two agree about WHICH work landed.
      for (const workId of report.changesLanded) {
        expect(merges.some((m) => m.includes(workId))).toBe(true);
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 120_000);

  test("THE FIDELITY REPORT NAMES WHAT IT REACHED, and it is not empty", async () => {
    const repo = realRepo();
    const inbox = realInbox();
    try {
      const report = await runAgainst(repo, inbox);
      // Five real ports, and `reached` rather than merely configured — the distinction this
      // register added after a run reported "touched something real: review" with zero gate
      // evaluations.
      for (const port of [Port.Intake, Port.WorkExecution, Port.TestExecution, Port.ChangeControl, Port.DataSource]) {
        expect(report.fidelity.reached).toContain(port);
      }
      // A run holding real adapters is NOT replayable, and says so.
      expect(report.fidelity.replayable).toBe(false);
      // The one honestly-simulated port is still named as such.
      expect(report.fidelity.ports.find((p) => p.port === Port.Review)?.fidelity).toBe(Fidelity.Simulated);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 120_000);

  test("DELIVERY IS NOT CLAIMED OVER A CHANGE THAT DID NOT MERGE", async () => {
    // The narrow, load-bearing rule: `delivered` is the cascade AND an empty `changesUnlanded`.
    // A run that projected a merge the port refused must not print DELIVERED, and this is the only
    // configuration in which the two can actually disagree — a simulated change control never does.
    const repo = realRepo();
    const inbox = realInbox();
    try {
      const report = await runAgainst(repo, inbox);
      // `changesUnlanded` is not on the report; the RECONCILIATION is where a projected-but-
      // unlanded change surfaces, which is the same fact read through the module built for it.
      const unlanded = report.reconciliation.disagreements.filter(
        (d) => d.kind === "projected_merged_but_not_landed",
      );
      if (report.delivered) expect(unlanded).toEqual([]);
      expect(
        report.reconciliation.disagreements.filter((d) => d.kind === "delivered_over_unlanded_change"),
      ).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 120_000);

  test("WORK THAT COMMITTED NOTHING IS NOT DELIVERED — the wiring, not the predicate", async () => {
    // ── WHAT THIS COVERS THAT THE UNIT TESTS DO NOT ────────────────────────
    // `done-implies-commit.test.ts` pins the predicate and the reconciliation's vocabulary. Neither
    // goes red if the block in `org-runtime` that JOINS them is deleted — the two halves would sit
    // there, correct and unconnected, which is the exact failure this register keeps finding. This
    // test runs the organization against a real repository and reads the verdict.
    //
    // THE ONLY CHANGE FROM THE TEST ABOVE is an executor that does not commit. Everything else —
    // the same ticket, the same gates, the same real change control — is held fixed, so a
    // difference in the verdict can only come from the commit.
    const repo = realRepo();
    const inbox = realInbox();
    try {
      const report = await runAgainst(repo, inbox, {
        // Succeeds, touches the repository, and leaves nothing behind. A worker that ran, reported
        // success, and committed nothing is not a contrived case: it is what every simulated
        // executor does, and what a real agent does when it decides no change was needed.
        work: commandWorkExecutor({ command: "git", argsFor: () => ["--version"], cwd: repo }),
      });

      // THE REPOSITORY FIRST. No merge commit exists, so any claim of delivery is false about a
      // fact anybody can check.
      const merges = execFileSync("git", ["log", "--merges", "--oneline", "main"], {
        cwd: repo,
        encoding: "utf-8",
      }).trim();
      expect(merges).toBe("");

      // ...and the organization agrees, which is the whole point.
      expect(report.delivered).toBe(false);

      // NAMED EXACTLY, not "one of these two". The first draft of this assertion accepted either
      // `done_with_nothing_merged` or `projected_merged_but_not_landed` and therefore distinguished
      // nothing — it stayed green under a mutation that deleted the code it was written for. What
      // this configuration actually produces is the second: the projection DOES reach `Merged`
      // (every gate passed), the port then refuses an empty branch, and that is a refused merge.
      expect(report.reconciliation.disagreements.map((d) => d.kind)).toContain("projected_merged_but_not_landed");

      // And the refusal says so in words an operator can act on.
      expect(report.refusals.some((r) => r.includes("could not merge"))).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 120_000);

  test("A RESUMED RUN OVER ALREADY-MERGED WORK STILL DELIVERS", async () => {
    // ── THE FALSE FAILURE THIS PREVENTS, MEASURED ──────────────────────────
    // The first cut of the done-implies-commit rule asked THIS RUN's projection whether a change
    // had merged. On a resume that is always "no": resuming opens no change for work that finished
    // earlier, so the projection sits at `Claimed` while the merge commit sits in git. Two runs
    // over one repository, before the rule consulted the log:
    //
    //     RUN 1  delivered: true    merge commits in git: 1
    //     RUN 2  delivered: false   done_with_nothing_merged    merge commits in git: 1
    //
    // A verdict that calls shipped work unshipped is worse than the gap it was closing, because it
    // fires on every healthy resumed run rather than on a rare broken one.
    const repo = realRepo();
    const inbox = realInbox();
    try {
      const first = await runAgainst(repo, inbox);
      expect(first.delivered).toBe(true);
      const merges = execFileSync("git", ["log", "--merges", "--oneline", "main"], {
        cwd: repo,
        encoding: "utf-8",
      }).trim();
      expect(merges).not.toBe("");

      // Resume exactly as `run-org --resume` does: the cascade the first run produced, and the
      // history of what landed — which is the half that makes the verdict sound.
      const second = await runAgainst(repo, inbox, {}, {
        priorCascade: first.cascade,
        alreadyLanded: new Set(first.changesLanded),
      });

      // NOTHING IS CALLED UNLANDED. The repository has not changed between the two runs.
      expect(second.changesDoneUnmerged).toEqual([]);
      expect(
        second.reconciliation.disagreements.filter((d) => d.kind === "done_with_nothing_merged"),
      ).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 180_000);

  test("A RESUMED RUN OVER WORK THAT NEVER LANDED IS REFUSED", async () => {
    // ── THE RULE FIRING. The pair matters more than either half ────────────
    // The test above resumes over work that DID land and must stay quiet. This one resumes over
    // work that never landed and must not. Same code path, same cascade shape, same real change
    // control - the ONLY difference is what the history says - so a verdict that differs between
    // them can only be reading the history, which is the property being pinned.
    const repo = realRepo();
    const inbox = realInbox();
    try {
      // A worker that succeeds and commits nothing, so there is genuinely nothing to land.
      const idle = { work: commandWorkExecutor({ command: "git", argsFor: () => ["--version"], cwd: repo }) };
      const first = await runAgainst(repo, inbox, idle);
      expect(first.delivered).toBe(false);
      expect(first.changesLanded).toEqual([]);

      // Resume, with a history that honestly reports nothing landed.
      const second = await runAgainst(repo, inbox, idle, {
        priorCascade: first.cascade,
        alreadyLanded: new Set(first.changesLanded),
      });

      expect(second.changesDoneUnmerged.length).toBeGreaterThan(0);
      expect(second.delivered).toBe(false);
      expect(
        second.reconciliation.disagreements.map((d) => d.kind),
      ).toContain("done_with_nothing_merged");
      // And it says which item and why, in words an operator can act on.
      expect(second.refusals.some((r) => r.includes("no commit exists for it"))).toBe(true);

      // THE REPOSITORY AGREES. Nothing merged, so the refusal is about a fact anybody can check.
      expect(
        execFileSync("git", ["log", "--merges", "--oneline", "main"], { cwd: repo, encoding: "utf-8" }).trim(),
      ).toBe("");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 180_000);

  test("...and WITHOUT that history the run is not judged at all, rather than judged wrongly", async () => {
    // `alreadyLanded` absent means the caller kept no store. The honest reading is NOT MEASURED, so
    // the rule declines to fire — the alternative, treating absence as "nothing has ever landed",
    // is the same false failure arriving through a different door.
    const repo = realRepo();
    const inbox = realInbox();
    try {
      const first = await runAgainst(repo, inbox);
      expect(first.delivered).toBe(true);
      const second = await runAgainst(repo, inbox, {}, { priorCascade: first.cascade });
      expect(second.changesDoneUnmerged).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 180_000);

  test("revision() REFUSES a ref it cannot resolve, rather than echoing it back", async () => {
    // `git rev-parse` prints its input back verbatim when it cannot resolve it under some
    // configurations, so a reader that trusts the output gets the string "work/nope" where it
    // expected a sha — and that string then becomes a cache key that matches nothing and collides
    // with nothing, which looks exactly like a cache that simply never hits.
    const repo = realRepo();
    try {
      const port = gitChangeControl({ cwd: repo, baseBranch: "main" });
      const out = await port.revision?.({ changeId: "c", branch: "work/never-created" });
      expect(out?.ok).toBe(false);

      // ...and the real branch resolves to two distinct 40-hex object names.
      const opened = await port.open({ workId: "task-1" } as never, { branch: "work/real" });
      expect(opened.ok).toBe(true);
      const good = await port.revision?.({ changeId: "c", branch: "work/real" });
      expect(good?.ok).toBe(true);
      if (good?.ok === true) {
        expect(good.value.commit).toMatch(/^[0-9a-f]{40}$/);
        expect(good.value.tree).toMatch(/^[0-9a-f]{40}$/);
        expect(good.value.commit).not.toBe(good.value.tree);
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  }, 60_000);

  test("revisionOf REFUSES output that is not an object name, even on a zero exit", () => {
    // ── WHY THIS IS A UNIT TEST AND NOT AN ADAPTER ONE ─────────────────────
    // The guard exists because `git rev-parse` prints its input back verbatim when it cannot
    // resolve it under some configurations. Real git will not produce "exit 0 with a non-sha" on
    // request, so through the adapter the guard is UNFALSIFIABLE — it survived a mutation that
    // deleted it outright. Injecting the runner is what makes it a check rather than a comment.
    //
    // `String.fromCharCode(10)` rather than an escape: this file is patched by scripts, and a
    // backslash escape does not survive that round trip — it arrives as a real newline and
    // splits the literal it was inside.
    const LF = String.fromCharCode(10);
    const answering = (stdout: string) => () => ({ status: 0, stdout });

    // The failure being guarded: the ref echoed back as if it were a revision.
    expect(revisionOf(answering("work/task-1" + LF), "work/task-1").ok).toBe(false);
    // An abbreviated sha is ambiguous by design and must not become a cache key.
    expect(revisionOf(answering("a1b2c3d" + LF), "HEAD").ok).toBe(false);
    // Empty output, and a warning line git sometimes prepends.
    expect(revisionOf(answering(""), "HEAD").ok).toBe(false);
    expect(revisionOf(answering("warning: refname is ambiguous" + LF), "HEAD").ok).toBe(false);

    // ...and a genuine 40-hex object name is accepted.
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const good = revisionOf(answering(sha + LF), "HEAD");
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.revision.commit).toBe(sha);

    // A non-zero exit refuses regardless of what was printed.
    expect(revisionOf(() => ({ status: 1, stdout: sha + LF }), "HEAD").ok).toBe(false);
  });

  test("A GATE BOUND TO A FAILING CHECK IS REJECTED, AND THE CHECK IS RECORDED", async () => {
    // ── THE WIRING, NOT THE MECHANISM ──────────────────────────────────────
    // `check-roster.test.ts` pins what a roster run decides. Nothing there goes red if the runtime
    // never CALLS it — the classic reader-with-no-writer, where a well-tested module sits beside a
    // gate that ignores it. This runs the organization with a check bound and reads the outcome.
    const repo = realRepo();
    const inbox = realInbox();
    try {
      const report = await runAgainst(repo, inbox, {}, {
        checkBindings: [{ gate: "implementation_review", checkIds: ["always-fails"] }],
        checkSpecs: [
          {
            id: "always-fails",
            title: "a check that finds something",
            // `exit 1` with a line on stderr: the reason has to reach the rejection, or an agent
            // sent back to fix it has nothing to go on.
            command: "echo 'src/x.ts:41 claim of arity 2 discharged by one execution' >&2; exit 1",
            falsifier: "true",
          },
        ],
        checkResults: new Map(),
      }, mkdtempSync(join(tmpdir(), "wt-")));

      // The check ran and its verdict was RECORDED against a tree.
      const recorded = report.trace
        .map((e) => e.fact)
        .filter((f) => f?.kind === "check_result");
      expect(recorded.length).toBeGreaterThan(0);

      // The gate it was bound to did not pass.
      const impl = report.gateEvaluations.filter((g) => g.gate === "implementation_review");
      expect(impl.length).toBeGreaterThan(0);
      expect(impl.every((g) => g.outcome !== "approved")).toBe(true);

      // …and the reason carries the check's own output, not a shrug.
      expect(report.refusals.some((r) => r.includes("always-fails"))).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 180_000);

  test("A CHECK BOUND TO A GATE THAT RUNS BEFORE ANY CHANGE EXISTS IS REFUSED", async () => {
    // ── WHY THIS CASE IS NOT HYPOTHETICAL ──────────────────────────────────
    // `peer_review` is walked before the work is claimed, so there is no branch and no tree. A
    // check bound there has nothing to run against — and the only two options are to refuse or to
    // pass. Passing would be a gate that reports itself verified by checks that never ran, which is
    // the vacuity class arriving through configuration rather than through code.
    //
    // Running them against the base checkout instead would be worse still: a base that already
    // passes hands every change a green gate that proves nothing about it.
    const repo = realRepo();
    const inbox = realInbox();
    try {
      const report = await runAgainst(repo, inbox, {}, {
        checkBindings: [{ gate: "peer_review", checkIds: ["always-passes"] }],
        checkSpecs: [{ id: "always-passes", title: "clean", command: "true", falsifier: "true" }],
        checkResults: new Map(),
      });

      // Refused by name, and the reason says what is missing rather than blaming the check.
      // The reason names what is actually missing: `peer_review` runs before the work is claimed,
      // so no change has been opened — which is a different problem from a branch that will not
      // resolve, and sends the reader somewhere different.
      expect(report.refusals.some((r) => r.includes("no change has been opened"))).toBe(true);
      expect(report.delivered).toBe(false);
      // NOTHING WAS RECORDED, because nothing ran. A result filed against no tree would be a
      // verdict nobody could attribute to a revision — and would be reused as if they could.
      expect(report.trace.map((e) => e.fact).filter((f) => f?.kind === "check_result")).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 180_000);

  test("A GATE BOUND TO A PASSING, PROVEN CHECK STILL DELIVERS", async () => {
    // The other half: bound checks are STRICTLY ADDITIVE. A clean roster must change nothing, or
    // binding a check would be a decision nobody could make safely.
    const repo = realRepo();
    const inbox = realInbox();
    try {
      const report = await runAgainst(repo, inbox, {}, {
        checkBindings: [{ gate: "implementation_review", checkIds: ["always-passes"] }],
        checkSpecs: [{ id: "always-passes", title: "clean", command: "true", falsifier: "true" }],
        checkResults: new Map(),
      }, mkdtempSync(join(tmpdir(), "wt-")));
      expect(report.delivered).toBe(true);
      expect(report.trace.map((e) => e.fact).filter((f) => f?.kind === "check_result").length).toBeGreaterThan(0);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 180_000);

  test("BOUND CHECKS REFUSE WHEN THE CHANGE HAS NO CHECKOUT OF ITS OWN", async () => {
    // ── THE HOLE THIS CLOSES ───────────────────────────────────────────────
    // `runAgainst` uses `gitChangeControl`, the SHARED-checkout adapter, which leaves
    // `handle.workdir` absent on purpose to mark that this change has no isolation. The first cut
    // of the check wiring fell back to `"."` — the directory `run-org` was LAUNCHED FROM — so the
    // roster would have judged whatever repository the operator happened to be standing in, and
    // filed the verdict against this change's tree hash. A wrong answer attributed to the right
    // content is worse than no answer, and it is the same trap `gitChangeControl` already throws
    // over for its own `cwd`.
    const repo = realRepo();
    const inbox = realInbox();
    try {
      const report = await runAgainst(repo, inbox, {}, {
        checkBindings: [{ gate: "implementation_review", checkIds: ["always-passes"] }],
        checkSpecs: [{ id: "always-passes", title: "clean", command: "true", falsifier: "true" }],
        checkResults: new Map(),
      });

      expect(report.refusals.some((r) => r.includes("no checkout of its own"))).toBe(true);
      expect(report.delivered).toBe(false);
      // NOTHING WAS RECORDED, because nothing legitimate could have run. A result filed here would
      // attribute a judgement about another directory to this change.
      expect(report.trace.map((e) => e.fact).filter((f) => f?.kind === "check_result")).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 180_000);

  test("A CHECK WITH NO FALSIFIER BLOCKS THE GATE — a green nothing can falsify is not evidence", async () => {
    const repo = realRepo();
    const inbox = realInbox();
    try {
      const report = await runAgainst(repo, inbox, {}, {
        checkBindings: [{ gate: "implementation_review", checkIds: ["unproven"] }],
        // Passes, and nothing establishes it could ever fail.
        checkSpecs: [{ id: "unproven", title: "green, unproven", command: "true" }],
        checkResults: new Map(),
      }, mkdtempSync(join(tmpdir(), "wt-")));
      expect(report.delivered).toBe(false);
      expect(report.refusals.some((r) => r.includes("UNPROVEN"))).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 180_000);

  test("A MERGE IS RECORDED WITH ITS COMMIT AND ITS TREE", async () => {
    // What makes the rule above answerable across processes, and what a gate keys its checks on.
    const repo = realRepo();
    const inbox = realInbox();
    try {
      const report = await runAgainst(repo, inbox);
      // READ THROUGH THE FOLD, not by filtering facts by hand here. `foldLandedChanges` is what the
      // runtime and the CLI actually consult, so asserting on it covers the reader as well as the
      // writer — a fact written in a shape the fold does not pick up would pass a hand-rolled
      // filter and still leave the feature dead.
      const merged = [...foldLandedChanges(report.trace).values()];
      expect(merged.length).toBeGreaterThan(0);
      for (const f of merged) {
        // FULL HEX OBJECT NAMES. An abbreviated sha is ambiguous by design and would make a cache
        // key that silently collides as the repository grows.
        expect(f.commit).toMatch(/^[0-9a-f]{40}$/);
        expect(f.tree).toMatch(/^[0-9a-f]{40}$/);
        // ...and they are genuinely different objects, not the same value written twice.
        expect(f.commit).not.toBe(f.tree);
      }
      // The commit named is one git actually has.
      const first = merged[0];
      if (first?.commit !== undefined) {
        expect(
          execFileSync("git", ["cat-file", "-t", first.commit], { cwd: repo, encoding: "utf-8" }).trim(),
        ).toBe("commit");
      }
      if (first?.tree !== undefined) {
        expect(
          execFileSync("git", ["cat-file", "-t", first.tree], { cwd: repo, encoding: "utf-8" }).trim(),
        ).toBe("tree");
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 120_000);

  test("the review lane runs against the real run too — asked, and booked", async () => {
    const repo = realRepo();
    const inbox = realInbox();
    try {
      const report = await runAgainst(repo, inbox);
      const reviews = report.signals.filter((s) => s.tool === "request_review");
      expect(reviews.length).toBeGreaterThan(0);
      const booked = new Set(report.calendar.blocks.filter((b) => b.blockType === "review").map((b) => b.hatId));
      for (const r of reviews) expect(booked.has(r.toHatId)).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 120_000);
});

describe("THE GUARD THAT WOULD HAVE PREVENTED THE INCIDENT", () => {
  test("gitChangeControl REFUSES to be built without a directory", () => {
    // What happened: this file was first written with `repoDir` instead of `cwd`. TypeScript
    // caught it — and `bun test` does not typecheck, so the test ran with `cwd: undefined`,
    // `spawnSync` used the process directory, and the adapter branched, committed and MERGED in
    // the Zeta repository itself, leaving it checked out on a `work/task-013` branch it created.
    //
    // A type that is only checked by a tool nobody ran before the damage is not a guard. This is.
    expect(() => gitChangeControl({ cwd: "", baseBranch: "main" })).toThrow(/explicit `cwd`/);
    expect(() =>
      gitChangeControl({ cwd: undefined as unknown as string, baseBranch: "main" }),
    ).toThrow(/explicit `cwd`/);
  });

  test("...and builds normally when told where to work", () => {
    const repo = realRepo();
    try {
      expect(() => gitChangeControl({ cwd: repo, baseBranch: "main" })).not.toThrow();
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("NO SIMULATED PORT AT ALL", () => {
  test("all six ports real, and the goal delivered into a real repository", async () => {
    // The strongest statement this register can make about itself: a run in which nothing was
    // assumed. Every other suite here holds at least one simulated adapter, and the review port is
    // the one that matters most — `autoApproveReview` approves every gate it is asked about and
    // reads no evidence, so a run carrying it has thirteen judgements nobody made.
    const repo = realRepo();
    const inbox = realInbox();
    let n = 0;
    try {
      const report = await runOrgRuntime({
        chart,
        agents: agentsFromChart(chart),
        observations: [],
        externalEvents: [],
        acceptingHatId: "cto",
        resourceAuthorityHatId: "rmo_office",
        priorityDeciderHatId: "cto",
        createId: (p: string) => `${p}-${String(++n).padStart(3, "0")}`,
        nowMs: 0,
        workBlockMs: 3_600_000,
        leaseMs: 300_000,
        settings: [{ setting: "delivery", value: "merge", why: "this test exercises the organization's own merge" }],
        dataSource: gitDataSource({ repoDir: repo, ref: "main", extensions: [".md"] }),
        providers: {
          intake: directoryIntake(inbox),
          work: commandWorkExecutor({
            command: "git",
            argsFor: (node) => ["commit", "--allow-empty", "-m", node.workId],
            cwd: repo,
          }),
          tests: commandTestRunner({ command: "git", argsFor: () => ["--version"], cwd: repo }),
          // A command that exits 0 is an approval, which is thin as reviews go — but it is a REAL
          // process making the call, not a constant, and the fidelity report stops claiming a
          // simulated judgement.
          review: commandReview({ command: "git", argsFor: () => ["--version"], cwd: repo }),
          change: gitChangeControl({ cwd: repo, baseBranch: "main" }),
        },
        priorityInputsFor: () => ({
          executivePriority: 0.5,
          customerImpact: 1,
          severity: 1,
          releaseRisk: 0.2,
          blockedDownstreamCount: 2,
          dependencyFanOut: 1,
          queueAgeMs: 0,
          hatScarcity: 0,
          budgetBurn: 0,
          estimatedEffort: 0.2,
        }),
      } as unknown as OrgRuntimeDeps);

      // NOT ONE simulated port.
      expect(report.fidelity.ports.filter((p) => p.fidelity === Fidelity.Simulated)).toEqual([]);
      expect(report.fidelity.reached.length).toBe(report.fidelity.ports.length);
      expect(report.delivered).toBe(true);

      // And the repository agrees.
      const merges = execFileSync("git", ["log", "--merges", "--oneline", "main"], {
        cwd: repo,
        encoding: "utf-8",
      })
        .split("\n")
        .filter((l) => l.trim() !== "");
      expect(merges.length).toBe(report.changesLanded.length);
      expect(merges.length).toBeGreaterThan(0);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(inbox, { recursive: true, force: true });
    }
  }, 180_000);
});

describe("A REVIEWER RUNS IN THE WORK'S OWN CHECKOUT", () => {
  // MEASURED on AIAGENT-1662: a QA reviewer ran the change's Playwright spec from the shared base
  // checkout and the screenshot it wrote sat, untracked, at the path the branch commits - a merge
  // into that checkout would have been refused.
  test("a request that names a workdir is run there; one that does not, in the configured directory", async () => {
    const shared = mkdtempSync(join(tmpdir(), "review-shared-"));
    const own = mkdtempSync(join(tmpdir(), "review-own-"));
    const port = commandReview({ command: process.execPath, argsFor: () => ["-e", "console.log(process.cwd())"], cwd: shared });
    const inOwn = await port.review({ gate: "qa_uat" as never, workId: "task-1", evidence: [], workdir: own });
    const inShared = await port.review({ gate: "qa_uat" as never, workId: "task-1", evidence: [] });
    const said = (r: typeof inOwn): string => (r.ok ? r.value.reason.toLowerCase() : "");
    // By the directory's own name: the temp root may print in its 8.3 short form.
    expect(said(inOwn)).toContain(basename(own).toLowerCase());
    expect(said(inOwn)).not.toContain(basename(shared).toLowerCase());
    expect(said(inShared)).toContain(basename(shared).toLowerCase());
    rmSync(shared, { recursive: true, force: true });
    rmSync(own, { recursive: true, force: true });
  });
});

describe("A REAL REPOSITORY IS HANDED TO PEOPLE, NEVER MERGED INTO, UNLESS SOMEONE SAID MERGE", () => {
  // MEASURED on the Agentic Team's first real run: with nothing said about delivery, the runtime
  // merged two defects into its clone's master - the one act the operator would never allow.
  function handoffStub(dir: string): { command: string; args: string[]; seen: string } {
    const seen = join(dir, "handoff-seen.json");
    const stub = join(dir, "handoff.cjs");
    writeFileSync(
      stub,
      `const fs=require("fs");fs.writeFileSync(${JSON.stringify(seen)},JSON.stringify({branch:process.env.ORG_BRANCH,base:process.env.ORG_BASE,title:process.env.ORG_TITLE,description:fs.readFileSync(process.env.ORG_DESCRIPTION_FILE,"utf-8")}));` +
        `console.log("opened");console.log("https://review.example/mr/1");`,
    );
    return { command: process.execPath, args: [stub], seen };
  }
  const merges = (repo: string): string[] =>
    execFileSync("git", ["log", "--merges", "--oneline", "main"], { cwd: repo, encoding: "utf-8" })
      .split("\n")
      .filter((l) => l.trim() !== "");

  test("with no delivery setting the finished change is handed off: main gets no merge, the review is recorded", async () => {
    const repo = realRepo();
    const inbox = realInbox();
    const wt = mkdtempSync(join(tmpdir(), "zeta-handoff-wt-"));
    const scratch = mkdtempSync(join(tmpdir(), "zeta-handoff-"));
    const h = handoffStub(scratch);
    try {
      const events: { kind: string; decision: string; fact?: { kind?: string; url?: string } }[] = [];
      const report = await runAgainst(
        repo,
        inbox,
        { change: gitWorktreeChangeControl({ cwd: repo, baseBranch: "main", worktreeRoot: wt, handoff: { command: h.command, args: h.args } }) },
        { settings: [], onEvent: (e: never) => events.push(e) },
      );
      expect(merges(repo)).toEqual([]);
      expect(report.changesLanded).toEqual([]);
      expect(report.changesHandedOff.length).toBeGreaterThan(0);
      const fact = events.find((e) => e.fact?.kind === "change_handed_off")?.fact;
      expect(fact?.url).toBe("https://review.example/mr/1");
      expect(events.some((e) => e.decision.includes("HANDED OFF for human review"))).toBe(true);
      const seen = JSON.parse(readFileSync(h.seen, "utf-8")) as { base: string; title: string; description: string };
      expect(seen.base).toBe("main");
      expect(seen.title.startsWith("PROJ-9:")).toBe(true);
      expect(seen.description).toContain("Nothing has been merged");
    } finally {
      for (const d of [repo, inbox, wt, scratch]) rmSync(d, { recursive: true, force: true });
    }
  }, 120_000);

  test("an adapter that cannot hand off is REFUSED, never merged instead", async () => {
    const repo = realRepo();
    const inbox = realInbox();
    const wt = mkdtempSync(join(tmpdir(), "zeta-nohandoff-wt-"));
    try {
      const report = await runAgainst(repo, inbox, {}, { settings: [] }, wt);
      expect(merges(repo)).toEqual([]);
      expect(report.delivered).toBe(false);
      expect(report.refusals.some((r) => r.includes("cannot hand") && r.includes("does not merge it instead"))).toBe(true);
    } finally {
      for (const d of [repo, inbox, wt]) rmSync(d, { recursive: true, force: true });
    }
  }, 120_000);

  test("work already in front of a reviewer is neither walked again nor proposed a second time", async () => {
    const repo = realRepo();
    const inbox = realInbox();
    const wt = mkdtempSync(join(tmpdir(), "zeta-resume-wt-"));
    const scratch = mkdtempSync(join(tmpdir(), "zeta-resume-"));
    const h = handoffStub(scratch);
    try {
      const change = () => gitWorktreeChangeControl({ cwd: repo, baseBranch: "main", worktreeRoot: wt, handoff: { command: h.command, args: h.args } });
      const first = await runAgainst(repo, inbox, { change: change() }, { settings: [] });
      const handed = new Set(first.changesHandedOff);
      expect(handed.size).toBeGreaterThan(0);
      const again = await runAgainst(repo, mkdtempSync(join(tmpdir(), "zeta-empty-inbox-")), { change: change() }, {
        settings: [],
        alreadyHandedOff: handed,
        priorCascade: first.cascade,
      });
      expect(again.changesHandedOff).toEqual([]);
      expect(again.gateEvaluations.some((e) => handed.has(e.workId))).toBe(false);
    } finally {
      for (const d of [repo, inbox, wt, scratch]) rmSync(d, { recursive: true, force: true });
    }
  }, 180_000);
});
