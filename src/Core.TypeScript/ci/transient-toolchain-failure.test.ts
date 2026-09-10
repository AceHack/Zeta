import { describe, expect, test } from "bun:test";
import { backoffMs, classifyToolFailure, TRANSIENT_PATTERNS } from "./transient-toolchain-failure.ts";

// The exact line from build-and-test (windows-11-arm) on main, 2026-09-10.
const REAL_503 =
  'mise ERROR Failed to install github:yannh/kubeconform@0.7.0: GitHub artifact attestations verification error for github:yannh/kubeconform@0.7.0: API error: GitHub API returned 503 Service Unavailable: {"message":"trust-metadata-api service unavailable","documentation_url":"https://docs.github.com/rest/repos/attestations#list-attestations","status":"503"}';

describe("the measured failure is recognised", () => {
  test("the real windows-11-arm 503 retries", () => {
    const v = classifyToolFailure({ exitCode: 1, output: REAL_503, attempt: 1, maxAttempts: 3 });
    expect(v.kind).toBe("retry");
    if (v.kind === "retry") expect(v.why).toContain("attestation");
  });
});

describe("the default is FAIL-NOW — a broad predicate would turn red into slow-green", () => {
  test("an ordinary compile error does not retry", () => {
    const v = classifyToolFailure({ exitCode: 1, output: "error CS0103: The name 'x' does not exist", attempt: 1, maxAttempts: 3 });
    expect(v.kind).toBe("fail-now");
  });
  test("a 404 does not retry — the server answered, and the answer was no", () => {
    const v = classifyToolFailure({ exitCode: 1, output: "HTTP 404 Not Found", attempt: 1, maxAttempts: 3 });
    expect(v.kind).toBe("fail-now");
  });
  test("a checksum mismatch does not retry — that is the security check working", () => {
    const v = classifyToolFailure({ exitCode: 1, output: "sha256 mismatch: expected abc got def", attempt: 1, maxAttempts: 3 });
    expect(v.kind).toBe("fail-now");
  });
  test("a FAILED attestation (not an unavailable service) does not retry", () => {
    // The distinction the whole module rests on: verification that RAN and said no must
    // never be retried away. Only verification that could not run is re-attemptable.
    const v = classifyToolFailure({
      exitCode: 1,
      output: "artifact attestation verification failed: no matching attestation found",
      attempt: 1,
      maxAttempts: 3,
    });
    expect(v.kind).toBe("fail-now");
  });
  test("empty output does not retry", () => {
    expect(classifyToolFailure({ exitCode: 1, output: "", attempt: 1, maxAttempts: 3 }).kind).toBe("fail-now");
  });
});

describe("bounds", () => {
  test("exit 0 is never retried even with a transient-looking log", () => {
    const v = classifyToolFailure({ exitCode: 0, output: REAL_503, attempt: 1, maxAttempts: 3 });
    expect(v.kind).toBe("fail-now");
    if (v.kind === "fail-now") expect(v.reason).toContain("succeeded");
  });
  test("the budget is finite — the last attempt fails even when transient", () => {
    const v = classifyToolFailure({ exitCode: 1, output: REAL_503, attempt: 3, maxAttempts: 3 });
    expect(v.kind).toBe("fail-now");
    if (v.kind === "fail-now") expect(v.reason).toContain("budget is spent");
  });
  test("backoff grows and then caps, with no jitter so a replay is deterministic", () => {
    expect(backoffMs(1)).toBe(2_000);
    expect(backoffMs(2)).toBe(4_000);
    expect(backoffMs(9)).toBe(backoffMs(4));
  });
});

describe("the roster stays small and every entry justifies itself", () => {
  test("each pattern carries a why that is an observation, not a category", () => {
    for (const p of TRANSIENT_PATTERNS) {
      expect(p.why.length).toBeGreaterThan(30);
      expect(p.needle.length).toBeGreaterThan(0);
    }
  });
  test("no pattern is so short it would match ordinary output", () => {
    for (const p of TRANSIENT_PATTERNS) expect(p.needle.length).toBeGreaterThan(8);
  });
});
