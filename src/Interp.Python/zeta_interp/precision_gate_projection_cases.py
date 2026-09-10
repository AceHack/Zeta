"""Frozen scalar-projection subjects and single-field control transformations.

No solver, reference, process or artifact is executed here. Certificate-control
construction is a byte transformation, not certification: its caller must first
retain the actual certified core/unconstructed run. Unit fixtures cannot replace
that prerequisite in the registered comparison.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Any

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_ieee as ieee
from . import hidden_switch_compiled_record_encoding as encoding

INPUT_BYTES = 64 * 1024
RESULT_BYTES = 2 * 1024 * 1024
INPUT_SCHEMA = "zeta.precision-projection.input.v1"
CSTAR = (
    "0.77880078307140486824517026697832064729677229042614147424131736626824561205351924"
)


@dataclass(frozen=True, slots=True)
class Case:
    Id: str
    T: str
    U: str
    K: str
    C: str
    Class: str
    Profile: str = "default"


BASE_CASES = (
    Case("core/center", "1", "0", "0.75", "1", "core"),
    Case("core/displaced", "2", "-1", "3.75", "2", "core"),
    Case("core/small-ratio", "0.9375", "0", "-0.40625", "0.0625", "core"),
    Case("core/large-ratio", "0.0625", "0", "0.90625", "0.9375", "core"),
    Case("core/small-scale", "0.03125", "0", "-0.21875", "0.03125", "core"),
    Case("core/large-scale", "16", "0", "15.75", "16", "core"),
    Case("core/rounded-center", "1", "0", "1", CSTAR, "core"),
    Case("core/unconstructed", "1", "0", "0", "1", "core"),
    Case("core/positive-forcing", "1", "800", "0", "1", "core"),
    Case("core/negative-forcing", "1", "-20", "0", "1", "core"),
    Case("core/signed-zero", "1", "-0", "0", "1", "core"),
    Case(
        "core/wide-variance",
        "0.0009765625",
        "0",
        "-0.2490234375",
        "0.0009765625",
        "core",
    ),
    Case("stress/native-exp-range", "1", "-1000", "0", "1", "stress"),
    Case("stress/parameter-range", "5e-324", "0", "1", "1", "stress"),
    Case("stress/reference-exp-range", "1", "-1e308", "0", "1", "stress"),
    Case("stress/cancellation", "1e-300", "0", "0", "1", "stress"),
    Case("limit/native-midpoints", "1", "0", "0", "1", "limit", "native-one"),
    Case("domain/t-zero", "0", "0", "0", "1", "domain"),
    Case("domain/t-negative", "-1", "0", "0", "1", "domain"),
    Case("domain/c-zero", "1", "0", "0", "0", "domain"),
    Case("domain/c-negative", "1", "0", "0", "-1", "domain"),
)
REFERENCE_LIMIT = Case(
    "limit/reference-midpoints", "1", "0", "0", "1", "limit", "reference-one"
)
WIRE_IDS = (
    "wire/t-boolean",
    "wire/u-NaN",
    "wire/u-infinity",
    "wire/missing-c",
    "wire/duplicate-t",
    "wire/unknown-field",
)
CERTIFICATE_IDS = (
    "cert/mean",
    "cert/variance-zero",
    "cert/log-ratio",
    "cert/ratio",
    "cert/r",
    "cert/objective",
    "cert/mean-gradient",
    "cert/variance-gradient",
    "cert/target-zero-sign",
    "cert/source-binding",
    "cert/missing-objective",
    "cert/reversed-bracket",
)


def ordered_calls() -> tuple[tuple[str, str], ...]:
    """The fixed top-level ledger order; this does not claim calls occurred."""
    return (
        tuple(
            (case.Id, op)
            for case in BASE_CASES
            for op in ("NativeSolve", "ReferenceRoot", "CertifyNative")
        )
        + ((REFERENCE_LIMIT.Id, "ReferenceRoot"),)
        + tuple(
            (name, op) for name in WIRE_IDS for op in ("NativeSolve", "ReferenceRoot")
        )
        + tuple((name, "CertifyNative") for name in CERTIFICATE_IDS)
    )


def render_input(case_id: object) -> a.Admission[bytes]:
    """Render only a registered subject; controls retain the underlying Id."""
    if type(case_id) is not str:
        return a.Refused("case-id", "CaseId", "requires an exact registered string")
    found = next((c for c in (*BASE_CASES, REFERENCE_LIMIT) if c.Id == case_id), None)
    if found is None and case_id not in WIRE_IDS:
        return a.Refused("case-id", "CaseId", "unknown registered input subject")
    case = found or next(c for c in BASE_CASES if c.Id == "core/unconstructed")
    parameters: dict[str, Any] = {"T": case.T, "U": case.U, "K": case.K, "C": case.C}
    obj: dict[str, Any] = {
        "Schema": INPUT_SCHEMA,
        "Id": case.Id,
        "Parameters": parameters,
        "Profile": case.Profile,
    }
    if case_id == "wire/t-boolean":
        parameters["T"] = True
    elif case_id == "wire/u-NaN":
        parameters["U"] = "NaN"
    elif case_id == "wire/u-infinity":
        parameters["U"] = "Infinity"
    elif case_id == "wire/missing-c":
        del parameters["C"]
    elif case_id == "wire/unknown-field":
        obj["Unexpected"] = 0
    encoded = encoding.encode_public_result(obj, maximum_bytes=INPUT_BYTES)
    if isinstance(encoded, a.Refused) or case_id != "wire/duplicate-t":
        return encoded
    needle = b'"T":"1"'
    if encoded.value.count(needle) != 1:
        return a.Refused(
            "case-encoding", "Parameters.T", "unique duplication site absent"
        )
    raw = encoded.value.replace(needle, b'"T":"1","T":"1"', 1)
    if len(raw) > INPUT_BYTES:
        return a.Refused("case-size", "$", "duplicate control exceeds input bound")
    return a.Admitted(raw)


def _plus_one(value: object, field: str) -> a.Admission[str]:
    parsed = ieee.parse_bits(value)
    if isinstance(parsed, ieee.Failure):
        return a.Refused("mutation-bits", field, parsed.Message)
    exact = ieee.exact_fraction(parsed.value)
    if isinstance(exact, ieee.Failure):
        return a.Refused("mutation-bits", field, exact.Message)
    rounded = ieee.round_fraction(exact.value + Fraction(1))
    if isinstance(rounded, ieee.Failure):
        return a.Refused("mutation-range", field, rounded.Message)
    formatted = ieee.format_bits(rounded.value)
    if isinstance(formatted, ieee.Failure):
        return a.Refused("mutation-bits", field, formatted.Message)
    return a.Admitted(formatted.value)


def mutate_native(control_id: object, raw_native: object) -> a.Admission[bytes]:
    """Transform a supplied candidate once; this never establishes its provenance.

    The run coordinator must retain the actual baseline certificate before
    entering any of these controls. Only CertifyNative validates full receipts.
    This helper refuses unusable transformation inputs instead of synthesizing
    a baseline. The input bytes are immutable and remain caller-owned evidence.
    """
    if type(control_id) is not str or control_id not in CERTIFICATE_IDS:
        return a.Refused("mutation-id", "ControlId", "unknown certificate control")
    if type(raw_native) is not bytes:
        return a.Refused("mutation-input", "$", "requires actual candidate bytes")
    decoded = a.strict_json(raw_native, maximum_bytes=RESULT_BYTES)
    if isinstance(decoded, a.Refused):
        return decoded
    obj = decoded.value
    if type(obj) is not dict or obj.get("CaseId") != "core/unconstructed":
        return a.Refused("mutation-subject", "CaseId", "requires core/unconstructed")
    outcome = obj.get("Outcome")
    if type(outcome) is not dict or outcome.get("Kind") != "candidate":
        return a.Refused("mutation-candidate", "Outcome", "actual candidate absent")
    candidate = outcome.get("Value")
    if type(candidate) is not dict:
        return a.Refused(
            "mutation-candidate", "Outcome.Value", "candidate record absent"
        )
    try:
        if control_id == "cert/mean":
            candidate["MeanBits"] = "4090000000000000"
        elif control_id == "cert/variance-zero":
            candidate["VarianceBits"] = "0000000000000000"
        elif control_id in ("cert/log-ratio", "cert/ratio", "cert/r"):
            field = {
                "cert/log-ratio": "LogRatioBits",
                "cert/ratio": "RatioBits",
                "cert/r": "RBits",
            }[control_id]
            changed = _plus_one(candidate[field], field)
            if isinstance(changed, a.Refused):
                return changed
            candidate[field] = changed.value
        elif control_id in (
            "cert/objective",
            "cert/mean-gradient",
            "cert/variance-gradient",
        ):
            field = {
                "cert/objective": "ValueBits",
                "cert/mean-gradient": "DerivativeMeanBits",
                "cert/variance-gradient": "DerivativeVarianceBits",
            }[control_id]
            changed = _plus_one(candidate["OriginalObjective"][field], field)
            if isinstance(changed, a.Refused):
                return changed
            candidate["OriginalObjective"][field] = changed.value
        elif control_id == "cert/target-zero-sign":
            if candidate["TargetBits"]["U"] != "0000000000000000":
                return a.Refused(
                    "mutation-target", "TargetBits.U", "positive zero required"
                )
            candidate["TargetBits"]["U"] = "8000000000000000"
        elif control_id == "cert/source-binding":
            obj["Bindings"]["ProtocolSha256"] = "0" * 64
        elif control_id == "cert/missing-objective":
            del candidate["OriginalObjective"]
        elif control_id == "cert/reversed-bracket":
            bracket = candidate["Bracket"]
            bracket["LowerBits"], bracket["UpperBits"] = (
                bracket["UpperBits"],
                bracket["LowerBits"],
            )
    except (KeyError, TypeError, IndexError) as error:
        return a.Refused("mutation-shape", "Outcome.Value", str(error))
    return encoding.encode_public_result(obj, maximum_bytes=RESULT_BYTES)
