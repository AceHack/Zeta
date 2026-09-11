/**
 * org-store.test.ts — the organization's history, durable across process lifetimes.
 *
 * The point of storing the trace is that `org-event.ts`'s questions — what happened to this work,
 * what did this line of authority decide — become answerable over MORE THAN ONE RUN. So the tests
 * that matter run the real runtime twice and ask across both.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  appendEvent,
  appendRun,
  compareMintedIds,
  decidedUnder,
  deliveryRate,
  eventsFor,
  logHighWater,
  mintRunId,
  readEvents,
  readRuns,
} from "./org-store";
import { agentsFromChart, runOrgRuntime, type OrgRuntimeDeps } from "./org-runtime";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { IntakeKind, Severity, type ExternalEvent } from "./intake";
import { RunOutcome } from "./qa";
import { emit, OrgEventKind, type OrgEvent } from "./org-event";

const roots: string[] = [];
function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "org-store-"));
  roots.push(dir);
  return dir;
}
afterEach(() => {
  while (roots.length > 0) {
    const dir = roots.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

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

const ev = (over: Partial<OrgEvent> = {}): OrgEvent => ({
  id: "e1",
  kind: OrgEventKind.Refusal,
  atMs: 1_000,
  subjectId: "w1",
  decision: "d",
  supervisorChain: [],
  evidenceRefs: [],
  ...over,
});

const runInput = (over: Partial<Parameters<typeof appendRun>[0]> = {}) => ({
  atMs: 0,
  delivered: true,
  levelsEngaged: ["c_suite"],
  refusals: [],
  trace: [ev()],
  ...over,
});

describe("THE RUN ID IS MINTED FROM CONTENT, never supplied", () => {
  test("two runs that DID DIFFERENT THINGS get different ids", () => {
    // The first cut let the caller pass `run-${nowMs}`, which is not unique when the clock is
    // fixed — as it is in every deterministic run. Two different runs then shared an identity and
    // the second silently vanished: the store reported 0/1 delivered after two runs.
    const a = mintRunId({ atMs: 0, delivered: true, eventCount: 3, levelsEngaged: [], refusals: [] });
    const b = mintRunId({ atMs: 0, delivered: false, eventCount: 3, levelsEngaged: [], refusals: [] });
    expect(a).not.toBe(b);
  });

  test("the SAME run gets the same id — a replay is an upsert", () => {
    const summary = { atMs: 0, delivered: true, eventCount: 3, levelsEngaged: ["cto"], refusals: [] };
    expect(mintRunId(summary)).toBe(mintRunId(summary));
  });

  test("two genuinely different runs are BOTH kept in the history", () => {
    const root = tempRoot();
    appendRun(runInput({ delivered: true }), root);
    appendRun(runInput({ delivered: false, trace: [ev({ id: "e2", atMs: 2_000 })] }), root);
    expect(readRuns(root)).toHaveLength(2);
    expect(deliveryRate(root)).toEqual({
      runs: 2, delivered: 1,
      // This fixture records no fidelity, so the delivered run is UNKNOWN — not simulated.
      deliveredForReal: 0, deliveredSimulated: 0, deliveredUnknownFidelity: 1,
    });
  });

  test("re-appending an identical run does NOT duplicate it", () => {
    const root = tempRoot();
    appendRun(runInput(), root);
    appendRun(runInput(), root);
    expect(readRuns(root)).toHaveLength(1);
    expect(deliveryRate(root)).toEqual({
      runs: 1, delivered: 1,
      deliveredForReal: 0, deliveredSimulated: 0, deliveredUnknownFidelity: 1,
    });
  });
});

describe("events", () => {
  test("a missing store reads empty rather than throwing", () => {
    const root = join(tempRoot(), "never-written");
    expect(readEvents(root)).toEqual([]);
    expect(readRuns(root)).toEqual([]);
    expect(deliveryRate(root)).toEqual({
      runs: 0, delivered: 0,
      deliveredForReal: 0, deliveredSimulated: 0, deliveredUnknownFidelity: 0,
    });
  });

  test("ordering is by TIME even when the ids disagree with it", () => {
    // Ids chosen to sort OPPOSITE to their times. With ids matching time order, sorting by id and
    // sorting by time give the same answer and the test cannot tell them apart.
    const root = tempRoot();
    appendRun(
      runInput({
        trace: [ev({ id: "a", atMs: 3_000 }), ev({ id: "c", atMs: 1_000 }), ev({ id: "b", atMs: 2_000 })],
      }),
      root,
    );
    expect(readEvents(root).map((e) => e.id)).toEqual(["c", "b", "a"]);
  });

  test("the run summary counts the events it stored", () => {
    const root = tempRoot();
    appendRun(runInput({ trace: [ev({ id: "a" }), ev({ id: "b", atMs: 2_000 })] }), root);
    expect(readRuns(root)[0]?.eventCount).toBe(2);
  });

  test("an event is stored under ITS OWN day, not the run's", () => {
    // A run at midnight that emits an event after it must not file that event in yesterday.
    const root = tempRoot();
    const nextDay = Date.parse("2026-09-04T01:00:00.000Z");
    const { eventPaths } = appendRun(
      runInput({ atMs: Date.parse("2026-09-03T23:00:00.000Z"), trace: [ev({ atMs: nextDay })] }),
      root,
    );
    expect(eventPaths[0]).toContain(join("2026", "09", "04"));
  });

  test("THE SAME EVENT AT TWO PATHS COUNTS ONCE — identity is the event's own id", () => {
    // Writing it twice through `appendRun` lands it at the SAME content-derived path, so the file
    // is simply overwritten and de-duplication is never exercised. A merged branch is the real
    // case: the same event arriving at a second path.
    const root = tempRoot();
    const { eventPaths } = appendRun(runInput({ trace: [ev()] }), root);
    const stray = join(root, "events", "2026", "09", "04");
    mkdirSync(stray, { recursive: true });
    writeFileSync(join(stray, basename(eventPaths[0]!)), readFileSync(eventPaths[0]!, "utf-8"));
    expect(readEvents(root)).toHaveLength(1);
  });

  test("the same RUN at two paths counts once", () => {
    const root = tempRoot();
    const { runPath } = appendRun(runInput(), root);
    const stray = join(root, "runs", "2026", "09", "04");
    mkdirSync(stray, { recursive: true });
    writeFileSync(join(stray, basename(runPath)), readFileSync(runPath, "utf-8"));
    expect(readRuns(root)).toHaveLength(1);
  });

});

describe("ACROSS RUNS — the questions the trace exists to answer", () => {
  test("a real run's history survives the process that produced it", async () => {
    const root = tempRoot();
    const report = await runOrgRuntime(deps());
    appendRun(
      {
        atMs: 0,
        delivered: report.delivered,
        levelsEngaged: report.levelsEngaged,
        refusals: report.refusals,
        trace: report.trace,
      },
      root,
    );

    // Read back with nothing but the root — no report object in hand.
    const stored = readEvents(root);
    expect(stored.length).toBe(report.trace.length);
    expect(stored.length).toBeGreaterThan(20);

    // "What happened to this work" and "what did this line decide", answered from disk.
    const taskId = report.cascade.nodes.find((n) => n.assigneeHatId !== undefined)!.workId;
    expect(eventsFor(root, taskId).length).toBeGreaterThan(3);
    for (const e of eventsFor(root, taskId)) expect(e.subjectId).toBe(taskId);
    expect(decidedUnder(root, "cto").length).toBeGreaterThan(0);
    // The COO's line decided less than the CTO's — so this is a real query, not everything.
    expect(decidedUnder(root, "coo").length).toBeLessThan(decidedUnder(root, "cto").length);
  });

  test("TWO runs accumulate into ONE history", async () => {
    const root = tempRoot();
    const ok = await runOrgRuntime(deps());
    const bad = await runOrgRuntime(deps({ qaFallback: RunOutcome.Failed }));
    appendRun({ atMs: 0, delivered: ok.delivered, levelsEngaged: ok.levelsEngaged, refusals: ok.refusals, trace: ok.trace }, root);
    appendRun({ atMs: 1, delivered: bad.delivered, levelsEngaged: bad.levelsEngaged, refusals: bad.refusals, trace: bad.trace }, root);

    expect(readRuns(root)).toHaveLength(2);
    // One delivered, one did not — the simplest thing a history is for, and it was WRONG before
    // the run id was content-derived.
    expect(deliveryRate(root)).toEqual({
      runs: 2, delivered: 1,
      // This fixture records no fidelity, so the delivered run is UNKNOWN — not simulated.
      deliveredForReal: 0, deliveredSimulated: 0, deliveredUnknownFidelity: 1,
    });
    // The runs are ordered oldest first.
    expect(readRuns(root).map((r) => r.delivered)).toEqual([true, false]);
    // And the combined event log holds more than either run alone.
    expect(readEvents(root).length).toBeGreaterThan(Math.max(ok.trace.length, bad.trace.length));
  });
});

describe("EVENT IDENTITY IS THE CONTENT ADDRESS, not the writer's id", () => {
  test("TWO DIFFERENT EVENTS SHARING AN ID BOTH SURVIVE — the store must not delete history", () => {
    // This used to lose one. `identifyEvent` returned `event.id`, so two genuinely different events
    // that happened to share an id landed at different paths, were BOTH written, and then one was
    // dropped on read. Measured on `run-org.ts --store S` run twice with different flags — which
    // mints the same ids every invocation: 78 event files on disk, 58 returned.
    const root = tempRoot();
    const shared = "evt-062";
    appendRun({ atMs: 0, delivered: true, levelsEngaged: [], refusals: [],
      trace: [ev({ id: shared, decision: "the first thing that happened" })] }, root);
    appendRun({ atMs: 0, delivered: true, levelsEngaged: [], refusals: [],
      trace: [ev({ id: shared, decision: "a DIFFERENT thing that also happened" })] }, root);

    const read = readEvents(root);
    expect(read).toHaveLength(2);
    expect(read.map((e) => e.decision).sort()).toEqual([
      "a DIFFERENT thing that also happened",
      "the first thing that happened",
    ]);
  });

  test("...and two BYTE-IDENTICAL copies still collapse, which was the original intent", () => {
    // The reason the id-based identity existed: a re-run or a merged branch must not duplicate
    // history. Content identity keeps that and loses nothing.
    const root = tempRoot();
    const once = ev({ id: "evt-1", decision: "exactly the same event" });
    appendRun({ atMs: 0, delivered: true, levelsEngaged: [], refusals: [], trace: [once] }, root);
    appendRun({ atMs: 0, delivered: true, levelsEngaged: [], refusals: [], trace: [once] }, root);
    expect(readEvents(root)).toHaveLength(1);
  });

  test("what the reader returns matches what is ON DISK — the two cannot disagree", () => {
    // The defect was precisely a disagreement between the file count and the read count, and
    // nothing anywhere said so. Identity is now the filename, so "two files" and "two events" are
    // one statement.
    const root = tempRoot();
    for (const decision of ["a", "b", "c"]) {
      appendRun({ atMs: 0, delivered: true, levelsEngaged: [], refusals: [],
        trace: [ev({ id: "same-id-every-time", decision })] }, root);
    }
    const onDisk: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".json")) onDisk.push(full);
      }
    };
    walk(join(root, "events"));
    expect(readEvents(root)).toHaveLength(onDisk.length);
    expect(onDisk).toHaveLength(3);
  });
});

describe("A RUN CAN BE WATCHED WHILE IT IS STILL RUNNING", () => {
  test("events appended one at a time read back in order, before any run summary exists", () => {
    // The live view is a FOLD OVER THE LOG, not a second copy of the state. That only works if a
    // partial log reads correctly — `appendRun` has not been called and there is no RunRecord yet.
    const root = mkdtempSync(join(tmpdir(), "livestore-"));
    const made = [3, 1, 2].map((n) =>
      appendEvent(
        emit(chart, `evt-${String(n)}`, {
          kind: OrgEventKind.WorkItemTransition,
          atMs: n * 1000,
          actorHatId: "tech_lead",
          subjectId: `task-${String(n)}`,
          decision: `moved ${String(n)}`,
        }),
        root,
      ),
    );
    expect(made).toHaveLength(3);
    expect(readRuns(root)).toEqual([]);

    // ORDERED BY THE EVENT'S OWN CLOCK, not by write order or filename — so a watcher folding a
    // half-written log sees the organization's sequence, not the filesystem's.
    const back = readEvents(root);
    expect(back.map((e) => e.subjectId)).toEqual(["task-1", "task-2", "task-3"]);
  });

  test("an observer that THROWS does not stop the organization", async () => {
    // A dashboard is a reader. A reader that can halt the thing it reads is not observability.
    const report = await runOrgRuntime(
      deps({
        onEvent: () => {
          throw new Error("the dashboard fell over");
        },
      }),
    );
    expect(report.delivered).toBe(true);
    expect(report.trace.length).toBeGreaterThan(0);
  });

  test("every event the run records reaches the observer — no second path", async () => {
    const seen: string[] = [];
    const report = await runOrgRuntime(deps({ onEvent: (e) => void seen.push(e.id) }));
    expect(seen).toEqual(report.trace.map((e) => e.id));
  });
});

describe("THE LOG IS READ IN THE ORDER IT WAS MINTED", () => {
  test("a counter past 999 still sorts after 999 — digit runs compare as numbers", () => {
    // `createId` pads to three digits. As strings `evt-1000` < `evt-999`, so every instant with a
    // thousand ids behind it folded a transition before the item it moves.
    expect(compareMintedIds("evt-999", "evt-1000")).toBeLessThan(0);
    expect(compareMintedIds("evt-1000", "evt-999")).toBeGreaterThan(0);
    expect(compareMintedIds("evt-021", "evt-033")).toBeLessThan(0);
    expect(compareMintedIds("evt-033", "evt-033")).toBe(0);
    // Total even where the numbers agree and the padding does not.
    expect(compareMintedIds("evt-7", "evt-007")).not.toBe(0);
    expect(Math.sign(compareMintedIds("evt-7", "evt-007"))).toBe(-Math.sign(compareMintedIds("evt-007", "evt-7")));
  });

  test("readEvents orders one instant by minting order, not by string", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-org-order-"));
    try {
      const at = (id: string): OrgEvent => ({
        id, kind: OrgEventKind.DecisionRecorded, subjectId: "x", actorHatId: "cto",
        supervisorChain: [], decision: id, atMs: 5, evidenceRefs: [],
      }) as unknown as OrgEvent;
      for (const id of ["evt-1000", "evt-999", "evt-1001", "evt-998"]) appendEvent(at(id), root);
      expect(readEvents(root).map((e) => e.id)).toEqual(["evt-998", "evt-999", "evt-1000", "evt-1001"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("logHighWater names the last instant and the highest minted counter, from any field", () => {
    const e = (id: string, atMs: number, fact?: unknown): OrgEvent =>
      ({ id, atMs, kind: OrgEventKind.DecisionRecorded, subjectId: "task-024", decision: "", evidenceRefs: [], ...(fact === undefined ? {} : { fact }) }) as unknown as OrgEvent;
    const hw = logHighWater([
      e("evt-021", 0),
      e("evt-436", 60001, { kind: "binding", bindingId: "bind-512", ticket: "AIAGENT-1660" }),
      e("evt-tick-0-1", 3),
    ]);
    expect(hw.atMs).toBe(60001);
    // `bind-512` is buried in a fact and still counts; the ticket key is not a minted id.
    expect(hw.counter).toBe(512);
    expect(logHighWater([])).toEqual({ atMs: undefined, counter: 0 });
  });
});
