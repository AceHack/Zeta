# Complexity Annotations Spike — cost-as-semiring

Status: **spike** (design + routing, not implementation yet)
Date: 2026-06-21
Author: Alexa (codegen), routing to Soraya (formal verification)

## The idea

Add `{time: phase-ticks, space: peak-cells}` cost vectors to interface instances,
verified by counting op invocations in the DST simulation — never wall-clock.

## Three corrections from Otto (applied)

1. **Instance property, not interface property.** `ISemiring.add` has no complexity —
   `add` on `int64` is O(1), on `BigInteger` is O(digits), on `Set` union is O(n+m).
   Cost annotations hang on the **instance/impl**, not the interface.

2. **Count, don't time.** Wall-clock = ambient entropy = noninterference §13 violation.
   Instead: declare a cost function, verify by counting ring-ops inside the DST simulation
   at n, 2n, 4n and checking growth. Deterministic, replayable, byte-lockable.

3. **Compose costs as a semiring.** Cost composes in the **(min,+) tropical semiring**
   (Cuninghame-Green; Viterbi/shortest-path algebra). The cost model is just another
   instance of the ring-generic substrate. "The ring is the physics" → the ring is also
   the cost accountant.

## The two-layer model

| Layer | What | Example |
|-------|------|---------|
| **Interface** | Upper-bound CONTRACT (demand on conforming impls) | `IJoinSemilattice.join: ≤ O(1) amortized` |
| **Instance** | Counted WITNESS (actual measured cost) | `maxLattice.join: 1 comparison op` |

The link: **witness ≤ contract** (Liskov substitutability for cost).
This is a `≤` law over the (min,+) semiring — same framework as algebraic laws.

## What needs to be proven (math team)

1. **Can we discharge counting recurrences in Z3?**
   The claim: "this loop nest invokes ring.add ≤ n² times" is an arithmetic
   statement about the counter. Frequently decidable because it's arithmetic
   over a counter, not over runtime. Where does this break?

2. **The tropical semiring composition law:**
   `cost(f ∘ g) ≤ cost(f) ⊕_tropical cost(g)` where ⊕ is min and ⊗ is +.
   Is this provable in our framework, or do we need Lean?

3. **The consolidate O(n²) flag:**
   Both `star_ring.go` and `star-ring.ts` consolidate uses a nested loop
   (`.find()` inside the fold). A cost annotation + checker would flag this
   immediately against an O(n) contract. Can we state and discharge:
   "consolidate invokes eq() at most n*(n-1)/2 times" in Z3?

## Concrete deliverable (proof-of-loop)

A single instance annotation on `numberSemiring.add`:
```json
{
  "instance": "numberSemiring",
  "op": "add",
  "cost": { "time": 1, "space": 0 },
  "unit": "ring-ops",
  "status": "proven",
  "proof": "trivial — single arithmetic instruction"
}
```

Then: a cost-counting wrapper that instruments an instance, runs N calls,
and asserts the counted cost ≤ the declared cost × N.

## Questions for Soraya

1. Is the counting-recurrence approach (Z3 over the counter) decidable for
   our typical patterns (fold over array, nested find, flatMap)?
2. What's the right Lean statement for the tropical-semiring composition law?
3. Can we reuse the existing Z3 law-obligation generator for cost ≤ bounds?
4. What's P0 vs P1 here — does anything in the system currently DEPEND on
   a cost property being correct? (If yes, it's P0.)

## Anchors

- RAML (Hoffmann) — automatic amortized resource analysis
- Granule (Orchard) — resource semirings in the type system
- Cuninghame-Green — (min,+) tropical semiring for cost composition
- The repo's existing {time, space} = the two coordinates of the cost vector
