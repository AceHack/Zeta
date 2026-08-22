// Experiment 5 — harden the counterexample: MAXIMISE the loss margin subject to rho <= budget.
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

printfn "MAXIMISE loss = c - E[maj_m(theta)]  subject to rho <= rho*(m) (the shipped 'safe' region)"
printfn ""
printfn "  m   rho-budget  c      theta_lo theta_hi p(hi)   E[theta]  E[maj]    LOSS      rho"
for m in [5; 9; 15; 25; 51] do
  let budget = rhoStarAlgebraic m
  let mutable best = None
  for ic in 0 .. 100 do
    let c = 0.5001 + float ic * 0.004
    if c < 0.95 then
      for iLo in 0 .. 400 do
        let lo = float iLo * 0.00125
        if lo < c then
          for iHi in 1 .. 400 do
            let hi = c + float iHi * (1.0 - c) / 400.0
            let p = (c - lo) / (hi - lo)
            if p > 0.0 && p < 1.0 then
              let v = p * (hi - c) ** 2.0 + (1.0 - p) * (lo - c) ** 2.0
              let rho = v / (c * (1.0 - c))
              if rho <= budget then
                let em = (1.0 - p) * maj m lo + p * maj m hi
                let loss = c - em
                match best with
                | Some (l0, _, _, _, _, _, _) when l0 >= loss -> ()
                | _ -> best <- Some (loss, c, lo, hi, p, em, rho)
  match best with
  | Some (loss, c, lo, hi, p, em, rho) when loss > 0.0 ->
      printfn "  %-3d %.4f      %.4f %.4f   %.4f   %.4f  %.6f  %.6f  %+.6f  %.4f" m budget c lo hi p c em loss rho
  | _ -> printfn "  %-3d  no reversal inside the rho budget" m
printfn ""

printfn "Independent re-check of the m=9 winner by direct EXCHANGEABLE simulation"
printfn "(sample theta from the mixing law, then m iid Bernoulli(theta) votes):"
let recheck (m: int) (lo: float) (hi: float) (p: float) (trials: int) =
    let rng = Random(2718)
    let mutable worldWins = 0
    let mutable socWins = 0
    for _ in 1 .. trials do
        let theta = if rng.NextDouble() < p then hi else lo
        let votes = Array.init m (fun _ -> if rng.NextDouble() < theta then 1 else 0) |> Array.sum
        if votes > m / 2 then worldWins <- worldWins + 1
        // "one society" = the first voter (exchangeable, so any single one)
        if Array.init 1 (fun _ -> if rng.NextDouble() < theta then 1 else 0) |> Array.sum = 1 then socWins <- socWins + 1
    let pw = float worldWins / float trials
    let ps = float socWins / float trials
    printfn "    P(world majority correct)  = %.5f" pw
    printfn "    P(single society correct)  = %.5f" ps
    printfn "    world - society            = %+.5f   (negative => the lift FAILS)" (pw - ps)
    printfn "    empirical pairwise rho     = %.4f" ((p*(hi-(p*hi+(1.0-p)*lo))**2.0 + (1.0-p)*(lo-(p*hi+(1.0-p)*lo))**2.0) / ((p*hi+(1.0-p)*lo)*(1.0-(p*hi+(1.0-p)*lo))))
// re-run the search for m=9 to get its params, then recheck
let paramsFor (m: int) =
  let budget = rhoStarAlgebraic m
  let mutable best = None
  for ic in 0 .. 100 do
    let c = 0.5001 + float ic * 0.004
    if c < 0.95 then
      for iLo in 0 .. 400 do
        let lo = float iLo * 0.00125
        if lo < c then
          for iHi in 1 .. 400 do
            let hi = c + float iHi * (1.0 - c) / 400.0
            let p = (c - lo) / (hi - lo)
            if p > 0.0 && p < 1.0 then
              let v = p * (hi - c) ** 2.0 + (1.0 - p) * (lo - c) ** 2.0
              let rho = v / (c * (1.0 - c))
              if rho <= budget then
                let em = (1.0 - p) * maj m lo + p * maj m hi
                let loss = c - em
                match best with
                | Some (l0, _, _, _) when l0 >= loss -> ()
                | _ -> best <- Some (loss, lo, hi, p)
  best
match paramsFor 9 with
| Some (loss, lo, hi, p) ->
    printfn "  m=9 winner: theta_lo=%.4f theta_hi=%.4f p=%.4f (analytic loss %+.6f)" lo hi p loss
    recheck 9 lo hi p 40_000_000
| None -> printfn "  none"
