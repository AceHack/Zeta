; light-time-endpoint-speed-envelope.smt2
;
; Proves: the ENDPOINT-SPEED ENVELOPE is a genuine upper bound on the one-way
; light-time asymmetry |tau_AB - tau_BA| for sub-luminal RECTILINEAR endpoint
; motion --- and that it is SHARP, so the inherited `* 1.2` multiplier in
; `src/Bayesian/OrbitalAsymmetryBudget.fs` covers nothing this model can produce.
;
; Context: work-items 081KZY5W6AJ087G0R003EE7PY6 (defect record) and
; 081KZYK0Q8Z087G0R0010Z2Z2Q (the proposed envelope, filed as PROPOSED with
; "never exceeded across a coarse two-body scan" as its only support --- a count,
; not a proof).  delta_max widens the OutOfCone cone in `BusRegime.regimeOf`, so a
; bound that is too TIGHT falsely convicts an honest message.  That is why this
; needs a theorem and not a scan.
;
; ---------------------------------------------------------------------------
; THE MODEL (stated, because the theorem is only as strong as its hypotheses)
;
; Fixed inertial frame.  Common transmit epoch t = 0.  Both endpoints move
; RECTILINEARLY at constant velocity over the light-time interval:
;     r_A(s) = r_A + s*v_A ,  r_B(s) = r_B + s*v_B
; Implicit one-way light-time equations (as stated in 081KZYK0Q8Z087G0R0010Z2Z2Q):
;     c*tAB = || r_B(tAB) - r_A(0) ||
;     c*tBA = || r_A(tBA) - r_B(0) ||
;
; EXACT 3D -> SCALAR REDUCTION (no approximation, no trig, no ephemeris):
; with R = ||r_B - r_A|| and u the A->B unit vector,
;     || R*u + t*v ||^2 = R^2 + 2*R*t*(u.v) + t^2*||v||^2
; so the equations depend on geometry ONLY through the scalars
;     s = u.v  (projected speed) and w = ||v|| (speed norm), with |s| <= w.
; Squaring is an EQUIVALENCE, not a relaxation: c*t > 0 and the norm is >= 0.
; The result is a polynomial sentence over the reals => the decidable theory of
; real closed fields (Tarski 1951; Collins CAD 1975), which is z3's nlsat
; fragment.  This encoding choice is the whole routing decision: quantify over
; STATES, never over orbital elements or time, and Kepler's transcendental
; fixed point never enters the SMT problem at all.
;
; SOUNDNESS CAVEAT: `unsat` here is a decision-procedure verdict, not a
; replayable proof object --- z3 emits no independently checkable certificate
; for nlsat.  This file is therefore ONE of two tools; the machine-checked
; cross-check is `src/Core.Lean4/Lean4/LightTimeAsymmetry.lean` (BP-16).
; ---------------------------------------------------------------------------
;
; Author: Soraya (formal-verification routing) 2026-08-13
; Run:    z3 tools/Z3Verify/light-time-endpoint-speed-envelope.smt2
; Expect: unsat unsat unsat unsat unsat unsat unsat unsat sat sat sat
;         (8 proved lemmas, 1 sharpness witness, 2 hypothesis-necessity witnesses)

(set-logic QF_NRA)

(declare-const c   Real)   ; signal speed
(declare-const R   Real)   ; ||r_B - r_A|| at the common epoch
(declare-const VA  Real)   ; DECLARED bound on endpoint A's speed
(declare-const VB  Real)   ; DECLARED bound on endpoint B's speed
(declare-const wA  Real)   ; actual ||v_A||
(declare-const wB  Real)   ; actual ||v_B||
(declare-const sA  Real)   ; u . v_A
(declare-const sB  Real)   ; u . v_B
(declare-const tAB Real)   ; one-way light time A -> B
(declare-const tBA Real)   ; one-way light time B -> A

(define-fun base () Bool
  (and (> c 0) (> R 0)
       (>= VA 0) (>= VB 0) (< VA c) (< VB c)
       (>= wA 0) (<= wA VA)                       ; VA bounds the ACTUAL speed
       (>= wB 0) (<= wB VB)
       (<= sA wA) (>= sA (- wA))                  ; Cauchy-Schwarz: |u.v| <= ||v||
       (<= sB wB) (>= sB (- wB))
       (> tAB 0) (> tBA 0)
       ; A -> B : receiver B has moved +tAB*v_B ; +2*R*t*sB
       (= (* (* c tAB) (* c tAB))
          (+ (* R R) (* 2 R tAB sB) (* tAB tAB wB wB)))
       ; B -> A : receiver A has moved +tBA*v_A, but seen from B the unit vector
       ; is -u, so the projection enters with the opposite sign ; -2*R*t*sA
       (= (* (* c tBA) (* c tBA))
          (+ (* R R) (- (* 2 R tBA sA)) (* tBA tBA wA wA)))))

; === L0  WELL-POSEDNESS ======================================================
; The "fixed point solve" is only meaningful if the equation has exactly one
; positive root.  Product of roots of (c^2-w^2)t^2 - 2*R*s*t - R^2 = 0 is
; -R^2/(c^2-w^2) < 0, so the roots straddle zero.

(push 1)  ; L0a  the positive root is unique
(declare-const t2 Real)
(assert base)
(assert (> t2 0))
(assert (= (* (* c t2) (* c t2)) (+ (* R R) (* 2 R t2 sB) (* t2 t2 wB wB))))
(assert (not (= t2 tAB)))
(check-sat)   ; expect unsat  => the positive root is unique
(pop 1)

(push 1)  ; L0b  the discriminant is strictly positive => a real root exists
(assert base)
(assert (not (> (+ (* 4 R R sB sB) (* 4 (- (* c c) (* wB wB)) R R)) 0)))
(check-sat)   ; expect unsat
(pop 1)

; === L1-L4  ONE-SIDED LIGHT-TIME BOUNDS ======================================
; Each one-way light time is pinned into R/(c+V) .. R/(c-V) by the RECEIVER's
; speed bound alone.  Note which endpoint governs which: tAB is governed by VB
; (the receiver), tBA by VA.  Divisions are cleared by multiplying through;
; c-V > 0 and c+V > 0 so the inequality direction is preserved.

(push 1) (assert base) (assert (not (<= (* tAB (- c VB)) R))) (check-sat) (pop 1) ; L1 tAB <= R/(c-VB)
(push 1) (assert base) (assert (not (>= (* tAB (+ c VB)) R))) (check-sat) (pop 1) ; L2 tAB >= R/(c+VB)
(push 1) (assert base) (assert (not (<= (* tBA (- c VA)) R))) (check-sat) (pop 1) ; L3 tBA <= R/(c-VA)
(push 1) (assert base) (assert (not (>= (* tBA (+ c VA)) R))) (check-sat) (pop 1) ; L4 tBA >= R/(c+VA)

; === M1, M2  THE ENVELOPE, WITH NO 1.2 MULTIPLIER ============================
;   |tAB - tBA| <= max( R/(c-VB) - R/(c+VA) , R/(c-VA) - R/(c+VB) )
; Cleared of divisions, using R/(c-X) - R/(c+Y) = R*(X+Y)/((c-X)*(c+Y)).

(push 1)  ; M1
(assert base)
(assert (not (<= (* (- tAB tBA) (- c VB) (+ c VA)) (* R (+ VA VB)))))
(check-sat)   ; expect unsat
(pop 1)

(push 1)  ; M2
(assert base)
(assert (not (<= (* (- tBA tAB) (- c VA) (+ c VB)) (* R (+ VA VB)))))
(check-sat)   ; expect unsat
(pop 1)

; === S1  SHARPNESS: the UN-multiplied envelope is ATTAINED ===================
; Both endpoints moving along +u at exactly their declared bounds (A chasing B)
; achieves equality in M1.  Consequence: no multiplicative margin > 1 is
; justified by this model --- the bound has ZERO slack in the worst case, so
; `* 1.2` is not covering residual error of THIS kind.  Whatever the 1.2 is for,
; it is not for the rectilinear light-time solve.

(push 1)
(assert base)
(assert (= (* (- tAB tBA) (- c VB) (+ c VA)) (* R (+ VA VB))))
(assert (= R 1)) (assert (= c 10)) (assert (= VA 2)) (assert (= VB 3))
(check-sat)   ; expect sat  => equality is reachable, the envelope is TIGHT
(get-model)
(pop 1)

; === R1, R2  HYPOTHESIS NECESSITY (try to refute my own theorem) =============
; A bound is only as good as the hypotheses it silently assumes.  Each block
; DROPS one hypothesis and asks z3 to break the envelope.  `sat` here is the
; desired answer: it shows the hypothesis is load-bearing and must be checked at
; the call site, not assumed.

(push 1)  ; R1  drop Cauchy-Schwarz on sB (projection allowed to exceed the norm)
(assert (> c 0)) (assert (> R 0))
(assert (>= VA 0)) (assert (>= VB 0)) (assert (< VA c)) (assert (< VB c))
(assert (>= wA 0)) (assert (<= wA VA)) (assert (>= wB 0)) (assert (<= wB VB))
(assert (<= sA wA)) (assert (>= sA (- wA)))
(assert (> tAB 0)) (assert (> tBA 0))
(assert (= (* (* c tAB) (* c tAB)) (+ (* R R) (* 2 R tAB sB) (* tAB tAB wB wB))))
(assert (= (* (* c tBA) (* c tBA)) (+ (* R R) (- (* 2 R tBA sA)) (* tBA tBA wA wA))))
(assert (not (<= (* (- tAB tBA) (- c VB) (+ c VA)) (* R (+ VA VB)))))
(check-sat)   ; expect sat  => |u.v| <= ||v|| is load-bearing
(pop 1)

(push 1)  ; R2  let the ACTUAL speed exceed its declared bound VB
(assert (> c 0)) (assert (> R 0))
(assert (>= VA 0)) (assert (>= VB 0)) (assert (< VA c)) (assert (< VB c))
(assert (>= wA 0)) (assert (<= wA VA))
(assert (> wB VB)) (assert (< wB c))       ; <-- VB no longer bounds wB
(assert (<= sA wA)) (assert (>= sA (- wA)))
(assert (<= sB wB)) (assert (>= sB (- wB)))
(assert (> tAB 0)) (assert (> tBA 0))
(assert (= (* (* c tAB) (* c tAB)) (+ (* R R) (* 2 R tAB sB) (* tAB tAB wB wB))))
(assert (= (* (* c tBA) (* c tBA)) (+ (* R R) (- (* 2 R tBA sA)) (* tBA tBA wA wA))))
(assert (not (<= (* (- tAB tBA) (- c VB) (+ c VA)) (* R (+ VA VB)))))
(check-sat)   ; expect sat  => VA/VB must bound the speed over the WHOLE
              ; light-time interval [t, t+tau], not merely at the transmit epoch.
              ; A finite-difference velocity sampled at t alone does NOT
              ; discharge this; a perihelion-speed constant does.
(pop 1)
