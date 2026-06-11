import { expect, test } from "bun:test";
import golden from "./qsharp-golden.json";

type Probabilities = { Zero: number; One: number };
type Complex = { real: number; imag: number };
type Matrix = Complex[][];

const tolerance = 1e-6;
const qsharpDumpTolerance = 1e-5;

function closeTo(actual: number, expected: number, epsilon = tolerance) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(epsilon);
}

function closeComplexTo(actual: Complex, expected: Complex, epsilon = tolerance) {
  closeTo(actual.real, expected.real, epsilon);
  closeTo(actual.imag, expected.imag, epsilon);
}

function probabilitySum(probabilities: Probabilities) {
  return probabilities.Zero + probabilities.One;
}

test("Q# golden fixture exposes the observable treaty", () => {
  expect(golden.schema).toBe("zeta.qsharp.reference-observables.v1");
  expect(golden.qsharpSource).toBe("tools/qsharp-oracle/ZetaReferenceOracle.qs");
  expect(golden.qdkPackage).toBe("qdk[azure]==1.29.1");
  expect(golden.qsharpPackage).toBe("qsharp==1.29.1");
});

test("single-qubit measurement observables match textbook probabilities", () => {
  const cases = new Map(golden.vectors.singleQubitMeasurement.map((v) => [v.id, v]));

  const h = cases.get("H|0>")?.probabilities as Probabilities;
  closeTo(h.Zero, 0.5);
  closeTo(h.One, 0.5);
  closeTo(probabilitySum(h), 1);

  const ryPiOver3 = cases.get("Ry(pi/3)|0>")?.probabilities as Probabilities;
  closeTo(ryPiOver3.Zero, 0.75);
  closeTo(ryPiOver3.One, 0.25);
  closeTo(probabilitySum(ryPiOver3), 1);

  const ryPiOver2 = cases.get("Ry(pi/2)|0>")?.probabilities as Probabilities;
  closeTo(ryPiOver2.Zero, 0.5);
  closeTo(ryPiOver2.One, 0.5);
  closeTo(probabilitySum(ryPiOver2), 1);
});

test("Bell/CHSH vector pins the canonical correlators and singlet corner observables", () => {
  const canonical = golden.vectors.bellChsh.canonical;

  closeTo(canonical.correlators["E(a,b)"], Math.SQRT1_2);
  closeTo(canonical.correlators["E(a,bPrime)"], -Math.SQRT1_2);
  closeTo(canonical.correlators["E(aPrime,b)"], Math.SQRT1_2);
  closeTo(canonical.correlators["E(aPrime,bPrime)"], Math.SQRT1_2);
  closeTo(canonical.s, 2 * Math.SQRT2);
  closeTo(canonical.tsirelson, 2 * Math.SQRT2);
  expect(canonical.s).toBeGreaterThan(canonical.classicalBound);

  const singlet = golden.vectors.bellChsh.singletCorners;
  expect(singlet.scope).toContain("Tsirelson maximality is cited/proved separately");
  expect(singlet.corners).toHaveLength(4);
  closeTo(singlet.analytic, 2 * Math.SQRT2);
  closeTo(singlet.s, singlet.analytic, qsharpDumpTolerance);

  const cornerMap = new Map(singlet.corners.map((v) => [v.id, v]));
  closeTo(cornerMap.get("E(a0,b0)")?.correlator as number, Math.SQRT1_2, qsharpDumpTolerance);
  closeTo(cornerMap.get("E(a0,b1)")?.correlator as number, Math.SQRT1_2, qsharpDumpTolerance);
  closeTo(cornerMap.get("E(a1,b0)")?.correlator as number, Math.SQRT1_2, qsharpDumpTolerance);
  closeTo(cornerMap.get("E(a1,b1)")?.correlator as number, -Math.SQRT1_2, qsharpDumpTolerance);
});

test("Bell coincidence observables pin PhiPlus and singlet outcome conventions", () => {
  const cases = new Map(golden.vectors.bellCoincidence.map((v) => [v.id, v]));

  const phiPiOver4 = cases.get("PhiPlus same-outcome a=0 b=pi/4");
  closeTo(phiPiOver4?.probability as number, Math.cos(Math.PI / 8) ** 2);
  expect(phiPiOver4?.event).toBe("sameOutcome");

  const singletPiOver4 = cases.get("Singlet opposite-outcome a=0 b=pi/4");
  closeTo(singletPiOver4?.probability as number, Math.cos(Math.PI / 8) ** 2);
  expect(singletPiOver4?.event).toBe("oppositeOutcome");

  const phiPiOver2 = cases.get("PhiPlus same-outcome a=0 b=pi/2");
  closeTo(phiPiOver2?.probability as number, 0.5);

  const phiPi = cases.get("PhiPlus same-outcome a=0 b=pi");
  closeTo(phiPi?.probability as number, 0);
});

test("interference observables distinguish open, reinforce, and cancel cases", () => {
  const cases = new Map(golden.vectors.interferenceVisibility.map((v) => [v.id, v]));

  const open = cases.get("mach-zehnder-open")?.probabilities as Probabilities;
  closeTo(open.Zero, 0.5, qsharpDumpTolerance);
  closeTo(open.One, 0.5, qsharpDumpTolerance);

  const reinforced = cases.get("mach-zehnder-closed-zero-phase")?.probabilities as Probabilities;
  closeTo(reinforced.Zero, 1);
  closeTo(reinforced.One, 0);

  const piOver3 = cases.get("mach-zehnder-closed-pi-over-3-phase")?.probabilities as Probabilities;
  closeTo(piOver3.Zero, 0.75, qsharpDumpTolerance);
  closeTo(piOver3.One, 0.25, qsharpDumpTolerance);

  const piOver2 = cases.get("mach-zehnder-closed-pi-over-2-phase")?.probabilities as Probabilities;
  closeTo(piOver2.Zero, 0.5, qsharpDumpTolerance);
  closeTo(piOver2.One, 0.5, qsharpDumpTolerance);

  const twoPiOver3 = cases.get("mach-zehnder-closed-two-pi-over-3-phase")?.probabilities as Probabilities;
  closeTo(twoPiOver3.Zero, 0.25, qsharpDumpTolerance);
  closeTo(twoPiOver3.One, 0.75, qsharpDumpTolerance);

  const cancelled = cases.get("mach-zehnder-closed-pi-phase")?.probabilities as Probabilities;
  closeTo(cancelled.Zero, 0);
  closeTo(cancelled.One, 1);
});

test("Q# Pauli products pin the hardware-side anticommutation signs", () => {
  for (const item of golden.vectors.pauliAnticommutation) {
    expect(item.relation).toBe("lhsMatrix = -rhsMatrix");
    const lhs = item.lhsMatrix as Matrix;
    const rhs = item.rhsMatrix as Matrix;

    for (let row = 0; row < lhs.length; row++) {
      for (let col = 0; col < lhs[row].length; col++) {
        closeComplexTo(lhs[row][col], { real: -rhs[row][col].real, imag: -rhs[row][col].imag });
      }
    }
  }
});
