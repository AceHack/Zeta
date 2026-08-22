/**
 * node-attestation.ts - binding a workload identity to a HARDWARE root, and
 * refusing to claim more than the hardware can carry.
 *
 * Aaron 2026-08-20: *"i'm trying to connect machines/nodes tpm to AI identity
 * with their own wallets, HSM is the upgrade and maybe we can have AI's per
 * docker container restricted to only certain keys"* and *"can we simulate with
 * is process injected identity or something like that SPIFFE or SPIRE related?"*
 *
 * ============================================================================
 * THE GAP THIS FILLS, AND THE ONE IT REFUSES TO PRETEND TO FILL
 * ============================================================================
 *
 * `workload-attestation.ts` implements SPIRE's WORKLOAD attestor: uid, binary
 * hash, container id, argv. Its own header states the limit - on a shared kernel
 * every one of those fields is under host root's control, so an SVID issued from
 * them says *the node's own bookkeeping believes this process is X*.
 *
 * SPIRE has a SECOND layer this repo never had: NODE attestation. Before an
 * agent may ask for any workload's identity, the agent itself proves what
 * machine it is - and SPIRE's `tpm_devid` plugin does that with a TPM 2.0
 * credential-activation exchange. That is the layer that turns "the node says
 * so" into "a machine with this hardware root says so".
 *
 * This module adds that layer AS A DECISION, and it is deliberately blunt about
 * what the decision buys, because the honest answer contradicts the most natural
 * reading of the request.
 */

/*
 * ============================================================================
 * THE CONSTRAINT, STATED LOUDLY BECAUSE IT LIMITS WHAT WAS ASKED FOR
 * ============================================================================
 *
 * "AI per docker container restricted to only certain keys" is REACHABLE for
 * confidentiality on a YubiHSM 2 and UNREACHABLE on a shared TPM 2.0. Two
 * in-repo research findings decide this, and neither is overridden here:
 *
 *  - `docs/research/2026-08-18-hsm-container-isolation-a-shared-connector-is-
 *    not-a-boundary-and-what-prove-ish-can-honestly-mean.md` S0: container A
 *    cannot USE container B's keys (domain intersection is device-enforced), but
 *    container A CAN deny container B its keys, and can attack B's client
 *    process, because the single path to the device is an unauthenticated shared
 *    multiplexer Yubico explicitly declines to call trusted.
 *  - `docs/research/2026-08-18-tpm-2-0-versus-yubihsm-2-as-root-of-trust-the-
 *    isolation-architectures-are-inverted.md` S2 and S6: granting the device
 *    node grants the WHOLE TPM, and PCRs are identical for every container on
 *    the machine, so there is no PCR policy that admits container A and refuses
 *    container B.
 *
 * So a hardware root can make a claim about a MACHINE that every co-resident
 * tenant shares, or - only on specific device classes - a claim that contains a
 * per-tenant term. Those are different claims and this module will not let the
 * first be reported as the second.
 */

/*
 * ============================================================================
 * REGISTER
 * ============================================================================
 *
 * `unmetered` for the DECISION: every refusal arm below is reached by a test,
 * and the signature checks use real ed25519, so a forged attestation genuinely
 * fails. The ISOLATION PROFILE TABLE is `unmetered` too and for a weaker reason
 * that is stated rather than hidden: its rows are read off two research
 * documents that measured a header, a connector, published advisories and the
 * mainline kernel source. No row here was measured by this file, no device was
 * touched, no session was opened, no credential was handled.
 *
 * The hardware path is `designed, not running` - exactly as `hsm-domain-map.ts`
 * says of its own. A test that this module's decision is correct is NOT a test
 * that any device enforces it.
 */

import { createHash } from "node:crypto";

import {
  canonicalJson,
  type AttestedWorkload,
  type NodeAttestation,
  type NodeAttestationChallenge,
  type Phase,
  type Result,
  type RootEvidenceState,
  type RootOfTrustClass,
  type SignatureVerifier,
  canonicalBytes,
  err,
  ok,
} from "./ports.ts";

// -- The claim ladder --------------------------------------------------------

/**
 * What an attestation is entitled to say. Three rungs, and the middle one is
 * where every shared hardware root lands - which is the whole finding.
 *
 *  - `node-bookkeeping`  the node's own records assert it. No hardware evidence.
 *                        This is what `workload-attestation.ts` alone produces.
 *  - `machine-rooted`    a hardware root attests THE MACHINE. True, useful, and
 *                        IDENTICAL for every co-resident tenant, so it can never
 *                        distinguish one container from another.
 *  - `tenant-rooted`     the hardware evidence contains a term that DIFFERS per
 *                        tenant. Only reachable on device classes that partition
 *                        themselves between mutually distrusting callers.
 */
export type AttestationClaim = "node-bookkeeping" | "machine-rooted" | "tenant-rooted";

const CLAIM_RANK: Record<AttestationClaim, number> = {
  "node-bookkeeping": 0,
  "machine-rooted": 1,
  "tenant-rooted": 2,
};

/** Ordinal, never a score. Rank compares rungs; it does not measure security. */
export function claimAtLeast(actual: AttestationClaim, required: AttestationClaim): boolean {
  return CLAIM_RANK[actual] >= CLAIM_RANK[required];
}

// -- The isolation profile table ---------------------------------------------

/**
 * Four independent axes, because a single "is it isolated" boolean is exactly
 * the answer that made the shared connector look like a boundary.
 */
export interface RootOfTrustProfile {
  readonly rootClass: RootOfTrustClass;
  /** Can a co-resident tenant USE another tenant's keys? false means refused. */
  readonly partitionsConfidentiality: boolean;
  /** Can a co-resident tenant DENY another tenant service? */
  readonly partitionsAvailability: boolean;
  /** Does the evidence contain a term that DIFFERS between co-resident tenants? */
  readonly evidenceBindsTenant: boolean;
  /** Does the root defend the tenant against the HOST that runs it? */
  readonly rootsAgainstHost: boolean;
  /** Where this row was read from. An unsourced row is an invented one. */
  readonly citation: string;
}

export const ROOT_OF_TRUST_PROFILES: Record<RootOfTrustClass, RootOfTrustProfile> = {
  "software-only": {
    rootClass: "software-only",
    partitionsConfidentiality: false,
    partitionsAvailability: false,
    evidenceBindsTenant: false,
    rootsAgainstHost: false,
    citation:
      "workload-attestation.ts header: every field of ObservedProcess is under host root's control, so this is operational identity, not cryptographic isolation",
  },
  "tpm2-shared-node": {
    rootClass: "tpm2-shared-node",
    partitionsConfidentiality: false,
    partitionsAvailability: false,
    evidenceBindsTenant: false,
    rootsAgainstHost: false,
    citation:
      "2026-08-18-tpm-2-0-versus-yubihsm-2 S2 (granting the device node grants the whole TPM; the TPM has no tenants), S4 (global DA lockout is reachable with no credential and no victim can clear it), S6 (PCRs are byte-identical for every container, so no PCR policy admits A and refuses B)",
  },
  "tpm2-vtpm-per-tenant": {
    rootClass: "tpm2-vtpm-per-tenant",
    partitionsConfidentiality: true,
    partitionsAvailability: true,
    evidenceBindsTenant: true,
    rootsAgainstHost: false,
    citation:
      "2026-08-18-tpm-2-0-versus-yubihsm-2 S5: a vTPM per microVM gives each tenant its own PCRs, NV space, DA counter and hierarchies, so it is a root of trust for the guest AGAINST OTHER GUESTS and never against the host, because its entire state is a file the host owns. Costs a VM per tenant, not a container.",
  },
  "apple-secure-enclave": {
    rootClass: "apple-secure-enclave",
    partitionsConfidentiality: false,
    partitionsAvailability: false,
    evidenceBindsTenant: false,
    rootsAgainstHost: false,
    citation:
      "2026-08-18-tpm-2-0-versus-yubihsm-2 S6 fleet table: Apple Silicon has no TPM 2.0 and no USB passthrough, so a Linux container on macOS can reach NEITHER device. The SEP is a machine root with no multi-tenant partitioning primitive; separation between processes rests on OS keychain access control, which is not a device partition. DESIGN CLAIM, not measured here.",
  },
  "yubihsm2-shared-connector": {
    rootClass: "yubihsm2-shared-connector",
    partitionsConfidentiality: true,
    partitionsAvailability: false,
    evidenceBindsTenant: true,
    rootsAgainstHost: false,
    citation:
      "2026-08-18-hsm-container-isolation S0: container A cannot USE container B's keys (16 domains, capability agreement, evaluated per session ON THE DEVICE), but container A CAN deny container B its keys and can attack B's client process, because the one path to the device is an unauthenticated shared multiplexer. S5 T1-B: 16 sessions device-wide, so any legitimate tenant can starve every peer.",
  },
  "yubihsm2-dedicated-device": {
    rootClass: "yubihsm2-dedicated-device",
    partitionsConfidentiality: true,
    partitionsAvailability: true,
    evidenceBindsTenant: true,
    rootsAgainstHost: false,
    citation:
      "2026-08-18-hsm-container-isolation S3 T5: one device per trust domain. No shared connector, no shared session pool, no shared log, no shared admin key. The partition that works is the physical one. Costs hardware.",
  },
};

/**
 * The strongest claim a root class is entitled to make. Note the ONLY route to
 * `tenant-rooted` is `evidenceBindsTenant`, and note which classes have it: the
 * two YubiHSM rows and the vTPM row. A shared TPM has no route there at all, no
 * matter how the containers are configured, because the missing property is in
 * the device rather than in the configuration.
 */
export function strongestClaimFor(rootClass: RootOfTrustClass): AttestationClaim {
  const profile = ROOT_OF_TRUST_PROFILES[rootClass];
  if (profile.evidenceBindsTenant) return "tenant-rooted";
  if (rootClass === "software-only") return "node-bookkeeping";
  return "machine-rooted";
}

// -- Signing bytes -----------------------------------------------------------

/**
 * What a node attestation actually signs.
 *
 * The nonce and the challenge phase are INSIDE the signed body. If they were
 * not, a captured attestation could be replayed against a different challenge
 * and the signature would still verify - which is the difference between a
 * quote and a recording of a quote.
 *
 * `signature` and `signerPublicKey` are excluded, since a signature cannot cover
 * itself.
 */
export function nodeAttestationSigningBytes(a: Omit<NodeAttestation, "signature" | "signerPublicKey">): Uint8Array {
  return canonicalBytes({
    nodeId: a.nodeId,
    nonce: a.nonce,
    rootOfTrustClass: a.rootOfTrustClass,
    rootEvidenceState: a.rootEvidenceState,
    rootEvidenceDigest: a.rootEvidenceDigest,
    attestedAtPhase: a.attestedAtPhase,
  });
}

// -- The bound result --------------------------------------------------------

/**
 * A workload identity with a hardware root recorded BESIDE it rather than
 * folded INTO it. Keeping them separate is the point: a reader can always see
 * which half of the evidence is software bookkeeping and which half is a device.
 */
export interface HardwareBoundWorkload {
  readonly spiffePath: string;
  /** The workload attestor's digest, carried through unchanged. */
  readonly workloadAttestationDigest: string;
  readonly nodeId: string;
  readonly rootOfTrustClass: RootOfTrustClass;
  readonly claim: AttestationClaim;
  /** Digest over BOTH halves plus the nonce. Changes if any input changes. */
  readonly bindingDigest: string;
  readonly boundAtPhase: Phase;
  /**
   * The coverage statement. Prove-ish is a COVERAGE STATEMENT, not a confidence
   * number: what is covered, and what is explicitly not.
   */
  readonly coverage: string;
}

/** Every refusal names a distinct, reachable failure. */
export interface NonceMismatch {
  readonly kind: "nonce-mismatch";
  readonly expected: string;
  readonly received: string;
}

export interface NodeIdMismatch {
  readonly kind: "node-id-mismatch";
  readonly expected: string;
  readonly received: string;
}

/** The attestation is older than the challenge, i.e. it is a recording. */
export interface AttestationPrecedesChallenge {
  readonly kind: "attestation-precedes-challenge";
  readonly attestedAtPhase: Phase;
  readonly challengeIssuedAtPhase: Phase;
}

export interface StaleNodeAttestation {
  readonly kind: "stale-node-attestation";
  readonly currentPhase: Phase;
  readonly windowClosesAtPhase: Phase;
}

export interface AttestationSignatureInvalid {
  readonly kind: "attestation-signature-invalid";
  readonly nodeId: string;
}

/**
 * The attestation is signed by a key this verifier was not expecting.
 *
 * A separate refusal from a bad signature, because they diagnose opposite
 * things: a bad signature says the bytes were altered, this says the SIGNER is
 * not the node we asked. Without this check the binding would verify an
 * attestation against a public key the attestation itself supplies, which is
 * trust-on-self and lets anyone mint an attestation for any node. That defect
 * was live in the first draft of this file and was caught by the paired
 * negative test, which is what a falsifier is for.
 */
export interface NodeSignerNotExpected {
  readonly kind: "node-signer-not-expected";
  readonly nodeId: string;
}

/**
 * The root evidence is not `present`, so nothing above `node-bookkeeping` may be
 * claimed. Carries the state, so an auditor can tell "this node has no TPM" from
 * "we were not allowed to look".
 */
export interface RootEvidenceNotPresent {
  readonly kind: "root-evidence-not-present";
  readonly state: RootEvidenceState;
  readonly rootClass: RootOfTrustClass;
}

/**
 * THE CONTAINER-ISOLATION REFUSAL. The caller asked for a claim the device
 * class cannot carry - typically `tenant-rooted` on a shared TPM. This is the
 * refusal that keeps "AI per docker container restricted to only certain keys"
 * from being reported as achieved on hardware that cannot achieve it.
 */
export interface RootClassCannotCarryClaim {
  readonly kind: "root-class-cannot-carry-claim";
  readonly rootClass: RootOfTrustClass;
  readonly requested: AttestationClaim;
  readonly strongestAvailable: AttestationClaim;
  readonly citation: string;
}

export type NodeBindingRefusal =
  | NonceMismatch
  | NodeIdMismatch
  | AttestationPrecedesChallenge
  | StaleNodeAttestation
  | AttestationSignatureInvalid
  | NodeSignerNotExpected
  | RootEvidenceNotPresent
  | RootClassCannotCarryClaim;

/** Enumerated so a test can assert every arm is reachable, not just typed. */
export const NODE_BINDING_REFUSAL_KINDS = [
  "nonce-mismatch",
  "node-id-mismatch",
  "attestation-precedes-challenge",
  "stale-node-attestation",
  "attestation-signature-invalid",
  "node-signer-not-expected",
  "root-evidence-not-present",
  "root-class-cannot-carry-claim",
] as const;

// -- The coverage statement --------------------------------------------------

/**
 * What the binding covers and what it does not, generated from the profile
 * rather than written by hand - so it cannot drift away from the table it is
 * supposed to describe.
 */
export function coverageStatementFor(rootClass: RootOfTrustClass, claim: AttestationClaim): string {
  const p = ROOT_OF_TRUST_PROFILES[rootClass];
  const covered: string[] = [];
  const notCovered: string[] = [];

  covered.push("the workload selectors matched on this node");
  if (claim === "node-bookkeeping") {
    notCovered.push("any hardware fact whatsoever - this is the node's own bookkeeping");
  } else {
    covered.push("a fresh, nonce-bound attestation from the node's declared root of trust");
  }
  if (claim === "machine-rooted") {
    notCovered.push("WHICH tenant on this machine - the evidence is identical for every co-resident tenant");
  }
  if (claim === "tenant-rooted") {
    covered.push("a per-tenant term inside the hardware evidence");
  }

  if (!p.partitionsConfidentiality) {
    notCovered.push("confidentiality between co-resident tenants - a peer can use this tenant's keys");
  }
  if (!p.partitionsAvailability) {
    notCovered.push("availability - a co-resident tenant can deny this one its keys");
  }
  if (!p.rootsAgainstHost) {
    notCovered.push("anything against the host that runs this tenant");
  }
  notCovered.push("client-process integrity on the path to the device");

  return (
    `COVERED: ${covered.join("; ")}. NOT COVERED: ${notCovered.join("; ")}. ` +
    `Root class '${rootClass}' basis: ${p.citation}`
  );
}

// -- The binding decision ----------------------------------------------------

export interface BindWorkloadParams {
  readonly attested: AttestedWorkload;
  readonly attestation: NodeAttestation;
  /** The challenge THIS verifier issued. Never one the node supplied. */
  readonly challenge: NodeAttestationChallenge;
  readonly verifier: SignatureVerifier;
  /**
   * The node public key THIS VERIFIER already holds, from a trust bundle.
   *
   * Load-bearing, and its absence was a real bug: verifying an attestation with
   * the key the attestation itself carries proves only that the signer signed
   * its own message. The expected key is what makes the signature name a node.
   */
  readonly expectedNodePublicKey: string;
  /** Phases after `challenge.issuedAtPhase` in which an answer is accepted. */
  readonly acceptancePhases: number;
  readonly currentPhase: Phase;
  /**
   * What the CALLER needs. Optional, and omitting it is the honest default:
   * you get whatever the root can carry, stated. Supplying it turns this
   * function into a gate that fails closed.
   */
  readonly requiredClaim?: AttestationClaim | undefined;
}

/**
 * Bind an attested workload to an attested node root.
 *
 * ORDER MATTERS AND IS DELIBERATE. Freshness and authenticity are checked
 * BEFORE the claim ladder, so a forged or replayed attestation can never reach
 * the interesting refusal and be mistaken for a policy decision. The last check
 * is the only one that is about policy; everything above it is about whether
 * there is any evidence at all.
 *
 * Note what this function does NOT do: it does not decide that the workload may
 * use a key. That is `decideHsmAccess` in `hsm-domain-map.ts`, and keeping them
 * apart is the same separation that file already draws - the DECISION is here,
 * the ENFORCEMENT is on a device none of this code can reach.
 */
export function bindWorkloadToNodeRoot(params: BindWorkloadParams): Result<HardwareBoundWorkload, NodeBindingRefusal> {
  const { attested, attestation, challenge, verifier, acceptancePhases, currentPhase, requiredClaim } = params;
  const expectedNodePublicKey = params.expectedNodePublicKey;

  if (attestation.nodeId !== challenge.nodeId) {
    return err({ kind: "node-id-mismatch", expected: challenge.nodeId, received: attestation.nodeId });
  }
  if (attestation.nonce !== challenge.nonce) {
    return err({ kind: "nonce-mismatch", expected: challenge.nonce, received: attestation.nonce });
  }
  if (attestation.attestedAtPhase < challenge.issuedAtPhase) {
    return err({
      kind: "attestation-precedes-challenge",
      attestedAtPhase: attestation.attestedAtPhase,
      challengeIssuedAtPhase: challenge.issuedAtPhase,
    });
  }

  const windowClosesAtPhase = challenge.issuedAtPhase + acceptancePhases;
  if (currentPhase > windowClosesAtPhase || attestation.attestedAtPhase > windowClosesAtPhase) {
    return err({ kind: "stale-node-attestation", currentPhase, windowClosesAtPhase });
  }

  // Whose key, THEN whether the bytes hold. A self-carried public key is not an
  // identity; the expected key is the only thing that makes this name a node.
  if (attestation.signerPublicKey !== expectedNodePublicKey) {
    return err({ kind: "node-signer-not-expected", nodeId: attestation.nodeId });
  }
  const signed = nodeAttestationSigningBytes(attestation);
  if (!verifier.verify(expectedNodePublicKey, signed, attestation.signature)) {
    return err({ kind: "attestation-signature-invalid", nodeId: attestation.nodeId });
  }

  // A root that could not be read NEVER rounds up. `indeterminate` is not
  // `present`, and `unreadable` is not `absent`. The only state that supports a
  // hardware claim is `present`; every other state falls back to bookkeeping.
  const rootPresent = attestation.rootEvidenceState === "present";
  const claim: AttestationClaim = rootPresent ? strongestClaimFor(attestation.rootOfTrustClass) : "node-bookkeeping";

  if (requiredClaim !== undefined && !claimAtLeast(claim, requiredClaim)) {
    if (!rootPresent) {
      return err({
        kind: "root-evidence-not-present",
        state: attestation.rootEvidenceState,
        rootClass: attestation.rootOfTrustClass,
      });
    }
    return err({
      kind: "root-class-cannot-carry-claim",
      rootClass: attestation.rootOfTrustClass,
      requested: requiredClaim,
      strongestAvailable: claim,
      citation: ROOT_OF_TRUST_PROFILES[attestation.rootOfTrustClass].citation,
    });
  }

  return ok({
    spiffePath: attested.spiffePath,
    workloadAttestationDigest: attested.attestationDigest,
    nodeId: attestation.nodeId,
    rootOfTrustClass: attestation.rootOfTrustClass,
    claim,
    bindingDigest: bindingDigestOf(attested, attestation, challenge),
    boundAtPhase: currentPhase,
    coverage: coverageStatementFor(attestation.rootOfTrustClass, claim),
  });
}

/**
 * Digest over BOTH halves of the evidence plus the nonce.
 *
 * It covers the workload digest, the node attestation, and the challenge - so
 * flipping any one of them produces a different binding. Like
 * `attestationDigestOf`, it excludes pid, because a pid is recycled by the OS
 * and a credential bound to one changes meaning underneath itself.
 */
export function bindingDigestOf(
  attested: AttestedWorkload,
  attestation: NodeAttestation,
  challenge: NodeAttestationChallenge,
): string {
  const body = {
    workload: { spiffePath: attested.spiffePath, attestationDigest: attested.attestationDigest },
    node: {
      nodeId: attestation.nodeId,
      rootOfTrustClass: attestation.rootOfTrustClass,
      rootEvidenceState: attestation.rootEvidenceState,
      rootEvidenceDigest: attestation.rootEvidenceDigest,
      attestedAtPhase: attestation.attestedAtPhase,
      signature: attestation.signature,
    },
    challenge: { nodeId: challenge.nodeId, nonce: challenge.nonce, issuedAtPhase: challenge.issuedAtPhase },
  };
  return createHash("sha256").update(canonicalJson(body), "utf8").digest("hex");
}
