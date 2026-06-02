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
tags: [canonical-primitives, primitives-registry, promotion-gate, whats-the-difference-test, decomposition-direction-triage, earn-its-keep, minimal-vocabulary, suspicion-by-default, zset, gset, bag, indexed-zset, event-index, rx, bonsai, tick-source, aesthetics-gate, correctness-gate, orthogonal-primitive-axes, codec-axis, codec-as-primitive, infer-net, research, aaron]
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
argument and not everything is decided.

**The registry is multi-axis, not a flat list (Aaron 2026-06-02):** *"codecs are
just a different orthogonal of primitive but they are still essential for
function."* Primitives live on **orthogonal axes**, and a candidate promotes onto
*an* axis (it isn't promoted-or-excluded against one flat list). The axes so far:

- **data axis** — the Z-set family (`ZSet`/`GSet`/`Bag`/`IndexedZSet`): the
  values/collections that flow.
- **time/control axis** — `tick-source` (the clock/Δ-driver): what the data is
  indexed *by*.
- **codec axis** — `codec<codec<t>>` (serializers; Bonsai): what makes a value on
  any axis *transmissible/persistable*. **Essential for function** — a value you
  can't serialize can't cross a boundary — so codecs are first-class primitives,
  just orthogonal to the collection axis.
- **base substrate** — generic-math / `INumerics` under all of them.

"Fold vs promote" is therefore "does it earn a place *on some axis*?" — Bonsai is
not "not a primitive"; it's a primitive on the *codec* axis. Rx/event-index still
fold (they're a view / a keyed-IndexedZSet on the data axis, not a new axis).

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
| **tick-source** (the clock/Δ driver) | **promote-recommended — candidate pending correctness-gate** (audit 2026-06-02) | the time/control axis the Z-set family is indexed *by* — `Op` in `src/Core/Circuit.fs` (`StepAsync`/`ClockStart`/`Fixedpoint`); not a collection, doesn't reduce to zset/gset (Q3-categorical). Aesthetics gate passed; **correctness gate (stated laws + tests for tick-source as a primitive) not yet written** — stays candidate until it is (Codex review) |
| generic-math / `INumerics` base | promoted (substrate, not a collection) | per `numerical-algebra-shaped-into-the-generic-math-interface` |
| **Bonsai** | **promoted — codec axis** (audit 2026-06-02) | `src/Core/Bonsai.fs` expression-tree serializer — a primitive on the **codec axis** (`codec<codec<t>>`), orthogonal to the data axis; essential for function (makes values transmissible). Not on the collection axis, but a real primitive on its own (Aaron: "codecs are just a different orthogonal of primitive but still essential") |
| ~~event-index~~ | **folded** (audit 2026-06-02) | = `IndexedZSet<tick, 'V>` (same sorted abelian group of per-key `ZSet` groups); a monotone-tick invariant is at most a constrained wrapper, not a new primitive (Q2/Q4) |
| ~~Rx (`IObservable`)~~ | **view + adapter** (audit 2026-06-02) | push-dual *view* of `Stream<ZSet>` (`src/Core/Rx.fs` `RxAdapter`: `Stream<ZSet>` ≅ `IObservable<ChangeSet>`); an interop adapter, not a core primitive (Q2) |

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

## Suspicion audit — first application (Aaron authorized 2026-06-02)

Acceptance #3 run on the four candidates, against the promoted core
(ZSet/GSet/Bag/IndexedZSet + generic-math base), grounded in the actual source.
On the **collection axis** the test folds two of four (nothing new there — the
discipline working: those "candidates" are existing primitives wearing a different
hat); the other two promote onto **different orthogonal axes** (codec, time) per
Aaron's "codecs are a different orthogonal of primitive, still essential". So:
**event-index** + **Rx** fold (collection axis); **Bonsai** → codec axis;
**tick-source** → time axis (candidate pending its correctness gate).

| Candidate | Triage | Verdict | Evidence |
|---|---|---|---|
| **event-index** | Q2 (view) / Q4 (composition) | **fold** → `IndexedZSet<tick, 'V>` | `src/Core/IndexedZSet.fs` is a sorted run of `KeyGroup<'K, 'V>` where each group's `Values` is a `ZSet<'V>` (there is no `KeyGroup<'K, ZSet<'V>>` instantiation) — an abelian group keyed by any comparable `'K`. An event/time-keyed log is just `'K = tick`. The only candidate-difference is a *monotone-tick / append-only invariant* on the key — not a new algebra, complexity, or structure; at most a **constrained wrapper/view** of `IndexedZSet`, not a primitive. |
| **Rx** (`IObservable`) | Q2 (view) + adapter | **view + interop adapter**, not a primitive | `src/Core/Rx.fs` is `RxAdapter`; its own doc: *"DBSP's `Stream<ZSet<'T>>` is morally equivalent to `IObservable<ChangeSet<'T>>`"* (Meijer push-dual of `IEnumerable`). Rx is the **push-dual presentation** of `tick-source + ZSet deltas` plus an adapter into System.Reactive. It earns its keep as **ecosystem interop**, not as a core primitive. |
| **Bonsai** | Q3 (categorical — a different orthogonal axis) | **promote → codec axis** | `src/Core/Bonsai.fs` is an *expression-tree serializer* (serialize/parse → `Result`, compact-JSON byte-diff cross-oracle contract). It's a **codec** — and codecs are *a different orthogonal axis of primitive, still essential for function* (Aaron 2026-06-02): a value you can't serialize can't cross a boundary. So Bonsai is a real primitive **on the codec axis** (`codec<codec<t>>`, the B-0976 serializer roster / B-1002 Eve transport), not on the collection axis. It enters the registry — just on its own axis. |
| **tick-source** | Q3 (categorical — a different kind) | **promote-recommended → time axis (candidate pending correctness-gate)** | `Op` in `src/Core/Circuit.fs` exposes `StepAsync` / `ClockStart` / `ClockEnd` / `Fixedpoint` — the circuit advances one **tick** at a time. The tick-source is not data; it is the **time/control axis the whole Z-set family is indexed *by***. Nothing in zset/gset *produces* ticks (they are the data flowing *between* ticks). It can't be reduced to a collection composition → a genuine primitive, distinct in **kind** (control/time, not data); the Circuit clock/step machinery is the implementation. Aesthetics/categorical gate passed; **stays candidate until the correctness gate (stated laws + tests for tick-source as a primitive) is written** (Codex review). |

**Result (corrected per Aaron 2026-06-02 + Codex review):** the two candidates with a
*categorical* difference promote onto **new orthogonal axes** — **Bonsai** onto the
**codec axis** (codecs are a different orthogonal kind of primitive, still essential:
a value you can't serialize can't cross a boundary), and **tick-source** onto the
**time/control axis** (promote-recommended, but staying *candidate* until its
correctness gate — stated laws + tests — is written, per Codex). The two with no
categorical difference fold: **event-index** = `IndexedZSet<tick,'V>`; **Rx** = the
push-dual *view* of `tick-source + ZSet deltas` + interop adapter. So the test still
keeps the *collection* axis minimal (nothing new there) while surfacing that the
registry is **multi-axis** — data / time / codec / generic-math base. The earlier
"Bonsai is not a primitive" framing was wrong: it's a primitive on a *different* axis,
not excluded.

(Audit caveat: verdicts are operationally grounded in the current source; the
correctness-gate evidence for tick-source as a primitive is still owed; if the exact
"two core dimensions" naming or a hard monotone-tick invariant changes the picture,
re-run the triage — that's the point of the gate.)

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
