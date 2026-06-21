import QuantumCircuit from "quantum-circuit";
function getProb(amp) {
    if (!amp)
        return 0;
    if (typeof amp === "number")
        return amp * amp;
    const c = amp;
    const re = c.re ?? c.real ?? 0;
    const im = c.im ?? c.imag ?? 0;
    return re * re + im * im;
}
export class QuantumObservableOracle {
    runSingleQubit(id, operation, theta) {
        const circuit = new QuantumCircuit(1);
        if (operation === "Zeta.ReferenceOracle.ApplyH") {
            circuit.appendGate("h", 0);
        }
        else if (operation === "Zeta.ReferenceOracle.ApplyRyPiOver3") {
            circuit.appendGate("ry", 0, { params: { theta: Math.PI / 3.0 } });
        }
        else if (operation === "Zeta.ReferenceOracle.ApplyRyPiOver2") {
            circuit.appendGate("ry", 0, { params: { theta: Math.PI / 2.0 } });
        }
        else if (theta !== undefined) {
            circuit.appendGate("ry", 0, { params: { theta } });
        }
        else {
            throw new Error(`Unknown single qubit operation: ${operation}`);
        }
        circuit.run();
        const probOne = circuit.probabilities()[0] ?? 0;
        const probZero = 1 - probOne;
        return {
            Id: id,
            Operation: operation,
            ThetaRadians: theta,
            Probabilities: { Zero: probZero, One: probOne },
        };
    }
    runCanonicalChsh(id, a, aPrime, b, bPrime) {
        const getCorr = (x, y) => {
            const circuit = new QuantumCircuit(2);
            circuit.appendGate("h", 0);
            circuit.appendGate("cx", [0, 1]);
            circuit.appendGate("ry", 0, { params: { theta: -x } });
            circuit.appendGate("ry", 1, { params: { theta: -y } });
            circuit.run();
            const p00 = getProb(circuit.state[0]);
            const p01 = getProb(circuit.state[1]);
            const p10 = getProb(circuit.state[2]);
            const p11 = getProb(circuit.state[3]);
            return p00 + p11 - (p01 + p10);
        };
        const eAB = getCorr(a, b);
        const eABPrime = getCorr(a, bPrime);
        const eAPrimeB = getCorr(aPrime, b);
        const eAPrimeBPrime = getCorr(aPrime, bPrime);
        const s = eAB - eABPrime + eAPrimeB + eAPrimeBPrime;
        return {
            Id: id,
            Angles: { A: a, APrime: aPrime, B: b, BPrime: bPrime },
            Correlators: { EAB: eAB, EABPrime: eABPrime, EAPrimeB: eAPrimeB, EAPrimeBPrime: eAPrimeBPrime },
            S: s,
            Tsirelson: 2 * Math.sqrt(2),
            ClassicalBound: 2.0,
        };
    }
    runSingletChsh(id, cornersInput) {
        const corners = cornersInput.map((corner) => {
            const a = corner.A ?? corner.a ?? 0;
            const b = corner.B ?? corner.b ?? 0;
            const coeff = corner.Coefficient ?? corner.coefficient ?? 1;
            const op = corner.Operation ?? corner.operation ?? "";
            const cid = corner.Id ?? corner.id ?? "";
            const circuit = new QuantumCircuit(2);
            circuit.appendGate("h", 0);
            circuit.appendGate("cx", [0, 1]);
            circuit.appendGate("x", 1);
            circuit.appendGate("z", 1);
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
            return {
                Id: cid,
                Operation: op,
                A: a,
                B: b,
                Coefficient: coeff,
                SameOutcomeProbability: pSame,
                OppositeOutcomeProbability: pOpposite,
                Correlator: correlator,
            };
        });
        const s = corners.reduce((acc, c) => acc + c.Coefficient * c.Correlator, 0);
        return {
            Id: id,
            Corners: corners,
            S: s,
            Analytic: 2 * Math.sqrt(2),
            ClassicalBound: 2.0,
        };
    }
    runBellCoincidence(id, state, operation, a, b, event) {
        const circuit = new QuantumCircuit(2);
        circuit.appendGate("h", 0);
        circuit.appendGate("cx", [0, 1]);
        if (state === "Singlet") {
            circuit.appendGate("x", 1);
            circuit.appendGate("z", 1);
        }
        circuit.appendGate("ry", 0, { params: { theta: -a } });
        circuit.appendGate("ry", 1, { params: { theta: -b } });
        circuit.run();
        const p00 = getProb(circuit.state[0]);
        const p01 = getProb(circuit.state[1]);
        const p10 = getProb(circuit.state[2]);
        const p11 = getProb(circuit.state[3]);
        const prob = event === "sameOutcome" ? p00 + p11 : p01 + p10;
        return {
            Id: id,
            State: state,
            Operation: operation,
            A: a,
            B: b,
            Event: event,
            Probability: prob,
        };
    }
    runInterferenceVisibility(id, operation, phase) {
        const circuit = new QuantumCircuit(1);
        if (operation.endsWith("ApplyMachZehnderOpen")) {
            circuit.appendGate("h", 0);
        }
        else if (operation.endsWith("ClosedZeroPhase")) {
            circuit.appendGate("h", 0);
            circuit.appendGate("h", 0);
        }
        else if (operation.endsWith("ClosedPiPhase")) {
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
            throw new Error(`Unknown Mach-Zehnder operation: ${operation}`);
        }
        circuit.run();
        const probOne = circuit.probabilities()[0] ?? 0;
        const probZero = 1 - probOne;
        return {
            Id: id,
            Operation: operation,
            PhaseRadians: phase,
            Probabilities: { Zero: probZero, One: probOne },
            Visibility: operation.endsWith("Open") ? undefined : 1.0,
        };
    }
    runFlowBitDistinction(id, operation, externalBit) {
        const circuit = new QuantumCircuit(1);
        circuit.appendGate("h", 0);
        if (externalBit) {
            circuit.appendGate("z", 0);
        }
        circuit.appendGate("h", 0);
        circuit.run();
        const probOne = circuit.probabilities()[0] ?? 0;
        const probZero = 1 - probOne;
        return {
            Id: id,
            Operation: operation,
            ExternalBit: externalBit,
            Probabilities: { Zero: probZero, One: probOne },
        };
    }
}
