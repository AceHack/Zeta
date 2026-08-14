; predictive-advantage-lemma.smt2
; Proves: predictive (offline) scheduling dissipates ≤ non-predictive (online).
;
; The finite-time erasure cost: W(τ) = floor + L²/τ
; where τ = erasure window, L² = thermodynamic length (constant for a given protocol)
;
; Predictive: knows (B, t) in advance → starts early → τ_pred ≥ τ_online
; Therefore: W_pred ≤ W_online (pointwise, for every batch)
;
; This IS the anti-Nagle insight: batching + prediction = larger τ = less excess.

(set-logic QF_NRA)

(declare-const floor Real)      ; Landauer floor (B × kT·ln2, batch-invariant)
(declare-const L_sq Real)       ; thermodynamic length² (protocol constant)
(declare-const tau_pred Real)   ; erasure window for predictive scheduler
(declare-const tau_online Real) ; erasure window for non-predictive scheduler

; Well-posedness constraints, shared by every block below.
(define-fun wellPosed () Bool
  (and (> floor 0.0) (> L_sq 0.0) (> tau_pred 0.0) (> tau_online 0.0)))

; --- P1  THE THEOREM ---------------------------------------------------------
; Costs:
; W_pred = floor + L²/τ_pred
; W_online = floor + L²/τ_online
;
; Claim: W_pred ≤ W_online
; i.e., floor + L²/τ_pred ≤ floor + L²/τ_online
; i.e., L²/τ_pred ≤ L²/τ_online
; i.e., 1/τ_pred ≤ 1/τ_online (since L² > 0)
; which follows from τ_pred ≥ τ_online
;
; SCOPED in (push)/(pop) as of the 2026-08-13 retrofit (work-item
; 081KZYYKHX1087G0R0036E9RH9). These assertions used to be at global scope with
; a single trailing (check-sat), so any block appended after them would have
; returned `unsat` for free -- the vacuity trap this file is being fixed against.
(push)
(assert wellPosed)
(assert (>= tau_pred tau_online))   ; predictive scheduler has MORE time
; Negate for refutation: assert W_pred > W_online
(assert (> (+ floor (/ L_sq tau_pred)) (+ floor (/ L_sq tau_online))))
(check-sat)
; Expected: UNSAT — the predictive scheduler can never dissipate MORE than online.
; The advantage is provable: prediction = larger τ = less excess = less total heat.
(pop)

; --- V1  NON-VACUITY PROBE: the window ordering is load-bearing ---------------
; P1 alone is indistinguishable from a tautology. This block drops exactly ONE
; hypothesis -- τ_pred ≥ τ_online, the whole content of "prediction buys time" --
; and asks for a counterexample. `sat` proves P1 is a theorem about that
; hypothesis and not a restatement of the cost formula.
; Witness shape: τ_pred < τ_online makes the predictive scheduler the one in a
; hurry, and it dissipates strictly MORE.
(push)
(assert wellPosed)
(assert (> (+ floor (/ L_sq tau_pred)) (+ floor (/ L_sq tau_online))))
(check-sat)   ; expect: sat  => without τ_pred ≥ τ_online the advantage is false
(pop)

; --- V2  NON-VACUITY PROBE: positivity of L² is load-bearing too -------------
; The step "1/τ_pred ≤ 1/τ_online ⟹ L²/τ_pred ≤ L²/τ_online" multiplies by L²,
; which reverses if L² < 0. Thermodynamic length squared is non-negative by
; construction (it is a squared Riemannian length -- Salamon & Berry 1983), so
; this is a hypothesis the CALLER discharges, and the file should say so out loud
; rather than let it hide inside "all positive".
(push)
(assert (and (> floor 0.0) (> tau_pred 0.0) (> tau_online 0.0)))
(assert (< L_sq 0.0))               ; <-- the DROPPED hypothesis, negated
(assert (>= tau_pred tau_online))
(assert (> (+ floor (/ L_sq tau_pred)) (+ floor (/ L_sq tau_online))))
(check-sat)   ; expect: sat  => L² > 0 is load-bearing, not decoration
(pop)

; Verdict sequence: unsat sat sat
