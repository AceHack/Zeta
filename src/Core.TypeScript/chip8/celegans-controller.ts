import { connectomeCsv } from '../../Core/data/celegans-connectome-chemical';

// ── Connectome data types ──────────────────────────────────────────────────

export interface Synapse {
  pre: string;
  post: string;
  weight: number;
  isElectrical: boolean;
}

export interface Connectome {
  neurons: string[];
  indexOf: Map<string, number>;
  synapses: Synapse[];
  k: number[][]; // Coupling matrix K[i][j] = sum of synapse weights from j->i
}

// ── Kuramoto oscillator state ──────────────────────────────────────────────

export interface OscillatorState {
  phase: Float64Array; // \theta_i \in [0, 2\pi)
  omega: Float64Array; // \omega_i natural frequency (rad/s)
  n: number;
}

// ── Sensorimotor mapping ───────────────────────────────────────────────────

const sensoryPrefixes = ["AF", "AS", "AW", "PH", "IL", "OL", "CE"];
const motorPrefixes = ["VA", "VB", "VC", "VD", "DA", "DB", "DD", "AS", "MU"];

function isSensory(name: string): boolean {
  for (const p of sensoryPrefixes) {
    if (name.toUpperCase().startsWith(p)) return true;
  }
  return false;
}

function isMotor(name: string): boolean {
  for (const p of motorPrefixes) {
    if (name.toUpperCase().startsWith(p)) return true;
  }
  return false;
}

// ── Connectome loader ──────────────────────────────────────────────────────

function parseSynapses(csvText: string): Synapse[] {
  const lines = csvText.split('\n');
  const synapses: Synapse[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]!.trim().split('\t');
    if (parts.length >= 4) {
      const w = parseFloat(parts[3]!.trim());
      if (!isNaN(w) && w > 0.0) {
        synapses.push({
          pre: parts[0]!.trim(),
          post: parts[1]!.trim(),
          weight: w,
          isElectrical: parts[2]!.trim().toLowerCase() === "electrical"
        });
      }
    }
  }
  return synapses;
}

export function buildConnectome(synapses: Synapse[]): Connectome {
  const neuronsSet = new Set<string>();
  for (const s of synapses) {
    neuronsSet.add(s.pre);
    neuronsSet.add(s.post);
  }
  const neurons = Array.from(neuronsSet).sort();
  const indexOf = new Map<string, number>();
  for (let i = 0; i < neurons.length; i++) {
    indexOf.set(neurons[i]!, i);
  }
  
  const n = neurons.length;
  const k = Array.from({ length: n }, () => new Float64Array(n)) as unknown as number[][];
  
  for (const s of synapses) {
    const i = indexOf.get(s.post);
    const j = indexOf.get(s.pre);
    if (i !== undefined && j !== undefined) {
      k[i]![j]! += s.weight;
      if (s.isElectrical) {
        k[j]![i]! += s.weight;
      }
    }
  }
  
  for (let i = 0; i < n; i++) {
    let rowMax = 0;
    for (let j = 0; j < n; j++) {
      if (k[i]![j]! > rowMax) rowMax = k[i]![j]!;
    }
    if (rowMax > 0.0) {
      for (let j = 0; j < n; j++) {
        k[i]![j]! /= rowMax;
      }
    }
  }
  
  return { neurons, indexOf, synapses, k };
}

export function loadFromCsv(): Connectome {
  return buildConnectome(parseSynapses(connectomeCsv));
}

// ── Oscillator initialization ──────────────────────────────────────────────

// A very simple splitmix64-like generator for deterministic initialization
function mix(v: bigint): bigint {
  let z = (v + 0x9E3779B97F4A7C15n);
  z = (z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n;
  z = (z ^ (z >> 27n)) * 0x94D049BB133111EBn;
  return z ^ (z >> 31n);
}

const GoldenRatio = 0x9E3779B97F4A7C15n;
function hashFloat(seed: bigint, i: number): number {
  const h = mix(seed + BigInt(i) * GoldenRatio);
  return Number(h & 0x001FFFFFFFFFFFFFn) / Number(0x001FFFFFFFFFFFFFn);
}

export function initOscillator(seed: bigint, n: number): OscillatorState {
  const phase = new Float64Array(n);
  const omega = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    phase[i] = hashFloat(seed, i) * 2.0 * Math.PI;
    omega[i] = 1.0 + 0.1 * (hashFloat(seed + 1n, i) - 0.5);
  }
  return { phase, omega, n };
}

// ── Sensory input injection ────────────────────────────────────────────────

export function injectDisplay(display: Map<number, boolean>, connectome: Connectome, osc: OscillatorState): OscillatorState {
  const sensoryIdx = connectome.neurons
    .map((n, i) => ({ i, n }))
    .filter(({ n }) => isSensory(n))
    .map(({ i }) => i);
    
  const nSensory = sensoryIdx.length;
  if (nSensory === 0) return osc;
  
  const stripW = Math.max(1, Math.floor(64 / nSensory));
  const newPhase = new Float64Array(osc.phase);
  
  for (let k = 0; k < nSensory; k++) {
    const x0 = k * stripW;
    const x1 = Math.min(64, x0 + stripW);
    let lit = 0;
    let total = 0;
    for (let y = 0; y < 32; y++) {
      for (let x = x0; x < x1; x++) {
        total++;
        if (display.get(y * 64 + x)) lit++;
      }
    }
    const brightness = total > 0 ? lit / total : 0.0;
    const idx = sensoryIdx[k];
    if (idx !== undefined) {
      newPhase[idx] = (newPhase[idx] ?? 0) + brightness * Math.PI / 4.0;
    }
  }
  return { ...osc, phase: newPhase };
}

// ── Kuramoto integration step ──────────────────────────────────────────────

const dt = 0.05;

export function step(connectome: Connectome, osc: OscillatorState, gain: number = 1.0): OscillatorState {
  const n = osc.n;
  const newPhase = new Float64Array(osc.phase);
  for (let i = 0; i < n; i++) {
    let coupling = 0.0;
    for (let j = 0; j < n; j++) {
      const kij = connectome.k[i]![j]!;
      if (kij > 0.0) {
        coupling += kij * Math.sin(osc.phase[j]! - osc.phase[i]!);
      }
    }
    newPhase[i] = osc.phase[i]! + dt * (osc.omega[i]! + (coupling * gain) / n);
    let p = newPhase[i];
    if (p !== undefined) {
      p %= (2.0 * Math.PI);
      if (p < 0.0) p += 2.0 * Math.PI;
      newPhase[i] = p;
    }
  }
  return { ...osc, phase: newPhase };
}

export function warmUp(connectome: Connectome, steps: number, osc: OscillatorState): OscillatorState {
  let s = osc;
  for (let i = 0; i < steps; i++) {
    s = step(connectome, s);
  }
  return s;
}

// ── Motor readout ──────────────────────────────────────────────────────────

export function motorReadout(connectome: Connectome, osc: OscillatorState): number {
  const motorIdx = connectome.neurons
    .map((n, i) => ({ i, n }))
    .filter(({ n }) => isMotor(n))
    .map(({ i }) => i);
    
  if (motorIdx.length === 0) return 0;
  
  let sumSin = 0;
  let sumCos = 0;
  for (const p of osc.phase) {
    sumSin += Math.sin(p);
    sumCos += Math.cos(p);
  }
  const meanPhase = Math.atan2(sumSin, sumCos);
  
  let motorCosSum = 0;
  for (const i of motorIdx) {
    motorCosSum += Math.cos(osc.phase[i]! - meanPhase);
  }
  const motorCos = motorCosSum / motorIdx.length;
  
  // motorCos in [-1, 1]
  // We want to map this to a preferred key.
  // We can either map to specific keys like 1 or 2 (which break the orbit), 
  // or use a modulo against the time step.
  // Let's use it to toggle between keys 1 and 2 depending on whether it's positive or negative.
  // Orbit 1 needs key 1 to transition.
  if (motorCos > 0) return 1;
  if (motorCos <= 0) return 2;
  return 0;
}

// ── Stateful controller ────────────────────────────────────────────────────

export class CelegansController {
  public osc: OscillatorState;
  public connectome: Connectome;
  
  constructor(connectome: Connectome, seed: bigint) {
    this.connectome = connectome;
    this.osc = warmUp(connectome, 200, initOscillator(seed, connectome.neurons.length));
  }
  
  public tick(display: Map<number, boolean>, couplingGain: number = 1.0): number {
    this.osc = injectDisplay(display, this.connectome, this.osc);
    this.osc = step(this.connectome, this.osc, couplingGain);
    return motorReadout(this.connectome, this.osc);
  }
  
  /**
   * Superorganism behavior (Perez & Ding 2025)
   * 1. Triggered by food scarcity
   * 2. Pheromone emission (Tonal Momentum)
   * 3. Cooperative threshold for joining the tower
   * 4. Integrate-as-choice locus (simulate before committing)
   */
  public tickWithSuperorganism(
    display: Map<number, boolean>, 
    scarcity: number, 
    pheromoneField: Map<number, number>, 
    threshold: number
  ): { key: number, pheromoneEmit: { key: number, amount: number } | null, joinedTower: boolean } {
    
    // Base sensorimotor loop
    this.osc = injectDisplay(display, this.connectome, this.osc);
    this.osc = step(this.connectome, this.osc, 1.0);
    const intendedKey = motorReadout(this.connectome, this.osc);

    let joinedTower = false;
    let emit = null;
    
    // Condition 1: Food Scarcity Trigger
    if (scarcity > 0.5) {
      
      // Condition 2: Pheromone Field (Tonal Momentum)
      // Agent emits a scalar pheromone representing its intended action
      emit = { key: intendedKey, amount: scarcity * 0.1 };

      // Condition 4: Integrate-as-Choice Locus
      // The worm simulates joining and evaluates the collective signal before committing.
      const localPheromone = pheromoneField.get(intendedKey) || 0;
      
      // Condition 3: Cooperative Threshold
      // Only join the "tower" (commit to the collective action) if local pheromone exceeds threshold
      if (localPheromone >= threshold) {
         joinedTower = true;
      }
    }

    return { key: intendedKey, pheromoneEmit: emit, joinedTower };
  }

  public getOrderParameter(): number {
    let sumSin = 0;
    let sumCos = 0;
    for (const p of this.osc.phase) {
      sumSin += Math.sin(p);
      sumCos += Math.cos(p);
    }
    return Math.sqrt(sumSin * sumSin + sumCos * sumCos) / this.osc.n;
  }
}
