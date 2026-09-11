/**
 * memory-loop.test.ts — the circuit, not the diary.
 *
 * Every signal that decides whether a memory survives is produced by USING it. So the property
 * under test is that using it actually moves those counters, and that an agent cannot move them by
 * claiming to have used something it was never shown.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { MemoryPhase, MemoryTier, utilityRatioOf, weightOf, write, WorkOutcomeSignal } from "./memory";
import { directoryMemoryStore, type MemoryStore } from "./memory-store";
import {
  citedIdsIn,
  correlateOutcome,
  EMPTY_LEDGER,
  inject,
  noteInjectionFor,
  recordCitations,
  renderForPrompt,
  signalFor,
} from "./memory-loop";

const T0 = 1_700_000_000_000;
const roots: string[] = [];

function tempStore(): MemoryStore {
  const dir = mkdtempSync(join(tmpdir(), "zeta-loop-"));
  roots.push(dir);
  return directoryMemoryStore(dir);
}
afterEach(() => {
  while (roots.length > 0) {
    const d = roots.pop();
    if (d !== undefined) rmSync(d, { recursive: true, force: true });
  }
});

function seed(store: MemoryStore, key: string, value: string, confidence = 0.8): string {
  const made = write(undefined, {
    tier: MemoryTier.Hat, scope: "code_reviewer", key, value,
    writtenBy: "code_reviewer", atMs: T0, confidence,
  });
  if (!made.ok) throw new Error(made.reason);
  store.save({ content: made.memory.content, state: { ...made.memory.state, phase: MemoryPhase.Active } });
  return made.memory.content.memoryId;
}

const binding = { hatId: "code_reviewer", workId: "task-1" };

describe("INJECTION IS RECORDED — an unread memory cannot be judged useless", () => {
  test("what is in scope comes back, and the counter moves", () => {
    const store = tempStore();
    const id = seed(store, "rollback", "Require a rollback plan.");
    const injection = inject(store, binding, T0);
    expect(injection.injectedIds).toEqual([id]);
    expect(store.load()[0]?.state.utility.injectedCount).toBe(1);
  });

  test("injecting twice counts twice — that is what makes never-cited meaningful", () => {
    const store = tempStore();
    seed(store, "k", "v");
    inject(store, binding, T0);
    inject(store, binding, T0 + 1);
    expect(store.load()[0]?.state.utility.injectedCount).toBe(2);
  });

  test("another hat's memory is not injected", () => {
    const store = tempStore();
    seed(store, "k", "v");
    expect(inject(store, { hatId: "architect" }, T0).injectedIds).toEqual([]);
  });

  test("the budget caps what an agent is shown", () => {
    const store = tempStore();
    for (let i = 0; i < 12; i++) seed(store, `k${String(i)}`, `value ${String(i)}`);
    expect(inject(store, binding, T0, 5).injectedIds.length).toBe(5);
  });

  test("the rendered block carries the id and the weight, so a citation can be checked", () => {
    const store = tempStore();
    const id = seed(store, "rollback", "Require a rollback plan.");
    const text = inject(store, binding, T0).text;
    expect(text).toContain(id);
    expect(text).toContain("Require a rollback plan.");
    expect(text).toContain("already knows");
  });

  test("nothing known renders nothing rather than an empty heading", () => {
    expect(renderForPrompt([])).toBe("");
  });
});

describe("A CITATION CANNOT BE FABRICATED", () => {
  test("citing what was injected moves the cited counter", () => {
    const store = tempStore();
    const id = seed(store, "k", "v");
    const injection = inject(store, binding, T0);
    const result = recordCitations(store, injection.injectedIds, [id], T0 + 1);
    expect(result.ok).toBe(true);
    expect(store.load()[0]?.state.utility.citedCount).toBe(1);
  });

  test("citing something NEVER INJECTED refuses the WHOLE batch", () => {
    // Recording the valid subset would let a fabricated citation pass silently while its
    // neighbours counted — and the point of the clamp is that fabricating one is found out.
    const store = tempStore();
    const real = seed(store, "k", "v");
    const injection = inject(store, binding, T0);
    const result = recordCitations(store, injection.injectedIds, [real, "3:hat|1:x|1:y"], T0 + 1);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("never injected");
    // And the honest one was NOT credited either.
    expect(store.load()[0]?.state.utility.citedCount).toBe(0);
  });

  test("naming the same memory twice in one answer credits it once", () => {
    const store = tempStore();
    const id = seed(store, "k", "v");
    const injection = inject(store, binding, T0);
    const result = recordCitations(store, injection.injectedIds, [id, id], T0 + 1);
    expect(result.ok && result.recorded.length).toBe(1);
    expect(store.load()[0]?.state.utility.citedCount).toBe(1);
  });

  test("ids are read out of ordinary prose", () => {
    const ids = citedIdsIn("I relied on [3:hat|13:code_reviewer|1:k] and also on [3:org|3:org|2:xy].");
    expect(ids.length).toBe(2);
    expect(ids[0]).toContain("code_reviewer");
  });

  test("prose with no ids cites nothing", () => {
    expect(citedIdsIn("I thought about it and decided on my own.")).toEqual([]);
  });
});

describe("UTILITY ACTUALLY BITES — the loop, end to end", () => {
  test("injected many times and never cited sinks the weight", () => {
    // The whole reason the read path exists. Without it this memory's utility ratio would sit at
    // its neutral 0.5 forever and it would decay only on a timer.
    const store = tempStore();
    seed(store, "ignored", "Something nobody ever relies on.");
    for (let i = 0; i < 10; i++) inject(store, binding, T0 + i);
    const after = store.load()[0];
    if (after === undefined) throw new Error("no memory");
    expect(after.state.utility.injectedCount).toBe(10);
    expect(utilityRatioOf(after.state)).toBe(0);
  });

  test("injected and cited every time keeps it at the top", () => {
    const store = tempStore();
    const id = seed(store, "used", "Something relied on every time.");
    for (let i = 0; i < 10; i++) {
      const injection = inject(store, binding, T0 + i);
      recordCitations(store, injection.injectedIds, [id], T0 + i);
    }
    const after = store.load()[0];
    if (after === undefined) throw new Error("no memory");
    expect(utilityRatioOf(after.state)).toBe(1);
  });

  test("the used one outweighs the ignored one, and that is the point", () => {
    const store = tempStore();
    const used = seed(store, "used", "relied on");
    seed(store, "ignored", "never relied on");
    for (let i = 0; i < 10; i++) {
      const injection = inject(store, binding, T0 + i);
      recordCitations(store, injection.injectedIds, [used], T0 + i);
    }
    const all = store.load();
    const a = all.find((m) => m.content.key === "used");
    const b = all.find((m) => m.content.key === "ignored");
    if (a === undefined || b === undefined) throw new Error("missing");
    expect(weightOf(a, { nowMs: T0 })).toBeGreaterThan(weightOf(b, { nowMs: T0 }));
  });
});

describe("OUTCOME CORRELATION — the only signal that says it was RIGHT", () => {
  test("a delivered work item credits what was in scope", () => {
    const store = tempStore();
    const id = seed(store, "k", "v");
    const injection = inject(store, binding, T0);
    const touched = correlateOutcome(store, "task-1", injection.injectedIds, WorkOutcomeSignal.Success, T0 + 1);
    expect(touched).toEqual([id]);
    expect(store.load()[0]?.state.outcome.successCount).toBe(1);
  });

  test("the same work item votes once, however many gates it touched", () => {
    const store = tempStore();
    seed(store, "k", "v");
    const injection = inject(store, binding, T0);
    correlateOutcome(store, "task-1", injection.injectedIds, WorkOutcomeSignal.Success, T0 + 1);
    correlateOutcome(store, "task-1", injection.injectedIds, WorkOutcomeSignal.Success, T0 + 2);
    expect(store.load()[0]?.state.outcome.successCount).toBe(1);
  });

  test("BLOCKED IS NOT FAILURE — work stopped for a person says nothing about the memory", () => {
    // Counting it as failure would punish memories for being used on careful work.
    expect(signalFor(false, true)).toBe(WorkOutcomeSignal.Inconclusive);
    expect(signalFor(true, false)).toBe(WorkOutcomeSignal.Success);
    expect(signalFor(false, false)).toBe(WorkOutcomeSignal.Failure);
  });

  test("an inconclusive outcome does not move the success/failure ratio", () => {
    const store = tempStore();
    seed(store, "k", "v");
    const injection = inject(store, binding, T0);
    correlateOutcome(store, "task-1", injection.injectedIds, WorkOutcomeSignal.Inconclusive, T0 + 1);
    const s = store.load()[0]?.state.outcome;
    expect(s?.inconclusiveCount).toBe(1);
    expect(s?.successCount).toBe(0);
    expect(s?.failureCount).toBe(0);
  });

  test("failing work counts against what was in scope", () => {
    const store = tempStore();
    seed(store, "k", "v");
    for (const workId of ["a", "b", "c"]) {
      const injection = inject(store, { ...binding, workId }, T0);
      correlateOutcome(store, workId, injection.injectedIds, WorkOutcomeSignal.Failure, T0);
    }
    const after = store.load()[0];
    if (after === undefined) throw new Error("no memory");
    expect(after.state.outcome.failureCount).toBe(3);
  });
});

describe("THE LEDGER remembers what was in scope for which item", () => {
  test("ids accumulate per work item without duplicating", () => {
    let ledger = noteInjectionFor(EMPTY_LEDGER, "task-1", ["a", "b"]);
    ledger = noteInjectionFor(ledger, "task-1", ["b", "c"]);
    expect([...(ledger.byWork.get("task-1") ?? [])].sort()).toEqual(["a", "b", "c"]);
  });

  test("two work items keep separate scopes", () => {
    let ledger = noteInjectionFor(EMPTY_LEDGER, "task-1", ["a"]);
    ledger = noteInjectionFor(ledger, "task-2", ["b"]);
    expect(ledger.byWork.get("task-1")).toEqual(["a"]);
    expect(ledger.byWork.get("task-2")).toEqual(["b"]);
  });

  test("the empty ledger knows nothing rather than throwing", () => {
    expect(EMPTY_LEDGER.byWork.get("nope")).toBeUndefined();
  });
});
