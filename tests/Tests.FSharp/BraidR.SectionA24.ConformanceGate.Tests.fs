module Zeta.Tests.BraidR.SectionA24.ConformanceGate
/// §A #24 Conformance Gate Tests
///
/// These tests are the §A conformance gate for §A #24:
///   "MenoBraided.braidR is a faithful non-Abelian Bₙ / Yang–Baxter operator"
///
/// Any change to MenoBraided.braidR that breaks P4 or P5c is a §A violation.
/// These tests MUST NOT be disabled or weakened without updating the §A register.
///
/// P4 tripwire: R²≠id (non-symmetric braiding)
/// P5c tripwire: ρ-equal ⟺ Braid.equal (faithfulness)

open global.Xunit
open Zeta.Core

// ── Helpers (same pattern as Braid.Tests.fs) ─────────────────────────────────
let private x0 : MenoBraided.V = Braid.gen 0
let private x1 : MenoBraided.V = Braid.gen 1
let private x2 : MenoBraided.V = Braid.gen 2

let private applyBraid (arrow: Meno.Arrow<MenoBraided.V * MenoBraided.V, MenoBraided.V * MenoBraided.V>) (p: MenoBraided.V * MenoBraided.V) =
    let (Meno.MenoArrow f) = arrow
    [ for e in f (ZSet.singleton p 1L) -> e.Key ]

let private applyRep (braid: int list) (strands: MenoBraided.V list) =
    let (Meno.MenoArrow f) = MenoBraided.rep braid
    [ for e in f (ZSet.singleton strands 1L) -> e.Key ]

// ── §A #24 P4 Tripwire: R²≠id ────────────────────────────────────────────────
[<Fact>]
let ``§A-24 P4: braidR is non-symmetric — R²≠id (earns braided, not swap)`` () =
    // R²(x0,x1) = R(R(x0,x1)) ≠ (x0,x1) in a non-Abelian free group
    // This is the P4 tripwire: goes RED if braidR were the swap
    let braidSq = applyBraid (Meno.compose MenoBraided.braidR MenoBraided.braidR) (x0, x1)
    Assert.DoesNotContain((x0, x1), braidSq)

[<Fact>]
let ``§A-24 P4-anti: swap satisfies R²=id (negative control — P4 is non-trivial)`` () =
    // The symmetric swap DOES return to identity: swap∘swap = id
    // This confirms the P4 test can distinguish braidR from the swap
    let swapVV : Meno.Arrow<MenoBraided.V * MenoBraided.V, MenoBraided.V * MenoBraided.V> = Meno.braid
    let swapSq = applyBraid (Meno.compose swapVV swapVV) (x0, x1)
    Assert.Equal<(MenoBraided.V * MenoBraided.V) list>([ (x0, x1) ], swapSq)

// ── §A #24 P5c Tripwire: faithfulness ────────────────────────────────────────
[<Fact>]
let ``§A-24 P5c: braidR realizes σ₀ faithfully (ρ-equal ⟺ Braid.equal)`` () =
    // R(x0,x1) = (x0·x1·x0⁻¹, x0) = (Braid.act [1] x0, Braid.act [1] x1)
    // The R-matrix IS Braid's crossing, so ρ factors through Braid's faithful action
    let out = applyBraid MenoBraided.braidR (x0, x1)
    let expected = (Braid.act [ 1 ] x0, Braid.act [ 1 ] x1)
    Assert.Equal<(MenoBraided.V * MenoBraided.V) list>([ expected ], out)

[<Fact>]
let ``§A-24 P5c-inv: braidR ∘ braidRinv = id`` () =
    Assert.Equal<(MenoBraided.V * MenoBraided.V) list>(
        [ (x0, x1) ], applyBraid (Meno.compose MenoBraided.braidR MenoBraided.braidRinv) (x0, x1))

[<Fact>]
let ``§A-24 P5c-inv2: braidRinv ∘ braidR = id`` () =
    Assert.Equal<(MenoBraided.V * MenoBraided.V) list>(
        [ (x0, x1) ], applyBraid (Meno.compose MenoBraided.braidRinv MenoBraided.braidR) (x0, x1))

// ── §A #24 Yang-Baxter equation ───────────────────────────────────────────────
[<Fact>]
let ``§A-24 YBE: the R-matrix rep satisfies Yang-Baxter (Artin σ₁σ₂σ₁ = σ₂σ₁σ₂)`` () =
    let strands = [ x0; x1; x2 ]
    Assert.Equal<MenoBraided.V list list>(applyRep [ 1; 2; 1 ] strands, applyRep [ 2; 1; 2 ] strands)

// ── §A #24 Scope boundary ─────────────────────────────────────────────────────
[<Fact>]
let ``§A-24 Scope: distinct braid words produce distinct actions (faithfulness over free groups)`` () =
    // σ₁ and σ₁⁻¹ are distinct braid words — they must produce distinct actions
    let sigma1 = applyBraid MenoBraided.braidR (x0, x1)
    let sigma1inv = applyBraid MenoBraided.braidRinv (x0, x1)
    Assert.NotEqual<(MenoBraided.V * MenoBraided.V) list>(sigma1, sigma1inv)
