/**
 * local-issuer.ts — the node's own SPIRE-shaped issuer, and the federated
 * verifier that is its mirror image.
 *
 * Two halves, and the asymmetry between them is the design:
 *
 *   ISSUE   — only for workloads on THIS node, only under THIS node's root,
 *             only after local attestation, always short-lived.
 *   VERIFY  — for any peer's SVID, against the trust bundles this node has
 *             LOCALLY decided to accept (see `trust-bundle.ts`).
 *
 * Nobody issues on anyone else's behalf, and nobody tells anybody whose
 * signatures to honour. That is what "every node is its own identity provider"
 * costs and buys.
 *
 * REGISTER: `unmetered`.
 *
 * ── Anchors (Beacon) ─────────────────────────────────────────────────────────
 * SPIFFE/SPIRE (CNCF; Evan Gilman, Ian Haken et al., *Solving the Bottom Turtle*,
 * 2020) for the trust-domain / SVID / workload-attestation vocabulary, and its
 * federation model for bundle exchange between independent trust domains.
 * Key continuity as an alternative to hierarchical PKI: Ylönen's SSH host-key
 * model (RFC 4251 §4.1), and its formal treatment in the key-continuity-management
 * literature (Gutmann, "Plug-and-Play PKI", 2003). Short-lived-credentials-instead-of-
 * revocation is Rivest's "Can We Eliminate Certificate Revocation Lists?" (1998) —
 * a *checked* anchor here, in that the design consequence this file implements
 * (expiry needs no cooperation; a CRL does) is exactly that paper's argument.
 */

import {
  canonicalBytes,
  type AttestedWorkload,
  type Decision,
  type Phase,
  type Result,
  type SignatureVerifier,
  type Signer,
  err,
  ok,
} from "./ports.ts";
import { type AcceptedBundles, type TrustRoot } from "./trust-bundle.ts";

/** Parse the trust domain out of a SPIFFE ID, or undefined if malformed. */
export function trustDomainOf(spiffeId: string): string | undefined {
  const m = /^spiffe:\/\/([^/]+)(\/.*)?$/.exec(spiffeId);
  return m?.[1];
}

/** Path portion of a SPIFFE ID (`/agent/otto`), or undefined. */
export function spiffePathOf(spiffeId: string): string | undefined {
  const m = /^spiffe:\/\/[^/]+(\/.*)$/.exec(spiffeId);
  return m?.[1];
}

/**
 * The claim body. Note there is NO private key field: the subject generates its
 * own keypair inside its own `Signer` and hands the issuer only the public half.
 * The issuer never sees, and structurally cannot carry, the private material.
 *
 * (Contrast the existing seam at
 * `agentic-organization/packages/application/src/spiffe-identity.ts`, whose
 * `x509` SVID variant is `{ certChain, privateKey }`.)
 */
export interface SvidClaim {
  readonly spiffeId: string;
  readonly trustDomain: string;
  /** Public key of the SUBJECT, not of the issuer. */
  readonly subjectPublicKey: string;
  /** Which root signed this. Must resolve inside the issuer's bundle. */
  readonly issuerKeyId: string;
  readonly issuedAtPhase: Phase;
  readonly expiresAtPhase: Phase;
  /** Binds the SVID to the attestation evidence that produced it. */
  readonly attestationDigest: string;
  /** Empty ⇒ general purpose. Non-empty ⇒ only valid for these audiences. */
  readonly audience: readonly string[];
}

export interface SignedSvid {
  readonly claim: SvidClaim;
  readonly signature: string;
}

export type IssueRefusal =
  | { readonly kind: "lifetime-exceeds-ceiling"; readonly requested: number; readonly ceiling: number }
  | { readonly kind: "lifetime-not-positive"; readonly requested: number }
  | { readonly kind: "signer-refused"; readonly detail: string }
  | { readonly kind: "empty-subject-public-key" };

/**
 * Ceiling on any leaf SVID's life, in phases.
 *
 * Short lifetimes are not a performance tuning knob here — they ARE the
 * revocation mechanism. With no authority above the node there is no CRL anyone
 * is obliged to honour, so the only revocation that works under partition is the
 * one that requires no cooperation: expiry. A long-lived leaf reintroduces the
 * need for a revocation channel through the back door.
 */
export const MAX_SVID_LIFETIME_PHASES = 512;

export interface LocalIssuer {
  readonly trustDomain: string;
  readonly rootKeyId: string;
  issue(params: {
    readonly attested: AttestedWorkload;
    readonly subjectPublicKey: string;
    readonly lifetimePhases: number;
    readonly currentPhase: Phase;
    readonly audience?: readonly string[];
  }): Result<SignedSvid, IssueRefusal>;
}

/** The bytes an SVID signature covers. Purpose-tagged: no cross-protocol reuse. */
export function svidSigningBytes(claim: SvidClaim): Uint8Array {
  return canonicalBytes({ purpose: "zeta-svid-v0", claim });
}

/**
 * Build the node's issuer. The `Signer` is the node's CA root — this module
 * never sees its private half and has no way to ask for it.
 */
export function createLocalIssuer(params: { readonly trustDomain: string; readonly rootSigner: Signer }): LocalIssuer {
  const { trustDomain, rootSigner } = params;
  return {
    trustDomain,
    rootKeyId: rootSigner.keyId,
    issue({ attested, subjectPublicKey, lifetimePhases, currentPhase, audience }) {
      if (subjectPublicKey === "") return err({ kind: "empty-subject-public-key" });
      if (!Number.isSafeInteger(lifetimePhases) || lifetimePhases <= 0) {
        return err({ kind: "lifetime-not-positive", requested: lifetimePhases });
      }
      if (lifetimePhases > MAX_SVID_LIFETIME_PHASES) {
        return err({ kind: "lifetime-exceeds-ceiling", requested: lifetimePhases, ceiling: MAX_SVID_LIFETIME_PHASES });
      }
      const claim: SvidClaim = {
        spiffeId: `spiffe://${trustDomain}${attested.spiffePath}`,
        trustDomain,
        subjectPublicKey,
        issuerKeyId: rootSigner.keyId,
        issuedAtPhase: currentPhase,
        expiresAtPhase: currentPhase + lifetimePhases,
        attestationDigest: attested.attestationDigest,
        audience: audience ?? [],
      };
      const signed = rootSigner.sign(svidSigningBytes(claim));
      if (!signed.ok) {
        return err({ kind: "signer-refused", detail: JSON.stringify(signed.error) });
      }
      return ok({ claim, signature: signed.value });
    },
  };
}

// ── The federated verifier ───────────────────────────────────────────────────

export type SvidRejection =
  | "malformed-spiffe-id"
  | "spiffe-id-domain-mismatch"
  | "no-accepted-bundle-for-domain"
  | "issuer-key-not-in-bundle"
  | "issuer-root-not-live-at-issuance"
  | "signature-invalid"
  | "svid-not-yet-valid"
  | "svid-expired"
  | "lifetime-exceeds-ceiling"
  | "audience-mismatch";

export interface SvidVerdict extends Decision {
  readonly rejection?: SvidRejection;
  readonly spiffeId?: string;
}

/**
 * Validate a peer's SVID against the bundles THIS node accepts.
 *
 * Every input is explicit — accepted bundles, current agreed phase, the
 * verifier. There is no ambient trust store and no clock read, so two nodes
 * holding the same bundles at the same phase return the same verdict. That is
 * `local-time-never-enters-the-shared-fold` honoured at the one place where it
 * would be easiest to break: `Date.now() > expiry` is the natural way to write
 * this, and it is exactly the leak.
 */
export function validatePeerSvid(params: {
  readonly accepted: AcceptedBundles;
  readonly signed: SignedSvid;
  readonly currentPhase: Phase;
  readonly verifier: SignatureVerifier;
  /** If set, the SVID must name this audience (or be general-purpose). */
  readonly requiredAudience?: string;
}): SvidVerdict {
  const { accepted, signed, currentPhase, verifier, requiredAudience } = params;
  const { claim } = signed;

  const domainFromId = trustDomainOf(claim.spiffeId);
  if (domainFromId === undefined || spiffePathOf(claim.spiffeId) === undefined) {
    return {
      allowed: false,
      rejection: "malformed-spiffe-id",
      reason: `'${claim.spiffeId}' is not a well-formed SPIFFE ID with a path`,
    };
  }
  // The ID and the claim must agree, or a peer could carry a claim for one
  // domain under an ID that reads as another.
  if (domainFromId !== claim.trustDomain) {
    return {
      allowed: false,
      rejection: "spiffe-id-domain-mismatch",
      reason: `SPIFFE ID names domain '${domainFromId}' but the claim says '${claim.trustDomain}'`,
    };
  }

  const bundle = accepted.get(claim.trustDomain);
  if (!bundle) {
    return {
      allowed: false,
      rejection: "no-accepted-bundle-for-domain",
      reason: `this node accepts no trust bundle for '${claim.trustDomain}'; federation is opt-in per domain and this one was never accepted`,
      spiffeId: claim.spiffeId,
    };
  }

  const root: TrustRoot | undefined = bundle.roots.find((r) => r.keyId === claim.issuerKeyId);
  if (!root) {
    return {
      allowed: false,
      rejection: "issuer-key-not-in-bundle",
      reason: `issuer key '${claim.issuerKeyId}' is not a root in the accepted bundle for '${claim.trustDomain}' (bundle sequence ${String(bundle.sequence)})`,
      spiffeId: claim.spiffeId,
    };
  }

  // The root must have been live WHEN THE SVID WAS ISSUED, not merely now.
  // Checking only "now" would let a rotated-out root keep minting into the past.
  if (claim.issuedAtPhase < root.notBeforePhase || claim.issuedAtPhase >= root.notAfterPhase) {
    return {
      allowed: false,
      rejection: "issuer-root-not-live-at-issuance",
      reason: `root '${root.keyId}' was live [${String(root.notBeforePhase)}, ${String(root.notAfterPhase)}) but the SVID claims issuance at phase ${String(claim.issuedAtPhase)}`,
      spiffeId: claim.spiffeId,
    };
  }

  const lifetime = claim.expiresAtPhase - claim.issuedAtPhase;
  if (!Number.isSafeInteger(lifetime) || lifetime <= 0 || lifetime > MAX_SVID_LIFETIME_PHASES) {
    return {
      allowed: false,
      rejection: "lifetime-exceeds-ceiling",
      reason: `SVID lifetime ${String(lifetime)} is outside (0, ${String(MAX_SVID_LIFETIME_PHASES)}] — a long-lived leaf is unrevokable in a system with no CRL`,
      spiffeId: claim.spiffeId,
    };
  }

  if (!verifier.verify(root.publicKey, svidSigningBytes(claim), signed.signature)) {
    return {
      allowed: false,
      rejection: "signature-invalid",
      reason: `SVID signature does not verify under root '${root.keyId}'`,
      spiffeId: claim.spiffeId,
    };
  }

  if (currentPhase < claim.issuedAtPhase) {
    return {
      allowed: false,
      rejection: "svid-not-yet-valid",
      reason: `SVID becomes valid at phase ${String(claim.issuedAtPhase)}, agreed phase is ${String(currentPhase)}`,
      spiffeId: claim.spiffeId,
    };
  }
  if (currentPhase >= claim.expiresAtPhase) {
    return {
      allowed: false,
      rejection: "svid-expired",
      reason: `SVID expired at phase ${String(claim.expiresAtPhase)}, agreed phase is ${String(currentPhase)}`,
      spiffeId: claim.spiffeId,
    };
  }

  if (requiredAudience !== undefined && claim.audience.length > 0 && !claim.audience.includes(requiredAudience)) {
    return {
      allowed: false,
      rejection: "audience-mismatch",
      reason: `SVID is scoped to [${claim.audience.join(", ")}] and does not name '${requiredAudience}'`,
      spiffeId: claim.spiffeId,
    };
  }

  return {
    allowed: true,
    reason: `'${claim.spiffeId}' verified under accepted root '${root.keyId}' of '${claim.trustDomain}', live until phase ${String(claim.expiresAtPhase)}`,
    spiffeId: claim.spiffeId,
  };
}
