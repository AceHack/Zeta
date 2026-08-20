/**
 * policy-and-lifecycle.test.ts — attestation, HSM authorization, the ceremony
 * gate, rotation planning, seed bootstrap, and the raw-vault verdict store.
 *
 * Every positive is paired with a negative computed by the same code path, and
 * the closed unions (`FederatedIdentityOperation`) are enumerated so nothing
 * passes by not being looked at.
 */

import { describe, expect, test } from "bun:test";

import { createSoftwareWorkloadAttestor, validateSelectorRules, attestationDigestOf } from "./workload-attestation.ts";
import { decideHsmAccess, spiffeIdMatchesPrefix, validateHsmDomainMap, type HsmDomainGrant } from "./hsm-domain-map.ts";
import {
  ALL_OPERATIONS,
  ceremonyRequirementFor,
  isUnattended,
  type FederatedIdentityOperation,
} from "./ceremony-gate.ts";
import {
  checkpointDeadlinePhase,
  planBundleRefresh,
  planRotation,
  renewAtPhase,
  validateRotationPolicy,
  type RotationPolicy,
} from "./rotation.ts";
import {
  COMMON_SEED_S,
  toyEvaluateReconstruction,
  toyReconstruct,
  toyRespondToChallenge,
  type SeedChallenge,
} from "./seed-bootstrap.ts";
import {
  decorrelation,
  deriveActionableView,
  EMPTY_VAULT,
  loadVerdict,
  observersOf,
  type RecordedVerdict,
} from "./verdict-vault.ts";
import { type ObservedProcess } from "./ports.ts";
import { type SvidClaim } from "./local-issuer.ts";

// ── workload attestation ─────────────────────────────────────────────────────

describe("workload attestation", () => {
  const BIN = "c".repeat(64);
  const OTHER = "d".repeat(64);
  const rules = validateSelectorRules([
    { spiffePath: "/agent/otto", requireUid: 501, requireBinarySha256: BIN },
    { spiffePath: "/agent/amara", requireUid: 502, requireBinarySha256: OTHER },
  ]);
  if (!rules.ok) throw new Error("fixture");
  const attestor = createSoftwareWorkloadAttestor(rules.value);
  const good: ObservedProcess = { pid: 10, uid: 501, binarySha256: BIN };

  test("a matching process is attested to its path, with no secret presented", () => {
    const r = attestor.attest(good, 100);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.spiffePath).toBe("/agent/otto");
  });

  test("NEGATIVE: a wrong uid, a wrong binary, and an unknown process all refuse", () => {
    expect(attestor.attest({ ...good, uid: 999 }, 100).ok).toBe(false);
    expect(attestor.attest({ ...good, binarySha256: OTHER }, 100).ok).toBe(false);
    expect(attestor.attest({ pid: 11, uid: 0, binarySha256: "e".repeat(64) }, 100).ok).toBe(false);
  });

  test("NEGATIVE: ambiguity refuses rather than picking the first rule", () => {
    const amb = validateSelectorRules([
      { spiffePath: "/agent/a", requireUid: 501 },
      { spiffePath: "/agent/b", requireBinarySha256: BIN },
    ]);
    if (!amb.ok) throw new Error("fixture");
    const r = createSoftwareWorkloadAttestor(amb.value).attest(good, 100);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error.kind).toBe("ambiguous-selectors");
  });

  test("NEGATIVE: a rule with NO constraints is refused at validation — it would match everything", () => {
    const bad = validateSelectorRules([{ spiffePath: "/agent/anything" }]);
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("unreachable");
    expect(bad.error.kind).toBe("rule-has-no-constraints");
  });

  test("NEGATIVE: malformed observations are refused, not coerced", () => {
    expect(attestor.attest({ ...good, pid: 0 }, 100).ok).toBe(false);
    expect(attestor.attest({ ...good, binarySha256: "short" }, 100).ok).toBe(false);
  });

  test("the digest excludes pid — a recycled pid must not change a credential's meaning", () => {
    const a = attestor.attest({ ...good, pid: 10 }, 100);
    const b = attestor.attest({ ...good, pid: 99999 }, 100);
    if (!a.ok || !b.ok) throw new Error("unreachable");
    expect(a.value.attestationDigest).toBe(b.value.attestationDigest);
    // NEGATIVE control: a different matched selector set DOES change it.
    expect(attestationDigestOf("/agent/otto", { uid: 501 })).not.toBe(attestationDigestOf("/agent/otto", { uid: 502 }));
  });
});

// ── HSM domain authorization ─────────────────────────────────────────────────

describe("SPIFFE-ID → HSM domain", () => {
  const grants: readonly HsmDomainGrant[] = [
    { spiffeIdPrefix: "spiffe://node-a.zeta.local/agent/otto", hsmDomain: 3, allowedMechanisms: ["ecdsa-sha256"] },
    {
      spiffeIdPrefix: "spiffe://node-a.zeta.local/agent/amara",
      hsmDomain: 4,
      allowedMechanisms: ["ed25519", "eck256"],
    },
  ];
  const decide = (spiffeId: string, mechanism: string) =>
    decideHsmAccess({ grants, spiffeId, mechanism, requireTrustDomain: "node-a.zeta.local" });

  test("an authorized identity reaches its own domain", () => {
    const v = decide("spiffe://node-a.zeta.local/agent/otto", "ecdsa-sha256");
    expect(v.allowed).toBe(true);
    expect(v.hsmDomain).toBe(3);
    // ...and the verdict says out loud that it is a decision, not enforcement.
    expect(v.reason).toContain("DECISION only");
  });

  test("NEGATIVE: a workload may not use another workload's domain", () => {
    expect(decide("spiffe://node-a.zeta.local/agent/amara", "ecdsa-sha256").allowed).toBe(false);
  });

  test("NEGATIVE: prefix matching is segment-aware — 'otto-evil' does not inherit 'otto'", () => {
    expect(
      spiffeIdMatchesPrefix("spiffe://node-a.zeta.local/agent/otto-evil", "spiffe://node-a.zeta.local/agent/otto"),
    ).toBe(false);
    expect(decide("spiffe://node-a.zeta.local/agent/otto-evil", "ecdsa-sha256").allowed).toBe(false);
    // POSITIVE control: a genuine sub-path does inherit.
    expect(
      spiffeIdMatchesPrefix("spiffe://node-a.zeta.local/agent/otto/worker", "spiffe://node-a.zeta.local/agent/otto"),
    ).toBe(true);
  });

  test("NEGATIVE: accepting a PEER's identity does not grant it local hardware", () => {
    const v = decide("spiffe://node-b.zeta.local/agent/otto", "ecdsa-sha256");
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("not granting it your HSM");
  });

  test("NEGATIVE: a mechanism the device does not have is refused, FROST named explicitly", () => {
    const v = decide("spiffe://node-a.zeta.local/agent/otto", "frost-ed25519");
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("FROST");
  });

  test("NEGATIVE: a device mechanism outside this identity's grant is still refused", () => {
    expect(decide("spiffe://node-a.zeta.local/agent/otto", "ed25519").allowed).toBe(false);
  });

  test("NEGATIVE: deny by default for an unlisted identity", () => {
    expect(decide("spiffe://node-a.zeta.local/agent/nobody", "ecdsa-sha256").allowed).toBe(false);
  });

  test("map validation refuses overlaps, bad domains, and empty mechanism lists", () => {
    expect(validateHsmDomainMap(grants).ok).toBe(true);
    expect(
      validateHsmDomainMap([
        ...grants,
        { spiffeIdPrefix: "spiffe://node-a.zeta.local/agent/otto/sub", hsmDomain: 5, allowedMechanisms: ["ed25519"] },
      ]).ok,
    ).toBe(false);
    expect(
      validateHsmDomainMap([
        { spiffeIdPrefix: "spiffe://node-a.zeta.local/x", hsmDomain: 0, allowedMechanisms: ["ed25519"] },
      ]).ok,
    ).toBe(false);
    expect(
      validateHsmDomainMap([
        { spiffeIdPrefix: "spiffe://node-a.zeta.local/x", hsmDomain: 17, allowedMechanisms: ["ed25519"] },
      ]).ok,
    ).toBe(false);
    expect(
      validateHsmDomainMap([{ spiffeIdPrefix: "spiffe://node-a.zeta.local/x", hsmDomain: 3, allowedMechanisms: [] }])
        .ok,
    ).toBe(false);
    expect(
      validateHsmDomainMap([{ spiffeIdPrefix: "not-a-spiffe-id", hsmDomain: 3, allowedMechanisms: ["ed25519"] }]).ok,
    ).toBe(false);
  });
});

// ── the ceremony gate ────────────────────────────────────────────────────────

describe("ceremony gate", () => {
  test("the routine credential lifecycle is unattended end to end", () => {
    for (const op of [
      "issue-leaf-svid",
      "renew-leaf-svid",
      "rotate-leaf-signing-key",
      "refresh-peer-bundle-with-continuity",
    ] as const) {
      expect(isUnattended(op)).toBe(true);
    }
  });

  test("NEGATIVE: everything that establishes or widens trust, or is irreversible, is gated", () => {
    for (const op of [
      "generate-node-root-key",
      "rotate-node-root-key",
      "accept-new-trust-domain-first-contact",
      "repair-broken-continuity",
      "resolve-bundle-conflict",
      "remap-hsm-domain",
      "widen-standing-budget",
      "x402-authorize-exceeding-standing-budget",
      "export-or-destroy-key",
      "open-authenticated-hsm-session",
      "provision-or-reconfigure-hardware-token",
    ] as const) {
      expect(ceremonyRequirementFor(op).requirement).toBe("biometric-ceremony");
    }
  });

  test("the leaf/root asymmetry is the whole design: leaf rotation unattended, ROOT rotation gated", () => {
    expect(isUnattended("rotate-leaf-signing-key")).toBe(true);
    expect(isUnattended("rotate-node-root-key")).toBe(false);
  });

  test("ALL_OPERATIONS matches the union exactly — no operation escapes classification", () => {
    // If a member were added to the union and not to this array, the exhaustive
    // switch would still compile (the array is just data), so assert both ways.
    expect(new Set(ALL_OPERATIONS).size).toBe(ALL_OPERATIONS.length);
    for (const op of ALL_OPERATIONS) {
      const c = ceremonyRequirementFor(op);
      expect(c.operation).toBe(op);
      expect(c.reason.length).toBeGreaterThan(20); // a gate with no reason is a gate nobody trusts
    }
    // Both classes are non-empty — a gate where everything is unattended, or
    // everything is gated, would be a classifier that classifies nothing.
    const unattended = ALL_OPERATIONS.filter(isUnattended);
    expect(unattended.length).toBeGreaterThan(0);
    expect(unattended.length).toBeLessThan(ALL_OPERATIONS.length);
  });

  test("a typo-shaped operation is not silently unattended (the union is closed)", () => {
    // `as` is required to even express this, which is the point: the closed set
    // means a peer can NAME an operation and never DEFINE one.
    const bogus = "delete-everything" as FederatedIdentityOperation;
    expect(ceremonyRequirementFor(bogus)).toBeUndefined();
  });
});

// ── rotation ─────────────────────────────────────────────────────────────────

describe("rotation planning", () => {
  const policy: RotationPolicy = { lifetimePhases: 100, renewAtFraction: 0.5, checkpointReservePhases: 20 };
  const claim = { issuedAtPhase: 1000, expiresAtPhase: 1100 } as SvidClaim;
  const plan = (currentPhase: number, failed = 0) =>
    planRotation({ claim, policy, currentPhase, renewalAttemptsFailed: failed });

  test("the four bands are reached in order", () => {
    expect(renewAtPhase(claim, policy)).toBe(1050);
    expect(checkpointDeadlinePhase(claim, policy)).toBe(1080);
    expect(plan(1010).band).toBe("healthy");
    expect(plan(1050).band).toBe("renewing");
    expect(plan(1080).band).toBe("draining");
    expect(plan(1100).band).toBe("expired");
  });

  test("boundaries are exact, not approximate", () => {
    expect(plan(1049).band).toBe("healthy");
    expect(plan(1079).band).toBe("renewing");
    expect(plan(1099).band).toBe("draining");
  });

  test("work disposition answers 'does it lose work': the reserve exists BEFORE expiry", () => {
    expect(plan(1010).workDisposition).toBe("proceed");
    expect(plan(1050).workDisposition).toBe("proceed-and-renew");
    expect(plan(1085, 3).workDisposition).toBe("drain-and-checkpoint");
    expect(plan(1100).workDisposition).toBe("fail-closed");
  });

  test("NEGATIVE: a policy whose reserve swallows the renew window is refused", () => {
    expect(validateRotationPolicy(policy).ok).toBe(true);
    const bad = validateRotationPolicy({ lifetimePhases: 100, renewAtFraction: 0.9, checkpointReservePhases: 30 });
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("unreachable");
    expect(bad.error.kind).toBe("reserve-swallows-renew-window");
  });

  test("NEGATIVE: degenerate policies are refused", () => {
    expect(validateRotationPolicy({ ...policy, lifetimePhases: 0 }).ok).toBe(false);
    expect(validateRotationPolicy({ ...policy, renewAtFraction: 0 }).ok).toBe(false);
    expect(validateRotationPolicy({ ...policy, renewAtFraction: 1 }).ok).toBe(false);
    expect(validateRotationPolicy({ ...policy, checkpointReservePhases: 0 }).ok).toBe(false);
  });

  test("bundle refresh: fresh, due, and stale — stale is a working mechanism, not a fault", () => {
    const p = { bundleIssuedAtPhase: 100, maxBundleAgePhases: 200, refreshAtFraction: 0.5 } as const;
    expect(planBundleRefresh({ ...p, currentPhase: 150 })).toMatchObject({ refreshNow: false, stale: false });
    expect(planBundleRefresh({ ...p, currentPhase: 200 })).toMatchObject({ refreshNow: true, stale: false });
    const stale = planBundleRefresh({ ...p, currentPhase: 400 });
    expect(stale).toMatchObject({ refreshNow: true, stale: true });
    expect(stale.reason).toContain("not a fault");
  });
});

// ── seed bootstrap ───────────────────────────────────────────────────────────

describe("seed reconstruction (toy)", () => {
  const challenge: SeedChallenge = {
    nonce: "chal-1",
    issuedAtPhase: 100,
    expiresAtPhase: 200,
    derivation: "toy-lcg-orbit-v0",
    steps: 64,
  };
  const spent: ReadonlySet<string> = new Set();

  test("a holder of the common seed reconstructs and is admitted", () => {
    const resp = toyRespondToChallenge(challenge, COMMON_SEED_S, 110);
    const v = toyEvaluateReconstruction({
      challenge,
      response: resp,
      seed: COMMON_SEED_S,
      currentPhase: 120,
      spentNonces: spent,
    });
    expect(v.sharesGenerator).toBe(true);
    // the scope disclosure travels with the verdict
    expect(v.reason).toContain("names nobody");
  });

  test("NEGATIVE: a party with a DIFFERENT seed fails", () => {
    const resp = toyRespondToChallenge(challenge, 5, 110);
    expect(
      toyEvaluateReconstruction({
        challenge,
        response: resp,
        seed: COMMON_SEED_S,
        currentPhase: 120,
        spentNonces: spent,
      }).code,
    ).toBe("answer-mismatch");
  });

  test("REPLAY RESISTANCE: an observer of one exchange cannot answer a DIFFERENT nonce", () => {
    const observed = toyRespondToChallenge(challenge, COMMON_SEED_S, 110);
    const fresh: SeedChallenge = { ...challenge, nonce: "chal-2" };
    const replayed = { ...observed, nonce: "chal-2" };
    expect(
      toyEvaluateReconstruction({
        challenge: fresh,
        response: replayed,
        seed: COMMON_SEED_S,
        currentPhase: 120,
        spentNonces: spent,
      }).code,
    ).toBe("answer-mismatch");
    // ...and the answers genuinely differ per nonce, so this is not luck.
    expect(toyReconstruct(COMMON_SEED_S, "chal-1", 64)).not.toBe(toyReconstruct(COMMON_SEED_S, "chal-2", 64));
  });

  test("NEGATIVE: a REUSED nonce is refused even with a correct answer", () => {
    const resp = toyRespondToChallenge(challenge, COMMON_SEED_S, 110);
    expect(
      toyEvaluateReconstruction({
        challenge,
        response: resp,
        seed: COMMON_SEED_S,
        currentPhase: 120,
        spentNonces: new Set(["chal-1"]),
      }).code,
    ).toBe("nonce-reused");
  });

  test("NEGATIVE: expiry, nonce mismatch, backdating, and an unknown derivation all refuse", () => {
    const resp = toyRespondToChallenge(challenge, COMMON_SEED_S, 110);
    expect(
      toyEvaluateReconstruction({
        challenge,
        response: resp,
        seed: COMMON_SEED_S,
        currentPhase: 300,
        spentNonces: spent,
      }).code,
    ).toBe("challenge-expired");
    expect(
      toyEvaluateReconstruction({
        challenge,
        response: { ...resp, nonce: "other" },
        seed: COMMON_SEED_S,
        currentPhase: 120,
        spentNonces: spent,
      }).code,
    ).toBe("nonce-mismatch");
    expect(
      toyEvaluateReconstruction({
        challenge,
        response: { ...resp, respondedAtPhase: 50 },
        seed: COMMON_SEED_S,
        currentPhase: 120,
        spentNonces: spent,
      }).code,
    ).toBe("responded-before-issued");
    expect(
      toyEvaluateReconstruction({
        challenge: { ...challenge, derivation: "future-v9" },
        response: resp,
        seed: COMMON_SEED_S,
        currentPhase: 120,
        spentNonces: spent,
      }).code,
    ).toBe("unsupported-derivation");
  });

  test("DST: the derivation is deterministic — same inputs, same answer, every run", () => {
    expect(toyReconstruct(COMMON_SEED_S, "x", 32)).toBe(toyReconstruct(COMMON_SEED_S, "x", 32));
  });
});

// ── the raw vault ────────────────────────────────────────────────────────────

describe("verdict vault (DV2.0 raw vault)", () => {
  const row = (
    observer: string,
    verdict: RecordedVerdict["verdict"],
    phase: number,
    source = "direct",
  ): RecordedVerdict => ({
    subject: "node-c.zeta.local",
    observerTrustDomain: observer,
    verdict,
    reason: `${observer} says ${verdict}`,
    observedAtPhase: phase,
    recordSource: source,
  });

  const vault = [row("node-a.zeta.local", "accept", 100), row("node-b.zeta.local", "reject", 101)].reduce(
    loadVerdict,
    EMPTY_VAULT,
  );

  test("two observers disagreeing are BOTH retained — no reconciliation happens", () => {
    expect(vault.length).toBe(2);
    expect(observersOf(vault, "node-c.zeta.local")).toEqual(["node-a.zeta.local", "node-b.zeta.local"]);
    const d = decorrelation(vault, "node-c.zeta.local");
    expect(d.divergent).toBe(true);
    expect(d.reason).toContain("retained, not reconciled");
  });

  test("the library exposes NO reconcile / consensus / resolve — the absence is the design", async () => {
    const mod = (await import("./verdict-vault.ts")) as Record<string, unknown>;
    expect(Object.keys(mod).filter((k) => /reconcile|consensus|resolve|majority|winner/i.test(k))).toEqual([]);
  });

  test("a changed mind is history, not an overwrite", () => {
    const v2 = loadVerdict(vault, row("node-a.zeta.local", "reject", 200));
    expect(v2.length).toBe(3); // the earlier accept survives
    expect(decorrelation(v2, "node-c.zeta.local").byObserver.get("node-a.zeta.local")?.verdict).toBe("reject");
  });

  test("idempotent load: an exact duplicate row adds nothing; a differing one does", () => {
    expect(loadVerdict(vault, row("node-a.zeta.local", "accept", 100)).length).toBe(2);
    expect(loadVerdict(vault, row("node-a.zeta.local", "accept", 100, "via-gossip")).length).toBe(3);
  });

  test("DERIVED VIEW: the same vault yields DIFFERENT actions under different local policies", () => {
    const own = deriveActionableView({
      vault,
      subject: "node-c.zeta.local",
      actingObserver: "node-a.zeta.local",
      policy: { kind: "own-verdict-only" },
    });
    expect(own.act).toBe(true);
    expect(own.dissentingObservers).toEqual(["node-b.zeta.local"]);
    expect(own.reason).toContain("retained, not overridden");

    const cautious = deriveActionableView({
      vault,
      subject: "node-c.zeta.local",
      actingObserver: "node-a.zeta.local",
      policy: { kind: "own-verdict-and-no-dissent" },
    });
    expect(cautious.act).toBe(false);

    // and the vault is untouched by either derivation
    expect(vault.length).toBe(2);
  });

  test("NEGATIVE: a node with no verdict of its own does not act on someone else's", () => {
    const v = deriveActionableView({
      vault,
      subject: "node-c.zeta.local",
      actingObserver: "node-z.zeta.local",
      policy: { kind: "own-verdict-only" },
    });
    expect(v.act).toBe(false);
    expect(v.reason).toContain("deferring to an authority it did not choose");
  });

  test("corroboration consults only this node's OWN list, and refuses when short", () => {
    const wider = [row("node-d.zeta.local", "accept", 102)].reduce(loadVerdict, vault);
    const ok = deriveActionableView({
      vault: wider,
      subject: "node-c.zeta.local",
      actingObserver: "node-a.zeta.local",
      policy: { kind: "own-verdict-and-corroboration", minAgreeingPeers: 1, consultOnly: ["node-d.zeta.local"] },
    });
    expect(ok.act).toBe(true);
    const short = deriveActionableView({
      vault: wider,
      subject: "node-c.zeta.local",
      actingObserver: "node-a.zeta.local",
      policy: {
        kind: "own-verdict-and-corroboration",
        minAgreeingPeers: 2,
        consultOnly: ["node-d.zeta.local", "node-b.zeta.local"],
      },
    });
    expect(short.act).toBe(false);
  });
});
