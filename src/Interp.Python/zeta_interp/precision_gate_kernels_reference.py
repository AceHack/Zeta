"""Independent rational VMP sites and Decimal80 objective, without a solver.

This is a mathematical reference, not a binary64 execution/range emulator.
Ordinary records are revalidated; exact int/Fraction inputs exclude bool/float.
Decimal work uses a fresh fixed context. No native imports, source draws or I/O.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, fields
from decimal import (
    ROUND_HALF_EVEN,
    Context,
    Decimal,
    DecimalException,
    DivisionByZero,
    InvalidOperation,
    Overflow,
    Underflow,
    localcontext,
)
from fractions import Fraction
from typing import cast

type Json = None | bool | int | str | list[Json] | dict[str, Json]

DECIMAL_PRECISION = 80
SCHEMA = "zeta.precision-gate-kernels.reference.v1"


@dataclass(frozen=True, slots=True)
class Failure:
    Code: str
    Field: str
    Message: str


@dataclass(frozen=True, slots=True)
class Success[T]:
    Value: T


type Result[T] = Success[T] | Failure


@dataclass(frozen=True, slots=True)
class RealMoments:
    Mean: Fraction
    Variance: Fraction


@dataclass(frozen=True, slots=True)
class GaussianKernel:
    PrecisionMean: Fraction
    Precision: Fraction


@dataclass(frozen=True, slots=True)
class GammaKernel:
    LogPower: Fraction
    Rate: Fraction


@dataclass(frozen=True, slots=True)
class ShapeEncoding:
    RequestedShape: Fraction
    RepresentedShape: Fraction
    Kernel: GammaKernel


@dataclass(frozen=True, slots=True)
class GammaMoments:
    Shape: Fraction
    Rate: Fraction
    Mean: Fraction
    Variance: Fraction


@dataclass(frozen=True, slots=True)
class SoftDotVmp:
    ResidualSecondMoment: Fraction
    ToZ: GaussianKernel
    ToWeight: GaussianKernel
    ToInput: GaussianKernel
    ToTau: GammaKernel


@dataclass(frozen=True, slots=True)
class NormalPrecisionVmp:
    ToY: GaussianKernel
    ToMean: GaussianKernel
    ToPrecision: GammaKernel


@dataclass(frozen=True, slots=True)
class GammaRateVmp:
    ToValue: GammaKernel
    ToRate: GammaKernel
    ValueEncoding: ShapeEncoding


@dataclass(frozen=True, slots=True)
class ProjectionObjective:
    Value: Decimal
    DerivativeMean: Decimal
    DerivativeVariance: Decimal


class _Refusal(Exception):
    def __init__(self, code: str, field: str, message: str):
        super().__init__(message)
        self.Code = code
        self.Field = field
        self.Message = message


def _capture[T](operation: Callable[[], T]) -> Result[T]:
    try:
        return Success(operation())
    except _Refusal as failure:
        return Failure(failure.Code, failure.Field, failure.Message)
    except DecimalException as failure:
        return Failure("DecimalFailure", "arithmetic", type(failure).__name__)


def _fraction(value: object, field: str) -> Fraction:
    if type(value) is Fraction:
        return value
    if type(value) is int:
        return Fraction(value)
    raise _Refusal("InvalidRational", field, "exact int or Fraction required")


def _positive(value: object, field: str) -> Fraction:
    number = _fraction(value, field)
    if number <= 0:
        raise _Refusal("InvalidDomain", field, "strictly positive value required")
    return number


def _real(value: object, field: str) -> RealMoments:
    if type(value) is not RealMoments:
        raise _Refusal("InvalidMoments", field, "RealMoments record required")
    mean = _fraction(value.Mean, field + ".Mean")
    variance = _fraction(value.Variance, field + ".Variance")
    if variance < 0:
        raise _Refusal(
            "InvalidMoments", field + ".Variance", "variance must be nonnegative"
        )
    return RealMoments(mean, variance)


def _gaussian(value: object, field: str) -> GaussianKernel:
    if type(value) is not GaussianKernel:
        raise _Refusal("InvalidGaussianKernel", field, "GaussianKernel record required")
    return GaussianKernel(
        _fraction(value.PrecisionMean, field + ".PrecisionMean"),
        _fraction(value.Precision, field + ".Precision"),
    )


def _gamma(value: object, field: str) -> GammaKernel:
    if type(value) is not GammaKernel:
        raise _Refusal("InvalidGammaKernel", field, "GammaKernel record required")
    return GammaKernel(
        _fraction(value.LogPower, field + ".LogPower"),
        _fraction(value.Rate, field + ".Rate"),
    )


def _decimal_context() -> Context:
    return Context(
        prec=DECIMAL_PRECISION,
        rounding=ROUND_HALF_EVEN,
        Emin=-999999,
        Emax=999999,
        traps=[InvalidOperation, DivisionByZero, Overflow, Underflow],
    )


def _decimal(value: object, field: str, *, positive: bool = False) -> Decimal:
    if type(value) is Decimal:
        if not value.is_finite():
            raise _Refusal("InvalidDecimal", field, "finite Decimal required")
        number = +value
    elif type(value) is int or type(value) is Fraction:
        rational = _fraction(value, field)
        number = Decimal(rational.numerator) / Decimal(rational.denominator)
    else:
        raise _Refusal(
            "InvalidDecimal", field, "finite Decimal, exact int or Fraction required"
        )
    if positive and number <= 0:
        raise _Refusal("InvalidDomain", field, "strictly positive value required")
    return number


def _soft_dot(w: object, x: object, z: object, mean_tau: object) -> SoftDotVmp:
    weight, feature, target = _real(w, "w"), _real(x, "x"), _real(z, "z")
    t = _positive(mean_tau, "mean_tau")
    mw, vw = weight.Mean, weight.Variance
    mx, vx = feature.Mean, feature.Variance
    mz, vz = target.Mean, target.Variance
    # Expand E[z^2] - 2 E[z]E[w]E[x] + E[w^2]E[x^2].
    # Exact arithmetic makes this independent form cancellation-safe.
    residual = mz * mz + vz - 2 * mz * mw * mx + (mw * mw + vw) * (mx * mx + vx)
    return SoftDotVmp(
        residual,
        GaussianKernel(t * mw * mx, t),
        GaussianKernel(t * mz * mx, t * (mx * mx + vx)),
        GaussianKernel(t * mz * mw, t * (mw * mw + vw)),
        GammaKernel(Fraction(1, 2), residual / 2),
    )


def soft_dot_vmp(
    w: object, x: object, z: object, mean_tau: object
) -> Result[SoftDotVmp]:
    """Independent mean-field scalar Normal(z; w*x, tau^-1) sites."""
    return _capture(lambda: _soft_dot(w, x, z, mean_tau))


def _normal(y: object, mu: object, mean_gamma: object) -> NormalPrecisionVmp:
    observed, center = _real(y, "y"), _real(mu, "mu")
    t = _positive(mean_gamma, "mean_gamma")
    residual = (observed.Mean - center.Mean) ** 2 + observed.Variance + center.Variance
    return NormalPrecisionVmp(
        GaussianKernel(t * center.Mean, t),
        GaussianKernel(t * observed.Mean, t),
        GammaKernel(Fraction(1, 2), residual / 2),
    )


def normal_precision_vmp(
    y: object, mu: object, mean_gamma: object
) -> Result[NormalPrecisionVmp]:
    """Independent-marginal Normal mean/precision sites, without covariance."""
    return _capture(lambda: _normal(y, mu, mean_gamma))


def _shape(alpha: object, rate: object) -> ShapeEncoding:
    shape, beta = _positive(alpha, "alpha"), _positive(rate, "rate")
    kernel = GammaKernel(shape - 1, beta)
    return ShapeEncoding(shape, kernel.LogPower + 1, kernel)


def gamma_from_shape(alpha: object, rate: object) -> Result[ShapeEncoding]:
    """Exact encoding; requested and represented shapes coincide here."""
    return _capture(lambda: _shape(alpha, rate))


def _gamma_rate(alpha: object, mean_beta: object, mean_gamma: object) -> GammaRateVmp:
    shape = _positive(alpha, "alpha")
    beta, gamma = _positive(mean_beta, "mean_beta"), _positive(mean_gamma, "mean_gamma")
    encoding = _shape(shape, beta)
    return GammaRateVmp(encoding.Kernel, GammaKernel(shape, gamma), encoding)


def gamma_rate_vmp(
    alpha: object, mean_beta: object, mean_gamma: object
) -> Result[GammaRateVmp]:
    """The beta-dependent factor has log-power alpha, hence shape alpha+1."""
    return _capture(lambda: _gamma_rate(alpha, mean_beta, mean_gamma))


def _gaussian_combine(left: object, right: object, sign: int) -> GaussianKernel:
    a, b = _gaussian(left, "left"), _gaussian(right, "right")
    return GaussianKernel(
        a.PrecisionMean + sign * b.PrecisionMean, a.Precision + sign * b.Precision
    )


def gaussian_product(left: object, right: object) -> Result[GaussianKernel]:
    return _capture(lambda: _gaussian_combine(left, right, 1))


def gaussian_quotient(left: object, right: object) -> Result[GaussianKernel]:
    return _capture(lambda: _gaussian_combine(left, right, -1))


def _gaussian_moments(value: object) -> RealMoments:
    kernel = _gaussian(value, "kernel")
    if kernel.Precision <= 0:
        raise _Refusal(
            "ImproperGaussian",
            "kernel.Precision",
            "proper density requires positive precision",
        )
    return RealMoments(kernel.PrecisionMean / kernel.Precision, 1 / kernel.Precision)


def gaussian_proper_moments(kernel: object) -> Result[RealMoments]:
    return _capture(lambda: _gaussian_moments(kernel))


def _gamma_combine(left: object, right: object, sign: int) -> GammaKernel:
    a, b = _gamma(left, "left"), _gamma(right, "right")
    return GammaKernel(a.LogPower + sign * b.LogPower, a.Rate + sign * b.Rate)


def gamma_product(left: object, right: object) -> Result[GammaKernel]:
    return _capture(lambda: _gamma_combine(left, right, 1))


def gamma_quotient(left: object, right: object) -> Result[GammaKernel]:
    return _capture(lambda: _gamma_combine(left, right, -1))


def _gamma_moments(value: object) -> GammaMoments:
    kernel = _gamma(value, "kernel")
    shape = kernel.LogPower + 1
    if shape <= 0:
        raise _Refusal(
            "ImproperGamma", "kernel.LogPower", "proper density requires LogPower+1 > 0"
        )
    if kernel.Rate <= 0:
        raise _Refusal(
            "ImproperGamma", "kernel.Rate", "proper density requires positive rate"
        )
    return GammaMoments(
        shape, kernel.Rate, shape / kernel.Rate, shape / (kernel.Rate * kernel.Rate)
    )


def gamma_proper_moments(kernel: object) -> Result[GammaMoments]:
    return _capture(lambda: _gamma_moments(kernel))


def _reverse(orientation: object, value: object, z: object) -> Decimal:
    if type(orientation) is not str or orientation not in (
        "ExpConstraint",
        "LogConstraint",
    ):
        raise _Refusal(
            "InvalidOrientation",
            "orientation",
            "ExpConstraint or LogConstraint required",
        )
    kernel = _gamma(value, "kernel")
    with localcontext(_decimal_context()):
        point = _decimal(z, "z")
        power = kernel.LogPower + (1 if orientation == "LogConstraint" else 0)
        linear = _decimal(power, "kernel.LogPower") * point
        # An exact zero rate makes the exponential term identically zero.
        if kernel.Rate == 0:
            return linear
        return linear - _decimal(kernel.Rate, "kernel.Rate") * point.exp()


def reverse_log_kernel(
    orientation: object, kernel: object, z: object
) -> Result[Decimal]:
    """Unnormalized real log-kernel; no posterior or normalizer is returned."""
    return _capture(lambda: _reverse(orientation, kernel, z))


def _objective(
    t: object, u: object, k: object, c: object, m: object, v: object
) -> ProjectionObjective:
    with localcontext(_decimal_context()):
        precision = _decimal(t, "t", positive=True)
        center, linear = _decimal(u, "u"), _decimal(k, "k")
        coefficient = _decimal(c, "c", positive=True)
        mean = _decimal(m, "m")
        variance = _decimal(v, "v", positive=True)
        weighted_exp = (coefficient.ln() + mean + variance / 2).exp()
        displacement = mean - center
        energy = precision * (displacement * displacement + variance) / 2
        value = energy - linear * mean + weighted_exp - variance.ln() / 2
        derivative_mean = precision * displacement - linear + weighted_exp
        derivative_variance = (precision + weighted_exp - 1 / variance) / 2
        return ProjectionObjective(value, derivative_mean, derivative_variance)


def projection_objective(
    t: object, u: object, k: object, c: object, m: object, v: object
) -> Result[ProjectionObjective]:
    """Reverse-KL objective up to a candidate-independent constant; no optimizer."""
    return _capture(lambda: _objective(t, u, k, c, m, v))


_RECORDS = (
    RealMoments,
    GaussianKernel,
    GammaKernel,
    ShapeEncoding,
    GammaMoments,
    SoftDotVmp,
    NormalPrecisionVmp,
    GammaRateVmp,
    ProjectionObjective,
    Failure,
)

type _WireRecord = (
    RealMoments
    | GaussianKernel
    | GammaKernel
    | ShapeEncoding
    | GammaMoments
    | SoftDotVmp
    | NormalPrecisionVmp
    | GammaRateVmp
    | ProjectionObjective
    | Failure
)


def _wire(value: object, depth: int = 0) -> Json:
    if depth > 32:
        raise _Refusal(
            "EncodingFailure", "value", "reference encoding depth limit exceeded"
        )
    if type(value) is Fraction:
        try:
            return {"Num": str(value.numerator), "Den": str(value.denominator)}
        except ValueError as failure:
            raise _Refusal(
                "EncodingFailure", "rational", "integer string limit exceeded"
            ) from failure
    if type(value) is Decimal:
        if not value.is_finite():
            raise _Refusal("EncodingFailure", "decimal", "nonfinite output refused")
        return str(value)
    if type(value) in _RECORDS:
        record = cast(_WireRecord, value)
        return {
            field.name: _wire(getattr(record, field.name), depth + 1)
            for field in fields(record)
        }
    if value is None or type(value) is str or type(value) is bool or type(value) is int:
        return value
    if type(value) is dict:
        if any(type(key) is not str for key in value):
            raise _Refusal("EncodingFailure", "object", "string keys required")
        return {key: _wire(item, depth + 1) for key, item in value.items()}
    if type(value) is list or type(value) is tuple:
        return [_wire(item, depth + 1) for item in value]
    raise _Refusal("EncodingFailure", "value", "unsupported reference value")


def encode_value(value: object) -> Result[Json]:
    """Encode only finite known reference records/scalars; never instantiate types."""
    return _capture(lambda: _wire(value))


def _row(
    identifier: str, operation: str, inputs: dict[str, object], result: Result[object]
) -> Json:
    outcome: dict[str, Json]
    if isinstance(result, Failure):
        outcome = {"Kind": "refused", "Failure": _wire(result)}
    else:
        outcome = {"Kind": "success", "Value": _wire(result.Value)}
    return {
        "Id": identifier,
        "Operation": operation,
        "Input": _wire(inputs),
        "Outcome": outcome,
    }


def _reference_vectors() -> dict[str, Json]:
    f = Fraction
    w, x, z = RealMoments(f(2), f(3)), RealMoments(f(4), f(5)), RealMoments(f(7), f(2))
    with localcontext(_decimal_context()):
        stationary_c = (Decimal(-1) / 4).exp()
    general = {
        "t": f(3, 2),
        "u": f(-1, 3),
        "k": f(-2, 5),
        "c": f(7, 4),
        "m": f(2, 3),
        "v": f(3, 5),
    }
    rows: list[Json] = []

    def add(
        identifier: str,
        operation: str,
        inputs: dict[str, object],
        call: Callable[..., Result[object]],
    ) -> None:
        rows.append(_row(identifier, operation, inputs, call(**inputs)))

    add(
        "soft/uncertain",
        "soft_dot_vmp",
        {"w": w, "x": x, "z": z, "mean_tau": f(2)},
        soft_dot_vmp,
    )
    add(
        "soft/clamped-zero",
        "soft_dot_vmp",
        {
            "w": RealMoments(f(2), f(0)),
            "x": RealMoments(f(0), f(0)),
            "z": RealMoments(f(0), f(0)),
            "mean_tau": f(2),
        },
        soft_dot_vmp,
    )
    add(
        "soft/fractional",
        "soft_dot_vmp",
        {
            "w": RealMoments(f(-1, 2), f(1, 3)),
            "x": RealMoments(f(3, 2), f(2, 5)),
            "z": RealMoments(f(1, 4), f(3, 7)),
            "mean_tau": f(5, 2),
        },
        soft_dot_vmp,
    )
    add(
        "normal/uncertain",
        "normal_precision_vmp",
        {
            "y": RealMoments(f(3), f(2)),
            "mu": RealMoments(f(-1), f(5)),
            "mean_gamma": f(3, 2),
        },
        normal_precision_vmp,
    )
    add(
        "normal/zero",
        "normal_precision_vmp",
        {
            "y": RealMoments(f(2), f(0)),
            "mu": RealMoments(f(2), f(0)),
            "mean_gamma": f(3),
        },
        normal_precision_vmp,
    )
    add(
        "gamma/rate",
        "gamma_rate_vmp",
        {"alpha": f(2), "mean_beta": f(7), "mean_gamma": f(3)},
        gamma_rate_vmp,
    )
    add(
        "gamma/product",
        "gamma_product",
        {"left": GammaKernel(f(4), f(7)), "right": GammaKernel(f(2), f(3))},
        gamma_product,
    )
    add(
        "gamma/quotient",
        "gamma_quotient",
        {"left": GammaKernel(f(6), f(10)), "right": GammaKernel(f(4), f(7))},
        gamma_quotient,
    )
    add(
        "gamma/proper",
        "gamma_proper_moments",
        {"kernel": GammaKernel(f(6), f(10))},
        gamma_proper_moments,
    )
    add(
        "gamma/improper",
        "gamma_proper_moments",
        {"kernel": GammaKernel(f(1, 2), f(0))},
        gamma_proper_moments,
    )
    add(
        "gaussian/improper-product",
        "gaussian_product",
        {"left": GaussianKernel(f(2), f(-3)), "right": GaussianKernel(f(1), f(5))},
        gaussian_product,
    )
    add(
        "gaussian/linear-improper",
        "gaussian_proper_moments",
        {"kernel": GaussianKernel(f(1), f(0))},
        gaussian_proper_moments,
    )
    add(
        "shape/small",
        "gamma_from_shape",
        {"alpha": f(1, 10**16), "rate": f(1)},
        gamma_from_shape,
    )
    for identifier, orientation in (
        ("reverse/exp", "ExpConstraint"),
        ("reverse/log", "LogConstraint"),
    ):
        add(
            identifier,
            "reverse_log_kernel",
            {"orientation": orientation, "kernel": GammaKernel(f(0), f(1)), "z": f(1)},
            reverse_log_kernel,
        )
    add(
        "reverse/signed",
        "reverse_log_kernel",
        {
            "orientation": "ExpConstraint",
            "kernel": GammaKernel(f(-2), f(-1)),
            "z": f(1, 2),
        },
        reverse_log_kernel,
    )
    add(
        "objective/stationary",
        "projection_objective",
        {"t": f(1), "u": f(0), "k": f(1), "c": stationary_c, "m": f(0), "v": f(1, 2)},
        projection_objective,
    )
    add(
        "objective/general", "projection_objective", dict(general), projection_objective
    )
    add(
        "invalid/negative-variance",
        "soft_dot_vmp",
        {"w": RealMoments(f(2), f(-1)), "x": x, "z": z, "mean_tau": f(2)},
        soft_dot_vmp,
    )
    add(
        "invalid/nonpositive-gamma",
        "gamma_rate_vmp",
        {"alpha": f(2), "mean_beta": f(0), "mean_gamma": f(3)},
        gamma_rate_vmp,
    )
    add(
        "invalid/proper-gaussian",
        "gaussian_proper_moments",
        {"kernel": GaussianKernel(f(2), f(-1))},
        gaussian_proper_moments,
    )
    add(
        "invalid/objective-variance",
        "projection_objective",
        {**general, "v": f(0)},
        projection_objective,
    )
    add(
        "shape/nonpositive",
        "gamma_from_shape",
        {"alpha": f(0), "rate": f(1)},
        gamma_from_shape,
    )
    add(
        "gamma/neutral",
        "gamma_product",
        {"left": GammaKernel(f(0), f(0)), "right": GammaKernel(f(1), f(2))},
        gamma_product,
    )
    return {
        "Schema": SCHEMA,
        "Arithmetic": {
            "Algebraic": "exact Fraction",
            "Transcendental": "Decimal",
            "DecimalPrecision": DECIMAL_PRECISION,
            "Rounding": ROUND_HALF_EVEN,
            "Binary64Emulator": False,
        },
        "Rows": rows,
    }


def reference_vectors() -> Result[dict[str, Json]]:
    """Execute the fixed, predeclared 24-row exact reference roster."""
    return _capture(_reference_vectors)
