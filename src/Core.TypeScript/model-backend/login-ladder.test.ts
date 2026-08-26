import { describe, expect, test } from "bun:test";
import { LOGIN_FLOWS, LOGIN_LADDER, preferredFlow, rankOf } from "./login-ladder.ts";

describe("login ladder", () => {
  test("device-code beats every other flow, including vendor-cli-import and localhost PKCE", () => {
    expect(rankOf("device-code")).toBe(0);
    expect(preferredFlow(["api-key", "pkce-localhost", "device-code", "vendor-cli-import"])).toBe("device-code");
  });

  test("paste-code (any-device browser, no local callback) beats localhost PKCE", () => {
    expect(preferredFlow(["pkce-localhost", "paste-code"])).toBe("paste-code");
  });

  test("vendor-cli-import beats a local browser and is valid on a remote box", () => {
    expect(preferredFlow(["pkce-localhost", "vendor-cli-import"])).toBe("vendor-cli-import");
    expect(LOGIN_LADDER.find((r) => r.flow === "vendor-cli-import")?.remoteOk).toBe(true);
    expect(LOGIN_LADDER.find((r) => r.flow === "pkce-localhost")?.localBrowser).toBe(true);
  });

  test("api-key is last — account login is primary", () => {
    expect(rankOf("api-key")).toBe(LOGIN_FLOWS.length - 1);
    expect(preferredFlow(["api-key"])).toBe("api-key");
  });

  test("empty offer is null, not a guessed flow", () => {
    expect(preferredFlow([])).toBeNull();
  });
});
