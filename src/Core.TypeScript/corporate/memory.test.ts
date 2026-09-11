/**
 * memory.test.ts — a memory system is only a memory system if it can forget.
 *
 * The central property, and the one the source design loses: a memory that is stale, uncited and
 * badly correlated must actually reach the archive floor. Under the source's constant-`0.5`
 * semantic substitution it cannot — every weight is floored at exactly the archive threshold — so
 * the first describe block below is arithmetic, not behaviour, because that is where the defect is.
 */

import { describe, expect, test } from "bun:test";

import {
  applyAction,
  ARCHIVE_FLOOR,
  atArchiveFloor,
  belowReadFloor,
  freshnessOf,
  legalTransitions,
  maintenancePass,
  mayTransition,
  memoryIdOf,
  MemoryPhase,
  MemoryTier,
  noteCited,
  noteCrossScope,
  noteInjected,
  noteOutcome,
  outcomeRatioOf,
  promotionCandidate,
  READ_FLOOR,
  recall,
  tierAbove,
  utilityRatioOf,
  weightOf,
  write,
  WorkOutcomeSignal,
  type Memory,
} from "./memory";

const DAY = 86_400_000;
const T0 = 1_700_000_000_000;

function mem(over: {
  tier?: MemoryTier;
  scope?: string;
  key?: string;
  value?: string;
  confidence?: number;
  freshnessAtMs?: number;
  phase?: MemoryPhase;
  injected?: number;
  cited?: number;
  success?: number;
  failure?: number;
  scopes?: readonly string[];
  isProtected?: boolean;
} = {}): Memory {
  const tier = over.tier ?? MemoryTier.Hat;
  const scope = over.scope ?? "code_reviewer";
  const key = over.key ?? "require-rollback-plan";
  return {
    content: {
      memoryId: memoryIdOf(tier, scope, key),
      tier,
      scope,
      key,
      value: over.value ?? "Require a rollback plan before approving a database migration.",
      protected: over.isProtected ?? false,
      writtenBy: "code_reviewer",
      writtenAtMs: T0,
    },
    state: {
      memoryId: memoryIdOf(tier, scope, key),
      confidence: over.confidence ?? 0.6,
      freshnessAtMs: over.freshnessAtMs ?? T0,
      reinforcementCount: 0,
      outcome: {
        successCount: over.success ?? 0,
        failureCount: over.failure ?? 0,
        inconclusiveCount: 0,
        lastOutcomeAtMs: undefined,
        workItemsObserved: [],
      },
      utility: {
        injectedCount: over.injected ?? 0,
        citedCount: over.cited ?? 0,
        lastInjectedAtMs: undefined,
      },
      crossScope: {
        distinctScopes: over.scopes ?? [scope],
        firstObservedAtMs: T0,
        lastObservedAtMs: T0,
      },
      phase: over.phase ?? MemoryPhase.Active,
    },
  };
}

describe("THE FLOOR MUST BE REACHABLE — otherwise nothing is ever forgotten", () => {
  test("a stale, uncited, badly-correlated memory reaches the archive floor", () => {
    // Everything that can go wrong, has: aged past twice its half-life, injected repeatedly and
    // never cited, and correlated with failure every time.
    const dead = mem({
      freshnessAtMs: T0 - 400 * DAY, // hat half-life is 120d, so freshness is 0
      confidence: 0,
      injected: 20,
      cited: 0,
      success: 0,
      failure: 10,
    });
    const ctx = { nowMs: T0 };
    expect(freshnessOf(dead, T0)).toBe(0);
    expect(outcomeRatioOf(dead.state)).toBe(0);
    expect(utilityRatioOf(dead.state)).toBe(0);
    expect(weightOf(dead, ctx)).toBe(0);
    expect(atArchiveFloor(dead, ctx)).toBe(true);
  });

  test("the SOURCE's constant-0.5 substitution would have made that impossible", () => {
    // Not a test of our code — a statement of the arithmetic that motivated the change, so the
    // reason for it survives after the design doc is forgotten. 0.30 × 0.5 = 0.15, and the hat
    // archive floor IS 0.15, so the worst memory imaginable would sit exactly AT the floor with
    // every other term at zero, and any confidence at all would lift it clear forever.
    const constantSemanticFloor = 0.3 * 0.5;
    expect(constantSemanticFloor).toBe(ARCHIVE_FLOOR.hat);
  });

  test("a fresh, well-cited, well-correlated memory is nowhere near the floor", () => {
    const good = mem({ confidence: 0.9, injected: 10, cited: 9, success: 9, failure: 1 });
    const w = weightOf(good, { nowMs: T0 });
    expect(w).toBeGreaterThan(0.85);
    expect(atArchiveFloor(good, { nowMs: T0 })).toBe(false);
  });

  test("the four terms are renormalised, so a perfect memory scores 1 and not 0.7", () => {
    const perfect = mem({ confidence: 1, injected: 10, cited: 10, success: 10, failure: 0 });
    expect(weightOf(perfect, { nowMs: T0 })).toBeCloseTo(1, 6);
  });

  test("with a semantic score the declared weights are used unchanged", () => {
    const perfect = mem({ confidence: 1, injected: 10, cited: 10, success: 10, failure: 0 });
    // 0.30 × 1.0 semantic + 0.70 of everything else = 1.0
    expect(weightOf(perfect, { nowMs: T0, semanticScore: 1 })).toBeCloseTo(1, 6);
    // A perfect memory nobody's query resembles keeps exactly the non-semantic 0.70.
    expect(weightOf(perfect, { nowMs: T0, semanticScore: 0 })).toBeCloseTo(0.7, 6);
  });

  test("renormalising does not reorder anything — it restores the range", () => {
    const a = mem({ key: "a", confidence: 0.9 });
    const b = mem({ key: "b", confidence: 0.2 });
    const ctx = { nowMs: T0 };
    expect(weightOf(a, ctx)).toBeGreaterThan(weightOf(b, ctx));
  });

  test("a PROTECTED memory never reaches the floor, however bad its numbers", () => {
    const dead = mem({
      isProtected: true,
      freshnessAtMs: T0 - 400 * DAY,
      confidence: 0,
      injected: 20,
      cited: 0,
      failure: 10,
    });
    expect(weightOf(dead, { nowMs: T0 })).toBe(0);
    // The arithmetic still says zero; the policy says it is not forgotten by neglect.
    expect(atArchiveFloor(dead, { nowMs: T0 })).toBe(false);
  });
});

describe("DECAY", () => {
  test("freshness runs from the last confirmation, not from when it was written", () => {
    const m = mem({ freshnessAtMs: T0 - 120 * DAY });
    expect(freshnessOf(m, T0)).toBeCloseTo(0.5, 6); // exactly one half-life for a hat memory
  });

  test("work memory decays four times faster than hat memory", () => {
    const w = mem({ tier: MemoryTier.Work, scope: "task-1", freshnessAtMs: T0 - 30 * DAY });
    const h = mem({ freshnessAtMs: T0 - 30 * DAY });
    expect(freshnessOf(w, T0)).toBeLessThan(freshnessOf(h, T0));
  });

  test("freshness never goes negative, so an ancient memory is 0 and not -3", () => {
    expect(freshnessOf(mem({ freshnessAtMs: T0 - 10_000 * DAY }), T0)).toBe(0);
  });
});

describe("NEUTRAL UNTIL THERE IS SIGNAL", () => {
  test("one success is not evidence — the ratio stays neutral below three samples", () => {
    expect(outcomeRatioOf(mem({ success: 1 }).state)).toBe(0.5);
    expect(outcomeRatioOf(mem({ success: 2, failure: 0 }).state)).toBe(0.5);
    expect(outcomeRatioOf(mem({ success: 3, failure: 0 }).state)).toBe(1);
  });

  test("utility is neutral below five injections, then it bites", () => {
    expect(utilityRatioOf(mem({ injected: 4, cited: 0 }).state)).toBe(0.5);
    expect(utilityRatioOf(mem({ injected: 20, cited: 0 }).state)).toBe(0);
    expect(utilityRatioOf(mem({ injected: 20, cited: 10 }).state)).toBe(0.5);
  });
});

describe("IDENTITY — two writes of the same lesson are one memory", () => {
  test("the id is derived from tier, scope and key", () => {
    expect(memoryIdOf(MemoryTier.Hat, "code_reviewer", "k")).toBe(
      memoryIdOf(MemoryTier.Hat, "code_reviewer", "k"),
    );
  });

  test("a scope containing the delimiter cannot forge another memory's id", () => {
    // The same trap `externalRefOf` closes. Without length prefixes `a|b` + `c` and `a` + `b|c`
    // would collide, and one hat's lesson would land in another's memory.
    expect(memoryIdOf(MemoryTier.Hat, "a|b", "c")).not.toBe(memoryIdOf(MemoryTier.Hat, "a", "b|c"));
  });

  test("different tiers with the same scope and key are different memories", () => {
    expect(memoryIdOf(MemoryTier.Hat, "x", "k")).not.toBe(memoryIdOf(MemoryTier.Agent, "x", "k"));
  });
});

describe("WRITING: new, reinforced, or conflicted — never silently replaced", () => {
  const input = {
    tier: MemoryTier.Hat,
    scope: "code_reviewer",
    key: "require-rollback-plan",
    value: "Require a rollback plan.",
    writtenBy: "code_reviewer",
    atMs: T0,
  };

  test("a first write is a draft", () => {
    const r = write(undefined, input);
    expect(r.ok && r.memory.state.phase).toBe(MemoryPhase.Draft);
    expect(r.ok && r.reinforced).toBe(false);
  });

  test("the same value again reinforces: freshness resets and confidence lifts", () => {
    const first = write(undefined, input);
    if (!first.ok) throw new Error("unreachable");
    const again = write(first.memory, { ...input, atMs: T0 + 60 * DAY });
    expect(again.ok && again.reinforced).toBe(true);
    expect(again.ok && again.memory.state.freshnessAtMs).toBe(T0 + 60 * DAY);
    expect(again.ok && again.memory.state.confidence).toBeCloseTo(0.7, 6);
    expect(again.ok && again.memory.state.reinforcementCount).toBe(1);
  });

  test("a DIFFERENT value conflicts, and the existing belief stands until somebody decides", () => {
    const first = write(undefined, input);
    if (!first.ok) throw new Error("unreachable");
    const clash = write(first.memory, { ...input, value: "Rollback plans are optional." });
    expect(clash.ok && clash.conflicted).toBe(true);
    expect(clash.ok && clash.memory.state.phase).toBe(MemoryPhase.Conflicted);
    // The whole point: taking the new value would make "conflicted" a label on a change that
    // already happened, and the organization would lose an argument nobody knew it was having.
    expect(clash.ok && clash.memory.content.value).toBe("Require a rollback plan.");
  });

  test("a protected memory refuses to be overwritten", () => {
    const first = write(undefined, { ...input, protected: true });
    if (!first.ok) throw new Error("unreachable");
    const clash = write(first.memory, { ...input, value: "something else" });
    expect(clash.ok).toBe(false);
  });

  test("a protected memory can still be reinforced by the same value", () => {
    const first = write(undefined, { ...input, protected: true });
    if (!first.ok) throw new Error("unreachable");
    expect(write(first.memory, input).ok).toBe(true);
  });

  test("a memory with no value, key, scope or author is refused", () => {
    expect(write(undefined, { ...input, value: "  " }).ok).toBe(false);
    expect(write(undefined, { ...input, key: "" }).ok).toBe(false);
    expect(write(undefined, { ...input, scope: "" }).ok).toBe(false);
    expect(write(undefined, { ...input, writtenBy: "" }).ok).toBe(false);
  });
});

describe("CITATION CANNOT BE FABRICATED", () => {
  test("citing a memory that was never injected is refused, and SAYS WHICH FAILURE IT IS", () => {
    // An agent that could cite anything would manufacture its own grounding, and the utility
    // ratio — which decides what survives — would measure claims instead of behaviour.
    const r = noteCited(mem().state, T0);
    expect(r.ok).toBe(false);
    // ── WHY THE MESSAGE IS ASSERTED AND NOT JUST THE REFUSAL ────────────────
    // A mutation run showed the never-injected guard SURVIVING deletion: with `injected: 0` the
    // next guard (`cited >= injected`) is `0 >= 0` and refuses anyway, so the two are
    // behaviourally identical and the first looked like dead code.
    //
    // It is not dead, and the difference is diagnostic. "Never injected" says an agent invented a
    // grounding — the thing this whole check exists to catch. "Cited more often than injected"
    // reads as an off-by-one. Deleting the guard would lose that distinction silently, so what is
    // pinned here is the SENTENCE, which is the only thing the guard uniquely produces.
    expect(r.ok === false && r.reason).toContain("never injected");
  });

  test("citing more often than injected is a DIFFERENT refusal", () => {
    const injected = noteInjected(mem().state, T0);
    const once = noteCited(injected, T0);
    if (!once.ok) throw new Error("unreachable");
    const twice = noteCited(once.state, T0);
    expect(twice.ok).toBe(false);
    expect(twice.ok === false && twice.reason).toContain("more often than injected");
  });

  test("one injection may be cited once", () => {
    const injected = noteInjected(mem().state, T0);
    const first = noteCited(injected, T0);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("unreachable");
    expect(noteCited(first.state, T0).ok).toBe(false);
  });

  test("a citation refreshes the memory, because being used is a confirmation", () => {
    const injected = noteInjected(mem({ freshnessAtMs: T0 - 100 * DAY }).state, T0);
    const cited = noteCited(injected, T0);
    expect(cited.ok && cited.state.freshnessAtMs).toBe(T0);
  });
});

describe("OUTCOME CORRELATION: one work item votes once", () => {
  test("a success is counted", () => {
    const s = noteOutcome(mem().state, "task-1", WorkOutcomeSignal.Success, T0);
    expect(s.outcome.successCount).toBe(1);
  });

  test("the same work item cannot vote twice", () => {
    // Without this a long item that touches a memory at every gate casts fourteen votes, and the
    // ratio measures how chatty the run was rather than whether the memory helped.
    let s = noteOutcome(mem().state, "task-1", WorkOutcomeSignal.Success, T0);
    s = noteOutcome(s, "task-1", WorkOutcomeSignal.Success, T0 + 1);
    expect(s.outcome.successCount).toBe(1);
  });

  test("a different work item does vote", () => {
    let s = noteOutcome(mem().state, "task-1", WorkOutcomeSignal.Success, T0);
    s = noteOutcome(s, "task-2", WorkOutcomeSignal.Failure, T0 + 1);
    expect(s.outcome.successCount).toBe(1);
    expect(s.outcome.failureCount).toBe(1);
  });
});

describe("PROMOTION: a lesson several scopes learned independently", () => {
  test("three distinct scopes make it a candidate", () => {
    expect(promotionCandidate(mem({ scopes: ["a", "b"] }))).toBe(false);
    expect(promotionCandidate(mem({ scopes: ["a", "b", "c"] }))).toBe(true);
  });

  test("the same scope observed again is not a second scope", () => {
    const s = noteCrossScope(noteCrossScope(mem().state, "a", T0), "a", T0 + 1);
    expect(s.crossScope.distinctScopes.filter((x) => x === "a").length).toBe(1);
  });

  test("org memory has nowhere to be promoted to", () => {
    expect(promotionCandidate(mem({ tier: MemoryTier.Org, scope: "org", scopes: ["a", "b", "c"] }))).toBe(false);
    expect(tierAbove(MemoryTier.Org)).toBeUndefined();
    expect(tierAbove(MemoryTier.Work)).toBe(MemoryTier.Hat);
  });

  test("an archived memory is not promoted out of its grave", () => {
    expect(promotionCandidate(mem({ phase: MemoryPhase.Archived, scopes: ["a", "b", "c"] }))).toBe(false);
  });
});

describe("RECALL: the union of scopes, ranked, capped", () => {
  const binding = { orgId: "org", departmentId: "engineering", hatId: "code_reviewer", agentId: "agent-7", workId: "task-1" };
  const ctx = { nowMs: T0, hatId: "code_reviewer", agentId: "agent-7", workId: "task-1" };

  test("a hat memory and an agent memory both surface — the ladder is a union", () => {
    const memories = [
      mem({ tier: MemoryTier.Hat, scope: "code_reviewer", key: "h", confidence: 0.9 }),
      mem({ tier: MemoryTier.Agent, scope: "agent-7", key: "a", confidence: 0.9 }),
    ];
    expect(recall(memories, binding, ctx).length).toBe(2);
  });

  test("another hat's memory does not surface", () => {
    const other = mem({ tier: MemoryTier.Hat, scope: "security_reviewer", key: "s", confidence: 0.9 });
    expect(recall([other], binding, ctx)).toEqual([]);
  });

  test("an archived memory never surfaces, whatever its weight would be", () => {
    const dead = mem({ phase: MemoryPhase.Archived, confidence: 1 });
    expect(recall([dead], binding, ctx)).toEqual([]);
  });

  test("a memory below the read floor does not surface", () => {
    const faded = mem({ freshnessAtMs: T0 - 200 * DAY, confidence: 0, injected: 20, cited: 0, failure: 5 });
    expect(belowReadFloor(faded, ctx)).toBe(true);
    expect(recall([faded], binding, ctx)).toEqual([]);
  });

  test("the budget caps what an agent is shown, heaviest first", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      mem({ key: `k${String(i)}`, confidence: i / 20 }),
    );
    const got = recall(many, binding, ctx, 5);
    expect(got.length).toBe(5);
    expect(got[0]?.weight).toBeGreaterThanOrEqual(got[4]?.weight ?? 0);
  });

  test("ties break on id, so two identical runs recall in the same order", () => {
    const a = mem({ key: "aaa" });
    const b = mem({ key: "bbb" });
    expect(recall([b, a], binding, ctx).map((r) => r.memory.content.key)).toEqual(
      recall([a, b], binding, ctx).map((r) => r.memory.content.key),
    );
  });
});

describe("THE PHASE MACHINE", () => {
  test("archived is terminal — nothing follows it", () => {
    expect(legalTransitions(MemoryPhase.Archived)).toEqual([]);
    expect(mayTransition(MemoryPhase.Archived, MemoryPhase.Active)).toBe(false);
  });

  test("a promotion leaves the source usable, because it explains where the lesson came from", () => {
    expect(mayTransition(MemoryPhase.Promoted, MemoryPhase.Active)).toBe(true);
  });

  test("archiving and demoting are the two things a hat, not the clock, may decide", () => {
    const fromActive = legalTransitions(MemoryPhase.Active);
    expect(fromActive.find((t) => t.to === MemoryPhase.Demoted)?.authority).toBe("hat_decided");
    expect(fromActive.find((t) => t.to === MemoryPhase.Stale)?.authority).toBe("auto");
  });

  test("applying an illegal transition is refused rather than forced", () => {
    const m = mem({ phase: MemoryPhase.Archived });
    const r = applyAction(m, { memoryId: m.content.memoryId, from: MemoryPhase.Archived, to: MemoryPhase.Active, authority: "auto", reason: "x", weight: 0 }, T0);
    expect(r.ok).toBe(false);
  });

  test("a protected memory refuses to be archived even by a legal-looking action", () => {
    const m = mem({ isProtected: true });
    const r = applyAction(m, { memoryId: m.content.memoryId, from: MemoryPhase.Active, to: MemoryPhase.Archived, authority: "auto", reason: "x", weight: 0 }, T0);
    expect(r.ok).toBe(false);
  });
});

describe("A MEMORY NOBODY EVER ASKED FOR", () => {
  const LONG_AFTER = T0 + 200 * 86_400_000;

  test("MEASURED: decay alone can never forget one — which is why the rule below exists", () => {
    // Ten years. Never injected, never judged, confidence at the study-loop default.
    const forgotten = mem({ confidence: 0.45 });
    const w = weightOf(forgotten, { nowMs: T0 + 3650 * 86_400_000 });
    expect(w).toBeGreaterThan(READ_FLOOR[MemoryTier.Hat]);
    expect(w).toBeGreaterThan(ARCHIVE_FLOOR[MemoryTier.Hat] * 2);
    // The organisation forgets what it TRIED and did badly with, and would hoard forever what it
    // wrote and never looked at again — which is the likeliest junk, and forty-five a day of it.
  });

  test("goes stale once recall has been running and never reached for it", () => {
    const actions = maintenancePass(
      [mem({ key: "asked-for", injected: 9, cited: 6 }), mem({ key: "never-asked" })],
      { nowMs: LONG_AFTER },
    );
    const stale = actions.find((a) => a.memoryId === memoryIdOf(MemoryTier.Hat, "code_reviewer", "never-asked"));
    expect(stale?.to).toBe(MemoryPhase.Stale);
    expect(stale?.reason).toContain("never once asked for");
  });

  test("STALE, never archived — an absence of evidence is not a permanent verdict", () => {
    const actions = maintenancePass(
      [mem({ key: "asked-for", injected: 9, cited: 6 }), mem({ key: "never-asked" })],
      { nowMs: LONG_AFTER },
    );
    expect(actions.every((a) => a.to !== MemoryPhase.Archived)).toBe(true);
  });

  test("SILENCE MEANS NOTHING IF NOBODY IS READING — a store never recalled from judges nobody", () => {
    // The whole reason this lives in the pass rather than in `weightOf`. With no injections
    // anywhere, "never asked for" is indistinguishable from "the recall path was never wired", and
    // punishing a memory for that would let an unconfigured run quietly demote the entire store.
    const actions = maintenancePass([mem({ key: "a" }), mem({ key: "b" })], { nowMs: LONG_AFTER });
    expect(actions.filter((a) => a.to === MemoryPhase.Stale)).toEqual([]);
  });

  test("a memory that WAS asked for is judged on its weight, not on this rule", () => {
    const actions = maintenancePass(
      [mem({ key: "asked-for", injected: 9, cited: 6 }), mem({ key: "also-asked", injected: 2 })],
      { nowMs: LONG_AFTER },
    );
    expect(actions.every((a) => !(a.reason ?? "").includes("never once asked for"))).toBe(true);
  });

  test("a recent memory is not punished for not having been needed yet", () => {
    const actions = maintenancePass(
      [mem({ key: "asked-for", injected: 9, cited: 6 }), mem({ key: "new-today" })],
      { nowMs: T0 + 86_400_000 },
    );
    expect(actions.filter((a) => a.to === MemoryPhase.Stale)).toEqual([]);
  });

  test("reinforcement resets the clock — the organisation keeps rediscovering it", () => {
    const actions = maintenancePass(
      [
        mem({ key: "asked-for", injected: 9, cited: 6 }),
        mem({ key: "kept-relearning", freshnessAtMs: LONG_AFTER - 86_400_000 }),
      ],
      { nowMs: LONG_AFTER },
    );
    expect(actions.filter((a) => a.to === MemoryPhase.Stale)).toEqual([]);
  });
});

describe("THE MAINTENANCE PASS proposes; it does not act", () => {
  const ctx = { nowMs: T0 };

  test("a dead memory is proposed for archive, by the system", () => {
    const dead = mem({ freshnessAtMs: T0 - 400 * DAY, confidence: 0, injected: 20, cited: 0, failure: 10 });
    const plan = maintenancePass([dead], ctx);
    expect(plan[0]?.to).toBe(MemoryPhase.Archived);
    expect(plan[0]?.authority).toBe("auto");
    // The reason carries the arithmetic, so a person reading the log can check it.
    expect(plan[0]?.reason).toContain("archive floor");
  });

  test("a faded memory is proposed for stale, which is recoverable", () => {
    const faded = mem({ freshnessAtMs: T0 - 200 * DAY, confidence: 0.2, injected: 6, cited: 1 });
    const plan = maintenancePass([faded], ctx);
    expect(plan[0]?.to).toBe(MemoryPhase.Stale);
  });

  test("a draft above the floor joins the pool", () => {
    const plan = maintenancePass([mem({ phase: MemoryPhase.Draft, confidence: 0.9 })], ctx);
    expect(plan[0]?.to).toBe(MemoryPhase.Active);
  });

  test("a promotion is proposed but marked as a DECISION, never applied by the clock", () => {
    const spread = mem({ confidence: 0.9, scopes: ["a", "b", "c"] });
    const plan = maintenancePass([spread], ctx);
    expect(plan[0]?.to).toBe(MemoryPhase.Promoted);
    expect(plan[0]?.authority).toBe("hat_decided");
  });

  test("an archived memory is not revisited", () => {
    expect(maintenancePass([mem({ phase: MemoryPhase.Archived })], ctx)).toEqual([]);
  });

  test("a protected memory is never proposed for archive", () => {
    const dead = mem({ isProtected: true, freshnessAtMs: T0 - 400 * DAY, confidence: 0, injected: 20, cited: 0, failure: 10 });
    expect(maintenancePass([dead], ctx).some((a) => a.to === MemoryPhase.Archived)).toBe(false);
  });

  test("a healthy memory needs nothing done to it", () => {
    expect(maintenancePass([mem({ confidence: 0.9, injected: 10, cited: 8, success: 8 })], ctx)).toEqual([]);
  });
});
