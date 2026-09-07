"""Independent finite binary64 arithmetic for the guarded-controller audit.

All arithmetic below rounds integer ratios, never host floating point. The
admitted subset is finite operands and finite results, nearest/even with gradual
underflow. Division by zero and overflow return typed refusals, as do NaN/Inf
operands. Signed zero is retained in bit patterns and arithmetic; Fraction is
only an exact magnitude/value view, never the complete floating-point state.

Public operations return Success.value or Failure.Code/Failure.Message. Wire
parsing/formatting admits exactly sixteen uppercase hexadecimal digits. These
field names form the coordinator boundary; neither failure raises nor an
unvalidated host float enters that boundary. Trusted internal helpers are
private and may raise only the caught _Refusal used by the typed wrapper.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from fractions import Fraction

SIGN = 1 << 63
FRACTION_MASK = (1 << 52) - 1
EXPONENT_MASK = 0x7FF0000000000000
MASK = (1 << 64) - 1
MAX_FINITE = 0x7FEFFFFFFFFFFFFF
ONE = 0x3FF0000000000000
HALF = 0x3FE0000000000000
POSITIVE_ZERO = 0
NEGATIVE_ZERO = SIGN


@dataclass(frozen=True, slots=True)
class Failure:
    """Public refusal, distinct from a successful numerical value."""

    Code: str
    Message: str


@dataclass(frozen=True, slots=True)
class Success[T]:
    value: T


type Result[T] = Success[T] | Failure


class _Refusal(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _capture[T](operation: Callable[[], T]) -> Result[T]:
    try:
        return Success(operation())
    except _Refusal as refusal:
        return Failure(refusal.code, refusal.message)


def _finite(value: object) -> int:
    if type(value) is not int or not 0 <= value <= MASK:
        raise _Refusal(
            "InvalidBits", "binary64 bits must be an unsigned 64-bit integer"
        )
    if value & EXPONENT_MASK == EXPONENT_MASK:
        raise _Refusal("NonFiniteOperand", "NaN and infinity are not admitted")
    return value


def _value(bits: int) -> Fraction:
    exponent = (bits >> 52) & 0x7FF
    significand = bits & FRACTION_MASK
    power = -1074
    if exponent:
        significand |= 1 << 52
        power = exponent - 1023 - 52
    if bits & SIGN:
        significand = -significand
    return (
        Fraction(significand << power)
        if power >= 0
        else Fraction(significand, 1 << -power)
    )


def _round_integer(numerator: int, denominator: int) -> int:
    quotient, remainder = divmod(numerator, denominator)
    twice = remainder << 1
    return quotient + int(
        twice > denominator or (twice == denominator and quotient & 1)
    )


def _round(value: Fraction, negative_zero: bool = False) -> int:
    sign = SIGN if value < 0 or (value == 0 and negative_zero) else 0
    numerator, denominator = abs(value.numerator), value.denominator
    if not numerator:
        return sign
    exponent = numerator.bit_length() - denominator.bit_length()
    if exponent >= 0:
        if numerator < denominator << exponent:
            exponent -= 1
    elif numerator << -exponent < denominator:
        exponent -= 1
    if exponent < -1022:
        # This includes the carry into the smallest normal and signed underflow.
        return sign | _round_integer(numerator << 1074, denominator)
    shift = 52 - exponent
    significand = (
        _round_integer(numerator << shift, denominator)
        if shift >= 0
        else _round_integer(numerator, denominator << -shift)
    )
    if significand == 1 << 53:
        significand >>= 1
        exponent += 1
    if exponent > 1023:
        raise _Refusal(
            "NonFiniteResult", "binary64 overflow is outside the finite audit"
        )
    return sign | ((exponent + 1023) << 52) | (significand - (1 << 52))


def parse_bits(value: object) -> Result[int]:
    """Admit the canonical 16-uppercase-hex finite wire representation."""

    def operation() -> int:
        if (
            type(value) is not str
            or len(value) != 16
            or any(char not in "0123456789ABCDEF" for char in value)
        ):
            raise _Refusal(
                "InvalidBitEncoding", "expected sixteen uppercase hex digits"
            )
        return _finite(int(value, 16))

    return _capture(operation)


def format_bits(value: object) -> Result[str]:
    return _capture(lambda: f"{_finite(value):016X}")


def exact_fraction(value: object) -> Result[Fraction]:
    """Exact real value only; retain the original bits for the zero sign."""
    return _capture(lambda: _value(_finite(value)))


def round_fraction(value: object, *, negative_zero: object = False) -> Result[int]:
    def operation() -> int:
        if type(value) is not Fraction or type(negative_zero) is not bool:
            raise _Refusal("InvalidRational", "expected Fraction and boolean zero sign")
        if value != 0 and negative_zero:
            raise _Refusal("InvalidZeroSign", "explicit zero sign applies only to zero")
        return _round(value, negative_zero)

    return _capture(operation)


def _add(left: int, right: int) -> int:
    value = _value(left) + _value(right)
    # Round-to-nearest exact cancellation produces +0. Only -0 + -0 is -0.
    return _round(value, value == 0 and left == SIGN and right == SIGN)


def _sub(left: int, right: int) -> int:
    return _add(left, right ^ SIGN)


def _mul(left: int, right: int) -> int:
    return _round(_value(left) * _value(right), bool((left ^ right) & SIGN))


def _div(left: int, right: int) -> int:
    denominator = _value(right)
    if denominator == 0:
        raise _Refusal("DivisionByZero", "zero denominator is outside the finite audit")
    return _round(_value(left) / denominator, bool((left ^ right) & SIGN))


def add(left: object, right: object) -> Result[int]:
    return _capture(lambda: _add(_finite(left), _finite(right)))


def sub(left: object, right: object) -> Result[int]:
    return _capture(lambda: _sub(_finite(left), _finite(right)))


def mul(left: object, right: object) -> Result[int]:
    return _capture(lambda: _mul(_finite(left), _finite(right)))


def div(left: object, right: object) -> Result[int]:
    return _capture(lambda: _div(_finite(left), _finite(right)))


def compare(left: object, right: object) -> Result[int]:
    def operation() -> int:
        a, b = _value(_finite(left)), _value(_finite(right))
        return int(a > b) - int(a < b)

    return _capture(operation)


def _neighbor(bits: int, upward: bool) -> int:
    if bits & ~SIGN == 0:
        return 1 if upward else SIGN | 1
    if upward:
        result = bits - 1 if bits & SIGN else bits + 1
    else:
        result = bits + 1 if bits & SIGN else bits - 1
    if result & EXPONENT_MASK == EXPONENT_MASK:
        raise _Refusal(
            "NonFiniteResult", "finite neighbor does not exist in this direction"
        )
    return result


def next_up(value: object) -> Result[int]:
    return _capture(lambda: _neighbor(_finite(value), True))


def next_down(value: object) -> Result[int]:
    return _capture(lambda: _neighbor(_finite(value), False))


def admit_belief(value: object) -> Result[int]:
    def operation() -> int:
        bits = _finite(value)
        if not 0 <= _value(bits) <= 1:
            raise _Refusal("InvalidBelief", "belief must be finite and in [0,1]")
        return bits

    return _capture(operation)
