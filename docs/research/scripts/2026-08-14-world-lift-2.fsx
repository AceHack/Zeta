// Experiment 2 — does "society > best individual" lift to "world > best society"?
open System

let rng = Random(20260814)
let nextNormal () =
    let u1 = max (rng.NextDouble()) 1e-30
    let u2 = rng.NextDouble()
    sqrt (-2.0 * log u1) * cos (2.0 * Math.PI * u2)

// Acklam inverse normal CDF
let probit (p: float) =
    let a = [| -3.969683028665376e+01; 2.209460984245205e+02; -2.759285104469687e+02; 1.383577518672690e+02; -3.066479806614716e+01; 2.506628277459239e+00 |]
    let b = [| -5.447609879822406e+01; 1.615858368580409e+02; -1.556989798598866e+02; 6.680131188771972e+01; -1.328068155288572e+01 |]
    let c = [| -7.784894002430293e-03; -3.223964580411365e-01; -2.400758277161838e+00; -2.549732539343734e+00; 4.374664141464968e+00; 2.938163982698783e+00 |]
    let d = [| 7.784695709041462e-03; 3.224671290700398e-01; 2.445134137142996e+00; 3.754408661907416e+00 |]
    let pl = 0.02425
    if p < pl then
        let q = sqrt (-2.0 * log p)
        (((((c.[0]*q+c.[1])*q+c.[2])*q+c.[3])*q+c.[4])*q+c.[5]) / ((((d.[0]*q+d.[1])*q+d.[2])*q+d.[3])*q+1.0)
    elif p <= 1.0 - pl then
        let q = p - 0.5
        let r = q * q
        (((((a.[0]*r+a.[1])*r+a.[2])*r+a.[3])*r+a.[4])*r+a.[5])*q / (((((b.[0]*r+b.[1])*r+b.[2])*r+b.[3])*r+b.[4])*r+1.0)
    else
        let q = sqrt (-2.0 * log (1.0 - p))
        -(((((c.[0]*q+c.[1])*q+c.[2])*q+c.[3])*q+c.[4])*q+c.[5]) / ((((d.[0]*q+d.[1])*q+d.[2])*q+d.[3])*q+1.0)

let binomial (n: int) (k: int) =
    if k < 0 || k > n then 0.0
    else let mutable r = 1.0 in (for i in 0 .. k-1 do r <- r * float (n-i) / float (i+1)); r
let maj (n: int) (c: float) =
    let m = n/2 + 1
    let mutable s = 0.0
    for k in m .. n do s <- s + binomial n k * (pown c k) * (pown (1.0-c) (n-k))
    s
let effectiveN (n: int) (rho: float) = float n / (1.0 + float (n-1) * (max 0.0 (min 1.0 rho)))
let corrMaj n c rho = maj (max 1 (int (floor (effectiveN n rho)))) c
let rhoStarAlgebraic (n: int) = if n <= 3 then 0.0 else float (n-3) / (3.0 * float (n-1))

printfn "############ PART 1 — RULE A (union/discovery): is the lift a theorem or a tautology? ############"
printfn ""
// Pathwise test: world's discovery set vs the BEST society's discovery set, under
// ARBITRARY dependence (adversarial hierarchical copula, heterogeneous competences).
let unionPathwise (trials: int) =
    let m = 4                       // societies
    let n = 5                       // members per society
    let nFacts = 40
    let mutable violations = 0
    let mutable strictWins = 0
    let mutable ties = 0
    for _ in 1 .. trials do
        // fresh random hierarchical structure each trial (incl. near-degenerate ones)
        let a = rng.NextDouble()
        let b = rng.NextDouble() * (1.0 - a)
        let e = 1.0 - a - b
        let comps = Array.init m (fun _ -> Array.init n (fun _ -> 0.05 + rng.NextDouble() * 0.9))
        let socVals = Array.zeroCreate m
        let mutable worldVal = 0.0
        let socFound = Array.init m (fun _ -> Array.zeroCreate<bool> nFacts)
        for j in 0 .. nFacts - 1 do
            let w = nextNormal ()
            for k in 0 .. m - 1 do
                let s = nextNormal ()
                let mutable any = false
                for i in 0 .. n - 1 do
                    let z = sqrt a * w + sqrt b * s + sqrt e * nextNormal ()
                    if z < probit comps.[k].[i] then any <- true
                socFound.[k].[j] <- any
        for k in 0 .. m - 1 do
            socVals.[k] <- socFound.[k] |> Array.sumBy (fun f -> if f then 1.0 else 0.0)
        for j in 0 .. nFacts - 1 do
            if socFound |> Array.exists (fun s -> s.[j]) then worldVal <- worldVal + 1.0
        let bestSoc = Array.max socVals
        if worldVal < bestSoc then violations <- violations + 1
        elif worldVal > bestSoc then strictWins <- strictWins + 1
        else ties <- ties + 1
    printfn "  pathwise (m=4 societies x n=5, random a/b/e AND random heterogeneous competences, %d trials):" trials
    printfn "    world < best society : %d   <-- any nonzero value REFUTES the tautology claim" violations
    printfn "    world > best society : %d" strictWins
    printfn "    world = best society : %d" ties
unionPathwise 2000
printfn ""
printfn "  Why: union is MONOTONE. World's discovery set is a SUPERSET of the best society's,"
printfn "  on EVERY sample path, under ARBITRARY dependence. No independence assumption is used."
printfn "  Strictness (not the inequality) is what needs rho<1."
printfn ""

// Is the one-parameter mixture family closed under hierarchical composition?
printfn "  --- closure test: does level-1 union o level-2 union stay in the family? ---"
let cS n c r1 = r1 * c + (1.0 - r1) * (1.0 - (1.0 - c) ** float n)
let flat nm c r = r * c + (1.0 - r) * (1.0 - (1.0 - c) ** float nm)
let n1, m1, r1, r2 = 5, 4, 0.30, 0.30
printfn "  n=%d m=%d rho1=%.2f rho2=%.2f  -> the rho_flat that a FLAT society of %d would need:" n1 m1 r1 r2 (n1*m1)
for c in [0.05; 0.10; 0.20; 0.40; 0.60; 0.80] do
    let cw = cS m1 (cS n1 c r1) r2
    let tail = 1.0 - (1.0 - c) ** float (n1*m1)
    let rhoFlat = (cw - tail) / (c - tail)
    printfn "    c=%.2f  c_S=%.4f  c_W=%.4f  rho_flat=%.4f" c (cS n1 c r1) cw rhoFlat
printfn "  => rho_flat DEPENDS ON c: the hierarchy is NOT a flat society with a re-fitted rho."
printfn "     The one-parameter family is not closed under composition (except rho1 in {0,1})."
printfn ""

printfn "############ PART 2 — RULE B (majority): what does aggregation do to rho? ############"
printfn ""
printfn "  Hierarchical error model: z_ik = sqrt(a)*W + sqrt(b)*S_k + sqrt(e)*eps_ik,  a+b+e=1"
printfn "    intra-society latent correlation  rho1 = a + b            (independent of n)"
printfn "    inter-society latent correlation  rho2 = a / (a + b + e/n) (INCREASING in n)"
printfn "    limit n->inf:                     rho2 = a / (a + b) = a / rho1"
printfn ""
// empirical check of rho2 for the MAJORITY aggregate (binary), vs the latent-mean formula
let measureRho2 (a: float) (b: float) (n: int) (m: int) (c: float) (trials: int) =
    let e = 1.0 - a - b
    let th = probit c
    let socCorrect = Array2D.zeroCreate trials m
    let worldCorrect = Array.zeroCreate trials
    for t in 0 .. trials - 1 do
        let w = nextNormal ()
        let mutable socYes = 0
        for k in 0 .. m - 1 do
            let s = nextNormal ()
            let mutable votes = 0
            for _ in 1 .. n do
                let z = sqrt a * w + sqrt b * s + sqrt e * nextNormal ()
                if z < th then votes <- votes + 1
            let ok = votes > n / 2
            socCorrect.[t, k] <- (if ok then 1.0 else 0.0)
            if ok then socYes <- socYes + 1
        worldCorrect.[t] <- if socYes > m / 2 then 1.0 else 0.0
    // pairwise binary correlation across societies
    let mutable sumR = 0.0
    let mutable cnt = 0
    for k1 in 0 .. m - 2 do
      for k2 in k1 + 1 .. m - 1 do
        let x = Array.init trials (fun t -> socCorrect.[t, k1])
        let y = Array.init trials (fun t -> socCorrect.[t, k2])
        let mx = Array.average x
        let my = Array.average y
        let cov = Array.map2 (fun xi yi -> (xi - mx) * (yi - my)) x y |> Array.average
        let sx = sqrt (Array.averageBy (fun xi -> (xi - mx) ** 2.0) x)
        let sy = sqrt (Array.averageBy (fun yi -> (yi - my) ** 2.0) y)
        if sx > 1e-9 && sy > 1e-9 then sumR <- sumR + cov / (sx * sy); cnt <- cnt + 1
    let rho2emp = if cnt > 0 then sumR / float cnt else 0.0
    let cSoc = Array.init m (fun k -> Array.init trials (fun t -> socCorrect.[t, k]) |> Array.average)
    let bestSoc = Array.max cSoc
    let pWorld = Array.average worldCorrect
    let rho2latent = a / (a + b + e / float n)
    (rho2emp, rho2latent, bestSoc, pWorld)

printfn "  a     b     n    rho1   rho2(latent)  rho2(empirical, majority)  P(best soc)  P(world)  world>best?  predicted by floor(N_eff(m,rho2))>=3?"
let m2 = 5
for (a, b, n) in [ (0.05, 0.15, 5); (0.05, 0.15, 25); (0.02, 0.28, 5); (0.02, 0.28, 25);
                   (0.15, 0.05, 5); (0.15, 0.05, 25); (0.01, 0.09, 15); (0.001, 0.199, 15) ] do
    let (r2e, r2l, best, pw) = measureRho2 a b n m2 0.65 60000
    let neff = effectiveN m2 r2e
    let predicted = int (floor neff) >= 3
    printfn "  %.3f %.3f %4d  %.3f     %.4f          %.4f                  %.4f      %.4f    %-5b        %-5b (N_eff=%.2f, rho*(%d)=%.4f)"
        a b n (a+b) r2l r2e best pw (pw > best + 1e-4) predicted neff m2 (rhoStarAlgebraic m2)
printfn ""
printfn "  Read: rho2 rises with n (bigger societies -> MORE inter-society correlation),"
printfn "  and rho1 = a+b is unchanged by n. You cannot buy world-level independence by growing societies."
