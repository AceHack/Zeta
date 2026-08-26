import { describe, expect, test } from "bun:test";
import { GitHubAdapter } from "./github-adapter";
import { classifyGhError } from "./classify-error";
import { forgeError, ok } from "../result";
import type { GithubRest } from "./github-pr-rest.ts";

describe("GitHubAdapter", () => {
  test("forgeName is github", () => {
    const adapter = new GitHubAdapter("Lucent-Financial-Group", "Zeta");
    expect(adapter.forgeName).toBe("github");
  });

  test("not-supported methods return proper error", async () => {
    const adapter = new GitHubAdapter("org", "repo");

    // getBranchProtection is still not-supported
    const protection = await adapter.getBranchProtection("main");
    expect(protection.ok).toBe(false);
    if (!protection.ok) expect(protection.error.kind).toBe("not-supported");
  });

  // REPLACED 2026-08-20. The test that stood here called `adapter.createBlob("hello")`
  // against a nonexistent repo, which shells out to `gh api` -- a REAL NETWORK CALL inside
  // the tier whose job is literally named "TS hermetic". It cost the gate a flake
  // (timed out after 5000ms, against the adapter's own 30000ms spawn timeout, so any slow
  // network guarantees it), and it bought nothing: its only assertion was
  // `expect(blob.error.kind).not.toBe("not-supported")`, and EVERY error path in
  // createBlob returns either classifyGhError(...) or forgeError("parse-failure", ...) --
  // neither of which can produce "not-supported". The assertion was structurally
  // unfalsifiable. It passed on auth failure, DNS failure, rate limit, and on the network
  // being unplugged, so it could not distinguish "wired to gh" from "everything is broken".
  //
  // What it MEANT to pin is pinned below without a network call: the classifier that every
  // git-data method routes its failures through never yields "not-supported". That is
  // falsifiable -- reintroduce a not-supported stub in that path and it goes red.
  // HONEST LIMIT, so this replacement is not mistaken for equivalent coverage: the test
  // below pins the CLASSIFIER, not that `createBlob` routes through it. If someone reverted
  // createBlob to a `not-supported` stub, this file would stay green. Pinning that without a
  // network call needs a runner seam on GitHubAdapter (it calls spawnSync("gh", ...) directly,
  // with no injection point) -- a real change, deliberately not made here. What IS still
  // pinned hermetically is the other side of the pair: the test above asserts
  // getBranchProtection DOES return not-supported, and that one spawns nothing.
  test("classifyGhError never yields not-supported — git data methods are wired, not stubbed", () => {
    // Exhaustive over the classifier's branches, plus the fallback that a missing `gh`
    // binary produces (spawnSync sets status = null when the executable is absent).
    const cases: ReadonlyArray<readonly [number | null, string]> = [
      [null, ""], // gh absent: the hermetic case the deleted test reached over the network
      [1, "HTTP 401: Bad credentials"],
      [1, "HTTP 403: Resource not accessible"],
      [1, "HTTP 404: Not Found"],
      [1, "API rate limit exceeded"],
      [1, "dial tcp: i/o timeout"],
      [1, "HTTP 502: Bad Gateway"],
      [1, "something nobody has classified yet"],
    ];
    for (const [status, stderr] of cases) {
      expect(classifyGhError(status, stderr).kind).not.toBe("not-supported");
    }
    // The paired negative: the stub shape this is guarding against IS "not-supported",
    // so the assertion above discriminates rather than passing vacuously.
    expect(forgeError("not-supported", "createBlob: stub").kind).toBe("not-supported");
    // And the fallback is specifically what an absent `gh` yields.
    expect(classifyGhError(null, "").kind).toBe("internal");
  });

  test("listOpenPullRequests and createPullRequest use injected REST — no gh", async () => {
    const calls: { method: string; path: string; body: unknown }[] = [];
    const pull = {
      number: 7,
      title: "rest",
      html_url: "https://github.com/o/r/pull/7",
      updated_at: "2026-08-26T00:00:00Z",
      draft: false,
      state: "open",
      merged_at: null,
      user: { login: "ace" },
      head: { ref: "feat" },
      base: { ref: "main" },
    };
    const rest: GithubRest = {
      request: (method, path, body) => {
        calls.push({ method, path, body });
        if (method === "GET") return Promise.resolve(ok(JSON.stringify([pull])));
        return Promise.resolve(ok(JSON.stringify({ ...pull, number: 8, html_url: "https://github.com/o/r/pull/8" })));
      },
    };
    const adapter = new GitHubAdapter("o", "r", { rest });
    const listed = await adapter.listOpenPullRequests({ limit: 10 });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value).toHaveLength(1);
      expect(listed.value[0]?.number).toBe(7);
    }
    const created = await adapter.createPullRequest({ title: "t", body: "b", head: "feat", base: "main" });
    expect(created.ok).toBe(true);
    if (created.ok) expect(created.value.number).toBe(8);
    expect(calls.some((c) => c.method === "GET" && c.path.startsWith("repos/o/r/pulls"))).toBe(true);
    expect(calls.some((c) => c.method === "POST" && c.path === "repos/o/r/pulls")).toBe(true);
  });

  test("createPullRequest without a token is auth-failure, not a gh spawn", async () => {
    const adapter = new GitHubAdapter("o", "r", {
      rest: { request: () => Promise.resolve({ ok: false, error: forgeError("auth-failure", "no token") }) },
    });
    const result = await adapter.createPullRequest({ title: "t", body: "b", head: "h", base: "main" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("auth-failure");
  });

  test("resolveThreadsBatch maintains arithmetic invariant", async () => {
    const adapter = new GitHubAdapter("org", "repo", {
      porcelain: () => ({ ok: false, error: forgeError("internal", "injected miss") }),
    });
    const threads = [
      { threadId: "t1", body: "ack" },
      { threadId: "t2", body: "ack" },
    ];
    const result = await adapter.resolveThreadsBatch(threads);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.resolved).toBe(0);
      expect(result.value.failed.length).toBe(threads.length);
      expect(result.value.resolved + result.value.failed.length).toBe(threads.length);
    }
  });
});
