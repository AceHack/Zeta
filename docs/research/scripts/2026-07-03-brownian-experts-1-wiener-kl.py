# Computation 1: KL between two Wiener-class experts on a tick window.
# X_i sampled at t_i = i*Delta, i=1..N, window T = N*Delta.
# Wiener with diffusion sigma_i^2: increments iid N(0, sigma_i^2 * Delta).
# Claim: KL(P1||P2) = N * [ log(s2/s1) + s1^2/(2 s2^2) - 1/2 ]  (exact, all N)
# and KL diverges LINEARLY in N as Delta->0 with T fixed (mutual singularity:
# quadratic variation identifies sigma^2 a.s.; Girsanov covers drift only).
import sympy as sp
import mpmath as mp

s1, s2, D = sp.symbols('sigma1 sigma2 Delta', positive=True)

kl_per_tick = sp.log(s2/s1) + s1**2/(2*s2**2) - sp.Rational(1, 2)

def wiener_cov(N, s):
    # Sigma_ij = s^2 * Delta * min(i,j),  i,j = 1..N
    return sp.Matrix(N, N, lambda i, j: s**2 * D * min(i + 1, j + 1))

def gauss_kl(S1, S2):
    N = S1.shape[0]
    S2i = S2.inv()
    return sp.Rational(1, 2) * ((S2i * S1).trace() - N
                                + sp.log(S2.det() / S1.det()))

print("=== 1. Wiener vs Wiener KL: matrix formula == N * per-tick (symbolic) ===")
for N in [2, 3, 4]:
    kl_mat = sp.simplify(gauss_kl(wiener_cov(N, s1), wiener_cov(N, s2)))
    diff = sp.simplify(kl_mat - N * kl_per_tick)
    print(f"  N={N}: residual vs N*per-tick: {diff}")
    assert diff == 0, (N, kl_mat)

print("=== numeric cross-check N=120 (mpmath, independent route) ===")
mp.mp.dps = 30
Nn, s1v, s2v, Dv = 120, mp.mpf('0.7'), mp.mpf('1.3'), mp.mpf('0.01')
M1 = mp.matrix(Nn, Nn); M2 = mp.matrix(Nn, Nn)
for i in range(Nn):
    for j in range(Nn):
        m = mp.mpf(min(i + 1, j + 1)) * Dv
        M1[i, j] = s1v**2 * m
        M2[i, j] = s2v**2 * m
S2inv_S1 = mp.inverse(M2) * M1
tr = sum(S2inv_S1[i, i] for i in range(Nn))
logdet_ratio = mp.log(mp.det(M2) / mp.det(M1))
kl_num = (tr - Nn + logdet_ratio) / 2
kl_exact = Nn * (mp.log(s2v/s1v) + s1v**2/(2*s2v**2) - mp.mpf('0.5'))
print(f"  matrix KL = {mp.nstr(kl_num, 15)}  exact = {mp.nstr(kl_exact, 15)}")
assert abs(kl_num - kl_exact) < mp.mpf('1e-18') * abs(kl_exact)

print("=== divergence as Delta->0, T fixed ===")
T = sp.Symbol('T', positive=True)
# per-tick constant in ratio form: r = sigma1^2/sigma2^2  =>  g(r) = (r - 1 - log r)/2
r = sp.Symbol('r', positive=True)
g = (r - 1 - sp.log(r)) / 2
assert sp.simplify(kl_per_tick.subs(s1, sp.sqrt(r) * s2) - g) == 0
# g strictly convex, unique minimum g(1)=0  =>  g > 0 for r != 1
assert sp.simplify(g.subs(r, 1)) == 0
assert sp.solve(sp.diff(g, r), r) == [1]
assert sp.simplify(sp.diff(g, r, 2) - 1 / (2 * r**2)) == 0   # g'' = 1/(2r^2) > 0
c = sp.Symbol('c', positive=True)   # the proven-positive per-tick KL
lim = sp.limit((T / D) * c, D, 0, '+')
print("  per-tick KL = g(r) = (r - 1 - log r)/2, >= 0, = 0 iff r = 1 (convex, min at 1)")
print(f"  limit_(Delta->0) KL(T fixed) = {lim}  -- linear divergence in N = T/Delta")
assert lim == sp.oo
print("ALL ASSERTIONS PASSED (script 1)")
