import { describe, expect, test } from "bun:test";
import { PROVIDER_ROSTER, preferredLogin, resolveProvider, uniqueStoreKeys, wiredProviders } from "./provider-roster.ts";

describe("provider roster", () => {
  test("the seven paid accounts plus GitHub are declared, ids unique", () => {
    const ids = PROVIDER_ROSTER.map((p) => p.id);
    expect(ids).toEqual(["github", "openai", "codex", "claude", "grok", "gemini", "kiro", "manus"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("aliases resolve; unknown is null; empty is null", () => {
    expect(resolveProvider("chatgpt")?.id).toBe("openai");
    expect(resolveProvider("GH")?.id).toBe("github");
    expect(resolveProvider("xai")?.id).toBe("grok");
    expect(resolveProvider("anthropic")?.id).toBe("claude");
    expect(resolveProvider("nope")).toBeNull();
    expect(resolveProvider("")).toBeNull();
  });

  test("codex stores under openai (one ChatGPT account, two product names)", () => {
    expect(resolveProvider("codex")?.storeAs).toBe("openai");
    expect(resolveProvider("openai")?.storeAs).toBe("openai");
  });

  test("wired set is github + ChatGPT/codex + manus api-key", () => {
    const wired = wiredProviders().map((p) => p.id);
    expect(wired).toEqual(["github", "openai", "codex", "manus"]);
  });

  test("uniqueStoreKeys collapses the openai/codex pair", () => {
    expect(uniqueStoreKeys()).toEqual(["github", "openai", "claude", "grok", "gemini", "kiro", "manus"]);
  });

  test("manus is an account API key, remote-only — not a local tool loop", () => {
    const m = resolveProvider("manus");
    expect(m?.loginKind).toBe("account-api-key");
    expect(m?.status).toBe("wired");
    expect(m?.execution).toBe("remote-only");
    expect(m?.flows).toEqual(["api-key"]);
  });

  test("a missing AuthProvider cannot hide as wired — declared providers stay declared", () => {
    for (const p of PROVIDER_ROSTER) {
      if (p.id === "claude" || p.id === "grok" || p.id === "gemini" || p.id === "kiro") {
        expect(p.status).toBe("declared");
      }
    }
  });

  test("preferred login is device-code when the vendor offers it, never localhost PKCE over device", () => {
    expect(preferredLogin(resolveProvider("github")!)).toBe("device-code");
    expect(preferredLogin(resolveProvider("openai")!)).toBe("device-code");
    expect(preferredLogin(resolveProvider("grok")!)).toBe("device-code");
    expect(preferredLogin(resolveProvider("kiro")!)).toBe("device-code");
    expect(preferredLogin(resolveProvider("claude")!)).toBe("paste-code");
    expect(preferredLogin(resolveProvider("gemini")!)).toBe("vendor-cli-import");
    expect(preferredLogin(resolveProvider("manus")!)).toBe("api-key");
  });

  test("every paid LLM except manus has a vendor-cli-import path", () => {
    for (const id of ["openai", "codex", "claude", "grok", "gemini", "kiro", "github"]) {
      expect(resolveProvider(id)?.flows.includes("vendor-cli-import")).toBe(true);
    }
    expect(resolveProvider("manus")?.flows.includes("vendor-cli-import")).toBe(false);
  });
});
