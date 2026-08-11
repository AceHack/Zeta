/**
 * connectivity-metric.test.ts — per-agent connectivity from attestation events.
 */

import { describe, test, expect } from "bun:test";
import { computeConnectivity } from "./connectivity-metric";
import type { ObserveEvent } from "./vault-state-bridge";

const NOW = new Date("2026-08-10T12:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;

function attest(by: string, about: string, hoursAgo: number): ObserveEvent {
  return {
    id: `${by}-${about}-${hoursAgo}`,
    at: new Date(NOW - hoursAgo * HOUR).toISOString(),
    by,
    action: { kind: "attest_peer", reason: `attesting ${about} heartbeat` },
  };
}

const agents = ["alexa", "otto", "soraya"] as const;

describe("computeConnectivity", () => {
  test("empty events: all zeros", () => {
    const result = computeConnectivity([], { agents, nowMs: NOW });
    expect(result.length).toBe(3);
    expect(result.every((r) => r.connectivity === 0)).toBe(true);
    expect(result.every((r) => r.reciprocity === 0)).toBe(true);
  });

  test("full mutual attestation: connectivity = 1.0", () => {
    const events: ObserveEvent[] = [
      attest("alexa", "otto", 1),
      attest("alexa", "soraya", 1),
      attest("otto", "alexa", 2),
      attest("otto", "soraya", 2),
      attest("soraya", "alexa", 3),
      attest("soraya", "otto", 3),
    ];
    const result = computeConnectivity(events, { agents, nowMs: NOW });
    // Each agent attested by 2 peers out of 2 possible = 1.0
    expect(result.every((r) => r.connectivity === 1.0)).toBe(true);
    // Each gives 2, receives 2 → reciprocity = 1.0
    expect(result.every((r) => r.reciprocity === 1.0)).toBe(true);
  });

  test("one-way attestation: connectivity varies, reciprocity < 1", () => {
    const events: ObserveEvent[] = [
      attest("alexa", "otto", 1),
      attest("alexa", "soraya", 1),
      // otto and soraya don't attest anyone
    ];
    const result = computeConnectivity(events, { agents, nowMs: NOW });
    const alexa = result.find((r) => r.agent_id === "alexa")!;
    const otto = result.find((r) => r.agent_id === "otto")!;

    // alexa: gives 2, receives 0 → reciprocity = 0
    expect(alexa.attestations_given).toBe(2);
    expect(alexa.attestations_received).toBe(0);
    expect(alexa.reciprocity).toBe(0);

    // otto: receives 1 (from alexa), gives 0
    expect(otto.attestations_received).toBe(1);
    expect(otto.attested_by_count).toBe(1);
    expect(otto.connectivity).toBe(0.5); // 1 of 2 peers
  });

  test("events outside window are excluded", () => {
    const events: ObserveEvent[] = [
      attest("alexa", "otto", 200), // 200 hours ago > 7 days
    ];
    const result = computeConnectivity(events, { agents, nowMs: NOW });
    const otto = result.find((r) => r.agent_id === "otto")!;
    expect(otto.attestations_received).toBe(0);
  });

  test("custom window size", () => {
    const events: ObserveEvent[] = [
      attest("alexa", "otto", 25), // 25 hours ago
    ];
    // 24-hour window excludes the event
    const result24h = computeConnectivity(events, { agents, nowMs: NOW, windowMs: 24 * HOUR });
    expect(result24h.find((r) => r.agent_id === "otto")!.attestations_received).toBe(0);

    // 48-hour window includes it
    const result48h = computeConnectivity(events, { agents, nowMs: NOW, windowMs: 48 * HOUR });
    expect(result48h.find((r) => r.agent_id === "otto")!.attestations_received).toBe(1);
  });

  test("self-attestation is ignored", () => {
    const events: ObserveEvent[] = [
      { id: "self", at: new Date(NOW - HOUR).toISOString(), by: "alexa", action: { kind: "attest_peer", reason: "attesting alexa" } },
    ];
    const result = computeConnectivity(events, { agents, nowMs: NOW });
    const alexa = result.find((r) => r.agent_id === "alexa")!;
    expect(alexa.attestations_received).toBe(0);
    expect(alexa.attestations_given).toBe(0);
  });

  test("multiple attestations from same peer count toward total but not distinct", () => {
    const events: ObserveEvent[] = [
      attest("otto", "alexa", 1),
      attest("otto", "alexa", 2),
      attest("otto", "alexa", 3),
    ];
    const result = computeConnectivity(events, { agents, nowMs: NOW });
    const alexa = result.find((r) => r.agent_id === "alexa")!;
    expect(alexa.attested_by_count).toBe(1); // still just otto
    expect(alexa.attestations_received).toBe(3); // but 3 events
    expect(alexa.connectivity).toBe(0.5); // 1 of 2 possible peers
  });

  test("no subject IDs leak into output", () => {
    const events: ObserveEvent[] = [
      attest("alexa", "otto", 1),
      attest("otto", "alexa", 2),
    ];
    const result = computeConnectivity(events, { agents, nowMs: NOW });
    const serialized = JSON.stringify(result);
    // The output contains agent_id (that's the point) but no raw event IDs or reasons
    expect(serialized).not.toContain("heartbeat");
    expect(serialized).not.toContain("attesting");
  });

  test("PURE: same inputs same output", () => {
    const events: ObserveEvent[] = [attest("alexa", "otto", 1)];
    const a = computeConnectivity(events, { agents, nowMs: NOW });
    const b = computeConnectivity(events, { agents, nowMs: NOW });
    expect(a).toEqual(b);
  });
});
