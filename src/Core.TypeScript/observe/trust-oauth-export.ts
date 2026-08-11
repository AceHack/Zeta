/**
 * trust-oauth-export.ts — OAuth as an EXPORT of local trust verdicts (slice 4).
 *
 * Trajectory: `docs/trajectories/local-trust-view-decentralized-identity/RESUME.md`
 *
 * ## Why this is deliberately LAST
 *
 * Building the provider first would force naming an issuer, and an issuer is a hub —
 * the exact thing this trajectory exists to remove, reintroduced at step one and
 * worked around forever after. Once a node computes its own verdict (slices 1-3),
 * OAuth becomes a shim that EXPORTS a local verdict to systems expecting a central
 * authority. Same content, opposite dependency direction.
 *
 * ## What this does
 *
 * Translates a `TrustVerdict` (the local, pure, non-boolean spectrum from slice 1)
 * into OAuth-shaped tokens that external systems can consume. The node is the issuer;
 * the verdict is the claim; the token is the transport format.
 *
 * ## What this deliberately does NOT do
 *
 * - **No central issuer.** Each node that calls `exportVerdict()` issues its own token.
 *   There is no "the" token server — any node with a signing key can export.
 * - **No global scope.** A token asserts "I (this node) believe X about subject Y."
 *   It does NOT assert "the network believes X about Y."
 * - **No revocation registry.** Tokens expire. The short lifetime IS the revocation.
 *   A revocation list is a global data structure, and a global data structure is a hub.
 * - **No discovery.** Finding a node that issues tokens is the consumer's problem.
 *   Advertising issuance would create a directory, and a directory is assemblable.
 *
 * ## OAuth 2.0 mapping
 *
 * | OAuth concept    | Maps to                                    |
 * |------------------|--------------------------------------------|
 * | Issuer (iss)     | This node's identifier (SubjectId)         |
 * | Subject (sub)    | The subject the verdict is about           |
 * | Audience (aud)   | The consuming service requesting the token |
 * | Claims           | TrustSignals flattened to key/value pairs  |
 * | Expiry (exp)     | Short-lived (phases, not wall-clock)       |
 * | Scope            | "trust:read" — the verdict is read-only    |
 *
 * ## Connects to
 *
 * - `local-trust-view.ts` (slice 1) — the verdict this exports
 * - `signed-stamp.ts` (slice 3) — the signature scheme for token signing
 * - `trust-neighbourhood.ts` (slice 2) — NOT connected (fingerprints are private)
 * - `phase-clock.ts` — expiry measured in phases
 */

import type { TrustVerdict, TrustSignal, SubjectId } from "./local-trust-view";

// ═══ Token Types ══════════════════════════════════════════════════════════════

/**
 * A trust claim — one signal from the verdict, flattened for JWT-style transport.
 */
export interface TrustClaim {
  readonly kind: TrustSignal["kind"];
  /** The primary numeric value (depth, span, or index depending on kind). */
  readonly value: number;
  /** Additional context (reason for chain-broken, phase for shared-anchor). */
  readonly detail?: string;
}

/**
 * The exported token payload (JWT claims shape).
 *
 * NOT actually a JWT — this is the structured payload that a JWT (or any other
 * signed token format) would carry. The signing/serialization is format-specific
 * and lives in the transport layer, not here.
 */
export interface TrustTokenPayload {
  /** Issuer: the node exporting this verdict (its own SubjectId). */
  readonly iss: string;
  /** Subject: who the verdict is about. */
  readonly sub: string;
  /** Audience: which service this token is for. */
  readonly aud: string;
  /** Issued at: the phase at which this was exported. */
  readonly iat: number;
  /** Expires: the phase after which this token should not be accepted. */
  readonly exp: number;
  /** Scope: always "trust:read" for verdict exports. */
  readonly scope: "trust:read";
  /** The trust claims (verdict signals flattened). */
  readonly claims: readonly TrustClaim[];
  /** The overall signal quality: how much evidence backs this verdict. */
  readonly evidence_depth: number;
}

/**
 * Configuration for token export.
 */
export interface ExportConfig {
  /** This node's identifier (becomes the issuer). */
  readonly issuerId: SubjectId;
  /** Current phase (for iat). */
  readonly currentPhase: number;
  /** Token lifetime in phases (default: 100 — about 25 hours at 15min ticks). */
  readonly lifetimePhases?: number;
  /** Target audience (the consuming service). */
  readonly audience: string;
}

const DEFAULT_LIFETIME = 100; // ~25 hours at 15-min ticks

// ═══ Export Logic ═════════════════════════════════════════════════════════════

/**
 * Flatten a TrustSignal into a TrustClaim.
 */
function signalToClaim(signal: TrustSignal): TrustClaim {
  switch (signal.kind) {
    case "shared-anchor":
      return { kind: "shared-anchor", value: signal.depth, detail: `phase:${signal.atPhase}` };
    case "chain-verified":
      return { kind: "chain-verified", value: signal.span, detail: `links:${signal.links}` };
    case "chain-broken":
      return { kind: "chain-broken", value: signal.atIndex, detail: signal.reason };
    case "no-evidence":
      return { kind: "no-evidence", value: 0 };
  }
}

/**
 * Compute evidence depth: how many non-trivial signals support the verdict.
 * "no-evidence" contributes 0; everything else contributes 1.
 */
function computeEvidenceDepth(signals: readonly TrustSignal[]): number {
  return signals.filter((s) => s.kind !== "no-evidence").length;
}

/**
 * Export a local trust verdict as an OAuth-shaped token payload.
 *
 * PURE: deterministic given (verdict, config). No I/O, no signing (that's transport).
 *
 * The token asserts: "I (iss) believe these claims about (sub) as of phase (iat),
 * valid until phase (exp), for consumption by (aud)."
 *
 * A consuming service that trusts this issuer can use the claims to make access
 * decisions. A service that does not trust this issuer ignores the token entirely.
 * Trust in the issuer is established out-of-band (the same way any OAuth provider
 * is trusted — by configuration, not by protocol).
 */
export function exportVerdict(
  verdict: TrustVerdict,
  config: ExportConfig,
): TrustTokenPayload {
  const lifetime = config.lifetimePhases ?? DEFAULT_LIFETIME;
  return {
    iss: config.issuerId,
    sub: verdict.subject,
    aud: config.audience,
    iat: config.currentPhase,
    exp: config.currentPhase + lifetime,
    scope: "trust:read",
    claims: verdict.signals.map(signalToClaim),
    evidence_depth: computeEvidenceDepth(verdict.signals),
  };
}

// ═══ Token Validation (consumer side) ═════════════════════════════════════════

/**
 * Validation result — either the payload passes checks or it doesn't.
 */
export type ValidationResult =
  | { readonly valid: true; readonly payload: TrustTokenPayload }
  | { readonly valid: false; readonly reason: string };

/**
 * Validate a token payload (structural checks only — NOT signature verification).
 *
 * This checks:
 * 1. Token is not expired (currentPhase < exp)
 * 2. Token was issued in the past (iat <= currentPhase)
 * 3. Audience matches the expected audience
 * 4. Required fields are present
 *
 * Signature verification is transport-layer responsibility (depends on the format:
 * JWT, Paseto, raw Ed25519, etc.) and is NOT this module's concern.
 */
export function validatePayload(
  payload: TrustTokenPayload,
  currentPhase: number,
  expectedAudience: string,
): ValidationResult {
  if (!payload.iss || !payload.sub || !payload.aud) {
    return { valid: false, reason: "missing required field (iss, sub, or aud)" };
  }
  if (payload.scope !== "trust:read") {
    return { valid: false, reason: `unexpected scope: ${payload.scope}` };
  }
  if (payload.iat > currentPhase) {
    return { valid: false, reason: `issued in the future (iat=${payload.iat} > now=${currentPhase})` };
  }
  if (payload.exp <= currentPhase) {
    return { valid: false, reason: `expired (exp=${payload.exp} <= now=${currentPhase})` };
  }
  if (payload.aud !== expectedAudience) {
    return { valid: false, reason: `audience mismatch (got "${payload.aud}", expected "${expectedAudience}")` };
  }
  return { valid: true, payload };
}

// ═══ Convenience: verdict → validated token (single node, self-check) ═════════

/**
 * Full round-trip for testing: export a verdict and immediately validate it.
 * In production, export and validate happen on different nodes.
 */
export function exportAndValidate(
  verdict: TrustVerdict,
  config: ExportConfig,
): ValidationResult {
  const payload = exportVerdict(verdict, config);
  return validatePayload(payload, config.currentPhase, config.audience);
}
