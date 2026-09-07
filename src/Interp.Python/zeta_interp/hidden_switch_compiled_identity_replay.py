"""Fresh replay of fixed identity fixtures with explicit path association.

Original roots are caller-admitted labels, never filesystem inputs. Existing
fixture code alone chooses mutations and operations; actual returns and owned
child output survive subsequent comparison refusal. This is not full outer
source/runtime admission or proof of recorded execution from JSON.
"""

from __future__ import annotations

import copy
import hashlib
import posixpath
import stat
from collections.abc import Callable
from dataclasses import dataclass, fields, replace
from functools import partial
from pathlib import Path
from typing import Any, NoReturn, cast

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_conformance as c
from . import hidden_switch_compiled_identity_fixtures as fixtures
from . import hidden_switch_compiled_record_encoding as encoding
from . import hidden_switch_compiled_storage as storage

MAX_RESULT_BYTES = 1024 * 1024
CHILD_ROLES = ("stdout", "stderr", "trace")
CHILD_FILES = ("process-0001.stdout", "process-0001.stderr", "child-trace.jsonl")
SOURCE_CODES = (
    None,
    "source-bytes",
    "archive-hash",
    "source-roster",
    "source-order",
    "archive-file",
    "file-read",
)
PYTHON_CODES = (
    None,
    "ModuleOrigin",
    "ModuleOrigin",
    "ModuleMissing",
    "UnlistedModule",
    "ModuleIdentity",
    "ModuleOrigin",
    "SourceBytes",
)


@dataclass(frozen=True, slots=True)
class ProducerRoot:
    CaseId: str
    Root: str


@dataclass(frozen=True, slots=True)
class RecordedIdentityCase:
    CaseId: str
    Inputs: tuple[c.NamedInput, ...]
    Operation: str
    InputRoles: tuple[str, ...]
    ResultRaw: bytes
    ChildArtifacts: tuple[c.NamedInput, ...] = ()


@dataclass(frozen=True, slots=True)
class Raised:
    Type: str
    Message: str


@dataclass(frozen=True, slots=True)
class Observation:
    Stage: str
    Returned: object
    Raised: Raised | None


@dataclass(frozen=True, slots=True)
class ChildRead:
    Role: str
    File: str
    Bytes: int | None
    Mode: int | None
    Outcome: Observation | None


@dataclass(frozen=True, slots=True)
class Association:
    ProducerRoot: str
    ReplayRoot: str
    ProducerPid: int | None
    ReplayPid: int | None


@dataclass(frozen=True, slots=True)
class CaseReplay:
    CaseId: str
    Recorded: object
    ReplayRoot: str
    Actual: Observation
    ChildReads: tuple[ChildRead, ...] = ()
    Helpers: tuple[Observation, ...] = ()
    Association: Association | None = None
    Matched: bool = False


@dataclass(frozen=True, slots=True)
class Counts:
    StartedFixtures: int
    ReturnedFixtures: int
    CompletedOperations: int
    MatchedCases: int


@dataclass(frozen=True, slots=True)
class IdentityReplaySucceeded:
    Records: object
    ProducerRoots: object
    Cases: tuple[CaseReplay, ...]
    Counts: Counts
    Scope: str
    OuterSourceAndRuntimeAdmission: str = "not-performed"


@dataclass(frozen=True, slots=True)
class IdentityReplayFailed:
    Failure: a.Refused
    Records: object
    ProducerRoots: object
    Cases: tuple[CaseReplay, ...]
    Counts: Counts
    Scope: str
    OuterSourceAndRuntimeAdmission: str = "not-performed"


class _Stop(Exception):
    def __init__(self, code: str, path: str, detail: str) -> None:
        self.failure = a.Refused(code, path, detail)
        super().__init__(detail)


def _refuse(code: str, path: str, detail: str) -> NoReturn:
    raise _Stop(code, path, detail)


def _observe(stage: str, function: Callable[[], object]) -> Observation:
    try:
        return Observation(stage, function(), None)
    except Exception as error:  # noqa: BLE001 - retain raised public-boundary outcomes
        kind = type(error)
        return Observation(
            stage, None, Raised(kind.__module__ + "." + kind.__qualname__, str(error))
        )


def _root(value: object, path: str) -> str:
    if (
        type(value) is not str
        or not value.startswith("/")
        or value.startswith("//")
        or "\0" in value
        or posixpath.normpath(value) != value
        or value == "/"
    ):
        _refuse(
            "identity-root",
            path,
            "canonical absolute caller-admitted root label required",
        )
    return value


def _shape(value: Any, keys: set[str], path: str) -> dict[str, Any]:
    if type(value) is not dict or value.keys() != keys:
        _refuse("identity-shape", path, "exact declared object fields required")
    return cast(dict[str, Any], value)


def _data(value: Any, cls: type[Any], path: str) -> dict[str, Any]:
    row = _shape(value, {"Type", "Fields"}, path)
    if row["Type"] != cls.__module__ + "." + cls.__qualname__:
        _refuse("identity-type", path, "wrong public result type label")
    return _shape(
        row["Fields"], {field.name for field in fields(cls)}, path + ".Fields"
    )


def _fixed(value: Any, expected: Any, path: str) -> None:
    # Strictly decoded or independently constructed plain values, no type loading.
    left = encoding.encode_public_result(value, maximum_bytes=fixtures.FILE_BYTES)
    right = encoding.encode_public_result(expected, maximum_bytes=fixtures.FILE_BYTES)
    if (
        not isinstance(left, a.Admitted)
        or not isinstance(right, a.Admitted)
        or left.value != right.value
    ):
        _refuse("identity-mismatch", path, "differs from fixed expected value")


def _at(
    row: dict[str, Any], key: str, expected: str, normalized: str, path: str
) -> None:
    if type(row.get(key)) is not str or row[key] != expected:
        _refuse(
            "identity-path-association",
            path + "." + key,
            "path does not name its fixed root/module role",
        )
    row[key] = normalized


def _normalize_result(tree: Any, root: str, case_id: str) -> tuple[Any, int | None]:
    if case_id in fixtures.SOURCE_CASES:
        return tree, None
    result = copy.deepcopy(tree)
    row = _data(result, fixtures.PythonChildOutcome, "Result")
    process = _data(row["Process"], fixtures.ProcessObservation, "Result.Process")
    pid = process["Pid"]
    if type(pid) is not int or not 1 <= pid <= 2**31 - 1:
        _refuse(
            "identity-pid",
            "Result.Process.Pid",
            "positive observed process ID required",
        )
    process["Pid"] = 0
    _at(process, "Directory", root, "$FIXTURE", "Result.Process")
    environment = process["Environment"]
    if type(environment) is not list:
        _refuse(
            "identity-shape",
            "Result.Process.Environment",
            "ordered environment pairs required",
        )
    path_env = {
        "PYTHONPATH": (root + "/A/src/Interp.Python", "$FIXTURE/A/src/Interp.Python"),
        "ZETA_IDENTITY_ROOT": (root, "$FIXTURE"),
        "ZETA_IDENTITY_B_PACKAGE": (
            root + "/B/" + fixtures.PACKAGE_PATH,
            "$FIXTURE/B/" + fixtures.PACKAGE_PATH,
        ),
    }
    expected_names = sorted(
        (*path_env, "PYTHONDONTWRITEBYTECODE", "PYTHONNOUSERSITE", "ZETA_IDENTITY_CASE")
    )
    if len(environment) != len(expected_names):
        _refuse(
            "identity-environment",
            "Result.Process.Environment",
            "complete fixed environment required",
        )
    for pair, name in zip(environment, expected_names, strict=True):
        if type(pair) is not list or len(pair) != 2 or pair[0] != name:
            _refuse(
                "identity-environment",
                "Result.Process.Environment",
                "fixed ordered environment keys required",
            )
        if name in path_env:
            path_expected, normalized = path_env[name]
            if type(pair[1]) is not str or pair[1] != path_expected:
                _refuse(
                    "identity-path-association",
                    "Result.Process.Environment." + name,
                    "wrong root association",
                )
            pair[1] = normalized
        else:
            _fixed(
                pair[1],
                case_id if name == "ZETA_IDENTITY_CASE" else "1",
                "Result.Process.Environment." + name,
            )
    for key, expected in (
        ("ReturnCode", 0),
        ("Signal", None),
        ("TimedOut", False),
        ("Error", None),
        ("CleanupErrors", []),
        ("ResourceExceeded", False),
    ):
        _fixed(process[key], expected, "Result.Process." + key)
    _fixed(process["Stdout"], CHILD_FILES[0], "Result.Process.Stdout")
    _fixed(process["Stderr"], CHILD_FILES[1], "Result.Process.Stderr")
    _fixed(row["Trace"], CHILD_FILES[2], "Result.Trace")
    for key, outcome_expected in (
        ("CollectorEntries", 1),
        ("CollectorReturns", 1),
        ("TraceStatus", "complete"),
        ("TraceDetail", None),
    ):
        _fixed(row[key], outcome_expected, "Result." + key)
    collector = _shape(row["CollectorResult"], {"Type", "Fields"}, "CollectorResult")
    code = PYTHON_CODES[fixtures.PYTHON_CASES.index(case_id)]
    if code is not None:
        _fixed(collector["Type"], fixtures.IEEE + ".Failure", "CollectorResult.Type")
        failure = _shape(
            collector["Fields"], {"Code", "Message"}, "CollectorResult.Fields"
        )
        _fixed(failure["Code"], code, "CollectorResult.Code")
        if type(failure["Message"]) is not str:
            _refuse(
                "identity-shape",
                "CollectorResult.Message",
                "complete refusal message required",
            )
        return result, pid
    _fixed(collector["Type"], fixtures.IEEE + ".Success", "CollectorResult.Type")
    success = _shape(collector["Fields"], {"value"}, "CollectorResult.Fields")["value"]
    success = _shape(
        success,
        {
            "Schema",
            "CloneRoot",
            "Modules",
            "EntryAdmitted",
            "EntryModule",
            "EntryReason",
            "Interpreter",
            "SnapshotAgreement",
            "Scope",
            "Limitations",
        },
        "CollectorResult.value",
    )
    _at(success, "CloneRoot", root + "/A", "$FIXTURE/A", "CollectorResult.value")
    _fixed(success["EntryAdmitted"], True, "CollectorResult.EntryAdmitted")
    _fixed(success["EntryModule"], fixtures.ENTRY, "CollectorResult.EntryModule")
    _fixed(success["SnapshotAgreement"], True, "CollectorResult.SnapshotAgreement")
    interpreter = success["Interpreter"]
    if type(interpreter) is not dict or type(interpreter.get("CacheTag")) is not str:
        _refuse(
            "identity-shape",
            "CollectorResult.Interpreter",
            "complete interpreter identity required",
        )
    tag = interpreter["CacheTag"]
    names = sorted(
        (
            "zeta_interp",
            fixtures.COLLECTOR,
            fixtures.IEEE,
            fixtures.ENTRY,
            fixtures.HELPER,
        )
    )
    modules = success["Modules"]
    if type(modules) is not list or len(modules) != len(names):
        _refuse(
            "identity-modules",
            "CollectorResult.Modules",
            "complete fixed module roster required",
        )
    for module, name in zip(modules, names, strict=True):
        if type(module) is not dict or module.get("Name") != name:
            _refuse(
                "identity-modules",
                "CollectorResult.Modules",
                "fixed module order required",
            )
        relative = (
            fixtures.PACKAGE_PATH
            + "/"
            + ("__init__" if name == "zeta_interp" else name.rsplit(".", 1)[1])
            + ".py"
        )
        _fixed(module.get("Path"), relative, "CollectorResult.Module.Path")
        for key in ("AbsolutePath", "File", "SpecOrigin", "LoaderPath"):
            _at(
                module,
                key,
                root + "/A/" + relative,
                "$FIXTURE/A/" + relative,
                "CollectorResult.Module",
            )
        if module.get("CachedPath") is not None:
            cache = str(
                Path(relative).parent
                / "__pycache__"
                / (Path(relative).stem + "." + tag + ".pyc")
            )
            _at(
                module,
                "CachedPath",
                root + "/A/" + cache,
                "$FIXTURE/A/" + cache,
                "CollectorResult.Module",
            )
    return result, pid


def _expected_facts(
    case_id: str, root: str, sources: dict[str, tuple[str, bytes]], after: bool
) -> list[dict[str, Any]]:
    names = sorted(
        name
        for name in sources
        if name != fixtures.EXTRA or after and case_id == "python/unlisted-module"
    )
    result = []
    for name in names:
        relative, raw = sources[name]
        missing = (
            after
            and name == fixtures.HELPER
            and case_id in ("python/missing-helper", "python/dynamic-module")
        )
        clone = (
            "B"
            if (name == fixtures.ENTRY and case_id == "python/foreign-entry")
            or (name == fixtures.HELPER and case_id == "python/foreign-helper")
            else "A"
        )
        location = root + "/" + clone + "/" + relative
        origin = (
            root + "/B/" + relative
            if after and name == fixtures.HELPER and case_id == "python/changed-origin"
            else location
        )
        if after and name == fixtures.HELPER and case_id == "python/changed-bytes":
            raw = b"VALUE = 8\n"
        result.append(
            {
                "Name": name,
                "RuntimeName": "__main__" if name == fixtures.ENTRY else name,
                "ModuleType": "NoneType"
                if missing and case_id == "python/missing-helper"
                else "module",
                "File": None if missing else location,
                "SpecOrigin": None if missing else origin,
                "LoaderName": None if missing else name,
                "LoaderPath": None if missing else location,
                "SourceSha256": None
                if missing
                else hashlib.sha256(raw).hexdigest().upper(),
            }
        )
    return result


class _Case:
    def __init__(
        self, case_id: str, recorded: object, producer_root: str, replay_root: Path
    ) -> None:
        self.case_id, self.recorded, self.producer_root, self.root = (
            case_id,
            recorded,
            producer_root,
            replay_root,
        )
        self.actual: Observation | None = None
        self.helpers: list[Observation] = []
        self.reads: list[ChildRead] = []
        self.association: Association | None = None
        self.completed = 0
        self.matched = False

    def snapshot(self) -> CaseReplay:
        assert self.actual is not None
        return CaseReplay(
            self.case_id,
            self.recorded,
            str(self.root),
            self.actual,
            tuple(self.reads),
            tuple(self.helpers),
            self.association,
            self.matched,
        )

    def observe(self, stage: str, function: Callable[[], object]) -> object:
        observation = _observe(stage, function)
        self.helpers.append(observation)
        if observation.Raised is not None:
            _refuse("identity-helper-raised", stage, "actual helper exception retained")
        return observation.Returned

    def decode(self, raw: object, stage: str, maximum: int) -> Any:
        if type(raw) is not bytes or len(raw) > maximum:
            _refuse(
                "identity-byte-bound",
                stage,
                "exact bytes within the fixed bound required",
            )
        result = self.observe(stage, lambda: a.strict_json(raw))
        if not isinstance(result, a.Admitted):
            _refuse(
                "identity-json",
                stage,
                "strict raw JSON refused; actual outcome retained",
            )
        return result.value

    def encode(
        self, value: object, stage: str, maximum: int = fixtures.FILE_BYTES
    ) -> bytes:
        result = self.observe(
            stage, lambda: encoding.encode_public_result(value, maximum_bytes=maximum)
        )
        if not isinstance(result, a.Admitted) or type(result.value) is not bytes:
            _refuse(
                "identity-encoding",
                stage,
                "bounded result encoding refused; complete actual return retained",
            )
        return result.value

    def read_children(self) -> tuple[c.NamedInput, ...]:
        captured = []
        for role, name, maximum in zip(
            CHILD_ROLES,
            CHILD_FILES,
            (fixtures.OUTPUT_BYTES, fixtures.OUTPUT_BYTES, fixtures.TRACE_BYTES),
            strict=True,
        ):
            try:
                metadata = (self.root / name).lstat()
            except OSError as error:
                kind = type(error)
                observation = Observation(
                    "child-metadata",
                    None,
                    Raised(kind.__module__ + "." + kind.__qualname__, str(error)),
                )
                self.reads.append(ChildRead(role, name, None, None, observation))
                _refuse(
                    "identity-child-read",
                    name,
                    "actual child file metadata unavailable",
                )
            self.reads.append(
                ChildRead(role, name, metadata.st_size, metadata.st_mode, None)
            )
            if (
                not stat.S_ISREG(metadata.st_mode)
                or not 0 <= metadata.st_size <= maximum
            ):
                _refuse(
                    "identity-child-read",
                    name,
                    "bounded regular child artifact required",
                )
            observation = _observe(
                "child-read",
                partial(
                    storage.read_exact,
                    self.root,
                    name,
                    expected_bytes=metadata.st_size,
                    maximum_bytes=maximum,
                ),
            )
            self.reads[-1] = replace(self.reads[-1], Outcome=observation)
            if (
                observation.Raised is not None
                or not isinstance(observation.Returned, a.Admitted)
                or type(observation.Returned.value) is not bytes
            ):
                _refuse(
                    "identity-child-read",
                    name,
                    "actual child read refused; complete outcome retained",
                )
            captured.append(c.NamedInput(role, observation.Returned.value))
        return tuple(captured)

    def validate_child(
        self,
        artifacts: object,
        tree: Any,
        root: str,
        sources: dict[str, tuple[str, bytes]],
        side: str,
    ) -> None:
        if type(artifacts) is not tuple or len(artifacts) != 3:
            _refuse(
                "identity-child-artifacts",
                side,
                "three complete ordered raw child artifacts required",
            )
        for item, role, maximum in zip(
            artifacts,
            CHILD_ROLES,
            (fixtures.OUTPUT_BYTES, fixtures.OUTPUT_BYTES, fixtures.TRACE_BYTES),
            strict=True,
        ):
            if (
                type(item) is not c.NamedInput
                or item.Role != role
                or type(item.Raw) is not bytes
                or len(item.Raw) > maximum
            ):
                _refuse(
                    "identity-child-artifacts",
                    side,
                    "exact ordered bounded child bytes required",
                )
        outcome = _data(tree, fixtures.PythonChildOutcome, side + ".Result")
        output = self.decode(artifacts[0].Raw, side + ".stdout", fixtures.OUTPUT_BYTES)
        _fixed(
            output,
            {
                "CollectorEntries": 1,
                "CollectorReturns": 1,
                "Result": outcome["CollectorResult"],
            },
            side + ".stdout-result",
        )
        _fixed(artifacts[1].Raw, b"", side + ".stderr")
        lines = artifacts[2].Raw.splitlines()
        if len(lines) != 2:
            _refuse(
                "identity-child-trace",
                side + ".trace",
                "exactly two retained collector trace rows required",
            )
        first = self.decode(lines[0], side + ".trace[0]", fixtures.TRACE_BYTES)
        last = self.decode(lines[1], side + ".trace[1]", fixtures.TRACE_BYTES)
        _fixed(
            first,
            {
                "Kind": "collector-entry",
                "Entry": 1,
                "CaseId": self.case_id,
                "Before": _expected_facts(self.case_id, root, sources, False),
                "After": _expected_facts(self.case_id, root, sources, True),
            },
            side + ".trace-entry",
        )
        _fixed(
            last,
            {
                "Kind": "collector-return",
                "Return": 1,
                "Result": outcome["CollectorResult"],
            },
            side + ".trace-return",
        )

    def run(self, python_sources: tuple[fixtures.FixtureSource, ...]) -> None:
        supplied = python_sources if self.case_id in fixtures.PYTHON_CASES else ()
        self.actual = _observe(
            "fixed-identity-fixture",
            lambda: fixtures.run_identity_fixture(
                self.case_id, self.root, python_sources=supplied
            ),
        )
        if self.actual.Raised is not None:
            _refuse(
                "identity-fixture-raised",
                self.case_id,
                "actual fixture raised; no operation return invented",
            )
        actual = self.actual.Returned
        if (
            isinstance(actual, (fixtures.FixtureReady, fixtures.FixtureFailed))
            and type(actual.CompletedOperation) is int
            and actual.CompletedOperation in (0, 1)
            and (actual.CompletedOperation == 0 or type(actual.Call) is c.CallResult)
        ):
            self.completed = actual.CompletedOperation
        if type(actual) is not fixtures.FixtureReady:
            _refuse(
                "identity-fixture-incomplete",
                self.case_id,
                "fresh fixture incomplete; actual prefix and files retained",
            )
        if (
            actual.CaseId != self.case_id
            or actual.Root != str(self.root)
            or type(actual.CompletedOperation) is not int
            or actual.CompletedOperation != 1
        ):
            _refuse(
                "identity-fixture-identity",
                self.case_id,
                "fresh fixture identity or completion differs",
            )
        operation = (
            "verify-source-files"
            if self.case_id in fixtures.SOURCE_CASES
            else "python-identity-child"
        )
        if (
            type(actual.Call) is not c.CallResult
            or actual.Call.Operation != operation
            or actual.Call.InputRoles != ("fixture", "expected")
        ):
            _refuse(
                "identity-fixture-operation", self.case_id, "wrong actual fixed call"
            )
        if self.case_id in fixtures.SOURCE_CASES:
            code = SOURCE_CODES[fixtures.SOURCE_CASES.index(self.case_id)]
            if (code is None and type(actual.Call.Result) is not a.Admitted) or (
                code is not None
                and (
                    type(actual.Call.Result) is not a.Refused
                    or actual.Call.Result.code != code
                )
            ):
                _refuse(
                    "identity-fresh-outcome",
                    self.case_id,
                    "fresh actual source boundary returned the wrong outcome",
                )
        row = self.recorded
        if (
            type(row) is not RecordedIdentityCase
            or type(row.CaseId) is not str
            or row.CaseId != self.case_id
        ):
            _refuse(
                "identity-case", self.case_id, "complete fixed case identity required"
            )
        if (
            type(row.Operation) is not str
            or row.Operation != operation
            or type(row.InputRoles) is not tuple
            or any(type(role) is not str for role in row.InputRoles)
            or row.InputRoles != ("fixture", "expected")
        ):
            _refuse(
                "identity-operation",
                self.case_id,
                "fixed operation and ordered input roles required",
            )
        if (
            type(row.Inputs) is not tuple
            or len(row.Inputs) != 2
            or any(
                type(item) is not c.NamedInput
                or type(item.Role) is not str
                or type(item.Raw) is not bytes
                or len(item.Raw) > fixtures.FILE_BYTES
                for item in row.Inputs
            )
        ):
            _refuse(
                "identity-inputs",
                self.case_id,
                "exact immutable ordered input pair required",
            )
        if tuple(item.Role for item in row.Inputs) != ("fixture", "expected"):
            _refuse("identity-inputs", self.case_id, "fixed input roles required")
        fresh_inputs = [
            self.decode(item.Raw, "fresh-input." + item.Role, fixtures.FILE_BYTES)
            for item in actual.Inputs
        ]
        expected_inputs = copy.deepcopy(fresh_inputs)
        if self.case_id in fixtures.SOURCE_CASES:
            _at(
                expected_inputs[0],
                "Repository",
                str(self.root / "repository"),
                self.producer_root + "/repository",
                "Inputs.fixture",
            )
        else:
            clones = _shape(
                expected_inputs[0]["Clones"], {"A", "B"}, "Inputs.fixture.Clones"
            )
            for clone in ("A", "B"):
                _at(
                    clones,
                    clone,
                    str(self.root / clone),
                    self.producer_root + "/" + clone,
                    "Inputs.fixture.Clones",
                )
            _at(
                expected_inputs[1],
                "CloneRoot",
                str(self.root / "A"),
                self.producer_root + "/A",
                "Inputs.expected",
            )
        for item, expected in zip(row.Inputs, expected_inputs, strict=True):
            wanted = self.encode(expected, "expected-input." + item.Role)
            if item.Raw != wanted:
                _refuse(
                    "identity-inputs",
                    item.Role,
                    "bytes differ from fresh fixed preparation with only declared root fields changed",
                )
        actual_raw = self.encode(
            actual.Call.Result, "actual-result-encoding", MAX_RESULT_BYTES
        )
        actual_tree = self.decode(actual_raw, "actual-result-tree", MAX_RESULT_BYTES)
        recorded_tree = self.decode(row.ResultRaw, "recorded-result", MAX_RESULT_BYTES)
        if self.case_id in fixtures.PYTHON_CASES:
            source_map = {
                "zeta_interp": (
                    fixtures.PACKAGE_PATH + "/__init__.py",
                    fixtures._PACKAGE,
                ),
                fixtures.ENTRY: (
                    fixtures.PACKAGE_PATH + "/hidden_switch_fixture_entry.py",
                    fixtures._ENTRY,
                ),
                fixtures.HELPER: (
                    fixtures.PACKAGE_PATH + "/hidden_switch_fixture_helper.py",
                    b"VALUE = 7\n",
                ),
                fixtures.EXTRA: (
                    fixtures.PACKAGE_PATH + "/hidden_switch_fixture_extra.py",
                    b"EXTRA = 9\n",
                ),
            }
            source_map.update(
                {
                    source.Module: (source.RelativePath, source.Raw)
                    for source in python_sources
                }
            )
            # Own returned result is already retained before these fallible reads.
            children = self.read_children()
            self.validate_child(
                children, actual_tree, str(self.root), source_map, "fresh"
            )
            self.validate_child(
                row.ChildArtifacts,
                recorded_tree,
                self.producer_root,
                source_map,
                "recorded",
            )
        elif type(row.ChildArtifacts) is not tuple or row.ChildArtifacts:
            _refuse(
                "identity-child-artifacts",
                self.case_id,
                "source case has no Python child artifacts",
            )
        normalized_actual, replay_pid = _normalize_result(
            actual_tree, str(self.root), self.case_id
        )
        normalized_recorded, producer_pid = _normalize_result(
            recorded_tree, self.producer_root, self.case_id
        )
        self.association = Association(
            self.producer_root, str(self.root), producer_pid, replay_pid
        )
        left = self.encode(normalized_actual, "normalized-actual", MAX_RESULT_BYTES)
        right = self.encode(
            normalized_recorded, "normalized-recorded", MAX_RESULT_BYTES
        )
        if left != right:
            _refuse(
                "identity-result-mismatch",
                self.case_id,
                "complete result differs after only fixed root/PID association",
            )
        self.matched = True


def _python_sources(value: object) -> tuple[fixtures.FixtureSource, ...]:
    if type(value) is not tuple or len(value) != 2:
        _refuse(
            "identity-python-sources",
            "PythonSources",
            "exact independently admitted collector/IEEE pair required",
        )
    for item, name in zip(value, (fixtures.COLLECTOR, fixtures.IEEE), strict=True):
        relative = fixtures.PACKAGE_PATH + "/" + name.rsplit(".", 1)[1] + ".py"
        if (
            type(item) is not fixtures.FixtureSource
            or item.Module != name
            or item.RelativePath != relative
            or type(item.Raw) is not bytes
            or not 1 <= len(item.Raw) <= 1024 * 1024
        ):
            _refuse(
                "identity-python-sources",
                "PythonSources",
                "fixed source names/paths and bounded exact bytes required",
            )
    return value


def _counts(cases: list[_Case]) -> Counts:
    return Counts(
        len(cases),
        sum(case.actual is not None and case.actual.Raised is None for case in cases),
        sum(case.completed for case in cases),
        sum(case.matched for case in cases),
    )


def _replay(
    records: object,
    roots: object,
    targets: tuple[Path, ...],
    case_ids: tuple[str, ...],
    python_sources: object,
    scope: str,
) -> IdentityReplaySucceeded | IdentityReplayFailed:
    cases: list[_Case] = []
    try:
        if type(records) is not tuple:
            _refuse(
                "identity-records", "Cases", "ordered immutable record tuple required"
            )
        if type(roots) is not tuple or len(roots) != len(case_ids):
            _refuse(
                "identity-producer-roots",
                "ProducerRoots",
                "complete independently supplied ordered root map required",
            )
        labels = []
        for root, case_id in zip(roots, case_ids, strict=True):
            if type(root) is not ProducerRoot or root.CaseId != case_id:
                _refuse(
                    "identity-producer-roots",
                    "ProducerRoots",
                    "fixed ordered root identity required",
                )
            labels.append(_root(root.Root, "ProducerRoots." + case_id))
        if len(set(labels)) != len(labels):
            _refuse(
                "identity-producer-roots",
                "ProducerRoots",
                "distinct producer roots required",
            )
        sources = (
            _python_sources(python_sources)
            if any(case in fixtures.PYTHON_CASES for case in case_ids)
            else ()
        )
        if not sources and python_sources != ():
            _refuse(
                "identity-python-sources",
                "PythonSources",
                "single source-only replay consumes no Python pair",
            )
        for target in targets:
            if (
                not isinstance(target, Path)
                or not target.is_absolute()
                or "\0" in str(target)
            ):
                _refuse(
                    "identity-replay-root",
                    "ReplayRoot",
                    "absolute caller-owned replay path required",
                )
            _root(str(target), "ReplayRoot")
            if any(
                str(target) == label
                or str(target).startswith(label + "/")
                or label.startswith(str(target) + "/")
                for label in labels
            ):
                _refuse(
                    "identity-root-overlap",
                    "ReplayRoot",
                    "producer and fresh replay roots must not overlap",
                )
        for index, (case_id, target, label) in enumerate(
            zip(case_ids, targets, labels, strict=True)
        ):
            if index >= len(records):
                _refuse(
                    "identity-missing-case",
                    f"Cases[{index}]",
                    "missing fixed case; no fixture call invented",
                )
            case = _Case(case_id, records[index], label, target)
            cases.append(case)
            case.run(sources)
        if len(records) != len(case_ids):
            _refuse(
                "identity-extra-case", "Cases", "extra row after complete fixed roster"
            )
        return IdentityReplaySucceeded(
            records,
            roots,
            tuple(case.snapshot() for case in cases),
            _counts(cases),
            scope,
        )
    except _Stop as error:
        failure = error.failure
    except Exception as error:  # noqa: BLE001 - preserve actual fixture before incidental comparison failures
        kind = type(error)
        failure = a.Refused(
            "identity-replay-error",
            "Replay",
            kind.__module__ + "." + kind.__qualname__ + ": " + str(error),
        )
    return IdentityReplayFailed(
        failure,
        records,
        roots,
        tuple(case.snapshot() for case in cases if case.actual is not None),
        _counts(cases),
        scope,
    )


def replay_identity_case(
    record: object,
    *,
    fixed_case_id: object,
    producer_root: object,
    replay_root: Path,
    python_sources: object = (),
) -> IdentityReplaySucceeded | IdentityReplayFailed:
    """Replay one caller-fixed allowed case; its producer label never dispatches."""
    scope = "one-fixed-identity-case-only"
    if type(fixed_case_id) is not str or fixed_case_id not in fixtures.CASE_IDS:
        return IdentityReplayFailed(
            a.Refused(
                "identity-case-selector",
                "FixedCaseId",
                "one of the fixed fifteen caller-selected IDs required",
            ),
            record,
            producer_root,
            (),
            Counts(0, 0, 0, 0),
            scope,
        )
    roots = (ProducerRoot(fixed_case_id, cast(str, producer_root)),)
    return _replay(
        (record,), roots, (replay_root,), (fixed_case_id,), python_sources, scope
    )


def replay_identity_cases(
    records: object,
    replay_parent: Path,
    *,
    producer_roots: object,
    python_sources: object,
) -> IdentityReplaySucceeded | IdentityReplayFailed:
    """Replay all fifteen cases in fixed order into retained exclusive roots.

    The existing owned parent is supplied by the coordinator. This function
    never reads the original producer roots or adopts/retries a failed root.
    Root/PID associations are observations; other metadata is compared exactly.
    """
    scope = "fifteen-fixed-identity-cases-only"
    if not isinstance(replay_parent, Path):
        return IdentityReplayFailed(
            a.Refused(
                "identity-replay-root", "ReplayParent", "caller-owned Path required"
            ),
            records,
            producer_roots,
            (),
            Counts(0, 0, 0, 0),
            scope,
        )
    targets = tuple(replay_parent / f"case-{index:02d}" for index in range(15))
    return _replay(
        records, producer_roots, targets, fixtures.CASE_IDS, python_sources, scope
    )
