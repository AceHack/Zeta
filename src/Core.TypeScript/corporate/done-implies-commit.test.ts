/**
 * done-implies-commit.test.ts - "this work is finished" and "the repository has it" are two claims.
 *
 * -- WHAT IS PINNED HERE, AND WHAT DELIBERATELY IS NOT --------------------------
 * `doneWithNothingMerged` and the `DoneWithNothingMerged` disagreement kind exist and are exact.
 * They are NOT yet wired to the DELIVERED verdict, and that is a decision, not an omission.
 *
 * -- WHY NOT, MEASURED 2026-09-10 ---------------------------------------------
 * Wiring them was tried first and reverted. The projection describes what THIS RUN did, so on a
 * resumed run every already-merged item comes back Done with a projection sitting at `Claimed` -
 * this run opened no change for work that was finished last week. Held against DELIVERED, that
 * turns a genuine delivery into a false failure. Two runs over one repository:
 *
 *   RUN 1  delivered: true    merge commits in git: 1
 *   RUN 2  delivered: false   done_with_nothing_merged    merge commits in git: 1  <- it IS there
 *
 * The same measurement retired the evidence the rule was built on: the `newco` refusal
 * ("'task-011' is done in the cascade but the change is Claimed") came from a RESUMED run, so it
 * was never proof that nothing had been committed.
 *
 * -- WHAT WOULD MAKE IT SOUND ---------------------------------------------------
 * The question "does a commit exist for this work" has to be answered by the REPOSITORY, across
 * runs, not by one run's projection. That needs the merge commit recorded when a change lands -
 * which is the sha work, and why it comes first. Until then this file pins the vocabulary, and
 * the verdict keeps the narrower rule it already had.
 */

import { describe, expect, test } from "bun:test";
import { doneWithNothingMerged } from "./change-control";
import { DisagreementKind, partyOf, Party, reconcile } from "./reconciliation";
import { WorkState, WorkType, type Cascade, type CascadeNode } from "./goal-cascade";
import type { Projection } from "./change-control";

const node = (over: Partial<CascadeNode> = {}): CascadeNode =>
  ({
    workId: "task-1",
    parentId: "goal-1",
    title: "a task",
    type: WorkType.Task,
    state: WorkState.Done,
    ownerHatId: "backend_implementer",
    ...over,
  }) as CascadeNode;

const cascadeOf = (nodes: readonly CascadeNode[]): Cascade => ({ nodes }) as Cascade;

/** Only `state.tag` is read by the predicate; the rest of a Projection is not its business. */
const at = (tag: string): Projection => ({ state: { tag } }) as unknown as Projection;

describe("DONE WITH NOTHING MERGED IS A REAL DISAGREEMENT", () => {
  test("done in the cascade + a change short of Merged is caught", () => {
    // The measured case: the projection sat at `Claimed`.
    expect(doneWithNothingMerged(at("Claimed"), { cascade: cascadeOf([node()]), workId: "task-1" })).toBe(true);
  });

  test.each([["Opened"], ["Claimed"], ["Reviewed"], ["Abandoned"]])(
    "…and at %s too — every tag that is not Merged",
    (tag) => {
      expect(doneWithNothingMerged(at(tag), { cascade: cascadeOf([node()]), workId: "task-1" })).toBe(true);
    },
  );

  test("done + Merged is NOT a disagreement", () => {
    expect(doneWithNothingMerged(at("Merged"), { cascade: cascadeOf([node()]), workId: "task-1" })).toBe(false);
  });

  test("work still in flight is not a disagreement — it has not claimed to be finished", () => {
    // The rule must not fire mid-run on every unfinished item, or it fires on every run.
    for (const state of [WorkState.Open, WorkState.InProgress, WorkState.Canceled]) {
      expect(doneWithNothingMerged(at("Claimed"), { cascade: cascadeOf([node({ state })]), workId: "task-1" })).toBe(false);
    }
  });

  test("an item that is not in the cascade at all is not a disagreement", () => {
    // `nodeById` returns undefined, and undefined is not Done. Asserted because the alternative —
    // reading a missing node as done — would fire on every id anybody mistypes.
    expect(doneWithNothingMerged(at("Claimed"), { cascade: cascadeOf([]), workId: "ghost" })).toBe(false);
  });
});

describe("THE RECONCILIATION DESCRIBES IT ACCURATELY", () => {
  const report = (over: Parameters<typeof reconcile>[0] extends infer T ? Partial<T> : never = {}) =>
    reconcile({
      cascade: [node()],
      changesLanded: [],
      changesUnlanded: [],
      gateEvaluations: [{ workId: "task-1" }] as never,
      delivered: false,
      ...over,
    });

  test("it is reported as its own kind, not as a refused merge", () => {
    const found = report({ changesDoneUnmerged: ["task-1"] }).disagreements;
    const kinds = found.map((d) => d.kind);
    expect(kinds).toContain(DisagreementKind.DoneWithNothingMerged);
    // THE MISLABELLING THIS AVOIDS. Folding it into the existing kind would have the report say the
    // organization believed "merged" about a change it called `Claimed` — sending a reader to look
    // for a merge nobody ever projected.
    expect(kinds).not.toContain(DisagreementKind.ProjectedMergedButNotLanded);
  });

  test("and it says what each side actually claimed", () => {
    const found = report({ changesDoneUnmerged: ["task-1"] }).disagreements.find(
      (d) => d.kind === DisagreementKind.DoneWithNothingMerged,
    );
    expect(found?.organizationSays).toBe("done");
    expect(found?.realitySays).toBe("no merged change");
    expect(found?.workId).toBe("task-1");
  });

  test("the party is the repository — that is who disagrees", () => {
    expect(partyOf(DisagreementKind.DoneWithNothingMerged)).toBe(Party.Repository);
  });

  test("ABSENT is not the same as empty — an unmeasured run reports no such disagreement", () => {
    // Every existing caller omits the field. Omission must mean "not measured", never "measured and
    // clean", or adding this kind would silently declare every prior run healthy on a question
    // nobody asked.
    expect(report().disagreements.map((d) => d.kind)).not.toContain(DisagreementKind.DoneWithNothingMerged);
    expect(report({ changesDoneUnmerged: [] }).disagreements.map((d) => d.kind)).not.toContain(
      DisagreementKind.DoneWithNothingMerged,
    );
  });
});
