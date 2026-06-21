function compareStrings(a, b) {
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}
function compareNumbers(a, b) {
    if (a === undefined && b === undefined)
        return 0;
    if (a === undefined)
        return -1;
    if (b === undefined)
        return 1;
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}
function tagOrder(type) {
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
        case "FlowBitDistinction":
            return 6;
    }
}
function compareSingleQubit(va, vb) {
    let cmp = compareStrings(va.Operation, vb.Operation);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.ThetaRadians, vb.ThetaRadians);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.Probabilities.Zero, vb.Probabilities.Zero);
    if (cmp !== 0)
        return cmp;
    return compareNumbers(va.Probabilities.One, vb.Probabilities.One);
}
function compareCanonicalChsh(va, vb) {
    let cmp = compareNumbers(va.Angles.A, vb.Angles.A);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.Angles.APrime, vb.Angles.APrime);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.Angles.B, vb.Angles.B);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.Angles.BPrime, vb.Angles.BPrime);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.Correlators.EAB, vb.Correlators.EAB);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.Correlators.EABPrime, vb.Correlators.EABPrime);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.Correlators.EAPrimeB, vb.Correlators.EAPrimeB);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.Correlators.EAPrimeBPrime, vb.Correlators.EAPrimeBPrime);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.S, vb.S);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.Tsirelson, vb.Tsirelson);
    if (cmp !== 0)
        return cmp;
    return compareNumbers(va.ClassicalBound, vb.ClassicalBound);
}
function compareSingletChsh(va, vb) {
    let cmp = compareNumbers(va.S, vb.S);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.Analytic, vb.Analytic);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.ClassicalBound, vb.ClassicalBound);
    if (cmp !== 0)
        return cmp;
    const lenA = va.Corners.length;
    const lenB = vb.Corners.length;
    if (lenA !== lenB)
        return lenA - lenB;
    for (let i = 0; i < lenA; i++) {
        const ca = va.Corners[i];
        const cb = vb.Corners[i];
        if (ca === undefined || cb === undefined) {
            throw new Error("Out of bounds index in corners comparison");
        }
        const cmpC = compareBellCorner(ca, cb);
        if (cmpC !== 0)
            return cmpC;
    }
    return 0;
}
function compareBellCorner(va, vb) {
    let cmp = compareStrings(va.Id, vb.Id);
    if (cmp !== 0)
        return cmp;
    cmp = compareStrings(va.Operation, vb.Operation);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.A, vb.A);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.B, vb.B);
    if (cmp !== 0)
        return cmp;
    cmp = va.Coefficient - vb.Coefficient;
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.SameOutcomeProbability, vb.SameOutcomeProbability);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.OppositeOutcomeProbability, vb.OppositeOutcomeProbability);
    if (cmp !== 0)
        return cmp;
    return compareNumbers(va.Correlator, vb.Correlator);
}
function compareBellCoincidence(va, vb) {
    let cmp = compareStrings(va.State, vb.State);
    if (cmp !== 0)
        return cmp;
    cmp = compareStrings(va.Operation, vb.Operation);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.A, vb.A);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.B, vb.B);
    if (cmp !== 0)
        return cmp;
    cmp = compareStrings(va.Event, vb.Event);
    if (cmp !== 0)
        return cmp;
    return compareNumbers(va.Probability, vb.Probability);
}
function compareInterferenceVisibility(va, vb) {
    let cmp = compareStrings(va.Operation, vb.Operation);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.PhaseRadians, vb.PhaseRadians);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.Probabilities.Zero, vb.Probabilities.Zero);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.Probabilities.One, vb.Probabilities.One);
    if (cmp !== 0)
        return cmp;
    return compareNumbers(va.Visibility, vb.Visibility);
}
function compareBooleans(a, b) {
    if (a === b)
        return 0;
    return a ? 1 : -1;
}
function compareFlowBitDistinction(va, vb) {
    let cmp = compareStrings(va.Operation, vb.Operation);
    if (cmp !== 0)
        return cmp;
    cmp = compareBooleans(va.ExternalBit, vb.ExternalBit);
    if (cmp !== 0)
        return cmp;
    cmp = compareNumbers(va.Probabilities.Zero, vb.Probabilities.Zero);
    if (cmp !== 0)
        return cmp;
    return compareNumbers(va.Probabilities.One, vb.Probabilities.One);
}
export function compareQuantumObservableRow(a, b) {
    if (a.type !== b.type) {
        return tagOrder(a.type) - tagOrder(b.type);
    }
    // Compare Ids first
    const idA = a.value.Id;
    const idB = b.value.Id;
    const cmpId = compareStrings(idA, idB);
    if (cmpId !== 0)
        return cmpId;
    // Compare other fields depending on tag
    switch (a.type) {
        case "SingleQubit":
            return compareSingleQubit(a.value, b.value);
        case "CanonicalChsh":
            return compareCanonicalChsh(a.value, b.value);
        case "SingletChsh":
            return compareSingletChsh(a.value, b.value);
        case "BellCorner":
            return compareBellCorner(a.value, b.value);
        case "BellCoincidence":
            return compareBellCoincidence(a.value, b.value);
        case "InterferenceVisibility":
            return compareInterferenceVisibility(a.value, b.value);
        case "FlowBitDistinction":
            return compareFlowBitDistinction(a.value, b.value);
    }
}
