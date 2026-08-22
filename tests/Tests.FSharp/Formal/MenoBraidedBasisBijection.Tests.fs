module Zeta.Tests.Formal.MenoBraidedBasisBijection

/// **The guard that keeps ⟨V⟩ non-cartesian: every hom of ⟨V⟩ is a basis bijection, so copy `Δ` and
/// discard `ε` cannot enter.** Work-item 081KZZVC6SE087G0R001SXE8BV.
///
/// **Why this is load-bearing, not hygiene.** A *cartesian* monoidal category has a **unique braiding**,
/// and it is the swap — stronger than Mathlib's `Subsingleton (SymmetricCategory C)`, which only pins the
/// *symmetric* structure. (I is terminal, so naturality of `c` against `!_A : A → I` forces `π₁∘c = π_B`
/// and `π₂∘c = π_A`; the product's universal property then pins `c = swap`.) `Meno.fs:38` records that the
/// DETERMINISTIC subcategory — the `arr f` arrows — IS cartesian (Fox 1976), and `MenoBraided.braidR` is
/// built with `Meno.arr`. So if `Δ`/`ε` were ever admitted into ⟨V⟩, `braidR` would be *forced* to the
/// swap, and the machine-checked `Zeta.MenoBraided.braidR_not_symmetric_perm3`
/// (`src/Core.Lean4/Lean4/MenoBraidedRMatrix.lean`) would be false. The escape is that every ⟨V⟩ hom is a
/// **basis bijection**: `Δ : V → V⊗V` is not surjective on basis and `ε : V → I` is not injective, so
/// neither is one, and by Fox ⟨V⟩ carries no natural comonoid and stays genuinely braided.
///
/// **Where the guard actually lives.** Rung 1 of the externalization ladder is the type
/// `MenoBraided.Hom` — a *private* union over braid words with a **total** `inverse`, so a copy or a
/// discard is unrepresentable rather than merely absent. This file is the falsifier for that type plus
/// the rung-3 backstop for the ambient-arrow escape hatch that no F# type can close: `Hom.toArrow` is a
/// one-way door into `Meno.Arrow`, where `Δ` and `ε` legitimately exist (Meno is a CD category), and
/// nothing stops a future edit from hand-writing one *beside* `rep` and calling it ⟨V⟩. That edit is what
/// these tests catch.
///
/// **Non-vacuity is the point.** Five negative controls — `Δ`, `ε`, the length-preserving copy `Δ∘ε`, a
/// ℤ-linear sign flip, and a weight doubling — are each asserted to be REJECTED, and each names *which*
/// predicate rejects it, so that neutering any one predicate of the checker turns some test red. Every
/// number below is exact integer arithmetic; there are no floats and no tolerances.
///
/// Anchors: Fox 1976, *Coalgebras and cartesian categories* (cartesian ⟺ natural comonoid);
/// Joyal & Street 1993 (braided monoidal categories); Artin 1925 (faithfulness of the free-group action).

open global.Xunit
open Zeta.Core

// ── The finite exhaustive model ──────────────────────────────────────────────────────────────────
// V = ℤ[Fₙ] is infinite, so "exhaustive" means exhaustive over a finite sub-basis of V^⊗n: every tuple
// of length k drawn from { ε, x₀^±1, …, x_{n−1}^±1 }. Injectivity and the two-sided roundtrip are exact
// on that set; nothing is sampled and nothing is random.

type private W = MenoBraided.V

let private alphabet (n: int) : W list =
    [ yield []
      for i in 0 .. n - 1 do
          yield Braid.gen i
          yield Braid.inv (Braid.gen i) ]

let rec private tuples (alpha: W list) (k: int) : W list list =
    if k <= 0 then
        [ [] ]
    else
        [ for a in alpha do
              for rest in tuples alpha (k - 1) -> a :: rest ]

/// Three strands, alphabet of 7 ⇒ 343 basis tuples. Total and cheap.
let private domain3 : W list list = tuples (alphabet 3) 3

/// Two strands ⇒ 49 basis tuples — the domain the copy/discard controls live on.
let private domain2 : W list list = tuples (alphabet 3) 2

/// One strand ⇒ 7 basis elements — the domain `Δ_V : V → V⊗V` and `ε_V : V → I` live on.
let private domain1 : W list list = tuples (alphabet 3) 1

/// Apply an arrow to ONE basis element and read the whole resulting ℤ-combination (keys AND weights —
/// reading only the keys is how a sign flip or a weight doubling would slip past).
let private applyBasis (arrow: Meno.Arrow<W list, W list>) (b: W list) : (W list * int64) list =
    let (Meno.MenoArrow f) = arrow
    [ for e in f (ZSet.singleton b 1L) -> e.Key, e.Weight ]

// ── The checker ──────────────────────────────────────────────────────────────────────────────────
// Three independent predicates. Each has at least one negative control below that ONLY it rejects, so
// none of the three is decoration.

type private Verdict =
    { /// Both `h` and the claimed inverse send each basis element to exactly ONE basis element of
      /// weight +1 — i.e. each is a map of basis elements, not a general ℤ-linear map.
      BasisMaps: bool
      /// `hInv ∘ h = id` on the domain — injectivity, in its strongest checkable form.
      LeftInverse: bool
      /// `h ∘ hInv = id` on the domain — surjectivity onto the basis, in its strongest checkable form.
      RightInverse: bool }

    member v.IsBasisBijection = v.BasisMaps && v.LeftInverse && v.RightInverse

let private isBasisMapOn (domain: W list list) (arrow: Meno.Arrow<W list, W list>) : bool =
    domain
    |> List.forall (fun b ->
        match applyBasis arrow b with
        | [ (_, 1L) ] -> true
        | _ -> false)

let private check
    (domain: W list list)
    (h: Meno.Arrow<W list, W list>)
    (hInv: Meno.Arrow<W list, W list>)
    : Verdict =
    { BasisMaps = isBasisMapOn domain h && isBasisMapOn domain hInv
      LeftInverse = domain |> List.forall (fun b -> applyBasis (Meno.compose h hInv) b = [ (b, 1L) ])
      RightInverse = domain |> List.forall (fun b -> applyBasis (Meno.compose hInv h) b = [ (b, 1L) ]) }

// ── The ⟨V⟩ homs under test ──────────────────────────────────────────────────────────────────────

/// Every braid word of length ≤ 3 over the crossings {σ₁^±1, σ₂^±1} — 85 words, the exhaustive
/// 3-strand closure sample. `Hom.ofWord` is the only way in; there is no function-shaped constructor.
let private allHoms : MenoBraided.Hom list =
    let letters = [ 1; -1; 2; -2 ]

    let rec words k =
        if k = 0 then
            [ [] ]
        else
            [ for w in words (k - 1) do
                  yield w
                  for l in letters -> l :: w ]

    words 3 |> List.distinct |> List.map MenoBraided.Hom.ofWord

// ── The negative controls ────────────────────────────────────────────────────────────────────────
// These are what a regression would look like: an arrow hand-written with `Meno.arr` beside `rep` and
// treated as if it were in ⟨V⟩. Each is paired with the BEST claimed inverse available to it, so that a
// rejection is a genuine impossibility and not a straw man.

/// **Δ : V → V⊗V**, copy. `[x] ↦ [x; x]`. Injective, a basis map — and *not surjective on basis*.
let private copyDelta: Meno.Arrow<W list, W list> = Meno.arr (fun xs -> xs @ xs)

/// The best inverse `Δ` can have: the first projection.
let private copyDeltaBestInv: Meno.Arrow<W list, W list> =
    Meno.arr (fun xs -> List.truncate (max 1 (List.length xs / 2)) xs)

/// **ε : V → I**, discard. `[x] ↦ []`. A basis map — and *not injective*.
let private discardEps: Meno.Arrow<W list, W list> = Meno.arr (fun _ -> [])

/// The best inverse `ε` can have: pick some point of V.
let private discardEpsBestInv: Meno.Arrow<W list, W list> = Meno.arr (fun _ -> [ Braid.gen 0 ])

/// **Δ then ε — the LENGTH-PRESERVING copy** `[x; y] ↦ [x; x]`. The sharp mutant: a guard that only
/// compared tensor degree (list length) would pass this, and it is exactly the comonoid composite that
/// would make ⟨V⟩ cartesian.
let private copyThenDiscard: Meno.Arrow<W list, W list> =
    Meno.arr (fun xs ->
        match xs with
        | x :: _ :: rest -> x :: x :: rest
        | _ -> xs)

/// A ℤ-linear **iso** that is not a basis bijection: `s ↦ −s`. It is its own two-sided inverse, so both
/// roundtrip predicates PASS — only `BasisMaps` can reject it. (This is why invertibility alone is not
/// the invariant: ℤ-linear isos may permute the basis *with signs*.)
let private signFlip: Meno.Arrow<W list, W list> =
    Meno.MenoArrow(fun s -> ZSet.scale -1L s)

/// Weight doubling `s ↦ 2s` — not a basis map and not invertible over ℤ.
let private weightDouble: Meno.Arrow<W list, W list> =
    Meno.MenoArrow(fun s -> ZSet.scale 2L s)

// ── 1. Positive: every ⟨V⟩ hom is a basis bijection, exhaustively ────────────────────────────────

[<Fact>]
let ``BB-1: every Hom of length <= 3 is a basis bijection on the 343-element 3-strand basis`` () =
    Assert.Equal(85, List.length allHoms)
    Assert.Equal(343, List.length domain3)

    for h in allHoms do
        let v =
            check domain3 (MenoBraided.Hom.toArrow h) (MenoBraided.Hom.toArrow (MenoBraided.Hom.inverse h))

        Assert.True(v.IsBasisBijection, sprintf "not a basis bijection: word=%A verdict=%A" (MenoBraided.Hom.word h) v)

[<Fact>]
let ``BB-2: Hom.inverse is TOTAL — h ∘ h⁻¹ = h⁻¹ ∘ h = id for every Hom (the type-level bijection witness)`` () =
    for h in allHoms do
        let f = MenoBraided.Hom.toArrow h
        let g = MenoBraided.Hom.toArrow (MenoBraided.Hom.inverse h)

        for b in domain3 do
            Assert.Equal<(W list * int64) list>([ (b, 1L) ], applyBasis (Meno.compose f g) b)
            Assert.Equal<(W list * int64) list>([ (b, 1L) ], applyBasis (Meno.compose g f) b)

[<Fact>]
let ``BB-3: composition and shift stay inside ⟨V⟩ — closure preserves basis bijection`` () =
    // ⊗ and ∘ of bijections are bijections: check the closure operations the type exposes.
    let sample = allHoms |> List.filter (fun h -> List.length (MenoBraided.Hom.word h) <= 2)

    for a in sample do
        for b in sample do
            let c = MenoBraided.Hom.compose a b
            let v = check domain3 (MenoBraided.Hom.toArrow c) (MenoBraided.Hom.toArrow (MenoBraided.Hom.inverse c))
            Assert.True(v.IsBasisBijection, sprintf "compose escaped: %A" (MenoBraided.Hom.word c))

    for a in sample do
        let s = MenoBraided.Hom.shift 1 a
        let v = check domain3 (MenoBraided.Hom.toArrow s) (MenoBraided.Hom.toArrow (MenoBraided.Hom.inverse s))
        Assert.True(v.IsBasisBijection, sprintf "shift escaped: %A" (MenoBraided.Hom.word s))

[<Fact>]
let ``BB-4: rep is exactly Hom.toArrow ∘ Hom.ofWord — the shipped arrow has no second construction path`` () =
    for h in allHoms do
        let w = MenoBraided.Hom.word h

        for b in domain3 do
            Assert.Equal<(W list * int64) list>(applyBasis (MenoBraided.Hom.toArrow h) b, applyBasis (MenoBraided.rep w) b)

[<Fact>]
let ``BB-5: Hom.sigma 0 interpreted on a 2-strand tuple is the shipped braidR — the typed hom and the R-matrix agree`` () =
    let (Meno.MenoArrow r) = MenoBraided.braidR
    let sigma0 = MenoBraided.Hom.toArrow (MenoBraided.Hom.sigma 0)

    for x in alphabet 3 do
        for y in alphabet 3 do
            let viaHom = applyBasis sigma0 [ x; y ] |> List.map (fun (k, w) -> (List.item 0 k, List.item 1 k), w)
            let viaR = [ for e in r (ZSet.singleton (x, y) 1L) -> e.Key, e.Weight ]
            Assert.Equal<((W * W) * int64) list>(viaR, viaHom)

// ── 2. Negative controls — the checker MUST reject these ─────────────────────────────────────────

[<Fact>]
let ``BB-N1: copy Δ is REJECTED — not surjective on basis (RightInverse fails)`` () =
    let v = check domain1 copyDelta copyDeltaBestInv
    Assert.False(v.IsBasisBijection)
    Assert.False(v.RightInverse) // the rejecting predicate
    // …and Δ passes the two OTHER predicates, so `RightInverse` is the one doing the work here.
    Assert.True(v.BasisMaps)
    Assert.True(v.LeftInverse)

[<Fact>]
let ``BB-N1b: copy Δ misses a basis element outright — the direct not-surjective witness`` () =
    // (x₀, x₁) is a basis element of V⊗V that no `[x]` maps to under Δ. Independent of any claimed
    // inverse: this is the categorical fact, checked.
    let image = domain1 |> List.map (fun b -> applyBasis copyDelta b |> List.map fst) |> List.concat
    Assert.DoesNotContain([ Braid.gen 0; Braid.gen 1 ], image)

[<Fact>]
let ``BB-N2: discard ε is REJECTED — not injective (LeftInverse fails)`` () =
    let v = check domain1 discardEps discardEpsBestInv
    Assert.False(v.IsBasisBijection)
    Assert.False(v.LeftInverse) // the rejecting predicate

[<Fact>]
let ``BB-N2b: discard ε collapses two distinct basis elements — the direct not-injective witness`` () =
    Assert.Equal<(W list * int64) list>(
        applyBasis discardEps [ Braid.gen 0 ],
        applyBasis discardEps [ Braid.gen 1 ])

[<Fact>]
let ``BB-N3: the LENGTH-PRESERVING copy Δ∘ε is REJECTED — a degree-only guard would pass it`` () =
    let identityArrow: Meno.Arrow<W list, W list> = Meno.arr id
    let v = check domain2 copyThenDiscard identityArrow
    Assert.False(v.IsBasisBijection)
    Assert.False(v.LeftInverse)
    // It IS length-preserving and IS a basis map — the two properties a weaker guard would have checked.
    Assert.True(v.BasisMaps)
    Assert.True(domain2 |> List.forall (fun b ->
        applyBasis copyThenDiscard b |> List.forall (fun (k, _) -> List.length k = List.length b)))

[<Fact>]
let ``BB-N4: the sign flip s ↦ −s is REJECTED by BasisMaps ALONE — invertibility is not the invariant`` () =
    let v = check domain2 signFlip signFlip
    Assert.False(v.IsBasisBijection)
    Assert.False(v.BasisMaps) // the rejecting predicate — and the ONLY one that rejects
    Assert.True(v.LeftInverse)
    Assert.True(v.RightInverse)

[<Fact>]
let ``BB-N5: weight doubling s ↦ 2s is REJECTED`` () =
    let identityArrow: Meno.Arrow<W list, W list> = Meno.arr id
    let v = check domain2 weightDouble identityArrow
    Assert.False(v.IsBasisBijection)
    Assert.False(v.BasisMaps)

[<Fact>]
let ``BB-N6: no braid word of length <= 3 realizes the copy — exhaustive closure, not an assumption`` () =
    // The rung-1 claim, checked at the semantic level rather than trusted from the type: none of the 85
    // ⟨V⟩ homs acts like `Δ∘ε` on the 2-strand basis. (Type-level, `copyThenDiscard` cannot even be a
    // `Hom`; this is the belt to that suspenders, and it is what would catch a `crossingOnList` that
    // silently stopped being invertible.)
    for h in allHoms do
        let f = MenoBraided.Hom.toArrow h
        let agrees = domain2 |> List.forall (fun b -> applyBasis f b = applyBasis copyThenDiscard b)
        Assert.False(agrees, sprintf "a braid word realized the copy: %A" (MenoBraided.Hom.word h))

// ── 3. The concrete non-cartesian witness over S₃ (exact, independent of Braid.fs) ───────────────
// A second implementation of the same conjugation rack, over a finite group, built from permutations —
// no free-group words, no shared code with `Braid`. If the two disagree, that is a FINDING.

type private Perm = int list

let private s3: Perm list =
    [ for a in 0..2 do
          for b in 0..2 do
              for c in 0..2 do
                  if a <> b && b <> c && a <> c then yield [ a; b; c ] ]

/// (p ∘ q)(i) = p(q(i)).
let private pmul (p: Perm) (q: Perm) : Perm = q |> List.map (fun i -> List.item i p)

let private pinv (p: Perm) : Perm = [ for i in 0..2 -> List.findIndex ((=) i) p ]

/// The rack R(x, y) = (x·y·x⁻¹, x) — the same formula `MenoBraided.braidR` uses, over S₃.
let private rS3 (x: Perm, y: Perm) : Perm * Perm = (pmul (pmul x y) (pinv x), x)

let private s3Pairs: (Perm * Perm) list =
    [ for x in s3 do
          for y in s3 -> (x, y) ]

[<Fact>]
let ``BB-S3-1: R is a bijection on S₃ × S₃ — 36 of 36, exact`` () =
    Assert.Equal(6, List.length s3)
    Assert.Equal(36, List.length s3Pairs)
    Assert.Equal(36, s3Pairs |> List.map rS3 |> List.distinct |> List.length)

[<Fact>]
let ``BB-S3-2: π₁∘R ≠ π₂ on 18 of 36 pairs — the concrete refutation of a cartesian ambient`` () =
    // In a cartesian category naturality of `c` against `!_A : A → I` forces π₁∘c = π_B. Here π₁∘R =
    // x·y·x⁻¹, which differs from y exactly on the non-commuting pairs. |{(x,y) : xy ≠ yx}| in S₃ is
    // 36 − Σ_x |C(x)| = 36 − (6 + 3·2 + 2·3) = 18.
    let differs = s3Pairs |> List.filter (fun (x, y) -> fst (rS3 (x, y)) <> y) |> List.length
    Assert.Equal(18, differs)

[<Fact>]
let ``BB-S3-3: negative control — the swap has π₁∘c = π₂ on ALL 36, so the 18 above is discriminating`` () =
    let swap (x: Perm, y: Perm) = (y, x)
    Assert.Equal(36, s3Pairs |> List.map swap |> List.distinct |> List.length) // also a bijection…
    let differs = s3Pairs |> List.filter (fun (x, y) -> fst (swap (x, y)) <> y) |> List.length
    Assert.Equal(0, differs) // …but never differs — bijectivity alone does not separate R from the swap

[<Fact>]
let ``BB-S3-4: R² ≠ id on S₃ — braided, not symmetric, in the independent model too`` () =
    let fixedPoints = s3Pairs |> List.filter (fun p -> rS3 (rS3 p) = p) |> List.length
    Assert.NotEqual(36, fixedPoints)
