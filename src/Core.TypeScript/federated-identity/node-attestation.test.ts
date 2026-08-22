/**
 * node-attestation.test.ts - falsifiers for hardware-rooted workload binding.
 *
 * THE METHODOLOGICAL RULE BOTH RESEARCH DOCUMENTS INSIST ON, APPLIED HERE:
 *
 *   A negative test with no positive control IN THE SAME RUN is the vacuity
 *   class. So every refusal below is paired with an acceptance that differs in
 *   exactly the one field under test. A refusal that would also fire when the
 *   fixture is simply broken proves nothing.
 *
 * No device is touched, no session is opened, no credential is handled. Every
 * key here is generated in memory at call time and dies with the process.
 */

import { describe, expect, test } from "bun:test";

import { ceremonyRequirementFor, type FederatedIdentityOperation } from "./ceremony-gate.ts";
import {
  NODE_BINDING_REFUSAL_KINDS,
  ROOT_OF_TRUST_PROFILES,
  bindWorkloadToNodeRoot,
  claimAtLeast,
  coverageStatementFor,
  nodeAttestationSigningBytes,
  strongestClaimFor,
  type AttestationClaim,
  type NodeBindingRefusal,
} from "./node-attestation.ts";
import {
  hardwareNodeAttestorRequiringCeremony,
  softwareEd25519Verifier,
  toyGenerateSigner,
  toySoftwareNodeAttestor,
} from "./software-adapters.ts";
import { createSoftwareWorkloadAttestor, validateSelectorRules } from "./workload-attestation.ts";
import {
  type AttestedWorkload,
  type NodeAttestation,
  type NodeAttestationChallenge,
  type ObservedProcess,
  ordinalCompare,
  type RootEvidenceState,
  type RootOfTrustClass,
} from "./ports.ts";

const V = softwareEd25519Verifier;
const nodeSigner = toyGenerateSigner("node-a-root");
const otherSigner = toyGenerateSigner("impostor-node");

const BINARY = "b".repeat(64);
const OBSERVED: ObservedProcess = { pid: 4242, uid: 501, binarySha256: BINARY, containerId: "ctr-otto" };

const rules = validateSelectorRules([
  { spiffePath: "/agent/otto", requireUid: 501, requireBinarySha256: BINARY, requireContainerId: "ctr-otto" },
]);
if (!rules.ok) throw new Error("test fixture rules invalid");
const workloadAttestor = createSoftwareWorkloadAttestor(rules.value);

const attestedResult = workloadAttestor.attest(OBSERVED, 100);
if (!attestedResult.ok) throw new Error("workload attest failed in fixture");
const ATTESTED: AttestedWorkload = attestedResult.value;

const CHALLENGE: NodeAttestationChallenge = { nodeId: "node-a", nonce: "9f3c00aa", issuedAtPhase: 100 };

/**
 * Build a signed node attestation for an arbitrary root class and state.
 *
 * The signature is REAL ed25519 over the same bytes the verifier checks, which
 * is what stops these tests from being string comparisons.
 */
function signedAttestation(
  overrides: {
    readonly rootOfTrustClass?: RootOfTrustClass;
    readonly rootEvidenceState?: RootEvidenceState;
    readonly nonce?: string;
    readonly nodeId?: string;
    readonly attestedAtPhase?: number;
    readonly signWith?: typeof nodeSigner;
  } = {},
): NodeAttestation {
  const unsigned = {
    nodeId: overrides.nodeId ?? "node-a",
    nonce: overrides.nonce ?? CHALLENGE.nonce,
    rootOfTrustClass: overrides.rootOfTrustClass ?? ("software-only" as const),
    rootEvidenceState: overrides.rootEvidenceState ?? ("unavailable" as const),
    rootEvidenceDigest: "c".repeat(64),
    attestedAtPhase: overrides.attestedAtPhase ?? 101,
  };
  const signer = overrides.signWith ?? nodeSigner;
  const sig = signer.sign(nodeAttestationSigningBytes(unsigned));
  if (!sig.ok) throw new Error("fixture signer refused");
  return { ...unsigned, signature: sig.value, signerPublicKey: signer.publicKey() };
}

function bind(attestation: NodeAttestation, requiredClaim?: AttestationClaim, currentPhase = 102) {
  return bindWorkloadToNodeRoot({
    attested: ATTESTED,
    attestation,
    challenge: CHALLENGE,
    verifier: V,
    expectedNodePublicKey: nodeSigner.publicKey(),
    acceptancePhases: 10,
    currentPhase,
    requiredClaim,
  });
}

/** Collects every refusal kind reached, for the anti-vacuity enumeration. */
const reached = new Set<NodeBindingRefusal["kind"]>();

function expectRefusal(result: ReturnType<typeof bind>, kind: NodeBindingRefusal["kind"]): NodeBindingRefusal {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected a refusal");
  expect(result.error.kind).toBe(kind);
  reached.add(result.error.kind);
  return result.error;
}

describe("freshness and authenticity, each paired with its positive control", () => {
  test("a fresh, correctly-signed attestation binds; a replayed nonce does not", () => {
    const good = bind(signedAttestation());
    expect(good.ok).toBe(true);
    if (!good.ok) throw new Error("positive control failed");
    expect(good.value.spiffePath).toBe("/agent/otto");

    const replayed = signedAttestation({ nonce: "deadbeef" });
    const e = expectRefusal(bind(replayed), "nonce-mismatch");
    if (e.kind !== "nonce-mismatch") throw new Error("narrowing");
    expect(e.expected).toBe(CHALLENGE.nonce);
    expect(e.received).toBe("deadbeef");
  });

  test("an attestation signed by a stranger names the wrong signer, and is refused as such", () => {
    expect(bind(signedAttestation()).ok).toBe(true);
    expectRefusal(bind(signedAttestation({ signWith: otherSigner })), "node-signer-not-expected");
  });

  /**
   * Distinct from the test above, and the distinction is the point: here the
   * signer IS the expected node, and only the bytes are wrong. If both cases
   * produced one refusal, a substituted signer would be indistinguishable from
   * a corrupted message and the diagnosis would be a guess.
   */
  test("a signature over different bytes fails verification under the right key", () => {
    const good = signedAttestation();
    const elsewhere = signedAttestation({ nonce: "0011ffee" });
    const tampered = { ...good, signature: elsewhere.signature };
    expect(bind(good).ok).toBe(true);
    expectRefusal(bind(tampered), "attestation-signature-invalid");
  });

  test("an attestation for another node is refused", () => {
    expect(bind(signedAttestation()).ok).toBe(true);
    expectRefusal(bind(signedAttestation({ nodeId: "node-z" })), "node-id-mismatch");
  });

  test("an attestation older than the challenge is a recording, not a quote", () => {
    expect(bind(signedAttestation({ attestedAtPhase: 100 })).ok).toBe(true);
    expectRefusal(bind(signedAttestation({ attestedAtPhase: 99 })), "attestation-precedes-challenge");
  });

  test("the acceptance window closes; inside it the same attestation binds", () => {
    expect(bind(signedAttestation(), undefined, 110).ok).toBe(true);
    expectRefusal(bind(signedAttestation(), undefined, 111), "stale-node-attestation");
  });
});

describe("the container-isolation constraint, made mechanical", () => {
  /**
   * THE central falsifier of this module. A shared TPM 2.0 is a real machine
   * root and a real improvement, and it still cannot say WHICH container asked.
   * The paired positive control in the same test is what makes the refusal mean
   * something: the same root, same state, same signature, one field different.
   */
  test("a shared TPM cannot carry a tenant-rooted claim, but does carry a machine-rooted one", () => {
    const tpm = signedAttestation({ rootOfTrustClass: "tpm2-shared-node", rootEvidenceState: "present" });

    const machine = bind(tpm, "machine-rooted");
    expect(machine.ok).toBe(true);
    if (!machine.ok) throw new Error("positive control failed");
    expect(machine.value.claim).toBe("machine-rooted");

    const e = expectRefusal(bind(tpm, "tenant-rooted"), "root-class-cannot-carry-claim");
    if (e.kind !== "root-class-cannot-carry-claim") throw new Error("narrowing");
    expect(e.strongestAvailable).toBe("machine-rooted");
    expect(e.requested).toBe("tenant-rooted");
    expect(e.citation).toContain("PCRs are byte-identical for every container");
  });

  /**
   * The refusal above is not vacuous: three root classes DO reach tenant-rooted.
   * Without this test, `bindWorkloadToNodeRoot` could refuse everything and the
   * previous test would still pass.
   */
  test("vTPM-per-tenant and both YubiHSM classes DO carry a tenant-rooted claim", () => {
    for (const rootClass of [
      "tpm2-vtpm-per-tenant",
      "yubihsm2-shared-connector",
      "yubihsm2-dedicated-device",
    ] as const) {
      const r = bind(signedAttestation({ rootOfTrustClass: rootClass, rootEvidenceState: "present" }), "tenant-rooted");
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error(`expected ${rootClass} to reach tenant-rooted`);
      expect(r.value.claim).toBe("tenant-rooted");
    }
  });

  test("the Apple Secure Enclave is a machine root, never a tenant root", () => {
    const sep = signedAttestation({ rootOfTrustClass: "apple-secure-enclave", rootEvidenceState: "present" });
    expect(bind(sep, "machine-rooted").ok).toBe(true);
    expectRefusal(bind(sep, "tenant-rooted"), "root-class-cannot-carry-claim");
  });
});

describe("a check that could not run never rounds up", () => {
  /**
   * The probe lesson, enforced at the binding rather than restated in prose.
   * `indeterminate` is a device node with no family confirmation; `unreadable`
   * is a denied read. Neither is evidence, and neither is `absent` either.
   */
  test("only rootEvidenceState 'present' supports a hardware claim", () => {
    const present = signedAttestation({ rootOfTrustClass: "tpm2-shared-node", rootEvidenceState: "present" });
    expect(bind(present, "machine-rooted").ok).toBe(true);

    for (const state of ["absent", "unreadable", "unavailable", "indeterminate"] as const) {
      const a = signedAttestation({ rootOfTrustClass: "tpm2-shared-node", rootEvidenceState: state });
      const e = expectRefusal(bind(a, "machine-rooted"), "root-evidence-not-present");
      if (e.kind !== "root-evidence-not-present") throw new Error("narrowing");
      expect(e.state).toBe(state);
    }
  });

  test("an unread root still binds when no claim is required, and says node-bookkeeping", () => {
    const a = signedAttestation({ rootOfTrustClass: "tpm2-shared-node", rootEvidenceState: "indeterminate" });
    const r = bind(a);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected a binding");
    expect(r.value.claim).toBe("node-bookkeeping");
    expect(r.value.coverage).toContain("this is the node's own bookkeeping");
  });
});

describe("the coverage statement cannot drift from the profile table", () => {
  test("every root class that does not partition availability says so out loud", () => {
    for (const [rootClass, profile] of Object.entries(ROOT_OF_TRUST_PROFILES)) {
      const text = coverageStatementFor(
        rootClass as RootOfTrustClass,
        strongestClaimFor(rootClass as RootOfTrustClass),
      );
      if (profile.partitionsAvailability) {
        expect(text).not.toContain("can deny this one its keys");
      } else {
        expect(text).toContain("can deny this one its keys");
      }
    }
  });

  test("the shared-connector YubiHSM reports confidentiality covered and availability not", () => {
    const text = coverageStatementFor("yubihsm2-shared-connector", "tenant-rooted");
    expect(text).toContain("a per-tenant term inside the hardware evidence");
    expect(text).toContain("can deny this one its keys");
    expect(text).not.toContain("a peer can use this tenant's keys");
  });

  test("a machine-rooted claim always states that it cannot tell tenants apart", () => {
    const text = coverageStatementFor("tpm2-shared-node", "machine-rooted");
    expect(text).toContain("WHICH tenant on this machine");
  });

  test("no root class in the table claims to defend a tenant against its host", () => {
    for (const rootClass of Object.keys(ROOT_OF_TRUST_PROFILES) as RootOfTrustClass[]) {
      expect(coverageStatementFor(rootClass, strongestClaimFor(rootClass))).toContain(
        "anything against the host that runs this tenant",
      );
    }
  });

  test("every profile row carries a citation naming its source document", () => {
    for (const profile of Object.values(ROOT_OF_TRUST_PROFILES)) {
      expect(profile.citation.length).toBeGreaterThan(40);
    }
  });
});

describe("the binding digest covers everything it claims to cover", () => {
  test("identical inputs give an identical digest (DST replay)", () => {
    const a = signedAttestation();
    const one = bind(a);
    const two = bind(a);
    expect(one.ok && two.ok).toBe(true);
    if (!one.ok || !two.ok) throw new Error("expected both to bind");
    expect(one.value.bindingDigest).toBe(two.value.bindingDigest);
  });

  test("changing the root class changes the digest", () => {
    const base = bind(signedAttestation({ rootEvidenceState: "present" }));
    const other = bind(signedAttestation({ rootOfTrustClass: "tpm2-shared-node", rootEvidenceState: "present" }));
    expect(base.ok && other.ok).toBe(true);
    if (!base.ok || !other.ok) throw new Error("expected both to bind");
    expect(base.value.bindingDigest).not.toBe(other.value.bindingDigest);
  });

  test("a different workload under the same node attestation gets a different digest", () => {
    const otherRules = validateSelectorRules([{ spiffePath: "/agent/kira", requireUid: 502 }]);
    if (!otherRules.ok) throw new Error("fixture");
    const otherAttestor = createSoftwareWorkloadAttestor(otherRules.value);
    const otherAttested = otherAttestor.attest({ pid: 7, uid: 502, binarySha256: BINARY }, 100);
    if (!otherAttested.ok) throw new Error("fixture");

    const a = signedAttestation();
    const mine = bind(a);
    const theirs = bindWorkloadToNodeRoot({
      attested: otherAttested.value,
      attestation: a,
      challenge: CHALLENGE,
      verifier: V,
      expectedNodePublicKey: nodeSigner.publicKey(),
      acceptancePhases: 10,
      currentPhase: 102,
    });
    expect(mine.ok && theirs.ok).toBe(true);
    if (!mine.ok || !theirs.ok) throw new Error("expected both to bind");
    expect(mine.value.bindingDigest).not.toBe(theirs.value.bindingDigest);
  });
});

describe("the adapters", () => {
  test("the software node attestor produces a verifiable attestation and never claims hardware", () => {
    const attestor = toySoftwareNodeAttestor({ nodeId: "node-a", signer: nodeSigner });
    const r = attestor.attest(CHALLENGE, 101);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected an attestation");
    expect(r.value.rootOfTrustClass).toBe("software-only");
    expect(r.value.rootEvidenceState).toBe("unavailable");
    expect(V.verify(r.value.signerPublicKey, nodeAttestationSigningBytes(r.value), r.value.signature)).toBe(true);
    expect(bind(r.value, "machine-rooted").ok).toBe(false);
  });

  test("an empty nonce is a malformed challenge, refused before anything is signed", () => {
    const attestor = toySoftwareNodeAttestor({ nodeId: "node-a", signer: nodeSigner });
    const bad = attestor.attest({ nodeId: "node-a", nonce: "", issuedAtPhase: 100 }, 101);
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("expected a refusal");
    expect(bad.error.kind).toBe("malformed-challenge");
  });

  /**
   * The linkage test. The hardware adapter names a ceremony; this asserts the
   * name is a REAL member of the gated operation set and that the gate agrees it
   * needs a human. A refusal that named an operation nobody classifies would be
   * a string pretending to be a control.
   */
  test("the hardware node attestor refuses, and the ceremony it names is genuinely gated", () => {
    const attestor = hardwareNodeAttestorRequiringCeremony({
      nodeId: "node-a",
      rootOfTrustClass: "tpm2-shared-node",
    });
    const r = attestor.attest(CHALLENGE, 101);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("a hardware attestation must not be producible by an agent");
    if (r.error.kind !== "requires-human-ceremony") throw new Error("wrong refusal");

    const classification = ceremonyRequirementFor(r.error.operation as FederatedIdentityOperation);
    expect(classification.requirement).toBe("biometric-ceremony");
    const classified: string = classification.operation;
    expect(classified).toBe(r.error.operation);
  });
});

describe("the claim ladder is an order, not a score", () => {
  test("claimAtLeast is reflexive, and strictly ordered across the three rungs", () => {
    const rungs: AttestationClaim[] = ["node-bookkeeping", "machine-rooted", "tenant-rooted"];
    for (const r of rungs) expect(claimAtLeast(r, r)).toBe(true);
    expect(claimAtLeast("tenant-rooted", "machine-rooted")).toBe(true);
    expect(claimAtLeast("machine-rooted", "tenant-rooted")).toBe(false);
    expect(claimAtLeast("node-bookkeeping", "machine-rooted")).toBe(false);
  });
});

describe("every rejection is reachable", () => {
  test("all NodeBindingRefusal kinds were produced by the tests above", () => {
    const produced: string[] = [...reached].sort(ordinalCompare);
    const declared: string[] = [...NODE_BINDING_REFUSAL_KINDS].sort(ordinalCompare);
    expect(produced).toEqual(declared);
  });
});
