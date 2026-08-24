// PROBE: does the SHARED BELIEF FOLD exhibit destructive interference?
// Classical probability cannot: adding a path never REDUCES total support.
// Amplitude addition can: contributions cancel.
// src/Core/BeliefConvergence.fs:33  ->  let observe likelihood belief = Array.map2 (*) likelihood belief
//   ... over int64[] NON-NEGATIVE weights.

const observe = (lik: bigint[], bel: bigint[]) => bel.map((b, i) => b * (lik[i] as bigint));
let seed = 24680;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const randBelief = (n: number) => Array.from({ length: n }, () => BigInt(1 + Math.floor(rnd() * 50)));

// E1 — can two NONZERO evidence arrays combine to give a ZERO weight? (cancellation)
let cancellations = 0, negatives = 0, trials = 0;
for (let t = 0; t < 200000; t++) {
  const n = 4;
  const b = randBelief(n), e1 = randBelief(n), e2 = randBelief(n);
  const out = observe(e2, observe(e1, b));
  for (const w of out) { if (w === 0n) cancellations++; if (w < 0n) negatives++; }
  trials++;
}
console.log(`E1 belief fold: cancellations to zero from nonzero inputs = ${cancellations} / ${trials * 4} weights`);
console.log(`E1 belief fold: negative weights produced                 = ${negatives}`);

// E2 — is combination MONOTONE on the support? A path can only scale a weight by a
// non-negative factor, so the SUPPORT (set of nonzero candidates) can never grow, and a
// candidate can never be pushed to zero except by an exactly-zero likelihood.
let supportGrew = 0;
for (let t = 0; t < 50000; t++) {
  const b = randBelief(5), e = randBelief(5);
  const before = b.filter((w) => w !== 0n).length;
  const after = observe(e, b).filter((w) => w !== 0n).length;
  if (after > before) supportGrew++;
}
console.log(`E2 belief fold: trials where support GREW after observing = ${supportGrew} (interference would allow it)`);

// F — the CONTROL, and it is the load-bearing half: the SAME repo has a lane that DOES interfere.
// WSet.consolidate over a signed/complex ring: opposite weights annihilate on a shared key.
type C = { re: number; im: number };
const cAdd = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });
const consolidate = (s: [string, C][]): [string, C][] => {
  const m = new Map<string, C>();
  for (const [k, w] of s) m.set(k, m.has(k) ? cAdd(m.get(k) as C, w) : w);
  return [...m].filter(([, w]) => Math.abs(w.re) > 1e-15 || Math.abs(w.im) > 1e-15);
};
let interfered = 0;
for (let t = 0; t < 50000; t++) {
  const th = rnd() * 2 * Math.PI;
  const pathA: [string, C][] = [["k", { re: Math.cos(th), im: Math.sin(th) }]];
  const pathB: [string, C][] = [["k", { re: -Math.cos(th), im: -Math.sin(th) }]];  // opposite phase
  const both = consolidate([...pathA, ...pathB]);
  const alone = consolidate(pathA);
  if (both.length < alone.length) interfered++;   // two paths give LESS support than one
}
console.log(`F  amplitude lane (WSet/C): trials where TWO paths gave LESS support than ONE = ${interfered} / 50000`);
console.log("");
console.log(`VERDICT: belief fold interference = ${cancellations === 0 && supportGrew === 0 ? "NONE (classical, non-negative multiplicative)" : "PRESENT"}`);
console.log(`VERDICT: amplitude lane interference = ${interfered > 0 ? "PRESENT (by construction — the ring is C)" : "NONE"}`);
