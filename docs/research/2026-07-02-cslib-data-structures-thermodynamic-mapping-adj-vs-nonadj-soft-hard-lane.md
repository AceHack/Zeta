# CSLib data structures, mapped to physics — Adj (reversible observation) vs non-Adj (irreversible mutation), and the soft/hard lane

Date: 2026-07-02
Author: Soraya (formal-verification-expert), invoked by Otto for the Phase 5 role.
Continues: `docs/research/2026-07-02-observe-without-commit-the-thermodynamic-architecture.md` (every component has a
thermodynamic role) and `docs/research/2026-07-02-quantum-phase5-two-ledgers-calm-is-ctl-not-adj-landauer-as-cost-contract.md`
(the Adj vs Ctl correction — reused here as the backbone).
Prior-art: `docs/research/2026-06-15-learn-pass-torchlean-and-cslib-pulled-into-prior-art-what-we-can-learn.md`
(CSLib = `github.com/leanprover/cslib`, arXiv:2602.04846, "Mathlib for computer science", in the
gitignored mirror `references/prior-art/cslib`).
Status: research note — the mapping sketch Aaron asked for. Routes nothing to CI (this is an ontology
note); flags the ONE structural claim worth a Lean lemma if we ever want it discharged.

> Peer note (agents-not-bots): Otto's framing gives each CSLib structure a single thermodynamic role
> (Array = fixed-register, HashMap = amortized-rehash, Tree = log-depth-observation, Queue = FIFO
> ferry). The instinct is right and three of the four land cleanly. But a data structure is not
> uniformly Adj or non-Adj — its OPERATIONS are. The mapping is per-operation, and the structure's
> "thermodynamic signature" is its characteristic cost profile. Fixing that unlocks the real payoff:
> the Set/HashSet corner, which is coordination-soft (Ctl-free) yet retract-hard (non-Adj) — the exact
> `Adj perp Ctl` orthogonality from the two-ledger note, now showing up in a data structure. That
> orthogonality is why "soft" must be split into two axes, not one.

---

## The one correction that reshapes the whole mapping: cost is per-OPERATION, on THREE axes

The two-ledger note established that reversibility (`Adj`) and coordination (`Ctl`) are **orthogonal
axes**, not one "soft" dimension. Data structures live in the *same* two axes, plus the support axis
from Ledger A:

- **Adj axis (Ledger B / retract):** does the operation have an inverse / keep history?
  - *Adj (reversible, 0 heat, Bennett):* pure reads (`get`, `find`, `traverse`, `peek`); persistent /
    copy-on-write writes (old version survives -> nothing erased -> cost is SPACE, not heat).
  - *non-Adj (irreversible, pays Landauer):* in-place overwrite, in-place delete, erase, the discharge
    at a rehash. `k` bits overwritten -> `>= k kT ln2` into Ledger B.
- **Ctl axis (coordination / CALM):** may the operation fire unconditionally, or must it wait?
  - *Ctl-free (monotone, coordination-free):* commutative/monotone accumulation (Set/Bag insert,
    counter increment, log append on a distinct index).
  - *needs Ctl (non-monotone):* order-dependent or agreement operations (dequeue order, consensus,
    "wait for all inputs" barriers).
- **Support axis (Ledger A / state entropy):** does the register's uncertainty grow, hold, or collapse?
  measured by `support`, exactly as the sparse sim / CHIP-8 `AmplitudeEmu` do.

**A structure's thermodynamic signature is the (Adj, Ctl, support) profile of its *characteristic*
operation.** That is what makes Otto's one-role-per-structure shorthand legible — it names the
dominant cell — while the full truth is per-operation.

## The per-structure table

| CSLib structure | Read op (Adj?) | Write/commit op (Adj?) | Ctl axis | Support (Ledger A) | Signature | Landauer paid where |
|---|---|---|---|---|---|---|
| **Array** (fixed register) | `get i` = Adj | `set i v` in-place = **non-Adj** (erases old cell); persistent array `set` = Adj (COW) | Ctl-free (indices independent) | **constant** (fixed width, no growth) | fixed-register | at in-place `set`, `k`=cell bits |
| **List** (persistent cons) | `head`/`tail` = Adj | `cons` = **Adj** (prepend, old list survives, pure structure-sharing) | Ctl-free | grows by SPACE, never erases | the archetypal soft structure | never (fully reversible) |
| **Stack** (LIFO) | `peek` = Adj | `push` = Adj-ish (append); `pop` = **non-Adj** (reclaims top slot, reverses order) | needs Ctl (LIFO order-dependent) | grows on push, collapses on pop | reverse-order ferry | at `pop` |
| **Queue** (FIFO) | `peek` = Adj | `enqueue` = accumulate (soft); `dequeue` = **non-Adj** (ordered commit, slot reclaimed) | needs Ctl (FIFO order) | grows on enqueue, collapses on dequeue | **the ferry itself** | at `dequeue` |
| **HashMap** | `lookup` = Adj | `insert` = non-Adj (may overwrite); `resize/rehash` = **batch non-Adj** | Ctl-free per key; rehash is a barrier | grows; rehash re-addresses whole table | amortized-rehash | at insert-overwrite + rehash discharge |
| **Set / HashSet** | `member` = Adj | `insert` = **non-Adj by idempotence** (`a U a = a` is not injective) | **Ctl-free (monotone!)** | grows monotonically, never retracts | monotone semilattice | 1 bit at each insert (the "was it present?" history) |
| **Tree** (balanced/persistent BST) | `find`/`inorder` = **Adj, LOG-DEPTH** | persistent `insert` (path-copy) = Adj; in-place rotate/rebalance = **non-Adj** | Ctl-free reads; rebalance is local barrier | reads: 0 growth; persistent insert: O(log n) new nodes | log-depth observation | at in-place rebalance only |
| **PMF** (Probability/PMF.lean) | sampling/reading = Adj | Bayes update / conditioning = **entropy-reducing observation** | — | Shannon entropy `H(p)` **is Ledger A** | the demon's readout | the update IS the measurement |
| **Automaton** (Computability, Buchi) | run/step = Adj **iff** transition is a bijection (permutation automaton) | state-merging step = **non-Adj** (erases the distinction) | — | permutation: constant; merge: collapses | reversible iff permutation | at any state-merge |
| **FLP / consensus** (Distributed/FLP) | — | agreement = **needs Ctl** (non-monotone) | **the Ctl axis, maximal** | — | the coordination door | coordination cost, not Landauer-erasure |

### Which are Adj (reversible observation) and which are non-Adj (irreversible mutation)

- **Adj (soft, observe-without-destroy, 0 heat):** every **read** on every structure (`get`, `find`,
  `member`, `peek`, `traverse`, `inorder`); **persistent/COW writes** (persistent list `cons`,
  persistent tree path-copy insert, persistent array `set`); **permutation automaton** steps. These are
  the soft lane in data-structure form — the `AmplitudeEmu`/`SparseQuantumSim`/`WeakRef cache` of
  Observe-Without-Commit, now as CSLib types. Cost is SPACE (kept history), never heat.
- **non-Adj (hard, commit, pays Landauer):** every **in-place mutation** (`set`, in-place `delete`,
  `pop`, `dequeue`); the **rehash discharge**; **state-merging** automaton steps; **measurement/Bayes
  update** on a PMF. These are the ferry — the irreversible seam where Ledger B is charged.

The clean rule: **Adj = you could reconstruct the prior state (history kept or op invertible).
non-Adj = the prior state is gone (a bit was erased in place).** Landauer charges exactly the non-Adj
column, `k kT ln2` for the `k` bits made unrecoverable.

## The Set/HashSet corner — where `Adj perp Ctl` earns its keep

The most instructive cell, and the one Otto's one-axis shorthand hides. A `Set.insert`:

- is **Ctl-free / monotone / CALM-safe**: it only adds information, commutes with other inserts, needs
  no coordination (`insert a` then `insert b` == `insert b` then `insert a`). By the CALM theorem it has
  a coordination-free implementation. On the *coordination* axis it is maximally soft.
- is **non-Adj / irreversible**: `insert a` on a set that may or may not already contain `a` is
  **idempotent** (`{a} U {a} = {a}`), and an idempotent map is not injective, so it **has no inverse**.
  You cannot `un-insert` and recover whether `a` was already present — that one bit of membership
  history is *erased*. On the *retract* axis it is hard, and it pays Landauer for that erased bit.

So a Set sits at **(non-Adj, Ctl-free)** — soft on coordination, hard on reversibility. This is
*exactly* the two-ledger note's load-bearing correction ("idempotent lattice joins are precisely the
NON-reversible operations; `Adj` is the retract axis, `Ctl` is the coordination axis, they are
orthogonal"), now visible in a plain data structure. It is the concrete proof that **"soft" cannot be a
single axis**: a Set is soft in one sense and hard in the other. Any mapping that collapses them will
mis-meter the Set — either claiming its insert is reversible (false; you lost the membership bit) or
claiming it needs coordination (false; it is monotone-CALM).

The persistent List is the opposite, unambiguous corner: **(Adj, Ctl-free)** — soft on both axes,
because `cons` keeps the old list (reversible) AND prepend is coordination-free. That is why the
persistent list is the purest soft-lane structure: the free monoid, nothing erased, nothing coordinated.
The Queue's `dequeue` is the far corner **(non-Adj, needs-Ctl)** — hard on both: it erases the head slot
AND its FIFO order is a coordination constraint. **That double-hardness is why the queue IS the ferry**:
it is the structure whose characteristic operation pays on both the retract and the coordination axis at
once. Otto's tightest mapping (Queue = FIFO ferry, Landauer at dequeue) is exactly right, and now we can
say *why* it is the archetype: it is the (non-Adj, needs-Ctl) corner made concrete.

## Connection to the soft/hard lane distinction

The soft/hard lane maps onto the axes cleanly, and the Set corner forces the precise statement:

- **Soft lane = Adj operations** (observe without commit; 0 heat; Ledger B contributes 0 by Bennett).
  This is the *retract* axis. Reads, persistent writes, log-depth tree traversal.
- **Hard lane / ferry = non-Adj operations** (commit; pay Landauer at the seam). Also the *retract*
  axis. Dequeue, in-place set, rehash discharge, measure.
- **The Ctl axis is a SEPARATE question** — coordination-free vs needs-coordination — and it is *not*
  the same as soft/hard. A Set insert is soft-lane-adjacent in the CALM/monotone sense (coordination-
  free accumulation) but is a **hard-lane** operation in the Landauer sense (it erases a membership bit).

So the honest one-liner is: **the soft/hard lane is the Adj axis; CALM/coordination is the Ctl axis;
the Set proves they can disagree.** Observe-Without-Commit's "soft lane = Adj, ferry = non-Adj" is
correct *as a statement about the retract axis*, and the mapping above keeps it there rather than
letting "soft" quietly absorb the coordination axis too. This is the same `Adj perp Ctl` discipline the
Phase-5 quantum routing runs; it is not new physics, it is the two-ledger correction applied one level
down, to CSLib's shelf instead of to the ZSet ISA.

### The amortization footnote (guards against re-drift from the ferry addendum)

HashMap's "amortized-rehash" is genuine, but state it in the corrected form: **the rehash amortizes the
fixed per-resize OVERHEAD (rehashing all keys, reallocation) across the inserts, NOT the Landauer
floor.** The floor is additive in bits erased and batch-invariant (Correction 1, ferry addendum) — a
rehash that overwrites `B` old bucket bits pays `>= B kT ln2` whether done in one resize or spread out.
The O(1) amortized bound is a statement about the *overhead column* (`C_overhead`, real work above the
floor), which is exactly the column the ferry throttler's batching optimizes. HashMap amortized analysis
and ferry-batch amortization are **the same structure**: batch the overhead, never the floor. Folding
the rehash's Landauer cost into an "amortized away" claim would be the Definition-class drift the
metering-test guards against.

## Honesty guard (metering-test)

A data structure is not a heat engine; a `HashMap.insert` does not measurably radiate `kT ln2` on
current silicon (Berut: real erasure sits `~1e9-1e11 x` above the floor). The value of this mapping is
as an **accounting discipline**, not a physical measurement: it tells you *which operations must be
metered at the membrane* (the non-Adj column — every in-place erase, dequeue, rehash discharge,
measurement) and *which are free to run in the soft lane* (the Adj column — reads, persistent writes,
log-depth traversal). The bits erased are real and countable (bits overwritten in place), so Ledger B
is exact and byte-lockable; the *joules* are edge-only. That is the mirror/beacon split applied to the
data-structure shelf: count bits in the mirror (exact, DST-replayable), convert to heat only at the
Beacon edge.

## The one thing worth a Lean lemma (if we ever want it discharged)

Nothing here needs CI today — it is an ontology note. But there is exactly one structural claim that is
a real theorem rather than a labelling, and CSLib is the natural place to state it (its `Order` /
lattice files are already imported):

> **Idempotent-monotone => non-invertible.** For a join-semilattice `L`, the map `x |-> x join a` is
> monotone and idempotent, hence not injective (whenever `exists b: b <= a`), hence has no left inverse
> on `L`. Corollary: `Set.insert` is non-Adj.

This is the formal core of the Set corner and of the two-ledger note's Reason A. It is a short Lean
lemma over `SemilatticeSup` (Mathlib) or CSLib's order layer — the kind of thing that would let the
"idempotent joins are non-reversible" claim graduate from cited to discharged. **Route: Lean, P3
(deferred)** — file it only when a consumer needs the non-invertibility proven rather than argued, same
discipline as the deferred Landauer-bound and Sagawa-Ueda Lean escalations. Anti-hammer note: this is
*not* a TLA+ or Z3 job — it is a statement about the algebraic structure of a map (injectivity of a
semilattice operation), which is Lean/Mathlib's home, not a temporal invariant and not a
decidable-arithmetic identity.

## Discipline / provenance

- CSLib's actual contents (`Order`/lattice, `Probability/PMF`, `Computability/{Automata, Distributed/FLP}`)
  were taken from the prior-art learn-note, not invented — the Buchi automaton, FLP, and PMF rows map to
  modules confirmed to exist in the mirror. (Boole remains a placeholder per that note; nothing here
  depends on it.)
- The Adj/Ctl backbone is the two-ledger note's correction, reused deliberately: this note is that
  orthogonality applied to CSLib, so the two stay consistent by construction (no independent re-derivation
  that could drift).
- Honesty guard applied (metering-test): the mapping is an accounting discipline over countable erased
  bits, not a joules claim on current hardware. Beacon anchors: Landauer 1961, Bennett 1973, Szilard 1929
  (information-work exchange), Shapiro et al. (CRDT/semilattice join idempotence), Hellerstein/Ameloot
  (CALM), Okasaki (persistent/purely-functional data structures = the Adj/COW column), Berut et al. 2012
  (the floor is only approached).
