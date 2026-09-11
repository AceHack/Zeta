import { describe, expect, test } from "bun:test";
import {
  externalRefOf,
  ingest,
  IntakeKind,
  IntakeState,
  INTAKE_PATH,
  normalize,
  receive,
  requirementsFor,
  Severity,
  triage,
  type ExternalEvent,
} from "./intake";
import { WorkType } from "./goal-cascade";

const raw = (over: Partial<ExternalEvent> = {}): ExternalEvent => ({
  source: "customer_portal",
  externalId: "TICKET-1",
  title: "checkout double-charges",
  ...over,
});

const at = { itemId: "i1", nowMs: 100, seen: new Set<string>() };

describe("THE IDEMPOTENCY KEY IS UNAMBIGUOUS", () => {
  test("it round-trips the two parts distinguishably", () => {
    expect(externalRefOf("a", "b")).not.toBe(externalRefOf("b", "a"));
  });

  test("parts containing the separator do NOT collide", () => {
    // The reference keys on `${source}:${externalId}`, so source "a:b" + id "c" and source "a" +
    // id "b:c" both make "a:b:c" — two unrelated upstream reports become one work item, and the
    // loser is dropped as a duplicate. The least visible failure available.
    expect(externalRefOf("a:b", "c")).not.toBe(externalRefOf("a", "b:c"));
    // …and the naive scheme really would have collided, which is what makes this test load-bearing.
    expect(`a:b:c`).toBe(`${"a:b"}:${"c"}`);
    expect(`a:b:c`).toBe(`${"a"}:${"b:c"}`);
  });

  test("empty parts are still distinguishable from each other", () => {
    expect(externalRefOf("", "x")).not.toBe(externalRefOf("x", ""));
  });

  test("the same pair always makes the same key", () => {
    expect(externalRefOf("s", "1")).toBe(externalRefOf("s", "1"));
  });
});

describe("normalizing refuses rather than guessing", () => {
  test("a well-formed event normalizes", () => {
    const r = normalize(raw({ kind: IntakeKind.Defect, severity: Severity.High }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.kind).toBe(IntakeKind.Defect);
    expect(r.value.workType).toBe(WorkType.Defect);
    expect(r.value.severity).toBe(Severity.High);
  });

  test("THE CLASSIFICATION SURVIVES INTO THE CASCADE — a defect is not flattened to a task", () => {
    // All four non-goal kinds used to map onto `Task`, discarding the distinction intake had just
    // drawn. Nothing downstream could then treat a defect differently from an incident, so a
    // restoration time was not merely unmeasured but unmeasurable.
    const typeOf = (kind: IntakeKind): WorkType | undefined => {
      const r = normalize(raw({ kind, severity: Severity.High }));
      return r.ok ? r.value.workType : undefined;
    };
    expect(typeOf(IntakeKind.Defect)).toBe(WorkType.Defect);
    expect(typeOf(IntakeKind.Incident)).toBe(WorkType.Incident);
    expect(typeOf(IntakeKind.Goal)).toBe(WorkType.Goal);

    // The discriminating half: a defect and an incident are DIFFERENT work, not merely both
    // non-task. Asserting each mapping alone would still pass if every kind mapped to one type.
    expect(typeOf(IntakeKind.Defect)).not.toBe(typeOf(IntakeKind.Incident));
    expect(typeOf(IntakeKind.Incident)).not.toBe(typeOf(IntakeKind.Feature));
  });

  test("no title is refused", () => {
    const r = normalize(raw({ title: "   " }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.reason).toBe("missing_title");
  });

  test("no source is refused — the key would not be unique across systems", () => {
    const r = normalize(raw({ source: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.reason).toBe("missing_source");
  });

  test("no external id is refused — it could not be de-duplicated", () => {
    const r = normalize(raw({ externalId: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.reason).toBe("missing_external_id");
  });

  test("an unstated severity defaults to MEDIUM, not low", () => {
    // An unclassified report is not evidence that nothing is wrong, and defaulting downward buries
    // exactly the reports nobody triaged.
    const r = normalize(raw());
    expect(r.ok && r.value.severity).toBe(Severity.Medium);
  });

  test("an unstated kind defaults to a service request", () => {
    const r = normalize(raw());
    expect(r.ok && r.value.kind).toBe(IntakeKind.ServiceRequest);
  });

  test("an external GOAL is classified as a goal — authority is asked elsewhere", () => {
    // Intake classifies honestly; `acceptGoal` is what refuses to let an outside system set company
    // direction. Keeping those separate is deliberate.
    const r = normalize(raw({ kind: IntakeKind.Goal }));
    expect(r.ok && r.value.workType).toBe(WorkType.Goal);
  });

  test("blank reproduction is treated as absent, not as present-and-empty", () => {
    const r = normalize(raw({ reproduction: "   " }));
    expect(r.ok && r.value.reproduction).toBeUndefined();
  });
});

describe("ingesting is idempotent", () => {
  test("the first time it creates an item in `created`", () => {
    const n = normalize(raw());
    expect(n.ok).toBe(true);
    if (!n.ok) return;
    const r = ingest(n.value, at);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.state).toBe(IntakeState.Created);
    expect(r.value.receivedAtMs).toBe(100);
  });

  test("A RETRY IS REFUSED — a retrying upstream is the normal case", () => {
    const n = normalize(raw());
    if (!n.ok) return;
    const r = ingest(n.value, { ...at, seen: new Set([n.value.externalRef]) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.reason).toBe("duplicate");
  });

  test("a DIFFERENT report from the same source is not a duplicate", () => {
    const first = normalize(raw({ externalId: "T-1" }));
    const second = normalize(raw({ externalId: "T-2" }));
    if (!first.ok || !second.ok) return;
    const seen = new Set([first.value.externalRef]);
    expect(ingest(second.value, { ...at, seen }).ok).toBe(true);
  });
});

describe("TRIAGE ACTUALLY CHECKS, rather than asserting", () => {
  test("a defect needs reproduction AND evidence", () => {
    // The reference passes `hasTriageFields: true, hasRequiredEvidence: true` hardcoded into its
    // guard, so the guard is called and cannot refuse — a defect with neither advances exactly as
    // one with both.
    expect(requirementsFor(IntakeKind.Defect)).toEqual({ needsReproduction: true, needsEvidence: true });
  });

  test("a defect with NO reproduction is refused at the door", () => {
    // Costs the reporter one reply. Letting it through costs a developer a day, and it comes back
    // unresolved.
    const r = receive(raw({ kind: IntakeKind.Defect, evidenceRefs: ["log/1"] }), at);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.reason).toBe("missing_reproduction");
  });

  test("a defect with NO evidence is refused", () => {
    const r = receive(raw({ kind: IntakeKind.Defect, reproduction: "click twice" }), at);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.reason).toBe("missing_evidence");
  });

  test("a complete defect reaches ready", () => {
    const r = receive(raw({ kind: IntakeKind.Defect, reproduction: "click twice", evidenceRefs: ["log/1"] }), at);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.state).toBe(IntakeState.Ready);
  });

  test("an INCIDENT needs evidence but not reproduction — it may not repeat on demand", () => {
    expect(requirementsFor(IntakeKind.Incident)).toEqual({ needsReproduction: false, needsEvidence: true });
    expect(receive(raw({ kind: IntakeKind.Incident, evidenceRefs: ["alert/9"] }), at).ok).toBe(true);
    const bare = receive(raw({ kind: IntakeKind.Incident }), at);
    expect(bare.ok).toBe(false);
    if (!bare.ok) expect(bare.refusal.reason).toBe("missing_evidence");
  });

  test("a feature and a service request need neither", () => {
    for (const kind of [IntakeKind.Feature, IntakeKind.ServiceRequest, IntakeKind.Goal] as const) {
      expect(requirementsFor(kind)).toEqual({ needsReproduction: false, needsEvidence: false });
      expect(receive(raw({ kind }), at).ok).toBe(true);
    }
  });

  test("every kind has requirements — the table is total", () => {
    for (const kind of Object.values(IntakeKind)) {
      expect(typeof requirementsFor(kind).needsEvidence).toBe("boolean");
    }
  });

  test("triage does not move an item that it refuses", () => {
    const n = normalize(raw({ kind: IntakeKind.Defect }));
    if (!n.ok) return;
    const item = ingest(n.value, at);
    if (!item.ok) return;
    expect(triage(item.value).ok).toBe(false);
    // The item is untouched — a refused triage must not half-advance it.
    expect(item.value.state).toBe(IntakeState.Created);
  });

  test("the path is the four states, in order", () => {
    expect(INTAKE_PATH).toEqual(["created", "intake", "triage", "ready"]);
  });
});

describe("AN ORGANIZATION MAY OWE THE REPRODUCTION rather than demand it", () => {
  // Measured on the Agentic Team's first real run: the refusal above bounced four of five live
  // Jira tickets — one whose summary IS its reproduction, three that are investigations. The
  // refusal stays the default; `reproduce_first` is the organization choosing to do that step.
  const noRepro = raw({ kind: IntakeKind.Defect, evidenceRefs: ["log/1"] });

  test("with the policy, a defect with no reproduction is ADMITTED and marked owed", () => {
    const r = receive(noRepro, { ...at, unreproduced: "reproduce_first" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.state).toBe(IntakeState.Ready);
    expect(r.value.reproductionOwed).toBe(true);
  });

  test("the default is unchanged — unset still refuses", () => {
    const r = receive(noRepro, at);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.reason).toBe("missing_reproduction");
    const stated = receive(noRepro, { ...at, unreproduced: "refuse" });
    expect(stated.ok).toBe(false);
  });

  test("OWED IS NOT WAIVED — evidence is still required", () => {
    // The policy moves ONE obligation from reporter to organization. A defect with neither
    // reproduction nor evidence is still refused, for the evidence.
    const r = receive(raw({ kind: IntakeKind.Defect }), { ...at, unreproduced: "reproduce_first" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.reason).toBe("missing_evidence");
  });

  test("a defect that ARRIVED with a reproduction is not marked owed", () => {
    const r = receive(raw({ kind: IntakeKind.Defect, reproduction: "click twice", evidenceRefs: ["log/1"] }), {
      ...at,
      unreproduced: "reproduce_first",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.reproductionOwed).toBeUndefined();
  });

  test("a non-defect is never marked owed — it never needed one", () => {
    const r = receive(raw({ kind: IntakeKind.Feature }), { ...at, unreproduced: "reproduce_first" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.reproductionOwed).toBeUndefined();
  });
});

describe("THE WHOLE TICKET TRAVELS through the door", () => {
  // `normalize` dropped the body, so everything downstream that claimed to carry "what the
  // requester wrote" carried the reproduction and nothing else.
  test("body and parent survive normalize, ingest and triage", () => {
    const r = receive(
      raw({
        kind: IntakeKind.Defect,
        reproduction: "click twice",
        evidenceRefs: ["log/1"],
        body: "Steps: click twice.\n\nSuspected cause: a background sync.",
        parentExternalId: "EPIC-7",
        parentTitle: "MVP gaps",
      }),
      at,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.body).toContain("Suspected cause");
    expect(r.value.parentExternalId).toBe("EPIC-7");
    expect(r.value.parentTitle).toBe("MVP gaps");
  });

  test("blank body and parent are absent, not present-and-empty", () => {
    const n = normalize(raw({ body: "   ", parentExternalId: " ", parentTitle: "" }));
    expect(n.ok).toBe(true);
    if (!n.ok) return;
    expect(n.value.body).toBeUndefined();
    expect(n.value.parentExternalId).toBeUndefined();
    expect(n.value.parentTitle).toBeUndefined();
  });
});

describe("the whole door", () => {
  test("it returns the FIRST refusal, the one the caller can act on", () => {
    // Telling a reporter its untitled duplicate also lacks reproduction steps is three problems
    // where there is one.
    const r = receive(raw({ title: "", kind: IntakeKind.Defect }), at);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.reason).toBe("missing_title");
  });

  test("a duplicate is caught before triage runs", () => {
    const n = normalize(raw({ kind: IntakeKind.Defect }));
    if (!n.ok) return;
    const r = receive(raw({ kind: IntakeKind.Defect }), { ...at, seen: new Set([n.value.externalRef]) });
    expect(r.ok).toBe(false);
    // Not `missing_reproduction`, even though that is also true.
    if (!r.ok) expect(r.refusal.reason).toBe("duplicate");
  });

  test("a good event goes all the way through in one call", () => {
    const r = receive(raw({ kind: IntakeKind.Feature, severity: Severity.Low }), at);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.state).toBe(IntakeState.Ready);
    expect(r.value.severity).toBe(Severity.Low);
    expect(r.value.externalRef).toBe(externalRefOf("customer_portal", "TICKET-1"));
  });
});
