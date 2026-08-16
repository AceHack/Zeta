import { describe, expect, test } from "bun:test";
import {
  REQUIRED_GATE_NAME,
  heartbeatPrsMissingRequiredCheck,
  isTransientHostFailure,
  listWithTransientRetry,
  requiredCheckStarted,
} from "./required-check-started";

const T0 = Date.parse("2026-08-15T15:00:00.000Z");

describe("requiredCheckStarted (081M010H4KE)", () => {
  test("green present checks are not enough if gate never started", () => {
    expect(requiredCheckStarted([{ name: "agencysignature (PR body)" }, { name: "lint (TS)" }])).toBe(false);
  });

  test("gate present — even pending — counts as started", () => {
    expect(requiredCheckStarted([{ name: REQUIRED_GATE_NAME }])).toBe(true);
  });

  test("empty rollup is the filed defect", () => {
    expect(requiredCheckStarted([])).toBe(false);
  });
});

describe("heartbeatPrsMissingRequiredCheck", () => {
  test("ignores young PRs — gate may not have been scheduled yet", () => {
    const missing = heartbeatPrsMissingRequiredCheck(
      [
        {
          number: 1,
          createdAt: "2026-08-15T14:55:00.000Z",
          headRef: "heartbeat/otto",
          rollup: [],
        },
      ],
      T0,
      10 * 60_000,
    );
    expect(missing).toEqual([]);
  });

  test("names an old heartbeat PR whose gate never started", () => {
    const missing = heartbeatPrsMissingRequiredCheck(
      [
        {
          number: 10490,
          createdAt: "2026-08-15T12:00:00.000Z",
          headRef: "heartbeat/soraya",
          rollup: [{ name: "lint (TS)" }],
        },
        {
          number: 2,
          createdAt: "2026-08-15T12:00:00.000Z",
          headRef: "heartbeat/otto",
          rollup: [{ name: REQUIRED_GATE_NAME }],
        },
        {
          number: 3,
          createdAt: "2026-08-15T12:00:00.000Z",
          headRef: "fix/something",
          rollup: [],
        },
      ],
      T0,
      10 * 60_000,
    );
    expect(missing).toEqual([10490]);
  });
});

describe("listWithTransientRetry", () => {
  test("retries bounded transient host failures and returns the recovered read", async () => {
    const results = [
      { status: 1, stdout: "", stderr: "HTTP 504: request timed out" },
      { status: 1, stdout: "", stderr: "connection reset by peer" },
      { status: 0, stdout: "[]", stderr: "" },
    ];
    const delays: number[] = [];
    const result = await listWithTransientRetry(
      () => results.shift()!,
      (milliseconds) => {
        delays.push(milliseconds);
        return Promise.resolve();
      },
    );
    expect(result).toEqual({ status: 0, stdout: "[]", stderr: "" });
    expect(delays).toEqual([1_000, 2_000]);
  });

  test("does not retry an authorization failure", async () => {
    let calls = 0;
    const result = await listWithTransientRetry(
      () => {
        calls += 1;
        return { status: 1, stdout: "", stderr: "HTTP 403: Resource not accessible" };
      },
      () => Promise.resolve(),
    );
    expect(result.status).toBe(1);
    expect(calls).toBe(1);
  });

  test("recognizes only transport-class failures", () => {
    expect(isTransientHostFailure("HTTP 502: bad gateway")).toBe(true);
    expect(isTransientHostFailure("ECONNRESET")).toBe(true);
    expect(isTransientHostFailure("HTTP 401: bad credentials")).toBe(false);
  });
});
