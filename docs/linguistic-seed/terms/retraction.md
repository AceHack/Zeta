---
name: retraction
defined-by: Z-set negative weight (DBSP signed multiplicity); the additive-group inverse
formalised: draft
dependencies: [function]
---

# retraction

## Plain English

A **retraction** is an honest "I take that back." When you add a thing, it
gets weight **+1**. When you retract it, you add weight **−1**, and the two
cancel to zero. The point: you do **not erase** the fact that you once
added it. The undo is its own real, recorded event sitting next to the
original — like an accountant who never scribbles out a wrong entry but
posts an equal-and-opposite one beneath it.

This is step 4 of the five-year-old walk: *saying sorry is a move you're
allowed to make, and it's written down honestly, not deleted.* Adding is
mixing light to make a colour; retracting is mixing paint to take one
away (emit / retract — the RGB / CMYK duality).

## Mathematical definition

Over a domain `D`, a **Z-set** is a [`function`](function.md)
`w : D → ℤ` with finite support (only finitely many elements have nonzero
weight). Two operations:

```
emit(x)     :  w(x) ← w(x) + 1
retract(x)  :  w(x) ← w(x) − 1
```

Because `(ℤ, +)` is an additive group, `+1` followed by `−1` is the group
inverse and sums to `0`:

```
emit(x) then retract(x)   ⟹   net weight 0   (the element cancels)
```

Crucially this is **correction, not deduplication**. Two `emit(x)` give
weight `+2`, not `+1` — retraction does not make the operation idempotent;
it provides a signed inverse. Deletion would *remove the key* `x` from the
map and lose the history; retraction *adds an inverse element*, so the
event log still records that `x` was emitted and then taken back.

## Lean4 formalisation

```lean4
-- ℤ is an additive group; retraction is adding the additive inverse,
-- and emit-then-retract cancels by `neg_add_cancel` / `add_neg_cancel`
-- (real Mathlib lemmas):
example (n : ℤ) : n + 1 + (-1) = n := by ring

-- A Z-set as a finitely-supported function to ℤ is `Finsupp D ℤ`
-- (Mathlib `D →₀ ℤ`); emit/retract are `+ single x 1` / `- single x 1`,
-- and the group structure gives the cancellation for free.
```

## Grounding point (per Otto-21 Craft discipline)

**The accountant's reversing entry.** When a bookkeeper posts a mistake,
they do not erase it — erasing destroys the audit trail and looks like
fraud. They post a second, equal-and-opposite entry. The books now net to
the right number *and* tell the whole truth about what happened. A
retraction is that reversing entry, made a first-class primitive. It is
also the externalised "−1": the honest correction written into the ledger
rather than felt as private regret (the forgiveness-gravity ferry, #43).

## What this term DOES NOT mean

- **Not deletion / erasure.** Deletion drops the key and forgets;
  retraction adds an inverse and remembers. The event history is preserved
  (manifesto §5, memory-preservation).
- **Not idempotent dedup.** Retraction is a *signed inverse*, not a
  duplicate guard. `+1` twice is `+2`; guarding against double-apply needs
  an idempotency key, a different mechanism (manifesto §12).
- **Not logical negation.** `¬φ` flips a truth value; retraction flips the
  *weight* of an element in a multiset-with-signs. Different operators on
  different objects.

## Citations

- **Budiu, McSherry, Ryzhyk, Tannen.** *DBSP: Automatic Incremental View
  Maintenance for Rich Query Languages* (VLDB 2023). Z-sets / signed
  multiplicities — the factory's streaming substrate (`src/Core/ZSet.fs`).
- **Group theory** — the additive inverse in `(ℤ, +)`; the cancellation
  law that makes emit/retract net to zero.
- **Green, Karvounarakis, Tannen.** *Provenance semirings* (PODS 2007) —
  weighted collections, the lineage Z-sets specialise.

## What this term IS (summary)

The signed inverse of an emit: adding weight `−1` so the element nets to
zero, while the event log keeps both the add and the take-back. Correction,
not deletion; not idempotent. The formal twin of the walk's "honest
take-back" and the externalised "−1".
