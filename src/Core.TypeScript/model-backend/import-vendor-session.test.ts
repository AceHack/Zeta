import { describe, expect, test } from "bun:test";
import {
  expandHome,
  importVendorSession,
  tokensFromGhHostsYaml,
  tokensFromVendorJson,
} from "./import-vendor-session.ts";

describe("tokensFromVendorJson", () => {
  test("Codex ~/.codex/auth.json nested tokens", () => {
    const t = tokensFromVendorJson(
      JSON.stringify({ auth_mode: "chatgpt", tokens: { access_token: "AT", refresh_token: "RT", account_id: "acct" } }),
    );
    expect(t).toEqual({ accessToken: "AT", refreshToken: "RT", accountId: "acct" });
  });

  test("Claude Code claudeAiOauth camelCase", () => {
    const t = tokensFromVendorJson(JSON.stringify({ claudeAiOauth: { accessToken: "AT", refreshToken: "RT" } }));
    expect(t).toEqual({ accessToken: "AT", refreshToken: "RT" });
  });

  test("Gemini / Grok top-level snake_case", () => {
    const t = tokensFromVendorJson(JSON.stringify({ access_token: "AT", refresh_token: "RT" }));
    expect(t).toEqual({ accessToken: "AT", refreshToken: "RT" });
  });

  test("garbage is null, not a throw", () => {
    expect(tokensFromVendorJson("not-json")).toBeNull();
    expect(tokensFromVendorJson("{}")).toBeNull();
  });
});

describe("tokensFromGhHostsYaml", () => {
  test("reads oauth_token from gh hosts.yml", () => {
    const t = tokensFromGhHostsYaml("github.com:\n    user: AceHack\n    oauth_token: gho_T\n    git_protocol: https\n");
    expect(t).toEqual({ accessToken: "gho_T", refreshToken: "" });
  });
});

describe("importVendorSession", () => {
  test("expands ~ and takes the first file that parses", async () => {
    const files = new Map<string, string>([["/home/me/.grok/auth.json", JSON.stringify({ access_token: "AT", refresh_token: "RT" })]]);
    const r = await importVendorSession(["~/.missing.json", "~/.grok/auth.json"], "/home/me", (p) => {
      const v = files.get(p);
      if (v === undefined) return Promise.reject(new Error("missing"));
      return Promise.resolve(v);
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tokens.accessToken).toBe("AT");
      expect(r.path).toBe("/home/me/.grok/auth.json");
    }
  });

  test("all missing is a clean failure", async () => {
    const r = await importVendorSession(["~/.nope.json"], "/home/me", () => Promise.reject(new Error("missing")));
    expect(r.ok).toBe(false);
  });
});

describe("expandHome", () => {
  test("tilde-slash, bare tilde, already absolute", () => {
    expect(expandHome("~/.x", "/home/me")).toBe("/home/me/.x");
    expect(expandHome("~", "/home/me")).toBe("/home/me");
    expect(expandHome("/abs", "/home/me")).toBe("/abs");
  });
});
