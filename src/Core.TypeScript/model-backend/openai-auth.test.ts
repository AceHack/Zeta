import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import type { HttpTransport } from "./backend.ts";
import { generatePkce, createState, type DeviceFlowStart } from "./auth-provider.ts";
import { openAiCodexProvider as P } from "./openai-auth.ts";

// OUR OWN AUTH — the hexagonal AuthProvider port + the OpenAI provider (shadow*, Aaron 2026-07-03:
// "build our own device-login flow AND the same-machine browser flow — own the interface, many
// providers"). Independent of Codex's session. All tests use a FAKE transport — no network, no secret.
// Proofs:
//   1. PKCE: generatePkce yields a valid verifier + its S256 challenge (challenge == base64url(sha256(verifier))).
//   2. DEVICE START: POST deviceauth/usercode { client_id } → parses device_auth_id/user_code/interval.
//   3. DEVICE POLL: 403/404 = pending (keep polling); a token body → tokens.
//   4. AUTHORIZE URL (PKCE browser): correct params (response_type, client_id, challenge, S256, state).
//   5. EXCHANGE + REFRESH: form-encoded POST /oauth/token → tokens; clean errors.

function fakeTransport(response: { status: number; body: string } | (() => Promise<never>)) {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  const respond = () => (typeof response === "function" ? response() : Promise.resolve(response));
  const transport: HttpTransport = {
    post(url, headers, body) {
      calls.push({ url, headers: { ...headers }, body });
      return respond();
    },
    get(url, headers) {
      calls.push({ url, headers: { ...headers }, body: "" });
      return respond();
    },
  };
  return { transport, calls };
}

const tokenBody = JSON.stringify({ access_token: "AT", refresh_token: "RT", account_id: "acct-1" });

describe("PKCE", () => {
  test("generatePkce → verifier + valid S256 challenge", () => {
    const p = generatePkce();
    expect(p.method).toBe("S256");
    expect(p.verifier.length).toBeGreaterThanOrEqual(43);
    const expected = createHash("sha256").update(p.verifier).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    expect(p.challenge).toBe(expected);
    expect(p.verifier).not.toMatch(/[+/=]/); // base64url, no + / =
  });
});

describe("OpenAI provider — device-code flow", () => {
  test("startDeviceFlow: POST /api/accounts/deviceauth/usercode {client_id}; parses the start", async () => {
    const { transport, calls } = fakeTransport({ status: 200, body: JSON.stringify({ device_auth_id: "dev-1", user_code: "WXYZ-1234", interval: 5, verification_uri: "https://auth.openai.com/codex/device" }) });
    const r = await P.startDeviceFlow(transport);
    expect(calls[0]!.url).toBe("https://auth.openai.com/api/accounts/deviceauth/usercode"); // under /api/accounts (confirmed live)
    expect(JSON.parse(calls[0]!.body)).toEqual({ client_id: "app_EMoamEEZ73f0CkXaXp7hrann" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.deviceAuthId).toBe("dev-1");
      expect(r.value.userCode).toBe("WXYZ-1234");
      expect(r.value.intervalSec).toBe(5);
    }
  });

  // CONFIRMED LIVE: pollDevice on 200 gets { status, authorization_code, code_verifier } and EXCHANGES it
  // for tokens (a second POST /oauth/token). A sequenced fake returns the device-success then the tokens.
  test("pollDevice: 403 → pending; a success → exchanges the code for tokens", async () => {
    const start: DeviceFlowStart = { deviceAuthId: "d", userCode: "u", verificationUri: "v", intervalSec: 5 };
    const { transport: t403 } = fakeTransport({ status: 403, body: "" });
    expect(await P.pollDevice(t403, start)).toEqual({ ok: true, pending: true });

    const deviceSuccess = JSON.stringify({ status: "success", authorization_code: "AUTHCODE", code_verifier: "VERIFIER" });
    const responses = [{ status: 200, body: deviceSuccess }, { status: 200, body: tokenBody }];
    let i = 0;
    const calls: { url: string; body: string }[] = [];
    const seq: HttpTransport = {
      post: (url, _h, body) => {
        calls.push({ url, body });
        return Promise.resolve(responses[i++]!);
      },
      get: () => Promise.resolve({ status: 404, body: "" }),
    };
    const done = await P.pollDevice(seq, start);
    expect(calls[0]!.url).toBe("https://auth.openai.com/api/accounts/deviceauth/token"); // 1) poll
    expect(JSON.parse(calls[0]!.body)).toEqual({ device_auth_id: "d", user_code: "u" });
    expect(calls[1]!.url).toBe("https://auth.openai.com/oauth/token"); // 2) exchange the auth code
    const form = new URLSearchParams(calls[1]!.body);
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("code")).toBe("AUTHCODE");
    expect(form.get("code_verifier")).toBe("VERIFIER");
    expect(done).toEqual({ ok: true, tokens: { accessToken: "AT", refreshToken: "RT", accountId: "acct-1" } });
  });
});

describe("OpenAI provider — PKCE browser flow", () => {
  test("authorizeUrl carries the right params", () => {
    const pkce = generatePkce();
    const url = new URL(P.authorizeUrl(pkce, "http://127.0.0.1:1455/callback", "state-abc"));
    expect(url.origin + url.pathname).toBe("https://auth.openai.com/oauth/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("app_EMoamEEZ73f0CkXaXp7hrann");
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:1455/callback");
    expect(url.searchParams.get("code_challenge")).toBe(pkce.challenge);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("state-abc");
  });

  test("exchangeCode: form-encoded POST /oauth/token → tokens", async () => {
    const { transport, calls } = fakeTransport({ status: 200, body: tokenBody });
    const r = await P.exchangeCode(transport, "the-code", "the-verifier", "http://127.0.0.1:1455/callback");
    expect(calls[0]!.url).toBe("https://auth.openai.com/oauth/token");
    expect(calls[0]!.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const form = new URLSearchParams(calls[0]!.body);
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("code")).toBe("the-code");
    expect(form.get("code_verifier")).toBe("the-verifier");
    expect(r).toEqual({ ok: true, value: { accessToken: "AT", refreshToken: "RT", accountId: "acct-1" } });
  });
});

describe("OpenAI provider — refresh + errors", () => {
  test("refresh: form POST grant_type=refresh_token → tokens", async () => {
    const { transport, calls } = fakeTransport({ status: 200, body: tokenBody });
    const r = await P.refresh(transport, "my-refresh");
    const form = new URLSearchParams(calls[0]!.body);
    expect(form.get("grant_type")).toBe("refresh_token");
    expect(form.get("refresh_token")).toBe("my-refresh");
    expect(r.ok).toBe(true);
  });

  test("clean errors: non-2xx and transport throw never throw upward", async () => {
    const { transport: t1 } = fakeTransport({ status: 400, body: "invalid_grant" });
    expect(await P.refresh(t1, "x")).toEqual({ ok: false, error: "http 400: invalid_grant" });
    const { transport: t2 } = fakeTransport(() => Promise.reject(new Error("offline")));
    const r = await P.startDeviceFlow(t2);
    expect(r).toEqual({ ok: false, error: "transport error: offline" });
  });

  test("createState is random hex", () => {
    expect(createState()).toMatch(/^[0-9a-f]{32}$/);
    expect(createState()).not.toBe(createState());
  });
});
