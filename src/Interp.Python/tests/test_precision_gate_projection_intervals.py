"""Independent rational enclosure and actual arithmetic-admission witnesses."""

from __future__ import annotations

import itertools
from decimal import ROUND_DOWN, Context, Decimal, localcontext
from fractions import Fraction as F
from typing import Any, cast

import pytest
from zeta_interp import precision_gate_projection_intervals as i


def ok[T](result: i.Result[T]) -> T:
    assert type(result) is i.Success, result
    return result.Value


def refused(result: object, code: str) -> i.Failure:
    assert type(result) is i.Failure, result
    assert result.Code == code
    return result


def arithmetic(precision: int = 80, limit: int = 4096) -> i.Arithmetic:
    return ok(i.make_arithmetic(precision, transcendental_limit=limit))


def interval(lower: str, upper: str) -> i.Interval:
    return i.Interval(Decimal(lower), Decimal(upper))


def contains(value: i.Interval, exact: F) -> bool:
    return F(value.Lower) <= exact <= F(value.Upper)


@pytest.mark.parametrize("operation", ["add", "subtract", "multiply", "divide"])
def test_signed_fraction_containment(operation: str) -> None:
    a = arithmetic()
    operations = {
        "add": a.add,
        "subtract": a.subtract,
        "multiply": a.multiply,
        "divide": a.divide,
    }
    for x, y in itertools.product((F(-7, 3), F(1, 7), F(19, 13)), repeat=2):
        expected = {
            "add": x + y,
            "subtract": x - y,
            "multiply": x * y,
            "divide": x / y,
        }[operation]
        value = ok(operations[operation](ok(a.point(x)), ok(a.point(y))))
        assert contains(value, expected)
        assert value.Lower < value.Upper


@pytest.mark.parametrize(
    "denominator", [interval("-1", "1"), interval("0", "0"), interval("0", "2")]
)
def test_division_interval_must_exclude_zero(denominator: i.Interval) -> None:
    a = arithmetic()
    refused(a.divide(ok(a.point(1)), denominator), "Domain")


def test_product_encloses_all_independent_corner_pairs() -> None:
    result = ok(arithmetic().multiply(interval("-2", "3"), interval("-5", "7")))
    assert result == interval("-15", "21")


@pytest.mark.parametrize(
    "value,expected",
    [
        (interval("-2", "3"), interval("0", "9")),
        (interval("-4", "-2"), interval("4", "16")),
        (interval("2", "4"), interval("4", "16")),
    ],
)
def test_square_is_not_independent_product(
    value: i.Interval, expected: i.Interval
) -> None:
    assert ok(arithmetic().square(value)) == expected


def test_intersection_and_empty_refusal() -> None:
    assert ok(i.intersect(interval("-1", "4"), interval("2", "7"))) == interval(
        "2", "4"
    )
    assert ok(i.intersect(interval("1", "2"), interval("2", "3"))) == interval("2", "2")
    refused(i.intersect(interval("1", "2"), interval("3", "4")), "EmptyIntersection")


def test_width_and_midpoint_ignore_ambient_decimal_rounding() -> None:
    a = arithmetic()
    value = interval("1", "1." + "0" * 79 + "1")
    with localcontext(Context(prec=3, rounding=ROUND_DOWN)):
        assert ok(i.exact_width(value)) == F(1, 10**80)
        third = ok(a.point(F(1, 3)))
        assert contains(third, F(1, 3))
        assert ok(a.midpoint(interval("1", "2"))) == Decimal("1.5")


def test_no_representable_interior_is_typed() -> None:
    context = Context(prec=80)
    value = i.Interval(Decimal(1), context.next_plus(Decimal(1)))
    refused(arithmetic().midpoint(value), "ResolutionLimit")


def exp_half_series_bounds() -> tuple[F, F]:
    # Exact Taylor series; successive tail ratios are at most x/(n+2).
    x = F(1, 2)
    term = F(1)
    total = term
    for n in range(1, 161):
        term *= x / n
        total += term
    next_term = term * x / 161
    return total, total + next_term / (1 - x / 162)


def log_two_series_bounds() -> tuple[F, F]:
    # ln(2)=2*atanh(1/3); remaining term ratios are strictly below z^2.
    z = F(1, 3)
    total = sum((2 * z ** (2 * n + 1) / (2 * n + 1) for n in range(121)), F())
    next_term = 2 * z**243 / 243
    return total, total + next_term / (1 - z * z)


@pytest.mark.parametrize("kind", ["exp", "ln"])
def test_transcendentals_enclose_independent_rational_series(kind: str) -> None:
    a = arithmetic()
    result = (
        ok(a.exp(ok(a.point(F(1, 2))))) if kind == "exp" else ok(a.ln(ok(a.point(2))))
    )
    lower, upper = (
        exp_half_series_bounds() if kind == "exp" else log_two_series_bounds()
    )
    assert F(result.Lower) < lower < upper < F(result.Upper)
    assert a.TranscendentalEntries == 2


@pytest.mark.parametrize("kind", ["exp", "ln"])
def test_unwidened_point_does_not_enclose_finer_result(kind: str) -> None:
    a, b = arithmetic(), arithmetic(320)
    argument = F(1, 2) if kind == "exp" else F(2)
    low = (
        ok(a.exp(ok(a.point(argument))))
        if kind == "exp"
        else ok(a.ln(ok(a.point(argument))))
    )
    high = (
        ok(b.exp(ok(b.point(argument))))
        if kind == "exp"
        else ok(b.ln(ok(b.point(argument))))
    )
    assert low.Lower < high.Lower < high.Upper < low.Upper
    context = Context(prec=80)
    point = context.exp(Decimal("0.5")) if kind == "exp" else context.ln(Decimal(2))
    assert not (point <= high.Lower and high.Upper <= point)


def test_exact_singletons_use_no_transcendental_entries() -> None:
    a = arithmetic(limit=0)
    assert ok(a.exp(ok(a.point(0)))) == interval("1", "1")
    assert ok(a.ln(ok(a.point(1)))) == interval("0", "0")
    assert a.TranscendentalEntries == 0


def test_budget_is_charged_at_actual_entry_and_not_refunded() -> None:
    a = arithmetic(limit=1)
    refused(a.exp(interval("1", "2")), "IterationLimit")
    assert a.TranscendentalEntries == 1
    refused(a.ln(interval("2", "2")), "IterationLimit")
    assert a.TranscendentalEntries == 1


def test_transcendental_range_failure_retains_entered_count() -> None:
    a = arithmetic()
    refused(a.exp(interval("1e308", "1e308")), "NumericalRange")
    assert a.TranscendentalEntries == 1
    refused(a.exp(interval("-1e308", "-1e308")), "NumericalUnderflow")
    assert a.TranscendentalEntries == 2


def test_basic_underflow_is_not_silent_zero() -> None:
    a = arithmetic()
    refused(
        a.multiply(
            interval("1e-999999", "1e-999999"), interval("1e-999999", "1e-999999")
        ),
        "NumericalUnderflow",
    )
    assert ok(
        a.multiply(ok(a.point(0)), interval("1e-999999", "1e-999999"))
    ) == interval("0", "0")
    assert a.TranscendentalEntries == 0


@pytest.mark.parametrize("value", [True, 80.0, 79, 321, "80", None])
def test_context_admission_refuses_unregistered_precision(value: object) -> None:
    refused(i.make_arithmetic(value), "Domain")


@pytest.mark.parametrize("value", [True, 0.25, Decimal("0.5"), "1", None])
def test_rational_admission_excludes_inexact_or_untyped_values(value: object) -> None:
    refused(arithmetic().point(value), "Domain")


@pytest.mark.parametrize(
    "value",
    [
        None,
        (0, 1),
        i.Interval(cast(Any, 0), Decimal(1)),
        interval("2", "1"),
        interval("NaN", "1"),
        interval("1", "Infinity"),
    ],
)
def test_every_interval_operation_revalidates_ordinary_records(value: object) -> None:
    a = arithmetic()
    refused(a.add(value, interval("1", "1")), "Domain")
    refused(a.exp(value), "Domain")
    refused(a.midpoint(value), "Domain")
    refused(i.exact_width(value), "Domain")


def test_invalid_log_domain_has_no_actual_transcendental_entry() -> None:
    a = arithmetic()
    refused(a.ln(interval("-1", "1")), "Domain")
    assert a.TranscendentalEntries == 0


def test_reconstructed_context_and_counter_are_revalidated() -> None:
    a = i.Arithmetic(i.ContextSpec(cast(Any, True)))
    refused(a.point(1), "Domain")
    a = arithmetic()
    a.TranscendentalEntries = cast(Any, True)
    refused(a.exp(interval("1", "1")), "Domain")


def test_unexpected_primitive_failure_stays_a_public_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def broken_context(self: i.Arithmetic, rounding: str) -> Context:
        raise OSError("owned injected primitive failure")

    a = arithmetic()
    monkeypatch.setattr(i.Arithmetic, "_context", broken_context)
    result = refused(a.point(1), "Unexpected")
    assert result.Message == "OSError"
    assert a.TranscendentalEntries == 0
