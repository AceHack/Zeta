import sympy as sp, mpmath as mp

x, z, s, L = sp.symbols('x z s L', positive=True)
n = sp.symbols('n', positive=True, integer=True)

print("=== zeta'(0) numeric (mpmath) ===")
zp0 = mp.diff(mp.zeta, 0)
print("zeta'(0) =", zp0, " vs -log(2*pi)/2 =", -mp.log(2*mp.pi)/2)

print()
print("=== B2: spectral zeta log-det, Dirichlet Laplacian on [0,L] ===")
# eigenvalues (n pi/L)^2 => zeta_A(s) = (L/pi)^{2s} zeta(2s)
# zeta_A'(0) = 2 log(L/pi) zeta(0) + 2 zeta'(0) = -log(L/pi) - log(2pi) = -log(2L)
zA_p0 = 2*sp.log(L/sp.pi)*sp.Rational(-1,2) + 2*(-sp.log(2*sp.pi)/2)
print("zeta_A'(0) =", sp.simplify(zA_p0), " => det(-Lap) = exp(-zeta_A'(0)) =", sp.simplify(sp.exp(-sp.simplify(zA_p0))))
# numeric cross-check at L=3 via mpmath zeta derivative
Lv = 3.0
zA_p0_num = 2*mp.log(Lv/mp.pi)*mp.zeta(0) + 2*mp.diff(mp.zeta, 0)
print("numeric check L=3: exp(-zeta_A'(0)) =", mp.e**(-zA_p0_num), " (expect 2L=6)")

print()
print("=== B5: Stirling / log-Gamma Bernoulli coefficients ===")
for k in [1,2,3]:
    coef = sp.bernoulli(2*k)/(2*k*(2*k-1))
    print(f"  B_{2*k}/(2n(2n-1)) with n={k}:", coef)
zz = mp.mpf(20)
lhs = mp.loggamma(zz)
rhs = (zz-mp.mpf(0.5))*mp.log(zz) - zz + mp.log(2*mp.pi)/2 + 1/(12*zz) - 1/(360*zz**3) + 1/(1260*zz**5)
print("  |loggamma(20) - Stirling(3 Bernoulli terms)| =", abs(lhs-rhs))
# posterior-normalizer form: log Gamma(N+alpha) 1/12 term visible
NN = mp.mpf(50); al = mp.mpf(1.5)
lhs2 = mp.loggamma(NN+al)
rhs2 = (NN+al-mp.mpf(0.5))*mp.log(NN+al) - (NN+al) + mp.log(2*mp.pi)/2
print("  logGamma(N+a) minus 0-order Stirling =", lhs2-rhs2, " vs 1/(12(N+a)) =", 1/(12*(NN+al)))

print()
print("=== B5b: Todd / BCH generating function ===")
todd = x/(1 - sp.exp(-x))
print("x/(1-e^-x) =", sp.series(todd, x, 0, 7))
print("B_n:", [sp.bernoulli(i) for i in range(7)], " (note B1 sign: series carries +x/2)")

print()
print("=== B4b: Wiener 1/nu^2: convergent ===")
print("Sum 1/n^2 =", sp.summation(1/n**2, (n,1,sp.oo)), "-- finite, no regularization, no scheme dependence")

print()
print("=== B1 extra: -I'(0)/12 finite-part check with a different regulator (Gaussian) ===")
# scheme-independence probe: f(x) = x*exp(-(a x)^2); sum-integral -> -f'(0)/12 = -1/12 as a->0?
mp.mp.dps = 25
def gap(aa):
    S = mp.nsum(lambda k: k*mp.e**(-(aa*k)**2), [1, mp.inf])
    I = mp.quad(lambda t: t*mp.e**(-(aa*t)**2), [0, mp.inf])
    return S - I
for aa in [0.5, 0.2, 0.1, 0.05]:
    print(f"  a={aa}: sum-int = {mp.nstr(gap(mp.mpf(aa)), 10)}")
print("  (expect -> -1/12 = -0.08333... if scheme-independent)")
