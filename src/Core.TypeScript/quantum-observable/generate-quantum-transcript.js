import { writeFileSync } from "fs";
import { join } from "path";
import { QuantumObservableOracle } from "./oracle";
const currentDir = import.meta.dir;
const outputPath = join(currentDir, "quantum-treaty-transcript.json");
const oracle = new QuantumObservableOracle();
// Batch 0: Insert all baseline quantum observable rows (weight = 1)
const batch0Deltas = [];
// 1. Single Qubit measurements
const singleQubitOps = [
    { id: "H|0>", operation: "Zeta.ReferenceOracle.ApplyH" },
    { id: "Ry(pi/3)|0>", operation: "Zeta.ReferenceOracle.ApplyRyPiOver3", theta: Math.PI / 3.0 },
    { id: "Ry(pi/2)|0>", operation: "Zeta.ReferenceOracle.ApplyRyPiOver2", theta: Math.PI / 2.0 },
];
for (const op of singleQubitOps) {
    const row = {
        type: "SingleQubit",
        value: oracle.runSingleQubit(op.id, op.operation, op.theta),
    };
    batch0Deltas.push({ row, weight: 1 });
}
// 2. Canonical CHSH
const chshRow = {
    type: "CanonicalChsh",
    value: oracle.runCanonicalChsh("BellPhiPlus canonical CHSH", 0.0, Math.PI / 2.0, Math.PI / 4.0, (3.0 * Math.PI) / 4.0),
};
batch0Deltas.push({ row: chshRow, weight: 1 });
// 3. Singlet CHSH
const corners = [
    {
        id: "E(a0,b0)",
        operation: "Zeta.ReferenceOracle.ApplyBellSingletChshA0B0",
        a: 0.0,
        b: Math.PI / 4.0,
        coefficient: 1,
    },
    {
        id: "E(a0,b1)",
        operation: "Zeta.ReferenceOracle.ApplyBellSingletChshA0B1",
        a: 0.0,
        b: -Math.PI / 4.0,
        coefficient: 1,
    },
    {
        id: "E(a1,b0)",
        operation: "Zeta.ReferenceOracle.ApplyBellSingletChshA1B0",
        a: Math.PI / 2.0,
        b: Math.PI / 4.0,
        coefficient: 1,
    },
    {
        id: "E(a1,b1)",
        operation: "Zeta.ReferenceOracle.ApplyBellSingletChshA1B1",
        a: Math.PI / 2.0,
        b: -Math.PI / 4.0,
        coefficient: -1,
    },
];
const singletRow = {
    type: "SingletChsh",
    value: oracle.runSingletChsh("BellSinglet CHSH corners", corners),
};
batch0Deltas.push({ row: singletRow, weight: 1 });
// 4. Singlet Corners (individually)
for (const corner of corners) {
    const cornersResult = oracle.runSingletChsh("BellSinglet CHSH corners", [corner]).Corners;
    const c = cornersResult[0];
    if (c === undefined) {
        throw new Error("Expected at least one corner in BellSinglet result");
    }
    const row = {
        type: "BellCorner",
        value: c,
    };
    batch0Deltas.push({ row, weight: 1 });
}
// 5. Bell Coincidences
const coincidences = [
    {
        id: "PhiPlus same-outcome a=0 b=pi/4",
        state: "PhiPlus",
        op: "Zeta.ReferenceOracle.ApplyBellPhiPlusAnalyzers",
        a: 0.0,
        b: Math.PI / 4.0,
        event: "sameOutcome",
    },
    {
        id: "Singlet opposite-outcome a=0 b=pi/4",
        state: "Singlet",
        op: "Zeta.ReferenceOracle.ApplyBellSingletAnalyzers",
        a: 0.0,
        b: Math.PI / 4.0,
        event: "oppositeOutcome",
    },
    {
        id: "PhiPlus same-outcome a=0 b=pi/2",
        state: "PhiPlus",
        op: "Zeta.ReferenceOracle.ApplyBellPhiPlusAnalyzers",
        a: 0.0,
        b: Math.PI / 2.0,
        event: "sameOutcome",
    },
    {
        id: "PhiPlus same-outcome a=0 b=pi",
        state: "PhiPlus",
        op: "Zeta.ReferenceOracle.ApplyBellPhiPlusAnalyzers",
        a: 0.0,
        b: Math.PI,
        event: "sameOutcome",
    },
];
for (const c of coincidences) {
    const row = {
        type: "BellCoincidence",
        value: oracle.runBellCoincidence(c.id, c.state, c.op, c.a, c.b, c.event),
    };
    batch0Deltas.push({ row, weight: 1 });
}
// 6. Interference Visibility (Mach-Zehnder)
const mzInterferences = [
    { id: "mach-zehnder-open", op: "Zeta.ReferenceOracle.ApplyMachZehnderOpen" },
    { id: "mach-zehnder-closed-zero-phase", op: "Zeta.ReferenceOracle.ApplyMachZehnderClosedZeroPhase", phase: 0.0 },
    {
        id: "mach-zehnder-closed-pi-over-3-phase",
        op: "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver3Phase",
        phase: Math.PI / 3.0,
    },
    {
        id: "mach-zehnder-closed-pi-over-2-phase",
        op: "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver2Phase",
        phase: Math.PI / 2.0,
    },
    {
        id: "mach-zehnder-closed-two-pi-over-3-phase",
        op: "Zeta.ReferenceOracle.ApplyMachZehnderClosedTwoPiOver3Phase",
        phase: (2.0 * Math.PI) / 3.0,
    },
    { id: "mach-zehnder-closed-pi-phase", op: "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiPhase", phase: Math.PI },
];
for (const mz of mzInterferences) {
    const row = {
        type: "InterferenceVisibility",
        value: oracle.runInterferenceVisibility(mz.id, mz.op, mz.phase),
    };
    batch0Deltas.push({ row, weight: 1 });
}
// Batch 1: Retract 2 Mach-Zehnder rows (weight = -1) and insert 1 new MZ row (weight = 1)
const batch1Deltas = [];
// Retract mach-zehnder-open
const mzOpenRetract = {
    type: "InterferenceVisibility",
    value: oracle.runInterferenceVisibility("mach-zehnder-open", "Zeta.ReferenceOracle.ApplyMachZehnderOpen"),
};
batch1Deltas.push({ row: mzOpenRetract, weight: -1 });
// Retract mach-zehnder-closed-zero-phase
const mzZeroRetract = {
    type: "InterferenceVisibility",
    value: oracle.runInterferenceVisibility("mach-zehnder-closed-zero-phase", "Zeta.ReferenceOracle.ApplyMachZehnderClosedZeroPhase", 0.0),
};
batch1Deltas.push({ row: mzZeroRetract, weight: -1 });
// Insert mach-zehnder-closed-pi-over-6-phase (new phase phase = pi/6)
const mzPiOver6Insert = {
    type: "InterferenceVisibility",
    value: oracle.runInterferenceVisibility("mach-zehnder-closed-pi-over-6-phase", "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver6Phase", // custom/arbitrary name ending
    Math.PI / 6.0),
};
batch1Deltas.push({ row: mzPiOver6Insert, weight: 1 });
const transcript = {
    schema: "zeta.quantum.zset-transcript.v1",
    metadata: {
        generatedBy: "src/Core.TypeScript/quantum-observable/generate-quantum-transcript.ts",
        timestamp: new Date().toISOString(),
    },
    batches: [
        {
            batchId: 0,
            deltas: batch0Deltas,
        },
        {
            batchId: 1,
            deltas: batch1Deltas,
        },
    ],
};
writeFileSync(outputPath, JSON.stringify(transcript, null, 2) + "\n", "utf-8");
console.log(`Successfully generated quantum-treaty-transcript.json at ${outputPath}`);
