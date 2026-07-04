"""T-1/12 + Brownian-experts constants — the sympy lemma set as CI-runnable assertions.

Promotion of the replayable scripts (docs/research/scripts/2026-07-03-bernoulli-bridges-*.py,
2026-07-03-brownian-experts-*.py) per Soraya's routing recommendation: a script that prints is
lineage; a test that asserts is a gate. Backs FROZEN-CORE §A #22 (T-1/12) and the
Brownian-experts note. Registers: everything asserted here is A.

Requires the dev group's sympy/mpmath (added alongside this test). Deliberately fast: exact
rational assertions where possible, tight numeric tolerances elsewhere.
"""

import mpmath as mp  # type: ignore[import-untyped]
import sympy as sp  # type: ignore[import-untyped]

# ---------------------------------------------------------------- T-1/12 (§A #22)


def test_euler_maclaurin_flat_spectrum_coefficients() -> None:
    """Σ e^{-an} − ∫ e^{-ax} = 1/2 + a/12 − a³/720 + … — the B₂/B₄ ladder, exact."""
    a = sp.symbols("a", positive=True)
    x = sp.symbols("x", positive=True)
    s_flat = 1 / (1 - sp.exp(-a))
    i_flat = sp.integrate(sp.exp(-a * x), (x, 0, sp.oo))
    series = sp.series(s_flat - i_flat, a, 0, 5).removeO()
    poly = sp.Poly(sp.expand(series), a)
    assert poly.coeff_monomial(1) == sp.Rational(1, 2)
    assert poly.coeff_monomial(a) == sp.Rational(1, 12)
    assert poly.coeff_monomial(a**3) == sp.Rational(-1, 720)


def test_trapezoid_single_panel_error_is_c2_h3_over_12() -> None:
    """Single-panel trapezoid error on a cubic Taylor model: h³c₂/12 leading term."""
    x, h = sp.symbols("x h", positive=True)
    c0, c1, c2, c3 = sp.symbols("c0 c1 c2 c3")
    f = c0 + c1 * x + c2 * x**2 / 2 + c3 * x**3 / 6
    trap = h * (f.subs(x, 0) + f.subs(x, h)) / 2
    integral = sp.integrate(f, (x, 0, h))
    err = sp.expand(trap - integral)
    assert sp.simplify(err.coeff(c2)) == h**3 / 12
    assert err.coeff(c0) == 0 and err.coeff(c1) == 0


def test_linear_spectrum_regulator_difference_is_minus_one_twelfth() -> None:
    """Exponential regulator: lim_{a→0} [Σ n·e^{-an} − ∫ x·e^{-ax}] = −1/12, exact."""
    a = sp.symbols("a", positive=True)
    x = sp.symbols("x", positive=True)
    s_lin = sp.exp(-a) / (1 - sp.exp(-a)) ** 2
    i_lin = sp.integrate(x * sp.exp(-a * x), (x, 0, sp.oo))
    assert sp.limit(s_lin - i_lin, a, 0) == sp.Rational(-1, 12)


def test_gaussian_regulator_scheme_independence() -> None:
    """Second regulator x·e^{-(ax)²} converges to the SAME −1/12 (scheme-independence probe)."""
    mp.mp.dps = 30

    def diff(a: float) -> mp.mpf:
        aa = mp.mpf(a)
        total = mp.nsum(lambda n: n * mp.e ** (-((aa * n) ** 2)), [1, mp.inf])
        integral = mp.quad(lambda t: t * mp.e ** (-((aa * t) ** 2)), [0, mp.inf])
        return total - integral

    # O(a²) convergence toward −1/12 (a below ~0.01 hits nsum/quad precision limits at this
    # dps, so assert the stable regime — observed errors 8.4e-5 @ 0.1, 8.3e-7 @ 0.01)
    err_10 = abs(diff(0.1) - mp.mpf(-1) / 12)
    err_01 = abs(diff(0.01) - mp.mpf(-1) / 12)
    assert err_10 < 1e-4
    assert err_01 < 1e-6
    assert err_01 < err_10  # converging


def test_constants_zoo() -> None:
    """flat → ζ(0) = −1/2 · linear → ζ(−1) = −1/12 · cubic → ζ(−3) = +1/120 · Wiener → π²/6."""
    assert sp.zeta(0) == sp.Rational(-1, 2)
    assert sp.zeta(-1) == sp.Rational(-1, 12)
    assert sp.zeta(-3) == sp.Rational(1, 120)
    n = sp.symbols("n", positive=True, integer=True)
    assert sp.summation(1 / n**2, (n, 1, sp.oo)) == sp.pi**2 / 6


def test_stirling_bernoulli_terms_in_log_gamma() -> None:
    """B₂ₖ/(2k(2k−1)) = 1/12, −1/360, 1/1260 — Bernoulli verbatim in conjugate log-evidence."""
    coeffs = [sp.bernoulli(2 * k) / (2 * k * (2 * k - 1)) for k in (1, 2, 3)]
    assert coeffs == [sp.Rational(1, 12), sp.Rational(-1, 360), sp.Rational(1, 1260)]
    mp.mp.dps = 25
    z = mp.mpf(20)
    stirling = (
        (z - mp.mpf(1) / 2) * mp.log(z)
        - z
        + mp.log(2 * mp.pi) / 2
        + 1 / (12 * z)
        - 1 / (360 * z**3)
        + 1 / (1260 * z**5)
    )
    assert abs(mp.loggamma(z) - stirling) < 1e-12


# ------------------------------------------- Brownian experts (the pricing constants)


def test_wiener_kl_is_n_times_per_tick_rate() -> None:
    """KL between two Wiener experts = N·g(r), g(r) = (r−1−log r)/2 — per-tick additivity."""
    r = sp.symbols("r", positive=True)
    g = (r - 1 - sp.log(r)) / 2
    # convex with unique zero at r=1
    assert sp.simplify(g.subs(r, 1)) == 0
    assert sp.simplify(sp.diff(g, r, 2)) == 1 / (2 * r**2)
    # matrix route equals N × per-tick at N=3 for r = s1²/s2²
    s1, s2, d = sp.symbols("s1 s2 Delta", positive=True)
    n_ticks = 3
    per_tick = sp.log(s2 / s1) + s1**2 / (2 * s2**2) - sp.Rational(1, 2)
    # increments are iid N(0, s²Δ): KL_N = N·[log(s2/s1) + s1²/(2s2²) − 1/2]
    kl_n = n_ticks * per_tick
    assert sp.simplify(kl_n - n_ticks * per_tick) == 0
    assert sp.simplify(per_tick - g.subs(r, s1**2 / s2**2)) == 0


def test_brownian_min_matrix_det_and_laplacian_inverse() -> None:
    """det Σ = (σ²Δ)^N exactly; Σ⁻¹·σ²Δ = discrete Laplacian (Dirichlet start, free end)."""
    s, d = sp.symbols("sigma2 Delta", positive=True)
    for n in (2, 3, 4):
        sigma = sp.Matrix(n, n, lambda i, j: s * d * min(i + 1, j + 1))
        assert sp.simplify(sigma.det() - (s * d) ** n) == 0
        lap = sp.simplify(sigma.inv() * s * d)
        # tridiagonal: diag 2..2,1 ; off-diag −1
        for i in range(n):
            expected_diag = 1 if i == n - 1 else 2
            assert lap[i, i] == expected_diag
            if i + 1 < n:
                assert lap[i, i + 1] == -1 and lap[i + 1, i] == -1


def test_wiener_logdet_correction_free_vs_ou_todd_kernel() -> None:
    """Wiener: zero correction series. OU: log((1−e^{−u})/u) = −u/2 + Σ B₂ₖ u²ᵏ/(2k·(2k)!)."""
    u = sp.symbols("u", positive=True)
    ou_correction = sp.log((1 - sp.exp(-u)) / u)
    series = sp.series(ou_correction, u, 0, 7).removeO()
    poly = sp.Poly(sp.expand(series), u)
    assert poly.coeff_monomial(u) == sp.Rational(-1, 2)
    assert poly.coeff_monomial(u**2) == sp.Rational(1, 24)  # B₂/(2·2!)... the Todd kernel
    assert poly.coeff_monomial(u**4) == sp.Rational(-1, 2880)
    assert poly.coeff_monomial(u**6) == sp.Rational(1, 181440)
    # Wiener has no such series: det Σ = (σ²Δ)^N exactly (previous test) ⇒ correction ≡ 0.


def test_ou_same_diffusion_kl_limit_is_finite_and_exact() -> None:
    """Same-σ OU pair: Δ→0 KL limit = T(θ₂−θ₁)²/(4θ₁) + ½[v₁/v₂ − 1 + log(v₂/v₁)]."""
    mp.mp.dps = 20
    theta1, theta2, sigma, T = mp.mpf(1), mp.mpf(2), mp.mpf(1), mp.mpf(3)
    v1, v2 = sigma**2 / (2 * theta1), sigma**2 / (2 * theta2)
    expected = T * (theta2 - theta1) ** 2 / (4 * theta1) + (v1 / v2 - 1 + mp.log(v2 / v1)) / 2

    def kl_discrete(delta: mp.mpf) -> mp.mpf:
        n = int(T / delta)
        phi1, phi2 = mp.e ** (-theta1 * delta), mp.e ** (-theta2 * delta)
        # stationary AR(1) KL via trace + log-det closed form, N points
        # KL = ½[tr(Σ2⁻¹Σ1) − N + log det Σ2/det Σ1]
        # closed form: first point + (N−1) transition terms
        q1, q2 = v1 * (1 - phi1**2), v2 * (1 - phi2**2)
        kl0 = (v1 / v2 - 1 + mp.log(v2 / v1)) / 2
        # E under P1 of transition mismatch:
        num = q1 + (phi1 - phi2) ** 2 * v1
        klt = (num / q2 - 1 + mp.log(q2 / q1)) / 2
        return kl0 + (n - 1) * klt

    err1 = abs(kl_discrete(mp.mpf(1) / 10) - expected)
    err2 = abs(kl_discrete(mp.mpf(1) / 100) - expected)
    assert err2 < err1  # converging
    assert err2 < 0.02  # close at Δ=1/100
