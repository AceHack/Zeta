"""Fixed, non-I/O coordinator fixtures calling the real shared boundaries.

Preparation creates immutable fixture bytes, never an operation outcome.
Execution returns one actual public result at a time so its caller can retain
each result before starting the next operation. These synthetic fixtures do not
generate a registered tape, measure cost or admit a scientific phase/runtime.
"""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import re
from dataclasses import asdict, dataclass
from typing import Any

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_bindings as b
from . import hidden_switch_compiled_conformance as c
from . import hidden_switch_compiled_cost_ledgers as costs
from . import hidden_switch_compiled_ieee as ieee
from . import hidden_switch_compiled_old_replay as old
from . import hidden_switch_compiled_schedule as schedule


@dataclass(frozen=True, slots=True)
class SupportingArtifact:
    File: str
    Stored: bytes
    Original: bytes


@dataclass(frozen=True, slots=True)
class PreparedCase:
    CaseId: str
    Inputs: tuple[c.NamedInput, ...]
    SupportingArtifacts: tuple[SupportingArtifact, ...] = ()


@dataclass(frozen=True, slots=True)
class JsonFixture:
    Count: int
    ValueBits: str
    Items: tuple[int, int]


STATIC_CASE_IDS = tuple(
    row.CaseId
    for row in c.case_specs()
    if row.CaseId.split("/")[0] in ("json", "links", "schedule", "resources")
    or row.CaseId.startswith("artifact/")
    and row.CaseId not in ("artifact/symlink-path", "artifact/truncated-gzip")
)
JSON_CONTROL = b'{"Count":0,"Value":-0,"Items":[0,1]}'


def _raw(value: Any) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")


def _digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest().upper()


def _descriptor(
    file: str, stored: bytes, original: bytes, encoding: str = "identity"
) -> dict[str, Any]:
    return {
        "File": file,
        "Bytes": len(original),
        "Sha256": _digest(original),
        "Encoding": encoding,
        "StoredBytes": len(stored),
        "StoredSha256": _digest(stored),
    }


def _prepared(
    case_id: str, values: dict[str, bytes], support: tuple[SupportingArtifact, ...] = ()
) -> PreparedCase:
    spec = next(row for row in c.case_specs() if row.CaseId == case_id)
    return PreparedCase(
        case_id,
        tuple(c.NamedInput(role, values[role]) for role in spec.InputRoles),
        support,
    )


def _context(value: object) -> a.Admission[dict[str, Any]]:
    if type(value) is not b.BindingContext:
        return a.Refused(
            "fixture-context", "Context", "requires explicit BindingContext"
        )
    row = asdict(value)
    for key in ("ProtocolSha256", "NumericCertificateSha256", "NativeRecordSha256"):
        checked = a.sha256(row[key], "Context." + key)
        if isinstance(checked, a.Refused):
            return checked
    if row["ProtocolSha256"] != a.PROTOCOL_SHA256:
        return a.Refused(
            "fixture-protocol", "Context.ProtocolSha256", "frozen protocol differs"
        )
    if (
        type(row["SourceCommit"]) is not str
        or re.fullmatch(r"[0-9a-f]{40}", row["SourceCommit"], flags=re.ASCII) is None
    ):
        return a.Refused(
            "fixture-commit", "Context.SourceCommit", "requires full lowercase commit"
        )
    return a.Admitted(row)


def _links(case_id: str, context: dict[str, Any]) -> PreparedCase:
    inputs: list[dict[str, Any]] = []
    records: list[dict[str, Any]] = []
    support: list[SupportingArtifact] = []
    fields = {
        "links/source-substitution": "SourceCommit",
        "links/certificate-substitution": "NumericCertificateSha256",
        "links/runtime-substitution": "NativeRecordSha256",
    }
    for role in b.ROLES:
        actual = copy.deepcopy(context)
        if role == "cost" and case_id in fields:
            field = fields[case_id]
            actual[field] = ("0" if actual[field][0] != "0" else "1") + actual[field][
                1:
            ]
        raw = _raw(
            {
                "Role": role,
                "Context": actual,
                "Inputs": copy.deepcopy(inputs),
                "Payload": {"Witness": 0},
            }
        )
        inputs.append({"Role": role, "Bytes": len(raw), "Sha256": _digest(raw)})
        if role == "replay":
            if case_id == "links/envelope-substitution":
                raw = b" " + raw
            elif case_id == "links/replay-substitution":
                raw = raw.replace(b'"Witness"', b'"\\u0057itness"')
        file = role + ".json"
        records.append({"Role": role, "Artifact": _descriptor(file, raw, raw)})
        support.append(SupportingArtifact(file, raw, raw))
    expected = {"Context": context, "Inputs": inputs}
    if case_id == "links/reordered-inputs":
        records[-2], records[-1] = records[-1], records[-2]
        inputs[-2], inputs[-1] = inputs[-1], inputs[-2]
    timeline = {
        key: f"2026-09-07T00:00:00.{index + 1:09d}Z"
        for index, key in enumerate(b.TIMELINE_FIELDS)
    }
    if case_id == "links/cost-before-behavior":
        timeline["CostStarted"] = "2026-09-07T00:00:00.000000000Z"
    fixture = {
        "Records": records,
        "Expected": copy.deepcopy(expected),
        "Timeline": timeline,
    }
    return _prepared(
        case_id, {"fixture": _raw(fixture), "expected": _raw(expected)}, tuple(support)
    )


def prepare_static_case(
    case_id: object, *, context: object = None
) -> a.Admission[PreparedCase]:
    """Prepare only a source-fixed case; link cases require the caller's context."""
    if type(case_id) is not str or case_id not in STATIC_CASE_IDS:
        return a.Refused(
            "fixture-case", "CaseId", "requires one of the 32 static cases"
        )
    family, name = case_id.split("/")
    if family == "json":
        variants = {
            "control": JSON_CONTROL,
            "duplicate-key": JSON_CONTROL.replace(b'"Count":0', b'"Count":0,"Count":0'),
            "nonfinite": JSON_CONTROL.replace(b'"Value":-0', b'"Value":NaN'),
            "bool-integer": JSON_CONTROL.replace(b'"Count":0', b'"Count":false'),
            "extra-key": JSON_CONTROL[:-1] + b',"Extra":0}',
            "missing-key": JSON_CONTROL.replace(b'"Count":0,', b""),
            "truncated": JSON_CONTROL[:-1],
            "invalid-utf8": JSON_CONTROL.replace(b"Count", b"\xffount"),
        }
        return a.Admitted(_prepared(case_id, {"raw": variants[name]}))
    if family == "artifact":
        original = b"ABC"
        stored = gzip.compress(original, mtime=0)
        descriptor = _descriptor("fixture.bin.gz", stored, original, "gzip")
        if name == "control":
            return a.Admitted(
                _prepared(
                    case_id,
                    {
                        "descriptor-identity": _raw(
                            _descriptor("fixture.bin", original, original)
                        ),
                        "stored-identity": original,
                        "original": original,
                        "descriptor-gzip": _raw(descriptor),
                        "stored-gzip": stored,
                    },
                )
            )
        if name == "stored-hash":
            descriptor["StoredSha256"] = "0" * 64
        elif name == "original-hash":
            original = b"ABD"
        elif name == "unrelated-gzip":
            stored = gzip.compress(b"ABD", mtime=0)
            descriptor["StoredBytes"] = len(stored)
            descriptor["StoredSha256"] = _digest(stored)
        elif name == "parent-path":
            descriptor["File"] = "../escape.bin"
        return a.Admitted(
            _prepared(
                case_id,
                {
                    "descriptor": _raw(descriptor),
                    "stored": stored,
                    "original": original,
                },
            )
        )
    if family == "links":
        checked = _context(context)
        return (
            checked
            if isinstance(checked, a.Refused)
            else a.Admitted(_links(case_id, checked.value))
        )
    if family == "schedule":
        rows = [asdict(row) for row in schedule.cost_schedule()]
        if name == "omitted":
            rows.pop()
        elif name == "reordered":
            rows[0], rows[1] = rows[1], rows[0]
            rows[0]["Index"], rows[1]["Index"] = 0, 1
        elif name == "warmup":
            rows[0]["WarmupCalls"] += 1
        elif name == "duplicate":
            rows[1] = copy.deepcopy(rows[0])
            rows[1]["Index"] = 1
        return a.Admitted(_prepared(case_id, {"headers": _raw(rows)}))
    timing: dict[str, Any] = {
        "WallNs": 1,
        "CpuNs": 0,
        "AllocatedBytes": 0,
        "GcBefore": [0, 0, 0],
        "GcAfter": [0, 0, 0],
        "GcDelta": [0, 0, 0],
    }
    if name == "zero-wall":
        timing["WallNs"] = 0
    elif name == "negative-allocation":
        timing["AllocatedBytes"] = -1
    elif name == "decreasing-gc":
        timing["GcBefore"][0] = 1
    values = {
        "timing": _raw(timing),
        "cpu": _raw({"Kind": "cpu", "Numerator": 0, "Denominator": 0}),
        "allocation": _raw({"Kind": "allocation", "Numerator": 0, "Denominator": 1}),
        "compiled": _raw([0] * 5),
        "native": _raw([0 if name == "zero-native-allocation" else 2**54] * 5),
        "compiled-at-half": _raw([2**53] * 5),
        "compiled-above-half": _raw([2**53 + 1] * 5),
    }
    return a.Admitted(_prepared(case_id, values))


def json_fixture_pipeline(raw: bytes) -> object:
    """Preserve each actual boundary refusal and negative-zero value bits."""
    decoded = a.strict_json(raw)
    if isinstance(decoded, a.Refused):
        return decoded
    keys = a.exact_keys(decoded.value, frozenset(("Count", "Value", "Items")), "Raw")
    if isinstance(keys, a.Refused):
        return keys
    count = a.integer(keys.value["Count"], 0, a.INT64_MAX, "Raw.Count")
    if isinstance(count, a.Refused):
        return count
    bits = old.decode_old_number_bits(keys.value["Value"])
    if isinstance(bits, ieee.Failure):
        return bits
    if bits.value != 0x8000000000000000:
        return a.Refused(
            "fixture-negative-zero", "Raw.Value", "requires lexical negative zero"
        )
    items = keys.value["Items"]
    if type(items) is not list or len(items) != 2:
        return a.Refused("fixture-items", "Raw.Items", "requires two ordered integers")
    for index, item in enumerate(items):
        checked = a.integer(item, index, index, f"Raw.Items[{index}]")
        if isinstance(checked, a.Refused):
            return checked
    return a.Admitted(
        JsonFixture(count.value, f"{bits.value:016X}", (items[0], items[1]))
    )


def execute_static_call(
    case_id: object,
    call_index: object,
    inputs: tuple[c.NamedInput, ...],
    support: tuple[SupportingArtifact, ...] = (),
) -> object:
    """Dispatch one fixed operation over actual retained bytes, without replaying preparation.

    The caller must independently compare fixture bytes with their source-fixed
    preparation and retain support artifacts and this entire returned result.
    Neither a passed preparation nor this dispatch authenticates those inputs.
    """
    if type(case_id) is not str or case_id not in STATIC_CASE_IDS:
        return a.Refused("fixture-case", "CaseId", "requires fixed static case")
    spec = next(row for row in c.case_specs() if row.CaseId == case_id)
    index = a.integer(call_index, 0, len(spec.Calls) - 1, "CallIndex")
    if isinstance(index, a.Refused):
        return index
    if type(inputs) is not tuple or any(
        type(row) is not c.NamedInput
        or type(row.Role) is not str
        or type(row.Raw) is not bytes
        for row in inputs
    ):
        return a.Refused(
            "fixture-inputs", "Inputs", "requires exact immutable named bytes"
        )
    if tuple(row.Role for row in inputs) != spec.InputRoles:
        return a.Refused("fixture-inputs", "Inputs", "requires exact case role order")
    if type(support) is not tuple or any(
        type(row) is not SupportingArtifact
        or type(row.File) is not str
        or type(row.Stored) is not bytes
        or type(row.Original) is not bytes
        for row in support
    ):
        return a.Refused(
            "fixture-support", "Support", "requires immutable support bytes"
        )
    if (
        len({row.File for row in support}) != len(support)
        or support
        and not case_id.startswith("links/")
    ):
        return a.Refused("fixture-support", "Support", "duplicate or unrelated support")
    actual = {row.Role: row.Raw for row in inputs}
    operation = spec.Calls[index.value]
    roles = operation.InputRoles
    if operation.Operation == "json-fixture-pipeline":
        return json_fixture_pipeline(actual[roles[0]])
    decoded: dict[str, Any] = {}
    raw_roles = {"stored", "original", "stored-identity", "stored-gzip"}
    for role in roles:
        if role in raw_roles:
            continue
        result = a.strict_json(actual[role])
        if isinstance(result, a.Refused):
            return result
        decoded[role] = result.value
    if operation.Operation == "bind-artifact":
        return a.bind_artifact_bytes(
            decoded[roles[0]], actual[roles[1]], actual[roles[2]], "Descriptor"
        )
    if operation.Operation == "artifact-descriptor":
        return a.artifact_descriptor(decoded[roles[0]], "Descriptor")
    if operation.Operation == "admit-binding-subjects":
        return b.admit_binding_subjects(
            decoded["fixture"],
            decoded["expected"],
            {row.File: (row.Stored, row.Original) for row in support},
        )
    if operation.Operation == "admit-cost-schedule":
        return schedule.admit_cost_schedule(decoded["headers"])
    if operation.Operation == "admit-timing":
        return a.timing(decoded["timing"], "Timing", measured=True)
    if operation.Operation == "descriptive-ratio":
        row = a.exact_keys(
            decoded[roles[0]], frozenset(("Kind", "Numerator", "Denominator")), "Ratio"
        )
        if isinstance(row, a.Refused):
            return row
        return costs.descriptive_ratio(
            row.value["Numerator"], row.value["Denominator"], row.value["Kind"], "Ratio"
        )
    if operation.Operation == "half-median":
        return a.half_median(decoded[roles[0]], decoded[roles[1]], "RequiredMedian")
    return a.Refused(
        "fixture-operation", "Operation", "unimplemented fixed static operation"
    )
