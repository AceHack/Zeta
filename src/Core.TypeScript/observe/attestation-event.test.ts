import { describe, test, expect } from "bun:test";
import {
  pairwiseStrength,
  simultaneousStrength,
  buildAttestation,
  summarizeAttestations,
} from "./attestation-event";

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
    });
    expect(a.attestor).toBe("otto");
    expect(a.attested).toBe("alexa");
    expect(a.strength).toBe(1);
    expect(a.claim).toBe("heartbeat-genuine");
    expect(a.simultaneousParticipants).toBeUndefined();
  });

  test("trio: strength > 1, simultaneousParticipants present", () => {
    const a = buildAttestation({
      attestor: "otto",
      attested: "alexa",
      eventCount: 4,
      windowStart: "2026-07-08T22:00:00Z",
      windowEnd: "2026-07-08T23:00:00Z",
      simultaneousParticipants: ["soraya"], // +1 = trio (3 total)
    });
    expect(a.strength).toBeGreaterThan(1);
    expect(a.simultaneousParticipants).toEqual(["soraya"]);
  });
});

describe("summarizeAttestations", () => {
  const now = "2026-07-08T23:00:00Z";

  const attestations = [
    buildAttestation({ attestor: "otto", attested: "alexa", eventCount: 4, windowStart: "2026-07-08T22:00:00Z", windowEnd: "2026-07-08T23:00:00Z" }),
    buildAttestation({ attestor: "soraya", attested: "alexa", eventCount: 4, windowStart: "2026-07-08T21:00:00Z", windowEnd: "2026-07-08T22:00:00Z" }),
    buildAttestation({ attestor: "alexa", attested: "otto", eventCount: 3, windowStart: "2026-07-08T22:00:00Z", windowEnd: "2026-07-08T23:00:00Z" }),
    buildAttestation({
      attestor: "otto",
      attested: "alexa",
      eventCount: 4,
      windowStart: "2026-07-07T20:00:00Z", // older than 24h
      windowEnd: "2026-07-07T21:00:00Z",
    }),
  ];

  test("counts received attestations for the agent", () => {
    const summary = summarizeAttestations("alexa", attestations, now);
    expect(summary.totalAttestations).toBe(3); // 2 from otto + 1 from soraya
  });

  test("counts distinct attestors", () => {
    const summary = summarizeAttestations("alexa", attestations, now);
    expect(summary.distinctAttestors).toBe(2); // otto + soraya
  });

  test("recent24h excludes old attestations", () => {
    const summary = summarizeAttestations("alexa", attestations, now);
    expect(summary.recent24h).toBe(2); // only the two within 24h
  });

  test("totalStrength sums attestation strengths", () => {
    const summary = summarizeAttestations("alexa", attestations, now);
    expect(summary.totalStrength).toBe(3); // 3 × strength(1)
  });

  test("hasTrioAttestation is false when no trio", () => {
    const summary = summarizeAttestations("alexa", attestations, now);
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
        simultaneousParticipants: ["soraya"], // trio
      }),
    ];
    const summary = summarizeAttestations("alexa", trioAttestations, now);
    expect(summary.hasTrioAttestation).toBe(true);
  });
});
