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
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
} from "./adapters";
import { gitDataSource } from "./git-data-source";
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

async function runAgainst(repo: string, inbox: string) {
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
