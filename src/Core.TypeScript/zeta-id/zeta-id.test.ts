import { test, expect } from "bun:test";
import { pack, unpack, DETERMINISTIC_ENV } from "./zeta-id";
import type { ZetaObservation } from "./types";

const fixedObservation: ZetaObservation = {
  version: 1,
  timestamp: 1747780809123 as any,
  chromosome: 7,
  category: 0,
  authority: { type: "HumanVerified" },
  persona: 1,
  momentum: { type: "High" },
  location: 1,
};

test("ZetaId round-trips all fields correctly", () => {
  const id = pack(fixedObservation, DETERMINISTIC_ENV);
  const result = unpack(id);

  expect(result.version).toBe(fixedObservation.version);
  expect(result.timestamp).toBe(fixedObservation.timestamp);
  expect(result.chromosome).toBe(fixedObservation.chromosome);
  expect(result.category).toBe(fixedObservation.category);
  expect(result.persona).toBe(fixedObservation.persona);
  expect(result.location).toBe(fixedObservation.location);
  expect(result.authority).toEqual(fixedObservation.authority);
  expect(result.momentum).toEqual(fixedObservation.momentum);
});

// Bit 64 is RESERVED. It held the 1-bit Firefly field until it was reclaimed NO-SHIFT on
// 2026-08-11 (bit 64 freed; NO other field moved). Nothing else pins the newly-reserved bit:
// a round-trip test cannot see it, because a bit no field reads round-trips vacuously. These
// two tests are the only thing standing between a stray write to bit 64 and a silent
// cross-oracle byte-lock break.
test("bit 64 is RESERVED (ex-Firefly): pack NEVER writes it", () => {
  const cases: ZetaObservation[] = [
    fixedObservation,
    { ...fixedObservation, category: 8, chromosome: 0, momentum: { type: "Critical" } },
    { ...fixedObservation, timestamp: 0 as any, chromosome: 0, category: 0, persona: 0 as any, location: 0 as any, authority: { type: "Raw", value: 31 }, momentum: { type: "Raw", value: 255 } },
    { ...fixedObservation, timestamp: ((1n << 48n) - 1n) as any, chromosome: 31 as any, category: 8, persona: 255 as any, location: 255 as any, authority: { type: "Raw", value: 31 }, momentum: { type: "Raw", value: 255 } },
  ];
  for (const obs of cases) {
    const id = pack(obs, DETERMINISTIC_ENV);
    expect((id >> 64n) & 1n).toBe(0n);
  }
});

// NO-SHIFT guard: Firefly's removal must not have moved any field above bit 64. Pinning the
// offsets directly catches a re-pack of the layout that a round-trip test would happily accept
// (pack and unpack would agree with each other while disagreeing with the other five oracles).
test("NO-SHIFT: fields above bit 64 keep their offsets (Category 65, Chromosome 70, Timestamp 75, Version 123)", () => {
  const obs: ZetaObservation = {
    ...fixedObservation,
    version: 1,
    timestamp: 1747780809123 as any,
    chromosome: 7,
    category: 8,
  };
  const id = pack(obs, DETERMINISTIC_ENV);
  expect(Number((id >> 65n) & 0xfn)).toBe(8);          // category  @65 w4
  expect(Number((id >> 70n) & 0x1fn)).toBe(7);         // chromosome @70 w5
  expect((id >> 75n) & ((1n << 48n) - 1n)).toBe(1747780809123n); // timestamp @75 w48
  expect(Number((id >> 123n) & 0x1fn)).toBe(1);        // version   @123 w5
});

import { packPayload, unpackPayload } from "./zeta-id";
import type { ZetaIdPayload } from "./types";

test("ZetaId packPayload/unpackPayload round-trips Observation payload", () => {
  const payload: ZetaIdPayload = { type: "Observation", value: fixedObservation };
  const id = packPayload(payload, DETERMINISTIC_ENV);
  const unpacked = unpackPayload(id);
  expect(unpacked).toEqual(payload);
});

test("ZetaId packPayload/unpackPayload round-trips ContentAddress payload", () => {
  const payload: ZetaIdPayload = {
    type: "ContentAddress",
    version: 1,
    payload: (1n << 119n) - 5n,
  };
  const id = packPayload(payload, DETERMINISTIC_ENV);
  const unpacked = unpackPayload(id);
  expect(unpacked).toEqual(payload);
});

test("ZetaId packPayload/unpackPayload round-trips Generic payload", () => {
  const payload: ZetaIdPayload = {
    type: "Generic",
    version: 1,
    category: 15, // Extended
    payload: 12345678901234567890n,
  };

  const id = packPayload(payload, DETERMINISTIC_ENV);
  const unpacked = unpackPayload(id);
  expect(unpacked).toEqual(payload);
});

test("ZetaId packPayload throws when payload exceeds 119 bits", () => {
  const invalidContent: ZetaIdPayload = {
    type: "ContentAddress",
    version: 1,
    payload: 1n << 119n,
  };
  expect(() => packPayload(invalidContent, DETERMINISTIC_ENV)).toThrow();

  const invalidGeneric: ZetaIdPayload = {
    type: "Generic",
    version: 1,
    category: 5,
    payload: 1n << 120n,
  };
  expect(() => packPayload(invalidGeneric, DETERMINISTIC_ENV)).toThrow();
});

