/**
 * SPIFFE workload identity — port of
 * `full-ai-cluster/k8s/applications/spire/Application.yaml` (Merge1 §08).
 *
 * SPIRE issues short-lived SVIDs to every workload so pod-to-pod auth does not
 * depend on long-lived K8s ServiceAccount tokens. A room runs AS a SPIFFE
 * identity; the credential proxy binds tool grants to it (§07 HatBinding wearer
 * is a SPIFFE ID). Identity provisioning is a seam (MP-2): real = SPIRE workload
 * API; mock = deterministic SVID from seed (MP-1). Errors are Result-shaped
 * (MP-7), never exceptions.
 */

import type { AgentIdentity } from "./room.ts";

/** spiffe://<trust-domain>/<path> */
export interface SpiffeIdentity {
  readonly spiffeId: string;
  readonly trustDomain: string;
  readonly svid: SpiffeSvid;
  readonly expiresAt: string; // ISO-8601
}

export type SpiffeSvid =
  | { readonly type: "x509"; readonly certChain: string; readonly privateKey: string }
  | { readonly type: "jwt"; readonly token: string };

export type SpiffeError =
  | { readonly kind: "workload_not_found"; readonly workloadId: string }
  | { readonly kind: "svid_expired" }
  | { readonly kind: "trust_domain_mismatch"; readonly expected: string; readonly actual: string };

export type SpiffeResult =
  | { readonly outcome: "ok"; readonly value: SpiffeIdentity }
  | { readonly outcome: "feedback"; readonly error: SpiffeError };

/** Parse the trust domain out of a SPIFFE ID, or undefined if malformed. */
export function trustDomainOf(spiffeId: string): string | undefined {
  const m = /^spiffe:\/\/([^/]+)\//.exec(spiffeId);
  return m?.[1];
}

/**
 * Derive an `AgentIdentity` from a SPIFFE identity: `agentId` is the last path
 * segment, `subject` is the full SPIFFE ID.
 */
export function agentIdentityFromSpiffe(spiffe: SpiffeIdentity): AgentIdentity {
  return {
    agentId: spiffe.spiffeId.split("/").pop() ?? "unknown",
    subject: spiffe.spiffeId,
  };
}

/** SPIFFE identity provider seam — real fetches from SPIRE, mock is deterministic. */
export interface SpiffeIdentityProvider {
  fetchIdentity(workloadId: string): Promise<SpiffeResult>;
}

export interface MockSpiffeOptions {
  readonly trustDomain?: string;
  readonly expiresAt?: string;
}

/**
 * Deterministic SPIFFE provider for DST: a workload id maps to a stable
 * `spiffe://<trustDomain>/agent/<workloadId>` with a fixed JWT SVID. Same inputs
 * → same identity. An empty workload id surfaces `workload_not_found`.
 */
export function createMockSpiffeIdentityProvider(options: MockSpiffeOptions = {}): SpiffeIdentityProvider {
  const trustDomain = options.trustDomain ?? "zeta.local";
  const expiresAt = options.expiresAt ?? "2099-12-31T23:59:59.000Z";
  return {
    fetchIdentity(workloadId: string): Promise<SpiffeResult> {
      if (workloadId === "") {
        return Promise.resolve({ outcome: "feedback", error: { kind: "workload_not_found", workloadId } });
      }
      const spiffeId = `spiffe://${trustDomain}/agent/${workloadId}`;
      return Promise.resolve({
        outcome: "ok",
        value: {
          spiffeId,
          trustDomain,
          svid: { type: "jwt", token: `mock-svid:${spiffeId}` },
          expiresAt,
        },
      });
    },
  };
}

/**
 * Validate a SPIFFE identity against an expected trust domain and a current
 * time. Returns ok, or a feedback Result describing the mismatch/expiry.
 */
export function validateSpiffeIdentity(
  spiffe: SpiffeIdentity,
  expectedTrustDomain: string,
  nowIso: string,
): SpiffeResult {
  if (spiffe.trustDomain !== expectedTrustDomain) {
    return {
      outcome: "feedback",
      error: { kind: "trust_domain_mismatch", expected: expectedTrustDomain, actual: spiffe.trustDomain },
    };
  }
  if (Date.parse(spiffe.expiresAt) <= Date.parse(nowIso)) {
    return { outcome: "feedback", error: { kind: "svid_expired" } };
  }
  return { outcome: "ok", value: spiffe };
}
