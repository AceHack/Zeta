/**
 * trust-oauth-export.test.ts — OAuth export of local trust verdicts (slice 4).
 *
 * Tests:
 * 1. Export produces well-formed token payloads
 * 2. Validation accepts fresh tokens, rejects expired/future/wrong-audience
 * 3. Every signal kind maps to a claim
 * 4. No global issuer — any node can export
 * 5. Phase-based expiry (not wall-clock)
 * 6. Round-trip: export → validate succeeds for fresh tokens
 */

import { describe, test, expect } from "bun:test";
import {
  exportVerdict,
  validatePayload,
  exportAndValidate,
} from "./trust-oauth-export";
import type { TrustVerdict } from "./local-trust-view";
import type { ExportConfig } from "./trust-oauth-export";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const verdictWithEvidence: TrustVerdict = {
  subject: "alice-fingerprint-abc123",
  signals: [
    { kind: "shared-anchor", depth: 5, atPhase: 100 },
    { kind: "chain-verified", span: 5, links: 4 },
  ],
};

const verdictNoEvidence: TrustVerdict = {
  subject: "unknown-entity",
  signals: [{ kind: "no-evidence" }],
};

const verdictBrokenChain: TrustVerdict = {
  subject: "mallory-key-xyz",
  signals: [
    { kind: "shared-anchor", depth: 10, atPhase: 50 },
    { kind: "chain-broken", reason: "seed-mismatch", atIndex: 3 },
  ],
};

const config: ExportConfig = {
  issuerId: "node-otto-pubkey-def456",
  currentPhase: 200,
  lifetimePhases: 100,
  audience: "settlement-page",
};

// ─── Export Tests ────────────────────────────────────────────────────────────

describe("exportVerdict", () => {
  test("produces a well-formed token payload", () => {
    const token = exportVerdict(verdictWithEvidence, config);
    expect(token.iss).toBe("node-otto-pubkey-def456");
    expect(token.sub).toBe("alice-fingerprint-abc123");
    expect(token.aud).toBe("settlement-page");
    expect(token.iat).toBe(200);
    expect(token.exp).toBe(300); // 200 + 100
    expect(token.scope).toBe("trust:read");
    expect(token.claims.length).toBe(2);
    expect(token.evidence_depth).toBe(2);
  });

  test("no-evidence verdict exports with depth 0", () => {
    const token = exportVerdict(verdictNoEvidence, config);
    expect(token.evidence_depth).toBe(0);
    expect(token.claims[0]!.kind).toBe("no-evidence");
    expect(token.claims[0]!.value).toBe(0);
  });

  test("chain-broken signal maps correctly", () => {
    const token = exportVerdict(verdictBrokenChain, config);
    const brokenClaim = token.claims.find((c) => c.kind === "chain-broken");
    expect(brokenClaim).toBeDefined();
    expect(brokenClaim!.value).toBe(3); // atIndex
    expect(brokenClaim!.detail).toBe("seed-mismatch");
  });

  test("shared-anchor signal includes phase in detail", () => {
    const token = exportVerdict(verdictWithEvidence, config);
    const anchorClaim = token.claims.find((c) => c.kind === "shared-anchor");
    expect(anchorClaim!.value).toBe(5); // depth
    expect(anchorClaim!.detail).toBe("phase:100");
  });

  test("chain-verified signal includes link count", () => {
    const token = exportVerdict(verdictWithEvidence, config);
    const chainClaim = token.claims.find((c) => c.kind === "chain-verified");
    expect(chainClaim!.value).toBe(5); // span
    expect(chainClaim!.detail).toBe("links:4");
  });

  test("default lifetime is 100 phases", () => {
    const shortConfig: ExportConfig = {
      issuerId: "node-a",
      currentPhase: 50,
      audience: "test",
    };
    const token = exportVerdict(verdictWithEvidence, shortConfig);
    expect(token.exp).toBe(150); // 50 + 100 default
  });

  test("any node can be an issuer (no privileged issuer)", () => {
    const nodeA = exportVerdict(verdictWithEvidence, { ...config, issuerId: "node-A" });
    const nodeB = exportVerdict(verdictWithEvidence, { ...config, issuerId: "node-B" });
    // Same verdict, different issuers — both are valid exports
    expect(nodeA.iss).toBe("node-A");
    expect(nodeB.iss).toBe("node-B");
    expect(nodeA.claims).toEqual(nodeB.claims);
  });

  test("PURE: same inputs same output", () => {
    const a = exportVerdict(verdictWithEvidence, config);
    const b = exportVerdict(verdictWithEvidence, config);
    expect(a).toEqual(b);
  });
});

// ─── Validation Tests ────────────────────────────────────────────────────────

describe("validatePayload", () => {
  test("accepts a fresh token", () => {
    const token = exportVerdict(verdictWithEvidence, config);
    const result = validatePayload(token, 200, "settlement-page");
    expect(result.valid).toBe(true);
  });

  test("accepts token at any phase before expiry", () => {
    const token = exportVerdict(verdictWithEvidence, config);
    const result = validatePayload(token, 299, "settlement-page");
    expect(result.valid).toBe(true);
  });

  test("rejects expired token (phase >= exp)", () => {
    const token = exportVerdict(verdictWithEvidence, config);
    const result = validatePayload(token, 300, "settlement-page");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("expired");
  });

  test("rejects token issued in the future", () => {
    const token = exportVerdict(verdictWithEvidence, config);
    const result = validatePayload(token, 199, "settlement-page");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("future");
  });

  test("rejects wrong audience", () => {
    const token = exportVerdict(verdictWithEvidence, config);
    const result = validatePayload(token, 200, "other-service");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("audience");
  });

  test("rejects token with wrong scope", () => {
    const token = { ...exportVerdict(verdictWithEvidence, config), scope: "admin:write" as any };
    const result = validatePayload(token, 200, "settlement-page");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("scope");
  });
});

// ─── Round-Trip ──────────────────────────────────────────────────────────────

describe("exportAndValidate round-trip", () => {
  test("fresh export validates immediately", () => {
    const result = exportAndValidate(verdictWithEvidence, config);
    expect(result.valid).toBe(true);
  });

  test("no-evidence verdict still exports and validates", () => {
    const result = exportAndValidate(verdictNoEvidence, config);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.evidence_depth).toBe(0);
    }
  });
});

// ─── Design Invariants ───────────────────────────────────────────────────────

describe("design invariants", () => {
  test("no global state: export is a pure function of (verdict, config)", () => {
    // Calling export twice with same args gives same result
    const a = exportVerdict(verdictWithEvidence, config);
    const b = exportVerdict(verdictWithEvidence, config);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("expiry is phase-based, not wall-clock", () => {
    const token = exportVerdict(verdictWithEvidence, config);
    // exp and iat are numbers (phases), not ISO strings
    expect(typeof token.iat).toBe("number");
    expect(typeof token.exp).toBe("number");
    // No wallClockAt or Date anywhere in the token
    expect(JSON.stringify(token)).not.toContain("wallClockAt");
    expect(JSON.stringify(token)).not.toContain("T00:");
  });

  test("token carries no private data from the neighbourhood", () => {
    const token = exportVerdict(verdictWithEvidence, config);
    const serialized = JSON.stringify(token);
    // No mention of other subjects, no fingerprint data, no histogram
    expect(serialized).not.toContain("histogram");
    expect(serialized).not.toContain("neighbourhood");
    expect(serialized).not.toContain("recencyBin");
  });
});
