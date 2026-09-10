/**
 * study-wiring.test.ts — the budget and the sources actually reach the proposal.
 *
 * `study-session.test.ts` proves the allowance is computed and enforced in isolation, and
 * `study-topics.test.ts` proves topics rank. Neither shows they are CONSULTED where study is
 * actually proposed, which is the reader-with-no-writer gap. These tests are about
 * `proposeSelfDirected` behaving differently when the two hooks are supplied — and behaving exactly
 * as before when they are not, so adoption is not forced on a caller that has not opted in.
 */

import { describe, expect, test } from "bun:test";
import { proposeSelfDirected, SelfDirectedKind, type IdleHat } from "./org-life";
import { DEFAULT_STUDY_BUDGET, openStudySession, remainingStudy } from "./study-session";
import { bestTopic } from "./study-topics";
import type { SourceDocument } from "./providers";
import { EMPTY_CALENDAR, type Calendar } from "./work-schedule";

const T0 = 5 * 3_600_000;
const IDLE: readonly IdleHat[] = [
  { hatId: "architect", because: "no_work_assigned" },
  { hatId: "qa_engineer", because: "no_work_assigned" },
];

function doc(path: string): SourceDocument {
  return { path, revision: "sha1", content: "c", ref: `git:sha1:${path}` };
}

describe("the budget is consulted where study is proposed", () => {
  test("with no hook, every idle hat is proposed study — the old behaviour", () => {
    const out = proposeSelfDirected({ idle: IDLE, nowMs: T0, concurrency: 2 });
    expect(out.map((p) => p.hatId).sort()).toEqual(["architect", "qa_engineer"]);
  });

  test("A HAT OUT OF ALLOWANCE IS NOT PROPOSED STUDY", () => {
    const out = proposeSelfDirected({
      idle: IDLE,
      nowMs: T0,
      concurrency: 2,
      mayStudy: (hatId) => hatId !== "architect",
    });
    expect(out.map((p) => p.hatId)).toEqual(["qa_engineer"]);
  });

  test("everyone out of allowance means nobody studies, not a fallback pick", () => {
    const out = proposeSelfDirected({ idle: IDLE, nowMs: T0, mayStudy: () => false });
    expect(out).toEqual([]);
  });

  test("CONCURRENCY SLOTS GO TO HATS THAT CAN USE THEM", () => {
    // Filtering after `limit` would spend the single slot on the hat that is out of budget and
    // propose nothing at all — busy-looking capacity that produces no study.
    const out = proposeSelfDirected({
      idle: IDLE,
      nowMs: T0,
      concurrency: 1,
      mayStudy: (hatId) => hatId !== "architect",
    });
    expect(out.map((p) => p.hatId)).toEqual(["qa_engineer"]);
  });

  test("the real budget drives the hook end to end", () => {
    // Spend the architect's whole allowance, then let `remainingStudy` answer the hook.
    let calendar: Calendar = EMPTY_CALENDAR;
    for (let i = 0; i < 2; i++) {
      const r = openStudySession({
        calendar,
        hatId: "architect",
        nowMs: T0 + i * DEFAULT_STUDY_BUDGET.maxSessionMs,
        topic: "something",
        createId: () => `s-${String(i)}`,
      });
      if (!r.ok) throw new Error(r.because);
      calendar = r.calendar;
    }
    expect(remainingStudy(calendar, "architect", T0)).toBe(0);

    const out = proposeSelfDirected({
      idle: IDLE,
      nowMs: T0,
      concurrency: 2,
      mayStudy: (hatId) => remainingStudy(calendar, hatId, T0) >= DEFAULT_STUDY_BUDGET.minSessionMs,
    });
    expect(out.map((p) => p.hatId)).toEqual(["qa_engineer"]);
  });
});

describe("the subject comes from a real document when one is supplied", () => {
  const DOCS = [doc("payments/standin.ts"), doc("receipts/render.ts")];

  test("a supplied topic replaces the built-in rotation, and carries its ref", () => {
    const out = proposeSelfDirected({
      idle: IDLE,
      nowMs: T0,
      concurrency: 2,
      cycle: 0,
      topicFor: (hatId) => {
        const t = bestTopic({ documents: DOCS, hatId });
        return t === undefined ? undefined : { subject: t.subject, sourceRef: t.sourceRef };
      },
    });
    const studied = out.filter((p) => p.kind !== SelfDirectedKind.TendMemory);
    expect(studied.length).toBeGreaterThan(0);
    for (const p of studied) {
      expect(p.sourceRef).toContain("git:sha1:");
      expect(p.subject).toContain("/");
    }
  });

  test("NO SOURCE REF WHEN THE SUBJECT IS THE ROTATION — the two must be tellable apart", () => {
    // A memory written from a named document can cite it; one written from "the part of this
    // repository this hat touches" cannot, and a reader has to be able to tell which it got.
    const out = proposeSelfDirected({ idle: IDLE, nowMs: T0, concurrency: 2 });
    for (const p of out) expect(p.sourceRef).toBeUndefined();
  });

  test("an empty source falls back rather than proposing an empty subject", () => {
    const out = proposeSelfDirected({
      idle: IDLE,
      nowMs: T0,
      concurrency: 2,
      topicFor: (hatId) => {
        const t = bestTopic({ documents: [], hatId });
        return t === undefined ? undefined : { subject: t.subject, sourceRef: t.sourceRef };
      },
    });
    for (const p of out) {
      expect(p.subject.length).toBeGreaterThan(0);
      expect(p.sourceRef).toBeUndefined();
    }
  });

  test("TENDING MEMORY IS NEVER GIVEN AN EXTERNAL SUBJECT", () => {
    // The block exists to re-examine what the hat already believes; handing it a repository to read
    // would quietly convert it into another study block.
    const out = proposeSelfDirected({
      idle: IDLE,
      nowMs: T0,
      concurrency: 2,
      cycle: 2, // rotates the first hat onto TendMemory
      topicFor: () => ({ subject: "payments/standin.ts", sourceRef: "git:sha1:payments/standin.ts" }),
    });
    const tending = out.filter((p) => p.kind === SelfDirectedKind.TendMemory);
    expect(tending.length).toBeGreaterThan(0);
    for (const p of tending) {
      expect(p.subject).toBe("its own memory");
      expect(p.sourceRef).toBeUndefined();
    }
  });

  test("proposals stay replayable with both hooks supplied", () => {
    const opts = {
      idle: IDLE,
      nowMs: T0,
      concurrency: 2,
      cycle: 1,
      topicFor: (hatId: string) => {
        const t = bestTopic({ documents: DOCS, hatId });
        return t === undefined ? undefined : { subject: t.subject, sourceRef: t.sourceRef };
      },
      mayStudy: () => true,
    };
    const a = proposeSelfDirected(opts);
    const b = proposeSelfDirected(opts);
    expect(a.map((p) => `${p.hatId}:${p.subject}`)).toEqual(b.map((p) => `${p.hatId}:${p.subject}`));
  });
});
