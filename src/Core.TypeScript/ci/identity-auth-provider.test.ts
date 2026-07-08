import { describe, expect, it } from "bun:test";
import {
  IDENTITY_AUTH_SERIAL,
  MOCK_GH_USER_CODE,
  createMockIdentityAuthProvider,
  createSkipIdentityAuthProvider,
  resolveIdentityAuthMode,
  serialLinesForIdentityAuth,
} from "./identity-auth-provider.ts";

describe("identity-auth-provider seam", () => {
  it("resolveIdentityAuthMode defaults to live", () => {
    expect(resolveIdentityAuthMode({})).toBe("live");
  });

  it("resolveIdentityAuthMode accepts mock skip live and legacy aliases", () => {
    expect(resolveIdentityAuthMode({ ZETA_IDENTITY_AUTH_MODE: "mock" })).toBe("mock");
    expect(resolveIdentityAuthMode({ ZETA_IDENTITY_AUTH_MODE: "skip" })).toBe("skip");
    expect(resolveIdentityAuthMode({ ZETA_IDENTITY_AUTH_MODE: "live" })).toBe("live");
    expect(resolveIdentityAuthMode({ ZETA_IDENTITY_AUTH_MODE: "mock-gh" })).toBe("mock");
  });

  it("mock provider completes device-code UX with fixed user_code", () => {
    const provider = createMockIdentityAuthProvider();
    const result = provider.authenticate();
    expect(result.mode).toBe("mock");
    expect(result.outcome).toBe("ready");
    expect(result.userCode).toBe(MOCK_GH_USER_CODE);
    expect(result.stubToken).toBeDefined();
  });

  it("skip provider emits skipped without claiming coverage", () => {
    const result = createSkipIdentityAuthProvider().authenticate();
    expect(result.outcome).toBe("skipped");
    expect(result.mode).toBe("skip");
  });

  it("serialLinesForIdentityAuth distinguishes mock vs skip", () => {
    const mock = createMockIdentityAuthProvider().authenticate();
    const mockLines = serialLinesForIdentityAuth(mock);
    expect(mockLines).toContain(IDENTITY_AUTH_SERIAL.mockBegin);
    expect(mockLines).toContain(IDENTITY_AUTH_SERIAL.mockOk);
    expect(mockLines.some((l) => l.includes(MOCK_GH_USER_CODE))).toBe(true);

    const skip = createSkipIdentityAuthProvider().authenticate();
    const skipLines = serialLinesForIdentityAuth(skip);
    expect(skipLines).toContain(IDENTITY_AUTH_SERIAL.skip);
    expect(skipLines).not.toContain(IDENTITY_AUTH_SERIAL.mockOk);
  });
});
