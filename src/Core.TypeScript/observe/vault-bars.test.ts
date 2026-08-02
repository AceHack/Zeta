/**
 * vault-bars.test.ts — uncertainty is rendered, never hidden.
 *
 * The bar is where over-claiming is easiest: a widget that draws only `value` looks tidy and
 * asserts a precision the data does not have. Two specific failures this pins, both of which
 * already existed on the shipped surfaces:
 *
 *   1. `Vaults.dc.html:394` computed the epsilon as `100 - round(value*100)` — FABRICATING it from
 *      the value and discarding the real one. With real data (`0.90 +/- 0.10`, `0.00 +/- 0.50`)
 *      that is simply wrong.
 *   2. The adapter emitted `{value: 0, epsilon: 0, silent: true}`, which renders naively as an
 *      empty bar with ZERO admitted uncertainty — the most confident statement the widget can
 *      make, about the dweller we know least about.
 */

import { describe, expect, test } from "bun:test";
import {
  FORBIDDEN_CADENCE_WORDS,
  NO_DATA_EPSILON,
  cadenceLabel,
  numeral,
  signedBar,
  unsignedBar,
} from "./vault-bars.ts";

describe("no data is NOT a bar", () => {
  test("value 0 with a wide band is not-observed, not an empty bar", () => {
    // "We never looked" and "we looked and it is zero" are different claims. A full-width
    // uncertainty band and a confident zero are both wrong here; the honest render is no bar.
    const plan = unsignedBar(0, NO_DATA_EPSILON);
    expect(plan.kind).toBe("not-observed");
  });

  test("a real low value with a narrow band IS a bar", () => {
    // The negative control: if everything degraded to not-observed, the widget would say nothing.
    const plan = unsignedBar(0.1, 0.05);
    expect(plan.kind).toBe("bar");
  });
});

describe("the band is the admitted uncertainty, and it clamps", () => {
  test("solid fill stops where the band begins", () => {
    const plan = unsignedBar(0.5, 0.2);
    expect(plan.kind).toBe("bar");
    if (plan.kind !== "bar") return;
    expect(plan.solidTo).toBeCloseTo(0.3, 5);
    expect(plan.bandFrom).toBeCloseTo(0.3, 5);
    expect(plan.bandTo).toBeCloseTo(0.7, 5);
    expect(plan.tickAt).toBeCloseTo(0.5, 5);
  });

  test("the band CLAMPS at the track edges rather than wrapping", () => {
    // .95 with a .2 band is "somewhere in [.75, 1]" — not something that wraps to the left edge.
    const plan = unsignedBar(0.95, 0.2);
    if (plan.kind !== "bar") return;
    expect(plan.bandTo).toBe(1);
    expect(plan.bandFrom).toBeCloseTo(0.75, 5);
  });

  test("a wide band at a low value clamps at zero, never negative", () => {
    const plan = unsignedBar(0.1, 0.3);
    if (plan.kind !== "bar") return;
    expect(plan.solidTo).toBe(0);
    expect(plan.bandFrom).toBe(0);
  });
});

describe("epsilon is READ, never fabricated from the value", () => {
  test("the same value with different epsilons yields different bands", () => {
    // The `Vaults.dc.html:394` bug in one assertion: if epsilon were computed from the value,
    // these two would be identical. They must not be.
    const tight = unsignedBar(0.9, 0.02);
    const loose = unsignedBar(0.9, 0.3);
    if (tight.kind !== "bar" || loose.kind !== "bar") return;
    expect(tight.bandTo - tight.bandFrom).toBeLessThan(loose.bandTo - loose.bandFrom);
  });

  test("the numeral shows both, in the shipped format", () => {
    expect(numeral(0.5, 0.27)).toBe(".50 +/- .27");
    expect(numeral(0.9, 0.1)).toBe(".90 +/- .10");
  });
});

describe("signed epsilon leans one way — and NEVER changes the colour", () => {
  test("+eps extends the band upward from the value", () => {
    const plan = signedBar(0.5, 0.2);
    if (plan.kind !== "bar") return;
    expect(plan.bandFrom).toBeCloseTo(0.5, 5);
    expect(plan.bandTo).toBeCloseTo(0.7, 5);
    expect(plan.lean).toBe("up");
  });

  test("-eps extends the band downward to the value", () => {
    const plan = signedBar(0.5, -0.2);
    if (plan.kind !== "bar") return;
    expect(plan.bandFrom).toBeCloseTo(0.3, 5);
    expect(plan.bandTo).toBeCloseTo(0.5, 5);
    expect(plan.lean).toBe("down");
  });

  test("the plan carries NO colour — sign cannot become red", () => {
    // Red is `heat` and nothing else. In the current snapshot every agent carries eps ~= -0.107;
    // if downside rendered red the whole settlement would be red, and that would be a lie — the
    // "decline" is an artifact of the cadence denominator, not a failure.
    const down = signedBar(0.5, -0.2);
    expect(JSON.stringify(down)).not.toMatch(/#|colou?r|red/i);
  });

  test("zero epsilon leans neither way", () => {
    const plan = signedBar(0.5, 0);
    if (plan.kind !== "bar") return;
    expect(plan.lean).toBe("none");
  });
});

describe("silent is a corroborated fact, rendered without a verdict", () => {
  test("a silent dweller gets NO bar", () => {
    // `{value: 0, epsilon: 0, silent: true}` naively rendered is an empty bar with zero admitted
    // uncertainty — maximum confidence about the dweller we know least about.
    const plan = signedBar(0, 0, true);
    expect(plan.kind).toBe("silent");
  });

  test("the caption states the MECHANISM and the witness count", () => {
    // What makes the label auditable rather than an accusation: a reader can see it was a quorum
    // observation and how it could be wrong.
    const plan = signedBar(0, 0, true);
    if (plan.kind !== "silent") return;
    expect(plan.caption).toContain("7d");
    expect(plan.caption).toContain("corroborated");
    expect(plan.caption).toContain("peers");
  });

  test("nothing in the silent render is a verdict", () => {
    // Forbidden per §5: no warning glyphs, no past tense, no accusation. `silent` replaced
    // `degenerate` precisely because the word is factual, and the visual must carry the same
    // neutrality — a dweller declared silent is not being accused of anything.
    const plan = signedBar(0, 0, true);
    const text = JSON.stringify(plan);
    for (const verdict of ["!", "⚠", "✗", "warning", "inactive", "gone", "missing", "dropped", "failed"]) {
      expect(text).not.toContain(verdict);
    }
  });

  test("silent is distinct from not-observed", () => {
    // Corroborated absence vs no measurement. Collapsing them would lose the thing that makes
    // silence auditable: we know WHY there is nothing, and who witnessed it.
    expect(signedBar(0, 0, true).kind).toBe("silent");
    expect(signedBar(0, NO_DATA_EPSILON).kind).toBe("not-observed");
  });
});

describe("the cadence readout shows its denominator and drops the noun", () => {
  test("the label names cadence adherence and carries both numbers", () => {
    // Dividing by an expected 4 ticks/hour that the scheduler does not deliver scores every agent
    // ~0.12. Under the word "reputation" that reads as "12% trustworthy". They are not — they are
    // ticking at the rate GitHub permits, so the denominator goes on screen.
    const label = cadenceLabel(41, 336);
    expect(label).toContain("cadence adherence");
    expect(label).toContain("41");
    expect(label).toContain("336");
  });

  test("the forbidden nouns appear nowhere in it", () => {
    const label = cadenceLabel(41, 336).toLowerCase();
    for (const word of FORBIDDEN_CADENCE_WORDS) {
      expect(label).not.toContain(word);
    }
  });
});
