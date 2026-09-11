/**
 * run-agent.test.ts — the two halves, joined.
 *
 * The claim under test is the one neither half could make alone: an agent picking REAL work off a
 * REAL organization, recorded to disk, resuming from that disk on the next invocation. Each half was
 * already tested; what was never tested is that they meet.
 */

import { uncertaintyOf } from "./agent-loop-bridge";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, mergeQueues, organizationSurface, resumedSurface } from "./run-agent";
import { appendRun, deliveryRate, readRuns } from "./org-store";
import { ShardState } from "./work-market";
import { OrgEventKind } from "./org-event";
import type { QaCycleReport } from "./qa";
import { currentState, readHistory } from "../workflow-engine/agent-loop/state-store";
import { isNonCoercive } from "../workflow-engine/agent-loop/menu-generator";
import { generateMenu } from "../workflow-engine/agent-loop/menu-generator";

const roots: string[] = [];
function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "run-agent-"));
  roots.push(dir);
  return dir;
}
afterEach(() => {
  while (roots.length > 0) {
    const dir = roots.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

const AT = "2026-09-03T10:00:00.000Z";
const AT_MS = Date.parse(AT);

describe("THE SURFACE IS A REAL ORGANIZATION", () => {
  test("a failing run puts real work on the surface", async () => {
    const org = await organizationSurface({ atMs: AT_MS, qaFails: true, incident: false, resume: false });
    expect(org.delivered).toBe(false);
    expect(org.candidates).toBeGreaterThan(0);
    // Not the empty surface: the DORA numbers came from what the organization did.
    expect(org.surface.snapshot.currentDora.deploymentCount).toBeGreaterThan(0);
    expect(org.surface.snapshot.hotTrajectories.length).toBeGreaterThan(0);
    for (const c of org.surface.candidates) {
      expect(c.lane).not.toBe("mixed"); // paths were supplied, so the classifier assigned a lane
      expect(c.uncertainty).toBeGreaterThan(0); // the run's own trouble
    }
  });

  test("a DELIVERED run leaves nothing to pick — and that is not an empty surface", async () => {
    const org = await organizationSurface({ atMs: AT_MS, qaFails: false, incident: false, resume: false });
    expect(org.delivered).toBe(true);
    expect(org.candidates).toBe(0);
    // The distinction that matters: no candidates, but the surface still carries what happened.
    expect(org.surface.snapshot.currentDora.deploymentCount).toBeGreaterThan(0);
    expect(org.surface.snapshot.coolingTrajectories.length).toBeGreaterThan(0);
  });

  test("the two runs give DIFFERENT surfaces — it reads the run, not a constant", async () => {
    const ok = await organizationSurface({ atMs: AT_MS, qaFails: false, incident: false, resume: false });
    const bad = await organizationSurface({ atMs: AT_MS, qaFails: true, incident: false, resume: false });
    expect(ok.candidates).not.toBe(bad.candidates);
    expect(ok.surface.snapshot.hotTrajectories.length).not.toBe(bad.surface.snapshot.hotTrajectories.length);
  });

  test("THE SUPPLIED INSTANT IS THE ONE USED — the organization reads no clock", async () => {
    const org = await organizationSurface({ atMs: AT_MS, qaFails: true, incident: false, resume: false });
    // The snapshot's own time...
    expect(org.surface.snapshot.snapshotIso).toBe(AT);
    // ...and the events the organization emitted. A `Date.now()` anywhere in the run would put
    // these hours away from the instant that was asked for, and the whole store would be addressed
    // at times that never happened.
    expect(org.trace.length).toBeGreaterThan(0);
    for (const e of org.trace) expect(e.atMs).toBeGreaterThanOrEqual(AT_MS);
    expect(Math.min(...org.trace.map((e) => e.atMs))).toBe(AT_MS);
  });

  test("AN INCIDENT MAKES MTTR MEASURABLE — which is what the trace is for", async () => {
    // A defect carries no restoration time, so the trace changes nothing and passing it through
    // would be a pass-through that looks load-bearing and is not. An incident is the case where it
    // is: the run's own events supply detection and restoration.
    const defect = await organizationSurface({ atMs: AT_MS, qaFails: false, incident: false, resume: false });
    expect(defect.unmeasured).toContain("mttrMedianSeconds");

    const incident = await organizationSurface({ atMs: AT_MS, qaFails: false, incident: true, resume: false });
    expect(incident.unmeasured).not.toContain("mttrMedianSeconds");
    // And with lanes supplied too, nothing is left unmeasured at all.
    expect(incident.unmeasured).toEqual([]);
    expect(incident.surface.snapshot.currentDora.mttrMedianSeconds).toBeGreaterThan(0);
  });

  test("the same instant rebuilds the SAME organization — recomputation, not a second one", async () => {
    // This is what makes re-running it per invocation honest rather than a different org each time.
    const a = await organizationSurface({ atMs: AT_MS, qaFails: true, incident: false, resume: false });
    const b = await organizationSurface({ atMs: AT_MS, qaFails: true, incident: false, resume: false });
    expect(b.surface.candidates.map((c) => c.id)).toEqual(a.surface.candidates.map((c) => c.id));
    expect(b.surface.snapshot).toEqual(a.surface.snapshot);
  });

  test("the organization's own history is written only when asked", async () => {
    const store = tempRoot();
    await organizationSurface({ atMs: AT_MS, qaFails: true, incident: false, resume: false });
    expect(readRuns(store)).toEqual([]); // no --store: no side effect
    await organizationSurface({ atMs: AT_MS, qaFails: true, incident: false, resume: false, store });
    expect(readRuns(store)).toHaveLength(1);
    expect(deliveryRate(store)).toEqual({
      runs: 1, delivered: 0,
      deliveredForReal: 0, deliveredSimulated: 0, deliveredUnknownFidelity: 0,
    });
  });
});

describe("THE MENU CARRIES THAT WORK", () => {
  test("the loop is offered the organization's candidates, and still leaves a way out", async () => {
    const org = await organizationSurface({ atMs: AT_MS, qaFails: true, incident: false, resume: false });
    const menu = generateMenu({
      state: { tag: "Idle", context: { agent: "alexa", cycle: 1, sessionStartIso: AT } },
      snapshot: org.surface.snapshot,
      candidates: org.surface.candidates,
      namedDeps: [],
      heartbeatLane: "operational",
    });
    const picks = menu.filter((o) => o.tag === "PickWork");
    expect(picks).toHaveLength(org.candidates);
    // Real work on the menu does not cost the agent its exits.
    expect(isNonCoercive(menu)).toBe(true);
  });
});

describe("END TO END — pick real work, record it, resume", () => {
  const argv = (root: string, at: string, ...rest: string[]) => [
    "--agent", "alexa", "--root", root, "--at", at, "--qa-fails", ...rest,
  ];

  test("a cycle picks REAL work and records it", async () => {
    const root = tempRoot();
    expect(await main(argv(root, AT, "--choose", "PickWork"))).toBe(0);
    const history = readHistory(root, "alexa");
    expect(history).toHaveLength(1);
    expect(history[0]?.chosen?.tag).toBe("PickWork");
    // The item picked is one the ORGANIZATION produced, not a fixture.
    const org = await organizationSurface({ atMs: AT_MS, qaFails: true, incident: false, resume: false });
    const chosen = history[0]?.chosen;
    if (chosen?.tag === "PickWork") {
      expect(org.surface.candidates.map((c) => c.id)).toContain(chosen.work.id);
    }
    expect(history[0]?.state.tag).toBe("ExecutingWork");
  });

  test("A SECOND INVOCATION RESUMES from disk, mid-work", async () => {
    const root = tempRoot();
    await main(argv(root, AT, "--choose", "PickWork"));
    expect(currentState(root, "alexa")?.tag).toBe("ExecutingWork");

    await main(argv(root, "2026-09-03T10:05:00.000Z", "--choose", "EmitHeartbeat"));
    const history = readHistory(root, "alexa");
    expect(history.map((r) => r.cycle)).toEqual([1, 2]);
    // The second cycle STARTED from the state the first left, which is the whole claim.
    expect(history[1]?.chosen?.tag).toBe("EmitHeartbeat");
  });

  test("SWITCHING AWAY FROM LIVE WORK IS RECORDED, across invocations", async () => {
    // The churn is only visible over cycles: one switch is a change of mind, the same two items
    // traded back and forth is an agent finishing nothing while every cycle looks productive.
    const root = tempRoot();
    await main(argv(root, AT, "--choose", "PickWork"));
    await main(argv(root, "2026-09-03T10:05:00.000Z", "--choose", "PickWork"));
    const history = readHistory(root, "alexa");
    expect(history[0]?.abandonedWorkId).toBeUndefined(); // nothing was in flight yet
    expect(history[1]?.abandonedWorkId).toBeDefined();
    // And it names the item the FIRST cycle took.
    const first = history[0]?.chosen;
    if (first?.tag === "PickWork") expect(history[1]?.abandonedWorkId).toBe(first.work.id);
  });

  test("the in-flight item is not offered again, so the two cycles pick DIFFERENT work", async () => {
    const root = tempRoot();
    await main(argv(root, AT, "--choose", "PickWork"));
    await main(argv(root, "2026-09-03T10:05:00.000Z", "--choose", "PickWork"));
    const history = readHistory(root, "alexa");
    const a = history[0]?.chosen;
    const b = history[1]?.chosen;
    if (a?.tag === "PickWork" && b?.tag === "PickWork") expect(b.work.id).not.toBe(a.work.id);
  });

  test("a DELIVERED organization offers no work — and the menu is still not a cage", async () => {
    const root = tempRoot();
    // No `--qa-fails`: everything shipped, so there is nothing to pick up.
    expect(await main(["--agent", "alexa", "--root", root, "--at", AT, "--choose", "EnterFreeTime"])).toBe(0);
    const history = readHistory(root, "alexa");
    expect(history[0]?.nonCoercive).toBe(true);
    expect(history[0]?.chosen?.tag).toBe("EnterFreeTime");
  });

  test("--history reads the past WITHOUT running an organization", async () => {
    const root = tempRoot();
    const store = tempRoot();
    await main([...argv(root, AT, "--choose", "PickWork"), "--store", store]);
    expect(readRuns(store)).toHaveLength(1);
    expect(await main(["--agent", "alexa", "--root", root, "--at", AT, "--history", "--store", store])).toBe(0);
    // Reading the past must not have a side effect: still one run, not two.
    expect(readRuns(store)).toHaveLength(1);
  });

  test("THE ORGANIZATION RESUMES — rebuilt from the store, not re-run", async () => {
    const store = tempRoot();
    const first = tempRoot();
    await main([...argv(first, AT, "--choose", "PickWork"), "--store", store]);

    // A different agent root: nothing about the loop's own history carries over, so anything the
    // second process knows about the organization came from the STORE.
    const second = tempRoot();
    const { surface, folded } = resumedSurface(store, Date.parse("2026-09-03T10:05:00.000Z"));
    expect(folded.factCount).toBeGreaterThan(0);
    expect(folded.refusals).toEqual([]);

    // The rebuilt organization matches the one that ran.
    const org = await organizationSurface({ atMs: AT_MS, qaFails: true, incident: false, resume: false });
    expect(folded.cascade.nodes.length).toBe(5);
    expect(surface.candidates.map((c) => c.id).sort()).toEqual(org.surface.candidates.map((c) => c.id).sort());

    // And an agent can work it.
    expect(
      await main(["--agent", "alexa", "--root", second, "--at", "2026-09-03T10:05:00.000Z", "--store", store, "--resume", "--choose", "PickWork"]),
    ).toBe(0);
    const history = readHistory(second, "alexa");
    expect(history[0]?.state.tag).toBe("ExecutingWork");
  });

  test("THE RESUMED QUEUE AND QA HISTORY ARE NOT EMPTY — the interruption is what carries over", async () => {
    // The boundary this closes. Before the market and the QA history were folded, a resumed
    // organization inherited an empty queue and no test runs, so it read as an organization that
    // had never worked rather than one that had been interrupted — and it reported zero deployments
    // no matter how much had actually shipped.
    const store = tempRoot();
    await main([...argv(tempRoot(), AT, "--choose", "PickWork"), "--store", store]);
    const { folded } = resumedSurface(store, AT_MS);
    const market = mergeQueues(folded.queues);

    expect(folded.queues.length).toBeGreaterThan(0);
    expect(market.shards.length).toBeGreaterThan(0);
    expect(market.claims.length).toBeGreaterThan(0);
    // Real shards, pointing at work the same log created — not a market floating free of it.
    for (const shard of market.shards) {
      expect(folded.cascade.nodes.some((n) => n.workId === shard.workId)).toBe(true);
    }
    // The QA history is what makes a regression distinguishable from a feature that never worked,
    // so it has to arrive with its RUNS, not merely as a count.
    expect(folded.qa.length).toBeGreaterThan(0);
    expect(folded.qa.flatMap((c) => c.runs).length).toBeGreaterThan(0);
  });

  test("A SECOND RUN INTO THE SAME STORE ADDS to the market rather than replacing it", async () => {
    // Two interruptions are two histories. If the later snapshot replaced the earlier organization
    // wholesale, resuming would silently discard everything the first run shipped.
    const store = tempRoot();
    await main([...argv(tempRoot(), AT, "--choose", "PickWork"), "--store", store]);
    const one = resumedSurface(store, AT_MS);
    await main([...argv(tempRoot(), "2026-09-03T11:00:00.000Z", "--choose", "PickWork"), "--store", store]);
    const two = resumedSurface(store, AT_MS);

    expect(two.folded.queues.length).toBeGreaterThan(one.folded.queues.length);
    expect(mergeQueues(two.folded.queues).shards.length).toBeGreaterThan(mergeQueues(one.folded.queues).shards.length);
    expect(two.folded.qa.length).toBeGreaterThan(one.folded.qa.length);
    // Still one coherent organization: nothing went unaccounted for by growing.
    expect(two.folded.refusals).toEqual([]);
  });

  test("A RESUMED RUN REPORTS ITS DEPLOYMENTS — the folded market is what DORA counts", async () => {
    // The most legible symptom of the empty queue: `deploymentCount` is merged shards, so a resumed
    // organization that inherited an empty market reported ZERO deployments however much it had
    // shipped, and its lead time was unmeasurable.
    const store = tempRoot();
    await main([...argv(tempRoot(), AT, "--choose", "PickWork"), "--store", store]);
    const { surface, folded } = resumedSurface(store, AT_MS);

    const merged = mergeQueues(folded.queues).shards.filter((s) => s.state === ShardState.Merged);
    expect(merged.length).toBeGreaterThan(0);
    expect(surface.snapshot.currentDora.deploymentCount).toBe(merged.length);
    // ...and lead time is a measurement rather than a gap, which it cannot be with no shards.
    expect(surface.snapshot.currentDora.leadTimeMedianSeconds).not.toBeUndefined();
  });

  test("THE QA HISTORY IS WHAT KNOWS about a failure no gate recorded", async () => {
    // Why the QA history has to survive on its own: gate verdicts and QA cycles usually name the
    // same troubled items, so folding one covers for losing the other — until a case fails that no
    // gate rejected, and then only the QA history has it. That is the run this checks.
    const store = tempRoot();
    await main([...argv(tempRoot(), AT, "--choose", "PickWork"), "--store", store]);
    const before = resumedSurface(store, AT_MS);
    const leaf = before.folded.cascade.nodes.find((n) => n.assigneeHatId !== undefined);
    expect(leaf).toBeDefined();
    if (leaf === undefined) return;

    // A later QA cycle in which that item's feature failed. No gate verdict accompanies it.
    const cycle: QaCycleReport = {
      runs: [], regressions: [], failedFeatureIds: [leaf.workId], untestedIds: [], defects: [], passed: 0, failed: 1,
    };
    appendRun(
      {
        atMs: AT_MS + 60_000, delivered: false, levelsEngaged: [], refusals: [],
        trace: [{
          id: "qa-late", kind: OrgEventKind.TestRunRecorded, atMs: AT_MS + 60_000, subjectId: leaf.workId,
          decision: "0/1 passed", supervisorChain: [], evidenceRefs: [],
          fact: { kind: "qa_cycle", report: cycle },
        }],
      },
      store,
    );

    const after = resumedSurface(store, AT_MS);
    expect(after.folded.qa.length).toBe(before.folded.qa.length + 1);
    // The surface CARRIES it: the item's uncertainty accounts for a QA failure that no gate ever
    // recorded, which is what raises it as somewhere a look pays.
    //
    // Asserted as "counts it and is at maximum" rather than "went up". `uncertaintyOf` is
    // `min(1, signals/3)`, and a leaf whose gate was retried to exhaustion already carries three
    // signals — so once retries stopped collapsing into one log entry, the before-state was
    // already saturated and a strictly-greater comparison could never hold. The property under
    // test is that the QA history contributes at all, and that is shown directly.
    const uncertaintyIn = (r: typeof after) =>
      r.surface.candidates.find((c) => c.id === leaf.workId)?.uncertainty ?? 0;
    expect(uncertaintyIn(after)).toBeGreaterThanOrEqual(uncertaintyIn(before));
    expect(uncertaintyIn(after)).toBe(1);
    // And the QA half is load-bearing: drop the gate verdicts and the QA history alone still
    // raises it off zero.
    expect(uncertaintyOf(leaf.workId, [], after.folded.qa)).toBeGreaterThan(0);
  });

  test("the resumed priorities and gate verdicts come back too", async () => {
    const store = tempRoot();
    await main([...argv(tempRoot(), AT, "--choose", "PickWork"), "--store", store]);
    const { folded } = resumedSurface(store, AT_MS);
    // Both are state the surface reads: without them the candidates carry no contribution and no
    // uncertainty, and the menu would order real work by nothing.
    expect(folded.priorities.length).toBeGreaterThan(0);
    expect(folded.gateEvaluations.length).toBeGreaterThan(0);
  });

  test("A FAILED RESUME REFUSES rather than quietly running fresh", async () => {
    // Falling back would make a resume that did not work indistinguishable from one that did.
    const emptyStore = tempRoot();
    expect(
      await main(["--agent", "alexa", "--root", tempRoot(), "--at", AT, "--store", emptyStore, "--resume", "--choose", "EnterFreeTime"]),
    ).toBe(1);
    // ...and without a store at all.
    expect(await main(["--agent", "alexa", "--root", tempRoot(), "--at", AT, "--resume"])).toBe(1);
  });

  test("--at is required — neither the organization nor the loop reads a clock", async () => {
    expect(await main(["--agent", "alexa", "--root", tempRoot()])).toBe(1);
    expect(await main(["--agent", "alexa", "--root", tempRoot(), "--at", "yesterday"])).toBe(1);
  });
});
