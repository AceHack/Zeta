module Zeta.Tests.TwoTimescaleFoldTests

// The two-timescale fold: differentiation on the fast local layer, convergence on the slow shared
// one. These tests exist to check that the no-go was genuinely routed around rather than restated.
//
// THE NO-GO (audit 2026-08-10): on ONE commutative fold, durable differentiation and
// order-independent convergence are mutually exclusive — a path-independent merge means a persistent
// difference cannot exist. So the headline test below must show BOTH properties at once, and it must
// be impossible for it to pass by having no differentiation at all. That anti-vacuity guard is the
// most important assertion in the file: without it, "converges despite differentiating" is trivially
// true for a system that never differentiates.

open global.Xunit
open Zeta.Core

module TTF = TwoTimescaleFold

let private dim = 4

/// Deterministic, injected, replayable — never ambient (§13 noninterference). Different seeds model
/// different per-replica entropy sources, which is what makes differentiation possible at all.
type private SeqSource(picks: int list) =
    let mutable rest = picks

    interface TTF.IEntropySource with
        member _.Next(bound: int) =
            match rest with
            | x :: tail ->
                rest <- tail
                x % bound
            | [] -> 0

let private ev id likelihood : TTF.SharedEvidence = { Id = id; Likelihood = likelihood }

// ── the shared layer is a JOIN-SEMILATTICE, which is what makes delay free ──────────────────────

[<Fact>]
let ``IDEMPOTENT: re-applying the same evidence is a no-op — redelivery cannot double-count`` () =
    // This is the property `BeliefConvergence.observe` LACKS (pinned as a negative in its own tests).
    // Supplying it via a dedup key is what discipline #6 prescribes, and it is why delay is free here
    // by construction rather than by assumption.
    let e = ev "a" [| 3L; 1L; 1L; 1L |]
    let once = TTF.apply e (TTF.emptyShared dim)
    let twice = TTF.apply e once
    Assert.Equal<int64[]>(once.Belief, twice.Belief)
    Assert.Equal<Set<string>>(once.Applied, twice.Applied)

[<Fact>]
let ``COMMUTATIVE and ASSOCIATIVE: belief is a function of the evidence SET, not the path`` () =
    let a = ev "a" [| 2L; 1L; 1L; 1L |]
    let b = ev "b" [| 1L; 5L; 1L; 1L |]
    let c = ev "c" [| 1L; 1L; 7L; 1L |]
    let start = TTF.emptyShared dim
    let forward = TTF.applyAll [ a; b; c ] start
    let reversed = TTF.applyAll [ c; b; a ] start
    let regrouped = TTF.applyAll [ b ] (TTF.applyAll [ c; a ] start)
    // ... and with arbitrary redelivery mixed in, which order-independence alone would NOT survive.
    let noisy = TTF.applyAll [ a; b; a; c; b; a; c ] start
    Assert.Equal<int64[]>(forward.Belief, reversed.Belief)
    Assert.Equal<int64[]>(forward.Belief, regrouped.Belief)
    Assert.Equal<int64[]>(forward.Belief, noisy.Belief)

[<Fact>]
let ``the JOIN merges any two states, however far they drifted, path-independently`` () =
    let catalog =
        Map.ofList [ "a", [| 2L; 1L; 1L; 1L |]; "b", [| 1L; 3L; 1L; 1L |]; "c", [| 1L; 1L; 5L; 1L |] ]

    let start = TTF.emptyShared dim
    let left = TTF.applyAll [ ev "a" catalog.["a"]; ev "b" catalog.["b"] ] start
    let right = TTF.applyAll [ ev "b" catalog.["b"]; ev "c" catalog.["c"] ] start
    let lr = TTF.merge catalog left right
    let rl = TTF.merge catalog right left
    Assert.Equal<int64[]>(lr.Belief, rl.Belief) // commutative
    Assert.Equal<int64[]>(lr.Belief, (TTF.merge catalog lr left).Belief) // idempotent under re-merge
    Assert.Equal<Set<string>>(Set.ofList [ "a"; "b"; "c" ], lr.Applied)

// ── the fast layer genuinely differentiates ────────────────────────────────────────────────────

[<Fact>]
let ``ANTI-VACUITY: different entropy actually produces different local states`` () =
    // Load-bearing. If this fails, the headline test below is meaningless — it would be asserting
    // convergence for replicas that never diverged.
    let src1 = SeqSource([ 0; 0; 0 ]) :> TTF.IEntropySource
    let src2 = SeqSource([ 1; 1; 1 ]) :> TTF.IEntropySource
    let r1 = [ 1..3 ] |> List.fold (fun s _ -> TTF.localStep src1 s) (TTF.emptyLocal "r1" dim)
    let r2 = [ 1..3 ] |> List.fold (fun s _ -> TTF.localStep src2 s) (TTF.emptyLocal "r2" dim)
    Assert.NotEqual<int64[]>(r1.Local, r2.Local)
    Assert.Equal(3, r1.Sharpenings)

[<Fact>]
let ``the fast step is state-dependent, so it does NOT commute — that is the differentiating agent`` () =
    // Per Dobzhansky-Muller the non-commutative term is what differentiates; delay only stops the
    // merge erasing it. Applying the same two picks in opposite orders must diverge.
    let ab = SeqSource([ 0; 1 ]) :> TTF.IEntropySource
    let ba = SeqSource([ 1; 0 ]) :> TTF.IEntropySource
    let start = { TTF.emptyLocal "r" dim with Local = [| 2L; 3L; 1L; 1L |] }
    let viaAB = TTF.localStep ab (TTF.localStep ab start)
    let viaBA = TTF.localStep ba (TTF.localStep ba start)
    Assert.NotEqual<int64[]>(viaAB.Local, viaBA.Local)

// ── HEADLINE: both properties at once, which one fold cannot give ───────────────────────────────

[<Fact>]
let ``HEADLINE: replicas DIFFERENTIATE locally and still CONVERGE on the shared layer`` () =
    let src1 = SeqSource([ 0; 0 ]) :> TTF.IEntropySource
    let src2 = SeqSource([ 2; 2 ]) :> TTF.IEntropySource
    let r1 = [ 1..2 ] |> List.fold (fun s _ -> TTF.localStep src1 s) (TTF.emptyLocal "r1" dim)
    let r2 = [ 1..2 ] |> List.fold (fun s _ -> TTF.localStep src2 s) (TTF.emptyLocal "r2" dim)

    // (1) They really did differentiate — asserted here too, so this test cannot pass vacuously.
    Assert.NotEqual<int64[]>(r1.Local, r2.Local)

    // (2) Each crosses the declared door exactly once.
    let e1, c1 = TTF.project r1
    let e2, c2 = TTF.project r2
    let catalog = Map.ofList [ e1.Id, e1.Likelihood; e2.Id, e2.Likelihood ]

    // (3) Two nodes receive the two pieces of evidence in OPPOSITE orders, with redelivery.
    let nodeA = TTF.applyAll [ e1; e2; e1 ] (TTF.emptyShared dim)
    let nodeB = TTF.applyAll [ e2; e1; e2 ] (TTF.emptyShared dim)

    // (4) ... and agree exactly. Differentiation upstream, convergence downstream.
    Assert.Equal<int64[]>(nodeA.Belief, nodeB.Belief)
    Assert.Equal<Set<string>>(nodeA.Applied, nodeB.Applied)
    Assert.Equal<int64[]>(nodeA.Belief, (TTF.merge catalog nodeA nodeB).Belief)
    Assert.Equal(2, c1.SharpeningsAtCrossing)
    Assert.Equal("r2#2", c2.EvidenceId)

// ── the door: local time and local order must not cross ────────────────────────────────────────

[<Fact>]
let ``project's dedup key is reproducible from logical state alone — no local clock crosses`` () =
    // If the key were local-time-derived, two nodes would key the same evidence differently, the
    // merge would stop being idempotent, and they would diverge. Same logical state must key the same
    // regardless of when it is projected.
    let st = { TTF.emptyLocal "alice" dim with Sharpenings = 7 }
    let e1, _ = TTF.project st
    let e2, _ = TTF.project st
    Assert.Equal("alice#7", e1.Id)
    Assert.Equal(e1.Id, e2.Id)
    // Distinct replicas at the same logical step never collide.
    let other, _ = TTF.project { st with ReplicaId = "bob" }
    Assert.NotEqual<string>(e1.Id, other.Id)

[<Fact>]
let ``project copies — the shared layer cannot be mutated through a retained local reference`` () =
    let st = { TTF.emptyLocal "r" dim with Local = [| 2L; 1L; 1L; 1L |] }
    let e, _ = TTF.project st
    st.Local.[0] <- 99L
    Assert.Equal(2L, e.Likelihood.[0])

// ── the delta log is a GROUP — the half the semilattice provably cannot be ──────────────────────

[<Fact>]
let ``THE FORCED PAIR: the delta log has inverses, which the idempotent join cannot`` () =
    // `a + a = a  =>  a = e`, so no non-trivial structure is both idempotent and a group. The join
    // gives redelivery-safety; the log gives retraction. Two structures, forced by a one-line
    // theorem rather than chosen by taste.
    let d: TTF.Delta = { Of = "r1"; Change = [| 5L; -2L; 0L; 1L |] }
    let v = [| 10L; 10L; 10L; 10L |]
    let applied = TTF.applyDelta d v
    Assert.NotEqual<int64[]>(v, applied)
    Assert.Equal<int64[]>(v, TTF.applyDelta (TTF.invert d) applied) // retraction is exact
    Assert.Equal<int64[]>(v, TTF.replay [ d; TTF.invert d ] v)

[<Fact>]
let ``the log preserves the PATH that the join destroys`` () =
    // The join is a function of the evidence set and forgets how it got there; the log does not.
    // That difference is the extension class the audit named — kept here rather than lost.
    let d1: TTF.Delta = { Of = "r"; Change = [| 1L; 0L; 0L; 0L |] }
    let d2: TTF.Delta = { Of = "r"; Change = [| 0L; 2L; 0L; 0L |] }
    let v = [| 0L; 0L; 0L; 0L |]
    Assert.Equal<int64[]>(TTF.replay [ d1; d2 ] v, TTF.replay [ d2; d1 ] v) // same endpoint...
    Assert.NotEqual<TTF.Delta list>([ d1; d2 ], [ d2; d1 ]) // ...different, retained, path

// ── DST: the module CLAIMS replayability, so the claim gets a check ────────────────────────────
//
// `IEntropySource` exists so "DST can replay it exactly" (TwoTimescaleFold.fs:131). That claim
// shipped with nothing enforcing it, which is the same claim-not-matched-to-check pattern this
// session has been closing elsewhere. These tests close it here.

/// A seeded, ambient-free source — the realistic form. No clock, no Random(), no thread-pool read;
/// the seed is the entire state, which is what makes a run reproducible from it.
type private SeededSource(seed: uint64) =
    let mutable s = seed

    interface TTF.IEntropySource with
        member _.Next(bound: int) =
            // SplitMix64-shaped step: deterministic, seed-determined, no ambient input.
            s <- s + 0x9E3779B97F4A7C15UL
            let mutable z = s
            z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
            z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
            z <- z ^^^ (z >>> 31)
            int (z % uint64 bound)

/// NOTE the replica id parameter. An earlier version of this helper hardcoded "r", so two
/// *different* replicas both projected to the key "r#5" — a dedup-key COLLISION that silently
/// merged distinct evidence and made the schedule-free test fail. The design was right; the helper
/// violated a precondition the module had not stated. It states it now, and
/// ``a dedup-key COLLISION silently merges distinct evidence`` below pins the consequence.
let private runLocalAs (replicaId: string) (seed: uint64) (steps: int) : TTF.LocalState =
    let src = SeededSource(seed) :> TTF.IEntropySource
    [ 1..steps ] |> List.fold (fun st _ -> TTF.localStep src st) (TTF.emptyLocal replicaId dim)

let private runLocal (seed: uint64) (steps: int) : TTF.LocalState = runLocalAs "r" seed steps

[<Fact>]
let ``DST: the same seed replays byte-identically across independent runs`` () =
    let a = runLocal 42UL 25
    let b = runLocal 42UL 25
    Assert.Equal<int64[]>(a.Local, b.Local)
    Assert.Equal(a.Sharpenings, b.Sharpenings)

[<Fact>]
let ``DST ANTI-VACUITY: a different seed gives a different trajectory`` () =
    // Without this, the replay test above would pass for a constant function — the strongest way for
    // a determinism claim to be true and worthless.
    let a = runLocal 42UL 25
    let b = runLocal 43UL 25
    Assert.NotEqual<int64[]>(a.Local, b.Local)

[<Fact>]
let ``DST: the WHOLE system is a function of (seed, evidence set) — schedule-free`` () =
    // The strong property this two-layer design is for: nothing depends on the delivery schedule.
    // The local layer is entropy-determined, and the shared layer is a function of the evidence SET,
    // so replaying from (seed, set) reproduces both layers with no record of ordering or timing.
    let r1 = runLocalAs "r1" 7UL 5
    let r2 = runLocalAs "r2" 9UL 5
    let e1, _ = TTF.project r1
    let e2, _ = TTF.project r2

    // Same inputs, three different delivery schedules — including redelivery.
    let s1 = TTF.applyAll [ e1; e2 ] (TTF.emptyShared dim)
    let s2 = TTF.applyAll [ e2; e1 ] (TTF.emptyShared dim)
    let s3 = TTF.applyAll [ e2; e2; e1; e1; e2 ] (TTF.emptyShared dim)
    Assert.Equal<int64[]>(s1.Belief, s2.Belief)
    Assert.Equal<int64[]>(s1.Belief, s3.Belief)

    // And the whole thing reproduces from the seeds alone.
    let e1', _ = TTF.project (runLocalAs "r1" 7UL 5)
    let e2', _ = TTF.project (runLocalAs "r2" 9UL 5)
    let replayed = TTF.applyAll [ e1'; e2' ] (TTF.emptyShared dim)
    Assert.Equal<int64[]>(s1.Belief, replayed.Belief)
    Assert.Equal<Set<string>>(s1.Applied, replayed.Applied)

[<Fact>]
let ``PRECONDITION: a dedup-key COLLISION silently merges distinct evidence`` () =
    // Found by the schedule-free test failing above, and pinned because the failure mode is SILENT.
    // Two replicas sharing an id project the same key at the same logical step, so the shared layer
    // dedups them as one — the second piece of evidence is discarded with no error. Replica-id
    // uniqueness is therefore a REAL precondition of the design, not a naming nicety.
    let a = runLocalAs "same" 7UL 5
    let b = runLocalAs "same" 9UL 5
    let ea, _ = TTF.project a
    let eb, _ = TTF.project b

    Assert.NotEqual<int64[]>(ea.Likelihood, eb.Likelihood) // genuinely different evidence...
    Assert.Equal(ea.Id, eb.Id) // ...colliding on one key

    let folded = TTF.applyAll [ ea; eb ] (TTF.emptyShared dim)
    Assert.Equal(1, folded.Applied.Count) // only ONE survived
    Assert.Equal<int64[]>((TTF.apply ea (TTF.emptyShared dim)).Belief, folded.Belief) // and it was the first

// ── metering: claims about delay carry a number ────────────────────────────────────────────────

[<Fact>]
let ``the small parameter is r*tau, never tau — so a quiescent system tolerates any delay`` () =
    Assert.Equal(6.0, TTF.inFlight 3.0 2.0, 9)
    // r -> 0 makes any delay harmless. This is the design consequence worth keeping.
    Assert.Equal(0.0, TTF.inFlight 0.0 1_000_000.0, 9)

[<Fact>]
let ``differentiation persists iff lambda_F * tau > 2 — local growth must outrun mixing`` () =
    Assert.True(TTF.differentiationPersists 3.0 1.0) // 3 > 2
    Assert.False(TTF.differentiationPersists 1.0 1.0) // 1 < 2
    Assert.False(TTF.differentiationPersists 2.0 1.0) // strict: exactly 2 does not persist
