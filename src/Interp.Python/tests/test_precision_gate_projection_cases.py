"""Source-adapter controls, not the registered solver comparison.

Candidate dictionaries below are explicit disposable unit fixtures. They are
never represented as actual or certified native baseline evidence.
"""

from __future__ import annotations

import copy
import json
from fractions import Fraction
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import precision_gate_projection_cases as c


def ok(result: a.Admission[bytes]) -> bytes:
    assert isinstance(result, a.Admitted), result
    return result.value


def fixture() -> dict[str, Any]:
    return {
        "CaseId": "core/unconstructed",
        "Bindings": {"ProtocolSha256": "A" * 64},
        "Outcome": {
            "Kind": "candidate",
            "Value": {
                "MeanBits": "0000000000000000",
                "VarianceBits": "3FF0000000000000",
                "LogRatioBits": "3FF0000000000000",
                "RatioBits": "3FF0000000000000",
                "RBits": "3FF0000000000000",
                "TargetBits": {"U": "0000000000000000"},
                "OriginalObjective": {
                    "ValueBits": "3FF0000000000000",
                    "DerivativeMeanBits": "3FF0000000000000",
                    "DerivativeVarianceBits": "3FF0000000000000",
                },
                "Bracket": {
                    "LowerBits": "BFF0000000000000",
                    "UpperBits": "3FF0000000000000",
                },
            },
        },
    }


def test_roster_has_separate_subject_ids_and_complete_call_order() -> None:
    calls = c.ordered_calls()
    assert len(calls) == 88 and len({name for name, _ in calls}) == 40
    assert calls[:3] == tuple(
        ("core/center", op) for op in ("NativeSolve", "ReferenceRoot", "CertifyNative")
    )
    assert calls[63] == ("limit/reference-midpoints", "ReferenceRoot")
    assert calls[-1] == ("cert/reversed-bracket", "CertifyNative")
    for name in c.WIRE_IDS:
        if name != "wire/duplicate-t":
            assert json.loads(ok(c.render_input(name)))["Id"] == "core/unconstructed"


def test_exact_known_centers_satisfy_independently_simplified_stationarity() -> None:
    # At m=-v/2, exp argument is exactly zero, r=c. This algebraic test
    # does not invoke either optimizer or generate an exponential oracle.
    for subject in (*c.BASE_CASES[:6], c.BASE_CASES[11]):
        t, u, k, r = map(Fraction, (subject.T, subject.U, subject.K, subject.C))
        v = 1 / (t + r)
        m = -v / 2
        assert t * (m - u) - k + r == 0
        assert t + r - 1 / v == 0


def test_signed_zero_and_tiny_decimal_are_not_json_numbers() -> None:
    signed = json.loads(ok(c.render_input("core/signed-zero")))
    tiny = json.loads(ok(c.render_input("stress/parameter-range")))
    assert signed["Parameters"]["U"] == "-0"
    assert tiny["Parameters"]["T"] == "5e-324"
    assert all(type(x) is str for x in signed["Parameters"].values())


def test_duplicate_wire_control_survives_until_real_json_admission() -> None:
    raw = ok(c.render_input("wire/duplicate-t"))
    assert raw.count(b'"T":"1"') == 2
    result = a.strict_json(raw, maximum_bytes=c.INPUT_BYTES)
    assert isinstance(result, a.Refused) and result.code == "json-duplicate"
    boolean = json.loads(ok(c.render_input("wire/t-boolean")))
    assert boolean["Parameters"]["T"] is True
    missing = json.loads(ok(c.render_input("wire/missing-c")))
    assert "C" not in missing["Parameters"]


@pytest.mark.parametrize(
    "bad", [None, True, 1, [], {}, "core/not-registered", "cert/mean"]
)
def test_unknown_input_never_substitutes_a_registered_subject(bad: object) -> None:
    assert isinstance(c.render_input(bad), a.Refused)


@pytest.mark.parametrize("name", c.CERTIFICATE_IDS)
def test_mutations_do_not_reuse_mutated_baselines(name: str) -> None:
    obj = fixture()
    original = copy.deepcopy(obj)
    raw = json.dumps(obj).encode()
    mutated = json.loads(ok(c.mutate_native(name, raw)))
    assert mutated != original
    assert obj == original and json.loads(raw) == original
    assert mutated["CaseId"] == "core/unconstructed"
    # Repeating a transformation on original immutable bytes is deterministic.
    assert ok(c.mutate_native(name, raw)) == ok(c.mutate_native(name, raw))


def test_plus_one_uses_exact_nearest_even_at_a_halfway_boundary() -> None:
    obj = fixture()
    # 2^53 + 1 is halfway between consecutive representable binary64 values.
    obj["Outcome"]["Value"]["RatioBits"] = "4340000000000000"
    raw = json.dumps(obj).encode()
    changed = json.loads(ok(c.mutate_native("cert/ratio", raw)))
    assert changed["Outcome"]["Value"]["RatioBits"] == "4340000000000000"
    # The helper does not invent a different mutation when rounding absorbs +1.
    # The registered baseline determines whether that mutation discriminates.


def test_target_zero_mutation_changes_only_its_bit_sign() -> None:
    original = fixture()
    result = json.loads(
        ok(c.mutate_native("cert/target-zero-sign", json.dumps(original).encode()))
    )
    expected = copy.deepcopy(original)
    expected["Outcome"]["Value"]["TargetBits"]["U"] = "8000000000000000"
    assert result == expected
    assert isinstance(
        c.mutate_native("cert/target-zero-sign", json.dumps(result).encode()), a.Refused
    )


@pytest.mark.parametrize(
    "raw", [b'{"CaseId":1,"CaseId":2}', b"NaN", b'"\\ud800"', b"\xff", b"[]"]
)
def test_invalid_or_duplicate_candidate_input_is_not_a_baseline(raw: bytes) -> None:
    assert isinstance(c.mutate_native("cert/mean", raw), a.Refused)


def test_refusal_missing_objective_and_nonfinite_bits_remain_refusals() -> None:
    obj = fixture()
    obj["Outcome"]["Kind"] = "refused"
    assert isinstance(c.mutate_native("cert/mean", json.dumps(obj).encode()), a.Refused)
    obj = fixture()
    del obj["Outcome"]["Value"]["OriginalObjective"]
    assert isinstance(
        c.mutate_native("cert/objective", json.dumps(obj).encode()), a.Refused
    )
    obj = fixture()
    obj["Outcome"]["Value"]["RBits"] = "7FF0000000000000"
    assert isinstance(c.mutate_native("cert/r", json.dumps(obj).encode()), a.Refused)
