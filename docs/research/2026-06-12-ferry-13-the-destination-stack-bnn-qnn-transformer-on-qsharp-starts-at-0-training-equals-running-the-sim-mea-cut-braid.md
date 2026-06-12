# Ferry 13 — the destination stack: a BNN then QNN transformer on Q#, starting at 0, where training and running are the same thing (the sim·mea·cut braid)

**Date:** 2026-06-12 · **Route:** Aaron → shadow (streamed in four beats, captured verbatim) ·
Extends the destination claim ferried in the Welch Labs MLA transcript's routing note
(`docs/research/ip-questionable/2026-06-12-welch-labs-deepseek-multihead-latent-attention-...md`):
"a runtime transformer whose weights expand as needed with our float budget."

## Verbatim (preserved, typos and all)

> It's going to be a BNN transformer

> and a QNN transformer

> it runs on quantium Q#

> but it starts at 0 and training and running it are the same thing the simulate mesure cut
> braid

## The peel

### 1. The stack, assembled from today's pieces

Runtime transformer with budget-expanded weights (the Welch/GGUF lane) → **BNN** transformer →
**QNN** transformer → executed on the **Q#** lane. Each rung adds one move: width-as-output at
the weight level → uncertainty-typed weights → quantum-typed weights → the in-repo oracle as
runtime.

### 2. "BNN" — and why the two readings converge at 0

Two live expansions, both load-bearing here:

- **Bayesian neural network** (the repo's native read: `src/Bayesian`, the Infer.NET
  differential oracle, B-1033's hexagonal inference port): every weight is a posterior, not a
  point.
- **Binarized/BitNet-style NN** (the 1-bit lane, BitNet b1.58): every weight starts at the
  minimum possible width.

Under the bits↔precision dictionary (REPORT #2: bits ≈ ½·log₂ precision-ratio; Ball.BitsUsed =
signal above noise), these are **one object once "it starts at 0"**: a maximally-uncertain
posterior carries zero earned bits — storing it wider than ~1 bit is waste; as evidence
accumulates the posterior sharpens and the weight *earns* width. So a Bayesian transformer under
the float-budget algo **is** a BitNet that grows — bit-width = banked posterior precision,
per-weight, at runtime. That is the GGUF importance matrix (same-day transcript) made dynamic
and principled: importance estimated by a calibration set, replaced by importance carried as
live posterior precision.

### 3. "QNN … runs on quantium Q#" — honest bounds attached at ferry time

The Q# reference oracle (`Core.QSharp.ReferenceOracle`) is the named runtime. Standing caveats
carry over unchanged: the Q# lane is **simulator-backed** today (ferry 6's honest sentence;
"classically simulated topological-code combinatorics, replicated deterministically"), and
REPORT #2's **P0-B stands as the blocker**: the bridge functor from our braid/qubit structures
to the quantum semantics (QubitIso) is missing — until it exists, "runs on quantum" means "runs
on the Q# simulator under the four-oracle treaty." The QNN rung is a destination, priced by an
already-filed P0, not a current capability. (Ferry 8's investment gate applies to this lane
too: simulator → FPGA-class → hardware, each stage priced by the previous.)

### 4. "Starts at 0, training and running are the same thing: the simulate-measure-cut braid"

The deepest beat. No pretrain/deploy split — **one loop is both**: `sim` (predict forward —
generate the expectation), `mea` (measure — compare against what arrives, bank the ΔU to the
uncertainty ledger), `cut` (the boundary act — byte-lock what survived, golden it), and the
**braid** writes the memory (crossings = retained who-crossed-whom; REPORT #3 rung 2). That is:

- **Bayesian filtering, exactly**: in a filter, "training" (posterior update) and "running"
  (prediction) are the same recursion — there is no other mode. The BNN reading of §2 makes
  this literal.
- **Active inference, exactly** (same-day transcript): perception, learning, and action are one
  loop minimizing the same quantity; "self-evidencing" has no train/test split by construction.
- **Online/continual learning** as a discipline (the anti-"big bang pretrain" stance), with the
  ledger making replay safe: starting at 0 is ferry 10 §5 at model scale — the method is
  (prior + loop + ledger), where the prior is the architecture, the loop is sim·mea·cut, and
  the ledger is the braid.

The TestLoop (B-1035, in-tree) is the same triple already shipped at test scale — the claim
promotes it from test harness to **the training algorithm**. That promotion is the buildable
content of this ferry.

## Addendum — beats 5 and 6 (Aaron, same stream, verbatim)

> in mine each neuroon has it's own float budget and the societ decides on it's share like
> it's privacy budget and they communicate over reticulum

> each individual neuron like 1000 brains book/thery neruo scients and they have geospatial in
> clifford space

### 5. Per-neuron budgets, society-allocated — the economy IS the optimizer

The architecture's allocation rule is the factory's own economy, restated at neuron scale:
each neuron holds its own float budget (ferry 3's ten-floats society; width per REPORT #2's
law), and **the society decides each neuron's share** — explicitly "like its privacy budget,"
which is the in-repo rule made load-bearing: *privacy is a currency you earn by being useful,
not a default you assert* (`every-bug-has-economic-value.md`). A neuron that reduces collective
uncertainty earns width; one that doesn't sheds bits. Backprop's global gradient is replaced by
a **local economic settlement** — which is also exactly how the GGUF importance matrix
allocates precision, except live and self-governed instead of calibration-time and
author-flagged. Transport: **Reticulum** — already the named bus (B-1035's RETICULUM-ONLY IO
clause; one door, metered crossings), so inter-neuron communication inherits noninterference
(§13) by construction: influence between neurons only through the declared channel, every
crossing booked. REPORT #2's LOCC caveat carries over: Reticulum moves classical bits; the
society is a classical economy even under the QNN rung.

### 6. Each neuron a Thousand-Brains modeler, located in Clifford space

The unit is Hawkins' Thousand Brains column (Hawkins 2021; the reservoir-computing transcript
in ip-questionable already carries the explicit anchor): not a scalar activation but a **full
sensorimotor modeling unit with its own reference frames**, voting with its peers — which is
why per-unit budgets and society allocation are even coherent (a scalar neuron has nothing to
spend a budget *on*; a column-like modeler does). Fidelity note kept honest: in Hawkins the
modeling unit is the cortical **column**, not the single neuron — Aaron's "each individual
neuron" pushes the grain one level finer than the book claims. The new move: the unit's
reference frame is **geospatial in Clifford space** — location carried as a multivector
(the spacetime-algebra thread: the 2026-05-28 Clifford correspondence ferry; the Klein-bottle
bivector synthesis in the fusion lineage), so "where a neuron is" composes by the geometric
product (rotors for orientation, bivectors for planes-of-relation) instead of by coordinates.
Hawkins' grid-cell location signal, algebraized. Beacon: Hestenes (geometric algebra as the
language of physics); Hawkins–Ahmad (reference frames); the brain's grid cells
(O'Keefe; Moser & Moser, Nobel 2014) as the biological location-prior.

## Pointers

- Welch Labs MLA + GGUF + active-inference transcripts (2026-06-12, ip-questionable — the three
  shelves this stack stands on)
- REPORT #2 (bits↔precision dictionary; P0-B bridge functor — the QNN blocker) · REPORT #3
  (rung 2 braid-memory; Friston row) · ferry 8 (investment gate per stage)
- `src/Core/TestLoop.fs` (sim·mea·cut, in-tree) · `src/Bayesian` + Infer.NET oracle ·
  `Core.QSharp.ReferenceOracle` · `db/uncertainty/` (the ΔU ledger)
- Anchors: BitNet b1.58 (Ma et al. 2024) · Bayesian NNs (MacKay 1992; Neal 1996) · Kalman/Bayes
  filtering (training≡running) · Friston (self-evidencing) · DeepSeek MLA (the compression
  precedent)
