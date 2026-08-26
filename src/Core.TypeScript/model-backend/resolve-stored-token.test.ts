import { describe, expect, test } from "bun:test";
import { memoryTokenStore } from "./token-store.ts";
import { asGithubAccessToken, GITHUB_TOKEN_ENV_KEYS, parseStoredAccessToken, resolveAccessToken } from "./resolve-stored-token.ts";

describe("resolveAccessToken", () => {
  test("store wins over env — gh is never consulted", async () => {
    const store = memoryTokenStore();
    await store.save({ provider: "github", tokens: { accessToken: "gho_store", refreshToken: "" }, lastRefresh: "t" });
    const got = await resolveAccessToken({
      store,
      storeAs: "github",
      env: { GH_TOKEN: "gho_env", GITHUB_TOKEN: "gho_env2" },
      envKeys: GITHUB_TOKEN_ENV_KEYS,
    });
    expect(got).toEqual({ token: "gho_store", source: "store", storeAs: "github" });
  });

  test("falls back to env when the store is empty", async () => {
    const got = await resolveAccessToken({
      store: memoryTokenStore(),
      storeAs: "github",
      env: { GITHUB_TOKEN: " gho_env \n" },
      envKeys: GITHUB_TOKEN_ENV_KEYS,
    });
    expect(got).toEqual({ token: "gho_env", source: "env", storeAs: "github" });
  });

  test("null when neither store nor env has a token — does not shell out", async () => {
    const got = await resolveAccessToken({
      store: memoryTokenStore(),
      storeAs: "github",
      env: { GH_TOKEN: "  ", PATH: "/usr/bin" },
      envKeys: GITHUB_TOKEN_ENV_KEYS,
    });
    expect(got).toBeNull();
  });
});

describe("parseStoredAccessToken", () => {
  test("reads our store shape and trims", () => {
    expect(parseStoredAccessToken(JSON.stringify({ provider: "github", tokens: { accessToken: " gho_x ", refreshToken: "" } }))).toBe("gho_x");
  });

  test("garbage / empty / missing is null, not a throw", () => {
    expect(parseStoredAccessToken("not-json")).toBeNull();
    expect(parseStoredAccessToken("{}")).toBeNull();
    expect(parseStoredAccessToken(JSON.stringify({ tokens: { accessToken: "  " } }))).toBeNull();
  });
});

describe("asGithubAccessToken", () => {
  test("rebuilds a gho_ token from charset-bounded groups; dumps are null", () => {
    expect(asGithubAccessToken("gho_testtokenvalue12345678")).toBe("gho_testtokenvalue12345678");
    expect(asGithubAccessToken("{accessToken:\"gho_testtokenvalue12345678\"}")).toBeNull();
    expect(asGithubAccessToken("https://evil.example/gho_testtokenvalue12345678")).toBeNull();
    expect(asGithubAccessToken("gho_short")).toBeNull();
  });
});
