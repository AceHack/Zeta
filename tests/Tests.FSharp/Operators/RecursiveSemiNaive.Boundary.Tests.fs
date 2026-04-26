module Zeta.Tests.Operators.RecursiveSemiNaiveBoundaryTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Boundary tests for `RecursiveSemiNaive`.
//
// Encodes the two scenarios from `openspec/specs/retraction-safe-
// recursion/spec.md` § "Requirement: semi-naïve recursion is
// monotone-only":
//
//   Scenario 1: monotone inputs yield the same result as the
//               retraction-safe combinator.
//   Scenario 2: retraction leaks stale facts (the documented
//               boundary; fed retracting input, semi-naïve's
//               integrated output retains rows derived from the
//               retracted fact).
//
// Motivation: Amara's 2026-04-23 ZSet-semantics courier report
// (absorbed as `docs/aurora/2026-04-23-amara-zset-semantics-
// operator-algebra.md` via PR #211) called out the
// `RecursiveSemiNaive` monotone-only boundary as a "must remain
// explicitly labeled" gap. Code and spec already document it; this
// file adds the *executable* documentation — the tests assert the
// monotone-equivalent behavior AND the retraction-leak behavior as
// the current documented boundary. If a future change fixes the
// leak without also fixing the algorithm (see the gap-monotone
// signed-delta research plan in `docs/research/retraction-safe-
// semi-naive.md`), the second test will fail and prompt an
// investigation.
//
// Reading: *the leak test is not a bug being asserted; it is a
// boundary being recorded.* Callers that want retraction safety
// already have `Recursive` available. This suite protects
// `RecursiveSemiNaive`'s documented semantics from silent drift.
// ═══════════════════════════════════════════════════════════════════


/// Transitive-closure one-step body over `(u,v)` edges: given the
/// current `reach` set, produce additional `(a,z)` reach via a
/// key-join between `reach.2` and `edges.1`. The body is Z-linear.
let private oneStepClosure (c: Circuit) (edges: Stream<ZSet<struct (int * int)>>)
    (reach: Stream<ZSet<struct (int * int)>>) : Stream<ZSet<struct (int * int)>> =
    c.Join(
        reach,
        edges,
        System.Func<_, _>(fun (struct (_, m)) -> m),
        System.Func<_, _>(fun (struct (u, _)) -> u),
        System.Func<_, _, _>(fun (struct (a, _)) (struct (_, z)) ->
            struct (a, z)))


// ─── Scenario 1: monotone inputs match the retraction-safe combinator ───

[<Fact>]
let ``RecursiveSemiNaive matches Recursive on monotone inputs (acyclic DAG)`` () =
    // A --> B --> C
    // Monotone: only inserts, no retractions.
    // Closure: {(1,2), (2,3), (1,3)} once fully expanded.
    let edges = [ struct (1, 2); struct (2, 3) ]

    // ── Retraction-safe combinator reference ──
    let cRef = Circuit()
    let edgesRef = cRef.ZSetInput<struct (int * int)>()
    let closureRef =
        cRef.Recursive(
            edgesRef.Stream,
            System.Func<_, _>(fun s -> oneStepClosure cRef edgesRef.Stream s))
    let outRef = OutputHandle closureRef.Op
    cRef.Build()
    edgesRef.Send (ZSet.ofKeys edges)
    let struct (_, _) = cRef.IterateToFixedPointWithConvergence(closureRef, 20)
    let refResult = outRef.Current

    // ── Semi-naïve under test ──
    let cSN = Circuit()
    let edgesSN = cSN.ZSetInput<struct (int * int)>()
    let closureSN =
        cSN.RecursiveSemiNaive(
            edgesSN.Stream,
            System.Func<_, _>(fun s -> oneStepClosure cSN edgesSN.Stream s))
    let outSN = OutputHandle closureSN.Op
    cSN.Build()
    edgesSN.Send (ZSet.ofKeys edges)
    let struct (_, _) = cSN.IterateToFixedPointWithConvergence(closureSN, 20)
    let snResult = outSN.Current

    // Both combinators MUST agree on the integrated closure under
    // monotone input. This is spec scenario #1.
    //
    // We check by positive-weight support equality: both should
    // contain exactly {(1,2), (2,3), (1,3)} with positive weight.
    // (Weight magnitudes may differ — `Recursive` uses `Distinct`
    // internally so all weights clamp to 1; `RecursiveSemiNaive`
    // may carry higher counts.)
    let supportOf (z: ZSet<struct (int * int)>) =
        z
        |> Seq.filter (fun (e: ZEntry<struct (int * int)>) -> e.Weight > 0L)
        |> Seq.map (fun e -> e.Key)
        |> Set.ofSeq

    supportOf snResult |> should equal (supportOf refResult)


// ─── Scenario 2: retraction leaks stale facts (documented boundary) ─────

[<Fact>]
let ``RecursiveSemiNaive leaks stale facts after retraction (documented boundary)`` () =
    // tick 0: insert edge (1,2) then (2,3) → closure {(1,2), (2,3), (1,3)}
    // tick 1: retract edge (2,3) → closure should become {(1,2)} if retraction-safe.
    //
    // Under `Recursive` (retraction-safe) the closure row (1,3)
    // drops out. Under `RecursiveSemiNaive` (monotone-only) the
    // row (1,3) LEAKS — it was written to the internal `total`
    // feedback cell and the algorithm has no path to reverse it.
    //
    // This test ASSERTS the leak. It is the documented boundary,
    // not a bug being fixed. See `openspec/specs/retraction-safe-
    // recursion/spec.md` § "Scenario: retraction leaks stale facts"
    // for the spec-level SHALL-NOT equivalent.
    //
    // If this test ever *fails* because (1,3) drops out correctly
    // after retraction, the fix is either:
    //   (a) replace the combinator with the gap-monotone signed-
    //       delta variant (ongoing research;
    //       `docs/research/retraction-safe-semi-naive.md`), and
    //       remove this test's leak-assertion; OR
    //   (b) investigate whether the test harness now masks the
    //       leak via some other operator's behavior, and adjust
    //       the scenario to surface it directly.

    // ── Semi-naïve under test ──
    let cSN = Circuit()
    let edgesSN = cSN.ZSetInput<struct (int * int)>()
    let closureSN =
        cSN.RecursiveSemiNaive(
            edgesSN.Stream,
            System.Func<_, _>(fun s -> oneStepClosure cSN edgesSN.Stream s))
    let outSN = OutputHandle closureSN.Op
    cSN.Build()

    // tick 0: inserts (1,2), (2,3) → closure grows to include (1,3).
    edgesSN.Send (ZSet.ofKeys [ struct (1, 2); struct (2, 3) ])
    let struct (_, _) = cSN.IterateToFixedPointWithConvergence(closureSN, 20)
    let after0 = outSN.Current
    after0.[struct (1, 3)] |> should be (greaterThan 0L)

    // tick 1: retract edge (2,3). Under semi-naïve, the positive-
    // integrated `total` cannot be reversed — (1,3) leaks.
    edgesSN.Send (ZSet.ofPairs [ struct (struct (2, 3), -1L) ])
    let struct (_, _) = cSN.IterateToFixedPointWithConvergence(closureSN, 20)
    let after1 = outSN.Current

    // Leaked row (1,3) MUST still carry positive weight — this
    // is the documented boundary. If it drops to 0, the test
    // fails and prompts the investigation above.
    after1.[struct (1, 3)] |> should be (greaterThan 0L)
