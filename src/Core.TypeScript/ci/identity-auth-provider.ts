/**
 * Provider-shaped identity-auth seam for first-session / installer CI.
 *
 * Today the production foothold is GitHub CLI (`gh auth login` device-code).
 * That is temporary: ADR 2026-07-08-distributed-identity-provider makes Zeta
 * its own IdP, and ZetaDB / DagFs is the eventual git backend + client
 * replacement. This module keeps CI and first-session code behind a vendor-
 * neutral contract so the mock path does not harden `gh` as forever.
 *
 * CI fork (ADR 2026-07-08-installer-ci-auth-mock-gh-device-code):
 *   - mock  → exercise device-code UX against in-memory stub (no real secrets)
 *   - skip  → explicit serial marker; do not claim auth coverage
 *   - live  → real provider CLI (production / physical)
 */

import {
  GH_DEVICE_CODE_GRANT,
  MOCK_GH_STUB_TOKEN,
  MOCK_GH_USER_CODE,
  MOCK_GH_VERIFICATION_URI,
  createMockGhDeviceCodeEndpoint,
  type MockGhDeviceCodeEndpoint,
} from "./mock-gh-device-code";

/** Temporary first-target vendor id. Not the long-term IdP name. */
export const TEMPORARY_CLUSTER_AUTH_VENDOR = "gh" as const;

export type IdentityAuthMode = "live" | "mock" | "skip";

export const IDENTITY_AUTH_MODE_ENV = "ZETA_IDENTITY_AUTH_MODE";

/** Serial markers — QEMU / CI must distinguish mock coverage from skip. */
export const IDENTITY_AUTH_SERIAL = {
  begin: "zeta-first-session: identity-auth-begin",
  mockBegin: "zeta-first-session: identity-auth-mock-begin",
  mockUserCode: "zeta-first-session: identity-auth-mock-user-code",
  mockOk: "zeta-first-session: identity-auth-mock-ok",
  mockFailed: "zeta-first-session: identity-auth-mock-failed",
  skip: "zeta-first-session: identity-auth-skip",
  liveBegin: "zeta-first-session: gh-auth-begin",
  liveOk: "zeta-first-session: gh-auth-ok",
  liveFailed: "zeta-first-session: gh-auth-failed",
} as const;

export interface IdentityAuthResult {
  readonly outcome: "ready" | "failed" | "skipped";
  readonly message: string;
  readonly mode: IdentityAuthMode;
  /** Stub token only — never a real GitHub credential. */
  readonly stubToken?: string;
  readonly userCode?: string;
  readonly verificationUri?: string;
}

export interface IdentityAuthProvider {
  readonly id: string;
  readonly mode: IdentityAuthMode;
  readonly authenticate: () => IdentityAuthResult;
}

export function resolveIdentityAuthMode(
  env: NodeJS.ProcessEnv = process.env,
): IdentityAuthMode {
  const raw = (env[IDENTITY_AUTH_MODE_ENV] ?? "").trim().toLowerCase();
  if (raw === "mock" || raw === "skip" || raw === "live") return raw;
  // Legacy alias used in early QEMU notes — treat as mock.
  if (raw === "mock-gh" || raw === "ci-mock") return "mock";
  return "live";
}

export function createMockIdentityAuthProvider(
  endpoint: MockGhDeviceCodeEndpoint = createMockGhDeviceCodeEndpoint(),
  clientId = "zeta-ci-installer",
  scope = "repo read:public_key",
): IdentityAuthProvider {
  return {
    id: TEMPORARY_CLUSTER_AUTH_VENDOR,
    mode: "mock",
    authenticate() {
      try {
        const device = endpoint.requestDeviceCode({ client_id: clientId, scope });
        const token = endpoint.pollDeviceToken({
          client_id: clientId,
          device_code: device.device_code,
          grant_type: GH_DEVICE_CODE_GRANT,
        });
        if (token.access_token !== MOCK_GH_STUB_TOKEN) {
          return {
            outcome: "failed",
            message: "mock identity auth returned unexpected stub token",
            mode: "mock",
          };
        }
        return {
          outcome: "ready",
          message: "CI mock identity auth completed (temporary gh-shaped foothold)",
          mode: "mock",
          stubToken: token.access_token,
          userCode: device.user_code,
          verificationUri: device.verification_uri,
        };
      } catch (err) {
        return {
          outcome: "failed",
          message: err instanceof Error ? err.message : String(err),
          mode: "mock",
        };
      }
    },
  };
}

export function createSkipIdentityAuthProvider(): IdentityAuthProvider {
  return {
    id: TEMPORARY_CLUSTER_AUTH_VENDOR,
    mode: "skip",
    authenticate() {
      return {
        outcome: "skipped",
        message: "identity auth skipped with explicit CI marker (no auth coverage claimed)",
        mode: "skip",
      };
    },
  };
}

/** Emit serial lines for a mock/skip result (caller logs live path separately). */
export function serialLinesForIdentityAuth(result: IdentityAuthResult): readonly string[] {
  if (result.mode === "skip") {
    return [IDENTITY_AUTH_SERIAL.begin, IDENTITY_AUTH_SERIAL.skip];
  }
  if (result.mode === "mock") {
    const lines: string[] = [IDENTITY_AUTH_SERIAL.begin, IDENTITY_AUTH_SERIAL.mockBegin];
    if (result.userCode) {
      lines.push(`${IDENTITY_AUTH_SERIAL.mockUserCode} ${result.userCode}`);
    }
    if (result.verificationUri) {
      lines.push(`zeta-first-session: identity-auth-mock-uri ${result.verificationUri}`);
    }
    lines.push(result.outcome === "ready" ? IDENTITY_AUTH_SERIAL.mockOk : IDENTITY_AUTH_SERIAL.mockFailed);
    return lines;
  }
  return [];
}

export {
  MOCK_GH_USER_CODE,
  MOCK_GH_VERIFICATION_URI,
  MOCK_GH_STUB_TOKEN,
};
