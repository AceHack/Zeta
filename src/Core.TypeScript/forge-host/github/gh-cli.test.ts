/**
 * ABSENT ≠ REJECTED — the falsifiers for the credential answer.
 *
 * On 2026-08-27 the drift-dashboard lane reported "no GitHub token in
 * ~/.config/zeta/auth/github.json or GH_TOKEN/GITHUB_TOKEN" on a runner where
 * `GH_TOKEN` was set from `secrets.GITHUB_TOKEN`. The token had resolved; the charset
 * filter refused its shape; the two answers shared one message. The pass then made 78
 * enumeration calls that each failed in under a millisecond, observed nothing, and
 * rendered its own blindness as twelve RED "STALE" lanes — four of which were sampled
 * and had each run successfully within the hour.
 *
 * These tests pin the two properties that would have made that outage self-describing:
 * the two conditions produce DIFFERENT text, and neither text contains the credential.
 */

import { describe, expect, test } from "bun:test";
import { classifyTokenRejection, githubRestRequest, tokenRefusalMessage } from "./gh-cli.ts";

// A syntactically valid credential of an accepted shape. Synthetic — the same
// literal `resolve-stored-token.test.ts` already uses — never a real token, and no
// live secret is read anywhere in this file. (Written to a shape the pre-push
// secret floor tolerates: a fixture that trips a secret scanner is a fixture that
// trains people to silence secret scanners.)
const ACCEPTED = "gho_testtokenvalue12345678";
// A resolved-but-refused shape. `-` is outside the filter's `[A-Za-z0-9_]` class, so
// this stands in for "whatever this host issues that the filter does not admit"
// without anyone having to know what that is.
const REFUSED = "gho_test-token-value-12345678";

describe("classifyTokenRejection — the two credential answers are distinguishable", () => {
  test("null and whitespace are ABSENT", () => {
    expect(classifyTokenRejection(null)).toBe("absent");
    expect(classifyTokenRejection("")).toBe("absent");
    expect(classifyTokenRejection("   ")).toBe("absent");
  });

  test("a present token of an unaccepted shape is REJECTED, not absent", () => {
    expect(classifyTokenRejection(REFUSED)).toBe("rejected-by-charset-filter");
    // The bug in one line: this used to be indistinguishable from the case above.
    expect(classifyTokenRejection(REFUSED)).not.toBe(classifyTokenRejection(null));
  });

  test("a usable token is neither", () => {
    expect(classifyTokenRejection(ACCEPTED)).toBeNull();
  });
});

describe("tokenRefusalMessage — says which, and never says the secret", () => {
  test("the absent message claims absence; the rejected message explicitly denies it", () => {
    expect(tokenRefusalMessage("absent")).toContain("no GitHub token");
    expect(tokenRefusalMessage("rejected-by-charset-filter")).toContain("WAS resolved");
    expect(tokenRefusalMessage("rejected-by-charset-filter")).toContain("NOT a missing credential");
    expect(tokenRefusalMessage("rejected-by-charset-filter")).not.toContain("no GitHub token");
  });

  test("neither message can carry a credential — they take no argument that could hold one", () => {
    for (const m of [tokenRefusalMessage("absent"), tokenRefusalMessage("rejected-by-charset-filter")]) {
      expect(m).not.toContain(REFUSED);
      expect(m).not.toContain(ACCEPTED);
    }
  });
});

describe("githubRestRequest reports the true condition", () => {
  const noFetch = (): never => {
    throw new Error("the request must not be attempted when the credential is refused");
  };

  test("a refused-shape token does not report itself as a missing token", async () => {
    const res = await githubRestRequest("GET", "repos/o/r", undefined, {
      token: REFUSED,
      fetch: noFetch,
      signal: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe("auth-failure");
    expect(res.error.message).toContain("WAS resolved");
    expect(res.error.message).not.toContain(REFUSED);
  });

  test("a genuinely absent token still reports absence", async () => {
    const res = await githubRestRequest("GET", "repos/o/r", undefined, {
      token: null,
      fetch: noFetch,
      signal: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.message).toContain("no GitHub token");
  });

  test("an accepted token is sent, and the taint barrier still rebuilds it", async () => {
    const seen: (string | null)[] = [];
    const res = await githubRestRequest("GET", "repos/o/r", undefined, {
      token: ACCEPTED,
      signal: null,
      fetch: (_url, init) => {
        seen.push(new Headers(init?.headers).get("authorization"));
        return Promise.resolve(new Response("{}", { status: 200 }));
      },
    });
    expect(res.ok).toBe(true);
    expect(seen).toEqual([`Bearer ${ACCEPTED}`]);
  });
});
