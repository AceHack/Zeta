# Infer.NET circuits — Minka's EP, factor graphs, and the THIRD ring of one circuit calculus

Aaron 2026-06-13: "are there any kind of Infer.NET circuits we can do the same with? research the
guy behind it and his latest papers — we can write our own code if they have a similar way to
connect a circuit-like thing."

## The people and the lineage (researched, verified)

**Tom Minka** — Expectation Propagation (UAI 2001), Power EP, "Divergence measures and message
passing" (the α-divergence unification); **John Winn** — Variational Message Passing (Winn &
Bishop, JMLR 2005) and the Model-Based Machine Learning book. Infer.NET is their engine: a model
COMPILES to a FACTOR GRAPH and inference runs as MESSAGE PASSING over it. It is MIT-licensed, a
.NET Foundation project, alive at dotnet/infer. The deepest anchor under all of it:
**Aji & McEliece, "The Generalized Distributive Law" (IEEE IT 2000)** + Kschischang–Frey–Loeliger
factor graphs (2001) — sum-product, max-product, Viterbi, FFT, and Turbo decoding are ONE
algorithm over different commutative semirings. The GDL is the theorem our whole circuit thesis
rides on.

## The answer: yes — and HALF OF IT IS ALREADY IN OUR TREE

`Zeta.Bayesian` already carries the Infer.NET shape, written by us: `FactorGraph.fs` (with
`runToFixpoint` — the message-passing fixpoint driver), `Message.fs`, `MessageBatch.fs`, and
`Ep.fs` — a real EP step (cavity = marginal/f_message → project to the exponential family →
divide = new message), Minka's loop verbatim. So Aaron's "we can write our own code" is DONE for
the engine core; what's missing is the CONNECTION to the DBSP `Circuit` — and that connection is
the same one the quantum answer named yesterday:

| ring | circuit | weights | the boundary nonlinearity |
|---|---|---|---|
| ℤ | DBSP / ZSet | signed counts | **Distinct** (clamp after convergence) |
| ℂ | quantum / AmplitudeEmu | amplitudes | **measurement** (Born rule) |
| ℝ≥0 (or log-semiring) | factor graph / sum-product | probabilities (messages) | **EP projection** (moment-match to the family) |

Three rings, ONE calculus (the GDL says so with a proof); three boundary nonlinearities, one
discipline — ENFORCED SEPARATELY per engine (no generic code enforcement; Rodney 2026-06-13: the connection is demonstrated, not shared-coded) — the nonlinear step never lives inside the linear loop. Minka's EP projection is to
inference what Distinct is to DBSP and measurement is to quantum: the lossy step, quarantined at
the boundary (EP literally alternates linear message products with a projection — and the
α-divergence paper is the knob between them).

## What we build (081KTZ4EF0008QG0R001R3XPYV, the named slice — shared with the quantum one)

`WSet<'K,'W>` over any commutative semiring (we carry `Semiring`/`ProbabilitySemiring`/`IStarRing`
already), then ONE demo per ring on the SAME circuit shape: (a) discrete sum-product on a 3-node
chain as a Circuit instance with 'W = probability, marginals cross-checked against
`Zeta.Bayesian.FactorGraph` (two independent engines, BP-16); (b) the Mach-Zehnder with 'W = ℂ
vs AmplitudeEmu + Vera's Q# job 3; (c) 'W = ℤ is the existing ZSet (free). Honest limits: EP is
APPROXIMATE off-tree (loopy graphs — convergence not guaranteed, Minka says so himself); the
sum-product/Circuit equivalence is exact only on trees/fixed schedules; we state schedules
explicitly (DST: deterministic message order).

Sources: [Minka's site](https://tminka.github.io/) · [EP, UAI 2001](https://arxiv.org/pdf/1301.2294) ·
[Power EP](https://tminka.github.io/papers/minka-power-ep.pdf) · [dotnet/infer](https://github.com/dotnet/infer) ·
[Infer.NET compiler overview](https://dotnet.github.io/infer/development/Compiler%20overview.html) ·
Aji & McEliece 2000 · Winn & Bishop 2005

## Pointers

- `src/Bayesian/` (FactorGraph/Message/Ep — ours, already written) · `Circuit.RecursiveSignedDelta`
  (the ℤ ring's newest law) · the quantum-bridge capture (2026-06-13) · 081KTWJ1R0008QG0R001ZBWKTR (Lior's lane)
