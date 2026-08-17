import { describe, expect, test } from "bun:test";
import {
  REQUIRED_GATE_NAME,
  classifyMissingRequiredCheck,
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
          headSha: "a".repeat(40),
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
          headSha: "b".repeat(40),
          rollup: [{ name: "lint (TS)" }],
        },
        {
          number: 2,
          createdAt: "2026-08-15T12:00:00.000Z",
          headRef: "heartbeat/otto",
          headSha: "c".repeat(40),
          rollup: [{ name: REQUIRED_GATE_NAME }],
        },
        {
          number: 3,
          createdAt: "2026-08-15T12:00:00.000Z",
          headRef: "fix/something",
          headSha: "d".repeat(40),
          rollup: [],
        },
      ],
      T0,
      10 * 60_000,
    );
    expect(missing).toEqual([10490]);
  });
});

// The regression these tests exist for (2026-08-17): rollup-absence alone
// reported three healthy-but-queued PRs as "never started", because a gate run
// that has started does not publish `gate (required)` into the rollup for the
// first ~28 minutes. Existence of a run for the head SHA separates them; the
// numbers below are the real ones measured that morning.
describe("classifyMissingRequiredCheck — absent-from-rollup is not never-going-to-run", () => {
  test("a run that exists is queued, not stalled (#11387, #11401 shape)", () => {
    expect(classifyMissingRequiredCheck([{ number: 11387, runCount: 1 }])).toEqual({
      stalled: [],
      queued: [11387],
    });
  });

  test("zero runs is the genuine defect (#11369, #11426 shape)", () => {
    expect(classifyMissingRequiredCheck([{ number: 11369, runCount: 0 }])).toEqual({
      stalled: [11369],
      queued: [],
    });
  });

  test("a mixed batch reports each PR under the right verdict", () => {
    expect(
      classifyMissingRequiredCheck([
        { number: 11387, runCount: 1 },
        { number: 11426, runCount: 0 },
        { number: 11401, runCount: 2 },
      ]),
    ).toEqual({ stalled: [11426], queued: [11387, 11401] });
  });

  test("no candidates is not a verdict about anything", () => {
    expect(classifyMissingRequiredCheck([])).toEqual({ stalled: [], queued: [] });
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
