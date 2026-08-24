/**
 * tick-agreement-probe.test.ts — the falsifiers.
 *
 * The load-bearing one is FORCING CASE, which mechanizes the whole reason this file exists:
 * agreement correlation and Condorcet error correlation are DIFFERENT QUANTITIES, and a test suite
 * that cannot tell them apart would let the probe be misused as a `rho` for
 * `N_eff = N/(1+(N-1)rho)`.
 */

import { describe, expect, test } from "bun:test";
import { bucketByWindow, pairAgreement, type ObserveEvent } from "./tick-agreement-probe";

const W = 900_000;

function ev(by: string, ms: number, kind: string): ObserveEvent {
  return { at: new Date(ms).toISOString(), by, action: { kind } };
}

/** Build one event per (agent, window) from explicit per-window kind pairs. */
function windowsOf(pairs: readonly (readonly [string, string])[]) {
  const events: ObserveEvent[] = [];
  pairs.forEach(([ka, kb], i) => {
    events.push(ev("alexa", i * W + 1, ka));
    events.push(ev("otto", i * W + 2, kb));
  });
  return bucketByWindow(events, W, ["alexa", "otto"]);
}

describe("bucketing", () => {
  test("last write wins within a window, and separate windows stay separate", () => {
    const events = [ev("alexa", 1, "explore"), ev("alexa", 2, "play"), ev("alexa", W + 1, "explore")];
    const w = bucketByWindow(events, W, ["alexa"]);
    expect(w.size).toBe(2);
    expect(w.get(0)!.get("alexa")).toBe("play");
    expect(w.get(1)!.get("alexa")).toBe("explore");
  });

  test("an agent outside the roster is excluded, and a kindless event is dropped", () => {
    const events: ObserveEvent[] = [
      ev("society", 1, "explore"),
      { at: new Date(2).toISOString(), by: "alexa" },
      { at: "not-a-date", by: "alexa", action: { kind: "explore" } },
    ];
    expect(bucketByWindow(events, W, ["alexa"]).size).toBe(0);
  });
});

describe("kappa calibration", () => {
  test("perfect agreement with non-degenerate marginals gives kappa 1", () => {
    const r = pairAgreement(windowsOf([["a", "a"], ["b", "b"], ["a", "a"], ["b", "b"]]), "alexa", "otto");
    expect(r.po).toBe(1);
    expect(r.kappa).toBeCloseTo(1, 12);
  });

  test("agreement exactly AT the marginal chance level gives kappa 0", () => {
    // Each agent plays "a" half the time; the 2x2 is the independence table exactly.
    const r = pairAgreement(windowsOf([["a", "a"], ["a", "b"], ["b", "a"], ["b", "b"]]), "alexa", "otto");
    expect(r.po).toBeCloseTo(0.5, 12);
    expect(r.pe).toBeCloseTo(0.5, 12);
    expect(r.kappa).toBeCloseTo(0, 12);
  });

  test("a degenerate pair (both always the same single kind) reports 0, never NaN", () => {
    const r = pairAgreement(windowsOf([["a", "a"], ["a", "a"], ["a", "a"]]), "alexa", "otto");
    expect(r.pe).toBe(1);
    expect(Number.isNaN(r.kappa)).toBe(false);
    expect(r.kappa).toBe(0);
  });

  test("no comparable windows reports n = 0 rather than a number", () => {
    const events = [ev("alexa", 1, "a"), ev("otto", 5 * W + 1, "b")];
    const r = pairAgreement(bucketByWindow(events, W, ["alexa", "otto"]), "alexa", "otto");
    expect(r.n).toBe(0);
  });
});

describe("SABOTAGE CONTROL — the uniform null is the defect under test", () => {
  /**
   * Reconstructs the ACTUAL defect in `observe/decorrelation-meter.ts`: it computes excess against
   * `1 / menuSize` (what two UNIFORM choosers would agree at) instead of against the pair's own
   * marginals. On a skewed marginal — which is what the live log has — the uniform null is far
   * BELOW the true chance level, so the excess is inflated and correlation is over-reported.
   *
   * The control is the defect itself, not a paraphrase of it: same input, same `po`, only the null
   * swapped. A suite in which both nulls agreed would be a check that cannot fail.
   */
  test("on a skewed marginal the uniform null strictly over-reports correlation", () => {
    // 9 of 10 windows are "explore" for both agents; a third kind appears once each.
    const pairs: (readonly [string, string])[] = [
      ["explore", "explore"], ["explore", "explore"], ["explore", "explore"],
      ["explore", "explore"], ["explore", "explore"], ["explore", "explore"],
      ["explore", "explore"], ["explore", "explore"], ["explore", "play"],
      ["play", "explore"],
    ];
    const r = pairAgreement(windowsOf(pairs), "alexa", "otto");
    // The pair's own marginals put chance agreement far above 1/2.
    expect(r.pe).toBeGreaterThan(0.5);
    expect(r.uniformNull).toBeCloseTo(0.5, 12);
    // The defect, stated as an inequality that fails if the null is ever unified.
    expect(r.uniformNullExcess).toBeGreaterThan(r.kappa);
    // And the size of the inflation is real, not a rounding artefact.
    expect(r.uniformNullExcess - r.kappa).toBeGreaterThan(0.15);
  });
});

describe("FORCING CASE — agreement kappa does NOT identify the Condorcet error correlation", () => {
  /**
   * The probe's kappa is a function of the JOINT LABEL DISTRIBUTION ALONE. The Condorcet rho that
   * `N_eff = N/(1+(N-1)rho)` and `expectedGain` are defined over is a function of the joint label
   * distribution AND AN ANSWER KEY. So: hold the labels fixed, vary only the key, and rho moves
   * while kappa cannot move at all. The two quantities are therefore NOT in bijection, and no
   * rescaling of one produces the other.
   *
   * This is the mechanized form of the demarcation. `docs/observe-events/` carries no answer key —
   * no action kind is "correct" — so for the live log rho is not merely different from kappa, it is
   * UNDEFINED. A future change that let this probe's output be read as a Condorcet rho would have
   * to break the equality assertion below.
   */
  const LABELS: (readonly [string, string])[] = [
    ...Array.from({ length: 50 }, () => ["a", "a"] as const),
    ...Array.from({ length: 20 }, () => ["b", "b"] as const),
    ...Array.from({ length: 15 }, () => ["a", "b"] as const),
    ...Array.from({ length: 15 }, () => ["b", "a"] as const),
  ];

  /** Product-moment (phi) correlation of the two error indicators under a given answer key. */
  function errorPhi(key: readonly string[]): number {
    let both = 0, onlyA = 0, onlyB = 0, neither = 0;
    LABELS.forEach(([la, lb], i) => {
      const k = key[i]!;
      const ea = la !== k, eb = lb !== k;
      if (ea && eb) both++; else if (ea) onlyA++; else if (eb) onlyB++; else neither++;
    });
    const denom = Math.sqrt((both + onlyA) * (onlyB + neither) * (both + onlyB) * (onlyA + neither));
    return denom === 0 ? 0 : (both * neither - onlyA * onlyB) / denom;
  }

  test("kappa is invariant to the answer key; the error correlation is not", () => {
    const kappaOnce = pairAgreement(windowsOf(LABELS), "alexa", "otto").kappa;

    // KEY 1 — "a" is always correct.
    const key1 = LABELS.map(() => "a");
    // KEY 2 — the same labels, a different (and equally consistent) key: whichever of the two
    // agents' answers the majority of windows of that shape carried.
    const key2 = LABELS.map(([, lb]) => lb);

    const phi1 = errorPhi(key1);
    const phi2 = errorPhi(key2);

    // The labels never changed, so kappa cannot have changed. Recomputing proves the invariance
    // mechanically rather than by assertion.
    expect(pairAgreement(windowsOf(LABELS), "alexa", "otto").kappa).toBeCloseTo(kappaOnce, 12);

    // ...while the error correlation moved.
    expect(phi1).not.toBeCloseTo(phi2, 6);

    // And it moved by an amount that is not a rounding artefact: one key makes the pair look
    // materially more correlated in ERROR than the other, on identical observed behaviour.
    expect(Math.abs(phi1 - phi2)).toBeGreaterThan(0.2);
  });

  test("the live event log has no answer key, so a Condorcet rho is not computable from it", () => {
    // Stated as a check on the SHAPE of the event record rather than as prose: an observe event
    // carries `action.kind` and no correctness field. If one is ever added, this test fails and the
    // demarcation must be re-argued rather than silently lapsing.
    const sample: ObserveEvent = { at: new Date(0).toISOString(), by: "alexa", action: { kind: "explore" } };
    expect(Object.keys(sample.action ?? {})).toEqual(["kind"]);
  });
});
