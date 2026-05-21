import { test, expect } from 'bun:test';
import { pack, unpack } from './zeta-id';
import type { ZetaObservation } from './types';

const fixedObservation: ZetaObservation = {
  version: 1,
  timestamp: 1747780809123 as any,
  chromosome: 7,
  category: 0,
  firefly: 1,
  authority: { type: 'HumanVerified' },
  persona: 1,
  momentum: { type: 'High' },
  location: 1,
};

test('ZetaId round-trips all fields correctly', () => {
  const id = pack(fixedObservation);
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
