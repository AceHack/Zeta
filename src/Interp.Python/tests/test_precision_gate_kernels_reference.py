"""Independent density identities, fixed scalars and public refusal controls."""

from __future__ import annotations

import itertools
import json
from decimal import ROUND_DOWN, Context, Decimal, Inexact, localcontext
from fractions import Fraction as F
from typing import Any, cast

import pytest

from zeta_interp import precision_gate_kernels_reference as r


def ok[T](result: r.Result[T]) -> T:
    assert isinstance(result, r.Success), result
    return result.Value


def refusal(result: object, code: str, field: str | None = None) -> r.Failure:
    assert type(result) is r.Failure, result
    assert result.Code == code
    if field is not None:
        assert result.Field == field
    return result


def real(mean: int | F, variance: int | F) -> r.RealMoments:
    return r.RealMoments(F(mean), F(variance))


def gaussian(linear: int | F, precision: int | F) -> r.GaussianKernel:
    return r.GaussianKernel(F(linear), F(precision))


def gamma(power: int | F, rate: int | F) -> r.GammaKernel:
    return r.GammaKernel(F(power), F(rate))


def test_uncertain_bilinear_literal_sites() -> None:
    value = ok(r.soft_dot_vmp(real(2, 3), real(4, 5), real(7, 2), 2))
    assert value == r.SoftDotVmp(
        F(86), gaussian(16, 2), gaussian(56, 42), gaussian(28, 14), gamma(F(1, 2), 43)
    )
    # Removing either input variance contribution would give a different rate.
    assert value.ResidualSecondMoment not in (86 - 20, 86 - 48, 86 - 15)


def test_exact_finite_support_density_expectation_is_independent_residual() -> None:
    # Each support is a fair two-point distribution; no RNG or normal sampling.
    squared_errors = [
        (z - w * x) ** 2 for w, x, z in itertools.product((-1, 3), (0, 2), (3, 5))
    ]
    expectation = sum(map(F, squared_errors), F()) / 8
    result = ok(r.soft_dot_vmp(real(1, 4), real(1, 1), real(4, 1), F(3, 2)))
    assert expectation == 19
    assert result.ResidualSecondMoment == expectation
    assert result.ToTau == gamma(F(1, 2), F(19, 2))


def test_fractional_and_negative_mean_sites() -> None:
    value = ok(
        r.soft_dot_vmp(
            real(F(-1, 2), F(1, 3)),
            real(F(3, 2), F(2, 5)),
            real(F(1, 4), F(3, 7)),
            F(5, 2),
        )
    )
    assert value.ResidualSecondMoment == F(1013, 420)
    assert value.ToZ == gaussian(F(-15, 8), F(5, 2))
    assert value.ToWeight == gaussian(F(15, 16), F(53, 8))
    assert value.ToInput == gaussian(F(-5, 16), F(35, 24))
    assert value.ToTau == gamma(F(1, 2), F(1013, 840))


def test_zero_clamped_predictor_and_zero_residual_are_sites() -> None:
    value = ok(r.soft_dot_vmp(real(2, 0), real(0, 0), real(0, 0), 2))
    assert value.ResidualSecondMoment == 0
    assert value.ToWeight == gaussian(0, 0)
    assert value.ToInput == gaussian(0, 8)
    assert value.ToTau == gamma(F(1, 2), 0)
    refusal(r.gamma_proper_moments(value.ToTau), "ImproperGamma")
    combined = ok(r.gamma_product(value.ToTau, gamma(1, 3)))
    assert ok(r.gamma_proper_moments(combined)).Mean == F(5, 6)


def test_normal_sites_are_independent_not_correlated_marginals() -> None:
    result = ok(r.normal_precision_vmp(real(3, 2), real(-1, 5), F(3, 2)))
    assert result == r.NormalPrecisionVmp(
        gaussian(F(-3, 2), F(3, 2)),
        gaussian(F(9, 2), F(3, 2)),
        gamma(F(1, 2), F(23, 2)),
    )
    exact = ok(r.normal_precision_vmp(real(2, 0), real(2, 0), 3))
    assert exact.ToPrecision == gamma(F(1, 2), 0)


def test_reverse_gamma_shape_increment_survives_prior_product() -> None:
    result = ok(r.gamma_rate_vmp(2, 7, 3))
    assert result.ToValue == gamma(1, 7)
    assert result.ToRate == gamma(2, 3)
    assert result.ValueEncoding == r.ShapeEncoding(F(2), F(2), result.ToValue)
    combined = ok(r.gamma_product(gamma(4, 7), result.ToRate))
    assert combined == gamma(6, 10)
    assert ok(r.gamma_proper_moments(combined)) == r.GammaMoments(
        F(7), F(10), F(7, 10), F(7, 100)
    )


@pytest.mark.parametrize(
    "kernel", [gamma(0, 0), gamma(-5, -2), gamma(F(-3, 2), 4), gamma(2, 3)]
)
def test_gamma_kernel_algebra_does_not_require_properness(
    kernel: r.GammaKernel,
) -> None:
    other = gamma(F(3, 7), F(-9, 2))
    assert ok(r.gamma_product(kernel, gamma(0, 0))) == kernel
    assert ok(r.gamma_quotient(ok(r.gamma_product(kernel, other)), other)) == kernel
    assert ok(r.gamma_quotient(kernel, kernel)) == gamma(0, 0)


@pytest.mark.parametrize(
    "kernel", [gaussian(1, 0), gaussian(2, -3), gaussian(0, 0), gaussian(-4, 2)]
)
def test_gaussian_kernel_algebra_is_not_proper_density_admission(
    kernel: r.GaussianKernel,
) -> None:
    other = gaussian(F(-2, 7), F(3, 2))
    assert ok(r.gaussian_product(kernel, gaussian(0, 0))) == kernel
    assert (
        ok(r.gaussian_quotient(ok(r.gaussian_product(kernel, other)), other)) == kernel
    )
    assert ok(r.gaussian_quotient(kernel, kernel)) == gaussian(0, 0)


def test_improper_gaussian_site_can_combine_to_proper_density() -> None:
    kernel = ok(r.gaussian_product(gaussian(2, -3), gaussian(1, 5)))
    assert kernel == gaussian(3, 2)
    assert ok(r.gaussian_proper_moments(kernel)) == real(F(3, 2), F(1, 2))
    assert ok(r.gaussian_proper_moments(gaussian(0, 3))) == real(0, F(1, 3))
    assert ok(r.gaussian_proper_moments(gaussian(-2, 1))).Mean == -2


@pytest.mark.parametrize("precision", [0, -1, F(-1, 10**20)])
def test_improper_gaussians_refuse_moment_interpretation(precision: int | F) -> None:
    refusal(
        r.gaussian_proper_moments(gaussian(1, precision)),
        "ImproperGaussian",
        "kernel.Precision",
    )


@pytest.mark.parametrize(
    "kernel,field",
    [
        (gamma(-1, 1), "kernel.LogPower"),
        (gamma(-2, -1), "kernel.LogPower"),
        (gamma(0, 0), "kernel.Rate"),
        (gamma(1, -3), "kernel.Rate"),
    ],
)
def test_improper_gamma_refuses_moments(kernel: r.GammaKernel, field: str) -> None:
    refusal(r.gamma_proper_moments(kernel), "ImproperGamma", field)


def test_exact_shape_and_tiny_positive_moments_do_not_emulate_binary64() -> None:
    shape = F(1, 10**1000)
    encoded = ok(r.gamma_from_shape(shape, 2))
    assert encoded == r.ShapeEncoding(shape, shape, gamma(shape - 1, 2))
    moments = ok(r.gamma_proper_moments(encoded.Kernel))
    assert moments.Mean == shape / 2 > 0
    assert moments.Variance == shape / 4 > 0
    # Native may refuse at its declared representation/range boundary.
    tiny = F(1, 2**2000)
    assert (
        ok(r.soft_dot_vmp(real(0, tiny), real(1, 0), real(0, 0), 1)).ToTau.Rate
        == tiny / 2
    )


def test_exp_log_orientation_from_delta_jacobian() -> None:
    exp_value = ok(r.reverse_log_kernel("ExpConstraint", gamma(0, 1), 1))
    log_value = ok(r.reverse_log_kernel("LogConstraint", gamma(0, 1), 1))
    with localcontext(Context(prec=100)):
        e = Decimal(1).exp()
        assert abs(exp_value + e) < Decimal("1e-78")
        assert abs(log_value - (1 - e)) < Decimal("1e-78")
        assert log_value - exp_value == 1
        # A normalized log-Gamma transform in both directions is the wrong factor.
        assert abs(exp_value - (1 - e)) > Decimal("0.99")


def test_signed_and_neutral_reverse_kernels() -> None:
    value = ok(r.reverse_log_kernel("ExpConstraint", gamma(-2, -1), F(1, 2)))
    with localcontext(Context(prec=100)):
        assert abs(value - (Decimal("0.5").exp() - 1)) < Decimal("1e-78")
    assert ok(r.reverse_log_kernel("ExpConstraint", gamma(0, 0), Decimal("1e8"))) == 0
    assert ok(r.reverse_log_kernel("LogConstraint", gamma(0, 0), 3)) == 3


def general() -> dict[str, F | Decimal]:
    return {
        "t": F(3, 2),
        "u": F(-1, 3),
        "k": F(-2, 5),
        "c": F(7, 4),
        "m": F(2, 3),
        "v": F(3, 5),
    }


def stationary() -> dict[str, F | Decimal]:
    with localcontext(Context(prec=80)):
        coefficient = Decimal("-0.25").exp()
    return {"t": F(1), "u": F(0), "k": F(1), "c": coefficient, "m": F(0), "v": F(1, 2)}


def decimal(value: F | Decimal) -> Decimal:
    return (
        Decimal(value.numerator) / Decimal(value.denominator)
        if isinstance(value, F)
        else value
    )


@pytest.mark.parametrize("inputs", [general(), stationary()])
def test_objective_against_independent_decimal100_energy(
    inputs: dict[str, F | Decimal],
) -> None:
    actual = ok(r.projection_objective(**inputs))
    with localcontext(Context(prec=100)):
        t, u, k, c, m, v = (
            decimal(inputs[key]) for key in ("t", "u", "k", "c", "m", "v")
        )
        # Separate entropy and E[z^2] calculation; exp is multiplied directly,
        # not evaluated through the production logarithmic combination.
        expected = (
            t * (m * m + v - 2 * u * m + u * u) / 2
            - k * m
            + c * (m + v / 2).exp()
            - v.ln() / 2
        )
        assert abs(actual.Value - expected) < Decimal("2e-77")


def test_stationary_derivative_fixture() -> None:
    actual = ok(r.projection_objective(**stationary()))
    assert abs(actual.DerivativeMean) < Decimal("1e-77")
    assert abs(actual.DerivativeVariance) < Decimal("1e-77")


@pytest.mark.parametrize("inputs", [general(), stationary()])
@pytest.mark.parametrize(
    "coordinate,attribute", [("m", "DerivativeMean"), ("v", "DerivativeVariance")]
)
def test_derivatives_against_independent_central_differences(
    inputs: dict[str, F | Decimal], coordinate: str, attribute: str
) -> None:
    actual = ok(r.projection_objective(**inputs))
    with localcontext(Context(prec=80)):
        h = Decimal("1e-20")
        center = decimal(inputs[coordinate])
        upper = ok(r.projection_objective(**{**inputs, coordinate: center + h})).Value
        lower = ok(r.projection_objective(**{**inputs, coordinate: center - h})).Value
        difference = (upper - lower) / (2 * h)
        assert abs(difference - getattr(actual, attribute)) < Decimal("1e-37")


def test_decimal_context_is_owned_and_caller_context_unchanged() -> None:
    inputs = general()
    expected = ok(r.projection_objective(**inputs))
    with localcontext(
        Context(prec=6, rounding=ROUND_DOWN, Emax=9, Emin=-9, traps=[Inexact])
    ) as caller:
        before = caller.copy()
        assert ok(r.projection_objective(**inputs)) == expected
        assert caller.prec == before.prec and caller.rounding == before.rounding
        assert caller.flags == before.flags and caller.traps == before.traps


@pytest.mark.parametrize(
    "bad", [True, 1.0, float("nan"), float("inf"), Decimal(1), None, "1"]
)
def test_exact_algebra_refuses_nonrational_values(bad: object) -> None:
    refusal(
        r.soft_dot_vmp(real(2, 3), real(4, 5), real(7, 2), bad),
        "InvalidRational",
        "mean_tau",
    )
    refusal(r.gamma_from_shape(bad, 1), "InvalidRational", "alpha")


@pytest.mark.parametrize("position", ["w", "x", "z"])
def test_real_moments_revalidated_at_every_soft_dot_position(position: str) -> None:
    inputs: dict[str, object] = {
        "w": real(2, 3),
        "x": real(4, 5),
        "z": real(7, 2),
        "mean_tau": 2,
    }
    inputs[position] = real(1, -1)
    refusal(r.soft_dot_vmp(**inputs), "InvalidMoments", position + ".Variance")
    inputs[position] = {"Mean": F(1), "Variance": F(2)}
    refusal(r.soft_dot_vmp(**inputs), "InvalidMoments", position)


@pytest.mark.parametrize("bad", [True, 2.0, float("nan"), None])
def test_malformed_kernel_fields_are_not_trusted(bad: object) -> None:
    broken_gamma = r.GammaKernel(cast(F, bad), F(1))
    refusal(
        r.gamma_product(broken_gamma, gamma(0, 0)), "InvalidRational", "left.LogPower"
    )
    broken_gaussian = r.GaussianKernel(F(1), cast(F, bad))
    refusal(
        r.gaussian_proper_moments(broken_gaussian),
        "InvalidRational",
        "kernel.Precision",
    )
    broken_real = r.RealMoments(cast(F, bad), F(1))
    refusal(
        r.normal_precision_vmp(broken_real, real(0, 1), 1), "InvalidRational", "y.Mean"
    )


@pytest.mark.parametrize("field", ["alpha", "mean_beta", "mean_gamma"])
@pytest.mark.parametrize("bad", [0, -1])
def test_gamma_factor_positive_domains(field: str, bad: int) -> None:
    inputs = {"alpha": 2, "mean_beta": 7, "mean_gamma": 3}
    inputs[field] = bad
    refusal(r.gamma_rate_vmp(**inputs), "InvalidDomain", field)


@pytest.mark.parametrize("field", ["t", "c", "v"])
@pytest.mark.parametrize("bad", [0, -1])
def test_objective_positive_domains(field: str, bad: int) -> None:
    inputs: dict[str, object] = dict(general())
    inputs[field] = bad
    refusal(r.projection_objective(**inputs), "InvalidDomain", field)


@pytest.mark.parametrize(
    "bad",
    [
        Decimal("NaN"),
        Decimal("sNaN"),
        Decimal("Infinity"),
        Decimal("-Infinity"),
        True,
        1.0,
        "1",
    ],
)
def test_decimal_input_admission(bad: object) -> None:
    inputs: dict[str, object] = dict(general())
    inputs["m"] = bad
    refusal(r.projection_objective(**inputs), "InvalidDecimal", "m")
    refusal(
        r.reverse_log_kernel("ExpConstraint", gamma(0, 1), bad), "InvalidDecimal", "z"
    )


@pytest.mark.parametrize("bad", ["Exp", "Log", "", None, 0])
def test_orientation_is_exact(bad: object) -> None:
    refusal(
        r.reverse_log_kernel(bad, gamma(0, 1), 1), "InvalidOrientation", "orientation"
    )


@pytest.mark.parametrize("point", [Decimal("1e10"), Decimal("-1e10")])
def test_decimal_context_overflow_and_underflow_are_typed(point: Decimal) -> None:
    failure = refusal(
        r.reverse_log_kernel("ExpConstraint", gamma(0, 1), point),
        "DecimalFailure",
        "arithmetic",
    )
    assert failure.Message in ("Overflow", "Underflow")


def test_known_record_encoder_and_unsupported_values() -> None:
    assert ok(r.encode_value(gamma(F(-2, 3), 0))) == {
        "LogPower": {"Num": "-2", "Den": "3"},
        "Rate": {"Num": "0", "Den": "1"},
    }
    assert ok(r.encode_value(Decimal("-0"))) == "-0"
    refusal(r.encode_value(Decimal("NaN")), "EncodingFailure")
    refusal(r.encode_value(object()), "EncodingFailure")
    refusal(r.encode_value({1: "x"}), "EncodingFailure")
    refusal(r.encode_value(1.0), "EncodingFailure")


def test_encoder_cycle_refuses_without_recursion_escape() -> None:
    cycle: list[object] = []
    cycle.append(cycle)
    refusal(r.encode_value(cycle), "EncodingFailure", "value")


def test_fixed_vector_roster_schema_and_selected_exact_fields() -> None:
    receipt = ok(r.reference_vectors())
    expected_ids = [
        "soft/uncertain",
        "soft/clamped-zero",
        "soft/fractional",
        "normal/uncertain",
        "normal/zero",
        "gamma/rate",
        "gamma/product",
        "gamma/quotient",
        "gamma/proper",
        "gamma/improper",
        "gaussian/improper-product",
        "gaussian/linear-improper",
        "shape/small",
        "reverse/exp",
        "reverse/log",
        "reverse/signed",
        "objective/stationary",
        "objective/general",
        "invalid/negative-variance",
        "invalid/nonpositive-gamma",
        "invalid/proper-gaussian",
        "invalid/objective-variance",
        "shape/nonpositive",
        "gamma/neutral",
    ]
    parsed: Any = json.loads(json.dumps(receipt, sort_keys=True, allow_nan=False))
    assert set(parsed) == {"Schema", "Arithmetic", "Rows"}
    assert parsed["Schema"] == r.SCHEMA
    assert parsed["Arithmetic"]["Binary64Emulator"] is False
    assert parsed["Arithmetic"]["DecimalPrecision"] == 80
    assert [row["Id"] for row in parsed["Rows"]] == expected_ids
    for row in parsed["Rows"]:
        assert set(row) == {"Id", "Operation", "Input", "Outcome"}
    first = parsed["Rows"][0]["Outcome"]
    assert first["Value"]["ResidualSecondMoment"] == {"Num": "86", "Den": "1"}
    rate = parsed["Rows"][5]["Outcome"]["Value"]
    assert rate["ToValue"] == rate["ValueEncoding"]["Kernel"]
    assert (
        rate["ValueEncoding"]["RequestedShape"]
        == rate["ValueEncoding"]["RepresentedShape"]
    )
    assert sum(row["Outcome"]["Kind"] == "success" for row in parsed["Rows"]) == 17
    assert sum(row["Outcome"]["Kind"] == "refused" for row in parsed["Rows"]) == 7
    assert r.reference_vectors() == r.Success(receipt)


def test_all_vector_rationals_are_canonical_and_no_binary_floats() -> None:
    def check(value: r.Json) -> None:
        assert type(value) is not float
        if type(value) is dict:
            if set(value) == {"Num", "Den"}:
                numerator, denominator = value["Num"], value["Den"]
                assert type(numerator) is str and type(denominator) is str
                fraction = F(int(numerator), int(denominator))
                assert str(fraction.numerator) == numerator
                assert str(fraction.denominator) == denominator
            else:
                for item in value.values():
                    check(item)
        elif type(value) is list:
            for item in value:
                check(item)

    check(ok(r.reference_vectors()))
