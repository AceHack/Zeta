# The signed-delta combinator SHIPS (TLC-verified, in order) — and the ZSet↔quantum-circuit bridge

Two threads, one capture: Aaron's "let's do it" (the signed-delta work) and his question "can we
connect ZSet circuit to quantum circuit?" — which turns out to be answered BY the work.

## RecursiveSignedDelta — shipped per its own gate, in sequence

The skeleton's stated graduation path was followed exactly: (1) the TLA+ spec's REAL step relation
TLC-checked — Safety (S1 termination, S2 fixpoint `total = seed + body(total)`, S3/S3'
gap-monotone/single-signed) green at all four seed weights (+1, −1, +2, −2); (2) the F# combinator
landed at the planned home (`Circuit.RecursiveSignedDelta`, Recursive.fs) with the spec's exact
recurrence — **the feedback cell carries the SIGNED DELTA, never the total**, so a seed delta
(insert or retract) joins at its own tick and propagates linearly; (3) graduation tests: one-shot
LFP exact; **the multi-tick case that REFUTED RecursiveCounting passes by construction**;
insert-then-retract converges to zero everywhere — dip and recover, no tombstone pass. Suite 3009,
zero skipped. (The removed FsCheck property's resurrection criterion is now MET in spirit — a
SignedClosureTable wiring + the property re-aimed at the new combinator is the named follow-up.)
Beacon: Feldera/DBSP VLDB 2023 §6.3 (the production shape); Bancilhon–Ramakrishnan 1986;
Gupta–Mumick–Subrahmanian 1993; the plan doc §7.

## "Can we connect ZSet circuit to quantum circuit?" — yes, and precisely HERE

The honest mapping, with the load-bearing rhyme first:

| | DBSP circuit | quantum circuit |
|---|---|---|
| state | ZSet: keys → ℤ weights | amplitudes: basis states → ℂ |
| operators | Z-LINEAR (Plus/Join/Map distribute over +/−) | ℂ-linear (gates are linear maps) |
| the nonlinear step | `Distinct` — FORBIDDEN inside the body, applied at the OUTER BOUNDARY after convergence | MEASUREMENT (Born rule) — nonlinear, applied at the boundary, never inside the unitary circuit |
| cancellation | a −1 delta annihilates a +1 derivation (retraction) | opposite-phase amplitudes annihilate (interference) |
| proof in-tree | RecursiveSignedDelta retraction test → exact zero | AmplitudeEmu.merge → the two-slit |

The connection is not analogy — it is the SAME calculus over a different weight ring. `AmplitudeEmu`
already IS a ℂ-weighted Z-set over machine frames (`Amp = (Frame × Complex) list`), its `merge` is
ZSet consolidation with complex cancellation, and `bornProb` is the boundary measurement. What the
signed-delta work just proved for ℤ (negative weights propagate linearly through the body and
cancel exactly) is one ring-swap away from amplitude propagation: generalize `ZSet<'K>` weights
from ℤ to any commutative ring 'W (we already carry `Semiring`/`ProbabilitySemiring`/`IStarRing`),
and a quantum circuit is the SAME `Circuit` shape with 'W = ℂ and the operator set restricted to
norm-preserving (unitary) maps. The Distinct-at-the-boundary discipline we enforce for correctness
is literally the measurement-at-the-boundary discipline quantum mechanics enforces by law.
(Razor note 2026-06-13: ONE discipline, enforced SEPARATELY per engine — no generic enforcement
exists in code; the law lives in three review conventions and this prose. A shared boundary-typed
seam is the upgrade if drift ever appears.)

HONEST LIMITS, stated: (a) unitarity is NOT free — circuit composition preserves linearity, not
norm; a quantum lane needs the operator set gated (the acceptance-gate pattern applies); (b) this
is SIMULATION of amplitude arithmetic (the AmplitudeEmu honesty note carries: distinct-frame
count can grow exponentially — the merge only collapses reconverging paths); no hardware claim;
(c) measurement nonlinearity means no measurement inside feedback loops — same rule as Distinct,
enforced the same way.

NAMED SLICE: `WSet<'K,'W>` (ring-generic Z-set) + a ℂ instance + the Mach-Zehnder drawn as a
two-key DBSP circuit (Plus/Map only, merge at boundary) cross-checked against AmplitudeEmu and
Vera's Q# job 3 — the literal connection, testable in three oracles.

## Pointers

- `Circuit.RecursiveSignedDelta` (Recursive.fs) · the TLA+ spec + cfg (all four seeds) ·
  §SIGNED-DELTA tests · `AmplitudeEmu` · `Semiring`/`ProbabilitySemiring` · Vera brief job 3
