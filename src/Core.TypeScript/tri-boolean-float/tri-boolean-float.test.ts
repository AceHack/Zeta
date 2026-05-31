import { test, expect } from 'bun:test';
import { T, F, N } from '../tri-boolean';
import { DEFAULT_SHAPE } from './types';
import {
  decode, measure, cooperate, isHeld, fromValue, fromTrits,
} from './tri-boolean-float';

test('round-trip: representable non-negative values decode back exactly', () => {
  // shape 4/3/4 => 8 value bits (V in [0,256)), mode in [0,8).
  for (const v of [0, 1, 5, 42, 255, 0.5, 0.25, 1.5, 3.75, 0.125]) {
    const enc = fromValue(v);
    expect(enc.ok).toBe(true);
    if (enc.ok) {
      const dec = decode(enc.float);
      expect(dec.ok).toBe(true);
      if (dec.ok) expect(dec.value).toBe(v);
    }
  }
});

test('the MIDDLE decodes the ends: same value bits, different mode => different magnitude', () => {
  // value field = 0000 0001 (V=1); decoder mode picks the radix point.
  const high = [F, F, F, F];
  const low = [F, F, F, T];
  const m0 = fromTrits(high, [F, F, F], low); // mode 0 -> 1 / 1
  const m1 = fromTrits(high, [F, F, T], low); // mode 1 -> 1 / 2
  const m2 = fromTrits(high, [F, T, F], low); // mode 2 -> 1 / 4
  expect(decode(m0)).toEqual({ ok: true, value: 1 });
  expect(decode(m1)).toEqual({ ok: true, value: 0.5 });
  expect(decode(m2)).toEqual({ ok: true, value: 0.25 });
});

test('N in a VALUE trit => value-superposed (interpretation known)', () => {
  const f = fromTrits([F, F, F, N], [F, F, F], [F, F, F, T]); // decoder certain, value has an N
  const r = measure(f);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.feedback.reason).toBe('value-superposed');
  expect(isHeld(f)).toBe(true);
});

test('N in a DECODER trit => interpretation-superposed (even with a fully-certain value)', () => {
  const f = fromTrits([F, F, F, F], [F, N, F], [F, F, F, T]); // value certain, decoder has an N
  const r = measure(f);
  expect(r.ok).toBe(false);
  // The decode INSTRUCTION itself is held -- the qubit property at the interpretation level.
  if (!r.ok) expect(r.feedback.reason).toBe('interpretation-superposed');
});

test('decoder-N dominates: interpretation-superposed even when a value trit is ALSO N', () => {
  const f = fromTrits([N, F, F, F], [N, F, F], [F, F, F, T]); // both held; decoder read first
  const r = decode(f);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.feedback.reason).toBe('interpretation-superposed');
});

test('cooperate preserves every held trit (identity; never collapses)', () => {
  const f = fromTrits([N, F, F, F], [F, N, F], [F, F, F, N]);
  expect(cooperate(f)).toBe(f);
  expect(isHeld(cooperate(f))).toBe(true);
});

test('fromValue surfaces not-representable for negatives + out-of-range', () => {
  expect(fromValue(-1).ok).toBe(false);
  expect(fromValue(256).ok).toBe(false); // exceeds 8 value bits at mode 0
  expect(fromValue(1 / 1024).ok).toBe(false); // needs mode 10 > maxMode 7
});

test('encode canonicalizes to the smallest mode (decode is exact regardless)', () => {
  const enc = fromValue(2, DEFAULT_SHAPE); // 2 = 2/1 (mode 0), not 4/2 (mode 1)
  expect(enc.ok).toBe(true);
  if (enc.ok) {
    expect(enc.float.decoder).toEqual([F, F, F]); // mode 0
    expect(decode(enc.float)).toEqual({ ok: true, value: 2 });
  }
});
