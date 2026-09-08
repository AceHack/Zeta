"""Fixed coordinator case/operation contracts and lossless public-result trees.

This module runs no fixtures, policies or source generators. A checked record
prefix is structural evidence only; its actual operation outcomes and source
identities must be independently replayed before conformance admission.
"""

from __future__ import annotations

import dataclasses
import math
from dataclasses import dataclass
from typing import Any, cast

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_certificate_cases as certificate_cases


@dataclass(frozen=True, slots=True)
class NamedInput:
    Role: str
    Raw: bytes


@dataclass(frozen=True, slots=True)
class CallResult:
    Operation: str
    InputRoles: tuple[str, ...]
    Result: object


@dataclass(frozen=True, slots=True)
class OperationSpec:
    Operation: str
    InputRoles: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class CaseSpec:
    CaseId: str
    ControlId: str | None
    Calls: tuple[OperationSpec, ...]

    @property
    def InputRoles(self) -> tuple[str, ...]:
        return tuple(
            dict.fromkeys(role for call in self.Calls for role in call.InputRoles)
        )


def _op(name: str, *roles: str) -> OperationSpec:
    return OperationSpec(name, roles)


def case_specs() -> tuple[CaseSpec, ...]:
    """The reviewed 92-case order, with exactly 136 counted operation entries."""
    rows: list[CaseSpec] = []

    def add(name: str, control: str | None, *calls: OperationSpec) -> None:
        rows.append(CaseSpec(name, control, calls))

    for name in certificate_cases.CASE_IDS:
        add(
            "certificate/" + name,
            None if name == "baseline" else "certificate/baseline",
            _op("python-certificate-verify", "raw", "bindings"),
            _op("native-certificate-verify", "raw", "bindings"),
        )
    add(
        "semantic/full-hand",
        None,
        _op("semantic-falsifier-replay", "hand-slices", "semantic", "certificate"),
    )
    add(
        "selector/epsilon-tie",
        None,
        _op("selector-witness-replay", "witness", "certificate"),
    )
    for name in (
        "control",
        "duplicate-key",
        "nonfinite",
        "bool-integer",
        "extra-key",
        "missing-key",
        "truncated",
        "invalid-utf8",
    ):
        add(
            "json/" + name,
            None if name == "control" else "json/control",
            _op("json-fixture-pipeline", "raw"),
        )
    add(
        "artifact/control",
        None,
        _op("bind-artifact", "descriptor-identity", "stored-identity", "original"),
        _op("bind-artifact", "descriptor-gzip", "stored-gzip", "original"),
    )
    for name in ("stored-hash", "original-hash", "unrelated-gzip"):
        add(
            "artifact/" + name,
            "artifact/control",
            _op("bind-artifact", "descriptor", "stored", "original"),
        )
    add(
        "artifact/parent-path",
        "artifact/control",
        _op("artifact-descriptor", "descriptor"),
    )
    for name in ("symlink-path", "truncated-gzip"):
        add(
            "artifact/" + name,
            "artifact/control",
            _op("read-artifact", "fixture", "descriptor"),
        )
    for name in (
        "control",
        "current-bytes",
        "wrong-archive",
        "omitted-helper",
        "reordered",
        "unarchived-helper",
        "symlink",
    ):
        add(
            "source/" + name,
            None if name == "control" else "source/control",
            _op("verify-source-files", "fixture", "expected"),
        )
    for name in (
        "control",
        "foreign-entry",
        "foreign-helper",
        "missing-helper",
        "unlisted-module",
        "dynamic-module",
        "changed-origin",
        "changed-bytes",
    ):
        add(
            "python/" + name,
            None if name == "control" else "python/control",
            _op("python-identity-child", "fixture", "expected"),
        )
    add(
        "storage/control",
        None,
        _op("create-directory", "fixture"),
        _op("write-exclusive", "fixture", "original"),
    )
    add(
        "storage/reused-attempt",
        "storage/control",
        _op("create-directory", "fixture"),
        _op("create-directory", "fixture"),
    )
    for name in ("reused-file", "partial-write"):
        add(
            "storage/" + name,
            "storage/control",
            _op("write-exclusive", "fixture", "original"),
            _op("write-exclusive", "fixture", "replacement"),
        )
    add(
        "storage/changed-read",
        "storage/control",
        _op("read-exact", "fixture", "expected"),
    )
    for name in (
        "control",
        "envelope-substitution",
        "source-substitution",
        "certificate-substitution",
        "runtime-substitution",
        "reordered-inputs",
        "cost-before-behavior",
        "replay-substitution",
    ):
        add(
            "links/" + name,
            None if name == "control" else "links/control",
            _op("admit-binding-subjects", "fixture", "expected"),
        )
    for name in ("control", "late-counter", "truncated", "reordered", "reserved-byte"):
        add(
            "choice/" + name,
            None if name == "control" else "choice/control",
            _op("replay-choice-buffer", "native-buffer", "tuples", "context"),
            _op("replay-choice-buffer", "compiled-buffer", "tuples", "context"),
        )
    for name in ("control", "omitted", "reordered", "warmup", "duplicate"):
        add(
            "schedule/" + name,
            None if name == "control" else "schedule/control",
            _op("admit-cost-schedule", "headers"),
        )
    add(
        "resources/control",
        None,
        _op("admit-timing", "timing"),
        _op("descriptive-ratio", "cpu"),
        _op("descriptive-ratio", "allocation"),
    )
    for name in ("zero-wall", "negative-allocation", "decreasing-gc"):
        add("resources/" + name, "resources/control", _op("admit-timing", "timing"))
    add(
        "resources/zero-native-allocation",
        "resources/control",
        _op("half-median", "compiled", "native"),
    )
    add(
        "resources/half-threshold",
        "resources/control",
        _op("half-median", "compiled-at-half", "native"),
        _op("half-median", "compiled-above-half", "native"),
    )
    return tuple(rows)


@dataclass(frozen=True, slots=True)
class CasePrefix:
    Cases: int
    Calls: int
    RetainedCaseRows: int
    Scope: str = "coordinator-case-structure-only"
    OutcomeReplay: str = "not-performed"


@dataclass(frozen=True, slots=True)
class CasePrefixRefused:
    code: str
    path: str
    detail: str
    CheckedRows: int
    CheckedCalls: int


def admit_case_prefix(
    records: Any, completed: Any, *, complete: Any
) -> a.Admitted[CasePrefix] | CasePrefixRefused:
    """Validate exact fixed headers and retain the structurally checked prefix.

    A failed final case can contain zero through all of its completed calls;
    the case does not become accepted merely because its calls returned. A
    failure after all 92 cases may still retain all 136 calls with Complete=false.
    Scientific outcomes, referenced bytes and source admission are separate.
    """
    checked_rows = checked_calls = 0

    def fail(problem: a.Refused) -> CasePrefixRefused:
        return CasePrefixRefused(
            problem.code, problem.path, problem.detail, checked_rows, checked_calls
        )

    if type(complete) is not bool:
        return fail(a.Refused("case-complete", "Complete", "requires exact boolean"))
    counts = a.exact_keys(completed, frozenset(("Cases", "Calls")), "Completed")
    if isinstance(counts, a.Refused):
        return fail(counts)
    cases = a.integer(counts.value["Cases"], 0, 92, "Completed.Cases")
    calls = a.integer(counts.value["Calls"], 0, 136, "Completed.Calls")
    for result in (cases, calls):
        if isinstance(result, a.Refused):
            return fail(result)
    assert isinstance(cases, a.Admitted) and isinstance(calls, a.Admitted)
    if complete and (cases.value, calls.value) != (92, 136):
        return fail(
            a.Refused(
                "case-complete",
                "Completed",
                "complete conformance requires 92 cases and 136 calls",
            )
        )
    if type(records) is not list or not cases.value <= len(records) <= min(
        92, cases.value + int(not complete)
    ):
        return fail(
            a.Refused(
                "case-roster",
                "Cases",
                "requires the whole accepted prefix and at most one failed-case row",
            )
        )
    specs = case_specs()
    for index, raw in enumerate(records):
        spec = specs[index]
        path = f"Cases[{index}]"
        row = a.exact_keys(
            raw, frozenset(("Index", "CaseId", "ControlId", "Inputs", "Calls")), path
        )
        if isinstance(row, a.Refused):
            return fail(row)
        position = a.integer(row.value["Index"], index, index, path + ".Index")
        if isinstance(position, a.Refused):
            return fail(position)
        if type(row.value["CaseId"]) is not str or row.value["CaseId"] != spec.CaseId:
            return fail(
                a.Refused(
                    "case-id",
                    path + ".CaseId",
                    "case ID/order differs from fixed roster",
                )
            )
        if row.value["ControlId"] != spec.ControlId or type(
            row.value["ControlId"]
        ) is not type(spec.ControlId):
            return fail(
                a.Refused(
                    "case-control",
                    path + ".ControlId",
                    "requires the fixed prior control",
                )
            )
        inputs = row.value["Inputs"]
        if type(inputs) is not list or len(inputs) != len(spec.InputRoles):
            return fail(
                a.Refused(
                    "case-inputs",
                    path + ".Inputs",
                    "requires the exact first-occurrence role union",
                )
            )
        for ordinal, role in enumerate(spec.InputRoles):
            input_path = f"{path}.Inputs[{ordinal}]"
            item = a.exact_keys(
                inputs[ordinal], frozenset(("Role", "Artifact")), input_path
            )
            if isinstance(item, a.Refused):
                return fail(item)
            if type(item.value["Role"]) is not str or item.value["Role"] != role:
                return fail(
                    a.Refused(
                        "case-inputs", input_path + ".Role", "input role/order differs"
                    )
                )
            descriptor = a.artifact_descriptor(
                item.value["Artifact"], input_path + ".Artifact"
            )
            if isinstance(descriptor, a.Refused):
                return fail(descriptor)
        operations = row.value["Calls"]
        required = len(spec.Calls) if index < cases.value else 0
        if type(operations) is not list or not required <= len(operations) <= len(
            spec.Calls
        ):
            return fail(
                a.Refused(
                    "case-calls",
                    path + ".Calls",
                    "requires exact calls or the first failed-case call prefix",
                )
            )
        for ordinal, operation in enumerate(operations):
            call_path = f"{path}.Calls[{ordinal}]"
            expected = spec.Calls[ordinal]
            call = a.exact_keys(
                operation,
                frozenset(("Sequence", "Operation", "InputRoles", "ResultArtifact")),
                call_path,
            )
            if isinstance(call, a.Refused):
                return fail(call)
            sequence = a.integer(
                call.value["Sequence"], ordinal, ordinal, call_path + ".Sequence"
            )
            if isinstance(sequence, a.Refused):
                return fail(sequence)
            if (
                type(call.value["Operation"]) is not str
                or call.value["Operation"] != expected.Operation
            ):
                return fail(
                    a.Refused(
                        "case-operation",
                        call_path + ".Operation",
                        "requires the source-fixed operation",
                    )
                )
            roles = call.value["InputRoles"]
            if (
                type(roles) is not list
                or any(type(role) is not str for role in roles)
                or tuple(roles) != expected.InputRoles
            ):
                return fail(
                    a.Refused(
                        "case-call-inputs",
                        call_path + ".InputRoles",
                        "requires exact ordered call roles",
                    )
                )
            descriptor = a.artifact_descriptor(
                call.value["ResultArtifact"], call_path + ".ResultArtifact"
            )
            if isinstance(descriptor, a.Refused):
                return fail(descriptor)
            checked_calls += 1
        checked_rows += 1
    if checked_calls != calls.value:
        return fail(
            a.Refused(
                "case-counts",
                "Completed.Calls",
                "completed call count differs from retained actual result descriptors",
            )
        )
    return a.Admitted(CasePrefix(cases.value, checked_calls, checked_rows))


def result_tree(value: object) -> a.Admission[Any]:
    """Encode complete public results; refuse opaque or unbounded object graphs.

    Type names are evidence labels only. This function neither decodes them
    into objects nor treats a serialized result as an executed operation.
    Process-local certificate capabilities are deliberately not serializable;
    the certificate operation returns its existing public PythonOutcome instead.
    """
    nodes = 0
    ancestors: set[int] = set()

    def visit(item: object, path: str, depth: int) -> a.Admission[Any]:
        nonlocal nodes
        nodes += 1
        if nodes > 100_000 or depth > 128:
            return a.Refused(
                "result-size", path, "public result exceeds finite encoding bounds"
            )
        if item is None or type(item) in (bool, int):
            return a.Admitted(item)
        if type(item) is float:
            return (
                a.Admitted(item)
                if math.isfinite(item)
                else a.Refused("result-number", path, "nonfinite result number")
            )
        if type(item) is str:
            try:
                raw = item.encode("utf-8", errors="strict")
            except UnicodeEncodeError:
                return a.Refused("result-unicode", path, "unpaired result surrogate")
            return (
                a.Admitted(item)
                if len(raw) <= 16 * 1024 * 1024
                else a.Refused("result-size", path, "result string exceeds bound")
            )
        if type(item) is bytes:
            return (
                a.Admitted({"BytesHex": item.hex().upper()})
                if len(item) <= 16 * 1024 * 1024
                else a.Refused("result-size", path, "result bytes exceed bound")
            )
        marker = id(item)
        if marker in ancestors:
            return a.Refused("result-cycle", path, "cyclic result cannot be encoded")
        ancestors.add(marker)
        try:
            if type(item) in (tuple, list):
                values: list[Any] = []
                for index, child in enumerate(
                    cast(tuple[object, ...] | list[object], item)
                ):
                    checked = visit(child, f"{path}[{index}]", depth + 1)
                    if isinstance(checked, a.Refused):
                        return checked
                    values.append(checked.value)
                return a.Admitted(values)
            if type(item) is dict:
                result: dict[str, Any] = {}
                for key, child in item.items():
                    if type(key) is not str:
                        return a.Refused(
                            "result-key", path, "JSON result key must be text"
                        )
                    key_check = visit(key, path + ".<key>", depth + 1)
                    if isinstance(key_check, a.Refused):
                        return key_check
                    checked = visit(child, path + "." + key, depth + 1)
                    if isinstance(checked, a.Refused):
                        return checked
                    result[key] = checked.value
                return a.Admitted(result)
            if not isinstance(item, type) and dataclasses.is_dataclass(item):
                encoded: dict[str, Any] = {}
                for field in dataclasses.fields(item):
                    checked = visit(
                        getattr(item, field.name), path + "." + field.name, depth + 1
                    )
                    if isinstance(checked, a.Refused):
                        return checked
                    encoded[field.name] = checked.value
                kind = type(item)
                return a.Admitted(
                    {
                        "Type": kind.__module__ + "." + kind.__qualname__,
                        "Fields": encoded,
                    }
                )
            return a.Refused(
                "result-type",
                path,
                "unsupported public result value; no implicit string conversion",
            )
        finally:
            ancestors.remove(marker)

    return visit(value, "$", 0)
