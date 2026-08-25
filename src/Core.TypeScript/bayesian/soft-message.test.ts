/**
 * Falsifiers for the categorical message family.
 *
 * The claim worth testing is not "the arithmetic works". It is that NO SINGLE
 * PARTICIPANT CAN SILENCE A CANDIDATE — and that claim is only meaningful if
 * the test would catch its removal. §VETO RESISTANCE builds the attack
 * explicitly and shows it succeeding against the unbounded design, so the
 * passing test measures the clamp rather than assuming it.
 */

import { describe, expect, test } from "bun:test";
import {
  argmax,
  atInfluenceFloor,
  distinctSourceCount,
  divide,
  effectiveCount,
  fromLogWeights,
  MAX_INFLUENCE,
  product,
  productAll,
  productByDistinctSource,
  SCALE,
  type SoftMessage,
  type SourceAssignment,
  toDistribution,
  uniform,
} from "./soft-message";

/** A finite stand-in for the veto a caller might try to express. */
const VERY_STRONG_DISBELIEF = 1e9;

describe("group laws — exactly, because integers", () => {
  const a = fromLogWeights({ x: 1200, y: -300, z: 50 });
  const b = fromLogWeights({ x: -400, y: 900, w: 20 });
  const c = fromLogWeights({ y: 111, z: -222, w: -333 });

  test("uniform is the identity for product", () => {
    expect(product(a, uniform)).toEqual(a);
    expect(product(uniform, a)).toEqual(a);
  });

  test("product is commutative", () => {
    expect(product(a, b)).toEqual(product(b, a));
  });

  test("product is associative — EXACTLY, so message order cannot change a decision", () => {
    // The reason for integers rather than floats. With float log-weights this
    // holds only approximately, and "approximately associative" means two
    // agents that received the same evidence in different orders can reach
    // different argmaxes. That is a divergence bug wearing a rounding error.
    expect(product(product(a, b), c)).toEqual(product(a, product(b, c)));
  });

  test("divide inverts product — the EP cavity is exact", () => {
    const joint = product(a, b);
    const cavity = divide(joint, b);
    // Every key `a` mentions comes back at its original value.
    for (const k of Object.keys(a)) expect(cavity[k]).toBe(a[k]!);
    // Keys only `b` mentioned come back to 0 — no opinion, not weight zero.
    expect(cavity["w"]).toBe(0);
  });

  test("an absent key means NO OPINION, not impossible", () => {
    // The distinction the whole design rests on. `uniform` mentions nothing
    // and must therefore change nothing.
    const m = fromLogWeights({ only: 500 });
    expect(product(m, uniform)["only"]).toBe(500);
    expect(product(m, uniform)["anything-else"]).toBeUndefined();
  });
});

describe("VETO RESISTANCE — no single participant can silence a candidate", () => {
  /** The unbounded design, for contrast. This is what we are NOT shipping. */
  const unboundedProduct = (
    a: Record<string, number>,
    b: Record<string, number>,
  ): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
      out[k] = (a[k] ?? 0) + (b[k] ?? 0);
    return out;
  };

  test("THE ATTACK SUCCEEDS against unbounded log-weights", () => {
    // One participant asserts weight zero (log −∞) for `dissent`. Then a
    // hundred participants, each strongly in favour, try to revive it.
    let joint: Record<string, number> = { dissent: -Infinity, consensus: 0 };
    for (let i = 0; i < 100; i++) {
      joint = unboundedProduct(joint, { dissent: 50 * SCALE, consensus: 0 });
    }
    // It is gone. Not unlikely — GONE, and unrecoverable by any finite evidence.
    expect(joint["dissent"]).toBe(-Infinity);
    expect(joint["dissent"]! > joint["consensus"]!).toBe(false);
  });

  test("...and FAILS against bounded influence, which is the point", () => {
    const attacker = fromLogWeights({ dissent: -VERY_STRONG_DISBELIEF, consensus: 0 });
    // The attacker's opinion was clamped to the floor, not honoured as −∞.
    expect(attacker["dissent"]).toBe(-MAX_INFLUENCE);

    let joint: SoftMessage = attacker;
    // A single supporter of equal strength is enough to cancel it exactly.
    joint = product(joint, fromLogWeights({ dissent: MAX_INFLUENCE, consensus: 0 }));
    expect(joint["dissent"]).toBe(0);

    // And one more makes the suppressed candidate the society's argmax.
    joint = product(joint, fromLogWeights({ dissent: MAX_INFLUENCE, consensus: 0 }));
    expect(joint["dissent"]).toBe(MAX_INFLUENCE);
    expect(argmax(joint)).toBe("dissent");
  });

  test("the bound is exactly what one participant may assert", () => {
    // Not a soft preference — an arithmetic ceiling. Ask for a thousand times
    // the bound and you get the bound.
    const shouting = fromLogWeights({ c: 1000 * MAX_INFLUENCE });
    expect(shouting["c"]).toBe(MAX_INFLUENCE);
    const whispering = fromLogWeights({ c: -1000 * MAX_INFLUENCE });
    expect(whispering["c"]).toBe(-MAX_INFLUENCE);
  });

  test("k attackers need k defenders — influence is linear, not absolute", () => {
    // The honest limit, asserted rather than glossed: bounded influence does
    // not make a candidate unsuppressable, it makes suppression COST
    // something proportional. Five attackers are outvoted by five supporters
    // and not by four. A majority can still bury a minority — what it cannot
    // do is bury it with one voice, or bury it irreversibly.
    const attack = (n: number): SoftMessage => {
      let m: SoftMessage = uniform;
      for (let i = 0; i < n; i++) m = product(m, fromLogWeights({ c: -MAX_INFLUENCE }));
      return m;
    };
    const defend = (m: SoftMessage, n: number): SoftMessage => {
      let out = m;
      for (let i = 0; i < n; i++) out = product(out, fromLogWeights({ c: MAX_INFLUENCE }));
      return out;
    };
    expect(defend(attack(5), 4)["c"]).toBe(-MAX_INFLUENCE);
    expect(defend(attack(5), 5)["c"]).toBe(0);
    expect(defend(attack(5), 6)["c"]).toBe(MAX_INFLUENCE);
  });
});

describe("the cavity cannot blow up — same clamp, second problem", () => {
  test("dividing by a floor-clamped message stays finite", () => {
    const suppressor = fromLogWeights({ c: -VERY_STRONG_DISBELIEF });
    const joint = product(fromLogWeights({ c: 0 }), suppressor);
    const cavity = divide(joint, suppressor);
    expect(Number.isFinite(cavity["c"]!)).toBe(true);
    expect(cavity["c"]).toBe(0);
  });

  test("no operation produces NaN or Infinity, over the whole bound range", () => {
    const extremes = [-MAX_INFLUENCE, -1, 0, 1, MAX_INFLUENCE];
    for (const l of extremes) {
      for (const r of extremes) {
        const a = fromLogWeights({ c: l });
        const b = fromLogWeights({ c: r });
        for (const v of [product(a, b)["c"]!, divide(a, b)["c"]!]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(Number.isNaN(v)).toBe(false);
        }
      }
    }
  });

  test("an infinite log-weight is REFUSED, not silently reinterpreted", () => {
    // Clamping −Infinity to the floor would be the friendly thing and the
    // wrong thing: it hides a caller who believes they can express certainty.
    expect(() => fromLogWeights({ c: -Infinity })).toThrow(/permanent veto/);
    expect(() => fromLogWeights({ c: Number.NaN })).toThrow();
  });
});

describe("dual-use — the module reports facts and refuses verdicts", () => {
  test("atInfluenceFloor names the clamped candidates and says nothing more", () => {
    const m = fromLogWeights({ suppressed: -VERY_STRONG_DISBELIEF, ordinary: -5, loud: 1e9 });
    expect(atInfluenceFloor(m)).toEqual(["suppressed"]);
  });

  test("the SAME fact carries opposite readings, which is why there is no verdict", () => {
    // An adversary suppressing a candidate, and an honest sensor that has
    // simply never observed it, produce byte-identical messages. No function
    // here can tell them apart, and one that claimed to would be lying.
    const adversary = fromLogWeights({ c: -VERY_STRONG_DISBELIEF });
    const honestSensorWithNoData = fromLogWeights({ c: -VERY_STRONG_DISBELIEF });
    expect(adversary).toEqual(honestSensorWithNoData);
    expect(atInfluenceFloor(adversary)).toEqual(atInfluenceFloor(honestSensorWithNoData));
    // Any `detectSuppressionAttack` would have to invent the difference.
  });
});

describe("the exit to decision space", () => {
  test("toDistribution normalizes, and floats appear only here", () => {
    const d = toDistribution(fromLogWeights({ a: 0, b: 0 }));
    expect(d["a"]).toBeCloseTo(0.5, 10);
    expect(d["b"]).toBeCloseTo(0.5, 10);
    const total = Object.values(d).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  test("a floored candidate keeps NON-ZERO probability — quiet, not deleted", () => {
    // The values claim, made arithmetic. Down-weighted, never removed: the
    // minority candidate is the one carrying information when the majority is
    // wrong, so it has to stay reachable.
    const d = toDistribution(fromLogWeights({ minority: -VERY_STRONG_DISBELIEF, majority: 0 }));
    expect(d["minority"]!).toBeGreaterThan(0);
    expect(d["minority"]!).toBeLessThan(d["majority"]!);
  });

  test("argmax ties break by ascending key, matching the SoftValue oracle", () => {
    expect(argmax(fromLogWeights({ b: 5, a: 5 }))).toBe("a");
    expect(argmax(uniform)).toBeNull();
  });
});

describe("SYBIL RESISTANCE — bounded influence alone was not enough", () => {
  test("THE HOLE: bounded influence does NOT stop an attacker who sends many messages", () => {
    // Stated as a failing property of the naive combine, because it was a real
    // gap in the first version of this module and pretending otherwise would
    // make everything below look stronger than it is.
    let joint: SoftMessage = fromLogWeights({ truth: MAX_INFLUENCE });
    for (let i = 0; i < 50; i++) {
      joint = product(joint, fromLogWeights({ truth: -MAX_INFLUENCE, lie: MAX_INFLUENCE }));
    }
    // Fifty clones beat one honest voice under plain addition. Per-message
    // bounds without identity are worthless against a Sybil (Douceur 2002).
    expect(argmax(joint)).toBe("lie");
  });

  test("rho = 1 makes N clones worth ONE message — cloning buys nothing", () => {
    const clone = fromLogWeights({ lie: MAX_INFLUENCE });
    const one = productAll([clone], 1);
    const fifty = productAll(Array.from({ length: 50 }, () => clone), 1);
    expect(fifty["lie"]).toBe(one["lie"]);
  });

  test("...so the same attack fails once the clones are priced as correlated", () => {
    const honest = fromLogWeights({ truth: MAX_INFLUENCE });
    const clone = fromLogWeights({ truth: -MAX_INFLUENCE, lie: MAX_INFLUENCE });
    const fleet = productAll(Array.from({ length: 50 }, () => clone), 1);
    // The fleet now carries EXACTLY one clone's worth, and the boundary is
    // asserted rather than gestured at. Each clone votes truth:-B, lie:+B; each
    // honest voice votes truth:+B. So k honest gives truth = (k-1)B against
    // lie = B, and truth wins only for k > 2.
    expect(fleet["lie"]).toBe(MAX_INFLUENCE);
    expect(fleet["truth"]).toBe(-MAX_INFLUENCE);

    const withTwo = product(product(honest, honest), fleet);
    expect(withTwo["truth"]).toBe(withTwo["lie"]); // a tie, broken by key order
    const withThree = product(product(product(honest, honest), honest), fleet);
    expect(argmax(withThree)).toBe("truth");

    // Fifty clones cost the honest side three voices instead of fifty-one.
    // That is the whole claim, and it is a RATIO not an immunity.
  });

  test("rho = 0 reproduces plain product exactly — no silent discount", () => {
    // The discount must be OPT-IN via a measured rho, not applied by default.
    // A combine that quietly shrank independent evidence would be its own bug.
    const a = fromLogWeights({ x: 300, y: -100 });
    const b = fromLogWeights({ x: -50, z: 700 });
    expect(productAll([a, b], 0)).toEqual(product(a, b));
  });

  test("effectiveCount matches the F# peer at both endpoints and clamps rho", () => {
    // Pinned to SocietyUsefulWork.fs:112 `effectiveTrialCount` so the two
    // cannot drift: rho=0 -> n, rho=1 -> 1.
    expect(effectiveCount(50, 0)).toBe(50);
    expect(effectiveCount(50, 1)).toBe(1);
    expect(effectiveCount(50, -5)).toBe(50); // clamped low
    expect(effectiveCount(50, 9)).toBe(1); // clamped high
    expect(effectiveCount(0, 0.5)).toBe(0);
    // Interior: deff = 1 + 49*0.5 = 25.5, nEff = 50/25.5
    expect(effectiveCount(50, 0.5)).toBeCloseTo(50 / 25.5, 10);
  });

  test("partial correlation partially discounts — it is a dial, not a switch", () => {
    const m = fromLogWeights({ c: 1000 });
    const ten = Array.from({ length: 10 }, () => m);
    const independent = productAll(ten, 0)["c"]!;
    const half = productAll(ten, 0.5)["c"]!;
    const identical = productAll(ten, 1)["c"]!;
    expect(independent).toBe(10000);
    expect(identical).toBe(1000);
    expect(half).toBeGreaterThan(identical);
    expect(half).toBeLessThan(independent);
  });
});

describe("THE SENSOR WIRED TO THE PRICING — distinctness, not an asserted rho", () => {
  test("a fleet traced to ONE source carries one participant's worth", () => {
    const puppet = fromLogWeights({ lie: MAX_INFLUENCE, truth: -MAX_INFLUENCE });
    const fleet = Array.from({ length: 50 }, () => puppet);
    // The probe traced all 50 claimed identities to source component 0.
    const oneSource: SourceAssignment = new Map(fleet.map((_, i) => [i, 0]));
    const collapsed = productByDistinctSource(fleet, oneSource);
    expect(collapsed).toEqual(puppet);
    expect(distinctSourceCount(50, oneSource)).toBe(1);
  });

  test("SPLITTING an opinion across puppets does not amplify it", () => {
    // Why the within-group collapse averages rather than sums. A source that
    // splits its conviction over ten puppets, each asserting a tenth, would
    // reassemble the full weight under summation — the attack restated as
    // arithmetic. Averaging returns exactly what one participant said.
    const tenth = fromLogWeights({ c: MAX_INFLUENCE / 10 });
    const split = Array.from({ length: 10 }, () => tenth);
    const oneSource: SourceAssignment = new Map(split.map((_, i) => [i, 0]));
    expect(productByDistinctSource(split, oneSource)["c"]).toBe(MAX_INFLUENCE / 10);
  });

  test("genuinely distinct sources are NOT discounted — honest consensus survives", () => {
    // The failure mode an in-band, content-based estimator would have: three
    // independent sensors that AGREE would look correlated and be penalised.
    // Distinctness is measured from drift, not from what they said, so
    // agreement between distinct sources counts fully.
    const agree = fromLogWeights({ c: 1000 });
    const three = [agree, agree, agree];
    const distinct: SourceAssignment = new Map([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    expect(productByDistinctSource(three, distinct)["c"]).toBe(3000);
    expect(distinctSourceCount(3, distinct)).toBe(3);
  });

  test("the mixed case: a fleet plus honest voices prices each side once", () => {
    const puppet = fromLogWeights({ lie: MAX_INFLUENCE, truth: -MAX_INFLUENCE });
    const honest = fromLogWeights({ truth: MAX_INFLUENCE });
    const batch = [puppet, puppet, puppet, puppet, honest, honest];
    // Probe: indices 0-3 are one forged source; 4 and 5 are distinct.
    const readout: SourceAssignment = new Map([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 1],
      [5, 2],
    ]);
    const joint = productByDistinctSource(batch, readout);
    // Four puppets contribute one puppet's worth; two honest contribute two.
    expect(joint["truth"]).toBe(2 * MAX_INFLUENCE - MAX_INFLUENCE);
    expect(joint["lie"]).toBe(MAX_INFLUENCE);
    expect(argmax(joint)).toBe("lie"); // still a tie broken by key order
    expect(distinctSourceCount(6, readout)).toBe(3);
  });

  test("an UNMEASURED participant fails OPEN — counted as its own source", () => {
    // Deliberate and stated: default regard for a participant the probe never
    // saw, matching TravelerRankLedger's honest 0.5 prior over a pessimistic
    // clamp. The cost is that probe coverage is load-bearing, and this test
    // exists so that cost is visible rather than discovered.
    const m = fromLogWeights({ c: 500 });
    const empty: SourceAssignment = new Map();
    expect(productByDistinctSource([m, m, m], empty)["c"]).toBe(1500);
    expect(distinctSourceCount(3, empty)).toBe(3);
  });

  test("collapsing is idempotent — re-combining one source's output changes nothing", () => {
    const m = fromLogWeights({ c: 700 });
    const one: SourceAssignment = new Map([[0, 0]]);
    const once = productByDistinctSource([m], one);
    const twice = productByDistinctSource([once], one);
    expect(twice).toEqual(once);
  });
});
