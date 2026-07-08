export const MOCK_GH_DEVICE_CODE = "zeta-ci-device-code", MOCK_GH_USER_CODE = "ZETA-CI", MOCK_GH_VERIFICATION_URI = "https://mock-gh-device-code.local/login/device", MOCK_GH_STUB_TOKEN = "zeta-ci-stub-token", GH_DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
export function createMockGhDeviceCodeEndpoint() {
  let issuedClientId = null, issuedScope = "";
  return {
    requestDeviceCode(request) {
      issuedClientId = request.client_id;
      issuedScope = request.scope ?? "";
      return {
        device_code: MOCK_GH_DEVICE_CODE,
        user_code: MOCK_GH_USER_CODE,
        verification_uri: MOCK_GH_VERIFICATION_URI,
        expires_in: 600,
        interval: 1
      };
    },
    pollDeviceToken(request) {
      if (issuedClientId === null)
        throw Error("mock gh device-code poll before request");
      if (request.client_id !== issuedClientId)
        throw Error("mock gh device-code poll client_id mismatch");
      if (request.device_code !== MOCK_GH_DEVICE_CODE)
        throw Error("mock gh device-code poll unknown device_code");
      if (request.grant_type !== GH_DEVICE_CODE_GRANT)
        throw Error("mock gh device-code poll unsupported grant_type");
      return {
        access_token: MOCK_GH_STUB_TOKEN,
        token_type: "bearer",
        scope: issuedScope
      };
    }
  };
}
