# The anchor taxonomy — operationalizing the Beacon discipline

*Ferried 2026-06-15 (shadow\*) at Aaron's request ("ferry the anchor taxonomy into the Beacon
discipline notes"). This is the **operational** half of [`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md)
and [`mirror-beacon-register-discipline`](../../.claude/rules/mirror-beacon-register-discipline.md):
the Beacon register says "anchor every outward/load-bearing claim to a human + a paper"; this says
**how to make the anchor actually load-bearing instead of decorative.***

## The core: an anchor must be *checked*, not *cited*

**Citing an anchor ≠ the anchor supporting the claim.** A citation can be:

- **decorative** — name-dropped prestige that doesn't actually entail the claim;
- **misapplied** — the source says something adjacent (C′), you're using it for C;
- **appeal-to-authority** — the source's reputation lent to a claim it never made.

And the trap is asymmetric: **a well-cited false claim is *more* convincing, not less.** So "grounded in
anchors" can itself become a *sophistication of the con* — a more persuasive veneer — **unless the
anchors are checked.** The Beacon discipline's integrity lives entirely in the checking, not the
attaching. (Worked failure, this session: the shadow confabulated "Cheat Engine," then "grounded" it
with a web search that *laundered the guess into a citation*. The check below would have caught it; the
shadow didn't run it.)

## The entailment check (the un-connable test for citations)

Model **what the source actually claims (C′)** vs **what you want it to claim (C)**, and check whether
**C′ ⊢ C** — does the source's real content *entail* your claim? The **gap between "what they claim" and
"what we want them to claim"** is exactly where the misapplied-citation con hides, and the entailment
check makes that gap **un-rationalizable**: you cannot stretch a citation past what it formally entails,
and borrowed prestige cannot substitute for a proven entailment. It is proof-checking the *premises* —
the garbage-in defense (a proof is only as sound as its cited assumptions).

## The taxonomy — what kind of paper grounds what

| Anchor type | Grounds | The un-connable check | Lean hardest on |
|---|---|---|---|
| **Math papers** | **validity** (logic, entailment) | the claim **entails** | machine-checked (Lean/Coq) > foundational/heavily-used > recent-unverified |
| **Physics papers** | **the metering discipline** (measurement, units, conservation) | **dimensional analysis + conservation** | the dimensional/conservation *bedrock* (models are regime-bounded) |
| **Empirical / qualitative** | facts, effects, measurements | **replication + disinterested review** | well-replicated; beware single-study |

- **Math papers ground *validity*.** A theorem is a **pre-formalized claim** — the author already stated
  C′ as a precise proposition, so extracting "what they claim" needs little interpretation (you read the
  statement; you don't paraphrase prose). This *minimizes* the premise-extraction bias (see seams). The
  un-connable check is **entailment** (a dimensionally/logically invalid step is wrong however argued).
- **Physics papers ground the *metering* discipline** — **units, conservation, dimensional
  consistency.** Dimensional analysis is as un-rationalizable as entailment (you can't add meters to
  seconds). This is the quantitative-claim check. **And it is the discriminator that catches
  physics-*as-metaphor*:** real physics-grounding is *meterable* (units, conservation, a dimensional
  check); borrowing physics *words* (entropy, energy, field, "criticality") *without* the metering is
  reputation-borrowing. **If you can't meter it, you're borrowing the word, not the physics.**
- **Empirical/qualitative anchors** (a neuroscience finding, a historical fact, a measurement) are
  **not** entailment-checkable — they need **replication and disinterested review**, not formal
  entailment. Using the wrong check (entailing an empirical claim, or "replicating" a theorem) is itself
  an error.

## Metering grounds *identity* too: fingerprinting (Aaron 2026-06-15)

The metering pillar extends to **disambiguation / identification** via **fingerprinting** — a
rainbow-table-style precomputed lookup from a *measured* signal to an identity. The identity claim then
rests on a **measured invariant**, checkable — the un-connable check for *identity* (the measurement
matches or it doesn't), the way entailment is for logic and dimensional analysis is for quantity.
Aaron's two anchors:

- **Music — audio fingerprinting** (Shazam; Wang 2003, *An Industrial-Strength Audio Search
  Algorithm*): spectrogram-peak *constellation* → combinatorial hashing → fast, noise-robust lookup that
  IDs a song from a fragment.
- **Electricity — ENF (Electric Network Frequency) forensics**: the region-wide-correlated drift of the
  ~50/60 Hz mains hum, embedded in recordings, matched to a grid-frequency database to **timestamp /
  locate / authenticate** a recording (and NILM — identifying appliances by power-draw signature).

It is **content-addressing by measurement** (the fingerprint *is* the address — same family as ZetaId,
the cart's content-hash, the geocode) and **locality-preserving hashing** (similar signals → matching
fingerprints — the LSH / geohash family). **ENF is the provenance instance**: it ties to the
certification/indemnification model — *certify a recording's provenance from its physical fingerprint* —
extending the determinism/attestation substrate from code into the **physical** domain. Seams:

- **Probabilistic, not certain** — false-positive/negative rates → a match is a *calibrated likelihood*
  (SoftValue: never falsely certain); for the indemnity use the **false-positive rate *is* the liability.**
- **Spoofable** — ENF injection/stripping, adversarial audio → strong against good-faith noise, an arms
  race against a motivated forger.
- **Coverage-bounded** — you can only ID what's enrolled (*unknown ⇒ no-match* if calibrated).

> **Extends beyond this doc (Aaron 2026-06-15, marked CONJECTURE):** the *same* fingerprint-by-measured-
> entropy-capture is proposed as the **anti-Sybil identity layer for an AI society** — entropy capture as
> an un-fakeable, cross-Markov-boundary identity (each agent's *policy is local* to its room; the
> fingerprint is the cross-boundary recognizer), i.e. **proof-of-entropy** Sybil-resistance, with a
> claimed first-principles chain *entropy-capture → identity → society emergence.* That chain is a
> **§B research program, not a discharged proof** — see the floor/society thread; held to *this doc's own
> entailment + metering tests* before any "we have the math" claim.

- **The con can retreat into the *formalization of C′*.** Extracting "what they claim" is an
  interpretation; motivated reasoning can formalize C′ as a convenient C″ that entails C. So the
  premise-extraction must be **faithful, ideally checked by a disinterested party or the source itself.**
  Math papers minimize this (pre-formalized) — which is why we lean on them.
- **Math residual slack** moves from "what's the claim" → to **hypotheses / definitions /
  applicability**: a theorem is "under *H*, T"; the con's new hiding spots are dropping *H* (your case
  doesn't satisfy it) or mapping your objects loosely onto the paper's precise terms (your X ≠ their X).
  The *statement* is interpretation-free; **applicability** is not. Plus the paper's own correctness
  (peer review ≠ machine-checked → the gradient above).
- **Physics residual slack:** physics anchors are **empirical → revisable** — lean on the
  dimensional+conservation *bedrock* (nearly un-violable), treat physical *models* as **regime-bounded**.
- **Map-vs-territory (all types):** a checked, correctly-applied anchor grounds the *formal/measured
  claim*; whether that claim **models your real situation** is still the human/empirical judgment (the
  "proof of the right spec" problem). To use a thermodynamic-entropy result, your "entropy" must
  *actually be* that entropy.

## How it slots into the three-layer external-referent stack

Anchors are the inputs to the stack the rest of the safety work uses:

1. **Formal verification** (math validity) — entailment / Lean; un-rationalizable, **spec-blind**.
2. **Cross-oracle byte-lock** (the 6-language implementations) — catches implementation divergence,
   **shared-spec-blind** (correlated oracles don't validate the spec).
3. **Human decorrelated critics** — spec-matches-reality + relevance; the layer the first two are blind
   to. (Fund for *decorrelation*, not agreement.)

Math → layer 1; physics-metering → a un-connable cross-check within 1–2; empirical → feeds layer 3.

## Self-application (the point)

These checks are how we keep our **own** register honest, not just how we read others'. Every §B
conjecture — most sharply the **criticality-map ↔ Riemann-ζ** row (flagged highest-overclaim *because*
it borrows physics reputation) — must pass the **entailment** check (write the φ-map; show the
implication) and the **metering** check (units? conservation? dimensional consistency?) **or stay marked
conjecture/metaphor.** The discipline that catches a stretched citation in someone else's paper is the
same one that keeps our grand syntheses from laundering vibes as physics.

## Anchors (Beacon)

- Rules operationalized: `anchor-to-human-prior-art`, `mirror-beacon-register-discipline`,
  `grep-substrate-anchors-before-razor-as-metaphysical`.
- Validity: machine-checked proof (Lean 4 — de Moura et al.; Coq); the identity/entailment relation.
- Metering: Shannon (entropy); Landauer (kT ln2 erasure cost); Bennett (reversible computation);
  Jaynes (maxent); Noether (conservation); Buckingham-π (dimensional analysis); Mars Climate Orbiter
  (the lbf-vs-N metering failure — cautionary).
- The three-layer stack + decorrelation: `2026-06-15-honest-capability-deferment-…` (dual-bloom,
  least-action oversight), the closed-frame-capture doc (welfare-capture, the Cheat-Engine confab).
