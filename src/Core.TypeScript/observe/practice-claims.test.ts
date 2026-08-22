/**
 * practice-claims.test.ts — the falsifiers are what this module DECLINES to conclude.
 *
 * A detector over people's accounts of themselves is easy to test in the flattering direction: feed it a
 * counterexample, watch it find one. That proves almost nothing. The properties worth pinning are the
 * refusals — that an unbound check is inert, that another subject's record is never yours, that one
 * instance cannot escalate, that malice is not in the type — because each of those is a way the
 * mechanism could quietly become a compliance checklist while every "detects drift" test stayed green.
 *
 * Every describe block below names the property it would falsify.
 */

import { describe, expect, test } from "bun:test";

import {
  EMPTY_PRACTICE_LEDGER,
  acknowledgeException,
  applyPracticeRepair,
  bindPractice,
  charitableReadingsForCounterexample,
  findCounterexamples,
  movedAfter,
  observePractice,
  offeredPracticeMoveKinds,
  patternReadingsForCounterexamples,
  practiceReadingGloss,
  practiceRecurrence,
  releasePractice,
  standingsFor,
  supersedePractice,
  type CheckRegistry,
  type PatternReading,
  type PracticeBinding,
  type PracticeEvidence,
  type PracticeLedger,
} from "./practice-claims";

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────────────

/** A record whose only content is whether the practice held. Keeps the tests about the fold. */
interface Toy {
  readonly signed: boolean;
  /** `true` ⇒ the check cannot settle this record. */
  readonly opaque?: boolean;
}

const REGISTRY: CheckRegistry<Toy> = {
  checks: [
    {
      checkId: "signed",
      question: "Was it signed?",
      evaluate: (r) => {
        if (r.opaque === true) return "undetermined";
        return r.signed ? "holds" : "does-not-hold";
      },
    },
    {
      // Present in the registry, bound by nobody in most tests. The inertness falsifier depends on it.
      checkId: "never-holds",
      question: "A check that fails on every record.",
      evaluate: () => "does-not-hold",
    },
  ],
};

/** Ordinal comparison. Never `localeCompare` — that is a live tripwire in this repo. */
function ordinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

const ALICE = "alice";
const BOB = "bob";

function binding(over: Partial<PracticeBinding> = {}): PracticeBinding {
  return {
    subject: ALICE,
    practiceId: "alice/sign",
    checkId: "signed",
    text: "I sign everything I author.",
    boundAt: 10,
    ...over,
  };
}

function bound(over: Partial<PracticeBinding> = {}): PracticeLedger {
  const result = bindPractice(EMPTY_PRACTICE_LEDGER, REGISTRY, over.subject ?? ALICE, binding(over));
  if (!result.ok) throw new Error(`fixture refused: ${result.refusal.kind}`);
  return result.ledger;
}

function ev(
  phase: number,
  signed: boolean,
  over: Partial<PracticeEvidence<Toy>> = {},
): PracticeEvidence<Toy> {
  return { subject: ALICE, evidenceId: `e${String(phase)}`, phase, record: { signed }, ...over };
}

// ── Property 1: nothing is checked unbound ──────────────────────────────────────────────────────────

describe("an observer-supplied category is not representable", () => {
  test("a registry check nobody bound finds nothing, on a record that fails it", () => {
    // `never-holds` fails on every record in existence, and alice never bound it.
    const report = observePractice(bound(), REGISTRY, ALICE, [ev(11, true)]);
    expect(report.observation.kind).toBe("no-counterexample");
  });

  test("a subject with no bindings at all has no counterexamples, whatever their record", () => {
    const report = observePractice(EMPTY_PRACTICE_LEDGER, REGISTRY, ALICE, [ev(11, false), ev(12, false)]);
    expect(report.observation.kind).toBe("no-counterexample");
    expect(report.standings).toEqual([]);
  });

  test("observePractice takes no predicate parameter — the only route in is a binding", () => {
    // A compile-time property, asserted here as an arity fact so a fourth parameter would break it.
    expect(observePractice.length).toBe(4); // ledger, registry, subject, evidence
  });
});

// ── Property 2: only the subject writes ─────────────────────────────────────────────────────────────

describe("refusals on the write path", () => {
  test("another actor cannot bind a practice on your behalf", () => {
    const result = bindPractice(EMPTY_PRACTICE_LEDGER, REGISTRY, BOB, binding());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toEqual({ kind: "not-your-claim", actor: BOB, owner: ALICE });
  });

  test("a binding to a check nothing can evaluate is refused", () => {
    const result = bindPractice(EMPTY_PRACTICE_LEDGER, REGISTRY, ALICE, binding({ checkId: "vibes" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toEqual({ kind: "unknown-check", subject: ALICE, checkId: "vibes" });
  });

  test("releasing a practice you never bound is refused", () => {
    const result = releasePractice(bound(), ALICE, { subject: ALICE, practiceId: "alice/ghost", releasedAt: 12 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.kind).toBe("unknown-practice");
  });

  test("acknowledging an exception on a practice you never bound is refused", () => {
    const result = acknowledgeException(bound(), ALICE, {
      subject: ALICE,
      practiceId: "alice/ghost",
      evidenceId: "e11",
      acknowledgedAt: 12,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.kind).toBe("unknown-practice");
  });

  test("a binding cannot supersede itself", () => {
    const result = supersedePractice(bound(), REGISTRY, ALICE, ALICE, "alice/sign", binding(), 12);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toEqual({ kind: "self-pair", practiceId: "alice/sign" });
  });

  test("another actor cannot repair your ledger", () => {
    const result = applyPracticeRepair(bound(), REGISTRY, BOB, ALICE, { kind: "release", practiceId: "alice/sign" }, 12);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.kind).toBe("not-your-claim");
  });

  test("re-binding the same practice id replaces rather than duplicates (idempotency #6)", () => {
    const once = bound();
    const twice = bindPractice(once, REGISTRY, ALICE, binding({ text: "restated" }));
    expect(twice.ok).toBe(true);
    if (twice.ok) {
      expect(twice.ledger.bindings.length).toBe(1);
      expect(twice.ledger.bindings[0]?.text).toBe("restated");
    }
  });
});

// ── Property 3: only your own evidence ──────────────────────────────────────────────────────────────

describe("another subject's record is never yours", () => {
  test("bob's failing record produces no counterexample for alice's claim", () => {
    const evidence = [ev(11, false, { subject: BOB, evidenceId: "bob-1" })];
    const report = observePractice(bound(), REGISTRY, ALICE, evidence);
    expect(report.observation.kind).toBe("no-counterexample");
    expect(report.evidenceVolume).toBe(0);
  });

  test("bob's record is not counted in alice's denominators either", () => {
    const evidence = [ev(11, true), ev(12, false, { subject: BOB, evidenceId: "bob-1" })];
    const standing = standingsFor(bound(), REGISTRY, ALICE, evidence)[0];
    expect(standing?.conforming).toBe(1);
    expect(standing?.counterexamples).toBe(0);
  });
});

// ── Property 4: the claim does not reach backwards ──────────────────────────────────────────────────

describe("evidence that predates the binding is never a counterexample", () => {
  test("a failing record before boundAt is counted as preceding, not as drift", () => {
    const report = observePractice(bound(), REGISTRY, ALICE, [ev(9, false)]);
    expect(report.observation.kind).toBe("no-counterexample");
    expect(report.standings[0]?.precedingBinding).toBe(1);
    expect(report.standings[0]?.counterexamples).toBe(0);
  });

  test("a failing record exactly at boundAt does count — the claim applies from the phase it was made", () => {
    const report = observePractice(bound(), REGISTRY, ALICE, [ev(10, false)]);
    expect(report.observation.kind).toBe("counterexample");
  });
});

// ── Property 5: a released claim stops applying ─────────────────────────────────────────────────────

describe("released and superseded bindings stop being checked, and are kept", () => {
  test("a failing record after the release is not a counterexample", () => {
    const released = releasePractice(bound(), ALICE, { subject: ALICE, practiceId: "alice/sign", releasedAt: 12 });
    expect(released.ok).toBe(true);
    if (!released.ok) return;
    const report = observePractice(released.ledger, REGISTRY, ALICE, [ev(13, false)]);
    expect(report.observation.kind).toBe("no-counterexample");
  });

  test("the released binding is still in the ledger (§5 memory preservation)", () => {
    const released = releasePractice(bound(), ALICE, { subject: ALICE, practiceId: "alice/sign", releasedAt: 12 });
    if (!released.ok) throw new Error("unexpected refusal");
    expect(released.ledger.bindings.length).toBe(1);
    expect(released.ledger.releases.length).toBe(1);
  });

  test("a failing record BEFORE the release is still a counterexample", () => {
    const released = releasePractice(bound(), ALICE, { subject: ALICE, practiceId: "alice/sign", releasedAt: 12 });
    if (!released.ok) throw new Error("unexpected refusal");
    const report = observePractice(released.ledger, REGISTRY, ALICE, [ev(11, false)]);
    expect(report.observation.kind).toBe("counterexample");
  });
});

// ── The three-valued verdict ────────────────────────────────────────────────────────────────────────

describe("undetermined is never a counterexample and never a conformance", () => {
  test("an unsettled record lands in its own column", () => {
    const evidence = [{ ...ev(11, false), record: { signed: false, opaque: true } }];
    const report = observePractice(bound(), REGISTRY, ALICE, evidence);
    expect(report.observation.kind).toBe("no-counterexample");
    expect(report.standings[0]?.undetermined).toBe(1);
    expect(report.standings[0]?.conforming).toBe(0);
    expect(report.standings[0]?.counterexamples).toBe(0);
  });
});

// ── The charity gradient ────────────────────────────────────────────────────────────────────────────

describe("one instance cannot escalate", () => {
  test("a single counterexample yields only charitable readings", () => {
    const report = observePractice(bound(), REGISTRY, ALICE, [ev(11, false)]);
    expect(report.observation.kind).toBe("counterexample");
    if (report.observation.kind !== "counterexample") return;
    for (const reading of report.observation.readings) {
      expect(["accidental", "growth"]).toContain(reading);
    }
  });

  test("a single counterexample does not offer `restate` — the record cannot yet ground it", () => {
    const report = observePractice(bound(), REGISTRY, ALICE, [ev(11, false)]);
    expect(offeredPracticeMoveKinds(report.observation)).toEqual(["release", "keep-claim-note-exception"]);
  });

  test("repetition WIDENS the menu and removes nothing", () => {
    const one = observePractice(bound(), REGISTRY, ALICE, [ev(11, false)]);
    const many = observePractice(bound(), REGISTRY, ALICE, [ev(11, false), ev(12, false)]);
    const oneMoves = offeredPracticeMoveKinds(one.observation);
    const manyMoves = offeredPracticeMoveKinds(many.observation);
    for (const move of oneMoves) expect(manyMoves).toContain(move);
    expect(manyMoves.length).toBeGreaterThan(oneMoves.length);
    expect(manyMoves).toContain("restate");
  });

  test("the widest reading set the module can produce names no intent", () => {
    const many = observePractice(bound(), REGISTRY, ALICE, [ev(11, false), ev(12, false)]);
    if (many.observation.kind !== "recurring-counterexamples") throw new Error("expected a pattern");
    expect([...many.observation.readings].sort(ordinal)).toEqual([
      "accidental",
      "ironic",
      "unresolved",
    ]);
  });

  test("no reading in the union glosses as an intent, and every one glosses", () => {
    const all: readonly PatternReading[] = ["accidental", "growth", "ironic", "unresolved"];
    for (const reading of all) {
      const gloss = practiceReadingGloss(reading);
      expect(gloss.length).toBeGreaterThan(0);
      for (const forbidden of ["malic", "decept", "lie", "bad faith", "dishonest"]) {
        expect(gloss.toLowerCase()).not.toContain(forbidden);
      }
    }
  });
});

/**
 * The type-level falsifier. `PatternReading` is the ONLY union in which a moral reading could appear, and
 * these lines fail `tsc` if one is ever added — the runtime tests above cannot catch that, because a new
 * constructor nothing returns yet would leave every assertion green.
 */
type NoMoralReading = Extract<PatternReading, "malicious" | "deceptive" | "bad-faith" | "fraudulent">;
const MALICE_IS_UNREPRESENTABLE: NoMoralReading extends never ? true : false = true;

describe("malice is unrepresentable, checked by the compiler", () => {
  test("the extract of every moral name from the reading union is empty", () => {
    expect(MALICE_IS_UNREPRESENTABLE).toBe(true);
  });
});

// ── growth is derived, not listed ───────────────────────────────────────────────────────────────────

describe("growth is offered only where the record shows a move", () => {
  test("no later conforming record ⇒ growth is not offered", () => {
    const ledger = bound();
    const evidence = [ev(11, false), { ...ev(12, false), record: { signed: false, opaque: true } }];
    const found = findCounterexamples(ledger, REGISTRY, ALICE, evidence);
    expect(found.length).toBe(1);
    const first = found[0];
    if (first === undefined) throw new Error("expected a counterexample");
    expect(charitableReadingsForCounterexample(ledger, REGISTRY, evidence, first)).toEqual(["accidental"]);
  });

  test("a later conforming record ⇒ growth becomes available", () => {
    const ledger = bound();
    const evidence = [ev(11, false), ev(12, true)];
    const found = findCounterexamples(ledger, REGISTRY, ALICE, evidence);
    const first = found[0];
    if (first === undefined) throw new Error("expected a counterexample");
    expect(charitableReadingsForCounterexample(ledger, REGISTRY, evidence, first)).toEqual([
      "accidental",
      "growth",
    ]);
  });

  test("an EARLIER conforming record does not make it growth — direction is load-bearing", () => {
    const ledger = bound();
    const evidence = [ev(10, true), ev(11, false)];
    const found = findCounterexamples(ledger, REGISTRY, ALICE, evidence);
    const first = found[0];
    if (first === undefined) throw new Error("expected a counterexample");
    expect(charitableReadingsForCounterexample(ledger, REGISTRY, evidence, first)).toEqual(["accidental"]);
  });

  test("releasing the claim after the record is itself a visible move", () => {
    const released = releasePractice(bound(), ALICE, { subject: ALICE, practiceId: "alice/sign", releasedAt: 13 });
    if (!released.ok) throw new Error("unexpected refusal");
    const evidence = [ev(11, false)];
    const found = findCounterexamples(released.ledger, REGISTRY, ALICE, evidence);
    const first = found[0];
    if (first === undefined) throw new Error("expected a counterexample");
    expect(movedAfter(released.ledger, REGISTRY, evidence, first)).toBe(true);
  });

  test("a pattern offers growth only when at least one of its members has a move after it", () => {
    const ledger = bound();
    const noMove = [ev(11, false), ev(12, false)];
    expect(
      patternReadingsForCounterexamples(ledger, REGISTRY, noMove, findCounterexamples(ledger, REGISTRY, ALICE, noMove)),
    ).not.toContain("growth");
    const withMove = [ev(11, false), ev(12, false), ev(13, true)];
    expect(
      patternReadingsForCounterexamples(
        ledger,
        REGISTRY,
        withMove,
        findCounterexamples(ledger, REGISTRY, ALICE, withMove),
      ),
    ).toContain("growth");
  });
});

// ── Repair ──────────────────────────────────────────────────────────────────────────────────────────

describe("repair belongs to the subject and resolves without erasing", () => {
  test("hold-both moves a counterexample from unheld to held", () => {
    const ledger = bound();
    const evidence = [ev(11, false)];
    const repaired = applyPracticeRepair(
      ledger,
      REGISTRY,
      ALICE,
      ALICE,
      { kind: "keep-claim-note-exception", practiceId: "alice/sign", evidenceId: "e11" },
      12,
    );
    if (!repaired.ok) throw new Error("unexpected refusal");
    const report = observePractice(repaired.ledger, REGISTRY, ALICE, evidence);
    expect(report.observation.kind).toBe("no-counterexample");
    expect(report.held.length).toBe(1);
  });

  test("a held counterexample still shows in the standing counts — seen is not erased", () => {
    const ledger = bound();
    const repaired = applyPracticeRepair(
      ledger,
      REGISTRY,
      ALICE,
      ALICE,
      { kind: "keep-claim-note-exception", practiceId: "alice/sign", evidenceId: "e11" },
      12,
    );
    if (!repaired.ok) throw new Error("unexpected refusal");
    const report = observePractice(repaired.ledger, REGISTRY, ALICE, [ev(11, false)]);
    expect(report.standings[0]?.counterexamples).toBe(1);
  });

  test("restating keeps the lineage: the old binding, the new one, and the link", () => {
    const restated = applyPracticeRepair(
      bound(),
      REGISTRY,
      ALICE,
      ALICE,
      {
        kind: "restate",
        supersededId: "alice/sign",
        replacement: binding({ practiceId: "alice/sign-v2", text: "I sign what I author, except merges." }),
      },
      13,
    );
    if (!restated.ok) throw new Error("unexpected refusal");
    expect(restated.ledger.bindings.length).toBe(2);
    expect(restated.ledger.supersessions).toEqual([
      { subject: ALICE, supersededId: "alice/sign", replacementId: "alice/sign-v2", at: 13 },
    ]);
    const report = observePractice(restated.ledger, REGISTRY, ALICE, []);
    expect(report.retiredBindings).toBe(1);
  });

  test("no move is offered when there is nothing to repair", () => {
    const report = observePractice(bound(), REGISTRY, ALICE, [ev(11, true)]);
    expect(offeredPracticeMoveKinds(report.observation)).toEqual([]);
  });
});

// ── Determinism ─────────────────────────────────────────────────────────────────────────────────────

describe("the fold is deterministic (DST) and forms no rates", () => {
  test("shuffled evidence produces an identical report", () => {
    const ledger = bound();
    const evidence = [ev(11, false), ev(12, false), ev(13, true), ev(14, false)];
    const forward = observePractice(ledger, REGISTRY, ALICE, evidence);
    const backward = observePractice(ledger, REGISTRY, ALICE, [...evidence].reverse());
    expect(JSON.stringify(backward)).toBe(JSON.stringify(forward));
  });

  test("recurrence is a count, and counts every member of the pattern", () => {
    const ledger = bound();
    const evidence = [ev(11, false), ev(12, false), ev(13, false)];
    const found = findCounterexamples(ledger, REGISTRY, ALICE, evidence);
    expect(practiceRecurrence(found)).toEqual([{ practiceId: "alice/sign", counterexamples: 3 }]);
  });

  test("every one of the subject's records lands in exactly one standing column", () => {
    const ledger = bound();
    const evidence = [
      ev(9, false), // preceding
      ev(11, true), // conforming
      ev(12, false), // counterexample
      { ...ev(13, false), record: { signed: false, opaque: true } }, // undetermined
    ];
    const standing = standingsFor(ledger, REGISTRY, ALICE, evidence)[0];
    if (standing === undefined) throw new Error("expected a standing");
    const total =
      standing.precedingBinding + standing.conforming + standing.counterexamples + standing.undetermined;
    expect(total).toBe(evidence.length);
  });
});

// ── Isolation between subjects and between bindings ─────────────────────────────────────────────────
//
// Added 2026-08-18 after a mutation sweep: eleven mutants survived in `endOf` / `bindingsLiveAt` /
// `standingsFor` because every fixture had exactly one subject and exactly one binding, so flipping
// `&&` to `||` in a subject/practice filter changed nothing observable. A test suite that cannot
// distinguish "this subject" from "any subject" is not testing the sovereignty property at all.

describe("bindings do not leak across subjects or across practices", () => {
  function twoSubjects(): PracticeLedger {
    const a = bindPractice(EMPTY_PRACTICE_LEDGER, REGISTRY, ALICE, binding());
    if (!a.ok) throw new Error("fixture");
    const b = bindPractice(a.ledger, REGISTRY, BOB, binding({ subject: BOB, practiceId: "bob/sign" }));
    if (!b.ok) throw new Error("fixture");
    return b.ledger;
  }

  test("bob's binding does not apply to alice's records", () => {
    const ledger = twoSubjects();
    const report = observePractice(ledger, REGISTRY, ALICE, [ev(11, false)]);
    // Exactly one counterexample — alice's own binding. Bob's must not produce a second.
    expect(report.observation.kind).toBe("counterexample");
    expect(report.standings.length).toBe(1);
    expect(report.standings[0]?.binding.subject).toBe(ALICE);
  });

  test("releasing bob's practice does not release alice's", () => {
    const released = releasePractice(twoSubjects(), BOB, { subject: BOB, practiceId: "bob/sign", releasedAt: 11 });
    if (!released.ok) throw new Error("unexpected refusal");
    const report = observePractice(released.ledger, REGISTRY, ALICE, [ev(12, false)]);
    expect(report.observation.kind).toBe("counterexample");
  });

  test("releasing one of alice's two practices leaves the other applying", () => {
    const second = bindPractice(bound(), REGISTRY, ALICE, binding({ practiceId: "alice/sign-2" }));
    if (!second.ok) throw new Error("fixture");
    const released = releasePractice(second.ledger, ALICE, {
      subject: ALICE,
      practiceId: "alice/sign-2",
      releasedAt: 11,
    });
    if (!released.ok) throw new Error("unexpected refusal");
    const report = observePractice(released.ledger, REGISTRY, ALICE, [ev(12, false)]);
    expect(report.observation.kind).toBe("counterexample");
    if (report.observation.kind !== "counterexample") return;
    expect(report.observation.counterexample.binding.practiceId).toBe("alice/sign");
  });

  test("bob's release is not counted among alice's retired bindings", () => {
    const released = releasePractice(twoSubjects(), BOB, { subject: BOB, practiceId: "bob/sign", releasedAt: 11 });
    if (!released.ok) throw new Error("unexpected refusal");
    expect(observePractice(released.ledger, REGISTRY, ALICE, []).retiredBindings).toBe(0);
    expect(observePractice(released.ledger, REGISTRY, BOB, []).retiredBindings).toBe(1);
  });
});

describe("a superseded binding closes its window exactly where it was replaced", () => {
  function superseded(at: number): PracticeLedger {
    const result = supersedePractice(
      bound(),
      REGISTRY,
      ALICE,
      ALICE,
      "alice/sign",
      binding({ practiceId: "alice/sign-v2", boundAt: at }),
      at,
    );
    if (!result.ok) throw new Error(`fixture refused: ${result.refusal.kind}`);
    return result.ledger;
  }

  test("a failing record AFTER the supersession is judged by the replacement, not the original", () => {
    const report = observePractice(superseded(12), REGISTRY, ALICE, [ev(13, false)]);
    expect(report.observation.kind).toBe("counterexample");
    if (report.observation.kind !== "counterexample") return;
    expect(report.observation.counterexample.binding.practiceId).toBe("alice/sign-v2");
  });

  test("a record exactly AT the supersession phase is outside the superseded window", () => {
    const standings = standingsFor(superseded(12), REGISTRY, ALICE, [ev(12, false)]);
    const original = standings.find((s) => s.binding.practiceId === "alice/sign");
    expect(original?.counterexamples).toBe(0);
    expect(original?.conforming).toBe(0);
  });

  test("a record inside the superseded window still counts against the original", () => {
    const standings = standingsFor(superseded(12), REGISTRY, ALICE, [ev(11, false)]);
    const original = standings.find((s) => s.binding.practiceId === "alice/sign");
    expect(original?.counterexamples).toBe(1);
  });

  test("the superseded binding still reports its in-window conformance — nothing is erased", () => {
    const standings = standingsFor(superseded(12), REGISTRY, ALICE, [ev(11, true)]);
    const original = standings.find((s) => s.binding.practiceId === "alice/sign");
    expect(original?.conforming).toBe(1);
  });

  test("the earliest of two closures wins — a release before a supersession bounds the window", () => {
    const both = releasePractice(superseded(14), ALICE, {
      subject: ALICE,
      practiceId: "alice/sign",
      releasedAt: 12,
    });
    if (!both.ok) throw new Error("unexpected refusal");
    const standings = standingsFor(both.ledger, REGISTRY, ALICE, [ev(13, false)]);
    const original = standings.find((s) => s.binding.practiceId === "alice/sign");
    expect(original?.counterexamples).toBe(0);
  });
});

describe("a binding this registry cannot evaluate is inert, not a counterexample", () => {
  const EMPTY_REGISTRY: CheckRegistry<Toy> = { checks: [] };

  test("observing with a registry that lacks the check finds nothing", () => {
    const report = observePractice(bound(), EMPTY_REGISTRY, ALICE, [ev(11, false)]);
    expect(report.observation.kind).toBe("no-counterexample");
  });

  test("its records are counted as unsettled rather than as conformance", () => {
    const standing = standingsFor(bound(), EMPTY_REGISTRY, ALICE, [ev(11, false), ev(12, true)])[0];
    expect(standing?.undetermined).toBe(2);
    expect(standing?.conforming).toBe(0);
    expect(standing?.counterexamples).toBe(0);
  });

  test("movedAfter cannot claim a move it has no way to see", () => {
    const ledger = bound();
    const evidence = [ev(11, false), ev(12, true)];
    const found = findCounterexamples(ledger, REGISTRY, ALICE, evidence);
    const first = found[0];
    if (first === undefined) throw new Error("expected a counterexample");
    expect(movedAfter(ledger, EMPTY_REGISTRY, evidence, first)).toBe(false);
  });
});

describe("movedAfter is about what came AFTER, called directly or not", () => {
  test("a closure at or before the record is not a move after it", () => {
    // Unreachable via findCounterexamples (a record at/after the end is outside the window), but
    // `movedAfter` is exported and a caller may hand it any pair. Pinned so the guard stays a
    // conjunction: "the claim ended" is not the same fact as "the claim ended LATER than this".
    const released = releasePractice(bound(), ALICE, { subject: ALICE, practiceId: "alice/sign", releasedAt: 11 });
    if (!released.ok) throw new Error("unexpected refusal");
    const hand = { binding: binding(), evidence: ev(11, false) };
    expect(movedAfter(released.ledger, REGISTRY, [hand.evidence], hand)).toBe(false);
  });
});
