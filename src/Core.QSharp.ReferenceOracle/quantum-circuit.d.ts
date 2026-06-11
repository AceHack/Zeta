declare module "quantum-circuit" {
  export default class QuantumCircuit {
    constructor(qubits: number);

    readonly state: readonly unknown[];

    appendGate(gate: string, wire: number | readonly number[], options?: { readonly params: readonly number[] }): void;

    circuitMatrix(): readonly (readonly unknown[])[];

    probabilities(): readonly number[];

    run(): void;
  }
}
