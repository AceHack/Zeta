/**
 * handoff-brief.test.ts — losing the work is visible; losing what was TRIED is not.
 *
 * The next agent repays a missing handoff by walking down the same dead ends, and from outside that
 * looks like the work being hard rather than like the organization having forgotten something. So
 * the load-bearing test here is the three-state `attemptedPaths` field: an empty list and an
 * untracked one are opposite facts — untouched ground versus unknown ground — and a brief that
 * renders both the same way is worse than no brief, because it is read as the first.
 */

import { describe, expect, test } from "bun:test";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { buildContextPack, ContextItemKind, OmissionKind, type ContextPack } from "./context-pack";
import { buildHandoffBrief, diffHandoffContext, HandoffTrigger, type BriefInput } from "./handoff-brief";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

function packFor(hatId: string, over: Partial<Parameters<typeof buildContextPack>[1]> = {}): ContextPack {
  const r = buildContextPack(chart, {
    hatId,
    resourceAuthorityHatId: "rmo_office",
    items: [
      {
        kind: ContextItemKind.WorkItem,
        id: "task-1",
        summary: "stop the double charge",
        source: { kind: "document", ref: "cascade:task-1" },
      },
    ],
    ...over,
  });
  if (!r.ok) throw new Error(r.reason);
  return r.pack;
}

function brief(over: Partial<BriefInput> = {}) {
  return buildHandoffBrief({
    workId: "task-1",
    trigger: HandoffTrigger.Reassigned,
    lastActorHatId: "backend_implementer",
    goal: "stop charging twice on a retried payment",
    currentState: "the retry path is isolated; the fix is not written",
    pack: packFor("backend_implementer"),
    requiredNextActions: ["write the idempotency key into the retry path"],
    ...over,
  });
}

describe("ATTEMPTED PATHS IS THREE-STATE, and two of them look identical as an empty list", () => {
  test("NOTHING RECORDED is the default — a caller's silence is not evidence nothing was tried", () => {
    const r = brief();
    if (!r.ok) throw new Error(r.reason);
    expect(r.brief.attemptedPaths.kind).toBe("not_recorded");
  });

  test("NOTHING ATTEMPTED requires somebody to say attempts were tracked", () => {
    // Untouched ground. Different from unknown ground, and the next agent acts differently on each.
    const r = brief({ attemptsTracked: true });
    if (!r.ok) throw new Error(r.reason);
    expect(r.brief.attemptedPaths.kind).toBe("none_attempted");
  });

  test("recorded attempts are carried, and blank ones dropped", () => {
    const r = brief({ attemptedPaths: ["retried at the port — same duplicate", "  "] });
    if (!r.ok) throw new Error(r.reason);
    expect(r.brief.attemptedPaths).toEqual({ kind: "recorded", paths: ["retried at the port — same duplicate"] });
  });

  test("a recorded attempt beats the tracking flag — evidence outranks a claim about evidence", () => {
    const r = brief({ attemptsTracked: false, attemptedPaths: ["tried the ledger store"] });
    if (!r.ok) throw new Error(r.reason);
    expect(r.brief.attemptedPaths.kind).toBe("recorded");
  });
});

describe("WHAT THE BRIEF REFUSES", () => {
  test("A BRIEF WITH NO NEXT ACTION IS A STATUS UPDATE, and is refused as one", () => {
    // Telling the next agent what happened and not what to do makes its first act working out the
    // thing the last one already knew — the exact cost this mechanism exists to avoid.
    expect(brief({ requiredNextActions: [] }).ok).toBe(false);
    expect(brief({ requiredNextActions: ["   "] }).ok).toBe(false);
  });

  test("work with no stated goal is refused — the next agent would inherit an aim-less task", () => {
    expect(brief({ goal: "" }).ok).toBe(false);
  });

  test("a brief naming no work is refused", () => {
    expect(brief({ workId: "  " }).ok).toBe(false);
  });
});

describe("UNRESOLVED CONTRADICTIONS ARE INHERITED, not re-decided", () => {
  test("a diverged artifact in the pack becomes a contradiction in the brief", () => {
    // The handoff is the moment somebody is most tempted to just pick a head. The pack already
    // refuses to, and the brief inherits that refusal rather than settling it in passing.
    const r = brief({
      pack: packFor("backend_implementer", {
        omissions: [{ kind: OmissionKind.UnresolvedContradiction, about: "doc-1", why: "two heads" }],
      }),
    });
    if (!r.ok) throw new Error(r.reason);
    expect(r.brief.unresolvedContradictions).toEqual(["doc-1: two heads"]);
  });

  test("NOT EVERY OMISSION IS A CONTRADICTION — a denied read is a gap, not a disagreement", () => {
    // Collapsing them would tell the next agent two sources disagree when in fact one was
    // unreachable, and it would go looking for an argument that does not exist.
    const r = brief({
      pack: packFor("backend_implementer", {
        omissions: [{ kind: OmissionKind.AccessDenied, about: "budget", why: "an IC does not see finance" }],
      }),
    });
    if (!r.ok) throw new Error(r.reason);
    expect(r.brief.unresolvedContradictions).toEqual([]);
  });

  test("THE BRIEF NAMES THE PACK, not the actor — they are not always the same hat", () => {
    // A supervisor writing the handoff for a report that went silent holds its own pack. Reading
    // the actor instead would name a pack that was never used, and the handoff would not replay.
    const r = brief({ lastActorHatId: "backend_implementer", pack: packFor("tech_lead") });
    if (!r.ok) throw new Error(r.reason);
    expect(r.brief.contextPackHatId).toBe("tech_lead");
    expect(r.brief.lastActorHatId).toBe("backend_implementer");
  });
});

describe("the doc's five triggers, and its thirteen fields", () => {
  test("every trigger produces a brief", () => {
    for (const trigger of Object.values(HandoffTrigger)) {
      expect(brief({ trigger }).ok).toBe(true);
    }
    expect(Object.values(HandoffTrigger)).toHaveLength(5);
  });

  test("all thirteen fields are present", () => {
    const r = brief();
    if (!r.ok) throw new Error(r.reason);
    for (const field of [
      "currentState",
      "lastActorHatId",
      "goal",
      "whatChanged",
      "attemptedPaths",
      "openQuestions",
      "knownRisks",
      "unresolvedContradictions",
      "requiredNextActions",
      "evidenceLinks",
      "contextPackHatId",
      "sourceRefs",
      "trigger",
    ]) {
      expect(Object.keys(r.brief)).toContain(field);
    }
  });
});

describe("DIFFING THE CONTEXT — what the new holder inherits blind", () => {
  const previous = packFor("backend_implementer", {
    items: [
      { kind: ContextItemKind.WorkItem, id: "task-1", summary: "t", source: { kind: "document", ref: "a" } },
      { kind: ContextItemKind.Decision, id: "dec-1", summary: "d", source: { kind: "document", ref: "b" } },
    ],
    omissions: [{ kind: OmissionKind.MemoryUnavailable, about: "hindsight", why: "unreachable" }],
  });

  test("ITEMS THE LAST AGENT HAD AND THIS ONE DOES NOT are the blind spots", () => {
    // The new holder is a DIFFERENT HAT, so its pack is scoped differently and the difference is
    // not a defect. What it needs to know is which of those differences it inherits blind.
    const incoming = packFor("frontend_implementer", {
      items: [{ kind: ContextItemKind.WorkItem, id: "task-1", summary: "t", source: { kind: "document", ref: "a" } }],
    });
    const d = diffHandoffContext(previous, incoming);
    expect(d.lostItemIds).toEqual(["dec-1"]);
    expect(d.gainedItemIds).toEqual([]);
  });

  test("what the new holder gained is reported too", () => {
    const incoming = packFor("frontend_implementer", {
      items: [
        { kind: ContextItemKind.WorkItem, id: "task-1", summary: "t", source: { kind: "document", ref: "a" } },
        { kind: ContextItemKind.Decision, id: "dec-1", summary: "d", source: { kind: "document", ref: "b" } },
        { kind: ContextItemKind.Policy, id: "pol-1", summary: "p", source: { kind: "document", ref: "c" } },
      ],
    });
    expect(diffHandoffContext(previous, incoming).gainedItemIds).toEqual(["pol-1"]);
  });

  test("AN OMISSION BOTH HOLDERS HAVE IS INHERITED — the handoff did not fix it", () => {
    const incoming = packFor("frontend_implementer", {
      omissions: [
        { kind: OmissionKind.MemoryUnavailable, about: "hindsight", why: "still unreachable" },
        { kind: OmissionKind.AccessDenied, about: "budget", why: "new to this holder" },
      ],
    });
    const d = diffHandoffContext(previous, incoming);
    // The memory gap carries over; the access denial is the new holder's own and is not "inherited".
    expect(d.inheritedOmissions).toEqual(["memory_unavailable:hindsight"]);
  });

  test("diffs are ORDINAL even over a pack the builder did not order", () => {
    // `diffHandoffContext` takes the INTERFACE, and `buildContextPack` is not the only way to hold
    // one — the type carries no ordering guarantee, so a pack assembled by hand arrives in whatever
    // order its author used. Building the fixture through the builder hid that: it sorts, so the
    // diff looked ordinal while doing nothing, and a mutant deleting the sort survived.
    const unordered: ContextPack = {
      ...previous,
      items: [
        { kind: ContextItemKind.Policy, id: "z", summary: "z", source: { kind: "document", ref: "z" } },
        { kind: ContextItemKind.Policy, id: "a", summary: "a", source: { kind: "document", ref: "a" } },
      ],
    };
    expect(diffHandoffContext(previous, unordered).gainedItemIds).toEqual(["a", "z"]);
    expect(diffHandoffContext(unordered, previous).lostItemIds).toEqual(["a", "z"]);
  });

  test("an identical pack diffs to nothing", () => {
    const d = diffHandoffContext(previous, previous);
    expect(d.lostItemIds).toEqual([]);
    expect(d.gainedItemIds).toEqual([]);
    // ...but the omission is still inherited, because it is still there.
    expect(d.inheritedOmissions).toEqual(["memory_unavailable:hindsight"]);
  });
});
