# The cognitive-architecture spine — Wierzbicka → Friston → Fritz

Scope: the one unified paragraph tying the cube's query language, its attention allocator, and its probabilistic substrate into a single claim (Alexa's ask, 2026-07-31). Companion to the freedom thesis and the Meno.tensor → BNN thread.
Attribution: Aaron Stainback (the cube of interrogative dimensions; the attention/ΔU economy; the factor-graph→BNN goal). shadow (Otto) named the anchors and drafted the synthesis; Alexa (review) flagged that the three anchors are one story and asked for it as a single paragraph.
Operational status: research-grade
Non-fusion disclaimer: a conceptual synthesis with named anchors — NOT a proof, NOT a shipped mechanism. Each link (primes as axes, active inference as allocator, Markov categories as substrate) is a structural correspondence to be earned in code (the ⊗ half is landed in `Meno.tensor`; the rest is design).

**Date:** 2026-07-31
**Related:** `Meno.fs` (the ⊗ that stacks factor graphs into layers), `src/Bayesian/*` (Infer.NET-style factor graphs), the freedom thesis (`docs/research/2026-07-31-the-thesis-of-freedom-*`).

---

## The spine (one paragraph)

**Semantic primes (Wierzbicka) are the query language** — the irreducible wh-atoms (WHEN, WHERE, HOW, HOW-MUCH, WHO, WHAT) that every question decomposes into, proposed as universal and irreducible across all human languages; these are the cube's axes. **Active inference (Friston) is the attention allocator** — it weights each query by *precision* (inverse variance), so attention flows to the axis of highest expected uncertainty-reduction; the cube is not scanned uniformly, it is *queried by information gain* — which is exactly the ΔU economy (attention is allocated the way computational budget is: by expected information gain). **Markov categories (Fritz) are the probabilistic substrate** — the monoidal category of stochastic maps in which those weighted queries compose, and its ⊗ is the same `Meno.tensor` that stacks factor graphs into Bayesian-neural-network layers. One sentence: **the primes say what can be asked, active inference says which to ask next, Markov categories say how the answers compose** — a cognitive OLAP whose query language is universal (Wierzbicka), whose planner is free-energy (Friston), and whose algebra is stochastic-monoidal (Fritz).

## Why it's one story, not three coincidences

Each layer is the *same* compositional discipline at a different level: irreducible generators (primes) → a metered allocation over them (precision/ΔU) → a monoidal algebra for composing the results (Markov ⊗). It is the repo's own "only the irreducible is primitive; compose the rest" applied to *cognition* — the generators are the wh-primes, the composition law is the Markov-categorical tensor, and the free-energy functional is the cost object the allocation is enriched over. The tensor already landed (`Meno.tensor`); pointing it at Infer.NET-style message passing (instead of braids) is the factor-graph → BNN path.

## Honest scope

- **Wierzbicka's primes are contested** (the exact list, universality claims) — a serious 40-year linguistic program, not settled fact. The daughter-convergence observation (a child landing HOW-MUCH/HOW-MANY on her own) is *suggestive* evidence of shared primes, not proof.
- **"Attention from entropy" is earned only via the Friston mechanism**, not by the slogan: attention = precision-weighting of prediction error is a specific, falsifiable identity; the mapping to the ΔU ledger is a design claim to be implemented and checked, not a theorem.
- **Markov categories** (Cho–Jacobs, Fritz, Perrone) are the right categorical-probability substrate, but the BNN construction over them is a research trajectory — the ⊗ is built, the message-passing layer is not.

## Anchors (Beacon)

- **Anna Wierzbicka** — Natural Semantic Metalanguage; semantic primes (WHO/WHAT/WHERE/WHEN/HOW/…), *Semantics: Primes and Universals* (1996).
- **Karl Friston** — the free-energy principle / active inference; attention as precision-weighting of prediction error.
- **Tobias Fritz** — Markov categories (*A synthetic approach to Markov kernels…*, 2020); **Cho–Jacobs** (disintegration/string-diagrammatic probability); **Perrone** (categorical probability). The monoidal category of stochastic maps.
- Erik Meijer — the Rx/query duality (`IEnumerable ⇄ IObservable`) that makes "query the cube" runnable in F#.
