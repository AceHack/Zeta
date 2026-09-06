/**
 * alternate-work.test.ts — "I was blocked, so I did this instead" is where scope creep is invisible.
 *
 * The eleven kinds are a list. The guardrails are the mechanism, and each of them is a refusal, so
 * this file is mostly refusals: untied work, work outside the approved scope, a lower-priority
 * choice made while a higher one was on the table, and an agent approving its own detour.
 *
 * The fourth guardrail has no refusal because it is the absence of a default — when the blocker
 * clears, nothing happens until a named hat answers. The test for it is that neither resumption nor
 * continuation occurs on its own.
 */

import { describe, expect, test } from "bun:test";
import {
  AlternateRefusal,
  type AlternateCandidate,
  AlternateWorkKind,
  applyResumption,
  offerAlternateWork,
  onBlockerCleared,
  Resumption,
} from "./alternate-work";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { PriorityClass } from "./prioritization";
import { GateKind } from "./quality-gate";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const SCOPE = "initiative-7";
const NOW = 1_000;

function candidate(over: Partial<AlternateCandidate> = {}): AlternateCandidate {
  return {
    kind: AlternateWorkKind.TestsOrHarness,
    workId: "task-2",
    priority: PriorityClass.Normal,
    scope: SCOPE,
    ...over,
  };
}

function offer(over: Partial<Parameters<typeof offerAlternateWork>[1]> = {}) {
  return offerAlternateWork(chart, {
    agentHatId: "backend_implementer",
    blockedWorkId: "task-1",
    blockedPriority: PriorityClass.High,
    candidates: [candidate()],
    chosenIndex: 0,
    approvedScopes: [SCOPE],
    approvedByHatId: "tech_lead",
    atMs: NOW,
    ...over,
  });
}

describe("the happy path exists, and it is narrow", () => {
  test("a supervisor approves in-scope, tied, correctly-ranked alternate work", () => {
    const r = offer();
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.assignment.candidate.workId).toBe("task-2");
    // The blocked item is carried, never dropped. Alternate work pauses the original; it does not
    // replace it, and an assignment that forgot which item was waiting would lose that.
    expect(r.assignment.blockedWorkId).toBe("task-1");
    expect(r.assignment.audit).toContain("tech_lead");
    expect(r.assignment.audit).toContain("task-1");
  });
});

describe("GUARDRAIL 1 — tied to a work item", () => {
  test("UNTIED WORK IS REFUSED — it is where an unrequested change enters looking requested", () => {
    const r = offer({ candidates: [candidate({ workId: "" })] });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(AlternateRefusal.Untied);
  });

  test("whitespace is not an id", () => {
    const r = offer({ candidates: [candidate({ workId: "   " })] });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(AlternateRefusal.Untied);
  });
});

describe("GUARDRAIL 2 — the priority policy still decides", () => {
  test("A LOWER-PRIORITY CHOICE IS REFUSED WHILE A HIGHER ONE WAS AVAILABLE", () => {
    // The ordering still exists; it just stopped deciding anything. That is what "bypasses priority
    // policy" means, and without this check the guardrail is a sentence in a doc.
    const r = offer({
      candidates: [candidate({ workId: "task-low", priority: PriorityClass.Defer }), candidate({ workId: "task-high", priority: PriorityClass.High })],
      chosenIndex: 0,
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(AlternateRefusal.BypassesPriority);
    expect(r.reason).toContain("task-high");
  });

  test("...and the SAME SET is accepted when the highest is the one chosen", () => {
    const r = offer({
      candidates: [candidate({ workId: "task-low", priority: PriorityClass.Defer }), candidate({ workId: "task-high", priority: PriorityClass.Normal })],
      chosenIndex: 1,
    });
    expect(r.ok).toBe(true);
  });

  test("A CANDIDATE THE AGENT COULD NOT HAVE TAKEN IS NOT ONE THAT WAS PASSED OVER", () => {
    // Out-of-scope and beyond-the-hat candidates must not block a legitimate choice, or the
    // guardrail refuses everything and the agent idles for a reason nobody can act on.
    const r = offer({
      candidates: [
        candidate({ workId: "task-elsewhere", priority: PriorityClass.Expedite, scope: "other-initiative" }),
        candidate({ workId: "task-here", priority: PriorityClass.Normal }),
      ],
      chosenIndex: 1,
    });
    expect(r.ok).toBe(true);
  });

  test("AN ALTERNATE MAY NOT OUTRANK THE BLOCKED WORK — a promotion earned by being stuck", () => {
    const r = offer({
      blockedPriority: PriorityClass.Normal,
      candidates: [candidate({ priority: PriorityClass.High })],
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(AlternateRefusal.BypassesPriority);
    expect(r.reason).toContain("task-1");
  });
});

describe("GUARDRAIL 3 — scope does not widen quietly", () => {
  test("WORK OUTSIDE EVERY APPROVED SCOPE IS REFUSED, not merely noted", () => {
    const r = offer({ candidates: [candidate({ scope: "some-other-project" })] });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(AlternateRefusal.OutsideApprovedScope);
  });

  test("no approved scopes at all means nothing is in scope", () => {
    const r = offer({ approvedScopes: [] });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(AlternateRefusal.OutsideApprovedScope);
  });
});

describe("the hat must be able to do it, and someone else must approve it", () => {
  test("AN AGENT MAY NOT APPROVE ITS OWN DETOUR", () => {
    const r = offer({ approvedByHatId: "backend_implementer" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(AlternateRefusal.ApproverLacksAuthority);
  });

  test("a senior hat outside the reporting line has no standing", () => {
    const r = offer({ approvedByHatId: "qa_director" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(AlternateRefusal.ApproverLacksAuthority);
  });

  test("REVIEWING SOMEONE ELSE'S WORK NEEDS THE SCOPE — the doc's own 'if the active hat allows it'", () => {
    const review = candidate({ kind: AlternateWorkKind.ReviewOrQaOtherWork, gate: GateKind.PeerReview });
    const refused = offer({ candidates: [review] });
    expect(refused.ok).toBe(false);
    if (refused.ok) throw new Error("unreachable");
    expect(refused.refusal).toBe(AlternateRefusal.HatCannotPerform);

    // The tech lead holds peer review, and is supervised by the engineering manager.
    const allowed = offerAlternateWork(chart, {
      agentHatId: "tech_lead",
      blockedWorkId: "task-1",
      blockedPriority: PriorityClass.High,
      candidates: [review],
      chosenIndex: 0,
      approvedScopes: [SCOPE],
      approvedByHatId: "engineering_manager",
      atMs: NOW,
    });
    expect(allowed.ok).toBe(true);
  });

  test("a review candidate naming NO gate cannot be checked, so it is refused", () => {
    const r = offer({ candidates: [candidate({ kind: AlternateWorkKind.ReviewOrQaOtherWork })] });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(AlternateRefusal.HatCannotPerform);
    // AND IT SAYS WHICH FAILURE THIS IS. Falling through to the scope lookup refuses too — no hat
    // holds an undefined gate — so the outcome alone cannot tell "you forgot the gate" from "you
    // lack the standing", and only the second is something the agent could act on.
    expect(r.reason).toContain("names no gate");
  });

  test("A MANAGER IS NOT GIVEN IMPLEMENTATION WORK to fill a gap", () => {
    const r = offer({ agentHatId: "engineering_manager", approvedByHatId: "engineering_director" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(AlternateRefusal.HatCannotPerform);
  });
});

describe("NOTHING AVAILABLE IS REPORTED, not papered over", () => {
  test("an empty candidate list refuses rather than manufacturing busywork", () => {
    // An organization with nothing approved for a blocked agent has a real gap. Inventing a task to
    // hide it costs the idle hour anyway and adds an unrequested change.
    const r = offer({ candidates: [] });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(AlternateRefusal.NothingAvailable);
    // NAMING THE AGENT AND THE BLOCKED ITEM, because this refusal is addressed to the organization
    // rather than to the caller: nothing approved exists for a hat that is stuck, and somebody has
    // to fix that. The index refusal below shares the kind and is a caller bug — two audiences, so
    // the message is the part that has to differ.
    expect(r.reason).toContain("backend_implementer");
    expect(r.reason).toContain("task-1");
  });

  test("an index nobody offered refuses, and says so as the caller bug it is", () => {
    const r = offer({ chosenIndex: 4 });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(AlternateRefusal.NothingAvailable);
    expect(r.reason).toContain("index 4");
  });
});

describe("GUARDRAIL 4 — the clear DECIDES NOTHING on its own", () => {
  const assignment = (() => {
    const r = offer();
    if (!r.ok) throw new Error("expected an assignment");
    return r.assignment;
  })();

  test("clearing the blocker produces a QUESTION with all three of the doc's options", () => {
    const q = onBlockerCleared(assignment);
    expect(q.options).toEqual([Resumption.ResumeOriginal, Resumption.FinishAlternateFirst, Resumption.ReassignOriginal]);
    // Auto-resuming discards half-finished alternate work; auto-continuing leaves the unblocked
    // original sitting. Both are decisions, and whichever the code picked would be one made by
    // whoever wrote the code rather than by the hat the doc puts it with.
    expect(Object.keys(q)).not.toContain("resumed");
    expect(Object.keys(q)).not.toContain("choice");
  });

  test("it is addressed to the hat that approved the detour, and to nobody else", () => {
    const q = onBlockerCleared(assignment);
    expect(q.deciderHatId).toBe("tech_lead");
    expect(applyResumption(q, Resumption.ResumeOriginal, "engineering_manager").ok).toBe(false);
    expect(applyResumption(q, Resumption.ResumeOriginal, "backend_implementer").ok).toBe(false);
  });

  test("an answer from the right hat is recorded with what it chose", () => {
    const q = onBlockerCleared(assignment);
    const r = applyResumption(q, Resumption.FinishAlternateFirst, "tech_lead");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.choice).toBe(Resumption.FinishAlternateFirst);
    expect(r.audit).toContain("task-1");
    expect(r.audit).toContain("task-2");
  });

  test("the question carries BOTH work items — which was blocked and which was the detour", () => {
    const q = onBlockerCleared(assignment);
    expect(q.blockedWorkId).toBe("task-1");
    expect(q.alternateWorkId).toBe("task-2");
  });
});

describe("the doc's eleven kinds are all here", () => {
  test("eleven, and each is distinct", () => {
    const kinds = Object.values(AlternateWorkKind);
    expect(kinds).toHaveLength(11);
    expect(new Set(kinds).size).toBe(11);
  });
});
