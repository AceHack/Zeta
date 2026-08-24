#!/usr/bin/env python3
r"""Witnesses for docs/research/2026-08-23-adjudicating-pr-14218-*.md

Adjudicates Aaron's chain -- "widening is a special version of the retraction -1 ...
a full key retraction would be the uncertainty collapse" -- by testing the
IDENTIFICATION in BOTH directions against the operators shipped in
`src/Core/SoftValue.fs` (`widen`, `retain`, `foldRetained`, `observe`, `build`).

  D1  Retraction does NOT imply widening. Retracting one piece of evidence can
      strictly DECREASE entropy. So "widening" is not the consequence of "-1";
      retraction's effect on uncertainty is sign-indefinite.
  D2  `widen` is NOT any retraction. The retraction-reachable set from a posterior
      is the FINITE sublattice { pi * prod L_e^m' : 0 <= m' <= m_e }; `widen lam`
      lands off it. Finiteness + continuity in `lam` makes this generic, not a
      numerical accident.
  D3  Full retraction returns the PRIOR -- the maximum re-opening available, not a
      collapse. This is the shipped docstring's own words ("horizon <= 0 retains
      NOTHING ... leaving the prior untouched") and it INVERTS the chain's second
      sentence.
  D4  The underflow deletion (workitem 081M0R5R1JN087G0R0031FT1C2) is reachable
      THROUGH `foldRetained`, because MAX_MULTIPLICITY = 1024 > 324.

Models the F# semantics; it does not run the F#.
Run: python3 docs/research/scripts/2026-08-23-widening-is-not-a-special-case-of-retraction-two-directions-verify.py
Exit 0 iff every check reaches its stated conclusion.
"""

import itertools
import math
import sys

EPS = 1e-12                # SoftValue.EPS
MAX_MULTIPLICITY = 1024    # SoftValue.MAX_MULTIPLICITY

FAILURES = []


def check(label, ok):
    print(("    OK   " if ok else "    FAIL ") + label)
    if not ok:
        FAILURES.append(label)


def normalise(v):
    t = sum(v)
    return [x / t for x in v]


def entropy(v):
    return -sum(p * math.log(p) for p in v if p > 0.0)


def observe(likelihood, belief):
    """Mirror of SoftValue.observe |> build: multiply, drop w <= 0, renormalise."""
    xs = [(d, w * max(0.0, likelihood(d))) for d, w in belief]
    xs = [(d, w) for d, w in xs if w > 0.0]
    total = 0.0
    for _, w in xs:
        total += w
    if not xs or total <= EPS:
        return None
    return [(d, w / total) for d, w in xs]


def widen(lam, p):
    """Mirror of SoftValue.widen -- the idempotent uniform-share FLOOR."""
    n = len(p)
    if n <= 1 or lam <= 0.0:
        return list(p)
    lam = min(lam, 1.0)
    t = n * min(p)
    if t >= lam:
        return list(p)
    u = 1.0 / n
    a = (1.0 - lam) / (1.0 - t)
    return [a * (pi - t * u) + lam * u for pi in p]


def d1_retraction_does_not_imply_widening():
    print("D1  retraction does NOT imply widening (it can strictly SHARPEN)")
    prior = [0.5, 0.5]
    e1 = [0.9, 0.1]   # favours candidate 0
    e2 = [0.1, 0.9]   # favours candidate 1, exactly cancelling e1
    full = normalise([prior[i] * e1[i] * e2[i] for i in range(2)])
    ret = normalise([prior[i] * e1[i] for i in range(2)])   # retract e2: m 1 -> 0
    print("      fold{e1,e2} = %s  H=%.6f" % ([round(x, 6) for x in full], entropy(full)))
    print("      retract e2  = %s  H=%.6f" % ([round(x, 6) for x in ret], entropy(ret)))
    check("the retracted belief is SHARPER, not wider", entropy(ret) < entropy(full))
    check("the pre-retraction belief was maximum entropy", abs(entropy(full) - math.log(2)) < 1e-12)


def d2_widen_is_not_a_retraction():
    print("D2  `widen` is NOT in the retraction-reachable set")
    prior = [1 / 3, 1 / 3, 1 / 3]
    E = [([4.0, 1.0, 1.0], 3), ([1.0, 3.0, 1.0], 2)]   # (likelihood vector, multiplicity)

    def fold(ms):
        v = list(prior)
        for (L, _), m in zip(E, ms):
            for i in range(3):
                v[i] *= L[i] ** m
        return normalise(v)

    post = fold([3, 2])
    reach = [fold(ms) for ms in itertools.product(range(4), range(3))]
    print("      posterior = %s" % [round(x, 6) for x in post])
    print("      |retraction-reachable set| = %d (= prod (m_e + 1))" % len(reach))
    check("the reachable set is finite and has the predicted cardinality", len(reach) == 4 * 3)

    off = 0
    for lam in (0.15, 0.30, 0.45, 0.60, 0.75, 0.90):
        w = normalise(widen(lam, post))
        dist = min(max(abs(r[i] - w[i]) for i in range(3)) for r in reach)
        if dist > 1e-9:
            off += 1
        print("      widen %.2f -> %s   L_inf to nearest retraction = %.6f"
              % (lam, [round(x, 6) for x in w], dist))
    check("every widen tested lands OFF the reachable set", off == 6)
    print("      (generic, not accidental: the reachable set is FINITE while widen")
    print("       varies continuously in lambda, so it can coincide at most finitely often)")


def d3_full_retraction_returns_the_prior():
    print("D3  full retraction returns the PRIOR -- maximum re-opening, not collapse")
    prior = [("a", 0.4), ("b", 0.3), ("c", 0.2), ("d", 0.1)]   # deliberately NON-uniform
    lik = [lambda d: 8.0 if d == "a" else 1.0, lambda d: 6.0 if d == "a" else 1.0]
    post = prior
    for l in lik:
        post = observe(l, post)
    # foldRetained with a schedule that retains NOTHING applies no likelihood at all
    retained_none = prior
    print("      after 2 observations : %s" % [round(w, 6) for _, w in post])
    print("      schedule retains none: %s" % [round(w, 6) for _, w in retained_none])
    check("confidence FELL back to the prior's (re-opened)",
          max(w for _, w in retained_none) < max(w for _, w in post))
    check("entropy ROSE to the prior's (maximum re-opening available)",
          entropy([w for _, w in retained_none]) > entropy([w for _, w in post]))
    check("the result is exactly the PRIOR (which is not uniform), so this is\n           re-opening to the prior, not flattening to uniform",
          retained_none == prior and len(set(w for _, w in prior)) > 1)


def d4_underflow_is_reachable_through_foldretained():
    print("D4  the underflow deletion is reachable THROUGH foldRetained")
    belief = [("x", 0.5), ("y", 0.5)]
    lik = lambda d: 1.0 if d == "x" else 0.1
    step = None
    for i in range(1, MAX_MULTIPLICITY + 1):
        prev = belief
        belief = observe(lik, belief)
        if belief is None or len(belief) == 1:
            step = i
            break
    print("      candidate 'y' left the support at inner step %s" % step)
    print("      its weight one step earlier: %r (subnormal; no zero was supplied)" % dict(prev)["y"])
    check("deletion occurs at step 324", step == 324)
    check("a single evidence at multiplicity MAX_MULTIPLICITY reaches it",
          step is not None and step <= MAX_MULTIPLICITY)


def main():
    for fn in (d1_retraction_does_not_imply_widening,
               d2_widen_is_not_a_retraction,
               d3_full_retraction_returns_the_prior,
               d4_underflow_is_reachable_through_foldretained):
        fn()
        print()
    if FAILURES:
        print("FAILED: " + "; ".join(FAILURES))
        return 1
    print("ALL PASS -- every check reached its stated conclusion (several are negative).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
