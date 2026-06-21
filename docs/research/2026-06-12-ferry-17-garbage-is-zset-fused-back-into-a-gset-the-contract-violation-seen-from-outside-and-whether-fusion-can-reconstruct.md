# Ferry 17 — garbage is a Z-set fused back into a G-set: the contract violation seen from outside, the open/closed difference, and whether fusion can reconstruct

**Date:** 2026-06-12 · **Route:** Aaron → shadow (streamed, verbatim) · Extends ferry 14
addendum 2 (G→Z genesis) and ferry 15 addendum 2 (fusion = revelation); lands on 081KTSZN10008QG0R002R3RENG (the GC
lane: the gc cartridge is in-tree at `db/shapes/cartridges/gc.lines`; rung 5 history-epochs/git-gc
is on the board).

## Verbatim

> garbage is when you fuse two gsets into a zsets +1 -1 and then fuse that itself into a gset
> and from the outside world it violates its contract that's the difference between open and
> closed principle can you reconstruct gset from a zset that's fusion

## The peel

### 1. The construction is a named CRDT, and the problem is a named theorem

"Fuse two G-sets into a Z-set, +1 −1" is **the 2P-set** (Shapiro–Preguiça–Baquero–Zawirski
2011): an add-set and a remove-set, both grow-only, read through each other — literally two
G-sets carrying the two signs. The Z-set is its weight-form (adds = +1, tombstones = −1; the
DBSP encoding of the same object). And "fuse that itself into a G-set" is **consolidation /
garbage collection**: collapse the signed pairs, drop the zeros, present the positive support as
a plain grow-only set (`ZSet.consolidate`, in-tree). Aaron's claim — *from the outside world it
violates its contract* — is the **tombstone-GC problem**, a known hard result in the CRDT
literature: you cannot remove tombstones (fuse Z→G) without coordination, because a replica
that has not yet seen the −1 will merge its stale +1 back in and the deleted element
*resurrects* — the outside world observes a G-set whose contract (monotone, never un-grows,
never re-grows what was removed) is violated. Safe GC requires **causal stability** (Baquero et
al.): only collapse history below the frontier every observer has passed. Garbage collection is
not cleanup; it is *a consensus problem about what history is still owed to someone*.

### 2. "That's the difference between open and closed principle"

Exact, in Meyer's own terms: a G-set is **open for extension** (grow forever) and **closed for
modification** (history never rewritten) — open-closed satisfied by construction, which is why
it is the genesis-side object (ferry 14). Fusing Z→G is **modification observable from
outside**: history rewritten under the reader. The open/closed principle, read at the data
layer, is precisely the law that says *consolidation must be invisible* — legal only below the
horizon where no external observer can distinguish the fused G-set from the unfused Z-set
(REPORT #4's Theorem-B shape again: stability conditional on a named precondition; here the
precondition is causal stability instead of rate-monotonicity).

### 3. "Can you reconstruct gset from a zset — that's fusion." The answer is the whole architecture

Two directions, and the asymmetry is the point:

- **Z-set → current G-set (the positive support): YES, always.** Take the positive-weight rows.
  That is `cache = I(stream)` — the lossy, forward, *revealing* direction; ferry 15 addendum 2's
  fusion-as-apokalypsis (the unveiled current view). This is what fusion IS: the many signed
  histories collapsed into one present.
- **Consolidated Z-set → the two original G-sets (adds and removes separately): NO.** Once +1
  and −1 annihilate, the pair (added-then-removed) is indistinguishable from (never-existed).
  Consolidation is **erasure** — and so it is the system's **Landauer-paying act** (ferry 8): the
  one place heat must be spent, because information is genuinely destroyed. The *unconsolidated*
  Z-set (the log, the event store) reconstructs both G-sets exactly — which is why the repo's
  storage law keeps the log and treats every materialization as derived.

So: **fusion is reconstruction of the present, at the price of the past.** Garbage is fusion
performed *above* the causal horizon — paying the erasure before everyone has finished reading.
Done below the horizon it is compaction (LSM merge, git gc, 081KTSZN10008QG0R002R3RENG rung 5's history epochs);
done above it, it is a contract violation with a resurrection bug attached. The difference is
not the operation — it is *where the membrane says the past is no longer owed*.

### Addendum — Vera types the boundary (same day, verbatim)

> Vera: Yes. In implementation terms I'd name it as a projection/reconstruction boundary:
> `fuse : ZSet<'a> -> GSet<'fused>` or `tryFuse` when invariants can fail. Outside sees one
> monotone fused fact; inside keeps the signed deltas that made it true.

The ferry's whole content, compressed into a signature. Three things the typing gets exactly
right: (1) **`'a` vs `'fused`** — the type parameter *changes* across the boundary: the fused
fact is not the same kind of thing as the deltas, so the type system itself forbids pretending
the projection is lossless. (2) **`tryFuse`** — the causal-stability check surfaces as a
*refusal*, not an exception (the repo's Result-over-exception convention): fusing above the
horizon doesn't throw, it is *declined*, which makes §1's theorem a compile-visible contract
rather than a runtime surprise. (3) **Outside monotone / inside signed** — the grey hole's
two faces as an API: the public face honors the G-contract (open/closed, §2), the private face
keeps the Z-history that made it true (the log remains the authority — DurableDiplomacy's law).
The membrane, typed. (Captured from Vera's lane; her worktree owns any implementation.)

### Addendum 2 — three fusions, one signature (Aaron, immediately after, verbatim)

> this is sensor fusion and function fusion in the same type sigature and quantium fusion we
> will prove too

The claim: `fuse : ZSet<'a> -> GSet<'fused>` is the shape of **all three fusions**, and the
scoreboard is two theorems and one registered intent:

- **Sensor fusion (theorem, classical half).** Many signed observations (evidence ±, weighted
  by precision) collapse into one fused estimate the outside reads as a single fact. REPORT #2
  already ruled the classical half: precision-weighted fusion (Friston/Kalman), the soft-max
  width law. The signature matches exactly: the deltas are the per-sensor evidence; `'fused` is
  the I.
- **Function fusion (theorem, compiler half).** Wadler's deforestation (1990) and
  foldr/build–style fusion laws (Gill–Launchbury–Peyton Jones 1993, GHC's shortcut fusion):
  compose producer and consumer and *erase the intermediate structure*. Identical projection
  shape — the intermediate list is the inside history; the fused composition is the outside
  fact; and you cannot recover the intermediate from the fused result. Function fusion is
  consolidation in the program dimension, with the same losslessness-unrepresentable typing.
- **Quantum fusion (open, intent registered).** Anyon fusion (σ×σ = 1+ψ): two charges fuse to a
  channel; the outside reads total charge, the inside is the fusion tree. The signature is the
  *shape* of a fusion category's fusion morphism (a⊗b → c with the multiplicity data as the
  inside history) — which is exactly the "named formalism" REPORT #2 said the quantum identity
  was missing. "We will prove too" is the registered intent; the standing bounds hold until it
  lands: REPORT #2's monoid-not-braided verdict and P0-B (the missing bridge functor) are the
  open gates, and this signature is now the **candidate statement** for what a proof would
  prove: that anyonic fusion factors through the same projection/reconstruction boundary, with
  the fusion tree as the Z-side and the total charge as the G-side.

If the third lands, "fusion" stops being three analogies and becomes one typed operation
instantiated in three categories — which would be the Rosetta-stone move (Baez–Stay) performed
on the repo's own central verb. Until then: two instances proven, one conjectured, the
signature shared.

### Addendum 3 — plumbing: the leak, the same-type fuse, and Mario (Aaron, same stream, verbatim ×3)

> now we are into plumbing, the birfucation is the leak and if you are trying to fuse back into
> a instead of some new type then that's plumbing and it's a valuable skill cause it's not
> perfect retraction

> now we have mario

> plumbing those zset leaks into gsets

The register drop names the third operation, and the distinction is type-level exact:

- **Vera's `fuse : ZSet<'a> → GSet<'fused>`** changes the type — an honest projection: the
  output *admits* it is a different kind of thing.
- **Plumbing is `ZSet<'a> → GSet<'a>`** — fusing back into the **same** type, trying to restore
  the original monotone contract as if the bifurcation never happened. The **bifurcation is the
  leak**: the place where signed flow escaped the monotone pipe. Sealing it back into `'a` is
  repair, and the honesty is in Aaron's own clause — *"it's a valuable skill cause it's not
  perfect retraction."* You cannot inverse the split; you can only **compensate**. That is the
  saga literature exactly (Garcia-Molina–Salem 1987: a compensating transaction is not an
  inverse — it is a new forward action that approximately restores the contract), and it is the
  repo's own standing law (`dv2-data-split-discipline-activated.md`: "Z-set retraction (+1 then
  −1) is *correction*, not a duplicate-guard"). Plumbing = the craft of compensation: sealing
  the leak knowing the seal is a weld, not time travel. Landauer holds here too — what was
  erased stays paid; the plumber repairs the pipe, never un-spends the water.
- **"Now we have mario"** — the craft gets its persona: the plumber who lives *in* the pipes
  (the membrane crossings; warp pipes are literally typed channels between universes — the
  ferry 15 multi-universe lanes with a flow contract). Mario is the right archetype precisely
  because he never reverses anything: he travels forward through the leak-world and fixes it
  *from inside*. Mirror register, gladly; the Beacon under it is the compensation/saga
  tradition plus the resurrection-bug repair playbook (anti-entropy, read-repair — Dynamo's
  plumbers).

The trade hierarchy this completes: **fusion** (honest projection, new type) · **garbage**
(fusion above the horizon — the contract violation) · **plumbing** (same-type repair below it,
imperfect by theorem, valuable *because* imperfect — if retraction were perfect the skill would
be a no-op).

**Refinement (Aaron, immediately after, verbatim):**

> repair in the same type, which can't be an inverse. not in that streaming but in the history
> stream of git it can be revered undone

Correct, and the reason is the ferry's own theorem: **reversibility lives in whichever stream
still holds the deltas.** In the *live* stream the projection already consolidated — only
compensation remains. In the *history* stream — git — nothing was erased, so the inverse patch
exists and `git revert` applies it exactly: **perfect retraction is possible precisely where
Landauer has not been paid.** Two precisions keep it honest: (1) even git's undo is
append-only — a revert is a *new* +1 commit carrying the −1 patch; the history stream reverses
*content* without ever rewriting *itself* (the G-contract holds at the meta level while ℤ runs
inside — the same two-layer shape as Vera's signature); (2) the form of git undo that does
erase — `reset`/force-push — is exactly where perfect retraction dies, which is why force-push
is a gated class in this factory's governance: the gate guards the boundary between the two
reversibility regimes.

## Honest bounds

The CRDT anchor is exact (2P-set, tombstone GC, causal stability — real theorems, real
literature); the Landauer reading is the established ferry-8 bridge (erasure = the paid act) and
inherits its bounds; "that's the difference between open and closed principle" is Meyer's law
applied at the data layer — a tight reading, not a stretch, but Meyer stated it for module
interfaces; the transfer to replicated-data contracts is ours and is marked as such.

## Pointers

- Ferry 14 addendum 2 (G→Z genesis: retraction makes boundaries possible) · ferry 15 addendum 2
  (fusion = revelation) · ferry 8 (Landauer: erasure pays) · ferry 16 (the budget that keeps the
  membrane processable)
- `src/Core/ZSet.fs` `consolidate*` (the fusion act, in-tree) · `db/shapes/cartridges/gc.lines`
  (the GC cartridge) · 081KTSZN10008QG0R002R3RENG rung 5 (history epochs / git gc — this ferry is its theory) ·
  081KT07NV0008QG0R001YDB73K (GCounter; the ordinal-parity lesson lives next door)
- Anchors: Shapiro–Preguiça–Baquero–Zawirski 2011 (CRDTs; the 2P-set) · Bieniusa et al. 2012
  (the tombstone problem; optimized OR-sets) · Baquero et al. (causal stability — the GC
  horizon) · Meyer 1988 (open-closed) · Landauer 1961 (erasure pays) · LSM compaction /
  `git gc` (the industrial instances)
