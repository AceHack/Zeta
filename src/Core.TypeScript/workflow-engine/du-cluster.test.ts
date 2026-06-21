/**
 * src/Core.TypeScript/workflow-engine/du-cluster.test.ts
 *
 * Tests for today's DU cluster TS substrate:
 *   - IntrCtx (081KSNY2Z0008QG0R002HB4AGT) — 5 context-types
 *   - WalletLifetime (081KSNY2Z0008QG0R0036SJ3T1) — 9 variants
 *   - MemoryBinding (081KSNY2Z0008QG0R003518DNC) — 4 variants
 *   - MemoryLifetime (081KSNY2Z0008QG0R0017SRMHG) — 5 variants
 *   - DuClusterCatalog aggregator
 */

import { describe, expect, test } from "bun:test";
import {
  DU_CLUSTER_CATALOG,
  INTR_CTX_KINDS,
  MEMORY_BINDING_KINDS,
  MEMORY_LIFETIME_KINDS,
  WALLET_LIFETIME_KINDS,
  computeDuClusterStats,
  type IntrCtx,
  type MemoryBinding,
  type MemoryLifetime,
  type WalletLifetime,
} from "./du-cluster";

describe("IntrCtx (081KSNY2Z0008QG0R002HB4AGT)", () => {
  test("5 named context-types", () => {
    expect(INTR_CTX_KINDS).toHaveLength(5);
    expect(INTR_CTX_KINDS).toContain("memetic");
    expect(INTR_CTX_KINDS).toContain("prompt");
    expect(INTR_CTX_KINDS).toContain("trust");
    expect(INTR_CTX_KINDS).toContain("log");
    expect(INTR_CTX_KINDS).toContain("otel");
  });

  test("IntrCtx shape has all 5 fields", () => {
    const ctx: IntrCtx = {
      memetic: "tonal-context-placeholder",
      prompt: "operator-direction-placeholder",
      trust: "trust-calculus-placeholder",
      log: "audit-trail-placeholder",
      otel: "activity-context-placeholder",
    };
    expect(Object.keys(ctx)).toHaveLength(5);
  });
});

describe("WalletLifetime (081KSNY2Z0008QG0R0036SJ3T1)", () => {
  test("9 variants per 081KSNY2Z0008QG0R0036SJ3T1 spec", () => {
    expect(WALLET_LIFETIME_KINDS).toHaveLength(9);
  });

  test("exhaustive variant set", () => {
    const variants: WalletLifetime[] = [
      { kind: "uninitialized" },
      { kind: "initialized", walletId: "w1", signingAuthority: "k1", initialBalance: 0 },
      { kind: "transaction-pending", walletId: "w1", transaction: "t1", auditTrail: "a1" },
      {
        kind: "balance-updated",
        walletId: "w1",
        balanceDelta: 100,
        cause: "c1",
        auditTrail: "a1",
      },
      {
        kind: "signing-authority-rotated",
        walletId: "w1",
        oldAuthority: "k1",
        newAuthority: "k2",
        consent: "ce1",
        auditTrail: "a1",
      },
      {
        kind: "trust-context-updated",
        walletId: "w1",
        oldTrust: "t1",
        newTrust: "t2",
        consent: "ce1",
        auditTrail: "a1",
      },
      {
        kind: "counterparty-engaged",
        walletId: "w1",
        counterparty: "cp1",
        engagementTerms: "et1",
        auditTrail: "a1",
      },
      {
        kind: "emergency-frozen",
        walletId: "w1",
        freezeReason: "r1",
        authorizedBy: "ab1",
        auditTrail: "a1",
      },
      { kind: "archived-read-only", walletId: "w1", finalAuditTrail: "fa1" },
    ];
    expect(variants).toHaveLength(9);
    const kindSet = new Set(variants.map((v) => v.kind));
    expect(kindSet.size).toBe(9);
  });

  test("WALLET_LIFETIME_KINDS contains all expected kinds", () => {
    expect(WALLET_LIFETIME_KINDS).toContain("uninitialized");
    expect(WALLET_LIFETIME_KINDS).toContain("archived-read-only");
  });
});

describe("MemoryBinding (081KSNY2Z0008QG0R003518DNC)", () => {
  test("4 variants per 081KSNY2Z0008QG0R003518DNC spec", () => {
    expect(MEMORY_BINDING_KINDS).toHaveLength(4);
  });

  test("exhaustive variant set", () => {
    const variants: MemoryBinding[] = [
      { kind: "personal-only", persona: "otto", taggedOn: "2026-05-28" },
      { kind: "hat-only", hat: "architect", taggedOn: "2026-05-28" },
      {
        kind: "dual-tagged",
        persona: "otto",
        hat: "architect",
        taggedOn: "2026-05-28",
        consent: "ce1",
      },
      {
        kind: "inherited-from-persona",
        fromPersona: "otto",
        toHat: "architect",
        originalMemoryId: "m1",
        transferredOn: "2026-05-28",
      },
    ];
    expect(variants).toHaveLength(4);
  });

  test("MEMORY_BINDING_KINDS contains expected kinds", () => {
    expect(MEMORY_BINDING_KINDS).toContain("personal-only");
    expect(MEMORY_BINDING_KINDS).toContain("dual-tagged");
  });
});

describe("MemoryLifetime (081KSNY2Z0008QG0R0017SRMHG)", () => {
  test("5 variants per 081KSNY2Z0008QG0R0017SRMHG spec", () => {
    expect(MEMORY_LIFETIME_KINDS).toHaveLength(5);
  });

  test("exhaustive variant set", () => {
    const variants: MemoryLifetime[] = ["drafted", "active", "superseded", "archived", "retracted"];
    expect(variants).toHaveLength(5);
    const variantSet = new Set(variants);
    expect(variantSet.size).toBe(5);
  });
});

describe("DU_CLUSTER_CATALOG", () => {
  test("4 entries (081KSNY2Z0008QG0R002HB4AGT + 081KSNY2Z0008QG0R0036SJ3T1 + 081KSNY2Z0008QG0R003518DNC + 081KSNY2Z0008QG0R0017SRMHG)", () => {
    expect(DU_CLUSTER_CATALOG).toHaveLength(4);
    const ids = DU_CLUSTER_CATALOG.map((e) => e.id);
    expect(ids).toContain("081KSNY2Z0008QG0R002HB4AGT");
    expect(ids).toContain("081KSNY2Z0008QG0R0036SJ3T1");
    expect(ids).toContain("081KSNY2Z0008QG0R003518DNC");
    expect(ids).toContain("081KSNY2Z0008QG0R0017SRMHG");
  });

  test("each entry has substrate-anchor + composesWith", () => {
    for (const entry of DU_CLUSTER_CATALOG) {
      expect(entry.substrateAnchor.length).toBeGreaterThan(0);
      expect(entry.composesWith.length).toBeGreaterThan(0);
      expect(entry.variantCount).toBe(entry.variants.length);
    }
  });
});

describe("computeDuClusterStats", () => {
  test("aggregates 4 entries", () => {
    const stats = computeDuClusterStats();
    expect(stats.entryCount).toBe(4);
    expect(stats.entries).toHaveLength(4);
  });

  test("totalVariantCount = 5 + 9 + 4 + 5 = 23", () => {
    const stats = computeDuClusterStats();
    expect(stats.totalVariantCount).toBe(23);
  });
});
