// Experiment 3 — the decisive tests.
//  (a) Is "aggregate > BEST unit" true when units are HETEROGENEOUS? (exact, not MC)
//  (b) Does correlation ALONE (identical units) ever break majority? (Gauss-Legendre quadrature)
//  (c) Does log-odds-weighted majority (Nitzan-Paroush 1982) restore "aggregate >= best"?
open System

let binomial (n: int) (k: int) =
    if k < 0 || k > n then 0.0
    else let mutable r = 1.0 in (for i in 0 .. k-1 do r <- r * float (n-i) / float (i+1)); r
let maj (n: int) (c: float) =
    let m = n/2 + 1
    let mutable s = 0.0
    for k in m .. n do s <- s + binomial n k * (pown c k) * (pown (1.0-c) (n-k))
    s

/// EXACT P(unweighted majority of independent heterogeneous voters is correct).
/// Enumerates all 2^m correctness patterns.
let exactMajorityHetero (cs: float[]) =
    let m = cs.Length
    let mutable p = 0.0
    for mask in 0 .. (1 <<< m) - 1 do
        let mutable prob = 1.0
        let mutable votes = 0
        for i in 0 .. m - 1 do
            if (mask >>> i) &&& 1 = 1 then prob <- prob * cs.[i]; votes <- votes + 1
            else prob <- prob * (1.0 - cs.[i])
        if votes > m / 2 then p <- p + prob
    p

/// EXACT P(weighted majority correct), weights = log-odds (Nitzan-Paroush optimal rule).
let exactWeightedHetero (cs: float[]) =
    let m = cs.Length
    let w = cs |> Array.map (fun c -> log (c / (1.0 - c)))
    let mutable p = 0.0
    for mask in 0 .. (1 <<< m) - 1 do
        let mutable prob = 1.0
        let mutable score = 0.0
        for i in 0 .. m - 1 do
            if (mask >>> i) &&& 1 = 1 then prob <- prob * cs.[i]; score <- score + w.[i]
            else prob <- prob * (1.0 - cs.[i]); score <- score - w.[i]
        if score > 1e-12 then p <- p + prob
        elif abs score <= 1e-12 then p <- p + prob * 0.5   // tie broken by fair coin
    p

printfn "=========== (a) UNWEIGHTED MAJORITY vs THE BEST UNIT, heterogeneous ==========="
printfn ""
printfn "  competences                              P(maj)   best c   maj > best?"
let cases =
    [ [| 0.99; 0.55; 0.55; 0.55; 0.55 |]
      [| 0.95; 0.60; 0.60; 0.60; 0.60 |]
      [| 0.90; 0.70; 0.70; 0.70; 0.70 |]
      [| 0.80; 0.75; 0.75; 0.75; 0.75 |]
      [| 0.99; 0.51; 0.51 |]
      [| 0.85; 0.52; 0.52 |]
      [| 0.70; 0.70; 0.70; 0.70; 0.70 |]     // identical control (row-15 regime)
      [| 0.99; 0.95; 0.95; 0.95; 0.95 |] ]
for cs in cases do
    let pm = exactMajorityHetero cs
    let best = Array.max cs
    printfn "  %-40s %.4f   %.4f   %b"
        (String.Join(",", cs |> Array.map (fun c -> c.ToString("0.00", Globalization.CultureInfo.InvariantCulture))))
        pm best (pm > best)
printfn ""
printfn "  => Unweighted majority is NOT >= the best unit under heterogeneity."
printfn "     Row 15's 'best individual' is only 'best' because all agents are IDENTICAL."
printfn ""

// random sweep: how often does unweighted majority beat the best unit?
let rng = Random(4)
let mutable fails = 0
let mutable tot = 0
for _ in 1 .. 20000 do
    let m = 3 + 2 * rng.Next(0, 3)                       // 3,5,7
    let cs = Array.init m (fun _ -> 0.5 + rng.NextDouble() * 0.49)
    let pm = exactMajorityHetero cs
    if pm <= Array.max cs then fails <- fails + 1
    tot <- tot + 1
printfn "  random sweep (all c_i > 0.5, independent, m in {3,5,7}, %d draws):" tot
printfn "    unweighted majority FAILED to beat the best unit in %d / %d = %.1f%% of draws" fails tot (100.0 * float fails / float tot)
printfn ""

printfn "=========== (b) CORRELATION ALONE (identical units): does majority break? ==========="
printfn ""
// probit-normal: q(W) = Phi((th - sqrt(a) W)/s), s = sqrt(1-a); E[q] = c exactly.
let normCdf (x: float) =
    // Abramowitz-Stegun 7.1.26 on erf
    let t = 1.0 / (1.0 + 0.3275911 * abs x / sqrt 2.0)
    let y = 1.0 - (((((1.061405429*t - 1.453152027)*t) + 1.421413741)*t - 0.284496736)*t + 0.254829592) * t * exp (-(x*x/2.0))
    if x >= 0.0 then 0.5 * (1.0 + y) else 0.5 * (1.0 - y)
let probit (p: float) =
    let mutable lo, hi = -8.0, 8.0
    for _ in 1 .. 200 do
        let mid = (lo + hi) / 2.0
        if normCdf mid < p then lo <- mid else hi <- mid
    (lo + hi) / 2.0

/// E_W[ maj_m(q(W)) ] by fine trapezoid over W in [-8,8]
let worldUnderSharedComponent (m: int) (c: float) (a: float) =
    let th = probit c
    let s = sqrt (1.0 - a)
    let steps = 40000
    let lo, hi = -8.0, 8.0
    let h = (hi - lo) / float steps
    let mutable accW = 0.0
    let mutable accQ = 0.0
    for i in 0 .. steps do
        let w = lo + float i * h
        let wt = (if i = 0 || i = steps then 0.5 else 1.0) * exp (-w*w/2.0) / sqrt (2.0 * Math.PI) * h
        let q = normCdf ((th - sqrt a * w) / s)
        accW <- accW + wt * maj m q
        accQ <- accQ + wt * q
    (accW, accQ)

printfn "  m    c      a(shared frac)   E[q]=P(unit)   P(world)   world > unit?"
for m in [3; 5; 9] do
  for c in [0.55; 0.65; 0.80] do
    for a in [0.0; 0.3; 0.6; 0.9; 0.99] do
        let (pw, pq) = worldUnderSharedComponent m c a
        printfn "  %-4d %.2f   %.2f             %.5f        %.5f    %b" m c a pq pw (pw > pq + 1e-9)
printfn ""
printfn "  => With IDENTICAL units, correlation NEVER reverses the majority result (only shrinks the gain to 0)."
printfn "     There is NO rho* at all in the exact model. rho* is an artifact of the floor(N_eff) approximation."
printfn ""

printfn "=========== (c) LOG-ODDS WEIGHTED MAJORITY (Nitzan-Paroush 1982) ==========="
printfn ""
printfn "  competences                              P(wmaj)  best c   wmaj >= best?"
for cs in cases do
    let pw = exactWeightedHetero cs
    let best = Array.max cs
    printfn "  %-40s %.4f   %.4f   %b"
        (String.Join(",", cs |> Array.map (fun c -> c.ToString("0.00", Globalization.CultureInfo.InvariantCulture))))
        pw best (pw >= best - 1e-12)
printfn ""
let rng2 = Random(11)
let mutable wfails = 0
let mutable wstrict = 0
let mutable wtot = 0
for _ in 1 .. 20000 do
    let m = 3 + rng2.Next(0, 5)                          // 3..7, odd AND even
    let cs = Array.init m (fun _ -> 0.5 + rng2.NextDouble() * 0.49)
    let pw = exactWeightedHetero cs
    let best = Array.max cs
    if pw < best - 1e-12 then wfails <- wfails + 1
    elif pw > best + 1e-12 then wstrict <- wstrict + 1
    wtot <- wtot + 1
printfn "  random sweep (independent, m in 3..7, %d draws):" wtot
printfn "    weighted majority < best unit : %d   <-- any nonzero REFUTES the discharge path" wfails
printfn "    weighted majority > best unit : %d (%.1f%%)" wstrict (100.0 * float wstrict / float wtot)
