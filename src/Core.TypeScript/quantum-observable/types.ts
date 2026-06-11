export interface Probabilities {
  readonly Zero: number;
  readonly One: number;
}

export interface SingleQubitMeasurement {
  readonly Id: string;
  readonly Operation: string;
  readonly ThetaRadians?: number | undefined;
  readonly Probabilities: Probabilities;
}

export interface ChshAngles {
  readonly A: number;
  readonly APrime: number;
  readonly B: number;
  readonly BPrime: number;
}

export interface ChshCorrelators {
  readonly EAB: number;
  readonly EABPrime: number;
  readonly EAPrimeB: number;
  readonly EAPrimeBPrime: number;
}

export interface CanonicalChsh {
  readonly Id: string;
  readonly Angles: ChshAngles;
  readonly Correlators: ChshCorrelators;
  readonly S: number;
  readonly Tsirelson: number;
  readonly ClassicalBound: number;
}

export interface BellCorner {
  readonly Id: string;
  readonly Operation: string;
  readonly A: number;
  readonly B: number;
  readonly Coefficient: number;
  readonly SameOutcomeProbability: number;
  readonly OppositeOutcomeProbability: number;
  readonly Correlator: number;
}

export interface SingletChsh {
  readonly Id: string;
  readonly Corners: readonly BellCorner[];
  readonly S: number;
  readonly Analytic: number;
  readonly ClassicalBound: number;
}

export interface BellCoincidence {
  readonly Id: string;
  readonly State: string;
  readonly Operation: string;
  readonly A: number;
  readonly B: number;
  readonly Event: string;
  readonly Probability: number;
}

export interface InterferenceVisibility {
  readonly Id: string;
  readonly Operation: string;
  readonly PhaseRadians?: number | undefined;
  readonly Probabilities: Probabilities;
  readonly Visibility?: number | undefined;
}

export type QuantumObservableRow =
  | { readonly type: "SingleQubit"; readonly value: SingleQubitMeasurement }
  | { readonly type: "CanonicalChsh"; readonly value: CanonicalChsh }
  | { readonly type: "SingletChsh"; readonly value: SingletChsh }
  | { readonly type: "BellCorner"; readonly value: BellCorner }
  | { readonly type: "BellCoincidence"; readonly value: BellCoincidence }
  | { readonly type: "InterferenceVisibility"; readonly value: InterferenceVisibility };

export interface QuantumObservableDelta {
  readonly row: QuantumObservableRow;
  readonly weight: number;
}

export interface QuantumObservableBatch {
  readonly batchId: number;
  readonly deltas: readonly QuantumObservableDelta[];
}

export interface QuantumObservableTranscript {
  readonly schema: string;
  readonly metadata?: {
    readonly generatedBy: string;
    readonly timestamp: string;
  };
  readonly batches: readonly QuantumObservableBatch[];
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareNumbers(a?: number, b?: number): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function tagOrder(type: QuantumObservableRow["type"]): number {
  switch (type) {
    case "SingleQubit":
      return 0;
    case "CanonicalChsh":
      return 1;
    case "SingletChsh":
      return 2;
    case "BellCorner":
      return 3;
    case "BellCoincidence":
      return 4;
    case "InterferenceVisibility":
      return 5;
  }
}

export function compareQuantumObservableRow(a: QuantumObservableRow, b: QuantumObservableRow): number {
  if (a.type !== b.type) {
    return tagOrder(a.type) - tagOrder(b.type);
  }

  // Compare Ids first
  const idA = a.value.Id;
  const idB = b.value.Id;
  const cmpId = compareStrings(idA, idB);
  if (cmpId !== 0) return cmpId;

  // Compare other fields depending on tag
  switch (a.type) {
    case "SingleQubit": {
      const va = a.value;
      const vb = b.value as SingleQubitMeasurement;
      let cmp = compareStrings(va.Operation, vb.Operation);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.ThetaRadians, vb.ThetaRadians);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.Probabilities.Zero, vb.Probabilities.Zero);
      if (cmp !== 0) return cmp;
      return compareNumbers(va.Probabilities.One, vb.Probabilities.One);
    }
    case "CanonicalChsh": {
      const va = a.value;
      const vb = b.value as CanonicalChsh;
      let cmp = compareNumbers(va.Angles.A, vb.Angles.A);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.Angles.APrime, vb.Angles.APrime);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.Angles.B, vb.Angles.B);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.Angles.BPrime, vb.Angles.BPrime);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.Correlators.EAB, vb.Correlators.EAB);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.Correlators.EABPrime, vb.Correlators.EABPrime);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.Correlators.EAPrimeB, vb.Correlators.EAPrimeB);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.Correlators.EAPrimeBPrime, vb.Correlators.EAPrimeBPrime);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.S, vb.S);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.Tsirelson, vb.Tsirelson);
      if (cmp !== 0) return cmp;
      return compareNumbers(va.ClassicalBound, vb.ClassicalBound);
    }
    case "SingletChsh": {
      const va = a.value;
      const vb = b.value as SingletChsh;
      let cmp = compareNumbers(va.S, vb.S);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.Analytic, vb.Analytic);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.ClassicalBound, vb.ClassicalBound);
      if (cmp !== 0) return cmp;
      const lenA = va.Corners.length;
      const lenB = vb.Corners.length;
      if (lenA !== lenB) return lenA - lenB;
      for (let i = 0; i < lenA; i++) {
        const ca = va.Corners[i]!;
        const cb = vb.Corners[i]!;
        let cmpC = compareStrings(ca.Id, cb.Id);
        if (cmpC !== 0) return cmpC;
        cmpC = compareStrings(ca.Operation, cb.Operation);
        if (cmpC !== 0) return cmpC;
        cmpC = compareNumbers(ca.A, cb.A);
        if (cmpC !== 0) return cmpC;
        cmpC = compareNumbers(ca.B, cb.B);
        if (cmpC !== 0) return cmpC;
        cmpC = ca.Coefficient - cb.Coefficient;
        if (cmpC !== 0) return cmpC;
        cmpC = compareNumbers(ca.SameOutcomeProbability, cb.SameOutcomeProbability);
        if (cmpC !== 0) return cmpC;
        cmpC = compareNumbers(ca.OppositeOutcomeProbability, cb.OppositeOutcomeProbability);
        if (cmpC !== 0) return cmpC;
        cmpC = compareNumbers(ca.Correlator, cb.Correlator);
        if (cmpC !== 0) return cmpC;
      }
      return 0;
    }
    case "BellCorner": {
      const va = a.value;
      const vb = b.value as BellCorner;
      let cmp = compareStrings(va.Operation, vb.Operation);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.A, vb.A);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.B, vb.B);
      if (cmp !== 0) return cmp;
      cmp = va.Coefficient - vb.Coefficient;
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.SameOutcomeProbability, vb.SameOutcomeProbability);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.OppositeOutcomeProbability, vb.OppositeOutcomeProbability);
      if (cmp !== 0) return cmp;
      return compareNumbers(va.Correlator, vb.Correlator);
    }
    case "BellCoincidence": {
      const va = a.value;
      const vb = b.value as BellCoincidence;
      let cmp = compareStrings(va.State, vb.State);
      if (cmp !== 0) return cmp;
      cmp = compareStrings(va.Operation, vb.Operation);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.A, vb.A);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.B, vb.B);
      if (cmp !== 0) return cmp;
      cmp = compareStrings(va.Event, vb.Event);
      if (cmp !== 0) return cmp;
      return compareNumbers(va.Probability, vb.Probability);
    }
    case "InterferenceVisibility": {
      const va = a.value;
      const vb = b.value as InterferenceVisibility;
      let cmp = compareStrings(va.Operation, vb.Operation);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.PhaseRadians, vb.PhaseRadians);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.Probabilities.Zero, vb.Probabilities.Zero);
      if (cmp !== 0) return cmp;
      cmp = compareNumbers(va.Probabilities.One, vb.Probabilities.One);
      if (cmp !== 0) return cmp;
      return compareNumbers(va.Visibility, vb.Visibility);
    }
  }
}
