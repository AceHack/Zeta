module Zeta.Tests.HomoiconicSeamTests

open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════════════════════════
//  THE HOMOICONIC SEAM — pinned as a machine-checked NEGATIVE.
//
//  Routed by Soraya (formal-verification-expert), 2026-08-18. Grounding:
//    docs/research/2026-08-18-soraya-where-the-uncoded-coded-seam-actually-lands-in-our-ir.md
//
//  Lumen 2026-08-14 proved that homoiconicity, given the checkable definition (a homoiconic
//  pair is (A, M, rho) with rho an ISOMORPHISM, i.e. M is the REGULAR representation of A),
//  survives the uncoded N-cube adinkra and DIES at the code quotient: minimal ^ homoiconic
//  holds exactly for N <= 3. The obstruction is MINIMALITY — the quotient map collapses
//  distinct representatives, so the representation can no longer recover its own description.
//
//  This file asserts that our IR has the SAME obstruction in the SAME place, and pins WHERE.
//  Every assertion here fails if the seam MOVES — which is exactly when someone needs telling.
//  Nothing here is a proof of homoiconicity; three of the four facts below are its ABSENCE,
//  stated out loud so no docstring can quietly round them up (toy-is-free-metered-must-be-earned).
// ═══════════════════════════════════════════════════════════════════════════════════════

// ── the skeleton fold: SHAPE only, every leaf payload discarded ──────────────────────────
//
// This is the instrument. A DynamicValue's "skeleton" is what a structural fold can SEE:
// the tree of kinds and object keys, with scalar contents erased. Two values with the same
// skeleton are indistinguishable to any algebra that does not read leaf payloads — which is
// the operational meaning of "this sub-language is opaque to the metalanguage".
let private skeleton: DynamicValueFold.DvAlgebra<string> =
    { Null = "n"
      Bool = fun _ -> "b"
      Int = fun _ -> "i"
      Float = fun _ -> "f"
      String = fun _ -> "s"
      Bytes = fun _ -> "y"
      Array = fun xs -> "[" + System.String.Join(",", xs) + "]"
      Object = fun kvs -> "{" + System.String.Join(",", kvs |> List.map (fun (k, v) -> k + ":" + v)) + "}" }

let private skeletonOf (dv: DynamicValue) : string = DynamicValueFold.cata skeleton dv

// ═══════════════════════════════════════════════════════════════════════════════════════
//  SEAM 1 — ZetaIrNormalizer.normalize: the QUOTIENT break (Lumen's obstruction, in our IR).
//
//  `normalize` lowers the v1-v4 op vocabulary into the minimal generating set (the "core
//  four": Mul, Add, XShrXor, XRotXor). That is a quotient of a free term algebra by a set of
//  relations, and — exactly like the adinkra code quotient — it is NOT INJECTIVE. Upstream of
//  this function an IR term is its own description; downstream it is a coset representative
//  and the surface op the author wrote is unrecoverable.
//
//  Contrast with src/Core.Lean4/Gen/HomoiconicFixpoint.lean `quote_injective`, which proves
//  that in a homoiconic pair the reflection map IS injective. Normalize is a different map,
//  so there is no contradiction — but it is the precise point past which that conclusion can
//  no longer be re-established, because the pre-image is already gone.
// ═══════════════════════════════════════════════════════════════════════════════════════

let private irOf (ops: ZetaIrV4.Op list) : ZetaIrV4.Ir =
    { Generator = "seam.probe"; Version = 1; Width = 64; Ops = ops }

/// Both witness pairs, as (distinct surface op, its already-core twin).
let private collisionWitnesses: (ZetaIrV4.Op * ZetaIrV4.Op) list =
    [ ZetaIrV4.Rotl 7L, ZetaIrV4.XRotXor [ 0L; 7L ]
      ZetaIrV4.XorShr 13L, ZetaIrV4.XShrXor [ 13L ] ]

[<Fact>]
let ``SEAM 1a: normalize is NOT injective -- two independent collision witnesses`` () =
    for (surface, core) in collisionWitnesses do
        // the two ops are genuinely distinct terms (else the test is vacuous)
        Assert.False((surface = core), sprintf "witness pair is not distinct: %A" surface)
        // ...and they have the SAME normal form: the quotient collapses them
        Assert.Equal<ZetaIrV4.Op>(ZetaIrNormalizer.normalizeOp surface, ZetaIrNormalizer.normalizeOp core)
        Assert.Equal<ZetaIrV4.Ir>(ZetaIrNormalizer.normalize (irOf [ surface ]), ZetaIrNormalizer.normalize (irOf [ core ]))

[<Fact>]
let ``SEAM 1b: the collapse is SEMANTICS-PRESERVING -- syntax forgotten, denotation kept`` () =
    // A code quotient's defining signature: the map forgets syntax and preserves meaning.
    // Without this half, `normalize` would be a bug rather than a seam. Probed at both
    // supported widths over edge words + a seeded spread (DST-deterministic).
    let rnd = System.Random(20260818)
    let probes64 =
        [ 0UL; 1UL; 2UL; 3UL; System.UInt64.MaxValue; System.UInt64.MaxValue - 1UL; 1UL <<< 63; 0x0123456789ABCDEFUL ]
        @ [ for _ in 1..256 -> (uint64 (rnd.Next()) <<< 32) ||| uint64 (rnd.Next()) ]
    for (surface, core) in collisionWitnesses do
        for x in probes64 do
            Assert.Equal(ZetaIrNormalizer.evalOp64 surface x, ZetaIrNormalizer.evalOp64 core x)
            let x32 = uint32 (x &&& 0xFFFFFFFFUL)
            Assert.Equal(ZetaIrNormalizer.evalOp32 surface x32, ZetaIrNormalizer.evalOp32 core x32)

// ═══════════════════════════════════════════════════════════════════════════════════════
//  SEAM 2 — YinYang: the TYPE break.
//
//  `YinYang.Cell = { Remains: DynamicValue; Acts: Bonsai.Expr }` holds its two halves in two
//  DIFFERENT types, and `toDynamicValue` renders the acts half as a Bonsai-serialized
//  `DynamicValue.String` — one opaque leaf. So the engine is CARRIED by the value tree but
//  is not VISIBLE to it: no structural fold can descend into it.
//
//  YinYang.fs's own docstring says "Because both halves are `DynamicValue`s in one structure,
//  each can represent the other." The first clause is false as written (Acts is a Bonsai.Expr),
//  and `YinYang.Homoiconic.Tests.fs` proves only that each half can CARRY an ENCODING of the
//  other -- through a string, both directions. Encodability is not homoiconicity: under the
//  checkable definition the carrier must be the same type and the map an isomorphism. These
//  two facts bound that claim mechanically instead of arguing with it.
// ═══════════════════════════════════════════════════════════════════════════════════════

let private cellDv (remains: DynamicValue) (acts: Bonsai.Expr) : DynamicValue =
    match YinYang.toDynamicValue { YinYang.Remains = remains; YinYang.Acts = acts } with
    | Some d -> d
    | None -> failwith "YinYang.toDynamicValue returned None for a valid cell"

[<Fact>]
let ``SEAM 2a: the ACTS half is opaque -- structurally different engines fold to the same skeleton`` () =
    let tiny = Bonsai.Param "x"
    let big =
        Bonsai.Lambda(
            [ "a"; "b" ],
            Bonsai.Cond(
                Bonsai.Binary(Bonsai.Lt, Bonsai.Param "a", Bonsai.Const(Bonsai.CInt 3L)),
                Bonsai.Call("f", [ Bonsai.Param "b"; Bonsai.Const(Bonsai.CStr "z") ]),
                Bonsai.Binary(Bonsai.Add, Bonsai.Param "a", Bonsai.Param "b")))
    // the two engines are genuinely different programs (else the test is vacuous)
    Assert.False((tiny = big), "witness engines must differ")

    let remains = DynamicValue.Int 1L
    let sTiny = skeletonOf (cellDv remains tiny)
    let sBig = skeletonOf (cellDv remains big)

    // THE SEAM: a six-node lambda and a bare parameter are the SAME SHAPE to the fold.
    Assert.Equal<string>(sTiny, sBig)
    // ...and the shape is exactly two leaves: the value tree, and one opaque string.
    Assert.Equal<string>("{remains:i,acts:s}", sTiny)

[<Fact>]
let ``SEAM 2b: the REMAINS half is transparent -- the contrast that makes 2a a seam`` () =
    // If BOTH halves were opaque there would be no seam, just a uniformly flat encoding.
    // The asymmetry is the finding: one half is structure, the other is a string.
    let acts = Bonsai.Param "x"
    let flat = skeletonOf (cellDv (DynamicValue.Int 1L) acts)
    let deep = skeletonOf (cellDv (DynamicValue.Array [ DynamicValue.Int 1L; DynamicValue.Object [ "k", DynamicValue.Bool true ] ]) acts)
    Assert.False((flat = deep), "the remains half must be visible to the fold")
    Assert.Equal<string>("{remains:[i,{k:b}],acts:s}", deep)
