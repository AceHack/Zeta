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
