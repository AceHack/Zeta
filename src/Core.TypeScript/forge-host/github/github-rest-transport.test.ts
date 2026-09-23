// github-rest-transport.test.ts — the shared transport's pure halves: argv translation for the
// `gh api` fallback, rate-limit recognition (including the 403 secondary limit), and bounded
// back-off. No process is spawned and no socket opened.

import { describe, expect, test } from "bun:test";
import type { ForgeError, Result } from "../types";
import { err, forgeError, ok } from "../result";
import {
  classifyProbeError,
  ghApiArgv,
  isRateLimited,
  parseNwo,
  requestWithBackoff,
} from "./github-rest-transport.ts";

describe("ghApiArgv", () => {
  test("a GET is `api <path>` with no method flag", () => {
    expect(ghApiArgv("GET", "repos/o/r/actions/runs/1")).toEqual({ ok: true, value: ["api", "repos/o/r/actions/runs/1"] });
  });

  test("a PUT carries -X and string fields as RAW -f (no @file magic)", () => {
    const a = ghApiArgv("PUT", "repos/o/r/pulls/5/update-branch", { expected_head_sha: "@/etc/passwd" });
    expect(a.ok && a.value).toEqual(["api", "-X", "PUT", "repos/o/r/pulls/5/update-branch", "-f", "expected_head_sha=@/etc/passwd"]);
  });

  test("graphql: query and variables become fields; numbers/booleans are typed -F", () => {
    const a = ghApiArgv("POST", "graphql", { query: "mutation{x}", variables: { id: "PR_1", n: 3, b: true } });
    expect(a.ok && a.value).toEqual(["api", "graphql", "-f", "query=mutation{x}", "-f", "id=PR_1", "-F", "n=3", "-F", "b=true"]);
  });

  test("a nested body is refused rather than approximated", () => {
    expect(ghApiArgv("POST", "repos/o/r/issues", { labels: ["a"] }).ok).toBe(false);
    expect(ghApiArgv("POST", "graphql", { query: "q", variables: { input: { a: 1 } } }).ok).toBe(false);
    expect(ghApiArgv("POST", "graphql", { variables: {} }).ok).toBe(false);
  });

  test("a path that looks like a flag or a URL is refused", () => {
    expect(ghApiArgv("GET", "--hostname").ok).toBe(false);
    expect(ghApiArgv("GET", "https://evil.example/x").ok).toBe(false);
  });

  test("job logs ask gh to pass terminal escapes through (they go into JSON, not a tty)", () => {
    const a = ghApiArgv("GET", "repos/o/r/actions/jobs/9/logs");
    expect(a.ok && a.value).toContain("--allow-escape-sequences");
    const b = ghApiArgv("GET", "repos/o/r/actions/jobs/9");
    expect(b.ok && b.value).not.toContain("--allow-escape-sequences");
  });
});

describe("rate-limit recognition", () => {
  test("a 403 whose text names a secondary rate limit is a rate limit, not a permission refusal", () => {
    expect(isRateLimited(forgeError("permission-denied", "You have exceeded a secondary rate limit"))).toBe(true);
    expect(classifyProbeError(forgeError("permission-denied", "API rate limit exceeded for user"))).toBe("rate-limited");
  });
  test("a real permission refusal is fatal", () => {
    expect(classifyProbeError(forgeError("permission-denied", "Resource not accessible by integration"))).toBe("fatal");
  });
  test("network is transient; not-found and auth are fatal", () => {
    expect(classifyProbeError(forgeError("network", "reset"))).toBe("transient");
    expect(classifyProbeError(forgeError("not-found", "Not Found"))).toBe("fatal");
    expect(classifyProbeError(forgeError("auth-failure", "Bad credentials"))).toBe("fatal");
    expect(classifyProbeError(forgeError("rate-limited", "429"))).toBe("rate-limited");
  });
});

describe("requestWithBackoff", () => {
  const scripted = (answers: Result<string, ForgeError>[]) => {
    let i = 0;
    const calls: string[] = [];
    return {
      calls,
      rest: {
        request: (m: string, p: string) => {
          calls.push(`${m} ${p}`);
          return Promise.resolve(answers[Math.min(i++, answers.length - 1)] as Result<string, ForgeError>);
        },
      },
    };
  };

  test("retries a rate limit with doubling waits, then succeeds", async () => {
    const s = scripted([err(forgeError("rate-limited", "429")), err(forgeError("rate-limited", "429")), ok("yes")]);
    const slept: number[] = [];
    const r = await requestWithBackoff(s.rest, "GET", "x", {
      intervalMs: 1000,
      attempts: 3,
      sleep: (ms) => {
        slept.push(ms);
        return Promise.resolve();
      },
    });
    expect(r).toEqual({ ok: true, value: "yes" });
    expect(slept).toEqual([2000, 4000]);
  });

  test("a fatal error returns at once, no sleep, one call", async () => {
    const s = scripted([err(forgeError("not-found", "nope")), ok("never")]);
    const slept: number[] = [];
    const r = await requestWithBackoff(s.rest, "GET", "x", {
      intervalMs: 1000,
      attempts: 3,
      sleep: (ms) => {
        slept.push(ms);
        return Promise.resolve();
      },
    });
    expect(r.ok).toBe(false);
    expect(s.calls.length).toBe(1);
    expect(slept).toEqual([]);
  });

  test("gives up after `attempts` calls and returns the last error", async () => {
    const s = scripted([err(forgeError("network", "reset"))]);
    const r = await requestWithBackoff(s.rest, "GET", "x", { intervalMs: 1, attempts: 3, sleep: () => Promise.resolve() });
    expect(r.ok).toBe(false);
    expect(s.calls.length).toBe(3);
  });
});

describe("parseNwo", () => {
  test("owner/name only", () => {
    expect(parseNwo("Lucent-Financial-Group/Zeta")).toBe("Lucent-Financial-Group/Zeta");
    expect(parseNwo("a/b/c")).toBeNull();
    expect(parseNwo("a/..")).toBeNull();
    expect(parseNwo("a")).toBeNull();
  });
});
