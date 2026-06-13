from typing import Callable, Union, Literal, Tuple

State = Literal["T", "F", "N"]


class Tri:
    __slots__ = ("s",)

    def __init__(self, s: State):
        self.s = s

    def __eq__(self, other):
        if not isinstance(other, Tri):
            return False
        return self.s == other.s

    def __hash__(self):
        return hash(self.s)

    def __repr__(self):
        return f"Tri({self.s!r})"

    def is_living(self) -> bool:
        return self.s == "N"

    def is_certain(self) -> bool:
        return self.s != "N"


T = Tri("T")
F = Tri("F")
N = Tri("N")


def from_bool(b: bool) -> Tri:
    return T if b else F


def held() -> Tri:
    return N


def cooperate(t: Tri) -> Tri:
    return t


class MeasureFeedback:
    def __init__(self, reason: str):
        self.reason = reason


class MeasureResult:
    def __init__(
        self,
        ok: bool,
        value: bool = False,
        feedback: Union[MeasureFeedback, None] = None,
    ):
        self.ok = ok
        self.value = value
        self.feedback = feedback


def measure(t: Tri) -> MeasureResult:
    if t.s == "T":
        return MeasureResult(ok=True, value=True)
    elif t.s == "F":
        return MeasureResult(ok=True, value=False)
    else:
        return MeasureResult(
            ok=False, feedback=MeasureFeedback(reason="collapsed-living-uncertainty")
        )


def map_tri(t: Tri, fn: Callable[[bool], bool]) -> Tri:
    if t.s == "T":
        return from_bool(fn(True))
    elif t.s == "F":
        return from_bool(fn(False))
    return N


def bind_tri(t: Tri, fn: Callable[[bool], Tri]) -> Tri:
    if t.s == "T":
        return fn(True)
    elif t.s == "F":
        return fn(False)
    return N


def not_tri(t: Tri) -> Tri:
    if t.s == "T":
        return F
    elif t.s == "F":
        return T
    return N


def and_tri(a: Tri, b: Tri) -> Tri:
    if a.s == "F" or b.s == "F":
        return F
    if a.s == "N" or b.s == "N":
        return N
    return T


def or_tri(a: Tri, b: Tri) -> Tri:
    if a.s == "T" or b.s == "T":
        return T
    if a.s == "N" or b.s == "N":
        return N
    return F


class FloatShape:
    def __init__(self, high_width: int, decoder_width: int, low_width: int):
        self.high_width = high_width
        self.decoder_width = decoder_width
        self.low_width = low_width


DEFAULT_SHAPE = FloatShape(high_width=4, decoder_width=3, low_width=4)


class TriFloat:
    def __init__(
        self,
        shape: FloatShape,
        high: Tuple[Tri, ...],
        decoder: Tuple[Tri, ...],
        low: Tuple[Tri, ...],
    ):
        self.shape = shape
        self.high = high
        self.decoder = decoder
        self.low = low


def int_of(trits: Tuple[Tri, ...]) -> Union[int, None]:
    v = 0
    for t in trits:
        if t.s == "N":
            return None
        v = v * 2 + (1 if t.s == "T" else 0)
    return v


def int_to_trits(v: int, width: int) -> Tuple[Tri, ...]:
    out = []
    for i in range(width - 1, -1, -1):
        out.append(T if ((v >> i) & 1) == 1 else F)
    return tuple(out)


class FloatFeedback:
    def __init__(self, reason: str):
        self.reason = reason


class DecodeResult:
    def __init__(
        self, ok: bool, value: float = 0.0, feedback: Union[FloatFeedback, None] = None
    ):
        self.ok = ok
        self.value = value
        self.feedback = feedback


def decode(f: TriFloat) -> DecodeResult:
    mode = int_of(f.decoder)
    if mode is None:
        return DecodeResult(
            ok=False, feedback=FloatFeedback(reason="interpretation-superposed")
        )
    v = int_of(f.high + f.low)
    if v is None:
        return DecodeResult(ok=False, feedback=FloatFeedback(reason="value-superposed"))
    bias = 2 ** (f.shape.decoder_width - 1)
    exponent = mode - bias
    return DecodeResult(ok=True, value=float(v * (2**exponent)))


def cooperate_float(f: TriFloat) -> TriFloat:
    return f


def is_held(f: TriFloat) -> bool:
    return not decode(f).ok


class EncodeFeedback:
    def __init__(self, reason: str, detail: str):
        self.reason = reason
        self.detail = detail


class EncodeResult:
    def __init__(
        self,
        ok: bool,
        float_val: Union[TriFloat, None] = None,
        feedback: Union[EncodeFeedback, None] = None,
    ):
        self.ok = ok
        self.float = float_val
        self.feedback = feedback


def from_value(value: float, shape: FloatShape = DEFAULT_SHAPE) -> EncodeResult:
    import math

    if not math.isfinite(value) or value < 0:
        return EncodeResult(
            ok=False,
            feedback=EncodeFeedback(
                reason="not-representable", detail="v0 is unsigned + finite"
            ),
        )
    value_bits = shape.high_width + shape.low_width
    max_mode = (1 << shape.decoder_width) - 1
    max_v = 1 << value_bits
    bias = 2 ** (shape.decoder_width - 1)

    for mode in range(max_mode + 1):
        scaled = value / (2 ** (mode - bias))
        if scaled.is_integer() and scaled >= 0 and scaled < max_v:
            bits = int_to_trits(int(scaled), value_bits)
            return EncodeResult(
                ok=True,
                float_val=TriFloat(
                    shape=shape,
                    high=bits[: shape.high_width],
                    decoder=int_to_trits(mode, shape.decoder_width),
                    low=bits[shape.high_width :],
                ),
            )
    return EncodeResult(
        ok=False,
        feedback=EncodeFeedback(
            reason="not-representable",
            detail=f"no (mode,V) with mode<={max_mode} and V<{max_v} represents {value}",
        ),
    )


def from_trits(
    high: Tuple[Tri, ...], decoder: Tuple[Tri, ...], low: Tuple[Tri, ...]
) -> TriFloat:
    shape = FloatShape(
        high_width=len(high), decoder_width=len(decoder), low_width=len(low)
    )
    return TriFloat(shape=shape, high=high, decoder=decoder, low=low)
