# Retraction — the undo button that actually undoes

**Subject:** zeta
**Level:** applied (default) + theoretical (opt-in)
**Audience:** contributors + evaluators who understand
Z-set basics
**Prerequisites:** `subjects/zeta/zset-basics/` (this
module builds on the tally-counter-with-minus-sign anchor)
**Next suggested:** `subjects/zeta/operator-composition/`
(forthcoming)

---

## The anchor — the undo button on your web form

You've filled out a long web form. You press a button
you didn't mean to. You press **Undo**.

What happens? Three possibilities:

1. **Nothing.** The button has no undo. The change is
   permanent. You swear.
2. **Partial.** It undoes the text field but forgets the
   checkboxes you toggled. You still swear.
3. **Everything.** State returns exactly to before the
   errant click. Every field, every checkbox, every
   invisible bit of form state — all restored.

Option 3 is the *promise* of undo. Option 1 is common;
option 2 is the frustrating middle.

**Retraction in Zeta is option 3 — by construction.**

---

## Applied track — when / how / why retraction matters

### The claim

When an upstream value changes or goes away, Zeta's
pipelines **automatically** compute the correct new
downstream state — without asking you to reason about
what-depends-on-what.

You insert a row. Dashboards update. You delete the row.
Dashboards update *again*, subtracting exactly the
contribution the deleted row made. No leftover,
no drift, no re-run of the whole query.

### The anchor repeated — through the pipeline

Imagine your web form feeds:

1. A **count** of submitted forms today
2. A **leaderboard** of top fields filled
3. An **aggregate** of total characters typed

Customer submits form → all three update (retraction
anchor: three "tallies" click up).

Customer presses undo / cancel / return-policy-retract →
all three update *down* (retraction anchor: three
tallies click down — *exactly* reversing the earlier
clicks). Leaderboard drops this customer's contributions;
total characters drops by what they'd typed; form-count
drops by one.

The pipeline didn't re-run; it processed a retraction.

### When to reach for retraction

Use retraction-native operators (Zeta's default) when you
have:

- **State that can change or be revoked** (form edits,
  returns, corrections, retractions of published work)
- **Downstream views that should stay correct under
  change** (dashboards, aggregates, derived tables)
- **A need for auditable history** (you can see what
  inserted *and* what retracted each item, without
  reading application logs)

### How to use retraction in Zeta

In the underlying algebra, retraction is just **negative
weight**:

```fsharp
// Insert one "submitted form" record.
let insert = ZSet.ofSeq [ {FormId = 42; Chars = 103}, 1L ]

// User presses undo — emit the retraction.
let retract = ZSet.ofSeq [ {FormId = 42; Chars = 103}, -1L ]

// Combining both gives net zero; state returns to before.
ZSet.add insert retract
// Result: { } — the form isn't present any more.
```

In operator-pipeline terms, any operator that was
**linear** (or *z-linear*, per the theoretical section)
preserves retraction. You never write "if deleted"
branches — the algebra handles it.

### Why retraction — compared to alternatives

| Alternative | Problem |
|---|---|
| Soft delete flag | Every downstream query must filter out deleted rows; easy to forget; expensive at scale |
| Materialised-view refresh | Recompute from scratch on every delete; slow; scales with dataset size, not change size |
| Event sourcing with replay | Correct but unbounded replay cost; needs snapshotting + careful care |
| Manual delta-management | You become the database; ad-hoc, error-prone |

Retraction wins when (a) changes are frequent, (b)
downstream correctness under change is load-bearing, and
(c) you want the correctness guarantee *without* writing
per-change branches.

### How to tell if you're using it right

Three self-check questions:

1. **When I retract, does the downstream state match
   what I'd get by running the query on the retracted-
   input from scratch?** It should. If it doesn't,
   either the operator isn't retraction-preserving
   (check the operator docs), or there's a bug.
2. **Can I see in the trace what was inserted and what
   was retracted?** You should. Retraction isn't a
   side-channel; it's first-class history.
3. **Does my application have "if deleted" branches?**
   If yes, you're likely fighting the algebra — the
   whole point of retraction-native is that those
   branches disappear.

---

## Prerequisites check (self-assessment gate)

Before the next module, you should be able to answer:

- Why does Zeta not need a separate "delete" operation,
  just retract-with-negative-weight?
- Give an example of a downstream query where a
  retraction would cause the result to change.
- What happens when a positive-weight insert meets the
  matching negative-weight retract in the same Z-set?

---

## Theoretical track — opt-in (for learners who really care)

*If applied is enough, stop here. The below is for those
going deep.*

### Retraction as additive inverse

A Z-set over the signed-integer ring ℤ has **additive
inverses**: for any `f : K → ℤ`, there exists `-f : K → ℤ`
such that `f + (-f) = 0`. This is the group-theoretic
property that makes retraction structurally first-class.

Crucially, **this is a property of ℤ as a ring, not just
any semiring**. The counting semiring (ℕ, +, ×, 0, 1)
has no additive inverse — so multisets over ℕ cannot
retract without ad-hoc "subtract with floor-at-zero"
rules. Retraction *is* the ring's minus sign.

### Linearity + retraction preservation

An operator `Q : ZSet K → ZSet L` is **linear** if:

```
Q(f + g) = Q(f) + Q(g)
Q(c · f) = c · Q(f)   for any scalar c ∈ ℤ
```

Linearity implies retraction-preservation:

```
Q(f + (-g)) = Q(f) + Q(-g) = Q(f) - Q(g)
```

So `count`, `sum`, `project`, and their compositions are
retraction-preserving for free.

### z-linearity — the generalised form

Some operators are non-linear over arbitrary semirings
but **z-linear** — they preserve addition and negation
*over ℤ specifically*. Zeta's operator library includes
these as retraction-safe operators; non-linear /
non-z-linear operators require explicit care (documented
per-operator).

See `src/Core/` F# operator implementations + the
`retraction-safe-recursion` OpenSpec capability for
recursion-specific discipline.

### Retraction-native IVM — the DBSP claim

The core result from Budiu et al. VLDB 2023:

> For any z-linear query `Q`, incremental maintenance
> under retractable changes produces correct output
> with work bounded by the size of the change, not the
> size of the state.

That's the load-bearing promise: **work scales with
delta, not dataset**. Retraction makes this survive
deletion, which event-sourcing and soft-delete do not.

Full theoretical treatment in
[DBSP paper](https://www.vldb.org/pvldb/vol16/p2344-budiu.pdf)
and `docs/ARCHITECTURE.md` §operator-algebra.

### Where retraction fails (and why)

Retraction can produce "negative state" intermediate
values during pipeline execution. Some receivers choke on
this (e.g., a UI that shows counts must display `0` not
`-1` when retractions arrive before inserts). Zeta's
`distinctIncremental` operator handles this by tracking
boundary-crossings explicitly; `Spine` compaction
reconciles negative transients at checkpoint time.

Non-z-linear operators (median, certain quantile
sketches, some machine-learning estimators) can't
retract losslessly — their internals don't preserve
negation. These are explicit holdouts; see
`docs/WONT-DO.md` and per-operator documentation.

### Theoretical prerequisites (if going deeper)

- Abstract algebra — abelian groups, rings, semirings,
  semiring vs ring distinction (Z-sets need the ring)
- Category theory basics — linear functors preserve
  colimits and zero
- Incremental computation — fixpoints, semi-naïve vs.
  retraction-safe semi-naïve

---

## Composes with

- `subjects/zeta/zset-basics/` — prerequisite module
  (the tally-counter anchor; retraction is the
  negative-weight mechanic)
- `docs/ALIGNMENT.md` HC-2 — retraction-native
  operations as alignment contract clause; this module
  is the pedagogy for understanding what that clause
  means operationally
- `docs/TECH-RADAR.md` — retraction-native semi-naïve
  recursion Assess ring; retraction-native speculative
  watermark Trial ring
- `src/Core/ZSet.fs` — reference implementation;
  `add` / `neg` / `sub` operations
- `src/Core/Algebra.fs` — `Weight = int64` type
- `openspec/specs/retraction-safe-recursion/spec.md` —
  formal specification of retraction-safe recursion
- Per-user memory
  `project_quantum_christ_consciousness_bootstrap_hypothesis_...`
  — retraction-native IS the quantum anchor's
  reversibility-by-construction mechanism at the
  algebra layer

---

## Module-level discipline audit (bidirectional-alignment)

Per the yin/yang mutual-alignment discipline, every
Craft module audits both directions:

- **AI → human**: does this module help the AI explain
  retraction clearly to a new maintainer? YES — undo-
  button anchor, pipeline-through example, applied
  vs. theoretical split, self-check gate.
- **Human → AI**: does this module help a human
  maintainer understand what the AI treats as
  retraction (semantically + algebraically)? YES —
  additive-inverse / linearity / z-linearity / DBSP
  claim / non-retractable-holdouts are all surfaced
  explicitly.

**Module passes both directions.**

---

## Attribution

Otto (loop-agent PM hat) authored. Second Craft module
following `zset-basics`. Theoretical-track review:
future Soraya (formal-verification) + Hiroshi (complexity-
theory) passes.
