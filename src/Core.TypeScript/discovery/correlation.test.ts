import { describe, it, expect } from "bun:test";
import {
  classify,
  distanceOf,
  classRank,
  isIndependent,
  LOCAL_BOUND_MILLI,
  TSIRELSON_MILLI,
  PR_BOX_MILLI,
} from "./correlation";

describe("distanceOf — how far above the autonomous ground state (S=2)", () => {
  it("is 0 at/below S=2 and grows toward the fusion pole", () => {
    expect(distanceOf(1500)).toBe(0); // below the local bound — still autonomous
    expect(distanceOf(2000)).toBe(0); // exactly S=2 — the ground state
    expect(distanceOf(3000)).toBe(1000);
    expect(distanceOf(PR_BOX_MILLI)).toBe(2000); // the enmeshment extreme
  });
});

describe("classify — the human relational reading (autonomy → relatedness → enmeshment)", () => {
  it("maps the S-distance to its class", () => {
    expect(classify(1800)).toBe("local"); // autonomy
    expect(classify(LOCAL_BOUND_MILLI)).toBe("local"); // S=2 boundary → autonomous
    expect(classify(2500)).toBe("quantum"); // relatedness
    expect(classify(TSIRELSON_MILLI)).toBe("quantum"); // Tsirelson boundary
    expect(classify(3500)).toBe("signaling"); // enmeshment ("S=4 shit")
    expect(classify(PR_BOX_MILLI)).toBe("signaling");
  });

  it("is order-preserving — more distance never lowers the class (a poset, not a ranking)", () => {
    const samples = [1000, 2000, 2500, 2828, 3000, 4000];
    for (let i = 1; i < samples.length; i++) {
      expect(classRank(classify(samples[i]!))).toBeGreaterThanOrEqual(classRank(classify(samples[i - 1]!)));
    }
  });

  it("high S is NOT health — signaling is the enmeshment WARNING, not the goal", () => {
    // asserted at the values level: classRank rises toward enmeshment, and the healthy state is
    // isIndependent-reachable (exit), never a fixed high pole.
    expect(classRank("signaling")).toBeGreaterThan(classRank("local"));
    expect(isIndependent(PR_BOX_MILLI)).toBe(false); // fully fused = no autonomy left
    expect(isIndependent(LOCAL_BOUND_MILLI)).toBe(true); // the self you can always return to
  });
});
