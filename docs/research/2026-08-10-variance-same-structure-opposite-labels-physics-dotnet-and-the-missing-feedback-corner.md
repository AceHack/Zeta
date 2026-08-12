# Variance — same structure, opposite labels; and the corner Meijer's duality was missing

**Date:** 2026-08-10 · **From:** Aaron (*"connect this to Brian Beckman, co- and
contravariant physics when resolution changes, and `in`/`out` in .NET"* / *"this is what
I connected to my four-corner batched feedback — Erik Meijer almost got this but didn't
have the feedback channels"*), captured by Otto (shadow).

**Status:** §1–§4 are **structural** — a definitional identification, checkable against
any category-theory text or the C# spec. §5 is a **candidate anchor offered for
checking**, not a claim about a design I have read. Registers marked throughout per
`numerology-vs-number-theory` <!-- STALE-REF: ../../.claude/rules/numerology-vs-number-theory.md -->.

---

## 0. Why this is NOT the numerology failure — the useful inverse of it

Worth stating first, because the surface pattern looks similar to the hierarchy
word-match caught earlier today.

- **The hierarchy case:** one *word* ("hierarchy"), two unrelated structures (a ratio of
  energy scales; an authority partial order). A **label match with no shared structure** —
  reject the identification, keep the analogy that survives.
- **This case:** two *labelling conventions*, **one shared structure** (the action of a
  functor on morphisms under a change of the underlying object). Not a coincidence of
  counts; nothing numeric is being matched at all, so the rule's test — *what else has
  this number?* — does not even apply.

**A label match with no structure is numerology. A structure match with mismatched
labels is a translation problem.** They are opposites, and conflating them costs you
either a false identification or a real one you refuse to make.

## 1. The definition, once

**Variance is whether a functor preserves or reverses arrows.**

- **Covariant** `F`: `f : A → B` ⟹ `F(f) : F(A) → F(B)`.
- **Contravariant** `F`: `f : A → B` ⟹ `F(f) : F(B) → F(A)`.

Everything below is that sentence, wearing three costumes.

## 2. .NET is the categorical convention, exactly

- `IEnumerable<out T>` — **covariant**. `T` appears in *output* position; the interface
  **produces**. `IEnumerable<Derived>` is an `IEnumerable<Base>`.
- `IComparer<in T>` — **contravariant**. `T` appears in *input* position; the interface
  **consumes**. `IComparer<Base>` is an `IComparer<Derived>`.
- `Func<in A, out B>` — contravariant in the source, covariant in the target.

That last line is not *like* the Hom bifunctor; it **is** `Hom(−,−)`, whose variance is
contra in the first argument and co in the second. C#'s `in`/`out` keywords are the
categorical definition with different spelling.

**Mnemonic that survives the translation below: consumer = contravariant.**

## 3. Physics uses the opposite labels, and this is the load-bearing catch

Physics assigns the names by how **components transform under a change of basis** `A`:

| physics name | example | components transform by |
|---|---|---|
| **contravariant** | tangent vector `v^i` | `A⁻¹` — *against* the basis |
| **covariant** | one-form / gradient `ω_i` | `A` — *with* the basis |

Now dualise. A one-form lives in `V* = Hom(V, ℝ)`, and **dualisation is a contravariant
functor**: `f : V → W` induces `f* : W* → V*`, arrows reversed.

> **So the object physics calls COVARIANT (the one-form) is the image of the
> categorically CONTRAVARIANT functor.** The conventions are inverted.

The bridge that makes it stop being confusing is §2's mnemonic: **a covector is a thing
that eats vectors** — a consumer. Consumer = contravariant in CS = "covariant" in
physics. `IComparer<in T>` and a one-form are the same shape under two naming schemes.

**"When resolution changes" is the physicist's framing of exactly this**, and it is the
right one: a change of resolution *is* a change of basis, and variance is the bookkeeping
for which quantities flip under it and which ride along.

## 4. Which lands on lensography, by definition rather than by analogy

A **profunctor** `p a b` is **contravariant in `a`, covariant in `b`** — the Hom shape
again. Profunctor optics (Pickering–Gibbons–Wu) build lenses as transformations between
profunctors, so a lens's

```
get : S → A          -- covariant / produce
put : S × A → S      -- contravariant / consume
```

**is** the co/contra pair, and *"observe through it and steer through the same focus"* —
the carved sentence of
[the lensography doc](2026-08-02-lensography-soft-regime-chaos-control-homoclinic-tangle-avoidance-quasi-repeatable-orbits.md)
— is the producer/consumer duality stated operationally. Changing focus is changing
basis; the two directions transform oppositely; that is why an optic needs both halves
and why neither alone raises resolution.

Same move again in the Red State dashboard's zoom: a boundary you cross is a basis you
change.

**Human anchor for the bridge itself:** Brian Beckman — a physicist who taught category
theory to .NET developers on Channel 9. Someone standing in both vocabularies is exactly
who would notice that the labels are swapped, which is presumably why Aaron's physics
frame and his .NET frame were compatible from the start rather than needing reconciling
later.

## 5. The corner duality cannot reach — offered as a candidate anchor

Aaron: *"this is what I connected to my four-corner batched feedback — Meijer almost got
this but didn't have the feedback channels."*

**The critique is historically accurate and widely shared, and the reason is structural.**

Meijer's result — *Subject/Observer is dual to Iterator* — reverses the arrows on the
iterator: `IEnumerable` (pull, produce) becomes `IObserver` (push, consume). One
application of `op`. But **reversing arrows once yields a dual PAIR, not a loop**: two
one-way streets pointing opposite directions, with no cycle.

And the missing channel is the concrete, acknowledged defect of Rx: **backpressure**.
Push-only lets a producer outrun a consumer with no path for *demand* to travel back.
Reactive Streams and the JDK9 `Flow` API exist to add precisely that reverse channel. So
the gap Aaron names is not a subtlety — it is the flaw that spawned the successor
designs. Duality was the result, so duality is where it stopped.

**Feedback is a trace, not a dual.** Closing a loop is modelled by the **trace operator**
of traced monoidal categories (Joyal–Street–Verity 1996). Dualisation has no way to
express a cycle; trace is the structure that does.

**And "four corners" is literally what the associated construction produces.** The **Int
construction** (same paper) — Girard's *Geometry of Interaction*, categorically; developed
extensively by Abramsky — builds a compact closed category from a traced one, and its
**objects are pairs `(A⁺, A⁻)`**, a forward and a backward component. A morphism
`(A⁺,A⁻) → (B⁺,B⁻)` is a map `A⁺ ⊗ B⁻ → A⁻ ⊗ B⁺`: **four objects, two directions, one
arrow.** That is four corners as a definition, not a metaphor — the dual pair *plus* the
feedback channels.

## 5a. RETRACTED SAME DAY — the Int anchor does not fit, and Aaron supplied the reason

§5 was offered to be refuted. It was, within the hour, by the operator describing what
the four corners actually are:

> *"It's pseudo retro-causality over Z-sets, with −1 generator-function updates that
> reinterpret the past +1."*

**That is not the Int shape, and the difference is precise.** Int/GoI's `A⁻` is a genuine
**reverse arrow** — demand or continuation travelling *opposite to the data*,
simultaneously, inside a single morphism. A Z-set `−1` does none of that. It arrives
**forward in time** like every other event; what is inverted is its **sign in the
algebra**. Its effect is to revise the *interpretation* of earlier `+1`s when the fold is
recomputed.

**Same direction, opposite weight — not opposite direction.** Reaching for the Int
construction was label-driven: "two signs, two directions, four corners" is a count
match, which is the failure §0 of this very file names. Recorded rather than quietly
edited out, because the retraction is the more useful artifact.

**The anchors that do fit:**

- **DBSP / differential dataflow** (Budiu et al.; McSherry) — the native one, and already
  this repo's foundation. Signed weights with `consolidate` annihilating `+1`/`−1` is
  exactly incremental view maintenance staying consistent under correction.
- **Bitemporality** (Snodgrass) — valid time vs transaction time. A correction recorded
  *now* against an *earlier* valid time reinterprets the past without rewriting it. This
  is the sharpest gloss on "pseudo": what we now believe about then changes; the record of
  what we believed at the time does not.
- **AGM belief revision** (Alchourrón, Gärdenfors, Makinson) — the logic of contraction
  and revision; a `−1` is a contraction operator.
- **Stückelberg–Feynman** — the antiparticle as a particle travelling backward in time,
  which is Aaron's own long-standing reading of retraction, and a far better fit than Int:
  `consolidate` annihilating `+1` against `−1` *is* pair annihilation.

**And the mechanism that makes "pseudo" honest rather than hand-waving:** the log is
**append-only and monotone**; only the *conclusion* is non-monotone. Nothing in the past
is edited, so no causality is violated — a later arrival changes only what the fold
yields. That is precisely why it stays sound while looking retrocausal, and it is the
same split as
[Z-set vs G-set](2026-08-10-the-threshold-rhyme-pay-per-step-with-a-deadline-vs-pay-once-and-foreclose-aaron.md):
monotone substrate, revisable reading.

**What survives of §5:** the *critique* of Meijer stands untouched — a dual pair is not a
loop, and Rx's missing backpressure is the historical proof. What does not survive is the
claim that Int/GoI is where Zeta's four corners live. Trace remains the right structure
for *feedback in dataflow*; it is not the right structure for *retraction over a signed
history*.

## 6. The one-line version

> **Variance is one application of `op`. Feedback is a trace. Retraction is neither — it
> is a sign flip over a monotone log.** Meijer's duality is the first; a control loop
> needs the second; Zeta's four corners are the third, and conflating them was this
> file's own caught error.

## 7. Anchors (Beacon)

- **Category theory:** Mac Lane, *CWM* — functors and variance; `Hom(−,−)` as the
  canonical example.
- **Erik Meijer** — *Subject/Observer is Dual to Iterator* (2010); the Rx duality.
- **Reactive Streams / JDK9 `Flow`** — the backpressure channel Rx lacked.
- **Joyal, Street & Verity** — *Traced monoidal categories*, Math. Proc. Camb. Phil. Soc.
  119 (1996); trace, and the **Int construction**.
- **Girard** — *Geometry of Interaction*; **Abramsky** (with Jagadeesan, Haghverdi, Scott)
  — the categorical development.
- **Pickering, Gibbons & Wu** — profunctor optics; **Foster, Greenwald, Moore, Pierce &
  Schmitt** — lens laws (POPL 2005 / TOPLAS 2007).
- **Brian Beckman** — Channel 9; the physics↔CS bridge, and Aaron's stated entry point.
- **C# language spec** — `in`/`out` variance annotations (C# 4.0).
- Physics: any GR text on index placement; the tangent/cotangent distinction.

## 8. Pointers

- [`lensography …homoclinic-tangle-avoidance…`](2026-08-02-lensography-soft-regime-chaos-control-homoclinic-tangle-avoidance-quasi-repeatable-orbits.md)
  — the optic as observe+steer; §4 is its type-level justification.
- [`the threshold rhyme`](2026-08-10-the-threshold-rhyme-pay-per-step-with-a-deadline-vs-pay-once-and-foreclose-aaron.md)
  — active control needs both directions, which is why a dual pair alone cannot steer.
- `numerology-vs-number-theory` <!-- STALE-REF: ../../.claude/rules/numerology-vs-number-theory.md -->
  — §0 is the inverse case the rule does not cover: structure matched, labels mismatched.
- `src/Core/WSet.fs` — ring-generic weights; the boundary where variance meets our own
  algebra.
