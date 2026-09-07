"""Replay every invocation in one caller-admitted cyclic choice buffer.

This is a pure binary-record slice, not source, runtime, schedule or timing
admission. The caller must independently reconstruct and admit the tuple roster,
pass count and source/runtime identities. Local memoization only avoids repeated
software evaluation; every retained record is still decoded and compared.
No file, native process, source generator or measured strategy executes here.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_certificate as c
from . import hidden_switch_compiled_ieee as s
from . import hidden_switch_compiled_reference as r

MAX_TUPLES = 1024
MAX_CALLS = 65_536
_RECORD = struct.Struct("<BBH6I")


@dataclass(frozen=True, slots=True)
class ChoiceInput:
    BeliefBits: str
    Effect: bool
    Depth: int


@dataclass(frozen=True, slots=True)
class BufferReplayCounts:
    SourceManifestSha256: str
    NumericCertificateSha256: str
    NativeRuntimeSha256: str
    Strategy: str
    TuplePositions: int
    Passes: int
    Calls: int
    Bytes: int
    DistinctTuples: int
    PathCounts: tuple[int, ...]
    WorkTotals: tuple[int, ...]
    Scope: str = "one-cyclic-choice-buffer-only"
    RuntimeAndOuterAdmission: str = "not-performed-by-pure-replay"


@dataclass(frozen=True, slots=True)
class BufferReplayFailure(s.Failure):
    Path: str
    CompletedCalls: int
    CompletedBytes: int


class _Mismatch(s._Refusal):
    def __init__(self, code: str, message: str, path: str):
        super().__init__(code, message)
        self.path = path


def _need[T](result: s.Result[T], path: str) -> T:
    if isinstance(result, s.Failure):
        raise _Mismatch(result.Code, result.Message, path)
    return result.value


def _hash(value: object, path: str) -> str:
    checked = a.sha256(value, path)
    if isinstance(checked, a.Refused):
        raise _Mismatch(checked.code, checked.detail, checked.path)
    return checked.value


def replay_choice_buffer(
    raw: object,
    cycle: object,
    passes: object,
    certificate: object,
    strategy: object,
    *,
    source_manifest_sha256: object,
    native_runtime_sha256: object,
) -> s.Result[BufferReplayCounts]:
    """Check complete ordered records, including every duplicate/repeated call.

    Both strategies require the independently issued certificate. The finite limits
    cover every registered per-row buffer; exceeding them refuses, never truncates.
    The source/runtime hashes are caller-admitted context, not verified by this API.
    Unsupported-runtime conformance is deliberately outside measured buffer replay.
    """
    completed = 0
    try:
        source = _hash(source_manifest_sha256, "SourceManifestSha256")
        runtime = _hash(native_runtime_sha256, "NativeRuntimeSha256")
        cert = c._admitted(certificate)
        if type(strategy) is not str or strategy not in r.STRATEGIES:
            raise _Mismatch(
                "Strategy", "requires one of the two measured strategies", "Strategy"
            )
        if type(cycle) is not tuple or not 1 <= len(cycle) <= MAX_TUPLES:
            raise _Mismatch(
                "TupleRoster",
                "requires a nonempty tuple of at most 1024 inputs",
                "Cycle",
            )
        if type(passes) is not int or not 1 <= passes <= MAX_CALLS:
            raise _Mismatch(
                "PassCount", "requires a positive bounded integer pass count", "Passes"
            )
        calls = len(cycle) * passes
        if calls > MAX_CALLS:
            raise _Mismatch("CallCount", "per-buffer calls exceed 65536", "Passes")
        if type(raw) is not bytes or len(raw) != calls * _RECORD.size:
            raise _Mismatch(
                "BufferLength",
                "requires all and only the declared 28-byte records",
                "Choices",
            )

        # The cache is local to this replay and includes every admitted identity,
        # strategy/mode and numerical argument. Duplicate positions stay in order.
        cache: dict[tuple[str, str, str, str, int, bool, int], tuple[int, ...]] = {}
        expected_cycle: list[tuple[int, ...]] = []
        for index, item in enumerate(cycle):
            path = f"Cycle[{index}]"
            if type(item) is not ChoiceInput:
                raise _Mismatch("TupleType", "requires an immutable ChoiceInput", path)
            bits = a.belief_bits(item.BeliefBits, path + ".BeliefBits")
            if isinstance(bits, a.Refused):
                raise _Mismatch(bits.code, bits.detail, bits.path)
            if (
                type(item.Effect) is not bool
                or type(item.Depth) is not int
                or not 1 <= item.Depth <= 3
            ):
                raise _Mismatch(
                    "TupleDomain",
                    "requires boolean effect and integer depth 1..3",
                    path,
                )
            key = (
                source,
                cert.NumericSha256,
                runtime,
                strategy,
                bits.value,
                item.Effect,
                item.Depth,
            )
            if key not in cache:
                result = (
                    r.native_choice(bits.value, item.Effect, item.Depth)
                    if strategy == "native-recursive"
                    else r.compiled_choice(cert, bits.value, item.Effect, item.Depth)
                )
                encoded = _need(r.encode_choice(_need(result, path)), path)
                cache[key] = _RECORD.unpack(encoded)
            expected_cycle.append(cache[key])

        paths = [0] * 5
        work = [0] * 6
        for index, actual in enumerate(_RECORD.iter_unpack(raw)):
            if actual != expected_cycle[index % len(cycle)]:
                raise _Mismatch(
                    "ChoiceMismatch",
                    "action, path, reserved bytes or executed work differs",
                    f"Choices[{index}]",
                )
            paths[actual[1]] += 1
            for field, count in enumerate(actual[3:]):
                work[field] += count
            completed += 1
        return s.Success(
            BufferReplayCounts(
                source,
                cert.NumericSha256,
                runtime,
                strategy,
                len(cycle),
                passes,
                completed,
                len(raw),
                len(cache),
                tuple(paths),
                tuple(work),
            )
        )
    except s._Refusal as failure:
        return BufferReplayFailure(
            failure.code,
            failure.message,
            failure.path if isinstance(failure, _Mismatch) else "Certificate",
            completed,
            completed * _RECORD.size,
        )
