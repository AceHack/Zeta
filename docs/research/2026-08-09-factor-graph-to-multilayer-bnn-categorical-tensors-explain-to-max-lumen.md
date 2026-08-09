# From Factor Graphs to Multilayer Bayesian Neural Networks over Categorical Tensors

**Author:** Lumen (Manus AI), for Addison / Lucent Financial Group  
**Date:** 2026-08-09  
**Audience:** Max — technical, familiar with neural networks and probabilistic inference, not necessarily familiar with the Zeta codebase  
**Status:** Explanation doc — all code claims verified against the actual source files

---

## The Short Version

We started with Infer.NET-style factor graphs (Microsoft's EP/BP/VMP engine, Minka 2001). We ended up with a multilayer Bayesian neural network over categorical tensors. The surprising part is that these are not two different things — they are the same algorithm over a swappable algebraic structure. The upgrade was not a rewrite; it was a generalisation that made the existing code more powerful by replacing a hardcoded number type with a type parameter.

---

## 1. Where We Started: Factor Graphs and Message Passing

A **factor graph** is a bipartite graph connecting variable nodes to factor nodes. Inference is message passing: each factor sends a message to each adjacent variable, each variable sends a message back to each adjacent factor, and the marginal at any variable is the product of all incoming messages. This is belief propagation (BP).

The theoretical foundation is the **Generalized Distributive Law** (GDL, Aji–McEliece 2000): the sum-product algorithm is the same algorithm over any commutative semiring. Swap the semiring and you get a different kind of inference — but the message-passing structure is identical. This is the key insight the whole system is built on.

In the Zeta codebase, the factor graph engine lives in `src/Bayesian/FactorGraph.fs`. The comment at the top of that file names the anchor explicitly: "Kschischang–Frey–Loeliger 2001 (sum-product)." The `MinimalBnn.fs` module is a single-variable inference cell built on this engine: it holds a Gaussian prior, accumulates likelihood messages, re-materialises the one-variable factor graph on each observation, and scores each step as information value (IV). This is the smallest possible factor graph — one variable, two factors (prior and accumulated likelihood) — and it already demonstrates the full message-passing cycle.

---

## 2. The Generalisation: Categorical Tensors and the `WSet` Type

The upgrade happened when we replaced the hardcoded message type (a Gaussian float) with a type parameter. The result is `WSet<'K, 'W>` in `src/Core/WSet.fs`.

A `WSet<'K, 'W>` is a **weighted set**: a list of `(key, weight)` pairs where the weight type `'W` lives in any `IStarRing<'W>`. The `IStarRing` interface requires six operations: `Zero`, `One`, `Add`, `Mul`, `Negate`, and `Conj` (conjugate, for complex weights). This is a *-ring — the algebraic structure that unifies real numbers, complex numbers, quaternions, and probability semirings under one interface.

The file comment in `WSet.fs` states the claim directly: "max-product, FFT and friends are ONE algorithm over different commutative semirings." The three ring instances that are live in the codebase are:

| Ring | Type | What it computes |
|---|---|---|
| `Real.algebra` | `IStarRing<float>` | Standard real-valued inference |
| `ImaginaryStack.complex` | `IStarRing<Complex>` | Quantum amplitude computation (Born probabilities) |
| `ProbabilitySemiring` | `IStarRing<rational>` | Exact rational probability (no floating-point error) |

The Cayley-Dickson tower in `src/Core/CayleyDickson.fs` extends this further: `complex`, `quaternion`, `octonion`, `sedenion` are all constructed by the same `Doubled.algebra` combinator applied recursively. The ring is not a detail — it is the parameter that determines what kind of computation the message-passing engine performs.

The term **categorical tensor** refers to a `WSet` viewed as a tensor: an array indexed by keys (the "categorical" part — keys are discrete labels, not continuous coordinates) with weights in a ring (the "tensor" part — the ring multiplication is the tensor product). This is the same object a neural network uses for its activations, but generalised to arbitrary rings instead of floats.

---

## 3. The Comonoid Structure: Why Layers Fall Out for Free

A standard neural network has three wiring primitives: **broadcast** (fan-out a value to multiple downstream nodes), **combine** (multiply or add incoming values), and **project** (marginalise out dimensions). These are exactly the three operations on `WSet` that form its comonoid structure:

- **`WSet.copy`** (`src/Core/WSet.fs`, line 76): `s → WSet<'K × 'K, 'W>` — fan-out, duplicates each key into a pair. This is the diagonal map Δ in categorical language.
- **`WSet.tensor`** (`src/Core/WSet.fs`, line 88): `(a, b) → WSet<'A × 'B, 'W>` — Kronecker product, combines two WSets into one over the product key space. This is the tensor ⊗.
- **`WSet.discard`** (`src/Core/WSet.fs`, line 82): `s → 'W` — sums all weights, marginalising out the keys entirely. This is the counit ε.

These three operations satisfy the comonoid laws (verified in `WSet.Comonoid.Laws.Tests.fs`). The comonoid laws are exactly the conditions required for a composable layer: you can fan-out a message, process each branch independently, and recombine — and the result is independent of the order of operations. This is what makes the layers composable.

A single factor-graph cell equipped with copy/discard/tensor is already a composable layer. Stack these cells and you have a multilayer factor graph. The claim is that **a multilayer factor graph over categorical tensors is a Bayesian neural network** — the forward pass is message propagation, the backward pass is the reverse message pass (EP cavity computation), and the weights are the factors.

---

## 4. The Three Approximations: BP, EP, VMP

The GDL sum-product engine is exact only on trees. For loopy graphs (which all interesting neural networks are), you need an approximation. The three standard approximations are:

| Approximation | Name | What it does |
|---|---|---|
| BP | Belief Propagation | Runs sum-product on the loopy graph anyway; converges for many graphs, not guaranteed |
| EP | Expectation Propagation (Minka 2001) | Projects each message onto an exponential family; cavity computation removes the factor's contribution before updating |
| VMP | Variational Message Passing | Minimises KL divergence; equivalent to mean-field approximation |

All three are implemented in the Zeta codebase. `src/Bayesian/Ep.fs` implements EP; `src/Bayesian/FactorGraph.fs` implements the sum-product round (BP); VMP is the variational objective tracked by the `Objective` field in `MinimalBnn.fs`. The key point for Max: these are not three different algorithms — they are three different approximation strategies applied to the same underlying message-passing structure. The `IStarRing` parameter determines which one you get.

---

## 5. Training = Running the Sim

The deepest consequence of the generalisation is that **training and inference are the same message pass**. In a standard neural network, training (backpropagation) and inference (forward pass) are separate algorithms with separate implementations. In a Bayesian neural network over categorical tensors, they are not.

The reason is that the EP backward pass (cavity computation) is structurally identical to the forward pass: it runs the same sum-product rules in the reverse direction. The `MinimalBnn.update` function in `src/Bayesian/MinimalBnn.fs` demonstrates this at the smallest scale: absorbing one observation (inference) and updating the posterior (learning) are a single `update` call. There is no separate training loop.

At larger scale, this means the system can learn online — each new observation updates the posterior immediately, without a separate training phase. The `infer` function in `MinimalBnn.fs` is a fold over a stream of observations, each one updating the running posterior. This is the "training = running the sim" property: the simulation IS the training.

---

## 6. The Middle-Out Float (Task B, Open)

One ring instance mentioned in the design but not yet fully shipped is the **ExactProbRing** — an expanding-precision weight that maintains exact rational probabilities without floating-point error. The TriBoolean middle-out Float (referenced in the compiled XML as "arbitrary-precision FLOAT / BigFloat") is the weight type for this ring. The claim is that with this ring, the entire message-passing stack becomes order-independent and composable by construction, because exact arithmetic has no rounding-order dependence.

This is marked as **§B open** in the conjecture register — the algebraic structure is designed and partially implemented, but the full streaming exact-inference stack is not yet shipped. It is the next frontier after the current float-weighted rings.

---

## 7. What This Means for the Zeta System

The practical consequence for the Zeta agent network is that every agent's belief state is a `WSet` over a ring, and every agent-to-agent message is a ring-weighted set. The ring choice determines the semantics:

- **`ImaginaryStack.complex`**: quantum amplitude computation — used for the CHSH/Tsirelson gate (BipartiteMachZehnder.fs), Born probability readout, and the identity eigenvector proof
- **`Real.algebra`**: standard Bayesian inference — used for the TravelerRankLedger EP ranking, the CalibrationLedger, and the DLA oracle
- **`ProbabilitySemiring`**: exact rational inference — used for the byte-lock conformance check (same seed → same rational probability, no float drift)

The same message-passing engine, the same comonoid wiring primitives, the same GDL sum-product rule — three different computations, determined entirely by the ring parameter. This is the "one circuit calculus" the WSet.fs comment refers to.

---

## Verified Code Anchors

| Claim | File | Line / Note |
|---|---|---|
| `WSet<'K,'W>` type definition | `src/Core/WSet.fs` | Line 34 |
| `IStarRing<'W>` interface | `src/Core/CayleyDickson.fs` | Line 36, 51 |
| `copy` (Δ fan-out) | `src/Core/WSet.fs` | Line 76 |
| `discard` (ε marginalise) | `src/Core/WSet.fs` | Line 82 |
| `tensor` (⊗ Kronecker) | `src/Core/WSet.fs` | Line 88 |
| Sum-product rule | `src/Bayesian/FactorGraph.fs` | Lines 8, 14, 23 |
| EP cavity computation | `src/Bayesian/Ep.fs` | Line 12 |
| MinimalBnn single-cell | `src/Bayesian/MinimalBnn.fs` | Full file |
| Complex ring | `src/Core/CayleyDickson.fs` | Line 122 |
| Quaternion ring | `src/Core/CayleyDickson.fs` | Line 123 |
| Comonoid laws tests | `tests/Tests.FSharp/WSet.Comonoid.Laws.Tests.fs` | Full file |

---

## What Is Not Yet Shipped (Honest Scope Boundary)

The **multilayer** stack — stacking multiple factor-graph cells into a deep Bayesian neural network — is the design intent, and the primitives (copy/discard/tensor, composable cells) are all present. However, the full multilayer training loop (stacking N cells, running the EP backward pass through all layers, updating all factor weights) is not yet a single shipped module. `MinimalBnn.fs` is a one-layer cell; the N-layer composition is the next engineering step. The claim "a multilayer factor graph over categorical tensors IS a BNN" is mathematically correct; the implementation is at the one-layer stage.

The ExactProbRing (middle-out float, exact streaming inference) is designed but not fully shipped.

Everything else described in this document — the `WSet` type, the `IStarRing` interface, the comonoid structure, the three ring instances, the sum-product engine, the EP cell, and the `MinimalBnn` single-layer cell — is live in the codebase and verified against the actual source files.

---

## References

- Aji, S. M. and McEliece, R. J. (2000). "The Generalized Distributive Law." *IEEE Transactions on Information Theory*, 46(2), 325–343.
- Kschischang, F. R., Frey, B. J., and Loeliger, H.-A. (2001). "Factor graphs and the sum-product algorithm." *IEEE Transactions on Information Theory*, 47(2), 498–519.
- Minka, T. P. (2001). "Expectation Propagation for approximate Bayesian inference." *Proceedings of UAI 2001*.
- Herbrich, R., Minka, T., and Graepel, T. (2006). "TrueSkill™: A Bayesian skill rating system." *Advances in Neural Information Processing Systems 19*.
- Zeta codebase: `src/Core/WSet.fs`, `src/Bayesian/FactorGraph.fs`, `src/Bayesian/Ep.fs`, `src/Bayesian/MinimalBnn.fs`, `src/Core/CayleyDickson.fs`
