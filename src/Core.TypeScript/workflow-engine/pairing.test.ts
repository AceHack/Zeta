/**
 * src/Core.TypeScript/workflow-engine/pairing.test.ts
 *
 * 081KSNY2Z0008QG0R001YK61JQ.4 — invariant tests for pairing tracker.
 */

import { describe, expect, it } from "bun:test";
import {
  EMPTY_PAIRING_STATE,
  countVerdicts,
  findStaleEmissions,
  findUnverifiedEmissions,
  propagatableEmissionIds,
  recordEmission,
  recordVerification,
  type Emission,
  type PairingRole,
  type PairingState,
  type Verification,
  type VerificationVerdict,
} from "./pairing";

/**
 * Test helper: assert the discriminated-union result is `ok: true` and
 * return its state — replaces the `.state!` non-null assertion that
 * bypasses TypeScript's type narrowing on `PairingResult`. If the
 * operation unexpectedly fails, this surfaces the failure-mode
 * substrate immediately instead of silently propagating `undefined`
 * into downstream state.
 */
function mustState(r: { ok: true; state: PairingState } | { ok: false; feedback: unknown }): PairingState {
  if (!r.ok) {
    throw new Error(`unexpected pairing feedback: ${JSON.stringify(r.feedback)}`);
  }
  return r.state;
}

const emission = (id: string, atMs: number): Emission => ({
  id,
  producerId: "producer-1",
  substrate: { hypothesis: `h-${id}` },
  emittedAtMs: atMs,
  composesWith: [`source-${id}`],
});

const verification = (emissionId: string, atMs: number, verdict: VerificationVerdict): Verification => ({
  emissionId,
  verifierId: "verifier-1",
  verdict,
  verifiedAtMs: atMs,
});

describe("081KSNY2Z0008QG0R001YK61JQ.4 pairing tracker substrate", () => {
  it("records an emission to empty state", () => {
    const result = recordEmission(EMPTY_PAIRING_STATE, emission("e1", 1000));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.emissions.size).toBe(1);
    expect(result.state.verifications.size).toBe(0);
  });

  it("rejects duplicate emission id", () => {
    const r1 = recordEmission(EMPTY_PAIRING_STATE, emission("e1", 1000));
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = recordEmission(r1.state, emission("e1", 2000));
    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.feedback.kind).toBe("DuplicateEmissionId");
  });

  it("records verification for known emission", () => {
    const r1 = recordEmission(EMPTY_PAIRING_STATE, emission("e1", 1000));
    if (!r1.ok) throw new Error("emission failed");
    const r2 = recordVerification(r1.state, verification("e1", 2000, { kind: "verified" }));
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.state.verifications.size).toBe(1);
  });

  it("rejects verification for unknown emission", () => {
    const r = recordVerification(EMPTY_PAIRING_STATE, verification("nonexistent", 2000, { kind: "verified" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.feedback.kind).toBe("VerificationForUnknownEmission");
  });

  it("rejects duplicate verification", () => {
    const r1 = recordEmission(EMPTY_PAIRING_STATE, emission("e1", 1000));
    if (!r1.ok) throw new Error("emission failed");
    const r2 = recordVerification(r1.state, verification("e1", 2000, { kind: "verified" }));
    if (!r2.ok) throw new Error("first verify failed");
    const r3 = recordVerification(r2.state, verification("e1", 3000, { kind: "rejected", reason: "x" }));
    expect(r3.ok).toBe(false);
    if (r3.ok) return;
    expect(r3.feedback.kind).toBe("DuplicateVerification");
  });

  it("rejects verification before emission timestamp (causality violation)", () => {
    const r1 = recordEmission(EMPTY_PAIRING_STATE, emission("e1", 2000));
    if (!r1.ok) throw new Error("emission failed");
    const r2 = recordVerification(r1.state, verification("e1", 1000, { kind: "verified" }));
    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.feedback.kind).toBe("VerificationTooEarly");
  });

  it("findUnverifiedEmissions returns emissions without verifications", () => {
    let s = EMPTY_PAIRING_STATE;
    const r1 = recordEmission(s, emission("e1", 1000));
    if (!r1.ok) throw new Error("e1");
    s = r1.state;
    const r2 = recordEmission(s, emission("e2", 1500));
    if (!r2.ok) throw new Error("e2");
    s = r2.state;
    const r3 = recordVerification(s, verification("e1", 2000, { kind: "verified" }));
    if (!r3.ok) throw new Error("v1");
    s = r3.state;
    const unverified = findUnverifiedEmissions(s);
    expect(unverified.length).toBe(1);
    expect(unverified[0]!.id).toBe("e2");
  });

  it("findStaleEmissions returns emissions past the bounded window", () => {
    let s = EMPTY_PAIRING_STATE;
    const r1 = recordEmission(s, emission("e1", 1000));
    if (!r1.ok) throw new Error("e1");
    s = r1.state;
    const r2 = recordEmission(s, emission("e2", 5000));
    if (!r2.ok) throw new Error("e2");
    s = r2.state;
    // now = 10_000; timeoutMs = 4000
    const stale = findStaleEmissions(s, 10_000, 4000);
    expect(stale.length).toBe(2); // both exceeded window
    const stale2 = findStaleEmissions(s, 6000, 4000);
    expect(stale2.length).toBe(1); // only e1 exceeded
    expect(stale2[0]!.id).toBe("e1");
  });

  it("findStaleEmissions boundary semantics: emission exactly at timeout is NOT stale (strict >)", () => {
    // Locks in the strict > boundary documented in findStaleEmissions:
    // an emission at (nowMs - emittedAtMs === timeoutMs) gets the
    // boundary tick to be verified before becoming stale. Switch to >=
    // here AND in pairing.ts together if SLA semantics ever change.
    let s = EMPTY_PAIRING_STATE;
    const r1 = recordEmission(s, emission("e1", 1000));
    if (!r1.ok) throw new Error("e1");
    s = r1.state;
    // nowMs - emittedAtMs === timeoutMs exactly: 5000 - 1000 === 4000
    const atBoundary = findStaleEmissions(s, 5000, 4000);
    expect(atBoundary.length).toBe(0); // strict > means NOT stale at boundary
    // One ms past boundary: 5001 - 1000 > 4000
    const justPast = findStaleEmissions(s, 5001, 4000);
    expect(justPast.length).toBe(1);
    expect(justPast[0]!.id).toBe("e1");
  });

  it("findStaleEmissions excludes verified emissions even if old", () => {
    let s = EMPTY_PAIRING_STATE;
    const r1 = recordEmission(s, emission("e1", 1000));
    if (!r1.ok) throw new Error("e1");
    s = r1.state;
    const r2 = recordVerification(s, verification("e1", 1500, { kind: "verified" }));
    if (!r2.ok) throw new Error("v1");
    s = r2.state;
    // e1 emitted at 1000; verified at 1500; now = 10_000; would be stale if unverified
    const stale = findStaleEmissions(s, 10_000, 1000);
    expect(stale.length).toBe(0); // verified, so not stale
  });

  it("countVerdicts aggregates verdicts correctly", () => {
    let s = EMPTY_PAIRING_STATE;
    for (let i = 1; i <= 5; i++) {
      const r = recordEmission(s, emission(`e${i}`, 1000 + i * 100));
      if (!r.ok) throw new Error(`e${i}`);
      s = r.state;
    }
    s = mustState(recordVerification(s, verification("e1", 2000, { kind: "verified" })));
    s = mustState(recordVerification(s, verification("e2", 2000, { kind: "verified" })));
    s = mustState(recordVerification(s, verification("e3", 2000, { kind: "rejected", reason: "flawed" })));
    s = mustState(recordVerification(s, verification("e4", 2000, { kind: "needs-revision", suggestions: ["fix x"] })));
    // e5 left unverified
    const counts = countVerdicts(s);
    expect(counts.verified).toBe(2);
    expect(counts.rejected).toBe(1);
    expect(counts.needsRevision).toBe(1);
    expect(counts.unverified).toBe(1);
    expect(counts.total).toBe(5);
  });

  it("propagatableEmissionIds includes verified + needs-revision-with-suggestions; excludes rejected + empty-suggestions", () => {
    let s = EMPTY_PAIRING_STATE;
    for (let i = 1; i <= 4; i++) {
      const r = recordEmission(s, emission(`e${i}`, 1000 + i * 100));
      if (!r.ok) throw new Error(`e${i}`);
      s = r.state;
    }
    s = mustState(recordVerification(s, verification("e1", 2000, { kind: "verified" })));
    s = mustState(recordVerification(s, verification("e2", 2000, { kind: "rejected", reason: "flawed" })));
    s = mustState(recordVerification(s, verification("e3", 2000, { kind: "needs-revision", suggestions: ["fix x"] })));
    s = mustState(recordVerification(s, verification("e4", 2000, { kind: "needs-revision", suggestions: [] })));
    const propagatable = propagatableEmissionIds(s);
    expect(propagatable.length).toBe(2);
    expect(propagatable).toContain("e1");
    expect(propagatable).toContain("e3");
    expect(propagatable).not.toContain("e2"); // rejected excluded
    expect(propagatable).not.toContain("e4"); // empty suggestions excluded
  });

  it("immutable state operations: original state unchanged after record", () => {
    const r1 = recordEmission(EMPTY_PAIRING_STATE, emission("e1", 1000));
    expect(r1.ok).toBe(true);
    expect(EMPTY_PAIRING_STATE.emissions.size).toBe(0); // original unchanged
    if (!r1.ok) return;
    const r2 = recordVerification(r1.state, verification("e1", 2000, { kind: "verified" }));
    expect(r2.ok).toBe(true);
    expect(r1.state.verifications.size).toBe(0); // intermediate state unchanged
  });

  it("VerificationVerdict union exhaustive switch (compile-time check)", () => {
    const acknowledge = (v: VerificationVerdict): string => {
      switch (v.kind) {
        case "verified":
        case "rejected":
        case "needs-revision":
          return v.kind;
      }
    };
    expect(acknowledge({ kind: "verified" })).toBe("verified");
    expect(acknowledge({ kind: "rejected", reason: "x" })).toBe("rejected");
    expect(acknowledge({ kind: "needs-revision", suggestions: [] })).toBe("needs-revision");
  });

  it("PairingRole union exhaustive switch (compile-time check)", () => {
    const acknowledge = (r: PairingRole): string => {
      switch (r) {
        case "producer":
        case "verifier":
          return r;
      }
    };
    expect(acknowledge("producer")).toBe("producer");
    expect(acknowledge("verifier")).toBe("verifier");
  });

  it("tournament-loop composition: emissions → verifications → propagatable → next stage", () => {
    // Simulates the full producer-verifier-tournament loop
    let s = EMPTY_PAIRING_STATE;
    // Round 1: 3 emissions
    for (let i = 1; i <= 3; i++) {
      s = mustState(recordEmission(s, emission(`h${i}`, 1000 + i * 100)));
    }
    // Verifier-thread reflects
    s = mustState(recordVerification(s, verification("h1", 2000, { kind: "verified" })));
    s = mustState(recordVerification(s, verification("h2", 2000, { kind: "rejected", reason: "logic gap" })));
    s = mustState(
      recordVerification(s, verification("h3", 2000, { kind: "needs-revision", suggestions: ["clarify mechanism"] })),
    );
    // Propagatable to next stage
    const next = propagatableEmissionIds(s);
    expect(next.length).toBe(2); // h1 + h3
    // Pairing complete (no unverified)
    const stale = findStaleEmissions(s, 5000, 1000);
    expect(stale.length).toBe(0);
    // Aggregate state
    const counts = countVerdicts(s);
    expect(counts.verified + counts.rejected + counts.needsRevision).toBe(counts.total);
  });
});
