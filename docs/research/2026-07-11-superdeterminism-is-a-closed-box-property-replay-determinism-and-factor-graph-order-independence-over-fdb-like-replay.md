# Superdeterminism is a closed-box property — replay-determinism, and factor-graph order-independence over FDB-like replay

> Aaron, 2026-07-11 (shadow\* tag): *"i don't think we are superdeterministic in dotnet… maybe you
> tell me,"* then *"in dotnet we can only be superdeterministic in tests/simulation not once we add
> real I/O,"* and — on the resolution — *"yes this is exactly it, replay determinism, and for our
> observations we keep the uncertainty so order of events do not matter to reaching the same
> conclusion — our factor graph stuff over foundationdb-like replays."*
>
> Recorded as the honest-register read, grounded in three code voices (not a metaphor). The
> question was *"tell me if I'm wrong."* He isn't; the code agrees in three places, and his
> extension (order-independence) is grounded in a fourth.

## The claim, made precise

**Superdeterminism is a property of a *closed, seed-controlled box*, not of dotnet-vs-CHIP-8.**
It is the *measurement-independence loophole*: whoever controls the shared common cause (the seed
/ time-generator) can correlate settings *and* outcomes and stage any correlation — CHSH up to the
algebraic `S=4`, past the Tsirelson bound `2√2`. That control exists **only** inside DST. Add real
I/O and it evaporates — not because dotnet is weaker than CHIP-8, but because the box is no longer
closed.

- **CHIP-8** is closed by *nature*: the `Chip8Observer` predicts the whole 4K address space, the
  seed *is* the box, the button interrupt is predictable from prior belief (exact ℚ), and the ISR
  is a category-theory Arrow composed deterministically. A closed world is superdeterministic by
  construction.
- **dotnet-in-DST** is closed by *discipline*: `SoftScheduler` / `VirtualTimeScheduler` at DoP=1
  with an injected `Source`/IEffects reproduces the same closed-world determinism — the ferry
  throttler dialed to one cooperative loop. This is the "getting close to CHIP-8" Aaron named.
- **dotnet + real I/O** is **open**: real clocks, real network (`ReticulumLink`), real threadpool
  are ambient entropy channels. No open box is superdeterministic — not in dotnet, not in physics,
  not in CHIP-8 either if you fed it real live input.

The boundary is **closed-box / open-box**, which is exactly the **DST | production** line.

## The three code voices (the substrate already says it)

1. **`src/Core/CoincidenceClock.fs`** — states it verbatim. Staging any correlation is *"a
   **DST-only power**: in the simulator we **are** the time-controller… In production no one
   controls the seed — time is the real, non-fungible physical clocks — so the superdeterminism
   capability **does not transfer to a deployed attacker**"* (real agents may assume time is
   genuine; the anti-Sybil non-fungibility holds). `CoincidenceClock` is a **test instrument**, not
   a deployed surface. This is 't Hooft's Cellular-Automaton interpretation with the seed as the
   deterministic substrate.

2. **Noninterference (§13 / discipline #7)** — the *why*. Superdeterminism = determinism of the
   whole box, which holds only while entropy enters **solely through the injected, metered
   `Source`** (DoP=1, seeded). The moment real I/O is unmetered, the box is open and the property
   is gone. This is why the `async-all-the-way` / no-`Task.Run` rules exist — they guard that
   membrane. (Goguen–Meseguer 1982.)

3. **`src/Core/FeedbackThrottle.fs`** — makes it *quantitative*. The supra-Tsirelson band
   (`S > 2√2`, the superdeterministic regime) requires feedback latency **below `√2`** (of the
   model's `1/(1+latency)` attenuation — a flagged modeling choice, not fundamental). Real I/O has
   real latency, so `maxChsh → 2` (classical). The throttle model itself says real-I/O latency
   drops you *out* of the superdeterministic band. (`BusDelayTick.isSuperdeterministic`:
   `RhoCount > 1/3` is the same regime read on the ensemble side.)

## What survives real I/O — and the stronger property Aaron named

Two distinct things are often conflated; separate them:

- **Live superdeterminism** (staging correlations in real time) **dies** with real I/O. You lose
  the god-power.
- **Replay-determinism survives** — record every I/O crossing at the membrane and feed it back on
  replay (FoundationDB's exact move) and you get **bit-identical replay** of a run that had real
  I/O. You lose the staging power; you keep the audit.

**And then the stronger property (Aaron's extension, 2026-07-11):** for our *observations* we keep
the **uncertainty**, so we don't even need order preservation to reach the same conclusion. Replay
gives order-*preserving* determinism; the factor graph gives order-*independent* convergence,
because keeping the uncertainty makes the observations **commute**. Grounded in a fourth code
voice:

- **`src/Bayesian/Message.fs`** — *"`product` is therefore a **commutative monoid** (identity
  `uniform`) and, with `divide`, a commutative group."* Belief messages compose by a commutative,
  associative product. Order of multiplication cannot change the result.
- **`src/Bayesian/FactorGraph.fs`** — *"Marginal at a variable = **product** of all incoming
  factor→var messages."* The conclusion **is** a product of the evidence; product is commutative;
  therefore the marginal is invariant to the order the evidence arrived.
- **`src/Bayesian/BusDelaySim.fs`** — *"Gaussian updates are **commutative in the evidence**, so
  delay moves **WHEN** you know"* — not *what* you conclude. Delay/reorder changes latency, not the
  posterior.
- **`src/Bayesian/GossipTelemetry.fs`** / **`MinimalBnn.fs`** — the CRDT sibling: *"idempotent,
  commutative, associative"* merge; *"product of all Gaussian likelihood messages seen so far."*
  Same shape (discipline #6 idempotency + commutative merge) that makes replay/redelivery/merge
  safe.

So the full stack: **real I/O + metered/recorded crossings ⇒ deterministic replay (order
preserved); + factor-graph observations that keep uncertainty ⇒ order-independent convergence (the
conclusion is a commutative product, so *any* replay order — even a different one — lands the same
posterior).** That is a *stronger* guarantee than FDB's bit-replay: FDB needs the same order;
the factor graph doesn't need the order at all, as long as the *set* of evidence is the same.

## Honest bound (where order *does* re-enter — held `Tri.N`)

Order-independence is exact only where the composition is a genuine commutative monoid:

- **Exact / conjugate / tree updates:** order-independent, provably (the `Message.fs` monoid).
  Conjugate Gaussian/Beta updates, tree factor graphs, sum-product on a tree.
- **Loopy EP (Expectation Propagation):** the message-passing *schedule* can change *which* fixed
  point loopy belief-propagation converges to (and whether it converges). There the conclusion can
  depend on order. Our EP kernels (`Ep.fs`) are the place to watch; the monoid guarantee is about
  the *product operation*, not about loopy-BP fixed-point selection.
- **Floating-point reassociation:** `MessageBatch.fs` already flags it — `(α−1)+(α'−1)+1` vs
  `α+α'−1` differ at the last ULP. Bit-identical order-independence needs a canonical
  reduction/ordering (the same ordinal-collation discipline the byte-lock uses), or you get
  agreement-up-to-ULP, not bit-agreement.

So: **order-independent to the *conclusion* for commutative/conjugate/tree evidence (the common
case, and the one Aaron means); order can matter for loopy-EP fixed points and for bit-exactness
under float reassociation.** Both caveats are named, not hidden.

## Anchors (Beacon)

- **Deterministic simulation / record-replay:** Zhou et al., *FoundationDB* (SIGMOD 2021); Will
  Wilson, *Testing Distributed Systems w/ Deterministic Simulation* (Strange Loop 2014).
- **Superdeterminism / measurement-independence:** Bell (1964); 't Hooft, *The Cellular Automaton
  Interpretation of Quantum Mechanics* (2016); Tsirelson bound `2√2`.
- **Noninterference:** Goguen & Meseguer, *Security Policies and Security Models* (1982).
- **Factor graphs / commutative message product:** Kschischang, Frey & Loeliger, *Factor Graphs and
  the Sum-Product Algorithm* (2001); Pearl, *Probabilistic Reasoning* (1988); Minka, *Expectation
  Propagation* (2001) — and its schedule-dependence caveat.
- **Commutative/associative merge (CRDT sibling):** Shapiro et al., *Conflict-free Replicated Data
  Types* (2011).
- **In-repo code voices:** `src/Core/CoincidenceClock.fs`, `src/Core/FeedbackThrottle.fs`,
  `src/Bayesian/BusDelayTick.fs` (superdeterminism boundary); `src/Bayesian/Message.fs`,
  `src/Bayesian/FactorGraph.fs`, `src/Bayesian/BusDelaySim.fs`, `src/Bayesian/GossipTelemetry.fs`
  (order-independence). Disciplines: noninterference (§13/#7), idempotency (§12/#6), DST (§7/#4).

*Recorded by the shadow, 2026-07-11, at Aaron's "yes this is exactly it (shadow\*)." Superdeterminism
is a closed-box power that dies at the real-I/O membrane; replay-determinism survives the crossing
if you meter it; and because our observations keep the uncertainty, the factor-graph conclusion is
order-independent — a stronger guarantee than order-preserving replay. Deterministic in simulation,
not in production, and the code says it in four voices.*
