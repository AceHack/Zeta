# Computation 3: Matern-1/2 (Ornstein-Uhlenbeck) experts and the dichotomy.
# OU: dX = -theta X dt + sigma dW, theta = 1/ell, stationary var v = sigma^2/(2 theta).
# Sampled at Delta: stationary AR(1), phi = e^{-theta Delta}, Sigma_ij = v phi^|i-j|.
# (a) det Sigma = v^N (1-phi^2)^{N-1}; inverse tridiagonal (verified N=2,3,4 + numeric).
# (b) Closed-form KL between two stationary OU experts at N ticks (verified vs matrices).
# (c) SAME diffusion sigma, different ell: Delta->0, T fixed limit is FINITE and equals
#     the Girsanov path-space value  T (theta2-theta1)^2 / (4 theta1)  plus the
#     stationary-marginal boundary term  KL0 = [v1/v2 - 1 + log(v2/v1)]/2.
# (d) DIFFERENT diffusion: per-tick KL -> (r - 1 - log r)/2, r = sigma1^2/sigma2^2 --
#     the SAME constant as the Wiener case; total diverges linearly in N. Dichotomy.
import sympy as sp
import mpmath as mp

v, v1, v2, phi, phi1, phi2, D, T = sp.symbols('v v1 v2 phi phi1 phi2 Delta T', positive=True)
th1, th2, sg, sg1, sg2 = sp.symbols('theta1 theta2 sigma sigma1 sigma2', positive=True)
Nsym = sp.Symbol('N', positive=True)

def ar1_cov(N, vv, ph):
    return sp.Matrix(N, N, lambda i, j: vv * ph**abs(i - j))

def ar1_prec_tridiag(N, vv, ph):
    M = sp.zeros(N, N)
    for i in range(N):
        M[i, i] = 1 if i in (0, N - 1) else 1 + ph**2
        if i > 0: M[i, i - 1] = -ph
        if i < N - 1: M[i, i + 1] = -ph
    return M / (vv * (1 - ph**2))

print("=== (a) AR(1) det + tridiagonal inverse (symbolic N=2,3,4) ===")
for N in [2, 3, 4]:
    S = ar1_cov(N, v, phi)
    assert sp.simplify(S.det() - v**N * (1 - phi**2)**(N - 1)) == 0
    assert sp.simplify(S.inv() - ar1_prec_tridiag(N, v, phi)) == sp.zeros(N, N)
    print(f"  N={N}: det == v^N (1-phi^2)^(N-1); inverse tridiagonal  OK")

print("=== (b) closed-form KL vs matrix formula ===")
# tr(S2^-1 S1) = c [ N(1+phi2^2) - 2 phi2^2 - 2(N-1) phi1 phi2 ],  c = v1/(v2(1-phi2^2))
c = v1 / (v2 * (1 - phi2**2))
def kl_closed(N):
    tr = c * (N * (1 + phi2**2) - 2 * phi2**2 - 2 * (N - 1) * phi1 * phi2)
    logdet = N * sp.log(v2 / v1) + (N - 1) * sp.log((1 - phi2**2) / (1 - phi1**2))
    return sp.Rational(1, 2) * (tr - N + logdet)
def gauss_kl(S1, S2):
    N = S1.shape[0]
    return sp.Rational(1, 2) * ((S2.inv() * S1).trace() - N + sp.log(S2.det() / S1.det()))
def is_zero(expr):
    # factor inside logs (sympy won't reduce log((1-phi^2)^2)/2 - log(1-phi^2) alone)
    e = expr.replace(sp.log, lambda a: sp.log(sp.factor(a)))
    return sp.simplify(sp.expand_log(e, force=True)) == 0
for N in [2, 3, 4]:
    d = gauss_kl(ar1_cov(N, v1, phi1), ar1_cov(N, v2, phi2)) - kl_closed(N)
    assert is_zero(d), N
    print(f"  N={N}: closed form == matrix KL  OK")
# numeric N=80 cross-check
mp.mp.dps = 30
Nn = 80
v1v, v2v, p1v, p2v = mp.mpf('0.8'), mp.mpf('1.9'), mp.mpf('0.93'), mp.mpf('0.85')
A1 = mp.matrix(Nn, Nn); A2 = mp.matrix(Nn, Nn)
for i in range(Nn):
    for j in range(Nn):
        A1[i, j] = v1v * p1v**abs(i - j)
        A2[i, j] = v2v * p2v**abs(i - j)
X = mp.inverse(A2) * A1
kl_num = (sum(X[i, i] for i in range(Nn)) - Nn + mp.log(mp.det(A2) / mp.det(A1))) / 2
cc = v1v / (v2v * (1 - p2v**2))
tr_cf = cc * (Nn * (1 + p2v**2) - 2 * p2v**2 - 2 * (Nn - 1) * p1v * p2v)
ld_cf = Nn * mp.log(v2v / v1v) + (Nn - 1) * mp.log((1 - p2v**2) / (1 - p1v**2))
kl_cf = (tr_cf - Nn + ld_cf) / 2
assert abs(kl_num - kl_cf) < mp.mpf('1e-18') * abs(kl_cf)
print(f"  N=80 numeric: matrix {mp.nstr(kl_num, 12)} == closed form {mp.nstr(kl_cf, 12)}  OK")

print("=== (c) same diffusion sigma, different lengthscale: FINITE Delta->0 limit ===")
# substitute phi_i = exp(-theta_i Delta), v_i = sigma^2/(2 theta_i), N = T/Delta
subs_same = {phi1: sp.exp(-th1 * D), phi2: sp.exp(-th2 * D),
             v1: sg**2 / (2 * th1), v2: sg**2 / (2 * th2)}
KL_ND = kl_closed(Nsym).subs(subs_same)
# split: KL = (T/Delta) * Acoef/? ... take coefficient in N, then N = T/Delta
Acoef = sp.expand(KL_ND).coeff(Nsym, 1)
Bcoef = sp.expand(KL_ND).coeff(Nsym, 0)
A_ser = sp.series(Acoef, D, 0, 3).removeO()
girsanov_rate = (th2 - th1)**2 / (4 * th1)
assert sp.simplify(A_ser.coeff(D, 0)) == 0            # no 1/Delta divergence
assert sp.simplify(A_ser.coeff(D, 1) - girsanov_rate) == 0
B_lim = sp.limit(Bcoef, D, 0, '+')
KL0 = sp.Rational(1, 2) * (th2 / th1 - 1 + sp.log(th1 / th2))  # = [v1/v2-1+log(v2/v1)]/2
assert sp.simplify(B_lim - KL0) == 0
print("  lim KL = T (theta2-theta1)^2/(4 theta1) + [v1/v2 - 1 + log(v2/v1)]/2  (SYMBOLIC)")
print("           bulk = Girsanov drift term; constant = stationary-marginal KL0  OK")
# numeric convergence check: T = 2, theta1 = 1, theta2 = 3, sigma = 1.3
Tv, t1v, t2v, sgv = mp.mpf(2), mp.mpf(1), mp.mpf(3), mp.mpf('1.3')
target = Tv * (t2v - t1v)**2 / (4 * t1v) + (t2v/t1v - 1 + mp.log(t1v/t2v)) / 2
def kl_disc(Dv):
    Nn = int(Tv / Dv)
    p1, p2 = mp.e**(-t1v * Dv), mp.e**(-t2v * Dv)
    w1, w2 = sgv**2 / (2 * t1v), sgv**2 / (2 * t2v)
    ccc = w1 / (w2 * (1 - p2**2))
    tr = ccc * (Nn * (1 + p2**2) - 2 * p2**2 - 2 * (Nn - 1) * p1 * p2)
    ld = Nn * mp.log(w2 / w1) + (Nn - 1) * mp.log((1 - p2**2) / (1 - p1**2))
    return (tr - Nn + ld) / 2
errs = [abs(kl_disc(mp.mpf(1) / m) - target) for m in [10, 100, 1000]]
print(f"  numeric: |KL(Delta) - limit| at Delta=1/10,1/100,1/1000: "
      f"{[mp.nstr(e, 4) for e in errs]}")
# O(Delta) convergence: each 10x refinement shrinks the error ~10x
assert errs[1] / errs[0] < mp.mpf('0.15') and errs[2] / errs[1] < mp.mpf('0.15')
assert errs[2] < mp.mpf('2e-3')
print(f"  converges to {mp.nstr(target, 10)} (finite -- equivalent measures)  OK")

print("=== (d) different diffusion: per-tick KL -> Wiener constant, total diverges ===")
subs_diff = {phi1: sp.exp(-th1 * D), phi2: sp.exp(-th2 * D),
             v1: sg1**2 / (2 * th1), v2: sg2**2 / (2 * th2)}
A_diff = sp.expand(kl_closed(Nsym).subs(subs_diff)).coeff(Nsym, 1)
per_tick_lim = sp.limit(A_diff, D, 0, '+')
r = sp.Symbol('r', positive=True)
wiener_const = ((r - 1 - sp.log(r)) / 2).subs(r, sg1**2 / sg2**2)
assert sp.simplify(per_tick_lim - wiener_const) == 0
print("  lim per-tick KL = (r - 1 - log r)/2, r = sigma1^2/sigma2^2 -- SAME as Wiener case.")
print("  Total = N * const -> oo as Delta->0, T fixed: mutually singular (dichotomy).  OK")
print("ALL ASSERTIONS PASSED (script 3)")
