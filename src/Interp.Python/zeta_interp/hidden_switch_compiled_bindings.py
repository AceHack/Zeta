"""Exact whole-input binding and chronology, separate from phase semantics.

The shared subject validator extracts its metadata from the same original bytes
it binds. A final scientific phase parser must additionally enforce that phase's
complete schema and payload. The seven-subject adapter below exercises this
shared boundary with the reviewed synthetic schema; it is not phase admission.
"""

from __future__ import annotations

import hashlib
import itertools
import re
from dataclasses import dataclass
from typing import Any

from . import hidden_switch_compiled_admission as a

ROLES = ("hand", "certificate", "graph", "behavior", "setup", "cost", "replay")
CONTEXT_FIELDS = frozenset(
    ("ProtocolSha256", "SourceCommit", "NumericCertificateSha256", "NativeRecordSha256")
)
INPUT_FIELDS = frozenset(("Role", "Bytes", "Sha256"))
TIMELINE_FIELDS = (
    "BehaviorFinish",
    "BehaviorClosed",
    "BehaviorExit",
    "CostStarted",
    "BehaviorReadStarted",
    "BehaviorReadFinished",
    "AdmissionFinished",
    "FirstPolicyCall",
    "SetupFinished",
    "FirstRowStarted",
)
_COMMIT = re.compile(r"[0-9a-f]{40}\Z", re.ASCII)


@dataclass(frozen=True)
class BindingContext:
    ProtocolSha256: str
    SourceCommit: str
    NumericCertificateSha256: str
    NativeRecordSha256: str


@dataclass(frozen=True)
class InputBinding:
    Role: str
    Bytes: int
    Sha256: str


@dataclass(frozen=True)
class BindingExpectation:
    """Caller-reviewed expectations; every field is validated before use."""

    Context: Any
    Subject: Any
    UpstreamInputs: Any


@dataclass(frozen=True)
class BindingSubjects:
    Subjects: tuple[InputBinding, ...]
    Timeline: tuple[tuple[str, int], ...]
    Scope: str = "seven-synthetic-binding-subjects-only"
    ScientificPhaseAndRuntimeAdmission: str = "not-performed"


@dataclass(frozen=True)
class BindingSubjectsRefused:
    code: str
    path: str
    detail: str
    CompletedSubjects: int
    Scope: str = "seven-synthetic-binding-subjects-only"
    ScientificPhaseAndRuntimeAdmission: str = "not-performed"


def _context(value: Any, path: str) -> a.Admission[BindingContext]:
    checked = a.exact_keys(value, CONTEXT_FIELDS, path)
    if isinstance(checked, a.Refused):
        return checked
    row = checked.value
    for key in ("ProtocolSha256", "NumericCertificateSha256", "NativeRecordSha256"):
        field = a.sha256(row[key], path + "." + key)
        if isinstance(field, a.Refused):
            return field
    if row["ProtocolSha256"] != a.PROTOCOL_SHA256:
        return a.Refused("binding-protocol", path + ".ProtocolSha256", "wrong protocol")
    commit = row["SourceCommit"]
    if type(commit) is not str or _COMMIT.fullmatch(commit) is None:
        return a.Refused(
            "binding-commit", path + ".SourceCommit", "requires full lowercase commit"
        )
    return a.Admitted(BindingContext(**row))


def _input(value: Any, path: str) -> a.Admission[InputBinding]:
    checked = a.exact_keys(value, INPUT_FIELDS, path)
    if isinstance(checked, a.Refused):
        return checked
    row = checked.value
    if type(row["Role"]) is not str or row["Role"] not in ROLES:
        return a.Refused("input-role", path + ".Role", "requires a declared input role")
    count = a.integer(row["Bytes"], 0, a.INT64_MAX, path + ".Bytes")
    if isinstance(count, a.Refused):
        return count
    digest = a.sha256(row["Sha256"], path + ".Sha256")
    if isinstance(digest, a.Refused):
        return digest
    return a.Admitted(InputBinding(row["Role"], count.value, digest.value))


def _inputs(value: Any, path: str) -> a.Admission[tuple[InputBinding, ...]]:
    if type(value) is not list or len(value) > len(ROLES):
        return a.Refused("input-roster", path, "requires a finite input array")
    rows: list[InputBinding] = []
    for index, row in enumerate(value):
        checked = _input(row, f"{path}[{index}]")
        if isinstance(checked, a.Refused):
            return checked
        if any(prior.Role == checked.value.Role for prior in rows):
            return a.Refused("input-roster", f"{path}[{index}]", "duplicate input role")
        rows.append(checked.value)
    return a.Admitted(tuple(rows))


def _match_input_envelope_bytes(
    original: bytes, expected: InputBinding, path: str
) -> a.Admission[None]:
    """One comparison seam for the separately labeled fixture omission mutant."""
    if (
        len(original) != expected.Bytes
        or hashlib.sha256(original).hexdigest().upper() != expected.Sha256
    ):
        return a.Refused(
            "input-envelope-bytes",
            path,
            "complete input bytes differ from the independent binding",
        )
    return a.Admitted(None)


def admit_binding_subject(
    descriptor: Any,
    stored: bytes,
    original: bytes,
    expected: BindingExpectation,
    *,
    path: str = "Subject",
) -> a.Admission[InputBinding]:
    """Bind complete bytes, then extract and compare their own binding metadata.

    Required common metadata is Role/Context/Inputs. Other phase fields are
    opaque here and must be checked by the phase's exact schema parser. No
    caller-supplied extracted metadata or production omission option is accepted.
    """
    if type(expected) is not BindingExpectation:
        return a.Refused(
            "binding-expectation", path, "requires explicit independent expectations"
        )
    context = _context(expected.Context, path + ".Expected.Context")
    subject = _input(expected.Subject, path + ".Expected.Subject")
    upstream = _inputs(expected.UpstreamInputs, path + ".Expected.UpstreamInputs")
    for checked in (context, subject, upstream):
        if isinstance(checked, a.Refused):
            return checked
    assert (
        isinstance(context, a.Admitted)
        and isinstance(subject, a.Admitted)
        and isinstance(upstream, a.Admitted)
    )
    if any(row.Role == subject.value.Role for row in upstream.value):
        return a.Refused(
            "input-roster",
            path + ".Expected.UpstreamInputs",
            "subject cannot reference itself",
        )
    bound = a.bind_artifact_bytes(descriptor, stored, original, path + ".Artifact")
    if isinstance(bound, a.Refused):
        return bound
    complete = _match_input_envelope_bytes(
        original, subject.value, path + ".Expected.Subject"
    )
    if isinstance(complete, a.Refused):
        return complete
    decoded = a.strict_json(original)
    if isinstance(decoded, a.Refused):
        return decoded
    raw = decoded.value
    if type(raw) is not dict or not {"Role", "Context", "Inputs"}.issubset(raw):
        return a.Refused(
            "binding-metadata",
            path,
            "requires Role, Context and Inputs in the bound bytes",
        )
    if type(raw["Role"]) is not str or raw["Role"] != subject.value.Role:
        return a.Refused(
            "input-role", path + ".Role", "role differs from independent expectation"
        )
    actual_context = _context(raw["Context"], path + ".Context")
    if isinstance(actual_context, a.Refused):
        return actual_context
    if actual_context.value != context.value:
        return a.Refused(
            "binding-context",
            path + ".Context",
            "context differs from independent expectation",
        )
    actual_upstream = _inputs(raw["Inputs"], path + ".Inputs")
    if isinstance(actual_upstream, a.Refused):
        return actual_upstream
    if actual_upstream.value != upstream.value:
        return a.Refused(
            "input-links", path + ".Inputs", "ordered upstream byte bindings differ"
        )
    return subject


def admit_phase_chronology(value: Any) -> a.Admission[tuple[tuple[str, int], ...]]:
    """Check the specified partial order without ordering closure against exit."""
    checked = a.exact_keys(value, frozenset(TIMELINE_FIELDS), "Timeline")
    if isinstance(checked, a.Refused):
        return checked
    stamps: dict[str, int] = {}
    for name in TIMELINE_FIELDS:
        stamp = a.utc_nanoseconds(checked.value[name], "Timeline." + name)
        if isinstance(stamp, a.Refused):
            return stamp
        stamps[name] = stamp.value
    edges = (
        ("BehaviorFinish", "BehaviorClosed"),
        ("BehaviorFinish", "BehaviorExit"),
        ("BehaviorClosed", "CostStarted"),
        ("BehaviorExit", "CostStarted"),
        *itertools.pairwise(TIMELINE_FIELDS[3:]),
    )
    for before, after in edges:
        if stamps[before] > stamps[after]:
            return a.Refused(
                "phase-chronology", "Timeline." + after, f"{after} precedes {before}"
            )
    return a.Admitted(tuple(stamps.items()))


def _expectations(
    value: Any, path: str
) -> a.Admission[tuple[BindingContext, tuple[InputBinding, ...]]]:
    checked = a.exact_keys(value, frozenset(("Context", "Inputs")), path)
    if isinstance(checked, a.Refused):
        return checked
    context = _context(checked.value["Context"], path + ".Context")
    if isinstance(context, a.Refused):
        return context
    inputs = _inputs(checked.value["Inputs"], path + ".Inputs")
    if isinstance(inputs, a.Refused):
        return inputs
    if tuple(row.Role for row in inputs.value) != ROLES:
        return a.Refused(
            "input-roster", path + ".Inputs", "requires the exact seven-role roster"
        )
    return a.Admitted((context.value, inputs.value))


def admit_binding_subjects(
    fixture: Any, expected: Any, artifacts: Any
) -> a.Admitted[BindingSubjects] | BindingSubjectsRefused:
    """Strict reviewed synthetic adapter over the shared whole-input validator.

    artifacts maps each declared File to the actual (stored, original) bytes.
    The caller performs safe file acquisition separately; this pure function
    validates every supplied byte pair and cannot attest to its acquisition.
    """
    completed: list[InputBinding] = []

    def fail(problem: a.Refused) -> BindingSubjectsRefused:
        return BindingSubjectsRefused(
            problem.code, problem.path, problem.detail, len(completed)
        )

    checked = a.exact_keys(
        fixture, frozenset(("Records", "Expected", "Timeline")), "Fixture"
    )
    if isinstance(checked, a.Refused):
        return fail(checked)
    independent = _expectations(expected, "Expected")
    copied = _expectations(checked.value["Expected"], "Fixture.Expected")
    for result in (independent, copied):
        if isinstance(result, a.Refused):
            return fail(result)
    assert isinstance(independent, a.Admitted) and isinstance(copied, a.Admitted)
    if copied.value != independent.value:
        return fail(
            a.Refused(
                "binding-expectation",
                "Fixture.Expected",
                "fixture cannot replace independent expectations",
            )
        )
    rows = checked.value["Records"]
    if type(rows) is not list or len(rows) != len(ROLES):
        return fail(a.Refused("input-roster", "Records", "requires seven records"))
    if type(artifacts) is not dict:
        return fail(
            a.Refused(
                "binding-artifacts", "Artifacts", "requires exact materialized file map"
            )
        )
    files: list[str] = []
    descriptors: list[dict[str, Any]] = []
    for index, role in enumerate(ROLES):
        row = a.exact_keys(
            rows[index], frozenset(("Role", "Artifact")), f"Records[{index}]"
        )
        if isinstance(row, a.Refused):
            return fail(row)
        if type(row.value["Role"]) is not str or row.value["Role"] != role:
            return fail(
                a.Refused(
                    "input-roster", f"Records[{index}].Role", "wrong record role/order"
                )
            )
        descriptor = a.artifact_descriptor(
            row.value["Artifact"], f"Records[{index}].Artifact"
        )
        if isinstance(descriptor, a.Refused):
            return fail(descriptor)
        files.append(descriptor.value["File"])
        descriptors.append(descriptor.value)
    if len(set(files)) != len(files) or artifacts.keys() != set(files):
        return fail(
            a.Refused(
                "binding-artifacts",
                "Artifacts",
                "requires exactly one byte pair per declared file",
            )
        )
    for index, role in enumerate(ROLES):
        path = f"Records[{index}]"
        pair = artifacts[files[index]]
        if (
            type(pair) is not tuple
            or len(pair) != 2
            or any(type(part) is not bytes for part in pair)
        ):
            return fail(
                a.Refused(
                    "binding-artifacts", path, "requires actual stored/original bytes"
                )
            )
        expectation = BindingExpectation(
            expected["Context"], expected["Inputs"][index], expected["Inputs"][:index]
        )
        bound = admit_binding_subject(
            descriptors[index], pair[0], pair[1], expectation, path=path
        )
        if isinstance(bound, a.Refused):
            return fail(bound)
        parsed = a.strict_json(pair[1])
        assert isinstance(
            parsed, a.Admitted
        )  # The same immutable bytes were just parsed.
        schema = a.exact_keys(
            parsed.value, frozenset(("Role", "Context", "Inputs", "Payload")), path
        )
        if isinstance(schema, a.Refused):
            return fail(schema)
        payload = a.exact_keys(
            schema.value["Payload"], frozenset(("Witness",)), path + ".Payload"
        )
        if isinstance(payload, a.Refused):
            return fail(payload)
        witness = a.integer(payload.value["Witness"], 0, 0, path + ".Payload.Witness")
        if isinstance(witness, a.Refused):
            return fail(witness)
        completed.append(bound.value)
    timeline = admit_phase_chronology(checked.value["Timeline"])
    if isinstance(timeline, a.Refused):
        return fail(timeline)
    return a.Admitted(BindingSubjects(tuple(completed), timeline.value))


def require_binding_refusal(
    actual: a.Admitted[BindingSubjects] | BindingSubjectsRefused,
    *,
    code: str,
    path: str,
) -> a.Admission[BindingSubjectsRefused]:
    """Observe the executed negative result, including its exact refusal boundary."""
    if (
        type(actual) is not BindingSubjectsRefused
        or actual.code != code
        or actual.path != path
    ):
        return a.Refused(
            "negative-outcome",
            path,
            "actual operation did not refuse at the required boundary",
        )
    return a.Admitted(actual)
