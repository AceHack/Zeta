# An unmetered channel is a Maxwell's demon — retraction is free, compaction is where we pay Landauer

**Ferried + derived** 2026-08-18 · source: Aaron, on the Langan transcript's unmixing demo —
*"this is similar to our maxwells demon too"* · register: **Beacon** · status: §1–§3 **structural**
(standard physics, correctly attributed); §4 is an **engineering claim with a falsifier**, stated
as such.

## 0. The prompt

In the transcript the interviewer describes a machine: two coloured gelatinous liquids, crank
forward and they become an apparently chaotic mess, crank backward and they separate cleanly
again. Langan's reply: *"That sounds like Maxwell's demon."*

It is not, and the difference is the useful part.

## 1. What the demo actually shows: apparent disorder is not entropy

The device is the classic **laminar-flow reversibility** demonstration (G. I. Taylor's
Couette-flow experiment; dye in glycerin between concentric cylinders). At low Reynolds number the
flow is *deterministic and invertible* — the dye is **sheared**, not mixed. Reversing the crank
applies the inverse map and the dye returns.

**No entropy decreased, because none had increased.** Nothing was lost; the information about
where each dye parcel came from was still in the fluid, just spread out in a way the eye reads as
disorder.

And the trick has a known failure mode, which is what proves the point: **molecular diffusion**
is the genuinely irreversible process, and it runs the whole time. Crank slowly, or wait between
forward and back, and the dye does not come back. Diffusion is where entropy is actually produced;
shear is not.

So the demo is the **exact dual** of the interviewer's own coffee-and-milk correction earlier in
the same conversation. There, a uniform appearance was maximum entropy. Here, a chaotic appearance
was near-zero entropy production. Both say the same thing:

> **Entropy is a property of a description, not of how something looks.** You cannot read it off
> the picture. You have to name the coarse-graining first.

That is Gibbs and Jaynes, and it is why the "order vs disorder" vernacular Langan and the
interviewer are both circling is not repairable by argument — the vernacular is missing the
coarse-graining argument that makes the quantity well-defined at all.

## 2. What Maxwell's demon actually is — a *different* claim

Maxwell's demon is not "something that looks disordered becoming ordered." It is an agent that
**uses information** to sort molecules and thereby appears to decrease entropy in a closed system.

The resolution (Szilard 1929 → **Landauer 1961** → **Bennett 1982**) is that the demon must
*store* which molecule went where, and its memory is finite. Measurement can in principle be made
free; **erasure cannot**. Resetting one bit of the demon's memory dissipates at least **kT ln 2**.
Account for the demon's memory and the second law is intact — the entropy was never destroyed, it
was **relocated into an unmetered component**.

That last sentence is the whole transfer.

## 3. The generalisation: a demon is an accounting error, not a violation

> **A Maxwell's demon is what an unmetered channel looks like from outside.**

The demon never breaks physics. It breaks *your books*, by moving cost into a component your
accounting did not include. Once you meter the component, the anomaly disappears and nothing
interesting is left.

This makes **§13 noninterference (entropy quarantine)** a much sharper rule than it reads. §13 says
entropy and influence enter only through **declared, metered channels**. Stated in demon terms:

> **Every undeclared channel is a demon.** It will appear to give you something for nothing —
> free ordering, free coordination, free entropy reduction — precisely because the ledger that
> would show the cost is the one you did not open.

And it is the same shape as the **vacuity class**: an unmetered channel and a check that did not
run both produce *the appearance of a favourable result by omission*. Free entropy reduction and a
passing test that never executed are the same failure wearing different clothes.

Note this also explains why §13's guards are the ones they are — no ambient clock, no ambient
`Task.Run`, no ambient allocator. Each of those is a demon: a place where influence enters
without appearing on the books.

## 4. The engineering consequence: **retraction is free; compaction is where we pay**

This is the part that is ours, and it is a claim with a falsifier rather than a metaphor.

Our substrate is a Z-set / DBSP fold. Two operations look superficially like "undoing," and the
demon analysis says they are **completely different thermodynamically**:

| operation | what it is | reversible? | entropy cost |
|---|---|---|---|
| **Retraction** (`+1` then `−1`) | a *correction* recorded in the log; both events remain | **yes** — the log retains the full history, the map is invertible | **none** — this is the crank turning backward |
| **Compaction / GC / squash** | *discarding* the events that produced the current state | **no** — the preimage is gone | **kT ln 2 per bit erased** — this is Landauer |

So: **retraction is the laminar shear, and compaction is the diffusion.** The state after a
retraction *looks* like information was destroyed, and it was not — exactly the dye returning. The
state after a compaction looks identical and the information is genuinely gone.

**Design consequence, stated so it can be wrong:** an entropy budget that meters *retractions* is
metering the reversible operation and will read near-zero cost for a system that is in fact
destroying history rapidly. The meter belongs at **compaction, squash-merge, snapshot-supersedes-log,
and memory eviction** — every point where a preimage becomes unrecoverable.

**Falsifier:** find a substrate operation that destroys a preimage and is *not* on that list, or
show that one of the listed operations retains its preimage. Either refutes the placement.

This is also why `§5 Memory Preservation Guarantee` and the entropy discipline are the same
constraint seen twice: the spec that says identity transitions must never silently destroy memory
is, thermodynamically, the spec that says **you may not run a demon on your own history.**

## 5. What this does *not* claim

- It does not claim our compaction literally dissipates kT ln 2 on real hardware in any measurable
  way. The bound is a floor, and real DRAM is many orders of magnitude above it. The claim is about
  **where the irreversibility is**, not about joules.
- It does not promote the Landauer connection out of `unmetered`. §4's table is derived, not
  measured; the falsifier above is what would earn the promotion.
- Langan's *"mine actually has structure, mathematical structure to it"* is not being endorsed or
  attacked here — §1–§3 are standard physics that predate the conversation entirely, and the
  conversation is only the occasion.

## 6. Anchors (Beacon)

- **J. C. Maxwell** (1867, letter to Tait; *Theory of Heat* 1871) — the demon.
- **Leó Szilard** (1929) — the one-molecule engine; first linking of information to kT ln 2.
- **Rolf Landauer** (1961), *Irreversibility and heat generation in the computing process* — the
  erasure bound. **Charles Bennett** (1982) — the resolution: measurement can be reversible,
  erasure cannot, so the demon's memory is where the cost lives.
- **G. I. Taylor** — laminar-flow reversibility in Couette flow; the demo in the transcript.
- **J. W. Gibbs**; **E. T. Jaynes** (1957) — entropy as a property of the macrostate/description,
  which is the correction §1 rests on.
- **Goguen & Meseguer** (1982) — noninterference; §3 is that rule read thermodynamically.

## Pointers

- [`dv2-data-split-discipline-activated.md`](../../.claude/rules/dv2-data-split-discipline-activated.md)
  §7 noninterference — §3 sharpens it: *every undeclared channel is a demon*.
- [`manifesto-13-specifications.md`](../../.claude/rules/manifesto-13-specifications.md) §5 memory
  preservation, §13 noninterference — §4 argues these are one constraint.
- `2026-08-18-godel-localized-to-a-known-junction-*.md` §6f — the Landauer axiom-erasure thread
  this extends from erasing *axioms* to erasing *history*.
- `2026-08-18-chris-langan-ctmu-*-record.md` §8e — the coffee-cup half of the same correction.
- The Z-set retraction note in
  [`dv2-data-split-discipline-activated.md`](../../.claude/rules/dv2-data-split-discipline-activated.md)
  ("retraction is *correction*, not a duplicate-guard") — §4 adds the thermodynamic reading of why.

---

## 7. Aaron's move: mutual witness / quorum closes the regress — and the physics agrees

> *"we overcome this by mutual witness or qurom observatin to excape the spiral for homoclinical
> tangle"* — Aaron, 2026-08-18, on §2.

This is the sharpest thing in the thread and it is **not** a rhetorical dodge. It has a published
anchor, it has an exact limit, and the limit is where our engineering consequence lives.

### 7a. The spiral he is escaping

§2's demon has to hold the record *itself*, and eventually erase it. Asking *"who observes the
observer"* generates a **hierarchy**: A's memory is audited by B, whose memory is audited by C, and
so on. Every level needs its own memory, so the regress never terminates — and the top level, the
one nobody audits, is exactly where the unpaid cost hides.

A hierarchy of observers cannot close. **That is the spiral.**

### 7b. Why a cycle closes where a hierarchy cannot

Mutual witness replaces the chain with a **cycle**: A witnesses B witnesses A. The graph has no
top, so there is no level that must hold the final, unerased record.

The information no longer lives in either party. It lives in the **correlation between them** —
`I(A;B)` — and is attributable to neither. That is the whole trick, and it is why "mutual" is
load-bearing rather than decorative: a *hierarchical* witness still terminates in someone holding
an unchecked record.

### 7c. The physics: conditional erasure can cost zero, and this is a real result

Landauer's `kT ln 2` is the cost of erasing a bit **relative to no side information**. If B holds a
record correlated with A, then erasing A *conditioned on B* costs

```
W ≥ kT · ln 2 · H(A|B)
```

which is **zero when the correlation is perfect** — and, with quantum side information, `H(A|B)`
can be **negative**, meaning erasure *extracts* work.

That is not an analogy. It is **del Rio, Åberg, Renner, Dahlsten & Vedral, "The thermodynamic
meaning of negative entropy", Nature 474, 61–63 (2011)** — the paper says precisely that an
observer holding side information about a system can erase it at zero or negative work cost.

**So Aaron's intuition is anchored, not merely plausible.** Mutual witnessing is the arrangement
that makes every party's record conditionally-redundant to some other party's, which is exactly the
condition under which the erasure bill goes to zero at erasure time.

### 7d. The limit, stated plainly, because this is where a free lunch would hide

It does **not** repeal the second law, and the honest phrasing matters:

> **You escape the epistemic regress. You do not escape the bill — you relocate it from
> erasure-time to correlation-establishment-time.**

Establishing the correlation cost something. `H(A|B)` is only small *because* A and B were brought
into agreement, and that process is where the work was done. The joint system obeys the second law
throughout. What mutual witnessing genuinely buys is that **no single party pays at the moment of
erasure**, and the cost is amortised into shared history rather than concentrated in one component
— which is what makes quorum practical, not what makes it free.

### 7e. The engineering consequence — with a falsifier

This is the operational output, and it is a **placement claim** just like §4:

> **Meter the FORMATION of the witness relation, not only the erasure.**

If our ledger meters compaction (§4) but not the establishment of witness correlations, then
mutual witnessing looks free in our books — and by §3, *a thing that looks free because the ledger
is closed is a demon*. We would have built the exact failure this document is about, one level up.

**Falsifier:** exhibit a quorum that erases with no member paying **and** with no metered
correlation-establishment anywhere in its history. That is a perpetual motion machine; either it
does not exist, or §7 is wrong.

This also gives the staking rule its thermodynamic reading: witnessing costs the witness something
(`privacy-budget-is-hard-money`, the *stake*), and that cost is not a moral tax bolted on — it is
**the establishment cost of the correlation, made explicit in the ledger**. The rule and the physics
were describing the same expenditure.

### 7f. "Homoclinic tangle" is the right image, and it names the price

A **homoclinic orbit** leaves a fixed point along the unstable manifold and returns to *the same*
fixed point along the stable one — it closes on itself rather than escaping. Where the two
manifolds cross transversally you get Poincaré's **homoclinic tangle**: infinitely many
intersections, a bounded region, and Smale-horseshoe dynamics.

That is a precise description of the trade:

| | hierarchy (spiral) | mutual witness (tangle) |
|---|---|---|
| terminates? | **no** — infinite regress | **yes** — the cycle closes |
| well-founded? | yes — there is a ground level | **no** — there is no ground level |
| what you get | a top nobody audits | sensitive dependence, many crossings, bounded |

**You gain termination and you lose foundation.** There is no longer a level you can point at and
call ground truth. That is not a defect to be engineered away — it is the *price*, and stating it
as the price is the difference between this and a free lunch.

### 7g. The convergence with the Xbox 360 finding — structural, not numerological

The same mechanism appears in the hardware thread on the same day, and it is worth naming because
it is a *shared mechanism*, not a matching count:

- The 360's DVD drive was a **hierarchical** attestation: the console accepted a verdict from a
  root nobody checked. Class 2 in
  `2026-08-18-the-original-xbox-a-root-of-trust-below-the-update-boundary-*` §2d.
- A hierarchical *observer* chain has the same defect: a top whose record nobody audits.

**In both cases the unchecked root is where the unpaid cost hides** — an unverifiable verdict there,
an unmetered erasure here. And in both cases the fix is the same shape: **make it mutual, so there
is no unchecked root.** Attestation must be reciprocal for the same reason witnessing must be.

Per [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md): this is
promoted above coincidence because the *mechanism* is identified (who holds the record nobody
checks), not because two things both happened to be about trust.

### 7h. Register

7a/7b **structural**. 7c **anchored and checked** — del Rio et al. 2011 states the conditional-erasure
result directly; this is the strongest anchor in the document. 7d is the **honest limit** and is the
part most likely to be dropped in retelling. 7e is an **engineering claim with a stated falsifier**,
`unmetered` until someone builds the meter. 7f is a **named trade**, not a result. 7g is
**structural** by the mechanism test.

### 7i. Anchors added

- **del Rio, Åberg, Renner, Dahlsten & Vedral** (2011), *The thermodynamic meaning of negative
  entropy*, Nature 474:61–63 — conditional erasure at zero or negative cost. §7c rests on this.
- **Poincaré** — homoclinic tangle; **Smale** — the horseshoe. §7f.
- **Lamport, Shostak & Pease** (1982) — Byzantine agreement; quorum as the practical form of §7b.

---

## 11. CORRECTION (2026-08-18, same day): §4's falsifier fired — the placement was wrong

§4 offered a falsifier and it was taken up within hours. **It fired.** Recording the refutation in
the document rather than quietly editing §4, because a placement claim that was corrected is worth
more as a record than one that appears to have been right all along.

### 11a. The refutation, on both clauses

**Clause 1 — "find an operation that destroys a preimage and is NOT on that list."** Five, and they
are not obscure. `src/Core/WSetHeat.fs:50–114` carries a **declared** thermodynamic class per
operation, and `tests/Tests.FSharp/Formal/WSet.ErasureClassification.Laws.Tests.fs` **measures** it
by exhaustive sweep (`bitsErased = log2(largest fibre)`), failing if declaration and measurement
disagree *in either direction*:

| operation | largest fibre | bits erased | on §4's list? |
|---|---|---|---|
| `negate` — **the retraction** | 1 | **0.000** | n/a — free, and this half was right |
| `plus` — **the fold's own `+`** | 3 | **1.585** | **no** |
| `consolidate` — **the Z-set constructor path** | 11 | **3.459** | **no** |
| `bornProb` | 7 | 2.807 | **no** |
| `discard` | 15 | 3.907 | **no** |
| `tensor` | 85 | 6.409 | **no** |

**The erasure lives in the ordinary arithmetic of the fold, not at a GC boundary.** `ZSet.ofSeq`
runs `consolidate` on construction; `src/Core/ZSet.fs:211,216` drops a key whose accumulated weight
reaches zero, so `+1` then `−1` leaves *nothing* — indistinguishable from never-present. §4's list
was not merely incomplete; **it pointed away from the highest-frequency erasing operation in the
substrate.**

**Clause 2 — "show that one of the listed operations retains its preimage."** `FerryQueue.dequeue`
and `flush` are eviction-shaped and are declared and measured **reversible** — `0` bits — because
*the payload is returned*, so `(tail, head)` determines the queue.

### 11b. What was actually wrong: I typed the list by lifecycle stage

§4 grouped operations by **when they happen** — compaction, squash, snapshot, eviction. That is a
lifecycle taxonomy wearing a thermodynamic one's clothes. The real invariant is **injectivity**:

> **An operation erases iff it is non-injective. Not iff it is called garbage collection.**

Eviction is not a thermodynamic category; *whether the payload is handed back* is. Addition is not
a bookkeeping detail; forgetting the split point of an ordered pair costs `log2(3)` bits.

### 11c. The part that survives, and it was already proved

§4's **dichotomy** — retraction free, erasure elsewhere — is **CONFIRMED**: `negate` is fibre 1,
0.000 bits. And the F# test file states the distinction directly, two to five days *before* this
document was written:

> *"the annihilation step is the ERASING one, even though the negation feeding it is not. Those two
> facts are routinely read as one, and they are not."*

**So the repo already held a machine-checked, CI-gated answer, and I asserted a placement without
looking for it.** That is the failure `anchor-to-human-prior-art` exists to catch, committed against
our own prior art rather than someone else's — the search that would have found `WSetHeat.fs` is the
one I did not run. §5's `unmetered` label should be read as: **promoted for the dichotomy, corrected
for the placement.**

### 11d. §7e's falsifier was ill-formed — and the flaw is this document's own §3

The §7e falsifier ("exhibit a quorum that erases with no member paying and no metered
correlation-establishment anywhere") **can be satisfied trivially**: `SybilBft.decide`
(`src/Core/SybilBft.fs:93`) folds a tally to one verdict, is non-injective, and nothing is charged
anywhere. But that witness is produced by **absence of instrumentation, not by a fact about the
world** — *any* unmetered quorum satisfies it.

A falsifier that fires whenever the meter is missing measures **our books, not the second law**.
That is precisely the vacuity class this document's §3 names, inverted and turned on the document
itself. §7e must be restated as a claim about the ledger — *"no metered quorum may show erasure with
zero total charge"* — not as a claim about existence.

### 11e. §7e's *conditional* is CONFIRMED, and it is the real finding

§7e warned: *"if our ledger meters compaction but not the establishment of witness correlations,
then mutual witnessing looks free in our books."*

**Our ledger meters neither.** Three distinct ledgers exist and none covers this:

- `ledger/measure.ts` + `db/uncertainty/` — the **bug-fix ΔU** ledger, deliberately ordinal; meters
  no physical erasure and is not the entropy ledger (I conflated them in §4).
- `algebra/entropy-tracker.ts` — the real two-ledger Landauer accounting, with a Lean twin at
  `Core.Lean4/Lean4/LandauerFloor.lean`. Charged at five sites; **none is compaction, squash,
  snapshot-supersedes-log, or eviction.**
- `src/Core/Heat.fs` — the shed-disposition ledger.

`RecoverableSpine.fs:74` (`TruncateAsync … // GC the absorbed tail`) is the one genuine
snapshot-supersedes-log site and charges nothing. And the repo states the §7c gap itself at
`algebra/erasure-derivation.ts:49`: the finer figure *"requires modelling caller-retained side
information, which the two-ledger tracker does not carry"* — side information is exactly the
`H(A|B)` of §7c, and `FinConditionalEntropy.lean` / `FinMutualInfoNonneg.lean` formalise it in Lean
without anything wiring them to the meter.

**So the failure this document warns about is already built.**

### 11f. A demon inside the meter — verified

`src/Core/Heat.fs:285` `dispositionOfKind` matches on the **whole dotted kind including the source
prefix**, and the file's own comment (lines 277–278) names the cases it catches:
`denied-list.compacted`, `rejection-sampler.evicted`, `reject-cache.overwritten`,
`backpressure-meter.erased`.

**A compaction and an eviction that the meter can read as free** — under-charged in the *unsound*
direction, already on file in the source. That is §3 exactly: a thing that looks free because the
ledger is closed.

### 11g. What replaces §4

> **Meter by injectivity, not by lifecycle stage.** An operation is charged iff its fibres are
> non-trivial. The declaration lives beside the operation (`WSetHeat.fs`), the measurement is an
> exhaustive sweep, and the two must agree in **both** directions — a declaration that over-charges
> is as wrong as one that under-charges. Extend that existing machinery to the spine/log/eviction
> sites, which currently declare nothing; do not build a second list.

### 11h. Marked unknown, not inferred

Whether squash-merge destroys the preimage in this repo's actual configuration (PR commits and
`consume-pr-archives.ts` may retain it); whether `git gc` runs on `refs/zeta/*`; and the
Rust/C#/Q# oracles' Bloom/CountMin classifications, which were not swept. These are **unknown**,
not "fine."

### 11i. Amendment — the category error is deeper than §11b said, and §11e overstated

A re-verification pass against `origin/main` (the first pass read a checkout 754 commits stale;
every conclusion held, but two things sharpen and one was mis-stated).

**The list is stated in operation NAMES; erasure is a property of the REPRESENTATION.**

`IDeltaLog.TruncateAsync` is *one interface method with one call site*
(`RecoverableSpine.fs:74`). It is preimage-**destroying** under `DeltaLog.fs:94–98`
(`list.RemoveAll`) and preimage-**preserving** under `GitDeltaLog.fs:177–201`, which builds a tree
with the low blobs removed and commits it **with the old commit as parent** — so every truncated
delta stays reachable through the DAG. That file says so itself: *"git never rewrites history —
Landauer-honest, Memory-Preservation §5."*

**Same operation name, opposite thermodynamic class, decided by the injected backend.** So §11b's
"meter by injectivity, not lifecycle stage" is right but not yet sharp enough: injectivity is a
property of the *concrete implementation*, and no name-based list — mine or its replacement — can
be completed or trusted. The declaration must live where the representation is chosen.

**A whole category the list had no slot for.** `src/Core/GiftOfErasure.fs` (landed PR #11705, and
absent from the stale tree) is *deliberate, cooperative, privacy-motivated forgetting* whose entire
**purpose** is that the preimage be unrecoverable — it structurally removes sealed bytes and records
only the fact. Not GC, not eviction, not a squash. And it is **quorum-shaped**: its thesis is
literally *"you cannot forget alone."* So it is simultaneously §7's mutual-witness structure and
§7e's falsifying witness — erasing with no member paying and no metered correlation-establishment
anywhere (`mix` charges nothing). §7 was arguing about the very module that already implements it.

**§11e overstated: §7e's conditional has a FALSE ANTECEDENT.** I wrote that the conditional *"if our
ledger meters compaction but not witness-correlation formation"* is confirmed. It is not — the
ledger meters **neither**, so the antecedent is false and a conditional with a false antecedent is
not "confirmed," it is **unexercised**. The honest statement is that **the gap is both halves, and
the worry was understated rather than validated.** Correcting my own correction, because "confirmed"
was doing rhetorical work the logic did not support.

**Unknown, not inferred:** whether the F# erasure tests pass on `main` today — they are compiled in,
carry no `Skip`/`Ignore`, and are gated by `dotnet test Zeta.sln -c Release`, but non-vacuity is
argued from the source's structure (exact-match on fibre *and* `BitsErasedPpm`, plus a reflection
drift guard), not from an observed green run.

## 12. §11g DISCHARGED (2026-08-19) — the machinery extended, and what it measured

§11g named the replacement: *"Meter by injectivity, not by lifecycle stage. The declaration lives
beside the operation, the measurement is an exhaustive sweep, and the two must agree in BOTH
directions. Extend that existing machinery to the spine/log/eviction sites, which currently declare
nothing; do not build a second list."* This section records what happened when that was done, in
the order it should be read: **the two results that contradict this document first.**

### 12a. The correction to the correction: quota eviction erases NOTHING

§4 listed eviction. §11b demoted it from "erasing site" to "lifecycle category", but kept it in the
frame as a plausible candidate. It is not a candidate. **`DiskSpine.fs` / `DiskSpineAsync.fs` quota
eviction is measured `Reversible`, zero bits.** `spillLocked` writes the batch to the workspace file
and records its path *before* removing the heap entry, so `Load` returns the identical Z-set
afterwards. The falsifier is stated as a commuting square rather than a fibre, because that is the
legible form: **the store's content function under a quota that spills on every save is
byte-identical to the same store's content function under a quota that never spills.**

Mutating `spillLocked` to drop the path turns that row from fibre 1 to fibre 8 and reddens three
tests. Eviction is a *relocation*. This is the `FerryQueue.dequeue` finding again — the payload is
handed back — and it means §4's list was wrong about eviction in the *opposite* direction from the
one §11 assumed: not "incomplete", but naming an operation that is free.

### 12b. The observation is load-bearing, and §11i understated how much

§11i said the class is a property of the representation. True, and not sufficient. **The same
representation, same operation, can carry opposite classes under two observations, and both are
honest.** `ZetaFsDeltaLog.TruncateAsync` is:

- `Erasing` (fibre 13, 3.700 bits) through the log's own read surface, and
- `Reversible` (fibre 1) through the object store including unreachable loose objects,

because it writes a new tree and moves the ref **with no parent edge**, orphaning the old tree on
disk where nothing traverses to it and nothing collects it. The bytes are not dissipated; the
recoverability is gone. Averaging those two into one class would be a guess wearing a measurement's
clothes, so `(Representation, Operation, **Observation**)` is the key, and every row states what it
was measured against. A class with no stated observation is not a claim.

### 12c. Four classes for one interface method — the pin, now machine-checked

`IDeltaLog.TruncateAsync`, one method, one call site (`RecoverableSpine.fs:74`):

| representation | class through the read surface | why |
|---|---|---|
| `InMemoryDeltaLog` | **Erasing** (13, 3.700) | `list.RemoveAll`; nothing else holds them |
| `DiskDeltaLog` | **Erasing** (9, 3.170) | files unlinked; `HighWater` is a field, so the *count* survives |
| `ZetaFsDeltaLog` | **Erasing** (13, 3.700) | ref moved, old tree orphaned — litter, not recovery |
| `GroupCommitDiskDeltaLog` | **Reversible** (1, 0.000) | a no-op; compaction is unimplemented in v1 |
| `GitDeltaLog` | **Erasing** (9, 3.170) here, **Reversible** (1, 0.000) through the commit DAG | truncated tree committed **with the old commit as parent** |

The Git row is the one worth stating twice. Through the log's own read surface Git is *exactly as
erasing as everything else* — `ReplayAsync` reads the tip tree only. The two backends differ in what
**other** channel survives, and saying so keeps the comparison honest instead of flattering. A test
pins the disagreement itself, so a later refactor that unified truncation semantics would fail
loudly rather than quietly making this section false.

### 12d. Where the bits actually are, at every site examined

The §11a headline — erasure lives in the ordinary arithmetic, not at GC boundaries — reproduced at
three sites that had nothing to do with the four-corner algebra:

- **`IBackingStore.Save`** is `Erasing` (fibre 2, 1.000 bit) and the eviction is not why. A
  content-addressed upsert maps two pre-states onto one post-state: **idempotence is erasure.** The
  bits in `Save` are in the content-addressing.
- **`RecoverableSpine`'s fold** is `Erasing` (fibre 5, 2.322 bits) and fires on **every commit**,
  not once per snapshot cadence. `ZSet.add` consolidates, so a delta and its retraction annihilate.
- **`observeNode` in `discovery/dht-discovery.ts`** measures fibre 6 (2.585 bits) — and restricted
  to histories where no bucket can ever fill it still measures **4 (2.000 bits)**. So the k-bucket
  eviction accounts for 0.585 bits and the **idempotent refresh accounts for the other 2.000**. The
  decomposition is a declared, swept row, not a remark: disabling eviction entirely leaves the
  operation `Erasing`, which is the whole §11b thesis arriving from a direction nobody aimed at.

### 12e. The design question §11i raised, and the answer taken

*Where does a classification live when the same method has opposite classes per backend?*

**On the implementation, expressed as an obligation the interface does not carry.** `IDeltaLog` is
left alone — it is precisely the level at which the class is undecidable. A separate
`IErasureDeclaring` is implemented by each concrete representation, and a reflection drift guard
fails when a type implements a preimage-bearing interface (`IDeltaLog`, `IBackingStore`,
`IAsyncBackingStore`) without also implementing it. A new backend must classify itself before it can
merge; silence is not a passing state.

The composite case is the sharp one. `RecoverableSpine` **derives** its class by reading the
injected backend's declaration rather than asserting one, so:

- over `InMemoryDeltaLog` the same code path measures `Erasing`;
- over a preserving backend it measures `Reversible`;
- over a backend that declares **nothing** it reports `Unmeasured` — never free.

That last case is the drift guard at runtime, where a reflection test over our own assembly cannot
reach a caller-supplied type. Mis-declaring `InMemoryDeltaLog` propagates through the inherited row
and reddens the spine's test too, which is how the inheritance was verified as live rather than
decorative.

### 12f. `Unmeasured` is a class, and it is not zero

§2's demon is a channel that reads as free because the ledger is closed. So an operation nobody has
swept reports `bitsErasedPpm = None` — not `0` — and every caller that folds it into a ledger has to
decide in the open. Five rows are `Unmeasured`, each with a written reason:

- **the storage medium after an unlink** (`DiskDeltaLog`, `DiskBackingStore`,
  `DiskAsyncBackingStore`) — journals, SSD block remapping, snapshots and backups are outside
  anything a sweep inside the process can observe, and the swallowed `try ... with _ -> ()` on the
  delete means even the unlink is not guaranteed.
- **`WitnessDurableBackingStore.Release`** — the store has exactly one reachable state because
  `Save` raises, so a sweep has a one-point domain and **cannot fail**. Declaring it `Reversible`
  would have been a vacuous pass wearing evidence's clothes. This is §3 applied to our own pack.
- **`GiftOfErasure.forget`, with respect to the process heap** — and this is the row that matters
  most, because it is the one module whose entire *purpose* is that the preimage be unrecoverable.
  `AnonymitySet` is an immutable value; `forget` returns a *new* one and cannot reach the old. **If
  the caller still holds the pre-state, nothing has been forgotten.** Erasure there is a property of
  the caller's reachability graph, which no sweep inside the function can see. Recording it as zero
  would let a ledger certify a forgetting that never happened.

`GiftOfErasure.mix` is separately `Erasing` (fibre 6, 2.585 bits): every permutation of a batch
lands on one canonical set, so **destroying arrival order is the mechanism, not a side effect** — a
position that carried information would be the silhouette a later erasure could not hide behind.
§11i noted `mix` charges nothing; it now declares, and the declaration is measured.

### 12g. What was NOT done, and why

**No entropy charge.** `algebra/entropy-tracker.ts` is untouched. This work classifies; metering is
a separate decision with its own review, and coupling them would have made a wrong classification
expensive to unwind. The distinction is worth keeping for a second reason visible in 12a and 12d:
two of the rows moved in the *opposite* direction from the intuition that motivated the thread, and
a meter wired to the intuition would have been charging for months.

**§11f's demon is untouched.** `Heat.fs:285` `dispositionOfKind` still reads
`denied-list.compacted` and `rejection-sampler.evicted` as free. That is a charging decision and
belongs with the metering work, not here.

### 12h. Still unknown, still not "fine"

- The Rust / C# / Q# oracles are unclassified (§11h's Bloom/CountMin entry, unchanged).
- Production `k` in the DHT, id-space collisions at full width, and any future bucket-splitting
  policy are outside the pinned model, which is named in each row's `model` string rather than
  glossed.
- Whether squash-merge destroys the preimage in this repo's configuration (§11h) — unchanged.

**Falsifier for this section:** exhibit an operation in `src/Core` that destroys a preimage, is
reachable from a shipped code path, and is neither declared nor caught by the drift guard. Or:
exhibit a declared row whose class disagrees with what a sweep of its own representation measures —
which is exactly the check the law packs run, so the honest form of this falsifier is *find a site
the drift guard's interface list does not reach.*

## 13. The CHARGE side (2026-08-19) — §12g's deferral taken up, and what it does with `Unmeasured`

§12g deferred exactly one thing: *"No entropy charge. `algebra/entropy-tracker.ts` is untouched.
This work classifies; metering is a separate decision with its own review."* That decision is taken
here. It is deliberately **narrow**, because §12g's reason for deferring was good: two of §12's rows
moved in the *opposite* direction from the intuition that motivated this thread, and a meter wired
to an intuition would have been charging for months.

### 13a. The rule: the classification IS the charge, and there is no second list

`src/Core/ErasureCharge.fs` (and its TypeScript oracle `algebra/erasure-charge.ts`) folds an
`ErasureClass.Profile` into a disposition, reading **`Classification` and `Evidence` only**. It
never inspects `Representation`, `Operation`, or `Observation`, and it holds no table keyed by name.

That restriction is §11b/§11i made mechanical rather than aspirational. A name-keyed list of erasing
operations was written twice in this document and was wrong twice, and cannot be completed in
principle, because `TruncateAsync` is `Erasing` under `InMemoryDeltaLog` and `Reversible` under
`GitDeltaLog`. **A second list is the defect**, so the charge is derived from the first one. Both law
packs pin this by renaming all three string fields of a real profile to garbage and requiring the
disposition to be unchanged — a name-based special case fails the moment it is added.

Four dispositions, and only the first is free:

| disposition | reached from | ledger effect |
|---|---|---|
| `Free` | `Reversible` **backed by a measured fibre of 1** | nothing — Bennett |
| `Charged ppm` | `Erasing` backed by a sweep, `ppm > 0` | the declared, measured bits |
| `Unmeasured reason` | `NoAdmissibleMeasurement` with a written reason | a **hole**, never a zero |
| `Malformed complaint` | a declaration at war with its own evidence | a hole — **fails closed** |

`Malformed` is the case that did not exist before. A profile claiming `Reversible` over a fibre of 4
is not free and is not measured; it is broken, and charging it `0` would be the closed-ledger free
lunch arriving through a data-entry error rather than through a missing meter.

### 13b. `Unmeasured` charges nothing and is not free — the type is what enforces it

Three treatments were available, and the middle one is the trap:

| option | verdict |
|---|---|
| charge `0` | §2's demon exactly — a channel that reads as free because the ledger is closed |
| charge a stated upper bound | **there is none to state without inventing a coefficient**, which is the toy-presented-as-metered failure this whole thread exists to prevent |
| refuse the fold, and carry the hole **in the total's type** | taken |

So a settled account is a `Reading`, and a `Reading` is `Complete bits` or
`LowerBound (bits, holes)`. There is **no function in either implementation that returns the bit
total as a bare number** — `readingParts` returns the pair, `readHeat` returns the flag beside the
figure — so a caller cannot obtain a total without also learning whether it is the whole cost. That
is `ErasureClass.bitsErasedPpm` returning `int64 option` rather than `0L`, moved to the place where
a total is actually formed.

A `LowerBound` is also the physically correct direction: Landauer's `kT ln 2` is a **floor**, so *"at
least this much, plus N operations of unknown cost"* is a true statement about the world, whereas any
specific larger number would be a guess wearing an instrument's clothes.

**Measured-zero and unknown are now different values.** `GroupCommitDiskDeltaLog`'s no-op truncation
reads `Complete 0`; an undeclared backend reads `LowerBound (0, [hole])`. Before this they were both
"nothing happened."

### 13c. Bits are never summed across observations

§12b established that one representation's one operation can carry opposite classes under two
observations and both be honest. The charge honours that structurally: an `Account` is keyed by
observation, `Readings` is a list, and **there is no operation that collapses it to one number**. A
sum across observations would describe no observer.

### 13d. The wired site: `RecoverableSpine`, which §11e named as charging nothing

> *"`RecoverableSpine.fs:74` (`TruncateAsync … // GC the absorbed tail`) is the one genuine
> snapshot-supersedes-log site and charges nothing."* (§11e)

It charges now, and at the class the **injected** backend declares — the same code path, three
different bills:

- over `InMemoryDeltaLog`: `Complete 3_700_440` ppm per truncation (fibre 13);
- over `GroupCommitDiskDeltaLog`: `Complete 0` — a **measured** zero;
- over a backend implementing no `IErasureDeclaring`: `LowerBound (0, [hole])`, the hole naming the
  undeclared backend. This is the drift guard at runtime, where a reflection test over our own
  assembly cannot reach a caller-supplied type.

The fold is charged separately and on a different cadence — **every commit**, not every snapshot —
which is §11a's headline (the bits are in the ordinary arithmetic) expressed as an accumulating
figure rather than as a sentence.

### 13e. Witness-correlation formation: a hook and a declared hole, not a number

§7e worried that the ledger might meter compaction but not witness-correlation formation. §11i
corrected that to *"it meters **neither**, so the antecedent is false and the worry was understated
rather than validated."* Half of that is now closed and the other half is **named rather than
filled**, which is the honest order.

`WitnessCorrelationErasureDeclaration` declares `QuorumAlgebra.join` — the formation step, where
independent sources become one correlated quorum — with **two rows for two questions**:

1. **The marginal cost, MEASURED.** `join` is idempotent and commutative, so arrival order and
   contribution multiplicity are gone from the result. Swept over a bounded 2-source/2-value model:
   fibre 3, `1_584_963` ppm. *Idempotence is erasure* — the same finding `IBackingStore.Save`
   produced in §12d from an unrelated direction.
2. **The conditional cost, UNMEASURED and written down.** The quantity §7c's result runs on is
   `H(A|B)` — the cost of erasing given the side information a correlated witness retains (del Rio
   et al., Nature 474:61–63, 2011). The repo states its own gap at
   `algebra/erasure-derivation.ts:49`: the finer figure *"requires modelling caller-retained side
   information, which the two-ledger tracker does not carry."* There is no upper bound to charge
   that would not be an invented coefficient, so the fold **refuses** the row and reports it as a
   hole. Folding both rows yields a `LowerBound` whose named hole is the conditional.

Declaring the conditional `Unmeasured` is not a dodge, and the structure is what shows it: **row 1 is
swept.** The declaration does not use `Unmeasured` to avoid measuring something measurable; it uses
it for the one observation this substrate has no instrument for. That distinction only exists because
`(Representation, Operation, Observation)` is the key — §12b's lesson paying out again.

`entropy-tracker.ts` gains the missing third door for the same reason: it had `measure(k)` and
`permutation()` and **no way to say "unknown"**, so a caller facing an unswept operation had to pick
between an invented number and a silent zero. `unmeasured(reason)` moves no bits, records the hole,
and makes `chargeComplete` false thereafter.

### 13f. Verified by mutation, both directions, both oracles

- **A self-consistent mis-declaration.** `InMemoryDeltaLog.TruncateAsync` flipped from
  `Erasing`/fibre 13/`3_700_440` to `Reversible`/fibre 1/`0` — internally coherent, so no
  well-formedness check can catch it. **4 tests red**: three in the classification pack (declared
  vs measured, both directions, plus the spine-inheritance pin) and one in the charge pack (the
  spine's bill changed). Reverted.
- **The demon itself.** `dispositionOf` rewired so `Unmeasured` returns `Free`. **6 F# tests red**
  and, applied to the TypeScript twin, **5 red**. Reverted.

Both mutations were run against `origin/main` at `9ffc0e9884`, and `dotnet build -c Release`
(0 warnings) plus `dotnet test Zeta.sln -c Release` (5444 passed) are green with them reverted.

### 13g. What was NOT done — the edges, stated

- **`SybilBft.decide`, `Consensus`, and `TravelerRankLedger` are still unclassified and uncharged.**
  Their marginals are sweepable; this work does **not** pretend otherwise by declaring them
  `Unmeasured`, it simply does not cover them. Tracked as `081M0CP6V2N087G0R001P6SJ7C`.
- **`GiftOfErasure.mix` declares (since §12f) but nothing posts it at runtime.** `AnonymitySet` is an
  immutable value and threading a ledger through it changes a heavily-tested shape, so the charge is
  available to any caller and wired into none. Same work item.
- **§11f's demon is untouched.** `Heat.fs:285` `dispositionOfKind` still reads
  `denied-list.compacted` as free. It is a different ledger (shed disposition, not bits) and the
  file already carries a declared-field escape hatch; conflating the two would be the lifecycle
  taxonomy error one more time.
- **The Rust / C# / Q# oracles remain unclassified** (§11h, §12h — unchanged).

**Falsifier for this section:** exhibit a `Reading` that is `Complete` while some posting behind it
was unmeasured, or a code path that obtains an erasure bit total without the completeness flag. Or:
exhibit a declared row the charge fold treats differently from the way `Erasure.Representation.Laws`
measures it.
