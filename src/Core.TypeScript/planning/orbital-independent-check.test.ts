import { describe, expect, it } from "bun:test";
import {
  distanceAt,
  exactAsymmetryMs,
  firstOrderMs,
  flawedPosition,
  independentPosition,
  jdUtc,
} from "./orbital-independent-check";

// NASA's opposition table: 2027-02-19 16:02:32 UTC, 101,417,205 km.
const NASA_2027_OPPOSITION_KM = 101_417_205;
const OPPOSITION_JD = jdUtc("2027-02-19") + 16.043 / 24;

describe("independent orbital asymmetry review", () => {
  it("matches NASA's 2027 opposition range with the full coordinate transform", () => {
    const independentKm = distanceAt(OPPOSITION_JD, independentPosition);
    expect(Math.abs(independentKm - NASA_2027_OPPOSITION_KM) / NASA_2027_OPPOSITION_KM).toBeLessThan(0.001);
  });

  it("fault control: omitting perihelion/node rotations fails the NASA range anchor", () => {
    const omittedRotationKm = distanceAt(OPPOSITION_JD, flawedPosition);
    expect(Math.abs(omittedRotationKm - NASA_2027_OPPOSITION_KM) / NASA_2027_OPPOSITION_KM).toBeGreaterThan(1);
  });

  it("falsifies the relative-rate proxy and keeps the non-cancelling speed envelope above the direct solve", () => {
    const direct = exactAsymmetryMs(OPPOSITION_JD);
    const first = firstOrderMs(OPPOSITION_JD);
    expect(first.relative).toBeLessThan(direct);
    expect(first.speedEnvelope).toBeGreaterThan(direct);
  });
});
