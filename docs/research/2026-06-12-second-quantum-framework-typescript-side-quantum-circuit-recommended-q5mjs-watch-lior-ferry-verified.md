# The second quantum framework (TypeScript side) — quantum-circuit recommended, q5mjs on watch (Lior's list, verified)

Aaron 2026-06-12: "I want a 2nd framework for quantum and make sure it works for TypeScript —
look for the most popular TypeScript quantum framework like Q#." Lior ferried four candidates;
verified by search before adopting (the ferry was accurate — including q5mjs, which is real).

## Recommendation: `quantum-circuit` (quantastica) as the TS-side second oracle

- **Mature:** v0.9.x, the most established JS/TS quantum circuit simulator; 20+ qubits in browser
  or node — fits our bun/TS oracle stack natively.
- **The treaty fit (the deciding feature):** it EXPORTS circuits to **Q#**, Qiskit, Cirq,
  OpenQASM, and more — so one circuit definition in our TS oracle compiles to the exact program
  Vera runs. That is a literal ADAPTER PIECE (the toolbox economy): TS-circuit-out → Q#-in, the
  missing piece between our second framework and her first, byte-comparable on both ends.
- **It draws circuits to SVG** — text renders, straight into our golden-lock discipline (a
  circuit's drawing can be a byte-locked golden like any shape cartridge).
- BP-16 by construction: the SAME circuit runs on quantum-circuit's simulator (TS) AND on Q#
  (Vera) — two independent implementations of one number, our standing two-tool rule.

## On watch: `q5mjs` (openql-org)

Real and TypeScript-FIRST (type-safe, strict mode, claims 2000+ tests, React/Vue integration) —
but v0.1.1, young. Exactly the profile to RE-CHECK in a few months; if it matures, its type
safety beats quantum-circuit's plain JS for our Core.TypeScript treaty ports. Watch, don't adopt.

## The teaching layer: Quirk (Craig Gidney)

Drag-and-drop browser simulator, real-time state displays — the arcade-cabinet register for the
craft school (Max/Addison play circuits the way they play cartridges). Not an oracle; a toy in
the honorable sense.

## Named slices opened

1. `quantum-circuit` into the TS oracle: the three Vera jobs (singlet CHSH, cos² overlap,
   H·R1(φ)·H) built as circuits, run on its simulator, exported to Q# for Vera — one definition,
   two oracles, byte-comparable verdicts.
2. Circuit-SVG goldens under the golden lock (their SVG, our discipline — check their output is
   deterministic before locking; if not, that's a finding).
3. q5mjs re-check (a watch issue, not a backlog row yet).

Sources: [q5m.org](https://q5m.org/) · [openql-org/q5mjs](https://github.com/openql-org/q5mjs) ·
[quantum-circuit on npm](https://www.npmjs.com/package/quantum-circuit) ·
[quantastica/quantum-circuit](https://github.com/quantastica/quantum-circuit) ·
[jsqubits](https://davidbkemp.github.io/jsqubits/)
