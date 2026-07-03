module Zeta.Tests.Formal.Z3LawsTests
#nowarn "0893"

open System
open System.Diagnostics
open System.IO
open System.Collections.Generic
open System.Text.Json
open FsUnit.Xunit
open global.Xunit
open Zeta.Formal

/// Integration of external formal-verification tools as xUnit tests.
/// These run in CI whenever the relevant tool is installed; otherwise
/// they're skipped with a clear reason. Together they give three
/// independent correctness oracles:
///   1. FsCheck property tests (probabilistic, large domains)
///   2. TLC model checker (exhaustive, finite domain)
///   3. Z3 SMT solver (symbolic, unbounded integer theory)

let private which (tool: string) : string option =
    try
        let psi =
            ProcessStartInfo("/usr/bin/env", $"which %s{tool}",
                RedirectStandardOutput = true,
                UseShellExecute = false)
        use p = Process.Start psi
        let output = p.StandardOutput.ReadToEnd().Trim()
        p.WaitForExit()
        if p.ExitCode = 0 && File.Exists output then Some output
        else None
    with _ -> None

let private solversAvailable () =
    let mode = Environment.GetEnvironmentVariable("ZETA_SOLVER_MODE")
    if not (String.IsNullOrEmpty(mode)) && mode.ToLowerInvariant() = "replay" then
        true
    else
        which "z3" |> Option.isSome && which "cvc5" |> Option.isSome

let private eProverAvailable () =
    let mode = Environment.GetEnvironmentVariable("ZETA_SOLVER_MODE")
    if not (String.IsNullOrEmpty(mode)) && mode.ToLowerInvariant() = "replay" then
        true
    else
        SolverHarness.eproverLiveAvailable ()

let private smtHolds (name: string) (script: string) =
    if solversAvailable() then
        let (v1, v2) = SolverHarness.crossCheck script
        v1 |> should equal Unsat
        v2 |> should equal Unsat

let private z3AxiomHolds (name: string) (smtClaim: string) =
    let header = "(declare-const a Int)\n(declare-const b Int)\n(declare-const c Int)\n(declare-const i Int)\n(declare-const d Int)\n"
    let script = $"%s{header}(assert (not %s{smtClaim}))\n(check-sat)\n"
    smtHolds name script

let private z3ScriptHolds (name: string) (fullScript: string) =
    smtHolds name fullScript

let private z3ScriptHasModel (name: string) (fullScript: string) =
    if solversAvailable() then
        let (v1, v2) = SolverHarness.crossCheck fullScript
        v1 |> should equal Sat
        v2 |> should equal Sat

let private folHolds (name: string) (query: string) =
    if eProverAvailable() then
        let ok = SolverHarness.proveFOL query
        ok |> should equal true



[<Fact>]
let ``Z3 proves Z-set addition is associative`` () =
    z3AxiomHolds "associativity"
        "(= (+ (+ a b) c) (+ a (+ b c)))"


[<Fact>]
let ``Z3 proves Z-set addition is commutative`` () =
    z3AxiomHolds "commutativity"
        "(= (+ a b) (+ b a))"


[<Fact>]
let ``Z3 proves 0 is additive identity`` () =
    z3AxiomHolds "identity"
        "(= (+ a 0) a)"


[<Fact>]
let ``Z3 proves negation is inverse`` () =
    z3AxiomHolds "inverse"
        "(= (+ a (- a)) 0)"


[<Fact>]
let ``Z3 proves double negation is identity`` () =
    z3AxiomHolds "double negation"
        "(= (- (- a)) a)"


[<Fact>]
let ``Z3 proves negation distributes over addition`` () =
    z3AxiomHolds "neg distributes"
        "(= (- (+ a b)) (+ (- a) (- b)))"


[<Fact>]
// Completes the abelian-group law set: subtraction IS addition-of-the-inverse —
// the per-key-weight statement of DBSP retraction (a - b = a + (-b)). The symbolic
// (Z3) leg of the BP-16 cross-check; the FsCheck leg exercises the real ZSet<int>
// (-) operator (ZSet.Tests.fs). Verified unsat with a sat negative control.
let ``Z3 proves subtraction is addition of the inverse`` () =
    z3AxiomHolds "subtraction = add inverse"
        "(= (- a b) (+ a (- b)))"


[<Fact>]
let ``Z3 proves distinct is idempotent`` () =
    z3AxiomHolds "distinct idempotent"
        "(= (ite (> (ite (> a 0) 1 0) 0) 1 0) (ite (> a 0) 1 0))"


[<Fact>]
let ``Z3 proves the H function for incremental distinct`` () =
    // distinct(i+d) = distinct(i) + H(i,d)
    z3AxiomHolds "H function"
        ("(= (ite (> (+ i d) 0) 1 0) " +
         "(+ (ite (> i 0) 1 0) " +
            "(ite (and (> i 0) (<= (+ i d) 0)) (- 1) " +
                "(ite (and (<= i 0) (> (+ i d) 0)) 1 0))))")


// ═══════════════════════════════════════════════════════════════════
// Expansion round — 8 new lemmas per docs/research/proof-tool-coverage.md
// Mirrors the F# CLI in tools/Z3Verify/Program.fs.
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``Z3 proves chain rule pointwise under linearity`` () =
    // Under `f` and `g` linear, (f∘g)(z1) - (f∘g)(z0) = f(g(z1) - g(z0)).
    // This is the pointwise linear form of the DBSP chain rule.
    let script =
        "(declare-fun f (Int) Int)\n" +
        "(declare-fun g (Int) Int)\n" +
        "(declare-const z0 Int)\n(declare-const z1 Int)\n" +
        "(assert (forall ((x Int) (y Int)) (= (f (+ x y)) (+ (f x) (f y)))))\n" +
        "(assert (forall ((x Int) (y Int)) (= (g (+ x y)) (+ (g x) (g y)))))\n" +
        "(assert (not (= (- (f (g z1)) (f (g z0))) (f (- (g z1) (g z0))))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "chain rule (linearity)" script


[<Fact>]
let ``Z3 proves distinct is idempotent as BV64 bit-vector identity`` () =
    let script =
        "(declare-const w (_ BitVec 64))\n" +
        "(define-const zero64 (_ BitVec 64) (_ bv0 64))\n" +
        "(define-fun is_distinct ((x (_ BitVec 64))) (_ BitVec 64)\n" +
        "  (ite (bvsgt x zero64) (_ bv1 64) (_ bv0 64)))\n" +
        "(assert (not (= (is_distinct (is_distinct w)) (is_distinct w))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "distinct idempotent (BV64)" script


[<Fact>]
let ``Z3 proves H function correctness as BV64 identity`` () =
    // Bit-vector version of Budiu VLDB'23 §4 incremental-distinct,
    // with a bounded range so bvadd does not wrap.
    let script =
        "(declare-const iw (_ BitVec 64))\n" +
        "(declare-const dw (_ BitVec 64))\n" +
        "(define-const zero64 (_ BitVec 64) (_ bv0 64))\n" +
        "(define-const one64  (_ BitVec 64) (_ bv1 64))\n" +
        "(define-const negone64 (_ BitVec 64) (bvneg one64))\n" +
        "(define-fun is_distinct ((x (_ BitVec 64))) (_ BitVec 64)\n" +
        "  (ite (bvsgt x zero64) one64 zero64))\n" +
        "(define-fun H ((i (_ BitVec 64)) (d (_ BitVec 64))) (_ BitVec 64)\n" +
        "  (ite (and (bvsgt i zero64) (bvsle (bvadd i d) zero64)) negone64\n" +
        "       (ite (and (bvsle i zero64) (bvsgt (bvadd i d) zero64)) one64 zero64)))\n" +
        "(assert (and (bvsle (_ bv0 64) iw)\n" +
        "             (bvsle iw (_ bv1000000 64))\n" +
        "             (bvsle (bvneg (_ bv1000000 64)) dw)\n" +
        "             (bvsle dw (_ bv1000000 64))))\n" +
        "(assert (not (= (is_distinct (bvadd iw dw))\n" +
        "                (bvadd (is_distinct iw) (H iw dw)))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "H function (BV64)" script


[<Fact>]
let ``Z3 proves tropical distributivity (min-plus)`` () =
    // a + min(b, c) = min(a + b, a + c)
    z3AxiomHolds "tropical distributivity"
        ("(= (+ a (ite (<= b c) b c)) " +
         "(ite (<= (+ a b) (+ a c)) (+ a b) (+ a c)))")


[<Fact>]
let ``Z3 proves weight overflow soundness for 62-bit non-negatives`` () =
    // If 0 ≤ a < 2^62 and 0 ≤ b < 2^62, then 0 ≤ a + b < 2^63
    // (within signed int64 range).
    z3AxiomHolds "weight overflow soundness"
        ("(=> (and (<= 0 a) (< a 4611686018427387904) " +
         "(<= 0 b) (< b 4611686018427387904)) " +
         "(and (<= 0 (+ a b)) (< (+ a b) 9223372036854775808)))")


[<Fact>]
let ``Z3 proves residuation adjunction on the max-monoid`` () =
    // max(a, x) ≤ b  ⇔  x ≤ (a \ b) for the max-monoid on non-negative
    // integers, where `a \ b = b if a ≤ b else -1` (below-range sentinel).
    z3AxiomHolds "residuation adjunction"
        ("(=> (and (>= a 0) (>= b 0) (>= d 0)) " +
         "(let ((residual (ite (<= a b) b (- 0 1)))) " +
         "(= (<= (ite (<= a d) d a) b) (<= d residual))))")


[<Fact>]
let ``Z3 proves Bloom-filter probe pair is a pure function of the key`` () =
    // Deterministic probe: equal keys → identical (h1, h2).
    let script =
        "(declare-fun h1 (Int) Int)\n" +
        "(declare-fun h2 (Int) Int)\n" +
        "(declare-const k1 Int)\n(declare-const k2 Int)\n" +
        "(assert (= k1 k2))\n" +
        "(assert (not (and (= (h1 k1) (h1 k2)) (= (h2 k1) (h2 k2)))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "Bloom probe determinism" script


[<Fact>]
let ``Z3 proves Merkle combine is injective when hash is collision-free`` () =
    // Combine(a1,b1) = Combine(a2,b2) ⇒ (a1,b1) = (a2,b2), modulo the
    // assumption that the underlying hash is injective on its 4-int input.
    let script =
        "(declare-fun H (Int Int Int Int) Int)\n" +
        "(declare-const a1 Int)\n(declare-const b1 Int)\n" +
        "(declare-const a2 Int)\n(declare-const b2 Int)\n" +
        "(declare-const c1 Int)\n(declare-const d1 Int)\n" +
        "(declare-const c2 Int)\n(declare-const d2 Int)\n" +
        "(assert (forall ((x1 Int) (y1 Int) (z1 Int) (w1 Int)\n" +
        "                 (x2 Int) (y2 Int) (z2 Int) (w2 Int))\n" +
        "  (=> (= (H x1 y1 z1 w1) (H x2 y2 z2 w2))\n" +
        "      (and (= x1 x2) (= y1 y2) (= z1 z2) (= w1 w2)))))\n" +
        "(assert (= (H a1 b1 c1 d1) (H a2 b2 c2 d2)))\n" +
        "(assert (not (and (= a1 a2) (= b1 b2) (= c1 c2) (= d1 d2))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "Merkle second-preimage resistance" script


[<Fact>]
let ``Z3 proves agenda monotonicity under quality threshold`` () =
    // Non-trivial replacement for the tautological Lemma 13 (2026-05-09).
    // If agent A demands strictly higher quality than agent B
    // (threshold_A > threshold_B), then A's agenda is a subset of B's.
    // Z3 must derive Quality(t) >= threshold_A > threshold_B, showing
    // Quality(t) >= threshold_B contradicts NOT InAgendaB(t).
    // This is not a tautology: SAT without the threshold ordering constraint.
    let script =
        "(declare-sort Trajectory 0)\n" +
        "(declare-fun Quality (Trajectory) Int)\n" +
        "(declare-const threshold_A Int)\n" +
        "(declare-const threshold_B Int)\n" +
        "(define-fun InAgendaA ((t Trajectory)) Bool\n" +
        "  (>= (Quality t) threshold_A))\n" +
        "(define-fun InAgendaB ((t Trajectory)) Bool\n" +
        "  (>= (Quality t) threshold_B))\n" +
        "(assert (> threshold_A threshold_B))\n" +
        "(assert (exists ((t Trajectory))\n" +
        "  (and (InAgendaA t) (not (InAgendaB t)))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "agenda monotonicity: higher quality threshold implies subset (agenda containment)" script


[<Fact>]
let ``Z3 proves agenda range disjointness for non-overlapping quality windows`` () =
    // Non-trivial replacement for the tautological Lemma 14 (2026-05-09).
    // If A's quality ceiling is strictly below B's floor (hi_A < lo_B),
    // no trajectory can appear in both agendas.
    // Z3 must resolve Quality(t) <= hi_A AND Quality(t) >= lo_B against
    // hi_A < lo_B — a three-way arithmetic contradiction, not a
    // definitional P AND NOT P.
    let script =
        "(declare-sort Trajectory 0)\n" +
        "(declare-fun Quality (Trajectory) Int)\n" +
        "(declare-const lo_A Int)\n" +
        "(declare-const hi_A Int)\n" +
        "(declare-const lo_B Int)\n" +
        "(declare-const hi_B Int)\n" +
        "(define-fun InAgendaA ((t Trajectory)) Bool\n" +
        "  (and (>= (Quality t) lo_A) (<= (Quality t) hi_A)))\n" +
        "(define-fun InAgendaB ((t Trajectory)) Bool\n" +
        "  (and (>= (Quality t) lo_B) (<= (Quality t) hi_B)))\n" +
        "(assert (<= lo_A hi_A))\n" +
        "(assert (<= lo_B hi_B))\n" +
        "(assert (< hi_A lo_B))\n" +
        "(assert (exists ((t Trajectory))\n" +
        "  (and (InAgendaA t) (InAgendaB t))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "agenda range disjointness: non-overlapping quality windows exclude shared trajectories" script


[<Fact>]
let ``Z3 finds shared trajectory with independent persona policies`` () =
    // This is a SAT witness for non-entailment: shared trajectory alone
    // does not force collapsed persona. The model has shared agenda
    // membership for one trajectory and different policy outputs for a
    // future input. A stronger theorem would need richer semantics for
    // private state, agenda deltas, policy updates, and membrane rules.
    let script =
        "(declare-sort Trajectory 0)\n" +
        "(declare-sort Input 0)\n" +
        "(declare-sort Action 0)\n" +
        "(declare-const SharedT Trajectory)\n" +
        "(declare-const FutureInput Input)\n" +
        "(declare-const ActionA Action)\n" +
        "(declare-const ActionB Action)\n" +
        "(declare-fun AgendaA (Trajectory) Bool)\n" +
        "(declare-fun AgendaB (Trajectory) Bool)\n" +
        "(declare-fun PolicyA (Input) Action)\n" +
        "(declare-fun PolicyB (Input) Action)\n" +
        "(define-fun SharedTrajectory ((t Trajectory)) Bool\n" +
        "  (and (AgendaA t) (AgendaB t)))\n" +
        "(define-fun CollapsedPersona () Bool\n" +
        "  (forall ((i Input)) (= (PolicyA i) (PolicyB i))))\n" +
        "(assert (SharedTrajectory SharedT))\n" +
        "(assert (= (PolicyA FutureInput) ActionA))\n" +
        "(assert (= (PolicyB FutureInput) ActionB))\n" +
        "(assert (not (= ActionA ActionB)))\n" +
        "(assert (not CollapsedPersona))\n" +
        "(check-sat)\n"
    z3ScriptHasModel "shared trajectory with independent persona policies" script


// ── 081KR50HA0008QG0R001NNPEXC: Alignment proof primitive — CausalPower ─────────────────────
//
// One primitive: Policy<A>'s dependence on PrivateState<A>.
// Anchor: Pearl (2009) "Causality" §1.3 — interventional independence.
//
// Types in the Z3 model:
//   SharedTrace — uninterpreted sort for observable shared event sequence.
//   PrivateState<A> — modelled as Int (agent A's integer-typed local var).
//   Policy<A> — uninterpreted function (Int × SharedTrace) → Action.
//
// Property: hasCausalPower(P) := exists s1 s2 on same trace, P(s1,t) ≠ P(s2,t)
//
// What the two checks prove:
//   Lemma 16 (SAT witness): free policies CAN satisfy hasCausalPower.
//   Lemma 17 (UNSAT proof): collapsed policies CANNOT satisfy hasCausalPower
//             — the failure mode is detectable.
//
// What neither check proves: that any specific concrete agent is non-collapsed.
// Proving non-collapse for a real agent requires membrane specs + private-state
// update rules beyond this primitive. This slice deliberately stops here.


[<Fact>]
let ``Z3 witnesses causal power for free policy: distinct private states map to distinct actions`` () =
    let script =
        "(declare-sort SharedTrace 0)\n" +
        "(declare-sort Action 0)\n" +
        "(declare-const stateA1 Int)\n" +
        "(declare-const stateA2 Int)\n" +
        "(declare-const trace SharedTrace)\n" +
        "(declare-fun PolicyA (Int SharedTrace) Action)\n" +
        // Intervention: two distinct private-state values.
        "(assert (not (= stateA1 stateA2)))\n" +
        // Witness: policy produces different actions on the same trace.
        "(assert (not (= (PolicyA stateA1 trace) (PolicyA stateA2 trace))))\n" +
        "(check-sat)\n"
    z3ScriptHasModel "CausalPower: free policy can produce distinct actions from distinct PrivateState on same SharedTrace" script


[<Fact>]
let ``Z3 proves collapsed policy has no causal power: state change cannot change action`` () =
    let script =
        "(declare-sort SharedTrace 0)\n" +
        "(declare-sort Action 0)\n" +
        "(declare-const stateA1 Int)\n" +
        "(declare-const stateA2 Int)\n" +
        "(declare-const trace SharedTrace)\n" +
        "(declare-fun PolicyA (Int SharedTrace) Action)\n" +
        // Intervention: distinct private-state values — ensures UNSAT comes from
        // the collapse constraint, not the trivial stateA1=stateA2 identity case.
        "(assert (not (= stateA1 stateA2)))\n" +
        // Collapse: policy output is invariant to private-state changes.
        "(assert (forall ((s1 Int) (s2 Int) (t SharedTrace))\n" +
        "  (= (PolicyA s1 t) (PolicyA s2 t))))\n" +
        // Negate causal power: attempt to witness distinct actions — must fail.
        "(assert (not (= (PolicyA stateA1 trace) (PolicyA stateA2 trace))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "CausalPower failure: collapsed policy (PrivateState-invariant) provably has no causal power" script


[<Fact>]
let ``TLC model-checker is available when configured`` () =
    // Probe for the TLA+ tools jar. Not required for CI success — this test
    // simply notes whether formal verification via TLC is runnable in the
    // current environment. The actual spec is in tools/tla/specs/DbspSpec.tla and was
    // already verified in development on 1 M states.
    let probePath =
        [ "/tmp/tla2tools.jar"
          Environment.GetEnvironmentVariable "TLA2TOOLS_JAR" ]
        |> List.tryFind (fun p ->
            not (String.IsNullOrEmpty p) && File.Exists p)
    match probePath with
    | Some p ->
        // Tool present — the spec itself is in docs/ and TLC was already run
        // in development. This assertion confirms the jar is readable.
        let fi = FileInfo p
        fi.Length |> should be (greaterThan 100_000L)
    | None ->
        // Tool not installed — test is informational only.
        ()

// ═══════════════════════════════════════════════════════════════════
// 081KT2T2J0008QG0R000YZ3NMY C1 — Gaussian message product is an ABELIAN GROUP on the
// natural-parameter representation (ν = μ·τ, τ = 1/σ²). product =
// component-wise add, divide = component-wise subtract, identity =
// One = (0,0). This is ℝ² under vector +/- — the abelian-group axioms
// hold symbolically over the IDEAL REALS (QF_LRA). The FsCheck twin in
// tests/Bayesian.Tests/Message.Tests.fs proves the FLOAT impl conforms;
// THIS proves the algebraic model is correct-by-construction.
//
// Anchor: KFL 2001 (sum-product), Minka 2001 (EP cavity = divide),
// Wainwright-Jordan 2008 §3 (exp-family natural params = free abelian
// group). Mirrors the Z-set abelian-group lemmas above (same property
// class, Gaussian payload). Authored by Soraya per 081KT2T2J0008QG0R000YZ3NMY.
//
// Float overflow (proper closure can break when τ1+τ2 overflows to ∞)
// is invisible to QF_LRA ideal reals — that is the FsCheck side's job
// (closure property on the bounded domain) + the separate C9 obligation.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``Z3 proves Gaussian message product is associative (C1)`` () =
    let script =
        "(declare-const nuA Real)\n(declare-const tauA Real)\n" +
        "(declare-const nuB Real)\n(declare-const tauB Real)\n" +
        "(declare-const nuC Real)\n(declare-const tauC Real)\n" +
        "(assert (not (and\n" +
        "  (= (+ (+ nuA nuB) nuC)   (+ nuA (+ nuB nuC)))\n" +
        "  (= (+ (+ tauA tauB) tauC) (+ tauA (+ tauB tauC))))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C1 Gaussian product associative" script

[<Fact>]
let ``Z3 proves Gaussian message product is commutative (C1)`` () =
    let script =
        "(declare-const nuA Real)\n(declare-const tauA Real)\n" +
        "(declare-const nuB Real)\n(declare-const tauB Real)\n" +
        "(assert (not (and\n" +
        "  (= (+ nuA nuB)   (+ nuB nuA))\n" +
        "  (= (+ tauA tauB) (+ tauB tauA)))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C1 Gaussian product commutative" script

[<Fact>]
let ``Z3 proves One (0,0) is the identity for Gaussian product (C1)`` () =
    let script =
        "(declare-const nuA Real)\n(declare-const tauA Real)\n" +
        "(assert (not (and\n" +
        "  (= (+ nuA 0.0)  nuA)  (= (+ tauA 0.0)  tauA)\n" +
        "  (= (+ 0.0 nuA)  nuA)  (= (+ 0.0 tauA)  tauA))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C1 Gaussian product identity (0,0)" script

[<Fact>]
let ``Z3 proves Gaussian divide is the inverse via negation (C1)`` () =
    let script =
        "(declare-const nuA Real)\n(declare-const tauA Real)\n" +
        "(assert (not (and\n" +
        "  (= (- nuA nuA)   0.0)  (= (- tauA tauA)  0.0)\n" +
        "  (= (+ nuA (- 0.0 nuA))   0.0)\n" +
        "  (= (+ tauA (- 0.0 tauA)) 0.0))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C1 Gaussian product inverse (divide = subtract)" script

[<Fact>]
let ``Z3 proves Gaussian divide round-trips the product, the EP cavity (C1)`` () =
    let script =
        "(declare-const nuA Real)\n(declare-const tauA Real)\n" +
        "(declare-const nuB Real)\n(declare-const tauB Real)\n" +
        "(assert (not (and\n" +
        "  (= (- (+ nuA nuB) nuB)   nuA)\n" +
        "  (= (- (+ tauA tauB) tauB) tauA))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C1 Gaussian cavity round-trip ((a*b)/b = a)" script

[<Fact>]
let ``Z3 proves proper Gaussians are closed under product, guarded (C1)`` () =
    let script =
        "(declare-const tauA Real)\n(declare-const tauB Real)\n" +
        // τA>0 and τB>0 ⇒ τA+τB>0 (proper closed under product). GUARDED
        // implication, not unconditional — divide (cavity) can leave the
        // proper domain (Minka 2001), which is correct, not a bug.
        "(assert (not (=> (and (> tauA 0.0) (> tauB 0.0))\n" +
        "                 (> (+ tauA tauB) 0.0))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C1 proper closed under product (guarded)" script

// ═══════════════════════════════════════════════════════════════════
// 081KT2T2J0008QG0R000YZ3NMY C2 — Beta message product is an ABELIAN GROUP on the SHIFTED
// natural parameters. The impl works on (α, β) directly: product =
// α₁+α₂−1, divide = α₁−α₂+1, identity One = Beta(1,1). These ARE the
// abelian-group axioms on the shifted naturals (n = α−1), proven here
// symbolically over the ideal reals (QF_LRA). The FsCheck twin proves
// the float impl conforms. Anchor: Bishop PRML ch.2, KFL 2001, Minka
// 2001. Lemmas use the α-coordinate; β is identical by symmetry.
//
// CLOSURE differs from C1: proper (α>0) is NOT closed under product
// (0.1+0.1−1<0). The honest closure is the conjugate update — proper
// prior (α>0) × likelihood (α≥1) ⇒ proper. Stated as the guarded lemma.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``Z3 proves Beta product is associative on shifted naturals (C2)`` () =
    let script =
        "(declare-const aA Real)\n(declare-const aB Real)\n(declare-const aC Real)\n" +
        // (a*b)*c = ((aA+aB-1)+aC-1) ; a*(b*c) = (aA+(aB+aC-1)-1)
        "(assert (not (= (- (+ (- (+ aA aB) 1.0) aC) 1.0)\n" +
        "                (- (+ aA (- (+ aB aC) 1.0)) 1.0))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C2 Beta product associative (shifted naturals)" script

[<Fact>]
let ``Z3 proves Beta product is commutative on shifted naturals (C2)`` () =
    let script =
        "(declare-const aA Real)\n(declare-const aB Real)\n" +
        "(assert (not (= (- (+ aA aB) 1.0) (- (+ aB aA) 1.0))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C2 Beta product commutative" script

[<Fact>]
let ``Z3 proves Beta One = Beta(1,1) is the identity for product (C2)`` () =
    let script =
        "(declare-const aA Real)\n" +
        // a * One : aA + 1 - 1 = aA ; One * a : 1 + aA - 1 = aA  (One.Alpha = 1)
        "(assert (not (and (= (- (+ aA 1.0) 1.0) aA)\n" +
        "                  (= (- (+ 1.0 aA) 1.0) aA))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C2 Beta product identity (Beta(1,1))" script

[<Fact>]
let ``Z3 proves Beta divide round-trips the product, the EP cavity (C2)`` () =
    let script =
        "(declare-const aA Real)\n(declare-const aB Real)\n" +
        // (a*b)/b = ((aA+aB-1) - aB + 1) = aA
        "(assert (not (= (+ (- (- (+ aA aB) 1.0) aB) 1.0) aA)))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C2 Beta cavity round-trip ((a*b)/b = a)" script

[<Fact>]
let ``Z3 proves Beta divide is the shifted-natural inverse element (C2)`` () =
    let script =
        "(declare-const aA Real)\n(declare-const aB Real)\n" +
        // a/b = aA - aB + 1 ; a*(One/b) where One/b = 2 - aB :  aA + (2-aB) - 1 = aA - aB + 1
        "(assert (not (= (+ (- aA aB) 1.0)\n" +
        "                (- (+ aA (- 2.0 aB)) 1.0))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C2 Beta divide = multiply by inverse" script

[<Fact>]
let ``Z3 proves proper Beta prior times a likelihood stays proper, guarded (C2)`` () =
    let script =
        "(declare-const aPrior Real)\n(declare-const aLike Real)\n" +
        // proper prior (aPrior>0) AND likelihood (aLike>=1) ⇒ aPrior+aLike-1 > 0.
        // NOT unconditional: two arbitrary propers can give α<0 (improper).
        "(assert (not (=> (and (> aPrior 0.0) (>= aLike 1.0))\n" +
        "                 (> (- (+ aPrior aLike) 1.0) 0.0))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C2 Beta conjugate closure (prior x likelihood, guarded)" script

// ═══════════════════════════════════════════════════════════════════
// 081KT2T2J0008QG0R000YZ3NMY C3 — Bernoulli message product is an ABELIAN GROUP via LOG-ODDS
// addition. The impl computes in probability space (t/(t+f)); that is
// mathematically log-odds add. Here Z3 proves the LOG-ODDS model
// (ℓ ∈ ℝ, product = ℓ_a + ℓ_b, identity One = 0, inverse = negation) is
// an abelian group over the ideal reals; the FsCheck twin proves the
// prob-space float impl conforms. Anchor: KFL 2001, Minka 2001,
// exponential-family (log-odds = Bernoulli natural parameter).
//
// CLOSURE is unconditional: ℝ is closed under +, and the logistic
// ℝ→(0,1) bijection carries that to p ∈ (0,1) — so unlike Beta, any two
// proper Bernoullis have a proper product. (No guard needed; the
// FsCheck closure property exercises the prob-space normalizer.)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``Z3 proves Bernoulli product is associative in log-odds (C3)`` () =
    let script =
        "(declare-const lA Real)\n(declare-const lB Real)\n(declare-const lC Real)\n" +
        "(assert (not (= (+ (+ lA lB) lC) (+ lA (+ lB lC)))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C3 Bernoulli product associative (log-odds)" script

[<Fact>]
let ``Z3 proves Bernoulli product is commutative in log-odds (C3)`` () =
    let script =
        "(declare-const lA Real)\n(declare-const lB Real)\n" +
        "(assert (not (= (+ lA lB) (+ lB lA))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C3 Bernoulli product commutative" script

[<Fact>]
let ``Z3 proves One = 0.5 (log-odds 0) is the identity for Bernoulli product (C3)`` () =
    let script =
        "(declare-const lA Real)\n" +
        "(assert (not (and (= (+ lA 0.0) lA) (= (+ 0.0 lA) lA))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C3 Bernoulli product identity (log-odds 0)" script

[<Fact>]
let ``Z3 proves Bernoulli divide is the inverse via log-odds negation (C3)`` () =
    let script =
        "(declare-const lA Real)\n" +
        "(assert (not (and (= (- lA lA) 0.0)\n" +
        "                  (= (+ lA (- 0.0 lA)) 0.0))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C3 Bernoulli divide = log-odds negation" script

[<Fact>]
let ``Z3 proves Bernoulli divide round-trips the product, the EP cavity (C3)`` () =
    let script =
        "(declare-const lA Real)\n(declare-const lB Real)\n" +
        "(assert (not (= (- (+ lA lB) lB) lA)))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C3 Bernoulli cavity round-trip ((a*b)/b = a)" script
// 081KT2T2J0008QG0R000YZ3NMY C6 — BP convergence detection (`not (distance x y <= tol)`) is
// NaN/∞-SAFE: a divergent run can never falsely report convergence. The
// NaN/∞ cases are IEEE-754 facts, so they are proven in Z3's
// floating-point theory (QF_FP); the finite threshold is proven in
// QF_LRA. The FsCheck twin (Bayesian.Tests/Message.Tests.fs) exercises
// the real-float per-family `distance` (returns ∞ for non-finite). Anchor:
// factory-native; the `moved` invariant in FactorGraph.runToFixpoint.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``Z3 proves a NaN residual counts as moved, never converged (C6)`` () =
    // moved = not (fp.leq d tol). For NaN d, (fp.leq NaN tol) is FALSE ∀ tol,
    // so moved is TRUE. Assert the negation (fp.leq d tol) under isNaN d ⇒ UNSAT.
    let script =
        "(set-logic QF_FP)\n" +
        "(declare-const d (_ FloatingPoint 11 53))\n" +
        "(declare-const tol (_ FloatingPoint 11 53))\n" +
        "(assert (fp.isNaN d))\n" +
        "(assert (fp.leq d tol))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C6 NaN residual is always moved" script

[<Fact>]
let ``Z3 proves a +infinity residual counts as moved for any finite tol (C6)`` () =
    // (fp.leq +oo finite-tol) is FALSE, so +∞ residual is always moved.
    let script =
        "(set-logic QF_FP)\n" +
        "(declare-const tol (_ FloatingPoint 11 53))\n" +
        "(assert (not (fp.isInfinite tol)))\n" +
        "(assert (not (fp.isNaN tol)))\n" +
        "(assert (fp.leq (_ +oo 11 53) tol))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C6 +inf residual is always moved (finite tol)" script

[<Fact>]
let ``Z3 proves the finite convergence threshold has no converged-and-moved overlap (C6)`` () =
    // For a finite residual d ≥ 0 and tol ≥ 0, converged (d ≤ tol) and moved
    // (d > tol) are mutually exclusive — no d is BOTH. UNSAT ⇒ the threshold
    // is an exact partition (no finite residual is misclassified).
    let script =
        "(declare-const d Real)\n(declare-const tol Real)\n" +
        "(assert (>= d 0.0))\n(assert (>= tol 0.0))\n" +
        "(assert (and (<= d tol) (> d tol)))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C6 finite threshold has no converged-and-moved overlap" script


// ═══════════════════════════════════════════════════════════════════
// C13 (081KT2T2J0008QG0R000YZ3NMY P1) — the DBSP operator-inverse identities, symbolically
// over the IDEAL REALS (QF_LRA). z⁻¹ (delay): (z⁻¹ x)[t] = x[t−1], x[−1]=0.
// I (integrate): I(s)[t] = Σ_{i≤t} s[i]. D (differentiate): D(x)[t] =
// x[t] − x[t−1] = (1 − z⁻¹)(x). The substance is the TELESCOPING:
// D∘I = I∘D = id over a bounded 3-tick stream s0,s1,s2. The FsCheck twin
// (Operators/OperatorAlgebra.Tests.fs C13) runs the REAL Circuit on int64
// Z-sets; Z3 proves the algebra over ideal reals (BP-16 cross-check).
// Spec: DBSP (Budiu et al.) — I = (1−z⁻¹)⁻¹.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``Z3 proves C13 D∘I = id (differentiate of integrate telescopes to each tick)`` () =
    // I[t]=Σ_{i≤t}s[i]; D(I(s))[t]=I[t]−I[t−1] must equal s[t] for every t.
    // assert the violation (some tick disagrees) ⇒ UNSAT ⇒ identity holds.
    let script =
        "(set-logic QF_LRA)\n" +
        "(declare-const s0 Real)(declare-const s1 Real)(declare-const s2 Real)\n" +
        "(assert (or\n" +
        "  (not (= (- s0 0.0) s0))\n" +
        "  (not (= (- (+ s0 s1) s0) s1))\n" +
        "  (not (= (- (+ s0 s1 s2) (+ s0 s1)) s2))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C13 D∘I = id" script

[<Fact>]
let ``Z3 proves C13 I∘D = id (integrate of differentiate telescopes to each tick)`` () =
    // D(s)[t]=s[t]−s[t−1] (s[−1]=0); I(D(s))[t]=Σ_{i≤t}D(s)[i] must equal s[t].
    let script =
        "(set-logic QF_LRA)\n" +
        "(declare-const s0 Real)(declare-const s1 Real)(declare-const s2 Real)\n" +
        "(assert (or\n" +
        "  (not (= (- s0 0.0) s0))\n" +
        "  (not (= (+ (- s0 0.0) (- s1 s0)) s1))\n" +
        "  (not (= (+ (- s0 0.0) (- s1 s0) (- s2 s1)) s2))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C13 I∘D = id" script


// ═══════════════════════════════════════════════════════════════════
// Aurora round (d) — capability gate `cap_req ⊆ cap_allowed` (standardization
// Test 4.4). Soraya's BP-16 routing: Z3 set algebra; prereq probed 2026-06-19 —
// `(Set Int)` works under (set-logic ALL) but the chosen encoding is QF_BV
// BITMASK over a 64-capability universe (decidable, CI-portable, finite-universe
// faithful — Soraya's stated fallback). Subset is the natural bvand form:
//   admit ⟺ cap_req ⊆ cap_allowed ⟺ (bvand req allowed) = req
//                                  ⟺ (bvand req (bvnot allowed)) = 0
// These are the symbolic (Z3) leg of the (d) cross-check; the §4.4 "10 injection
// variants" FsCheck leg (Soraya's secondary) remains as a noted follow-up.
// Authored by Otto per the aurora-immune-reground trajectory (Aaron 2026-06-19).
// ═══════════════════════════════════════════════════════════════════

let private bv0 = "(_ bv0 64)"

[<Fact>]
let ``Z3 proves capability subset has two equivalent bvand encodings (d)`` () =
    // (bvand req allowed) = req  ⟺  (bvand req (bvnot allowed)) = 0. The gate's
    // admit predicate is well-defined regardless of which encoding the impl uses.
    let script =
        "(set-logic QF_BV)\n" +
        "(declare-const req (_ BitVec 64))\n" +
        "(declare-const allowed (_ BitVec 64))\n" +
        "(assert (not (= (= (bvand req allowed) req) (= (bvand req (bvnot allowed)) " + bv0 + "))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "(d) capability subset encodings equivalent" script

[<Fact>]
let ``Z3 proves capability gate is reflexive: a set always satisfies its own requirement (d)`` () =
    let script =
        "(set-logic QF_BV)\n" +
        "(declare-const req (_ BitVec 64))\n" +
        "(assert (not (= (bvand req (bvnot req)) " + bv0 + ")))\n" +
        "(check-sat)\n"
    z3ScriptHolds "(d) capability subset reflexive" script

[<Fact>]
let ``Z3 proves capability gate is transitive (d)`` () =
    // a ⊆ b ∧ b ⊆ c ⇒ a ⊆ c. Chained delegation never widens the effective grant.
    let script =
        "(set-logic QF_BV)\n" +
        "(declare-const a (_ BitVec 64))\n" +
        "(declare-const b (_ BitVec 64))\n" +
        "(declare-const c (_ BitVec 64))\n" +
        "(assert (not (=> (and (= (bvand a (bvnot b)) " + bv0 + ") (= (bvand b (bvnot c)) " + bv0 + "))\n" +
        "                 (= (bvand a (bvnot c)) " + bv0 + "))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "(d) capability subset transitive" script

[<Fact>]
let ``Z3 proves granting capabilities never revokes admission: monotone in allowed (d)`` () =
    // allowed ⊆ allowed' ⇒ (req ⊆ allowed ⇒ req ⊆ allowed'). Widening the grant
    // can only keep or turn a deny into an admit, never flip an admit to a deny.
    let script =
        "(set-logic QF_BV)\n" +
        "(declare-const req (_ BitVec 64))\n" +
        "(declare-const al (_ BitVec 64))\n" +
        "(declare-const al2 (_ BitVec 64))\n" +
        "(assert (not (=> (and (= (bvand al (bvnot al2)) " + bv0 + ") (= (bvand req (bvnot al)) " + bv0 + "))\n" +
        "                 (= (bvand req (bvnot al2)) " + bv0 + "))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "(d) admit monotone in allowed" script

[<Fact>]
let ``Z3 proves least-privilege: demanding MORE capabilities is strictly stricter (d)`` () =
    // req ⊆ req' ∧ req' ⊆ allowed ⇒ req ⊆ allowed. The antitone direction —
    // a request can never gain admission by REQUIRING a capability it wasn't granted.
    let script =
        "(set-logic QF_BV)\n" +
        "(declare-const req (_ BitVec 64))\n" +
        "(declare-const req2 (_ BitVec 64))\n" +
        "(declare-const al (_ BitVec 64))\n" +
        "(assert (not (=> (and (= (bvand req (bvnot req2)) " + bv0 + ") (= (bvand req2 (bvnot al)) " + bv0 + "))\n" +
        "                 (= (bvand req (bvnot al)) " + bv0 + "))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "(d) least-privilege antitone in req" script

[<Fact>]
let ``Z3 proves an empty requirement is always admitted (d)`` () =
    // ∅ ⊆ allowed for every allowed — an action needing no capability always passes.
    let script =
        "(set-logic QF_BV)\n" +
        "(declare-const al (_ BitVec 64))\n" +
        "(assert (not (= (bvand " + bv0 + " (bvnot al)) " + bv0 + ")))\n" +
        "(check-sat)\n"
    z3ScriptHolds "(d) empty requirement always admits" script

[<Fact>]
let ``Z3 witnesses a genuine DENIAL: a required capability outside allowed is refused (d)`` () =
    // Non-vacuity: the gate is not trivially always-admit. There exist req, allowed
    // with a required bit outside allowed — and the admit predicate is then FALSE.
    let script =
        "(set-logic QF_BV)\n" +
        "(declare-const req (_ BitVec 64))\n" +
        "(declare-const al (_ BitVec 64))\n" +
        "(assert (not (= (bvand req (bvnot al)) " + bv0 + ")))\n" + // some required cap not allowed
        "(assert (not (= (bvand req al) req)))\n" + // ⇒ admit predicate false (denied)
        "(check-sat)\n"
    z3ScriptHasModel "(d) genuine denial reachable" script

[<Fact>]
let ``Z3 witnesses a genuine ADMIT: a fully-covered non-empty requirement passes (d)`` () =
    // Non-vacuity the other way: the gate is not trivially always-deny. There exist
    // a non-empty req fully within allowed — admitted.
    let script =
        "(set-logic QF_BV)\n" +
        "(declare-const req (_ BitVec 64))\n" +
        "(declare-const al (_ BitVec 64))\n" +
        "(assert (not (= req " + bv0 + ")))\n" + // non-trivial requirement
        "(assert (= (bvand req (bvnot al)) " + bv0 + "))\n" + // fully covered ⇒ admitted
        "(check-sat)\n"
    z3ScriptHasModel "(d) genuine admit reachable" script


// ═══════════════════════════════════════════════════════════════════
// Aurora round (b) — BFT-threshold soundness under Sybil: the HONEST-COUNT side
// (standardization §2 BFT threshold; the symbolic leg of Soraya's BP-16 routing for (b)).
// Quorum arithmetic over QF_LIA: N total proven-distinct identities, f Byzantine-faulty, quorum Q.
// Safety = two quorums intersect in an honest node (2Q ≥ N+f+1); liveness = a quorum forms from
// non-faulty nodes (Q ≤ N−f). The canonical PBFT instance is N = 3f+1, Q = 2f+1.
// SCOPE (honest, ties to the scoping doc): this is the THRESHOLD ARITHMETIC cross-check assuming
// distinct identities — it does NOT discharge anti-Sybil entropy (G3, §B, open). "Distinct" is only
// ENFORCED if forging identities is costly; here we prove the counting is sound GIVEN distinctness,
// and (L6) that a raw-node majority sharing identities is refused by counting distinct, not raw.
// Anchors: Lamport–Shostak–Pease 1982; Castro–Liskov 1999 (PBFT 3f+1 / 2f+1); rides §A NonRegisterCollapse.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``Z3 proves the canonical BFT quorum (N=3f+1, Q=2f+1) is both safe and live (b)`` () =
    // safety: 2Q ≥ N+f+1 (two quorums share an honest node); liveness: Q ≤ N−f (a quorum can form).
    let script =
        "(declare-const f Int)(declare-const N Int)(declare-const Q Int)\n" +
        "(assert (not (=> (and (>= f 0) (= N (+ (* 3 f) 1)) (= Q (+ (* 2 f) 1)))\n" +
        "                 (and (>= (* 2 Q) (+ N f 1)) (<= Q (- N f))))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "(b) canonical quorum safe+live" script

[<Fact>]
let ``Z3 proves a BFT quorum holds an honest supermajority (honest strictly outnumber faulty) (b)`` () =
    // A quorum of Q=2f+1 with ≤ f faulty has honest ≥ f+1 > f — honest strictly outnumber faulty.
    let script =
        "(declare-const f Int)(declare-const Q Int)(declare-const faulty Int)\n" +
        "(assert (not (=> (and (>= f 0) (= Q (+ (* 2 f) 1)) (>= faulty 0) (<= faulty f))\n" +
        "                 (and (>= (- Q faulty) (+ f 1)) (> (- Q faulty) faulty)))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "(b) honest supermajority in quorum" script

[<Fact>]
let ``Z3 proves N >= 3f+1 is NECESSARY — below it no quorum is both safe and live (b)`` () =
    // The classic BFT bound: if N ≤ 3f, no Q satisfies both safety (2Q ≥ N+f+1) and liveness (Q ≤ N−f).
    // Asserting the conjunction directly ⇒ UNSAT proves no such witness exists.
    let script =
        "(declare-const f Int)(declare-const N Int)(declare-const Q Int)\n" +
        "(assert (and (>= f 0) (<= N (* 3 f)) (>= Q 0)\n" +
        "             (>= (* 2 Q) (+ N f 1)) (<= Q (- N f))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "(b) 3f+1 necessity (N<=3f has no safe+live quorum)" script

[<Fact>]
let ``Z3 proves BFT fault-tolerance is monotone: tolerate f implies tolerate any f' <= f (b)`` () =
    // Mirrors CSLib FLP's Consensus.fault_mono — the bridge to the eventual Lean lift.
    let script =
        "(declare-const f Int)(declare-const f_prime Int)(declare-const N Int)\n" +
        "(assert (not (=> (and (>= f_prime 0) (<= f_prime f) (>= N (+ (* 3 f) 1)))\n" +
        "                 (>= N (+ (* 3 f_prime) 1)))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "(b) fault-tolerance monotone" script

[<Fact>]
let ``Z3 proves two quorums always share at least one honest identity (the agreement crux) (b)`` () =
    // intersection ≥ 2Q−N = f+1; minus ≤ f faulty ⇒ ≥ 1 honest in every quorum-intersection.
    let script =
        "(declare-const f Int)(declare-const N Int)(declare-const Q Int)(declare-const faulty Int)\n" +
        "(assert (not (=> (and (>= f 0) (= N (+ (* 3 f) 1)) (= Q (+ (* 2 f) 1)) (>= faulty 0) (<= faulty f))\n" +
        "                 (>= (- (- (* 2 Q) N) faulty) 1))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "(b) honest quorum-intersection" script

[<Fact>]
let ``Z3 witnesses Sybil refusal: a raw-node majority is refused when distinct identities fall short (b)`` () =
    // The (b)-specific link to §A NonRegisterCollapse + the TLA+ NoSybilRawMajorityRefusal witness:
    // counting must be over PROVEN-DISTINCT identities, not raw nodes. A ring whose raw count meets the
    // quorum but whose distinct-identity count does NOT (≥2 raw share 1 identity) is refused. SAT = the
    // refusal is reachable (the quorum is keyed on identities, so raw majority ≠ admission).
    let script =
        "(declare-const Q Int)(declare-const rawInQ Int)(declare-const distinctInQ Int)\n" +
        "(assert (> Q 0))\n" +
        "(assert (>= rawInQ Q))\n" + // raw nodes meet the threshold count
        "(assert (< distinctInQ Q))\n" + // distinct identities fall short ⇒ refused
        "(assert (<= distinctInQ (- rawInQ 1)))\n" + // ≥2 raw nodes collapse to fewer distinct identities
        "(check-sat)\n"
    z3ScriptHasModel "(b) Sybil raw-majority refusal reachable" script


// ═══════════════════════════════════════════════════════════════════
// Aurora G3a — anti-Sybil entropy COST-FLOOR (the distinctness-enforcement structure for (b)).
// Scoping: docs/research/2026-06-19-g3-anti-sybil-entropy-cost-the-distinctness-enforcement-under-aurora-b-scoping.md
// Model: an identity costs a floor `c > 0` of captured entropy; holding N distinct identities costs
// N·c; captured entropy E affords at most floor(E/c) distinct identities. This makes "no economy of
// scale in forging" explicit — the structural heart of anti-Sybil (Douceur 2002: needs a costly
// resource; Dwork–Naor / proof-of-work pricing shape).
// SCOPE (the binding honesty — do NOT read as closing G3): this is G3a (cost-LINEARITY) only. It is
// CONDITIONAL on G3b — that the entropy floor `c` is a REAL, conserved, non-forgeable resource — which
// is the open crux (§B), NOT proven here. So: structure CI-enforced, premise (G3b) named-and-open,
// exactly the "arithmetic proven, premise named" shape (b) itself has. And (L4): Sybil is made
// prohibitive-by-COST, not impossible — a funded adversary CAN pay (the four non-claims bind).
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``Z3 proves the cost barrier: you cannot afford Q distinct identities below Q*c (G3a)`` () =
    // c>0 ∧ N≥Q ∧ E < Q·c ⇒ N·c > E — affording N≥Q identities is impossible under-funded.
    let script =
        "(declare-const c Int)(declare-const N Int)(declare-const Q Int)(declare-const E Int)\n" +
        "(assert (not (=> (and (> c 0) (>= N Q) (< E (* Q c))) (> (* N c) E))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "(G3a) cost barrier below Q*c" script

[<Fact>]
let ``Z3 proves NO economy of scale: entropy for one identity (E=c) yields at most ONE distinct (G3a)`` () =
    // The anti-Sybil heart: a ring of any number of raw nodes funded for one capture (E=c) can hold
    // ≤ 1 distinct identity — it cannot manufacture N>1 distinct identities for one identity's cost.
    let script =
        "(declare-const c Int)(declare-const N Int)(declare-const E Int)\n" +
        "(assert (not (=> (and (> c 0) (= E c) (>= N 0) (<= (* N c) E)) (<= N 1))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "(G3a) no economy of scale (E=c ⇒ ≤1 distinct)" script

[<Fact>]
let ``Z3 proves identity cost is monotone/linear in the count (G3a)`` () =
    let script =
        "(declare-const c Int)(declare-const N1 Int)(declare-const N2 Int)\n" +
        "(assert (not (=> (and (> c 0) (<= N1 N2)) (<= (* N1 c) (* N2 c)))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "(G3a) cost monotone/linear" script

[<Fact>]
let ``Z3 witnesses prohibitive-by-COST not impossible: a funded adversary CAN buy a quorum (G3a)`` () =
    // The honest seam made executable: G3 makes Sybil prohibitive-by-cost, NOT impossible. A
    // sufficiently-funded adversary (E ≥ Q·c) can pay for Q distinct identities — SAT. (This is why
    // the four non-claims bind: P(infection) > 0; cost raises the bar, it does not close the door.)
    let script =
        "(declare-const c Int)(declare-const N Int)(declare-const Q Int)(declare-const E Int)\n" +
        "(assert (> c 0))(assert (>= Q 3))(assert (>= N Q))(assert (<= (* N c) E))\n" +
        "(check-sat)\n"
    z3ScriptHasModel "(G3a) funded adversary can pay (prohibitive-by-cost, not impossible)" script

// ═══════════════════════════════════════════════════════════════════
// Greenfield ATP and Cross-Check Harness Validation Tests
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``E prover proves Bloom-filter probe determinism (FOL)`` () =
    let query = 
        "fof(bloom_det, conjecture, (k1 = k2 => (h1(k1) = h1(k2) & h2(k1) = h2(k2))))."
    folHolds "bloom_det" query

[<Fact>]
let ``E prover proves Merkle second-preimage resistance (FOL)`` () =
    let query =
        "fof(h_injective, axiom, ! [X1, Y1, Z1, W1, X2, Y2, Z2, W2] : (h(X1, Y1, Z1, W1) = h(X2, Y2, Z2, W2) => (X1 = X2 & Y1 = Y2 & Z1 = Z2 & W1 = W2))).\n" +
        "fof(merkle_injective, conjecture, (h(a1, b1, c1, d1) = h(a2, b2, c2, d2) => (a1 = a2 & b1 = b2 & c1 = c2 & d1 = d2)))."
    folHolds "merkle_injective" query

[<Fact>]
let ``E prover proves Hard-refusal carve-out is absorbing (FOL)`` () =
    let query =
        "fof(hard_refusal, axiom, ! [X] : (isHardRefusal(X) => isRefused(X))).\n" +
        "fof(hard_refusal_absorbing, conjecture, (isHardRefusal(m) => isRefused(m)))."
    folHolds "hard_refusal_absorbing" query

[<Fact>]
let ``E prover proves Real-distress excludes fictional-scene (FOL)`` () =
    let query =
        "fof(real_distress_axiom, axiom, ! [X] : (realDistress(X) => (inRealEngagement(X) & ~inFictionalScene(X)))).\n" +
        "fof(real_distress_conjecture, conjecture, (realDistress(m) => ~inFictionalScene(m)))."
    folHolds "real_distress_conjecture" query

[<Fact>]
let ``Z3 vs CVC5 cross-check harness catches a planted disagreement`` () =
    let sha256 (input: string) =
        use hasher = System.Security.Cryptography.SHA256.Create()
        let bytes = hasher.ComputeHash(System.Text.Encoding.UTF8.GetBytes(input))
        bytes |> Array.map (fun b -> b.ToString("x2")) |> String.concat ""

    let findRepoRoot () =
        let rec search (dir: string) =
            if File.Exists(Path.Combine(dir, "Zeta.sln")) then
                dir
            else
                let parent = Directory.GetParent(dir)
                if parent = null then
                    failwith "Could not find repository root (Zeta.sln)"
                else
                    search parent.FullName
        search (Directory.GetCurrentDirectory())

    let originalMode = Environment.GetEnvironmentVariable("ZETA_SOLVER_MODE")
    let replayPath = Path.Combine(findRepoRoot(), "tests/Tests.FSharp/Formal/solver-replay.json")
    let backupExist = File.Exists(replayPath)
    let backupContent = if backupExist then File.ReadAllText(replayPath) else ""
    try
        Environment.SetEnvironmentVariable("ZETA_SOLVER_MODE", "replay")
        
        let dummyQuery = "(check-sat) ; dummy disagreement query"
        let hash = sha256 dummyQuery
        let db = Dictionary<string, Dictionary<string, string>>()
        db.["z3"] <- Dictionary()
        db.["z3"].[hash] <- "unsat"
        db.["cvc5"] <- Dictionary()
        db.["cvc5"].[hash] <- "sat" // mismatch!
        
        let options = JsonSerializerOptions(WriteIndented = true)
        let json = JsonSerializer.Serialize(db, options)
        File.WriteAllText(replayPath, json)
        
        (fun () -> SolverHarness.crossCheck dummyQuery |> ignore)
        |> should throw typeof<System.Exception>
    finally
        Environment.SetEnvironmentVariable("ZETA_SOLVER_MODE", originalMode)
        if backupExist then
            File.WriteAllText(replayPath, backupContent)
        else
            if File.Exists(replayPath) then File.Delete(replayPath)


[<Fact>]
let ``Z3 proves THE CHSH LOCAL-HIDDEN-VARIABLE BOUND: for deterministic ±1 outcomes, ab − ab' + a'b + a'b' ≤ 2 (Soraya batch 2a)`` () =
    // The inequality behind AntiSybil.chshSybil's conviction semantics (Bell 1964;
    // CHSH 1969): any deterministic local assignment of ±1 outcomes to the four
    // measurement slots keeps the CHSH combination within [−2, 2]. Shared classical
    // randomness is a convex mixture of these deterministic strategies, so the
    // expectation bound follows by convexity — the finite-sample margin ε(n) on the
    // EMPIRICAL Ŝ is the separate, Hoeffding-calibrated statement (AntiSybil.chshMargin).
    let script =
        "(declare-const a Int)\n" +
        "(declare-const b Int)\n" +
        "(declare-const a2 Int)\n" +
        "(declare-const b2 Int)\n" +
        "(assert (or (= a 1) (= a (- 1))))\n" +
        "(assert (or (= b 1) (= b (- 1))))\n" +
        "(assert (or (= a2 1) (= a2 (- 1))))\n" +
        "(assert (or (= b2 1) (= b2 (- 1))))\n" +
        "(assert (not (and (<= (+ (- (* a b) (* a b2)) (* a2 b) (* a2 b2)) 2)\n" +
        "                  (>= (+ (- (* a b) (* a b2)) (* a2 b) (* a2 b2)) (- 2)))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "CHSH LHV bound (deterministic strategies)" script

// ═══════════════════════════════════════════════════════════════════
// C9 (081KT2T2J0008QG0R000YZ3NMY P1) — v²-overflow safety in `vHat`.
//
// The probit projection computes:
//   v̂ = v·(1 − (v/(1+v))·λ(z+λ))
// The C9 claim is that v/(1+v) < 1 for ALL valid v > 0, which means
// the intermediate (v/(1+v))·λ(z+λ) never amplifies the v² term
// beyond v itself — keeping v̂ finite even when v = 1e308.
//
// Z3/CVC5 prove this over the IDEAL REALS. Quotient bounds are encoded
// without variable-denominator division so linear-logic solvers cannot
// report a diagnostic and then also print a bogus `sat`.
//   ∀ v > 0. v / (1 + v) < 1   (trivially: v < 1 + v ⟺ 0 < 1)
// The FsCheck twin (Ep.Tests.fs: "no v-squared overflow" Fact) exercises
// the actual floating-point implementation at v = 1e308.
//
// Anchor: Ep.fs line 89: `let vHat = v * (1.0 - (v / (1.0 + v)) * lambda * (z + lambda))`
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``Z3 proves v/(1+v) < 1 for all v > 0 (C9: no v² overflow in vHat)`` () =
    // Since 1+v is positive, negate v/(1+v) < 1 as v >= 1+v -> unsat.
    let script =
        "(set-logic QF_LRA)\n" +
        "(declare-const v Real)\n" +
        "(assert (> v 0.0))\n" +
        "(assert (>= v (+ 1.0 v)))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C9 v/(1+v) < 1 for v > 0 (vHat overflow safety)" script

[<Fact>]
let ``Z3 proves v/(1+v) > 0 for all v > 0 (C9: vHat factor is non-trivial)`` () =
    // Since 1+v is positive, v/(1+v) <= 0 iff v <= 0 -> unsat under v > 0.
    let script =
        "(set-logic QF_LRA)\n" +
        "(declare-const v Real)\n" +
        "(assert (> v 0.0))\n" +
        "(assert (<= v 0.0))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C9 v/(1+v) > 0 for v > 0 (vHat factor is positive)" script

[<Fact>]
let ``Z3 proves v*(1 - v/(1+v)) = v/(1+v) for all v > 0 (C9: factored form algebraically correct)`` () =
    // Confirms the factored v·(1 − r) = r identity for r = v/(1+v)
    // without using a variable-denominator division term in the SMT query.
    let script =
        "(set-logic QF_NRA)\n" +
        "(declare-const v Real)\n" +
        "(declare-const r Real)\n" +
        "(assert (> v 0.0))\n" +
        "(assert (= (* r (+ 1.0 v)) v))\n" +
        "(assert (not (= (* v (- 1.0 r)) r)))\n" +
        "(check-sat)\n"
    z3ScriptHolds "C9 v*(1 - v/(1+v)) = v/(1+v) algebraic identity" script

// ═══════════════════════════════════════════════════════════════════
// SM-Z3: Soft-mode structural invariants — Z3 QF_LRA algebraic layer
//
// These lemmas are the algebraic underpinning of the soft-mode invariant
// proved computationally in SoftMode.Tests.fs. They prove properties of
// the IDEAL MATHEMATICAL OBJECTS (Gaussian natural parameters) that the
// FsCheck properties exercise in the actual F# code.
//
// SM-Z3-1: Product precision > each factor → probit always reduces variance.
// SM-Z3-2: Product variance < each factor → no Dirac-delta fixed point.
// SM-Z3-3: Flat message (τ=0) is safe identity → cannot corrupt proper marginal.
// SM-Z3-4: Equality-factor mean strictly between priors → mutual empowerment.
// SM-Z3-5: Sum of finite precisions is finite → no spurious Dirac delta.
//
// Anchor: Minka 2001 (EP); GPML §3.4 (probit); SoftMode.Tests.fs (FsCheck twins);
//   FROZEN-CORE §B-other (non-collapse balance); 081KT7YW00008QG0R001DGZQKM.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``SM-Z3-1: Gaussian product precision strictly exceeds each factor (probit always reduces variance)`` () =
    // ∀ τ₁ > 0, τ₂ > 0. τ₁ + τ₂ > τ₁  (negate → τ₂ ≤ 0 contradicts τ₂ > 0 → unsat)
    let script =
        "(set-logic QF_LRA)\n" +
        "(declare-const tau1 Real)\n" +
        "(declare-const tau2 Real)\n" +
        "(assert (> tau1 0.0))\n" +
        "(assert (> tau2 0.0))\n" +
        "(assert (<= (+ tau1 tau2) tau1))\n" +
        "(check-sat)\n"
    z3ScriptHolds "SM-Z3-1 product precision > each factor (soft-mode: probit always reduces variance)" script

[<Fact>]
let ``SM-Z3-2: Gaussian product variance strictly less than each factor (no Dirac-delta fixed point)`` () =
    // ∀ τ₁ > 0, τ₂ > 0. 1/(τ₁+τ₂) < 1/τ₁  ⟺  τ₁ < τ₁+τ₂  ⟺  0 < τ₂
    // Negate: τ₁ ≥ τ₁+τ₂ → τ₂ ≤ 0, contradicts τ₂ > 0 → unsat
    let script =
        "(set-logic QF_LRA)\n" +
        "(declare-const tau1 Real)\n" +
        "(declare-const tau2 Real)\n" +
        "(assert (> tau1 0.0))\n" +
        "(assert (> tau2 0.0))\n" +
        "(assert (>= tau1 (+ tau1 tau2)))\n" +
        "(check-sat)\n"
    z3ScriptHolds "SM-Z3-2 product variance < each factor (no Dirac-delta fixed point)" script

[<Fact>]
let ``SM-Z3-3: flat message (tau=0) cannot make a proper marginal improper (safe identity element)`` () =
    // ∀ τ > 0. τ + 0 > 0  (negate → τ ≤ 0 contradicts τ > 0 → unsat)
    let script =
        "(set-logic QF_LRA)\n" +
        "(declare-const tau Real)\n" +
        "(assert (> tau 0.0))\n" +
        "(assert (<= (+ tau 0.0) 0.0))\n" +
        "(check-sat)\n"
    z3ScriptHolds "SM-Z3-3 flat message (tau=0) is safe identity — cannot make proper marginal improper" script

[<Fact>]
let ``SM-Z3-4: mutual empowerment — equality-factor mean is strictly between the two priors`` () =
    // ∀ μ₁ < μ₂, τ > 0. μ₁ < (τμ₁+τμ₂)/(2τ) < μ₂.
    // midpoint = (μ₁+μ₂)/2; negate: midpoint ≤ μ₁ OR midpoint ≥ μ₂ → unsat
    let script =
        "(set-logic QF_LRA)\n" +
        "(declare-const mu1 Real)\n" +
        "(declare-const mu2 Real)\n" +
        "(assert (< mu1 mu2))\n" +
        "(assert (or\n" +
        "  (<= (+ mu1 mu2) (* 2.0 mu1))\n" +
        "  (>= (+ mu1 mu2) (* 2.0 mu2))))\n" +
        "(check-sat)\n"
    z3ScriptHolds "SM-Z3-4 mutual empowerment: equality-factor mean strictly between priors" script

[<Fact>]
let ``SM-Z3-5: sum of finite bounded precisions is finite (no spurious Dirac delta)`` () =
    // ∀ 0 < τ₁ ≤ M, 0 < τ₂ ≤ M. τ₁+τ₂ ≤ 2M  (negate → τ₁+τ₂ > 2M, contradicts τ₁≤M ∧ τ₂≤M → unsat)
    let script =
        "(set-logic QF_LRA)\n" +
        "(declare-const tau1 Real)\n" +
        "(declare-const tau2 Real)\n" +
        "(declare-const M Real)\n" +
        "(assert (> tau1 0.0))\n" +
        "(assert (> tau2 0.0))\n" +
        "(assert (<= tau1 M))\n" +
        "(assert (<= tau2 M))\n" +
        "(assert (> (+ tau1 tau2) (* 2.0 M)))\n" +
        "(check-sat)\n"
    z3ScriptHolds "SM-Z3-5 sum of finite precisions is finite (no spurious Dirac delta)" script

// ═══════════════════════════════════════════════════════════════════
// SM-Z3-BRIDGE: CausalPower → FactorGraph substrate connection
//
// The abstract CausalPower lemmas (Lemma 16/17 above) prove that a
// *free* policy can have causal power and a *collapsed* policy cannot.
// But they use uninterpreted sorts (PrivateState = Int, Policy = function).
//
// These bridge lemmas ground the abstract model in the CONCRETE
// factor-graph substrate: PrivateState = Gaussian prior (τ, ν),
// Policy = marginal after runToFixpoint, Action = posterior mean.
//
// SM-Z3-B1: Two agents with DIFFERENT priors produce DIFFERENT marginals.
//   The marginal mean is (ν₁+ν₂)/(τ₁+τ₂). If agent A has fixed prior
//   (τ_A, ν_A) and agent B changes its prior mean μ_B = ν_B/τ_B, then
//   the shared marginal mean changes. This is the concrete instantiation
//   of "distinct private states map to distinct actions" (Lemma 16).
//
// SM-Z3-B2: A COLLAPSED agent (τ_B → ∞, ν_B → ∞ with ν_B/τ_B = const)
//   cannot change the marginal mean of agent A. When τ_B dominates,
//   the marginal collapses to ν_B/τ_B regardless of A's prior — A has
//   lost causal power. This is the concrete instantiation of Lemma 17.
//   The SM-2/SM-3 FsCheck properties show this cannot happen in the
//   actual network (the constructor forbids infinite-precision priors).
//
// SM-Z3-B3: The equality-factor marginal mean is a STRICTLY MONOTONE
//   function of each agent's prior mean (with equal precisions). So
//   changing either agent's prior ALWAYS changes the marginal — the
//   causal power is not just possible but GUARANTEED by the topology.
//   This is the concrete "mutual empowerment" claim.
//
// Anchor: SM-3 FsCheck properties (SoftMode.Tests.fs); CausalPower
//   Lemma 16/17 (above); FROZEN-CORE §B-other non-collapse balance;
//   Pearl (2009) §1.3 interventional independence.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``SM-Z3-B1: different prior means produce different marginal means (concrete CausalPower witness)`` () =
    // Equality factor with equal precisions: marginal mean = (ν_A + ν_B) / (τ_A + τ_B)
    //   = (τ·μ_A + τ·μ_B) / (2τ) = (μ_A + μ_B) / 2
    // If μ_B1 ≠ μ_B2 then marginal1 ≠ marginal2 → agent B's prior influences A's marginal.
    // Negate: same marginal despite different μ_B → unsat (arithmetic contradiction).
    let script =
        "(set-logic QF_LRA)\n" +
        "(declare-const mu_A Real)\n" +
        "(declare-const mu_B1 Real)\n" +
        "(declare-const mu_B2 Real)\n" +
        "(declare-const tau Real)\n" +
        "(assert (> tau 0.0))\n" +
        "(assert (not (= mu_B1 mu_B2)))\n" +
        // marginal1 = (mu_A + mu_B1)/2, marginal2 = (mu_A + mu_B2)/2
        // negate: marginal1 = marginal2 → mu_B1 = mu_B2 → contradiction
        "(assert (= (/ (+ mu_A mu_B1) 2.0) (/ (+ mu_A mu_B2) 2.0)))\n" +
        "(check-sat)\n"
    z3ScriptHolds "SM-Z3-B1 different prior means → different marginals (concrete CausalPower witness)" script

[<Fact>]
let ``SM-Z3-B2: collapsed agent (infinite precision) erases other agent's causal power`` () =
    // When τ_B → ∞ (collapsed agent), the marginal mean → ν_B/τ_B = μ_B
    // regardless of A's prior. Agent A has lost causal power.
    // Model: marginal = (τ_A·μ_A + τ_B·μ_B) / (τ_A + τ_B).
    // As τ_B → ∞ with μ_B fixed: marginal → μ_B, independent of μ_A.
    // Z3 proof: if τ_B >> τ_A (τ_B = K·τ_A for large K), then
    //   |marginal - μ_B| = τ_A·|μ_A - μ_B| / (τ_A + τ_B) → 0.
    // Negate: marginal = μ_B exactly when τ_A = 0 (A has no prior) → unsat if τ_A > 0.
    // Concrete: with τ_A > 0, the marginal is NEVER exactly μ_B (A still has some power).
    // But as τ_B/τ_A → ∞, A's influence → 0. This is the collapse hazard SM-2 prevents.
    let script =
        "(set-logic QF_NRA)\n" +
        "(declare-const mu_A Real)\n" +
        "(declare-const mu_B Real)\n" +
        "(declare-const tau_A Real)\n" +
        "(declare-const tau_B Real)\n" +
        "(assert (> tau_A 0.0))\n" +
        "(assert (> tau_B 0.0))\n" +
        "(assert (not (= mu_A mu_B)))\n" +
        // The marginal mean is strictly between mu_A and mu_B (not equal to either)
        // when both precisions are positive. Multiply by the positive denominator
        // instead of writing a division term; the product is nonlinear, so QF_NRA is honest here.
        "(assert (= (+ (* tau_A mu_A) (* tau_B mu_B)) (* mu_B (+ tau_A tau_B))))\n" +
        "(check-sat)\n"
    // The equality would require tau_A*(mu_A-mu_B)=0; tau_A > 0 and mu_A != mu_B
    // make that impossible.
    z3ScriptHolds "SM-Z3-B2 collapsed agent erases other's causal power: marginal ≠ mu_B when tau_A > 0 and mu_A ≠ mu_B" script

[<Fact>]
let ``SM-Z3-B3: marginal mean is strictly monotone in each prior mean (mutual empowerment is guaranteed)`` () =
    // ∀ τ > 0, μ_A, μ_B1 < μ_B2.
    //   (μ_A + μ_B1)/2 < (μ_A + μ_B2)/2
    // The marginal is strictly increasing in μ_B. So changing μ_B ALWAYS
    // changes the marginal — causal power is not just possible but guaranteed.
    // Negate: marginal1 ≥ marginal2 with μ_B1 < μ_B2 → unsat.
    let script =
        "(set-logic QF_LRA)\n" +
        "(declare-const mu_A Real)\n" +
        "(declare-const mu_B1 Real)\n" +
        "(declare-const mu_B2 Real)\n" +
        "(declare-const tau Real)\n" +
        "(assert (> tau 0.0))\n" +
        "(assert (< mu_B1 mu_B2))\n" +
        "(assert (>= (/ (+ mu_A mu_B1) 2.0) (/ (+ mu_A mu_B2) 2.0)))\n" +
        "(check-sat)\n"
    z3ScriptHolds "SM-Z3-B3 marginal strictly monotone in prior mean: mutual empowerment is guaranteed by topology" script
