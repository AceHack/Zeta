#!/usr/bin/env python3
"""Witnesses for docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-*.md

Three checks, stdlib only (no numpy), deterministic:

  W1  A Normal-Gamma superlevel set in the (mu, tau) chart is NOT convex — an explicit
      two-point witness whose midpoint falls outside.
  W2  The analytic Hessian determinant of log f, matched against a finite difference,
      and the exact boundary of the non-log-concave region.
  W3  The half-space theorem: with T(mu,tau) = (log tau, tau, tau*mu, tau*mu^2) and the
      natural parameter theta, log f == <theta, T> identically, so every superlevel set
      is the preimage of a closed half-space.

Run: python3 docs/research/scripts/2026-08-23-geometry-as-root-ng-convexity-verify.py
Exit 0 iff every check passes.
"""

import math
import random
import sys

# Normal-Gamma NG(m, lam, a, b) over (mu, tau), log density up to an additive constant.
def logf(mu, tau, m=0.0, lam=1.0, a=2.0, b=1.0):
    if tau <= 0:
        return float("-inf")
    return (a - 0.5) * math.log(tau) - b * tau - 0.5 * lam * tau * (mu - m) ** 2


def w1_nonconvex():
    A, B = (-6.0, 0.25), (-1.0, 6.0)
    mid = (0.5 * (A[0] + B[0]), 0.5 * (A[1] + B[1]))
    la, lb, lm = logf(*A), logf(*B), logf(*mid)
    print("W1  NG(m=0, lam=1, a=2, b=1), chart (mu, tau)")
    print(f"    A   = {A}  log f = {la:.6f}")
    print(f"    B   = {B}  log f = {lb:.6f}")
    print(f"    mid = {mid}  log f = {lm:.6f}")
    ok = lm < min(la, lb)
    print(f"    midpoint strictly below both endpoints: {ok}  "
          f"=> superlevel set at c = min(A,B) is NOT convex")
    return ok


def detH(mu, tau, m=0.0, lam=1.0, a=2.0, b=1.0):
    # d2/dmu2 = -lam*tau ; d2/dtau2 = -(a-1/2)/tau^2 ; d2/dmu dtau = -lam*(mu-m)
    return lam * (a - 0.5) / tau - lam * lam * (mu - m) ** 2


def detH_numeric(mu, tau, h=1e-5, **kw):
    f = lambda x, y: logf(x, y, **kw)
    fxx = (f(mu + h, tau) - 2 * f(mu, tau) + f(mu - h, tau)) / h ** 2
    fyy = (f(mu, tau + h) - 2 * f(mu, tau) + f(mu, tau - h)) / h ** 2
    fxy = (f(mu + h, tau + h) - f(mu + h, tau - h) - f(mu - h, tau + h) + f(mu - h, tau - h)) / (4 * h * h)
    return fxx * fyy - fxy * fxy


def w2_hessian():
    print("W2  Hessian determinant of log f  (det H = lam*(a-1/2)/tau - lam^2*(mu-m)^2)")
    ok = True
    for pt in [(0.0, 1.0), (2.0, 1.0), (1.3, 0.9), (-6.0, 0.25)]:
        an, nu = detH(*pt), detH_numeric(*pt)
        agree = abs(an - nu) < 1e-2 * max(1.0, abs(an))
        ok = ok and agree
        print(f"    {pt}: analytic {an:+.6f}  numeric {nu:+.6f}  agree={agree}  "
              f"log-concave-here={an >= 0}")
    print(f"    non-log-concave exactly where (mu-m)^2 > (a-1/2)/(lam*tau); "
          f"at tau=1,a=2,lam=1 that is |mu| > {math.sqrt(1.5):.6f}")
    # the log density is not jointly concave anywhere off the line mu = m at low tau
    ok = ok and detH(2.0, 1.0) < 0 and detH(0.0, 1.0) > 0
    return ok


def w3_halfspace():
    a, b, lam, m = 2.0, 1.0, 1.0, 0.0
    theta = (a - 0.5, -(b + lam * m * m / 2.0), lam * m, -lam / 2.0)
    T = lambda mu, tau: (math.log(tau), tau, tau * mu, tau * mu * mu)
    dot = lambda u, v: sum(x * y for x, y in zip(u, v))
    rng = random.Random(7)
    worst = 0.0
    for _ in range(20000):
        mu, tau = rng.uniform(-8, 8), rng.uniform(1e-3, 8)
        worst = max(worst, abs(dot(theta, T(mu, tau)) - logf(mu, tau, m, lam, a, b)))
    print("W3  half-space theorem, T(mu,tau) = (log tau, tau, tau*mu, tau*mu^2)")
    print(f"    theta = {theta}")
    print(f"    max |<theta, T> - log f| over 20000 points: {worst:.3e}")
    print("    => {f >= c} == T^-1({t : <theta,t> >= log c}), a closed half-space preimage")
    return worst < 1e-9


def main():
    results = [w1_nonconvex(), w2_hessian(), w3_halfspace()]
    print()
    print("ALL PASS" if all(results) else "FAILED")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
