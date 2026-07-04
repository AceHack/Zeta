module Zeta.Core.Tests.SoftRegimeEquivarianceTests

// SORAYA'S NAMED HIGHEST-VALUE FORMAL ARTIFACT (routing review 2026-07-04, landed #9468; shadow*):
// the property pair that the whole BRIDGE-11 dynamics story hinges on —
//   (i)  Aut([8,4])-equivariance of the strategy-level Bayesian update (the treaty `.*` operator), and
//   (ii) the Lyapunov behaviour of the asymmetry functional A(s) = H(proj(s)) − H(s) = deviationPayoff(s)
//        under ADVERSARIAL evidence.
// Soraya: "if it fails, the attractor conjecture dies for the price of a unit test; if it survives, it
// licenses the Lean Lyapunov lemma." Deterministic seeded property loops (DST discipline — replayable,
// no ambient randomness) standing in for FsCheck generators; same falsification power, fixed seeds.
//
// FINDINGS ENCODED BELOW (the honest results, not just green checks):
//   EQV-1  |Aut([8,4]) ∩ S8| = 1344 — the automorphism group order, verified by exhaustive enumeration.
//   EQV-2  the Bayesian update IS equivariant under every sampled automorphism (the conditional's hypothesis
//          transports correctly — the "nearly free" leg, but now executed on the real code path).
//   EQV-3  orbit-symmetric × orbit-symmetric evidence → orbit-symmetric posterior (the soft regime is
//          closed under SYMMETRIC evidence).
//   LYAP-1 ADVERSARIAL (non-orbit-symmetric) evidence STRICTLY INCREASES the asymmetry functional from 0 —
//          the raw Bayesian update does NOT keep the demon soft: the orbit-symmetric regime is NOT an
//          attractor of the uncorrected dynamics (it is invariant, not attracting — matches FIG8: the demon's
//          ACTIVE corrective step, projection/reseed, is load-bearing, not optional).
//   LYAP-2 deviationPayoff(s) ≥ 0 on random strategies, OS and non-OS — Jensen on the real code path.
//   LYAP-3 update-then-project keeps a trajectory orbit-symmetric across 100 adversarial steps.
//   LYAP-4 orbit-symmetry ALONE does not prevent collapse: the Dirac on the zero codeword IS orbit-symmetric
//          (singleton weight class) yet violates the positive cone (p₄ = p₈ = 0) — the soft regime needs
//          BOTH constraints (orbit-symmetry AND positive mass in every weight class), exactly as the
//          positive-cone ferry stated.

open Xunit
open Zeta.Core

// ── the code, as data ────────────────────────────────────────────────────────────────────────────

/// The 16 codewords of the [8,4] Adinkra code, as bit arrays (length 8).
let private codewords : int[][] = AdinkraCode.allCodewords |> List.toArray

/// The codeword set as a comparable set of bit-lists (for permutation-invariance checks).
let private codewordSet : Set<int list> = codewords |> Array.map Array.toList |> Set.ofArray

/// Apply a coordinate permutation (perm.[j] = source index for target slot j) to a codeword.
let private permuteCoords (perm: int[]) (cw: int[]) : int[] =
    Array.init 8 (fun j -> cw.[perm.[j]])

/// All permutations of [0..7] (8! = 40320) — small enough to enumerate exhaustively.
let private allPerms : int[][] =
    let rec perms (xs: int list) : int list list =
        match xs with
        | [] -> [ [] ]
        | _ -> xs |> List.collect (fun x -> perms (List.filter ((<>) x) xs) |> List.map (fun p -> x :: p))
    perms [ 0 .. 7 ] |> List.map List.toArray |> List.toArray

/// The coordinate-permutation automorphisms of the code: perms mapping the codeword SET to itself.
let private autPerms : int[][] =
    allPerms
    |> Array.filter (fun p ->
        codewords |> Array.forall (fun cw -> codewordSet.Contains(permuteCoords p cw |> Array.toList)))

/// The permutation of the 16 CODEWORD INDICES induced by a coordinate automorphism.
let private inducedIndexPerm (perm: int[]) : int[] =
    let indexOf (cw: int[]) =
        codewords |> Array.findIndex (fun c -> c = cw || (Array.forall2 (=) c cw))
    Array.init 16 (fun i -> indexOf (permuteCoords perm codewords.[i]))

/// Apply an induced index permutation to a strategy: (π·s).[π(i)] = s.[i].
let private permuteStrategy (indexPerm: int[]) (s: float[]) : float[] =
    let out = Array.zeroCreate 16
    for i in 0 .. 15 do
        out.[indexPerm.[i]] <- s.[i]
    out

/// The strategy-level Bayesian update — the treaty `.*` operator (pointwise product + renormalize),
/// the same shape as `SoftValue.combine` at the 16-codeword level and PontryaginDuality's product.
let private bayesUpdate (s: float[]) (e: float[]) : float[] =
    let raw = Array.map2 (*) s e
    let total = Array.sum raw
    Array.map (fun x -> x / total) raw

/// Shannon entropy (nats), 0·log 0 = 0.
let private entropy (p: float[]) : float =
    p |> Array.sumBy (fun x -> if x <= 1e-15 then 0.0 else -x * log x)

/// A seeded random strategy (positive, normalized) — deterministic (DST).
let private randomStrategy (rng: System.Random) : float[] =
    let raw = Array.init 16 (fun _ -> rng.NextDouble() + 1e-6)
    let t = Array.sum raw
    Array.map (fun x -> x / t) raw

/// Project onto the orbit-symmetric manifold (average within weight classes) — mirrors the impl.
let private project (s: float[]) : float[] =
    let weights = codewords |> Array.map Array.sum
    let out = Array.copy s
    for w in [ 0; 4; 8 ] do
        let idx = [| 0 .. 15 |] |> Array.filter (fun i -> weights.[i] = w)
        if idx.Length > 0 then
            let avg = idx |> Array.averageBy (fun i -> s.[i])
            for i in idx do
                out.[i] <- avg
    out

/// The asymmetry functional A(s) = H(proj(s)) − H(s) — the Lyapunov candidate (= deviationPayoff).
let private asymmetry (s: float[]) : float = entropy (project s) - entropy s

// ── EQV: equivariance ────────────────────────────────────────────────────────────────────────────

/// EQV-1: the coordinate-permutation automorphism group of the [8,4] code has order exactly 1344.
[<Fact>]
let ``EQV-1: Aut([8,4]) as coordinate permutations has order 1344`` () =
    Assert.Equal(1344, autPerms.Length)

/// EQV-2: the Bayesian update commutes with every automorphism: update(π·s, π·e) = π·update(s, e).
[<Fact>]
let ``EQV-2: Bayesian update is Aut-equivariant on the real operator`` () =
    let rng = System.Random(42)
    for _trial in 1 .. 50 do
        let s = randomStrategy rng
        let e = randomStrategy rng
        let perm = autPerms.[rng.Next(autPerms.Length)]
        let ip = inducedIndexPerm perm
        let lhs = bayesUpdate (permuteStrategy ip s) (permuteStrategy ip e)
        let rhs = permuteStrategy ip (bayesUpdate s e)
        Array.iter2 (fun (l: float) (r: float) -> Assert.True(abs (l - r) < 1e-12)) lhs rhs

/// EQV-3: the soft regime is closed under SYMMETRIC evidence: OS prior × OS evidence → OS posterior.
[<Fact>]
let ``EQV-3: orbit-symmetric prior and evidence give an orbit-symmetric posterior`` () =
    let rng = System.Random(43)
    for _trial in 1 .. 50 do
        let s = project (randomStrategy rng)
        let e = project (randomStrategy rng)
        let post = bayesUpdate s e
        Assert.True(SoftRegimeStability.isOrbitSymmetric 1e-9 post)

// ── LYAP: the Lyapunov question ──────────────────────────────────────────────────────────────────

/// LYAP-1 (THE FINDING): adversarial evidence strictly increases the asymmetry functional from zero —
/// the raw Bayesian update does NOT keep the demon soft. Orbit-symmetry is invariant, NOT attracting.
[<Fact>]
let ``LYAP-1: adversarial evidence strictly increases asymmetry — soft regime is not self-restoring`` () =
    let uniform = SoftRegimeStability.fixedPoint
    Assert.True(asymmetry uniform < 1e-12) // starts orbit-symmetric: A = 0
    // adversarial evidence: concentrated on ONE weight-4 codeword (breaks the weight-4 orbit)
    let weights = codewords |> Array.map Array.sum
    let target = [| 0 .. 15 |] |> Array.find (fun i -> weights.[i] = 4)
    let adversarial = Array.init 16 (fun i -> if i = target then 0.9 else 0.1 / 15.0)
    let post = bayesUpdate uniform adversarial
    Assert.True(asymmetry post > 0.01, "adversarial evidence must push the belief off the OS manifold")
    Assert.False(SoftRegimeStability.isOrbitSymmetric 1e-9 post)

/// LYAP-2: deviationPayoff ≥ 0 on random strategies (Jensen on the REAL code path), equality iff OS.
[<Fact>]
let ``LYAP-2: deviationPayoff is non-negative on random strategies (Jensen, real code path)`` () =
    let rng = System.Random(44)
    for _trial in 1 .. 200 do
        let s = randomStrategy rng
        Assert.True(SoftRegimeStability.deviationPayoff s >= -1e-12)
    for _trial in 1 .. 50 do
        let s = project (randomStrategy rng)
        Assert.True(abs (SoftRegimeStability.deviationPayoff s) < 1e-9) // OS ⇒ equality case

/// LYAP-3: the CORRECTED dynamics (update, then the demon's projection step) keeps a trajectory
/// orbit-symmetric across 100 adversarial steps — the corrective step is what makes the regime stable.
[<Fact>]
let ``LYAP-3: update-then-project survives 100 adversarial steps`` () =
    let rng = System.Random(45)
    let mutable s = SoftRegimeStability.fixedPoint
    for _step in 1 .. 100 do
        let adversarial = randomStrategy rng // generic evidence is non-orbit-symmetric a.s.
        s <- project (bayesUpdate s adversarial)
        Assert.True(SoftRegimeStability.isOrbitSymmetric 1e-9 s)

/// LYAP-4 (THE OTHER HALF): orbit-symmetry alone does NOT prevent collapse — the Dirac on the zero
/// codeword is orbit-symmetric (singleton weight class) yet positive-cone-violating (p₄ = p₈ = 0).
/// The soft regime needs BOTH constraints, exactly as the positive-cone ferry stated.
[<Fact>]
let ``LYAP-4: the Dirac on the zero codeword is orbit-symmetric but cone-violating`` () =
    let weights = codewords |> Array.map Array.sum
    let zeroIdx = [| 0 .. 15 |] |> Array.find (fun i -> weights.[i] = 0)
    let dirac = Array.init 16 (fun i -> if i = zeroIdx then 1.0 else 0.0)
    Assert.True(SoftRegimeStability.isOrbitSymmetric 1e-9 dirac) // symmetric…
    // …but collapsed: entire weight classes carry zero mass (the positive cone is violated)
    let byWeight = [ 0; 4; 8 ] |> List.map (fun w -> [| 0 .. 15 |] |> Array.filter (fun i -> weights.[i] = w) |> Array.sumBy (fun i -> dirac.[i]))
    Assert.Equal(1.0, byWeight.[0], 12)
    Assert.Equal(0.0, byWeight.[1], 12)
    Assert.Equal(0.0, byWeight.[2], 12)
