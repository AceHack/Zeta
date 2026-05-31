import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  DocType,
  DocLifecycleState,
  isLoadBearing,
  legalDocTransitions,
  isLegalDocTransition,
  isRetrievalEligible,
} from "../src/index.ts";

const L = DocLifecycleState;

test("load-bearing docs (handbook/policy/architecture/adr) must pass in_review; light docs may skip it", () => {
  ok(isLoadBearing(DocType.Handbook));
  ok(isLoadBearing(DocType.Policy));
  ok(isLoadBearing(DocType.Architecture));
  ok(isLoadBearing(DocType.Adr));
  ok(!isLoadBearing(DocType.MeetingNote));
  ok(!isLoadBearing(DocType.Reference));

  // a load-bearing draft cannot go straight to active — review is mandatory
  ok(!isLegalDocTransition(L.Draft, L.Active, true));
  ok(isLegalDocTransition(L.Draft, L.InReview, true));
  // a light-weight draft MAY go straight to active (the autonomy dial)
  ok(isLegalDocTransition(L.Draft, L.Active, false));
});

test("the lifecycle DU's legal transitions match the design state machine", () => {
  deepEqual([...legalDocTransitions(L.Draft, true)].sort(), [L.Archived, L.InReview].sort());
  deepEqual([...legalDocTransitions(L.InReview, true)].sort(), [L.Active, L.Archived, L.Draft].sort());
  deepEqual([...legalDocTransitions(L.Active, true)].sort(), [L.Archived, L.Stale, L.Superseded].sort());
  deepEqual([...legalDocTransitions(L.Stale, true)].sort(), [L.Active, L.Archived, L.Superseded].sort());
  // superseded is terminal-ish (only archivable); archived is terminal
  deepEqual(legalDocTransitions(L.Superseded, true), [L.Archived]);
  deepEqual(legalDocTransitions(L.Archived, true), []);
});

test("only active docs are retrieval-eligible by default", () => {
  equal(isRetrievalEligible(L.Active), true);
  for (const s of [L.Draft, L.InReview, L.Stale, L.Superseded, L.Archived]) {
    equal(isRetrievalEligible(s), false);
  }
});

test("M4 clamp property: document lifecycle transitions are total and closed", () => {
  const states = new Set<string>(Object.values(DocLifecycleState));
  for (const state of Object.values(DocLifecycleState)) {
    for (const loadBearing of [true, false]) {
      const next = legalDocTransitions(state, loadBearing);
      ok(Array.isArray(next));
      for (const target of next) {
        ok(states.has(target));
        ok(target !== state);
      }
    }
  }
  deepEqual(legalDocTransitions(L.Archived, true), []);
  deepEqual(legalDocTransitions(L.Archived, false), []);
});
