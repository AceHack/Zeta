/**
 * context-pack.test.ts — a thin pack and an unreachable one look identical to an agent that only
 * reads `items`.
 *
 * That is the whole reason omissions are a field. The first is an organization with little to say;
 * the second is one that could not reach most of what it holds, and an agent acting on the second
 * as if it were the first is confidently working from a quarter of the picture.
 *
 * So the load-bearing tests are: an unwired pack still carries a brief and SAYS it is degraded, and
 * `degraded` cannot be claimed away by whoever built the pack.
 */

import { describe, expect, test } from "bun:test";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import {
  buildContextPack,
  ContextItemKind,
  ContextScope,
  itemsOfKind,
  OmissionKind,
  replayableOf,
  scopeFor,
  type ContextItem,
} from "./context-pack";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

function item(over: Partial<ContextItem> = {}): ContextItem {
  return {
    kind: ContextItemKind.WorkItem,
    id: "task-1",
    summary: "stop the double charge",
    source: { kind: "document", ref: "cascade:task-1" },
    ...over,
  };
}

function pack(over: Partial<Parameters<typeof buildContextPack>[1]> = {}) {
  const r = buildContextPack(chart, {
    hatId: "backend_implementer",
    resourceAuthorityHatId: "rmo_office",
    items: [item()],
    ...over,
  });
  if (!r.ok) throw new Error(r.reason);
  return r.pack;
}

describe("A HAT NEVER WAKES TO AN EMPTY IMPLICIT CONTEXT", () => {
  test("NO BUILDER WIRED gives a DEGRADED pack, not an empty one and not an error", () => {
    // The doc's first non-negotiable. Returning an empty `items` with no omission is the silent
    // version, and an agent reading it would proceed as though the organization had nothing to say.
    const r = buildContextPack(chart, { hatId: "backend_implementer", resourceAuthorityHatId: "rmo_office" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.pack.items).toEqual([]);
    expect(r.pack.degraded).toBe(true);
    expect(r.pack.omissions.map((o) => o.kind)).toEqual([OmissionKind.NoBuilderWired]);
  });

  test("...and it STILL CARRIES THE BRIEF", () => {
    // The one thing that cannot be missing. A hat that does not know its own duty, route and
    // evidence requirements has nothing to be careful with.
    //
    // HONEST LIMIT, measured: dropping `brief === undefined` from the guard survives this suite,
    // because `scopeFor` and `buildHatCommunicationBrief` both return undefined for exactly the
    // same reason — an unknown hat — so at RUNTIME the two conditions coincide. It is caught by
    // `tsc` instead (TS2322 at the assignment), which is a real check and not this file's. Worth
    // naming because `bun test` does not typecheck: a green suite over that mutant proves nothing
    // about the code the compiler never saw.
    const r = buildContextPack(chart, { hatId: "backend_implementer", resourceAuthorityHatId: "rmo_office" });
    if (!r.ok) throw new Error("expected a pack");
    expect(r.pack.brief.hatId).toBe("backend_implementer");
    expect(r.pack.brief.supervisorHatId).toBe("tech_lead");
    expect(r.pack.brief.tools.length).toBeGreaterThan(0);
  });

  test("AN EMPTY-BUT-WIRED PACK IS NOT DEGRADED — the distinction the field exists for", () => {
    // Retrieval ran and found nothing is a different fact from retrieval never ran.
    const p = pack({ items: [] });
    expect(p.items).toEqual([]);
    expect(p.degraded).toBe(false);
    expect(p.omissions).toEqual([]);
  });

  test("only an unknown hat refuses — there is nothing to build a pack ABOUT", () => {
    const r = buildContextPack(chart, { hatId: "not_a_hat", resourceAuthorityHatId: "rmo_office" });
    expect(r.ok).toBe(false);
  });
});

describe("DEGRADED IS DERIVED, NOT DECLARED", () => {
  test("any omission degrades the pack", () => {
    const p = pack({
      omissions: [{ kind: OmissionKind.AccessDenied, about: "budget", why: "an IC does not see finance" }],
    });
    expect(p.degraded).toBe(true);
    expect(p.items).toHaveLength(1);
  });

  test("A CALLER CANNOT CLAIM A COMPLETE PACK IT DID NOT BUILD", () => {
    // `degraded` is not an input. The whole point is that an agent reading only `items` cannot tell
    // a thin organization from an unreachable one, so the answer travels with the pack and is not
    // anybody's opinion.
    const p = pack({ omissions: [{ kind: OmissionKind.MemoryUnavailable, about: "hindsight", why: "unreachable" }] });
    expect(Object.keys(p)).toContain("degraded");
    expect(p.degraded).toBe(true);
  });

  test("the doc's six omission kinds are all here", () => {
    expect(Object.values(OmissionKind)).toHaveLength(6);
  });
});

describe("SCOPE IS DERIVED FROM AUTHORITY, never chosen", () => {
  test("an IC sees the work item; a manager sees the initiative; the top sees the portfolio", () => {
    expect(scopeFor(chart, "backend_implementer")).toBe(ContextScope.WorkItem);
    expect(scopeFor(chart, "tech_lead")).toBe(ContextScope.WorkItem);
    expect(scopeFor(chart, "engineering_manager")).toBe(ContextScope.Initiative);
    expect(scopeFor(chart, "engineering_director")).toBe(ContextScope.Initiative);
    expect(scopeFor(chart, "cto")).toBe(ContextScope.Portfolio);
    expect(scopeFor(chart, "ceo")).toBe(ContextScope.Portfolio);
  });

  test("the pack carries the derived scope, and the request has no way to set it", () => {
    expect(pack().scope).toBe(ContextScope.WorkItem);
    expect(pack({ hatId: "cto" }).scope).toBe(ContextScope.Portfolio);
  });

  test("an unknown hat has no scope", () => {
    expect(scopeFor(chart, "nobody")).toBeUndefined();
  });
});

describe("REPLAYABLE IS DERIVED FROM THE POINTERS", () => {
  test("a complete pack whose every item names a source replays", () => {
    expect(replayableOf(pack())).toBe(true);
  });

  test("AN ITEM WITH A BLANK POINTER BREAKS IT — that is something the pack asserts and cannot support", () => {
    expect(replayableOf(pack({ items: [item({ source: { kind: "document", ref: "  " } })] }))).toBe(false);
  });

  test("AN OMISSION BREAKS IT TOO — replaying would produce a different pack", () => {
    // An omission is precisely a part of the world this pack could not reach. Calling a pack with
    // holes replayable would make the word mean "the items replay", which is not what a reader of
    // that field is asking.
    const p = pack({ omissions: [{ kind: OmissionKind.StaleDocument, about: "handbook", why: "9 days old" }] });
    expect(p.items.every((i) => i.source.ref.trim() !== "")).toBe(true);
    expect(replayableOf(p)).toBe(false);
  });

  test("an unwired pack is not replayable", () => {
    const r = buildContextPack(chart, { hatId: "tech_lead", resourceAuthorityHatId: "rmo_office" });
    if (!r.ok) throw new Error("expected a pack");
    expect(replayableOf(r.pack)).toBe(false);
  });
});

describe("the pack is ordered and readable", () => {
  test("ITEMS ARE ORDINAL by kind then id, so the same organization packs the same way twice", () => {
    const p = pack({
      items: [
        item({ kind: ContextItemKind.Policy, id: "p-2" }),
        item({ kind: ContextItemKind.Decision, id: "d-9" }),
        item({ kind: ContextItemKind.Decision, id: "d-1" }),
      ],
    });
    expect(p.items.map((i) => i.id)).toEqual(["d-1", "d-9", "p-2"]);
  });

  test("omissions are ordinal too", () => {
    const p = pack({
      omissions: [
        { kind: OmissionKind.StaleDocument, about: "z", why: "" },
        { kind: OmissionKind.AccessDenied, about: "b", why: "" },
        { kind: OmissionKind.AccessDenied, about: "a", why: "" },
      ],
    });
    expect(p.omissions.map((o) => o.about)).toEqual(["a", "b", "z"]);
  });

  test("items can be read back by kind", () => {
    const p = pack({ items: [item(), item({ kind: ContextItemKind.Decision, id: "d-1" })] });
    expect(itemsOfKind(p, ContextItemKind.Decision).map((i) => i.id)).toEqual(["d-1"]);
    expect(itemsOfKind(p, ContextItemKind.MemoryPointer)).toEqual([]);
  });

  test("the doc's eight item kinds are all here", () => {
    expect(Object.values(ContextItemKind)).toHaveLength(8);
  });
});
