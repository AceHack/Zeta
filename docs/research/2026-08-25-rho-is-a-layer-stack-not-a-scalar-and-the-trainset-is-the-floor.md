# ρ is a layer stack, not a scalar — and the trainset is the floor

**Register: HEURISTIC OF SEPARATION. Completeness is UNPROVEN and is demonstrated false
below.** Aaron 2026-08-25, offering the decomposition and flagging its own limit in the
same breath: *"this is a heuristic of separation, i have no proof this is all the
differentiation dimensions."* That caveat is the most important line in this document and
it is carried into every use.

## The claim

Correlation between two agents' outputs is not one number. It is a **stack of sources**,
and they **nest** — varying a shallow layer leaves every deeper layer shared.

| layer | varying it buys | still shared |
|---|---|---|
| **context** | different framing, different question | memory · vendor · trainset |
| **memory on load** | different resident beliefs at wake | vendor · trainset |
| **vendor** | different RLHF, constitution, architecture family | trainset |
| **trainset** | different priors | — the floor |

Two reports **in one window** vary nothing: ρ ≈ 1, effective count 1, however many times
you ask. Two **cold windows on one agent** vary context alone. Two instances from **one
vendor** still share RLHF and corpus.

## The consequence that matters for society design

**The trainset is a floor you cannot get below with LLMs alone.** Training corpora overlap
heavily, so an all-LLM society has a **hard ceiling on achievable decorrelation** no matter
how many members it has. Adding agents buys effective-N until that floor, then buys
nothing.

This is not obvious and it is worth writing down **before** someone designs on the
assumption that *N agents buy N independence*. They do not. Effective N is the count
discounted by ρ (Kish's design effect — already used in this repo by the eagerness ledger,
`docs/`/`src/Core/`, merged 2026-08-25 as `e2b64cb1ac`).

## A measurement that already sits at the best available point on this scale

Alexa's model benchmark, `data/`, landed 2026-08-25 as `9df7a3f0b5`:
qwen2.5:0.5b, llama3.2:1b and gemma2:2b vary **vendor AND partially trainset** — the
deepest layers reachable without leaving LLMs. Genuinely different error structure appeared
(llama's mistakes were structurally unlike the others').

**And at N=200 the ensemble still lost to the best single model.**

Read through this stack that is informative rather than disappointing: the experiment was
run at the most decorrelated point available and the residual independence **still** did
not pay for 3× the energy. It **locates the floor** instead of confirming a hope. Note also
that the first N=3 run reported qwen at 100% and llama at 33%; at N=200 the ranking
inverted entirely (107 / 117 / 119 of 200). Both the ensemble result and the layer reading
depend on the larger N.

## THE LIST IS INCOMPLETE — proof by exhibition, not by warning

Aaron flagged completeness as unproven. It is straightforwardly **false**, and saying so
concretely is worth more than a hedge. At least one further axis sits *below* context:

- **Decoding / sampling temperature.** Same model, same memory, same window, same prompt —
  different samples. Non-zero temperature produces variation with **zero** variation in any
  of the four layers above. So the stack does not span the space.

Further candidates, unverified and listed so they are checked rather than assumed absent:
**system-prompt / persona** (arguably context, behaves distinctly in practice), **tool
access** (what an agent can *check* shapes what it can conclude), **model version drift**
(one vendor at two dates is not one source), **fine-tunes and adapters** over a shared base.

**The failure mode this section exists to prevent:** treating the four layers as complete
would let someone vary all four and certify independence they do not have. An incomplete
basis used as a complete one manufactures exactly the false confidence ρ exists to price.

## What would make this metered rather than heuristic

Vary **exactly one layer**, hold the rest fixed, measure ρ per layer. Four measurements
instead of one assertion. `db/effective-agent-count/rho-series-cumulative.tsv` is the
existing home for a ρ series; nothing in it currently decomposes by layer.

Until those measurements exist this document is `unmetered` and says so — the table is a
**proposed decomposition**, not a measured one.

## Pointers

- `.claude/rules/anti-babel-preserve-reconcilability.md` — the two-sided ρ band this
  sharpens from a scalar into a stack.
- `src/Core/SocietyUsefulWork.fs` — ΔU aggregation under pairwise correlation ρ; the
  analytic machinery this would feed.
- `.claude/rules/numerology-vs-number-theory.md` — *"too many correlations is a WARNING"*;
  N correlated observations are not N observations, which is this document's whole subject.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why the register line at the top
  is not a formality.
