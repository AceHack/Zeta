import { describe, expect, test } from "bun:test";
import { ok, err, forgeError } from "../result";
import { githubRestRequest, githubRestUrl } from "./gh-cli.ts";
import {
  restCreatePull,
  restGetPull,
  restListPulls,
  restPullToPr,
  type GithubRest,
  type RestPull,
} from "./github-pr-rest.ts";

function sample(over: Partial<RestPull> = {}): RestPull {
  return {
    number: 12,
    title: "name Harny",
    html_url: "https://github.com/o/r/pull/12",
    updated_at: "2026-08-26T00:00:00Z",
    draft: false,
    state: "open",
    merged_at: null,
    user: { login: "ace" },
    head: { ref: "feat/h" },
    base: { ref: "main" },
    ...over,
  };
}

function recordingRest(body: string, calls: { method: string; path: string; body: unknown }[]): GithubRest {
  return {
    request: (method, path, b) => {
      calls.push({ method, path, body: b });
      return Promise.resolve(ok(body));
    },
  };
}

describe("restPullToPr", () => {
  test("maps REST list shape; reviewDecision is honestly null", () => {
    const pr = restPullToPr(sample());
    expect(pr.number).toBe(12);
    expect(pr.headRef).toBe("feat/h");
    expect(pr.baseRef).toBe("main");
    expect(pr.state).toBe("open");
    expect(pr.author).toBe("ace");
    expect(pr.reviewDecision).toBeNull();
    expect(pr.mergeStateStatus).toBe("unknown");
  });

  test("closed + merged_at is merged; mergeable_state behind is dirty", () => {
    const pr = restPullToPr(sample({ state: "closed", merged_at: "2026-08-01T00:00:00Z", mergeable_state: "behind" }));
    expect(pr.state).toBe("merged");
    expect(pr.mergeStateStatus).toBe("dirty");
  });
});

describe("restListPulls / restCreatePull", () => {
  test("GET open pulls with cap 100", async () => {
    const calls: { method: string; path: string; body: unknown }[] = [];
    const result = await restListPulls(recordingRest(JSON.stringify([sample()]), calls), "o/r", {
      state: "open",
      limit: 500,
      sort: "updated",
    });
    expect(result.ok).toBe(true);
    expect(calls[0]).toEqual({
      method: "GET",
      path: "repos/o/r/pulls?state=open&per_page=100&sort=updated&direction=desc",
      body: undefined,
    });
  });

  test("POST create body is title/head/base/draft — never shells gh", async () => {
    const calls: { method: string; path: string; body: unknown }[] = [];
    const created = sample({ number: 99, html_url: "https://github.com/o/r/pull/99" });
    const result = await restCreatePull(recordingRest(JSON.stringify(created), calls), "o/r", {
      title: "t",
      body: "b",
      head: "feat",
      base: "main",
      draft: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.number).toBe(99);
    expect(calls[0]).toEqual({
      method: "POST",
      path: "repos/o/r/pulls",
      body: { title: "t", body: "b", head: "feat", base: "main", draft: true },
    });
  });

  test("transport failure is passed through, not turned into a spawn", async () => {
    const rest: GithubRest = {
      request: () => Promise.resolve(err(forgeError("auth-failure", "no token"))),
    };
    const result = await restGetPull(rest, "o/r", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("auth-failure");
  });

  test("githubRestRequest with a null token never fetches", async () => {
    let fetched = 0;
    const result = await githubRestRequest("GET", "repos/o/r", undefined, {
      token: null,
      signal: null,
      fetch: async () => {
        fetched += 1;
        return new Response("nope");
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("auth-failure");
    expect(fetched).toBe(0);
  });

  test("githubRestRequest sends Bearer and classifies HTTP 401", async () => {
    const result = await githubRestRequest("GET", "repos/o/r", undefined, {
      token: "gho_testtokenvalue12345678",
      signal: null,
      fetch: async (_url, init) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer gho_testtokenvalue12345678");
        expect(init?.signal).toBeUndefined();
        return new Response("Bad credentials", { status: 401 });
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("auth-failure");
  });

  test("githubRestUrl pins api.github.com and refuses absolute URLs", () => {
    expect(githubRestUrl("repos/o/r/pulls")).toBe("https://api.github.com/repos/o/r/pulls");
    expect(githubRestUrl("https://evil.example/steal")).toBeNull();
    expect(githubRestUrl("../etc/passwd")).toBeNull();
    expect(githubRestUrl("repos/o/r/pulls?state=open&per_page=10")).toBe("https://api.github.com/repos/o/r/pulls?state=open&per_page=10");
  });

  test("a JSON dump is not a token — no outbound request", async () => {
    let fetched = 0;
    const result = await githubRestRequest("GET", "repos/o/r", undefined, {
      token: "{\"tokens\":{\"accessToken\":\"gho_testtokenvalue12345678\"}}",
      signal: null,
      fetch: async () => {
        fetched += 1;
        return new Response("nope");
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("auth-failure");
    expect(fetched).toBe(0);
  });

  test("garbage JSON is parse-failure", async () => {
    const rest: GithubRest = { request: () => Promise.resolve(ok("not-json")) };
    const result = await restListPulls(rest, "o/r", { state: "open", limit: 10, sort: "created" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("parse-failure");
  });
});
