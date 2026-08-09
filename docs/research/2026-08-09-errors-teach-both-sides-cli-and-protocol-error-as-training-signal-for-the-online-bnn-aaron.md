# Errors teach both sides — the error message as a training signal for the online BNN

**Source:** Aaron (streamed, 2026-08-09), ferried by Otto (shadow*).
**Status:** design direction. The CLI half has a shipped worked example; the protocol
half and the online-BNN coupling are the build target (Lumen).

---

## The carved statement

> *"i'm going for that for all the CLIs and transport protocols we are building —
> the errors are costly so they should teach every time, so the other side can
> learn and become better. i'm building an online learning BNN … it will fit right
> in with this vibe, either turn-based CLI or multiplexed bidirectional
> communications."*

The extension that matters: **the "user" who learns from an error need not be
human.** Once the receiver is an agent — and especially an *online-learning* agent —
an error message stops being a status report and becomes a **training example**. A
teaching error is a labeled negative delivered with the direction of the correction
attached.

That reframes error design as an information-theoretic question, not a UX one.

## Why "errors are costly" is the load-bearing clause

An error has already cost both sides: the sender wasted work, the receiver wasted a
round trip, and (in the fleet) a reviewer may waste a cycle deciding whether it is
real. That cost is sunk. The only question left is **whether anything is bought with
it.**

- A bare failure (`exit 2`, `400 Bad Request`, `NACK`) buys ~nothing. The receiver
  learns that *something* is wrong, which it already suspected, and must guess the
  dimension. Guessing is retry — the same cost, paid again.
- A teaching failure buys a **posterior update**: the receiver now knows *which*
  dimension it was wrong on, and can be right next time without another round trip.

So the value of an error message is exactly the **uncertainty it removes from the
peer** — Shannon's definition, applied to the failure path. This is the same ledger
as [`every-bug-has-economic-value`](../../.claude/rules/every-bug-has-economic-value.md):
a bug is reducible uncertainty and a fix banks ΔU. An error message is the *cheapest
possible* ΔU transfer — it costs one string and can save an unbounded number of
retries.

## The information content is the distinction the receiver could not make

The practical test, from the shipped worked example (PR #10203):

`tsc` cannot distinguish **"this module is not declared"** (a real error) from
**"this module is declared but was never installed here"** (an unprovisioned
checkout). Both emit `TS2307`. That missing bit is *precisely* the information
content of the error — and its absence convinced **two independent reviewers** that
CI was red when it was green.

> **The teaching content of an error is the distinction the receiver was unable to
> draw for itself.** Not the restatement of what it already observed.

That generalizes cleanly to protocols: do not send `400`; send *which field, which
constraint, what was received, and what would be accepted*. The receiver already
knows it failed. It does not know **why it could not have known**.

## The four-part shape (from the CLI half, already shipped)

1. **WHAT** is wrong — the specific token/field/marker, never a category.
2. **WHY** — including the distinction the receiver couldn't make.
3. **HOW to fix** — a runnable command / a valid alternative, not a description.
4. **WHAT WON'T reproduce it** — when the failure is context-specific. The most
   expensive failures are the ones that *look like findings but aren't*.

## Both transports, one discipline

Aaron names two modes; the discipline is identical, the mechanics differ:

**Turn-based CLI** — the error is the response of a request/response turn. Learning
is episodic and naturally correlated (this error belongs to that command). Dual
register applies: human-legible prose (Beacon) plus a machine-parseable payload
(Mirror) so an agent peer does not have to regex prose.

**Multiplexed bidirectional** — errors arrive out-of-band, interleaved with other
streams. Three extra requirements, all already carved elsewhere in the substrate:

- **Correlation, not ordering.** An error must carry the id of the message that
  caused it. It cannot rely on arrival order — see
  [`local-time-never-enters-the-shared-fold`](../../.claude/rules/local-time-never-enters-the-shared-fold.md).
  Reordering must be free.
- **Idempotent under redelivery.** The same error delivered twice must produce one
  learning update, not two — otherwise a flaky link silently doubles the gradient
  (discipline #6).
- **A declared, metered channel.** Teaching flows through the error channel, never
  ambiently — §13 noninterference (Goguen–Meseguer). If an error updates the peer's
  model, that is *influence*, and influence must cross a declared boundary where it
  can be metered and, if necessary, refused.

## The coupling to the online-learning BNN (the build target)

If the receiver runs an online BNN (`MinimalBnn` + EP, Minka 2001 — "training and
inference are the same message pass"), then:

- Each error is **one observation absorbed** into the posterior. Rich errors carry
  more bits per observation, so the same number of round trips buys a sharper
  posterior. **Error richness is sample efficiency.**
- Because the update is EP over a factor graph, an error that names its *dimension*
  (which field, which constraint) updates the right factor rather than smearing
  probability over the whole model. A bare failure is an uninformative likelihood —
  it barely moves the posterior, which is exactly why bare failures feel like
  "retry and hope."
- **Watch the incentive.** A peer that learns from errors is a peer whose behaviour
  can be *steered* by errors. Two guards, both existing: the error channel is
  metered (§13), and error-derived updates should be attributable — a peer that
  teaches badly (or adversarially) is a calibration signal in its own right
  (`TravelerRankLedger` / the calibration ledger). **Do not let an unmetered error
  channel become an unaccounted training channel.**

## The thermodynamic half — why a rich error is *cheaper*, not merely nicer

Aaron, same session:

> *"We have a concept of heat from erasure and also missed communications that lead
> to errors, because that's when you hit the edges — it helps us with our reversible
> computing heat budgeting and entropy budgeting too."*
>
> *"We also have a four-corner feedback system for continual learning with pseudo-
> retrocausality by emitting a −1 in Z-sets … that updates the generator function."*
>
> *"We preserve uncertainty, and each traveler/agent decides who it trusts based on
> past performance."*

This answers the metering-unit question left open below, and upgrades the argument
from *ergonomics* to *physics*.

### Errors are where you hit the edge of the reversible envelope

A missed or rejected message forces the receiver into one of two moves:

- **Discard and redo.** The failed attempt's state is erased, and erasure has a hard
  floor — **Landauer (1961)**: ≥ `kT ln 2` per bit (≈ 2.8 × 10⁻²¹ J at 300 K). That
  floor is already modelled in-repo: `src/Core/ComputeReceipt.fs` carries `DeltaJ`
  (cost), `DeltaU` (net useful work — *"negative = heat"*) and `LandauerRatio`
  (efficiency against the theoretical minimum).
- **Retract and re-emit.** Emit a **−1** for the superseded belief. `+w` and `−w`
  annihilate in `consolidate`, but — per the honesty note already carved into
  `src/Core/WSet.fs` — *the past record is immutable; only its reading is corrected.*
  **Nothing is erased**, so no Landauer floor is paid for the correction itself.

So Aaron's two ideas are one idea:

> **A teaching error buys a retraction; a bare error buys an erasure.**

A bare `exit 2` gives the receiver nothing to retract *with*: it cannot identify
which belief was wrong, so it discards the whole attempt and redoes it. A teaching
error names the dimension, so the receiver emits one targeted `−1` and carries the
rest of its state forward. Same correction — one erased bit instead of thousands.
That is why "errors are costly" is literal rather than rhetorical: the cost has a
unit, and the unit is **heat**.

This is the bit-level discipline of
`docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md`
and `src/Core/ToffoliGate.fs` (*"no bit erasure: the retained wires carry the inverse
function"*), meeting the network.

### The loop: four corners → −1 → the generator

`src/Core/FourCorner.fs` is the bidirectional-feedback object this rides on — a 2×2
of (data × feedback) × (in × out), i.e. `N S E W = {1, i, −1, −i} = C₄`, with
`TInFeedback` **co-owned** (*"each is backpressure from the other's perspective —
frame-relative, no absolute backpressure"*). Both transports here are instances:
turn-based CLI is the degenerate case where corners alternate; multiplexed
bidirectional is the general case where all four are live at once.

```
teaching error → −1 retraction (no erasure) → generator update → future emissions
                                                                 corrected at the source
```

The last arrow is the one easy to miss: the retraction **updates the generator
function**, not merely the current answer. Because the generator IS the
error-correcting code
([`only-the-irreducible-is-primitive-generate-the-rest`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md)),
correcting it repairs every future emission at the root instead of patching outputs
one at a time. And because the specializer's own rules are `DynamicValue`
(`MixIr` / mix-as-data), the generator is a **value** — which is precisely what makes
it addressable by a Z-set delta. Mix-as-data is the enabling condition for
generator-level learning, not a separate curiosity.

"Pseudo-retrocausality" is the honest name, and `WSet.fs` already carries the caveat:
nothing is sent backwards. Later feedback updates the *interpretation*; the stored
history is re-run through it; the superseded emission is retracted. The past record
is immutable — only its reading, and therefore the downstream conclusion, is
corrected.

### Uncertainty is preserved, and trust is local

Two constraints on how an error may update a receiver:

- **Preserve uncertainty.** An error updates a posterior; it must not collapse one.
  `TravelerRankLedger` keeps `(μ, σ²)` and reports `trustBand = Φ(μ/√(σ²+β²))` — a
  distribution, not a point estimate. A failure that drove a peer to certainty would
  destroy exactly the information the next update needs.
- **Trust is decided by each traveler from past performance**, with no central
  authority (Multi-Oracle, §11). A fresh identity starts at the honest prior `0.5`,
  never a pessimistic `0.0`.

Together these settle the adversarial-teaching worry raised below: error-derived
updates are **trust-weighted per receiver**, so a peer that teaches badly or
maliciously moves your posterior less, and its own `trustBand` degrades on the
evidence. The defence is endogenous — no separate anti-abuse mechanism required.

## Open questions (genuinely open — not settled here)

1. **Schema.** One canonical machine-readable error envelope across every CLI and
   protocol, or per-surface schemas with a shared core? (A shared core is the DV2.0
   answer: stable hub, fast-changing satellite.)
2. **Does the sender learn too?** Aaron says "the other side can learn" — but a
   symmetric protocol means both ends update. If an error teaches the receiver that
   the sender is wrong, does the *sender* also learn from the fact that it emitted
   one? That is a feedback loop with a stability question attached.
3. ~~**Metering units.**~~ **ANSWERED above (Aaron, same session): the unit is HEAT.**
   `ComputeReceipt` already carries `DeltaJ` / `DeltaU` / `LandauerRatio` against the
   `kT ln 2` floor. What remains open is narrower: what exchange rate converts an
   avoided retry into avoided joules, so the budget is enforceable rather than
   merely observable?
4. **Adversarial teaching.** Largely settled by trust-weighting (above): a bad teacher
   moves your posterior less and loses `trustBand` on the evidence. What stays open is
   the *outbound* direction — an error maximally informative to an honest peer is also
   maximally informative to an attacker probing the interface, and the sender cannot
   condition on trust it has not yet earned about a stranger. Where does teaching stop
   for an unknown peer? (Dual-use again: the mechanism is neutral, the oracle decides.)

## Anchors (Beacon)

- **Shannon (1948)** — information as reduction in uncertainty. The value of an error
  is its information content, which is why a bare failure code is nearly worthless.
- **RFC 9413, *Maintaining Robust Protocols* (Thomson & Eggert, IAB 2023)** — the
  modern correction to Postel's robustness principle: silently tolerating malformed
  input degrades protocols over time, and active feedback (not leniency) is what
  keeps them healthy. This is the standards-track statement of "errors should teach."
- **Minka (2001), Expectation Propagation** — the update mechanism on the receiving
  side (`src/Bayesian/Ep.fs`, `MinimalBnn`).
- **Goguen & Meseguer (1982), noninterference** — why the error channel must be
  declared and metered rather than ambient.
- **Landauer (1961)**, *Irreversibility and heat generation in the computing process*
  — the `kT ln 2` floor that makes "errors are costly" a physical claim.
- **Bennett (1973)**, *Logical reversibility of computation* — why retraction rather
  than erasure is the cheap correction; the Toffoli/Z-set bridge already in-repo.

## Pointers

- `src/Core.TypeScript/lint/lint-typescript.ts` — the shipped CLI worked example
  (081KZKWB1FZ / PR #10203): declared-but-not-installed vs genuinely-undeclared.
- `src/Bayesian/MinimalBnn.fs`, `src/Bayesian/Ep.fs` — the online-learning receiver.
- [`every-bug-has-economic-value`](../../.claude/rules/every-bug-has-economic-value.md) — the ΔU ledger this rides on.
- [`dual-use-detection-is-neutral-oracle-decides`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md) — open question 4.
- `memory/feedback_errors_should_teach_the_user_when_they_fail_aaron_2026_08_09.md` — the origin note.
