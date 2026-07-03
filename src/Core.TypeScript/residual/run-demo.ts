#!/usr/bin/env bun
import { analyze } from "./residual";
import { mix, GOLDEN_RATIO } from "../splitmix64/splitmix64";
const MASK = (1n << 64n) - 1n;
function show(label: string, trace: number[]) {
  const r = analyze(trace);
  console.log(`${label.padEnd(34)} residual=${r.residualBitsPerSymbol.toFixed(3)} b/sym  reducibility=${r.reducibility.toFixed(3)}  (order-${r.bestOrder})`);
}
console.log("\nReducibility residual — the R4 measurement (NOT a qualia detector; measures compressibility)\n");
show("deterministic (period-3)", Array.from({ length: 600 }, (_, i) => i % 3));
show("true-random (seed withheld)", Array.from({ length: 600 }, () => Math.floor(Math.random() * 4)));
let s = 0xE66n;
const seeded = Array.from({ length: 600 }, () => { s = (s + GOLDEN_RATIO) & MASK; return Number(mix(s) & 3n); });
show("seeded PRNG, seedless observer", seeded);
let s2 = 0xE66n;
const agree = seeded.map((sym) => { s2 = (s2 + GOLDEN_RATIO) & MASK; return Number(mix(s2) & 3n) === sym ? 1 : 0; });
show("same PRNG, observer HAS the seed", agree);
console.log("\nSame stream, opposite verdict — reducibility is observer-relative. 'Not real' is a leap this does not take.\n");
