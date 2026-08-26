import { describe, expect, test } from "bun:test";
import { classifyGhError } from "./classify-error";

describe("classifyGhError", () => {
  test("HTTP status 401 with a body that does not say 401 is still auth-failure", () => {
    const classified = classifyGhError(401, "Bad credentials");
    expect(classified.kind).toBe("auth-failure");
    expect(classified.retryable).toBe(false);
  });

  test("401 → auth-failure (not retryable)", () => {
    const err = classifyGhError(2, "HTTP 401: Bad credentials");
    expect(err.kind).toBe("auth-failure");
    expect(err.retryable).toBe(false);
  });

  test("not logged in → auth-failure", () => {
    const err = classifyGhError(1, "You are not logged in to any GitHub hosts");
    expect(err.kind).toBe("auth-failure");
    expect(err.retryable).toBe(false);
  });

  test("403 forbidden → permission-denied (not retryable)", () => {
    const err = classifyGhError(2, "HTTP 403: Resource not accessible by integration");
    expect(err.kind).toBe("permission-denied");
    expect(err.retryable).toBe(false);
  });

  test("404 → not-found (not retryable)", () => {
    const err = classifyGhError(2, "HTTP 404: Not Found");
    expect(err.kind).toBe("not-found");
    expect(err.retryable).toBe(false);
  });

  test("could not resolve → not-found", () => {
    const err = classifyGhError(2, "Could not resolve to a Repository with the name 'org/nonexistent'");
    expect(err.kind).toBe("not-found");
    expect(err.retryable).toBe(false);
  });

  test("rate limit → rate-limited (retryable)", () => {
    const err = classifyGhError(2, "API rate limit exceeded for user");
    expect(err.kind).toBe("rate-limited");
    expect(err.retryable).toBe(true);
  });

  test("secondary rate limit → rate-limited (retryable)", () => {
    const err = classifyGhError(2, "You have exceeded a secondary rate limit");
    expect(err.kind).toBe("rate-limited");
    expect(err.retryable).toBe(true);
  });

  test("connection timeout → network (retryable)", () => {
    const err = classifyGhError(2, "connection timeout after 30s");
    expect(err.kind).toBe("network");
    expect(err.retryable).toBe(true);
  });

  test("502 bad gateway → network (retryable)", () => {
    const err = classifyGhError(2, "HTTP 502: Bad Gateway");
    expect(err.kind).toBe("network");
    expect(err.retryable).toBe(true);
  });

  test("503 service unavailable → network (retryable)", () => {
    const err = classifyGhError(2, "HTTP 503: Service Unavailable");
    expect(err.kind).toBe("network");
    expect(err.retryable).toBe(true);
  });

  test("unknown error → internal (not retryable)", () => {
    const err = classifyGhError(1, "something unexpected happened");
    expect(err.kind).toBe("internal");
    expect(err.retryable).toBe(false);
  });

  test("null status → internal", () => {
    const err = classifyGhError(null, "process killed");
    expect(err.kind).toBe("internal");
    expect(err.retryable).toBe(false);
    expect(err.message).toContain("null");
  });
});
