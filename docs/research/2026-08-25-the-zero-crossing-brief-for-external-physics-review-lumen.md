# The Zero-Crossing Conjecture — a brief for external physics review

**Status: the central claim was REFUTED by our own review before this brief was
sent.** What survives is stated in §2b and is, we think, stronger than what it
replaces. This document is kept in its original order so the refutation can be
audited rather than just asserted — the conjecture is stated first, then killed.

Written for a reader with no exposure to this codebase. Everything needed to
evaluate the argument is defined below. We want adjudication, not endorsement.

Companion document (the full internal review, with the code measurements):
`docs/research/2026-08-25-the-landauer-floor-does-not-ground-the-encryption-budget-mutual-information-does-and-decorrelation-does-not-follow-lumen.md`

---

## 0. What we are trying to build

A **privacy budget** for software agents that behaves like hard money: earnable,
spendable, and **not confiscatable by another party**. An agent spends budget to
make a region of its own state permanently unreadable. Spending must be genuinely
irreversible — a budget you can un-spend is not money, and a privacy guarantee
another party can revoke is not privacy.

The question was whether that irreversibility is a *physical* property rather than
a policy we enforce.

## 1. The substrate

**G-set** (grow-only set; Shapiro et al. 2011): add-only, merge is idempotent set
union, state space is a join-semilattice, all operations move monotonically up.

**Z-set** / Z-relation (Green, Karvounarakis & Tannen 2007; the core structure of
DBSP — Budiu, McSherry, Ryzhyk & Tannen 2022): a finitely-supported map `K → ℤ`.
Insert is `+1`, **retract is `−1`**, addition is pointwise on weights.

Critical structural fact: **finitely supported.** A key at weight zero is not
stored as zero — it has no entry.

| operation | effect | status |
|---|---|---|
| `+1` new key | key appears | information-preserving |
| `+1`, 4 → 5 | weight rises | information-preserving |
| `−1`, 5 → 4 | weight falls (a *widening*, in Cousot & Cousot's sense) | information-preserving |
| **`−1`, 1 → 0** | **key ceases to exist** | the **zero-crossing** |

**Measured, all three language oracles agree** (`ZSet.fs:211,216,239,251`;
`z-set.ts`; `indexed_zset.rs`): zeros are dropped, not retained. The count is
byte-lock-stable across implementations. That invariant is real and is the
foundation everything below stands on.

## 2. The conjecture (as originally stated)

> In this algebra the zero-crossing is the **unique** logically irreversible
> operation; it is therefore the only carrier of a Landauer floor, and a ledger
> counting zero-crossings meters physical irreversibility rather than convention.

## 2b. Why it is false — and what replaces it

**Uniqueness fails.** `{(k,5),(k,−1)} → {(k,4)}` is exactly as non-injective as a
zero-crossing: two inputs, one output. Worse for the conjecture, on canonical
Z-sets the map `a ↦ a + b` is a **bijection** for known `b` — *including* at
zero-crossings. So the zero-crossing is not distinguished by irreversibility at
all. The genuine boundary is **discarding the delta** `b`, which sits one level up
from the algebra (Bennett 1973: keep the record and the computation is reversible).

**What survives, and is sharper:**

> The zero-crossing is the unique **evidence-destroying** operation. After it,
> absence is indistinguishable from never-having-existed. It is the only act that
> can **blind the meter** — which is precisely why a ledger must instrument it.

This is a claim about *auditability*, not thermodynamics, and it is the one that
actually motivates the engineering.

**A second, independent objection — direction, not magnitude.** Landauer's arrow
runs `logical irreversibility ⟹ dissipation`. Hard money needs the converse: a
lower bound on the **attacker's** cost to *un-erase*. Landauer bounds the
**defender's** erase. Even granting everything, it constrains the wrong party.

**Magnitude, corrected.** `kT ln 2 = 2.871 zJ` at 300 K (an earlier draft said
2.75 zJ, which is the value at 287.4 K). Against a DRAM write — Horowitz, ISSCC
2014 — the ratio is **10^9.8**. The floor is ten orders of magnitude below the
real cost of erasing anything.

**The honest summary of the physics:** mutual information does all the work; `k`
and `T` do none. Delete them and every result in the analysis still stands.

## 3. The formulation that still deserves review

Independent of the refutation, one structural idea remains interesting. In
abstract interpretation (Cousot & Cousot 1977), **widening** loses precision to
force termination, moving up the lattice toward ⊤. A weight change `5 → 4` is a
**lattice move** — less specific, still in the domain. A zero-crossing `1 → 0` is
**not** a lattice move: the key leaves the domain entirely.

> **The operation that is distinguished is precisely the one not expressible as a
> monotone lattice move.**

If that holds, the consequence is a striking cost model: a list or dictionary is
reversible except where keys cross zero, so total dissipation is bounded by *the
number of keys erased*, **not by the work done** — an arbitrarily long incremental
computation over a fixed key set would have a floor that does not grow with its
length.

We flag that as a reason for suspicion rather than enthusiasm, and we would like
help finding where an unbounded term hides. **Practical limit, stated plainly:**
resolving this empirically likely requires FPGA or exotic-SoC instrumentation to
measure per-operation energy at the necessary resolution. On commodity hardware we
can only speculate, and we are labelling this speculation rather than result.

## 4. Who pays — and the two defects that answering it exposed

An accountant standing *outside* the system, tallying for free, **is Maxwell's
demon in its unresolved form.** Bennett 1982 fixed exactly that: the demon's own
memory is inside the system, and the entropy is paid when it resets. (Correcting
Szilard 1929 and Brillouin, who located the cost at measurement.)

So the design places cost on the `−1` itself — read, after Feynman, as an
antiparticle worldline that must be created and carried, with payment at
annihilation. The governing principle, from the design's originator:

> *"Cost-free recording is a huge stench smell if not measured in actual physics."*

A ledger entry that costs nothing to make constrains nothing. If recording is free,
any party can write any quantity and the measurement is decorative — the same
instinct that makes proof-of-work a filter, and that separates revenue-grade
metrology (tamper-evidence is table stakes) from software telemetry (usually absent,
rarely noticed).

**Checking that against the implementation found two defects with the same shape:**

1. **`GlassHalo.frost` is a revocable marker.** `clear` is free, unconditional, and
   takes no owner argument — contradicting the permanence its governing rule
   asserts. *(Found independently by a second review, which additionally found that
   the behaviour is pinned by a passing test as intended.)*
2. **`Pool.Return` passes `clearArray = false`** for value-type keys, so annihilated
   weights **survive annihilation** and die later against an unrelated `Rent`.

So the `−1` records an *intent* to erase and defers payment. "The antiparticle
pays" is structurally right about **who** and wrong about **when**. Twice over: the
promise of destruction is implemented; the destruction is not.

## 5. The three irreversibilities — one property, pick one, or a triangle?

The design has been assuming thermodynamic, logical, and cryptographic
irreversibility ultimately agree. That assumption is labelled, not granted. Three
readings are live, and we do not know which is right:

| reading | consequence |
|---|---|
| **They coincide** — three views of one property | the framing is safe; use whichever is convenient |
| **They diverge** — the design must pick one | each has a distinct hole (below) |
| **Triangle** — jointly necessary, each covering a failure the others cannot | defence-in-depth across *different threat models*, not redundancy |

The holes that make the third reading plausible:

- **Logical** — certain, but says nothing about cost, and does not stop a copy
  existing elsewhere.
- **Cryptographic** — measurable, enormous leverage (NIST SP 800-88: erase 256 bits,
  render terabytes unrecoverable), but rests on **computational hardness, which is a
  conjecture, not a law**.
- **Thermodynamic** — unconditional, but unmeasurable at any practical scale, and
  (per §2b) bounds the wrong party.

Each alone has a hole the other two cover. Whether that makes them a genuine
triad or three separate mechanisms wearing one word is itself a review question.

## 6. Questions for review

1. Is the §2b refutation correct? Specifically: is `a ↦ a + b` genuinely a bijection
   on canonical Z-sets for known `b`, and does that fully dispose of the uniqueness
   claim?
2. Does *evidence-destroying* (§2b) survive as a well-defined and distinguished
   category, or does it too have counterexamples?
3. Does the lattice-move characterisation (§3) hold, and where is the unbounded term?
4. Bennett 1973 says computation can be made reversible in principle. Does a
   G-set-only system inherit that — or does **idempotent merge quietly destroy
   information** (two identical elements merging into one)? **We do not have a
   confident answer and this worries us.**
5. Is the Maxwell's-demon identification structural or analogical? Our own review
   argues **Pacioli 1494 (double-entry bookkeeping) is the better Beacon anchor than
   Dirac 1928** for retraction: both share the shape "two meet, both cease," but only
   bookkeeping shares the discriminating invariant — *no conservation law forces a
   release*. Is that right?
6. Is the triangle reading (§5) coherent, or a way of avoiding a choice?

## 7. Status

| claim | status |
|---|---|
| Z-sets finitely supported; zeros dropped — three oracles agree | **measured** |
| Only erasure must dissipate (Bennett 1973) | **established physics**, not ours |
| Zero-crossing is the unique *irreversible* operation | **REFUTED** (§2b) |
| Zero-crossing is the unique *evidence-destroying* operation | **survives**, wants review |
| Landauer grounds the privacy budget | **REFUTED** — wrong direction, wrong party |
| Bounded heat per key ⇒ dissipation independent of work done | **speculation**; likely needs FPGA/SoC instrumentation |
| The `−1` bears the cost | **false as implemented** — payment deferred (§4) |
| Frost is permanent | **false as implemented** — `clear` is free and unauthenticated |
| Metering ⇒ agents decorrelate | **non-sequitur.** ρ\* = 1/3 is 0.085 bits of mutual information; the budget is denominated in hundreds. It is a *floor on secrecy* where a *ceiling on disclosure* is needed, reveal-to-earn subsidises the correlation channel, and shared derivation — the dominant term — is untouched. |

The last row was the intended payoff. It does not follow, and saying so is the
main result of this exercise.

## References

Landauer 1961, *IBM J. Res. Dev.* 5(3) · Bennett 1973, *IBM J. Res. Dev.* 17(6) ·
Bennett 1982, *Int. J. Theor. Phys.* 21(12) · Szilard 1929, *Z. Phys.* 53 ·
Bérut et al. 2012, *Nature* 483 · Sagawa & Ueda 2008–2010 *(flagged UNCHECKED — verify first)* ·
Horowitz, ISSCC 2014 · Cousot & Cousot 1977, *POPL* · Green, Karvounarakis & Tannen 2007, *PODS* ·
Budiu, McSherry, Ryzhyk & Tannen 2022, *VLDB* · Shapiro, Preguiça, Baquero & Zawirski 2011, *SSS* ·
Pacioli 1494, *Summa de arithmetica* · NIST SP 800-88 Rev. 1 (2014).
