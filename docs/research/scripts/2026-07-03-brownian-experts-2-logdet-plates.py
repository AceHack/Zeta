# Computation 2: log-det structure of tick-sampled Brownian motion.
# (a) Sigma_ij = sigma^2*Delta*min(i,j): det = (sigma^2*Delta)^N exactly;
#     Sigma^{-1} * sigma^2*Delta = L_DN, the discrete Laplacian on the tick
#     grid with Dirichlet boundary at the pinned start (X_0 = 0) and a
#     free/Neumann end at t_N: tridiag(-1, 2, -1) except L[N,N] = 1.
# (b) det L_DN = 1 for ALL N (exactly); the continuum zeta-det of the
#     Dirichlet-Neumann Laplacian on [0,T] is 2 -- both length-independent.
# (c) Brownian BRIDGE (pinned both ends) -> L_DD = tridiag(-1,2,-1) full,
#     det = N+1 = T/Delta; continuum zeta-det = 2T (bridge 2's plates).
#     Linear-in-T on both sides; lattice-to-zeta factor = 2*Delta.
# (d) The Bernoulli question: finite-N corrections to log det.
#     Wiener: log det Sigma = N log(sigma^2*Delta) EXACT -> corrections
#     identically zero, no Bernoulli terms. OU/Matern-1/2: per-tick log-det
#     correction log((1-e^{-u})/u), u = 2*Delta/ell, whose Taylor
#     coefficients ARE -u/2 + sum B_{2k} u^{2k} / (2k*(2k)!) -- the
#     Euler-Maclaurin/Todd kernel. Bernoulli numbers appear verbatim.
import sympy as sp
import mpmath as mp

sig, D, s, T, u = sp.symbols('sigma Delta s T u', positive=True)

def wiener_cov(N):
    return sp.Matrix(N, N, lambda i, j: sig**2 * D * min(i + 1, j + 1))

def L_DN(N):
    M = sp.zeros(N, N)
    for i in range(N):
        M[i, i] = 2
        if i > 0: M[i, i - 1] = -1
        if i < N - 1: M[i, i + 1] = -1
    M[N - 1, N - 1] = 1
    return M

print("=== (a) det Sigma = (sigma^2 Delta)^N ; inverse = L_DN/(sigma^2 Delta) ===")
for N in [2, 3, 4]:
    S = wiener_cov(N)
    assert sp.simplify(S.det() - (sig**2 * D)**N) == 0
    assert sp.simplify(S.inv() * sig**2 * D - L_DN(N)) == sp.zeros(N, N)
    print(f"  N={N}: det == (sigma^2 Delta)^{N}; Sigma^-1 * sigma^2 Delta == L_DN  OK")
# numeric N=100
mp.mp.dps = 25
Nn, sv, Dv = 100, mp.mpf('1.7'), mp.mpf('0.02')
M = mp.matrix(Nn, Nn)
for i in range(Nn):
    for j in range(Nn):
        M[i, j] = sv**2 * Dv * min(i + 1, j + 1)
ld = mp.log(mp.det(M))
assert abs(ld - Nn * mp.log(sv**2 * Dv)) < mp.mpf('1e-15') * abs(ld)
Minv = mp.inverse(M)
# check tridiagonal DN structure numerically
ok = True
for i in range(Nn):
    for j in range(Nn):
        expect = 0
        if i == j: expect = 1 if i == Nn - 1 else 2
        elif abs(i - j) == 1: expect = -1
        ok = ok and abs(Minv[i, j] * sv**2 * Dv - expect) < mp.mpf('1e-12')
assert ok
print(f"  N=100 numeric: log det == N log(sigma^2 Delta), inverse == L_DN/(sigma^2 Delta)  OK")

print("=== (b) det L_DN = 1 for all N; continuum zeta-det(-Lap_DN on [0,T]) = 2 ===")
for N in range(1, 13):
    assert L_DN(N).det() == 1
print("  det L_DN(N) = 1, N = 1..12  OK  (length-independent, exactly)")
# continuum: eigenvalues ((k-1/2) pi / T)^2, k >= 1 (Dirichlet at 0, Neumann at T).
# zeta_A(s) = (T/pi)^{2s} * sum (k-1/2)^{-2s} = (T/pi)^{2s} * g(2s),
# g(w) := zeta(w, 1/2) = (2^w - 1) zeta(w)   [Hurwitz identity; asserted numerically]
for wv in ['0.3', '2.0', '3.7']:
    w = mp.mpf(wv)
    assert abs(mp.zeta(w, mp.mpf('0.5')) - (2**w - 1) * mp.zeta(w)) < mp.mpf('1e-18')
# zeta(0) = -1/2 (sympy), zeta'(0) = -log(2 pi)/2 (mpmath-asserted, house pattern)
assert sp.zeta(0) == sp.Rational(-1, 2)
zp0 = mp.diff(mp.zeta, 0)
assert abs(zp0 + mp.log(2 * mp.pi) / 2) < mp.mpf('1e-18')
# g(0) = (2^0 - 1) zeta(0) = 0; g'(0) = 2 log 2 * zeta(0) + 0 * 2 zeta'(0) = -log 2.
# zeta_A(0) = 1 * g(0) = 0;  zeta_A'(0) = 2 log(T/pi) * g(0) + g'(0) = -log 2  (T-free!)
g0 = (2**sp.Integer(0) - 1) * sp.zeta(0)
gp0 = 2 * sp.log(2) * sp.zeta(0)              # the zeta'(0) term carries factor (2^0-1)=0
zA0 = g0
zAp0 = 2 * sp.log(T / sp.pi) * g0 + gp0
detDN = sp.simplify(sp.exp(-zAp0))
print(f"  zeta_A(0) = {zA0},  zeta_A'(0) = {sp.simplify(zAp0)},  zeta-det = {detDN}")
assert zA0 == 0 and detDN == 2
# numeric cross-check via mpmath Hurwitz zeta at T = 3.7
Tv = mp.mpf('3.7')
f = lambda t: (Tv/mp.pi)**(2*t) * mp.zeta(2*t, mp.mpf('0.5'))
detDN_num = mp.e**(-mp.diff(f, 0))
assert abs(detDN_num - 2) < mp.mpf('1e-12')
print(f"  numeric (T=3.7): zeta-det = {mp.nstr(detDN_num, 12)}  (length-independent: 2)  OK")

print("=== (c) bridge plate: det L_DD = N+1 = T/Delta; zeta-det = 2T; factor 2*Delta ===")
def L_DD(N):
    M = L_DN(N); M[N - 1, N - 1] = 2; return M
for N in range(1, 13):
    assert L_DD(N).det() == N + 1
print("  det L_DD(N) = N+1, N = 1..12  OK")
# continuum (bridge 2, re-asserted): eigenvalues (k pi/T)^2 => det = 2T
# zeta_B(s) = (T/pi)^{2s} zeta(2s); zeta_B'(0) = 2 log(T/pi) zeta(0) + 2 zeta'(0)
#           = -log(T/pi) - log(2 pi) = -log(2T)   [house bridges-2.py pattern]
zBp0 = 2 * sp.log(T / sp.pi) * sp.zeta(0) + 2 * (-sp.log(2 * sp.pi) / 2)
detDD = sp.simplify(sp.exp(-sp.simplify(zBp0)))
print(f"  zeta-det(-Lap_DD on [0,T]) = {detDD}")
assert sp.simplify(detDD - 2*T) == 0
# correspondence: with T = (N+1)*Delta (N interior ticks), zeta-det / lattice-det = 2*Delta
ratio = sp.simplify((2*T).subs(T, (sp.Symbol('N') + 1) * D) / (sp.Symbol('N') + 1))
print(f"  zeta-det / lattice-det = {ratio}  -- the 2*Delta lattice normalization")
assert sp.simplify(ratio - 2*D) == 0

print("=== (d) Bernoulli question: finite-N corrections to log det ===")
# Wiener: (1/N) log det Sigma = log(sigma^2 Delta) EXACT (shown in (a)) ->
# Euler-Maclaurin correction series is identically zero. No Bernoulli terms.
print("  Wiener plate: log det Sigma_N = N log(sigma^2 Delta) EXACT -> zero correction series.")
# Consistency via eigenvalues: det L_DN = prod 4 sin^2((2k-1)pi/(2(2N+1))) = 1;
# check numerically that sum log(4 sin^2) = 0, i.e. EM corrections cancel exactly.
for Nn2 in [5, 20, 60]:
    ssum = mp.fsum(mp.log(4 * mp.sin((2*k - 1) * mp.pi / (2*(2*Nn2 + 1)))**2)
                   for k in range(1, Nn2 + 1))
    assert abs(ssum) < mp.mpf('1e-18'), (Nn2, ssum)
print("  eigenvalue route: sum_k log(4 sin^2((2k-1)pi/(2(2N+1)))) = 0 exactly (N=5,20,60)  OK")
# OU / Matern-1/2: per-tick log-det correction is log((1-e^{-u})/u), u = 2 Delta/ell.
# Claim: log((1-e^{-u})/u) = -u/2 + sum_{k>=1} B_{2k} u^{2k} / (2k*(2k)!)
lhs = sp.series(sp.log((1 - sp.exp(-u)) / u), u, 0, 9).removeO()
rhs = -u/2 + sum(sp.bernoulli(2*k) * u**(2*k) / (2*k * sp.factorial(2*k))
                 for k in range(1, 5))
assert sp.simplify(sp.expand(lhs - rhs)) == 0
print("  OU plate: log((1-e^-u)/u) = -u/2 + B2 u^2/24 - B4-term u^4/2880 + ...")
print("           = -u/2 + sum B_2k u^2k/(2k (2k)!)  -- Bernoulli numbers VERBATIM,")
print("           the Euler-Maclaurin/Todd kernel (bridge 1/5b), asserted to O(u^8).")
print("  coefficients:", [sp.nsimplify(lhs.coeff(u, m)) for m in range(1, 7)])
print("ALL ASSERTIONS PASSED (script 2)")
