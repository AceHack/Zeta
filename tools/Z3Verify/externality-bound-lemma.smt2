; externality-bound-lemma.smt2
; Target: src/Core.TypeScript/planning/empowerment-bound.ts:244-253  externalitySafe()
;         src/Core.TypeScript/planning/calibration-ledger.ts:393-398  trustBound()
;
; ANCHOR: factory-native predicate; the underlying floor is Cantelli (1928) / Scarf (1958)
;   (mu - k*sigma is the EXACT maximin over the moment-ambiguity class, shortfall
;   alpha = 1/(1+k^2)).  The externality *predicate* itself has no literature anchor --
;   the closest is the Pigouvian externality condition, which prices harm rather than
;   forbidding it, and the Pareto-noninterference condition, which forbids ANY harm.
;   Neither matches "harm bounded by a party-declared floor". Factory-native; documented.
;
; PROSE PROPERTY (design doc 2026-08-09-mutual-empowerment-bound..., line 210-213):
;   "No interaction between consenting parties may reduce a non-consenting third
;    party's trustBound (or option space) below its floor."
;
; SHIPPED CODE (reading (a), "never below zero"):
;   floor      := clamp01(mu - k*sigma)
;   afterFloor := floor + min(0, delta)
;   safe       := afterFloor >= 0
;
; This file does NOT try to prove the shipped predicate correct. It EXHIBITS the
; degeneracies of reading (a) as SAT witnesses, and proves the one structural
; property (a) does have (harm-antitonicity), so the routing decision rests on
; machine-checked facts rather than on reading the source.
;
; Soraya routing, 2026-08-09. Run: z3 tools/Z3Verify/externality-bound-lemma.smt2

(set-logic QF_NRA)

(define-fun clamp01 ((x Real)) Real (ite (< x 0.0) 0.0 (ite (> x 1.0) 1.0 x)))
(define-fun negpart ((x Real)) Real (ite (< x 0.0) x 0.0))          ; Math.min(0, x)
(define-fun safeA  ((floor Real) (delta Real)) Bool
  (>= (+ floor (negpart delta)) 0.0))                                ; shipped predicate

; ---------------------------------------------------------------------------
; L1  [UNSAT expected]  floor is ALWAYS in [0,1] -- trustBound is clamped.
;     Consequence used by L2/L3: `floor >= 0` is a theorem, not a hypothesis.
; ---------------------------------------------------------------------------
(push)
(declare-const mu Real) (declare-const sg Real) (declare-const k Real)
(assert (>= sg 0.0)) (assert (>= k 0.0))
(assert (not (and (>= (clamp01 (- mu (* k sg))) 0.0) (<= (clamp01 (- mu (* k sg))) 1.0))))
(check-sat)   ; unsat  => floor in [0,1] always
(pop)

; ---------------------------------------------------------------------------
; L2  [UNSAT expected]  DEGENERACY 1 -- vacuity on non-negative delta.
;     For every third party and every delta >= 0, safeA is TRUE unconditionally.
;     i.e. the predicate carries ZERO information about the third party on the
;     benefit side. Test EB-8 (empowerment-bound.test.ts:97-101) asserts exactly
;     this and therefore cannot fail: it is a tautology test.
; ---------------------------------------------------------------------------
(push)
(declare-const floor Real) (declare-const delta Real)
(assert (and (>= floor 0.0) (<= floor 1.0)))
(assert (>= delta 0.0))
(assert (not (safeA floor delta)))
(check-sat)   ; unsat => safeA is vacuously true for all non-negative delta
(pop)

; ---------------------------------------------------------------------------
; L3  [SAT expected]  DEGENERACY 2 -- HARM TOLERANCE EQUALS THE BYSTANDER'S SCORE.
;     safeA admits every delta >= -floor. So the admitted harm budget for a
;     bystander IS its calibration floor. Executed against the shipped code
;     (mu=.95, sigma=.01 -> floor=0.92): delta = -0.9 returns TRUE -- a 90%
;     reduction of a bystander's reach is reported "externality-safe".
;     The floor = 1.0 / delta = -1.0 corner below is the limit case (unreachable
;     under Beta(2,2), which always has sigma > 0, but it is the sup of the family).
; ---------------------------------------------------------------------------
(push)
(declare-const floor Real) (declare-const delta Real)
(assert (= floor 0.92)) (assert (= delta (- 0.9)))   ; shipped-reachable instance
(assert (safeA floor delta))
(check-sat) (get-model)   ; sat => witness of the degeneracy
(pop)

; ---------------------------------------------------------------------------
; L4  [SAT expected]  Otto's reported divergence, machine-confirmed:
;     floor = 0.8, delta = -0.7  ->  safeA TRUE, yet the bystander ends at 0.1,
;     i.e. 0.7 BELOW its own floor. Reading (a) and the prose diverge here.
; ---------------------------------------------------------------------------
(push)
(declare-const floor Real) (declare-const delta Real)
(assert (= floor 0.8)) (assert (= delta (- 0.7)))
(assert (safeA floor delta))                       ; shipped predicate says SAFE
(assert (< (+ floor delta) floor))                 ; yet strictly below own floor
(check-sat) (get-model)   ; sat => divergence confirmed
(pop)

; ---------------------------------------------------------------------------
; L5  [UNSAT expected]  PROTECTION INVERSION.  There is NO pair of third parties
;     (weak, strong) and harm delta < 0 such that the WEAKER party (lower floor)
;     tolerates MORE harm than the stronger. Formally: safeA is monotone
;     NON-DECREASING in floor. Combined with L1 this means the least-established
;     bystander (floor = 0, the shipped Beta(2,2) fresh case: mu=.5 sigma=.2236,
;     mu-3sigma = -0.171 -> clamp 0) tolerates the LEAST harm and the most-
;     established tolerates the MOST. Protection scales with the bystander's
;     CALIBRATION SCORE, which is not a measure of how much harm they can absorb.
; ---------------------------------------------------------------------------
(push)
(declare-const fw Real) (declare-const fs Real) (declare-const delta Real)
(assert (and (>= fw 0.0) (<= fw 1.0))) (assert (and (>= fs 0.0) (<= fs 1.0)))
(assert (<= fw fs)) (assert (< delta 0.0))
(assert (and (safeA fw delta) (not (safeA fs delta))))
(check-sat)   ; unsat => strictly monotone in floor; inversion is structural, not a bug
(pop)

; ---------------------------------------------------------------------------
; L6  [UNSAT expected]  The one GOOD property (a) has: harm-antitonicity.
;     More harm is never more safe.
; ---------------------------------------------------------------------------
(push)
(declare-const floor Real) (declare-const d1 Real) (declare-const d2 Real)
(assert (and (>= floor 0.0) (<= floor 1.0)))
(assert (<= d1 d2))
(assert (and (safeA floor d1) (not (safeA floor d2))))
(check-sat)   ; unsat => antitone in harm (keep this property in any replacement)
(pop)

; ---------------------------------------------------------------------------
; L7  [UNSAT expected]  Reading (b) ("never below its own floor") is EXACTLY
;     `delta >= 0` -- Otto's collapse claim, machine-confirmed. So (b) cannot be
;     the intended predicate: it forbids every interaction with any negative
;     external effect, including ones the bystander would consent to.
; ---------------------------------------------------------------------------
(push)
(declare-const floor Real) (declare-const delta Real)
(define-fun safeB ((f Real) (d Real)) Bool (>= (+ f (negpart d)) f))
(assert (not (= (safeB floor delta) (>= delta 0.0))))
(check-sat)   ; unsat => (b) == (delta >= 0), collapse confirmed
(pop)

; ---------------------------------------------------------------------------
; L8  [UNSAT expected]  Reading (c): the design doc's OWN constraint
;     (design doc lines 60-62)   trustBound(party, after(a)) >= tau_party
;     subsumes both (a) and (b): (a) is (c) at tau = 0, (b) is (c) at tau = floor.
;     So the (a)-vs-(b) argument is an argument about the DEFAULT VALUE of a
;     party-owned parameter that externalitySafe() dropped from its signature.
; ---------------------------------------------------------------------------
(push)
(declare-const floor Real) (declare-const delta Real)
(define-fun safeC ((f Real) (d Real) (tau Real)) Bool (>= (+ f (negpart d)) tau))
(assert (and (>= floor 0.0) (<= floor 1.0)))
(assert (not (and (= (safeC floor delta 0.0)   (safeA floor delta))
                  (= (safeC floor delta floor) (>= delta 0.0)))))
(check-sat)   ; unsat => (c) subsumes (a) at tau=0 and (b) at tau=floor
(pop)

(exit)
