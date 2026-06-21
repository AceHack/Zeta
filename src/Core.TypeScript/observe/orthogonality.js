#!/usr/bin/env bun
// orthogonality.ts — the no-base-vector-overlap proof for context surfaces
// (081KT7YW00008QG0R002T1XNWT, tier after minimization). Minimal-per-file (byte-cost) is necessary;
// orthogonal-across-files is the stronger claim that kills duplication fleet-wide.
//
// A surface is a VECTOR in shingle-space (its set of k-word shingles). Two
// surfaces "overlap" (share a base vector) when their content similarity exceeds
// a threshold. The corpus is an ORTHOGONAL BASIS when every pair is below
// threshold — no two surfaces carry redundant content. Rodney's-Razor-after-drift
// keeps it there (081KT7YW00008QG0R002T1XNWT): drift → razor → re-converge to orthogonal.
//
//   --check exits non-zero if any pair overlaps (the gate, no PR needed).
//   default prints the pairwise overlap report (top offenders first).
//
// The overlap MEASURE's axioms (symmetry, bounds, self=1, disjoint=0, Jaccard
// distance = a true metric) are proven in F#: tests/Tests.FSharp/Formal/
// Jaccard.Laws.Tests.fs. NCI: measures only.
import { Glob } from "bun";
import { readFileSync } from "node:fs";
/** Normalize prose to a word stream: lowercase, drop markdown/punctuation. */
export function tokens(text) {
    return text
        .toLowerCase()
        .replace(/[`*_#>\-\[\]()|.,:;!?"'/\\]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 0);
}
/** k-word shingles (k=3 default) — the surface's coordinates in shingle-space. */
export function shingles(text, k = 3) {
    const t = tokens(text);
    if (t.length < k)
        return new Set(t.length ? [t.join(" ")] : []);
    const s = new Set();
    for (let i = 0; i + k <= t.length; i++)
        s.add(t.slice(i, i + k).join(" "));
    return s;
}
function intersectionSize(a, b) {
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    let n = 0;
    for (const x of small)
        if (big.has(x))
            n++;
    return n;
}
/** Jaccard similarity |A∩B|/|A∪B| ∈ [0,1] (0 = orthogonal, 1 = identical). */
export function jaccard(a, b) {
    if (a.size === 0 && b.size === 0)
        return 1;
    const inter = intersectionSize(a, b);
    return inter / (a.size + b.size - inter);
}
/** Containment |A∩B|/min(|A|,|B|) — catches a small surface SUBSUMED in a big one. */
export function containment(a, b) {
    const m = Math.min(a.size, b.size);
    if (m === 0)
        return 0;
    return intersectionSize(a, b) / m;
}
/** Assess every pair; overlaps if jaccard OR containment exceeds its threshold. */
export function assessOrthogonality(surfaces, th) {
    const shs = surfaces.map((s) => ({ path: s.path, sh: shingles(s.text) }));
    const pairs = [];
    for (let i = 0; i < shs.length; i++) {
        for (let j = i + 1; j < shs.length; j++) {
            const jac = jaccard(shs[i].sh, shs[j].sh);
            const con = containment(shs[i].sh, shs[j].sh);
            pairs.push({
                a: shs[i].path,
                b: shs[j].path,
                jaccard: jac,
                containment: con,
                overlaps: jac > th.jaccard || con > th.containment,
            });
        }
    }
    return pairs.sort((x, y) => Math.max(y.jaccard, y.containment) - Math.max(x.jaccard, x.containment));
}
// ── CLI ─────────────────────────────────────────────────────────────────────
const MANIFEST = [".claude/rules/*.md"];
const THRESHOLDS = { jaccard: 0.2, containment: 0.5 };
if (import.meta.main) {
    const args = new Set(Bun.argv.slice(2));
    const paths = MANIFEST.flatMap((g) => [...new Glob(g).scanSync({ cwd: ".", dot: true })]).sort();
    const surfaces = paths.map((p) => ({ path: p, text: readFileSync(p, "utf8") }));
    const pairs = assessOrthogonality(surfaces, THRESHOLDS);
    const offenders = pairs.filter((p) => p.overlaps);
    console.log(`orthogonality: ${surfaces.length} surfaces, ${pairs.length} pairs, thresholds J>${THRESHOLDS.jaccard} C>${THRESHOLDS.containment}`);
    for (const p of pairs.slice(0, 5)) {
        console.log(`  ${p.overlaps ? "✗" : "·"} J=${p.jaccard.toFixed(3)} C=${p.containment.toFixed(3)}  ${p.a}  ×  ${p.b}`);
    }
    if (offenders.length === 0) {
        console.log(`orthogonal basis: no pair overlaps — the corpus carries no redundant base vector.`);
    }
    else {
        console.log(`${offenders.length} overlapping pair(s) — razor the shared content (081KT7YW00008QG0R002T1XNWT).`);
    }
    if (args.has("--check") && offenders.length > 0)
        process.exit(1);
    process.exit(0);
}
