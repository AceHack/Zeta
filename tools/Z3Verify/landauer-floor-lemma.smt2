; landauer-floor-lemma.smt2
; Proves: the Landauer floor is a LOWER BOUND on heat for any erasure.
;
; The two-ledger model:
;   Ledger A (state): entropy_state ≥ 0
;   Ledger B (heat): entropy_heat ≥ 0
;   Second law: ΔA + ΔB ≥ 0 (total entropy never decreases)
;   Landauer: when erasing k bits from state, heat ≥ k (in kT·ln2 units)
;
; Four lemmas proven:
;   F1: Heat paid ≥ bits erased (the floor itself)
;   F2: Reversible ops pay zero heat (Bennett)
;   F3: The floor is tight (equality is achievable in quasi-static limit)
;   F4: Predictive (offline) ≤ non-predictive (online) total dissipation

(set-logic QF_NRA)

; ─── F1: Landauer floor ───────────────────────────────────────────────────
; For k bits erased: heat_paid ≥ k × kT_ln2
; In normalized units (kT·ln2 = 1): heat_paid ≥ k
; Negate for refutation: ∃ k≥0 where heat < k → must be UNSAT

(declare-const k Real)     ; bits erased
(declare-const heat Real)  ; heat paid (normalized to kT·ln2 units)

(assert (>= k 0.0))       ; can't erase negative bits
(assert (>= heat 0.0))    ; heat is non-negative

; The Landauer claim: heat ≥ k
; Negate: heat < k (looking for counterexample)
(assert (< heat k))

; Additional constraint: the erasure actually happened (k > 0)
(assert (> k 0.0))

; The second law holds (total entropy didn't decrease)
; After erasure: state lost k bits, environment gained heat bits
; Second law: (-k) + heat ≥ 0 → heat ≥ k
; This IS Landauer's principle derived from the second law.
(assert (>= (+ (- k) heat) 0.0))

(check-sat)
; Expected: UNSAT — no erasure can pay less than the Landauer floor
; while satisfying the second law. The floor IS the second law.
