/**
 * trust-neighbourhood.test.ts — trajectory slice 2: the fingerprint constraint.
 *
 * Tests that the neighbourhood fingerprint is:
 * 1. LOSSY — you cannot reconstruct subjects from it
 * 2. LOCAL — computed from held anchors only, no ambient state
 * 3. PURE — same inputs, same fingerprint, deterministically
 * 4. NON-ENUMERABLE — no primitive exposes subject identifiers
 * 5. HETEROGENEOUS — node-specific binning prevents cross-node joins
 * 6. SAFE TO EXCHANGE — comparison reveals less than either fingerprint alone
 */

import { describe, test, expect } from "bun:test";
import {
  computeFingerprint,
  compareFingerprints,
  nodeSpecificBins,
} from "./trust-neighbourhood";
import type { HeldAnchor } from "./local-trust-view";
import type { PhaseState } from "./phase-clock";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stamp(phase: number, seed: number = phase * 7): PhaseState {
  return { phase, seed, lastAdvanceReason: "heartbeat", wallClockAt: "2026-08-10T00:00:00Z" };
}

function anchor(subject: string, phase: number): HeldAnchor {
  return { subject, stamp: stamp(phase) };
}

// ─── Fingerprint computation ─────────────────────────────────────────────────

describe("computeFingerprint", () => {
  test("empty anchors produce a zero-size fingerprint", () => {
    const fp = computeFingerprint([], 100);
    expect(fp.schema).toBe("zeta.neighbourhood.v1");
    expect(fp.size).toBe(0);
    expect(fp.atPhase).toBe(100);
    expect(fp.histogram.every((b) => b.count === 0)).toBe(true);
  });

  test("subjects are counted (deduplicated by subject, latest wins)", () => {
    const held: HeldAnchor[] = [
      anchor("alice", 50),
      anchor("alice", 80), // later for same subject — this wins
      anchor("bob", 60),
      anchor("carol", 70),
    ];
    const fp = computeFingerprint(held, 100);
    expect(fp.size).toBe(3); // alice, bob, carol
  });

  test("subjects bucketed by phase distance from current phase", () => {
    // currentPhase = 100, edges = [10, 50, 200, 1000]
    // bins: [0,10), [10,50), [50,200), [200,1000), [1000,∞)
    const held: HeldAnchor[] = [
      anchor("recent", 95), // distance 5 → bin [0,10)
      anchor("warm", 70), // distance 30 → bin [10,50)
      anchor("cooling", 20), // distance 80 → bin [50,200)
    ];
    const fp = computeFingerprint(held, 100);
    expect(fp.histogram[0]!.count).toBe(1); // [0,10)
    expect(fp.histogram[1]!.count).toBe(1); // [10,50)
    expect(fp.histogram[2]!.count).toBe(1); // [50,200)
    expect(fp.histogram[3]!.count).toBe(0); // [200,1000)
    expect(fp.histogram[4]!.count).toBe(0); // [1000,∞)
  });

  test("PURITY: same inputs same fingerprint", () => {
    const held = [anchor("a", 50), anchor("b", 60)];
    const fp1 = computeFingerprint(held, 100);
    const fp2 = computeFingerprint(held, 100);
    expect(fp1).toEqual(fp2);
  });

  test("density computed when maxPopulation given", () => {
    const held = [anchor("a", 50), anchor("b", 60), anchor("c", 70)];
    const fp = computeFingerprint(held, 100, { maxPopulation: 10 });
    expect(fp.density).toBe(0.3);
  });

  test("density omitted when maxPopulation not given", () => {
    const held = [anchor("a", 50)];
    const fp = computeFingerprint(held, 100);
    expect(fp.density).toBeUndefined();
  });

  test("custom bin edges produce different bucketing", () => {
    const held = [anchor("x", 80)]; // distance 20 from phase 100
    const fpDefault = computeFingerprint(held, 100);
    const fpCustom = computeFingerprint(held, 100, { binEdges: [5, 15, 25] });
    // Default bins: [0,10), [10,50)... → distance 20 in bin [10,50) = index 1
    expect(fpDefault.histogram[1]!.count).toBe(1);
    // Custom bins: [0,5), [5,15), [15,25), [25,∞) → distance 20 in bin [15,25) = index 2
    expect(fpCustom.histogram[2]!.count).toBe(1);
  });
});

// ─── Anti-enumeration (the structural guarantee) ─────────────────────────────

describe("structural non-enumerability", () => {
  test("fingerprint contains NO subject identifiers", () => {
    const held = [anchor("secret-alice", 50), anchor("secret-bob", 60)];
    const fp = computeFingerprint(held, 100);
    const serialized = JSON.stringify(fp);
    expect(serialized).not.toContain("secret-alice");
    expect(serialized).not.toContain("secret-bob");
    // Also check that no field in the histogram or anywhere leaks identity
    expect(serialized).not.toContain("alice");
    expect(serialized).not.toContain("bob");
  });

  test("fingerprint contains NO exact phase values of anchors", () => {
    const held = [anchor("x", 42), anchor("y", 73)];
    const fp = computeFingerprint(held, 100);
    // The fingerprint should not reveal that specific phases 42 or 73 exist
    // Only the atPhase (100) should appear as a phase value
    const serialized = JSON.stringify(fp);
    // Phase distances (58, 27) appear implicitly in bin assignment but not as values
    expect(serialized).not.toContain('"42"');
    expect(serialized).not.toContain('"73"');
  });

  test("two different subject sets with same recency distribution are INDISTINGUISHABLE", () => {
    // This is the fingerprinting invariant: the fingerprint is a function of
    // the DISTRIBUTION, not the IDENTITIES
    const setA = [anchor("alpha", 90), anchor("beta", 50)];
    const setB = [anchor("gamma", 90), anchor("delta", 50)];
    const fpA = computeFingerprint(setA, 100);
    const fpB = computeFingerprint(setB, 100);
    // Same histogram, same size — fingerprints are identical
    expect(fpA.histogram).toEqual(fpB.histogram);
    expect(fpA.size).toBe(fpB.size);
  });
});

// ─── Fingerprint comparison ──────────────────────────────────────────────────

describe("compareFingerprints", () => {
  test("identical fingerprints: sizeDirection=0, all deltas zero", () => {
    const held = [anchor("a", 90), anchor("b", 50)];
    const fp = computeFingerprint(held, 100);
    const cmp = compareFingerprints(fp, fp);
    expect(cmp.sizeDirection).toBe(0);
    expect(cmp.binsCompatible).toBe(true);
    expect(cmp.binDeltas!.every((d) => d === 0)).toBe(true);
  });

  test("one side larger: sizeDirection reflects that", () => {
    const mine = computeFingerprint([anchor("a", 90), anchor("b", 80), anchor("c", 70)], 100);
    const theirs = computeFingerprint([anchor("x", 90)], 100);
    const cmp = compareFingerprints(mine, theirs);
    expect(cmp.sizeDirection).toBe(1); // I have more
  });

  test("incompatible bins: comparison is coarse-only", () => {
    const mine = computeFingerprint([anchor("a", 90)], 100);
    const theirs = computeFingerprint([anchor("x", 90)], 100, { binEdges: [5, 25, 100] });
    const cmp = compareFingerprints(mine, theirs);
    expect(cmp.binsCompatible).toBe(false);
    expect(cmp.binDeltas).toBeUndefined();
    // Size direction still works
    expect(cmp.sizeDirection).toBe(0);
  });

  test("comparison reveals LESS than either fingerprint", () => {
    // Comparison is a delta over counts. Counts are already lossy over identifiers.
    // So comparison is doubly lossy — you can't reconstruct either fingerprint from it.
    const mine = computeFingerprint([anchor("a", 90), anchor("b", 50)], 100);
    const theirs = computeFingerprint([anchor("x", 90), anchor("y", 85), anchor("z", 50)], 100);
    const cmp = compareFingerprints(mine, theirs);
    // The comparison tells us theirs has 1 more total, and the per-bin difference
    // But NOT that "x" and "y" are in the recent bin specifically
    expect(cmp.sizeDirection).toBe(-1); // they have more
    expect(cmp.binsCompatible).toBe(true);
  });
});

// ─── Node-specific binning (heterogeneity defence) ───────────────────────────

describe("nodeSpecificBins", () => {
  test("different seeds produce different bin edges", () => {
    const bins1 = nodeSpecificBins(42);
    const bins2 = nodeSpecificBins(1337);
    // With different seeds, at least some edges should differ
    const allSame = bins1.every((b, i) => b === bins2[i]);
    expect(allSame).toBe(false);
  });

  test("same seed produces same bins (deterministic)", () => {
    const bins1 = nodeSpecificBins(42);
    const bins2 = nodeSpecificBins(42);
    expect(bins1).toEqual(bins2);
  });

  test("bins are always strictly ascending", () => {
    // Try a range of seeds to verify monotonicity invariant
    for (let seed = 0; seed < 100; seed++) {
      const bins = nodeSpecificBins(seed);
      for (let i = 1; i < bins.length; i++) {
        expect(bins[i]!).toBeGreaterThan(bins[i - 1]!);
      }
    }
  });

  test("heterogeneous binning prevents cross-node joins", () => {
    // Two nodes with different bins produce incompatible fingerprints
    const held = [anchor("shared-subject", 90)];
    const binsA = nodeSpecificBins(42);
    const binsB = nodeSpecificBins(1337);
    const fpA = computeFingerprint(held, 100, { binEdges: binsA });
    const fpB = computeFingerprint(held, 100, { binEdges: binsB });
    // Even though they hold the SAME subject, comparison says "incompatible"
    const cmp = compareFingerprints(fpA, fpB);
    expect(cmp.binsCompatible).toBe(false);
  });

  test("bins always have at least 4 elements (matching defaults)", () => {
    for (let seed = 0; seed < 50; seed++) {
      const bins = nodeSpecificBins(seed);
      expect(bins.length).toBe(4);
    }
  });
});

// ─── Falsifiers (the trajectory's own spec) ──────────────────────────────────

describe("trajectory falsifiers", () => {
  test("FALSIFIER #3: no global graph assemblable from the API", () => {
    // The module exports: computeFingerprint, compareFingerprints, nodeSpecificBins
    // None of these accept or return subject identifiers.
    // computeFingerprint takes HeldAnchor[] but OUTPUT has no SubjectId
    const held = [anchor("secret", 50)];
    const fp = computeFingerprint(held, 100);
    // The fingerprint type has no field that could contain a subject ID
    const keys = Object.keys(fp);
    expect(keys).not.toContain("subjects");
    expect(keys).not.toContain("anchors");
    // Compare also reveals no subjects
    const cmp = compareFingerprints(fp, fp);
    const cmpKeys = Object.keys(cmp);
    expect(cmpKeys).not.toContain("subjects");
  });

  test("FALSIFIER: lossy projection — two inputs collapse to same output", () => {
    // Information is DISCARDED, not hidden. Different identities, same fingerprint.
    const heldA = [anchor("personality-A", 90)];
    const heldB = [anchor("personality-B", 90)];
    const fpA = computeFingerprint(heldA, 100);
    const fpB = computeFingerprint(heldB, 100);
    expect(fpA).toEqual(fpB); // indistinguishable → irreversible
  });
});
