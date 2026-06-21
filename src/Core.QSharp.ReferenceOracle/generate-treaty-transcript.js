import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import QuantumCircuit from "quantum-circuit";
// Path resolution
const currentDir = import.meta.dir;
const goldenPath = join(currentDir, "qsharp-golden.json");
const outputPath = join(currentDir, "treaty-transcript.json");
// Read qsharp-golden.json
const goldenRaw = readFileSync(goldenPath, "utf-8");
const golden = JSON.parse(goldenRaw);
const tolerance = 1e-5;
function getProb(amp) {
    if (!amp)
        return 0;
    if (typeof amp === "number")
        return amp * amp;
    const c = amp;
    return c.re * c.re + c.im * c.im;
}
// 1. CHSH Corners Job
const chshResults = [];
let tsChshS = 0;
const chshQSharpCodeMap = {};
for (const corner of golden.vectors.bellChsh.singletCorners.corners) {
    const { a, b } = corner.anglesRadians;
    const circuit = new QuantumCircuit(2);
    // Prepare Singlet State (PsiMinus)
    circuit.appendGate("h", 0);
    circuit.appendGate("cx", [0, 1]);
    circuit.appendGate("x", 1);
    circuit.appendGate("z", 1);
    // Apply analyzers
    circuit.appendGate("ry", 0, { params: { theta: -a } });
    circuit.appendGate("ry", 1, { params: { theta: -b } });
    circuit.run();
    const p00 = getProb(circuit.state[0]);
    const p01 = getProb(circuit.state[1]);
    const p10 = getProb(circuit.state[2]);
    const p11 = getProb(circuit.state[3]);
    const pSame = p00 + p11;
    const pOpposite = p01 + p10;
    const correlator = pOpposite - pSame;
    tsChshS += corner.coefficient * correlator;
    // Compute F# / Analytic expected values
    const fsharpOpposite = Math.cos((a - b) / 2) ** 2;
    const fsharpSame = 1 - fsharpOpposite;
    const fsharpCorrelator = Math.cos(a - b);
    // Assert TS vs Q# vs F#/Analytic are within tolerance
    if (Math.abs(pOpposite - corner.oppositeOutcomeProbability) > tolerance) {
        throw new Error(`CHSH TS/Q# mismatch on ${corner.id}`);
    }
    if (Math.abs(pOpposite - fsharpOpposite) > tolerance) {
        throw new Error(`CHSH TS/Analytic mismatch on ${corner.id}`);
    }
    const qsharpExport = circuit.exportToQSharp();
    chshQSharpCodeMap[corner.id] = qsharpExport;
    chshResults.push({
        id: corner.id,
        operation: corner.operation,
        angles: { a, b, delta: a - b },
        coefficient: corner.coefficient,
        ts: {
            probabilities: { "|00>": p00, "|01>": p01, "|10>": p10, "|11>": p11 },
            pSame,
            pOpposite,
            correlator,
        },
        qsharp: {
            pSame: corner.sameOutcomeProbability,
            pOpposite: corner.oppositeOutcomeProbability,
            correlator: corner.correlator,
        },
        fsharpAnalytic: {
            pSame: fsharpSame,
            pOpposite: fsharpOpposite,
            correlator: fsharpCorrelator,
        },
    });
}
// 2. Bell Coincidence Probability Job
const coincidenceResults = [];
const coincidenceQSharpCodeMap = {};
for (const v of golden.vectors.bellCoincidence) {
    const { a, b } = v.anglesRadians;
    const circuit = new QuantumCircuit(2);
    // Prepare state depending on state type
    circuit.appendGate("h", 0);
    circuit.appendGate("cx", [0, 1]);
    if (v.state === "Singlet") {
        circuit.appendGate("x", 1);
        circuit.appendGate("z", 1);
    }
    // Apply analyzers
    circuit.appendGate("ry", 0, { params: { theta: -a } });
    circuit.appendGate("ry", 1, { params: { theta: -b } });
    circuit.run();
    const p00 = getProb(circuit.state[0]);
    const p01 = getProb(circuit.state[1]);
    const p10 = getProb(circuit.state[2]);
    const p11 = getProb(circuit.state[3]);
    const tsProb = v.event === "sameOutcome" ? p00 + p11 : p01 + p10;
    const fsharpProb = Math.cos((a - b) / 2) ** 2;
    if (Math.abs(tsProb - v.probability) > tolerance) {
        throw new Error(`Coincidence TS/Q# mismatch on ${v.id}`);
    }
    if (Math.abs(tsProb - fsharpProb) > tolerance) {
        throw new Error(`Coincidence TS/Analytic mismatch on ${v.id}`);
    }
    const qsharpExport = circuit.exportToQSharp();
    coincidenceQSharpCodeMap[v.id] = qsharpExport;
    coincidenceResults.push({
        id: v.id,
        state: v.state,
        operation: v.operation,
        angles: { a, b, delta: a - b },
        event: v.event,
        ts: tsProb,
        qsharp: v.probability,
        fsharpAnalytic: fsharpProb,
    });
}
// 3. Interference Grid Job
const interferenceResults = [];
const interferenceQSharpCodeMap = {};
for (const v of golden.vectors.interferenceVisibility) {
    const circuit = new QuantumCircuit(1);
    const phase = v.phaseRadians;
    if (v.operation.endsWith("ApplyMachZehnderOpen")) {
        circuit.appendGate("h", 0);
    }
    else if (v.operation.endsWith("ClosedZeroPhase")) {
        circuit.appendGate("h", 0);
        circuit.appendGate("h", 0);
    }
    else if (v.operation.endsWith("ClosedPiPhase")) {
        circuit.appendGate("h", 0);
        circuit.appendGate("z", 0);
        circuit.appendGate("h", 0);
    }
    else if (phase !== undefined) {
        circuit.appendGate("h", 0);
        circuit.appendGate("rz", 0, { params: { phi: phase } });
        circuit.appendGate("h", 0);
    }
    else {
        throw new Error(`Unknown Mach-Zehnder operation: ${v.operation}`);
    }
    circuit.run();
    const probOne = circuit.probabilities()[0] ?? 0;
    const probZero = 1 - probOne;
    let fsharpZero = 0.5;
    if (phase !== undefined) {
        fsharpZero = Math.cos(phase / 2) ** 2;
    }
    else if (!v.operation.endsWith("Open")) {
        fsharpZero = 1.0;
    }
    const fsharpOne = 1 - fsharpZero;
    if (Math.abs(probZero - v.probabilities.Zero) > tolerance) {
        throw new Error(`Interference TS/Q# mismatch on ${v.id}`);
    }
    if (Math.abs(probZero - fsharpZero) > tolerance) {
        throw new Error(`Interference TS/Analytic mismatch on ${v.id}`);
    }
    const qsharpExport = circuit.exportToQSharp();
    interferenceQSharpCodeMap[v.id] = qsharpExport;
    interferenceResults.push({
        id: v.id,
        operation: v.operation,
        phase: phase ?? null,
        ts: { Zero: probZero, One: probOne },
        qsharp: v.probabilities,
        fsharpAnalytic: { Zero: fsharpZero, One: fsharpOne },
    });
}
// Create Treaty Transcript JSON object
const transcript = {
    schema: "zeta.qsharp.treaty-transcript.v1",
    metadata: {
        generatedBy: "src/Core.QSharp.ReferenceOracle/generate-treaty-transcript.ts",
        timestamp: new Date().toISOString(),
        tolerances: {
            chsh: tolerance,
            coincidence: tolerance,
            interference: tolerance,
        },
    },
    jobs: {
        chshCorners: {
            sParameter: {
                ts: tsChshS,
                qsharp: golden.vectors.bellChsh.singletCorners.s,
                fsharpAnalytic: golden.vectors.bellChsh.singletCorners.analytic,
            },
            results: chshResults,
            qsharpCircuits: chshQSharpCodeMap,
        },
        bellCoincidence: {
            results: coincidenceResults,
            qsharpCircuits: coincidenceQSharpCodeMap,
        },
        interferenceGrid: {
            results: interferenceResults,
            qsharpCircuits: interferenceQSharpCodeMap,
        },
    },
};
writeFileSync(outputPath, JSON.stringify(transcript, null, 2) + "\n", "utf-8");
console.log(`Successfully generated treaty-transcript.json at ${outputPath}`);
