module Zeta.Tests.LeibnizAntiSybilTests

// LEIBNIZ → ANTI-SYBIL, pinned in code (shadow*, Aaron 2026-07-02: "yeah antisybil is
// all i'm trying to claim … pin it down in code, tie it to AntiSybil.fs"). The scoped,
// bankable claim — NOT consciousness, NOT rights, NOT proof-of-mind. Just:
//
//   IDENTITY OF INDISCERNIBLES (Leibniz) ⇒ SYBIL RESISTANCE.
//   Two identities are distinct IFF they differ in some property. If the only
//   differences are OBSERVABLE (hence forgeable), an attacker mints N observably-
//   distinct-but-actually-one identities — the Sybil. A PRIVATE (frosted) difference,
//   rooted in INDEPENDENT entropy, is the one that can't be forged. So you can only BE
//   as many distinct identities as you have independent private seeds.
//
// This is exactly what `Zeta.Core.AntiSybil` already computes: it collapses claimed
// identities whose observable streams are indiscernible (correlation ≥ threshold) into
// shared sources, and reports the DistinctCount = forgery-cost floor. This file pins
// the Leibniz reading onto that oracle and checks it against KNOWN source counts (the
// self-verification: the oracle must recover the number of independent seeds we built
// the streams from).
//
// CPT COROLLARY (Aaron): `correlation` folds perfect anti-correlation onto 1, so an
// inverted replay (Z-set −1: charge-conjugated + time-reversed, a positron from
// t₀=t∞) is the SAME source. Identity is CPT-invariant — you cannot forge a Sybil by
// running your own history backwards. This ties the CPT composite law to Sybil
// resistance (BellTest.fs / the CPT-composite routing).
//
// Anchors: Leibniz (identity of indiscernibles); Douceur 2002 (The Sybil Attack);
// AntiSybil.fs (the behavioral layer — non-fungible drift entropy). Complements the
// CHSH-Sybil / SybilBft statistical layer. NOT a proved general-forger theorem — the
// guarantee is the module's: exact reuse ⇒ collapse (see AntiSybil.fs docstring).

open global.Xunit
open Zeta.Core

module AS = AntiSybil

/// An observable bit-stream deterministically generated from a PRIVATE seed
/// (SplitMix64). Independent seeds ⇒ ~50% pairwise agreement ⇒ correlation ≈ 0.
let private streamFromSeed (seed: uint64) (n: int) : int list =
    let mutable s = seed
    [ for _ in 1 .. n do
        s <- s + SplitMix64.GoldenRatio
        yield int (SplitMix64.mix s &&& 1UL) ]

let private len = 256
let private threshold = 0.5

[<Fact>]
let ``IDENTITY OF INDISCERNIBLES: N observably-identical agents collapse to ONE identity`` () =
    // Four agents claiming to be distinct while emitting the SAME observable stream.
    // Leibniz: indiscernible in all observed properties ⇒ one entity, not four.
    let s = streamFromSeed 42UL len
    let verdict = AS.antiSybil threshold [ s; s; s; s ]
    Assert.Equal(4, verdict.ClaimedCount)
    Assert.Equal(1, verdict.DistinctCount)      // four Sybils, one identity
    Assert.False(verdict.AllDistinct)

[<Fact>]
let ``CPT invariance of identity: an inverted replay (C∘T, backwards-in-time positron) is still ONE identity`` () =
    // Naive forge: present the bit-inverted stream to "look different". correlation
    // treats perfect anti-correlation as the SAME source (an inverted replay is one
    // clock). Cosmetic negation is not a Leibniz difference.
    //
    // This is CPT (Aaron 2026-07-02). In the Z-set replay convention: +1 = forward
    // replay (particle), −1 = inverted replay (charge-conjugated, time-reversed —
    // a positron running backward from t₀ = t∞, the fold's fixpoint). CPT says an
    // identity and its CPT-conjugate ARE the same identity — so the inverted replay
    // must NOT count as a second Sybil, and `correlation` (|2·frac−1|) folds
    // anti-correlation onto 1 exactly. Anti-Sybil is CPT-invariant: you can't forge a
    // new identity by running your own history backwards. (Ties the CPT composite law
    // — fold(map neg (reverse t)) = neg(fold t) — to Sybil resistance.)
    let s = streamFromSeed 7UL len
    let inverted = s |> List.map (fun b -> 1 - b)     // C∘T: charge-conjugate + reverse-in-time
    let verdict = AS.antiSybil threshold [ s; inverted ]
    Assert.Equal(1, verdict.DistinctCount)            // identity = its own CPT-conjugate

[<Fact>]
let ``DISTINCTNESS REQUIRES INDEPENDENT PRIVATE ENTROPY: k independent seeds ⇒ k distinct identities`` () =
    // Genuinely distinct identities: each from its OWN private (frosted) seed. The
    // oracle recovers the true count — this is the self-verification (known k = 5).
    let streams = [ for seed in 1UL .. 5UL -> streamFromSeed (seed * 0x9E3779B97F4A7C15UL) len ]
    let verdict = AS.antiSybil threshold streams
    Assert.Equal(5, verdict.DistinctCount)
    Assert.True(verdict.AllDistinct)

[<Fact>]
let ``THE FORGERY-COST FLOOR = the number of private seeds (frost): 6 claims from 2 seeds ⇒ 2 sources`` () =
    // A Sybil forger with only 2 independent private seeds claims 6 identities (3
    // observable copies each). Leibniz/anti-Sybil exposes it: DistinctCount = 2 = the
    // number of frosted seeds, NOT the 6 claimed. You cannot be more distinct than you
    // have independent private entropy.
    let a = streamFromSeed 0xA5A5A5A5UL len
    let b = streamFromSeed 0x5A5A5A5AUL len
    let verdict = AS.antiSybil threshold [ a; a; a; b; b; b ]
    Assert.Equal(6, verdict.ClaimedCount)
    Assert.Equal(2, verdict.DistinctCount)      // 2 private seeds ⇒ at most 2 identities
    // the two genuine sources are the two seed-groups (all a's share, all b's share)
    let src = verdict.SourceOf
    Assert.Equal(src.[0], src.[1]); Assert.Equal(src.[1], src.[2])   // the three a-claims: one source
    Assert.Equal(src.[3], src.[4]); Assert.Equal(src.[4], src.[5])   // the three b-claims: one source
    Assert.NotEqual(src.[0], src.[3])                                 // a and b are genuinely distinct
