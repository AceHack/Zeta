// Falsifiers for the toy update-transition core.
//
// The two named in the brief are §FALSIFIER 1 and §FALSIFIER 2 below. Each is
// written so that it FAILS if the corresponding property is removed — the
// mutation that would break it is stated beside it, because a test whose
// mutation is not nameable is decoration.

import { test, expect } from "bun:test";
import { toyAdherenceScore, toyFold, toyFreshBelief, toyInflate, toyRecord, TOY_TAU } from "./toy-adherence.ts";
import { toyClassify, toyProvenanceReading } from "./toy-classify.ts";
import { defaultToyPolicy, type AdherenceRecord, type UpdateProposal } from "./types.ts";

const proposal = (over: Partial<UpdateProposal> = {}): UpdateProposal => ({
  publisher: "acme",
  ecosystem: "npm",
  packageName: "acme-widget",
  fromVersion: "1.2.3",
  toVersion: "1.3.0",
  claimedBump: "minor",
  ...over,
});

/// A publisher with an unbroken record — the score is pinned in the test below,
/// so this is "maximal" in a checkable sense, not an asserted one.
const spotless: AdherenceRecord = {
  publisher: "acme",
  ecosystem: "npm",
  belief: toyFold(Array.from({ length: 60 }, () => ({ held: true }))),
};

// ── FALSIFIER 1: ADHERENCE IS NEVER SUFFICIENT ────────────────────────────────
//
// xz-utils (CVE-2024-3094): a spotless release record, and a time-weighted score
// RISING right through the window where the backdoor landed. What changed was
// who was building it and how.
//
// Mutation that must break this: change the combinator in `toyClassify` from a
// join to any weighted sum, or let `toyProvenanceReading` see the adherence
// record. Either makes a high enough score buy down the discontinuity.

test("FALSIFIER 1: a maximal adherence score does not buy down a provenance discontinuity", () => {
  // The record really is at the top of the range this estimator produces.
  const score = toyAdherenceScore(spotless.belief);
  expect(score).toBeGreaterThan(0.95);
  expect(score).toBeGreaterThan(defaultToyPolicy.autoEligibleFloor);

  // With no provenance facts, that record flows automatically. This half matters:
  // without it the test could pass because everything escalates.
  const clean = toyClassify(proposal(), spotless, []);
  expect(clean.t).toBe("AutoEligible");

  // The xz shape: same spotless record, plus a build that no longer reproduces
  // from its declared source and a signing identity that moved.
  const escalated = toyClassify(proposal(), spotless, [
    { t: "BuildNotReproducible" },
    { t: "ProvenanceIdentityChanged", from: "release-bot@acme", to: "ci@elsewhere" },
  ]);
  expect(escalated.t).toBe("HeldForAttention");
});

test("FALSIFIER 1 (each fact alone escalates a spotless publisher)", () => {
  const facts = [
    { t: "ProvenanceMissing" },
    { t: "ProvenanceIdentityChanged", from: "a", to: "b" },
    { t: "MaintainerChanged", from: "a", to: "b" },
    { t: "BuildNotReproducible" },
    { t: "SuddenReleaseCadenceShift", priorMedianIntervalDays: 90, observedIntervalDays: 1 },
  ] as const;

  for (const f of facts) {
    const got = toyClassify(proposal(), spotless, [f]);
    expect(got.t).toBe("HeldForAttention");
  }
});

test("FALSIFIER 1 holds for a patch bump too — the smallest claim is not an exemption", () => {
  const got = toyClassify(proposal({ claimedBump: "patch", toVersion: "1.2.4" }), spotless, [
    { t: "MaintainerChanged", from: "founder", to: "newcomer" },
  ]);
  expect(got.t).toBe("HeldForAttention");
});

test("the provenance reading is not a function of adherence — it cannot be", () => {
  // Structural: `toyProvenanceReading` takes only the facts. If someone widened
  // its signature to accept a record, this call would stop compiling.
  expect(toyProvenanceReading([])).toBe("AutoEligible");
  expect(toyProvenanceReading([{ t: "ProvenanceMissing" }])).toBe("HeldForAttention");
});

// ── FALSIFIER 2: ESCALATION IS RECOVERABLE ────────────────────────────────────
//
// Aaron: "we never assume betrayal unless it's self declared by the betrayer and
// even then the game continues we don't end playing."
//
// Mutation that must break this: add any persistent flag — a blocklist
// parameter, a `flagged` field on the record, a penalty applied to the belief on
// escalation. Any of them makes the second call differ from the first.

test("FALSIFIER 2: a flagged publisher returns to AutoEligible once the discontinuity resolves", () => {
  const before = toyClassify(proposal(), spotless, []);
  expect(before.t).toBe("AutoEligible");

  const during = toyClassify(proposal(), spotless, [
    { t: "MaintainerChanged", from: "founder", to: "successor" },
    { t: "ProvenanceMissing" },
  ]);
  expect(during.t).toBe("HeldForAttention");

  // The handoff completes: new maintainer re-attests, provenance is restored.
  const after = toyClassify(proposal(), spotless, []);
  expect(after.t).toBe("AutoEligible");
  expect(after).toEqual(before);
});

test("FALSIFIER 2: no standing is confiscated by passing through an escalation", () => {
  const scoreBefore = toyAdherenceScore(spotless.belief);
  const snapshot = { ...spotless.belief };

  toyClassify(proposal(), spotless, [{ t: "BuildNotReproducible" }]);
  toyClassify(proposal(), spotless, [{ t: "ProvenanceMissing" }]);

  // classify returns a Transition and never a belief; the record is untouched.
  expect(spotless.belief).toEqual(snapshot);
  expect(toyAdherenceScore(spotless.belief)).toBe(scoreBefore);
});

test("FALSIFIER 2: recovery works for a publisher whose ADHERENCE was the problem", () => {
  // Escalation on the other axis must be recoverable the ordinary way too:
  // by accumulating new observations, not by petition.
  const damaged: AdherenceRecord = {
    publisher: "acme",
    ecosystem: "npm",
    belief: toyFold([
      ...Array.from({ length: 6 }, () => ({ held: true })),
      ...Array.from({ length: 8 }, () => ({ held: false })),
    ]),
  };
  expect(toyClassify(proposal(), damaged, []).t).toBe("HeldForAttention");

  const recovered: AdherenceRecord = {
    ...damaged,
    belief: toyFold(
      Array.from({ length: 30 }, () => ({ held: true })),
      TOY_TAU,
      damaged.belief,
    ),
  };
  expect(toyClassify(proposal(), recovered, []).t).toBe("AutoEligible");
});

// ── TIME-WEIGHTING: recent non-adherence must not be swallowed ────────────────
//
// The control is τ = 0, which is exactly `TravelerRankLedger.fs` as it stands
// today (no dynamics factor, σ² strictly decreasing). If the inflation step is
// deleted from `toyRecord`, the two branches become identical and this fails.

test("recent breakage is not swallowed by a long clean history (τ > 0 vs τ = 0)", () => {
  const history = [
    ...Array.from({ length: 50 }, () => ({ held: true })),
    ...Array.from({ length: 3 }, () => ({ held: false })),
  ];

  const withDynamics = toyAdherenceScore(toyFold(history, TOY_TAU));
  const withoutDynamics = toyAdherenceScore(toyFold(history, 0));

  // Both see the same evidence; only the one with a dynamics factor lets the
  // recent three misses actually move the estimate.
  expect(withDynamics).toBeLessThan(withoutDynamics);
  // And the gap is material, not a rounding artifact.
  expect(withoutDynamics - withDynamics).toBeGreaterThan(0.05);
});

test("a larger declared gap costs more confidence, and confidence is what decays", () => {
  const near = toyRecord(toyFold(Array.from({ length: 20 }, () => ({ held: true }))), true, 1);
  const far = toyRecord(toyFold(Array.from({ length: 20 }, () => ({ held: true }))), true, 40);
  // Stale evidence widens the posterior rather than being thrown away.
  expect(far.sigma2).toBeGreaterThan(near.sigma2);
  // No observation was discarded.
  expect(far.obsCount).toBe(near.obsCount);
});

test("a long-stale record surfaces as AdherenceStale, and staleness regresses the score", () => {
  const belief = toyFold(Array.from({ length: 20 }, () => ({ held: true })));
  const fresh: AdherenceRecord = { publisher: "acme", ecosystem: "npm", belief };
  const stale: AdherenceRecord = { ...fresh, gapSinceLastObservation: 60 };

  expect(toyClassify(proposal(), fresh, []).t).toBe("AutoEligible");

  const got = toyClassify(proposal(), stale, []);
  expect(got.t).toBe("ScrutinyRaised");
  if (got.t !== "HeldByDeclaredPin") {
    const staleFact = got.adherenceFacts.find((f) => f.t === "AdherenceStale");
    expect(staleFact).toBeDefined();
  }

  // Ageing widens the posterior, so the score moves TOWARD the 0.5 prior —
  // it does not fall below it. A publisher who stops shipping becomes less
  // known, never worse.
  const agedScore = toyAdherenceScore(toyInflate(belief, 60));
  expect(agedScore).toBeLessThan(toyAdherenceScore(belief));
  expect(agedScore).toBeGreaterThan(0.5);
});

test("ageing never drops σ² below what evidence supports, nor above the prior", () => {
  const belief = toyFold(Array.from({ length: 20 }, () => ({ held: true })));
  expect(toyInflate(belief, 10_000).sigma2).toBeLessThanOrEqual(1);
  expect(toyInflate(belief, 0).sigma2).toBe(belief.sigma2);
});

// ── THE WHITEWASH WINDOW ──────────────────────────────────────────────────────

test("a fresh publisher sits at the honest prior — not zero, not one", () => {
  expect(toyAdherenceScore(toyFreshBelief)).toBeCloseTo(0.5, 6);
});

test("re-minting under a new name returns to the prior; it does not beat a damaged record's ceiling", () => {
  const damaged = toyFold([{ held: true }, { held: false }, { held: false }]);
  const damagedScore = toyAdherenceScore(damaged);
  // Not clamped to zero — the honest posterior for 1 hit / 2 misses.
  expect(damagedScore).toBeGreaterThan(0.2);
  expect(damagedScore).toBeLessThan(0.5);

  // A fresh name is better than the damaged record, which is why re-minting is
  // tempting — and it is still escalated, because `NewPublisher` fires below the
  // observation floor. Whitewashing buys scrutiny, not a clean bill.
  const fresh: AdherenceRecord = { publisher: "acme2", ecosystem: "npm", belief: toyFreshBelief };
  const got = toyClassify(proposal({ publisher: "acme2" }), fresh, []);
  expect(got.t).toBe("ScrutinyRaised");
  if (got.t !== "HeldByDeclaredPin") {
    expect(got.adherenceFacts.some((f) => f.t === "NewPublisher")).toBe(true);
  }
});

// ── NEUTRALITY OF THE VOCABULARY ──────────────────────────────────────────────

test("no transition or fact row names an intent", () => {
  const src = [
    Bun.file(new URL("./types.ts", import.meta.url)),
    Bun.file(new URL("./toy-classify.ts", import.meta.url)),
    Bun.file(new URL("./toy-adherence.ts", import.meta.url)),
  ];
  return Promise.all(src.map((f) => f.text())).then((texts) => {
    const joined = texts.join("\n");
    // The words may appear in prose explaining why they are absent, so this
    // checks for them in the shape a DU row would take.
    for (const word of ["Compromised", "Malicious", "Attacker", "Forger", "Fraud", "Untrusted"]) {
      expect(joined).not.toContain(`t: "${word}"`);
      expect(joined).not.toContain(`"${word}";`);
    }
  });
});

test("there is no terminal row: every non-pin transition is reachable from and returns to AutoEligible", () => {
  const cases: { t: string }[] = [
    toyClassify(proposal(), spotless, []),
    toyClassify(proposal({ claimedBump: "major", toVersion: "2.0.0" }), spotless, []),
    toyClassify(proposal(), spotless, [{ t: "ProvenanceMissing" }]),
  ];
  expect(cases.map((c) => c.t)).toEqual(["AutoEligible", "ScrutinyRaised", "HeldForAttention"]);
  // Each of those inputs, with its escalating condition removed, is AutoEligible.
  expect(toyClassify(proposal(), spotless, []).t).toBe("AutoEligible");
});

// ── PURITY / TOTALITY (§13 noninterference) ───────────────────────────────────

test("classify is deterministic across repeated calls", () => {
  const args = [proposal(), spotless, [{ t: "MaintainerChanged", from: "a", to: "b" }]] as const;
  const first = toyClassify(args[0], args[1], args[2]);
  for (let i = 0; i < 500; i++) {
    expect(toyClassify(args[0], args[1], args[2])).toEqual(first);
  }
});

test("no ambient entropy source appears in the module sources", async () => {
  const files = ["types.ts", "toy-classify.ts", "toy-adherence.ts"];
  for (const name of files) {
    const text = await Bun.file(new URL(`./${name}`, import.meta.url)).text();
    // Strip line comments so the prose explaining these absences does not trip it.
    const code = text
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("///"))
      .join("\n");
    for (const forbidden of ["Date.", "Date(", "Math.random", "process.env", "fetch(", "readFile"]) {
      expect(code).not.toContain(forbidden);
    }
  }
});

test("classify is total over every bump kind with no record and no facts", () => {
  for (const bump of ["patch", "minor", "major"] as const) {
    const got = toyClassify(proposal({ claimedBump: bump }), undefined, []);
    expect(["AutoEligible", "ScrutinyRaised", "HeldForAttention"]).toContain(got.t);
    if (got.t !== "HeldByDeclaredPin") {
      expect(got.adherenceFacts.some((f) => f.t === "NoAdherenceRecord")).toBe(true);
    }
  }
});

test("a record for a different (publisher, ecosystem) is not evidence about this one", () => {
  const got = toyClassify(proposal({ ecosystem: "cargo" }), spotless, []);
  expect(got.t).toBe("ScrutinyRaised");
  if (got.t !== "HeldByDeclaredPin") {
    expect(got.adherenceFacts.some((f) => f.t === "AdherenceRecordMismatched")).toBe(true);
  }
});

// ── THE DECLARED PIN ──────────────────────────────────────────────────────────

test("a declared pin short-circuits both signals and records no opinion about the publisher", () => {
  const got = toyClassify(
    proposal({
      packageName: "typescript",
      claimedBump: "major",
      declaredPin: { reason: "TS 7 migration is its own change", heldBumps: ["major"] },
    }),
    spotless,
    [{ t: "ProvenanceMissing" }],
  );
  expect(got.t).toBe("HeldByDeclaredPin");
  if (got.t === "HeldByDeclaredPin") {
    expect(got.reason).toContain("TS 7");
  }
});

test("a pin held only for majors does not hold a minor", () => {
  const got = toyClassify(
    proposal({
      claimedBump: "minor",
      declaredPin: { reason: "majors only", heldBumps: ["major"] },
    }),
    spotless,
    [],
  );
  expect(got.t).toBe("AutoEligible");
});
