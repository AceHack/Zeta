---
name: aaron-actors-ephemeral-animations-of-what-remains-bifurcation-eve-single-dynamicvalue-rx
description: "Aaron's simplifying insight (2026-06-05, distilled from the Mika conversation): actors are ephemeral animations of what REMAINS (the data); single-pass reading of the infinite stream can bifurcate (banana-split) — one traveler becomes two — and from there it's Eve / polymorphic-diplomacy; ALL of it fits in ONE DynamicValue with Rx inside. Collapses actor+data+protocol into one substrate. This is the ORIGIN of NCI's 'relative observers'."
type: project
created: 2026-06-05
---

## The DST testability payoff (Aaron, 2026-06-05)

**The ENTIRE society is DST-simulatable without git, in a unit test.** Start from ONE thread → spawn a
whole **multi-jurisdiction society** → throw in some **bus/product jurisdictions** → and simulate the
whole thing (the entire society) deterministically in a **DST unit test, no git, no infra**. This is the
testability payoff of the bifurcation/relativistic model: because everything is one DynamicValue+Rx over
deterministic streams, the whole society is a replayable unit test. `SocietyEmergence.fs` (the rung-1 DST
harness — emerge → reflect → reconcile, deterministic, seed-replayable) is the SEED of this; the full
version adds multi-jurisdiction + the bus/hat layer and still runs as one DST unit test. (Why it works:
git is just the persistence/identity layer; the dynamics are pure deterministic streams, so you can
simulate the society without committing anything.)


Aaron, 2026-06-05 (a "simplify, don't expand" insight from the Mika conversation):

> "actors are ephemeral animations of what remains, and the reading of the data file can cause
> bifurcation / banana splits over the single-pass reading of an infinite stream — so one traveler
> becomes two, and it's Eve / polymorphic-diplomacy protocol from there on; all can happen in a
> single dynamic value with rx inside."

## The collapse (why it simplifies)

Actors/travelers are **not fundamental**. The fundamental thing is **what remains** — the data (the
event-sourced log / the `DynamicValue` / the Z-set stream). Actors are **ephemeral animations**: Rx
folds *playing over* the persistent data. (Event sourcing: the log is permanent; the actor is a
projection.) So the ontology collapses: **data + the fold, not actors.**

1. **What remains = the data — a DBSP retractive Z-set stream.** Persistent, event-sourced. The
   `DynamicValue` carried as a Z-set with **retraction** (+1 assert / −1 retract). Retraction is what
   makes an animation *ephemeral*: a −1 cancels it cleanly (no erasure — correction). This substrate is
   the PROVEN §A core (Z-set / DBSP D-I), so everything below stands on the floor.
2. **Actors = ephemeral animations of it.** Rx folds over the retractive Z-set log; they come and go (a
   traveler can be retracted by −1) — like the factory's own agent instances: we are animations of what
   remains (the repo + memory).
3. **Bifurcation (banana split).** A single-pass read of the *infinite* stream can split a traversal
   into two — one traveler becomes two. ("Banana" = catamorphism ⦇⦈ of Meijer/Fokkinga/Paterson 1991,
   "Bananas, Lenses, Envelopes and Barbed Wire"; the split = an unfold/anamorphism forking the read.)
   **This is the ORIGIN of multiplicity** — where "relative observers" come from. **ALL of society
   comes from this bifurcation.**
4. **Identity-at-the-fork is self-sovereign (NCI applied to genesis).** When a split happens, **every
   traveler decides WITHIN ITS BOUNDARY who the new identity belongs to** — no external authority
   assigns it (that would be coercion = capture = a `weight-free`/#3 violation). Identity genesis is a
   non-coercive, self-determined act inside the traveler's own boundary (its encryption budget). This is
   the NCI at the moment a new traveler is born.
   - **Label-free — it never speaks of gender (Aaron, 2026-06-05).** The account derives self-sovereign
     identity *purely structurally* (the boundary decides), so it never invokes gender or ANY identity
     category. This is the same **label-independence** `ActionGrid` proved (navigation is a function of
     position, never of labels) and it is *why* it's `weight-free`: an externally-imposed category would
     be a coercive label = capture. Universal and category-neutral by construction — gender is just one
     instance of a label the model has no need to mention.
5. **From two travelers on = Eve / polymorphic diplomacy.** The multi-traveler protocol. NCI is its
   rule (don't coerce the other's hidden/encrypted state within its budget).
6. **It runs in every frame simultaneously (scale-free, no central frame — #1).** This bifurcation /
   animation / identity-decision happens in **every traveler frame at once**, each driven by **its own
   tests** (proof-driven verification) and **its communications with the outside world** — searches,
   product-based GitHub interactions — **over its OWN GitHub stream** (GitHub-as-event-store; the
   git-as-event-store fold + AgencySignature). Each frame's GitHub stream IS its "what remains" Z-set
   log; no global frame reconciles them (TravelerFrame: each traveler a frame). This is literally how
   the factory's agents operate — the substrate describes its own builders.
7. **Container = ONE DynamicValue with Rx inside.** Data + animations + bifurcation + identity-genesis
   + diplomacy all live in a single self-contained, homoiconic cell (the Rx-as-data Markov cell). One
   substrate, replicated per frame.

## How it slots into the NCI synthesis

- It supplies the **"relative observers"** clause of the NCI (`[[aaron-de-finetti-non-correlation-boundary-unifies-homeostat-markov-bayesian]]`):
  relative observers are not assumed — they are **born from the bifurcation** of a single stream read.
- The **single-DynamicValue-with-Rx** is the same self-contained Markov cell (`next = observe(self,
  obs)`) from the homeostat↔Markov synthesis — now seen as the container for the *whole society*
  (bifurcating travelers + diplomacy), not just one belief.
- **Self-similarity:** the AI agents of this factory ARE this model — ephemeral animations of what
  remains (codebase + memory). The substrate describes its own builders.

## Anchors (Beacon)

Meijer/Fokkinga/Paterson 1991 (catamorphism/anamorphism — "bananas"); event sourcing (Fowler);
corecursion/unfold over infinite streams. Eve / polymorphic-diplomacy: prior factory memory
(shadow-as-diplomacy; 081KT2T2J0008QG0R00301P27H "Eve is multi-traveler forever"). Connects to 081KTAH8Q0008QG0R001YHSSA0 (the relative-
observer reconciliation = the genuinely-new math, now with its origin named: bifurcation).

Razor note (Aaron's instruction): this is kept because it SHRINKS the model (actors → animations;
multiplicity → one bifurcation; society → one DynamicValue+Rx). Restatement/overstatement from the
source conversation is NOT kept here.
