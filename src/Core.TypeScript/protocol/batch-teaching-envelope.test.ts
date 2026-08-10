/**
 * batch-teaching-envelope.test.ts
 *
 * Tests for the RFC 9457-compatible batch teaching envelope.
 * Anti-self-certifying: tests verify that bare erasures are correctly identified,
 * that teaching ratio is 0 for all-erasure batches, and that the tensor layout
 * matches the expected four-corner structure.
 */

import { describe, test, expect } from "bun:test";
import {
  makeBatchItemCell,
  makeBatchEnvelope,
  toFourCornerTensor,
  teachingOnly,
  groupByDimension,
  erasureHeat,
  mergePriorHint,
  type BatchItemCell,
  type PriorHint,
} from "./batch-teaching-envelope";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCell(
  itemId: string,
  dimension: "transport" | "schema" | "toolchain" | "auth" | "constraint" | "version" | "unknown",
  teaching: boolean,
): BatchItemCell {
  return makeBatchItemCell({
    itemId,
    retractableBeliefId: teaching ? `belief:${itemId}` : undefined,
    generatorFn: `retry:${itemId}`,
    dimension,
    severity: "error",
    reason: `${itemId} failed`,
    what: itemId,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("batch-teaching-envelope", () => {

  // BTE-1: RFC 9457 compliance — type, status, instance
  test("BTE-1: envelope conforms to RFC 9457 shape", () => {
    const env = makeBatchEnvelope({
      batchFrameId: "frame-1",
      correlationId: "corr-1",
      totalItems: 3,
      errors: [makeCell("item-1", "transport", true)],
    });
    expect(env.type).toBe("https://zeta.lfg/problems/batch-teaching");
    expect(env.status).toBe(207);
    expect(env.instance).toContain("frame-1");
    expect(env.envelopeId).toBeTruthy();
    expect(env.emittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // BTE-2: teaching cell has isTeaching=true, bare erasure has isTeaching=false
  test("BTE-2: isTeaching flag is correctly set", () => {
    const teaching = makeCell("t1", "schema", true);
    const erasure = makeCell("e1", "schema", false);
    expect(teaching.isTeaching).toBe(true);
    expect(erasure.isTeaching).toBe(false);
    expect(teaching.retractableBeliefId).toBe("belief:t1");
    expect(erasure.retractableBeliefId).toBeUndefined();
  });

  // BTE-3: summary counts are correct
  test("BTE-3: summary counts are correct", () => {
    const env = makeBatchEnvelope({
      batchFrameId: "frame-2",
      correlationId: "corr-2",
      totalItems: 5,
      errors: [
        makeCell("a", "transport", true),
        makeCell("b", "schema", true),
        makeCell("c", "toolchain", false), // bare erasure
      ],
    });
    expect(env.summary.totalItems).toBe(5);
    expect(env.summary.failedItems).toBe(3);
    expect(env.summary.succeededItems).toBe(2);
    expect(env.summary.teachingErrors).toBe(2);
    expect(env.summary.bareErasures).toBe(1);
  });

  // BTE-4: teaching ratio is correct
  test("BTE-4: teaching ratio is correct", () => {
    const env = makeBatchEnvelope({
      batchFrameId: "frame-3",
      correlationId: "corr-3",
      totalItems: 4,
      errors: [
        makeCell("a", "transport", true),
        makeCell("b", "transport", false),
        makeCell("c", "transport", false),
        makeCell("d", "transport", false),
      ],
    });
    expect(env.summary.teachingRatio).toBeCloseTo(0.25, 5);
  });

  // BTE-5 (negative): all-erasure batch has teachingRatio=0
  test("BTE-5 (negative): all-erasure batch has teachingRatio=0", () => {
    const env = makeBatchEnvelope({
      batchFrameId: "frame-4",
      correlationId: "corr-4",
      totalItems: 3,
      errors: [
        makeCell("a", "unknown", false),
        makeCell("b", "unknown", false),
        makeCell("c", "unknown", false),
      ],
    });
    expect(env.summary.teachingRatio).toBe(0);
    expect(env.summary.bareErasures).toBe(3);
    expect(env.summary.teachingErrors).toBe(0);
  });

  // BTE-6: dominant dimension is the most common
  test("BTE-6: dominant dimension is the most common", () => {
    const env = makeBatchEnvelope({
      batchFrameId: "frame-5",
      correlationId: "corr-5",
      totalItems: 5,
      errors: [
        makeCell("a", "transport", true),
        makeCell("b", "transport", true),
        makeCell("c", "transport", true),
        makeCell("d", "schema", false),
        makeCell("e", "schema", false),
      ],
    });
    expect(env.summary.dominantDimension).toBe("transport");
  });

  // BTE-7: toFourCornerTensor returns correct shape
  test("BTE-7: toFourCornerTensor returns correct shape", () => {
    const env = makeBatchEnvelope({
      batchFrameId: "frame-6",
      correlationId: "corr-6",
      totalItems: 2,
      errors: [
        makeCell("a", "transport", true),
        makeCell("b", "schema", false),
      ],
    });
    const tensor = toFourCornerTensor(env);
    expect(tensor).toHaveLength(2);
    // Row 0: teaching transport error
    expect(tensor[0]![0]).toBe("belief:a"); // retractableBeliefId
    expect(tensor[0]![1]).toBe("retry:a");  // generatorFn
    expect(tensor[0]![2]).toBe("transport"); // dimension
    expect(tensor[0]![3]).toBe("error");    // severity
    // Row 1: bare erasure schema error
    expect(tensor[1]![0]).toBeUndefined();  // no retractableBeliefId
    expect(tensor[1]![2]).toBe("schema");
  });

  // BTE-8: teachingOnly filters out bare erasures
  test("BTE-8: teachingOnly filters out bare erasures", () => {
    const env = makeBatchEnvelope({
      batchFrameId: "frame-7",
      correlationId: "corr-7",
      totalItems: 4,
      errors: [
        makeCell("a", "transport", true),
        makeCell("b", "schema", false), // erasure
        makeCell("c", "toolchain", true),
        makeCell("d", "unknown", false), // erasure
      ],
    });
    const teaching = teachingOnly(env);
    expect(teaching.errors).toHaveLength(2);
    expect(teaching.errors.every(e => e.isTeaching)).toBe(true);
    expect(teaching.summary.bareErasures).toBe(0);
  });

  // BTE-9: groupByDimension correctly partitions cells
  test("BTE-9: groupByDimension correctly partitions cells", () => {
    const env = makeBatchEnvelope({
      batchFrameId: "frame-8",
      correlationId: "corr-8",
      totalItems: 5,
      errors: [
        makeCell("a", "transport", true),
        makeCell("b", "transport", false),
        makeCell("c", "schema", true),
        makeCell("d", "toolchain", false),
        makeCell("e", "schema", true),
      ],
    });
    const groups = groupByDimension(env);
    expect(groups.get("transport")!.length).toBe(2);
    expect(groups.get("schema")!.length).toBe(2);
    expect(groups.get("toolchain")!.length).toBe(1);
    expect(groups.has("unknown")).toBe(false);
  });

  // BTE-10: erasureHeat is 0 for all-teaching batch
  test("BTE-10: erasureHeat is 0 for all-teaching batch", () => {
    const env = makeBatchEnvelope({
      batchFrameId: "frame-9",
      correlationId: "corr-9",
      totalItems: 3,
      errors: [
        makeCell("a", "transport", true),
        makeCell("b", "schema", true),
        makeCell("c", "toolchain", true),
      ],
    });
    expect(erasureHeat(env)).toBe(0);
  });

  // BTE-11: erasureHeat is 1 for all-erasure batch
  test("BTE-11: erasureHeat is 1 for all-erasure batch", () => {
    const env = makeBatchEnvelope({
      batchFrameId: "frame-10",
      correlationId: "corr-10",
      totalItems: 3,
      errors: [
        makeCell("a", "unknown", false),
        makeCell("b", "unknown", false),
        makeCell("c", "unknown", false),
      ],
    });
    expect(erasureHeat(env)).toBe(1);
  });

  // BTE-12: envelopeId is stable (same inputs → same id)
  test("BTE-12: envelopeId is stable (same inputs → same id)", () => {
    const spec = {
      batchFrameId: "frame-stable",
      correlationId: "corr-stable",
      totalItems: 2,
      errors: [makeCell("x", "transport", true)],
    };
    const env1 = makeBatchEnvelope(spec);
    const env2 = makeBatchEnvelope(spec);
    expect(env1.envelopeId).toBe(env2.envelopeId);
  });

  // BTE-13: empty batch has teachingRatio=1 (vacuously all teaching)
  test("BTE-13: empty batch has teachingRatio=1 (vacuously all teaching)", () => {
    const env = makeBatchEnvelope({
      batchFrameId: "frame-empty",
      correlationId: "corr-empty",
      totalItems: 5,
      errors: [],
    });
    expect(env.summary.teachingRatio).toBe(1);
    expect(env.summary.failedItems).toBe(0);
    expect(env.summary.succeededItems).toBe(5);
    expect(erasureHeat(env)).toBe(0);
  });

  // BTE-14: title reflects teaching/erasure counts
  test("BTE-14: title reflects teaching/erasure counts", () => {
    const env = makeBatchEnvelope({
      batchFrameId: "frame-title",
      correlationId: "corr-title",
      totalItems: 4,
      errors: [
        makeCell("a", "transport", true),
        makeCell("b", "schema", false),
      ],
    });
    expect(env.title).toContain("2 teaching error");
    expect(env.title).toContain("1 teaching");
    expect(env.title).toContain("1 erasure");
  });

});

  // BTE-15: envelope carries prior hints when provided
  test("BTE-15: envelope carries prior hints when provided", () => {
    const hint: PriorHint = {
      dimension: "transport",
      mu: 0.3,
      sigma2: 0.1,
      robustnessWeight: 0.9,
      obsCount: 5,
      senderZid: "agent-alice",
    };
    const env = makeBatchEnvelope({
      batchFrameId: "frame-prior",
      correlationId: "corr-prior",
      totalItems: 2,
      errors: [makeCell("a", "transport", true)],
      priorHints: [hint],
    });
    expect(env.priorHints).toHaveLength(1);
    expect(env.priorHints![0]!.mu).toBe(0.3);
    expect(env.summary.hasPriorHints).toBe(true);
  });

  // BTE-16: envelope without prior hints has hasPriorHints=false
  test("BTE-16: envelope without prior hints has hasPriorHints=false", () => {
    const env = makeBatchEnvelope({
      batchFrameId: "frame-no-prior",
      correlationId: "corr-no-prior",
      totalItems: 1,
      errors: [makeCell("a", "transport", true)],
    });
    expect(env.summary.hasPriorHints).toBe(false);
    expect(env.priorHints).toHaveLength(0);
  });

  // BTE-17: mergePriorHint is commutative (A+B = B+A in joint posterior)
  test("BTE-17: mergePriorHint is commutative (A+B = B+A)", () => {
    const localA = { mu: 0.5, sigma2: 0.2 };
    const hintB: PriorHint = { dimension: "transport", mu: 0.3, sigma2: 0.1, robustnessWeight: 1.0, obsCount: 5 };
    const localB = { mu: 0.3, sigma2: 0.1 };
    const hintA: PriorHint = { dimension: "transport", mu: 0.5, sigma2: 0.2, robustnessWeight: 1.0, obsCount: 3 };
    // A merges B's hint
    const jointAB = mergePriorHint(localA, hintB);
    // B merges A's hint
    const jointBA = mergePriorHint(localB, hintA);
    // Both should converge to the same joint posterior (commutativity)
    expect(jointAB.mu).toBeCloseTo(jointBA.mu, 5);
    expect(jointAB.sigma2).toBeCloseTo(jointBA.sigma2, 5);
  });

  // BTE-18: mergePriorHint with trustWeight=0 leaves local posterior unchanged
  test("BTE-18: mergePriorHint with trustWeight=0 leaves local posterior unchanged", () => {
    const local = { mu: 0.5, sigma2: 0.2 };
    const hint: PriorHint = { dimension: "transport", mu: 0.9, sigma2: 0.05, robustnessWeight: 1.0, obsCount: 100 };
    const joint = mergePriorHint(local, hint, 0);
    // trustWeight=0 means the hint has zero precision → joint = local
    expect(joint.mu).toBeCloseTo(local.mu, 5);
    expect(joint.sigma2).toBeCloseTo(local.sigma2, 5);
  });

  // BTE-19: accountedHeat vs unaccountedHeat — deliberate erasures are not alarming
  test("BTE-19: accountedHeat vs unaccountedHeat — deliberate erasures are not alarming", () => {
    const env = makeBatchEnvelope({
      batchFrameId: "frame-heat",
      correlationId: "corr-heat",
      totalItems: 5,
      errors: [
        makeBatchItemCell({ itemId: "a", generatorFn: "retry", dimension: "transport", severity: "error", reason: "timeout", what: "a" }), // bare erasure, unaccounted
        makeBatchItemCell({ itemId: "b", generatorFn: "retry", dimension: "transport", severity: "error", reason: "timeout", what: "b", accountedReason: "bounded-forget: TTL expired" }), // accounted
        makeBatchItemCell({ itemId: "c", retractableBeliefId: "belief:c", generatorFn: "retry", dimension: "schema", severity: "error", reason: "invalid", what: "c" }), // teaching
      ],
    });
    expect(env.summary.bareErasures).toBe(2);
    expect(env.summary.accountedHeat).toBe(1);   // b has accountedReason
    expect(env.summary.unaccountedHeat).toBe(1); // a has no accountedReason — the alarm
    expect(env.summary.teachingErrors).toBe(1);  // c is teaching
    // The alarm fires on unaccountedHeat, not totalHeat
    const alarm = env.summary.unaccountedHeat > 0;
    expect(alarm).toBe(true);
  });
