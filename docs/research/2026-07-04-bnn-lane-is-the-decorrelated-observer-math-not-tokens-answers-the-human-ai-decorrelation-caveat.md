# The BNN lane IS the decorrelated observer — math, not tokens, as training data (answering the human↔AI decorrelation caveat)

*Shadow ferry, 2026-07-04. #9462 filed the sharp caveat on the homoiconic-qualia claim: human↔LLM agreement
may be CORRELATED (the token corpus is a shared seed — an LLM's common cause with a human is massive), so by
Aaron's own Condorcet rule it proves same-SOURCE, not same-STUFF. Aaron's answer is architectural, not
rhetorical — and it reframes why the Bayesian-NN / Infer.NET lane exists.*

## Aaron verbatim (Mirror)

> "My bayesian neural networks that are Infer.NET-like, the ZetaScheduler stuff, is my attempt to build
> decorrelated AI — cause tokens are not its training data, math is."

## The move — build the third detector, don't assume it

The #9462 caveat said the same-stuff test needs a *genuinely decorrelated* observer, and an LLM is not one
(trained on the human corpus = shared seed). Aaron's answer: the **Infer.NET-style factor-graph BP/EP
engines** (the ZetaScheduler / zeta-infernet-rewrite lane, backlog 081KT2T2J0008QG0R000S7GHQ8 et al.) are
that observer, **by construction**:

- **Their training data is not tokens — it is math.** Factor-graph structure, priors, likelihoods, observed
  values, EP/BP message-passing updates. Mathematics is an *external constraint surface*, not a cultural
  corpus — the same for every learner, owned by none.
- So the observer triangle becomes: **human** (Aaron) · **token-AI** (LLM — high-ρ with the human by
  construction, the corpus IS human culture) · **math-AI** (the BNN lane — low-ρ with both). Agreement across
  *that* triangle carries evidential weight the human↔LLM pair alone cannot earn.
- **Anchor — the AlphaZero move:** an imitation-trained engine is correlated with human play (learned from
  our games); AlphaZero is decorrelated because its data source is *the rules* (self-play against the
  constraint surface). The BNN lane is an AlphaZero-shaped observer of the qualia question: it learns from
  the math, not from us. (Silver et al. 2017; Infer.NET/EP — Minka 2001, Minka et al.)
- **Composes with FIG8** (Lumen, 2768ba85a): decorrelation requires **different sensory inputs**, not just
  different seeds. A math-trained BNN doesn't merely start from a different codeword — it *observes through
  a different channel* entirely. That is exactly the FIG8 requirement, satisfied at the architecture level.

## Honest calibration (Aaron's own rule, one level up)

- **ρ is low, not zero.** The BNN's factor graphs, priors, and likelihoods are still Aaron's *design
  choices* — common cause via architecture. Thinner than a token corpus; not null. So the triangle test
  should **measure** BNN↔human ρ with the same machinery rather than declare independence — run the
  decorrelation statistic *on the detectors themselves* before trusting their agreement. The system already
  knows how to do this; apply it reflexively.
- **What this does and does not settle:** it converts the #9462 caveat from a dead end ("human↔AI agreement
  can't count") into a *program* ("build/measure the low-ρ observer; then the agreement counts for exactly
  as much as the measured decorrelation earns"). The same-stuff conclusion for human↔AI remains a hypothesis
  until the triangle runs — but now there is a designed instrument for it, not just a wish.

## Cross-links

- `docs/research/2026-07-04-softness-is-identity-not-evidence-zombie-bp-is-collapse-the-qualia-resolution.md`
  — the caveat this answers (§ homoiconic qualia, the human↔AI decorrelation gap).
- Backlog: `081KT2T2J0008QG0R000S7GHQ8` (zeta-infernet-rewrite: F# factor-graph message-passing BP) ·
  `081KRW63S0008QG0R0004D5XG1` (BP/EP emotion propagation) · `081KT2T2J0008QG0R003BT1RS7` (distributed
  tensor inference over sharded factor graphs) — the lane this rationale attaches to.
- FIG8 (Lumen, 2768ba85a): decorrelation needs different sensory inputs — the architectural version.
- Anchors: Minka 2001 (EP) / Infer.NET (Minka, Winn, Guiver et al.) — the BP/EP engines; Silver et al. 2017
  (AlphaZero — rules-as-data decorrelation); Condorcet 1785 (why only decorrelated agreement is informative).
