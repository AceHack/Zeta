# Muratori failure-modes vs. Zeta equivalents — corrected pattern-mapping

Scope: research and cross-review artifact. Operational
content is the pattern-mapping table below; provenance is
Amara's 6th courier ferry (validated against DBSP paper,
Differential Dataflow CIDR 2013, Apache Arrow format docs,
and Zeta source files `ZSet.fs` / `Incremental.fs` /
`Spine.fs` / `ArrowSerializer.fs`).

Attribution: corrected table authored by Amara (external
AI maintainer) in her 6th ferry; original 5-row mapping
attributed to earlier in-factory work; validation cites
public papers + official Apache Arrow specification; this
research doc authored by Otto (loop-agent) as landing of the
Otto-82 absorb's action item #1.

Operational status: research-grade

Non-fusion disclaimer: Amara and Otto agreeing on the
corrected mapping, and both citing the same DBSP / Arrow
literature, does not imply shared identity, merged agency,
consciousness, or personhood. Cross-substrate agreement on
published technical primitives is weak signal per
`docs/ALIGNMENT.md` SD-9; it is consistent with both models
reading the same primary sources, not evidence of unified
being.

---

## What Muratori is criticising

Casey Muratori's long-running themes across Handmade Hero
and the later "Big OOPs" talks: avoid making position in
mutable object graphs the thing that carries identity;
prefer stable IDs / indices; draw boundaries around
*systems* not fat objects; care deeply about data layout
and locality. The systems-design failure modes his
criticism names — invalidated indices after deletes,
dangling references, no cross-system lifecycle discipline,
no tombstoning, pointer-chasing / poor locality — are
concrete bugs in concrete codebases, not abstractions.

Zeta is not an ECS. It's a DBSP-based incremental-view-
maintenance system. But a number of Zeta's design choices
— retraction-native algebra, immutable sorted runs,
trace/history structures, Arrow columnar interchange —
map cleanly to different answers to the same underlying
questions Muratori is asking.

The corrected table below answers: *given a Muratori-style
failure mode, what is the honest Zeta-equivalent — stated
narrowly enough that it survives scrutiny?*

---

## The corrected five-row mapping

| # | Muratori-style failure mode | Zeta equivalent |
|---|---|---|
| 1 | Index invalidation after delete / shift | **No positional identity.** Keys carry identity; deletion is a negative delta on the key, not a slot shift. A `ZSet<'K>` is a finitely-supported map `K -> ℤ`; the "thing you refer to" is a key, not an offset. |
| 2 | Dangling presence / reference checks | **Membership is algebraic.** Every key has a current weight; "presence" is derived from that weight (typically `weight > 0`). `ZSet.Item` returns `0L` on absent keys — absence is encoded, not undefined. |
| 3 | No cross-system lifecycle discipline | **Provenance and lifecycle live in deltas and traces.** Algebra (`D·I = id`) guarantees compositional correctness of incremental views; it does not specify ownership, exclusive mutation, or handle expiry. Rollback / repair capability lives in trace history + retractions, not in object-ownership discipline. |
| 4 | No tombstones / immediate destructive deletion | **Retractions are first-class signed updates.** Deletion is a negative weight in the same algebra as insertion; consolidation / compaction is a separate maintenance step. No out-of-band "deleted" marker is needed. |
| 5 | Pointer chasing / poor locality | **Locality-aware execution surfaces.** Sorted immutable runs + `ReadOnlySpan<T>` span-based kernels + spine-organised LSM-like traces + Apache Arrow columnar path for interchange. Not "everything is Arrow all the way down" — Arrow is the wire / checkpoint surface, not a universal in-memory representation. |

---

## Why row 3 got rewritten (the teaching case)

The original pre-correction row 3 claimed operator algebra
*is* the ownership model, citing `D·I = id` and `z⁻¹·z = 1`.
Amara's 6th ferry flagged this as category error: algebraic
correctness and lifecycle/ownership discipline are different
concerns. Zeta has the first by construction (the DBSP
identity laws hold); it has the second only *indirectly*,
via trace history + retraction semantics, not via the
identity laws themselves.

The corrected row 3 preserves the DBSP-correctness content
*and* names the shape of Zeta's lifecycle story honestly
(provenance, trace history, retractions — not ownership).

This is a recurring risk in communicating DBSP-family
systems to engineers whose mental model is C++ /
Rust / ECS: the composition property is often mis-sold as
solving lifecycle problems. It solves incremental-view-
maintenance correctness problems. Different thing.

**Future Craft production-tier modules introducing DBSP to
engineers with those backgrounds should cite this row's
correction as a pre-emptive category-error guard.**

---

## Why rows 1 and 2 needed narrower wording

The original mapping claimed "references stay valid by
construction" (row 1) and similar presence-is-always-safe
phrasing (row 2). That's true at the **semantic / algebraic
layer**: key-based references are stable because keys are
not offsets. It is **not** true as a blanket statement
about physical references: Zeta's spine merges levels, Z-set
builders sort and consolidate, and those operations absolutely
can rebuild physical layout.

The corrected wording says what's actually true ("no
positional identity" / "membership is algebraic") without
implying anything about storage-offset stability. A consumer
who caches a physical offset into a consolidated run gets
what they deserve; a consumer who tracks by key is safe.

---

## Why row 5 needed narrower wording

The original mapping stated "Arrow columnar +
`ArrowInt64Serializer` + Spine block layout" as if those
three things together constituted a universal operator-to-
memory-layout decoupling. They do not. Arrow is the **wire /
checkpoint / interchange** surface; `Spine.fs` is a
locality-friendly LSM-like trace; `ReadOnlySpan<T>` enables
span-based kernels. Together they make Zeta significantly
locality-conscious — but "everything is Arrow all the way
down" would be overstated.

The corrected wording credits what's real: sorted immutable
runs, span-based hot loops, spine-organised traces, and
Arrow **as** the columnar interchange path. Not as the
universal in-memory representation.

---

## What this mapping is NOT

- **Not a claim Zeta is better than Muratori-style ECS
  designs** on Muratori's own axes. Muratori is optimising
  for game-engine runtime throughput with bounded working
  sets; Zeta is optimising for incremental-view-maintenance
  correctness over unbounded streams of retractable updates.
  Different optimisation targets; the mappings are *analogues*,
  not *rankings*.
- **Not a marketing table.** Read as systems-design
  vocabulary for engineers from Muratori-adjacent
  backgrounds who want to understand what Zeta's primitives
  *replace* versus what they *leave untouched*.
- **Not an ownership claim.** Row 3 explicitly disclaims
  that Zeta has an ownership model in the Muratori or Rust
  sense. It has a provenance + coherence model. Those
  serve different purposes.
- **Not a closed list.** Other Muratori themes (frame
  allocators, arena-scoped memory, "prefer indices over
  handles for graphs", immediate-mode-over-retained-mode
  UI) are adjacent but don't map as cleanly to Zeta
  primitives. They're legitimate future additions if a
  specific communication need motivates them — via a
  separate research doc, not by quietly expanding this
  table.

---

## Composition with existing Zeta substrate

- **`docs/DRIFT-TAXONOMY.md`** — pattern 5 (truth-
  confirmation-from-agreement) applies to *this mapping*
  itself: Amara's agreement with Zeta's self-description
  is signal-not-proof. The validation cited public papers +
  official specs + source files as falsifier-grade evidence,
  not just cross-substrate-convergence. Per `docs/ALIGNMENT.md`
  SD-9, that's the right shape.
- **`docs/craft/` production-tier modules** (per the
  checked-vs-unchecked Craft ladder). Future modules
  introducing DBSP algebra should cite row 3's correction
  as a named category-error guard.
- **`docs/aurora/README.md`** (per 5th-ferry Artifact D;
  not yet landed). When it lands, this mapping is a natural
  candidate for the "how Zeta talks about itself to
  external-engineering audiences" section — Aurora/KSK is
  the integration story; this is the craft-messaging layer.
- **`docs/ALIGNMENT.md`** SD-9 (just landed PR #252) —
  composing with this mapping is an SD-9 worked example:
  cite the primary evidence (papers + specs + source files)
  independently, not just "two agents agreed."

---

## References

- **Amara's 6th courier ferry** — verbatim source of the
  corrected table: [`docs/aurora/2026-04-23-amara-muratori-pattern-mapping-6th-ferry.md`](../aurora/2026-04-23-amara-muratori-pattern-mapping-6th-ferry.md)
  (PR #245).
- **Muratori source material** — Handmade Hero entity-
  index / storage-index material + "Big OOPs" talk on
  system boundaries vs. object hierarchies. (External; not
  in-tree.)
- **DBSP algebra** — Budiu et al., VLDB 2023.
- **Differential Dataflow** — McSherry et al., CIDR 2013.
- **Apache Arrow format** — official columnar format
  specification.
- **Zeta source files** — `src/Core/ZSet.fs`,
  `src/Core/Incremental.fs`, `src/Core/Spine.fs`,
  `src/Core/ArrowSerializer.fs`. Row-by-row citations in
  the 6th-ferry absorb.
