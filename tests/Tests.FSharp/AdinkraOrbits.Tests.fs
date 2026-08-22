module Zeta.Tests.AdinkraOrbitsTests

// ADINKRA ORBITS CLASSIFY MEMBERS (shadow*, Aaron's next-rung #3). Ties the adinkra
// member-identity thread (#9157) to the scheduler dynamical zeta (#9151): a
// CODE-PRESERVING round-map on GF(2)^8 keeps every member's purpose-codeword a valid
// identity, and the Artin–Mazur zeta of that map — restricted to the code — has
// periodic ORBITS that partition the 16 member-identities into PURPOSE CLASSES.
//
// The round-map is a CODE AUTOMORPHISM: a coordinate permutation π of the 8 bit
// positions with π(C) = C (found by exhaustive search over the [8,4,4] adinkra code
// from Zeta.Core.AdinkraCode). "Identity-preserving dynamics": no member is ever
// mapped to a non-identity. The dynamical zeta
//     ζ_π(u) = exp(Σ Fix(π^k) u^k/k) = Π_[orbit] (1 − u^|O|)^(−1)
// is self-verified (fixed-point counts vs. orbit decomposition, same discipline as
// #9151), and its orbits ARE the member classes.
//
// Anchors: S. James Gates Jr. (adinkras ↔ doubly-even codes); Artin–Mazur 1965;
// the code's automorphism group (AGL(3,2), order 1344, for the extended Hamming
// [8,4,4]) — asserted here as a comment since 2026-06, MEASURED as of 2026-08-15 in
// the two `AGL(3,2)` facts at the bottom of this file. Trajectory:
// docs/trajectories/zeta-name-audition/RESUME.md.

open global.Xunit

module AK = Zeta.Core.AdinkraCode

let private toBits (cw: int[]) : int = Array.fold (fun acc b -> (acc <<< 1) ||| (b &&& 1)) 0 cw
let private code : int list = AK.allCodewords |> List.map toBits
let private codeSet = Set.ofList code

/// Apply a bit-position permutation to a codeword bitmask.
let private applyPerm (perm: int[]) (c: int) : int =
    let mutable r = 0
    for i in 0 .. 7 do
        if (c >>> i) &&& 1 = 1 then r <- r ||| (1 <<< perm.[i])
    r

let private isAutomorphism (perm: int[]) : bool =
    code |> List.forall (fun c -> Set.contains (applyPerm perm c) codeSet)

let private allPerms (n: int) : int[] list =
    let rec go xs =
        match xs with
        | [] -> [ [] ]
        | _ -> xs |> List.collect (fun x -> go (List.filter ((<>) x) xs) |> List.map (fun p -> x :: p))
    go [ 0 .. n - 1 ] |> List.map List.toArray

/// The first non-identity code automorphism (lexicographic) with an orbit of length
/// ≥ 2 on the codewords — a genuinely dynamical, deterministic choice.
let private chosenAuto : int[] =
    let identity = [| 0 .. 7 |]
    allPerms 8
    |> List.filter isAutomorphism
    |> List.filter (fun p -> p <> identity)
    |> List.find (fun p -> code |> List.exists (fun c -> applyPerm p c <> c))

/// Orbit lengths of the codewords under π (cycle decomposition of π on C).
let private orbitLengths (perm: int[]) : int list =
    let seen = System.Collections.Generic.HashSet<int>()
    [ for c in code do
        if not (seen.Contains c) then
            let mutable len = 0
            let mutable y = c
            let mutable go = true
            while go do
                seen.Add y |> ignore
                y <- applyPerm perm y
                len <- len + 1
                if y = c then go <- false
            yield len ]

let private fixCount (perm: int[]) (k: int) : int64 =
    // # codewords fixed by π^k
    let piK c = let mutable y = c in (for _ in 1 .. k do y <- applyPerm perm y); y
    code |> List.filter (fun c -> piK c = c) |> List.length |> int64

[<Fact>]
let ``the round-map is a CODE AUTOMORPHISM: it preserves the code (every member identity stays an identity)`` () =
    Assert.True(isAutomorphism chosenAuto)
    // no codeword ever leaves the code under iteration
    for c in code do
        Assert.True(Set.contains (applyPerm chosenAuto c) codeSet)

[<Fact>]
let ``the dynamical zeta of the map self-verifies: exp(Σ Fix(π^k)u^k/k) = Π orbit 1/(1-u^len)`` () =
    let maxDeg = 16
    // exp side (integer log-derivative recurrence)
    let byExp =
        let c = Array.zeroCreate (maxDeg + 1)
        c.[0] <- 1L
        for m in 1 .. maxDeg do
            let mutable s = 0L
            for k in 1 .. m do s <- s + fixCount chosenAuto k * c.[m - k]
            Assert.True(s % int64 m = 0L, sprintf "recurrence: %d not divisible by %d" s m)
            c.[m] <- s / int64 m
        c
    // orbit-product side
    let byOrbit =
        let mutable series = Array.zeroCreate (maxDeg + 1)
        series.[0] <- 1L
        for L in orbitLengths chosenAuto do
            let geom = Array.init (maxDeg + 1) (fun d -> if d % L = 0 then 1L else 0L)
            let prod = Array.zeroCreate (maxDeg + 1)
            for i in 0 .. maxDeg do
                for j in 0 .. maxDeg - i do
                    prod.[i + j] <- prod.[i + j] + series.[i] * geom.[j]
            series <- prod
        series
    for m in 0 .. maxDeg do
        Assert.True(byExp.[m] = byOrbit.[m], sprintf "degree %d: exp %d, orbit %d" m byExp.[m] byOrbit.[m])

[<Fact>]
let ``the orbits PARTITION the 16 members into purpose classes (Σ orbit lengths = 16), non-trivially`` () =
    let orbits = orbitLengths chosenAuto
    Assert.Equal(16, List.sum orbits)                       // every member classified, once
    Assert.True(List.exists (fun l -> l >= 2) orbits, "a genuinely dynamical class (orbit length ≥ 2) exists")
    // the all-zero (quiescent) identity is always a fixed point — its own class
    Assert.Contains(1, orbits)

// ── |Aut([8,4,4])| = 1344, AND IT IS AGL(3,2) ─────────────────────────────────────────────────
//
// The header above has carried "AGL(3,2), order 1344" as an untested comment since 2026-06. It is
// correct; these two facts are its falsifier. Over GF(2) a linear code has no non-trivial scalars,
// so the automorphism group IS the permutation group of the 8 coordinates preserving the code —
// exactly what `isAutomorphism` decides, and 8! = 40320 is small enough to settle exhaustively.
//
// **What was already metered, and what was not** (recorded so this does not read as new ground it
// is not): the ORDER 1344 has been under test since 2026-07-04 — `SoftRegimeEquivariance.Tests.fs`
// `EQV-1`, landed #9468, exhaustive, in this same assembly. It uses the opposite coordinate
// convention (`cw.[perm.[j]]` there, `bit i ↦ position perm.[i]` here), so the two are a genuine
// cross-check rather than a copy; a group and its inverse-image group have the same order, and both
// routes say 1344. What was NEVER metered is the IDENTIFICATION — that the group is AGL(3,2) — and
// that is precisely the numerology/number-theory gap: the count was measured, the name was asserted.
// The second fact below is the part that is new.
//
// **1344 alone identifies nothing** (`numerology-vs-number-theory.md`). Groups of order 1344 that
// are NOT AGL(3,2) include the direct product 2³ × GL(3,2) and C₄ × PGL(2,7); and even restricting
// to 3-transitive groups of degree 8 — PGL(2,7) (336), AGL(3,2) (1344), A₈ (20160), S₈ (40320) —
// the count only discriminates once 3-transitivity and the degree are already in hand. What
// identifies the group is structure:
//
//   G is transitive on the 8 coordinates, and has a normal subgroup T with |T| = 8, elementary
//   abelian, acting REGULARLY. Regularity gives the split G = T ⋊ G₀ for a point stabiliser G₀ with
//   |G₀| = 1344/8 = 168; G₀ acts on T ≅ F₂³ by conjugation, faithfully (an element acting trivially
//   on T and fixing a point fixes every point, since T is transitive), so G₀ ↪ GL(3,2). And
//   |GL(3,2)| = 168 = |G₀|, so G₀ IS all of GL(3,2) and G ≅ F₂³ ⋊ GL(3,2) = AGL(3,2).
//
// The structural WHY: the in-tree [8,4,4] code is coordinate-equivalent to the first-order
// Reed–Muller code RM(1,3) — coordinates indexed by the points of AG(3,2), codewords the evaluation
// vectors of the 16 affine functions F₂³ → F₂ (1 of weight 0, 14 of weight 4, 1 of weight 8, which
// is exactly the weight enumerator `AdinkraCode.weightEnumerator` reports). A coordinate permutation
// preserves the affine functions iff it is itself affine — hence AGL(3,2).
// Anchor (checked, not merely cited): MacWilliams & Sloane, *The Theory of Error-Correcting Codes*
// (1977), Ch. 13 §9 Thm 24 — Aut(RM(r,m)) = GA(m,2) for 0 < r < m.

/// Pack an 8-point permutation into 24 bits so it can be a hashable set/dictionary key.
let private packPerm (p: int[]) : int =
    let mutable k = 0
    for i in 0..7 do
        k <- k ||| (p.[i] <<< (3 * i))
    k

let private unpackPerm (k: int) : int[] = Array.init 8 (fun i -> (k >>> (3 * i)) &&& 7)

/// (a ∘ b)[i] = a[b[i]] — matches `applyPerm a (applyPerm b c) = applyPerm (compose a b) c`.
let private compose (a: int[]) (b: int[]) : int[] = Array.init 8 (fun i -> a.[b.[i]])

let private invert (a: int[]) : int[] =
    let r = Array.zeroCreate 8
    for i in 0..7 do
        r.[a.[i]] <- i
    r

let private identityPerm = [| 0..7 |]

/// The FULL automorphism group, exhaustively over all 8! coordinate permutations.
let private autGroup: int[] list = allPerms 8 |> List.filter isAutomorphism

let private autKeys = autGroup |> List.map packPerm |> Set.ofList

/// Conjugacy classes of the automorphism group, as key sets.
let private conjugacyClasses: Set<int> list =
    let mutable seen = Set.empty
    [ for x in autGroup do
          let k = packPerm x
          if not (Set.contains k seen) then
              let cl =
                  autGroup
                  |> List.map (fun g -> packPerm (compose (compose g x) (invert g)))
                  |> Set.ofList

              seen <- Set.union seen cl
              yield cl ]

[<Fact>]
let ``|Aut([8,4,4])| = 1344 — measured exhaustively over all 8! coordinate permutations, not asserted`` () =
    Assert.Equal(40320, List.length (allPerms 8)) // the search really is exhaustive over S₈
    Assert.Equal(1344, List.length autGroup)
    // ...and the gate is not vacuous: most permutations are REJECTED
    Assert.Equal(40320 - 1344, List.length (allPerms 8 |> List.filter (isAutomorphism >> not)))
    // transitive on the 8 coordinates, with a point stabiliser of order 168 = |GL(3,2)|
    Assert.Equal<Set<int>>(Set.ofList [ 0..7 ], autGroup |> List.map (fun p -> p.[0]) |> Set.ofList)
    let stabiliser = autGroup |> List.filter (fun p -> p.[0] = 0)
    Assert.Equal(168, List.length stabiliser)
    Assert.Equal(1344, 8 * List.length stabiliser) // orbit-stabiliser, closed

[<Fact>]
let ``the group IS AGL(3,2), not merely a group of order 1344: a REGULAR normal 2³ with the full GL(3,2) as point stabiliser`` () =
    // The class equation — a structural fingerprint, far stronger than the order alone.
    Assert.Equal<int list>(
        [ 1; 7; 42; 42; 84; 168; 168; 192; 192; 224; 224 ],
        conjugacyClasses |> List.map Set.count |> List.sort
    )

    // T = identity ∪ the UNIQUE class of size 7 — the translations of AG(3,2).
    let sevens = conjugacyClasses |> List.filter (fun c -> Set.count c = 7)
    Assert.Equal(1, List.length sevens) // canonical: there is only one such class to pick
    let t = Set.add (packPerm identityPerm) (List.head sevens)
    Assert.Equal(8, Set.count t)

    let tElems = t |> Set.toList |> List.map unpackPerm
    // ELEMENTARY ABELIAN: every non-identity element is an involution, and T is abelian ⇒ T ≅ F₂³
    for x in tElems do
        Assert.Equal<int[]>(identityPerm, compose x x)

    for x in tElems do
        for y in tElems do
            Assert.Equal<int[]>(compose x y, compose y x)
            Assert.True(Set.contains (packPerm (compose x y)) t, "T is closed under composition")

    // NORMAL in Aut
    for g in autGroup do
        for x in tElems do
            Assert.True(Set.contains (packPerm (compose (compose g x) (invert g))) t, "T ⊲ Aut")

    // REGULAR: T is transitive on the 8 coordinates and |T| = 8, so stabilisers in T are trivial.
    Assert.Equal<Set<int>>(Set.ofList [ 0..7 ], tElems |> List.map (fun p -> p.[0]) |> Set.ofList)
    Assert.Equal(1, tElems |> List.filter (fun p -> p.[0] = 0) |> List.length)

    // ⇒ G = T ⋊ G₀ with |G₀| = 1344/8 = 168 = |GL(3,2)| ⇒ G₀ = GL(3,2) ⇒ G = AGL(3,2).
    Assert.Equal(168, autGroup |> List.filter (fun p -> p.[0] = 0) |> List.length)

    // EXCLUDING the same-order competitors, mechanically:
    // 2³ × GL(3,2) and C₄ × PGL(2,7) both have order 1344 and both have a non-trivial centre.
    let centre =
        autGroup
        |> List.filter (fun g -> autGroup |> List.forall (fun h -> compose g h = compose h g))

    Assert.Equal(1, List.length centre)

    // 3-transitive but NOT 4-transitive (PGL(2,7), the other 3-transitive degree-8 group, has
    // order 336; A₈/S₈ are 4-transitive — so this pair of counts separates all four).
    let triples = autGroup |> List.map (fun g -> g.[0], g.[1], g.[2]) |> List.distinct
    Assert.Equal(8 * 7 * 6, List.length triples) // 336 — sharply 3-transitive on ordered triples

    let quads = autGroup |> List.map (fun g -> g.[0], g.[1], g.[2], g.[3]) |> List.distinct
    Assert.Equal(1344, List.length quads)
    Assert.True(List.length quads < 8 * 7 * 6 * 5, "not 4-transitive: 1344 < 1680")

    // and the code whose automorphisms these are is the one `AdinkraCode` ships (RM(1,3)'s
    // weight enumerator: one 0, fourteen 4s, one 8)
    Assert.Equal<(int * int) list>([ 0, 1; 4, 14; 8, 1 ], AK.weightEnumerator)
