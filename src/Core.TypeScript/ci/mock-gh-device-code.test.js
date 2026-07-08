import { describe, expect, it } from "bun:test";
import {
  GH_DEVICE_CODE_GRANT,
  MOCK_GH_STUB_TOKEN,
  MOCK_GH_USER_CODE,
  createMockGhDeviceCodeEndpoint
} from "./mock-gh-device-code.ts";
describe("mock gh device-code endpoint", () => {
  it("returns fixed user_code and completes poll with stub token", () => {
    const endpoint = createMockGhDeviceCodeEndpoint(), device = endpoint.requestDeviceCode({
      client_id: "zeta-ci-installer",
      scope: "repo read:public_key"
    });
    expect(device.user_code).toBe(MOCK_GH_USER_CODE);
    const token = endpoint.pollDeviceToken({
      client_id: "zeta-ci-installer",
      device_code: device.device_code,
      grant_type: GH_DEVICE_CODE_GRANT
    });
    expect(token.access_token).toBe(MOCK_GH_STUB_TOKEN);
    expect(token.token_type).toBe("bearer");
    expect(token.scope).toBe("repo read:public_key");
  });
});
