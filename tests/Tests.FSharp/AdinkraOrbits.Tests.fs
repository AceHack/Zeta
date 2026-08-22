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
// [8,4,4]). Trajectory: docs/trajectories/zeta-name-audition/RESUME.md.

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
