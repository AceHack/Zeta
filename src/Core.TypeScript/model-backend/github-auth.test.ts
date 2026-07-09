import { describe, expect, test } from "bun:test";
import type { HttpTransport } from "./backend.ts";
import { generatePkce, createState, type DeviceFlowStart } from "./auth-provider.ts";
import { githubDeviceProvider as P, makeGithubProvider, GH_CLI_CLIENT_ID } from "./github-auth.ts";

// GitHub provider of the hexagonal AuthProvider port (shadow*, Aaron 2026-07-08: "wire in github
// credentials too"). All tests use a FAKE transport — no network, no secret. The response shapes
// were confirmed live 2026-07-08 (the device flow that pushed PRs #9549–#9551).
// Proofs:
//   1. DEVICE START: form POST /login/device/code (client_id + scope) → parses device_code/user_code/interval.
//   2. DEVICE POLL: 200 {error:authorization_pending|slow_down} = pending; 200 {access_token} = tokens;
//      200 {error:expired_token} = hard error (GitHub's 200-for-everything discriminator).
//   3. NO-ROTATE tokens: classic OAuth-app responses (no refresh_token) store refreshToken:"" and
//      refresh("") reports re-login instead of hitting the network.
//   4. GitHub-App shape: refresh_token round-trips through poll and refresh.
//   5. AUTHORIZE URL: correct params; exchangeCode degrades cleanly (no secretless PKCE on GitHub).

function fakeTransport(response: { status: number; body: string }) {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  const transport: HttpTransport = {
    post(url, headers, body) {
      calls.push({ url, headers: { ...headers }, body });
      return Promise.resolve(response);
    },
    get(url, headers) {
      calls.push({ url, headers: { ...headers }, body: "" });
      return Promise.resolve(response);
    },
  };
  return { transport, calls };
}

const start: DeviceFlowStart = { deviceAuthId: "dev-1", userCode: "3FD3-FA94", verificationUri: "https://github.com/login/device", intervalSec: 5 };

describe("GitHub provider — device-code flow", () => {
  test("startDeviceFlow: form POST /login/device/code with client_id + scope; parses the start", async () => {
    const { transport, calls } = fakeTransport({
      status: 200,
      body: JSON.stringify({ device_code: "dev-1", user_code: "3FD3-FA94", verification_uri: "https://github.com/login/device", expires_in: 899, interval: 5 }),
    });
    const r = await P.startDeviceFlow(transport);
    expect(calls[0]!.url).toBe("https://github.com/login/device/code");
    const params = new URLSearchParams(calls[0]!.body);
    expect(params.get("client_id")).toBe(GH_CLI_CLIENT_ID);
    expect(params.get("scope")).toBe("repo");
    expect(calls[0]!.headers["Accept"]).toBe("application/json"); // without it GitHub answers urlencoded
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.deviceAuthId).toBe("dev-1");
      expect(r.value.userCode).toBe("3FD3-FA94");
      expect(r.value.verificationUri).toBe("https://github.com/login/device");
      expect(r.value.intervalSec).toBe(5);
    }
  });

  test("pollDevice: 200 {error:authorization_pending} = pending, keep polling (confirmed live)", async () => {
    const { transport } = fakeTransport({ status: 200, body: JSON.stringify({ error: "authorization_pending", error_description: "…" }) });
    const r = await P.pollDevice(transport, start);
    expect(r).toEqual({ ok: true, pending: true });
  });

  test("pollDevice: 200 {error:slow_down} also = pending", async () => {
    const { transport } = fakeTransport({ status: 200, body: JSON.stringify({ error: "slow_down", interval: 10 }) });
    const r = await P.pollDevice(transport, start);
    expect(r).toEqual({ ok: true, pending: true });
  });

  test("pollDevice: 200 {access_token} (classic OAuth app — no refresh_token) → tokens with refreshToken:''", async () => {
    const { transport, calls } = fakeTransport({ status: 200, body: JSON.stringify({ access_token: "gho_AT", token_type: "bearer", scope: "repo" }) });
    const r = await P.pollDevice(transport, start);
    const params = new URLSearchParams(calls[0]!.body);
    expect(params.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:device_code");
    expect(params.get("device_code")).toBe("dev-1");
    expect(r.ok).toBe(true);
    if (r.ok && "tokens" in r) {
      expect(r.tokens.accessToken).toBe("gho_AT");
      expect(r.tokens.refreshToken).toBe("");
    }
  });

  test("pollDevice: 200 {access_token, refresh_token} (GitHub App with expiration) keeps the refresh token", async () => {
    const { transport } = fakeTransport({ status: 200, body: JSON.stringify({ access_token: "ghu_AT", refresh_token: "ghr_RT" }) });
    const r = await P.pollDevice(transport, start);
    expect(r.ok).toBe(true);
    if (r.ok && "tokens" in r) {
      expect(r.tokens.refreshToken).toBe("ghr_RT");
    }
  });

  test("pollDevice: 200 {error:expired_token} = hard error (re-start the flow)", async () => {
    const { transport } = fakeTransport({ status: 200, body: JSON.stringify({ error: "expired_token" }) });
    const r = await P.pollDevice(transport, start);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("expired_token");
  });
});

describe("GitHub provider — refresh", () => {
  test("refresh(''): classic no-rotate token → clean re-login error, network untouched", async () => {
    const { transport, calls } = fakeTransport({ status: 200, body: "{}" });
    const r = await P.refresh(transport, "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("re-run device login");
    expect(calls).toHaveLength(0);
  });

  test("refresh(ghr_…): GitHub-App grant → form POST grant_type=refresh_token → new tokens", async () => {
    const { transport, calls } = fakeTransport({ status: 200, body: JSON.stringify({ access_token: "ghu_AT2", refresh_token: "ghr_RT2" }) });
    const r = await P.refresh(transport, "ghr_RT");
    const params = new URLSearchParams(calls[0]!.body);
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("ghr_RT");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.accessToken).toBe("ghu_AT2");
      expect(r.value.refreshToken).toBe("ghr_RT2");
    }
  });
});

describe("GitHub provider — browser (PKCE) stance", () => {
  test("authorizeUrl carries client_id/scope/state/challenge params", () => {
    const pkce = generatePkce();
    const state = createState();
    const url = new URL(P.authorizeUrl(pkce, "http://127.0.0.1:7777/cb", state));
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe(GH_CLI_CLIENT_ID);
    expect(url.searchParams.get("scope")).toBe("repo");
    expect(url.searchParams.get("state")).toBe(state);
    expect(url.searchParams.get("code_challenge")).toBe(pkce.challenge);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  test("exchangeCode: honest degrade — GitHub has no secretless PKCE exchange; points at device flow", async () => {
    const { transport, calls } = fakeTransport({ status: 200, body: "{}" });
    const r = await P.exchangeCode(transport, "code", "verifier", "http://127.0.0.1:7777/cb");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("device flow");
    expect(calls).toHaveLength(0);
  });
});

describe("makeGithubProvider — least-privilege override", () => {
  test("custom client id + scope flow into start", async () => {
    const custom = makeGithubProvider("Iv1.customapp", "public_repo");
    const { transport, calls } = fakeTransport({ status: 200, body: JSON.stringify({ device_code: "d", user_code: "u" }) });
    await custom.startDeviceFlow(transport);
    const params = new URLSearchParams(calls[0]!.body);
    expect(params.get("client_id")).toBe("Iv1.customapp");
    expect(params.get("scope")).toBe("public_repo");
  });
});
