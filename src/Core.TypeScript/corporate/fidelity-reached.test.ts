/**
 * fidelity-reached.test.ts — what a run COULD do, and what it DID, kept apart.
 *
 * Two defects, and the first hid the second.
 *
 * A. THE FACT WAS MISSING ON EVERY EARLY RETURN. `runOrgRuntime` has three `return empty()` paths,
 *    all of them before the emission. `empty()` carried `fidelity` in the RETURNED report, so a
 *    live caller was fine and the store was not. Measured on a run with no workable goal,
 *    persisted exactly as both CLIs persist it:
 *
 *        the RUN RECORD says : {"replayable":true,"realPorts":[]}
 *        the EVENT LOG says  : []
 *        they disagree       : true
 *
 *    Two records of one fact in one store. `everyRunWasSimulated` and `--resume` read the LOG, so
 *    a resumed organization printed "no run recorded its fidelity — UNKNOWN, not simulated" about
 *    a run whose fidelity was sitting in the same store. Same shape as the `identifyEvent` loss:
 *    two views, one silently short. And the same early-return hole `runOrgCycle` had closed one
 *    pass earlier, in that pass's own words — its sibling was never checked.
 *
 * B. "TOUCHED SOMETHING" IS NOT WHAT `realPorts` MEASURES. It is derived from the ProviderSet's
 *    LABELS. Measured: a run with a real review port and no workable goal reported
 *    `realPorts: ["review"]` with ZERO gate evaluations — the reviewer was configured, not called.
 *
 *    `replayable` stays configuration-derived and conservative, deliberately: a set holding a real
 *    adapter cannot be promised to replay whether or not THIS run reached it. Only the sentence
 *    overreached, so only the sentence changed.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { agentsFromChart, runOrgRuntime, type OrgRuntimeDeps } from "./org-runtime";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { appendRun, readEvents, readRuns } from "./org-store";
import { foldRunFidelity } from "./org-fold";
import { fidelityLine, fidelityOf, Port, recordingProviders, runFidelityOf, type ProviderSet } from "./providers";
import { IntakeKind, Severity, type ExternalEvent } from "./intake";
import { RunOutcome } from "./qa";
import { OrgEventKind } from "./org-event";
import {
  autoApproveReview,
  directoryReview,
  simulatedChangeControl,
  simulatedIntake,
  simulatedTestRunner,
  simulatedWorkExecutor,
} from "./adapters";

const tempRoot = () => mkdtempSync(join(tmpdir(), "reached-"));

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const GOOD: ExternalEvent = {
  source: "portal",
  externalId: "T-1",
  kind: IntakeKind.Defect,
  severity: Severity.High,
  title: "checkout double-charges",
  reproduction: "twice",
  evidenceRefs: ["log/1"],
};

const simulatedSet = (over: Partial<ProviderSet> = {}): ProviderSet => ({
  intake: simulatedIntake([GOOD]),
  work: simulatedWorkExecutor(true),
  tests: simulatedTestRunner(new Map(), RunOutcome.Passed),
  review: autoApproveReview(),
  change: simulatedChangeControl(),
  ...over,
});

function deps(over: Partial<OrgRuntimeDeps> = {}): OrgRuntimeDeps {
  let n = 0;
  return {
    chart,
    externalEvents: [GOOD],
    agents: agentsFromChart(chart),
    observations: [],
    acceptingHatId: "cto",
    resourceAuthorityHatId: "rmo_office",
    priorityDeciderHatId: "cto",
    createId: (p) => `${p}-${String(++n).padStart(3, "0")}`,
    nowMs: 0,
    workBlockMs: 3_600_000,
    leaseMs: 300_000,
    priorityInputsFor: () => ({
      executivePriority: 0.5, customerImpact: 1, severity: 1, releaseRisk: 0.2,
      blockedDownstreamCount: 2, dependencyFanOut: 1, queueAgeMs: 0, hatScarcity: 0,
      budgetBurn: 0, estimatedEffort: 0.2,
    }),
    ...over,
  };
}

/** No inbound events at all: nothing is workable, so the run leaves by an early return. */
const earlyReturn = (over: Partial<ProviderSet> = {}) =>
  deps({ externalEvents: [], providers: simulatedSet({ intake: simulatedIntake([]), ...over }) });

const factIn = (trace: readonly { readonly kind: string; readonly decision: string }[]) =>
  trace.find((e) => e.kind === OrgEventKind.RunFidelity);

describe("A. EVERY PATH OUT OF THE RUNTIME WRITES THE FACT", () => {
  test("a run that never reaches a goal still records its fidelity", async () => {
    const report = await runOrgRuntime(earlyReturn());
    expect(report.cascade.nodes).toHaveLength(0);
    expect(factIn(report.trace)).toBeDefined();
  });

  test("THE TWO RECORDS IN THE STORE AGREE — this is the defect, stated as an invariant", async () => {
    // The run record and the event log are two views of one fact. Before this they could differ,
    // and nothing anywhere said so.
    const store = tempRoot();
    const report = await runOrgRuntime(earlyReturn());
    appendRun(
      {
        atMs: 0,
        delivered: report.delivered,
        levelsEngaged: report.levelsEngaged,
        refusals: report.refusals,
        trace: report.trace,
        replayable: report.fidelity.replayable,
        realPorts: report.fidelity.realPorts,
      },
      store,
    );
    const record = readRuns(store)[0];
    const folded = foldRunFidelity(readEvents(store));
    expect(folded).toHaveLength(1);
    expect(folded[0]?.replayable).toBe(record?.replayable);
    // Compared as strings on both sides: `RunRecord.realPorts` is deliberately `string[]`, because
    // a record read back from disk was written by some earlier version and must not be typed to
    // whatever this build's enum happens to contain.
    expect([...(folded[0]?.realPorts ?? [])].map(String)).toEqual([...(record?.realPorts ?? [])].map(String));
  });

  test("and the run that DOES reach a goal writes exactly one — not two", async () => {
    // The happy path emits at the end; `empty()` emits on the way out. If both ever ran, a single
    // run would fold as two, and every count over a history would be wrong.
    const report = await runOrgRuntime(deps({ providers: simulatedSet() }));
    expect(report.trace.filter((e) => e.kind === OrgEventKind.RunFidelity)).toHaveLength(1);
  });

  test("a refused GOAL is an early return too, and it records as well", async () => {
    // The third `return empty()`: the goal is not accepted because the hat cannot accept one.
    const report = await runOrgRuntime(deps({ acceptingHatId: "backend_implementer" }));
    expect(report.delivered).toBe(false);
    expect(report.refusals.length).toBeGreaterThan(0);
    expect(factIn(report.trace)).toBeDefined();
  });
});

describe("B. REACHED is measured; CONFIGURED is declared; they are different claims", () => {
  test("a real port that was never called is NOT reported as having reached anything", async () => {
    // Measured before the fix: `realPorts: ["review"]` and ZERO gate evaluations, under a sentence
    // reading "these port(s) touched something real: review".
    const report = await runOrgRuntime(earlyReturn({ review: directoryReview(tempRoot()) }));
    expect(report.gateEvaluations).toHaveLength(0);
    expect(report.fidelity.realPorts).toEqual([Port.Review]);
    expect(report.fidelity.reached).toEqual([]);
    expect(report.fidelity.configuredNotCalled).toEqual([Port.Review]);
  });

  test("...and REPLAYABLE stays false, because the next run with that set would reach", async () => {
    // The conservative direction, kept on purpose. Deriving `replayable` from invocation would make
    // it a property of what happened rather than of the set — and a caller asking "can I replay
    // this configuration?" would get yes from a run that merely never got that far.
    const report = await runOrgRuntime(earlyReturn({ review: directoryReview(tempRoot()) }));
    expect(report.fidelity.replayable).toBe(false);
  });

  test("THE SENTENCE SAYS SO — the log stops claiming a reach it cannot support", async () => {
    const report = await runOrgRuntime(earlyReturn({ review: directoryReview(tempRoot()) }));
    const said = factIn(report.trace)?.decision ?? "";
    expect(said).toContain("no real port was called");
    expect(said).toContain("never reached: review");
    expect(said).not.toContain("touched something");
    // ...and not the all-simulated sentence either, which would be the opposite overstatement.
    expect(said).not.toContain("performed nothing");
  });

  test("a run that DID reach says reached, and the two sentences are different", async () => {
    // Both directions, or the assertion above is satisfied by a sentence that never says "reached".
    const realWork: ProviderSet["work"] = {
      meta: { port: Port.WorkExecution, name: "realish", fidelity: "real", describes: "claims to reach" },
      execute: async (node) => ({
        ok: true,
        value: { workId: node.workId, succeeded: true, artifacts: [], summary: "s" },
        evidence: [],
      }),
    };
    const report = await runOrgRuntime(deps({ providers: simulatedSet({ work: realWork }) }));
    const said = factIn(report.trace)?.decision ?? "";
    expect(said).toContain("reached something real");
    expect(said).toContain("work_execution");
    expect(report.fidelity.reached).toEqual([Port.WorkExecution]);
    expect(report.fidelity.configuredNotCalled).toEqual([]);
  });

  test("all-simulated still says PERFORMED NOTHING, which is a third distinct answer", async () => {
    const report = await runOrgRuntime(deps({ providers: simulatedSet() }));
    expect(factIn(report.trace)?.decision).toContain("performed nothing");
    expect(report.fidelity.reached).toEqual([]);
    expect(report.fidelity.configuredNotCalled).toEqual([]);
  });
});

describe("runFidelityOf derives, and cannot be told", () => {
  test("reached and configuredNotCalled PARTITION the real ports", () => {
    const set = simulatedSet({ review: directoryReview("/nowhere") });
    const f = runFidelityOf(set, [Port.Intake]);
    expect([...f.reached, ...f.configuredNotCalled].sort()).toEqual([...f.realPorts].sort());
    // Intake was invoked but is SIMULATED, so it is in neither half — invocation alone is not reach.
    expect(f.invoked).toContain(Port.Intake);
    expect(f.reached).not.toContain(Port.Intake);
  });

  test("the order is ORDINAL, not call order — this value is content-addressed", () => {
    // Two runs that did the same thing must produce identical bytes. Call order is an accident of
    // the pipeline's shape; a report keyed on it would address differently for the same run.
    const set = simulatedSet();
    const a = runFidelityOf(set, [Port.Review, Port.Intake, Port.ChangeControl]);
    const b = runFidelityOf(set, [Port.ChangeControl, Port.Intake, Port.Review]);
    expect(a.invoked).toEqual(b.invoked);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("an empty invocation set makes every real port 'configured, not called'", () => {
    const f = runFidelityOf(simulatedSet({ review: directoryReview("/nowhere") }), []);
    expect(f.reached).toEqual([]);
    expect(f.configuredNotCalled).toEqual([Port.Review]);
  });
});

describe("WRAPPING A PORT MUST NOT AMPUTATE ITS OPTIONAL METHODS", () => {
  // ── THE DEFECT THIS PINS, MEASURED 2026-09-10 ────────────────────────────
  // `recordingProviders` rebuilds the change port field by field, so an optional method the wrapped
  // adapter implements ceased to exist once wrapped. Every caller guards with
  // `port.changed !== undefined`, so nothing errored — the feature simply never ran. `change_files`
  // had never been emitted by any run through `runOrgRuntime`, despite a call site that explains at
  // length why the measurement matters more than an agent's account of what it changed.
  //
  // Found by wiring a SECOND optional method and watching it arrive undefined. The first one had
  // been silently gone the whole time, which is exactly how this class of defect behaves.
  const withOptionals = (): ProviderSet => {
    const base = simulatedSet();
    return {
      ...base,
      change: {
        ...base.change,
        changed: async () => ({ ok: true as const, value: [{ path: "a.ts", added: 1, removed: 0 }], evidence: [] }),
        revision: async () => ({ ok: true as const, value: { commit: "c".repeat(40), tree: "t".repeat(40) }, evidence: [] }),
      },
    };
  };

  test("an optional method that exists before wrapping still exists after", () => {
    const wrapped = recordingProviders(withOptionals());
    expect(wrapped.providers.change.changed).toBeDefined();
    expect(wrapped.providers.change.revision).toBeDefined();
  });

  test("...and it still answers", async () => {
    const wrapped = recordingProviders(withOptionals());
    const rev = await wrapped.providers.change.revision?.({ changeId: "c", branch: "b" });
    expect(rev?.ok).toBe(true);
    const diff = await wrapped.providers.change.changed?.({ changeId: "c", branch: "b" });
    expect(diff?.ok).toBe(true);
  });

  test("an adapter that does NOT implement them is not given empty ones", () => {
    // The other direction matters just as much: `undefined` is how an adapter says "I cannot tell
    // you", and manufacturing a method that returns nothing would turn that into "nothing changed".
    const wrapped = recordingProviders(simulatedSet());
    expect(wrapped.providers.change.changed).toBeUndefined();
    expect(wrapped.providers.change.revision).toBeUndefined();
  });

  test("calling an optional method marks the port as reached", () => {
    // It is the recording wrapper: a method it forwards without marking would under-report what the
    // run touched, which is the fidelity report lying in the safe direction and still lying.
    const wrapped = recordingProviders(withOptionals());
    return wrapped.providers.change.revision?.({ changeId: "c", branch: "b" }).then(() => {
      expect(wrapped.invoked()).toContain(Port.ChangeControl);
    });
  });
});

describe("recordingProviders records what actually ran", () => {
  test("a port nobody calls is not in the invoked set", async () => {
    const rec = recordingProviders(simulatedSet());
    expect(rec.invoked()).toEqual([]);
    await rec.providers.intake.poll();
    expect(rec.invoked()).toEqual([Port.Intake]);
  });

  test("BOTH HALVES of change control mark it — opening is reaching", async () => {
    // A change opened and never merged still touched the repository. Counting only merges would
    // report that run as untouched, which is the same overstatement in the other direction.
    const opened = recordingProviders(simulatedSet());
    await opened.providers.change.open(
      { workId: "w", workType: "task", title: "t", state: "open", ownerHatId: "tech_lead", assigneeHatId: "backend_implementer" } as never,
      { branch: "b" },
    );
    expect(opened.invoked()).toEqual([Port.ChangeControl]);

    const merged = recordingProviders(simulatedSet());
    await merged.providers.change.merge({ changeId: "c", branch: "b" });
    expect(merged.invoked()).toEqual([Port.ChangeControl]);
  });

  test("ALL FIVE PORTS ARE RECORDED — a port the wrapper forgets is a port that never reached", async () => {
    // The matrix found this: a mutant that stopped marking the review port survived, because the
    // recorder's own tests covered intake and change control and the runtime tests never asserted
    // what `invoked` contained. Five wrappers is five chances to miss one, so all five are named.
    const rec = recordingProviders(simulatedSet());
    await rec.providers.intake.poll();
    await rec.providers.work.execute({ workId: "w" } as never, { branch: "b" });
    await rec.providers.tests.run({ testCaseId: "t" } as never, { branch: "b" });
    await rec.providers.review.review({ workId: "w", gate: "code_review", evidence: [] } as never);
    await rec.providers.change.open({ workId: "w" } as never, { branch: "b" });
    expect(rec.invoked()).toEqual([
      Port.ChangeControl,
      Port.Intake,
      Port.Review,
      Port.TestExecution,
      Port.WorkExecution,
    ]);
  });

  test("and a FULL RUN invokes all five, so the recording is load-bearing end to end", async () => {
    // The unit test above proves the wrapper marks. This proves the runtime actually goes through
    // the wrapper for every port — the two together are what make `reached` mean anything.
    const report = await runOrgRuntime(deps({ providers: simulatedSet() }));
    expect(report.fidelity.invoked).toEqual([
      Port.ChangeControl,
      Port.Intake,
      Port.Review,
      Port.TestExecution,
      Port.WorkExecution,
    ]);
  });

  test("the wrapper passes the real answer through — it records, it does not decide", async () => {
    const underlying = simulatedSet();
    const rec = recordingProviders(underlying);
    const polled = await rec.providers.intake.poll();
    expect(polled.ok).toBe(true);
    if (!polled.ok) return;
    expect(polled.value).toEqual([GOOD]);
  });

  test("the wrapped set carries the SAME meta objects, so fidelityOf over it is unchanged", () => {
    // If wrapping altered the metadata, `replayable` would be computed from the wrapper rather
    // than from the adapters, and every label in this system would be one indirection from true.
    const underlying = simulatedSet({ review: directoryReview("/x") });
    const rec = recordingProviders(underlying);
    expect(rec.providers.intake.meta).toBe(underlying.intake.meta);
    expect(rec.providers.work.meta).toBe(underlying.work.meta);
    expect(rec.providers.tests.meta).toBe(underlying.tests.meta);
    expect(rec.providers.review.meta).toBe(underlying.review.meta);
    expect(rec.providers.change.meta).toBe(underlying.change.meta);
    expect(fidelityOf(rec.providers)).toEqual(fidelityOf(underlying));
  });
});

describe("fidelityLine is the ONE wording", () => {
  test("all three answers are distinguishable from each other", () => {
    const set = simulatedSet();
    const nothing = fidelityLine(runFidelityOf(set, [Port.Intake]));
    const notCalled = fidelityLine(runFidelityOf(simulatedSet({ review: directoryReview("/x") }), []));
    const reached = fidelityLine(runFidelityOf(simulatedSet({ review: directoryReview("/x") }), [Port.Review]));
    expect(new Set([nothing, notCalled, reached]).size).toBe(3);
    expect(nothing).toContain("performed nothing");
    expect(notCalled).toContain("never reached");
    expect(reached).toContain("reached something real");
  });

  test("a run that reached one real port and skipped another says BOTH", () => {
    // The mixed case is the one a single sentence is most likely to lose.
    const set = simulatedSet({
      review: directoryReview("/x"),
      work: {
        meta: { port: Port.WorkExecution, name: "r", fidelity: "real", describes: "d" },
        execute: async () => ({ ok: false, reason: "no" }),
      },
    });
    const said = fidelityLine(runFidelityOf(set, [Port.WorkExecution]));
    expect(said).toContain("reached something real: work_execution");
    expect(said).toContain("configured real but never called: review");
  });
});
