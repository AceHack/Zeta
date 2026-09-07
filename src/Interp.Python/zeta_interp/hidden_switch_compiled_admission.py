"""Pure evidence admission for the registered guarded-controller study.

These functions validate bytes and ledgers, never execute a policy or open a
file. An admitted primitive is not an admitted whole experiment: phase replay
must additionally check the complete roster, identities and numerical model.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import struct
import zlib
from dataclasses import dataclass
from datetime import date
from typing import Any, cast

TASK = "081M1XXWTTF087G0R000X1HMD0"
PROTOCOL_SHA256 = "8BBDFE44A0844DD8CE4F6C5DD77B060A56E5B84EA94EA7A6FDBB482AEC9D738A"
INT64_MAX = (1 << 63) - 1
UINT32_MAX = (1 << 32) - 1
CHOICE_BYTES = 28
WORK_FIELDS = (
    "GuardComparisons",
    "RecursiveCalls",
    "Nodes",
    "ActionValues",
    "Predictions",
    "Updates",
)
CHOICE_FIELDS = frozenset(("Action", "Path", *WORK_FIELDS))
ARTIFACT_FIELDS = frozenset(
    ("File", "Bytes", "Sha256", "Encoding", "StoredBytes", "StoredSha256")
)
TIMING_FIELDS = frozenset(
    ("WallNs", "CpuNs", "AllocatedBytes", "GcBefore", "GcAfter", "GcDelta")
)
_HASH = re.compile(r"[0-9A-F]{64}\Z")
_BITS = re.compile(r"[0-9A-F]{16}\Z")
_UTC = re.compile(
    r"(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})"
    r"(?:\.(\d{1,9}))?(?:Z|\+00:00)\Z",
    re.ASCII,
)


@dataclass(frozen=True)
class Admitted[T]:
    value: T


@dataclass(frozen=True)
class Refused:
    code: str
    path: str
    detail: str


type Admission[T] = Admitted[T] | Refused


@dataclass(frozen=True)
class _Pairs:
    pairs: list[tuple[str, Any]]


@dataclass(frozen=True)
class _Nonfinite:
    spelling: str


def _materialize(node: Any, path: str, depth: int) -> Admission[Any]:
    if depth > 128:
        return Refused("json-depth", path, "JSON exceeds the admitted nesting depth")
    if isinstance(node, _Nonfinite) or (
        type(node) is float and not math.isfinite(node)
    ):
        return Refused("json-nonfinite", path, "JSON numbers must be finite")
    if isinstance(node, _Pairs):
        result: dict[str, Any] = {}
        for key, value in node.pairs:
            if key in result:
                return Refused("json-duplicate", path, f"duplicate field {key!r}")
            checked_key = _materialize(key, path, depth + 1)
            if isinstance(checked_key, Refused):
                return checked_key
            checked = _materialize(value, f"{path}.{key}", depth + 1)
            if isinstance(checked, Refused):
                return checked
            result[key] = checked.value
        return Admitted(result)
    if isinstance(node, list):
        items = []
        for index, value in enumerate(node):
            checked = _materialize(value, f"{path}[{index}]", depth + 1)
            if isinstance(checked, Refused):
                return checked
            items.append(checked.value)
        return Admitted(items)
    if type(node) is str:
        try:
            node.encode("utf-8", errors="strict")
        except UnicodeEncodeError:
            return Refused("json-unicode", path, "unpaired surrogate in JSON string")
    return Admitted(node)


def strict_json(
    raw: bytes, *, maximum_bytes: int = 256 * 1024 * 1024
) -> Admission[Any]:
    """Retain duplicate keys until checked; JSON parser failures become values."""
    if type(raw) is not bytes or type(maximum_bytes) is not int or maximum_bytes < 1:
        return Refused("json-input", "$", "requires bytes and a positive integer bound")
    if len(raw) > maximum_bytes:
        return Refused("json-size", "$", "JSON exceeds the declared byte bound")
    try:
        text = raw.decode("utf-8", errors="strict")
        parsed = json.loads(text, object_pairs_hook=_Pairs, parse_constant=_Nonfinite)
    except (UnicodeDecodeError, ValueError, RecursionError) as error:
        return Refused("json-parse", "$", str(error))
    return _materialize(parsed, "$", 0)


def exact_keys(
    value: Any, keys: frozenset[str], path: str
) -> Admission[dict[str, Any]]:
    if type(value) is not dict or value.keys() != keys:
        return Refused("fields", path, "requires exactly the declared object fields")
    return Admitted(cast(dict[str, Any], value))


def integer(value: Any, lower: int, upper: int, path: str) -> Admission[int]:
    if type(value) is not int or not lower <= value <= upper:
        return Refused(
            "integer",
            path,
            f"requires an integer in [{lower},{upper}], excluding booleans",
        )
    return Admitted(value)


def sha256(value: Any, path: str) -> Admission[str]:
    if type(value) is not str or _HASH.fullmatch(value) is None:
        return Refused("sha256", path, "requires 64 uppercase hexadecimal characters")
    return Admitted(value)


def belief_bits(value: Any, path: str) -> Admission[int]:
    if type(value) is not str or _BITS.fullmatch(value) is None:
        return Refused(
            "belief-bits", path, "requires 16 uppercase hexadecimal characters"
        )
    bits = int(value, 16)
    # Positive finite IEEE encodings are ordered as integers. Preserve -0 exactly.
    if bits != 0x8000000000000000 and not 0 <= bits <= 0x3FF0000000000000:
        return Refused(
            "belief-domain",
            path,
            "requires finite binary64 in [0,1], including both zeros",
        )
    return Admitted(bits)


def utc_nanoseconds(value: Any, path: str) -> Admission[int]:
    """UTC ordering without discarding native 100 ns digits or using host floats."""
    match = _UTC.fullmatch(value) if type(value) is str else None
    if match is None:
        return Refused(
            "utc",
            path,
            "requires an explicit UTC timestamp with at most nine fraction digits",
        )
    year, month, day, hour, minute, second = (int(part) for part in match.groups()[:6])
    try:
        ordinal = date(year, month, day).toordinal()
    except ValueError:
        return Refused("utc", path, "invalid calendar date")
    if hour > 23 or minute > 59 or second > 59:
        return Refused("utc", path, "invalid clock time")
    fraction = int((match.group(7) or "").ljust(9, "0"))
    return Admitted(
        ((ordinal * 24 + hour) * 3600 + minute * 60 + second) * 10**9 + fraction
    )


def interval(start: Any, finish: Any, path: str) -> Admission[tuple[int, int]]:
    first = utc_nanoseconds(start, path + ".StartedAtUtc")
    if isinstance(first, Refused):
        return first
    last = utc_nanoseconds(finish, path + ".FinishedAtUtc")
    if isinstance(last, Refused):
        return last
    if last.value < first.value:
        return Refused("chronology", path, "finish precedes start")
    return Admitted((first.value, last.value))


def relative_artifact_path(value: Any, path: str) -> Admission[str]:
    if (
        type(value) is not str
        or not value
        or re.fullmatch(r"[A-Za-z0-9._/-]+", value, re.ASCII) is None
        or any(part in ("", ".", "..") for part in value.split("/"))
    ):
        return Refused(
            "artifact-path", path, "requires a canonical relative ASCII POSIX path"
        )
    return Admitted(value)


def artifact_descriptor(value: Any, path: str) -> Admission[dict[str, Any]]:
    checked = exact_keys(value, ARTIFACT_FIELDS, path)
    if isinstance(checked, Refused):
        return checked
    row = checked.value
    for result in (
        relative_artifact_path(row["File"], path + ".File"),
        integer(row["Bytes"], 0, INT64_MAX, path + ".Bytes"),
        integer(row["StoredBytes"], 0, INT64_MAX, path + ".StoredBytes"),
        sha256(row["Sha256"], path + ".Sha256"),
        sha256(row["StoredSha256"], path + ".StoredSha256"),
    ):
        if isinstance(result, Refused):
            return result
    if type(row["Encoding"]) is not str or row["Encoding"] not in ("identity", "gzip"):
        return Refused("artifact-encoding", path, "requires identity or gzip storage")
    if row["Encoding"] == "identity" and (
        row["Bytes"] != row["StoredBytes"] or row["Sha256"] != row["StoredSha256"]
    ):
        return Refused(
            "artifact-identity",
            path,
            "identity storage requires identical raw/stored identities",
        )
    if row["Encoding"] == "gzip" and not row["File"].endswith(".gz"):
        return Refused("artifact-encoding", path, "gzip artifact path must end in .gz")
    return checked


def bind_artifact_bytes(
    descriptor: Any, stored: bytes, original: bytes, path: str
) -> Admission[dict[str, Any]]:
    """Bind raw/stored bytes and the exact lossless single-member gzip relation."""
    checked = artifact_descriptor(descriptor, path)
    if isinstance(checked, Refused):
        return checked
    if type(stored) is not bytes or type(original) is not bytes:
        return Refused(
            "artifact-bytes", path, "requires the exact original and stored bytes"
        )
    row = checked.value
    for label, raw, size_key, hash_key in (
        ("stored", stored, "StoredBytes", "StoredSha256"),
        ("original", original, "Bytes", "Sha256"),
    ):
        if (
            len(raw) != row[size_key]
            or hashlib.sha256(raw).hexdigest().upper() != row[hash_key]
        ):
            return Refused(
                "artifact-hash", path, f"{label} bytes differ from descriptor"
            )
    if row["Encoding"] == "identity" and stored != original:
        return Refused("artifact-identity", path, "identity storage bytes differ")
    if row["Encoding"] == "gzip":
        try:
            decoder = zlib.decompressobj(wbits=31)
            decoded = decoder.decompress(stored, len(original) + 1)
        except zlib.error as error:
            return Refused("artifact-gzip", path, str(error))
        if (
            not decoder.eof
            or decoder.unused_data
            or decoder.unconsumed_tail
            or decoded != original
        ):
            return Refused(
                "artifact-gzip",
                path,
                "requires one complete gzip member yielding the exact original bytes",
            )
    return checked


def timing(value: Any, path: str, *, measured: bool) -> Admission[dict[str, Any]]:
    checked = exact_keys(value, TIMING_FIELDS, path)
    if isinstance(checked, Refused):
        return checked
    if type(measured) is not bool:
        return Refused(
            "timing-mode", path, "requires an explicit measured/setup boolean"
        )
    row = checked.value
    for key in ("WallNs", "CpuNs", "AllocatedBytes"):
        lower = 1 if key == "WallNs" and measured else 0
        result = integer(row[key], lower, INT64_MAX, path + "." + key)
        if isinstance(result, Refused):
            return result
    for key in ("GcBefore", "GcAfter", "GcDelta"):
        if type(row[key]) is not list or len(row[key]) != 3:
            return Refused(
                "gc-roster", path + "." + key, "requires generations 0,1,2 in order"
            )
        for index, count in enumerate(row[key]):
            result = integer(count, 0, INT64_MAX, f"{path}.{key}[{index}]")
            if isinstance(result, Refused):
                return result
    for generation in range(3):
        actual = row["GcAfter"][generation] - row["GcBefore"][generation]
        if actual < 0 or actual != row["GcDelta"][generation]:
            return Refused(
                "gc-delta", path, "GC deltas must equal nonnegative after-minus-before"
            )
    return checked


def choice_record(value: Any, path: str) -> Admission[dict[str, int]]:
    checked = exact_keys(value, CHOICE_FIELDS, path)
    if isinstance(checked, Refused):
        return checked
    row = checked.value
    for key, maximum in (
        ("Action", 1),
        ("Path", 4),
        *((key, UINT32_MAX) for key in WORK_FIELDS),
    ):
        result = integer(row[key], 0, maximum, path + "." + key)
        if isinstance(result, Refused):
            return result
    return Admitted(cast(dict[str, int], row))


def decode_choice(raw: bytes, path: str) -> Admission[dict[str, int]]:
    if type(raw) is not bytes or len(raw) != CHOICE_BYTES:
        return Refused("choice-bytes", path, "requires exactly 28 bytes")
    action, selected_path, reserved, *counts = struct.unpack("<BBH6I", raw)
    if reserved != 0:
        return Refused("choice-reserved", path, "both reserved bytes must be zero")
    return choice_record(
        {
            "Action": action,
            "Path": selected_path,
            **dict(zip(WORK_FIELDS, counts, strict=True)),
        },
        path,
    )


def median_five(values: Any, path: str) -> Admission[int]:
    if type(values) is not list or len(values) != 5:
        return Refused("median-roster", path, "requires all five declared replicates")
    for index, value in enumerate(values):
        result = integer(value, 0, INT64_MAX, f"{path}[{index}]")
        if isinstance(result, Refused):
            return result
    return Admitted(sorted(values)[2])


def half_median(
    compiled: Any, native: Any, path: str
) -> Admission[dict[str, int | bool]]:
    """Exact integer order statistics and unbounded multiplication, without floats."""
    numerator = median_five(compiled, path + ".Compiled")
    if isinstance(numerator, Refused):
        return numerator
    denominator = median_five(native, path + ".Native")
    if isinstance(denominator, Refused):
        return denominator
    if denominator.value == 0:
        return Refused(
            "zero-native-median", path, "required native denominator must be positive"
        )
    return Admitted(
        {
            "Numerator": numerator.value,
            "Denominator": denominator.value,
            "AtMostHalf": 2 * numerator.value <= denominator.value,
        }
    )
