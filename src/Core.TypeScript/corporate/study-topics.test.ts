/**
 * study-topics.test.ts — falsifiers for study reading something real, aimed where it is needed.
 *
 * Two properties carry the module. A topic must NAME A DOCUMENT, so a session cannot be spent on a
 * description of a subject the way `subjectFor`'s fallback allowed. And the ranking must actually
 * discriminate — a ranker that returns everything in source order would pass any test that only
 * checks a list came back, and would waste the budget the sessions module just imposed.
 */

import { describe, expect, test } from "bun:test";
import type { GateStep } from "./gate-demand";
import { WorkType } from "./goal-cascade";
import type { SourceDocument } from "./providers";
import { GateKind } from "./quality-gate";
import { bestTopic, memoryKeyFor, topicKeyOf, topicsFor, TOPIC_WEIGHTS } from "./study-topics";

function doc(path: string, content = "some content"): SourceDocument {
  return { path, revision: "abc123", content, ref: `git:abc123:${path}` };
}

function reworkStep(over: Partial<GateStep> = {}): GateStep {
  return {
    workId: "T-1",
    workType: WorkType.Task,
    gate: GateKind.QaUat,
    title: "a task",
    ownerHatId: "owner",
    attempt: 2,
    rework: true,
    why: "sent back",
    ...over,
  };
}

const DOCS = [
  doc("payments/standin.ts"),
  doc("payments/relay.ts"),
  doc("receipts/ftl-render.ts"),
  doc("docs/onboarding.md"),
];

describe("a topic names a real document", () => {
  test("every topic carries a citable ref and a path", () => {
    for (const t of topicsFor({ documents: DOCS, hatId: "architect" })) {
      expect(t.sourceRef).toContain("git:abc123:");
      expect(t.path.length).toBeGreaterThan(0);
      expect(t.subject.length).toBeGreaterThan(0);
    }
  });

  test("NO DOCUMENTS MEANS NO TOPICS — never a placeholder subject", () => {
    // The `subjectFor` failure, stated as a property: an org whose sources are empty has nothing to
    // study, and must not be handed a string to study instead.
    expect(topicsFor({ documents: [], hatId: "architect" })).toEqual([]);
    expect(bestTopic({ documents: [], hatId: "architect" })).toBeUndefined();
  });

  test("a document with no usable name is skipped rather than named badly", () => {
    expect(topicsFor({ documents: [doc("")], hatId: "architect" })).toEqual([]);
  });

  test("every topic explains itself", () => {
    for (const t of topicsFor({ documents: DOCS, hatId: "architect" })) {
      expect(t.because.length).toBeGreaterThan(10);
    }
  });
});

describe("the ranking discriminates — it does not just return the list", () => {
  test("REWORK OUTRANKS EVERYTHING, because it is evidence rather than presumption", () => {
    const top = bestTopic({
      documents: DOCS,
      hatId: "architect",
      rework: [reworkStep({ title: "standin authorisation is wrong", workId: "ELERA-149570" })],
    });
    expect(top?.path).toBe("payments/standin.ts");
    expect(top?.because).toContain("rework");
  });

  test("more rework on the same area outranks less", () => {
    const ranked = topicsFor({
      documents: DOCS,
      hatId: "architect",
      rework: [
        reworkStep({ title: "standin fails", workId: "A" }),
        reworkStep({ title: "standin fails again", workId: "B" }),
        reworkStep({ title: "relay timing", workId: "C" }),
      ],
    });
    expect(ranked[0]?.path).toBe("payments/standin.ts");
    const standin = ranked.find((t) => t.path === "payments/standin.ts");
    const relay = ranked.find((t) => t.path === "payments/relay.ts");
    expect((standin?.weight ?? 0) > (relay?.weight ?? 0)).toBe(true);
  });

  test("relevance to the hat's domain lifts a document", () => {
    const ranked = topicsFor({ documents: DOCS, hatId: "architect", domain: "payments" });
    expect(ranked[0]?.path.startsWith("payments/")).toBe(true);
    expect(ranked[0]?.because).toContain("payments");
  });

  test("a document already in memory ranks below an unknown one, all else equal", () => {
    const ranked = topicsFor({
      documents: [doc("a/known.ts"), doc("b/unknown.ts")],
      hatId: "architect",
      known: new Set(["known"]),
    });
    expect(ranked[0]?.path).toBe("b/unknown.ts");
  });

  test("A KNOWN DOCUMENT WITH REWORK STILL BEATS AN UNKNOWN ONE WITHOUT", () => {
    // Novelty is a subtraction, not a filter. Evidence of a gap outweighs the presumption of one,
    // and filtering known documents out would make the org unable to re-learn what it recorded
    // wrongly the first time.
    const ranked = topicsFor({
      documents: [doc("a/standin.ts"), doc("b/fresh.ts")],
      hatId: "architect",
      known: new Set(["standin"]),
      rework: [reworkStep({ title: "standin is wrong" })],
    });
    expect(ranked[0]?.path).toBe("a/standin.ts");
  });

  test("a document with no signal at all is dropped, not ranked zero", () => {
    // Known, out of domain, no rework: there is no reason to spend an hour on it, and offering it
    // with weight zero would let a caller taking `[0]` book exactly that.
    const ranked = topicsFor({
      documents: [doc("far/away.ts")],
      hatId: "architect",
      domain: "payments",
      known: new Set(["away"]),
    });
    expect(ranked).toEqual([]);
  });

  test("the weights are the ones published", () => {
    const onlyNovel = topicsFor({ documents: [doc("x/thing.ts")], hatId: "h" });
    expect(onlyNovel[0]?.weight).toBe(TOPIC_WEIGHTS.novelty);

    const novelAndRelevant = topicsFor({
      documents: [doc("payments/thing.ts")],
      hatId: "h",
      domain: "payments",
    });
    expect(novelAndRelevant[0]?.weight).toBe(TOPIC_WEIGHTS.novelty + TOPIC_WEIGHTS.relevance);
  });
});

describe("the plan is replayable and bounded", () => {
  test("the same sources rank the same way twice", () => {
    const once = topicsFor({ documents: DOCS, hatId: "architect", domain: "payments" });
    const twice = topicsFor({ documents: DOCS, hatId: "architect", domain: "payments" });
    expect(once.map((t) => t.path)).toEqual(twice.map((t) => t.path));
  });

  test("ties are broken by path, not by source order", () => {
    const ranked = topicsFor({ documents: [doc("z/one.ts"), doc("a/two.ts")], hatId: "h" });
    expect(ranked.map((t) => t.path)).toEqual(["a/two.ts", "z/one.ts"]);
  });

  test("the limit is honoured", () => {
    expect(topicsFor({ documents: DOCS, hatId: "h", limit: 2 })).toHaveLength(2);
  });

  test("ordering is strictly descending by weight", () => {
    const ranked = topicsFor({
      documents: DOCS,
      hatId: "architect",
      domain: "payments",
      rework: [reworkStep({ title: "relay" })],
    });
    const weights = ranked.map((t) => t.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });
});

describe("topic keys and memory keys", () => {
  test("the key is the filename without its extension", () => {
    expect(topicKeyOf("payments/standin.ts")).toBe("standin");
    expect(topicKeyOf("a/b/c/Thing.MD")).toBe("thing");
    expect(topicKeyOf("noslash.md")).toBe("noslash");
    expect(topicKeyOf("windows\\path\\file.ts")).toBe("file");
  });

  test("a dotfile keeps its name rather than becoming empty", () => {
    expect(topicKeyOf(".gitignore")).toBe(".gitignore");
  });

  test("STUDYING THE SAME DOCUMENT TWICE REINFORCES ONE MEMORY", () => {
    // Otherwise the org fills with near-duplicates of its own reading notes.
    const a = topicsFor({ documents: [doc("payments/standin.ts")], hatId: "h" })[0];
    const b = topicsFor({ documents: [doc("payments/standin.ts", "changed")], hatId: "h" })[0];
    if (a === undefined || b === undefined) throw new Error("no topic");
    expect(memoryKeyFor(a)).toBe(memoryKeyFor(b));
    expect(memoryKeyFor(a)).toBe("study:standin");
  });

  test("different documents get different memory keys", () => {
    const ranked = topicsFor({ documents: [doc("a/one.ts"), doc("b/two.ts")], hatId: "h" });
    const keys = ranked.map(memoryKeyFor);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
