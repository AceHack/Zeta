// PROBE: does the SHIPPED factor-graph algorithm (src/Bayesian/FactorGraph.fs, replicated
// operation-for-operation) run with 'M = WeightedSet<NatCoord,float> and give the same
// marginals as 'M = Gaussian?  If yes, the factor graph's dependence on its message type is
// ONLY through IMessage = {Uniform, Product, Divide} = a commutative group.

// ── IMessage<'M>, verbatim from src/Bayesian/Message.fs:55
interface IMessage<M> { uniform: M; product: (a: M, b: M) => M; divide: (a: M, b: M) => M; }

// ── instance 1: Gaussian in natural params (Message.fs)
type Gaussian = { nu: number; tau: number };
const GaussianAlgebra: IMessage<Gaussian> = {
  uniform: { nu: 0, tau: 0 },
  product: (a, b) => ({ nu: a.nu + b.nu, tau: a.tau + b.tau }),
  divide: (a, b) => ({ nu: a.nu - b.nu, tau: a.tau - b.tau }),
};

// ── instance 2: WeightedSet<NatCoord,float> (src/Core/WeightedSet.fs), |K| = 2
type NatCoord = "nu" | "tau";
type WSet = ReadonlyMap<NatCoord, number>;
const wsSet = (m: Map<NatCoord, number>, k: NatCoord, w: number) => { if (w === 0) m.delete(k); else m.set(k, w); };
const wsAdd = (a: WSet, b: WSet): WSet => { const m = new Map(a); for (const [k, w] of b) wsSet(m, k, (m.get(k) ?? 0) + w); return m; };
const wsNeg = (a: WSet): WSet => { const m = new Map<NatCoord, number>(); for (const [k, w] of a) wsSet(m, k, -w); return m; };
const WSetAlgebra: IMessage<WSet> = {
  uniform: new Map(),                               // WeightedSet.empty  (Zero-pruned identity)
  product: (a, b) => wsAdd(a, b),                   // WeightedSet.add
  divide: (a, b) => wsAdd(a, wsNeg(b)),             // WeightedSet.subtract
};
const h = (g: Gaussian): WSet => { const m = new Map<NatCoord, number>(); wsSet(m, "nu", g.nu); wsSet(m, "tau", g.tau); return m; };
const hInv = (w: WSet): Gaussian => ({ nu: w.get("nu") ?? 0, tau: w.get("tau") ?? 0 });

// ── the algorithm, replicated from FactorGraph.fs (passOnce / marginal / varToFactor)
interface Factor<M> { neighbors: number[]; computeMessages: (incoming: Map<number, M>) => Map<number, M>; }
interface Graph<M> { alg: IMessage<M>; factors: Map<number, Factor<M>>; f2v: Map<number, Map<number, M>>; }

const prior = <M,>(v: number, msg: M): Factor<M> => ({ neighbors: [v], computeMessages: () => new Map([[v, msg]]) });
const equality = <M,>(alg: IMessage<M>, neighbors: number[]): Factor<M> => ({
  neighbors,
  computeMessages: (incoming) => {
    const out = new Map<number, M>();
    for (const target of neighbors) {
      let acc = alg.uniform;
      for (const n of neighbors) if (n !== target && incoming.has(n)) acc = alg.product(acc, incoming.get(n) as M);
      out.set(target, acc);
    }
    return out;
  },
});
const addFactor = <M,>(id: number, f: Factor<M>, g: Graph<M>): Graph<M> => {
  const init = new Map<number, M>(); for (const v of f.neighbors) init.set(v, g.alg.uniform);
  return { alg: g.alg, factors: new Map(g.factors).set(id, f), f2v: new Map(g.f2v).set(id, init) };
};
const factorsOf = <M,>(v: number, g: Graph<M>) => [...g.factors].filter(([, f]) => f.neighbors.includes(v)).map(([id]) => id).sort((a, b) => a - b);
const productFrom = <M,>(v: number, ids: number[], g: Graph<M>): M => {
  let acc = g.alg.uniform;
  for (const fid of ids) { const m = g.f2v.get(fid)?.get(v); if (m !== undefined) acc = g.alg.product(acc, m); }
  return acc;
};
const marginal = <M,>(v: number, g: Graph<M>): M => productFrom(v, factorsOf(v, g), g);
const varToFactor = <M,>(v: number, exclude: number, g: Graph<M>): M => productFrom(v, factorsOf(v, g).filter((f) => f !== exclude), g);
const passOnce = <M,>(g: Graph<M>): Graph<M> => {
  const updated = new Map<number, Map<number, M>>();
  for (const [fid, f] of g.factors) {
    const incoming = new Map<number, M>();
    for (const v of f.neighbors) incoming.set(v, varToFactor(v, fid, g));
    updated.set(fid, f.computeMessages(incoming));
  }
  return { alg: g.alg, factors: g.factors, f2v: updated };
};

// ── build the SAME graph in both algebras: 3 variables tied by an equality factor, each with a prior
const build = <M,>(alg: IMessage<M>, priors: [number, M][], eqVars: number[]): Graph<M> => {
  let g: Graph<M> = { alg, factors: new Map(), f2v: new Map() };
  priors.forEach(([v, m], i) => { g = addFactor(i + 1, prior(v, m), g); });
  g = addFactor(100, equality(alg, eqVars), g);
  return g;
};

let seed = 987654321;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

let worst = 0, trials = 0;
for (let t = 0; t < 5000; t++) {
  const gs: [number, Gaussian][] = [0, 1, 2].map((v) => [v, { nu: (rnd() - 0.5) * 10, tau: rnd() * 5 + 0.01 }] as [number, Gaussian]);
  let gG = build(GaussianAlgebra, gs, [0, 1, 2]);
  let gW = build(WSetAlgebra, gs.map(([v, m]) => [v, h(m)] as [number, WSet]), [0, 1, 2]);
  for (let r = 0; r < 4; r++) { gG = passOnce(gG); gW = passOnce(gW); }
  for (const v of [0, 1, 2]) {
    const mg = marginal(v, gG), mw = hInv(marginal(v, gW) as WSet);
    worst = Math.max(worst, Math.abs(mg.nu - mw.nu), Math.abs(mg.tau - mw.tau));
  }
  trials++;
}
console.log(`C  FactorGraph marginals: Gaussian vs WeightedSet<NatCoord,float>`);
console.log(`C  max abs diff = ${worst.toExponential(3)} over ${trials} random 3-variable graphs x 4 BP rounds`);
console.log(`C  verdict: ${worst === 0 ? "BIT-IDENTICAL — the graph runs over WeightedSet unchanged" : "DIFFERS"}`);

// ── SABOTAGE CONTROL: break the WSet algebra's identity; the probe must go red.
const WSetSabotaged: IMessage<WSet> = { ...WSetAlgebra, uniform: new Map([["tau", 1e-3]]) };
let sab = 0;
for (let t = 0; t < 200; t++) {
  const gs: [number, Gaussian][] = [0, 1, 2].map((v) => [v, { nu: (rnd() - 0.5) * 10, tau: rnd() * 5 + 0.01 }] as [number, Gaussian]);
  let gG = build(GaussianAlgebra, gs, [0, 1, 2]);
  let gW = build(WSetSabotaged, gs.map(([v, m]) => [v, h(m)] as [number, WSet]), [0, 1, 2]);
  for (let r = 0; r < 4; r++) { gG = passOnce(gG); gW = passOnce(gW); }
  for (const v of [0, 1, 2]) { const mg = marginal(v, gG), mw = hInv(marginal(v, gW) as WSet);
    sab = Math.max(sab, Math.abs(mg.nu - mw.nu), Math.abs(mg.tau - mw.tau)); }
}
console.log(`C' sabotage control (non-identity uniform): max abs diff = ${sab.toExponential(3)} — ${sab > 0 ? "PROBE CAN FAIL (control passes)" : "PROBE IS VACUOUS"}`);
