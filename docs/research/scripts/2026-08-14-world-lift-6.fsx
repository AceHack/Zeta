// Experiment 6 — SCOPE of the reversal: minimum rho producing a reversal, as a function of c.
open System
let binomial (n: int) (k: int) =
    if k < 0 || k > n then 0.0
    else let mutable r = 1.0 in (for i in 0 .. k-1 do r <- r * float (n-i) / float (i+1)); r
let maj (n: int) (c: float) =
    let m = n/2 + 1
    let mutable s = 0.0
    for k in m .. n do s <- s + binomial n k * (pown c k) * (pown (1.0-c) (n-k))
    s
let rhoStarAlgebraic (n: int) = if n <= 3 then 0.0 else float (n-3) / (3.0 * float (n-1))

printfn "min rho over two-point mixing laws such that E[maj_m(theta)] < c   (INF = no reversal found)"
printfn ""
printfn "  c       m=5      m=9      m=15     m=25     | rho*(5)=%.3f rho*(9)=%.3f rho*(15)=%.3f rho*(25)=%.3f"
    (rhoStarAlgebraic 5) (rhoStarAlgebraic 9) (rhoStarAlgebraic 15) (rhoStarAlgebraic 25)
for c in [0.51; 0.55; 0.60; 0.65; 0.70; 0.75; 0.80; 0.90] do
    let row =
        [5; 9; 15; 25] |> List.map (fun m ->
            let mutable best = Double.PositiveInfinity
            for iLo in 0 .. 1000 do
                let lo = float iLo * 0.0005
                if lo < c then
                    for iHi in 1 .. 500 do
                        let hi = c + float iHi * (1.0 - c) / 500.0
                        let p = (c - lo) / (hi - lo)
                        if p > 0.0 && p < 1.0 then
                            let em = (1.0 - p) * maj m lo + p * maj m hi
                            if em < c - 1e-7 then
                                let v = p * (hi - c) ** 2.0 + (1.0 - p) * (lo - c) ** 2.0
                                let rho = v / (c * (1.0 - c))
                                if rho < best then best <- rho
            best)
    let fmt (x: float) = if Double.IsInfinity x then "  INF " else sprintf "%.4f" x
    printfn "  %.2f    %s   %s   %s   %s" c (fmt row.[0]) (fmt row.[1]) (fmt row.[2]) (fmt row.[3])
printfn ""
printfn "Read: reversals inside the shipped 'safe' rho region exist across the whole competence range."
printfn "The reversal is NOT confined to c near 1/2 - only the LARGEST loss is."
