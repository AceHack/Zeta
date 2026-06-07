import { test, expect } from "bun:test";
import { pack, unpack, DETERMINISTIC_ENV } from "./zeta-id";
import type { ZetaObservation } from "./types";

const fixedObservation: ZetaObservation = {
  version: 1,
  timestamp: 1747780809123 as any,
  chromosome: 7,
  category: 0,
  firefly: 1,
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
  expect(result.firefly).toBe(fixedObservation.firefly);
  expect(result.persona).toBe(fixedObservation.persona);
  expect(result.location).toBe(fixedObservation.location);
  expect(result.authority).toEqual(fixedObservation.authority);
  expect(result.momentum).toEqual(fixedObservation.momentum);
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

