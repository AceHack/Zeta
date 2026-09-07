from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_bindings as b
from zeta_interp import hidden_switch_compiled_conformance as c
from zeta_interp import hidden_switch_compiled_record_encoding as e
from zeta_interp import hidden_switch_compiled_static_fixtures as fixtures


@dataclass(frozen=True)
class Observed:
    Z: object
    A: object


def canonical(value: object) -> bytes:
    tree = c.result_tree(value)
    assert isinstance(tree, a.Admitted), tree
    return (
        json.dumps(
            tree.value,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=True,
            allow_nan=False,
        )
        + "\n"
    ).encode("ascii")


@pytest.mark.parametrize(
    "value",
    [
        None,
        False,
        True,
        0,
        -(2**63),
        2**64 - 1,
        2**1074,
        -0.0,
        0.0,
        math.nextafter(0.0, 1.0),
        1.7976931348623157e308,
        "",
        'quoted"\\slash\n',
        "\x00\x01\x7f",
        "\u00ff\u20ac\U0001f642",
        "\U0001f642" * 600,
        bytes(range(256)) * 3,
        [1, False, None, -0.0],
        (b"a", {"z": 1, "a": 2}),
        Observed(a.Refused("code", "path", "detail"), (b"\x00\xff", True, 2**53 + 1)),
    ],
)
def test_exact_parity_with_complete_public_projection_and_canonical_scalar_spellings(
    value: object,
) -> None:
    expected = canonical(value)
    result = e.encode_public_result(value)
    assert result == a.Admitted(expected)
    assert isinstance(a.strict_json(expected), a.Admitted)
    assert e.encode_public_result(value, maximum_bytes=len(expected)) == result
    short = e.encode_public_result(value, maximum_bytes=len(expected) - 1)
    assert isinstance(short, a.Refused) and short.code == "record-byte-bound"


def test_every_ascii_escape_and_unicode_boundary_has_exact_quota() -> None:
    value = "".join(chr(code) for code in range(256)) + "\uffff\U00010000\U0010ffff"
    expected = canonical(value)
    assert e.encode_public_result(value, maximum_bytes=len(expected)) == a.Admitted(
        expected
    )
    assert isinstance(
        e.encode_public_result(value, maximum_bytes=len(expected) - 1), a.Refused
    )


def test_all_36_actual_static_operation_results_keep_every_type_and_field() -> None:
    context = b.BindingContext(a.PROTOCOL_SHA256, "1" * 40, "2" * 64, "3" * 64)
    calls = 0
    for case_id in fixtures.STATIC_CASE_IDS:
        prepared = fixtures.prepare_static_case(case_id, context=context)
        assert isinstance(prepared, a.Admitted)
        spec = next(row for row in c.case_specs() if row.CaseId == case_id)
        for index, _ in enumerate(spec.Calls):
            actual = fixtures.execute_static_call(
                case_id,
                index,
                prepared.value.Inputs,
                prepared.value.SupportingArtifacts,
            )
            assert e.encode_public_result(actual) == a.Admitted(canonical(actual))
            calls += 1
    assert calls == 36


def test_negative_zero_and_bool_integer_domains_survive_strict_round_trip() -> None:
    result = e.encode_public_result(
        {"minus": -0.0, "plus": 0.0, "boolean": False, "integer": 0}
    )
    assert isinstance(result, a.Admitted)
    decoded = a.strict_json(result.value)
    assert isinstance(decoded, a.Admitted)
    values = decoded.value
    assert math.copysign(1.0, values["minus"]) == -1.0
    assert math.copysign(1.0, values["plus"]) == 1.0
    assert type(values["boolean"]) is bool and type(values["integer"]) is int


@pytest.mark.parametrize(
    "value,code",
    [
        (float("nan"), "result-number"),
        (float("inf"), "result-number"),
        ("\ud800", "result-unicode"),
        ("x\udfff", "result-unicode"),
        ({1: "value"}, "result-key"),
        (object(), "result-type"),
        (bytearray(b"raw"), "result-type"),
        (Observed, "result-type"),
    ],
)
def test_invalid_public_values_return_typed_refusal(value: object, code: str) -> None:
    result = e.encode_public_result(value)
    assert isinstance(result, a.Refused) and result.code == code


def test_cycles_refuse_but_repeated_noncyclic_values_are_retained() -> None:
    cycle: list[object] = []
    cycle.append(cycle)
    result = e.encode_public_result(cycle)
    assert isinstance(result, a.Refused) and result.code == "result-cycle"
    shared = [Observed(0, b"same")]
    value = [shared, shared]
    assert e.encode_public_result(value) == a.Admitted(canonical(value))


def test_depth_node_key_and_integer_bounds_refuse_before_unbounded_expansion() -> None:
    deep: object = None
    for _ in range(e.MAX_DEPTH + 1):
        deep = [deep]
    for value in (
        deep,
        [None] * e.MAX_NODES,
        {"x" * (e.MAX_KEY_CHARACTERS + 1): 0},
        1 << e.MAX_INTEGER_BITS,
    ):
        result = e.encode_public_result(value)
        assert isinstance(result, a.Refused) and result.code == "result-size"


@pytest.mark.parametrize("bad", [False, 0, -1, 1.0, "4096", e.MAX_RECORD_BYTES + 1])
def test_quota_requires_exact_positive_bounded_integer(bad: object) -> None:
    result = e.encode_public_result(None, maximum_bytes=bad)
    assert isinstance(result, a.Refused) and result.code == "integer"


def test_expansion_is_not_constructed_after_remaining_output_quota_is_exhausted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[object] = []
    real = json.dumps

    def dumps(value: object, *args: Any, **kwargs: Any) -> str:
        calls.append(value)
        return real(value, *args, **kwargs)

    monkeypatch.setattr(json, "dumps", dumps)
    result = e.encode_public_result("\U0001f642" * 100_000, maximum_bytes=2)
    assert isinstance(result, a.Refused) and result.code == "record-byte-bound"
    assert not calls  # Refused before constructing the expanded JSON chunk.


def test_no_appended_prefix_exceeds_quota_and_strings_are_encoded_in_small_chunks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    observed: list[int] = []
    real_emit = e._Encoder.emit
    real_dumps = json.dumps
    slices: list[int] = []

    def emit(self: e._Encoder, raw: bytes, path: str) -> None:
        real_emit(self, raw, path)
        observed.append(len(self.output))
        assert len(self.output) <= self.maximum

    def dumps(value: object, *args: Any, **kwargs: Any) -> str:
        if type(value) is str:
            slices.append(len(value))
        return real_dumps(value, *args, **kwargs)

    monkeypatch.setattr(e._Encoder, "emit", emit)
    monkeypatch.setattr(json, "dumps", dumps)
    result = e.encode_public_result(
        ["\U0001f642" * 10_000, b"large" * 10_000], maximum_bytes=20_000
    )
    assert isinstance(result, a.Refused) and result.code == "record-byte-bound"
    assert observed and max(observed) <= 20_000
    assert slices and max(slices) <= e.CHUNK_CHARACTERS


def test_late_encoding_failure_reports_actual_path_without_silent_string_fallback() -> (
    None
):
    class Opaque:
        def __str__(self) -> str:
            raise AssertionError("implicit conversion must never execute")

    result = e.encode_public_result({"a": a.Admitted(3), "z": Opaque()})
    assert (
        isinstance(result, a.Refused)
        and result.code == "result-type"
        and result.path == "$.z"
    )
    assert isinstance(e.encode_public_result(a.Admitted(3)), a.Admitted)


def test_bad_dataclass_observation_returns_failure_separate_from_operation_result() -> (
    None
):
    @dataclass
    class Missing:
        Value: int

    value = Missing(1)
    del value.Value
    result = e.encode_public_result(value)
    assert isinstance(result, a.Refused) and result.code == "result-observation"
