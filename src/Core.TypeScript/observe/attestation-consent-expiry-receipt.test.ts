// attestation-consent-expiry-receipt.test.ts — test-only window observation, never consent or authority.
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { attestedEventsDigest, deriveAttestationId, type AttestationRecord } from "./attestation-record.ts";
import {
  evaluateConsentExpiry,
  receiptHasForbiddenAuthorityFields,
  renderCanonicalConsentExpiryReceipt,
  verifyCanonicalConsentExpiryReceipt,
  type ConsentExpiryInput,
} from "./attestation-consent-expiry-receipt.ts";

const record: AttestationRecord = {
  id: deriveAttestationId("otto", "alexa", "2026-09-07T12:00:00.000Z"),
  at: "2026-09-07T12:01:00.000Z",
  by: "otto",
  kind: "attestation",
  attestation: {
    attestor: "otto",
    attested: "alexa",
    claim: "heartbeat-genuine",
    windowStart: "2026-09-07T11:00:00.000Z",
    windowEnd: "2026-09-07T12:00:00.000Z",
    eventCount: 1,
    attestedDigest: attestedEventsDigest(["a0000000000000000000000000000001"]),
    strength: 1,
  },
};

const rawRecordUtf8 = JSON.stringify(record);
const recordHash = `sha256:${createHash("sha256").update(rawRecordUtf8, "utf8").digest("hex")}`;

function testInput(evaluationInstant: string): ConsentExpiryInput {
  return {
    rawRecordUtf8,
    attestationRecordSha256: recordHash,
    scopeId: "attestation-window-observation",
    evaluationInstant,
    evaluationMode: "local-status-only",
    roster: new Map(),
    testOnlyBinding: { status: "bound", signer: "test-only", signerSource: "test-only fixture" },
  };
}

function fixtureInput(): ConsentExpiryInput {
  const rawRecordUtf8 = readFileSync("tests/fixtures/attestation-consent-expiry-test-only-record.json", "utf8");
  return {
    rawRecordUtf8,
    attestationRecordSha256: `sha256:${createHash("sha256").update(rawRecordUtf8, "utf8").digest("hex")}`,
    scopeId: "attestation-window-observation",
    evaluationInstant: "2026-09-07T11:30:00.000Z",
    evaluationMode: "local-status-only",
    roster: new Map(),
    testOnlyBinding: { status: "bound", signer: "test-only", signerSource: "test-only fixture" },
  };
}

describe("finite attestation consent-and-expiry receipt", () => {
  test("reports only a test-only bound subject window", () => {
    const result = evaluateConsentExpiry(testInput("2026-09-07T11:30:00.000Z"));
    expect(result).toMatchObject({ kind: "receipt", receipt: { status: "within-declared-window" } });
    if (result.kind !== "receipt") throw new Error("expected receipt");
    const canonical = renderCanonicalConsentExpiryReceipt(result.receipt);
    expect(canonical.endsWith("\n")).toBe(true);
    expect(receiptHasForbiddenAuthorityFields(canonical)).toBe(false);
  });

  test("reports before and after as distinct local statuses", () => {
    expect(evaluateConsentExpiry(testInput("2026-09-07T10:59:59.000Z"))).toMatchObject({
      kind: "receipt",
      receipt: { status: "not-yet-declared-window" },
    });
    expect(evaluateConsentExpiry(testInput("2026-09-07T12:00:01.000Z"))).toMatchObject({
      kind: "receipt",
      receipt: { status: "expired-declared-window" },
    });
  });

  test("defers rather than affirming an unbound record", () => {
    const { testOnlyBinding: _testOnlyBinding, ...unbound } = testInput("2026-09-07T11:30:00.000Z");
    expect(evaluateConsentExpiry(unbound)).toEqual({ kind: "defer", reason: "provenance-not-bound" });
  });

  test("refuses a changed raw record, unsupported scope, and non-local evaluation mode", () => {
    expect(
      evaluateConsentExpiry({ ...testInput("2026-09-07T11:30:00.000Z"), rawRecordUtf8: `${rawRecordUtf8} ` }),
    ).toEqual({
      kind: "refuse",
      reason: "identity-mismatch",
    });
    expect(evaluateConsentExpiry({ ...testInput("2026-09-07T11:30:00.000Z"), scopeId: "authority-grant" })).toEqual({
      kind: "refuse",
      reason: "unsupported-scope",
    });
    expect(evaluateConsentExpiry({ ...testInput("2026-09-07T11:30:00.000Z"), evaluationMode: "shared-fold" })).toEqual({
      kind: "refuse",
      reason: "unsupported-evaluation-mode",
    });
  });

  test("both committed cross-language receipts reproduce only the test-only local observation", () => {
    const typescript = readFileSync(
      "docs/research/data/2026-09-07-attestation-consent-expiry-v1-typescript.json",
      "utf8",
    );
    const python = readFileSync("docs/research/data/2026-09-07-attestation-consent-expiry-v1-python.json", "utf8");
    expect(typescript).toBe(python);
    const input = fixtureInput();
    expect(verifyCanonicalConsentExpiryReceipt(input, typescript)).toBe(true);
    expect(receiptHasForbiddenAuthorityFields(typescript)).toBe(false);
  });

  test("a reordered receipt or added authority field is refused", () => {
    const input = fixtureInput();
    const canonical = readFileSync(
      "docs/research/data/2026-09-07-attestation-consent-expiry-v1-typescript.json",
      "utf8",
    );
    const parsed = JSON.parse(canonical) as Record<string, unknown>;
    const reordered = { status: parsed.status, ...parsed };
    expect(verifyCanonicalConsentExpiryReceipt(input, `${JSON.stringify(reordered)}\n`)).toBe(false);
    const authority = { ...parsed, authority: "forbidden" };
    expect(verifyCanonicalConsentExpiryReceipt(input, `${JSON.stringify(authority)}\n`)).toBe(false);
  });
});
