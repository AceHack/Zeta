/**
 * work-stealing.test.ts — the word in the doc's sentence is CONTROLLED.
 *
 * Reassignment that always succeeds is not a feature, it is the chaos the section is named against.
 * So the load-bearing tests here are the refusals: a steal with no condition behind it, a decider
 * with no standing over the condition it cites, and a transfer that would drop partial work or
 * strand a live session.
 *
 * The mutant this file is really written against is the one that makes `evaluateSteal` believe its
 * caller — because a check that accepts a declared justification is a check that cannot fail.
 */

import { describe, expect, test } from "bun:test";
import { BlockerKind } from "./blocker-taxonomy";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import {
  decidersFor,
  evaluateSteal,
  type OwnedWork,
  StealRefusal,
  StealTrigger,
  triggersFor,
} from "./work-stealing";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const NOW = 1_000_000;
const SLA = 60_000;

/** Owned, healthy, movable, with nothing to lose. Every test perturbs one thing. */
function work(over: Partial<OwnedWork> = {}): OwnedWork {
  return {
    workId: "task-1",
    ownerHatId: "backend_implementer",
    heartbeatAtMs: NOW,
    tokenExpiresMs: NOW + 3_600_000,
    tokenRefreshFailed: false,
    transferable: true,
    ...over,
  };
}

function steal(over: Partial<OwnedWork>, toHatId = "frontend_implementer", decidedByHatId = "tech_lead") {
  return evaluateSteal(chart, { work: work(over), toHatId, decidedByHatId, nowMs: NOW, silenceSlaMs: SLA });
}

describe("THE TRIGGER IS DERIVED — a caller cannot assert its way to a steal", () => {
  test("HEALTHY WORK IS NOT STEALABLE, however senior the decider", () => {
    // The whole module in one assertion. If this passes, "controlled" is decoration.
    const r = steal({}, "frontend_implementer", "ceo");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(StealRefusal.NoTrigger);
  });

  test("silence is measured against the SLA, not asserted", () => {
    expect(triggersFor(work({ heartbeatAtMs: NOW - SLA + 1 }), NOW, SLA)).toEqual([]);
    expect(triggersFor(work({ heartbeatAtMs: NOW - SLA }), NOW, SLA)).toEqual([StealTrigger.OwnerSilentPastSla]);
  });

  test("AN EXPIRED TOKEN ALONE IS NOT A TRIGGER — the refresh must have been TRIED and failed", () => {
    // A token that merely lapsed is a refresh nobody has run yet. Stealing on it would punish the
    // owner for the organization's own missing step, and the doc says "refresh failed" for exactly
    // that reason.
    expect(triggersFor(work({ tokenExpiresMs: NOW - 1, tokenRefreshFailed: false }), NOW, SLA)).toEqual([]);
    expect(triggersFor(work({ tokenExpiresMs: NOW - 1, tokenRefreshFailed: true }), NOW, SLA)).toEqual([
      StealTrigger.AssignmentTokenExpired,
    ]);
  });

  test("...and a FAILED REFRESH ALONE is not one either, while the token is still valid", () => {
    expect(triggersFor(work({ tokenRefreshFailed: true }), NOW, SLA)).toEqual([]);
  });

  test("every condition the doc lists can fire, and several can hold at once", () => {
    const all = triggersFor(
      work({
        heartbeatAtMs: NOW - SLA,
        tokenExpiresMs: NOW - 1,
        tokenRefreshFailed: true,
        higherPriorityWaitingOnSupply: true,
        blockerKind: BlockerKind.SecurityBlocked,
        queueSloViolated: true,
        incidentPreemption: true,
      }),
      NOW,
      SLA,
    );
    expect(all).toHaveLength(6);
    expect(new Set(all).size).toBe(6);
  });
});

describe("AUTHORITY COMES FROM THE TRIGGER", () => {
  test("a silent owner is its supervisor's call, at any depth of the chain", () => {
    const ids = decidersFor(chart, work(), StealTrigger.OwnerSilentPastSla).map((h) => h.id);
    expect(ids).toContain("tech_lead");
    expect(ids).toContain("engineering_manager");
    expect(ids).toContain("ceo");
  });

  test("A PEER MAY NOT TAKE A PEER'S WORK, however idle it is", () => {
    const r = steal({ heartbeatAtMs: NOW - SLA }, "frontend_implementer", "frontend_implementer");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(StealRefusal.DeciderLacksAuthority);
  });

  test("A SENIOR HAT IN ANOTHER LINE HAS NO STANDING — seniority is not authority", () => {
    // `qa_director` outranks a tech lead and supervises nothing on this work.
    const r = steal({ heartbeatAtMs: NOW - SLA }, "frontend_implementer", "qa_director");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(StealRefusal.DeciderLacksAuthority);
  });

  test("scarce supply is the RMO's, and the supervisor has no standing over THAT trigger", () => {
    expect(decidersFor(chart, work(), StealTrigger.ScarceSupplyHigherPriority).map((h) => h.id)).toContain("rmo_office");
    const r = steal({ higherPriorityWaitingOnSupply: true }, "frontend_implementer", "tech_lead");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(StealRefusal.DeciderLacksAuthority);
    expect(steal({ higherPriorityWaitingOnSupply: true }, "frontend_implementer", "rmo_office").ok).toBe(true);
  });

  test("a blocker's steal is decided by THAT blocker's owners, read off the work item", () => {
    const blocked = work({ blockerKind: BlockerKind.SecurityBlocked });
    expect(decidersFor(chart, blocked, StealTrigger.BlockerResolvableByOther).map((h) => h.id)).toEqual([
      "security_engineer",
      "security_director",
    ]);
    expect(evaluateSteal(chart, {
      work: blocked,
      toHatId: "frontend_implementer",
      decidedByHatId: "security_engineer",
      nowMs: NOW,
      silenceSlaMs: SLA,
    }).ok).toBe(true);
  });

  test("ONE TRIGGER IS ENOUGH — a supervisor's silence call survives an unrelated incident", () => {
    const r = steal({ heartbeatAtMs: NOW - SLA, incidentPreemption: true }, "frontend_implementer", "tech_lead");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    // ...and the audit records ONLY what this decider had standing over. Listing the incident would
    // put a justification in the log that this decision did not rest on.
    expect(r.transfer.triggers).toEqual([StealTrigger.OwnerSilentPastSla]);
    expect(r.transfer.audit).not.toContain(StealTrigger.IncidentPreemption);
  });
});

describe("A TRANSFER MAY NOT DESTROY WHAT IT MOVES", () => {
  test("PARTIAL WORK WITH NO PRESERVATION RECORD REFUSES", () => {
    const r = steal({ heartbeatAtMs: NOW - SLA, artifacts: ["draft.md"] });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(StealRefusal.ArtifactsUnpreserved);
  });

  test("...and passes once it is preserved, carrying WHERE in the transfer", () => {
    const r = steal({ heartbeatAtMs: NOW - SLA, artifacts: ["draft.md"], artifactsPreservedAt: "refs/preserve/task-1" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.transfer.artifactsPreservedAt).toBe("refs/preserve/task-1");
  });

  test("A LIVE UNRECONCILED RUN REFUSES — two agents on one session is worse than a stall", () => {
    const r = steal({ heartbeatAtMs: NOW - SLA, activeRunId: "run-7" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(StealRefusal.RunUnreconciled);
    expect(steal({ heartbeatAtMs: NOW - SLA, activeRunId: "run-7", runReconciled: true }).ok).toBe(true);
  });

  test("UNSTATED TRANSFERABILITY IS A REFUSAL, not a permission", () => {
    // An item nobody decided about is moved on silence otherwise — the permissive reading of an
    // unknown, which is how a default-deny becomes a default-allow without anyone editing it.
    const silent: OwnedWork = {
      workId: "task-1",
      ownerHatId: "backend_implementer",
      heartbeatAtMs: NOW - SLA,
      tokenExpiresMs: NOW + 3_600_000,
      tokenRefreshFailed: false,
    };
    const r = evaluateSteal(chart, {
      work: silent,
      toHatId: "frontend_implementer",
      decidedByHatId: "tech_lead",
      nowMs: NOW,
      silenceSlaMs: SLA,
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(StealRefusal.NotTransferable);
  });

  test("work already at the target is not moved", () => {
    const r = steal({ heartbeatAtMs: NOW - SLA }, "backend_implementer", "tech_lead");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(StealRefusal.SameOwner);
  });

  test("A MANAGER MAY NOT BE HANDED THE WORK — reassignment does not bypass who executes", () => {
    const r = steal({ heartbeatAtMs: NOW - SLA }, "engineering_manager", "tech_lead");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(StealRefusal.TargetCannotImplement);
  });

  test("an unknown hat on either side refuses", () => {
    expect(steal({ heartbeatAtMs: NOW - SLA }, "nobody").ok).toBe(false);
    expect(steal({ heartbeatAtMs: NOW - SLA }, "frontend_implementer", "nobody").ok).toBe(false);
  });
});

describe("what a granted transfer OWES, as data rather than as a caller's memory", () => {
  test("the notice to the previous owner is a FIELD, not an option", () => {
    const r = steal({ heartbeatAtMs: NOW - SLA });
    if (!r.ok) throw new Error("expected a transfer");
    expect(r.transfer.notice).toContain("task-1");
    expect(r.transfer.notice).toContain("frontend_implementer");
    expect(r.transfer.notice).toContain("tech_lead");
  });

  test("DEPENDENT QUEUES ARE NAMED, and ordinally so two machines agree", () => {
    const r = steal({ heartbeatAtMs: NOW - SLA, dependents: ["task-9", "task-2", "task-5"] });
    if (!r.ok) throw new Error("expected a transfer");
    expect(r.transfer.dependentsToUpdate).toEqual(["task-2", "task-5", "task-9"]);
  });

  test("the audit names who, what, from, to, when and why", () => {
    const r = steal({ heartbeatAtMs: NOW - SLA });
    if (!r.ok) throw new Error("expected a transfer");
    for (const part of ["tech_lead", "task-1", "backend_implementer", "frontend_implementer", String(NOW), StealTrigger.OwnerSilentPastSla]) {
      expect(r.transfer.audit).toContain(part);
    }
  });

  test("no artifact key at all when there was nothing partial to preserve", () => {
    const r = steal({ heartbeatAtMs: NOW - SLA });
    if (!r.ok) throw new Error("expected a transfer");
    expect(r.transfer.artifactsPreservedAt).toBeUndefined();
  });
});
