/**
 * CI-only GitHub device-code stub.
 *
 * This module keeps the installer auth test fork in memory: no real GitHub
 * credentials, no filesystem token cache, and no network calls.
 */

export const MOCK_GH_DEVICE_CODE = "zeta-ci-device-code";
export const MOCK_GH_USER_CODE = "ZETA-CI";
export const MOCK_GH_VERIFICATION_URI = "https://mock-gh-device-code.local/login/device";
export const MOCK_GH_STUB_TOKEN = "zeta-ci-stub-token";
export const GH_DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

export interface GhDeviceCodeRequest {
  readonly client_id: string;
  readonly scope?: string;
}

export interface GhDeviceCodeResponse {
  readonly device_code: string;
  readonly user_code: string;
  readonly verification_uri: string;
  readonly expires_in: number;
  readonly interval: number;
}

export interface GhDeviceTokenPollRequest {
  readonly client_id: string;
  readonly device_code: string;
  readonly grant_type: string;
}

export interface GhDeviceTokenResponse {
  readonly access_token: string;
  readonly token_type: "bearer";
  readonly scope: string;
}

export interface MockGhDeviceCodeEndpoint {
  readonly requestDeviceCode: (request: GhDeviceCodeRequest) => GhDeviceCodeResponse;
  readonly pollDeviceToken: (request: GhDeviceTokenPollRequest) => GhDeviceTokenResponse;
}

export function createMockGhDeviceCodeEndpoint(): MockGhDeviceCodeEndpoint {
  let issuedClientId: string | null = null;
  let issuedScope = "";

  return {
    requestDeviceCode(request) {
      issuedClientId = request.client_id;
      issuedScope = request.scope ?? "";
      return {
        device_code: MOCK_GH_DEVICE_CODE,
        user_code: MOCK_GH_USER_CODE,
        verification_uri: MOCK_GH_VERIFICATION_URI,
        expires_in: 600,
        interval: 1,
      };
    },
    pollDeviceToken(request) {
      if (issuedClientId === null) {
        throw new Error("mock gh device-code poll before request");
      }
      if (request.client_id !== issuedClientId) {
        throw new Error("mock gh device-code poll client_id mismatch");
      }
      if (request.device_code !== MOCK_GH_DEVICE_CODE) {
        throw new Error("mock gh device-code poll unknown device_code");
      }
      if (request.grant_type !== GH_DEVICE_CODE_GRANT) {
        throw new Error("mock gh device-code poll unsupported grant_type");
      }
      return {
        access_token: MOCK_GH_STUB_TOKEN,
        token_type: "bearer",
        scope: issuedScope,
      };
    },
  };
}
