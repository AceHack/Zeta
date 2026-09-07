/**
 * slot-dispatch.test.ts — a shadow lane must be distinguishable from a working one.
 *
 * What this replaces was a constant: `{ workId, lane, success: true, doraContribution: 0.5 }`,
 * returned for every `PickWork` the agent chose. Every cycle reported work nobody did, and the
 * record could not tell that run from one that delivered.
 *
 * So the tests that matter are the ones about what shadow does NOT do, and about who is allowed to
 * decide that a lane may stop being shadow.
 */

import { describe, expect, test } from "bun:test";
import {
  AgentLoopMode,
  dispatcherFor,
  evaluatePromotionGate,
  primaryDispatcher,
  PROMOTION_MAX_DIVERGENCE,
  PROMOTION_MIN_SOAK_HOURS,
  PROMOTION_MIN_TICKS,
  shadowDispatcher,
  type PromotionWindow,
} from "./slot-dispatch";
import { Fidelity } from "./providers";
import type { MenuOption } from "../workflow-engine/agent-loop/state-machine";

const pickWork: MenuOption = {
  tag: "PickWork",
  work: { id: "task-1", lane: "operational", title: "t", priority: 1 },
} as unknown as MenuOption;

const heartbeat: MenuOption = { tag: "EmitHeartbeat", lane: "operational" } as unknown as MenuOption;

/** A window that has earned promotion, so each test can spoil exactly one field. */
const earned: PromotionWindow = {
  shadowTicks: 500,
  shadowSoakHours: 48,
  shadowIllegalSelections: 0,
  shadowDivergenceRate: 0.01,
  divergenceMeasured: true,
  primarySelectorRejections30m: 0,
  primaryControlBypassRejections30m: 0,
};

describe("SHADOW performs nothing and INVENTS nothing", () => {
  test("a shadow PickWork produces NO result — not a success, not a failure", async () => {
    // The three-state answer. In shadow the work was not done: `success: true` is a lie and
    // `success: false` is also a lie, because it did not fail — it was not attempted. No result
    // leaves the agent in `ExecutingWork`, which is the true state.
    const d = await shadowDispatcher().dispatch(pickWork);
    expect(d.result).toBeUndefined();
    expect(d.performed).toBe(false);
    expect(d.mode).toBe(AgentLoopMode.ObserveActShadow);
  });

  test("...and it RECORDS what it would have done, which is the point of a shadow", async () => {
    const d = await shadowDispatcher().dispatch(pickWork);
    expect(d.slot).toBe("PickWork");
    expect(d.workId).toBe("task-1");
    expect(d.evidenceRefs).toContain("observe-act-shadow:slot:PickWork");
    expect(d.summary).toContain("would have dispatched");
  });

  test("the shadow dispatcher is LABELLED simulated, so a run's fidelity can see it", async () => {
    expect(shadowDispatcher().meta.fidelity).toBe(Fidelity.Simulated);
    expect(shadowDispatcher().meta.describes).toContain("produces no result");
  });
});

describe("PRIMARY reaches the real runtime, and reports what it found", () => {
  test("a chosen PickWork runs the work and carries the REAL outcome", async () => {
    let asked: string | undefined;
    const d = await primaryDispatcher(async (workId) => {
      asked = workId;
      return { succeeded: true, evidenceRefs: ["merge:abc"], summary: "merged", doraContribution: 1 };
    }).dispatch(pickWork);

    expect(asked).toBe("task-1");
    expect(d.performed).toBe(true);
    expect(d.result?.success).toBe(true);
    expect(d.result?.doraContribution).toBe(1);
    expect(d.evidenceRefs).toEqual(["merge:abc"]);
  });

  test("A FAILING PIPELINE PRODUCES A FAILING RESULT — the direction the constant could not express", async () => {
    // The old seam returned `success: true` unconditionally, so this case had no representation at
    // all. It is the one that matters: an agent must be told its work did not land.
    const d = await primaryDispatcher(async () => ({
      succeeded: false,
      evidenceRefs: ["blocked:adversarial_review"],
      summary: "the adversarial review rejected it",
      doraContribution: 0,
    })).dispatch(pickWork);

    expect(d.performed).toBe(true);
    expect(d.result?.success).toBe(false);
    expect(d.result?.doraContribution).toBe(0);
    expect(d.result?.notes).toContain("rejected");
  });

  test("a NON-work slot dispatches nothing and says so, rather than reading as a success", async () => {
    let called = false;
    const d = await primaryDispatcher(async () => {
      called = true;
      return { succeeded: true, evidenceRefs: [], summary: "", doraContribution: 1 };
    }).dispatch(heartbeat);

    expect(called).toBe(false);
    expect(d.performed).toBe(false);
    expect(d.result).toBeUndefined();
    expect(d.summary).toContain("nothing was dispatched");
  });

  test("the primary dispatcher is LABELLED real", async () => {
    expect(primaryDispatcher(async () => ({ succeeded: true, evidenceRefs: [], summary: "", doraContribution: 0 })).meta.fidelity).toBe(
      Fidelity.Real,
    );
  });
});

describe("THE GATE DECIDES, and it defaults to shadow", () => {
  test("a window that earned it is promoted", () => {
    const v = evaluatePromotionGate(earned);
    expect(v.mode).toBe(AgentLoopMode.ObserveActPrimary);
    expect(v.blockedBy).toEqual([]);
  });

  test("A FRESH WINDOW IS SHADOW — absence of evidence is never permission", () => {
    const v = evaluatePromotionGate({
      shadowTicks: 0,
      shadowSoakHours: 0,
      shadowIllegalSelections: 0,
      shadowDivergenceRate: 0,
      divergenceMeasured: false,
      primarySelectorRejections30m: 0,
      primaryControlBypassRejections30m: 0,
    });
    expect(v.mode).toBe(AgentLoopMode.ObserveActShadow);
    expect(v.blockedBy[0]).toContain("neither 100 ticks nor 24h");
  });

  test("EACH condition blocks on its own", () => {
    const spoil: [Partial<PromotionWindow>, string][] = [
      [{ shadowIllegalSelections: 1 }, "illegal slot selection"],
      [{ shadowDivergenceRate: PROMOTION_MAX_DIVERGENCE + 0.01 }, "divergence"],
      [{ primarySelectorRejections30m: 2 }, "selector rejection"],
      [{ primaryControlBypassRejections30m: 1 }, "control-bypass"],
      [{ shadowTicks: 1, shadowSoakHours: 1 }, "neither"],
    ];
    for (const [over, expected] of spoil) {
      const v = evaluatePromotionGate({ ...earned, ...over });
      expect(v.mode).toBe(AgentLoopMode.ObserveActShadow);
      expect(v.blockedBy.some((b) => b.includes(expected))).toBe(true);
    }
  });

  test("SOAK IS A DISJUNCTION — ticks OR hours", () => {
    // Requiring both would make a correct but quiet lane unpromotable forever, and a busy one wait
    // a day it did not need.
    expect(evaluatePromotionGate({ ...earned, shadowSoakHours: 0, shadowTicks: PROMOTION_MIN_TICKS }).mode).toBe(
      AgentLoopMode.ObserveActPrimary,
    );
    expect(evaluatePromotionGate({ ...earned, shadowTicks: 0, shadowSoakHours: PROMOTION_MIN_SOAK_HOURS }).mode).toBe(
      AgentLoopMode.ObserveActPrimary,
    );
  });

  test("a live primary failure blocks a clean HISTORICAL window", () => {
    // Recent bad news outranks a good record: the window may be spotless and the lane still be
    // rejecting selections right now.
    const v = evaluatePromotionGate({ ...earned, primaryControlBypassRejections30m: 1 });
    expect(v.mode).toBe(AgentLoopMode.ObserveActShadow);
  });

  test("the verdict carries the evidence refs the design names", () => {
    const v = evaluatePromotionGate(earned);
    for (const key of [
      "shadow_ticks",
      "shadow_soak_hours",
      "shadow_divergence_rate",
      "shadow_illegal_selections",
      "primary_selector_rejections_30m",
      "primary_control_bypass_rejections_30m",
    ]) {
      expect(v.evidenceRefs.some((r) => r.includes(key))).toBe(true);
    }
  });
});

describe("dispatcherFor — the caller cannot ask for primary", () => {
  test("an unearned verdict yields the SHADOW dispatcher however the caller feels", async () => {
    // The design document's own sentence: agents select slots, they do not decide whether the
    // organization is safe to promote a lane. Taking a VERDICT rather than a mode is what makes
    // that unsayable rather than merely discouraged.
    const unearned = evaluatePromotionGate({ ...earned, shadowIllegalSelections: 3 });
    let called = false;
    const d = dispatcherFor(unearned, async () => {
      called = true;
      return { succeeded: true, evidenceRefs: [], summary: "", doraContribution: 1 };
    });
    const out = await d.dispatch(pickWork);
    expect(called).toBe(false);
    expect(out.performed).toBe(false);
    expect(d.meta.fidelity).toBe(Fidelity.Simulated);
  });

  test("...and an earned one yields the primary dispatcher, which does call through", async () => {
    let called = false;
    const d = dispatcherFor(evaluatePromotionGate(earned), async () => {
      called = true;
      return { succeeded: true, evidenceRefs: ["x"], summary: "done", doraContribution: 1 };
    });
    const out = await d.dispatch(pickWork);
    expect(called).toBe(true);
    expect(out.performed).toBe(true);
    expect(d.meta.fidelity).toBe(Fidelity.Real);
  });
});

describe("UNMEASURED DIVERGENCE BLOCKS — the worst place to read absence as permission", () => {
  test("a spotless window whose divergence was never measured stays SHADOW", () => {
    // A rate of zero from a comparison nobody ran is not a clean rate; it is no rate. And this is
    // the gate that unlocks real dispatch of side effects, so it is the worst possible place to
    // let an absent measurement read as a passing one.
    const v = evaluatePromotionGate({ ...earned, divergenceMeasured: false, shadowDivergenceRate: 0 });
    expect(v.mode).toBe(AgentLoopMode.ObserveActShadow);
    expect(v.blockedBy.some((b) => b.includes("never measured"))).toBe(true);
  });

  test("...and the evidence ref says UNMEASURED rather than printing a zero", () => {
    const v = evaluatePromotionGate({ ...earned, divergenceMeasured: false });
    expect(v.evidenceRefs.some((r) => r.includes("shadow_divergence_rate:UNMEASURED"))).toBe(true);
  });

  test("a MEASURED zero is a real clean rate and does not block", () => {
    const v = evaluatePromotionGate({ ...earned, divergenceMeasured: true, shadowDivergenceRate: 0 });
    expect(v.mode).toBe(AgentLoopMode.ObserveActPrimary);
  });
});

describe("THE BUDGET GATE — 'if budget is available', able to refuse", () => {
  test("a refused budget means the work was NOT ATTEMPTED — no result, nothing performed", async () => {
    // The same three-state answer as shadow, for a different reason: it did not fail, it was never
    // started. `success: false` here would tell an agent its work was rejected on merit.
    let performed = false;
    const d = await primaryDispatcher(
      async () => {
        performed = true;
        return { succeeded: true, evidenceRefs: [], summary: "", doraContribution: 1 };
      },
      () => ({ refusal: "eng-q3 has 0 agent-minutes left", checked: true }),
    ).dispatch(pickWork);

    expect(performed).toBe(false);
    expect(d.performed).toBe(false);
    expect(d.result).toBeUndefined();
    expect(d.summary).toContain("budget refused");
  });

  test("the budget is checked BEFORE the work runs, not after", async () => {
    // A budget consulted afterwards is a report, not a limit.
    const order: string[] = [];
    await primaryDispatcher(
      async () => {
        order.push("perform");
        return { succeeded: true, evidenceRefs: [], summary: "", doraContribution: 1 };
      },
      () => {
        order.push("budget");
        return { checked: true };
      },
    ).dispatch(pickWork);
    expect(order).toEqual(["budget", "perform"]);
  });

  test("an allowed budget lets the work through and records that it was CHECKED", async () => {
    const d = await primaryDispatcher(
      async () => ({ succeeded: true, evidenceRefs: [], summary: "ok", doraContribution: 1 }),
      () => ({ checked: true }),
    ).dispatch(pickWork);
    expect(d.performed).toBe(true);
    expect(d.budgetChecked).toBe(true);
  });

  test("NO BUDGET DECLARED PROCEEDS, AND SAYS THE CHECK DID NOT RUN", async () => {
    // Not stopped by a limit nobody set, and not recorded as having passed one. `budgetChecked`
    // false is the difference between "allowed" and "unbudgeted", which one boolean would conflate.
    const d = await primaryDispatcher(async () => ({
      succeeded: true,
      evidenceRefs: [],
      summary: "ok",
      doraContribution: 1,
    })).dispatch(pickWork);
    expect(d.performed).toBe(true);
    expect(d.budgetChecked).toBe(false);
  });

  test("SHADOW NEVER CONSULTS A BUDGET — it spends nothing to spend", async () => {
    let asked = false;
    const d = dispatcherFor(
      evaluatePromotionGate({ ...earned, divergenceMeasured: false }),
      async () => ({ succeeded: true, evidenceRefs: [], summary: "", doraContribution: 1 }),
      () => {
        asked = true;
        return { checked: true };
      },
    );
    await d.dispatch(pickWork);
    expect(asked).toBe(false);
  });
});
