// chsh-delay.proof — the S(delay) shape, PROVEN exhaustively (register B, same discipline as
// correlation.proof.test.ts: total functions on integer milli, swept over the whole meaningful
// domain — every claim proven for every input, deterministically, no randomness).

import { describe, it, expect } from "bun:test";
import { sOfArrival, sOfDelay, arrivalProbabilityMilli, fallbackMilli, P_ONE_MILLI, type Fallback } from "./chsh-delay";
import { classify, LOCAL_BOUND_MILLI, TSIRELSON_MILLI, PR_BOX_MILLI } from "./correlation";

const FALLBACKS: Fallback[] = ["independent", "shared"];
const TAU = 100; // decision deadline (ms) for the delay sweeps
const DELAY_MAX = 300;
const JITTER_MAX = 60;

describe("PROVEN: S(p) — the one-line law (exhaustive over all p in [0, 1000])", () => {
  it("endpoints: never-arrives = the honest fallback; always-arrives = the PR-box", () => {
    for (const f of FALLBACKS) {
      expect(sOfArrival(0, f)).toBe(fallbackMilli(f));
      expect(sOfArrival(P_ONE_MILLI, f)).toBe(PR_BOX_MILLI);
    }
  });

  it("monotone non-decreasing in p, and always within [fallback, 4]", () => {
    for (const f of FALLBACKS) {
      let prev = sOfArrival(0, f);
      for (let p = 1; p <= P_ONE_MILLI; p++) {
        const s = sOfArrival(p, f);
        expect(s).toBeGreaterThanOrEqual(prev);
        expect(s).toBeGreaterThanOrEqual(fallbackMilli(f));
        expect(s).toBeLessThanOrEqual(PR_BOX_MILLI);
        prev = s;
      }
    }
  });

  it("the shared fallback dominates the independent one at every p (shared state never hurts)", () => {
    for (let p = 0; p <= P_ONE_MILLI; p++) {
      expect(sOfArrival(p, "shared")).toBeGreaterThanOrEqual(sOfArrival(p, "independent"));
    }
  });
});

describe("PROVEN: the shape of S(delay) — plateau, cliff, floor (exhaustive over delay × jitter)", () => {
  it("deterministic bus (jitter 0): a STEP — plateau at 4 while d ≤ τ, honest floor one tick past", () => {
    for (const f of FALLBACKS) {
      for (let d = 0; d <= DELAY_MAX; d++) {
        const s = sOfDelay(d, 0, TAU, f);
        expect(s).toBe(d <= TAU ? PR_BOX_MILLI : fallbackMilli(f));
      }
    }
  });

  it("S(delay) is monotone non-increasing in delay, for every jitter and fallback", () => {
    for (const f of FALLBACKS) {
      for (let j = 0; j <= JITTER_MAX; j++) {
        let prev = sOfDelay(0, j, TAU, f);
        for (let d = 1; d <= DELAY_MAX; d++) {
          const s = sOfDelay(d, j, TAU, f);
          expect(s).toBeLessThanOrEqual(prev);
          prev = s;
        }
      }
    }
  });

  it("the ramp is exactly jitter-wide: plateau while d+j ≤ τ, floor once d−j > τ", () => {
    for (const f of FALLBACKS) {
      for (let j = 0; j <= JITTER_MAX; j++) {
        for (let d = 0; d <= DELAY_MAX; d++) {
          const s = sOfDelay(d, j, TAU, f);
          if (d + j <= TAU) expect(s).toBe(PR_BOX_MILLI);
          else if (d - j > TAU) expect(s).toBe(fallbackMilli(f));
          else {
            expect(s).toBeGreaterThanOrEqual(fallbackMilli(f));
            expect(s).toBeLessThanOrEqual(PR_BOX_MILLI);
          }
        }
      }
    }
  });

  it("classification along the curve: superquantum inside the cone, never above quantum outside it", () => {
    const checkPoint = (d: number, j: number, f: Fallback): void => {
      const c = classify(sOfDelay(d, j, TAU, f));
      if (d + j <= TAU) expect(c).toBe("superquantum"); // timelike: S=4, the enmeshment warning
      // spacelike: the super-quantum zone is UNREACHABLE — the honest ceiling holds
      if (d - j > TAU) expect(c).toBe(f === "shared" ? "quantum" : "local");
    };
    for (const f of FALLBACKS) {
      for (let j = 0; j <= JITTER_MAX; j++) {
        for (let d = 0; d <= DELAY_MAX; d++) checkPoint(d, j, f);
      }
    }
  });

  it("arrival probability is a well-formed CDF slice: within [0, 1000], monotone in deadline", () => {
    for (let j = 0; j <= JITTER_MAX; j++) {
      for (let d = 0; d <= DELAY_MAX; d++) {
        let prev = arrivalProbabilityMilli(d, j, 0);
        for (let tau = 1; tau <= DELAY_MAX; tau++) {
          const p = arrivalProbabilityMilli(d, j, tau);
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(P_ONE_MILLI);
          expect(p).toBeGreaterThanOrEqual(prev); // a later deadline never loses an arrival
          prev = p;
        }
      }
    }
  });

  it("boundary sanity at the exact constants: fallbacks are the correlation bounds", () => {
    expect(fallbackMilli("independent")).toBe(LOCAL_BOUND_MILLI);
    expect(fallbackMilli("shared")).toBe(TSIRELSON_MILLI);
  });
});
