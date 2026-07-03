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

; Constraints: all positive
(assert (> floor 0.0))
(assert (> L_sq 0.0))
(assert (> tau_pred 0.0))
(assert (> tau_online 0.0))

; The key inequality: predictive scheduler has MORE time (starts earlier)
(assert (>= tau_pred tau_online))

; Costs:
; W_pred = floor + L²/τ_pred
; W_online = floor + L²/τ_online

; Claim: W_pred ≤ W_online
; i.e., floor + L²/τ_pred ≤ floor + L²/τ_online
; i.e., L²/τ_pred ≤ L²/τ_online
; i.e., 1/τ_pred ≤ 1/τ_online (since L² > 0)
; which follows from τ_pred ≥ τ_online

; Negate for refutation: assert W_pred > W_online
(assert (> (+ floor (/ L_sq tau_pred)) (+ floor (/ L_sq tau_online))))

(check-sat)
; Expected: UNSAT — the predictive scheduler can never dissipate MORE than online.
; The advantage is provable: prediction = larger τ = less excess = less total heat.
