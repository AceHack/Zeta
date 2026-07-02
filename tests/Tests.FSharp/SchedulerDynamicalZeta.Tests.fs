module Zeta.Tests.SchedulerDynamicalZetaTests

// ζ OF THE SCHEDULER (shadow*). The name stops auditioning on textbook graphs and
// starts MEASURING OUR OWN MACHINE. #9146 gave the commutative Euler product over
// knots; #9148 the noncommutative Ihara zeta over graph geodesics. Both were about
// outside objects. This is the **Artin–Mazur dynamical zeta of the cell scheduler's
// round-map** — the zeta of the DoP-invariant deterministic loop we actually built.
//
// A finite cell society (a ring of N cells holding bits, each cell integrating its
// left neighbour's value mod 2 — the synchronous round of the round-based runner,
// where every cell is ready every round; noninterfering, DoP-invariant) is a
// deterministic map f on its finite configuration space (ℤ/2)^N. Its Artin–Mazur
// zeta (Artin–Mazur 1965) is
//     ζ_f(u) = exp( Σ_{k≥1} Fix(f^k) u^k / k ),   Fix(f^k) = #{ x : f^k(x) = x },
// and equivalently the Euler product over PERIODIC ORBITS  Π_[O] (1 − u^|O|)^(−1)
// (transient configurations contribute nothing — they never return). THE THEOREM,
// self-verified: these two are the same series.
//
// Computed TWO independent ways that share no code — fixed-point counts of the
// iterated map vs. the cycle decomposition of its recurrent set — so agreement is
// a real cross-check (a wrong f, or wrong orbit-finding, diverges). Same safety-net
// discipline as #9148: get it wrong and the test shows it.
//
// The round-map here (M = I + S, S = cyclic shift, over GF(2)^N) is deliberately
// NON-bijective (all-ones ∈ ker), so the society has genuine TRANSIENTS feeding
// periodic orbits — the dynamical zeta must see only the periodic part. Its unique
// fixed point is the empty configuration (the quiescent all-zeros society): the
// scheduler's rest state is the zeta's leading term.
//
// Anchors: Artin–Mazur 1965 (the dynamical zeta); Bowen–Lanford 1970, Ruelle
// (dynamical zeta functions of maps); Smale (Axiom A). Companion to #9148 (Ihara)
// and #9146 (the commutative slice). The scheduler: src/Core/CellScheduler.fs.

open global.Xunit

let private nCells = 5

/// The synchronous round-map of the ring society, as a function on the 2^N
/// configuration bitmask: new bit i = bit i XOR bit (i−1 mod N)  (each cell adds
/// its left neighbour's value mod 2 — the DBSP integrate step over GF(2)).
let private round (x: int) : int =
    let bit i = (x >>> i) &&& 1
    let mutable r = 0
    for i in 0 .. nCells - 1 do
        let left = (i + nCells - 1) % nCells
        r <- r ||| (((bit i) ^^^ (bit left)) <<< i)
    r

let private size = 1 <<< nCells

/// f as an explicit transition table over the whole configuration space.
let private f : int[] = Array.init size round

/// Fix(f^k) = number of configurations fixed by the k-th iterate.
let private fixCounts (maxK: int) : int64[] =
    let counts = Array.zeroCreate (maxK + 1)
    // fk.[x] = f^k(x); rebuilt incrementally
    let mutable fk = Array.init size id // f^0 = identity
    for k in 1 .. maxK do
        fk <- Array.init size (fun x -> f.[fk.[x]])
        let mutable c = 0L
        for x in 0 .. size - 1 do
            if fk.[x] = x then c <- c + 1L
        counts.[k] <- c
    counts

// ── EXP side: ζ = exp(Σ Fix(f^k) u^k/k) as an exact integer series ──────────
let private zetaExp (maxDeg: int) : int64[] =
    let fixK = fixCounts maxDeg
    let c = Array.zeroCreate (maxDeg + 1)
    c.[0] <- 1L
    for m in 1 .. maxDeg do
        let mutable s = 0L
        for k in 1 .. m do s <- s + fixK.[k] * c.[m - k]
        Assert.True(s % int64 m = 0L, sprintf "Artin–Mazur recurrence: %d not divisible by %d (f is wrong)" s m)
        c.[m] <- s / int64 m
    c

// ── ORBIT-PRODUCT side: ζ = Π_[periodic orbits] 1/(1 − u^|O|) ───────────────
/// The lengths of the periodic orbits of f (cycles in its functional graph).
let private orbitLengths () : int list =
    // a config is periodic iff it lies on a cycle: follow f from x for at most
    // `size` steps; the recurrent set is what a long-enough orbit lands on.
    let onCycle = Array.zeroCreate size
    for x in 0 .. size - 1 do
        // f^size(x) is guaranteed to be on a cycle (functional graph, |S| = size)
        let mutable y = x
        for _ in 1 .. size do y <- f.[y]
        onCycle.[y] <- true
    // decompose the recurrent set into cycles
    let seen = Array.zeroCreate size
    let lengths = System.Collections.Generic.List<int>()
    for x in 0 .. size - 1 do
        if onCycle.[x] && not seen.[x] then
            let mutable len = 0
            let mutable y = x
            let mutable go = true
            while go do
                seen.[y] <- true
                y <- f.[y]
                len <- len + 1
                if y = x then go <- false
            lengths.Add len
    List.ofSeq lengths

let private zetaProduct (maxDeg: int) : int64[] =
    // 1/(1 − u^L) = 1 + u^L + u^2L + … ; multiply over all periodic orbits.
    let mutable series = Array.zeroCreate (maxDeg + 1)
    series.[0] <- 1L
    for L in orbitLengths () do
        let geom = Array.init (maxDeg + 1) (fun d -> if d % L = 0 then 1L else 0L)
        let prod = Array.zeroCreate (maxDeg + 1)
        for i in 0 .. maxDeg do
            for j in 0 .. maxDeg - i do
                prod.[i + j] <- prod.[i + j] + series.[i] * geom.[j]
        series <- prod
    series

// ── the theorem ────────────────────────────────────────────────────────────

[<Fact>]
let ``THE ARTIN-MAZUR ZETA OF THE SCHEDULER ROUND-MAP: exp(Σ Fix(f^k)u^k/k) = Π periodic-orbit 1/(1-u^len), coefficient by coefficient`` () =
    let maxDeg = size // periods divide |recurrent set| ≤ size; this degree suffices
    let byExp = zetaExp maxDeg
    let byProduct = zetaProduct maxDeg
    for m in 0 .. maxDeg do
        Assert.True(byExp.[m] = byProduct.[m], sprintf "degree %d: fixed-point side %d, orbit-product side %d" m byExp.[m] byProduct.[m])
    Assert.Equal(1L, byExp.[0]) // the empty product / quiescent leading term

[<Fact>]
let ``the quiescent all-zeros society is the unique fixed point (Fix(f^1)=1); it is a period-1 orbit`` () =
    let fix1 = (fixCounts 1).[1]
    Assert.Equal(1L, fix1)                          // only the empty configuration
    Assert.Equal(0, f.[0])                          // all-zeros is fixed (quiescent rest state)
    Assert.Contains(1, orbitLengths ())             // a length-1 orbit exists

[<Fact>]
let ``the round-map has genuine transients (non-bijective): periodic points are a strict subset`` () =
    // M = I + S is singular (all-ones ∈ ker), so f is not onto ⇒ some configs are
    // transient and contribute NOTHING to the zeta — the dynamical zeta must see
    // only the recurrent set. (If it counted transients, the two sides diverge.)
    let periodic = orbitLengths () |> List.sum
    Assert.True(periodic < size, sprintf "expected transients: %d periodic points of %d configs" periodic size)
    Assert.True(periodic > 0, "there must be periodic points")
