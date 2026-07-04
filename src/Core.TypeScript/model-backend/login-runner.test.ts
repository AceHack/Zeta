import { describe, expect, test } from "bun:test";
import type { HttpTransport } from "./backend.ts";
import type { AuthProvider, DeviceFlowStart, OAuthTokens, PollResult } from "./auth-provider.ts";
import { memoryTokenStore, fileTokenStore, type StoreFs } from "./token-store.ts";
import { deviceLogin, freshAccessToken, defaultStoreDir, type LoginDeps } from "./login-runner.ts";

// THE LOGIN RUNNER + TOKEN STORE (shadow*, Aaron 2026-07-03: "build our own device-login flow"). The
// executor drives the AuthProvider device flow, persists to OUR store, and refreshes to stay alive —
// all injected (transport, store, sleep, onCode) so it's deterministic + fake, NO network/secret.
// Proofs:
//   1. DEVICE LOGIN: start → onCode fires → poll through pending → tokens saved to the store.
//   2. TIMEOUT: never-approved → clean timeout error (never hangs / throws).
//   3. freshAccessToken: returns stored token; forceRefresh refreshes + persists (account_id preserved).
//   4. REFRESH FAILURE (dead session) → clean "re-login" error, not a throw.
//   5. FILE STORE: save then load round-trips over an injected fs; missing file → null.

// A scripted fake provider: emits `pending` N times then `tokens`; refresh returns a rotated token.
function fakeProvider(pendingCount: number): AuthProvider {
  let polls = 0;
  const start: DeviceFlowStart = { deviceAuthId: "dev", userCode: "CODE-1234", verificationUri: "https://chatgpt.com/activate", intervalSec: 1 };
  return {
    name: "openai",
    startDeviceFlow: () => Promise.resolve({ ok: true, value: start }),
    pollDevice: (): Promise<PollResult> => {
      polls += 1;
      if (polls <= pendingCount) return Promise.resolve({ ok: true, pending: true });
      return Promise.resolve({ ok: true, tokens: { accessToken: "AT", refreshToken: "RT", accountId: "acct-1" } });
    },
    authorizeUrl: () => "https://auth.openai.com/oauth/authorize",
    exchangeCode: () => Promise.resolve({ ok: true, value: { accessToken: "AT", refreshToken: "RT" } }),
    refresh: (): Promise<{ ok: true; value: OAuthTokens } | { ok: false; error: string }> => Promise.resolve({ ok: true, value: { accessToken: "AT2", refreshToken: "RT2" } }),
  };
}

const noTransport = {} as HttpTransport; // the fake provider ignores the transport
const deps = (over: Partial<LoginDeps>): LoginDeps => ({
  transport: noTransport,
  store: memoryTokenStore(),
  onCode: () => undefined,
  sleep: () => Promise.resolve(),
  now: () => "2026-07-03T00:00:00Z",
  ...over,
});

describe("deviceLogin", () => {
  test("start → onCode fires → poll through pending → tokens persisted", async () => {
    const shown: { uri: string; code: string }[] = [];
    const store = memoryTokenStore();
    const d = deps({ store, onCode: (uri, code) => shown.push({ uri, code }) });
    const out = await deviceLogin(fakeProvider(2), d);
    expect(shown).toEqual([{ uri: "https://chatgpt.com/activate", code: "CODE-1234" }]); // the one human step
    expect(out.ok).toBe(true);
    const saved = await store.load("openai");
    expect(saved?.tokens.accessToken).toBe("AT");
    expect(saved?.lastRefresh).toBe("2026-07-03T00:00:00Z");
  });

  test("never-approved → clean timeout (never hangs)", async () => {
    const prov = fakeProvider(9999); // always pending
    const out = await deviceLogin(prov, deps({ maxPolls: 3 }));
    expect(out).toEqual({ ok: false, error: "device login timed out (not approved in time)" });
  });
});

describe("freshAccessToken", () => {
  test("returns the stored token; forceRefresh rotates + persists + preserves account_id", async () => {
    const store = memoryTokenStore();
    await store.save({ provider: "openai", tokens: { accessToken: "OLD", refreshToken: "RTold", accountId: "acct-1" }, lastRefresh: "t0" });
    const d = deps({ store });
    expect((await freshAccessToken(fakeProvider(0), d)).ok).toBe(true);
    const r = await freshAccessToken(fakeProvider(0), d, true); // force refresh
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tokens.accessToken).toBe("AT2"); // rotated
      expect(r.tokens.accountId).toBe("acct-1"); // preserved across refresh
    }
    expect((await store.load("openai"))?.tokens.accessToken).toBe("AT2"); // persisted
  });

  test("not logged in → clean error; dead-session refresh → re-login error", async () => {
    expect(await freshAccessToken(fakeProvider(0), deps({}))).toEqual({ ok: false, error: "not logged in (no stored tokens — run deviceLogin)" });
    const store = memoryTokenStore();
    await store.save({ provider: "openai", tokens: { accessToken: "x", refreshToken: "dead" }, lastRefresh: "t0" });
    const deadProvider: AuthProvider = { ...fakeProvider(0), refresh: () => Promise.resolve({ ok: false, error: "refresh_token_invalidated" }) };
    const r = await freshAccessToken(deadProvider, deps({ store }), true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("re-login");
  });
});

describe("fileTokenStore + defaultStoreDir", () => {
  test("save then load round-trips over an injected fs; missing file → null", async () => {
    const files = new Map<string, string>();
    const fs: StoreFs = {
      readFile: (p) => {
        const v = files.get(p);
        return v === undefined ? Promise.reject(new Error("ENOENT")) : Promise.resolve(v);
      },
      writeFile: (p, c) => {
        files.set(p, c);
        return Promise.resolve();
      },
      nowIso: () => "t",
    };
    const store = fileTokenStore("/home/me/.config/zeta/auth", fs);
    expect(await store.load("openai")).toBeNull(); // no file yet
    await store.save({ provider: "openai", tokens: { accessToken: "A", refreshToken: "R", accountId: "acct" }, lastRefresh: "t1" });
    const loaded = await store.load("openai");
    expect(loaded?.tokens).toEqual({ accessToken: "A", refreshToken: "R", accountId: "acct" });
    expect([...files.keys()][0]).toBe("/home/me/.config/zeta/auth/openai.json");
  });

  test("defaultStoreDir is under ~/.config/zeta/auth (ours, not ~/.codex)", () => {
    expect(defaultStoreDir("/Users/acehack")).toBe("/Users/acehack/.config/zeta/auth");
  });
});
