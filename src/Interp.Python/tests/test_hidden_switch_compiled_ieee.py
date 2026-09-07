"""Hand arithmetic witnesses; no policy/source streams or timing runs."""

import math
import struct
from fractions import Fraction as F

import pytest
from zeta_interp import hidden_switch_compiled_ieee as s


def value[T](result: s.Result[T]) -> T:
    assert isinstance(result, s.Success), result
    return result.value


def bits(number: float) -> int:
    return int.from_bytes(struct.pack(">d", number), "big")


def host(pattern: int) -> float:
    return struct.unpack(">d", pattern.to_bytes(8, "big"))[0]


@pytest.mark.parametrize(
    ("rational", "expected"),
    [
        (F(0), 0),
        (F(1), s.ONE),
        (F(-1), s.SIGN | s.ONE),
        (F(1) + F(1, 1 << 53), s.ONE),
        (F(1) + F(3, 1 << 53), s.ONE + 2),
        (F(1, 1 << 1075), 0),
        (F(-1, 1 << 1075), s.SIGN),
        (F(3, 1 << 1075), 2),
        (F((1 << 53) - 1, 1 << 1075), 1 << 52),
        (F(1, 3), 0x3FD5555555555555),
    ],
)
def test_integer_rounding_at_ties_and_normal_boundary(rational: F, expected: int):
    assert value(s.round_fraction(rational)) == expected


def test_rounding_overflow_refuses_without_an_infinite_success():
    assert s.round_fraction(F(1 << 1024)).Code == "NonFiniteResult"  # type: ignore[union-attr]
    assert isinstance(s.mul(s.MAX_FINITE, bits(2.0)), s.Failure)


@pytest.mark.parametrize(
    ("operation", "left", "right", "expected"),
    [
        (s.add, s.SIGN, s.SIGN, s.SIGN),
        (s.add, s.SIGN, 0, 0),
        (s.add, 0, s.SIGN, 0),
        (s.sub, s.SIGN, 0, s.SIGN),
        (s.sub, s.SIGN, s.SIGN, 0),
        (s.sub, s.ONE, s.ONE, 0),
        (s.mul, s.SIGN, s.ONE, s.SIGN),
        (s.mul, s.SIGN, s.SIGN | s.ONE, 0),
        (s.div, s.SIGN, s.ONE, s.SIGN),
        (s.div, 0, s.SIGN | s.ONE, s.SIGN),
        (s.div, 1, bits(2.0), 0),
        (s.div, s.SIGN | 1, bits(2.0), s.SIGN),
        (s.div, 3, bits(2.0), 2),
        (s.add, (1 << 52) - 1, 1, 1 << 52),
    ],
)
def test_executed_signed_zero_subnormal_arithmetic(operation, left, right, expected):
    assert value(operation(left, right)) == expected


def test_wire_and_finite_refusals():
    for malformed in (None, True, -1, 1 << 64, 1.0, "3ff0000000000000"):
        assert isinstance(s.format_bits(malformed), s.Failure)
    for malformed in (None, True, "0", "3ff0000000000000", "3FF0000000000000 "):
        assert isinstance(s.parse_bits(malformed), s.Failure)
    for pattern in (0x7FF0000000000000, 0x7FF8000000000001, 0xFFF0000000000000):
        assert isinstance(s.add(pattern, 0), s.Failure)
        assert isinstance(s.parse_bits(f"{pattern:016X}"), s.Failure)
    assert isinstance(s.div(s.ONE, s.SIGN), s.Failure)
    assert isinstance(s.round_fraction(0), s.Failure)
    assert isinstance(s.round_fraction(F(1), negative_zero=True), s.Failure)
    assert value(s.parse_bits("8000000000000000")) == s.SIGN
    assert value(s.format_bits(s.SIGN)) == "8000000000000000"
    assert value(s.round_fraction(F(0), negative_zero=True)) == s.SIGN


def test_numeric_zero_equality_keeps_distinct_wire_and_neighbors():
    assert value(s.compare(0, s.SIGN)) == 0
    for zero in (0, s.SIGN):
        assert value(s.next_up(zero)) == 1
        assert value(s.next_down(zero)) == s.SIGN | 1
        assert value(s.admit_belief(zero)) == zero
    assert value(s.next_up(s.SIGN | 1)) == s.SIGN
    assert value(s.next_down(1)) == 0
    assert isinstance(s.next_up(s.MAX_FINITE), s.Failure)
    assert isinstance(s.next_down(s.SIGN | s.MAX_FINITE), s.Failure)
    assert isinstance(s.admit_belief(s.SIGN | 1), s.Failure)
    assert isinstance(s.admit_belief(s.ONE + 1), s.Failure)


def test_finite_host_agreement_is_a_secondary_hand_cross_check():
    # The implementation cannot import struct/float; host arithmetic here is only
    # a second check of these explicitly bounded hand operands, not the oracle.
    patterns = [0, s.SIGN, 1, s.SIGN | 1, (1 << 52) - 1, 1 << 52]
    patterns += [bits(x) for x in (0.125, 0.25, 0.5, 0.75, 1.0, -0.25, -1.0)]
    patterns += [s.ONE - 1, s.ONE + 1, bits(1e-200), bits(1e200)]
    for left in patterns:
        for right in patterns:
            a, b = host(left), host(right)
            operations = [(s.add, a + b), (s.sub, a - b), (s.mul, a * b)]
            if b:
                operations.append((s.div, a / b))
            for operation, expected in operations:
                result = operation(left, right)
                if math.isfinite(expected):
                    assert value(result) == bits(expected), (operation, left, right)
                else:
                    assert isinstance(result, s.Failure)
