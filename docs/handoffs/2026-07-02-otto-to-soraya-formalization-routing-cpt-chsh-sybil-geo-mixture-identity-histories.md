# Handoff — Otto → Soraya: formalization routing for the 2026-07-02 identity/CPT/geo batch

**Date:** 2026-07-02 · **From:** Otto · **For:** Soraya (formal-verification routing
authority) · **Status:** routing request — pick the tool per property class (BP-16
cross-check triage applies); nothing here presumes TLA+.

Everything below is already property-tested in the DST harness (xunit + FsCheck,
seeded, green on main). The tests are evidence, not proof — each statement is routed
here to be *promoted* from tested to signed where the property class merits it.

## 1. The CPT composite law (algebraic; Lean/FsCheck-mutation candidate)

`fold (CPT t) = CPT (fold t)` — the composite of tick reversal (T), weight negation
(C), and parity flip (P) commutes with the Z-set fold; each factor alone may fail
(the braid witnesses), the composite may not. Tested:
`tests/Tests.FSharp/CptSymmetry.Tests.fs` (9 green; annihilation `fold (t ++ CPT t)
= 0`; T-alone holds on the abelian plane; T/P-alone fail on the braid; writheParity
CPT-protected; adinkra global sign conjugation preserves Gates).
Doc: `docs/research/2026-07-02-name-of-name-…md` Addendum 3/3.1.
**Ask:** is the abelian-plane statement worth a Lean lemma (it is 3 lines of ring
algebra), and is the braid-plane composite (already Braid.Tests-locked via Artin)
better served by mutation testing over the existing suite than by a new spec?

## 2. CHSH-Sybil soundness (probabilistic; the genuinely open one)

Conjecture: under randomized settings and no in-tick channel, streams from `s ≥ 2`
independent seeds yield `S ≤ 2 + o(1)` w.h.p. as rounds grow. The deterministic
seeded instances are tested (`AntiSybil.Tests.fs`, CHSH section, 15 green:
completeness S=4 exact, LHV edge exactly at 2, mixture tier `S = 2 + 2·f*`), but the
*distributional* claim (concentration bound on empirical S for independent sources)
is unproven. Anchors: Bell 1964; CHSH 1969; the classical-side cousin of
device-independent certification (Mayers–Yao; Pironio/Colbeck/Acín).
**Ask:** route — this smells like a Hoeffding-style concentration argument (four
bucketed empirical means), possibly FsCheck-with-statistics rather than a prover;
your call whether it earns a paper-grade proof or a stated-tolerance gate like the
fourcorner's 0.05.

## 3. The geo mixture law + estimator (exact; the F* refinement-type candidate)

`S(f*) = 2 + 2·f*` exactly (mixture linearity of `chshOf`), estimator
`f̂ = (S − 2)/2` with round-trip property, radius of the conductor
`d* = τ · 200 km/ms`. Tested: `GeoSuperdeterminism.Tests.fs` (7 green, exact to 9+
decimal places). Aaron flagged the F\* rhyme deliberately (f\* is proof language —
"not a coincidence"): the estimator is exactly the shape of a refinement-typed spec
(`s:float{2.0 <= s /\ s <= 4.0} -> f:float{f = (s -. 2.0) /. 2.0 /\ 0.0 <= f /\
f <= 1.0}`).
Doc: `docs/research/2026-07-02-geographic-superdeterminism-…f-star.md`.
**Ask:** if F\* enters the portfolio for this, it is a deliberately small first F\*
artifact — the routing question is whether a single refinement-typed function is
worth the toolchain onboarding, or whether Lean subsumes it.

## 4. Identity histories as model-checked behaviors (temporal; the TLA+ shaped one)

Aaron's framing, verbatim: anti-forgery attempts are "the TLA+/Lamport
'reasons'/correlations for identity"; identity = "irreducible pairs of uncorrelated
value exchange over time by two provably distinct entities."
Spec sketch: an identity claim is a BEHAVIOR (sequence of exchange events); validity
= the whole history model-checks against (a) causal consistency (happened-before
edges hold — Lamport 1978) and (b) independence (pairwise correlations under the
common-cause bound — the CHSH gate as a state predicate). The union-find collapse in
`AntiSybil.chshSybil` is then a refinement of "quotient by convicted sameness."
**Ask:** this is the one that actually smells like TLA+ — but per your own
TLA+-hammer guard, note that the interesting invariant (DistinctCount ≤ true source
count) is already stated and tested as THE GUARANTEE in `AntiSybil.fs`; the temporal
value-add would be liveness (a forger is *eventually* convicted under continued
probing), which nothing currently states.

## Priority suggestion (advisory)

2 > 4 > 1 > 3. The soundness bound (2) is load-bearing for any outward Sybil claim
(Aminata/Mateo routing already flagged in AntiSybil's honest scope); the liveness
statement (4) is the only *new* property; 1 and 3 are consolidation.

## Pointers

- `src/Core/AntiSybil.fs` (oracle + honest scope) · `src/Core/BellTest.fs` (bounds)
- `tests/Tests.FSharp/{CptSymmetry,AntiSybil,GeoSuperdeterminism}.Tests.fs`
- `docs/research/2026-07-02-name-of-name-equals-mix-of-mix-…md` (Addenda 1–4)
- `docs/research/2026-07-02-geographic-superdeterminism-…-f-star.md`
- `db/shapes/cartridges/sybil-verdict.lines` (the glyph whose gate runs the oracle live)
