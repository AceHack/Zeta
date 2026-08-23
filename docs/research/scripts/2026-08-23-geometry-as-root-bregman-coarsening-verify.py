#!/usr/bin/env python3
"""Witnesses for §10 of docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-*.md

Aaron's addition: the covariance/contravariance framing, and whether "measure the
change rate over a CLUSTER" is a pushforward with a discharge condition.

Four checks, stdlib only, deterministic:

  B1  The two KL barycentres of the SAME cluster are different points.
      right-KL  argmin_q E[KL(p_i || q)]  -> the moment (m-) average   = EP moment matching
      left-KL   argmin_q E[KL(q || p_i)]  -> the natural (e-) average  = log-linear pooling
  B2  Both closed forms agree with a direct numerical minimisation.
  B3  The exact Bregman decomposition
          E[KL(p_i || q)]  =  E[KL(p_i || pbar)]  +  KL(pbar || q)
      holds for every q — the first term is the within-cluster Bregman information
      (the irreducible cost of the coarsening), the second is the part that descends.
  B4  The within-cluster information is exactly zero iff the fibre is constant.

Run: python3 docs/research/scripts/2026-08-23-geometry-as-root-bregman-coarsening-verify.py
Exit 0 iff every check passes.
"""

import math
import random
import sys

# Univariate Gaussian exponential family.
#   theta = (mu/s2, -1/(2*s2))   natural (e-affine) coordinates
#   eta   = (mu, mu^2 + s2)      moment / expectation (m-affine) coordinates
def to_theta(mu, s2):
    return (mu / s2, -1.0 / (2 * s2))


def to_eta(mu, s2):
    return (mu, mu * mu + s2)


def from_theta(t):
    s2 = -1.0 / (2 * t[1])
    return (t[0] * s2, s2)


def from_eta(e):
    return (e[0], e[1] - e[0] * e[0])


def KL(p, q):
    m1, v1 = p
    m2, v2 = q
    return 0.5 * (math.log(v2 / v1) + (v1 + (m1 - m2) ** 2) / v2 - 1.0)


PS = [(0.0, 1.0), (2.0, 0.5), (-1.0, 3.0), (4.0, 2.0)]
W = [0.4, 0.2, 0.3, 0.1]


def right_barycentre(ps, w):
    """argmin_q sum w_i KL(p_i || q) -- the m-average (moment matching)."""
    eta = tuple(sum(wi * to_eta(*p)[j] for wi, p in zip(w, ps)) for j in range(2))
    return from_eta(eta)


def left_barycentre(ps, w):
    """argmin_q sum w_i KL(q || p_i) -- the e-average (log-linear pooling)."""
    th = tuple(sum(wi * to_theta(*p)[j] for wi, p in zip(w, ps)) for j in range(2))
    return from_theta(th)


def objR(q):
    return sum(wi * KL(p, q) for wi, p in zip(W, PS))


def objL(q):
    return sum(wi * KL(q, p) for wi, p in zip(W, PS))


def minimise(obj):
    m, v = 0.0, 1.0
    for i in range(200):
        step = 2.0 * (0.9 ** i)
        cands = [(m + dm, v + dv)
                 for dm in (-step, 0.0, step)
                 for dv in (-step * 0.5, 0.0, step * 0.5)
                 if v + dv > 1e-6]
        m, v = min(cands, key=obj)
    return (m, v)


def b1_b2():
    qr, ql = right_barycentre(PS, W), left_barycentre(PS, W)
    print("B1  the same cluster has TWO barycentres, and they are different points")
    print(f"    members {PS}  weights {W}")
    print(f"    right-KL (moment / m-average, = EP moment matching):    "
          f"({qr[0]:.6f}, {qr[1]:.6f})")
    print(f"    left-KL  (natural / e-average, = log-linear pooling):   "
          f"({ql[0]:.6f}, {ql[1]:.6f})")
    differ = abs(qr[0] - ql[0]) > 1e-6 or abs(qr[1] - ql[1]) > 1e-6
    print(f"    they differ: {differ}")
    nr, nl = minimise(objR), minimise(objL)
    okr = abs(nr[0] - qr[0]) < 1e-3 and abs(nr[1] - qr[1]) < 1e-3
    okl = abs(nl[0] - ql[0]) < 1e-3 and abs(nl[1] - ql[1]) < 1e-3
    print("B2  closed forms match a direct numerical minimisation")
    print(f"    numeric right-KL argmin ({nr[0]:.4f}, {nr[1]:.4f})  match={okr}")
    print(f"    numeric left-KL  argmin ({nl[0]:.4f}, {nl[1]:.4f})  match={okl}")
    return differ and okr and okl


def b3():
    qbar = right_barycentre(PS, W)
    within = sum(wi * KL(p, qbar) for wi, p in zip(W, PS))
    rng = random.Random(3)
    worst = 0.0
    for _ in range(2000):
        q = (rng.uniform(-6, 6), rng.uniform(0.05, 8))
        worst = max(worst, abs(objR(q) - (within + KL(qbar, q))))
    print("B3  exact decomposition  E[KL(p_i||q)] = E[KL(p_i||pbar)] + KL(pbar||q)")
    print(f"    within-cluster Bregman information E[KL(p_i||pbar)] = {within:.8f}")
    print(f"    max |LHS - RHS| over 2000 random q: {worst:.3e}")
    print("    => the fibre-varying part does NOT descend; the fibre-constant part does")
    return worst < 1e-9


def b4():
    same = [(1.5, 0.7)] * 4
    qbar = right_barycentre(same, W)
    within = sum(wi * KL(p, qbar) for wi, p in zip(W, same))
    print("B4  within-cluster information is zero exactly when the fibre is constant")
    print(f"    all four members identical -> within = {within:.12f}")
    return abs(within) < 1e-12


def main():
    results = [b1_b2(), b3(), b4()]
    print()
    print("ALL PASS" if all(results) else "FAILED")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
