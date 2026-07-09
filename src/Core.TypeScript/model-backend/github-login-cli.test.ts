import { describe, expect, test } from "bun:test";
import type { HttpTransport } from "./backend.ts";
import { memoryTokenStore } from "./token-store.ts";
import { askpassAnswer, looksLikeAskpassExec, main, runLogin, type CliIo } from "./github-login-cli.ts";

// The first consumer of the GitHub AuthProvider — fake transport + memory
// store, no network, no fs, no git. Proofs:
//   1. login: device flow runs to completion, token persisted, code surfaced.
//   2. token/askpass: read the store; askpass answers git's two prompts.
//   3. not-logged-in and usage errors exit non-zero without touching network.

function collectIo() {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = { out: (l) => out.push(l), err: (l) => err.push(l) };
  return { io, out, err };
}

/// Transport that answers the device-start once, then pending once, then tokens.
function sequencedTransport(): HttpTransport {
  let polls = 0;
  return {
    post(url) {
      if (url.endsWith("/login/device/code")) {
        return Promise.resolve({
          status: 200,
          body: JSON.stringify({ device_code: "d1", user_code: "AAAA-1111", verification_uri: "https://github.com/login/device", interval: 1 }),
        });
      }
      polls += 1;
      return Promise.resolve({
        status: 200,
        body: polls === 1 ? JSON.stringify({ error: "authorization_pending" }) : JSON.stringify({ access_token: "gho_T", token_type: "bearer" }),
      });
    },
    get() {
      return Promise.resolve({ status: 500, body: "unused" });
    },
  };
}

describe("askpassAnswer", () => {
  test("answers git's Username prompt with x-access-token, Password with the token", () => {
    expect(askpassAnswer("Username for 'https://github.com': ", "gho_T")).toBe("x-access-token");
    expect(askpassAnswer("Password for 'https://x-access-token@github.com': ", "gho_T")).toBe("gho_T");
  });
});

describe("login", () => {
  test("runs the device flow, surfaces the code, persists tokens", async () => {
    const store = memoryTokenStore();
    const { io, out } = collectIo();
    const code = await runLogin(store, io, {
      transport: sequencedTransport(),
      sleep: () => Promise.resolve(),
      now: () => "2026-07-09T00:00:00Z",
      maxPolls: 5,
    });
    expect(code).toBe(0);
    expect(out.some((l) => l.includes("AAAA-1111"))).toBe(true);
    const stored = await store.load("github");
    expect(stored?.tokens.accessToken).toBe("gho_T");
  });
});

describe("GIT_ASKPASS direct exec (git passes only the prompt)", () => {
  test("bare credential-prompt argv routes to askpass; subcommands do not", () => {
    expect(looksLikeAskpassExec(["Username for 'https://github.com': "])).toBe(true);
    expect(looksLikeAskpassExec(["Password for 'https://x-access-token@github.com': "])).toBe(true);
    expect(looksLikeAskpassExec(["login"])).toBe(false);
    expect(looksLikeAskpassExec([])).toBe(false);
  });

  test("main answers a bare Username prompt without a subcommand", async () => {
    const store = memoryTokenStore();
    await store.save({ provider: "github", tokens: { accessToken: "gho_T", refreshToken: "" }, lastRefresh: "t" });
    const { io, out } = collectIo();
    expect(await main(["Username for 'https://github.com': "], store, io)).toBe(0);
    expect(out).toEqual(["x-access-token"]);
  });
});

describe("storage failure becomes a clean verdict (no unhandled rejection)", () => {
  test("store.save rejection -> exit 1 with the failure message", async () => {
    const failingStore = {
      load: () => Promise.resolve(null),
      save: () => Promise.reject(new Error("EROFS: read-only file system")),
    };
    const { io, err } = collectIo();
    const code = await runLogin(failingStore, io, {
      transport: sequencedTransport(),
      sleep: () => Promise.resolve(),
      now: () => "t",
      maxPolls: 5,
    });
    expect(code).toBe(1);
    expect(err[0]).toContain("EROFS");
  });
});

describe("token / askpass from store", () => {
  test("token prints the stored access token", async () => {
    const store = memoryTokenStore();
    await store.save({ provider: "github", tokens: { accessToken: "gho_T", refreshToken: "" }, lastRefresh: "t" });
    const { io, out } = collectIo();
    expect(await main(["token"], store, io)).toBe(0);
    expect(out).toEqual(["gho_T"]);
  });

  test("askpass routes the prompt through askpassAnswer", async () => {
    const store = memoryTokenStore();
    await store.save({ provider: "github", tokens: { accessToken: "gho_T", refreshToken: "" }, lastRefresh: "t" });
    const { io, out } = collectIo();
    expect(await main(["askpass", "Username for 'https://github.com':"], store, io)).toBe(0);
    expect(out).toEqual(["x-access-token"]);
  });

  test("not logged in -> exit 1 with a pointer at login", async () => {
    const { io, err } = collectIo();
    expect(await main(["token"], memoryTokenStore(), io)).toBe(1);
    expect(err[0]).toContain("run the `login` subcommand");
  });

  test("unknown subcommand -> usage, exit 2", async () => {
    const { io, err } = collectIo();
    expect(await main(["frobnicate"], memoryTokenStore(), io)).toBe(2);
    expect(err[0]).toContain("usage:");
  });
});
