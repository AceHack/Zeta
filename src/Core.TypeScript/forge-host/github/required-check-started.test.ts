import { describe, expect, test } from "bun:test";
import {
  REQUIRED_GATE_NAME,
  heartbeatPrsMissingRequiredCheck,
  requiredCheckStarted,
} from "./required-check-started";

const T0 = Date.parse("2026-08-15T15:00:00.000Z");

describe("requiredCheckStarted (081M010H4KE)", () => {
  test("green present checks are not enough if gate never started", () => {
    expect(
      requiredCheckStarted([
        { name: "agencysignature (PR body)" },
        { name: "lint (TS)" },
      ]),
    ).toBe(false);
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
