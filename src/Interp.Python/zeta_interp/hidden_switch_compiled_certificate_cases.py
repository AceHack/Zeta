"""Fixed raw certificate mutations for prearchive conformance, not study tapes.

The corpus is derived from the complete caller-admitted binding map. These exact
bytes can be passed to the actual native verifier in a separate hand process.
This module executes only independent Python certificate/JSON admission; its
outcomes do not claim that native conformance or runtime admission took place.
"""

from __future__ import annotations

import copy
import hashlib
import json
from dataclasses import dataclass
from typing import cast

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_certificate as c
from . import hidden_switch_compiled_ieee as s

CASE_IDS = (
    "baseline",
    "wrong-protocol-binding",
    "wrong-source-binding",
    "wrong-epsilon",
    "changed-drift",
    "changed-effect",
    "changed-depth",
    "reassociated-expression",
    "missing-alpha-candidate",
    "reordered-alpha-candidates",
    "changed-alpha-value",
    "missing-envelope-interval",
    "missing-gap-interval",
    "changed-endpoint-margin",
    "omitted-subtraction-error",
    "swapped-depth-two-guards",
    "outward-depth-two-switch",
    "outward-depth-two-harvest",
    "outward-depth-three-switch",
    "outward-depth-three-harvest",
    "inclusive-switch-relation",
    "noncanonical-rational",
    "boolean-candidate-index",
    "extra-top-level-field",
    "missing-top-level-field",
    "duplicate-schema-key",
    "nonfinite-index",
    "invalid-utf8",
    "unpaired-surrogate",
    "empty-input",
    "truncated-input",
)


@dataclass(frozen=True, slots=True)
class PythonOutcome:
    Accepted: bool
    Boundary: str
    Code: str | None
    Path: str | None
    Detail: str | None
    NumericCertificateSha256: str | None


@dataclass(frozen=True, slots=True)
class CertificateCase:
    CaseId: str
    Raw: bytes
    Sha256: str
    Python: PythonOutcome


@dataclass(frozen=True, slots=True)
class CertificateCaseSet:
    Cases: tuple[CertificateCase, ...]
    BaselineSha256: str
    Scope: str = "python-certificate-negative-corpus-only"
    NativeAdmission: str = "not-executed"


def _dict(node: c.Json) -> dict[str, c.Json]:
    # Only the locally constructed complete certificate reaches these helpers.
    return cast(dict[str, c.Json], node)


def _list(node: c.Json) -> list[c.Json]:
    return cast(list[c.Json], node)


def _row(node: c.Json, index: int) -> dict[str, c.Json]:
    return _dict(_list(node)[index])


def _encode(node: c.Json) -> bytes:
    return json.dumps(
        node, sort_keys=True, separators=(",", ":"), ensure_ascii=True
    ).encode("ascii")


def _different_hash(value: str) -> str:
    return ("1" if value[0] == "0" else "0") + value[1:]


def python_outcome(raw: bytes, bindings: object) -> PythonOutcome:
    """Retain the actual strict decoder or independent verifier outcome."""
    decoded = a.strict_json(raw)
    if isinstance(decoded, a.Refused):
        return PythonOutcome(
            False, "json", decoded.code, decoded.path, decoded.detail, None
        )
    result = c.verify_certificate(decoded.value, bindings)
    if isinstance(result, s.Failure):
        return PythonOutcome(
            False, "numeric-certificate", result.Code, None, result.Message, None
        )
    return PythonOutcome(
        True, "numeric-certificate", None, None, None, result.value.NumericSha256
    )


def certificate_cases(bindings: object) -> s.Result[CertificateCaseSet]:
    """Build and execute one valid control and thirty fixed raw input mutations.

    Malformed source binding requires at least one non-protocol binding. No input
    is selected from experiment outcomes. All negative cases must actually refuse,
    and no two raw inputs may coincide. The returned frozen rows preserve bytes.
    """
    built = c.build_certificate(bindings)
    if isinstance(built, s.Failure):
        return built
    base = built.value
    bound = _dict(base["Bindings"])
    sources = sorted(key for key in bound if key != "ProtocolSha256")
    if not sources:
        return s.Failure(
            "CaseBindings", "negative corpus requires a non-protocol source binding"
        )
    baseline = _encode(base)
    rows: list[CertificateCase] = []
    for name in CASE_IDS:
        document = copy.deepcopy(base)
        model = _dict(document["Model"])
        depth3 = _row(document["Models"], 2)
        guard2, guard3 = _row(document["Guards"], 0), _row(document["Guards"], 1)
        if name == "wrong-protocol-binding":
            _dict(document["Bindings"])["ProtocolSha256"] = _different_hash(
                c.PROTOCOL_SHA256
            )
        elif name == "wrong-source-binding":
            key = sources[0]
            _dict(document["Bindings"])[key] = _different_hash(cast(str, bound[key]))
        elif name == "wrong-epsilon":
            model["EpsilonBits"] = "0000000000000000"
        elif name == "changed-drift":
            model["Drift"] = {"Num": "1", "Den": "4"}
        elif name == "changed-effect":
            _row(document["Models"], 0)["Effect"] = False
        elif name == "changed-depth":
            _row(document["Models"], 0)["Depth"] = 2
        elif name == "reassociated-expression":
            _list(document["ExpressionGraph"])[9] = "tree.value = immediate+(zero+one)"
        elif name == "missing-alpha-candidate":
            _list(depth3["Candidates"]).pop()
        elif name == "reordered-alpha-candidates":
            _list(depth3["Candidates"]).reverse()
        elif name == "changed-alpha-value":
            _list(_row(depth3["Candidates"], 0)["Values"])[0] = {"Num": "0", "Den": "1"}
        elif name == "missing-envelope-interval":
            _list(depth3["Envelopes"]).pop()
        elif name == "missing-gap-interval":
            _list(depth3["GapPieces"]).pop()
        elif name == "changed-endpoint-margin":
            _list(_row(depth3["Envelopes"], 0)["EndpointMargins"])[0] = {
                "Num": "1",
                "Den": "1",
            }
        elif name == "omitted-subtraction-error":
            _row(_dict(document["Bounds"])["Depths"], 1)["Rho"] = {
                "Num": "532",
                "Den": str(1 << 48),
            }
        elif name == "swapped-depth-two-guards":
            guard2["SmaxBits"], guard2["HminBits"] = (
                guard2["HminBits"],
                guard2["SmaxBits"],
            )
        elif name.startswith("outward-depth-"):
            guard = guard2 if "-two-" in name else guard3
            key, step = (
                ("SmaxBits", 1) if name.endswith("-switch") else ("HminBits", -1)
            )
            guard[key] = f"{int(cast(str, guard[key]), 16) + step:016X}"
        elif name == "inclusive-switch-relation":
            _list(guard2["Relations"])[0] = "Smax<=Rminus<Snext"
        elif name == "noncanonical-rational":
            model["Drift"] = {"Num": "2", "Den": "16"}
        elif name == "boolean-candidate-index":
            _row(_row(document["Models"], 0)["Candidates"], 0)["Index"] = False
        elif name == "extra-top-level-field":
            document["Passed"] = True
        elif name == "missing-top-level-field":
            del document["Bounds"]
        raw = _encode(document)
        if name == "duplicate-schema-key":
            raw = b'{"Schema":' + _encode(base["Schema"]) + b"," + baseline[1:]
        elif name == "nonfinite-index":
            raw = baseline.replace(b'"Index":0', b'"Index":NaN', 1)
        elif name == "invalid-utf8":
            raw = b'{"\xff":0}'
        elif name == "unpaired-surrogate":
            raw = b'{"\\ud800":0}'
        elif name == "empty-input":
            raw = b""
        elif name == "truncated-input":
            raw = baseline[:-1]
        outcome = python_outcome(raw, bindings)
        if outcome.Accepted != (name == "baseline"):
            return s.Failure(
                "CaseDisposition", f"unexpected independent admission for {name}"
            )
        rows.append(
            CertificateCase(name, raw, hashlib.sha256(raw).hexdigest().upper(), outcome)
        )
    if len({row.Raw for row in rows}) != len(rows):
        return s.Failure(
            "DuplicateCaseBytes", "fixed raw corpus contains a duplicate input"
        )
    return s.Success(CertificateCaseSet(tuple(rows), rows[0].Sha256))
