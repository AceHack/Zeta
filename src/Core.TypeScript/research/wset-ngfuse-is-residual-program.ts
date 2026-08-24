// PROBE: is the shipped `ngFuse` (hand-written, 4 named fields) extensionally
// equal to the generic `WeightedSet.add` specialised to the 4-element key set?
// If YES: ngFuse is the RESIDUAL PROGRAM of a first-Futamura specialisation that
// nobody ran — the output shape without the projection.
import { ngFuse, ngToNp, type NormalGammaNp } from "../bayesian/toy-bnn-rgba-codec.ts";

// --- a generic WeightedSet over an additive semiring, mirroring src/Core/WeightedSet.fs
type Semiring<W> = { zero: W; add: (a: W, b: W) => W };
const RealAdd: Semiring<number> = { zero: 0, add: (a, b) => a + b };

type WeightedSet<K extends string, W> = ReadonlyMap<K, W>;

function wsOfSeq<K extends string, W>(sr: Semiring<W>, pairs: readonly (readonly [K, W])[]): WeightedSet<K, W> {
  const m = new Map<K, W>();
  for (const [k, w] of pairs) {
    const cur = m.has(k) ? (m.get(k) as W) : sr.zero;
    const nw = sr.add(cur, w);
    if (nw === sr.zero) m.delete(k); else m.set(k, nw);   // Zero-pruning, as WeightedSet.fs setW
  }
  return m;
}
function wsAdd<K extends string, W>(sr: Semiring<W>, a: WeightedSet<K, W>, b: WeightedSet<K, W>): WeightedSet<K, W> {
  const m = new Map(a);
  for (const [k, w] of b) {
    const cur = m.has(k) ? (m.get(k) as W) : sr.zero;
    const nw = sr.add(cur, w);
    if (nw === sr.zero) m.delete(k); else m.set(k, nw);
  }
  return m;
}

// --- the embedding h : NormalGammaNp -> WeightedSet<NatCoord, R>, |K| = 4
type NatCoord = "h1" | "h2" | "h3" | "h4";
const COORDS: readonly NatCoord[] = ["h1", "h2", "h3", "h4"];
const h = (p: NormalGammaNp): WeightedSet<NatCoord, number> =>
  wsOfSeq(RealAdd, COORDS.map((c) => [c, p[c]] as const));
const hInv = (w: WeightedSet<NatCoord, number>): NormalGammaNp => ({
  h1: w.get("h1") ?? 0, h2: w.get("h2") ?? 0, h3: w.get("h3") ?? 0, h4: w.get("h4") ?? 0,
});

// --- the falsifier
let seed = 20260824;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const randNp = (): NormalGammaNp => ngToNp({
  m: (rnd() - 0.5) * 20, lambda: rnd() * 10 + 0.01,
  alpha: rnd() * 10 + 0.51, beta: rnd() * 10 + 0.01,
});

let worst = 0, n = 0;
for (let i = 0; i < 20000; i++) {
  const a = randNp(), b = randNp();
  const direct = ngFuse(a, b);                              // the SHIPPED hand-written op
  const viaWSet = hInv(wsAdd(RealAdd, h(a), h(b)));         // the GENERIC op, specialised by |K|=4
  for (const c of COORDS) worst = Math.max(worst, Math.abs(direct[c] - viaWSet[c]));
  n++;
}
console.log(`A  ngFuse == WeightedSet.add over |K|=4 : max abs diff = ${worst.toExponential(3)} over ${n} pairs`);
console.log(`A  verdict: ${worst === 0 ? "BIT-IDENTICAL — ngFuse IS the residual program" : "DIFFERS"}`);

// --- SABOTAGE CONTROL: the probe must be able to fail.
const wsAddSabotaged = <K extends string>(a: WeightedSet<K, number>, b: WeightedSet<K, number>): WeightedSet<K, number> => {
  const m = new Map(a);
  for (const [k, w] of b) m.set(k, (m.get(k) ?? 0) + w * 1.0000001);
  return m;
};
let sabWorst = 0;
for (let i = 0; i < 1000; i++) {
  const a = randNp(), b = randNp();
  const direct = ngFuse(a, b);
  const sab = hInv(wsAddSabotaged(h(a), h(b)));
  for (const c of COORDS) sabWorst = Math.max(sabWorst, Math.abs(direct[c] - sab[c]));
}
console.log(`A' sabotage control (weight x1.0000001): max abs diff = ${sabWorst.toExponential(3)} — ${sabWorst > 0 ? "PROBE CAN FAIL (control passes)" : "PROBE IS VACUOUS"}`);

// --- identity: h(uniform) = empty  (Zero-pruning gives identity->identity)
const uniform: NormalGammaNp = { h1: 0, h2: 0, h3: 0, h4: 0 };
console.log(`B  h(uniform) size = ${h(uniform).size} (expect 0 = WeightedSet.empty)`);
