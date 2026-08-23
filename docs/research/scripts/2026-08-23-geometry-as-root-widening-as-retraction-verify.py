#!/usr/bin/env python3
r"""Witnesses for §14 of docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-*.md

Aaron: "widening is a special version of the retraction -1." Checked against the two
widening routes shipped in src/Core/SoftValue.fs.

  W1  Route (A) `widen` is SUPPORT-PRESERVING and IDEMPOTENT -- the predicted failure
      (a weight driven to zero and pruned) does NOT fire: every candidate ends with
      mass >= lambda/n > 0, and the floor formulation makes widen(widen(x)) = widen(x).
  W2  ...and route (A) is still NOT safe in a shared fold, because it is STATE-DEPENDENT:
      widen does not commute with observe, so two nodes that interleave differently
      diverge. Inflationary is not the same order-theoretic property as monotone.
  W3  Route (B) `foldRetained` -- widening AS retraction, via retention MULTIPLICITY
      (evidence enters the fold L^m; dropping m to 0 is literally the -1). It COMMUTES:
      any permutation of the evidence set gives the same belief, with widening enabled.
  S1  Aaron's invariant: COLLAPSE = a key leaving the support. Widening CANNOT
      collapse (mass >= lambda/n > 0 analytically).
  S2  ...but `observe` DOES, intentionally, on a non-positive likelihood.
  S3  ...and SILENTLY, by float underflow, with no zero likelihood anywhere.
  A2  ADVERSARIAL: try to find a widening that removes a key -- could not, and the
      reason is structural (the guard and the underflow condition are exclusive).
  A3  ADVERSARIAL: support-monotonicity is NOT sufficient for CALM monotonicity --
      support can be constant while a confidence query flips true -> false.
  W4  The discriminator is NAMEABILITY: a retraction that names what it retracts is a
      set operation (monotone, coordination-free); one that cannot must read the belief.

Models the F# semantics; it does not run the F#.
Run: python3 docs/research/scripts/2026-08-23-geometry-as-root-widening-as-retraction-verify.py
Exit 0 iff every check reaches its stated conclusion.
"""

import itertools
import sys

CANDS = ["a", "b", "c", "d"]


def normalise(p):
    t = sum(p.values())
    return {k: v / t for k, v in p.items()}


def observe(like, belief):
    return normalise({k: like[k] * belief[k] for k in belief})


def uniform_share(p):
    return len(p) * min(p.values())


def widen(lam, p):
    """SoftValue.widen -- the idempotent uniform-share FLOOR."""
    n = len(p)
    if n <= 1 or lam <= 0.0:
        return p
    lam = min(lam, 1.0)
    t = uniform_share(p)
    if t >= lam:
        return p
    u = 1.0 / n
    a = (1.0 - lam) / (1.0 - t)
    return {k: a * (v - t * u) + lam * u for k, v in p.items()}


def w1_support_preserving_and_idempotent():
    print("W1  route (A) widen: support-preserving and idempotent")
    p = normalise({"a": 100.0, "b": 1.0, "c": 0.5, "d": 0.25})
    lam = 0.4
    w = widen(lam, p)
    ww = widen(lam, w)
    floor = lam / len(CANDS)
    min_mass = min(w.values())
    print(f"    before: {[round(v,6) for v in p.values()]}")
    print(f"    after : {[round(v,6) for v in w.values()]}")
    print(f"    min mass {min_mass:.6f} >= lambda/n = {floor:.6f}: {min_mass >= floor - 1e-12}")
    idem = all(abs(w[k] - ww[k]) < 1e-12 for k in w)
    print(f"    widen(widen(x)) == widen(x): {idem}   (floor, not increment)")
    print(f"    uniformShare after = {uniform_share(w):.6f} (== lambda)")
    print("    => the predicted failure (weight -> 0 -> key pruned) does NOT fire.")
    return min_mass >= floor - 1e-12 and idem


def w2_widen_does_not_commute():
    print("W2  route (A) is state-dependent: widen does NOT commute with observe")
    p0 = normalise({k: 1.0 for k in CANDS})
    L = {"a": 4.0, "b": 2.0, "c": 1.0, "d": 1.0}
    # lam must be high enough that widen actually BITES in one order. At lam=0.5 it is a
    # no-op in both orders and the check passes vacuously -- that first draft is recorded
    # in the doc as an instance of the vacuity class caught by its own falsifier.
    lam = 0.8
    node1 = widen(lam, observe(L, p0))      # observe then widen
    node2 = observe(L, widen(lam, p0))      # widen then observe
    gap = max(abs(node1[k] - node2[k]) for k in CANDS)
    print(f"    observe-then-widen: {[round(node1[k],6) for k in CANDS]}")
    print(f"    widen-then-observe: {[round(node2[k],6) for k in CANDS]}")
    print(f"    max divergence {gap:.6f}  diverges={gap > 1e-9}")
    print("    => INFLATIONARY (x <= widen x) is not MONOTONE (x<=y => f x <= f y).")
    print("       Abstract-interpretation widening has exactly this property: it is")
    print("       required to be inflationary and is NOT required to be monotone.")
    return gap > 1e-9


def fold_retained(prior, evidence, horizon):
    """SoftValue.foldRetained -- multiplicity m, evidence enters as L^m; m=0 is the -1."""
    if not evidence:
        return prior
    max_phase = max(ph for ph, _ in evidence)
    b = dict(prior)
    for ph, L in evidence:
        m = 1 if (max_phase - ph) < horizon else 0
        for _ in range(m):
            b = observe(L, b)
    return normalise(b)


def w3_foldretained_commutes():
    print("W3  route (B) foldRetained: widening AS retraction, and it COMMUTES")
    p0 = normalise({k: 1.0 for k in CANDS})
    ev = [
        (10, {"a": 4.0, "b": 1.0, "c": 1.0, "d": 1.0}),
        (11, {"a": 1.0, "b": 3.0, "c": 1.0, "d": 1.0}),
        (12, {"a": 1.0, "b": 1.0, "c": 2.0, "d": 1.0}),
        (3,  {"a": 1.0, "b": 1.0, "c": 1.0, "d": 9.0}),   # stale -> retracted
    ]
    horizon = 5
    base = fold_retained(p0, ev, horizon)
    worst = 0.0
    for perm in itertools.permutations(ev):
        r = fold_retained(p0, list(perm), horizon)
        worst = max(worst, max(abs(r[k] - base[k]) for k in CANDS))
    print(f"    belief: {[round(base[k],6) for k in CANDS]}")
    print(f"    max divergence over all {len(list(itertools.permutations(ev)))} "
          f"permutations: {worst:.3e}")
    # the stale item is fully retracted: dropping it changes nothing
    without = fold_retained(p0, [e for e in ev if e[0] != 3], horizon)
    retracted = max(abs(without[k] - base[k]) for k in CANDS) < 1e-12
    print(f"    the phase-3 evidence is fully retracted (m=0): removing it is a no-op: "
          f"{retracted}")
    print("    => widening implemented as multiplicity reduction; m: k -> 0 IS the -1,")
    print("       and the fold stays order-independent because it reads the evidence SET.")
    return worst < 1e-12 and retracted


def w4_nameability_is_the_discriminator():
    print("W4  the discriminator is NAMEABILITY, not support-vs-confidence")
    print("    route (B) names WHICH observation is discounted -> a set operation")
    print("       -> monotone in the evidence set -> coordination-free")
    print("    route (A) names no culprit ('everything is less reliable now')")
    print("       -> must read the belief -> state-dependent -> not coordination-free")
    print("    Both are support-preserving (W1), so support is NOT what decides it.")
    print("    What decides it: is the summary DERIVED from a retained set, or STORED?")
    return True




# ---------------------------------------------------------------- S1..S3
# Aaron's closing definition: COLLAPSE = a key leaving the support.
#   widening reduces precision, key stays;  retraction removes the key.
#   => never-collapse  <=>  the support never shrinks.
# SoftValue builds through WeightedSet.ofSeq, which PRUNES zero weights, so the
# question is whether any belief-lane path can drive a weight to exactly zero.

def support(p):
    return {k for k, v in p.items() if v != 0.0}


def observe_pruning(like, belief):
    """SoftValue.observe: w * max(0, L), then build -> WeightedSet.ofSeq -> zero pruned."""
    raw = {k: belief[k] * max(0.0, like[k]) for k in belief}
    t = sum(raw.values())
    if t == 0.0:
        return None
    return {k: v / t for k, v in raw.items() if v / t != 0.0}


def s1_widen_cannot_collapse():
    print("S1  widening CANNOT collapse -- analytic, and the guard is real")
    p = normalise({"a": 1e12, "b": 1.0, "c": 1.0, "d": 1.0})
    for lam in (0.05, 0.4, 0.9, 1.0):
        w = widen(lam, p)
        assert support(w) == support(p)
    print("    mass_i = a*(p_i - t*u) + lambda*u  >=  lambda*u  =  lambda/n  >  0")
    print("    since a >= 0 and p_i >= min p = t*u. Exact zero is UNREACHABLE for lambda>0.")
    print("    checked at lambda in {0.05, 0.4, 0.9, 1.0}: support preserved every time")
    return True


def s2_observe_collapses_intentionally():
    print("S2  observe COLLAPSES on a non-positive likelihood -- documented, intentional")
    p = normalise({k: 1.0 for k in CANDS})
    L = {"a": 1.0, "b": 1.0, "c": 0.0, "d": 1.0}   # 'c' refuted
    q = observe_pruning(L, p)
    print(f"    support before {sorted(support(p))} -> after {sorted(support(q))}")
    print("    SoftValue.observe: `w * max 0.0 (likelihood d)`, docstring: "
          "'that candidate refuted'")
    print("    => under Aaron's definition this IS a collapse. It is deliberate, and it is")
    print("       a different act from widening -- but the support does shrink.")
    return support(q) < support(p)


def s3_underflow_collapses_silently():
    print("S3  observe collapses SILENTLY by float underflow -- nobody asked for this one")
    p = normalise({k: 1.0 for k in CANDS})
    L = {"a": 1.0, "b": 1.0, "c": 1.0, "d": 0.1}   # 'd' merely unlikely, never refuted
    n = 0
    while support(p) == set(CANDS) and n < 5000:
        p = observe_pruning(L, p)
        n += 1
    print(f"    likelihood for 'd' is 0.1 -- unlikely, NEVER zero, never refuted")
    print(f"    after {n} observations the support is {sorted(support(p))}")
    print(f"    'd' left the support at weight underflow, with no zero likelihood anywhere.")
    print("    => the support becomes a function of FLOAT ROUNDING, so two oracles with")
    print("       different float paths can prune at different steps and DIVERGE. That is")
    print("       the defect: not that a hopeless candidate dies, but that WHEN it dies is")
    print("       not byte-lockable.")
    return "d" not in support(p) and n > 1


# ---------------------------------------------------------------- A2, A3
# ADVERSARIAL: Aaron asked for his own framing to be attacked, not confirmed.

def a2_try_to_break_widen_support_preservation():
    print("A2  ATTACK: find a widening that removes a key.  RESULT: could not.")
    n = 1000
    p = normalise({f"k{i}": (1.0 if i else 1e300) for i in range(n)})
    u = 1.0 / n
    lost = []
    for lam in (5e-324, 1e-320, 1e-310, 1e-8):
        w = widen(lam, p)
        lost.append(len(support(p)) - len(support(w)))
    print(f"    keys lost at lambda in (5e-324, 1e-320, 1e-310, 1e-8): {lost}")
    print(f"    lambda*u CAN underflow: 5e-324 * {u} = {5e-324 * u!r}")
    print("    ...but it is unreachable, and structurally so: a MINIMAL key has")
    print("    v == t*u exactly, so its mass is exactly lambda*u; driving that to 0")
    print("    needs lambda < ~2.5e-321, while the guard `t >= lambda` returns early")
    print("    unless t < lambda, i.e. n*min(p) < lambda -- which forces min(p) below")
    print("    the smallest denormal, so the key was already absent. The two")
    print("    conditions are mutually exclusive. ATTACKED AND SURVIVED.")
    return all(x == 0 for x in lost)


def a3_support_monotone_does_not_give_calm():
    print("A3  ATTACK: is support-monotonicity SUFFICIENT for CALM monotonicity?  NO.")
    p = normalise({k: 1.0 for k in CANDS})
    rows = []
    for L in ({"a": 9.0, "b": 1.0, "c": 1.0, "d": 1.0},
              {"a": 1.0, "b": 9.0, "c": 1.0, "d": 1.0},
              {"a": 1.0, "b": 9.0, "c": 1.0, "d": 1.0}):
        p = observe(L, p)
        rows.append((round(p["a"], 4), p["a"] >= 0.5, sorted(support(p))))
    for r in rows:
        print(f"      P(a)={r[0]}  'P(a)>=0.5'={r[1]}  support={r[2]}")
    same = all(r[2] == sorted(CANDS) for r in rows)
    flip = any(rows[i][1] and not rows[i + 1][1] for i in range(len(rows) - 1))
    print(f"    support unchanged at every step: {same}")
    print(f"    the confidence query flips true -> false: {flip}")
    print("    => support-monotonicity is NECESSARY at best and NOT SUFFICIENT.")
    print("       'coordination-free as long as no key is pruned' is REFUTED.")
    return same and flip


def main():
    r = [w1_support_preserving_and_idempotent(),
         w2_widen_does_not_commute(),
         w3_foldretained_commutes(),
         w4_nameability_is_the_discriminator(),
         s1_widen_cannot_collapse(),
         s2_observe_collapses_intentionally(),
         s3_underflow_collapses_silently(),
         a2_try_to_break_widen_support_preservation(),
         a3_support_monotone_does_not_give_calm()]
    print()
    print("ALL PASS" if all(r) else "FAILED")
    return 0 if all(r) else 1


if __name__ == "__main__":
    sys.exit(main())
