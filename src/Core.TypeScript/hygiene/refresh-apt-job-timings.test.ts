// Falsifiers for the placeholder refusal in `refresh-apt-job-timings.ts`.
//
// The generator can see THAT a job could not be measured; only a human can say WHY. Until
// 2026-08-22 the interim value — "WRITE THE REAL REASON HERE BY HAND" — was written into
// the committed artifact like any other reason. That is the vacuity class: a `reason`
// field that says nothing while looking filled in, and reads to every later reviewer as
// an investigated decision. These tests pin the refusal.

import { describe, expect, test } from "bun:test";

import { isPlaceholderReason, placeholderReason } from "./refresh-apt-job-timings.ts";

describe("placeholder reason", () => {
  test("the sentinel recognises itself — the refusal cannot drift from what is emitted", () => {
    // If the emitted text and the detector ever diverge, the tool goes back to shipping
    // a placeholder while believing it refuses to. This is the one assertion that ties
    // them together.
    expect(isPlaceholderReason(placeholderReason())).toBe(true);
  });

  test("a real, investigated reason is accepted", () => {
    expect(
      isPlaceholderReason(
        "MEASURED 2026-08-22: this workflow has run ZERO times (/actions/workflows/x.yml/runs -> total_count 0)",
      ),
    ).toBe(false);
  });

  test("decorating the placeholder is not investigating it", () => {
    // Substring and not equality, deliberately: prepending context while leaving the
    // shout intact supplies no reason, and an equality check would let it through.
    expect(isPlaceholderReason("TODO(2026-09): WRITE THE REAL REASON HERE BY HAND — probably flaky")).toBe(true);
  });

  test("an empty reason is not mistaken for the placeholder", () => {
    // It is a different defect with a different fix; conflating them would report the
    // wrong cause.
    expect(isPlaceholderReason("")).toBe(false);
  });
});
