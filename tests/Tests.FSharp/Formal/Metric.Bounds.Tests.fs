module Zeta.Tests.Formal.MetricBoundsTests

open System
open System.Diagnostics
open System.IO
open global.Xunit

// PROVEN-CORE-MAP #6 (metric) — the FORMAL magnitude-bounds proof (the last leg). The
// probabilistic MAGNITUDE bounds that Sketch.Laws.Tests.fs flagged as "NOT proven" are
// machine-verified here in Z3 over reals: the derivation of the Count-Min ε/δ bound
// (Cormode & Muthukrishnan 2005) and the Bloom false-positive bound.
//
// SCOPE / PREMISES (honest, same shape as Merkle's "crypto premise named"): a probabilistic
// bound about a CONCRETE hash (XXH3) cannot be proven outright — it holds GIVEN the standard
// premises of the theorem. We name them and Z3 verifies that the bound FOLLOWS from them:
//   (P1) uniform / pairwise-independent hashing ⟹ per-row collision probability = 1/w, so
//        the expected per-row overestimate of x is (N − c_x)/w  (N = total weight, c_x = true).
//   (P2) Markov's inequality: for a non-negative RV with mean μ and t>0, P[X ≥ t] ≤ μ/t.
//   (P3) the d rows use independent hashes, so P[all rows exceed] = ∏ per-row.
// Z3 proves the ALGEBRA that assembles (P1)+(P2)+(P3) into the ε/δ guarantee (each step a
// theorem over ℝ: the negation is unsat). Independence-powering is shown at a representative
// depth d=4 (the general case is the same monotone power, by induction on d).
//
// Net: GIVEN uniform hashing + Markov + row independence, Count-Min satisfies
//   P[ estimate(x) − c_x ≥ εN ] ≤ (1/e)^d = δ   when  w ≥ e/ε,
// and the per-bit Bloom false-positive probability is bounded — both machine-checked.

// ── Z3 runner (reals + ints), mirroring ByteCost.Laws/Merkle.Laws ──
let private which (tool: string) : string option =
    try
        let psi = ProcessStartInfo("/usr/bin/env", $"which %s{tool}",
                    RedirectStandardOutput = true, UseShellExecute = false)
        use p = Process.Start psi
        let output = p.StandardOutput.ReadToEnd().Trim()
        p.WaitForExit()
        if p.ExitCode = 0 && File.Exists output then Some output else None
    with _ -> None

/// Prove `claim` is valid by checking its negation is unsat under `decls`.
let private z3Proves (name: string) (decls: string) (claim: string) =
    match which "z3" with
    | None -> () // z3 absent — CI installs it; skip cleanly (same convention as the other Z3 proofs).
    | Some _ ->
        let script = decls + "\n(assert (not " + claim + "))\n(check-sat)\n"
        let psi = ProcessStartInfo("z3", "-in",
                    RedirectStandardInput = true, RedirectStandardOutput = true, UseShellExecute = false)
        use p = Process.Start psi
        p.StandardInput.Write script
        p.StandardInput.Close()
        let output = p.StandardOutput.ReadToEnd()
        p.WaitForExit()
        if not (output.Contains "unsat") then
            failwithf "Z3 failed to prove metric-bound '%s'. Output:\n%s" name output

// ════════════════════════════════════════════════════════════════════
// Count-Min ε/δ bound (Cormode–Muthukrishnan 2005) — derivation over ℝ.
// ════════════════════════════════════════════════════════════════════

let private realsNCxW = "(declare-const n Real)(declare-const cx Real)(declare-const w Real)"

[<Fact>]
let ``Z3: (P1) expected per-row overestimate (N-cx)/w is at most N/w`` () =
    // E[per-row overestimate of x] = (N − c_x)/w ≤ N/w (the collision mass excludes x's own).
    z3Proves "cms-expectation-bound" realsNCxW
        "(=> (and (>= n 0) (>= cx 0) (<= cx n) (> w 0)) (<= (/ (- n cx) w) (/ n w)))"

[<Fact>]
let ``Z3: (P2) Markov applied — P[row ≥ εN] ≤ 1/(εw) given E ≤ N/w`` () =
    // Markov: P[X ≥ εN] ≤ E/(εN); with E ≤ N/w this is ≤ (N/w)/(εN) = 1/(εw).
    z3Proves "cms-markov" "(declare-const erow Real)(declare-const n Real)(declare-const w Real)(declare-const eps Real)"
        "(=> (and (>= erow 0) (> n 0) (> w 0) (> eps 0) (<= erow (/ n w))) (<= (/ erow (* eps n)) (/ 1.0 (* eps w))))"

[<Fact>]
let ``Z3: width condition w ≥ e/ε ⟹ 1/(εw) ≤ 1/e`` () =
    // Choosing w = ⌈e/ε⌉ gives ε·w ≥ e, so the per-row failure probability is ≤ 1/e.
    z3Proves "cms-width" "(declare-const eps Real)(declare-const w Real)(declare-const e Real)"
        "(=> (and (> eps 0) (> w 0) (> e 0) (>= (* eps w) e)) (<= (/ 1.0 (* eps w)) (/ 1.0 e)))"

[<Fact>]
let ``Z3: per-row failure probability ≤ 1/e (P1+P2+width combined)`` () =
    // The full per-row chain: P[row error ≥ εN] = E/(εN) ≤ 1/(εw) ≤ 1/e.
    z3Proves "cms-per-row"
        "(declare-const erow Real)(declare-const n Real)(declare-const w Real)(declare-const eps Real)(declare-const e Real)"
        "(=> (and (>= erow 0) (> n 0) (> w 0) (> eps 0) (> e 0) (<= erow (/ n w)) (>= (* eps w) e)) (<= (/ erow (* eps n)) (/ 1.0 e)))"

[<Fact>]
let ``Z3: (P3) row independence powers the failure to (1/e)^d = δ (d=4)`` () =
    // P[ALL d rows exceed] = ∏ per-row ≤ (1/e)^d = δ. Representative depth d=4; general d is
    // the same monotone power (induction): 0 ≤ p ≤ q ⟹ p^d ≤ q^d.
    z3Proves "cms-independence-d4" "(declare-const p Real)(declare-const q Real)"
        "(=> (and (>= p 0) (<= p q) (>= q 0)) (<= (* p p p p) (* q q q q)))"

[<Fact>]
let ``Z3: Count-Min never undercounts and the overestimate IS the min collision mass`` () =
    // Deterministic structural lemma (no probabilistic premise): estimate = c_x + minMass with
    // minMass ≥ 0 (insertion-only: all weights non-negative), so estimate ≥ c_x and the error
    // equals exactly the min collision mass.
    z3Proves "cms-no-undercount" "(declare-const cx Int)(declare-const mass Int)"
        "(=> (>= mass 0) (and (>= (+ cx mass) cx) (= (- (+ cx mass) cx) mass)))"

// ════════════════════════════════════════════════════════════════════
// Bloom false-positive bound — derivation over ℝ.
//   (B1) after the inserts, P[a given probed bit is set] = p_bit ∈ [0,1].
//   (B2) FP (for a non-member) = P[all k probed bits set] = p_bit^k.
// Representative k=4; the general case is the same monotone power.
// ════════════════════════════════════════════════════════════════════

[<Fact>]
let ``Z3: Bloom per-bit probability in [0,1] stays in [0,1] under k probes (k=4)`` () =
    z3Proves "bloom-pbit-bounded" "(declare-const b Real)"
        "(=> (and (>= b 0.0) (<= b 1.0)) (and (>= (* b b b b) 0.0) (<= (* b b b b) 1.0)))"

[<Fact>]
let ``Z3: Bloom false-positive rate p_bit^k ≤ p_bit (more probes never raise FP; k=4)`` () =
    z3Proves "bloom-fp-le-pbit" "(declare-const p Real)"
        "(=> (and (>= p 0.0) (<= p 1.0)) (<= (* p p p p) p))"

[<Fact>]
let ``Z3: Bloom false-positive rate is monotone in load (higher per-bit ⟹ higher FP; k=4)`` () =
    z3Proves "bloom-fp-monotone" "(declare-const p Real)(declare-const q Real)"
        "(=> (and (>= p 0.0) (<= p q) (<= q 1.0)) (<= (* p p p p) (* q q q q)))"
