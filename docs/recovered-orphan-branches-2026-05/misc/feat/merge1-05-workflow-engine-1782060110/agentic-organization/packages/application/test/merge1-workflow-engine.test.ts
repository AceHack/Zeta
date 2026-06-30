import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  acknowledgeFeedback,
  authorOutput,
  ownershipFromInput,
  type FourCornerOwnership,
} from "../src/four-corner-ownership.ts";
import {
  determineReviewLevel,
  SEED_ACTION_CATALOG,
  SEED_STATES,
  validateCatalog,
  validateStateOtto5Mods,
  type Action,
  type Tick,
  type WorkflowState,
} from "../src/workflow-engine-types.ts";
import {
  createMockChangeControl,
  EMPTY_WORLD,
  lookupLifetimePair,
  registerLifetimePair,
  type StandardVerdict,
} from "../src/workflow-world.ts";
import { conservativeSkill, DEFAULT_INITIAL_RATING, rate1v1 } from "../src/trueskill.ts";
import { clusterByCanonical, clusterBySimilarity, defaultTokenize, jaccardSimilarity, roomProximity } from "../src/proximity.ts";

// --- §6.1 Otto's 5 Mods validation -----------------------------------------

test("state without escape-hatch fails Mod 1", () => {
  const state: WorkflowState = {
    id: "s1",
    label: "State 1",
    description: "",
    tickCyclePattern: "observe-simulate-choose-emit",
    availableActions: ["a1"],
    composesWith: [],
  };
  const actions: Action[] = [
    { id: "a1", class: "transition", gate: "append-only", label: "A1", description: "", composesWith: [], feedbackVariants: [] },
  ];
  const result = validateStateOtto5Mods(state, actions);
  equal(result.outcome, "feedback");
});

test("state with an escape-hatch satisfies Mod 1", () => {
  const result = validateStateOtto5Mods(SEED_STATES[0]!, SEED_ACTION_CATALOG);
  equal(result.outcome, "ok");
});

test("catalog without grammar-extension fails Mod 2", () => {
  const noGrammar = SEED_ACTION_CATALOG.filter((a) => a.class !== "grammar-extension");
  const result = validateCatalog(noGrammar, []);
  equal(result.outcome, "feedback");
});

test("seed catalog + seed states validate fully", () => {
  const result = validateCatalog(SEED_ACTION_CATALOG, SEED_STATES);
  equal(result.outcome, "ok");
});

test("catalog with a duplicate action id fails", () => {
  const dup = [...SEED_ACTION_CATALOG, SEED_ACTION_CATALOG[0]!];
  const result = validateCatalog(dup, []);
  equal(result.outcome, "feedback");
});

test("state referencing an unknown action fails", () => {
  const state: WorkflowState = {
    id: "s-bad",
    label: "Bad",
    description: "",
    tickCyclePattern: "observe-simulate-choose-emit",
    availableActions: ["does-not-exist"],
    composesWith: [],
  };
  const result = validateCatalog(SEED_ACTION_CATALOG, [state]);
  equal(result.outcome, "feedback");
});

// --- review-level discriminator --------------------------------------------

test("determineReviewLevel maps each class to its required treatment", () => {
  const find = (id: string): Action => SEED_ACTION_CATALOG.find((a) => a.id === id)!;
  equal(determineReviewLevel(find("advance")), "trajectory-push");
  equal(determineReviewLevel(find("escape-hatch")), "pr-review-light");
  equal(determineReviewLevel(find("grammar-extend")), "pr-review-full");
  equal(determineReviewLevel(find("menu-contribute")), "trajectory-push");
});

test("operator-decision class always requires operator authorization", () => {
  const op: Action = {
    id: "op", class: "operator-decision", gate: "append-only", label: "op", description: "", composesWith: [], feedbackVariants: [],
  };
  equal(determineReviewLevel(op), "operator-required");
});

// --- §6.2 FourCornerOwnership round-trip ------------------------------------

test("FourCornerOwnership preserves all four corners", () => {
  const ownership: FourCornerOwnership<string, number, string, string> = {
    tIn: "input",
    tOut: 42,
    tOutFeedback: "success",
    tInFeedback: "ack",
  };
  equal(ownership.tIn, "input");
  equal(ownership.tOut, 42);
  equal(ownership.tOutFeedback, "success");
  equal(ownership.tInFeedback, "ack");
});

test("ownership builders fill corners immutably", () => {
  const initial = ownershipFromInput<string, number, string, string>("in");
  equal(initial.tOut, undefined);
  const produced = authorOutput(initial, 7, "ok");
  // original is untouched (retraction-native)
  equal(initial.tOut, undefined);
  equal(produced.tOut, 7);
  equal(produced.tOutFeedback, "ok");
  const acked = acknowledgeFeedback(produced, "got-it");
  equal(acked.tInFeedback, "got-it");
  equal(produced.tInFeedback, undefined);
});

// --- §6.3 World immutability ------------------------------------------------

test("registerLifetimePair returns a new world (immutable)", () => {
  const world1 = EMPTY_WORLD;
  const world2 = registerLifetimePair(world1, "pair-a", new Map<string, StandardVerdict>());
  ok(world1 !== world2);
  equal(world1.registry.size, 0);
  equal(world2.registry.size, 1);
});

test("lookupLifetimePair finds a registered matrix and misses unknown pairs", () => {
  const matrix = new Map<string, StandardVerdict>([["k", { kind: "advance" }]]);
  const world = registerLifetimePair(EMPTY_WORLD, "pair-b", matrix);
  const found = lookupLifetimePair<StandardVerdict>(world, "pair-b");
  ok(found !== undefined);
  equal(found!.get("k")!.kind, "advance");
  equal(lookupLifetimePair<StandardVerdict>(world, "missing"), undefined);
});

test("mock change control is deterministic and Result-shaped", async () => {
  const ccA = createMockChangeControl();
  const ccB = createMockChangeControl();
  const a = await ccA.commit([{ path: "x.ts", contents: "1" }]);
  const b = await ccB.commit([{ path: "x.ts", contents: "1" }]);
  ok(a.ok && b.ok);
  equal(a.value.commit, b.value.commit); // same seed sequence → same hash
  const pr = await ccA.openPR(a.value.commit, "t", "body");
  ok(pr.ok);
  const merged = await ccA.mergePR(pr.value.prNumber);
  ok(merged.ok && merged.value.merged);
});

// --- §6.4 TrueSkill update --------------------------------------------------

test("TrueSkill rate1v1 increases winner mu and decreases loser mu", () => {
  const result = rate1v1(DEFAULT_INITIAL_RATING, DEFAULT_INITIAL_RATING, { kind: "win-A" });
  ok(result.ok);
  ok(result.ratingA.mu > DEFAULT_INITIAL_RATING.mu);
  ok(result.ratingB.mu < DEFAULT_INITIAL_RATING.mu);
});

test("TrueSkill reduces uncertainty (sigma) after an informative match", () => {
  const result = rate1v1(DEFAULT_INITIAL_RATING, DEFAULT_INITIAL_RATING, { kind: "win-A" });
  ok(result.ok);
  ok(result.ratingA.sigma < DEFAULT_INITIAL_RATING.sigma);
});

test("TrueSkill is deterministic (same inputs → identical ratings)", () => {
  const r1 = rate1v1(DEFAULT_INITIAL_RATING, DEFAULT_INITIAL_RATING, { kind: "win-A" });
  const r2 = rate1v1(DEFAULT_INITIAL_RATING, DEFAULT_INITIAL_RATING, { kind: "win-A" });
  ok(r1.ok && r2.ok);
  equal(r1.ratingA.mu, r2.ratingA.mu);
  equal(r1.ratingA.sigma, r2.ratingA.sigma);
});

test("TrueSkill rejects an invalid rating with feedback", () => {
  const result = rate1v1({ mu: 25, sigma: 0 }, DEFAULT_INITIAL_RATING, { kind: "win-A" });
  ok(!result.ok);
  equal(result.feedback.kind, "InvalidRating");
});

test("conservativeSkill is mu - 3*sigma", () => {
  equal(conservativeSkill({ mu: 25, sigma: 5 }), 10);
});

// --- §6.5 Proximity ---------------------------------------------------------

test("clusterByCanonical groups items with identical canonical form", () => {
  const corpus = ["Foo Bar", "foo bar", "baz"];
  const result = clusterByCanonical(corpus, (s) => s.toLowerCase());
  ok(result.ok);
  equal(result.uniqueCount, 2);
});

test("clusterByCanonical on an empty corpus returns feedback", () => {
  const result = clusterByCanonical<string>([], (s) => s);
  ok(!result.ok);
  equal(result.feedback.kind, "EmptyCorpus");
});

test("jaccardSimilarity scores overlap in [0,1]", () => {
  equal(jaccardSimilarity(new Set(["a", "b"]), new Set(["a", "b"])), 1);
  equal(jaccardSimilarity(new Set(["a"]), new Set(["b"])), 0);
});

test("clusterBySimilarity rejects an out-of-range threshold", () => {
  const result = clusterBySimilarity({ corpus: ["a"], extractTokens: defaultTokenize, threshold: 2 });
  ok(!result.ok);
  equal(result.feedback.kind, "InvalidThreshold");
});

test("roomProximity is 1.0 for a room with itself and symmetric otherwise", () => {
  const a = { roomId: "r-a", hatIds: ["h1", "h2"], relationEdges: ["r-b"] };
  const b = { roomId: "r-b", hatIds: ["h2", "h3"] };
  equal(roomProximity(a, a), 1.0);
  equal(roomProximity(a, b), roomProximity(b, a));
  ok(roomProximity(a, b) > 0);
});

// --- §6.6 Tick cycle DST replay --------------------------------------------

test("Tick with a frozen timestamp replays identically (DST)", () => {
  const state = SEED_STATES[0]!;
  const makeTick = (): Tick<string, number, string, string> => ({
    state,
    ownership: ownershipFromInput<string, number, string, string>("input"),
    chosenAction: SEED_ACTION_CATALOG[0]!,
    timestamp: "1970-01-01T00:00:00.000Z",
  });
  const t1 = makeTick();
  const t2 = makeTick();
  equal(JSON.stringify(t1), JSON.stringify(t2));
});
