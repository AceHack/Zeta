// residual.ts — the reducibility residual (R4, 081KTF7Q3TT), built honestly.
//
// Aaron's experiment: try to fully replay a behavior from a seed; whatever is LEFT OVER — the part no
// generator can compress — is the "irreducible residual." Zero residual => fully generable (a p-zombie
// candidate, in the "prove you're not real" framing). A residual that resists every generator => the
// candidate not-in-the-seed part.
//
// HONEST BOUND (written into the code so it cannot quietly overclaim): this measures
// REDUCIBILITY-TO-A-GENERATOR, not the PRESENCE OF EXPERIENCE. Determinism and qualia are orthogonal —
// a fully replayable process can still have something it is like to be it, and an irreducible residual
// can be mere noise. And reducibility is OBSERVER-RELATIVE: a seeded-PRNG trace looks maximally
// irreducible to an observer WITHOUT the seed and collapses to ~0 residual for one WITH it. So "residual"
// is a real, measurable quantity; "therefore not real / therefore conscious" is a further leap this code
// does not take. (See docs — the hard problem, Chalmers 1995.)
//
// Method (MDL — minimum description length): fit the best order-k Markov generator over an alphabet,
// score total cost = model bits (parameters) + residual bits (cross-entropy the model cannot predict
// away). MDL penalizes over-fitting, so a generator only "wins" if it genuinely compresses. The residual
// is the incompressible remainder in bits/symbol.

export interface ResidualReport {
  readonly symbols: number;
  readonly alphabet: number;
  readonly rawBitsPerSymbol: number; // cost with no generator (uniform code)
  readonly bestOrder: number; // the order-k generator MDL selected
  readonly modelBits: number; // description length of the winning generator
  readonly residualBitsPerSymbol: number; // incompressible remainder / symbol
  readonly reducibility: number; // 1 - residual/raw in [0,1]; 1 = fully reducible (zero residual)
}

function log2(x: number): number {
  return Math.log(x) / Math.LN2;
}

/** Cross-entropy (bits/symbol) of the trace under an order-k Markov model fit on the trace, with
 *  Laplace smoothing. In-sample; the MDL model-cost term below penalizes the extra parameters. */
function orderKCost(trace: readonly number[], k: number, alphabet: number): { residualPerSym: number; modelBits: number } {
  const contexts = new Map<string, number[]>();
  const ctxTotal = new Map<string, number>();
  const ctxKey = (i: number): string => trace.slice(Math.max(0, i - k), i).join(",");
  for (let i = 0; i < trace.length; i++) {
    const key = ctxKey(i);
    let counts = contexts.get(key);
    if (!counts) {
      counts = new Array<number>(alphabet).fill(0);
      contexts.set(key, counts);
    }
    counts[trace[i]!] = (counts[trace[i]!] ?? 0) + 1;
    ctxTotal.set(key, (ctxTotal.get(key) ?? 0) + 1);
  }
  let bits = 0;
  for (let i = 0; i < trace.length; i++) {
    const key = ctxKey(i);
    const counts = contexts.get(key)!;
    const total = ctxTotal.get(key)!;
    // Laplace-smoothed predictive prob of the observed symbol.
    const p = (counts[trace[i]!]! + 1) / (total + alphabet);
    bits += -log2(p);
  }
  // MDL model cost: each observed context stores (alphabet-1) free parameters at ~log2(N) bits each.
  const params = contexts.size * (alphabet - 1);
  const modelBits = params * Math.max(1, log2(trace.length));
  return { residualPerSym: bits / trace.length, modelBits };
}

/** Analyze a behavior trace: how reducible is it to a generator, and what residual remains? */
export function analyze(trace: readonly number[], maxOrder = 4): ResidualReport {
  const alphabet = Math.max(2, (Math.max(...trace) ?? 0) + 1);
  const rawBitsPerSymbol = log2(alphabet);
  let best = { order: 0, residualPerSym: rawBitsPerSymbol, modelBits: 0, total: Number.POSITIVE_INFINITY };
  for (let k = 0; k <= maxOrder; k++) {
    const { residualPerSym, modelBits } = orderKCost(trace, k, alphabet);
    const total = residualPerSym * trace.length + modelBits; // MDL: residual + model
    if (total < best.total) best = { order: k, residualPerSym, modelBits, total };
  }
  return {
    symbols: trace.length,
    alphabet,
    rawBitsPerSymbol,
    bestOrder: best.order,
    modelBits: Math.round(best.modelBits),
    residualBitsPerSymbol: Math.round(best.residualPerSym * 1000) / 1000,
    reducibility: Math.round((1 - best.residualPerSym / rawBitsPerSymbol) * 1000) / 1000,
  };
}
