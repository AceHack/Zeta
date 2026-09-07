"""Owned source/loaded-Python fixtures for fifteen coordinator cases.

These calls execute Git and tiny file-backed Python entries, never a policy or
source generator. Every case root is new and retained. Actual outcomes and raw
setup files are evidence for the separate coordinator; this runner makes no
whole-envelope, source-to-bytecode or hostile-process isolation claim.
"""

from __future__ import annotations

import hashlib
import json
import os
import signal
import stat
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_conformance as c
from . import hidden_switch_compiled_sources as sources
from . import hidden_switch_compiled_storage as storage

SOURCE_CASES = (
    "source/control",
    "source/current-bytes",
    "source/wrong-archive",
    "source/omitted-helper",
    "source/reordered",
    "source/unarchived-helper",
    "source/symlink",
)
PYTHON_CASES = (
    "python/control",
    "python/foreign-entry",
    "python/foreign-helper",
    "python/missing-helper",
    "python/unlisted-module",
    "python/dynamic-module",
    "python/changed-origin",
    "python/changed-bytes",
)
CASE_IDS = SOURCE_CASES + PYTHON_CASES
PACKAGE_PATH = "src/Interp.Python/zeta_interp"
COLLECTOR = "zeta_interp.hidden_switch_compiled_python_identity"
IEEE = "zeta_interp.hidden_switch_compiled_ieee"
ENTRY = "zeta_interp.hidden_switch_fixture_entry"
HELPER = "zeta_interp.hidden_switch_fixture_helper"
EXTRA = "zeta_interp.hidden_switch_fixture_extra"
DEADLINE_SECONDS = 30
POLL_SECONDS = 0.02
OUTPUT_BYTES = 1024 * 1024
TRACE_BYTES = 2 * 1024 * 1024
FILE_BYTES = 4 * 1024 * 1024
INVENTORY_FILES = 1024
INVENTORY_BYTES = 32 * 1024 * 1024
INVENTORY_ENTRIES = 4096
INVENTORY_DEPTH = 32


@dataclass(frozen=True, slots=True)
class FixtureSource:
    Module: str
    RelativePath: str
    Raw: bytes


@dataclass(frozen=True, slots=True)
class ProcessObservation:
    Arguments: tuple[str, ...]
    Directory: str
    DeadlineSeconds: int
    Pid: int | None
    ReturnCode: int | None
    Signal: int | None
    TimedOut: bool
    Error: str | None
    CleanupErrors: tuple[str, ...]
    Stdout: str
    Stderr: str
    Input: str | None
    Environment: tuple[tuple[str, str], ...]
    ResourceExceeded: bool
    OutputLimits: tuple[tuple[str, int], ...]
    PollSeconds: float


@dataclass(frozen=True, slots=True)
class PythonChildOutcome:
    Process: ProcessObservation
    # Counts describe valid observed trace markers, not inferred process work.
    # Missing/unreadable/invalid initial trace means unknown, never zero.
    CollectorEntries: int | None
    CollectorReturns: int | None
    CollectorResult: object | None
    Trace: str
    TraceStatus: str
    TraceDetail: str | None


@dataclass(frozen=True, slots=True)
class FixtureReady:
    CaseId: str
    Root: str
    Inputs: tuple[c.NamedInput, ...]
    Call: c.CallResult
    TraceFiles: tuple[str, ...]
    CompletedOperation: int = 1
    Scope: str = "one-owned-identity-fixture-operation"


@dataclass(frozen=True, slots=True)
class FixtureFailed:
    Code: str
    Stage: str
    Detail: str
    Root: str | None
    Inputs: tuple[c.NamedInput, ...]
    CompletedOperation: int
    Call: c.CallResult | None
    ObservedOutcome: ProcessObservation | PythonChildOutcome | None
    TraceFiles: tuple[str, ...]
    Scope: str = "incomplete-owned-identity-fixture-operation"


class _Stop(Exception):
    def __init__(self, code: str, stage: str, detail: str) -> None:
        super().__init__(detail)
        self.code, self.stage, self.detail = code, stage, detail


def _raw(value: object) -> bytes:
    result = c.result_tree(value)
    if isinstance(result, a.Refused):
        raise _Stop(result.code, "encode", result.detail)
    return (
        json.dumps(
            result.value,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=True,
            allow_nan=False,
        )
        + "\n"
    ).encode("ascii")


def _sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest().upper()


def _close_descriptor(descriptor: int) -> None:
    os.close(descriptor)


class _Run:
    def __init__(self, case_id: str, root: Path) -> None:
        self.case_id, self.root = case_id, root
        self.inputs: tuple[c.NamedInput, ...] = ()
        self.call: c.CallResult | None = None
        self.outcome: ProcessObservation | PythonChildOutcome | None = None
        self.sequence = 0
        self.inventory_prefix: tuple[str, ...] = ()

    def write(self, relative: str, raw: bytes) -> None:
        if len(raw) > FILE_BYTES:
            raise _Stop("FixtureFileBound", "write:" + relative, "file exceeds bound")
        result = storage.write_exclusive(self.root, relative, raw)
        if isinstance(result, a.Refused):
            raise _Stop(result.code, "write:" + relative, result.detail)

    def mkdir(self, relative: str) -> None:
        result = storage.create_directory(self.root, relative)
        if isinstance(result, a.Refused):
            raise _Stop(result.code, "mkdir:" + relative, result.detail)

    def event(self, kind: str, value: object) -> None:
        name = f"trace-{self.sequence:04d}.json"
        self.sequence += 1
        self.write(name, _raw({"Kind": kind, "Value": value}))

    def bind(self, fixture: object, expected: object) -> None:
        self.inputs = (
            c.NamedInput("fixture", _raw(fixture)),
            c.NamedInput("expected", _raw(expected)),
        )
        for item in self.inputs:
            self.write(item.Role + ".json", item.Raw)

    def read(self, relative: str, maximum: int) -> bytes:
        before = (self.root / relative).lstat()
        if not stat.S_ISREG(before.st_mode) or before.st_size > maximum:
            raise _Stop(
                "FixtureFileBound",
                "read:" + relative,
                "requires a regular file within the declared bound",
            )
        result = storage.read_exact(
            self.root, relative, expected_bytes=before.st_size, maximum_bytes=maximum
        )
        if isinstance(result, a.Refused):
            raise _Stop(result.code, "read:" + relative, result.detail)
        return result.value

    def files(self) -> tuple[str, ...]:
        # Bounded enumeration without following symlinks. The retained prefix
        # remains available even when an inventory limit refuses completion.
        found: list[str] = []
        pending = [(self.root, 0)]
        entries, total = 0, 0
        self.inventory_prefix = ()
        while pending:
            directory, depth = pending.pop()
            with os.scandir(directory) as children:
                for child in children:
                    entries += 1
                    if entries > INVENTORY_ENTRIES:
                        raise _Stop(
                            "FixtureInventoryBound", "inventory", "entry bound exceeded"
                        )
                    metadata = child.stat(follow_symlinks=False)
                    path = Path(child.path)
                    if stat.S_ISDIR(metadata.st_mode):
                        if depth >= INVENTORY_DEPTH:
                            raise _Stop(
                                "FixtureInventoryBound",
                                "inventory",
                                "depth bound exceeded",
                            )
                        pending.append((path, depth + 1))
                    elif stat.S_ISREG(metadata.st_mode):
                        if len(found) >= INVENTORY_FILES:
                            raise _Stop(
                                "FixtureInventoryBound",
                                "inventory",
                                "file count exceeded",
                            )
                        relative = path.relative_to(self.root).as_posix()
                        found.append(relative)
                        self.inventory_prefix = tuple(sorted(found))
                        total += metadata.st_size
                        if metadata.st_size > FILE_BYTES or total > INVENTORY_BYTES:
                            raise _Stop(
                                "FixtureInventoryBound",
                                "inventory",
                                "file or total bytes exceeded",
                            )
        return self.inventory_prefix

    def capture(
        self,
        arguments: tuple[str, ...],
        directory: Path,
        environment: dict[str, str],
        recorded_environment: tuple[tuple[str, str], ...],
        stdin: bytes | None = None,
    ) -> ProcessObservation:
        serial = self.sequence
        limits = (
            (f"process-{serial:04d}.stdout", OUTPUT_BYTES),
            (f"process-{serial:04d}.stderr", OUTPUT_BYTES),
            ("child-trace.jsonl", TRACE_BYTES),
        )
        self.event(
            "process-start",
            {
                "Arguments": arguments,
                "Directory": str(directory),
                "DeadlineSeconds": DEADLINE_SECONDS,
                "Environment": recorded_environment,
                "OutputLimits": limits,
                "PollSeconds": POLL_SECONDS,
                "BoundScope": "polled size refusal; overshoot possible, not an OS quota",
            },
        )
        out, err = f"process-{serial:04d}.stdout", f"process-{serial:04d}.stderr"
        input_path = None if stdin is None else f"process-{serial:04d}.stdin"
        if input_path is not None:
            self.write(input_path, stdin if stdin is not None else b"")
        owned: list[int] = []
        process: subprocess.Popen[bytes] | None = None
        timed_out, resource_exceeded, error = False, False, None
        cleanup: list[str] = []
        try:
            for name in (out, err):
                descriptor = os.open(
                    self.root / name,
                    os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                    0o600,
                )
                owned.append(descriptor)
            input_descriptor: int | None = None
            if input_path is not None:
                input_descriptor = os.open(
                    self.root / input_path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
                )
                owned.append(input_descriptor)
            process = subprocess.Popen(
                arguments,
                cwd=directory,
                env=environment,
                start_new_session=True,
                stdin=input_descriptor
                if input_descriptor is not None
                else subprocess.DEVNULL,
                stdout=owned[0],
                stderr=owned[1],
            )
            deadline = time.monotonic() + DEADLINE_SECONDS
            while True:
                for relative, maximum in limits:
                    try:
                        metadata = (self.root / relative).lstat()
                    except FileNotFoundError:
                        continue
                    if not stat.S_ISREG(metadata.st_mode) or metadata.st_size > maximum:
                        resource_exceeded = True
                        error = "output size/type bound exceeded: " + relative
                        break
                if resource_exceeded or process.poll() is not None:
                    break
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    timed_out = True
                    error = "deadline exceeded; attempted owned process-group kill"
                    break
                try:
                    process.wait(timeout=min(POLL_SECONDS, remaining))
                except subprocess.TimeoutExpired:
                    pass
            # Files stay intact. Polling bounds detection and subsequent reads,
            # not instantaneous disk usage or arbitrary descendant survival.
        except (OSError, ValueError, subprocess.SubprocessError) as failure:
            error = str(failure)
        finally:
            if process is not None and process.poll() is None:
                # A capture/I/O error must not leave the known owned launcher
                # running silently. This is a bounded kill/wait attempt, not a
                # theorem about arbitrary descendants or hostile process groups.
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                except OSError as failure:
                    cleanup.append("final kill: " + str(failure))
                try:
                    process.wait(timeout=5)
                except (OSError, subprocess.SubprocessError) as failure:
                    cleanup.append("final wait: " + str(failure))
            while owned:
                descriptor = owned.pop()  # Relinquish before uncertain close.
                try:
                    _close_descriptor(descriptor)
                except OSError as failure:
                    cleanup.append("close: " + str(failure))
        code = None if process is None else process.returncode
        result = ProcessObservation(
            arguments,
            str(directory),
            DEADLINE_SECONDS,
            None if process is None else process.pid,
            code,
            -code if code is not None and code < 0 else None,
            timed_out,
            error,
            tuple(cleanup),
            out,
            err,
            input_path,
            recorded_environment,
            resource_exceeded,
            limits,
            POLL_SECONDS,
        )
        self.outcome = result
        self.event("process-return", result)
        return result

    def git(
        self, repository: Path, args: tuple[str, ...], stdin: bytes | None = None
    ) -> bytes:
        environment = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
        settings = {
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_AUTHOR_NAME": "Vera Fixture",
            "GIT_AUTHOR_EMAIL": "noreply@openai.com",
            "GIT_COMMITTER_NAME": "Vera Fixture",
            "GIT_COMMITTER_EMAIL": "noreply@openai.com",
            "GIT_AUTHOR_DATE": "2000-01-01T00:00:00Z",
            "GIT_COMMITTER_DATE": "2000-01-01T00:00:00Z",
        }
        environment.update(settings)
        observed = self.capture(
            (
                "git",
                "-c",
                "core.hooksPath=" + os.devnull,
                "-c",
                "commit.gpgsign=false",
                *args,
            ),
            repository,
            environment,
            tuple(sorted(settings.items())),
            stdin,
        )
        if observed.ReturnCode != 0 or observed.Error or observed.CleanupErrors:
            raise _Stop("GitSetup", "git:" + args[0], repr(observed))
        return self.read(observed.Stdout, OUTPUT_BYTES)


_COMMIT_MESSAGE = b"""fixture: retain owned source admission bytes

Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: none
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1XXWTTF087G0R000X1HMD0
Co-Authored-By: Codex <noreply@openai.com>
"""


def _source(run: _Run) -> None:
    run.mkdir("repository")
    repo = run.root / "repository"
    initial = {"a.py": b"A = 1\n", "b.py": b"B = 2\n"}
    for name, raw in initial.items():
        run.write("repository/" + name, raw)
    run.git(
        repo, ("init", "--template=", "--initial-branch=main", "--object-format=sha1")
    )
    run.git(repo, ("add", "--force", "--", "a.py", "b.py"))
    run.git(repo, ("commit", "--no-gpg-sign", "-F", "-"), _COMMIT_MESSAGE)
    baseline = run.git(repo, ("rev-parse", "HEAD")).decode("ascii").strip()
    run.git(repo, ("ls-tree", "-rz", baseline))
    archive = baseline
    rows = [
        {"File": name, "Bytes": len(raw), "Sha256": _sha(raw)}
        for name, raw in initial.items()
    ]
    expected_files: tuple[str, ...] = ("a.py", "b.py")
    mutation = run.case_id.split("/", 1)[1]
    if mutation in ("current-bytes", "wrong-archive"):
        # Keep the original current bytes at an additional owned path, besides
        # their immutable Git blob, before the explicit fixture mutation.
        (repo / "a.py").rename(repo / "a.original")
        run.write("repository/a.py", b"A = 3\n")
        if mutation == "wrong-archive":
            run.git(repo, ("add", "--force", "--", "a.py"))
            run.git(repo, ("commit", "--no-gpg-sign", "-F", "-"), _COMMIT_MESSAGE)
            archive = run.git(repo, ("rev-parse", "HEAD")).decode("ascii").strip()
            run.git(repo, ("ls-tree", "-rz", archive))
            (repo / "a.py").rename(repo / "a.changed")
            run.write("repository/a.py", initial["a.py"])
    elif mutation == "omitted-helper":
        rows = rows[:1]
    elif mutation == "reordered":
        rows.reverse()
    elif mutation == "unarchived-helper":
        run.write("repository/c.py", b"C = 3\n")
        rows.append({"File": "c.py", "Bytes": 6, "Sha256": _sha(b"C = 3\n")})
        expected_files += ("c.py",)
    elif mutation == "symlink":
        (repo / "a.py").rename(repo / "a.original")
        os.symlink("a.original", repo / "a.py")
    run.event(
        "source-mutation",
        {
            "Kind": mutation,
            "BaselineCommit": baseline,
            "ArchiveCommit": archive,
            "SymlinkTarget": "a.original" if mutation == "symlink" else None,
        },
    )
    run.bind(
        {
            "Schema": "zeta.hidden-switch.compiled.source-fixture.v1",
            "CaseId": run.case_id,
            "Repository": str(repo),
            "BaselineCommit": baseline,
            "InitialFiles": [
                {"File": name, "Raw": raw} for name, raw in initial.items()
            ],
            "Mutation": mutation,
        },
        {"Commit": archive, "Rows": rows, "ExpectedFiles": expected_files},
    )
    run.event("operation-entry", {"Operation": "verify-source-files", "Entry": 1})
    result = sources.verify_source_files(
        repo, archive, rows, expected_files=expected_files
    )
    run.call = c.CallResult("verify-source-files", ("fixture", "expected"), result)
    run.event("operation-return", run.call)


_PACKAGE = b'''"""Tiny owned fixture package; no production activation imports."""
import os
if os.environ["ZETA_IDENTITY_CASE"] == "python/foreign-entry":
    __path__ = [os.environ["ZETA_IDENTITY_B_PACKAGE"]]
'''

_ENTRY = b'''"""Fixed owned collector entry; no recorder, policy or source generator."""
import dataclasses
import hashlib
import importlib
import json
import os
import sys
from pathlib import Path
from types import ModuleType
import zeta_interp

root = Path(os.environ["ZETA_IDENTITY_ROOT"])
first, second = root / "A", root / "B"
package = "src/Interp.Python/zeta_interp"
zeta_interp.__path__ = [str(first / package)]
from . import hidden_switch_compiled_python_identity as identity

case = os.environ["ZETA_IDENTITY_CASE"]
helper_name = "zeta_interp.hidden_switch_fixture_helper"
entry_name = "zeta_interp.hidden_switch_fixture_entry"
if case == "python/foreign-helper":
    zeta_interp.__path__ = [str(second / package)]
helper = importlib.import_module(helper_name)
zeta_interp.__path__ = [str(first / package)]
expected = json.loads((root / "expected.json").read_bytes())

def encode(value):
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {"Type": type(value).__module__ + "." + type(value).__qualname__,
                "Fields": {f.name: encode(getattr(value, f.name)) for f in dataclasses.fields(value)}}
    if isinstance(value, (tuple, list)):
        return [encode(v) for v in value]
    if isinstance(value, dict):
        return {k: encode(v) for k, v in value.items()}
    if type(value) is bytes:
        return {"BytesHex": value.hex().upper()}
    return value

def facts():
    result = []
    names = set(expected["Modules"])
    names.update(name for name in sys.modules if name.startswith("zeta_interp.hidden_switch"))
    for name in sorted(names):
        key = "__main__" if name == entry_name else name
        module = sys.modules.get(key)
        spec = getattr(module, "__spec__", None)
        loader = getattr(spec, "loader", None)
        filename = getattr(module, "__file__", None)
        raw = Path(filename).read_bytes() if type(filename) is str else None
        result.append({"Name": name, "RuntimeName": key,
                       "ModuleType": type(module).__name__, "File": filename,
                       "SpecOrigin": getattr(spec, "origin", None),
                       "LoaderName": getattr(loader, "name", None),
                       "LoaderPath": getattr(loader, "path", None),
                       "SourceSha256": None if raw is None else hashlib.sha256(raw).hexdigest().upper()})
    return result

before = facts()
if case == "python/missing-helper":
    del sys.modules[helper_name]
elif case == "python/unlisted-module":
    importlib.import_module("zeta_interp.hidden_switch_fixture_extra")
elif case == "python/dynamic-module":
    sys.modules[helper_name] = ModuleType(helper_name)
elif case == "python/changed-origin":
    helper.__spec__.origin = str(second / package / "hidden_switch_fixture_helper.py")
elif case == "python/changed-bytes":
    p = first / package / "hidden_switch_fixture_helper.py"
    original = p.read_bytes()
    with (root / "helper-before-mutation.py").open("xb") as backup:
        backup.write(original)
    with p.open("wb") as changed:
        changed.write(original.replace(b"7", b"8", 1))
after = facts()
with (root / "child-trace.jsonl").open("x", encoding="ascii") as trace:
    trace.write(json.dumps({"Kind": "collector-entry", "Entry": 1,
                           "CaseId": case, "Before": before, "After": after}, sort_keys=True) + "\\n")
    trace.flush()
    result = identity.admit_python_identity(expected["CloneRoot"], expected["Modules"], entry_module=expected["EntryModule"])
    encoded = encode(result)
    trace.write(json.dumps({"Kind": "collector-return", "Return": 1, "Result": encoded}, sort_keys=True) + "\\n")
    trace.flush()
print(json.dumps({"CollectorEntries": 1, "CollectorReturns": 1, "Result": encoded}, sort_keys=True))
'''


def _collector_record(record: object) -> bool:
    if type(record) is not dict or record.keys() != {"Type", "Fields"}:
        return False
    fields = record["Fields"]
    if record["Type"] == IEEE + ".Success":
        return (
            type(fields) is dict
            and fields.keys() == {"value"}
            and type(fields["value"]) is dict
        )
    return (
        record["Type"] == IEEE + ".Failure"
        and type(fields) is dict
        and fields.keys() == {"Code", "Message"}
        and all(type(x) is str for x in fields.values())
    )


def _trace_outcome(run: _Run, observed: ProcessObservation) -> PythonChildOutcome:
    trace = "child-trace.jsonl"
    entries: int | None = None
    returns: int | None = None
    record: object | None = None
    status, detail = "missing", None
    try:
        lines = run.read(trace, TRACE_BYTES).splitlines()
        status = "invalid-prefix"
        detail = "no valid initial entry marker"
        if lines:
            first = a.strict_json(lines[0])
            if isinstance(first, a.Admitted):
                row = first.value
                valid_entry = (
                    type(row) is dict
                    and row.keys() == {"Kind", "Entry", "CaseId", "Before", "After"}
                    and row["Kind"] == "collector-entry"
                    and row["CaseId"] == run.case_id
                    and type(row["Entry"]) is int
                    and row["Entry"] == 1
                    and type(row["Before"]) is list
                    and type(row["After"]) is list
                )
                if valid_entry:
                    entries, returns, status, detail = 1, 0, "entry-only", None
                    if len(lines) >= 2:
                        second = a.strict_json(lines[1])
                        status, detail = "invalid-suffix", "invalid return marker"
                        if isinstance(second, a.Admitted):
                            last = second.value
                            if (
                                type(last) is dict
                                and last.keys() == {"Kind", "Return", "Result"}
                                and last["Kind"] == "collector-return"
                                and type(last["Return"]) is int
                                and last["Return"] == 1
                                and _collector_record(last["Result"])
                            ):
                                returns, record = 1, last["Result"]
                                status = (
                                    "complete" if len(lines) == 2 else "invalid-suffix"
                                )
                                detail = (
                                    None
                                    if len(lines) == 2
                                    else "extra trace rows after valid return"
                                )
    except FileNotFoundError:
        detail = "trace absent; collector work unknown"
    except (OSError, _Stop) as error:
        status, detail = "unreadable", str(error)
    return PythonChildOutcome(observed, entries, returns, record, trace, status, detail)


def _python(run: _Run, supplied: tuple[FixtureSource, ...]) -> None:
    fixed = (
        FixtureSource("zeta_interp", PACKAGE_PATH + "/__init__.py", _PACKAGE),
        *supplied,
        FixtureSource(ENTRY, PACKAGE_PATH + "/hidden_switch_fixture_entry.py", _ENTRY),
        FixtureSource(
            HELPER, PACKAGE_PATH + "/hidden_switch_fixture_helper.py", b"VALUE = 7\n"
        ),
        FixtureSource(
            EXTRA, PACKAGE_PATH + "/hidden_switch_fixture_extra.py", b"EXTRA = 9\n"
        ),
    )
    for clone in ("A", "B"):
        for path in (
            clone,
            clone + "/src",
            clone + "/src/Interp.Python",
            clone + "/" + PACKAGE_PATH,
        ):
            run.mkdir(path)
        for source in fixed:
            run.write(clone + "/" + source.RelativePath, source.Raw)
    roster = {
        source.Module: {
            "Path": source.RelativePath,
            "Bytes": len(source.Raw),
            "Sha256": _sha(source.Raw),
        }
        for source in fixed
        if source.Module != EXTRA
    }
    first, second = run.root / "A", run.root / "B"
    arguments = (sys.executable, "-B", "-s", "-P", "-m", ENTRY)
    run.bind(
        {
            "Schema": "zeta.hidden-switch.compiled.python-fixture.v1",
            "CaseId": run.case_id,
            "Clones": {"A": str(first), "B": str(second)},
            "EntryModule": ENTRY,
            "Arguments": arguments,
            "DeadlineSeconds": DEADLINE_SECONDS,
            "Files": [
                {"Module": f.Module, "RelativePath": f.RelativePath, "Raw": f.Raw}
                for f in fixed
            ],
        },
        {"CloneRoot": str(first), "Modules": roster, "EntryModule": ENTRY},
    )
    environment = {k: v for k, v in os.environ.items() if not k.startswith("PYTHON")}
    settings = {
        "PYTHONPATH": str(first / "src/Interp.Python"),
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONNOUSERSITE": "1",
        "ZETA_IDENTITY_ROOT": str(run.root),
        "ZETA_IDENTITY_CASE": run.case_id,
        "ZETA_IDENTITY_B_PACKAGE": str(second / PACKAGE_PATH),
    }
    environment.update(settings)
    observed = run.capture(
        arguments, run.root, environment, tuple(sorted(settings.items()))
    )
    outcome = _trace_outcome(run, observed)
    run.outcome = outcome
    if observed.ReturnCode != 0 or observed.TimedOut or observed.Error:
        raise _Stop(
            "PythonChild",
            "child",
            "child did not close normally with a collector return",
        )
    raw = run.read(observed.Stdout, OUTPUT_BYTES)
    parsed = a.strict_json(raw)
    if isinstance(parsed, a.Refused):
        raise _Stop(parsed.code, "child-output", parsed.detail)
    value = parsed.value
    if type(value) is not dict or value.keys() != {
        "CollectorEntries",
        "CollectorReturns",
        "Result",
    }:
        raise _Stop("ChildSchema", "child-output", "exact collector output required")
    if any(
        type(value[k]) is not int or value[k] != 1
        for k in ("CollectorEntries", "CollectorReturns")
    ):
        raise _Stop(
            "ChildEntries",
            "child-output",
            "exactly one collector entry and return required",
        )
    record = value["Result"]
    if not _collector_record(record):
        raise _Stop(
            "ChildResult",
            "child-output",
            "unknown or malformed actual collector result",
        )
    if outcome.TraceStatus != "complete" or outcome.CollectorResult != record:
        raise _Stop(
            "ChildTrace", "child-trace", "collector trace and actual output disagree"
        )
    run.call = c.CallResult("python-identity-child", ("fixture", "expected"), outcome)
    if observed.CleanupErrors:
        raise _Stop("DescriptorCleanup", "child-cleanup", repr(observed.CleanupErrors))
    run.event("operation-return", run.call)


def run_identity_fixture(
    case_id: object,
    case_root: Path,
    *,
    python_sources: tuple[FixtureSource, ...] = (),
) -> FixtureReady | FixtureFailed:
    """Execute one fixed fixture and retain every owned file; never retry it.

    CompletedOperation is one only after an actual source API result, or a
    normal child close with exactly one actual collector return. Crashes and
    timeouts retain observations but count zero. Expected refusal semantics
    and fresh-replay path/identity association are the coordinator's obligation.
    """
    run: _Run | None = None
    owned: Path | None = None
    try:
        if type(case_id) is not str or case_id not in CASE_IDS:
            raise _Stop(
                "FixtureCase", "input", "one of the fixed fifteen case IDs required"
            )
        if (
            not isinstance(case_root, Path)
            or not case_root.is_absolute()
            or "\0" in str(case_root)
            or case_root.resolve() != case_root
            or not case_root.parent.is_dir()
        ):
            raise _Stop(
                "FixtureRoot",
                "input",
                "absent canonical case root under owned parent required",
            )
        if type(python_sources) is not tuple:
            raise _Stop("FixtureSources", "input", "exact source tuple required")
        if case_id in PYTHON_CASES:
            if len(python_sources) != 2:
                raise _Stop(
                    "FixtureSources",
                    "input",
                    "actual collector and IEEE helper required",
                )
            for supplied, name in zip(python_sources, (COLLECTOR, IEEE), strict=True):
                path = PACKAGE_PATH + "/" + name.rsplit(".", 1)[1] + ".py"
                if (
                    type(supplied) is not FixtureSource
                    or supplied.Module != name
                    or supplied.RelativePath != path
                    or type(supplied.Raw) is not bytes
                    or not 1 <= len(supplied.Raw) <= 1024 * 1024
                ):
                    raise _Stop(
                        "FixtureSources",
                        "input",
                        "fixed ordered source identities and bounded bytes required",
                    )
        elif python_sources:
            raise _Stop(
                "FixtureSources",
                "input",
                "source cases consume no Python module source tuple",
            )
        created = storage.create_directory(case_root.parent, case_root.name)
        if isinstance(created, a.Refused):
            if (
                created.code != "existing-output"
                and case_root.is_dir()
                and not case_root.is_symlink()
            ):
                # A sync/close failure can follow successful exclusive mkdir.
                # Retain that newly created root instead of losing its record.
                # The caller supplies a unique root; concurrent replacement is
                # outside the ordinary owned-fixture filesystem assumption.
                owned = case_root
                run = _Run(case_id, case_root)
            raise _Stop(created.code, "create-case", created.detail)
        owned = case_root
        run = _Run(case_id, case_root)
        run.event("case-created", {"CaseId": case_id, "Root": str(case_root)})
        if case_id in SOURCE_CASES:
            _source(run)
        else:
            _python(run, python_sources)
        if run.call is None:
            raise _Stop("MissingOperation", "complete", "no operation result")
        files = run.files()
        inventory = []
        for relative in files:
            raw = run.read(relative, FILE_BYTES)
            inventory.append({"File": relative, "Bytes": len(raw), "Sha256": _sha(raw)})
        run.write(
            "manifest.json",
            _raw(
                {
                    "CaseId": case_id,
                    "Files": inventory,
                    "Scope": "owned fixture files only; no complete coordinator admission",
                }
            ),
        )
        return FixtureReady(case_id, str(case_root), run.inputs, run.call, run.files())
    except (
        OSError,
        ValueError,
        RuntimeError,
        subprocess.SubprocessError,
        _Stop,
    ) as error:
        code = error.code if isinstance(error, _Stop) else "FixtureIO"
        stage = error.stage if isinstance(error, _Stop) else "fixture-io"
        detail = error.detail if isinstance(error, _Stop) else str(error)
        failure_files: tuple[str, ...] = ()
        if run is not None:
            try:
                run.event(
                    "fixture-failed", {"Code": code, "Stage": stage, "Detail": detail}
                )
            except (OSError, ValueError, RuntimeError, _Stop) as retention:
                detail += "; failure-record retention: " + str(retention)
            try:
                failure_files = run.files()
            except (OSError, _Stop) as inspection:
                failure_files = run.inventory_prefix
                detail += "; inventory observation: " + str(inspection)
        return FixtureFailed(
            code,
            stage,
            detail,
            None if owned is None else str(owned),
            () if run is None else run.inputs,
            int(run is not None and run.call is not None),
            None if run is None else run.call,
            None if run is None else run.outcome,
            failure_files,
        )
