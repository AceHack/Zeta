import { describe, test, expect } from "bun:test";
import {
  pairwiseStrength,
  simultaneousStrength,
  buildAttestation,
  summarizeAttestations,
  type AttestationEvent,
  type AttestedRecord,
} from "./attestation-event";
import { attestedEventsDigest } from "./attestation-record";

/**
 * A real digest over a real id set. Not a literal: `buildAttestation` refuses a
 * malformed digest, and a test that hand-writes 64 hex characters would be pinning
 * the regex rather than the producer.
 */
const DIGEST = attestedEventsDigest(["aa00000000000000000000000000000f", "bb00000000000000000000000000000f"]);

/**
 * Pair an attestation with a binding verdict for the fold.
 *
 * `bound` is the default HERE and only here, because these tests are about the
 * strength arithmetic rather than about attribution. The attribution tests live in
 * `attestation-record.test.ts`, and the "unbound records are not folded" test is
 * below — it is the one that would have caught the defect this signature change
 * exists for.
 */
const rec = (attestation: AttestationEvent, binding: AttestedRecord["binding"] = "bound"): AttestedRecord => ({
  attestation,
  binding,
});

describe("attestation strength", () => {
  test("pairwise = 1", () => {
    expect(pairwiseStrength()).toBe(1);
  });

  test("N=2 = 1 (no simultaneity bonus)", () => {
    expect(simultaneousStrength(2)).toBe(1);
  });

  test("N=3 trio bonus ≈ 1.58", () => {
    expect(simultaneousStrength(3)).toBeCloseTo(1 + (Math.log2(3) - 1), 10);
    expect(simultaneousStrength(3)).toBeGreaterThan(1);
  });

  test("N=4 = 2 (log2(4) - 1 = 1, total = 2)", () => {
    expect(simultaneousStrength(4)).toBe(2);
  });

  test("strength is monotone in N (more participants = stronger)", () => {
    const s2 = simultaneousStrength(2);
    const s3 = simultaneousStrength(3);
    const s4 = simultaneousStrength(4);
    const s8 = simultaneousStrength(8);
    expect(s3).toBeGreaterThan(s2);
    expect(s4).toBeGreaterThan(s3);
    expect(s8).toBeGreaterThan(s4);
  });

  test("strength has diminishing returns (log scaling)", () => {
    const gain23 = simultaneousStrength(3) - simultaneousStrength(2);
    const gain34 = simultaneousStrength(4) - simultaneousStrength(3);
    const gain45 = simultaneousStrength(5) - simultaneousStrength(4);
    expect(gain23).toBeGreaterThan(gain34); // diminishing
    expect(gain34).toBeGreaterThan(gain45); // diminishing
  });
});

describe("buildAttestation", () => {
  test("pairwise: strength = 1, no simultaneousParticipants", () => {
    const a = buildAttestation({
      attestor: "otto",
      attested: "alexa",
      eventCount: 4,
      windowStart: "2026-07-08T22:00:00Z",
      windowEnd: "2026-07-08T23:00:00Z",
      attestedDigest: DIGEST,
    });
    expect(a.attestor).toBe("otto");
    expect(a.attested).toBe("alexa");
    expect(a.strength).toBe(1);
    expect(a.claim).toBe("heartbeat-genuine");
    expect(a.attestedDigest).toBe(DIGEST);
    expect(a.simultaneousParticipants).toBeUndefined();
  });

  test("trio: strength > 1, simultaneousParticipants present", () => {
    const a = buildAttestation({
      attestor: "otto",
      attested: "alexa",
      eventCount: 4,
      windowStart: "2026-07-08T22:00:00Z",
      windowEnd: "2026-07-08T23:00:00Z",
      attestedDigest: DIGEST,
      simultaneousParticipants: ["soraya"], // +1 = trio (3 total)
    });
    expect(a.strength).toBeGreaterThan(1);
    expect(a.simultaneousParticipants).toEqual(["soraya"]);
  });
});

describe("summarizeAttestations", () => {
  const now = "2026-07-08T23:00:00Z";

  const attestations = [
    buildAttestation({ attestor: "otto", attested: "alexa", eventCount: 4, windowStart: "2026-07-08T22:00:00Z", windowEnd: "2026-07-08T23:00:00Z", attestedDigest: DIGEST }),
    buildAttestation({ attestor: "soraya", attested: "alexa", eventCount: 4, windowStart: "2026-07-08T21:00:00Z", windowEnd: "2026-07-08T22:00:00Z", attestedDigest: DIGEST }),
    buildAttestation({ attestor: "alexa", attested: "otto", eventCount: 3, windowStart: "2026-07-08T22:00:00Z", windowEnd: "2026-07-08T23:00:00Z", attestedDigest: DIGEST }),
    buildAttestation({
      attestor: "otto",
      attested: "alexa",
      eventCount: 4,
      windowStart: "2026-07-07T20:00:00Z", // older than 24h
      windowEnd: "2026-07-07T21:00:00Z",
      attestedDigest: DIGEST,
    }),
  ];

  test("counts received attestations for the agent", () => {
    const summary = summarizeAttestations("alexa", attestations.map((a) => rec(a)), now);
    expect(summary.totalAttestations).toBe(3); // 2 from otto + 1 from soraya
  });

  test("counts distinct attestors", () => {
    const summary = summarizeAttestations("alexa", attestations.map((a) => rec(a)), now);
    expect(summary.distinctAttestors).toBe(2); // otto + soraya
  });

  test("recent24h excludes old attestations", () => {
    const summary = summarizeAttestations("alexa", attestations.map((a) => rec(a)), now);
    expect(summary.recent24h).toBe(2); // only the two within 24h
  });

  test("totalStrength sums attestation strengths", () => {
    const summary = summarizeAttestations("alexa", attestations.map((a) => rec(a)), now);
    expect(summary.totalStrength).toBe(3); // 3 × strength(1)
  });

  test("hasTrioAttestation is false when no trio", () => {
    const summary = summarizeAttestations("alexa", attestations.map((a) => rec(a)), now);
    expect(summary.hasTrioAttestation).toBe(false);
  });

  test("hasTrioAttestation is true when trio present", () => {
    const trioAttestations = [
      ...attestations,
      buildAttestation({
        attestor: "otto",
        attested: "alexa",
        eventCount: 4,
        windowStart: "2026-07-08T22:00:00Z",
        windowEnd: "2026-07-08T23:00:00Z",
        attestedDigest: DIGEST,
        simultaneousParticipants: ["soraya"], // trio
      }),
    ];
    const summary = summarizeAttestations("alexa", trioAttestations.map((a) => rec(a)), now);
    expect(summary.hasTrioAttestation).toBe(true);
  });
});

describe("buildAttestation refuses records that could not be evidence", () => {
  const base = {
    attestor: "otto",
    attested: "alexa",
    eventCount: 2,
    windowStart: "2026-07-08T22:00:00Z",
    windowEnd: "2026-07-08T23:00:00Z",
  };

  test("a malformed digest throws rather than shipping unmatchable evidence", () => {
    expect(() => buildAttestation({ ...base, attestedDigest: "sha256:nope" })).toThrow(/sha256:<64 hex>/);
    expect(() => buildAttestation({ ...base, attestedDigest: "" })).toThrow();
    // A bare hex digest with no algorithm prefix is the plausible-looking wrong one.
    expect(() => buildAttestation({ ...base, attestedDigest: "0".repeat(64) })).toThrow();
  });

  test("an attestation over zero events is refused — a count of nothing attests nothing", () => {
    expect(() => buildAttestation({ ...base, eventCount: 0, attestedDigest: DIGEST })).toThrow(/attests nothing/);
  });

  test("self-attestation is refused — strength minted from nothing", () => {
    expect(() => buildAttestation({ ...base, attested: "otto", attestedDigest: DIGEST })).toThrow(/cannot attest itself/);
  });
});

describe("summarizeAttestations folds BOUND records only", () => {
  const now = "2026-07-08T23:00:00Z";
  const from = (attestor: string, participants?: readonly string[]) =>
    buildAttestation({
      attestor,
      attested: "alexa",
      eventCount: 4,
      windowStart: "2026-07-08T22:00:00Z",
      windowEnd: "2026-07-08T23:00:00Z",
      attestedDigest: DIGEST,
      ...(participants !== undefined ? { simultaneousParticipants: participants } : {}),
    });

  /**
   * THE REGRESSION. This is the whole finding, expressed as arithmetic.
   *
   * One actor able to write files into `docs/observe-events/` could pick any
   * persona for `attestor` and mint as many records as it liked. Under the old
   * fold — which took bare `AttestationEvent[]` and had no notion of attribution —
   * every trust field moved: `totalStrength` up, `distinctAttestors` up, and
   * `hasTrioAttestation` flipped to true. Nothing in the record was checked
   * against a key, so nothing could tell the forgery from the fact.
   *
   * Now the forged records are visible in `unboundReceived` and contribute
   * nothing to any number a fold would multiply by.
   */
  test("unbound records move NO trust field — the forgeable-summary defect", () => {
    const forged = [rec(from("otto"), "unbound"), rec(from("soraya"), "unbound"), rec(from("ani", ["otto"]), "unbound")];

    const summary = summarizeAttestations("alexa", forged, now);
    expect(summary.totalAttestations).toBe(0);
    expect(summary.totalStrength).toBe(0);
    expect(summary.distinctAttestors).toBe(0);
    expect(summary.recent24h).toBe(0);
    expect(summary.hasTrioAttestation).toBe(false);

    // Reported, not discarded: "no unbound records" and "we did not look" are
    // different facts and must not print the same sentence.
    expect(summary.unboundReceived).toBe(3);
  });

  test("refused records are counted apart from unbound ones", () => {
    const summary = summarizeAttestations("alexa", [rec(from("otto"), "refused"), rec(from("ani"), "unbound")], now);
    expect(summary.refusedReceived).toBe(1);
    expect(summary.unboundReceived).toBe(1);
    expect(summary.totalAttestations).toBe(0);
  });

  test("a bound record among unbound ones is the only one that counts", () => {
    const summary = summarizeAttestations(
      "alexa",
      [rec(from("otto"), "bound"), rec(from("soraya"), "unbound"), rec(from("ani"), "refused")],
      now,
    );
    expect(summary.totalAttestations).toBe(1);
    expect(summary.totalStrength).toBe(1);
    expect(summary.distinctAttestors).toBe(1);
    expect(summary.unboundReceived).toBe(1);
    expect(summary.refusedReceived).toBe(1);
  });

  test("a trio flag requires a BOUND trio", () => {
    expect(summarizeAttestations("alexa", [rec(from("otto", ["soraya"]), "unbound")], now).hasTrioAttestation).toBe(
      false,
    );
    expect(summarizeAttestations("alexa", [rec(from("otto", ["soraya"]), "bound")], now).hasTrioAttestation).toBe(true);
  });
});
