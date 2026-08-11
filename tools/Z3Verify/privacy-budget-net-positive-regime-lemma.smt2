; privacy-budget-net-positive-regime-lemma.smt2
; Target: .claude/rules/privacy-budget-is-hard-money-earned-by-others.md
;         docs/research/2026-08-10-delay-is-the-decoupling-operator-...-privacy-budget.md §3b
; Claim under test: Aaron 2026-08-10, "captured entropy accurately measured and shared into
;   privacy budgets" — and the tension: sharing an accurate measurement SPENDS privacy in
;   order to EARN budget. Does a net-positive regime exist, and does it last?
;
; STATUS (run 2026-08-10, z3 -T:45, results recorded as returned, not as predicted):
;   LEMMA 1  sat        — a net-positive regime exists (by concrete witness, see note)
;   LEMMA 2  unsat      — THE RESULT: the regime always closes
;   LEMMA 3  timeout    — UNRESOLVED. Not proven and not refuted. See §LEMMA 3.
;
; ANCHOR (literature-first, step 0):
;   Dwork, McSherry, Nissim & Smith (2006), "Calibrating Noise to Sensitivity in Private
;     Data Analysis", TCC — differential privacy; epsilon COMPOSES and is never recovered.
;   Dwork & Roth (2014), "The Algorithmic Foundations of Differential Privacy" §3.5 (basic
;     composition, k mechanisms => k*eps) and §3.20 (advanced composition — still strictly
;     increasing and unbounded in k).
;   Shannon (1948) — the saturation constraint on the credit side: information about a
;     FIXED secret is bounded by that secret's entropy, so repeated disclosure about one
;     thing has strictly diminishing returns and a finite supremum.
;   Brier (1950) / Good (1952) / Gneiting & Raftery (2007) — strictly proper scoring rules;
;     why the credit is modelled as payout for information delivered, not for volume.
;
; ENCODING DECISION (the load-bearing routing call):
;   eps and b are UNINTERPRETED, constrained only by their essential properties — NOT the
;   specific composition formula and NOT a specific scoring rule. Same call the whitewash
;   lemma made about Phi, for the same two reasons: committing to advanced composition puts
;   transcendentals in QF_NRA and returns `unknown` or grinds, and a result about ONE
;   composition theorem would not transfer to the others. Abstracting to (strictly
;   increasing, unbounded) for eps and (strictly increasing, bounded) for b makes LEMMA 2
;   hold for EVERY composition theorem and EVERY bounded scoring rule.
;
;   BLIND SPOT, named per BP-16: this file proves nothing about whether any PARTICULAR
;   (eps, b) satisfies the hypotheses. "b is bounded" is the load-bearing assumption; it
;   holds PER SECRET (Shannon) and FAILS across a stream of genuinely new secrets. That
;   boundary is the entire operational content. Z3 closes the algebra; an empirical leg
;   must check saturation on real attestations.
;
; MODEL:
;   t       : disclosure effort (count or volume), t >= 0
;   eps(t)  : privacy SPENT (DP composition)
;   b(t)    : budget EARNED (others' attestations)
;   B       : supremum of b — the saturation ceiling for one secret
;   K       : a point at which spend has reached B

(set-logic UFNRA)
(set-option :produce-models true)

(declare-fun eps (Real) Real)
(declare-fun b   (Real) Real)
(declare-const B Real)
(declare-const K Real)

; ── eps: strictly increasing from zero ────────────────────────────────────────────────
(assert (= (eps 0.0) 0.0))
(assert (forall ((x Real) (y Real))
  (=> (and (<= 0.0 x) (< x y)) (< (eps x) (eps y)))))

; ── Unboundedness: SUPPLIED AS A WITNESS, not axiomatised. ────────────────────────────
; ENCODING FIX (after the first attempt returned `timeout`). Writing this as
; `(forall (m) (exists (x) (> (eps x) m)))` puts an alternating quantifier over
; uninterpreted reals in front of the solver and Z3 grinds — the wrong-axis failure the
; whitewash lemma warns about. It is also the wrong DIVISION OF LABOUR: "a strictly
; increasing unbounded function eventually exceeds B" is real analysis, not something a
; solver should rediscover. Unboundedness of DP composition (Dwork & Roth §3.5, §3.20)
; guarantees such a K exists; Z3's job is only what follows beyond it.
(assert (>= K 0.0))
(assert (>= (eps K) B))

; ── b: strictly increasing from zero, BOUNDED above by B (Shannon saturation) ──────────
(assert (= (b 0.0) 0.0))
(assert (forall ((x Real) (y Real))
  (=> (and (<= 0.0 x) (< x y)) (< (b x) (b y)))))
(assert (forall ((x Real)) (=> (<= 0.0 x) (< (b x) B))))
(assert (> B 0.0))

; ══ LEMMA 2 — THE RESULT. Beyond K, every disclosure is net-negative. ═════════════════
; Refutation form: assert that SOME point past K is still net non-negative, expect unsat.
; Polarity matters — a `sat` here would refute the finding.
; The argument is local: t > K  =>  eps(t) > eps(K) >= B > b(t).
; RETURNED: unsat (confirmed in isolation with the minimal axiom set).
(push)
(assert (exists ((t Real)) (and (> t K) (>= (b t) (eps t)))))
(check-sat)
(pop)

(exit)

; ══ LEMMA 1 — existence, moved to a CONCRETE WITNESS ══════════════════════════════════
; Asking Z3 to build a model of "some net-positive point exists" over quantified
; uninterpreted functions returned `timeout` — model construction over UF with quantifiers
; is the wrong ask. An existence claim wants a witness, not a search. With the saturating
; family b(t) = B*t/(1+t) and linear eps(t) = c*t, at B = 10, c = 1, t = 1:
;     b(1) = 5  >  eps(1) = 1
; checked separately in QF_NRA and RETURNED: sat. So the mechanism is not dead on arrival —
; disclosure can pay. This is a witness for ONE family, which is all an existence claim needs.
;
; ══ LEMMA 3 — NO RE-ENTRY: UNRESOLVED, and recorded as such ═══════════════════════════
; INTENDED CLAIM: with eps convex and b concave, once net goes negative it stays negative,
; so the stopping rule is a single threshold rather than a schedule re-evaluated forever.
;
; WHAT ACTUALLY HAPPENED, in order, because the sequence is the honest record:
;   (a) First encoding — discrete convexity/concavity on a single fixed increment d, WITHOUT
;       the anchors eps(0) = b(0) = 0 — returned `sat`. That is a genuine refutation OF THAT
;       ENCODING: with no anchor, net is free to start negative and rise, which is entirely
;       consistent with concavity. My encoding, not the claim, was wrong.
;   (b) Second encoding — same, WITH the anchors — returned `timeout`. Undetermined.
;
; So LEMMA 3 is NEITHER PROVEN NOR REFUTED and must not be cited as either. Note the
; informal argument is suggestive but not established here: net = b - eps is concave with
; net(0) = 0, so it rises then falls and cannot re-enter from below — but "discrete
; concavity at one fixed step d" is a strictly weaker hypothesis than concavity, and that
; gap is exactly what the solver could not close. Routing options if it is wanted:
; a real-analysis proof in Lean over genuinely concave functions, or an FsCheck leg over
; concrete saturating families. Do not re-encode in Z3 without changing the hypothesis.

; ══ RESULT (what LEMMA 2 establishes, and what it does not) ═══════════════════════════
;
;   The net-positive regime is BOUNDED: it closes at K, unconditionally. There is NO
;   parameter choice under which disclosure about a fixed secret pays indefinitely — not
;   because the exchange rate is badly set, but because b saturates (Shannon) while eps
;   composes without bound (Dwork et al.). Repricing moves K; it cannot remove it.
;
; Operational reading:
;
;   * ANTI-FARMING, and STRONGER than the volume argument. That crediting VOLUME is
;     self-mintable is the data-processing inequality, already proved sorry-free in
;     src/Core.Lean4/Lean4/DecorrelationDpi.lean. This is sharper: even HONEST re-disclosure
;     of the same fact stops paying. The mechanism self-limits against a truthful farmer,
;     not only a lying one.
;
;   * SUSTAINABLE ONLY UNDER GENUINE NOVELTY. The regime survives ACROSS secrets, never
;     WITHIN one. Earning requires having new things to say, and the ceiling on any single
;     disclosure stream is structural rather than a policy dial.
;
;   * IT IS A RATE, NOT A TOTAL — the threshold-rhyme shape again
;     (docs/research/2026-08-10-the-threshold-rhyme-*): what is bounded is sustained earning
;     from one source, and the bound is a crossing point, not a quota.
;
; NOT ESTABLISHED HERE:
;   * That any real (eps, b) pair satisfies the hypotheses — above all b's saturation.
;   * WHERE K falls for our attestation format. K is quantitative; this file is qualitative
;     by construction. Locating K needs the empirical leg.
;   * No-re-entry (LEMMA 3, unresolved above).
;   * That the scoring rule is incentive-compatible — a DESIGN decision (proper scoring
;     rules; peer prediction — Prelec 2004, Miller-Resnick-Zeckhauser 2005) that must be
;     settled before any tool is pointed at it.
