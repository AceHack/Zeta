// Experiment 4 — de Finetti: is rho the right invariant at all?
// Every exchangeable binary sequence is a MIXTURE of iid Bernoulli(theta) (de Finetti 1931).
// P(world correct) = E_theta[maj_m(theta)] ;  P(one society correct) = E_theta[theta]
// pairwise correlation rho = Var(theta) / (c(1-c)),  c = E[theta].
// Question: can the world LOSE at a rho BELOW the shipped rho*(m)?
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

/// two-point mixing law on {lo, hi} with mean c
let twoPoint (lo: float) (hi: float) (c: float) =
    let p = (c - lo) / (hi - lo)         // P(theta = hi)
    if p < 0.0 || p > 1.0 then None else Some p

printfn "Search: two-point mixing laws, mean c, minimise rho subject to E[maj_m(theta)] < c"
printfn ""
printfn "  m   c      theta_lo  theta_hi  p(hi)   E[maj]    c        loss     rho      rho*(m)   rho < rho*?"
for m in [5; 9; 15; 25] do
  let mutable best = None
  for c in [0.51; 0.52; 0.55; 0.60; 0.65; 0.70; 0.80] do
    for iLo in 0 .. 500 do
      let lo = float iLo * 0.001
      if lo < c then
        for iHi in 0 .. 200 do
          let hi = c + float iHi * (1.0 - c) / 200.0
          if hi > c then
            match twoPoint lo hi c with
            | Some p ->
                let em = (1.0 - p) * maj m lo + p * maj m hi
                if em < c - 1e-9 then
                    let v = p * (hi - c) ** 2.0 + (1.0 - p) * (lo - c) ** 2.0
                    let rho = v / (c * (1.0 - c))
                    match best with
                    | Some (r0, _, _, _, _, _, _) when r0 <= rho -> ()
                    | _ -> best <- Some (rho, c, lo, hi, p, em, c - em)
            | None -> ()
  match best with
  | Some (rho, c, lo, hi, p, em, loss) ->
      printfn "  %-3d %.2f   %.3f     %.3f     %.3f   %.5f   %.5f  %.5f  %.4f   %.4f    %b"
        m c lo hi p em c loss rho (rhoStarAlgebraic m) (rho < rhoStarAlgebraic m)
  | None -> printfn "  %-3d  (no reversal found)" m
printfn ""
printfn "Control — the Gaussian-copula mixing law at the SAME rho (identical units):"
printfn "  (exp3 part (b) showed it NEVER reverses, at any rho up to 0.99)"
printfn ""
printfn "=> Two exchangeable worlds with the SAME m and the SAME rho can land on OPPOSITE"
printfn "   sides of 'world > best society'. rho is therefore NOT a sufficient statistic"
printfn "   for the verdict: the placement of the mixing law relative to theta = 1/2 is."
printfn ""
printfn "The exact criterion (de Finetti):  E_theta[ maj_m(theta) - theta ] > 0."
printfn "  maj_m(theta) - theta > 0  iff  theta > 1/2   (odd m)."
printfn "  So: the world beats a society iff the shared component does not push society"
printfn "  competence below 1/2 often/deeply enough to outweigh the gain where it is above."
printfn ""
printfn "Sufficient condition (clean, checkable):  P(theta > 1/2) = 1."
for m in [3; 5; 9] do
    // verify the sufficient condition mechanically over random mixing laws supported on (1/2, 1]
    let rng = Random(99 + m)
    let mutable viol = 0
    for _ in 1 .. 20000 do
        let k = 2 + rng.Next(0, 6)
        let pts = Array.init k (fun _ -> 0.5 + 1e-6 + rng.NextDouble() * 0.5)
        let ws  = Array.init k (fun _ -> rng.NextDouble())
        let tot = Array.sum ws
        let ws = ws |> Array.map (fun w -> w / tot)
        let etheta = Array.map2 (*) ws pts |> Array.sum
        let emaj = Array.map2 (fun w t -> w * maj m t) ws pts |> Array.sum
        if emaj <= etheta then viol <- viol + 1
    printfn "  m=%-3d  mixing law supported on (1/2,1], 20000 random laws: violations = %d" m viol
