/**
 * Independent numerical check for Otto's orbital-asymmetry brief.
 *
 * This intentionally does not import OrbitalAsymmetryBudget.fs or reproduce
 * its coordinate routine. It evaluates the stated Kepler elements with the
 * missing perihelion rotations restored, and solves the one-way light-time
 * equations directly by fixed point iteration.
 */

const C_KM_S = 299_792.458;
const J2000 = 2_451_545.0;
const DAY_S = 86_400;

export type OrbitalVec = readonly [number, number, number];
export type OrbitalElements = Readonly<{
  a: number; e: number; n: number; m0: number; i: number; omegaNode: number; argPerihelion: number;
}>;

export const independentEarth: OrbitalElements = {
  a: 149_597_870.7, e: 0.01671022, n: 0.01720209895, m0: 6.240060,
  i: 0, omegaNode: 0, argPerihelion: 102.9373 * Math.PI / 180,
};
export const independentMars: OrbitalElements = {
  a: 227_936_637.0, e: 0.09341233, n: 0.00914709, m0: 0.33972,
  i: 0.03229, omegaNode: 0.86534, argPerihelion: (336.04084 * Math.PI / 180) - 0.86534,
};

export function jdUtc(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000 + 2_440_587.5;
}
function add(a: OrbitalVec, b: OrbitalVec): OrbitalVec { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a: OrbitalVec, b: OrbitalVec): OrbitalVec { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a: OrbitalVec, k: number): OrbitalVec { return [a[0] * k, a[1] * k, a[2] * k]; }
function dot(a: OrbitalVec, b: OrbitalVec): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a: OrbitalVec): number { return Math.sqrt(dot(a, a)); }
function unit(a: OrbitalVec): OrbitalVec { return scale(a, 1 / norm(a)); }

function eccentricAnomaly(m: number, e: number): number {
  let E = m;
  for (let k = 0; k < 20; k += 1) E -= (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
  return E;
}

/** Correct Rz(Ω) Rx(i) Rz(ω) coordinate transform. */
export function independentPosition(el: OrbitalElements, jd: number): OrbitalVec {
  const E = eccentricAnomaly(el.m0 + el.n * (jd - J2000), el.e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2));
  const r = el.a * (1 - el.e * Math.cos(E));
  const u = el.argPerihelion + nu;
  const cosO = Math.cos(el.omegaNode); const sinO = Math.sin(el.omegaNode);
  const cosU = Math.cos(u); const sinU = Math.sin(u); const cosI = Math.cos(el.i); const sinI = Math.sin(el.i);
  return [
    r * (cosO * cosU - sinO * sinU * cosI),
    r * (sinO * cosU + cosO * sinU * cosI),
    r * (sinU * sinI),
  ];
}

/** The delivered-code geometry: ν is treated as ecliptic longitude. */
export function flawedPosition(el: OrbitalElements, jd: number): OrbitalVec {
  const E = eccentricAnomaly(el.m0 + el.n * (jd - J2000), el.e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2));
  const r = el.a * (1 - el.e * Math.cos(E));
  return [r * Math.cos(nu), r * Math.sin(nu) * Math.cos(el.i), r * Math.sin(nu) * Math.sin(el.i)];
}
function velocity(el: OrbitalElements, jd: number): OrbitalVec {
  const dt = 1 / DAY_S;
  return scale(sub(independentPosition(el, jd + dt), independentPosition(el, jd)), 1); // km per second numerically
}
export function distanceAt(jd: number, p: (e: OrbitalElements, t: number) => OrbitalVec = independentPosition): number {
  return norm(sub(p(independentMars, jd), p(independentEarth, jd)));
}

function oneWayExact(from: OrbitalElements, to: OrbitalElements, jd: number): number {
  const source = independentPosition(from, jd);
  let tau = norm(sub(independentPosition(to, jd), source)) / C_KM_S;
  for (let k = 0; k < 30; k += 1) {
    const next = norm(sub(independentPosition(to, jd + tau / DAY_S), source)) / C_KM_S;
    if (Math.abs(next - tau) < 1e-13) return next;
    tau = next;
  }
  return tau;
}

export function exactAsymmetryMs(jd: number): number { return Math.abs(oneWayExact(independentEarth, independentMars, jd) - oneWayExact(independentMars, independentEarth, jd)) * 1000; }
export function firstOrderMs(jd: number): { relative: number; sumVelocity: number; bOnly: number; normBound: number; speedEnvelope: number } {
  const re = independentPosition(independentEarth, jd); const rm = independentPosition(independentMars, jd); const u = unit(sub(rm, re));
  const ve = velocity(independentEarth, jd); const vm = velocity(independentMars, jd);
  const tau = norm(sub(rm, re)) / C_KM_S;
  return {
    relative: Math.abs(dot(sub(vm, ve), u)) * tau / C_KM_S * 1000,
    sumVelocity: Math.abs(dot(add(vm, ve), u)) * tau / C_KM_S * 1000,
    bOnly: Math.abs(dot(vm, u)) * (2 * tau) / C_KM_S * 1000 * 1.2,
    // Cancellation-safe envelope: both projected endpoint speeds are bounded by their norms.
    normBound: 1.2 * (norm(ve) + norm(vm)) * tau / C_KM_S * 1000,
    // Exact speed-only envelope from R/(c±V) light-time inequalities, then a model margin.
    speedEnvelope: 1.2 * Math.max(
      (norm(sub(rm, re)) / (C_KM_S - norm(vm))) - (norm(sub(rm, re)) / (C_KM_S + norm(ve))),
      (norm(sub(rm, re)) / (C_KM_S - norm(ve))) - (norm(sub(rm, re)) / (C_KM_S + norm(vm))),
    ) * 1000,
  };
}

function solarElongationDeg(jd: number): number {
  const rE = independentPosition(independentEarth, jd); const rM = independentPosition(independentMars, jd);
  const toSun = scale(rE, -1); const toMars = sub(rM, rE);
  return Math.acos(Math.max(-1, Math.min(1, dot(unit(toSun), unit(toMars))))) * 180 / Math.PI;
}

function scan(): void {
  const opposition = jdUtc("2027-02-19") + 16.043 / 24;
  const corrected = distanceAt(opposition, independentPosition) / 1e6;
  const flawed = distanceAt(opposition, flawedPosition) / 1e6;
  const first = firstOrderMs(opposition);
  console.log(JSON.stringify({
    date: "2027-02-19T16:02:32Z", correctedDistanceGm: corrected, flawedDistanceGm: flawed,
    exactAsymmetryMs: exactAsymmetryMs(opposition), firstOrderRelativeMs: first.relative,
    firstOrderSumVelocityMs: first.sumVelocity, codeStyleBOnlyMs: first.bOnly,
    normBoundMs: first.normBound, speedEnvelopeMs: first.speedEnvelope,
    solarElongationDeg: solarElongationDeg(opposition),
  }, null, 2));

  let worst = { jd: jdUtc("2026-01-01"), ms: -1, elong: 0 };
  let worstUnderBudget = { jd: jdUtc("2026-01-01"), ratio: -1, exact: 0, code: 0 };
  let worstAgainstNormBound = { jd: jdUtc("2026-01-01"), ratio: -1, exact: 0, bound: 0 };
  let worstAgainstSpeedEnvelope = { jd: jdUtc("2026-01-01"), ratio: -1, exact: 0, bound: 0 };
  let correctedMin = { jd: jdUtc("2026-12-01"), distance: Number.POSITIVE_INFINITY };
  let flawedMin = { jd: jdUtc("2026-12-01"), distance: Number.POSITIVE_INFINITY };
  let closestSolar = { jd: jdUtc("2026-01-01"), deg: 181 };
  for (let jd = jdUtc("2026-01-01"); jd <= jdUtc("2028-06-01"); jd += 0.05) {
    const ms = exactAsymmetryMs(jd);
    if (ms > worst.ms) worst = { jd, ms, elong: solarElongationDeg(jd) };
    const code = firstOrderMs(jd).bOnly;
    if (code > 0 && ms / code > worstUnderBudget.ratio) worstUnderBudget = { jd, ratio: ms / code, exact: ms, code };
    const bound = firstOrderMs(jd).normBound;
    if (bound > 0 && ms / bound > worstAgainstNormBound.ratio) worstAgainstNormBound = { jd, ratio: ms / bound, exact: ms, bound };
    const speedEnvelope = firstOrderMs(jd).speedEnvelope;
    if (speedEnvelope > 0 && ms / speedEnvelope > worstAgainstSpeedEnvelope.ratio) worstAgainstSpeedEnvelope = { jd, ratio: ms / speedEnvelope, exact: ms, bound: speedEnvelope };
    if (jd >= jdUtc("2026-12-01") && jd <= jdUtc("2027-05-01")) {
      const correctedDistance = distanceAt(jd, independentPosition);
      const flawedDistance = distanceAt(jd, flawedPosition);
      if (correctedDistance < correctedMin.distance) correctedMin = { jd, distance: correctedDistance };
      if (flawedDistance < flawedMin.distance) flawedMin = { jd, distance: flawedDistance };
    }
    const deg = solarElongationDeg(jd);
    if (deg < closestSolar.deg) closestSolar = { jd, deg };
  }
  const date = (jd: number) => new Date((jd - 2_440_587.5) * 86_400_000).toISOString();
  console.log(JSON.stringify({
    worstAsymmetry: { at: date(worst.jd), ms: worst.ms, sepDeg: worst.elong },
    worstCodeUnderBudget: { at: date(worstUnderBudget.jd), factor: worstUnderBudget.ratio, exactMs: worstUnderBudget.exact, codeMs: worstUnderBudget.code },
    worstExactToNormBound: { at: date(worstAgainstNormBound.jd), factor: worstAgainstNormBound.ratio, exactMs: worstAgainstNormBound.exact, boundMs: worstAgainstNormBound.bound },
    worstExactToSpeedEnvelope: { at: date(worstAgainstSpeedEnvelope.jd), factor: worstAgainstSpeedEnvelope.ratio, exactMs: worstAgainstSpeedEnvelope.exact, boundMs: worstAgainstSpeedEnvelope.bound },
    phaseMinima: { corrected: { at: date(correctedMin.jd), distanceGm: correctedMin.distance / 1e6 }, flawed: { at: date(flawedMin.jd), distanceGm: flawedMin.distance / 1e6 } },
    minimumSolarElongation: { at: date(closestSolar.jd), deg: closestSolar.deg },
  }, null, 2));
}

if (import.meta.main) scan();
