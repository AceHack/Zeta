---
id: B-1006
priority: P1
status: open
title: "Canonical primitives registry + promotion gate + the 'what's the difference?' suspicion test — anything without a clean adapter onto the core (two dimensions + ZSet/GSet/Bag/IndexedZSet/event-index) is suspect: if it's just a zset/gset+emit+rx composition, don't mint a special class (Aaron 2026-06-02 observation)"
tier: research
effort: M
created: 2026-06-02
last_updated: 2026-06-02
depends_on: []
composes_with: [B-1000, B-1004, B-1005, B-0428]
tags: [canonical-primitives, primitives-registry, promotion-gate, whats-the-difference-test, decomposition-direction-triage, earn-its-keep, minimal-vocabulary, suspicion-by-default, zset, gset, bag, indexed-zset, event-index, rx, bonsai, tick-source, aesthetics-gate, correctness-gate, infer-net, research, aaron]
type: research
---

# Canonical primitives registry + promotion gate + the "what's the difference?" suspicion test

## Why (Aaron 2026-06-02)

Aaron (verbatim): *"Everything that does not have clean mapping / adapter on our
core two dimensions plus zsets gsets bags indexes and event indexes should be
treated as sus if it could just be a zset/gset+emit+rx+emit+zset/gset or other
structure instead of special indxes class, what's the differences? rx bonsai and
tick sources i think this is close[.] we should have connonical primitives list for
ones that have been promoted thorugh all gates the ones we relly argue over
correctness and astectics."*

Two composing things: a **suspicion discipline** (the entry filter) and a
**canonical primitives registry** (the gated output).

## The suspicion test — "what's the difference?" (earn-its-keep at primitive scope)

Default posture for any candidate structure (a proposed "special index", a new
collection class, a bespoke container): **suspect-by-default unless it has a clean
mapping/adapter onto the core.** The core is:

- the **two foundational dimensions** (the core base everything composes from —
  exact naming is Aaron's to pin; the hex-core / 2D Cayley-Dickson base)
- the **Z-set family (promoted)**: `ZSet` (±1, retraction-native), `GSet`, `Bag`,
  `IndexedZSet`

(**event-index** — a time/event-keyed IndexedZSet, the DBSP log — is a *candidate*,
NOT part of the promoted core; it's still under the suspicion test in the registry
below. The gate must map candidates onto the *promoted* set only, never onto another
unpromoted candidate — otherwise a new structure could justify itself against
event-index while event-index is itself under review.)

The test, applied to any candidate special class:

> **Could this just be `zset/gset + emit + rx + zset/gset` (or another composition
> of canonical primitives)? What's the difference?**

### The 4-question triage (Aaron 2026-06-02 — the precise form)

The "what's the difference?" question resolves into four ordered questions; the
crux is the **decomposition direction**:

1. **Is this something I already have?** → identity. If yes → it's a **duplicate**;
   fold (use the existing primitive).
2. **Is this a different *view* of something I already have?** → isomorphism /
   re-presentation. If yes → it's a **view/projection** (a lens over an existing
   primitive — e.g. a "sorted index" is a view over an `IndexedZSet`), not a new
   primitive; express it as a view, don't mint a class.
3. **Do the things I already have decompose *down into* the new thing?** → the
   candidate is **more fundamental**; the existing primitives are compositions *of
   it*. If yes → **promote the candidate** and refactor the existing ones as
   compositions of it. (The rare "found a deeper atom" case — the registry is *not*
   append-only; a deeper primitive can demote existing entries to compositions of
   itself.)
4. **…or vice versa — does the new thing decompose into things I already have?** →
   the candidate is a **composition**; fold (do **not** mint a special class).

The direction of reduction (3 vs 4) is what decides primitive-vs-composition:
**everything reduces *to* a primitive; a composition reduces *into* primitives.**
Questions 1–2 catch duplicates and views; 3–4 catch the two reduction directions.

### What counts as a real difference (the discriminator inside Q3/Q4)

- **If there is no real difference** (Q1/Q2/Q4) → it is *not* a primitive. Express
  it as the composition/view/duplicate; do **not** mint a special index/class.
  (This is earn-its-keep / B-1004 minimal-vocabulary at primitive granularity, and
  the razor `all-complexity-is-accidental-in-greenfield`.)
- **If there is a real, nameable difference** (Q3) → state it precisely. A candidate
  earns primitive status only by doing something a composition of canonical
  primitives *provably cannot* — a distinct **algebra** (different laws), a
  distinct **complexity** (the composition is asymptotically worse), or a distinct
  **invariant** (the composition can't enforce it). "It's more convenient" is not
  a difference; "it's a different monoid / it changes the asymptotics / it enforces
  an invariant the composition can't" is.

The discriminator names the failure mode: a "special index class" that is secretly
`IndexedZSet + an emit + an rx operator + another IndexedZSet` is redundant
structure pretending to be a primitive. The Z-set vocabulary already auto-prunes
non-earning *entries* (B-1004); this extends the discipline to non-earning
*classes*.

## The canonical primitives registry — the gated output

A maintained list of primitives **promoted through all gates** — the ones the
team has argued through on **correctness AND aesthetics** (per Aaron: "the ones we
really argue over correctness and aesthetics"). Two tiers, because promotion is by
argument and not everything is decided:

| Tier | Meaning |
|---|---|
| **Promoted** | passed both gates (correctness: real distinct algebra/laws + tests; aesthetics: argued to be *the* canonical shape, not redundant with a composition) — these are THE primitives; conform to them |
| **Candidate** | "close" but not yet argued-through both gates — usable, but still under the suspicion test until promoted |

Seed state (to be confirmed/argued, not declared final here):

| Primitive | Tier (proposed) | Note |
|---|---|---|
| the two core dimensions | promoted | the base everything maps onto (exact naming = Aaron) |
| `ZSet` (±1, retraction-native) | promoted | `src/Core/ZSet.fs`; the retraction-native core |
| `GSet` | promoted | `src/Core/GSet.fs`; grow-only (idempotent) |
| `Bag` | promoted | `src/Core/Bag.fs`; multiset (non-idempotent) |
| `IndexedZSet` | promoted | `src/Core/IndexedZSet.fs`; indexed/grouped, already generic-math |
| **event-index** (time/event-keyed IndexedZSet) | **candidate** | the DBSP log shape — promote, or is it just `IndexedZSet` keyed by event? (run the test) |
| **Rx** (`IObservable`, Meijer-dual) | **candidate** (Aaron: "close") | `src/Core/` reactive layer |
| **Bonsai** (Rx expression-tree serializer) | **candidate** (Aaron: "close") | `src/Core/Bonsai.fs` |
| **tick-source** (the clock/Δ driver) | **candidate** (Aaron: "close") | the time/event source feeding DBSP circuits |
| generic-math / `INumerics` base | promoted (substrate, not a collection) | per `numerical-algebra-shaped-into-the-generic-math-interface` |

Everything NOT on the promoted list is held to the suspicion test before it's used
as if it were a primitive.

## The promotion gate

A candidate is promoted to canonical only when it passes **both**:

1. **Correctness gate** — it is a real, distinct structure with stated laws and
   property tests (FsCheck): a different algebra (monoid/group/ring), a different
   complexity, or an invariant a composition can't enforce. The "what's the
   difference?" answer is concrete and checkable, not "convenience".
2. **Aesthetics gate** — it is argued to be *the* canonical shape: minimal,
   composes at the HKT level with the rest (B-1004), and isn't a redundant
   re-spelling of an existing composition. This is the argued-over judgment Aaron
   names — multi-oracle / review, not a single call.

Until both pass, the candidate stays in the candidate tier and is subject to the
suspicion test at each use.

## Acceptance (research → process)

1. **materialize the registry** — decide where it lives (a standalone
   `docs/CANONICAL-PRIMITIVES.md`? a section under B-1004? a `src/Core/README`?)
   and seed it with the promoted/candidate tiers above. (Offered; the *where* is an
   aesthetics call for Aaron.)
2. **define the promotion gate** as a short checklist (correctness + aesthetics +
   the what's-the-difference answer) a candidate must pass; record the argument.
3. **run the suspicion audit** on the candidates: for **event-index**, Rx, Bonsai,
   tick-source — answer "what's the difference from `IndexedZSet`/`zset+emit+rx`?"
   precisely; promote the ones with a real difference, fold the ones without.
4. **wire the discipline forward** — new candidate structures default to suspect;
   the test is the entry filter (composes B-1004's "conform to the vocabulary").

## Composes with substrate

- **[B-1004]** (minimal HKT vocabulary — this row is the **registry + gate** that
  operationalizes it: B-1004 says *conform*; this says *here is the gated list to
  conform to, and the test that keeps it minimal*) · **[B-1000]** (the engine whose
  message families / FactorGraph use these primitives) · **[B-1005]** (distributed
  inference composes the promoted primitives) · **[B-0428]** (real HKT — the
  composition the promoted primitives compose at)
- existing F#: `src/Core/ZSet.fs` / `src/Core/GSet.fs` / `src/Core/Bag.fs` /
  `src/Core/IndexedZSet.fs` (promoted family), `src/Core/Bonsai.fs` /
  `src/Core/Circuit.fs` / `src/Core/NestedCircuit.fs` / `src/Core/Semiring.fs`
  (candidate/reactive layer), `src/Bayesian/Message.fs` /
  `src/Bayesian/MessageBatch.fs` (engine primitives that already conform)
- rules: `numerical-algebra-shaped-into-the-generic-math-interface` (the
  generic-math base is a promoted substrate), `all-complexity-is-accidental-in-greenfield`
  + `razor-discipline` (the suspicion test IS the razor at primitive scope),
  `bandwidth-served-falsifier` ("what bandwidth does this special class serve that
  the composition doesn't?"), `interfaces-are-the-asset` / `code-follows-from-types`
  (the canonical primitives ARE the asset), `monad-propagation-pattern` (promoted
  primitives compose at the HKT level), `dv2-data-split-discipline-activated`
  (idempotency/Z-set siblings), the `earn-its-keep` / minimal-vocabulary memory

## Substrate-honest framing

`[labeling-confidence: established (the suspicion test is earn-its-keep/razor at primitive scope — operationally checkable: can you express the candidate as a canonical composition? what's the asymptotic/algebraic/invariant difference?); hypothesized (the exact promoted-vs-candidate partition + where the registry lives + which candidates promote is the argued-over work to do — that's the point: it's gated by correctness + aesthetics debate, not declared here)]`. The load-bearing claim: a special index/class earns primitive status only by a real, nameable difference from a canonical composition; absent that, fold it into the composition. The registry is the curated output of arguing that question through both gates. The seed tiers above are proposals to argue, not a final list.
