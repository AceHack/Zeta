"""Evidence-boundary counterexamples; no registered source or policy calls."""

from __future__ import annotations

import copy
import gzip
import hashlib
import struct
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as admission


def admitted(result: admission.Admission[Any]) -> Any:
    assert isinstance(result, admission.Admitted), result
    return result.value


@pytest.mark.parametrize(
    "raw",
    [
        b'{"Complete":true,"Complete":false}',
        b'{"Payload":{"Value":1,"Value":2}}',
        b'{"value":NaN}',
        b'{"value":[Infinity]}',
        b'{"value":-Infinity}',
        b'{"value":1e10000}',
        b'{"value":-1e10000}',
        b'{"value":1,}',
        b'{"value":1} trailing',
        b'"\\ud800"',
        b'{"\\udfff":0}',
        b'"\xff"',
        b"\xef\xbb\xbf{}",
        b"[" * 140 + b"0" + b"]" * 140,
        b"[" * 2000 + b"0" + b"]" * 2000,
    ],
)
def test_json_refuses_ambiguous_nonfinite_and_malformed_bytes(raw: bytes) -> None:
    assert isinstance(admission.strict_json(raw), admission.Refused)


def test_json_preserves_distinct_integer_boolean_and_nested_object_types() -> None:
    value = admitted(admission.strict_json(b'{"i":1,"b":true,"nested":[{},null,1.25]}'))
    assert type(value["i"]) is int
    assert type(value["b"]) is bool
    assert value["nested"] == [{}, None, 1.25]
    assert isinstance(admission.strict_json(b"{}", maximum_bytes=1), admission.Refused)
    assert isinstance(
        admission.strict_json(b"{}", maximum_bytes=True), admission.Refused
    )
    assert isinstance(admission.strict_json("{}"), admission.Refused)  # type: ignore[arg-type]


@pytest.mark.parametrize("token", [b"-0", b"-0.0", b"-0e0", b"-0E+0"])
def test_json_preserves_negative_zero_before_numeric_replay(token: bytes) -> None:
    values = [
        admitted(admission.strict_json(token)),
        admitted(admission.strict_json(b'{"nested":[' + token + b"]}"))["nested"][0],
    ]
    for value in values:
        assert type(value) is float
        assert struct.pack(">d", value).hex().upper() == "8000000000000000"
        assert isinstance(
            admission.integer(value, 0, admission.INT64_MAX, "ledger"),
            admission.Refused,
        )
    positive = admitted(admission.strict_json(b"0"))
    assert type(positive) is int and positive == 0
    assert admitted(admission.integer(positive, 0, admission.INT64_MAX, "ledger")) == 0


@pytest.mark.parametrize("value", [True, False, -1, 1.5, 1 << 63, "1", None])
def test_measurement_integer_domain_is_exact(value: Any) -> None:
    assert isinstance(
        admission.integer(value, 0, admission.INT64_MAX, "ledger"), admission.Refused
    )


def test_belief_bits_preserve_signed_zero_and_subnormal_identity() -> None:
    for bits in (
        0,
        1 << 63,
        1,
        0x000FFFFFFFFFFFFF,
        0x0010000000000000,
        0x3FF0000000000000,
    ):
        assert admitted(admission.belief_bits(f"{bits:016X}", "belief")) == bits
    for invalid in (
        "8000000000000001",
        "3FF0000000000001",
        "7FF0000000000000",
        "FFF0000000000000",
        "7FF8000000000000",
        "3ff0000000000000",
        "0",
        True,
        0,
    ):
        assert isinstance(admission.belief_bits(invalid, "belief"), admission.Refused)


def test_native_submicrosecond_chronology_is_not_truncated() -> None:
    start = "2026-09-07T15:00:00.1234567+00:00"
    finish = "2026-09-07T15:00:00.1234568Z"
    first, last = admitted(admission.interval(start, finish, "row"))
    assert last - first == 100
    assert isinstance(admission.interval(finish, start, "row"), admission.Refused)
    assert (
        admitted(admission.utc_nanoseconds("2026-09-07T15:00:00.000000001Z", "t"))
        - admitted(admission.utc_nanoseconds("2026-09-07T15:00:00Z", "t"))
        == 1
    )
    for invalid in (
        "2026-09-07T15:00:00",
        "2026-09-07T15:00:00-04:00",
        "2026-02-29T15:00:00Z",
        "2026-09-07T24:00:00Z",
        "2026-09-07T15:60:00Z",
        "2026-09-07T15:00:60Z",
        "2026-09-07T15:00:00.0000000001Z",
        "0000-01-01T00:00:00Z",
        True,
    ):
        assert isinstance(admission.utc_nanoseconds(invalid, "t"), admission.Refused)


def descriptor(stored: bytes, original: bytes, encoding: str) -> dict[str, Any]:
    def digest(value: bytes) -> str:
        return hashlib.sha256(value).hexdigest().upper()

    return {
        "File": "rows/row.bin.gz" if encoding == "gzip" else "rows/row.bin",
        "Bytes": len(original),
        "Sha256": digest(original),
        "Encoding": encoding,
        "StoredBytes": len(stored),
        "StoredSha256": digest(stored),
    }


def test_lossless_gzip_relation_is_checked_beyond_two_correct_hashes() -> None:
    original = b"raw\xef\xbb\xbf\x00evidence\n" * 100
    stored = gzip.compress(original, mtime=0)
    row = descriptor(stored, original, "gzip")
    assert (
        admitted(admission.bind_artifact_bytes(row, stored, original, "artifact"))
        == row
    )
    unrelated = b"a different original with its own correct hash"
    assert isinstance(
        admission.bind_artifact_bytes(
            descriptor(stored, unrelated, "gzip"), stored, unrelated, "artifact"
        ),
        admission.Refused,
    )
    for bad in (
        stored[:-1],
        stored + b"junk",
        stored + gzip.compress(b"", mtime=0),
        b"not gzip",
    ):
        assert isinstance(
            admission.bind_artifact_bytes(
                descriptor(bad, original, "gzip"), bad, original, "artifact"
            ),
            admission.Refused,
        )
    assert isinstance(
        admission.bind_artifact_bytes(row, stored, original + b"!", "artifact"),
        admission.Refused,
    )


def test_identity_storage_and_descriptor_shape_are_exact() -> None:
    raw = b"retained bytes"
    row = descriptor(raw, raw, "identity")
    assert admitted(admission.bind_artifact_bytes(row, raw, raw, "artifact")) == row
    mutations = [
        dict(row, Bytes=True),
        dict(row, Extra=0),
        dict(row, Encoding="unknown"),
        dict(row, Sha256=row["Sha256"].lower()),
    ]
    missing = dict(row)
    del missing["StoredBytes"]
    mutations.append(missing)
    mutations.append(descriptor(raw, b"other bytes", "identity"))
    for invalid in mutations:
        assert isinstance(
            admission.artifact_descriptor(invalid, "artifact"), admission.Refused
        )
    for path in (
        "/tmp/a",
        "../a",
        "a/../b",
        "a//b",
        "a/./b",
        "a\\b",
        "a/",
        "a\x00b",
        "C:/a",
        "",
    ):
        assert isinstance(
            admission.artifact_descriptor(dict(row, File=path), "artifact"),
            admission.Refused,
        )


def timing_row() -> dict[str, Any]:
    return {
        "WallNs": 1,
        "CpuNs": 0,
        "AllocatedBytes": 0,
        "GcBefore": [2, 3, 4],
        "GcAfter": [3, 3, 5],
        "GcDelta": [1, 0, 1],
    }


def test_timing_zero_numerator_and_setup_wall_are_not_imputed() -> None:
    row = timing_row()
    assert admitted(admission.timing(row, "row", measured=True)) == row
    row["WallNs"] = 0
    assert isinstance(admission.timing(row, "row", measured=True), admission.Refused)
    assert admitted(admission.timing(row, "setup", measured=False))["WallNs"] == 0


@pytest.mark.parametrize("key", ["WallNs", "CpuNs", "AllocatedBytes"])
@pytest.mark.parametrize("value", [True, -1, 1.5, 1 << 63, float("inf")])
def test_bad_timing_totals_refuse(key: str, value: Any) -> None:
    row = timing_row()
    row[key] = value
    assert isinstance(admission.timing(row, "row", measured=True), admission.Refused)


def test_gc_observations_are_ordered_and_deltas_are_not_absolute_values() -> None:
    for field, values in (
        ("GcBefore", [2, 4, 4]),
        ("GcAfter", [1, 3, 5]),
        ("GcDelta", [1, 0, 2]),
        ("GcDelta", [1, False, 1]),
        ("GcAfter", [3, 3]),
        ("GcBefore", [2, 3, 4, 5]),
    ):
        row = copy.deepcopy(timing_row())
        row[field] = values
        assert isinstance(
            admission.timing(row, "row", measured=True), admission.Refused
        )


def test_choice_wire_decodes_all_six_counts_and_both_reserved_bytes() -> None:
    raw = struct.pack("<BBH6I", 1, 4, 0, 2, 1, 21, 42, 10, 20)
    result = admitted(admission.decode_choice(raw, "choice"))
    assert result == {
        "Action": 1,
        "Path": 4,
        "GuardComparisons": 2,
        "RecursiveCalls": 1,
        "Nodes": 21,
        "ActionValues": 42,
        "Predictions": 10,
        "Updates": 20,
    }
    for bad in (
        raw[:-1],
        raw + b"\x00",
        bytes([2]) + raw[1:],
        raw[:1] + bytes([5]) + raw[2:],
    ):
        assert isinstance(admission.decode_choice(bad, "choice"), admission.Refused)
    for reserved in (1, 256):
        assert isinstance(
            admission.decode_choice(
                struct.pack("<BBH6I", 1, 4, reserved, 2, 1, 21, 42, 10, 20), "choice"
            ),
            admission.Refused,
        )
    assert isinstance(
        admission.choice_record(dict(result, Nodes=True), "choice"), admission.Refused
    )


def test_exact_half_threshold_detects_failure_hidden_by_float_rounding() -> None:
    native = [admission.INT64_MAX] * 5
    too_large = 1 << 62
    assert (
        admitted(admission.half_median([too_large] * 5, native, "cost"))["AtMostHalf"]
        is False
    )
    assert (
        admitted(admission.half_median([too_large - 1] * 5, native, "cost"))[
            "AtMostHalf"
        ]
        is True
    )
    assert admitted(admission.half_median([0] * 5, [1] * 5, "cost")) == {
        "Numerator": 0,
        "Denominator": 1,
        "AtMostHalf": True,
    }


def test_medians_use_complete_separate_order_statistics_and_positive_native() -> None:
    ratio = admitted(
        admission.half_median([100, 0, 3, 2, 1], [1, 20, 10, 2, 100], "cost")
    )
    assert ratio == {"Numerator": 2, "Denominator": 10, "AtMostHalf": True}
    for invalid in ([1, 2, 3, 4], [1, 2, 3, 4, 5, 6], [1, 2, True, 4, 5]):
        assert isinstance(
            admission.half_median(invalid, [10] * 5, "cost"), admission.Refused
        )
    assert isinstance(
        admission.half_median([0] * 5, [0] * 5, "cost"), admission.Refused
    )
