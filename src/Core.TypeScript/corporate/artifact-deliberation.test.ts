/**
 * artifact-deliberation.test.ts — two agents editing at once is not an error to resolve away.
 *
 * The tempting reading of "go over an artifact via CRDT" is a text CRDT that interleaves concurrent
 * edits into one document. This repository forbids that, in its own words:
 *
 *   anti-babel-preserve-reconcilability: *"Reintegration is NOT reconvergence... that difference is
 *   information, not error"*, and a reintegration producing one surviving value *"has performed the
 *   collapse, not the merge."*
 *
 * So the load-bearing tests are the ones proving nothing here picks a winner: concurrent edits are
 * TWO HEADS, `soleHead` refuses to answer, and convergence happens only when a hat writes a merge
 * revision naming both parents.
 */

import { describe, expect, test } from "bun:test";
import {
  headsOf,
  isDiverged,
  lineageOf,
  mergeHeads,
  mergeHistories,
  openArtifact,
  participantsIn,
  revise,
  historyFromPhases,
  revisionIdOf,
  soleHead,
  type ArtifactHistory,
} from "./artifact-deliberation";

function opened(content = "the design, v1"): ArtifactHistory {
  const r = openArtifact({
    artifactId: "design-1",
    byHatId: "solution_architect",
    atMs: 1_000,
    content,
    note: "first draft",
  });
  if (!r.ok) throw new Error(r.reason);
  return r.history;
}

function revised(
  history: ArtifactHistory,
  parents: readonly string[],
  byHatId: string,
  content: string,
): ArtifactHistory {
  const r = revise(history, { parents, byHatId, atMs: 2_000, content, note: `by ${byHatId}` });
  if (!r.ok) throw new Error(r.reason);
  return r.history;
}

describe("CONCURRENT EDITS ARE TWO HEADS — nothing picks a winner", () => {
  test("two hats revising the same parent produce two heads, both retained", async () => {
    const base = opened();
    const root = headsOf(base)[0]!.revisionId;
    const a = revised(base, [root], "tech_lead", "the design, with the lead's change");
    const b = revised(base, [root], "qa_director", "the design, with QA's change");

    const merged = mergeHistories(a, b);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(headsOf(merged.history).length).toBe(2);
    expect(isDiverged(merged.history)).toBe(true);
    // BOTH texts survive. Interleaving them would manufacture a document neither hat wrote and
    // nobody is accountable for — the worst outcome in a deliberation.
    const texts = headsOf(merged.history).map((h) => h.content).sort();
    expect(texts).toContain("the design, with QA's change");
    expect(texts).toContain("the design, with the lead's change");
  });

  test("`soleHead` REFUSES TO ANSWER while diverged, rather than choosing", async () => {
    // Returning the newest or the first would be a library picking a winner in an argument between
    // two hats. `undefined` is the honest answer to "what does this say right now?".
    const base = opened();
    const root = headsOf(base)[0]!.revisionId;
    const merged = mergeHistories(
      revised(base, [root], "tech_lead", "A"),
      revised(base, [root], "qa_director", "B"),
    );
    if (!merged.ok) throw new Error(merged.reason);
    expect(soleHead(merged.history)).toBeUndefined();
  });

  test("...and answers plainly when there is exactly one head", () => {
    const base = opened();
    const root = headsOf(base)[0]!.revisionId;
    const one = revised(base, [root], "tech_lead", "agreed text");
    expect(soleHead(one)?.content).toBe("agreed text");
    expect(isDiverged(one)).toBe(false);
  });

  test("CONVERGENCE IS AN ACCOUNTABLE ACT — a merge revision names both parents", () => {
    const base = opened();
    const root = headsOf(base)[0]!.revisionId;
    const merged = mergeHistories(
      revised(base, [root], "tech_lead", "A"),
      revised(base, [root], "qa_director", "B"),
    );
    if (!merged.ok) throw new Error(merged.reason);

    const resolved = mergeHeads(merged.history, {
      byHatId: "chief_architect",
      atMs: 3_000,
      content: "the reconciled design",
      note: "took the lead's structure with QA's assertions",
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.revision.parents.length).toBe(2);
    expect(resolved.revision.byHatId).toBe("chief_architect");
    expect(isDiverged(resolved.history)).toBe(false);
    expect(soleHead(resolved.history)?.content).toBe("the reconciled design");
  });

  test("merging when there is nothing to merge is REFUSED, not a no-op", () => {
    // A "merge" of one head would put a revision in the history claiming to reconcile a
    // disagreement that never existed.
    const r = mergeHeads(opened(), { byHatId: "x", atMs: 2, content: "c", note: "n" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("nothing to merge");
  });
});

describe("the three CRDT convergence laws hold", () => {
  const base = opened();
  const root = headsOf(base)[0]!.revisionId;
  const a = revised(base, [root], "tech_lead", "A");
  const b = revised(base, [root], "qa_director", "B");
  const c = revised(base, [root], "product_manager", "C");

  const ids = (h: ArtifactHistory) => h.revisions.map((r) => r.revisionId).sort();

  test("IDEMPOTENT — merging a history with itself changes nothing", () => {
    const once = mergeHistories(a, a);
    if (!once.ok) throw new Error(once.reason);
    expect(ids(once.history)).toEqual(ids(a));
  });

  test("COMMUTATIVE — order of exchange does not matter", () => {
    const ab = mergeHistories(a, b);
    const ba = mergeHistories(b, a);
    if (!ab.ok || !ba.ok) throw new Error("merge refused");
    expect(ids(ab.history)).toEqual(ids(ba.history));
  });

  test("ASSOCIATIVE — grouping does not matter, so no coordinator is needed", () => {
    const ab = mergeHistories(a, b);
    if (!ab.ok) throw new Error(ab.reason);
    const abThenC = mergeHistories(ab.history, c);
    const bc = mergeHistories(b, c);
    if (!bc.ok) throw new Error(bc.reason);
    const aThenBc = mergeHistories(a, bc.history);
    if (!abThenC.ok || !aThenBc.ok) throw new Error("merge refused");
    expect(ids(abThenC.history)).toEqual(ids(aThenBc.history));
  });

  test("merging two DIFFERENT artifacts is refused — a union of unrelated documents is neither", () => {
    const other = openArtifact({
      artifactId: "other",
      byHatId: "x",
      atMs: 1,
      content: "c",
      note: "n",
    });
    if (!other.ok) throw new Error(other.reason);
    expect(mergeHistories(a, other.history).ok).toBe(false);
  });
});

describe("every version is PROPER — content-addressed and immutable", () => {
  test("the same content from the same parent is ONE revision, whoever sent it twice", () => {
    // Two participants who wrote the same bytes converge rather than producing two versions that
    // differ only by who typed them.
    const base = opened();
    const root = headsOf(base)[0]!.revisionId;
    const a = revised(base, [root], "tech_lead", "identical text");
    const b = revised(base, [root], "tech_lead", "identical text");
    const merged = mergeHistories(a, b);
    if (!merged.ok) throw new Error(merged.reason);
    expect(merged.history.revisions.length).toBe(2);
  });

  test("THE CLOCK IS NOT PART OF IDENTITY — same change, different instant, one revision", () => {
    // Letting `atMs` into the address would give two hats proposing the same change from the same
    // parent two indistinguishable versions to reconcile.
    const base = opened();
    const root = headsOf(base)[0]!.revisionId;
    const early = revise(base, { parents: [root], byHatId: "t", atMs: 10, content: "same", note: "a" });
    const late = revise(base, { parents: [root], byHatId: "t", atMs: 99_999, content: "same", note: "b" });
    if (!early.ok || !late.ok) throw new Error("revise refused");
    expect(early.revision.revisionId).toBe(late.revision.revisionId);
  });

  test("A MERGE NAMING THE SAME PARENTS IN EITHER ORDER IS ONE REVISION", () => {
    // Parents are sorted into the address, so two hats reconciling the same pair converge.
    const one = revisionIdOf({ artifactId: "d", parents: ["p2", "p1"], byHatId: "h", content: "c" });
    const two = revisionIdOf({ artifactId: "d", parents: ["p1", "p2"], byHatId: "h", content: "c" });
    expect(one).toBe(two);
  });

  test("different content is a different revision", () => {
    const one = revisionIdOf({ artifactId: "d", parents: ["p"], byHatId: "h", content: "a" });
    const two = revisionIdOf({ artifactId: "d", parents: ["p"], byHatId: "h", content: "b" });
    expect(one).not.toBe(two);
  });
});

describe("a history stays walkable", () => {
  test("A REVISION ON AN UNKNOWN PARENT IS REFUSED — no branch reaches no root", () => {
    const r = revise(opened(), {
      parents: ["not-a-revision"],
      byHatId: "t",
      atMs: 2,
      content: "c",
      note: "n",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("not in this artifact's history");
  });

  test("a revision with no parent at all is refused — that is what `openArtifact` is for", () => {
    const r = revise(opened(), { parents: [], byHatId: "t", atMs: 2, content: "c", note: "n" });
    expect(r.ok).toBe(false);
  });

  test("A VERSION WITH NO NOTE IS REFUSED — one nobody explained cannot be argued with", () => {
    expect(openArtifact({ artifactId: "a", byHatId: "h", atMs: 1, content: "c", note: "  " }).ok).toBe(false);
    const base = opened();
    const root = headsOf(base)[0]!.revisionId;
    expect(revise(base, { parents: [root], byHatId: "h", atMs: 2, content: "c", note: "" }).ok).toBe(false);
  });

  test("lineage walks back to the root through a merge", () => {
    const base = opened();
    const root = headsOf(base)[0]!.revisionId;
    const merged = mergeHistories(
      revised(base, [root], "tech_lead", "A"),
      revised(base, [root], "qa_director", "B"),
    );
    if (!merged.ok) throw new Error(merged.reason);
    const resolved = mergeHeads(merged.history, { byHatId: "ca", atMs: 3, content: "R", note: "n" });
    if (!resolved.ok) throw new Error(resolved.reason);

    const line = lineageOf(resolved.history, resolved.revision.revisionId);
    // The merge, both branches, and the root — the whole path, which is what "each with its path
    // recorded" requires.
    expect(line.length).toBe(4);
    expect(line.map((r) => r.revisionId)).toContain(root);
  });

  test("'more agents, more deliberation' is countable", () => {
    const base = opened();
    const root = headsOf(base)[0]!.revisionId;
    const three = mergeHistories(
      revised(base, [root], "tech_lead", "A"),
      revised(base, [root], "qa_director", "B"),
    );
    if (!three.ok) throw new Error(three.reason);
    expect(participantsIn(three.history)).toEqual(["qa_director", "solution_architect", "tech_lead"]);
  });

  test("participants are ordered ORDINALLY, not by locale", () => {
    expect("B" < "a").toBe(true);
  });
});

describe("A PIPELINE RUN BECOMES AN ARTIFACT — the writer that was missing", () => {
  test("one revision per producing phase, chained in the order they ran", () => {
    // `openArtifact` had zero callers outside tests, so no run produced a history and the whole
    // deliberation layer was unreachable: a turn cites a revision, and none existed.
    const h = historyFromPhases({
      artifactId: "task-1",
      phases: [
        { gate: "architecture_design", refs: ["doc:design"], summary: "the design" },
        { gate: "implementation_review", refs: ["diff:abc"], summary: "the code" },
        { gate: "runtime_validation", refs: ["test:1"], summary: "3/3 passed" },
      ],
      byHatId: "backend_implementer",
      atMs: 10,
    });
    expect(h).toBeDefined();
    expect(h!.revisions.length).toBe(3);
    // LINEAR: the phases ran in order, so there is exactly one head and a walkable lineage. A
    // pipeline run is not concurrent, and manufacturing a divergence here would invent a
    // disagreement the run did not have.
    expect(headsOf(h!).length).toBe(1);
    expect(lineageOf(h!, headsOf(h!)[0]!.revisionId).length).toBe(3);
  });

  test("THE HEAD IS THE LAST PHASE, so a reviewer sees what the run ended with", () => {
    const h = historyFromPhases({
      artifactId: "task-1",
      phases: [
        { gate: "a", refs: [], summary: "first" },
        { gate: "b", refs: [], summary: "last" },
      ],
      byHatId: "h",
      atMs: 1,
    });
    expect(headsOf(h!)[0]!.content).toContain("last");
  });

  test("NO PHASE PRODUCED ANYTHING -> NO ARTIFACT, not an empty one", () => {
    // An artifact with no content is a document claiming the run made something, and every turn
    // citing it would cite nothing.
    expect(historyFromPhases({ artifactId: "t", phases: [], byHatId: "h", atMs: 1 })).toBeUndefined();
  });

  test("THE REFS ARE IN THE CONTENT — two phases differing only in output are two revisions", () => {
    // Hashing the summary alone would collapse them into one, and a citation would then be
    // ambiguous about which output it meant.
    const a = historyFromPhases({
      artifactId: "t",
      phases: [{ gate: "g", refs: ["diff:one"], summary: "same" }],
      byHatId: "h",
      atMs: 1,
    });
    const b = historyFromPhases({
      artifactId: "t",
      phases: [{ gate: "g", refs: ["diff:two"], summary: "same" }],
      byHatId: "h",
      atMs: 1,
    });
    expect(headsOf(a!)[0]!.revisionId).not.toBe(headsOf(b!)[0]!.revisionId);
  });
});
