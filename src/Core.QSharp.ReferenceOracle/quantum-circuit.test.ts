import { describe, expect, test } from "bun:test";
import QuantumCircuit from "quantum-circuit";
import golden from "./qsharp-golden.json";
import transcript from "./treaty-transcript.json";

interface Complex {
  readonly real: number;
  readonly imag: number;
}

type Matrix = Complex[][];
type CircuitAction = (circuit: QuantumCircuit) => void;
interface CorrelatorProbabilities {
  readonly corr: number;
  readonly pSame: number;
  readonly pOpposite: number;
}

const qsharpDumpTolerance = 1e-5;
const tolerance = 1e-6;

const singleQubitActions = new Map<string, CircuitAction>([
  [
    "Zeta.ReferenceOracle.ApplyH",
    (circuit) => {
      append(circuit, "h", 0);
    },
  ],
  [
    "Zeta.ReferenceOracle.ApplyRyPiOver3",
    (circuit) => {
      append(circuit, "ry", 0, [Math.PI / 3]);
    },
  ],
  [
    "Zeta.ReferenceOracle.ApplyRyPiOver2",
    (circuit) => {
      append(circuit, "ry", 0, [Math.PI / 2]);
    },
  ],
]);

const machZehnderActions = new Map<string, CircuitAction>([
  [
    "Zeta.ReferenceOracle.ApplyMachZehnderOpen",
    (circuit) => {
      append(circuit, "h", 0);
    },
  ],
  [
    "Zeta.ReferenceOracle.ApplyMachZehnderClosedZeroPhase",
    (circuit) => {
      append(circuit, "h", 0);
      append(circuit, "h", 0);
    },
  ],
  [
    "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiPhase",
    (circuit) => {
      append(circuit, "h", 0);
      append(circuit, "z", 0);
      append(circuit, "h", 0);
    },
  ],
  [
    "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver3Phase",
    (circuit) => {
      applyClosedPhaseMachZehnder(circuit, Math.PI / 3);
    },
  ],
  [
    "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver2Phase",
    (circuit) => {
      applyClosedPhaseMachZehnder(circuit, Math.PI / 2);
    },
  ],
  [
    "Zeta.ReferenceOracle.ApplyMachZehnderClosedTwoPiOver3Phase",
    (circuit) => {
      applyClosedPhaseMachZehnder(circuit, (2 * Math.PI) / 3);
    },
  ],
]);

const flowBitActions = new Map<string, CircuitAction>([
  [
    "Zeta.ReferenceOracle.ApplyExternalBitDistinguishZero",
    (circuit) => {
      append(circuit, "h", 0);
      append(circuit, "h", 0);
    },
  ],
  [
    "Zeta.ReferenceOracle.ApplyExternalBitDistinguishOne",
    (circuit) => {
      append(circuit, "h", 0);
      append(circuit, "z", 0);
      append(circuit, "h", 0);
    },
  ],
]);

const singleQubitGateActions = new Map<string, CircuitAction>([
  [
    "H",
    (circuit) => {
      append(circuit, "h", 0);
    },
  ],
  [
    "Ry(pi/2)",
    (circuit) => {
      append(circuit, "ry", 0, [Math.PI / 2]);
    },
  ],
  [
    "Ry(pi/3)",
    (circuit) => {
      append(circuit, "ry", 0, [Math.PI / 3]);
    },
  ],
  [
    "Rz(pi/3)",
    (circuit) => {
      append(circuit, "rz", 0, [Math.PI / 3]);
    },
  ],
  [
    "S",
    (circuit) => {
      append(circuit, "s", 0);
    },
  ],
  [
    "T",
    (circuit) => {
      append(circuit, "t", 0);
    },
  ],
  [
    "X",
    (circuit) => {
      append(circuit, "x", 0);
    },
  ],
  [
    "Y",
    (circuit) => {
      append(circuit, "y", 0);
    },
  ],
  [
    "Z",
    (circuit) => {
      append(circuit, "z", 0);
    },
  ],
]);

const pauliProductActions = new Map<string, CircuitAction>([
  [
    "Zeta.ReferenceOracle.ApplyPauliXAfterZ",
    (circuit) => {
      applyGates(circuit, "z", "x");
    },
  ],
  [
    "Zeta.ReferenceOracle.ApplyPauliZAfterX",
    (circuit) => {
      applyGates(circuit, "x", "z");
    },
  ],
  [
    "Zeta.ReferenceOracle.ApplyPauliXAfterY",
    (circuit) => {
      applyGates(circuit, "y", "x");
    },
  ],
  [
    "Zeta.ReferenceOracle.ApplyPauliYAfterX",
    (circuit) => {
      applyGates(circuit, "x", "y");
    },
  ],
  [
    "Zeta.ReferenceOracle.ApplyPauliYAfterZ",
    (circuit) => {
      applyGates(circuit, "z", "y");
    },
  ],
  [
    "Zeta.ReferenceOracle.ApplyPauliZAfterY",
    (circuit) => {
      applyGates(circuit, "y", "z");
    },
  ],
]);

function closeTo(actual: number, expected: number, epsilon = tolerance) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(epsilon);
}

function closeComplexTo(actual: Complex, expected: Complex, epsilon = tolerance) {
  closeTo(actual.real, expected.real, epsilon);
  closeTo(actual.imag, expected.imag, epsilon);
}

function expectDefined<T>(value: T | undefined, label: string): T {
  expect(value, label).toBeDefined();
  return value as T;
}

function append(circuit: QuantumCircuit, gate: string, wire: number | readonly number[], params?: readonly number[]) {
  if (params === undefined) {
    circuit.appendGate(gate, wire);
    return;
  }

  if (gate === "ry" && params[0] !== undefined) {
    circuit.appendGate(gate, wire, { params: { theta: params[0] } });
  } else if (gate === "rz" && params[0] !== undefined) {
    circuit.appendGate(gate, wire, { params: { phi: params[0] } });
  } else {
    circuit.appendGate(gate, wire, { params });
  }
}

function applyGates(circuit: QuantumCircuit, first: string, second: string) {
  append(circuit, first, 0);
  append(circuit, second, 0);
}

function applyClosedPhaseMachZehnder(circuit: QuantumCircuit, phase: number) {
  append(circuit, "h", 0);
  append(circuit, "rz", 0, [phase]);
  append(circuit, "h", 0);
}

function applyKnownOperation(circuit: QuantumCircuit, operation: string, actions: ReadonlyMap<string, CircuitAction>) {
  const action = expectDefined(actions.get(operation), `Unknown operation: ${operation}`);
  action(circuit);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberField(record: Record<string, unknown>, field: string): number | undefined {
  const value = record[field];
  return typeof value === "number" ? value : undefined;
}

function normalizeComplex(value: unknown): Complex {
  if (typeof value === "number") return { real: value, imag: 0 };

  if (isRecord(value)) {
    const re = numberField(value, "re");
    const im = numberField(value, "im");
    if (re !== undefined && im !== undefined) return { real: re, imag: im };

    const real = numberField(value, "real");
    const imag = numberField(value, "imag");
    if (real !== undefined && imag !== undefined) return { real, imag };
  }

  throw new Error(`Unsupported quantum-circuit complex value: ${JSON.stringify(value)}`);
}

function normalizeMatrix(raw: readonly (readonly unknown[])[]): Matrix {
  return raw.map((row) => row.map(normalizeComplex));
}

function matrixRow(matrix: Matrix, row: number): Complex[] {
  return expectDefined(matrix[row], `missing matrix row ${String(row)}`);
}

function matrixAt(matrix: Matrix, row: number, col: number): Complex {
  return expectDefined(matrixRow(matrix, row)[col], `missing matrix cell ${String(row)},${String(col)}`);
}

function probabilityOne(circuit: QuantumCircuit): number {
  return expectDefined(circuit.probabilities()[0], "missing |1> probability");
}

function amplitudeProbability(circuit: QuantumCircuit, basisIndex: number): number {
  const amplitude = normalizeComplex(
    expectDefined(circuit.state[basisIndex], `missing basis amplitude ${String(basisIndex)}`),
  );
  return amplitude.real * amplitude.real + amplitude.imag * amplitude.imag;
}

function bellProbabilities(circuit: QuantumCircuit) {
  const p00 = amplitudeProbability(circuit, 0);
  const p01 = amplitudeProbability(circuit, 1);
  const p10 = amplitudeProbability(circuit, 2);
  const p11 = amplitudeProbability(circuit, 3);
  return { p00, p01, p10, p11 };
}

function bellPhiPlusCircuit(a: number, b: number): QuantumCircuit {
  const circuit = new QuantumCircuit(2);
  append(circuit, "h", 0);
  append(circuit, "cx", [0, 1]);
  append(circuit, "ry", 0, [-a]);
  append(circuit, "ry", 1, [-b]);
  circuit.run();
  return circuit;
}

function bellSingletCircuit(a: number, b: number): QuantumCircuit {
  const circuit = new QuantumCircuit(2);
  append(circuit, "h", 0);
  append(circuit, "cx", [0, 1]);
  append(circuit, "x", 1);
  append(circuit, "z", 1);
  append(circuit, "ry", 0, [-a]);
  append(circuit, "ry", 1, [-b]);
  circuit.run();
  return circuit;
}

function phiPlusCorrelator(a: number, b: number): number {
  const { p00, p01, p10, p11 } = bellProbabilities(bellPhiPlusCircuit(a, b));
  return p00 + p11 - (p01 + p10);
}

function singletCorrelatorProbabilities(a: number, b: number): CorrelatorProbabilities {
  const { p00, p01, p10, p11 } = bellProbabilities(bellSingletCircuit(a, b));
  const pSame = p00 + p11;
  const pOpposite = p01 + p10;
  return { corr: pOpposite - pSame, pSame, pOpposite };
}

function makeGateCircuit(gateName: string): QuantumCircuit {
  if (gateName === "BellPhiPlusPrep") {
    const circuit = new QuantumCircuit(2);
    append(circuit, "h", 0);
    append(circuit, "cx", [0, 1]);
    return circuit;
  }

  const circuit = new QuantumCircuit(1);
  applyKnownOperation(circuit, gateName, singleQubitGateActions);
  return circuit;
}

function circuitMatrix(circuit: QuantumCircuit): Matrix {
  return normalizeMatrix(circuit.circuitMatrix());
}

// The TS simulator is a second implementation over the same observable
// golden vectors as Q#. It checks measurable probabilities/matrices here;
// Tsirelson maximality remains a cited/proved theorem, not a sampling claim.
describe("quantum-circuit simulator (second observable oracle)", () => {
  test("single-qubit measurement observables match textbook probabilities", () => {
    for (const v of golden.vectors.singleQubitMeasurement) {
      const circuit = new QuantumCircuit(1);
      applyKnownOperation(circuit, v.operation, singleQubitActions);
      circuit.run();

      const probOne = probabilityOne(circuit);
      const probZero = 1 - probOne;

      closeTo(probZero, v.probabilities.Zero, qsharpDumpTolerance);
      closeTo(probOne, v.probabilities.One, qsharpDumpTolerance);
    }
  });

  test("Bell/CHSH vector correlators and S parameter match Q# observables", () => {
    const canonical = golden.vectors.bellChsh.canonical;
    const angles = canonical.anglesRadians;

    const eAb = phiPlusCorrelator(angles.a, angles.b);
    const eAbPrime = phiPlusCorrelator(angles.a, angles.bPrime);
    const eAPrimeB = phiPlusCorrelator(angles.aPrime, angles.b);
    const eAPrimeBPrime = phiPlusCorrelator(angles.aPrime, angles.bPrime);
    const s = eAb - eAbPrime + eAPrimeB + eAPrimeBPrime;

    closeTo(eAb, canonical.correlators["E(a,b)"], qsharpDumpTolerance);
    closeTo(eAbPrime, canonical.correlators["E(a,bPrime)"], qsharpDumpTolerance);
    closeTo(eAPrimeB, canonical.correlators["E(aPrime,b)"], qsharpDumpTolerance);
    closeTo(eAPrimeBPrime, canonical.correlators["E(aPrime,bPrime)"], qsharpDumpTolerance);
    closeTo(s, canonical.s, qsharpDumpTolerance);
  });

  test("Bell/CHSH singlet corners match Q# observable treaty", () => {
    const singlet = golden.vectors.bellChsh.singletCorners;
    let s = 0;

    for (const corner of singlet.corners) {
      const angles = corner.anglesRadians;
      const result = singletCorrelatorProbabilities(angles.a, angles.b);

      closeTo(result.corr, corner.correlator, qsharpDumpTolerance);
      closeTo(result.pSame, corner.sameOutcomeProbability, qsharpDumpTolerance);
      closeTo(result.pOpposite, corner.oppositeOutcomeProbability, qsharpDumpTolerance);
      s += corner.coefficient * result.corr;
    }

    closeTo(s, singlet.s, qsharpDumpTolerance);
    closeTo(s, singlet.analytic, qsharpDumpTolerance);
  });

  test("Bell coincidence probability outcomes match Q# observables", () => {
    for (const v of golden.vectors.bellCoincidence) {
      const circuit =
        v.operation === "Zeta.ReferenceOracle.ApplyBellSingletAnalyzers"
          ? bellSingletCircuit(v.anglesRadians.a, v.anglesRadians.b)
          : bellPhiPlusCircuit(v.anglesRadians.a, v.anglesRadians.b);
      const { p00, p01, p10, p11 } = bellProbabilities(circuit);
      const actualProb = v.event === "sameOutcome" ? p00 + p11 : p01 + p10;

      closeTo(actualProb, v.probability, qsharpDumpTolerance);
    }
  });

  test("interference visibility matches Q# Mach-Zehnder observables", () => {
    for (const v of golden.vectors.interferenceVisibility) {
      const circuit = new QuantumCircuit(1);
      applyKnownOperation(circuit, v.operation, machZehnderActions);
      circuit.run();

      const probOne = probabilityOne(circuit);
      const probZero = 1 - probOne;

      closeTo(probZero, v.probabilities.Zero, qsharpDumpTolerance);
      closeTo(probOne, v.probabilities.One, qsharpDumpTolerance);
    }
  });

  test("flow-bit distinction maps external entropy bits into measured identity bits", () => {
    for (const v of golden.vectors.flowBitDistinction) {
      const circuit = new QuantumCircuit(1);
      applyKnownOperation(circuit, v.operation, flowBitActions);
      circuit.run();

      const probOne = probabilityOne(circuit);
      const probZero = 1 - probOne;

      closeTo(probZero, v.probabilities.Zero, qsharpDumpTolerance);
      closeTo(probOne, v.probabilities.One, qsharpDumpTolerance);
      closeTo(probOne, v.externalBit ? 1 : 0, qsharpDumpTolerance);
    }
  });

  test("gate unitary simulator sanity checks match Q# reference matrices", () => {
    const unitaries = golden.vectors.gateUnitaries;

    for (const [gateName, expectedMatrixRaw] of Object.entries(unitaries)) {
      const expectedMatrix = normalizeMatrix(expectedMatrixRaw);
      const actualMatrix = circuitMatrix(makeGateCircuit(gateName));

      expect(actualMatrix).toHaveLength(expectedMatrix.length);
      for (let row = 0; row < expectedMatrix.length; row++) {
        expect(matrixRow(actualMatrix, row)).toHaveLength(matrixRow(expectedMatrix, row).length);

        for (let col = 0; col < matrixRow(expectedMatrix, row).length; col++) {
          closeComplexTo(matrixAt(actualMatrix, row, col), matrixAt(expectedMatrix, row, col), qsharpDumpTolerance);
        }
      }
    }
  });

  test("Pauli product matrices match Q# hardware-side anticommutation signs", () => {
    for (const item of golden.vectors.pauliAnticommutation) {
      const lhsCircuit = new QuantumCircuit(1);
      const rhsCircuit = new QuantumCircuit(1);
      applyKnownOperation(lhsCircuit, item.lhsOperation, pauliProductActions);
      applyKnownOperation(rhsCircuit, item.rhsOperation, pauliProductActions);

      const lhs = circuitMatrix(lhsCircuit);
      const rhs = circuitMatrix(rhsCircuit);
      const expectedLhs = normalizeMatrix(item.lhsMatrix);
      const expectedRhs = normalizeMatrix(item.rhsMatrix);

      for (let row = 0; row < lhs.length; row++) {
        for (let col = 0; col < matrixRow(lhs, row).length; col++) {
          const lhsValue = matrixAt(lhs, row, col);
          const rhsValue = matrixAt(rhs, row, col);

          closeComplexTo(lhsValue, matrixAt(expectedLhs, row, col), qsharpDumpTolerance);
          closeComplexTo(rhsValue, matrixAt(expectedRhs, row, col), qsharpDumpTolerance);
          closeComplexTo(lhsValue, { real: -rhsValue.real, imag: -rhsValue.imag }, qsharpDumpTolerance);
        }
      }
    }
  });

  test("treaty transcript integrity: TS, Q#, and F#/Analytic values match within tolerance", () => {
    expect(transcript.schema).toBe("zeta.qsharp.treaty-transcript.v1");

    const t = 1e-5;

    // Check CHSH corners
    const chsh = transcript.jobs.chshCorners;
    closeTo(chsh.sParameter.ts, chsh.sParameter.fsharpAnalytic, t);
    closeTo(chsh.sParameter.ts, chsh.sParameter.qsharp, 1e-4);

    for (const res of chsh.results) {
      closeTo(res.ts.pOpposite, res.fsharpAnalytic.pOpposite, t);
      closeTo(res.ts.pOpposite, res.qsharp.pOpposite, t);
      closeTo(res.ts.correlator, res.fsharpAnalytic.correlator, t);
      closeTo(res.ts.correlator, res.qsharp.correlator, t);

      const qsharp = chsh.qsharpCircuits[res.id as keyof typeof chsh.qsharpCircuits];
      expect(qsharp).toBeDefined();
      expect(qsharp).toContain("operation Circuit()");
    }

    // Check Bell coincidence
    for (const res of transcript.jobs.bellCoincidence.results) {
      closeTo(res.ts, res.fsharpAnalytic, t);
      closeTo(res.ts, res.qsharp, t);

      const qsharp = transcript.jobs.bellCoincidence.qsharpCircuits[res.id as keyof typeof transcript.jobs.bellCoincidence.qsharpCircuits];
      expect(qsharp).toBeDefined();
      expect(qsharp).toContain("operation Circuit()");
    }

    // Check Interference visibility
    for (const res of transcript.jobs.interferenceGrid.results) {
      closeTo(res.ts.Zero, res.fsharpAnalytic.Zero, t);
      closeTo(res.ts.Zero, res.qsharp.Zero, t);

      const qsharp = transcript.jobs.interferenceGrid.qsharpCircuits[res.id as keyof typeof transcript.jobs.interferenceGrid.qsharpCircuits];
      expect(qsharp).toBeDefined();
      expect(qsharp).toContain("operation Circuit()");
    }
  });
});
