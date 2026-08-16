// Standalone re-implementation (NOT importing SocietyUsefulWork.fs / CondorcetBoundary.fs).
// Purpose: (a) re-verify the two reported tooling defects independently,
//          (b) test whether "society > best individual" lifts to "world > best society".
open System

// ── Rule B: majority aggregation (Condorcet), re-implemented ────────────────
let binomial (n: int) (k: int) =
    if k < 0 || k > n then 0.0
    else
        let mutable r = 1.0
        for i in 0 .. k - 1 do r <- r * float (n - i) / float (i + 1)
        r

/// P(more than half of n voters correct), majority = n/2+1 (strict; ties lose).
let maj (n: int) (c: float) =
    let m = n / 2 + 1
    let mutable s = 0.0
    for k in m .. n do s <- s + binomial n k * (pown c k) * (pown (1.0 - c) (n - k))
    s

let effectiveN (n: int) (rho: float) =
    let r = max 0.0 (min 1.0 rho)
    float n / (1.0 + float (n - 1) * r)

let corrMaj (n: int) (c: float) (rho: float) =
    maj (max 1 (int (floor (effectiveN n rho)))) c

let beats (n: int) (c: float) (rho: float) = corrMaj n c rho > c

let rhoStarAlgebraic (n: int) = if n <= 3 then 0.0 else float (n - 3) / (3.0 * float (n - 1))

/// Faithful copy of the shipped binary search.
let findRhoStar (n: int) (c: float) =
    if not (maj n c > c) then 0.0
    else
        let mutable lo = 0.0
        let mutable hi = 1.0
        for _ in 1 .. 50 do
            let mid = (lo + hi) / 2.0
            if beats n c mid then lo <- mid else hi <- mid
        lo

printfn "=== DEFECT A: findRhoStar binary-searches a NON-MONOTONE predicate ==="
printfn "N=8, c=0.65"
printfn "  findRhoStar 8 0.65      = %.4f" (findRhoStar 8 0.65)
printfn "  rhoStarAlgebraic 8      = %.4f" (rhoStarAlgebraic 8)
printfn "  beats 8 0.65 0.20       = %b   (rho well ABOVE the reported rho*)" (beats 8 0.65 0.20)
printfn "  ratio under-report      = %.2fx" (rhoStarAlgebraic 8 / findRhoStar 8 0.65)
printfn ""
printfn "  the TRUE-set of rho (grid 0.005) is a COMB, not an interval:"
let trueSet =
    [ for i in 0 .. 200 -> float i * 0.005 ]
    |> List.map (fun r -> r, beats 8 0.65 r)
// compress to intervals
let mutable runs = []
let mutable cur = None
for (r, b) in trueSet do
    match cur, b with
    | None, true -> cur <- Some (r, r)
    | Some (a, _), true -> cur <- Some (a, r)
    | Some (a, z), false -> runs <- (a, z) :: runs; cur <- None
    | None, false -> ()
match cur with Some (a, z) -> runs <- (a, z) :: runs | None -> ()
for (a, z) in List.rev runs do printfn "    TRUE on rho in [%.3f, %.3f]" a z
printfn "  => %d disjoint true-intervals. A binary search cannot find the sup of a comb." (List.length runs)
printfn ""
printfn "  reason: maj(k,c)>c is NOT monotone in k. For c=0.65:"
for k in 1 .. 10 do printfn "    k=%2d  maj=%.4f  beats=%b" k (maj k 0.65) (maj k 0.65 > 0.65)
printfn ""

printfn "=== DEFECT B: the N=16 docstring table is not what the code computes ==="
printfn "  docstring claims c-dependent rho*: c=0.6 -> 0.33, c=0.7 -> 0.14, c=0.8 -> 0.06"
for c in [ 0.55; 0.60; 0.65; 0.70; 0.75; 0.80; 0.85; 0.90 ] do
    printfn "    c=%.2f  findRhoStar 16 c = %.4f   rhoStarAlgebraic 16 = %.4f" c (findRhoStar 16 c) (rhoStarAlgebraic 16)
printfn "  => shipped value is c-INDEPENDENT (= the algebraic value); the table is unanchored."
printfn ""

printfn "=== rho*(m) at world-plausible society counts ==="
for m in [ 2; 3; 4; 5; 6; 8; 10; 20; 100 ] do
    printfn "  m=%3d  rho*(m) = %.4f" m (rhoStarAlgebraic m)
