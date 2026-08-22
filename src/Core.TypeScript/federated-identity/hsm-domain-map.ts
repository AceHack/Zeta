/**
 * hsm-domain-map.ts — SPIFFE-ID → HSM domain authorization, as data + a pure
 * decision function.
 *
 * A YubiHSM 2 partitions objects into 16 **domains** (a bitmask); a key in domain
 * 3 is unreachable to a session without domain 3. That partitioning is the
 * hardware's own authorization primitive, and this file is the mapping from the
 * software identity (a SPIFFE ID) onto it.
 *
 * Modelled as data + a pure function so the authorization decision is testable
 * with no hardware present. That separation is doing real work here, because the
 * hardware half CANNOT run: opening a session needs an auth credential, which an
 * agent may not hold. So the decision is verified and the enforcement is not.
 *
 * ── WHAT IS ENFORCED AND WHAT IS NOT — say it at the claim, not in a footnote ─
 *
 *   ENFORCED (by this code):    the DECISION. Given a map and a SPIFFE ID, this
 *                               returns allow/deny, and every deny path has a
 *                               test that reaches it.
 *   NOT ENFORCED (by this code): the SEPARATION. Nothing here stops a process
 *                               that already has an authenticated HSM session
 *                               from using any key that session's domains reach.
 *                               The hardware enforces domain separation against
 *                               a SESSION; this function is a gate a caller can
 *                               simply not call.
 *
 * Reading "SPIFFE ID → HSM domain mapping is implemented" as "a workload cannot
 * use another workload's key" would be exactly the vacuous-guarantee failure.
 * What is true is narrower: *a caller that consults this function will be told
 * no.*
 *
 * ── MEASURED DEVICE FACTS (unauthenticated `get-device-info` only) ───────────
 * Firmware 2.4.1, serial 39160506. Mechanisms include `eck256` (secp256k1),
 * `ecdsa-sha256`, `ed25519`. **No FROST-capable mechanism.** No session was
 * opened and no credential was handled to learn this.
 *
 * REGISTER: `unmetered` for the decision; the hardware path is `designed, not
 * running`.
 */

import { type Decision } from "./ports.ts";
import { spiffePathOf, trustDomainOf } from "./local-issuer.ts";

/** Mechanisms this device actually offers, per the unauthenticated probe above. */
export const YUBIHSM2_MECHANISMS_OBSERVED = ["ecdsa-sha256", "eck256", "ed25519"] as const;
export type HsmMechanism = (typeof YUBIHSM2_MECHANISMS_OBSERVED)[number];

/**
 * One authorization row: an identity prefix, the hardware domain it reaches, and
 * the mechanisms it may use there.
 *
 * `spiffeIdPrefix` matches on PATH SEGMENT BOUNDARIES, never on raw string
 * prefix. `spiffe://d/agent/otto-evil` must not match a rule written for
 * `spiffe://d/agent/otto`, and a naive `startsWith` says it does. That is a real
 * privilege-escalation class and it is cheap to get wrong.
 */
export interface HsmDomainGrant {
  readonly spiffeIdPrefix: string;
  /** 1..16 on a YubiHSM 2. */
  readonly hsmDomain: number;
  readonly allowedMechanisms: readonly HsmMechanism[];
  /** Optional label, for the reason string. */
  readonly note?: string;
}

export interface HsmAccessVerdict extends Decision {
  readonly hsmDomain?: number;
  readonly matchedPrefix?: string;
}

/**
 * Segment-aware prefix match. `prefix` matches `id` when `id === prefix` or
 * `id` starts with `prefix + "/"`.
 */
export function spiffeIdMatchesPrefix(spiffeId: string, prefix: string): boolean {
  if (spiffeId === prefix) return true;
  const normalized = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return spiffeId.startsWith(`${normalized}/`);
}

export type HsmMapError =
  | { readonly kind: "domain-out-of-range"; readonly prefix: string; readonly hsmDomain: number }
  | { readonly kind: "no-mechanisms"; readonly prefix: string }
  | { readonly kind: "prefix-not-a-spiffe-id"; readonly prefix: string }
  | { readonly kind: "overlapping-prefixes"; readonly a: string; readonly b: string };

/**
 * Validate a map before it is used.
 *
 * Overlapping prefixes are REFUSED rather than resolved by specificity. A
 * longest-match rule is defensible, but it makes the effective authorization
 * depend on a comparison the reader has to perform in their head across the
 * whole table — and an authorization table nobody can read by inspection is one
 * whose exceptions are discovered in production.
 */
export function validateHsmDomainMap(
  grants: readonly HsmDomainGrant[],
): { readonly ok: true } | { readonly ok: false; readonly error: HsmMapError } {
  for (const g of grants) {
    if (trustDomainOf(g.spiffeIdPrefix) === undefined || spiffePathOf(g.spiffeIdPrefix) === undefined) {
      return { ok: false, error: { kind: "prefix-not-a-spiffe-id", prefix: g.spiffeIdPrefix } };
    }
    if (!Number.isSafeInteger(g.hsmDomain) || g.hsmDomain < 1 || g.hsmDomain > 16) {
      return { ok: false, error: { kind: "domain-out-of-range", prefix: g.spiffeIdPrefix, hsmDomain: g.hsmDomain } };
    }
    if (g.allowedMechanisms.length === 0) {
      return { ok: false, error: { kind: "no-mechanisms", prefix: g.spiffeIdPrefix } };
    }
  }
  const prefixes = grants.map((g) => g.spiffeIdPrefix);
  for (const [i, a] of prefixes.entries()) {
    for (const b of prefixes.slice(i + 1)) {
      if (spiffeIdMatchesPrefix(a, b) || spiffeIdMatchesPrefix(b, a)) {
        return { ok: false, error: { kind: "overlapping-prefixes", a, b } };
      }
    }
  }
  return { ok: true };
}

/**
 * The decision. Deny-by-default: an identity with no matching grant gets
 * nothing, and an unknown mechanism is refused rather than passed through.
 *
 * `requireTrustDomain` is what keeps federation from becoming a key-sharing
 * scheme: accepting a peer's SVID means you believe who they are, and it must
 * never by itself mean they may use your hardware keys. Those are separate
 * questions and this parameter is where they stay separate.
 */
export function decideHsmAccess(params: {
  readonly grants: readonly HsmDomainGrant[];
  readonly spiffeId: string;
  readonly mechanism: string;
  /** Only identities in this trust domain may reach local hardware. */
  readonly requireTrustDomain: string;
}): HsmAccessVerdict {
  const { grants, spiffeId, mechanism, requireTrustDomain } = params;

  const domain = trustDomainOf(spiffeId);
  if (domain === undefined || spiffePathOf(spiffeId) === undefined) {
    return { allowed: false, reason: `'${spiffeId}' is not a well-formed SPIFFE ID` };
  }
  if (domain !== requireTrustDomain) {
    return {
      allowed: false,
      reason: `'${spiffeId}' belongs to trust domain '${domain}'; local hardware keys are reachable only by '${requireTrustDomain}'. Accepting a peer's identity is not granting it your HSM`,
    };
  }
  if (!(YUBIHSM2_MECHANISMS_OBSERVED as readonly string[]).includes(mechanism)) {
    return {
      allowed: false,
      reason: `mechanism '${mechanism}' is not among the mechanisms this device was observed to support (${YUBIHSM2_MECHANISMS_OBSERVED.join(", ")}); notably there is no FROST-capable mechanism on this hardware`,
    };
  }

  const matches = grants.filter((g) => spiffeIdMatchesPrefix(spiffeId, g.spiffeIdPrefix));
  if (matches.length === 0) {
    return { allowed: false, reason: `no HSM domain grant matches '${spiffeId}' — deny by default` };
  }
  if (matches.length > 1) {
    return {
      allowed: false,
      reason: `'${spiffeId}' matches ${String(matches.length)} grants (${matches.map((m) => m.spiffeIdPrefix).join(", ")}); an ambiguous authorization is refused, not resolved`,
    };
  }
  const grant = matches[0];
  if (grant === undefined) {
    return { allowed: false, reason: `no HSM domain grant matches '${spiffeId}' — deny by default` };
  }
  if (!grant.allowedMechanisms.includes(mechanism as HsmMechanism)) {
    return {
      allowed: false,
      hsmDomain: grant.hsmDomain,
      matchedPrefix: grant.spiffeIdPrefix,
      reason: `'${spiffeId}' reaches domain ${String(grant.hsmDomain)} but may only use [${grant.allowedMechanisms.join(", ")}], not '${mechanism}'`,
    };
  }
  return {
    allowed: true,
    hsmDomain: grant.hsmDomain,
    matchedPrefix: grant.spiffeIdPrefix,
    reason:
      `'${spiffeId}' authorized for '${mechanism}' in HSM domain ${String(grant.hsmDomain)}` +
      (grant.note === undefined ? "" : ` (${grant.note})`) +
      " — DECISION only; the session that would carry it out cannot be opened by an agent",
  };
}
