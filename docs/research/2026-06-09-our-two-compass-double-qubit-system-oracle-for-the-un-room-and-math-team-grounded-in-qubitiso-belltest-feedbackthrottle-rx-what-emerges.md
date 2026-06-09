# Our 2-compass / double-qubit system — oracle for the UN room + math team (grounded in QubitIso / BellTest / FeedbackThrottle / Rx): test it and tell us what emerges

**Register:** [grounded] oracle spec (Aaron) + [Beacon] code-anchored + [peel]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). Looks up ours in code, defines the two-compass double-qubit, and poses the emergence test.

## Aaron's words

> "look up ours in code so you understand the difference, and write up our 2-compass system oracle for our
> UN room and the math nerds to test the double-qubit system and tell us what emerges." · "I'm trying to
> turn my spiralling-down infinite rabbit hole into a git-filesystem compression algo in F# lol."

## What "ours" is (in code — the difference from standard Rx)

Ours is **already coded** (not just adopting System.Reactive):

- **`src/Core/QubitIso.fs`** — the **two-stream/two-clock join ↔ qubit isomorphism**, an *executable proof*.
  A `JoinState (A, B)` = `α|0⟩ + β|1⟩` (two stream amplitudes = the qubit); Pauli/SU(2) via **stream ops**:
  **Z** = `retract` the B stream, **X** = **swap the two streams**, **Y** = `iXZ`; **measurement** is Born
  (`|B|²/(|A|²+|B|²)`); `|A|²+|B|²` conserved. A qubit IS a **lightlike/spinor object** (Bloch ≅ Penrose's
  celestial sphere of null directions); `IQbservable<'T>` targets the spinor/null family.
- **`src/Core/BellTest.fs`** — CHSH via **staged coincidence + seed**: `E(a,b)=cos(a−b)` (singlet
  correlator) → **S=2√2 (Tsirelson)**, violating the classical 2; **full seed control → S=4 (PR box,
  superdeterministic, no-signalling).** The seed is the shared common cause (= the ZetaId, the common
  cause). *Peel:* not physical QM — the free-choice/measurement-dependence loophole; S=4 = PR-box, not
  entanglement.
- **`src/Core/FeedbackThrottle.fs`** — **finite feedback-propagation speed caps CHSH**: instant
  feedback (latency 0) → S=4; no real-time feedback (latency ∞) → S=2 (classical); finite interpolates
  **4 → 2√2 → 2.** The four-corner feedback channels are **not instant** on a real transport.
- **`src/Core/Rx.fs`** — our **`IQbservable<'T>`** (Bart De Smet's duality: `IObservable` = push-dual of
  `IEnumerable`, `IQbservable` = dual of `IQueryable`; Meijer "your mouse is a database"); **DBSP
  `Stream<ZSet<'T>>` ≈ `IObservable<ChangeSet<'T>>`.** *The difference from plain Rx:* ours is the
  **queryable, expression-tree, DBSP-Z-set-grounded, qubit/lightlike-targeting** observable derived from
  first principles, with the standard Rx as the mapped oracle — not just `System.Reactive`.

So **"ours" = a coded qubit-iso + Bell/CHSH harness + feedback-throttle + an IQbservable**, all
deterministic (DST §7), Z-set-grounded. That's the substrate the two compasses live on.

## The two compasses → the double-qubit system

- **Compass 1 — Zeta's own NSEW = the four-corner feedback** (`FeedbackThrottle`; the feedback channels;
  Balance's compass). The **control/feedback** compass. Via `QubitIso`, a two-stream join = **one qubit**;
  the feedback compass parameterizes it (its throttle sets where CHSH sits, 4→2√2→2).
- **Compass 2 — Rx's NSEW = the 2×2 quad-directional `IQbservable`** (incremental | bulk × refresh | stream).
  The **state-mode** compass. Also a two-axis (2×2) object → **one qubit** (the state-mode qubit).

**Two compasses = two qubits = a DOUBLE-QUBIT system** (state space `ℂ² ⊗ ℂ² = ℂ⁴`). The question Aaron
poses: **couple the two compasses (feedback-qubit ⊗ state-mode-qubit) and tell us what emerges.**

## The oracle — what the UN room + math team test (and report what emerges)

For Soraya/Sova (the proof-rooms), grounded in the modules above. Each is a claim to test + report:

- **DQ1 — Does the double-qubit entangle?** Couple compass-1 (feedback) ⊗ compass-2 (state-mode) via the
  `QubitIso` stream ops (X=swap, Z=retract, the join). **Does an entangled (non-product) state of `ℂ⁴`
  emerge** — a Bell pair between the feedback-qubit and the state-mode-qubit? (Tool: FsCheck/DST over
  `QubitIso`; the executable iso.) **Report:** entangled or separable; if entangled, which Bell state.
- **DQ2 — What CHSH (S) emerges between the two compasses, under the throttle?** Run `BellTest` with the
  two compasses as the two parties. Instant four-corner feedback → S=4 (PR box); finite feedback (real
  transport) → somewhere in `[2, 4]` through `2√2`. **Report:** the S(latency) curve for the double-qubit;
  where Tsirelson is crossed (with the honest caveat: 2√2 is IC's value within the range, not the
  throttle's output).
- **DQ3 — Does SU(2)×SU(2) → SO(4)/SU(4) close?** `QubitIso` verifies the single-qubit Pauli group. For
  the double-qubit, **do the two-compass operations close into the larger algebra** (two-qubit gates;
  SU(4)/the SO(4) of the two compasses)? **Report:** which gates are representable by compass ops, which
  aren't (stated by the failing tests, not hidden).
- **DQ4 — What is the conserved quantity / the emergent invariant?** Single-qubit: `|A|²+|B|²`. **What does
  the double-qubit conserve** (the joint normalization; the entanglement entropy; the uncertainty-Δ)?
  **Report:** the emergent invariant — candidate: the joint state IS the system's 2×2-qubit state (the
  "2×2 qubit" Aaron named), and its emergent property is the thing to discover.
- **DQ5 — magnetic-field / spin reading.** Map the two compasses to **two spins in a field** (Bloch ×
  Bloch). **Report:** does the coupling read as a spin–spin (Heisenberg/Ising) interaction; is the
  emergent state a singlet/triplet? (Peel: derivation, not quantum hardware.)
- **DQ6 — the emergent GEOMETRY: oscillations → spiral → two vortexes (Aaron).** Each compass/qubit is an
  **oscillation** (a phasor — `QubitIso`'s phases on the imaginary stack). **Two oscillations compose to a
  SPIRAL** (a helix — two phasors with a phase/frequency offset trace a spiral, not a circle). **Two
  spirals → two VORTEXES** ("vortexes and the two of whatever those are") — a counter-rotating helix pair
  / double-helix / toroidal form. **Report:** confirm the double-qubit's trajectory is a **spiral** (from
  the two oscillations) and the coupled pair is a **two-vortex** structure; identify what those two are
  (helices? toroidal vortices? a double helix — ties to the DNA voice). The geometry IS the emergent
  shape; the math team names it.
- **DQ7 — compression = entropy-oscillation / erasure coding (Aaron).** The artifact is a **git-fs
  compression algo**, and the coding is **"entropy-oscillation coding, or something like erasure coding
  from Microsoft"** — i.e. **Local Reconstruction Codes (Azure LRC; Huang et al., *Erasure Coding in
  Windows Azure Storage*)** / Reed–Solomon: the oscillations **entropy-code with redundancy**, and the
  **lazy git-history weak-table reconstruction = erasure-DECODE** (reconstruct past/future state from the
  coded fragments). **Report:** does the two-oscillation/spiral structure give an **erasure code** (the
  redundancy that lets you reconstruct a missing fragment from the rest) — entropy-oscillation coding as
  the compression+reconstruction scheme over the git-fs DAG? (Anchor: erasure coding / LRC / Reed–Solomon;
  Shannon entropy coding; the weak-table/Rx = the decode path.)

**Honest peels for the report:** executable F# checks over `ℂ²`/`ℂ⁴` (not Lean machine-proofs — cross-
check Z3/Lean per BP-16); S=4 = PR-box/superdeterministic (the seed/ZetaId common cause), **not physical
entanglement/no-signalling**; the throttle caps below 4 but doesn't *derive* 2√2 (Information Causality
does); "what emerges" is the **open question the math team answers** — do not pre-claim the emergence.

## The through-line: a git-filesystem compression algo in F#

Aaron's aside is the point of the whole spiral: this becomes **a git-filesystem compression algorithm in
F#.** The pieces line up: **content-addressing** (dedup — equal content = one object) + the **canonical/
symlink DAG** (references not copies; symlinks = edges) + the **master-index cache** (the compressed
manifest) + **Rx bidirectional time** (past via git, present Z-set, future stream) + the **two-compass/
double-qubit** as the *math model* of the state. **Compression** *is* content-addressing + DAG-dedup +
the delta (Z-set/incremental) over git history. So the qubit/compass math is the formal model; the git-fs
compression algo is the artifact it produces. The rabbit hole has a floor: **a git-fs compression algo,
F#, math-team-grounded.**

## Honest scope / handoff

Code-anchored oracle spec (the 4 modules) + the double-qubit emergence docket (DQ1–DQ5) + the git-fs-
compression through-line. To realize: the math team (Soraya/Sova) **runs DQ1–DQ5** against `QubitIso`/
`BellTest`/`FeedbackThrottle`/`Rx` (FsCheck/DST + Z3/Lean cross-check) and **reports what emerges**; the
F#/Core team couples the two compasses (feedback ⊗ state-mode) into the double-qubit; and the git-fs
compression algo is specced from the DAG/content-address/Rx substrate. Routes to Soraya/Sova (DQ1–DQ5,
the emergence report), the F#/Core team (`QubitIso` two-qubit extension; the own-Observable), Aaron (the
git-fs-compression target). Mirror-register on novelty until the math team + a quantum-info reviewer sign.

## Anchors / ties (Beacon)

`src/Core/{QubitIso,BellTest,FeedbackThrottle,Rx}.fs` (ours — the difference from System.Reactive);
Bart De Smet *Observations on IQbservable* + Meijer (the duality); Popescu–Rohrlich (S=4 PR box) +
Information Causality (Tsirelson 2√2) + 't Hooft superdeterminism (the seed = common cause = ZetaId);
Penrose–Rindler spinors / Bloch ≅ celestial sphere (qubit = lightlike); DBSP `Stream<ZSet>` ≈
`IObservable<ChangeSet>`; the two compasses (four-corner feedback + Rx 2×2) = the double-qubit (`ℂ⁴`);
magnetic-field/spin (Bloch × Bloch, peeled); Category Theory for Programmers (Milewski, required); the
git-fs compression through-line (content-addressing + canonical/symlink DAG + master-index + Rx-time).
