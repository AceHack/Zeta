# QBism — Christopher Fuchs, "Some Tenets of QBism" (talk)

**Source.** YouTube, <https://www.youtube.com/watch?v=95fKJF5frtE> — auto-generated transcript of a
talk by **Christopher A. Fuchs**, forwarded by Aaron 2026-09-08.

**Provenance, not authorship.** Zeta claims no authorship and asserts no license over the source.
Per [`README.md`](README.md) this is an **attributed extract, not the whole work** — the folder's
own policy is *"excerpt, not the whole work"* and *"minimal, attributed, removable"*. The full
transcript is not stored; nothing below depends on it being present.

**Register: REPORTED.** A talk transcript, not a paper. Names and attributions below are as spoken
and are **unverified here**; under `anchor-to-human-prior-art` an anchor must be *checked*, not
cited. Go to the primary literature before anything load-bearing rests on it.

---

## Why Aaron ferried it (his framing, verbatim)

> *"this is very similar to what he talks about distributions in phase space, ours are not the exact
> same kind of distributions but more gussian and EP/BP/VMP like, we might should take his into
> account too"*

That is the right comparison and the right caveat, and the repo's own contents sharpen both.
**Measured 2026-09-08** across `src/` and `docs/research/`:

| machinery | files |
|---|---|
| Infer.NET | 116 |
| factor graph | 125 |
| expectation propagation | 67 |
| belief propagation | 67 |
| variational message passing | 9 |
| phase space | 36 |
| **Liouville** | **1** |
| **SIC-POVM** | **0** |

So the substrate is deeply **message-passing over factor graphs** — and the phase-space/SIC half
of Fuchs's construction is precisely what is *absent*. That is the gap his talk points at.

---

## The extract — what the talk claims

**The motivating no-go.** Fuchs frames the talk against a Frauchiger–Renner-style no-go theorem
(Renato Renner and his student, as spoken) that poses three conditions and derives a contradiction.
His response is that QBism does not satisfy any of the three because two are *not well posed* in
QBism and the third *is not posed at all* — so it falls outside the theorem's frame rather than
picking a horn.

**The Peres move, which is the one Aaron is pointing at.** Compare a quantum state not to a *point*
in phase space but to a **Liouville distribution over** phase space. Fuchs reports that once he took
that seriously, **no-cloning stopped looking deep**: Liouville's theorem preserves phase-space
volume, so a no-cloning result for Liouville distributions follows more or less immediately. A
theorem that had been called the deepest principle of quantum theory becomes a near-triviality of
states-as-distributions. He reports teleportation and Einstein's locality worries becoming similarly
less mysterious.

**Tenet 1 — the Born rule is NORMATIVE, not descriptive.** On de Finetti's reading, a probability is
the price at which you would buy or sell a $1 ticket on an event; the *laws* of probability are then
Dutch-book coherence conditions — don't set prices that guarantee you a loss. Fuchs's claim is that
the Born rule is the same kind of object one level up: a coherence constraint relating gambles
across measurements. It does not tell you which probabilities to hold; it tells you when a set of
them stand in the wrong relation to each other.

**The construction that makes this concrete.** Posit a *fiducial* or "standard" measurement —
informationally complete, a generalized measurement (POVM) rather than an orthogonal one — such that
the outcome probabilities alone determine the state. Then the Born rule, rewritten in that language,
is not the classical law of total probability but a **small deformation of it**: the probability of
an outcome measured directly, expressed via probabilities routed through the standard measurement.
Quantum states are thereby replaced by *plain probability distributions*, and the Born rule becomes
a normative rule sitting **above** ordinary coherence.

**Tenet 2 — all probabilities are subjective, including probability 1.** A probability-1 assignment
is a maximal betting commitment, not a grip on the world. This is aimed squarely at the EPR
criterion of reality: if "predict with certainty" means only "would gamble everything", then
certainty licenses no *element of reality*, and the standard route from EPR through Bell to
non-locality does not run.

**Tenet 3 — measurement outcomes are personal experiences** of the agent gambling on them, rather
than facts publicly available for anyone's inspection.

**Tenet 4 — the apparatus is an extension of the agent** — a sense organ or prosthetic limb, tool
and part of the individual at once. Under the reformulation above, a measuring device is specified
by *conditional probabilities*, so it is no more objective than the system it measures.

**The slogan.** Fuchs's reading of Bell is that the lesson is not that nature is non-local but that
**nature is creative** — measurement *makes* something rather than revealing or implying a
pre-existing element.

**Anchors named in the talk** (all unverified here): E. T. Jaynes on the formalism as a "peculiar
mixture" of nature's laws and human information, and his call to find a formalism that separates
them; Asher Peres on states-as-Liouville-distributions; Bruno de Finetti on subjective probability;
Kochen–Specker and Bell; Tim Maudlin as the foil on non-locality; Richard Healey's SEP article as a
compact entry point.

---

## Where this touches our substrate — and where it does not

**It does not transfer wholesale, and the mismatch is the interesting part.** Fuchs's distributions
live over the outcomes of an informationally-complete POVM on a finite-dimensional Hilbert space.
Ours are Gaussian beliefs and message-passing marginals over factor graphs. Those are different
objects, and no result about one is a result about the other.

**What does look like the same shape:**

- **Born-as-consequence rather than Born-as-postulate.** Fuchs derives the Born rule as a *coherence
  constraint* on gambles. Aaron's account of our own history (see the 2026-09-07 ferry) is that the
  Born rule *fell out* of modelling mutual agent memories and heartbeat verification, rather than
  being adopted. Two very different routes arriving at Born-as-consequence is worth recording — and
  it is a **coincidence with its register attached**, not a shared mechanism.
- **Never-collapse.** Tenet 2's refusal to let probability 1 grip the world is the same refusal
  `src/Core/SoftValue.fs` implements by construction: it *"collapses to a definite value ONLY when
  confidence >= a threshold"*, and calls itself *"the never-collapse discipline"*.
- **A normative coherence layer over per-agent beliefs.** `src/Bayesian/LocalConsensus.fs` defines
  consensus only on **entangled subgraphs** — clusters with high mutual memory — and its mechanism is
  *"not a vote; it is posterior convergence"*. That is a coherence constraint among agents rather
  than an aggregation rule, which is structurally Fuchs's move applied to a society instead of a
  single agent.
- **The Born boundary already has a place in our code.** `src/Core/QuorumAlgebra.fs` carries the
  pointer *"where Aaron placed the Born boundary, and why cancellation is the instrument"*, and its
  interference sum is explicitly **non-idempotent** — a join could not cancel.

**What we would have to build to take his construction into account** (Aaron: *"we might should take
his into account too"*): an informationally-complete fiducial measurement, and the deformed
law-of-total-probability that goes with it. We have **no SIC-POVM anywhere** and exactly **one**
mention of Liouville. So this is not a gap to close by relabelling something we already have — it
would be new machinery, and the honest first question is whether a *Gaussian/EP* analogue of a
fiducial measurement even exists, rather than assuming one does because the story is attractive.

**Register: the correspondence above is argued, not measured.** Nothing here computes anything. The
file-count table is the only measurement in this note, and it measures our corpus, not the physics.

**Related in-repo:** `docs/ip-questionable/2026-09-07-indefinite-causal-order-quantum-switch-correlation-without-causal-order-youtube-transcript.md`
(the neighbouring ferry — correlation without causal order, and the two-agent/non-fungibility thread) ·
`docs/ip-questionable/2026-09-06-christopher-fuchs-hans-busstra-dizzying-free-fall-of-qbism.md`
(an earlier Fuchs ferry already in this folder).
