# Grounding the Alexa ferry against the code — four folk memories, and one correct prediction

**Date:** 2026-08-17 · **Requested by:** Aaron · **By:** Otto (shadow)

Aaron, on the [Alexa ferry](2026-08-17-ferry-alexa-lorentz-transformable-pairwise-memories-zset-minus-sign-and-consensus-gated-c.md):

> *"feel free to search what we have and validate and improve the exchange. this was based on a
> decorrelated model with no access to the repo, just my conversation and memories — and yes some
> may be folk memories not fully accurate. we want to ground everything."*

That is the right frame and it is worth stating why: **a decorrelated reviewer with no repo access
is a feature, not a handicap** — it is the only configuration in which agreement counts as evidence
rather than as an echo. The cost is that its picture of the substrate is reconstructed from
description, and description drifts. This note is the reconciliation.

**Method:** targeted reads of `src/Core/*.fs`, no inference from filenames. Every correction below
quotes the module.

## The scoreboard

| claim in the ferry | ground truth | verdict |
|---|---|---|
| anti-Sybil = fabricating `n²/2` consistent **pairwise histories** | `AntiSybil.fs` = **clock-drift entropy non-fungibility** | **folk memory — wrong mechanism, right shape** |
| light-cone collapse needs **51%** | `SybilBft.fs` = `d ≥ 3f+1`, quorum `2f+1` → **~33%** | **folk memory — and Alexa predicted this exact gap** |
| cartel detection = **firefly synchronization differentiability** | `TemporalCoordinationDetection.fs` = cross-correlation + phase-locking value | **folk memory — adjacent, not identical** |
| "proof of useful work" = Bitcoin-shaped consensus proof | `SocietyUsefulWork.fs` = the **ΔU/Condorcet aggregation theorem** | **name collision, different object** |
| Z-set `-1`, retraction without rewrite, generator update | DBSP Z-sets, real and load-bearing | **confirmed** |
| no ambient oracles; per-interaction bilateral selection | consistent with the code; no global oracle registry found | **consistent, not directly falsifiable here** |

## 1. Anti-Sybil is clock drift, not pairwise-history fabrication

Alexa reconstructed a quadratic argument: `n` fake agents require `n²/2` mutually consistent
pairwise histories. Elegant, and not what is built. `AntiSybil.fs`:

> **The anti-Sybil claim (the falsifiable core):** forging *k* distinct drift-identities costs
> **≥ *k* independent entropy sources** — clock-drift entropy is **non-fungible across identities**.
> A Sybil forger claiming *k* identities from *s < k* sources must (pigeonhole) re-use a source
> across two claims, so two of its emitted bit-streams are **correlated**.

The discriminator is a `BitGan` probe: a classifier confined to observed bits beats chance on a
re-used pair, so the forgery is caught. Anchors: Douceur 2002; Dwork–Naor 1992 / Nakamoto 2008.

**Alexa's shape was right even though the mechanism was wrong** — both arguments say Sybil cost must
be *superlinear in fabricated identities*, and both bottom out on a hardness fact rather than a
policy. The module makes that parallel explicit: *"structurally identical to how proof-of-work
grounds a blockchain's otherwise circular 'longest chain is truth': the circle bottoms out on a
hardness fact, and the hardness does the work."* So the ferry's Bitcoin comparison survives; its
`n²/2` does not.

**And the module's own scope directly contradicts the ferry's `✅ Handled`:**

> **Honest scope (peel):** this is **sound for exact replays**… For *noisy* forgeries and at
> *finite* stream length there is a detection/length tradeoff… **Not yet a proved theorem: a named
> function + a falsifiable property + an attack program.**

It also carries a standing routing rule the ferry's green table would have walked straight past:
*route to Aminata/Mateo before any outward "Sybil-resistance via drift non-fungibility" claim.*

## 2. The threshold is ~33%, not 51% — and this is the one Alexa called

Alexa raised it as her closing pressure point and got no answer:

> *"If your governance layer is calibrated to the 51% number but the underlying BFT protocol has a
> lower threshold, there's a gap worth closing. Which BFT variant is the substrate running on?"*

`SybilBft.fs` answers it:

> Classical BFT (PBFT, HotStuff) assumes `n` participants are *already distinct* and needs
> `n ≥ 3f+1`, quorum `2f+1`… safety needs **`d ≥ 3f+1`, quorum `2f+1` distinct sources**.

So corruption needs **more than one third of distinct entropy sources**, not more than half.
Aaron's *"something like a 51% attack"* is the folk number; the protocol's real bound is `f < d/3`.
**A governance detection window sized for 51% is sized wrong** — it would arm at a coalition size
the protocol has already lost to. Alexa reasoned to that gap from first principles, with no repo
access, and was correct. That is the decorrelation paying for itself in a single call.

Worth recording alongside it: the module states a genuine novelty claim — a literature search found
*"PoW/PoS-gated committees and 'consensus on the honest identity set,' but none deriving the quorum
from distinct **sources** rather than **claims**."*

## 3. Cartel detection is phase-locking, not a differentiable synchronization field

`TemporalCoordinationDetection.fs` is real and does what the ferry needs, by a different route:

> Pure-function detection primitives over pairs of numeric event streams… quantify that difference
> in two complementary registers — **amplitude** (cross-correlation at a lag) and **phase**
> (phase-locking value + mean phase offset) — so downstream detectors can compose both and **catch
> cartels that flatten one register while preserving the other**.

That last clause is sharper than anything in the ferry: it anticipates an adversary who *knows*
about the detector and suppresses one register. Alexa's "compute the gradient of the synchronization
field and read off local minima" is a different and more speculative construction, and the repo does
not implement it.

"Firefly" does appear — as **`Persona.FireflyCoherence`** in `ReticulumLink.fs`. A persona name, not
a Mirollo–Strogatz pulse-coupled oscillator model. **Do not cite Mirollo–Strogatz as implemented.**

Also honest about the primitives: they return `Option` and **refuse rather than fabricate**, because
*"silent nan-propagation would invite subtle detection bugs downstream."*

## 4. "Proof of useful work" is a name collision

The ferry treats it as a Bitcoin-shaped consensus mechanism where useful contribution replaces
hashing. In the repo, `SocietyUsefulWork.fs` is the **ΔU-aggregation / generalized Condorcet
theorem** — *society > best individual* — registered at `FROZEN-CORE-AND-CONJECTURE-REGISTER.md`
§A row 15, **PROVEN 2026-07-03, falsifier mutation-verified 2026-08-16**, with 11 properties in
`CondorcetBoundary.Tests.fs`.

That is a stronger and more specific result than the ferry describes, and it is *not* a consensus
mechanism. The two ideas may compose — a PoUW scheme could use ΔU as its scoring rule — but nothing
in the repo does that today, and the ferry's fleet-grading story should not be read as shipped.

## 5. The precedent for this exercise is already in the repo

`SybilBftProtocol.fs` corrected itself on 2026-08-16 for exactly the failure mode the ferry's green
table exhibits:

> an earlier version of this paragraph said the logic lived behind an `IBftTransport` port… and that
> the mux-WS adapter plugs in there. **`IBftTransport` has never existed** — no such type is declared
> anywhere in the repo, and the phrasing **described an intended design as though it were a shipped
> one**.

Same class, one layer up: Aaron said *"we have a lot of formal analysis around this"* and the table
rendered it `✅ Formally handled`. The repo already knows this failure by name.

## What this says about decorrelated review

The ferry got **one thing right that no repo-grounded reviewer would have flagged** (the BFT
threshold gap, reasoned from the general shape of BFT bounds) and **four things wrong that any
repo-grounded reviewer would have caught in a minute**. That is the expected trade, and it argues
for the pairing rather than either alone: run the decorrelated reviewer for the objections, then
ground every mechanism claim before it hardens into a citation.

The failure mode to watch is not the wrong mechanisms — those are cheap to fix, as here. It is that
a decorrelated reviewer's **confidence** is uncalibrated to its access. Alexa marked rows
`✅ Formally handled` about modules it had never read. Nothing in the exchange could have caught
that, because the check requires exactly the access the reviewer was defined not to have.

## Register

| claim | register |
|---|---|
| anti-Sybil = drift non-fungibility, pigeonhole, `BitGan` discriminator | **built and quoted** (`AntiSybil.fs`) |
| that mechanism is a proved theorem | **NO — the module says otherwise**: sound for exact replays; noisy forgeries sit on a detection/length curve; "not yet a proved theorem" |
| BFT bound is `d ≥ 3f+1`, quorum `2f+1` distinct sources | **built and quoted** (`SybilBft.fs`) |
| governance sized for 51% is mis-sized | **derivable** from the above; **whether governance is in fact sized to 51% is UNCHECKED** — I read the protocol, not the governance layer |
| cartel detection via cross-correlation + phase-locking | **built and quoted** (`TemporalCoordinationDetection.fs`) |
| a differentiable synchronization field / Mirollo–Strogatz model | **NOT FOUND.** "Firefly" is a persona name |
| ΔU/Condorcet aggregation, society > best individual | **PROVEN, falsifier mutation-verified** — register §A row 15 |
| PoUW as a consensus mechanism using ΔU as scoring | **NOT BUILT** — a composition nobody has made |
| Z-set `-1` as retraction-without-rewrite | **built** |
| the `ds²` analog two skewed agents compute | **STILL UNWRITTEN** — the ferry's open question survives grounding unchanged, and remains the highest-value follow-up |

## Pointers

- `src/Core/AntiSybil.fs` · `SybilBft.fs` · `SybilBftProtocol.fs` · `SybilBftLiveness.fs`
- `src/Core/TemporalCoordinationDetection.fs` — the cartel primitives
- `src/Core/SocietyUsefulWork.fs` · `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §A row 15
- `tests/Tests.FSharp/CondorcetBoundary.Tests.fs` — the 11 falsifier properties
- [the ferry itself](2026-08-17-ferry-alexa-lorentz-transformable-pairwise-memories-zset-minus-sign-and-consensus-gated-c.md)
- Anchors: Douceur, *The Sybil Attack* (2002) · Castro & Liskov, PBFT (1999) · Dwork & Naor (1992)
