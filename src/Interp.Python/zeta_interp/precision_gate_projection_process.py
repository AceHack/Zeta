"""Finite native-process custody; no projection/reference mathematics.

The caller supplies independently admitted file identities. Only the pinned
script, its three literal #r files and the executable are in this custody scope.
This is neither complete runtime closure nor hostile namespace isolation. Public
calls retain typed failures; failed children are not automatically replaced.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import stat
import subprocess
import threading
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from pathlib import Path
from typing import BinaryIO, cast

INPUT_CAP = 64 * 1024
RECEIPT_CAP = 2 * 1024 * 1024
STDOUT_CAP = 128 * 1024
STDERR_CAP = 64 * 1024
FILE_CAP = 128 * 1024 * 1024
SCRIPT = "src/Research.FSharp/PrecisionGateProjectionReplay.fsx"
SHA = re.compile(r"[0-9A-F]{64}\Z")
REFERENCE = re.compile(r'#r "([^"\r\n]+)"\Z')
ENVIRONMENT = {
    "DOTNET_CLI_TELEMETRY_OPTOUT": "1",
    "DOTNET_SKIP_FIRST_TIME_EXPERIENCE": "1",
    "DOTNET_NOLOGO": "1",
}


@dataclass(frozen=True, slots=True)
class ProcessFailure:
    Stage: str
    Code: str
    Message: str


@dataclass(frozen=True, slots=True)
class FileIdentity:
    Bytes: int
    Sha256: str


@dataclass(frozen=True, slots=True)
class FileObservation:
    Path: str
    Bytes: int
    Sha256: str


@dataclass(frozen=True, slots=True)
class DependencyObservation:
    Role: str
    Original: FileObservation | None = None
    Copy: FileObservation | None = None
    Before: FileObservation | None = None
    Producer: FileObservation | None = None
    After: FileObservation | None = None


@dataclass(frozen=True, slots=True)
class PreparedNative:
    Complete: bool
    Root: str
    Host: FileObservation | None
    Script: FileObservation | None
    References: tuple[str, ...]
    Dependencies: tuple[DependencyObservation, ...]
    CreatedFiles: tuple[str, ...]
    Failure: ProcessFailure | None
    Cleanup: tuple[ProcessFailure, ...]


@dataclass(frozen=True, slots=True)
class NativeObservation:
    Complete: bool = False
    Receipt: bytes | None = None
    Argv: tuple[str, ...] = ()
    StartedAtUtc: str = ""
    FinishedAtUtc: str = ""
    LaunchAttempted: bool = False
    LaunchStartedAtUtc: str | None = None
    ChildPid: int | None = None
    ExitCode: int | None = None
    CleanupExitCode: int | None = None
    DirectChildClosed: bool = False
    ReadersClosed: bool = False
    Stdout: bytes = b""
    Stderr: bytes = b""
    StdoutEof: bool = False
    StderrEof: bool = False
    StdoutLimitExceeded: bool = False
    StderrLimitExceeded: bool = False
    StdoutFailure: ProcessFailure | None = None
    StderrFailure: ProcessFailure | None = None
    Failure: ProcessFailure | None = None
    Cleanup: tuple[ProcessFailure, ...] = ()
    InputFiles: tuple[FileObservation, ...] = ()
    Output: FileObservation | None = None
    Producer: dict[str, object] | None = None
    Dependencies: tuple[DependencyObservation, ...] = ()
    CreatedFiles: tuple[str, ...] = ()
    EnvironmentOverrides: tuple[tuple[str, str], ...] = ()


def _utc() -> str:
    return datetime.now(UTC).isoformat()


def _error(stage: str, code: str, message: str) -> ProcessFailure:
    return ProcessFailure(stage, code, message[:1024])


class _Stop(Exception):
    pass


class _State:
    def __init__(self) -> None:
        self.failure: ProcessFailure | None = None
        self.cleanup: list[ProcessFailure] = []
        self.created: list[str] = []
        self.stage = "admission"

    def refuse(self, code: str, message: str) -> None:
        if self.failure is None:
            self.failure = _error(self.stage, code, message)
        raise _Stop

    def check(self) -> None:
        if self.failure is not None:
            raise _Stop

    def caught(self, error: Exception) -> None:
        if self.failure is None:
            self.failure = _error(self.stage, type(error).__name__, str(error))

    def close(self, close: Callable[[], object], name: str) -> None:
        try:
            close()
        except Exception as error:  # noqa: BLE001 - preserve typed boundary/cleanup failures
            failure = _error("cleanup", name, f"{type(error).__name__}: {error}")
            self.cleanup.append(failure)
            if self.failure is None:
                self.failure = failure


def _observation(path: Path, raw: bytes) -> FileObservation:
    return FileObservation(str(path), len(raw), hashlib.sha256(raw).hexdigest().upper())


def _read(
    path: Path, cap: int, state: _State, seen: Callable[[FileObservation], None]
) -> bytes:
    """Same regular descriptor, finite initial size plus one, before hashing."""
    descriptor: int | None = None
    raw = b""
    try:
        flags = (
            os.O_RDONLY | getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_NOFOLLOW", 0)
        )
        descriptor = os.open(path, flags)
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode) or not 0 <= before.st_size <= cap:
            state.refuse("FileBound", "regular file within declared byte cap required")
        deadline = time.monotonic() + 10.0
        chunks: list[bytes] = []
        remaining = before.st_size
        while remaining:
            if time.monotonic() > deadline:
                state.refuse("ReadDeadline", "finite read deadline exceeded")
            chunk = os.read(descriptor, min(65536, remaining))
            if not chunk:
                state.refuse("ShortRead", "initial file size was not fully readable")
            chunks.append(chunk)
            remaining -= len(chunk)
        if time.monotonic() > deadline:
            state.refuse("ReadDeadline", "finite read deadline exceeded")
        if os.read(descriptor, 1):
            state.refuse("FileChanged", "file grew beyond initial size")
        after = os.fstat(descriptor)
        if (
            before.st_dev,
            before.st_ino,
            before.st_size,
            before.st_mtime_ns,
            before.st_ctime_ns,
        ) != (
            after.st_dev,
            after.st_ino,
            after.st_size,
            after.st_mtime_ns,
            after.st_ctime_ns,
        ):
            state.refuse("FileChanged", "descriptor metadata changed during read")
        raw = b"".join(chunks)
        seen(_observation(path, raw))
    except _Stop:
        pass
    except Exception as error:  # noqa: BLE001 - preserve typed boundary/cleanup failures
        state.caught(error)
    finally:
        if descriptor is not None:
            state.close(lambda: os.close(descriptor), "FileClose")
    state.check()
    return raw


def _write(path: Path, raw: bytes, state: _State) -> None:
    descriptor: int | None = None
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        state.created.append(str(path))
        offset = 0
        while offset < len(raw):
            written = os.write(descriptor, memoryview(raw)[offset : offset + 65536])
            if written <= 0:
                state.refuse("ShortWrite", "write made no progress")
            offset += written
        os.fsync(descriptor)
    except _Stop:
        pass
    except Exception as error:  # noqa: BLE001 - preserve typed boundary/cleanup failures
        state.caught(error)
    finally:
        if descriptor is not None:
            state.close(lambda: os.close(descriptor), "FileClose")
    state.check()


def _match(
    actual: FileObservation, expected: FileIdentity | FileObservation, state: _State
) -> None:
    if (actual.Bytes, actual.Sha256) != (expected.Bytes, expected.Sha256):
        state.refuse(
            "FileIdentity", "actual file identity differs from independent expectation"
        )


def prepare_native(
    source_root: Path,
    custody_root: Path,
    host: Path,
    expected: Mapping[str, FileIdentity],
) -> PreparedNative:
    """Expected keys: @host, SCRIPT, and exactly the script-derived relative DLL paths."""
    state = _State()
    dependencies: list[DependencyObservation] = []
    references: tuple[str, ...] = ()
    actual_host: FileObservation | None = None
    actual_script: FileObservation | None = None
    try:
        source_root, custody_root, host = (
            source_root.absolute(),
            custody_root.absolute(),
            host.absolute(),
        )
        if len(expected) != 5 or any(
            type(pin.Bytes) is not int
            or not 0 <= pin.Bytes <= FILE_CAP
            or not SHA.fullmatch(pin.Sha256)
            for pin in expected.values()
        ):
            state.refuse(
                "ExpectedFiles",
                "exact five independently admitted file identities required",
            )
        custody_root.mkdir(parents=False, exist_ok=False)
        for role, path, cap in (
            ("@host", host, FILE_CAP),
            (SCRIPT, source_root / SCRIPT, INPUT_CAP),
        ):
            state.stage = "prepare-" + role
            index = len(dependencies)
            dependencies.append(DependencyObservation(role))

            def seen(value: FileObservation, index: int = index) -> None:
                dependencies[index] = replace(dependencies[index], Original=value)

            raw = _read(path, cap, state, seen)
            observed = dependencies[index].Original
            assert observed is not None
            _match(observed, expected[role], state)
            if role == "@host":
                actual_host = observed
                continue
            text = raw.decode("utf-8", errors="strict")
            paths: list[str] = []
            for line in text.splitlines():
                if line.startswith(("#r", "#load", "#I")):
                    match = REFERENCE.fullmatch(line)
                    if match is None:
                        state.refuse(
                            "ScriptReference",
                            "only reviewed literal file references allowed",
                        )
                    assert match is not None
                    absolute = (
                        (source_root / SCRIPT).parent.joinpath(match[1]).resolve()
                    )
                    relative = absolute.relative_to(source_root.resolve()).as_posix()
                    if not relative.endswith(".dll") or relative in paths:
                        state.refuse(
                            "ScriptReference", "unique relative DLL references required"
                        )
                    paths.append(relative)
            references = tuple(paths)
            if len(references) != 3 or set(expected) != {"@host", SCRIPT, *references}:
                state.refuse(
                    "ScriptReference",
                    "expected file roster differs from actual three #r references",
                )
            copy = custody_root / SCRIPT
            copy.parent.mkdir(parents=True, exist_ok=True)
            _write(copy, raw, state)

            def copied(value: FileObservation, index: int = index) -> None:
                dependencies[index] = replace(dependencies[index], Copy=value)

            _read(copy, cap, state, copied)
            actual_script = dependencies[index].Copy
            assert actual_script is not None
            _match(actual_script, observed, state)
        for relative in references:
            state.stage = "prepare-reference"
            index = len(dependencies)
            dependencies.append(DependencyObservation(relative))

            def original(value: FileObservation, index: int = index) -> None:
                dependencies[index] = replace(dependencies[index], Original=value)

            raw = _read(source_root / relative, FILE_CAP, state, original)
            observed = dependencies[index].Original
            assert observed is not None
            _match(observed, expected[relative], state)
            copy = custody_root / relative
            copy.parent.mkdir(parents=True, exist_ok=True)
            _write(copy, raw, state)

            def copied_reference(value: FileObservation, index: int = index) -> None:
                dependencies[index] = replace(dependencies[index], Copy=value)

            _read(copy, FILE_CAP, state, copied_reference)
            current = dependencies[index].Copy
            assert current is not None
            _match(current, observed, state)
    except _Stop:
        pass
    except Exception as error:  # noqa: BLE001 - preserve typed boundary/cleanup failures
        state.caught(error)
    return PreparedNative(
        state.failure is None,
        str(custody_root),
        actual_host,
        actual_script,
        references,
        tuple(dependencies),
        tuple(state.created),
        state.failure,
        tuple(state.cleanup),
    )


class _Pump:
    """At most cap+1 observed bytes; the extra byte witnesses cap refusal."""

    def __init__(self, pipe: BinaryIO, cap: int) -> None:
        self.pipe = pipe
        self.cap = cap
        self.raw = bytearray()
        self.eof = False
        self.error: str | None = None
        self.exceeded = False
        self.thread = threading.Thread(target=self.read, daemon=True)

    def read(self) -> None:
        try:
            while len(self.raw) <= self.cap:
                chunk = os.read(
                    self.pipe.fileno(), min(4096, self.cap + 1 - len(self.raw))
                )
                if not chunk:
                    self.eof = True
                    return
                self.raw.extend(chunk)
                if len(self.raw) > self.cap:
                    self.exceeded = True
                    return
        except Exception as error:  # noqa: BLE001 - preserve typed boundary/cleanup failures
            self.error = f"{type(error).__name__}: {error}"[:1024]


def _capture(
    argv: tuple[str, ...], cwd: Path, timeout_seconds: float
) -> NativeObservation:
    state = _State()
    outcome = NativeObservation(
        Argv=argv, StartedAtUtc=_utc(), EnvironmentOverrides=tuple(ENVIRONMENT.items())
    )
    child: subprocess.Popen[bytes] | None = None
    pumps: list[_Pump] = []
    try:
        state.stage = "launch"
        outcome = replace(outcome, LaunchAttempted=True, LaunchStartedAtUtc=_utc())
        child = subprocess.Popen(
            argv,
            cwd=cwd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=dict(os.environ) | ENVIRONMENT,
        )
        outcome = replace(outcome, ChildPid=child.pid)
        assert child.stdout is not None and child.stderr is not None
        pumps = [
            _Pump(cast(BinaryIO, child.stdout), STDOUT_CAP),
            _Pump(cast(BinaryIO, child.stderr), STDERR_CAP),
        ]
        for pump in pumps:
            pump.thread.start()
        deadline = time.monotonic() + timeout_seconds
        state.stage = "wait"
        while True:
            if any(pump.exceeded or pump.error for pump in pumps):
                state.refuse("StreamBoundOrRead", "bounded child stream refused")
            code = child.poll()
            if code is not None:
                outcome = replace(outcome, ExitCode=code)
                break
            if time.monotonic() > deadline:
                state.refuse("Timeout", "owned child deadline exceeded")
            time.sleep(0.005)
    except _Stop:
        pass
    except Exception as error:  # noqa: BLE001 - preserve typed boundary/cleanup failures
        state.caught(error)
    finally:
        if child is not None:
            alive = True
            try:
                alive = child.poll() is None
            except Exception as error:  # noqa: BLE001 - preserve typed boundary/cleanup failures
                state.cleanup.append(_error("cleanup", "Poll", str(error)))
            if alive:
                state.close(child.kill, "Kill")
            try:
                code = child.wait(timeout=5.0)
                outcome = replace(outcome, CleanupExitCode=code, DirectChildClosed=True)
                if outcome.ExitCode is None:
                    outcome = replace(outcome, ExitCode=code)
                elif outcome.ExitCode != code:
                    state.cleanup.append(
                        _error(
                            "cleanup",
                            "ExitDisagreement",
                            "main and cleanup wait disagree",
                        )
                    )
            except Exception as error:  # noqa: BLE001 - preserve typed boundary/cleanup failures
                state.cleanup.append(_error("cleanup", "Join", str(error)))
            for pump in pumps:

                def join_reader(pump: _Pump = pump) -> None:
                    pump.thread.join(timeout=1.0)

                state.close(join_reader, "ReaderJoin")
            for pipe in (child.stdout, child.stderr):
                if pipe is not None:
                    state.close(pipe.close, "PipeClose")
            outcome = replace(
                outcome,
                ReadersClosed=len(pumps) == 2
                and all(not p.thread.is_alive() for p in pumps),
            )
    if len(pumps) == 2:
        outcome = replace(
            outcome,
            Stdout=bytes(pumps[0].raw),
            Stderr=bytes(pumps[1].raw),
            StdoutEof=pumps[0].eof,
            StderrEof=pumps[1].eof,
            StdoutLimitExceeded=pumps[0].exceeded,
            StderrLimitExceeded=pumps[1].exceeded,
            StdoutFailure=_error("stdout-read", "Read", pumps[0].error)
            if pumps[0].error is not None
            else None,
            StderrFailure=_error("stderr-read", "Read", pumps[1].error)
            if pumps[1].error is not None
            else None,
        )
        if state.failure is None and any(p.error or p.exceeded for p in pumps):
            state.failure = _error(
                "streams", "StreamBoundOrRead", "bounded child stream refused"
            )
    if state.failure is None and state.cleanup:
        state.failure = state.cleanup[0]
    if state.failure is None and not (
        outcome.ReadersClosed and outcome.StdoutEof and outcome.StderrEof
    ):
        state.failure = _error(
            "streams", "IncompleteStreams", "reader completion and EOF required"
        )
    return replace(
        outcome,
        Failure=state.failure,
        Cleanup=tuple(state.cleanup),
        FinishedAtUtc=_utc(),
    )


def _pairs(values: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in values:
        if key in result:
            raise ValueError("duplicate JSON property")
        result[key] = value
    return result


def _invalid_number(_: str) -> object:
    raise ValueError("floating/nonfinite JSON number is outside command schema")


def _json(raw: bytes, cap: int) -> dict[str, object]:
    if len(raw) > cap:
        raise ValueError("JSON byte bound")
    value: object = json.loads(
        raw.decode("utf-8", errors="strict"),
        object_pairs_hook=_pairs,
        parse_float=_invalid_number,
        parse_constant=_invalid_number,
    )
    if type(value) is not dict:
        raise ValueError("JSON object required")
    return cast(dict[str, object], value)


def _file(value: object) -> FileObservation:
    if type(value) is not dict:
        raise ValueError("file observation required")
    row = cast(dict[str, object], value)
    if (
        set(row) != {"Path", "Bytes", "Sha256"}
        or type(row["Path"]) is not str
        or type(row["Bytes"]) is not int
    ):
        raise ValueError("exact file fields required")
    digest = row["Sha256"]
    if (
        type(digest) is not str
        or not SHA.fullmatch(digest)
        or not 0 <= row["Bytes"] <= FILE_CAP
    ):
        raise ValueError("file identity syntax")
    return FileObservation(row["Path"], row["Bytes"], digest)


def _admit_command(
    raw: bytes,
    receipt: bytes,
    expected_case_id: str,
    expected_hash: str,
    bindings: Mapping[str, str],
    inputs: tuple[FileObservation, ...],
    output: FileObservation,
    dependencies: list[DependencyObservation],
) -> dict[str, object]:
    if not raw.endswith(b"\n") or raw.endswith(b"\n\n"):
        raise ValueError("one newline-terminated command object required")
    report = _json(raw, STDOUT_CAP)
    if set(report) != {
        "Schema",
        "Complete",
        "Failure",
        "ApiFailure",
        "Cleanup",
        "InputFiles",
        "AssemblyFiles",
        "Output",
        "ReceiptAvailable",
        "ReceiptKind",
        "Counters",
        "TraceRows",
        "Runtime",
    }:
        raise ValueError("exact command fields required")
    if (
        report["Schema"] != "zeta.precision-projection.command.v1"
        or report["Complete"] is not True
        or report["Failure"] is not None
        or report["ApiFailure"] is not None
        or report["Cleanup"] != []
        or report["ReceiptAvailable"] is not True
        or report["ReceiptKind"] not in ("candidate", "refused")
        or type(report["Runtime"]) is not str
    ):
        raise ValueError("complete typed command outcome required")
    if _file(report["Output"]) != output:
        raise ValueError("producer output identity mismatch")
    producer_inputs = report["InputFiles"]
    if (
        type(producer_inputs) is not list
        or tuple(_file(v) for v in producer_inputs) != inputs
    ):
        raise ValueError("producer input identities mismatch")
    assemblies = report["AssemblyFiles"]
    if type(assemblies) is not list or len(assemblies) != 2:
        raise ValueError("exact two producer assembly observations required")
    paths: set[str] = set()
    for value in assemblies:
        file = _file(value)
        if file.Path in paths:
            raise ValueError("duplicate producer assembly")
        paths.add(file.Path)
        matches = [i for i, d in enumerate(dependencies) if d.Copy == file]
        if len(matches) != 1 or Path(file.Path).name not in (
            "Zeta.Core.dll",
            "Zeta.Bayesian.dll",
        ):
            raise ValueError("producer assembly does not match copied reference")
        i = matches[0]
        dependencies[i] = replace(dependencies[i], Producer=file)
    payload = _json(receipt, RECEIPT_CAP)
    if set(payload) != {
        "Schema",
        "CaseId",
        "InputSha256",
        "Bindings",
        "Outcome",
        "Counters",
        "Trace",
    }:
        raise ValueError("registered receipt root fields required")
    if (
        payload["Schema"] != "zeta.precision-projection.native.v1"
        or payload["CaseId"] != expected_case_id
        or payload["InputSha256"] != expected_hash
        or payload["Bindings"] != dict(bindings)
    ):
        raise ValueError("registered receipt caller identity mismatch")
    counters = report["Counters"]
    maximums = {
        "Starts": 1,
        "PhiEntries": 258,
        "MidpointAttempts": 256,
        "BracketUpdates": 256,
        "LogEntries": 3,
        "ExpEntries": 258,
        "ObjectiveEntries": 1,
    }
    if (
        type(counters) is not dict
        or set(counters) != set(maximums)
        or any(
            type(counters[key]) is not int or not 0 <= counters[key] <= limit
            for key, limit in maximums.items()
        )
        or type(report["TraceRows"]) is not int
        or not 1 <= report["TraceRows"] <= 262
    ):
        raise ValueError("bounded exact producer counter/trace fields required")
    if (
        type(payload["Counters"]) is not dict
        or set(payload["Counters"]) != set(maximums)
        or any(type(v) is not int for v in payload["Counters"].values())
        or payload["Counters"] != report["Counters"]
        or type(payload["Trace"]) is not list
        or type(report["TraceRows"]) is not int
        or len(cast(list[object], payload["Trace"])) != report["TraceRows"]
    ):
        raise ValueError("producer return counters/trace length mismatch")
    outcome = payload["Outcome"]
    if type(outcome) is not dict or outcome.get("Kind") != report["ReceiptKind"]:
        raise ValueError("producer return kind mismatch")
    # Full numerical/trace admission belongs to the independent certificate.
    return report


def _bindings_bytes(bindings: Mapping[str, str], state: _State) -> bytes:
    # Bound the actual ensure_ascii JSON size before constructing the output.
    if len(bindings) > 1024:
        state.refuse("BindingsBound", "bounded caller binding roster required")
    size = 2
    for index, (key, value) in enumerate(bindings.items()):
        if (
            type(key) is not str
            or not key
            or len(key) > INPUT_CAP
            or type(value) is not str
            or not SHA.fullmatch(value)
        ):
            state.refuse("Bindings", "named uppercase SHA256 caller bindings required")
        size += (1 if index else 0) + 1 + 2 + 64 + 2
        for character in key:
            code = ord(character)
            size += (
                2
                if character in '\\"\b\f\n\r\t'
                else 6
                if code < 32 or 127 <= code <= 65535
                else 12
                if code > 65535
                else 1
            )
            if size > INPUT_CAP:
                state.refuse("BindingsBound", "caller binding encoding exceeds 64 KiB")
    raw = json.dumps(
        dict(bindings), ensure_ascii=True, separators=(",", ":"), allow_nan=False
    ).encode()
    if len(raw) != size or len(raw) > INPUT_CAP:
        state.refuse("BindingsBound", "caller binding size accounting mismatch")
    return raw


def launch_native(
    prepared: PreparedNative,
    raw_input: bytes,
    expected_input_sha256: str,
    expected_case_id: str,
    expected_bindings: Mapping[str, str],
    attempt_root: Path,
    *,
    timeout_seconds: float = 60.0,
) -> NativeObservation:
    state = _State()
    outcome = NativeObservation(StartedAtUtc=_utc())
    dependencies: list[DependencyObservation] = []
    inputs: list[FileObservation] = []
    receipt: bytes | None = None
    output: FileObservation | None = None
    producer: dict[str, object] | None = None
    output_path: Path | None = None
    try:
        if type(prepared) is not PreparedNative:
            state.refuse("Preparation", "typed preparation required")
        dependencies = list(prepared.Dependencies)
        outcome = replace(outcome, Dependencies=prepared.Dependencies)
        if not prepared.Complete or prepared.Host is None or prepared.Script is None:
            state.refuse(
                "Preparation", "complete independently admitted preparation required"
            )
        if type(raw_input) is not bytes or len(raw_input) > INPUT_CAP:
            state.refuse(
                "InputBound", "raw input must be bytes within 64 KiB before hashing"
            )
        if (
            not SHA.fullmatch(expected_input_sha256)
            or hashlib.sha256(raw_input).hexdigest().upper() != expected_input_sha256
        ):
            state.refuse("InputIdentity", "independent input identity mismatch")
        if (
            type(expected_case_id) is not str
            or not expected_case_id
            or len(expected_case_id) > INPUT_CAP
            or len(expected_case_id.encode("utf-8")) > INPUT_CAP
        ):
            state.refuse("CaseId", "bounded expected numeric subject required")
        if (
            type(timeout_seconds) not in (int, float)
            or not math.isfinite(timeout_seconds)
            or not 0 < timeout_seconds <= 120
        ):
            state.refuse("TimeoutArgument", "finite timeout in (0,120] required")
        binding_raw = _bindings_bytes(expected_bindings, state)
        attempt_root = attempt_root.absolute()
        attempt_root.mkdir(parents=False, exist_ok=False)
        for name, raw in (("input.json", raw_input), ("bindings.json", binding_raw)):
            state.stage = "input-publication"
            path = attempt_root / name
            _write(path, raw, state)
            _read(path, INPUT_CAP, state, inputs.append)
            _match(inputs[-1], _observation(path, raw), state)
        for i, dependency in enumerate(dependencies):
            state.stage = "prelaunch-files"
            baseline = (
                dependency.Copy if dependency.Copy is not None else dependency.Original
            )
            if baseline is None:
                state.refuse("Dependency", "missing prepared dependency observation")
            assert baseline is not None

            def before(value: FileObservation, i: int = i) -> None:
                dependencies[i] = replace(dependencies[i], Before=value)

            _read(Path(baseline.Path), FILE_CAP, state, before)
            current_before = dependencies[i].Before
            assert current_before is not None
            _match(current_before, baseline, state)
        output_path = attempt_root / "receipt.json"
        assert prepared.Host is not None and prepared.Script is not None
        argv = (
            prepared.Host.Path,
            "fsi",
            "--exec",
            prepared.Script.Path,
            str(attempt_root / "input.json"),
            expected_input_sha256,
            expected_case_id,
            str(attempt_root / "bindings.json"),
            str(output_path),
        )
        outcome = replace(outcome, Argv=argv)
        if sum(len(value.encode("utf-8")) for value in argv[4:]) > INPUT_CAP:
            state.refuse("ArgumentsBound", "five native arguments exceed 64 KiB")
        started = outcome.StartedAtUtc
        outcome = replace(
            _capture(argv, Path(prepared.Root), timeout_seconds), StartedAtUtc=started
        )
        state.failure = outcome.Failure
        state.cleanup.extend(outcome.Cleanup)
        # Even a failed child may have returned a bounded partial/complete file.
        if output_path.exists():
            state.stage = "output-read"
            previous = state.failure
            state.failure = None

            def output_seen(value: FileObservation) -> None:
                nonlocal output
                output = value

            try:
                receipt = _read(output_path, RECEIPT_CAP, state, output_seen)
            except _Stop:
                pass
            finally:
                later = state.failure
                state.failure = previous or later
                if previous is not None and later is not None:
                    state.cleanup.append(later)
        if outcome.Stdout:
            previous = state.failure
            try:
                producer = _json(outcome.Stdout, STDOUT_CAP)
            except Exception as error:  # noqa: BLE001 - retain malformed command and prior failure
                state.caught(error)
            if previous is not None:
                state.failure = previous
        state.check()
        if outcome.ExitCode != 0 or not outcome.DirectChildClosed:
            state.refuse("ChildOutcome", "closed exit-zero command required")
        if receipt is None or output is None:
            state.refuse("MissingReceipt", "complete output bytes required")
        assert receipt is not None and output is not None
        state.stage = "command-admission"
        _admit_command(
            outcome.Stdout,
            receipt,
            expected_case_id,
            expected_input_sha256,
            expected_bindings,
            tuple(inputs),
            output,
            dependencies,
        )
    except _Stop:
        pass
    except Exception as error:  # noqa: BLE001 - preserve typed boundary/cleanup failures
        state.caught(error)
    finally:
        if outcome.LaunchAttempted:
            # Recheck every declared host/script/reference even after prior failure.
            for i, dependency in enumerate(dependencies):
                baseline = (
                    dependency.Copy
                    if dependency.Copy is not None
                    else dependency.Original
                )
                if baseline is None:
                    continue
                previous = state.failure
                state.failure = None
                state.stage = "after-files"

                def after(value: FileObservation, i: int = i) -> None:
                    dependencies[i] = replace(dependencies[i], After=value)

                try:
                    _read(Path(baseline.Path), FILE_CAP, state, after)
                    current = dependencies[i].After
                    assert current is not None
                    _match(current, baseline, state)
                except _Stop:
                    pass
                except Exception as error:  # noqa: BLE001 - preserve typed boundary/cleanup failures
                    state.caught(error)
                finally:
                    later = state.failure
                    state.failure = previous or later
                    if previous is not None and later is not None:
                        state.cleanup.append(later)
    return replace(
        outcome,
        Complete=state.failure is None and producer is not None and receipt is not None,
        Receipt=receipt,
        Failure=state.failure,
        Cleanup=tuple(state.cleanup),
        InputFiles=tuple(inputs),
        Output=output,
        Producer=producer,
        Dependencies=tuple(dependencies),
        CreatedFiles=tuple(state.created),
        FinishedAtUtc=_utc(),
    )
