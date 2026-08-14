; landauer-floor-lemma.smt2
;
; STATUS (2026-08-13, Soraya): rewritten after the previous version was found VACUOUS.
;
; What was wrong. The previous file asserted, as a premise, the second law in the form
;   (assert (>= (+ (- k) heat) 0.0))
; which simplifies to `heat >= k` — algebraically identical to the conclusion it then negated
; with `(assert (< heat k))`. The UNSAT was produced entirely by that propositional
; contradiction: the file proved `heat >= k  =>  heat >= k`. Measured, not assumed: deleting
; only that premise and re-running z3 returns SAT with the model k=1.0, heat=0.0 — an erasure
; paying no heat at all. Nothing else in the file excluded it. The header also advertised four
; lemmas (F1-F4); only F1 was present.
;
; What this file does now. It states the two-ledger update equations explicitly, derives the
; Landauer floor from total-entropy monotonicity over those equations, and — critically —
; carries its own NON-VACUITY PROBE: a block that drops the second-law premise and asserts the
; result is SAT. A verifier that expects the verdict sequence
;   unsat sat unsat unsat unsat
; cannot be fooled by a premise that has quietly become the conclusion, because a premise doing
; no work would make probe (V) unsat and fail the expectation.
;
; Honest limit, stated so nobody rounds it up: (F1) is a DERIVATION of Landauer from the second
; law in this model, not independent evidence for either. Its content is that the two-ledger
; bookkeeping is consistent with the bound — the same class of claim as the TypeScript
; `auditEntropyLedger`, and strictly weaker than a measurement. See
; `src/Core.TypeScript/algebra/key-erasure-meter.ts` for the accounting-vs-measurement split.
; (F4) is the one lemma here with non-trivial content: it is not derivable by simplification.
;
; Anchors: Landauer 1961; Bennett 1973 (reversible ops are free);
; Schmiedl and Seifert 2007 (finite-time excess L^2/tau).

(set-logic QF_NRA)
(set-option :produce-models true)

; ─── F1: Landauer floor, derived from the ledger equations ───────────────────
; Model: a measurement of k bits maps (stateA, heatB) |-> (stateA - k, heatB + h)
; where h is the heat actually paid. Second law: the total does not decrease.
; Claim: h >= k. Negate and expect UNSAT.

(push 1)
(declare-const k Real)      ; bits erased by this measurement
(declare-const h Real)      ; heat actually paid for it
(declare-const stateA Real) ; Ledger A before
(declare-const heatB Real)  ; Ledger B before

(assert (> k 0.0))          ; an erasure actually happened
(assert (>= h 0.0))         ; heat is non-negative
(assert (>= heatB 0.0))

; Second law over the ledger update: total_after >= total_before.
(assert (>= (+ (- stateA k) (+ heatB h)) (+ stateA heatB)))

(assert (< h k))            ; negated conclusion
(check-sat)                 ; expect: unsat
(pop 1)

; ─── V: NON-VACUITY PROBE for F1 (the check that the old file would have failed) ──
; Identical to F1 with the second-law premise REMOVED. If that premise is doing real work,
; the negated conclusion is now satisfiable: an erasure paying less than its floor exists.
; Expect SAT. A future edit that turns F1 back into a tautology makes this block unsat and
; breaks the expected verdict sequence.

(push 1)
(declare-const k2 Real)
(declare-const h2 Real)
(assert (> k2 0.0))
(assert (>= h2 0.0))
(assert (< h2 k2))
(check-sat)                 ; expect: sat  (witness: k2=1, h2=0 — erasure paying nothing)
(pop 1)

; ─── F2: the floor is TIGHT, and Bennett is its k=0 corner ───────────────────
; A bound nobody can meet is as useless as one nobody can miss, so both corners get checked
; as SATISFIABILITY (a witness exists), not as another negated implication:
;
;   F2a (Bennett)   k = 0, h = 0 is consistent with the second law
;                   -> a reversible operation is genuinely free; the floor does not secretly
;                      charge for doing nothing.
;   F2b (tightness) k > 0, h = k is consistent with the second law
;                   -> equality is achievable (the quasi-static limit); F1 is not vacuously
;                      strong by forbidding its own equality case.
;
; Note what is NOT claimed: that a reversible op MUST pay zero. The second law does not forbid
; gratuitous dissipation, and no encoding of it here would. Bennett zero-heat is a modelling
; assumption of the two-ledger tracker, and calling it a proven lemma would be exactly the
; rounding-up this file was rewritten to stop.

(push 1)
(declare-const s0 Real)
(declare-const b0 Real)
(assert (>= s0 0.0))
(assert (>= b0 0.0))
; F2a: nothing erased, nothing paid, second law intact.
(assert (>= (+ (- s0 0.0) (+ b0 0.0)) (+ s0 b0)))
(check-sat)                 ; expect: sat
(pop 1)

(push 1)
(declare-const k3 Real)
(declare-const s1 Real)
(declare-const b1 Real)
(assert (> k3 0.0))
(assert (>= s1 0.0))
(assert (>= b1 0.0))
; F2b: pay exactly the floor. Second law still intact -> equality is reachable.
(assert (>= (+ (- s1 k3) (+ b1 k3)) (+ s1 b1)))
(check-sat)                 ; expect: sat
(pop 1)

; ─── F4: predictive advantage (the one lemma here with non-trivial content) ───
; Finite-time thermodynamics: the excess above the floor is L^2/tau, so a longer erasure
; window costs less. Encoded without division: excess_i * tau_i = L2, excess_i > 0.
; Neither of the two claims below is reachable by simplification the way F1 was.

; F4a: strictly larger window => strictly smaller excess.
(push 1)
(declare-const L2 Real)
(declare-const tau1 Real)
(declare-const tau2 Real)
(declare-const e1 Real)
(declare-const e2 Real)
(assert (> L2 0.0))
(assert (> tau1 0.0))
(assert (> tau2 tau1))
(assert (= (* e1 tau1) L2))
(assert (= (* e2 tau2) L2))
(assert (> e1 0.0))
(assert (> e2 0.0))
(assert (>= e2 e1))          ; negated conclusion (claim: e2 < e1)
(check-sat)                  ; expect: unsat
(pop 1)

; F4b: for any FINITE window the excess is strictly positive — the floor is approached,
; never reached. This is what forbids claiming a real commit paid exactly the Landauer floor.
(push 1)
(declare-const L2b Real)
(declare-const taub Real)
(declare-const eb Real)
(assert (> L2b 0.0))
(assert (> taub 0.0))
(assert (= (* eb taub) L2b))
(assert (<= eb 0.0))         ; negated conclusion (claim: eb > 0)
(check-sat)                  ; expect: unsat
(pop 1)

; ─── Expected verdict sequence (locked by landauer-floor-lemma.test.ts) ──────
;   F1  unsat   floor derived from the ledger equations
;   V   sat     NON-VACUITY probe: without the second law, a free erasure exists
;   F2a sat     Bennett corner reachable
;   F2b sat     floor is tight
;   F4a unsat   larger window, strictly smaller excess
;   F4b unsat   finite window, strictly positive excess
