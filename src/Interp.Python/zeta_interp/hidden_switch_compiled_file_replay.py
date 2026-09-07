"""Fresh fixed file operations with explicit stable observation comparison.

Original paths are data and never opened. Absolute roots, device/inode numbers,
permission bits, timestamps and directory sizes remain in the retained raw
records; only their declared associations and bounded shapes are compared.
This executes one of seven conformance cases, never scientific sources.
"""

from __future__ import annotations

import stat
from collections.abc import Callable
from dataclasses import dataclass, fields, replace
from functools import partial
from pathlib import Path
from typing import Any

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_conformance as c
from . import hidden_switch_compiled_file_fixtures as f
from . import hidden_switch_compiled_record_encoding as encoding

MAX_RESULT_BYTES = 1024 * 1024
_STATE_TYPE = f.FileState.__module__ + "." + f.FileState.__qualname__
_FAULT_TYPE = f.FaultObservation.__module__ + "." + f.FaultObservation.__qualname__
_STATE_FIELDS = frozenset(x.name for x in fields(f.FileState))
_FAULT_FIELDS = frozenset(x.name for x in fields(f.FaultObservation))


@dataclass(frozen=True, slots=True)
class RecordedCall:
    Operation: str
    InputRoles: tuple[str, ...]
    ResultRaw: bytes


@dataclass(frozen=True, slots=True)
class RecordedFileCase:
    CaseId: str
    Inputs: tuple[c.NamedInput, ...]
    Calls: tuple[RecordedCall, ...]


@dataclass(frozen=True, slots=True)
class Observation:
    Returned: object
    RaisedType: str | None = None
    RaisedDetail: str | None = None


@dataclass(frozen=True, slots=True)
class ResultComparison:
    ActualEncoding: Observation
    RecordedParsing: Observation | None = None
    RecordedEncoding: Observation | None = None
    Matched: bool = False


@dataclass(frozen=True, slots=True)
class ReplayedCall:
    Index: int
    Recorded: object
    Actual: Observation
    Comparison: ResultComparison | None = None


@dataclass(frozen=True, slots=True)
class InputComparison:
    Role: str
    RecordedProjection: object
    ActualProjection: object
    Matched: bool


@dataclass(frozen=True, slots=True)
class FileReplay:
    FixedCaseId: object
    Recorded: object
    ProducerRoot: object
    ReplayParent: object
    Preparation: Observation | None
    Calls: tuple[ReplayedCall, ...]
    ActualInputs: Observation | None
    InputComparisons: tuple[InputComparison, ...]
    CompletedOperations: int
    MatchedCalls: int
    CaseMatched: bool
    Failure: a.Refused | None
    Scope: str = "one-fixed-owned-file-case-with-fresh-operations"
    OuterSourceAndRuntimeAdmission: str = "not-performed"


def _observe(call: Callable[[], object]) -> Observation:
    try:
        return Observation(call())
    except Exception as error:  # noqa: BLE001 - preserve ordinary boundary exceptions without inventing API returns
        kind = type(error)
        return Observation(None, kind.__module__ + "." + kind.__qualname__, str(error))


def _raw(observed: Observation) -> bytes | None:
    value = observed.Returned
    if (
        observed.RaisedType is None
        and type(value) is a.Admitted
        and type(value.value) is bytes
    ):
        return value.value
    return None


def _compare_result(original: bytes, actual: object) -> ResultComparison:
    encoded = _observe(
        lambda: encoding.encode_public_result(actual, maximum_bytes=MAX_RESULT_BYTES)
    )
    result = ResultComparison(encoded)
    if _raw(encoded) is None:
        return result
    parsed = _observe(lambda: a.strict_json(original))
    result = replace(result, RecordedParsing=parsed)
    if parsed.RaisedType is not None or type(parsed.Returned) is not a.Admitted:
        return result
    tree = parsed.Returned.value
    reencoded = _observe(
        lambda: encoding.encode_public_result(tree, maximum_bytes=MAX_RESULT_BYTES)
    )
    return replace(
        result,
        RecordedEncoding=reencoded,
        Matched=_raw(reencoded) is not None and _raw(encoded) == _raw(reencoded),
    )


class _ProjectionRefusal(Exception):
    pass


class _Projection:
    def __init__(self, target: str):
        self.target = target
        self.identities: dict[str, tuple[int, int]] = {}
        self.faults: list[tuple[int, int]] = []

    @staticmethod
    def integer(value: object, upper: int = a.INT64_MAX) -> int:
        if type(value) is not int or not 0 <= value <= upper:
            raise _ProjectionRefusal(
                "OS observation requires a bounded exact nonnegative integer"
            )
        return value

    def pair(self, row: dict[str, Any]) -> tuple[int, int]:
        return self.integer(row["Device"]), self.integer(row["Inode"])

    def state(self, row: object) -> dict[str, Any]:
        if type(row) is not dict or frozenset(row) != _STATE_FIELDS:
            raise _ProjectionRefusal("complete FileState fields required")
        result = dict(row)
        name = row["File"]
        if type(name) is not str or name not in (
            "attempt",
            "attempt/file.bin",
            "file.bin",
            "file.gz",
            "sibling.bin",
        ):
            raise _ProjectionRefusal("file observation is outside fixed logical paths")
        kind = row["Kind"]
        if kind == "absent":
            if any(row[key] is not None for key in _STATE_FIELDS - {"File", "Kind"}):
                raise _ProjectionRefusal("absent file cannot carry metadata or content")
            return result
        if kind not in ("regular", "directory", "symlink"):
            raise _ProjectionRefusal("unsupported observed file kind")
        pair = self.pair(row)
        if name in self.identities and self.identities[name] != pair:
            raise _ProjectionRefusal("one logical file changes device/inode identity")
        if any(
            other != name and observed == pair
            for other, observed in self.identities.items()
        ):
            raise _ProjectionRefusal(
                "distinct fixed files share one device/inode identity"
            )
        self.identities[name] = pair
        mode = self.integer(row["Mode"], 0xFFFF)
        wanted = {
            "regular": stat.S_IFREG,
            "directory": stat.S_IFDIR,
            "symlink": stat.S_IFLNK,
        }[kind]
        if stat.S_IFMT(mode) != wanted:
            raise _ProjectionRefusal("mode type disagrees with file kind")
        self.integer(row["ModifiedNs"])
        self.integer(row["ChangedNs"])
        size = self.integer(row["Bytes"])
        if kind != "directory" and size > f.MAX_FILE_BYTES:
            raise _ProjectionRefusal("fixed leaf exceeds fixture bound")
        result.update(
            Device="identity:" + name,
            Inode="identity:" + name,
            Mode=wanted,
            ModifiedNs="retained-os-time",
            ChangedNs="retained-os-time",
        )
        if kind == "directory":
            if row["Content"] is not None or row["SymlinkTarget"] is not None:
                raise _ProjectionRefusal(
                    "directory cannot carry file content or link target"
                )
            result["Bytes"] = "retained-directory-size"
        return result

    def visit(self, value: Any) -> Any:
        if type(value) is list:
            return [self.visit(item) for item in value]
        if type(value) is not dict:
            return value
        if value.get("Type") in (_STATE_TYPE, _FAULT_TYPE):
            if set(value) != {"Type", "Fields"}:
                raise _ProjectionRefusal(
                    "typed observation has extra or missing members"
                )
            if value["Type"] == _STATE_TYPE:
                return {"Type": _STATE_TYPE, "Fields": self.state(value["Fields"])}
            row = value["Fields"]
            if type(row) is not dict or frozenset(row) != _FAULT_FIELDS:
                raise _ProjectionRefusal("complete FaultObservation fields required")
            pair = self.pair(row)
            self.faults.append(pair)
            return {
                "Type": _FAULT_TYPE,
                "Fields": {
                    **row,
                    "Device": "identity:" + self.target,
                    "Inode": "identity:" + self.target,
                },
            }
        return {key: self.visit(item) for key, item in value.items()}


def _fixture_projection(raw: bytes, case_id: str, root: Path) -> a.Admission[bytes]:
    parsed = a.strict_json(raw)
    if isinstance(parsed, a.Refused):
        return parsed
    row = parsed.value
    if type(row) is not dict or set(row) != {
        "Schema",
        "CaseId",
        "Root",
        "Target",
        "Audit",
    }:
        return a.Refused(
            "file-audit-shape", "Fixture", "exact file fixture schema required"
        )
    target = (
        "attempt"
        if case_id == "storage/reused-attempt"
        else "attempt/file.bin"
        if case_id == "storage/control"
        else "file.gz"
        if case_id == "artifact/truncated-gzip"
        else "file.bin"
    )
    if (
        row["Schema"] != "zeta.hidden-switch.compiled.file-fixture.v1"
        or row["CaseId"] != case_id
        or row["Root"] != str(root)
        or row["Target"] != target
    ):
        return a.Refused(
            "file-audit-binding",
            "Fixture",
            "fixed schema/case/target and independent root required",
        )
    projection = _Projection(target)
    try:
        audit = projection.visit(row["Audit"])
        if any(pair != projection.identities.get(target) for pair in projection.faults):
            raise _ProjectionRefusal(
                "fault does not identify its actual logical target"
            )
    except _ProjectionRefusal as error:
        return a.Refused("file-audit-observation", "Fixture.Audit", str(error))
    return encoding.encode_public_result(
        {**row, "Root": "independent-owned-case-root", "Audit": audit},
        maximum_bytes=MAX_RESULT_BYTES,
    )


def _expected_outcome(case_id: str, index: int, actual: object) -> bool:
    code = (
        "file-read"
        if case_id == "artifact/symlink-path"
        else "artifact-gzip"
        if case_id == "artifact/truncated-gzip"
        else "file-changed"
        if case_id == "storage/changed-read"
        else "file-write"
        if case_id == "storage/partial-write" and index == 0
        else "existing-output"
        if index == 1
        and case_id
        in ("storage/reused-attempt", "storage/reused-file", "storage/partial-write")
        else None
    )
    return (
        type(actual) is a.Admitted
        if code is None
        else type(actual) is a.Refused and actual.code == code
    )


def replay_file_case(
    record: object,
    replay_parent: object,
    *,
    fixed_case_id: object,
    producer_root: object,
) -> FileReplay:
    """Execute the fixed present-call prefix once; never open a recorded path."""
    calls: list[ReplayedCall] = []
    comparisons: list[InputComparison] = []
    prepared: Observation | None = None
    inputs: Observation | None = None
    completed = matched = 0

    def finish(
        code: str | None, path: str = "Case", detail: str = "fixed file replay refused"
    ) -> FileReplay:
        return FileReplay(
            fixed_case_id,
            record,
            producer_root,
            replay_parent,
            prepared,
            tuple(calls),
            inputs,
            tuple(comparisons),
            completed,
            matched,
            code is None,
            None if code is None else a.Refused(code, path, detail),
        )

    if (
        type(fixed_case_id) is not str
        or fixed_case_id not in f.FILE_CASE_IDS
        or type(record) is not RecordedFileCase
        or type(record.CaseId) is not str
        or record.CaseId != fixed_case_id
    ):
        return finish("file-case")
    name = record.CaseId.replace("/", "-")
    if (
        not isinstance(producer_root, Path)
        or not producer_root.is_absolute()
        or producer_root.name != name
        or str(producer_root) != producer_root.as_posix()
        or ".." in producer_root.parts
    ):
        return finish(
            "file-producer-root",
            "ProducerRoot",
            "independent absolute fixed case root required",
        )
    if not isinstance(replay_parent, Path) or not replay_parent.is_absolute():
        return finish("file-replay-root")
    if type(record.Calls) is not tuple:
        return finish("file-calls")
    spec = next(row for row in c.case_specs() if row.CaseId == record.CaseId)
    prepared = _observe(
        lambda: f.prepare_file_fixture(record.CaseId, replay_parent / name)
    )
    fixture = prepared.Returned
    if prepared.RaisedType is not None or type(fixture) is not f.PreparedFileFixture:
        return finish("file-preparation")
    if fixture.CaseId != fixed_case_id or fixture.Root != replay_parent / name:
        return finish("file-preparation-contract")
    actual_rows: list[f.FileCallObservation] = []
    for index, operation in enumerate(spec.Calls):
        if index >= len(record.Calls):
            return finish("file-missing-call", f"Calls[{index}]")
        actual = _observe(partial(f.execute_file_call, fixture, index))
        row = actual.Returned
        calls.append(ReplayedCall(index, record.Calls[index], actual))
        if actual.RaisedType is not None or type(row) is not f.FileCallObservation:
            return finish("file-call-return", f"Calls[{index}]")
        actual_rows.append(row)
        if type(row.CompletedOperation) is int and row.CompletedOperation == 1:
            completed += 1
        if (
            row.Failure is not None
            or type(row.CompletedOperation) is not int
            or row.CompletedOperation != 1
            or type(row.Index) is not int
            or row.Index != index
            or row.CaseId != record.CaseId
            or row.Operation != operation.Operation
            or row.InputRoles != operation.InputRoles
            or not _expected_outcome(record.CaseId, index, row.ActualResult)
        ):
            return finish(
                "file-actual-outcome",
                f"Calls[{index}]",
                "actual fixed operation or its after-audit did not produce the required outcome",
            )
        old = record.Calls[index]
        if (
            type(old) is not RecordedCall
            or type(old.Operation) is not str
            or old.Operation != operation.Operation
            or type(old.InputRoles) is not tuple
            or old.InputRoles != operation.InputRoles
            or any(type(role) is not str for role in old.InputRoles)
        ):
            return finish("file-operation", f"Calls[{index}]")
        if type(old.ResultRaw) is not bytes or len(old.ResultRaw) > MAX_RESULT_BYTES:
            return finish("file-result-bound", f"Calls[{index}]")
        comparison = _compare_result(old.ResultRaw, row.ActualResult)
        calls[-1] = replace(calls[-1], Comparison=comparison)
        if not comparison.Matched:
            return finish("file-result-mismatch", f"Calls[{index}]")
        matched += 1
    if len(record.Calls) != len(spec.Calls):
        return finish("file-extra-call")
    inputs = _observe(lambda: f.file_fixture_inputs(fixture, tuple(actual_rows)))
    actual_inputs = inputs.Returned
    if (
        inputs.RaisedType is not None
        or type(actual_inputs) is not a.Admitted
        or type(actual_inputs.value) is not tuple
    ):
        return finish("file-input-capture")
    if len(actual_inputs.value) != len(spec.InputRoles) or any(
        type(value) is not c.NamedInput
        or type(value.Role) is not str
        or type(value.Raw) is not bytes
        or value.Role != role
        or len(value.Raw) > f.MAX_FIXTURE_BYTES
        for value, role in zip(actual_inputs.value, spec.InputRoles, strict=True)
    ):
        return finish("file-input-capture-contract")
    if type(record.Inputs) is not tuple or len(record.Inputs) != len(
        actual_inputs.value
    ):
        return finish("file-inputs")
    for recorded_input, fresh in zip(record.Inputs, actual_inputs.value, strict=True):
        if (
            type(recorded_input) is not c.NamedInput
            or type(recorded_input.Role) is not str
            or recorded_input.Role != fresh.Role
            or type(recorded_input.Raw) is not bytes
            or len(recorded_input.Raw) > f.MAX_FIXTURE_BYTES
        ):
            return finish("file-inputs")
        if fresh.Role == "fixture":
            original = _observe(
                partial(
                    _fixture_projection,
                    recorded_input.Raw,
                    record.CaseId,
                    producer_root,
                )
            )
            replayed = _observe(
                partial(_fixture_projection, fresh.Raw, record.CaseId, fixture.Root)
            )
            same = _raw(original) is not None and _raw(original) == _raw(replayed)
            comparisons.append(InputComparison(fresh.Role, original, replayed, same))
        else:
            same = recorded_input.Raw == fresh.Raw
            comparisons.append(
                InputComparison(fresh.Role, recorded_input.Raw, fresh.Raw, same)
            )
        if not same:
            return finish("file-input-mismatch", "Inputs." + fresh.Role)
    return finish(None)
