import { describe, expect, test } from "bun:test";
import QuantumCircuit from "quantum-circuit";
import golden from "./qsharp-golden.json";

const qsharpDumpTolerance = 1e-5;
const tolerance = 1e-6;

function closeTo(actual: number, expected: number, epsilon = tolerance) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(epsilon);
}

function getAmplitudeProb(amp: any): number {
  if (!amp) return 0;
  if (typeof amp === "number") return amp * amp;
  return amp.re * amp.re + amp.im * amp.im;
}

function normalizeComplex(val: any): { real: number; imag: number } {
  if (typeof val === "number") {
    return { real: val, imag: 0 };
  } else if (val && typeof val === "object") {
    if ("re" in val && "im" in val) {
      return { real: val.re, imag: val.im };
    }
    if ("real" in val && "imag" in val) {
      return { real: val.real, imag: val.imag };
    }
  }
  return { real: 0, imag: 0 };
}

describe("quantum-circuit simulator (second oracle)", () => {
  test("single-qubit measurement observables match textbook probabilities", () => {
    for (const v of golden.vectors.singleQubitMeasurement) {
      const c = new QuantumCircuit(1);
      if (v.operation === "Zeta.ReferenceOracle.ApplyH") {
        c.appendGate("h", 0);
      } else if (v.operation === "Zeta.ReferenceOracle.ApplyRyPiOver3") {
        c.appendGate("ry", 0, { params: [Math.PI / 3] });
      } else if (v.operation === "Zeta.ReferenceOracle.ApplyRyPiOver2") {
        c.appendGate("ry", 0, { params: [Math.PI / 2] });
      } else {
        throw new Error(`Unknown operation: ${v.operation}`);
      }
      c.run();

      const probOne = c.probabilities()[0];
      const probZero = 1 - probOne;

      closeTo(probZero, v.probabilities.Zero, qsharpDumpTolerance);
      closeTo(probOne, v.probabilities.One, qsharpDumpTolerance);
    }
  });

  test("Bell/CHSH vector correlators and S parameter", () => {
    const canonical = golden.vectors.bellChsh.canonical;
    const angles = canonical.anglesRadians;

    const computeCorrelator = (a: number, b: number) => {
      const c = new QuantumCircuit(2);
      c.appendGate("h", 0);
      c.appendGate("cx", [0, 1]);
      c.appendGate("ry", 0, { params: [-a] });
      c.appendGate("ry", 1, { params: [-b] });
      c.run();

      const p00 = getAmplitudeProb(c.state[0]);
      const p01 = getAmplitudeProb(c.state[1]);
      const p10 = getAmplitudeProb(c.state[2]);
      const p11 = getAmplitudeProb(c.state[3]);
      return p00 + p11 - (p01 + p10);
    };

    const E_ab = computeCorrelator(angles.a, angles.b);
    const E_abPrime = computeCorrelator(angles.a, angles.bPrime);
    const E_aPrimeb = computeCorrelator(angles.aPrime, angles.b);
    const E_aPrimebPrime = computeCorrelator(angles.aPrime, angles.bPrime);

    const s = E_ab - E_abPrime + E_aPrimeb + E_aPrimebPrime;

    closeTo(E_ab, canonical.correlators["E(a,b)"], qsharpDumpTolerance);
    closeTo(E_abPrime, canonical.correlators["E(a,bPrime)"], qsharpDumpTolerance);
    closeTo(E_aPrimeb, canonical.correlators["E(aPrime,b)"], qsharpDumpTolerance);
    closeTo(E_aPrimebPrime, canonical.correlators["E(aPrime,bPrime)"], qsharpDumpTolerance);
    closeTo(s, canonical.s, qsharpDumpTolerance);
  });

  test("Bell/CHSH singlet corners", () => {
    const singlet = golden.vectors.bellChsh.singletCorners;

    const runSingletCircuit = (a: number, b: number) => {
      const c = new QuantumCircuit(2);
      c.appendGate("h", 0);
      c.appendGate("cx", [0, 1]);
      c.appendGate("x", 1);
      c.appendGate("z", 1);
      c.appendGate("ry", 0, { params: [-a] });
      c.appendGate("ry", 1, { params: [-b] });
      c.run();

      const p00 = getAmplitudeProb(c.state[0]);
      const p01 = getAmplitudeProb(c.state[1]);
      const p10 = getAmplitudeProb(c.state[2]);
      const p11 = getAmplitudeProb(c.state[3]);
      const corr = p01 + p10 - (p00 + p11);
      return { corr, pSame: p00 + p11, pOpposite: p01 + p10 };
    };

    let s = 0;
    for (const corner of singlet.corners) {
      const angles = corner.anglesRadians;
      const res = runSingletCircuit(angles.a, angles.b);
      closeTo(res.corr, corner.correlator, qsharpDumpTolerance);
      closeTo(res.pSame, corner.sameOutcomeProbability, qsharpDumpTolerance);
      closeTo(res.pOpposite, corner.oppositeOutcomeProbability, qsharpDumpTolerance);
      s += corner.coefficient * res.corr;
    }
    closeTo(s, singlet.s, qsharpDumpTolerance);
    closeTo(s, singlet.analytic, qsharpDumpTolerance);
  });

  test("Bell coincidence probability outcomes", () => {
    for (const v of golden.vectors.bellCoincidence) {
      const c = new QuantumCircuit(2);
      c.appendGate("h", 0);
      c.appendGate("cx", [0, 1]);

      if (v.operation === "Zeta.ReferenceOracle.ApplyBellSingletAnalyzers") {
        c.appendGate("x", 1);
        c.appendGate("z", 1);
      }

      c.appendGate("ry", 0, { params: [-v.anglesRadians.a] });
      c.appendGate("ry", 1, { params: [-v.anglesRadians.b] });
      c.run();

      const p00 = getAmplitudeProb(c.state[0]);
      const p01 = getAmplitudeProb(c.state[1]);
      const p10 = getAmplitudeProb(c.state[2]);
      const p11 = getAmplitudeProb(c.state[3]);

      const actualProb = v.event === "sameOutcome" ? p00 + p11 : p01 + p10;
      closeTo(actualProb, v.probability, qsharpDumpTolerance);
    }
  });

  test("interference visibility (Mach-Zehnder interferometer)", () => {
    for (const v of golden.vectors.interferenceVisibility) {
      const c = new QuantumCircuit(1);
      if (v.operation === "Zeta.ReferenceOracle.ApplyMachZehnderOpen") {
        c.appendGate("h", 0);
      } else if (v.operation === "Zeta.ReferenceOracle.ApplyMachZehnderClosedZeroPhase") {
        c.appendGate("h", 0);
        c.appendGate("h", 0);
      } else if (v.operation === "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiPhase") {
        c.appendGate("h", 0);
        c.appendGate("z", 0);
        c.appendGate("h", 0);
      } else if (v.operation === "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver3Phase") {
        c.appendGate("h", 0);
        c.appendGate("rz", 0, { params: [Math.PI / 3] });
        c.appendGate("h", 0);
      } else if (v.operation === "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver2Phase") {
        c.appendGate("h", 0);
        c.appendGate("rz", 0, { params: [Math.PI / 2] });
        c.appendGate("h", 0);
      } else if (v.operation === "Zeta.ReferenceOracle.ApplyMachZehnderClosedTwoPiOver3Phase") {
        c.appendGate("h", 0);
        c.appendGate("rz", 0, { params: [(2 * Math.PI) / 3] });
        c.appendGate("h", 0);
      } else {
        throw new Error(`Unknown operation: ${v.operation}`);
      }
      c.run();

      const probOne = c.probabilities()[0];
      const probZero = 1 - probOne;

      closeTo(probZero, v.probabilities.Zero, qsharpDumpTolerance);
      closeTo(probOne, v.probabilities.One, qsharpDumpTolerance);
    }
  });

  test("gate unitary matrices match reference oracle exactly", () => {
    const unitaries = golden.vectors.gateUnitaries;

    for (const [gateName, expectedMatrix] of Object.entries(unitaries)) {
      let c: QuantumCircuit;
      if (gateName === "BellPhiPlusPrep") {
        c = new QuantumCircuit(2);
        c.appendGate("h", 0);
        c.appendGate("cx", [0, 1]);
      } else {
        c = new QuantumCircuit(1);
        if (gateName === "H") {
          c.appendGate("h", 0);
        } else if (gateName === "Ry(pi/2)") {
          c.appendGate("ry", 0, { params: [Math.PI / 2] });
        } else if (gateName === "Ry(pi/3)") {
          c.appendGate("ry", 0, { params: [Math.PI / 3] });
        } else if (gateName === "Rz(pi/3)") {
          c.appendGate("rz", 0, { params: [Math.PI / 3] });
        } else if (gateName === "S") {
          c.appendGate("s", 0);
        } else if (gateName === "T") {
          c.appendGate("t", 0);
        } else if (gateName === "X") {
          c.appendGate("x", 0);
        } else if (gateName === "Y") {
          c.appendGate("y", 0);
        } else if (gateName === "Z") {
          c.appendGate("z", 0);
        } else {
          throw new Error(`Unknown gate unitary key: ${gateName}`);
        }
      }

      const actualRawMatrix = c.circuitMatrix();
      const actualMatrix = actualRawMatrix.map((row: any) => row.map(normalizeComplex));

      expect(actualMatrix.length).toBe(expectedMatrix.length);
      for (let r = 0; r < expectedMatrix.length; r++) {
        expect(actualMatrix[r].length).toBe(expectedMatrix[r].length);
        for (let col = 0; col < expectedMatrix[r].length; col++) {
          const act = actualMatrix[r][col];
          const exp = expectedMatrix[r][col];
          closeTo(act.real, exp.real, qsharpDumpTolerance);
          closeTo(act.imag, exp.imag, qsharpDumpTolerance);
        }
      }
    }
  });

  test("Q# Pauli products anticommutation relations", () => {
    for (const item of golden.vectors.pauliAnticommutation) {
      const runCircuit = (opName: string) => {
        const c = new QuantumCircuit(1);
        if (opName === "Zeta.ReferenceOracle.ApplyPauliXAfterZ") {
          c.appendGate("z", 0);
          c.appendGate("x", 0);
        } else if (opName === "Zeta.ReferenceOracle.ApplyPauliZAfterX") {
          c.appendGate("x", 0);
          c.appendGate("z", 0);
        } else if (opName === "Zeta.ReferenceOracle.ApplyPauliXAfterY") {
          c.appendGate("y", 0);
          c.appendGate("x", 0);
        } else if (opName === "Zeta.ReferenceOracle.ApplyPauliYAfterX") {
          c.appendGate("x", 0);
          c.appendGate("y", 0);
        } else if (opName === "Zeta.ReferenceOracle.ApplyPauliYAfterZ") {
          c.appendGate("z", 0);
          c.appendGate("y", 0);
        } else if (opName === "Zeta.ReferenceOracle.ApplyPauliZAfterY") {
          c.appendGate("y", 0);
          c.appendGate("z", 0);
        } else {
          throw new Error(`Unknown Pauli operation: ${opName}`);
        }
        return c.circuitMatrix().map((row: any) => row.map(normalizeComplex));
      };

      const lhs = runCircuit(item.lhsOperation);
      const rhs = runCircuit(item.rhsOperation);

      for (let r = 0; r < lhs.length; r++) {
        for (let col = 0; col < lhs[r].length; col++) {
          const lVal = lhs[r][col];
          const rVal = rhs[r][col];
          const expectedLVal = normalizeComplex(item.lhsMatrix[r][col]);
          const expectedRVal = normalizeComplex(item.rhsMatrix[r][col]);

          closeTo(lVal.real, expectedLVal.real, qsharpDumpTolerance);
          closeTo(lVal.imag, expectedLVal.imag, qsharpDumpTolerance);
          closeTo(rVal.real, expectedRVal.real, qsharpDumpTolerance);
          closeTo(rVal.imag, expectedRVal.imag, qsharpDumpTolerance);

          closeTo(lVal.real, -rVal.real, qsharpDumpTolerance);
          closeTo(lVal.imag, -rVal.imag, qsharpDumpTolerance);
        }
      }
    }
  });
});
