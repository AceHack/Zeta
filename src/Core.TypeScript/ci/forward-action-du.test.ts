// forward-action-du.test.ts — 081M10JB2FJ087G0R00159NYSZ
//
// A classifier that cannot be wrong is the defect. These are the falsifiers.

import { describe, expect, test } from "bun:test";
import {
  ACTION_REGISTRY,
  type ActionName,
  type CheckFact,
  type Disposition,
  type DispositionKind,
  type PrFacts,
  REQUIRED_CHECK,
  actionFor,
  classify,
  isAttributable,
  isAwaitingApproval,
  isRemoteMergeVerdictStale,
  mayAutoExecute,
  propose,
  rootFailures,
  why,
} from "./forward-action-du.ts";

/** A PR with nothing wrong. Every fixture below is this, minimally perturbed. */
function baseFacts(over: Partial<PrFacts> = {}): PrFacts {
  return {
    number: 1,
    headSha: "a".repeat(40),
    headRef: "feat/x",
    baseRef: "main",
    isDraft: false,
    autoMergeArmed: true,
    mergeRefExists: true,
    localMerge: "clean",
    conflictPaths: [],
    remoteMergeable: "MERGEABLE",
    checks: [ok(REQUIRED_CHECK)],
    requiredCheckNames: [REQUIRED_CHECK],
    diffPaths: ["src/a.ts"],
    behindBy: 0,
    mainTipDate: "2026-08-27T00:00:00Z",
    branchHeldElsewhere: false,
    isFrozenLane: false,
    priorRerunAttempts: 0,
    gateRun: { id: 100, status: "completed", conclusion: "success", jobCount: 40 },
    ...over,
  };
}

/**
 * The live shape of PR #15772 on 2026-08-27, field by field as measured.
 *
 * Note what is TRUE here and reads as healthy: the merge ref resolves, nothing
 * is red, and every check-run present on the head is green — they are just all
 * from OTHER workflows (CodeQL, submit-nuget). `gate (required)` is absent.
 */
function awaitingApprovalFacts(over: Partial<PrFacts> = {}): PrFacts {
  return baseFacts({
    number: 15772,
    headRef: "heartbeat/pr-archive",
    checks: [ok("Analyze (go)"), ok("Analyze (python)"), ok("submit-nuget")],
    requiredCheckNames: [REQUIRED_CHECK],
    mergeRefExists: true,
    localMerge: "clean",
    remoteMergeable: "UNKNOWN",
    gateRun: { id: 33036398592, status: "completed", conclusion: "action_required", jobCount: 0 },
    ...over,
  });
}

function ok(name: string): CheckFact {
  return {
    name,
    conclusion: "success",
    status: "completed",
    completedAt: "2026-08-27T00:00:00Z",
    runId: 10,
    subjectPaths: [],
  };
}
function failed(name: string, subjectPaths: string[] = []): CheckFact {
  return {
    name,
    conclusion: "failure",
    status: "completed",
    completedAt: "2026-08-27T00:00:00Z",
    runId: 11,
    subjectPaths,
  };
}
function running(name: string): CheckFact {
  return { name, conclusion: null, status: "in_progress", completedAt: null, runId: 12, subjectPaths: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE CLOSED COMMAND SET — invariants that keep it closed
// ─────────────────────────────────────────────────────────────────────────────

describe("closed command set", () => {
  test("every registry row's key matches its name (no aliasing an arm to another's policy)", () => {
    for (const [key, spec] of Object.entries(ACTION_REGISTRY)) {
      expect(spec.name).toBe(key as ActionName);
    }
  });

  test("autoExecutable is EXACTLY reversibility === idempotent-reversible", () => {
    for (const spec of Object.values(ACTION_REGISTRY)) {
      expect(spec.autoExecutable).toBe(spec.reversibility === "idempotent-reversible");
    }
  });

  test("no irreversible-shaped action is auto-executable — the whole safety property", () => {
    const irreversible = Object.values(ACTION_REGISTRY).filter((s) => s.reversibility === "irreversible-shaped");
    expect(irreversible.length).toBeGreaterThan(0); // else this test is vacuous
    for (const spec of irreversible) expect(mayAutoExecute(spec.name)).toBe(false);
  });

  test("every automatable action names a compensation AND an idempotence witness", () => {
    const auto = Object.values(ACTION_REGISTRY).filter((s) => s.autoExecutable);
    expect(auto.length).toBeGreaterThan(0);
    for (const spec of auto) {
      expect(spec.compensation.length).toBeGreaterThan(0);
      expect(spec.idempotenceWitness.length).toBeGreaterThan(0);
    }
  });

  test("non-automatable actions declare NO compensation — silence is the honest record", () => {
    for (const spec of Object.values(ACTION_REGISTRY)) {
      if (!spec.autoExecutable) expect(spec.compensation).toBe("");
    }
  });

  test("every action carries a rationale a reviewer can audit", () => {
    for (const spec of Object.values(ACTION_REGISTRY)) expect(spec.rationale.length).toBeGreaterThan(20);
  });

  test("actionFor only ever returns a name IN the registry", () => {
    for (const f of everyFixture()) {
      const { action } = actionFor(classify(f), f);
      expect(Object.keys(ACTION_REGISTRY)).toContain(action);
    }
  });

  test("args are scalars — never a command string, never something interpolable into one", () => {
    for (const f of everyFixture()) {
      const p = propose(f);
      for (const v of Object.values(p.args)) {
        expect(["string", "number"]).toContain(typeof v);
        expect(String(v)).not.toMatch(/[;&|`$><]/);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TOTALITY — every shape maps to exactly one arm, and nothing throws
// ─────────────────────────────────────────────────────────────────────────────

/** Deliberately hostile shapes, including ones the edge should never produce. */
function everyFixture(): PrFacts[] {
  return [
    baseFacts(),
    baseFacts({ checks: [] }), // zero checks at all
    baseFacts({ checks: [], requiredCheckNames: [] }), // and nothing required
    baseFacts({ mergeRefExists: false }),
    baseFacts({ mergeRefExists: false, remoteMergeable: "UNKNOWN" }),
    baseFacts({ mergeRefExists: false, localMerge: "conflict", conflictPaths: ["a.ts"] }),
    baseFacts({ mergeRefExists: false, localMerge: "unknown" }),
    baseFacts({ localMerge: "unknown" }),
    baseFacts({ localMerge: "conflict", conflictPaths: ["src/a.ts"] }),
    baseFacts({ remoteMergeable: "CONFLICTING" }),
    baseFacts({ checks: [running(REQUIRED_CHECK)] }),
    baseFacts({ checks: [failed(REQUIRED_CHECK), failed("test", ["src/a.ts"])] }),
    baseFacts({ checks: [failed(REQUIRED_CHECK), failed("test")], behindBy: 5 }),
    baseFacts({ checks: [failed(REQUIRED_CHECK), failed("test")], behindBy: 0 }),
    baseFacts({ checks: [failed(REQUIRED_CHECK), failed("test")], behindBy: 0, priorRerunAttempts: 2 }),
    baseFacts({ branchHeldElsewhere: true }),
    baseFacts({ isFrozenLane: true, headRef: "heartbeat/x" }),
    baseFacts({ autoMergeArmed: false }),
    baseFacts({ isDraft: true }),
    baseFacts({ behindBy: -1 }), // nonsense the edge should never emit
    baseFacts({ diffPaths: [] }),
    baseFacts({ headSha: "" }),
    baseFacts({ checks: [failed("only-a-non-required-check")] }),
    baseFacts({ gateRun: null }), // no gate run at all
    baseFacts({ gateRun: { id: 1, status: "completed", conclusion: "action_required", jobCount: -1 } }), // jobs probe unanswered
    awaitingApprovalFacts(),
    awaitingApprovalFacts({ isFrozenLane: true }),
    awaitingApprovalFacts({ headRef: "feat/ordinary", isFrozenLane: false }),
  ];
}

describe("totality", () => {
  test("classify never throws and never returns undefined, on any shape", () => {
    for (const f of everyFixture()) {
      const d = classify(f);
      expect(d).toBeDefined();
      expect(typeof d.kind).toBe("string");
    }
  });

  test("propose never throws and always yields a renderable why", () => {
    for (const f of everyFixture()) {
      const p = propose(f);
      expect(p.why.length).toBeGreaterThan(0);
      expect(typeof p.autoExecutable).toBe("boolean");
    }
  });

  test("autoExecutable on the proposal always agrees with the registry", () => {
    for (const f of everyFixture()) {
      const p = propose(f);
      expect(p.autoExecutable).toBe(mayAutoExecute(p.action));
    }
  });

  test("why() is total — every Disposition kind produces prose", () => {
    const kinds: DispositionKind[] = [
      "Healthy",
      "AwaitingVerdict",
      "OwnedElsewhere",
      "VerdictUndispatchable",
      "VerdictNotDispatched",
      "VerdictAwaitingApproval",
      "VerdictStale",
      "SuspectedInfraFlake",
      "MergeVerdictStale",
      "MergeConflicted",
      "FrozenLane",
      "OwnFailure",
      "NeedsIntelligence",
      "Unknown",
    ];
    const seen = new Set(everyFixture().map((f) => classify(f).kind));
    // Not every kind is reachable from the fixture set, but every kind must
    // render. Build a minimal value for each and check why() handles it.
    const samples: Record<DispositionKind, Disposition> = {
      Healthy: { kind: "Healthy", armed: true },
      AwaitingVerdict: { kind: "AwaitingVerdict", pending: ["x"] },
      OwnedElsewhere: { kind: "OwnedElsewhere" },
      VerdictUndispatchable: { kind: "VerdictUndispatchable", why: "w" },
      VerdictNotDispatched: { kind: "VerdictNotDispatched", missing: ["x"] },
      VerdictAwaitingApproval: {
        kind: "VerdictAwaitingApproval",
        runId: 1,
        conclusion: "action_required",
        jobCount: 0,
        mergeRefExists: true,
      },
      VerdictStale: { kind: "VerdictStale", unattributable: ["x"], behindBy: 1 },
      SuspectedInfraFlake: { kind: "SuspectedInfraFlake", unattributable: ["x"] },
      MergeVerdictStale: { kind: "MergeVerdictStale", remote: "CONFLICTING" },
      MergeConflicted: { kind: "MergeConflicted", paths: ["a"] },
      FrozenLane: { kind: "FrozenLane", lane: "heartbeat/x" },
      OwnFailure: { kind: "OwnFailure", attributable: ["x"] },
      NeedsIntelligence: { kind: "NeedsIntelligence", measured: ["m"], ambiguity: "a" },
      Unknown: { kind: "Unknown", reason: "r", evidence: [] },
    };
    for (const k of kinds) expect(why(samples[k]).length).toBeGreaterThan(0);
    expect(seen.size).toBeGreaterThan(5); // the fixtures actually exercise breadth
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE TWO `dirty`s — the most common case, and a coin flip if they collapse
// ─────────────────────────────────────────────────────────────────────────────

describe("stale-dirty vs truly-conflicted MUST separate", () => {
  // #15724 on 2026-08-26: GitHub said dirty, a local merge produced zero conflicts.
  const staleDirty = baseFacts({
    number: 15724,
    remoteMergeable: "CONFLICTING",
    localMerge: "clean",
    conflictPaths: [],
  });
  // #15743 on 2026-08-27: measured rc=1 with real hunks in three files.
  const trulyConflicted = baseFacts({
    number: 15743,
    remoteMergeable: "CONFLICTING",
    localMerge: "conflict",
    conflictPaths: ["data/decorrelation-research.jsonl", "src/Core.TypeScript/observe/decorrelation-stats.ts"],
  });

  test("they land in DIFFERENT arms", () => {
    expect(classify(staleDirty).kind).not.toBe(classify(trulyConflicted).kind);
  });

  test("the stale one is MergeVerdictStale and gets an automatable remedy", () => {
    const p = propose(staleDirty);
    expect(p.disposition.kind).toBe("MergeVerdictStale");
    expect(p.action).toBe("MergeMainAndPush");
    expect(p.autoExecutable).toBe(true);
  });

  test("the real one is MergeConflicted and is PROPOSAL ONLY", () => {
    const p = propose(trulyConflicted);
    expect(p.disposition.kind).toBe("MergeConflicted");
    expect(p.action).toBe("ProposeConflictResolution");
    expect(p.autoExecutable).toBe(false);
  });

  test("both read IDENTICALLY from GitHub — only the local measurement separates them", () => {
    expect(staleDirty.remoteMergeable).toBe(trulyConflicted.remoteMergeable);
    // Same reading, opposite measurement, opposite arm. That is the whole claim.
    expect(isRemoteMergeVerdictStale(staleDirty)).toBe(true);
    expect(isRemoteMergeVerdictStale(trulyConflicted)).toBe(false);
  });

  test("an UNANSWERED merge probe is neither — it is Unknown, never clean", () => {
    const unanswered = baseFacts({ remoteMergeable: "CONFLICTING", localMerge: "unknown" });
    expect(classify(unanswered).kind).toBe("Unknown");
    expect(isRemoteMergeVerdictStale(unanswered)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NO SILENT UNKNOWN / NO SILENT ESCALATION
// ─────────────────────────────────────────────────────────────────────────────

describe("Unknown and Escalate must carry evidence", () => {
  test("every Unknown carries a non-empty reason", () => {
    for (const f of everyFixture()) {
      const d = classify(f);
      if (d.kind === "Unknown") expect(d.reason.trim().length).toBeGreaterThan(0);
    }
  });

  test("NeedsIntelligence names what it MEASURED and what was AMBIGUOUS", () => {
    const f = baseFacts({
      checks: [failed(REQUIRED_CHECK), failed("lint (yaml/k8s)")],
      behindBy: 0,
      priorRerunAttempts: 2,
    });
    const d = classify(f);
    expect(d.kind).toBe("NeedsIntelligence");
    if (d.kind !== "NeedsIntelligence") throw new Error("unreachable");
    expect(d.measured.length).toBeGreaterThan(2);
    expect(d.ambiguity.length).toBeGreaterThan(40);
    // "couldn't handle it" is exactly what this arm must never say.
    expect(d.ambiguity.toLowerCase()).not.toContain("could not handle");
    expect(why(d)).toContain("ESCALATION");
  });

  test("escalation is a CASE, not a fallback — it is reachable and distinct from Unknown", () => {
    const escalated = classify(
      baseFacts({ checks: [failed(REQUIRED_CHECK), failed("x")], behindBy: 0, priorRerunAttempts: 1 }),
    );
    const unknown = classify(baseFacts({ localMerge: "unknown" }));
    expect(escalated.kind).toBe("NeedsIntelligence");
    expect(unknown.kind).toBe("Unknown");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PER-ARM DETECTION — one test per class in the 2026-08-26 evidence base
// ─────────────────────────────────────────────────────────────────────────────

describe("the measured evidence classes", () => {
  test("ownership outranks EVERYTHING, including a real conflict", () => {
    const f = baseFacts({
      branchHeldElsewhere: true,
      localMerge: "conflict",
      conflictPaths: ["a"],
      checks: [failed(REQUIRED_CHECK)],
    });
    expect(classify(f).kind).toBe("OwnedElsewhere");
    expect(propose(f).action).toBe("NoAction");
  });

  test("never ran: merge ref 404 with a settled remote opinion is Undispatchable, and escalates", () => {
    const f = baseFacts({ mergeRefExists: false, localMerge: "clean", remoteMergeable: "MERGEABLE" });
    expect(classify(f).kind).toBe("VerdictUndispatchable");
    expect(propose(f).action).toBe("Escalate");
    expect(propose(f).autoExecutable).toBe(false);
  });

  test("merge ref 404 while GitHub is STILL COMPUTING is Unknown — the #15756 regression", () => {
    // Measured live 2026-08-27: PR #15756, mergeable=null, merge ref 404 at
    // T+16min. The first version of classify() called this Undispatchable.
    const f = baseFacts({ number: 15756, mergeRefExists: false, localMerge: "clean", remoteMergeable: "UNKNOWN" });
    const d = classify(f);
    expect(d.kind).toBe("Unknown");
    if (d.kind !== "Unknown") throw new Error("unreachable");
    expect(d.evidence).toContain("remoteMergeable=UNKNOWN");
  });

  test("retarget-no-event: required check absent, nothing red -> merge main (fires synchronize)", () => {
    const f = baseFacts({ checks: [], requiredCheckNames: [REQUIRED_CHECK] });
    expect(classify(f).kind).toBe("VerdictNotDispatched");
    const p = propose(f);
    expect(p.action).toBe("MergeMainAndPush");
    expect(p.autoExecutable).toBe(true);
    // The prose must name the missing trigger, since that is the actual cause.
    expect(p.why).toContain("edited");
  });

  test("stale verdict (behind main) -> MergeMainAndPush, NOT RerunFailedJobs", () => {
    const f = baseFacts({ checks: [failed(REQUIRED_CHECK), failed("test (TS hermetic)")], behindBy: 67 });
    expect(classify(f).kind).toBe("VerdictStale");
    // A re-run replays the pinned merge commit and would miss main's fix.
    expect(propose(f).action).toBe("MergeMainAndPush");
  });

  test("suspected flake (current with main, probe unspent) -> RerunFailedJobs", () => {
    const f = baseFacts({ checks: [failed(REQUIRED_CHECK), failed("lint (bash retirement inventory)")], behindBy: 0 });
    expect(classify(f).kind).toBe("SuspectedInfraFlake");
    const p = propose(f);
    expect(p.action).toBe("RerunFailedJobs");
    expect(p.autoExecutable).toBe(true);
    expect(p.args.runId).toBe(11);
  });

  test("the cheap probe is spent ONCE — a second identical rerun escalates instead", () => {
    const f = baseFacts({ checks: [failed(REQUIRED_CHECK), failed("x")], behindBy: 0, priorRerunAttempts: 1 });
    expect(classify(f).kind).toBe("NeedsIntelligence");
    expect(propose(f).action).toBe("Escalate");
  });

  test("frozen lane is recognised mechanically but retiring is PROPOSAL ONLY", () => {
    const f = baseFacts({ isFrozenLane: true, headRef: "heartbeat/pr-archive" });
    expect(classify(f).kind).toBe("FrozenLane");
    const p = propose(f);
    expect(p.action).toBe("ProposeRetireLane");
    expect(p.autoExecutable).toBe(false);
  });

  test("retire-vs-recover is exactly the judgement the machine refuses to make", () => {
    // #15709 was retired, #15724 was recovered, by the same operator, same night.
    // Both are FrozenLane-shaped from outside. The DU must not pick.
    const a = baseFacts({ number: 15709, isFrozenLane: true, headRef: "heartbeat/red-state" });
    const b = baseFacts({ number: 15724, isFrozenLane: true, headRef: "heartbeat/red-state" });
    expect(classify(a).kind).toBe(classify(b).kind);
    expect(propose(a).autoExecutable).toBe(false);
    expect(propose(b).autoExecutable).toBe(false);
  });

  test("a PR's own failure is never auto-remediated", () => {
    const f = baseFacts({
      checks: [failed(REQUIRED_CHECK), failed("test", ["src/a.ts"])],
      diffPaths: ["src/a.ts"],
      behindBy: 9,
    });
    expect(classify(f).kind).toBe("OwnFailure");
    expect(propose(f).autoExecutable).toBe(false);
  });

  test("running checks mean WAIT, and waiting touches nothing", () => {
    const f = baseFacts({ checks: [running(REQUIRED_CHECK)] });
    expect(classify(f).kind).toBe("AwaitingVerdict");
    const p = propose(f);
    expect(p.action).toBe("Wait");
    expect(p.autoExecutable).toBe(false);
    expect(ACTION_REGISTRY.Wait.reversibility).toBe("inert");
  });

  test("a required check absent ALONGSIDE failures is Unknown, never a pass", () => {
    const f = baseFacts({ checks: [failed("test (TS hermetic)")], requiredCheckNames: [REQUIRED_CHECK] });
    const d = classify(f);
    expect(d.kind).toBe("Unknown");
    if (d.kind !== "Unknown") throw new Error("unreachable");
    expect(d.reason).toContain("never ran is not a check that passed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DETECTOR-LEVEL FALSIFIERS — these are what the mutation run kills
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// THE FOURTH CLASS — a workflow held for manual approval (live: PR #15772)
// ─────────────────────────────────────────────────────────────────────────────

describe("VerdictAwaitingApproval — escalate-only, because the remedy is a privilege", () => {
  test("the live #15772 shape classifies as VerdictAwaitingApproval", () => {
    const d = classify(awaitingApprovalFacts());
    expect(d.kind).toBe("VerdictAwaitingApproval");
    if (d.kind !== "VerdictAwaitingApproval") throw new Error("unreachable");
    expect(d.runId).toBe(33036398592);
    expect(d.jobCount).toBe(0);
    expect(d.mergeRefExists).toBe(true);
  });

  test("it is NOT auto-executable, and the action is the inert escalation", () => {
    const p = propose(awaitingApprovalFacts());
    expect(p.action).toBe("Escalate");
    expect(p.autoExecutable).toBe(false);
    expect(ACTION_REGISTRY.Escalate.reversibility).toBe("inert");
  });

  test("the escalation carries run id, conclusion, job count, and the merge-ref fact", () => {
    const w = propose(awaitingApprovalFacts()).why;
    expect(w).toContain("33036398592");
    expect(w).toContain("action_required");
    expect(w).toContain("0 job(s)");
    // A reader must not be sent chasing a conflict that is not there.
    expect(w).toContain("EXISTS");
    expect(w).toContain("NOT a conflict");
  });

  test("the closed set contains NO arm that approves a run or edits a policy", () => {
    for (const name of Object.keys(ACTION_REGISTRY)) {
      expect(name.toLowerCase()).not.toContain("approve");
      expect(name.toLowerCase()).not.toContain("permission");
      expect(name.toLowerCase()).not.toContain("policy");
    }
    // And no arm reachable from this disposition is executable at all.
    expect(mayAutoExecute(propose(awaitingApprovalFacts()).action)).toBe(false);
  });

  test("it OUTRANKS FrozenLane — else it proposes retiring a lane that is merely waiting", () => {
    // This is what actually happened before the arm existed: #15772 hit
    // FrozenLane and proposed ProposeRetireLane. Proposal-only, so safe — but
    // the wrong diagnosis, and it would have destroyed live telemetry.
    const p = propose(awaitingApprovalFacts({ isFrozenLane: true }));
    expect(p.disposition.kind).toBe("VerdictAwaitingApproval");
    expect(p.action).not.toBe("ProposeRetireLane");
  });

  test("REGRESSION: a non-lane PR in this state must NOT get an automatable action", () => {
    // The latent defect. Without the new arm, `isFrozenLane: false` falls
    // through to VerdictNotDispatched -> MergeMainAndPush [AUTO] — and a push
    // from a non-approval-requiring credential may be exactly what creates a
    // runnable event, making the automation a bypass of an approval gate.
    const p = propose(awaitingApprovalFacts({ headRef: "feat/ordinary", isFrozenLane: false }));
    expect(p.disposition.kind).toBe("VerdictAwaitingApproval");
    expect(p.action).not.toBe("MergeMainAndPush");
    expect(p.autoExecutable).toBe(false);
  });

  test("the detector needs BOTH conjuncts — conclusion alone is not enough", () => {
    // A run that executed jobs and then requested a follow-up action is a
    // different state with a different remedy.
    const ranThenAsked = awaitingApprovalFacts({
      gateRun: { id: 7, status: "completed", conclusion: "action_required", jobCount: 12 },
    });
    expect(isAwaitingApproval(ranThenAsked)).toBe(false);
    expect(classify(ranThenAsked).kind).not.toBe("VerdictAwaitingApproval");
  });

  test("a QUEUED run also has zero jobs — jobCount alone must NOT imply approval-held", () => {
    // Found by a surviving mutant: keying the detector on `jobCount === 0`
    // alone passed every test. It is wrong, and wrong in the #15756 direction —
    // a run that has not started yet has zero jobs and `conclusion: null`.
    // Escalating that would report a privilege boundary for a PR that is simply
    // warming up.
    const queued = awaitingApprovalFacts({
      gateRun: { id: 8, status: "queued", conclusion: null, jobCount: 0 },
    });
    expect(isAwaitingApproval(queued)).toBe(false);
    expect(classify(queued).kind).not.toBe("VerdictAwaitingApproval");

    // Same for a run cancelled before any job started.
    const cancelledEarly = awaitingApprovalFacts({
      gateRun: { id: 9, status: "completed", conclusion: "cancelled", jobCount: 0 },
    });
    expect(isAwaitingApproval(cancelledEarly)).toBe(false);
  });

  test("an UNANSWERED jobs probe never manufactures the diagnosis", () => {
    // jobCount === -1 means "not measured". Zero is the positive signal, so
    // defaulting an unanswered probe to zero would invent the class.
    const unmeasured = awaitingApprovalFacts({
      gateRun: { id: 7, status: "completed", conclusion: "action_required", jobCount: -1 },
    });
    expect(isAwaitingApproval(unmeasured)).toBe(false);
  });

  test("no gate run at all is NOT this class — that is the retarget/never-ran shape", () => {
    expect(isAwaitingApproval(baseFacts({ gateRun: null }))).toBe(false);
    const d = classify(baseFacts({ gateRun: null, checks: [], requiredCheckNames: [REQUIRED_CHECK] }));
    expect(d.kind).toBe("VerdictNotDispatched");
  });

  test("it is distinguished from the dirty class by the merge ref EXISTING", () => {
    const f = awaitingApprovalFacts();
    expect(f.mergeRefExists).toBe(true);
    expect(f.localMerge).toBe("clean");
    expect(classify(f).kind).not.toBe("MergeConflicted");
    expect(classify(f).kind).not.toBe("VerdictUndispatchable");
  });
});

describe("detectors", () => {
  test("the aggregator is never counted as a cause", () => {
    expect(rootFailures([failed(REQUIRED_CHECK)])).toEqual([]);
    expect(rootFailures([failed(REQUIRED_CHECK), failed("test")])).toEqual(["test"]);
  });

  test("attribution withholds on an underivable subject", () => {
    expect(isAttributable(failed("t", []), ["src/a.ts"])).toBe(false);
    expect(isAttributable(failed("t", ["src/b.ts"]), ["src/a.ts"])).toBe(false);
    expect(isAttributable(failed("t", ["src/a.ts"]), ["src/a.ts"])).toBe(true);
  });

  test("a healthy unarmed PR gets armed; a healthy armed PR is left alone", () => {
    expect(propose(baseFacts({ autoMergeArmed: false })).action).toBe("ReArmAutoMerge");
    expect(propose(baseFacts({ autoMergeArmed: true })).action).toBe("NoAction");
  });
});
