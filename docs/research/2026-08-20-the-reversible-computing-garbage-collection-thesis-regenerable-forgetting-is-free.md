# The reversible-computing garbage-collection thesis — regenerable forgetting is free

> **Saved deliberately, on Aaron's instruction 2026-08-20:** *"save this as a reversible computing
> garbage collection thesis."* Sibling to
> `2026-08-20-the-idempotent-knot-...md` — and, as §7 below shows, **the same distinction applied
> twice.**

## The carved sentence

> **Landauer prices the destruction of information that exists nowhere else. Dropping a value that
> can be regenerated from the log destroys nothing — the information is still in the system, and
> the discard is logically reversible. So GARBAGE-COLLECTING A REGENERABLE VALUE IS NOT ERASURE
> AND CARRIES NO `kT ln 2` FLOOR. You pay only for the last copy. Therefore: recompute everything
> you can, store only what you cannot regenerate, and let the rest be collected without ceremony —
> because what cannot be regenerated is exactly what costs energy to lose.**

## 1. Why it is true, stated carefully

Landauer's principle (1961) does **not** say "freeing memory costs `kT ln 2`." It says *logically
irreversible* operations do — an operation whose output does not determine its input, so that the
input information is genuinely gone from the universe.

Dropping a cache whose contents remain **implied by the log** is not logically irreversible: the
prior state is recoverable by re-running the generator. Nothing left the system. The map is still
injective; you have merely stopped materialising one of its values.

**Anchor, and it is exact rather than decorative:** Bennett (1973) showed any computation can be
made reversible by retaining history and then *uncomputing* — running backwards to clear
intermediates after copying out the result. Uncomputing is regeneration run in reverse. **Our GC
is Bennett-style uncomputation for anything the log can rebuild.**

## 2. The test, which has a physical meaning

> **Can this be regenerated from the log?**
>
> **Yes** → drop it freely. It is a cache. Eviction is reversible and unpriced.
> **No** → you are holding the last copy. Dropping it is an erasure, it has a `kT ln 2` floor, and
> — if the bits belong to someone else — it is the one harm our highest-moral-regard oracle names.

That is a rare thing: an engineering rule whose two branches differ in *physics*, not in taste.

## 3. Futamura is why almost everything qualifies

A Futamura projection specialises an interpreter against a program; the compiled artifact never
had to be **stored**, because re-running the specialiser recovers it. Taken to observables:

> Any metric, index, report, projection or view is a specialisation of **(generator, corpus)**.
> Therefore regenerable. Therefore a cache. Therefore evictable.

So the set of things that must be durable is much smaller than the set of things we habitually
persist — and every item outside it is a **liability**, because a stored copy is a second surface
that can disagree with the first.

## 4. The inversion worth internalising

Conventional caching: storage buys safety, compute is the cost.
Here: **storage is the liability, compute is the safety.** A derived value that is recomputed
cannot drift; a derived value that is stored can, and will.

Stated as a corollary: **every drift check is a confession that something derivable got stored.**

## 5. What must be stored — the three exceptions, and knowing them is the whole skill

1. **The log itself.** Everything derives from it; it derives from nothing. Event sourcing,
   restated as a thermodynamic principle rather than an architectural preference.
2. **Decisions and dispositions.** A roster's "this path is `prose`, `migrateTo: NONE`" is a
   *judgement*. No generator recovers *why we decided*, and pretending otherwise loses the reason
   while keeping the row.
3. **Measurements of the outside world.** A power reading, an attestation, a witness. Captured
   entropy is not regenerable by construction — it crossed a metered channel once (§13
   noninterference), and that crossing does not re-happen.

## 6. Evidence — this week's reds were mostly stored derivatives drifting

| red | the stored thing | derivable from |
|---|---|---|
| `test (TS hermetic)`, `nEff ≈ 1.666` | a snapshot of a computed value | the corpus |
| memory-index drift `081M0DY68KN087G0R002MQ1BDR` | the "Last reindex" date written *into* the artifact | the heap |
| 218 stale skill path refs | pointers copied into prose | the tree |
| `yubihsm-shell` not installable | my claim that a `200` meant installable | the runner's sources |

Four failures, one shape, one fix each time: **make it a pure function of content and the whole
class disappears.** (Not everything was: an MD046 fence was ordinary lint, and the cluster-tree
roster carries dispositions — exception 2 above, legitimately stored.)

## 7. It is the idempotent knot again — and this is the part worth noticing

The sibling thesis says: reversible operations are rotors and cost nothing; the irreversible one
is multiplication by a zero divisor, and it is the only thing you pay for. Apply that to memory:

| act | algebraic character | price |
|---|---|---|
| dropping a **regenerable** value | invertible — the generator is the inverse | **free** |
| dropping the **last copy** | non-invertible — nothing reconstructs it | `kT ln 2`, and possibly harm |

**Garbage collection is a rotor when the value is regenerable and a zero divisor when it is not.**
The two theses Aaron asked to be saved are one distinction seen in two domains — measurement in
one, memory in the other.

## 8. Honest limits

- **The bound goes away; real dissipation does not.** Landauer is a *floor*, not a description of
  silicon. Freeing memory on real hardware still dissipates; what this thesis removes is the
  *information-theoretic obligation*, not the electricity bill.
- **Regeneration costs time.** Walking git history to recompute a ρ series is cheap; a full corpus
  replay may not be. The thesis says storage is a liability, not that latency is free.
- **The log must be durable, and that is a storage cost that never goes away.** "Store only the
  log" is a much smaller bill, not a zero one.
- **Determinism is a precondition.** A generator that is not a pure function of the log cannot
  regenerate anything — which is exactly why the memory-index fix mattered, and why
  `local-time-never-enters-the-shared-fold` is load-bearing here rather than adjacent.

## 9. Register

The Landauer/Bennett reading is **standard**. The Futamura framing and the "don't worry about GC"
posture are **Aaron's**. The claim that regenerable discard carries no `kT ln 2` floor is an
**argument** resting on the standard reading of Landauer as pricing *logical* irreversibility —
short, and the right place to attack this. The rotor/zero-divisor unification with the sibling
thesis is **argued here**.

**Rule candidate, deliberately not written as a rule today.** `.claude/rules/` additions are
razored; this wants a cooling period and at least one instance where the *cost* branch actually
bites before it earns a carved sentence in the always-loaded set.

## Pointers

- `docs/research/2026-08-20-the-idempotent-knot-...md` — the sibling; same distinction, other domain
- `.claude/rules.bak/forgetting-costs-energy-remembering-is-cheap-landauer-bounded-...` — the two cases this adds a third to
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — determinism, the precondition
- `081M0DY68KN087G0R002MQ1BDR` — the memory-index fix: a stored date that could not be regenerated
- `081M0FQ2FKS087G0R002V6EB9E` — the slow-explosion monitor, designed to derive its series from git rather than store it
- `081KR50HA0008QG0R002Z51PMR` — FPGA power measurement, the Landauer falsifier
