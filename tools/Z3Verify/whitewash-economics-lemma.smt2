; whitewash-economics-lemma.smt2
; Target: src/Core/TravelerRankLedger.fs  (trustBand, update, freshBelief)
; Claim under test: TRL-31 / TRL-32 "whitewash-unprofitability"
;   docs/ZETA-CORE-TECHNOLOGY-FOR-MAX.md:54
;   docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md:190
;
; ANCHOR (literature-first, step 0): Friedman & Resnick (2001), "The Social Cost
;   of Cheap Pseudonyms", J. Economics & Management Strategy 10(2). Already cited
;   at src/Core.TypeScript/planning/calibration-ledger.ts:46. Their result is an
;   IMPOSSIBILITY: when pseudonyms are free, any equilibrium that does not
;   distrust newcomers admits profitable whitewashing. Zeta CHOOSES the honest
;   prior for newcomers (trustBand(fresh) = 0.5, an explicit Multi-Oracle / default-
;   moral-regard values call). By Friedman-Resnick that choice PRICES IN profitable
;   whitewashing for the sub-prior population. So "whitewash is unprofitable" is not
;   an open question to be proven -- the literature says it CANNOT hold given the
;   newcomer prior. This file proves the exact boundary instead.
;
; ENCODING DECISION (the load-bearing routing call):
;   Phi is an UNINTERPRETED function constrained only by strict monotonicity and
;   Phi(0) = 1/2. It is NOT the Abramowitz & Stegun 7.1.26 polynomial the F# code
;   actually evaluates. This is deliberate:
;     - modelling A&S 7.1.26 in QF_NRA (degree-5 poly composed with exp) returns
;       `unknown` or grinds -- wrong axis;
;     - and a proof ABOUT the approximation would be a proof about the wrong
;       function (A&S has 1.5e-7 absolute error).
;   The abstraction makes these results hold for the EXACT normal CDF and for any
;   monotone approximation of it. The complementary blind spot -- whether the
;   shipped A&S polynomial IS monotone and IS 0.5 at 0 -- is the FsCheck leg's job.
;   That is the BP-16 pairing: Z3 closes the algebra, FsCheck closes the numerics.
;
; MODEL (verbatim from TravelerRankLedger.fs):
;   BETA = 1, freshBelief = (mu=0, sigma2=1), trustBand(b) = Phi(mu / sqrt(s2 + 1))
;   update: sign = +/-1; d = sqrt(s2+1); t = sign*mu/d; v = phi(t)/Phi(t) > 0;
;           mu' = mu + s2*sign*v/d;   s2' = max(EPS, s2*(1 - w*s2/(s2+1)))
;   v > 0 and s2 > 0 are the only facts about v, w needed below; both hold
;   (phi > 0, Phi > 0 on the reachable domain -- see the millsV reachability note).
;
; Soraya routing, 2026-08-09. Run: z3 tools/Z3Verify/whitewash-economics-lemma.smt2

(set-logic UFNRA)

(declare-fun Phi (Real) Real)
; Phi(0) = 1/2 (exact fact; global -- harmless for both sat and unsat goals).
(assert (= (Phi 0.0) 0.5))
;
; Strict monotonicity is asserted PER-BLOCK, not globally. Reason (routing note):
; a universally quantified constraint on an uninterpreted function makes the SAT
; goals (W2, W4) model-construction problems that Z3 does not terminate on. The
; UNSAT goals (W1, W5) get the full quantified axiom; the SAT goals get only the
; finite point instances they need. Same mathematics, decidable both directions.
(define-fun PhiMonotone () Bool
  (forall ((x Real) (y Real)) (=> (< x y) (< (Phi x) (Phi y)))))

; ---------------------------------------------------------------------------
; W1  [UNSAT expected]  THEOREM W -- the closed form the docs are missing.
;   For every belief (mu, s2) with s2 > 0:
;       trustBand(mu, s2) < trustBand(fresh) = 1/2   <=>   mu < 0.
;   Equivalently: WHITEWASHING IS STRICTLY PROFITABLE EXACTLY WHEN mu < 0.
;   sigma2 does not appear in the condition -- the amount of accumulated evidence
;   is IRRELEVANT to whether discarding the identity pays.
; ---------------------------------------------------------------------------
(push)
(assert PhiMonotone)
(declare-const mu Real) (declare-const s2 Real) (declare-const d Real)
(assert (> s2 0.0)) (assert (> d 0.0)) (assert (= (* d d) (+ s2 1.0)))
(assert (not (= (< (Phi (/ mu d)) 0.5) (< mu 0.0))))
(check-sat)   ; unsat => trustBand < 0.5 IFF mu < 0
(pop)

; ---------------------------------------------------------------------------
; W2  [SAT expected]  REFUTATION WITNESS -- whitewash gain is strictly positive
;   for any mu < 0 identity. The 1-miss identity has mu = -0.5642 (computed from
;   the shipped update: mu' = 0 - 1*v(0)/sqrt(2), v(0) = phi(0)/Phi(0) = 0.7979),
;   trustBand = 0.3318 (A&S), so discarding it and re-registering GAINS +0.1682.
;   "Whitewash is unprofitable" is FALSE as an unqualified claim.
; ---------------------------------------------------------------------------
(push)
(declare-const mu Real) (declare-const d Real) (declare-const gain Real)
(assert (< mu 0.0)) (assert (> d 0.0))
; the ONE monotonicity instance needed: mu/d < 0 = 0 implies Phi(mu/d) < Phi(0).
(assert (< (Phi (/ mu d)) (Phi 0.0)))
(assert (= gain (- 0.5 (Phi (/ mu d)))))
(assert (> gain 0.0))
(check-sat)   ; sat => a strictly profitable whitewash exists
(pop)

; ---------------------------------------------------------------------------
; W3  [UNSAT expected]  THE TRUE THEOREM -- what the mechanism DOES buy.
;   mu is strictly increasing on a hit and strictly decreasing on a miss
;   (given v > 0, s2 > 0, d > 0). Since freshBelief has mu = 0, it follows by
;   induction that mu > 0 requires at least one RECORDED HIT on that identity.
;   Therefore: NO WHITEWASH STRATEGY PRODUCES trustBand > 1/2 WITHOUT RECORDED
;   HITS. Whitewash buys AMNESTY UP TO THE PRIOR -- never ADVANTAGE ABOVE IT.
;   That is the defensible claim, and it is what the Max-facing doc should say.
; ---------------------------------------------------------------------------
(push)
(declare-const mu Real) (declare-const s2 Real) (declare-const d Real)
(declare-const v Real) (declare-const sign Real)
(assert (> s2 0.0)) (assert (> d 0.0)) (assert (= (* d d) (+ s2 1.0)))
(assert (> v 0.0))                                  ; v(t) = phi(t)/Phi(t) > 0
(assert (or (= sign 1.0) (= sign (- 1.0))))
; mu' = mu + s2*sign*v/d ; claim: sign(mu' - mu) = sign
(assert (not (= (> (+ mu (/ (* s2 (* sign v)) d)) mu) (> sign 0.0))))
(check-sat)   ; unsat => a hit strictly raises mu, a miss strictly lowers it
(pop)

; ---------------------------------------------------------------------------
; W4  [SAT expected]  THE INCENTIVE INVERSION.
;   Combining W1 and W3: the population for whom whitewash pays is exactly
;   {mu < 0} = the sub-prior performers -- the agents the ledger most wants to
;   hold accountable. The agents for whom whitewash costs (mu > 0) are exactly
;   the ones with no reason to whitewash. The mechanism's deterrent is therefore
;   anti-correlated with need. Witness: two identities, one below prior (gains by
;   whitewashing) and one above (loses), simultaneously.
; ---------------------------------------------------------------------------
(push)
(declare-const muBad Real) (declare-const muGood Real) (declare-const d Real)
(assert (> d 0.0)) (assert (< muBad 0.0)) (assert (> muGood 0.0))
; the TWO monotonicity instances needed (muBad/d < 0 < muGood/d).
(assert (< (Phi (/ muBad d))  (Phi 0.0)))
(assert (> (Phi (/ muGood d)) (Phi 0.0)))
(assert (> (- 0.5 (Phi (/ muBad d)))  0.0))    ; bad actor GAINS by whitewashing
(assert (< (- 0.5 (Phi (/ muGood d))) 0.0))    ; good actor LOSES by whitewashing
(check-sat)   ; sat => deterrent is anti-correlated with need
(pop)

; ---------------------------------------------------------------------------
; W5  [UNSAT expected]  SCOPE OF TRL-31/TRL-32.  What those tests actually
;   establish is only the W1 instance at the single point mu(1 miss) < 0:
;   "a 1-miss identity scores below a fresh one". That is a CONSEQUENCE of
;   whitewash being profitable, not evidence against it. Formally: the test's
;   assertion `discardedTB < freshTB` is EQUIVALENT to `whitewash gain > 0`.
;   The tests assert the profitability of whitewash under a name that denies it.
; ---------------------------------------------------------------------------
(push)
(declare-const muDisc Real) (declare-const d Real)
(assert (> d 0.0))
(assert (not (= (< (Phi (/ muDisc d)) 0.5)        ; discardedTB < freshTB (the assertion)
                (> (- 0.5 (Phi (/ muDisc d))) 0.0))))  ; whitewash gain > 0
(check-sat)   ; unsat => the two statements are the same statement
(pop)

(exit)
