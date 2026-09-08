"""Disposable receipt fixtures test outcome criteria, never final solver evidence."""

from __future__ import annotations

import hashlib
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import precision_gate_projection_cases as cases
from zeta_interp import precision_gate_projection_comparison as c


def bindings() -> dict[str, str]:
    return {
        "ProtocolSha256": c.PROTOCOL_SHA256,
        "docs/research/2026-09-08-precision-gate-projection-decimal-admission-clarification.md": "BA359E4FEC2484A680B6B149E6E887FBEA82AFBB67A15EAFBDB99949101BDAB8",
        "docs/research/2026-09-08-precision-gate-projection-rendered-zero-clarification.md": "67B7C9EFB6B42CEFE341507738B6122FAC4BEDF18C07A72564F3DEEFEE71235E",
    }


def raw(case: str) -> bytes:
    value = cases.render_input(
        "core/unconstructed" if case in cases.CERTIFICATE_IDS else case
    )
    assert isinstance(value, a.Admitted)
    return value.value


def failure(
    code: str, stage: str = "certificate", field: str | None = "X"
) -> dict[str, Any]:
    return {
        "Code": code,
        "Stage": stage,
        "Field": field,
        "Message": "fixture",
        "OriginalKernelFailure": None,
    }


def fixture(case: str, op: str, kind: str, code: str | None = None) -> dict[str, Any]:
    outcome: dict[str, Any] = {"Kind": kind}
    if code:
        outcome["NativeFailure" if kind == "no-candidate" else "Failure"] = failure(
            code
        )
    numeric = (
        "core/unconstructed"
        if case in (*cases.WIRE_IDS, *cases.CERTIFICATE_IDS)
        else case
    )
    result: dict[str, Any] = {
        "Schema": c.SCHEMAS[op],
        "CaseId": numeric,
        "InputSha256": hashlib.sha256(raw(case)).hexdigest().upper(),
        "Bindings": bindings(),
        "Outcome": outcome,
        "Counters": {"Starts": 0},
    }
    if op == "CertifyNative":
        result["NativeRaw"] = {
            "BytesHex": b"fixture".hex(),
            "Bytes": 7,
            "Sha256": hashlib.sha256(b"fixture").hexdigest().upper(),
        }
    if kind == "certified":
        outcome.update(
            TargetScope="exact-native-dyadic",
            NativeTrajectoryCertified=False,
            GraphApplicationPerformed=False,
        )
        result["Reference"] = fixture(case, "ReferenceRoot", "enclosure")
    return result


def assess(case: str, op: str, result: object) -> a.Admission[c.Assessment]:
    return c.assess_receipt(
        case, op, result, raw(case), bindings(), raw_native=b"fixture"
    )


def admitted(result: a.Admission[c.Assessment]) -> c.Assessment:
    assert isinstance(result, a.Admitted), result
    return result.value


def test_actual_callback_custody_is_outside_this_envelope_check() -> None:
    r = admitted(
        assess(
            "core/center",
            "CertifyNative",
            fixture("core/center", "CertifyNative", "certified"),
        )
    )
    assert r.Expected and r.CoreCertified
    assert r.Scope == "bound-envelope-and-registered-outcome-only"


@pytest.mark.parametrize(
    "key,value",
    [
        ("CaseId", "wrong"),
        ("InputSha256", "0" * 64),
        ("Schema", "other"),
        ("Bindings", {}),
    ],
)
def test_independent_header_discrimination(key: str, value: object) -> None:
    r = fixture("core/center", "NativeSolve", "candidate")
    r[key] = value
    assert isinstance(assess("core/center", "NativeSolve", r), a.Refused)


@pytest.mark.parametrize(
    "key,value",
    [
        ("NativeTrajectoryCertified", True),
        ("NativeTrajectoryCertified", 0),
        ("GraphApplicationPerformed", 0),
        ("TargetScope", "global"),
    ],
)
def test_certificate_scope_is_exact_including_bool_int(key: str, value: object) -> None:
    r = fixture("core/center", "CertifyNative", "certified")
    r["Outcome"][key] = value
    assert isinstance(assess("core/center", "CertifyNative", r), a.Refused)


def test_certificate_native_byte_identity_cannot_follow_producer_rewrite() -> None:
    r = fixture("core/center", "CertifyNative", "certified")
    r["NativeRaw"]["BytesHex"] = "00"
    assert isinstance(assess("core/center", "CertifyNative", r), a.Refused)


def test_nested_root_must_be_bound_to_same_case() -> None:
    r = fixture("core/center", "CertifyNative", "certified")
    r["Reference"]["CaseId"] = "core/displaced"
    assert isinstance(assess("core/center", "CertifyNative", r), a.Refused)


@pytest.mark.parametrize("code", ["Unexpected", "ResultTooLarge"])
def test_abnormal_refusal_never_passes_corruption_control(code: str) -> None:
    r = admitted(
        assess(
            "cert/mean",
            "CertifyNative",
            fixture("cert/mean", "CertifyNative", "refused", code),
        )
    )
    assert r.Abnormal and r.Expected is False


def test_named_refusal_passes_control_but_is_not_a_core_certificate() -> None:
    r = admitted(
        assess(
            "cert/mean",
            "CertifyNative",
            fixture("cert/mean", "CertifyNative", "refused", "NotCloseToMinimum"),
        )
    )
    assert r.Expected is True and not r.CoreCertified


def test_wire_refusal_requires_zero_numeric_entries() -> None:
    r = fixture("wire/t-boolean", "NativeSolve", "refused", "Wire")
    r["Outcome"]["Failure"]["Stage"] = "input"
    assert admitted(assess("wire/t-boolean", "NativeSolve", r)).Expected
    r["Counters"]["Starts"] = 1
    assert admitted(assess("wire/t-boolean", "NativeSolve", r)).Expected is False
    r["Counters"]["Starts"] = False
    assert isinstance(assess("wire/t-boolean", "NativeSolve", r), a.Refused)


@pytest.mark.parametrize(
    "op,kind,stage",
    [
        ("NativeSolve", "refused", "parameters"),
        ("ReferenceRoot", "refused", "input"),
        ("CertifyNative", "no-candidate", "parameters"),
    ],
)
def test_domain_boundary_is_service_specific(op: str, kind: str, stage: str) -> None:
    r = fixture("domain/t-zero", op, kind, "Domain")
    r["Outcome"]["NativeFailure" if kind == "no-candidate" else "Failure"]["Stage"] = (
        stage
    )
    assert admitted(assess("domain/t-zero", op, r)).Expected


@pytest.mark.parametrize(
    "case,op",
    [
        ("limit/native-midpoints", "NativeSolve"),
        ("limit/reference-midpoints", "ReferenceRoot"),
    ],
)
def test_budget_failure_requires_actual_midpoint_stage(case: str, op: str) -> None:
    r = fixture(case, op, "refused", "IterationLimit")
    r["Outcome"]["Failure"]["Stage"] = "midpoint"
    assert admitted(assess(case, op, r)).Expected
    r["Outcome"]["Failure"]["Stage"] = "reconstruction"
    assert admitted(assess(case, op, r)).Expected is False


def test_typed_core_refusal_is_observation_but_fails_viability() -> None:
    r = admitted(
        assess(
            "core/center",
            "NativeSolve",
            fixture("core/center", "NativeSolve", "refused", "NumericalUnderflow"),
        )
    )
    assert r.Expected is False and not r.Abnormal


def test_stress_success_and_range_refusal_are_both_reported_without_promise() -> None:
    case = "stress/cancellation"
    for kind, code in (("candidate", None), ("refused", "NumericalRange")):
        assert (
            admitted(
                assess(case, "NativeSolve", fixture(case, "NativeSolve", kind, code))
            ).Expected
            is None
        )


def test_missing_clarification_does_not_pass_map_validation() -> None:
    b = bindings()
    b.pop(next(key for key in b if key != "ProtocolSha256"))
    assert isinstance(c.validate_bindings(b), a.Refused)


def test_input_cap_is_checked_before_hash(monkeypatch: pytest.MonkeyPatch) -> None:
    def bad_hash(*args: object, **kwargs: object) -> None:
        pytest.fail("oversized input reached hash")

    monkeypatch.setattr(c.hashlib, "sha256", bad_hash)
    assert isinstance(
        c.assess_receipt("core/center", "NativeSolve", {}, b"x" * 65537, bindings()),
        a.Refused,
    )
