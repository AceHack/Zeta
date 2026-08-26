namespace Zeta.Core.Sql

open Zeta.Core

// ═══════════════════════════════════════════════════════════════════════
//  `zeta { }` — the TYPED, EAGER front end over the ONE operator algebra.
//
//  STATUS: **unmetered** (`.claude/rules/toy-is-free-metered-must-be-earned.md`)
//  — implemented, used, and now pinned by a differential falsifier against
//  the `QuerySurface` eager interpreter and the `Circuit` batch lowering
//  (`QuerySurface.Equivalence.Tests.fs` §EAGER MODE). It is not `metered`
//  because no cost model or workload measurement stands behind it.
//
//  ── What changed, and why it was a defect and not merely duplication ──
//
//  This CE used to carry its OWN implementations of `where` / `select` /
//  `join` / `for`, built out of `Seq.filter`, `Seq.map`, `Seq.groupBy` +
//  `Map.ofSeq`, each ending in `ZSet(Pool.Freeze arr)`.
//
//  `ZSet`'s array constructor is documented as: *"Construct from an
//  already-sorted-by-key, nonzero-weighted run. Callers are responsible
//  for the invariant; use `ZSet.ofSeq` for arbitrary input."* The four
//  hand-rolled operators honoured neither half of it:
//
//    • `select` maps keys, so a NON-INJECTIVE projection emits the same
//      key twice. The Z-set algebra says those weights SUM; this returned
//      two separate entries. `ZSet.Item` binary-searches, `(+)` sorted-
//      merges, and `Equals` compares position-wise — so the result read
//      as a different Z-set depending on which operator touched it.
//    • the projected/joined array was left in INPUT order, not key order,
//      so `zset.[k]` (binary search) could miss a key that is present.
//    • weights that cancel to zero were retained, breaking the
//      no-zero-weight invariant every other `ZSet` producer maintains.
//
//  The fix is deletion, not repair: every operation below now delegates to
//  the SAME `ZSet.filter` / `ZSet.map` / `ZSet.join` / `ZSet.flatMap`
//  primitives that `Circuit.Filter` / `Circuit.Map` / `Circuit.Join` call
//  through `MapZSetOp` / `FilterZSetOp` / `JoinZSetOp` (`Operators.fs`).
//  Those primitives `sortAndConsolidate` their output, which is exactly
//  the invariant the hand-rolled copies dropped.
//
//  So `zeta { }` is no longer a second implementation of the relational
//  OPERATORS — it is a typed surface syntax over the one implementation.
//
//  ── What this is NOT, stated because the loose claim is false ────────
//
//  `zeta { }` does **not** build a `QuerySurface.ToyPlan`, does not use
//  `ToyExecutionMode.Eager`, and never calls `ToyEager.run`. There is no
//  reference to any of them in this file outside these comments, and a
//  `grep` should return exactly that.
//
//  An earlier draft of this header said the eager evaluation here "is the
//  third execution mode of the shared plan". That was an overclaim of the
//  kind this PR exists to remove, so it is struck. What is true and
//  narrower: **`zeta { }` remains its own eager evaluator over its own
//  typed representation; what it stopped duplicating is the operator
//  semantics.** `ToyExecutionMode.Eager` is the plan-level home for the
//  same capability, built on the same `ZSet.*` primitives — a sibling, not
//  a destination.
//
//  ── Why it is still SEPARATE from `ToyPlan`, and why that is right ───
//
//  `zeta { }` is generic in the row type and takes F# LAMBDAS
//  (`'T -> bool`, `'T -> 'U`). `QuerySurface.ToyPlan` is deliberately
//  CLOSURE-FREE over an erased `ToyRow`, and that closure-freedom is
//  load-bearing: it is the only reason two independently written front
//  ends can be compared for structural equality. A typed lambda cannot be
//  lowered into a `ToyScalar` without quotation splitting (see the
//  "Deliberately left out" section of the design doc).
//
//  So the two IRs are NOT merged, and merging them would destroy the
//  falsifier. What IS shared is one level below both: the operator
//  semantics, i.e. `ZSet.filter` / `ZSet.map` / `ZSet.join` /
//  `ZSet.flatMap`. The relationship is pinned by a test, not asserted
//  here — `zeta { }` over a `ToyRow` relation must return the
//  byte-identical Z-set that `ToyEager.run` returns for the corresponding
//  `ToyPlan`, which in turn must equal the `Circuit` batch lowering.
//
//  ── Anchors (Beacon) ────────────────────────────────────────────────
//  • Codd, "A Relational Model of Data for Large Shared Data Banks"
//    (CACM 1970) — select / project / join.
//  • Budiu, McSherry, Ryzhyk, Tannen, "DBSP" (VLDB 2023) — the Z-set
//    algebra these operators are the set-at-a-time instance of.
// ═══════════════════════════════════════════════════════════════════════

/// Represents a schema-typed relation (a materialized Z-set) in the Zeta
/// DBSP runtime. Construct with `Relation.ofSeq` / `Relation.ofKeys` —
/// they route through `ZSet.ofSeq`, which establishes the sorted,
/// consolidated, nonzero-weight invariant that `ZSet`'s raw array
/// constructor requires the caller to guarantee.
type Relation<'Schema when 'Schema : comparison> = { Stream: ZSet<'Schema> }

[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Relation =

    /// The empty relation.
    let empty<'T when 'T : comparison> : Relation<'T> = { Stream = ZSet<'T>.Empty }

    /// Wrap an existing Z-set. The `ZSet` invariant is the caller's, as
    /// always — but every `ZSet` PRODUCER in the codebase maintains it, so
    /// this is safe for anything that came out of `ZSet.*`.
    let ofZSet (z: ZSet<'T>) : Relation<'T> = { Stream = z }

    /// Build from arbitrary `(key, weight)` pairs. Sorts and consolidates.
    let ofSeq (pairs: ('T * Weight) seq) : Relation<'T> = { Stream = ZSet.ofSeq pairs }

    /// Build from keys, each at weight 1. Sorts and consolidates, so a
    /// repeated key becomes weight 2 (Z-set semantics, not set semantics).
    let ofKeys (keys: 'T seq) : Relation<'T> = { Stream = ZSet.ofKeys keys }

    let toZSet (r: Relation<'T>) : ZSet<'T> = r.Stream

/// Builder for the `zeta` query computation expression. Every operation
/// delegates to the shared `ZSet` primitive named in its comment; none of
/// them implements relational semantics of its own.
type ZetaQueryBuilder() =

    /// `for x in r do ...` — the monadic bind. Delegates to `ZSet.flatMap`,
    /// which scales each inner Z-set by the outer entry's weight and sums,
    /// consolidating collisions. The hand-rolled version multiplied weights
    /// into a flat `ResizeArray` and never consolidated.
    ///
    /// **Cost regression, disclosed:** `ZSet.flatMap` folds with
    /// `acc <- add acc (scale w (f k))`, and each `add` is a full sorted
    /// merge plus one array allocation. So this is O(N² · M) time and N
    /// allocations over N outer entries, against the deleted flat append's
    /// O(N · M) and one. Correct where the old one was not, and slower —
    /// both halves are true. `ZSet.sum`'s k-way merge is the fix when a
    /// workload needs it; nothing measured here does yet, and guessing at
    /// which is a `toy`-grade optimisation without a benchmark.
    member _.For(r: Relation<'T>, f: 'T -> Relation<'U>) : Relation<'U>
        when 'T : comparison and 'U : comparison =
        { Stream = ZSet.flatMap (fun k -> (f k).Stream) r.Stream }

    /// A single row at weight 1. `ZSet.singleton` rather than a hand-built
    /// one-element array.
    member _.Yield(x: 'T) : Relation<'T> when 'T : comparison =
        { Stream = ZSet.singleton x 1L }

    member _.YieldFrom(r: Relation<'T>) : Relation<'T> when 'T : comparison = r

    member _.Zero() : Relation<'T> when 'T : comparison = { Stream = ZSet<'T>.Empty }

    /// σ (selection). Delegates to `ZSet.filter` — the same function
    /// `FilterZSetOp.StepAsync` calls. Filtering a sorted run preserves
    /// sort order, so this was the one hand-rolled operator that happened
    /// to be correct; it still routes through the shared primitive so
    /// there is exactly one implementation to keep correct.
    [<CustomOperation("where", MaintainsVariableSpace = true)>]
    member _.Where(r: Relation<'T>, [<ProjectionParameter>] predicate: 'T -> bool) : Relation<'T>
        when 'T : comparison =
        { Stream = ZSet.filter predicate r.Stream }

    /// π (projection). Delegates to `ZSet.map` — the same function
    /// `MapZSetOp.StepAsync` calls — which `sortAndConsolidate`s, so a
    /// non-injective projection SUMS the colliding weights and drops the
    /// ones that cancel to zero.
    [<CustomOperation("select")>]
    member _.Select(r: Relation<'T>, [<ProjectionParameter>] projection: 'T -> 'U) : Relation<'U>
        when 'T : comparison and 'U : comparison =
        { Stream = ZSet.map projection r.Stream }

    /// ⋈ (equi-join). Delegates to `ZSet.join` — the same function
    /// `JoinZSetOp.StepAsync` calls: a hash join that BUILDS a
    /// `Dictionary<'Key, int>` index over the right side and PROBES it by
    /// scanning the left, multiplies weights with `Checked` arithmetic,
    /// and consolidates.
    ///
    /// ── Two regressions this delegation causes, stated plainly ───────
    ///
    /// Moving onto the shared primitive is right — the deleted version
    /// produced non-Z-sets — but it is not free, and both costs land on
    /// LARGE inputs where no test currently goes:
    ///
    /// 1. **Output buffer is sized `|left| × |right|`, not by matches.**
    ///    `ZSet.join` rents the full cartesian product up front
    ///    (`ZSet.fs`, `Pool.Rent (int cap64)`), regardless of how
    ///    selective the key is. The deleted implementation grew a
    ///    `ResizeArray` bounded by ACTUAL matches. So a selective join
    ///    over two large relations now reserves vastly more memory than
    ///    its result needs.
    /// 2. **Inputs whose product exceeds `Array.MaxLength` are REFUSED.**
    ///    The same code `invalidOp`s when `|left| × |right| >
    ///    Array.MaxLength` — about 46 341 rows a side if both are equal —
    ///    *even when the result would be tiny*. The old path completed.
    /// 3. **The refusal in (2) is NOT the operative boundary — (1) is.**
    ///    Because the rent is the whole product, a join sized just UNDER
    ///    `Array.MaxLength` asks for 2 147 395 600 ×
    ///    `sizeof&lt;ZEntry&lt;int64&gt;&gt;` = **32 GiB** contiguously and dies of
    ///    `OutOfMemoryException` before the guard is ever consulted.
    ///    Measured on both `ubuntu-24.04` and `ubuntu-24.04-arm`,
    ///    identically. So the `invalidOp` is the limit callers are TOLD
    ///    about, and allocation is the limit they actually meet — roughly
    ///    32 GiB earlier. Anything near the guard is unusable long before
    ///    reaching it.
    ///
    /// This is a pre-existing defect in `ZSet.join` that `Circuit.Join`
    /// has always had; delegating here inherits it rather than creating
    /// it. It is disclosed rather than papered over, and the refusal is
    /// pinned by a test in `ZetaSqlBuilder.Tests.fs` §THE INHERITED LIMIT
    /// so the boundary is known rather than discovered in production.
    /// (3) is why that section's non-vacuity witness holds the refused
    /// input fixed and shrinks the other side rather than straddling the
    /// threshold: while the rent is the product, success just under the
    /// threshold is untestable by construction, not merely expensive.
    /// Fixing it means giving `ZSet.join` a geometrically-grown output
    /// buffer (the shape `ZSet.ofSeq` already uses) — a change to a hot
    /// path that wants a benchmark, and therefore not this PR's business.
    ///
    /// The `'Key : not null` constraint is also new, inherited from
    /// `ZSet.join` (and so from `Circuit.Join`): the index side is a
    /// `Dictionary<'Key, int>`, which cannot key on null. The hand-rolled
    /// version used `Map.ofSeq` and so accepted a nullable key — an
    /// accidental capability the circuit path never had.
    [<CustomOperation("join")>]
    member _.Join(relR: Relation<'R>,
                  relS: Relation<'S>,
                  keySelectorR: 'R -> 'Key,
                  keySelectorS: 'S -> 'Key,
                  projector: 'R -> 'S -> 'Result) : Relation<'Result>
        when 'R : comparison and 'S : comparison and 'Key : comparison and 'Key : not null and 'Result : comparison =
        { Stream = ZSet.join keySelectorR keySelectorS projector relR.Stream relS.Stream }

[<AutoOpen>]
module ZetaQueryModule =
    let zeta = ZetaQueryBuilder()
