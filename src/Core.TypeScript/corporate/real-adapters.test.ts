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
import { foldActionItems, foldAfterOpen, foldAfterUpdate, foldHandedOffChanges, foldLandedChanges } from "./org-fold";
import type { OrgEvent } from "./org-event";
import type { AnswerCheckRequest, AnswerItem, AnswerRequest, FollowUpReviewRequest } from "./change-followup";
import type { DescribeRequest } from "./change-request";
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

describe("A HANDED-OFF CHANGE: WHAT IT MAY CARRY, AND KEEPING IT CURRENT WITHOUT REWRITING IT", () => {
  /** A bare `origin`, a clone the organization works in, and a second clone standing in for other people. */
  function withRemote(): { origin: string; repo: string; others: string; wt: string; git: (at: string, ...a: string[]) => string; cleanup: () => void } {
    const origin = mkdtempSync(join(tmpdir(), "zeta-origin-"));
    const git = (at: string, ...a: string[]) => execFileSync("git", a, { cwd: at, encoding: "utf-8" });
    git(origin, "init", "-q", "--bare", "-b", "main");
    const repo = realRepo();
    git(repo, "remote", "add", "origin", origin);
    git(repo, "push", "-q", "origin", "main");
    const others = mkdtempSync(join(tmpdir(), "zeta-others-"));
    git(others, "clone", "-q", origin, ".");
    git(others, "config", "user.email", "o@example.com");
    git(others, "config", "user.name", "O");
    const wt = mkdtempSync(join(tmpdir(), "zeta-sync-wt-"));
    return { origin, repo, others, wt, git, cleanup: () => { for (const d of [origin, repo, others, wt]) rmSync(d, { recursive: true, force: true }); } };
  }
  const node = { workId: "task-1" } as never;

  test("a change that ADDS a kept-out path is refused before anything is pushed; editing an existing one is not", async () => {
    const r = withRemote();
    const scratch = mkdtempSync(join(tmpdir(), "zeta-keepout-"));
    const seen = join(scratch, "ran");
    const stub = join(scratch, "handoff.cjs");
    writeFileSync(stub, `require("fs").writeFileSync(${JSON.stringify(seen)},"1");console.log("https://review.example/mr/2");`);
    try {
      const port = gitWorktreeChangeControl({ cwd: r.repo, baseBranch: "main", worktreeRoot: r.wt, handoff: { command: process.execPath, args: [stub] } });
      const opened = await port.open(node, { branch: "defect/X-1" });
      if (!opened.ok) throw new Error(opened.reason);
      const at = opened.value.workdir as string;
      mkdirSync(join(at, "shots"), { recursive: true });
      writeFileSync(join(at, "shots", "after.png"), "png");
      writeFileSync(join(at, "fix.ts"), "export const x = 1;\n");
      r.git(at, "add", "-A");
      r.git(at, "commit", "-q", "-m", "X-1: fix");
      const refused = await port.handoff!(opened.value, { title: "X-1", description: "d", keepOut: ["*.png"] });
      expect(refused.ok).toBe(false);
      expect(refused.ok ? "" : refused.reason).toContain("shots/after.png");
      expect(() => readFileSync(seen)).toThrow();
      r.git(at, "rm", "-q", "shots/after.png");
      r.git(at, "commit", "-q", "-m", "X-1: keep evidence out");
      const handed = await port.handoff!(opened.value, { title: "X-1", description: "d", keepOut: ["*.png"] });
      expect(handed.ok).toBe(true);
    } finally {
      r.cleanup();
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 60_000);

  test("behind the target is MEASURED against the remote, and bringing it level MERGES the target in - history is not rewritten", async () => {
    const r = withRemote();
    try {
      const port = gitWorktreeChangeControl({ cwd: r.repo, baseBranch: "main", worktreeRoot: r.wt });
      const opened = await port.open(node, { branch: "defect/X-2" });
      if (!opened.ok) throw new Error(opened.reason);
      const at = opened.value.workdir as string;
      writeFileSync(join(at, "fix.ts"), "export const x = 1;\n");
      r.git(at, "add", "-A");
      r.git(at, "commit", "-q", "-m", "X-2: fix");
      const before = r.git(at, "rev-parse", "HEAD").trim();
      // Somebody else moves main on the review system.
      writeFileSync(join(r.others, "other.md"), "moved\n");
      r.git(r.others, "add", "-A");
      r.git(r.others, "commit", "-q", "-m", "main moves");
      r.git(r.others, "push", "-q", "origin", "main");

      const measured = await port.syncWithTarget!(opened.value, { apply: false });
      expect(measured.ok && measured.value).toMatchObject({ target: "origin/main", behindBy: 1, applied: false });
      const synced = await port.syncWithTarget!(opened.value, { apply: true });
      expect(synced.ok && synced.value.applied).toBe(true);
      // The change's own commit is still an ancestor: merged in, not rebased over.
      expect(() => r.git(at, "merge-base", "--is-ancestor", before, "HEAD")).not.toThrow();
      const after = await port.syncWithTarget!(opened.value, { apply: false });
      expect(after.ok && after.value.behindBy).toBe(0);
    } finally {
      r.cleanup();
    }
  }, 60_000);

  test("a conflicting target is left MID-MERGE with its conflicts named, and abortSync backs it out", async () => {
    const r = withRemote();
    try {
      const port = gitWorktreeChangeControl({ cwd: r.repo, baseBranch: "main", worktreeRoot: r.wt });
      const opened = await port.open(node, { branch: "defect/X-3" });
      if (!opened.ok) throw new Error(opened.reason);
      const at = opened.value.workdir as string;
      writeFileSync(join(at, "README.md"), "# ours\n");
      r.git(at, "commit", "-q", "-am", "X-3: ours");
      writeFileSync(join(r.others, "README.md"), "# theirs\n");
      r.git(r.others, "commit", "-q", "-am", "theirs");
      r.git(r.others, "push", "-q", "origin", "main");

      const synced = await port.syncWithTarget!(opened.value, { apply: true });
      expect(synced.ok && synced.value).toMatchObject({ applied: false, conflicts: ["README.md"] });
      expect(() => r.git(at, "rev-parse", "-q", "--verify", "MERGE_HEAD")).not.toThrow();
      const aborted = await port.abortSync!(opened.value);
      expect(aborted.ok).toBe(true);
      expect(() => r.git(at, "rev-parse", "-q", "--verify", "MERGE_HEAD")).toThrow();
    } finally {
      r.cleanup();
    }
  }, 60_000);
});

describe("AFTER THE HANDOFF: THE REQUEST SAYS WHAT THE ORGANIZATION CONFIGURED, AND FEEDBACK BECOMES ACTION ITEMS IT DECIDES ABOUT", () => {
  const sections = [
    { heading: "Problem statement", states: "what the reporter saw" },
    { heading: "Root cause", states: "why, with file:line" },
  ];
  const changeRequests = {
    sections,
    keepOut: ["*.png"],
    sync: "merge_target" as const,
    replies: "reply_and_resolve" as const,
    afterOpen: [{ kind: "comment" as const, body: "aireview" }],
    afterUpdate: [] as { kind: "comment"; body: string }[],
    why: "reviewers read the problem first",
  };
  const fullDescription = async () => ({ ok: true as const, value: "## Problem statement\nIt broke.\n\n## Root cause\nA race.", evidence: [] });

  function stubCounting(dir: string): { command: string; args: string[]; seen: string; count: () => number } {
    const seen = join(dir, "seen.json");
    const calls = join(dir, "calls.txt");
    const stub = join(dir, "handoff.cjs");
    writeFileSync(
      stub,
      `const fs=require("fs");fs.appendFileSync(${JSON.stringify(calls)},"x");` +
        `fs.writeFileSync(${JSON.stringify(seen)},JSON.stringify({description:fs.readFileSync(process.env.ORG_DESCRIPTION_FILE,"utf-8")}));` +
        `console.log("https://review.example/p/-/merge_requests/7");`,
    );
    const count = (): number => {
      try {
        return readFileSync(calls, "utf-8").length;
      } catch {
        return 0;
      }
    };
    return { command: process.execPath, args: [stub], seen, count };
  }

  test("the description is written in the configured sections, checked, and a description missing one is NOT handed off", async () => {
    const repo = realRepo();
    const inbox = realInbox();
    const wt = mkdtempSync(join(tmpdir(), "zeta-cr-wt-"));
    const scratch = mkdtempSync(join(tmpdir(), "zeta-cr-"));
    const h = stubCounting(scratch);
    try {
      const change = () => gitWorktreeChangeControl({ cwd: repo, baseBranch: "main", worktreeRoot: wt, handoff: { command: h.command, args: h.args } });
      const partial = await runAgainst(repo, inbox, { change: change() }, {
        settings: [],
        changeRequests,
        describeChange: async () => ({ ok: true as const, value: "## Problem statement\nIt broke.", evidence: [] }),
      });
      expect(partial.changesHandedOff).toEqual([]);
      expect(partial.refusals.some((r) => r.includes("does not carry: Root cause"))).toBe(true);
      expect(h.count()).toBe(0);
    } finally {
      for (const d of [repo, inbox, wt, scratch]) rmSync(d, { recursive: true, force: true });
    }
  }, 120_000);

  test("RED CODE IS NOT REVIEWED: the suite runs first, and a failing one costs no reviewer at all", async () => {
    // MEASURED on agentic-tpm !164, 2026-09-12: two reviewers spent 35 minutes approving 8c2767c4,
    // and the verifier then found new failures in workflowStage.test.ts and refused the push. The
    // cheap judge that cannot be talked round goes first.
    const repo = realRepo();
    const git = (at: string, ...a: string[]) => execFileSync("git", a, { cwd: at, encoding: "utf-8" });
    const inbox = realInbox();
    const wt = mkdtempSync(join(tmpdir(), "zeta-red-wt-"));
    const scratch = mkdtempSync(join(tmpdir(), "zeta-red-"));
    const h = stubCounting(scratch);
    const events: OrgEvent[] = [];
    try {
      const change = () => gitWorktreeChangeControl({ cwd: repo, baseBranch: "main", worktreeRoot: wt, handoff: { command: h.command, args: h.args } });
      const noComment = { postComment: async () => ({ ok: true as const, value: {}, evidence: [] }) };
      const base = { settings: [], changeRequests, describeChange: fullDescription, ...noComment, onEvent: (e: OrgEvent) => events.push(e) };
      const first = await runAgainst(repo, inbox, { change: change() }, base);
      const workId = first.changesHandedOff[0] as string;
      const handed = foldHandedOffChanges(events);
      const order: string[] = [];
      const second = await runAgainst(repo, inbox, { change: change() }, {
        ...base,
        priorCascade: first.cascade,
        alreadyHandedOff: new Set(handed.keys()),
        handedOffChanges: handed,
        actionItems: foldActionItems(events),
        afterOpenDone: foldAfterOpen(events),
        feedback: [{ deliveryId: "note-1", source: "gitlab", itemKind: "comment", summary: "please explain the race", author: "reviewer", branch: handed.get(workId)?.branch as string }],
        defaultBase: "main",
        verifyChange: async () => {
          order.push("verify");
          return { ok: false as const, reason: "NEW FAILURE introduced by this change: workflowStage.test.ts :: an unmapped status is REPORTED", evidence: [] };
        },
        reviewFollowUp: async () => {
          order.push("review");
          return { ok: true as const, value: { approved: true, reason: "looks fine to me" }, evidence: [] };
        },
        answer: async (r: AnswerRequest) => ({ ok: true as const, value: r.items.map((i) => ({ actionItemId: i.actionItemId, replyId: "note-9", resolved: true })), evidence: [] }),
        followUp: async (req: { items: readonly { actionItemId: string }[]; workdir?: string }) => {
          writeFileSync(join(req.workdir as string, "note.md"), "explained" + String.fromCharCode(10));
          git(req.workdir as string, "add", "-A");
          git(req.workdir as string, "commit", "-q", "-m", "explain the race");
          return { ok: true as const, value: { decisions: req.items.map((i) => ({ actionItemId: i.actionItemId, outcome: "addressed" as const, how: "explained the race" })), syncWithTarget: false, summary: "s" }, evidence: [] };
        },
      });
      // THE SUITE RAN, AND NO REVIEWER WAS EVER ASKED.
      expect(order).toEqual(["verify"]);
      expect(second.followUps?.[0]?.handedOffAgain).toBe(false);
      expect(h.count()).toBe(1); // not pushed again
      // And the next session is TOLD why, in the failure's own words - not left to rediscover it.
      const item = foldActionItems(events).get(workId)?.find((i) => i.actionItemId === "gitlab:note-1");
      expect(item?.settled).toBeUndefined();
      expect(item?.reopened?.why).toContain("did not pass the repository's own tests");
      expect(item?.reopened?.why).toContain("workflowStage.test.ts");
      expect(second.followUps?.[0]?.refused.some((r) => r.includes("does not pass verification"))).toBe(true);
    } finally {
      for (const d of [repo, inbox, wt, scratch]) rmSync(d, { recursive: true, force: true });
    }
  }, 240_000);

  test("AT maxParallel 2 THE SESSIONS OVERLAP AND THE TEST SUITES STILL DO NOT", async () => {
    // MEASURED on agentic-tpm, 2026-09-12: three requests took 2h04m end to end, one thing at a time.
    // Nothing required that - so the follow-ups ferry. What may NOT overlap is the repository's own
    // suite: two of agentic-tpm's at once fight over the MongoMemoryServer port, which is already the
    // commonest red in its pipeline. No clock in this test: overlap is measured by what is in flight.
    const repo = realRepo();
    const git = (at: string, ...a: string[]) => execFileSync("git", a, { cwd: at, encoding: "utf-8" });
    const inbox = mkdtempSync(join(tmpdir(), "zeta-par-inbox-"));
    for (const [id, title] of [["PROJ-1", "coupon applies twice"], ["PROJ-2", "totals round the wrong way"]]) {
      writeFileSync(join(inbox, id + ".json"), JSON.stringify({ source: "jira", externalId: id, title, body: title, kind: "defect", severity: "high", reproduction: title, evidenceRefs: ["log:" + id] }));
    }
    const wt = mkdtempSync(join(tmpdir(), "zeta-par-wt-"));
    const scratch = mkdtempSync(join(tmpdir(), "zeta-par-"));
    const h = stubCounting(scratch);
    const events: OrgEvent[] = [];
    try {
      const change = () => gitWorktreeChangeControl({ cwd: repo, baseBranch: "main", worktreeRoot: wt, handoff: { command: h.command, args: h.args } });
      const noComment = { postComment: async () => ({ ok: true as const, value: {}, evidence: [] }) };
      const base = { settings: [], changeRequests, describeChange: fullDescription, ...noComment, onEvent: (e: OrgEvent) => events.push(e) };
      const first = await runAgainst(repo, inbox, { change: change() }, base);
      const afterFirst = foldHandedOffChanges(events);
      await runAgainst(repo, inbox, { change: change() }, {
        ...base,
        priorCascade: first.cascade,
        alreadyHandedOff: new Set(afterFirst.keys()),
        handedOffChanges: afterFirst,
        actionItems: foldActionItems(events),
        afterOpenDone: foldAfterOpen(events),
      });
      const handed = foldHandedOffChanges(events);
      expect(handed.size).toBe(2);
      const ids = [...handed.keys()];

      const flight: string[] = [];
      let sessionsInFlight = 0;
      let sessionsAtOnce = 0;
      let suitesInFlight = 0;
      let suitesAtOnce = 0;
      const yieldOnce = () => new Promise<void>((r) => setImmediate(r));
      const third = await runAgainst(repo, inbox, { change: change() }, {
        ...base,
        priorCascade: first.cascade,
        alreadyHandedOff: new Set(handed.keys()),
        handedOffChanges: handed,
        actionItems: foldActionItems(events),
        afterOpenDone: foldAfterOpen(events),
        feedback: ids.map((w, i) => ({ deliveryId: `note-${String(i + 1)}`, source: "gitlab", itemKind: "comment", summary: "please explain the race", author: "reviewer", branch: handed.get(w)?.branch as string })),
        defaultBase: "main",
        maxParallel: 2,
        verifyChange: async () => {
          suitesInFlight++;
          suitesAtOnce = Math.max(suitesAtOnce, suitesInFlight);
          await yieldOnce();
          suitesInFlight--;
          return { ok: true as const, value: "green", evidence: [] };
        },
        answer: async (r: AnswerRequest) => ({ ok: true as const, value: r.items.map((i) => ({ actionItemId: i.actionItemId, replyId: "note-9", resolved: true })), evidence: [] }),
        followUp: async (req: { workId: string; items: readonly { actionItemId: string }[]; workdir?: string }) => {
          sessionsInFlight++;
          sessionsAtOnce = Math.max(sessionsAtOnce, sessionsInFlight);
          flight.push("enter:" + req.workId);
          // A yield, never a sleep: it lets the other ferry run if there IS another ferry.
          await yieldOnce();
          writeFileSync(join(req.workdir as string, "note.md"), "explained\n");
          git(req.workdir as string, "add", "-A");
          git(req.workdir as string, "commit", "-q", "-m", "explain the race");
          flight.push("exit:" + req.workId);
          sessionsInFlight--;
          return {
            ok: true as const,
            value: { decisions: req.items.map((i) => ({ actionItemId: i.actionItemId, outcome: "addressed" as const, how: "explained the race" })), syncWithTarget: false, summary: "s" },
            evidence: [],
          };
        },
      });
      expect(third.followUps?.length).toBe(2);
      // BOTH SESSIONS WERE IN FLIGHT AT ONCE - the second one started before the first came back.
      expect(sessionsAtOnce).toBe(2);
      expect(flight.slice(0, 2)).toEqual(["enter:" + String(ids[0]), "enter:" + String(ids[1])]);
      // AND THE SUITES DID NOT: each change was verified, one at a time.
      expect(suitesAtOnce).toBe(1);
      // Both requests were still followed up and reported, in the order they were queued.
      expect(third.followUps?.map((f) => f.workId)).toEqual(ids);
    } finally {
      for (const d of [repo, inbox, wt, scratch]) rmSync(d, { recursive: true, force: true });
    }
  }, 240_000);

  test("A REVIEWER IS ANSWERED AS SOON AS THEIR REQUEST IS PUSHED - not after every other request's follow-up", async () => {
    // MEASURED on agentic-tpm, 2026-09-12: !163's seven answers were written and its fix pushed at
    // 00:21, and nothing appeared on the merge request, because the answering ran after EVERY
    // follow-up in the run - and the next one took another forty-five minutes. To a reviewer that is
    // indistinguishable from being ignored. Two requests, so the difference is visible: the second
    // request's follow-up must not be able to delay the first request's replies.
    const repo = realRepo();
    const inbox = mkdtempSync(join(tmpdir(), "zeta-two-inbox-"));
    for (const [id, title] of [["PROJ-1", "coupon applies twice"], ["PROJ-2", "totals round the wrong way"]]) {
      writeFileSync(
        join(inbox, id + ".json"),
        JSON.stringify({ source: "jira", externalId: id, title, body: title, kind: "defect", severity: "high", reproduction: title, evidenceRefs: ["log:" + id] }),
      );
    }
    const wt = mkdtempSync(join(tmpdir(), "zeta-two-wt-"));
    const scratch = mkdtempSync(join(tmpdir(), "zeta-two-"));
    const h = stubCounting(scratch);
    const events: OrgEvent[] = [];
    try {
      const change = () => gitWorktreeChangeControl({ cwd: repo, baseBranch: "main", worktreeRoot: wt, handoff: { command: h.command, args: h.args } });
      const noComment = { postComment: async () => ({ ok: true as const, value: {}, evidence: [] }) };
      const first = await runAgainst(repo, inbox, { change: change() }, {
        settings: [],
        changeRequests,
        describeChange: fullDescription,
        ...noComment,
        onEvent: (e: OrgEvent) => events.push(e),
      });
      // One request per cycle is what this organization's supply allows, so the second cycle opens
      // the second request. Both are then open, which is the situation being tested.
      const afterFirst = foldHandedOffChanges(events);
      await runAgainst(repo, inbox, { change: change() }, {
        settings: [],
        changeRequests,
        describeChange: fullDescription,
        ...noComment,
        priorCascade: first.cascade,
        alreadyHandedOff: new Set(afterFirst.keys()),
        handedOffChanges: afterFirst,
        actionItems: foldActionItems(events),
        afterOpenDone: foldAfterOpen(events),
        onEvent: (e: OrgEvent) => events.push(e),
      });
      const handed = foldHandedOffChanges(events);
      expect(handed.size).toBe(2);
      const ids = [...handed.keys()];

      // One comment on each request, and a log of WHEN each session and each answer happened.
      const order: string[] = [];
      const answers: AnswerRequest[] = [];
      const feedback = ids.map((w, i) => ({
        deliveryId: `note-${String(i + 1)}`,
        source: "gitlab",
        itemKind: "comment",
        summary: "please explain the race",
        author: "reviewer",
        branch: handed.get(w)?.branch as string,
      }));
      const byWork = new Map(ids.map((w) => [w, (handed.get(w)?.branch ?? w) as string]));
      const second = await runAgainst(repo, inbox, { change: change() }, {
        settings: [],
        changeRequests,
        describeChange: fullDescription,
        ...noComment,
        priorCascade: first.cascade,
        alreadyHandedOff: new Set(handed.keys()),
        handedOffChanges: handed,
        // An item the LAST round settled and never got to answer - the situation on !163 at 00:51:
        // six replies written, checked, and unposted. It is owed, and its request also has a new
        // comment to work, so it lands in BOTH answering passes.
        actionItems: new Map([
          ...foldActionItems(events),
          [
            ids[0] as string,
            [
              ...(foldActionItems(events).get(ids[0] as string) ?? []),
              { workId: ids[0] as string, actionItemId: "gitlab:note-owed", source: "gitlab", itemKind: "comment", summary: "from the round before", raisedAtMs: 1, settled: { outcome: "addressed" as const, how: "fixed it last round", atMs: 2, respond: true } },
            ],
          ],
        ]),
        afterOpenDone: foldAfterOpen(events),
        feedback,
        defaultBase: "main",
        verifyChange: async () => ({ ok: true as const, value: "green", evidence: [] }),
        followUp: async (req: { workId: string; items: readonly { actionItemId: string }[] }) => {
          order.push("followUp:" + String(byWork.get(req.workId) ?? req.workId));
          return {
            ok: true as const,
            value: { decisions: req.items.map((i) => ({ actionItemId: i.actionItemId, outcome: "addressed" as const, how: "explained the race in the description" })), syncWithTarget: false, summary: "s" },
            evidence: [],
          };
        },
        answer: async (r: AnswerRequest) => {
          order.push("answer:" + String(byWork.get(r.workId) ?? r.workId));
          answers.push(r);
          return { ok: true as const, value: r.items.map((i) => ({ actionItemId: i.actionItemId, replyId: "note-9", resolved: true })), evidence: [] };
        },
        onEvent: (e: OrgEvent) => events.push(e),
      });
      expect(second.followUps?.length).toBe(2);
      // Every item was answered EXACTLY once - answering runs twice over (what was already owed, then
      // each request as its fix lands), and an item in both passes must not reach the reviewer twice.
      const posted = answers.flatMap((a) => a.items.map((i) => i.actionItemId));
      expect(new Set(posted).size).toBe(posted.length);
      // The one owed from before was posted, and posted once.
      expect(posted.filter((p) => p === "gitlab:note-owed")).toEqual(["gitlab:note-owed"]);
      // ...and it went out BEFORE any session ran, not after the last one.
      expect(order[0]).toBe("answer:" + String(byWork.get(ids[0] as string)));
      // THE POINT, in order: what was already owed goes out first, and then each request's answer
      // lands before the NEXT request's session even starts.
      expect(order.length).toBe(5);
      expect(order[1]?.startsWith("followUp:")).toBe(true);
      expect(order[2]).toBe(order[1]?.replace("followUp:", "answer:"));
      expect(order[3]?.startsWith("followUp:")).toBe(true);
      expect(order[4]).toBe(order[3]?.replace("followUp:", "answer:"));
      expect(order[1]).not.toBe(order[3]);
    } finally {
      for (const d of [repo, inbox, wt, scratch]) rmSync(d, { recursive: true, force: true });
    }
  }, 240_000);

  test("a comment and a moved target become action items; the organization decides, brings the change level, re-verifies and updates the request - and only then are the items settled", async () => {
    const repo = realRepo();
    const git = (at: string, ...a: string[]) => execFileSync("git", a, { cwd: at, encoding: "utf-8" });
    const origin = mkdtempSync(join(tmpdir(), "zeta-cr-origin-"));
    git(origin, "init", "-q", "--bare", "-b", "main");
    git(repo, "remote", "add", "origin", origin);
    git(repo, "push", "-q", "origin", "main");
    const others = mkdtempSync(join(tmpdir(), "zeta-cr-others-"));
    git(others, "clone", "-q", origin, ".");
    git(others, "config", "user.email", "o@example.com");
    git(others, "config", "user.name", "O");
    const inbox = realInbox();
    const wt = mkdtempSync(join(tmpdir(), "zeta-cr-wt-"));
    const scratch = mkdtempSync(join(tmpdir(), "zeta-cr-"));
    const h = stubCounting(scratch);
    const events: OrgEvent[] = [];
    try {
      const change = () => gitWorktreeChangeControl({ cwd: repo, baseBranch: "main", worktreeRoot: wt, handoff: { command: h.command, args: h.args } });
      const commented: Record<string, unknown>[] = [];
      const first = await runAgainst(repo, inbox, { change: change() }, {
        settings: [],
        changeRequests,
        describeChange: fullDescription,
        postComment: async (r: Record<string, unknown>) => {
          commented.push(r);
          return { ok: true as const, value: { replyId: "note-900" }, evidence: [] };
        },
        onEvent: (e: OrgEvent) => events.push(e),
      });
      expect(first.changesHandedOff.length).toBe(1);
      // AFTER THE REQUEST OPENED, the organization's configured step ran - once, on that request.
      expect(commented).toEqual([{ workId: first.changesHandedOff[0], changeUrl: "https://review.example/p/-/merge_requests/7", branch: expect.any(String), body: "aireview" }]);
      const workId = first.changesHandedOff[0] as string;
      const seen = JSON.parse(readFileSync(h.seen, "utf-8")) as { description: string };
      expect(seen.description).toContain("## Root cause");
      expect(seen.description).toContain("Nothing has been merged");
      const handed = foldHandedOffChanges(events);
      const branch = handed.get(workId)?.branch as string;

      // People react: a reviewer comments, and main moves on without the change.
      writeFileSync(join(others, "moved.md"), "main moved\n");
      git(others, "add", "-A");
      git(others, "commit", "-q", "-m", "main moves");
      git(others, "push", "-q", "origin", "main");
      const feedback = [
        // The organization's own `aireview` comment, read back from the review system: NOT an action item.
        { deliveryId: "note-900", source: "gitlab", itemKind: "comment", summary: "aireview", author: "operator", changeUrl: "https://review.example/p/-/merge_requests/7#note_900" },
        { deliveryId: "note-1", source: "gitlab", itemKind: "comment", summary: "please add a comment explaining the race", author: "reviewer", changeUrl: "https://review.example/p/-/merge_requests/7#note_1" },
        { deliveryId: "target-main-1", source: "gitlab", itemKind: "target_moved", summary: "main moved", target: "refs/heads/main" },
      ];
      const asked: { mode: string; items: number; canSync: boolean }[] = [];
      // THE ANSWERER records what it was asked and WHEN - how many pushes had happened by then.
      const answered: { pushesSoFar: number; resolve: boolean; items: readonly AnswerItem[] }[] = [];
      let replySeq = 500;
      const answer = (failFor: string) => async (req: AnswerRequest) => {
        answered.push({ pushesSoFar: h.count(), resolve: req.resolve, items: req.items });
        return {
          ok: true as const,
          value: req.items.map((i) =>
            i.actionItemId === failFor ? { actionItemId: i.actionItemId, error: "GitLab said 502" } : { actionItemId: i.actionItemId, replyId: `note-${String(++replySeq)}`, resolved: true },
          ),
          evidence: [],
        };
      };
      const described: DescribeRequest[] = [];
      const reviewed: FollowUpReviewRequest[] = [];
      const firstShown = handed.get(workId)?.commit;
      const second = await runAgainst(repo, realInbox(), { change: change() }, {
        settings: [],
        changeRequests,
        describeChange: async (req: DescribeRequest) => {
          described.push(req);
          return fullDescription();
        },
        priorCascade: first.cascade,
        alreadyHandedOff: new Set(handed.keys()),
        handedOffChanges: handed,
        actionItems: foldActionItems(events),
        afterOpenDone: foldAfterOpen(events),
        // Already done on this request: asking again would post a second `aireview`.
        postComment: async () => {
          throw new Error("the after-open step already ran on this request");
        },
        feedback,
        defaultBase: "main",
        verifyChange: async () => ({ ok: true as const, value: "green", evidence: [] }),
        followUp: async (req: { mode: string; items: readonly { actionItemId: string }[]; canSync: boolean; workdir?: string }) => {
          asked.push({ mode: req.mode, items: req.items.length, canSync: req.canSync });
          writeFileSync(join(req.workdir as string, "WHY.md"), "the race\n");
          git(req.workdir as string, "add", "-A");
          git(req.workdir as string, "commit", "-q", "-m", "explain the race");
          return {
            ok: true as const,
            value: {
              decisions: req.items.map((i) => ({ actionItemId: i.actionItemId, outcome: "addressed" as const, how: "explained the race; merged main in" })),
              syncWithTarget: true,
              summary: "done",
            },
            evidence: [],
          };
        },
        // The moved-target item's answer fails this time; it must be tried again, never lost.
        answer: answer(`gitlab:target-main-1@${workId}`),
        reviewFollowUp: async (r: FollowUpReviewRequest) => {
          reviewed.push(r);
          return { ok: true as const, value: { approved: true, reason: "each claimed fix has a test that fails without it" }, evidence: [] };
        },
        onEvent: (e: OrgEvent) => events.push(e),
      });
      expect(second.actionItemsRaised?.length).toBe(2);
      expect(asked).toEqual([{ mode: "triage", items: 2, canSync: true }]);
      const fu = second.followUps?.[0];
      expect(fu?.refused).toEqual([]);
      expect(fu?.synced?.applied).toBe(true);
      expect(fu?.handedOffAgain).toBe(true);
      // THE FOLLOW-UP WAS REVIEWED LIKE THE ORIGINAL, before the push: the item's own post-work gates,
      // each by someone other than the hat that made it, over everything since what people last saw.
      expect(reviewed.map((r) => r.gate)).toEqual(["implementation_review", "qa_uat"]);
      expect(firstShown).toBeDefined();
      expect(reviewed.every((r) => r.from === firstShown && r.to === git(repo, "rev-parse", branch).trim())).toBe(true);
      expect(new Set(reviewed.map((r) => r.reviewerHatId)).size).toBe(2);
      expect(reviewed[0]?.items.some((i) => i.how === "explained the race; merged main in")).toBe(true);
      expect(h.count()).toBe(2);
      // Merged in, never rebased: main's commit is now an ancestor of the branch.
      expect(() => git(repo, "merge-base", "--is-ancestor", "origin/main", branch)).not.toThrow();
      const items = foldActionItems(events).get(workId) ?? [];
      expect(items.length).toBe(2);
      expect(items.every((i) => i.settled?.outcome === "addressed")).toBe(true);

      // THE REWRITTEN DESCRIPTION IS TOLD WHAT REVIEWERS WERE ANSWERED - MEASURED on MR !162, a reply
      // pointed at a rollout note the re-written description never carried.
      expect(described.at(-1)?.settled).toContainEqual({ summary: "please add a comment explaining the race", outcome: "addressed", how: "explained the race; merged main in" });

      // ANSWERED ONLY AFTER THE PUSH, citing the commit that was pushed, and resolved as configured.
      const branchHead = git(repo, "rev-parse", branch).trim();
      expect(answered).toHaveLength(1);
      expect(answered[0]?.pushesSoFar).toBe(2);
      expect(answered[0]?.resolve).toBe(true);
      const comment = answered[0]?.items.find((i) => i.actionItemId === "gitlab:note-1");
      expect(comment).toMatchObject({ outcome: "addressed", how: "explained the race; merged main in", commit: branchHead, when: "always" });
      // The one whose answer failed is NOT recorded as answered - it is still owed.
      const afterSecond = foldActionItems(events).get(workId) ?? [];
      expect(afterSecond.find((i) => i.actionItemId === "gitlab:note-1")?.answered?.replyId).toBe("note-501");
      expect(afterSecond.find((i) => i.actionItemId.startsWith("gitlab:target-main-1"))?.answered).toBeUndefined();
      expect(second.refusals.some((r) => r.includes("GitLab said 502"))).toBe(true);

      // The same feedback delivered again raises nothing and asks nobody anything - and the
      // organization's OWN reply, read back from the review system, is not raised as feedback.
      const ownReply = { deliveryId: "note-501", source: "gitlab", itemKind: "comment", summary: "Fixed in abc", changeUrl: "https://review.example/p/-/merge_requests/7#note_501" };
      const third = await runAgainst(repo, realInbox(), { change: change() }, {
        settings: [],
        changeRequests,
        describeChange: fullDescription,
        priorCascade: second.cascade,
        alreadyHandedOff: new Set(handed.keys()),
        handedOffChanges: foldHandedOffChanges(events),
        actionItems: foldActionItems(events),
        afterOpenDone: foldAfterOpen(events),
        feedback: [...feedback, ownReply],
        defaultBase: "main",
        followUp: async () => {
          throw new Error("nothing is open - nobody should be asked");
        },
        answer: answer("none"),
        onEvent: (e: OrgEvent) => events.push(e),
      });
      expect(third.actionItemsRaised).toEqual([]);
      expect(third.followUps).toEqual([]);
      // THE FAILED ANSWER IS TRIED AGAIN, and only it: the answered one is not answered twice.
      expect(answered).toHaveLength(2);
      expect(answered[1]?.items.map((i) => i.actionItemId)).toEqual([`gitlab:target-main-1@${workId}`]);
      expect(third.actionItemsAnswered).toEqual([`gitlab:target-main-1@${workId}`]);
    } finally {
      for (const d of [repo, origin, others, inbox, wt, scratch]) rmSync(d, { recursive: true, force: true });
    }
  }, 240_000);
  test("A FOLLOW-UP THE REVIEW TURNS BACK IS NOT PUSHED, its items stay open with the reason - and its unpushed commit is reviewed again next time, never treated as seen", async () => {
    const repo = realRepo();
    const git = (at: string, ...a: string[]) => execFileSync("git", a, { cwd: at, encoding: "utf-8" });
    const inbox = realInbox();
    const wt = mkdtempSync(join(tmpdir(), "zeta-fr-wt-"));
    const scratch = mkdtempSync(join(tmpdir(), "zeta-fr-"));
    const h = stubCounting(scratch);
    const events: OrgEvent[] = [];
    const noComment = { postComment: async () => ({ ok: true as const, value: {}, evidence: [] }) };
    try {
      const change = () => gitWorktreeChangeControl({ cwd: repo, baseBranch: "main", worktreeRoot: wt, handoff: { command: h.command, args: h.args } });
      const first = await runAgainst(repo, inbox, { change: change() }, { settings: [], changeRequests, describeChange: fullDescription, ...noComment, onEvent: (e: OrgEvent) => events.push(e) });
      const workId = first.changesHandedOff[0] as string;
      const handed = foldHandedOffChanges(events);
      const shown = handed.get(workId)?.commit as string;
      const feedback = [{ deliveryId: "note-7", source: "gitlab", itemKind: "diff_comment", summary: "the cap drops rows", author: "reviewer", changeUrl: "https://review.example/p/-/merge_requests/7#note_7" }];
      const later = (over: Record<string, unknown>) =>
        runAgainst(repo, realInbox(), { change: change() }, {
          settings: [],
          changeRequests,
          describeChange: fullDescription,
          ...noComment,
          alreadyHandedOff: new Set(handed.keys()),
          handedOffChanges: foldHandedOffChanges(events),
          actionItems: foldActionItems(events),
          afterOpenDone: foldAfterOpen(events),
          feedback,
          defaultBase: "main",
          verifyChange: async () => ({ ok: true as const, value: "green", evidence: [] }),
          answer: async (r: AnswerRequest) => ({ ok: true as const, value: r.items.map((i) => ({ actionItemId: i.actionItemId, resolved: true })), evidence: [] }),
          onEvent: (e: OrgEvent) => events.push(e),
          ...over,
        });

      // The follow-up commits a fix; the review turns it back.
      const second = await later({
        followUp: async (req: { items: readonly { actionItemId: string }[]; workdir?: string }) => {
          writeFileSync(join(req.workdir as string, "cap.md"), "cap\n");
          git(req.workdir as string, "add", "-A");
          git(req.workdir as string, "commit", "-q", "-m", "cap the limit");
          return { ok: true as const, value: { decisions: req.items.map((i) => ({ actionItemId: i.actionItemId, outcome: "addressed" as const, how: "capped it; test added" })), syncWithTarget: false, summary: "s" }, evidence: [] };
        },
        reviewFollowUp: async () => ({ ok: true as const, value: { approved: false, reason: "the new test passes with the cap removed" }, evidence: [] }),
      });
      expect(second.followUps?.[0]?.handedOffAgain).toBe(false);
      expect(h.count()).toBe(1); // NOT pushed again
      const open = foldActionItems(events).get(workId)?.find((i) => i.actionItemId === "gitlab:note-7");
      expect(open?.settled).toBeUndefined();
      // REOPENED, not deferred: open and due, so the watcher starts the next round at once.
      expect(open?.deferred).toBeUndefined();
      expect(open?.reopened?.why).toContain("the new test passes with the cap removed");

      // Next time the session adds NOTHING - but the unpushed commit is still unreviewed, so it is
      // reviewed from what people last saw, and only then pushed.
      const reviewed: FollowUpReviewRequest[] = [];
      const third = await later({
        followUp: async (req: { items: readonly { actionItemId: string }[] }) => ({
          ok: true as const,
          value: { decisions: req.items.map((i) => ({ actionItemId: i.actionItemId, outcome: "addressed" as const, how: "the test now fails without the cap" })), syncWithTarget: false, summary: "s" },
          evidence: [],
        }),
        reviewFollowUp: async (r: FollowUpReviewRequest) => {
          reviewed.push(r);
          return { ok: true as const, value: { approved: true, reason: "fails without the cap" }, evidence: [] };
        },
      });
      expect(reviewed.length).toBeGreaterThan(0);
      expect(reviewed.every((r) => r.from === shown)).toBe(true);
      expect(third.followUps?.[0]?.handedOffAgain).toBe(true);
      expect(h.count()).toBe(2);
      expect(foldActionItems(events).get(workId)?.find((i) => i.actionItemId === "gitlab:note-7")?.settled?.outcome).toBe("addressed");
    } finally {
      for (const d of [repo, inbox, wt, scratch]) rmSync(d, { recursive: true, force: true });
    }
  }, 240_000);
  test("EVERY ANSWER IS CHECKED BEFORE A REVIEWER READS IT: one that does not hold is not posted and its item reopens; a check that cannot run posts nothing", async () => {
    const repo = realRepo();
    const inbox = realInbox();
    const wt = mkdtempSync(join(tmpdir(), "zeta-ck-wt-"));
    const scratch = mkdtempSync(join(tmpdir(), "zeta-ck-"));
    const h = stubCounting(scratch);
    const events: OrgEvent[] = [];
    const noComment = { postComment: async () => ({ ok: true as const, value: {}, evidence: [] }) };
    try {
      const change = () => gitWorktreeChangeControl({ cwd: repo, baseBranch: "main", worktreeRoot: wt, handoff: { command: h.command, args: h.args } });
      const first = await runAgainst(repo, inbox, { change: change() }, { settings: [], changeRequests, describeChange: fullDescription, ...noComment, onEvent: (e: OrgEvent) => events.push(e) });
      const workId = first.changesHandedOff[0] as string;
      const handed = foldHandedOffChanges(events);
      const feedback = [
        { deliveryId: "note-11", source: "gitlab", itemKind: "comment", summary: "is there a rollout note?", author: "reviewer", changeUrl: "https://review.example/p/-/merge_requests/7#note_11" },
        { deliveryId: "note-12", source: "gitlab", itemKind: "comment", summary: "why no backfill?", author: "reviewer", changeUrl: "https://review.example/p/-/merge_requests/7#note_12" },
      ];
      const posted: string[] = [];
      const later = (over: Record<string, unknown>) =>
        runAgainst(repo, realInbox(), { change: change() }, {
          settings: [],
          changeRequests,
          describeChange: fullDescription,
          ...noComment,
          alreadyHandedOff: new Set(handed.keys()),
          handedOffChanges: foldHandedOffChanges(events),
          actionItems: foldActionItems(events),
          afterOpenDone: foldAfterOpen(events),
          feedback,
          defaultBase: "main",
          verifyChange: async () => ({ ok: true as const, value: "green", evidence: [] }),
          readChange: async () => ({ ok: true as const, value: { description: "## Problem statement\nIt broke." }, evidence: [] }),
          answer: async (r: AnswerRequest) => {
            posted.push(...r.items.map((i) => i.actionItemId));
            return { ok: true as const, value: r.items.map((i) => ({ actionItemId: i.actionItemId, resolved: true })), evidence: [] };
          },
          onEvent: (e: OrgEvent) => events.push(e),
          ...over,
        });
      const decide = {
        followUp: async (req: { items: readonly { actionItemId: string }[] }) => ({
          ok: true as const,
          value: {
            decisions: req.items.map((i) => ({
              actionItemId: i.actionItemId,
              outcome: "declined" as const,
              how: i.actionItemId === "gitlab:note-11" ? "the rollout note is in the description" : "history is append-only by design",
            })),
            syncWithTarget: false,
            summary: "s",
          },
          evidence: [],
        }),
      };

      // A check that cannot run: NOTHING is posted, and nothing is lost - both stay owed.
      await later({ ...decide, checkAnswers: async () => ({ ok: false as const, reason: "the checker could not start" }) });
      expect(posted).toEqual([]);

      // The check finds one claim false: that answer is withheld and its item reopened; the other is posted.
      let seenDescription: string | undefined;
      await later({
        followUp: async () => {
          throw new Error("both items are settled and owed an answer - nothing is open to decide");
        },
        checkAnswers: async (r: AnswerCheckRequest) => {
          seenDescription = r.description;
          return {
            ok: true as const,
            value: r.items.map((i) =>
              i.actionItemId === "gitlab:note-11"
                ? { actionItemId: i.actionItemId, confirmed: false, unconfirmed: ["says the rollout note is in the description; the description has no rollout content"] }
                : { actionItemId: i.actionItemId, confirmed: true, unconfirmed: [] },
            ),
            evidence: [],
          };
        },
      });
      expect(seenDescription).toContain("## Problem statement");
      expect(posted).toEqual(["gitlab:note-12"]);
      const items = foldActionItems(events).get(workId) ?? [];
      const withheld = items.find((i) => i.actionItemId === "gitlab:note-11");
      expect(withheld?.settled).toBeUndefined();
      expect(withheld?.reopened?.why).toContain("the description has no rollout content");
      expect(items.find((i) => i.actionItemId === "gitlab:note-12")?.answered).toBeDefined();
    } finally {
      for (const d of [repo, inbox, wt, scratch]) rmSync(d, { recursive: true, force: true });
    }
  }, 240_000);
  test("MEASURED on dev-portal !1222: a commit SOMEBODY ELSE pushed to the request's branch is merged in before the follow-up works - never rebased - so its push is not refused as behind", async () => {
    const repo = realRepo();
    const git = (at: string, ...a: string[]) => execFileSync("git", a, { cwd: at, encoding: "utf-8" });
    const origin = mkdtempSync(join(tmpdir(), "zeta-ob-origin-"));
    git(origin, "init", "-q", "--bare", "-b", "main");
    git(repo, "remote", "add", "origin", origin);
    git(repo, "push", "-q", "origin", "main");
    const inbox = realInbox();
    const wt = mkdtempSync(join(tmpdir(), "zeta-ob-wt-"));
    const scratch = mkdtempSync(join(tmpdir(), "zeta-ob-"));
    const bot = mkdtempSync(join(tmpdir(), "zeta-ob-bot-"));
    const h = stubCounting(scratch);
    const events: OrgEvent[] = [];
    const noComment = { postComment: async () => ({ ok: true as const, value: {}, evidence: [] }) };
    try {
      const change = () => gitWorktreeChangeControl({ cwd: repo, baseBranch: "main", worktreeRoot: wt, handoff: { command: h.command, args: h.args } });
      const first = await runAgainst(repo, inbox, { change: change() }, { settings: [], changeRequests, describeChange: fullDescription, ...noComment, onEvent: (e: OrgEvent) => events.push(e) });
      const workId = first.changesHandedOff[0] as string;
      const handed = foldHandedOffChanges(events);
      const branch = handed.get(workId)?.branch as string;
      // The request is on the review system; then a bot pushes a commit to it.
      git(repo, "push", "-q", "origin", branch);
      git(bot, "clone", "-q", "--branch", branch, origin, ".");
      git(bot, "config", "user.email", "bot@example.com");
      git(bot, "config", "user.name", "Bot");
      writeFileSync(join(bot, "package-lock.json"), "{\"audit\":\"fixed\"}\n");
      git(bot, "add", "-A");
      git(bot, "commit", "-q", "-m", "chore: automated npm audit fix");
      git(bot, "push", "-q", "origin", branch);
      const botCommit = git(bot, "rev-parse", "HEAD").trim();

      const reviewed: FollowUpReviewRequest[] = [];
      const second = await runAgainst(repo, realInbox(), { change: change() }, {
        settings: [],
        changeRequests,
        describeChange: fullDescription,
        ...noComment,
        alreadyHandedOff: new Set(handed.keys()),
        handedOffChanges: handed,
        actionItems: foldActionItems(events),
        afterOpenDone: foldAfterOpen(events),
        feedback: [{ deliveryId: "note-5", source: "gitlab", itemKind: "diff_comment", summary: "clear the menu id", author: "reviewer", changeUrl: "https://review.example/p/-/merge_requests/7#note_5" }],
        defaultBase: "main",
        verifyChange: async () => ({ ok: true as const, value: "green", evidence: [] }),
        followUp: async (req: { items: readonly { actionItemId: string }[]; workdir?: string }) => {
          // The session works on what people are looking at: the bot's commit is already there.
          expect(git(req.workdir as string, "log", "--format=%H").includes(botCommit)).toBe(true);
          writeFileSync(join(req.workdir as string, "fix.md"), "cleared\n");
          git(req.workdir as string, "add", "-A");
          git(req.workdir as string, "commit", "-q", "-m", "clear the menu id");
          return { ok: true as const, value: { decisions: req.items.map((i) => ({ actionItemId: i.actionItemId, outcome: "addressed" as const, how: "cleared it; test added" })), syncWithTarget: false, summary: "s" }, evidence: [] };
        },
        reviewFollowUp: async (r: FollowUpReviewRequest) => {
          reviewed.push(r);
          return { ok: true as const, value: { approved: true, reason: "ok" }, evidence: [] };
        },
        answer: async (r: AnswerRequest) => ({ ok: true as const, value: r.items.map((i) => ({ actionItemId: i.actionItemId, resolved: true })), evidence: [] }),
        onEvent: (e: OrgEvent) => events.push(e),
      });
      expect(second.followUps?.[0]?.refused).toEqual([]);
      expect(second.followUps?.[0]?.handedOffAgain).toBe(true);
      // Merged in, never rebased: the bot's commit is an ancestor of what is pushed, unchanged.
      expect(() => git(repo, "merge-base", "--is-ancestor", botCommit, branch)).not.toThrow();
      // What people last saw is the bot's commit - the review covers only what came after it.
      expect(reviewed.every((r) => r.from === botCommit)).toBe(true);
      expect(foldActionItems(events).get(workId)?.find((i) => i.actionItemId === "gitlab:note-5")?.settled?.outcome).toBe("addressed");
    } finally {
      for (const d of [repo, origin, inbox, wt, scratch, bot]) rmSync(d, { recursive: true, force: true });
    }
  }, 240_000);
  test("REVIEW GOES BACK AND FORTH UNTIL IT IS CLEAN: after each pushed fix review is asked for again, once per push, until the round limit - then a person decides", async () => {
    const repo = realRepo();
    const git = (at: string, ...a: string[]) => execFileSync("git", a, { cwd: at, encoding: "utf-8" });
    const inbox = realInbox();
    const wt = mkdtempSync(join(tmpdir(), "zeta-rr-wt-"));
    const scratch = mkdtempSync(join(tmpdir(), "zeta-rr-"));
    const h = stubCounting(scratch);
    const events: OrgEvent[] = [];
    const rounds = { ...changeRequests, afterUpdate: [{ kind: "comment" as const, body: "aireview" }], reviewRounds: 1 };
    const posts: { body: string; repeat?: boolean }[] = [];
    let noteSeq = 800;
    const postComment = async (r: { body: string; repeat?: boolean }) => {
      posts.push({ body: r.body, ...(r.repeat === undefined ? {} : { repeat: r.repeat }) });
      return { ok: true as const, value: { replyId: `note-${String(++noteSeq)}` }, evidence: [] };
    };
    try {
      const change = () => gitWorktreeChangeControl({ cwd: repo, baseBranch: "main", worktreeRoot: wt, handoff: { command: h.command, args: h.args } });
      const first = await runAgainst(repo, inbox, { change: change() }, { settings: [], changeRequests: rounds, describeChange: fullDescription, postComment, onEvent: (e: OrgEvent) => events.push(e) });
      const workId = first.changesHandedOff[0] as string;
      // The first handoff gets the after-OPEN comment only - not a re-review.
      expect(posts).toEqual([{ body: "aireview" }]);
      const round = (deliveryId: string) =>
        runAgainst(repo, realInbox(), { change: change() }, {
          settings: [],
          changeRequests: rounds,
          describeChange: fullDescription,
          postComment,
          alreadyHandedOff: new Set(foldHandedOffChanges(events).keys()),
          handedOffChanges: foldHandedOffChanges(events),
          actionItems: foldActionItems(events),
          afterOpenDone: foldAfterOpen(events),
          afterUpdateDone: foldAfterUpdate(events),
          feedback: [{ deliveryId, source: "gitlab", itemKind: "diff_comment", summary: `finding ${deliveryId}`, author: "ai-review", changeUrl: `https://review.example/p/-/merge_requests/7#${deliveryId}` }],
          defaultBase: "main",
          verifyChange: async () => ({ ok: true as const, value: "green", evidence: [] }),
          followUp: async (req: { items: readonly { actionItemId: string }[]; workdir?: string }) => {
            writeFileSync(join(req.workdir as string, `${deliveryId}.md`), "fixed\n");
            git(req.workdir as string, "add", "-A");
            git(req.workdir as string, "commit", "-q", "-m", `fix ${deliveryId}`);
            return { ok: true as const, value: { decisions: req.items.map((i) => ({ actionItemId: i.actionItemId, outcome: "addressed" as const, how: "fixed; test added" })), syncWithTarget: false, summary: "s" }, evidence: [] };
          },
          answer: async (r: AnswerRequest) => ({ ok: true as const, value: r.items.map((i) => ({ actionItemId: i.actionItemId, resolved: true })), evidence: [] }),
          onEvent: (e: OrgEvent) => events.push(e),
        });

      // Round 1: the reviewer's finding is fixed and pushed - so review is asked for AGAIN, same words.
      await round("note-1");
      expect(posts).toEqual([{ body: "aireview" }, { body: "aireview", repeat: true }]);
      expect(foldAfterUpdate(events).get(workId)?.rounds).toBe(1);

      // The re-review finds something else; it is fixed and pushed - but the limit (1) is reached:
      // no third request, and the run says a person decides.
      const second = await round("note-2");
      expect(posts).toHaveLength(2);
      expect(second.refusals.some((r) => r.includes("review rounds have been asked for") && r.includes("a person decides"))).toBe(true);
    } finally {
      for (const d of [repo, inbox, wt, scratch]) rmSync(d, { recursive: true, force: true });
    }
  }, 240_000);
});
