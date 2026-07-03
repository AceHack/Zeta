import sympy as sp

a, x, z, s, L, nu, D = sp.symbols('a x z s L nu Delta', positive=True)
n = sp.symbols('n', positive=True, integer=True)

print("=== B1: Euler-Maclaurin / trapezoid bridge ===")
# flat-ish regulated spectrum f(x)=exp(-a x): sum_{n>=0} - integral_0^inf
S_flat = 1/(1 - sp.exp(-a))              # sum_{n=0}^inf e^{-an}
I_flat = sp.integrate(sp.exp(-a*x), (x, 0, sp.oo))
print("flat: sum - integral series:", sp.series(S_flat - I_flat, a, 0, 6))

# linear spectrum f(x)= x e^{-ax}: the Casimir toy. sum n e^{-an} - int x e^{-ax}
S_lin = sp.exp(-a)/(1-sp.exp(-a))**2     # sum_{n=0}^inf n e^{-an}
I_lin = sp.integrate(x*sp.exp(-a*x), (x, 0, sp.oo))
print("linear: sum - integral series:", sp.series(S_lin - I_lin, a, 0, 6))
print("limit a->0 (the -1/12):", sp.limit(S_lin - I_lin, a, 0))

# generic trapezoid error coefficient: single-panel trapezoid on [0,h] vs integral
h = sp.symbols('h', positive=True)
f = sp.Function('f')
trap = h*(f(0)+f(h))/2
integ = sp.integrate(f(x).series(x, 0, 5).removeO(), (x, 0, h))
err = sp.expand(trap - integ.subs(f(h), f(h)))
# do it with a Taylor model
c0,c1,c2,c3 = sp.symbols('c0 c1 c2 c3')
fT = c0 + c1*x + c2*x**2/2 + c3*x**3/6
trapT = h*(fT.subs(x,0)+fT.subs(x,h))/2
intT  = sp.integrate(fT,(x,0,h))
print("trapezoid single-panel error:", sp.expand(trapT-intT))  # expect h^3 c2/12 + ...

print()
print("=== B4: constants zoo ===")
print("zeta(0)   =", sp.zeta(0))
print("zeta(-1)  =", sp.zeta(-1))
print("zeta(-3)  =", sp.zeta(-3))
print("zeta(2)   =", sp.zeta(2))
zp0 = sp.diff(sp.zeta(s), s).subs(s, 0)
print("zeta'(0)  =", sp.simplify(zp0), "=", sp.nsimplify(sp.N(sp.zeta(s).diff(s).subs(s,0), 30), [sp.log(2*sp.pi)]))
print("B2 =", sp.bernoulli(2), " B4 =", sp.bernoulli(4))

print()
print("=== B2: spectral zeta log-det, Dirichlet Laplacian on [0,L] ===")
# eigenvalues (n pi / L)^2  =>  zeta_A(s) = (L/pi)^{2s} zeta(2s)
zetaA = (L/sp.pi)**(2*s) * sp.zeta(2*s)
zetaA_p0 = sp.diff(zetaA, s).subs(s, 0)
zetaA_p0 = sp.simplify(zetaA_p0.rewrite(sp.log))
print("zeta_A'(0) =", sp.simplify(zetaA_p0))
print("det(-Laplacian) = exp(-zeta_A'(0)) =", sp.simplify(sp.exp(-zetaA_p0)))

print()
print("=== B5: Stirling / log-Gamma Bernoulli coefficients ===")
# asymptotic: loggamma(z) - [(z-1/2)log z - z + log(2pi)/2] ~ sum B_{2n}/(2n(2n-1) z^{2n-1})
for k in [1,2,3]:
    coef = sp.bernoulli(2*k)/(2*k*(2*k-1))
    print(f"  B_{2*k}/({2*k}({2*k}-1)) =", coef, " -> term", coef/z**(2*k-1))
# numeric check at z=10
import mpmath
zz = 20
lhs = mpmath.loggamma(zz)
rhs = (zz-0.5)*mpmath.log(zz) - zz + 0.5*mpmath.log(2*mpmath.pi) \
      + 1/(12*zz) - 1/(360*zz**3) + 1/(1260*zz**5)
print("  |loggamma(20) - Stirling(3 Bernoulli terms)| =", abs(lhs-rhs))

print()
print("=== B5b: Todd class / BCH generating function ===")
todd = x/(1 - sp.exp(-x))
print("x/(1-e^-x) series:", sp.series(todd, x, 0, 7))
print("Bernoulli B0..B6:", [sp.bernoulli(i) for i in range(7)])

print()
print("=== B4b: Wiener 1/nu^2 spectrum -- convergent, no regularization ===")
print("Sum 1/n^2 =", sp.summation(1/n**2, (n, 1, sp.oo)))
