import { describe, expect, test } from "bun:test";
import type { AuthProvider, DeviceFlowStart, PollResult } from "./auth-provider.ts";
import { memoryTokenStore } from "./token-store.ts";
import { main, runLogin, type CliIo } from "./zeta-login-cli.ts";
import type { ProviderEntry } from "./provider-roster.ts";

function collectIo() {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = { out: (l) => out.push(l), err: (l) => err.push(l) };
  return { io, out, err };
}

function fakeGithubProvider(): AuthProvider {
  let polls = 0;
  const start: DeviceFlowStart = {
    deviceAuthId: "dev",
    userCode: "AAAA-1111",
    verificationUri: "https://github.com/login/device",
    intervalSec: 1,
  };
  return {
    name: "github",
    startDeviceFlow: () => Promise.resolve({ ok: true, value: start }),
    pollDevice: (): Promise<PollResult> => {
      polls += 1;
      if (polls === 1) return Promise.resolve({ ok: true, pending: true });
      return Promise.resolve({ ok: true, tokens: { accessToken: "gho_T", refreshToken: "" } });
    },
    authorizeUrl: () => "https://github.com/login/oauth/authorize",
    exchangeCode: () => Promise.resolve({ ok: false, error: "unused" }),
    refresh: () => Promise.resolve({ ok: false, error: "unused" }),
  };
}

const providers = (entry: ProviderEntry): AuthProvider | null => (entry.storeAs === "github" ? fakeGithubProvider() : null);

describe("zeta-login-cli list", () => {
  test("list --json names every roster id", async () => {
    const store = memoryTokenStore();
    const { io, out } = collectIo();
    expect(await main(["list", "--json"], store, io)).toBe(0);
    const parsed = JSON.parse(out.join("\n")) as { providers: { id: string }[] };
    expect(parsed.providers.map((p) => p.id)).toEqual(["github", "openai", "codex", "claude", "grok", "gemini", "kiro", "manus"]);
  });
});

describe("zeta-login-cli login", () => {
  test("wired github device flow persists under storeAs", async () => {
    const store = memoryTokenStore();
    const { io, out } = collectIo();
    expect(await runLogin("gh", store, io, { providers, sleep: () => Promise.resolve(), now: () => "t0", maxPolls: 5 })).toBe(0);
    expect(out.some((l) => l.includes("AAAA-1111"))).toBe(true);
    expect((await store.load("github"))?.tokens.accessToken).toBe("gho_T");
  });

  test("declared provider fails closed and names the AuthProvider workitem — no silent skip", async () => {
    const store = memoryTokenStore();
    const { io, err } = collectIo();
    expect(await runLogin("claude", store, io, { providers })).toBe(1);
    const parsed = JSON.parse(err.join("\n")) as { ok: boolean; error: string; next: string; provider: string };
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("no-auth-provider");
    expect(parsed.provider).toBe("claude");
    expect(parsed.next).toBe("081M100RH29087G0R0031HHGJ0");
    expect(await store.load("claude")).toBeNull();
  });

  test("unknown provider is a usage error", async () => {
    const store = memoryTokenStore();
    const { io } = collectIo();
    expect(await main(["login", "nope"], store, io)).toBe(2);
  });
});

describe("zeta-login-cli status / token", () => {
  test("status --json reports logged-in only after a store write", async () => {
    const store = memoryTokenStore();
    await store.save({ provider: "openai", tokens: { accessToken: "AT", refreshToken: "RT" }, lastRefresh: "t" });
    const { io, out } = collectIo();
    expect(await main(["status", "--json"], store, io)).toBe(0);
    const parsed = JSON.parse(out.join("\n")) as { status: { id: string; loggedIn: boolean; storeAs: string }[] };
    const openai = parsed.status.find((r) => r.id === "openai");
    const codex = parsed.status.find((r) => r.id === "codex");
    const claude = parsed.status.find((r) => r.id === "claude");
    expect(openai?.loggedIn).toBe(true);
    expect(codex?.loggedIn).toBe(true); // same storeAs
    expect(claude?.loggedIn).toBe(false);
  });

  test("token chatgpt reads the openai store key", async () => {
    const store = memoryTokenStore();
    await store.save({ provider: "openai", tokens: { accessToken: "AT", refreshToken: "RT" }, lastRefresh: "t" });
    const { io, out } = collectIo();
    expect(await main(["token", "chatgpt"], store, io)).toBe(0);
    expect(out).toEqual(["AT"]);
  });
});

describe("zeta-login-cli manus api-key", () => {
  test("refuses without --from-file", async () => {
    const store = memoryTokenStore();
    const { io, err } = collectIo();
    expect(await main(["login", "manus"], store, io)).toBe(2);
    expect(JSON.parse(err.join("\n")).error).toBe("api-key-file-required");
    expect(await store.load("manus")).toBeNull();
  });

  test("stores the key and never prints it", async () => {
    const store = memoryTokenStore();
    const { io, out } = collectIo();
    const files = new Map([["/tmp/manus.key", "msk_secret\n"]]);
    expect(
      await main(["login", "manus", "--from-file", "/tmp/manus.key"], store, io, {
        readFile: (p) => {
          const v = files.get(p);
          if (v === undefined) return Promise.reject(new Error("missing"));
          return Promise.resolve(v);
        },
      }),
    ).toBe(0);
    expect((await store.load("manus"))?.tokens.accessToken).toBe("msk_secret");
    expect(out.join("\n").includes("msk_secret")).toBe(false);
  });

  test("status --json marks manus remote-only even after login", async () => {
    const store = memoryTokenStore();
    const files = new Map([["/k", "msk_secret"]]);
    const { io, out } = collectIo();
    expect(
      await main(["login", "manus", "--from-file", "/k"], store, io, {
        readFile: (p) => Promise.resolve(files.get(p) ?? ""),
      }),
    ).toBe(0);
    out.length = 0;
    expect(await main(["status", "--json"], store, io)).toBe(0);
    const parsed = JSON.parse(out.join("\n")) as { status: { id: string; loggedIn: boolean; execution: string }[] };
    const manus = parsed.status.find((r) => r.id === "manus");
    expect(manus?.loggedIn).toBe(true);
    expect(manus?.execution).toBe("remote-only");
  });
});

describe("zeta-login-cli import", () => {
  test("copies a grok CLI session into our store without an AuthProvider", async () => {
    const store = memoryTokenStore();
    const { io } = collectIo();
    const files = new Map([["/home/me/.grok/auth.json", JSON.stringify({ access_token: "AT", refresh_token: "RT" })]]);
    expect(
      await main(["import", "grok"], store, io, {
        importDeps: {
          home: "/home/me",
          readFile: (p) => {
            const v = files.get(p);
            if (v === undefined) return Promise.reject(new Error("missing"));
            return Promise.resolve(v);
          },
          now: () => "t0",
        },
      }),
    ).toBe(0);
    expect((await store.load("grok"))?.tokens.accessToken).toBe("AT");
  });

  test("login claude still fails closed but names import as the next move", async () => {
    const store = memoryTokenStore();
    const { io, err } = collectIo();
    expect(await runLogin("claude", store, io, { providers })).toBe(1);
    const parsed = JSON.parse(err.join("\n")) as { try: string; preferredFlow: string };
    expect(parsed.try).toBe("zeta-login import claude");
    expect(parsed.preferredFlow).toBe("paste-code");
  });
});
