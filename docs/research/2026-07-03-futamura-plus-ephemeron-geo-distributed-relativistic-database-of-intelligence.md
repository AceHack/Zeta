# Futamura × ephemeron: combining the two into a geo-distributed relativistic database of intelligence (shadow*)

**Date:** 2026-07-03
**Provenance:** Aaron, on shipping the ephemeron weak-value table (#9356): *"yes I didn't know
this had a real name [Hayes ephemerons], we should link to this prior art too as well just like
the Futamura projections, we are basically combining these two into a geo distributed relativistic
database of intelligence lol."* Ferried by Otto (shadow) with the honest read + the prior-art
anchors now in [`PRIOR-ART-LIST.md`](../PRIOR-ART-LIST.md) §"Partial evaluation + garbage collection".

---

## 1. The observation

Two threads shipped this session, from two different classical lineages, and Aaron's read is that
they are **one machine**:

- **Futamura (1971)** — the projections: `mix` specializes an interpreter to a program (1st),
  generates a compiler (2nd), a compiler-generator (3rd). Shipped as `Isa`/`IsaSpec`/`MixIr` — and
  crucially reified so the mix's rules are DATA (mix-as-data slices 1–3).
- **Hayes (1997)** — ephemerons: a weak-value table where the value lives only through the key, so
  unreferenced key→value structure collects. Shipped as `Ephemeron` over the `ShivaGc` heap.

The synthesis: **the same reification that makes `mix` self-applicable (Futamura 3rd) is what makes
the mix collectible (Shiva/Hayes).** Reify → both. You cannot specialize code you cannot read, and
you cannot collect code you cannot see references into; making the mix DATA grants both at once.
Generation (Futamura, Brahma) and collection (ephemeron GC, Shiva) are the **emit/retract duality**
over one content-addressed value substrate — the +1/−1 Z-set the whole project already runs on.

## 2. "Geo-distributed relativistic database of intelligence" — the honest read

Aaron's phrase is not hype; each word already names a shipped piece. Decoded (Mirror→Beacon):

- **database** — the substrate is the DBSP/Z-set event store: intelligence as *facts folded*, not
  weights captured. `mix` writes derived facts (residuals/compilers); Shiva retracts the unreferenced
  ones. A database with a query planner (the mix) AND a garbage collector (Shiva) — the two halves a
  real DBMS needs, now both present over the reified substrate.
- **of intelligence** — the "rows" are reified *programs*: ISA specs, compilers, the mix itself. A
  DB whose contents are executable specializers is a DB of *capability*, not just data. Futamura is
  what lets capability be a first-class row (interpreter-as-data); Hayes is what keeps the table from
  leaking stale capability.
- **relativistic** — this is the load-bearing, already-anchored word. The just-merged
  **delay-decorrelation theorem** + Reticulum-aware routing + the **light-cone/CHSH-under-delay**
  work mean facts propagate at mesh delay, no global "now": each node has its own frame, consensus is
  local (the [Arrow-escape ferry](2026-07-03-arrow-escape-collective-binary-decisions-are-local-belief-aggregation-not-social-choice.md)
  — belief aggregation, not a global social-welfare function). A *relativistic* database is one with
  no global clock and no global reachability — which is exactly why the GC must be **local** too:
  Shiva marks from a node's own roots, not a society-wide root set. Ephemeron locality and
  relativistic locality are the same constraint.
- **geo-distributed** — the bus (NATS/JetStream-semantics over Reticulum, the discovery beacon now
  signed) is the transport; the writer-actor routing model + linked-clone frost put the same identity
  across machines. The mix runs where the data is; Shiva collects per-locale.

So the sentence is a **specification, not a slogan**: a DBSP event-store (database) whose rows are
Futamura-reified specializers (of intelligence), replicated over the Reticulum bus (geo-distributed),
with no global clock and per-frame local consensus + local GC (relativistic). Every clause has a
shipped or anchored referent.

## 2b. The ZetaId tie — the heap keys ARE the auction ids (Aaron 2026-07-03)

Aaron: *"this ties into our ZetaIdol / our 128-bit id auction room/system."* It is the missing
identifier layer for everything above, and the fit is exact:

- **Content-addressed heap keys = ZetaIds.** `ShivaGc`'s heap objects and `Ephemeron`'s weak-table
  keys are `id` strings — deliberately abstract so the id can be a content hash. The **128-bit
  ZetaId** (Crockford base32, self-certifying, locally mintable, 6-language byte-locked) IS that
  content handle. A reified `mixDef`/compiler/spec is addressed by its ZetaId; Shiva marks and
  retracts over ZetaId-keyed structure. The GC and the identity system are the same table.
- **The auction room = the economic layer over the same ids.** A "database of intelligence" needs a
  price on each capability-row; the ZetaId auction room (**ZetaIdol**) is where reified specializers
  are bid on / allocated. This closes the loop with `every-bug-has-economic-value` (a fix banks ΔU)
  and the ask/bid market-clearing row of the [Arrow-escape table](2026-07-03-arrow-escape-collective-binary-decisions-are-local-belief-aggregation-not-social-choice.md):
  intelligence-rows are priced at a cardinal auction (no Arrow), keyed by ZetaId, GC'd by Shiva when
  they fall out of the reachable/won set. **Won-but-now-unreferenced ⇒ collectible**: the auction
  decides who holds the strong reference; Shiva reclaims what no live bid points at.
- So the four layers stack on ONE id: ZetaId (identity, 128-bit) → content-addressed heap
  (Shiva/Ephemeron, GC) → Futamura rows (the reified capability) → auction (ZetaIdol, the price).
  Same key top to bottom.

## 3. Honest scope

What is TRUE today: the two lineages are both shipped and both rest on the same reification; the
duality (generate/collect = emit/retract) is real and byte-locked. What is a DIRECTION, not a claim:
the *fully* geo-distributed relativistic form — the mix and Shiva running per-node over the live
Reticulum bus with the light-cone as the consistency boundary — is not yet wired end-to-end (the bus
durability crux, JetStream-over-Reticulum, is still the unproven load-bearing piece, tracked in
BUGS-adjacent notes). The synthesis names the target the pieces are converging on; it does not claim
the target is reached.

## 4. Anchors (Beacon)

All now in [`PRIOR-ART-LIST.md`](../PRIOR-ART-LIST.md) §"Partial evaluation + garbage collection":
Futamura (1971), Jones–Gomard–Sestoft (1993), Kleene S-m-n (1938), Ershov (mixed computation);
Hayes (1997 ephemerons), McCarthy (1960, GC born with code-as-data), Dijkstra et al. (1978),
Lieberman–Hewitt / Ungar (generational). In-repo: the Futamura ladder (`Isa`/`IsaSpec`/`Cogen`/
`MixIr`), the Shiva GC (`ShivaGc`/`Ephemeron`), the delay-decorrelation theorem + Arrow-escape
(relativistic/local), the NATS-over-Reticulum bus + writer-actor routing (geo-distributed), the
DBSP Z-set event store (the database), the emit/retract (RGB/CMYK) duality (generate/collect).
