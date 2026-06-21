---
id: 081KT2T2J0008QG0R0008TFHJT
priority: P1
status: open
title: "Canonical primitives registry + promotion gate + the 'what's the difference?' suspicion test — anything without a clean adapter onto the core (two dimensions + ZSet/GSet/Bag/IndexedZSet/event-index) is suspect: if it's just a zset/gset+emit+rx composition, don't mint a special class (Aaron 2026-06-02 observation)"
tier: research
effort: M
created: 2026-06-02
last_updated: 2026-06-02
depends_on: []
composes_with: [081KT2T2J0008QG0R000S7GHQ8, 081KT2T2J0008QG0R0038CRFJM, 081KT2T2J0008QG0R003BT1RS7, 081KRFA460008QG0R0018SN61J, 081KR2E4K0008QG0R002YE3MMD, 081KSGS9H0008QG0R0031PBNGA, 081KT07NV0008QG0R003BE6MJ2]
tags: [canonical-primitives, primitives-registry, promotion-gate, whats-the-difference-test, decomposition-direction-triage, earn-its-keep, minimal-vocabulary, suspicion-by-default, zset, gset, bag, indexed-zset, event-index, rx, bonsai, tick-source, aesthetics-gate, correctness-gate, orthogonal-primitive-axes, codec-axis, codec-as-primitive, registry-is-bcl, codec-algebra, algebra-first-admission-procedure, registry-is-ship-gate, temporal-operator-algebra, everything-is-algebra, tick-source-folds-to-algebra, register-algebra-adapterize-sources, four-bucket-taxonomy, cross-ai-triangulation, asymmetric-exceptions, ace-distribution, cross-language-byte-lock, quality-uniqueness-composability-gate, infer-net, research, aaron]
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
  (This is earn-its-keep / 081KT2T2J0008QG0R0038CRFJM minimal-vocabulary at primitive granularity, and
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
non-earning *entries* (081KT2T2J0008QG0R0038CRFJM); this extends the discipline to non-earning
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
- **time axis = the temporal-operator *algebra*** — `tick-source` / time: what the
  data is indexed *by*. Per the algebra-first run below, this **is an algebra** too:
  time-index = `(ℕ, +, 0)` monoid, and the temporal operators `z⁻¹` (unit-delay,
  linear) / `I` (integrate = Σz⁻ⁿ) / `D` (differentiate = 1−z⁻¹) are **linear
  operators over `Stream<ZSet>`** (a commutative operator algebra generated by
  `z⁻¹`; grounded in `src/Core/Advanced.fs` `z⁻¹`/`DelayZSet` + `src/Core/Crdt.fs`
  `D`/`I`). So time folds onto the algebra axis; the effectful Step-driver that
  *runs* it is the **DBSP Circuit runtime**, not a registry primitive.
- **codec axis = the codec *algebra*** — `codec<codec<t>>` (serializers; Bonsai):
  what makes a value on any axis *transmissible/persistable*. **Essential for
  function** (a value you can't serialize can't cross a boundary). Per the
  algebra-first procedure below, codecs **are an algebra** — a codec is an encode/
  decode pair with the round-trip law `decode ∘ encode = id`, i.e. an **invariant
  functor** closed under product (`Codec<a>×Codec<b> → Codec<a×b>`), sum (tagged
  `Codec<a+b>`), and identity (`Codec<unit>`); `codec<codec<t>>` *is* codec
  composition. So the codec axis is an **algebraic** axis, not a non-algebra special
  kind (prior art: scodec / Haskell `codec` / profunctor-optics).
- **base substrate** — generic-math / `INumerics` under all of them.

"Fold vs promote" is therefore "does it earn a place *on some axis*?" — Bonsai is
a primitive on the *codec-algebra* axis. Rx/event-index still fold (they're a
view / a keyed-IndexedZSet on the data axis, not a new axis).

| Tier | Meaning |
|---|---|
| **Promoted** | passed all three gates (**quality**: laws + tests; **uniqueness**: not a dup/view/composition; **composability**: HKT-composes) — these are THE BCL primitives; conform to them |
| **Candidate** | "close" but not yet through all three gates — usable, but still under the suspicion test until promoted |

Seed state (to be confirmed/argued, not declared final here):

| Primitive | Tier (proposed) | Note |
|---|---|---|
| the two core dimensions | promoted | the base everything maps onto (exact naming = Aaron) |
| `ZSet` (±1, retraction-native) | promoted | `src/Core/ZSet.fs`; the retraction-native core |
| `GSet` | promoted | `src/Core/GSet.fs`; grow-only (idempotent) |
| `Bag` | promoted | `src/Core/Bag.fs`; multiset (non-idempotent) |
| `IndexedZSet` | promoted | `src/Core/IndexedZSet.fs`; indexed/grouped, already generic-math |
| **tick-source / time** | **folds → algebra axis (temporal-operator algebra)** (procedure-run 2026-06-02) | the time axis IS algebra: `(ℕ,+,0)` time-monoid + `z⁻¹`/`I`/`D` linear operators over `Stream<ZSet>` (`src/Core/Advanced.fs` `z⁻¹`/`DelayZSet`, `src/Core/Crdt.fs` `D`/`I`). Revises the earlier "promote as categorical primitive" — algebra-first found it *is* algebra. The effectful Step-driver (`Op` in `src/Core/Circuit.fs`) is the **DBSP Circuit runtime** that *runs* the algebra, **not** a registry primitive. See "Algebra-first procedure run on tick-source" below |
| generic-math / `INumerics` base | promoted (substrate, not a collection) | per `numerical-algebra-shaped-into-the-generic-math-interface` |
| **Bonsai** | **promoted — codec axis** (audit 2026-06-02) | `src/Core/Bonsai.fs` expression-tree serializer — a primitive on the **codec axis** (`codec<codec<t>>`), orthogonal to the data axis; essential for function (makes values transmissible). Not on the collection axis, but a real primitive on its own (Aaron: "codecs are just a different orthogonal of primitive but still essential") |
| ~~event-index~~ | **folded** (audit 2026-06-02) | = `IndexedZSet<tick, 'V>` (same sorted abelian group of per-key `ZSet` groups); a monotone-tick invariant is at most a constrained wrapper, not a new primitive (Q2/Q4) |
| ~~Rx (`IObservable`)~~ | **view + adapter** (audit 2026-06-02) | push-dual *view* of `Stream<ZSet>` (`src/Core/Rx.fs` `RxAdapter`: `Stream<ZSet>` ≅ `IObservable<ChangeSet>`); an interop adapter, not a core primitive (Q2) |

Everything NOT on the promoted list is held to the suspicion test before it's used
as if it were a primitive.

## The admission procedure — algebra-first, ordered (Aaron 2026-06-02)

Before the three gates, run the **ordered admission procedure** on any candidate
(Aaron, codecs as the worked example: *"can codecs be algebra[?] if yes do it; if
not[,] does algebra completely cover its use case[?] yes[:] stop; no[:] see if any
of the other rules apply; if not[,] add it to registry."* — *"very similar for
everything we have."*):

1. **Can it be an algebra?** (generic-math / the existing algebraic vocabulary —
   monoid/group/ring, Z-set family, the codec algebra, …)
   → **YES → do that.** Express it as the algebra; it lives on an algebraic axis.
     (Codecs cleared this: a codec is an invariant functor with `decode∘encode=id`,
     closed under product/sum/identity → the **codec algebra**.)
2. **If not an algebra — does the existing algebra completely cover its use case
   anyway?** → **YES → stop** (don't add; the use case is already served — adding
   it would be a redundant non-earning entry).
3. **If algebra doesn't cover it — do any of the other rules / existing primitives
   apply?** → **YES → use those** (don't add). → **NO → add it to the registry**
   (a genuine new primitive; then it must clear the three gates below).

The procedure is **algebra-first by design**: it prefers *express-as-algebra* >
*already-covered* > *use-existing-rule* > *add-new*. Every step before the last is
a reason **not** to grow the registry — which is how the BCL stays minimal while
absorbing everything expressible.

## The promotion gate — exactly three barriers (Aaron 2026-06-02)

Aaron: *"only quality gates and uniqueness plus composability stops [a candidate]
from getting in[to the] registry."* The gate is **exactly these three** — nothing
else gatekeeps (no taste, no politics, no seniority). Pass all three → it's in,
on whatever axis it earns:

1. **Quality** — it is a real, distinct structure with **stated laws + tests**
   (FsCheck; for cross-language primitives, byte-lock golden vectors). The
   correctness evidence is concrete and checkable.
2. **Uniqueness** — it is **not a duplicate / view / composition** of an existing
   primitive (the 4-question triage / "what's the difference?"). It either holds a
   distinct algebra/complexity/invariant on an existing axis, or it *is* a new
   orthogonal axis.
3. **Composability** — it **composes at the HKT level** with the rest of the
   registry (081KT2T2J0008QG0R0038CRFJM); it isn't a dead-end class that the other primitives can't
   compose with.

(This replaces the earlier vaguer "correctness + aesthetics" framing — "aesthetics"
was doing the work of *uniqueness + composability*, made concrete here.)

Until all three pass, the candidate stays in the candidate tier and is subject to
the suspicion test at each use. **Codecs are not special** — they pass the *same*
three gates (Bonsai's quality = its cross-oracle byte-diff golden vectors; its
uniqueness = the codec axis; its composability = `codec<codec<t>>`).

## This registry IS our BCL — and shipping it guarantees cross-language (Aaron 2026-06-02)

Aaron: *"this is our BCL[.] the more we ship the more we can guarantee cross
language with ace distribution."*

The canonical primitives registry **is the Zeta Base Class Library** — the
foundational set every Zeta program (in any target language) builds on. Promotion
isn't bookkeeping; it's **adding a guaranteed building block to the BCL.**

The cross-language guarantee is *compounding*:

- Each promoted primitive ships with its **cross-language contract** — the same
  algebra/laws expressed per-language (per `numerical-algebra-into-generic-math` /
  `monad-propagation-pattern`) plus, where it crosses a wire, **byte-lock golden
  vectors** (the meet-in-the-middle oracle discipline: one oracle authors the
  vectors, the others replay byte-for-byte — "agreement IS the verification").
- So **the more primitives we ship, the larger the surface that is
  cross-language-guaranteed** — every new BCL atom is one more thing that provably
  behaves identically in F#/C#/TS/Rust/….
- **Ace distributes the BCL** (081KR2E4K0008QG0R002YE3MMD package-manager CLI / 081KSGS9H0008QG0R0031PBNGA
  package-manager-of-package-managers): the registry is what Ace ships, and the
  gate (quality + uniqueness + composability + byte-lock) is *why* what Ace ships
  is trustworthy across languages. The registry → BCL → Ace pipeline is the
  cross-language guarantee made distributable.

This is also *why* the registry must stay minimal and gated: every entry is a
contract Ace commits to maintaining across every target language. A non-earning or
non-composing entry would be a cross-language liability shipped to every consumer —
so the three gates are the thing that keeps the BCL both small and trustworthy.

### The shipping policy — the registry is the ship gate (Aaron 2026-06-02)

Aaron: *"we want all things to be in registry eventually or else what's it for[.]
we don't ship what's not in registry unless there is special asymmetric
exceptions."*

- **Goal: everything in the registry eventually.** The registry is not a curated
  highlights reel — it is meant to be the *complete* authoritative set of shippable
  building blocks. If a thing we rely on isn't in it, that's a gap to close (run
  the admission procedure on it), not a permanent outsider. "Or else what's it
  for" — a registry that doesn't aim at completeness isn't doing its job.
- **Ship gate: we don't ship what's not in the registry.** Registry-membership is
  the precondition for shipping (via Ace). To ship is to have passed the admission
  procedure + the three gates + carry the cross-language contract — which is exactly
  what makes the shipped thing trustworthy across languages. Un-registered code is
  not a BCL primitive and isn't shipped as one.
- **Exception: special asymmetric exceptions.** Explicit, named exceptions exist
  (the asymmetric cases — e.g. a host/platform-specific adapter that can't be
  cross-language-guaranteed, an interop shim, a temporary bootstrap). These ship
  *as flagged exceptions*, not as registry primitives, and the asymmetry is stated
  (what guarantee is waived + why). Composes with the human-audit / risk-acceptance
  attribution pattern — an exception is a named, documented waiver, not a silent
  bypass.

So the full lifecycle of any building block: **admission procedure (algebra-first)
→ three gates (quality + uniqueness + composability) → registry (BCL) → Ace
distribution**, with the only off-ramp being an explicit asymmetric exception.

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
| **Bonsai** | Q3 (categorical — a different orthogonal axis) | **promote → codec axis** | `src/Core/Bonsai.fs` is an *expression-tree serializer* (serialize/parse → `Result`, compact-JSON byte-diff cross-oracle contract). It's a **codec** — and codecs are *a different orthogonal axis of primitive, still essential for function* (Aaron 2026-06-02): a value you can't serialize can't cross a boundary. So Bonsai is a real primitive **on the codec axis** (`codec<codec<t>>`, the 081KT07NV0008QG0R003BE6MJ2 serializer roster / 081KT2T2J0008QG0R002R72323 Eve transport), not on the collection axis. It enters the registry — just on its own axis. |
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

## Algebra-first procedure run on tick-source (Aaron authorized 2026-06-02)

Running the **algebra-first admission procedure** (not the categorical-audit) on
tick-source — and it **supersedes** the audit's "promote as a categorical primitive"
verdict (retraction-native: the audit row above is kept; this is the sharper result).

- **Q1 — can it be an algebra? YES.** Time has two algebraic pieces:
  - **time-index** = `(ℕ, +, 0)` — the ticks form a commutative monoid (advance-by-n
    composes additively; the free monoid on one generator).
  - **temporal operators** = `z⁻¹` (unit-delay, *linear*), `I` (integrate = Σz⁻ⁿ),
    `D` (differentiate = 1−z⁻¹) — **linear operators over the `Stream<ZSet>` abelian
    group**, a commutative operator algebra generated by `z⁻¹`. Grounded in source:
    `src/Core/Advanced.fs` (`z⁻¹` / `DelayZSet`, annotated "Linear in the input")
    and `src/Core/Crdt.fs` (`D` differentiate / `I` integrate).
  → so **do it**: tick-source folds onto the **algebra axis** as the
  temporal-operator algebra over `Stream<ZSet>`, indexed by the `ℕ` time-monoid.
- **The residual** = the effectful **Step-driver** (`Op` in `src/Core/Circuit.fs` —
  the clock that actually advances `ℕ→ℕ+1` and recomputes each tick). Q2: the algebra
  covers the temporal *structure* (index + delay/integrate/differentiate) but not the
  *drive*. Q3: the driver is the **DBSP Circuit runtime** — it *executes* the algebra
  (as a fold-driver runs a fold), so it is **not a registry primitive**; it's the
  engine that runs registered primitives.

**Result:** tick-source is **not** a separate non-algebra primitive — it's the
temporal-operator **algebra** (algebra axis) + the runtime that drives it. The
algebra-first procedure did exactly its job: the "categorically different primitive"
turned out expressible as algebra, so it folds.

**The "everything is algebra" convergence:** with **codecs** (codec algebra) and
**time** (temporal-operator algebra) both folding to algebra, the registry collapses
toward **algebras on orthogonal axes (data Z-set algebras · codec algebra ·
temporal-operator algebra) + the generic-math base** — the deepest form of 081KT2T2J0008QG0R0038CRFJM's
"conform to the minimal vocabulary": *the vocabulary is algebras, all the way down.*
The only non-algebra things left are the **runtimes** (drivers/engines that *execute*
the algebra) and explicit **asymmetric exceptions** (host adapters) — neither of which
is a registry primitive.

### Register the Tick *algebra*; adapterize the sources (Amara) — tick-source is the *generator* (Prism)

Two ferries sharpened the verdict (cross-AI triangulation: Otto + Amara + Prism all
ran the procedure independently and converged on "tick-source folds to the time
algebra"):

- **Amara:** *"do not register sources when you can register the algebra they emit.
  Register Tick. Adapterize TickSource."* So the **atom that registers** is the
  **Tick algebra** — `Tick` / `Delta` / `zero(origin)` / `advance` / `order` /
  `monotonicity` / `join(max)` / `z⁻¹`. The **sources are adapters**, *not*
  primitives: `ManualTickSource`, `TimerTickSource`, `CircuitStepSource`,
  `WebSocketTickSource`, `GitEventTickSource` — wall-clock / scheduler / file-watch /
  TCP / WS / UI-loop / git-event all *emit* ticks; register the algebra once,
  adapterize the emitters.
- **Prism:** tick-source is the **generator** of the time algebra (the unit-tick
  generates the `(ℕ,+,0)` monoid; `z⁻¹` generates the operator ring) — which is
  exactly *why* a source adapts rather than registers: it's the generator of an
  algebra, and the **algebra** is what registers, not its generator-implementations.

### The closed four-bucket taxonomy (Amara's keeper)

Amara's keeper — *"the registry stores atoms and laws; sources, views, and
transports adapt into those laws"* — closes the sort. Everything audited lands in
exactly one bucket:

| Bucket | What | Examples |
|---|---|---|
| **registers** (the BCL) | atoms + laws = **algebras** | Z-set family · codec algebra · Tick algebra · generic-math base |
| **adapts** (not registered) | **sources · views · transports** | `TickSource*` (sources) · Rx + event-index=`IndexedZSet`-keyed-by-Tick (views) · the wire under the codec (transports) |
| **executes** (not registered) | **runtimes** | the DBSP Circuit step-loop |
| **waives** (flagged, not registered) | named **asymmetric exceptions** | host adapters that can't be cross-language-guaranteed |

Only the first bucket is the registry. The algebra-first procedure is the
**registry's immune system** (Amara) — it sorts every candidate into these four and
admits only the algebras.

## Acceptance (research → process)

1. **materialize the registry** — decide where it lives (a standalone
   `docs/CANONICAL-PRIMITIVES.md`? a section under 081KT2T2J0008QG0R0038CRFJM? a `src/Core/README`?)
   and seed it with the promoted/candidate tiers above. (Offered; the *where* is an
   aesthetics call for Aaron.)
2. **define the promotion gate** as a short checklist (correctness + aesthetics +
   the what's-the-difference answer) a candidate must pass; record the argument.
3. **run the suspicion audit** on the candidates: for **event-index**, Rx, Bonsai,
   tick-source — answer "what's the difference from `IndexedZSet`/`zset+emit+rx`?"
   precisely; promote the ones with a real difference, fold the ones without.
4. **wire the discipline forward** — new candidate structures default to suspect;
   the test is the entry filter (composes 081KT2T2J0008QG0R0038CRFJM's "conform to the vocabulary").

## Composes with substrate

- **[081KT2T2J0008QG0R0038CRFJM]** (minimal HKT vocabulary — this row is the **registry + gate** that
  operationalizes it: 081KT2T2J0008QG0R0038CRFJM says *conform*; this says *here is the gated list to
  conform to, and the test that keeps it minimal*) · **[081KT2T2J0008QG0R000S7GHQ8]** (the engine whose
  message families / FactorGraph use these primitives) · **[081KT2T2J0008QG0R003BT1RS7]** (distributed
  inference composes the promoted primitives) · **[081KRFA460008QG0R0018SN61J]** (real HKT — the
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
