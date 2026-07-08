import {
  GH_DEVICE_CODE_GRANT,
  MOCK_GH_STUB_TOKEN,
  MOCK_GH_USER_CODE,
  MOCK_GH_VERIFICATION_URI,
  createMockGhDeviceCodeEndpoint
} from "./mock-gh-device-code";
export const TEMPORARY_CLUSTER_AUTH_VENDOR = "gh", IDENTITY_AUTH_MODE_ENV = "ZETA_IDENTITY_AUTH_MODE", IDENTITY_AUTH_SERIAL = {
  begin: "zeta-first-session: identity-auth-begin",
  mockBegin: "zeta-first-session: identity-auth-mock-begin",
  mockUserCode: "zeta-first-session: identity-auth-mock-user-code",
  mockOk: "zeta-first-session: identity-auth-mock-ok",
  mockFailed: "zeta-first-session: identity-auth-mock-failed",
  skip: "zeta-first-session: identity-auth-skip",
  liveBegin: "zeta-first-session: gh-auth-begin",
  liveOk: "zeta-first-session: gh-auth-ok",
  liveFailed: "zeta-first-session: gh-auth-failed"
};
export function resolveIdentityAuthMode(env = process.env) {
  const raw = (env[IDENTITY_AUTH_MODE_ENV] ?? "").trim().toLowerCase();
  if (raw === "mock" || raw === "skip" || raw === "live")
    return raw;
  if (raw === "mock-gh" || raw === "ci-mock")
    return "mock";
  return "live";
}
export function createMockIdentityAuthProvider(endpoint = createMockGhDeviceCodeEndpoint(), clientId = "zeta-ci-installer", scope = "repo read:public_key") {
  return {
    id: TEMPORARY_CLUSTER_AUTH_VENDOR,
    mode: "mock",
    authenticate() {
      try {
        const device = endpoint.requestDeviceCode({ client_id: clientId, scope }), token = endpoint.pollDeviceToken({
          client_id: clientId,
          device_code: device.device_code,
          grant_type: GH_DEVICE_CODE_GRANT
        });
        if (token.access_token !== MOCK_GH_STUB_TOKEN)
          return {
            outcome: "failed",
            message: "mock identity auth returned unexpected stub token",
            mode: "mock"
          };
        return {
          outcome: "ready",
          message: "CI mock identity auth completed (temporary gh-shaped foothold)",
          mode: "mock",
          stubToken: token.access_token,
          userCode: device.user_code,
          verificationUri: device.verification_uri
        };
      } catch (err) {
        return {
          outcome: "failed",
          message: err instanceof Error ? err.message : String(err),
          mode: "mock"
        };
      }
    }
  };
}
export function createSkipIdentityAuthProvider() {
  return {
    id: TEMPORARY_CLUSTER_AUTH_VENDOR,
    mode: "skip",
    authenticate() {
      return {
        outcome: "skipped",
        message: "identity auth skipped with explicit CI marker (no auth coverage claimed)",
        mode: "skip"
      };
    }
  };
}
export function serialLinesForIdentityAuth(result) {
  if (result.mode === "skip")
    return [IDENTITY_AUTH_SERIAL.begin, IDENTITY_AUTH_SERIAL.skip];
  if (result.mode === "mock") {
    const lines = [IDENTITY_AUTH_SERIAL.begin, IDENTITY_AUTH_SERIAL.mockBegin];
    if (result.userCode)
      lines.push(`${IDENTITY_AUTH_SERIAL.mockUserCode} ${result.userCode}`);
    if (result.verificationUri)
      lines.push(`zeta-first-session: identity-auth-mock-uri ${result.verificationUri}`);
    lines.push(result.outcome === "ready" ? IDENTITY_AUTH_SERIAL.mockOk : IDENTITY_AUTH_SERIAL.mockFailed);
    return lines;
  }
  return [];
}

export {
  MOCK_GH_USER_CODE,
  MOCK_GH_VERIFICATION_URI,
  MOCK_GH_STUB_TOKEN
};
