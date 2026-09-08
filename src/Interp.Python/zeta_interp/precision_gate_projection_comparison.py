"""Fixed projection outcome criteria, separate from solver and execution custody.

This module checks the independently supplied receipt envelope and registered
outcome criteria. It does not reimplement the reference certificate, establish
execution provenance, or turn a dictionary into an authenticated service call.
The whole-run coordinator must retain actual callbacks and source/input custody.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

from . import hidden_switch_compiled_admission as a
from . import precision_gate_projection_cases as cases

PROTOCOL_SHA256 = "537054779BF9E0BFA9271B5CC56116FBC80B16C4A2BE9F1B5E3C022FE95A0F8E"
SCHEMAS = {
    "NativeSolve": "zeta.precision-projection.native.v1",
    "ReferenceRoot": "zeta.precision-projection.reference.v1",
    "CertifyNative": "zeta.precision-projection.certificate.v1",
}
_CODES = frozenset(
    (
        "Wire",
        "Domain",
        "NumericalRange",
        "NumericalUnderflow",
        "NoRoundedBracket",
        "IterationLimit",
        "ResolutionLimit",
        "SignIndeterminate",
        "EmptyIntersection",
        "ObjectiveRefusal",
        "TargetMismatch",
        "SourceMismatch",
        "CandidateShape",
        "NoRootEnclosure",
        "NotCloseToMinimum",
        "InconsistentCoordinate",
        "ObjectiveMismatch",
        "ResultTooLarge",
        "Unexpected",
    )
)
_STAGES = frozenset(
    (
        "input",
        "parameters",
        "left-endpoint",
        "right-endpoint",
        "midpoint",
        "reconstruction",
        "objective",
        "certificate",
        "encoding",
    )
)


@dataclass(frozen=True, slots=True)
class Assessment:
    CaseId: str
    Operation: str
    Kind: str
    FailureCode: str | None
    Expected: bool | None
    CoreCertified: bool
    Abnormal: bool
    Scope: str = "bound-envelope-and-registered-outcome-only"


def _refuse(field: str, message: str) -> a.Refused:
    return a.Refused("comparison-envelope", field, message)


def validate_bindings(bindings: object) -> a.Admission[dict[str, str]]:
    """Validate a bounded caller map; do not infer loaded source identity."""
    if type(bindings) is not dict or not 3 <= len(bindings) <= 1024:
        return _refuse("Bindings", "bounded independent map required")
    total = 0
    for key, value in bindings.items():
        if type(key) is not str or type(value) is not str:
            return _refuse("Bindings", "exact string keys and hashes required")
        if not key or len(key) > 1024 or not key.isascii():
            return _refuse("Bindings", "bounded ASCII source key required")
        if len(value) != 64 or any(c not in "0123456789ABCDEF" for c in value):
            return _refuse("Bindings", "uppercase SHA256 required")
        total += len(key) + len(value)
        if total > 65536:
            return _refuse("Bindings", "logical binding payload exceeds cap")
    if bindings.get("ProtocolSha256") != PROTOCOL_SHA256:
        return _refuse("Bindings.ProtocolSha256", "registered contract required")
    required = {
        "docs/research/2026-09-08-precision-gate-projection-decimal-admission-clarification.md": "BA359E4FEC2484A680B6B149E6E887FBEA82AFBB67A15EAFBDB99949101BDAB8",
        "docs/research/2026-09-08-precision-gate-projection-rendered-zero-clarification.md": "67B7C9EFB6B42CEFE341507738B6122FAC4BEDF18C07A72564F3DEEFEE71235E",
    }
    if any(bindings.get(key) != value for key, value in required.items()):
        return _refuse("Bindings", "both registered clarification hashes required")
    return a.Admitted(dict(bindings))


def _failure(value: object) -> a.Admission[dict[str, Any]]:
    if type(value) is not dict or set(value) != {
        "Code",
        "Stage",
        "Field",
        "Message",
        "OriginalKernelFailure",
    }:
        return _refuse("Outcome.Failure", "exact registered failure required")
    if type(value["Code"]) is not str or value["Code"] not in _CODES:
        return _refuse("Outcome.Failure.Code", "registered failure code required")
    if type(value["Stage"]) is not str or value["Stage"] not in _STAGES:
        return _refuse("Outcome.Failure.Stage", "registered failure stage required")
    if value["Field"] is not None and type(value["Field"]) is not str:
        return _refuse("Outcome.Failure.Field", "member path or null required")
    if type(value["Message"]) is not str or len(value["Message"]) > 1024:
        return _refuse("Outcome.Failure.Message", "bounded diagnostic required")
    original = value["OriginalKernelFailure"]
    if original is not None and (
        type(original) is not dict
        or set(original) != {"Kind", "Field", "Detail"}
        or original["Kind"]
        not in ("InvalidInput", "NumericalFailure", "ImproperBelief")
        or any(v is not None and type(v) is not str for v in original.values())
    ):
        return _refuse(
            "Outcome.Failure.OriginalKernelFailure", "kernel error shape required"
        )
    return a.Admitted(value)


def assess_receipt(
    case_id: object,
    operation: object,
    receipt: object,
    raw_input: object,
    expected_bindings: object,
    *,
    raw_native: object = None,
) -> a.Admission[Assessment]:
    """Assess an actual retained receipt; never invoke or retry a service.

    Expected=None labels stress observations and ordinary successful/reference
    rows without a separate control promise. CoreCertified is true only for a
    bound certificate with the registered limited scope flags. Call and source
    authenticity are prerequisites enforced by the external coordinator.
    """
    if (
        type(case_id) is not str
        or type(operation) is not str
        or (case_id, operation) not in cases.ordered_calls()
    ):
        return _refuse("Call", "fixed roster slot required")
    if type(raw_input) is not bytes or len(raw_input) > cases.INPUT_BYTES:
        return _refuse("Input", "bounded exact input bytes required before hashing")
    bindings = validate_bindings(expected_bindings)
    if isinstance(bindings, a.Refused):
        return bindings
    numeric_id = (
        "core/unconstructed"
        if case_id in (*cases.WIRE_IDS, *cases.CERTIFICATE_IDS)
        else case_id
    )
    if type(receipt) is not dict:
        return _refuse("Receipt", "actual receipt tree required")
    for key, expected in (
        ("Schema", SCHEMAS[operation]),
        ("CaseId", numeric_id),
        ("InputSha256", hashlib.sha256(raw_input).hexdigest().upper()),
    ):
        if type(receipt.get(key)) is not str or receipt[key] != expected:
            return _refuse(key, "independent envelope identity mismatch")
    if (
        type(receipt.get("Bindings")) is not dict
        or receipt["Bindings"] != bindings.value
    ):
        return _refuse("Bindings", "independent exact source map mismatch")
    counters = receipt.get("Counters")
    if (
        type(counters) is not dict
        or not counters
        or any(type(v) is not int or v < 0 for v in counters.values())
    ):
        return _refuse("Counters", "nonnegative exact integer entries required")
    outcome = receipt.get("Outcome")
    if type(outcome) is not dict or type(outcome.get("Kind")) is not str:
        return _refuse("Outcome", "typed outcome required")
    kind = outcome["Kind"]
    allowed = {
        "NativeSolve": ("candidate", "refused"),
        "ReferenceRoot": ("enclosure", "refused"),
        "CertifyNative": ("certified", "refused", "no-candidate"),
    }
    if kind not in allowed[operation]:
        return _refuse("Outcome.Kind", "operation-specific outcome required")
    failure = None
    if kind in ("refused", "no-candidate"):
        f = _failure(
            outcome.get("NativeFailure" if kind == "no-candidate" else "Failure")
        )
        if isinstance(f, a.Refused):
            return f
        failure = f.value
    if operation == "CertifyNative":
        if type(raw_native) is not bytes or len(raw_native) > cases.RESULT_BYTES:
            return _refuse("NativeRaw", "actual bounded supplied native bytes required")
        expected_raw = {
            "BytesHex": raw_native.hex(),
            "Bytes": len(raw_native),
            "Sha256": hashlib.sha256(raw_native).hexdigest().upper(),
        }
        supplied = receipt.get("NativeRaw")
        if (
            type(supplied) is not dict
            or supplied != expected_raw
            or type(supplied.get("Bytes")) is not int
        ):
            return _refuse("NativeRaw", "certificate must retain exact supplied bytes")
        if kind == "certified":
            if (
                set(outcome)
                != {
                    "Kind",
                    "TargetScope",
                    "NativeTrajectoryCertified",
                    "GraphApplicationPerformed",
                }
                or outcome.get("TargetScope") != "exact-native-dyadic"
                or outcome.get("NativeTrajectoryCertified") is not False
                or outcome.get("GraphApplicationPerformed") is not False
            ):
                return _refuse(
                    "Outcome", "registered finite certificate scope required"
                )
            nested = receipt.get("Reference")
            if (
                type(nested) is not dict
                or nested.get("Schema") != SCHEMAS["ReferenceRoot"]
                or nested.get("CaseId") != numeric_id
                or nested.get("InputSha256") != receipt["InputSha256"]
                or nested.get("Bindings") != bindings.value
                or type(nested.get("Outcome")) is not dict
                or nested["Outcome"].get("Kind") != "enclosure"
            ):
                return _refuse("Reference", "bound actual root enclosure required")
    code = failure["Code"] if failure is not None else None
    abnormal = code in ("Unexpected", "ResultTooLarge")
    expected_result: bool | None = None
    if case_id in cases.WIRE_IDS:
        expected_result = (
            kind == "refused"
            and code == "Wire"
            and failure is not None
            and failure["Stage"] == "input"
            and all(value == 0 for value in counters.values())
        )
    elif case_id in cases.CERTIFICATE_IDS:
        expected_result = (
            kind == "refused"
            and not abnormal
            and failure is not None
            and (failure["Field"] is not None or failure["Stage"] == "certificate")
        )
    elif case_id.startswith("domain/"):
        expected_result = (
            kind == ("no-candidate" if operation == "CertifyNative" else "refused")
            and code == "Domain"
            and failure is not None
            and failure["Stage"]
            == ("input" if operation == "ReferenceRoot" else "parameters")
        )
    elif (case_id, operation) in (
        ("limit/native-midpoints", "NativeSolve"),
        ("limit/reference-midpoints", "ReferenceRoot"),
    ):
        expected_result = (
            kind == "refused"
            and code == "IterationLimit"
            and failure is not None
            and failure["Stage"] == "midpoint"
        )
    elif case_id.startswith("core/"):
        expected_result = (
            kind
            == {
                "NativeSolve": "candidate",
                "ReferenceRoot": "enclosure",
                "CertifyNative": "certified",
            }[operation]
        )
    if abnormal:
        expected_result = False
    return a.Admitted(
        Assessment(
            case_id,
            operation,
            kind,
            code,
            expected_result,
            case_id.startswith("core/")
            and operation == "CertifyNative"
            and kind == "certified",
            abnormal,
        )
    )
