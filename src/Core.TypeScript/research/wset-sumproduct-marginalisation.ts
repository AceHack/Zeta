// PROBE: is discrete sum-product (factor product + marginalisation) exactly
// WSet.tensor -> WSet.mapKeys -> WSet.consolidate, using only the shipped ops?
import { consolidateWSet, tensorWSet, type WSet, type StarRing } from "../algebra/wset.ts";

const ProbRing: StarRing<number> = {
  zero: 0, one: 1,
  add: (a: number, b: number) => a + b,
  mul: (a: number, b: number) => a * b,
  negate: (a: number) => -a,
};
const isZero = (w: number) => w === 0;
// WSet.mapKeys (src/Core/WSet.fs) — deterministic re-keying
// NOTE: consolidateWSet does NOT sort by key (open workitem 081M05ZZG6A) - sort here.
const sortW = <W,>(s: WSet<string, W>) => [...s].sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
const mapKeys = <K, K2, W>(g: (k: K) => K2, s: WSet<K, W>): WSet<K2, W> => s.map((e) => ({ key: g(e.key), weight: e.weight }));

let seed = 13579;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

let worst = 0;
for (let t = 0; t < 3000; t++) {
  const A = 3, B = 3;
  const fa: WSet<string, number> = Array.from({ length: A }, (_, i) => ({ key: `a${i}`, weight: rnd() }));
  const fb: WSet<string, number> = Array.from({ length: B }, (_, i) => ({ key: `b${i}`, weight: rnd() }));

  // via the shipped WSet ops: factor product = tensor; marginalise out B = mapKeys(fst) then consolidate
  const joint = tensorWSet(ProbRing, fa, fb);                                   // ⊗
  const marg = sortW(consolidateWSet(ProbRing, isZero, (k: string) => k, mapKeys(([a]: [string, string]) => a, joint))); // Σ_b

  // the textbook direct computation: m(a) = f_a(a) * Σ_b f_b(b)
  const sumB = fb.reduce((s, e) => s + e.weight, 0);
  const direct = fa.map((e) => ({ key: e.key, weight: e.weight * sumB })).sort((x, y) => (x.key < y.key ? -1 : 1));

  for (let i = 0; i < direct.length; i++) {
    const m = marg[i], d = direct[i];
    if (m === undefined || d === undefined) throw new Error("length mismatch");
    worst = Math.max(worst, Math.abs(m.weight - d.weight));
  }
}
console.log(`D  sum-product marginalisation == tensor -> mapKeys -> consolidate`);
console.log(`D  max abs diff = ${worst.toExponential(3)} over 3000 random 3x3 factor pairs`);
console.log(`D  verdict: ${worst < 1e-15 ? "HOLDS — marginalisation is already WSet's consolidate" : "DIFFERS"}`);

// SABOTAGE: marginalise the WRONG coordinate; must differ.
let sab = 0;
for (let t = 0; t < 300; t++) {
  const fa: WSet<string, number> = Array.from({ length: 3 }, (_, i) => ({ key: `a${i}`, weight: rnd() }));
  const fb: WSet<string, number> = Array.from({ length: 3 }, (_, i) => ({ key: `b${i}`, weight: rnd() }));
  const joint = tensorWSet(ProbRing, fa, fb);
  const wrong = sortW(consolidateWSet(ProbRing, isZero, (k: string) => k, mapKeys(([, b]: [string, string]) => b, joint)));
  const sumB = fb.reduce((s, e) => s + e.weight, 0);
  const direct = fa.map((e) => ({ key: e.key, weight: e.weight * sumB })).sort((x, y) => (x.key < y.key ? -1 : 1));
  for (let i = 0; i < direct.length; i++) {
    const w = wrong[i], d = direct[i];
    if (w === undefined || d === undefined) continue;
    sab = Math.max(sab, Math.abs(w.weight - d.weight));
  }
}
console.log(`D' sabotage control (marginalise wrong axis): max abs diff = ${sab.toExponential(3)} — ${sab > 1e-12 ? "PROBE CAN FAIL (control passes)" : "PROBE IS VACUOUS"}`);
