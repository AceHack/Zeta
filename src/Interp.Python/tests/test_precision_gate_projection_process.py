"""Finite transport fixtures only; no native/reference final solver subjects."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
from dataclasses import asdict, replace
from pathlib import Path
from typing import BinaryIO

import pytest
from zeta_interp import precision_gate_projection_process as p


def identity(raw: bytes) -> p.FileIdentity:
    return p.FileIdentity(len(raw), hashlib.sha256(raw).hexdigest().upper())


def prepare(tmp_path: Path) -> p.PreparedNative:
    source = tmp_path / "source"
    script = source / p.SCRIPT
    script.parent.mkdir(parents=True)
    references = (
        "src/Core/bin/Release/net10.0/Zeta.Core.dll",
        "src/Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll",
        "src/Bayesian/bin/Release/net10.0/Zeta.Bayesian.dll",
    )
    script.write_text("".join(f'#r "../{s[4:]}"\n' for s in references))
    host = Path(sys.executable).resolve()
    expected = {
        "@host": identity(host.read_bytes()),
        p.SCRIPT: identity(script.read_bytes()),
    }
    for index, relative in enumerate(references):
        file = source / relative
        file.parent.mkdir(parents=True, exist_ok=True)
        raw = f"synthetic nonexecutable DLL {index}".encode()
        file.write_bytes(raw)
        expected[relative] = identity(raw)
    result = p.prepare_native(source, tmp_path / "custody", host, expected)
    assert result.Complete, result.Failure
    return result


def test_preparation_copies_all_three_references_and_keeps_host_distinct(
    tmp_path: Path,
) -> None:
    actual = prepare(tmp_path)
    assert len(actual.References) == 3
    assert len(actual.Dependencies) == 5
    assert len(actual.CreatedFiles) == 4
    assert actual.Dependencies[0].Role == "@host"
    assert actual.Dependencies[0].Copy is None
    for row in actual.Dependencies[1:]:
        assert row.Original is not None and row.Copy is not None
        assert (row.Original.Bytes, row.Original.Sha256) == (
            row.Copy.Bytes,
            row.Copy.Sha256,
        )
        assert Path(row.Copy.Path).read_bytes() == Path(row.Original.Path).read_bytes()
        assert row.Producer is None


def test_binding_size_accounting_matches_actual_json_for_escape_classes() -> None:
    state = p._State()
    values = {"key" + chr(i): "A" * 64 for i in range(256)}
    values["astral\U0001f600"] = "B" * 64
    values["surrogate\ud800"] = "C" * 64
    raw = p._bindings_bytes(values, state)
    assert json.loads(raw) == values
    assert len(raw) <= p.INPUT_CAP


def test_huge_input_is_refused_before_hash_or_child(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prepared = prepare(tmp_path)

    def forbidden_hash(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("hash must not be entered")

    monkeypatch.setattr(hashlib, "sha256", forbidden_hash)
    result = p.launch_native(
        prepared,
        b"x" * (p.INPUT_CAP + 1),
        "A" * 64,
        "fixture",
        {},
        tmp_path / "attempt",
    )
    assert result.Failure is not None and result.Failure.Code == "InputBound"
    assert not result.LaunchAttempted and not result.CreatedFiles


def test_binding_bound_precedes_json_expansion(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prepared = prepare(tmp_path)

    def forbidden_json(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("JSON expansion must not be entered")

    monkeypatch.setattr(json, "dumps", forbidden_json)
    result = p.launch_native(
        prepared,
        b"{}",
        identity(b"{}").Sha256,
        "fixture",
        {"x" * p.INPUT_CAP: "A" * 64},
        tmp_path / "attempt",
    )
    assert result.Failure is not None and result.Failure.Code == "BindingsBound"
    assert not result.LaunchAttempted and not result.CreatedFiles


def test_fsync_failure_survives_real_close_then_secondary_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original_close = os.close
    closed: list[int] = []

    def fsync_fail(_fd: int) -> None:
        raise OSError("primary fsync")

    def close_fail(fd: int) -> None:
        original_close(fd)
        closed.append(fd)
        raise OSError("secondary close")

    monkeypatch.setattr(os, "fsync", fsync_fail)
    monkeypatch.setattr(os, "close", close_fail)
    state = p._State()
    target = tmp_path / "owned"
    with pytest.raises(p._Stop):
        p._write(target, b"retained actual bytes", state)
    assert state.failure is not None and state.failure.Message == "primary fsync"
    assert len(state.cleanup) == 1 and "secondary close" in state.cleanup[0].Message
    assert len(closed) == 1 and state.created == [str(target)]
    assert target.read_bytes() == b"retained actual bytes"


def test_actual_owned_python_streams_keep_stderr_without_empty_stderr_policy(
    tmp_path: Path,
) -> None:
    argv = (
        sys.executable,
        "-c",
        "import sys; print('owned stdout'); print('diagnostic', file=sys.stderr)",
    )
    result = p._capture(argv, tmp_path, 5.0)
    assert result.Argv == argv and result.LaunchAttempted
    assert (
        result.ChildPid is not None and result.ExitCode == result.CleanupExitCode == 0
    )
    assert result.DirectChildClosed and result.ReadersClosed
    assert result.Stdout == b"owned stdout\n" and result.Stderr == b"diagnostic\n"
    assert result.StdoutEof and result.StderrEof and result.Failure is None


def test_actual_owned_stream_bound_keeps_cap_plus_one_witness(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(p, "STDOUT_CAP", 32)
    result = p._capture(
        (sys.executable, "-c", "import sys; sys.stdout.buffer.write(b'x'*4096)"),
        tmp_path,
        5.0,
    )
    assert result.Stdout == b"x" * 33
    assert result.StdoutLimitExceeded and result.Failure is not None
    assert result.DirectChildClosed and result.ReadersClosed


def test_actual_owned_timeout_closes_only_its_direct_child(tmp_path: Path) -> None:
    result = p._capture(
        (sys.executable, "-c", "import time; time.sleep(10)"), tmp_path, 0.02
    )
    assert result.Failure is not None and result.Failure.Code == "Timeout"
    assert result.ChildPid is not None and result.DirectChildClosed
    assert result.CleanupExitCode is not None


def test_launch_failure_retains_attempt_and_exact_argv(tmp_path: Path) -> None:
    argv = (str(tmp_path / "absent-executable"), "fixture")
    result = p._capture(argv, tmp_path, 1.0)
    assert result.Argv == argv and result.LaunchAttempted and result.ChildPid is None
    assert result.Failure is not None and result.ExitCode is None
    assert result.Stdout == result.Stderr == b""


class FakeChild:
    def __init__(self, *, poll_error: bool, join_error: bool) -> None:
        self.pid = (
            123  # Synthetic Popen seam, never an observed operating-system child.
        )
        self.stdout: BinaryIO = tempfile.TemporaryFile("w+b")  # noqa: SIM115 - driver owns fixture close
        self.stderr: BinaryIO = tempfile.TemporaryFile("w+b")  # noqa: SIM115 - driver owns fixture close
        self.poll_error = poll_error
        self.join_error = join_error
        self.events: list[str] = []

    def poll(self) -> int:
        self.events.append("poll")
        if self.poll_error:
            raise OSError("poll failure")
        return 0

    def kill(self) -> None:
        self.events.append("kill")

    def wait(self, *, timeout: float) -> int:
        self.events.append("wait")
        assert timeout > 0
        if self.join_error:
            raise subprocess.TimeoutExpired("synthetic", timeout)
        return 0


@pytest.mark.parametrize("poll_error,join_error", [(True, False), (False, True)])
def test_poll_or_join_failure_keeps_independent_cleanup_attempts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, poll_error: bool, join_error: bool
) -> None:
    child = FakeChild(poll_error=poll_error, join_error=join_error)

    def create(*_args: object, **_kwargs: object) -> FakeChild:
        return child

    monkeypatch.setattr(subprocess, "Popen", create)
    result = p._capture(("synthetic",), tmp_path, 1.0)
    assert "wait" in child.events and child.stdout.closed and child.stderr.closed
    assert result.Failure is not None
    if poll_error:
        assert "kill" in child.events and result.DirectChildClosed
    else:
        assert result.ExitCode == 0 and result.CleanupExitCode is None
        assert not result.DirectChildClosed


def synthetic_capture(
    prepared: p.PreparedNative, argv: tuple[str, ...], *, failed: bool = False
) -> p.NativeObservation:
    """Constructed transport receipt, not a native numerical result."""
    source, expected_hash, case_id, binding_path, output_path = argv[4:]
    bindings = json.loads(Path(binding_path).read_bytes())
    counters = {
        key: 0
        for key in (
            "Starts",
            "PhiEntries",
            "MidpointAttempts",
            "BracketUpdates",
            "LogEntries",
            "ExpEntries",
            "ObjectiveEntries",
        )
    }
    payload = {
        "Schema": "zeta.precision-projection.native.v1",
        "CaseId": case_id,
        "InputSha256": expected_hash,
        "Bindings": bindings,
        "Outcome": {"Kind": "refused"},
        "Counters": counters,
        "Trace": [{}],
    }
    raw = json.dumps(payload).encode()
    Path(output_path).write_bytes(raw)
    files = [
        asdict(p._observation(Path(path), Path(path).read_bytes()))
        for path in (source, binding_path)
    ]
    assemblies = [
        asdict(d.Copy)
        for d in prepared.Dependencies
        if d.Copy is not None
        and Path(d.Copy.Path).name in ("Zeta.Core.dll", "Zeta.Bayesian.dll")
    ]
    report = {
        "Schema": "zeta.precision-projection.command.v1",
        "Complete": not failed,
        "Failure": {"Stage": "synthetic", "Code": "fixture", "Message": "retained"}
        if failed
        else None,
        "ApiFailure": None,
        "Cleanup": [],
        "InputFiles": files,
        "AssemblyFiles": assemblies,
        "Output": asdict(p._observation(Path(output_path), raw)),
        "ReceiptAvailable": True,
        "ReceiptKind": "refused",
        "Counters": counters,
        "TraceRows": 1,
        "Runtime": "synthetic transport fixture",
    }
    return p.NativeObservation(
        Argv=argv,
        LaunchAttempted=True,
        ChildPid=123,
        ExitCode=2 if failed else 0,
        CleanupExitCode=2 if failed else 0,
        DirectChildClosed=True,
        ReadersClosed=True,
        Stdout=json.dumps(report).encode() + b"\n",
        Stderr=b"retained diagnostic\n",
        StdoutEof=True,
        StderrEof=True,
    )


@pytest.mark.parametrize("failed", [False, True])
def test_transport_retains_returned_bytes_and_typed_report_even_on_exit_two(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, failed: bool
) -> None:
    prepared = prepare(tmp_path)

    def capture(
        argv: tuple[str, ...], _cwd: Path, _timeout: float
    ) -> p.NativeObservation:
        return synthetic_capture(prepared, argv, failed=failed)

    monkeypatch.setattr(p, "_capture", capture)
    result = p.launch_native(
        prepared,
        b"{}",
        identity(b"{}").Sha256,
        "fixture",
        {"ProtocolSha256": "A" * 64},
        tmp_path / "attempt",
    )
    assert result.Receipt is not None and result.Producer is not None
    assert result.Producer["Complete"] is (not failed)
    assert result.Complete is (not failed)
    assert result.Stderr == b"retained diagnostic\n"
    assert all(d.After is not None for d in result.Dependencies)
    if not failed:
        assert sum(d.Producer is not None for d in result.Dependencies) == 2
    else:
        assert result.Failure is not None and result.Failure.Code == "ChildOutcome"


def test_read_cap_precedes_hash_and_retains_no_invented_observation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "bounded"
    source.write_bytes(b"xx")

    def forbidden(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("hash must not be entered")

    monkeypatch.setattr(hashlib, "sha256", forbidden)
    state = p._State()
    observations: list[p.FileObservation] = []
    with pytest.raises(p._Stop):
        p._read(source, 1, state, observations.append)
    assert state.failure is not None and state.failure.Code == "FileBound"
    assert observations == []


@pytest.mark.skipif(os.name != "posix", reason="Unix FIFO admission fixture")
def test_nonblocking_fifo_is_rejected_before_any_read(tmp_path: Path) -> None:
    source = tmp_path / "fifo"
    os.mkfifo(source)
    state = p._State()
    observations: list[p.FileObservation] = []
    with pytest.raises(p._Stop):
        p._read(source, 10, state, observations.append)
    assert state.failure is not None and state.failure.Code == "FileBound"
    assert observations == []


def test_changed_copy_refuses_before_launch_and_preserves_actual_before(
    tmp_path: Path,
) -> None:
    prepared = prepare(tmp_path)
    copy = prepared.Dependencies[-1].Copy
    assert copy is not None
    Path(copy.Path).write_bytes(b"changed actual copied dependency")
    actual = p.launch_native(
        prepared, b"{}", identity(b"{}").Sha256, "fixture", {}, tmp_path / "attempt"
    )
    assert actual.Failure is not None and actual.Failure.Code == "FileIdentity"
    assert not actual.LaunchAttempted
    before = actual.Dependencies[-1].Before
    assert (
        before is not None
        and before.Sha256 == identity(b"changed actual copied dependency").Sha256
    )
    assert actual.Dependencies[-1].Copy == copy


def test_boolean_counter_mismatch_keeps_complete_raw_return_for_review(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prepared = prepare(tmp_path)

    def capture(
        argv: tuple[str, ...], _cwd: Path, _timeout: float
    ) -> p.NativeObservation:
        original = synthetic_capture(prepared, argv)
        report = json.loads(original.Stdout)
        payload = json.loads(Path(argv[-1]).read_bytes())
        report["Counters"]["Starts"] = False
        payload["Counters"]["Starts"] = False
        raw = json.dumps(payload).encode()
        Path(argv[-1]).write_bytes(raw)
        report["Output"] = asdict(p._observation(Path(argv[-1]), raw))
        return replace(original, Stdout=json.dumps(report).encode() + b"\n")

    monkeypatch.setattr(p, "_capture", capture)
    actual = p.launch_native(
        prepared, b"{}", identity(b"{}").Sha256, "fixture", {}, tmp_path / "attempt"
    )
    assert not actual.Complete and actual.Failure is not None
    assert actual.Receipt is not None and actual.Producer is not None
    assert json.loads(actual.Receipt)["Counters"]["Starts"] is False
    assert actual.Failure.Stage == "command-admission"


@pytest.mark.parametrize("receipt_only", [True, False])
def test_independent_receipt_read_or_type_failure_keeps_stdout_report(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, receipt_only: bool
) -> None:
    prepared = prepare(tmp_path)

    def capture(
        argv: tuple[str, ...], _cwd: Path, _timeout: float
    ) -> p.NativeObservation:
        original = synthetic_capture(prepared, argv)
        path = Path(argv[-1])
        if receipt_only:
            report = json.loads(original.Stdout)
            payload = json.loads(path.read_bytes())
            payload["Counters"]["Starts"] = False
            raw = json.dumps(payload).encode()
            path.write_bytes(raw)
            report["Output"] = asdict(p._observation(path, raw))
            return replace(original, Stdout=json.dumps(report).encode() + b"\n")
        path.write_bytes(b"x" * (p.RECEIPT_CAP + 1))
        return original

    monkeypatch.setattr(p, "_capture", capture)
    actual = p.launch_native(
        prepared, b"{}", identity(b"{}").Sha256, "fixture", {}, tmp_path / "attempt"
    )
    assert not actual.Complete and actual.Failure is not None
    assert actual.Producer is not None and actual.Stdout
    assert all(d.After is not None for d in actual.Dependencies)
    if receipt_only:
        assert actual.Receipt is not None
        assert actual.Failure.Stage == "command-admission"
    else:
        assert actual.Receipt is None and actual.Failure.Code == "FileBound"


def test_existing_output_directory_is_not_replaced(tmp_path: Path) -> None:
    prepared = prepare(tmp_path)
    attempt = tmp_path / "attempt"
    attempt.mkdir()
    marker = attempt / "marker"
    marker.write_bytes(b"already owned")
    actual = p.launch_native(
        prepared, b"{}", identity(b"{}").Sha256, "fixture", {}, attempt
    )
    assert not actual.Complete and not actual.LaunchAttempted
    assert actual.Failure is not None and actual.Failure.Code == "FileExistsError"
    assert marker.read_bytes() == b"already owned" and actual.CreatedFiles == ()


class UnjoinedReader:
    def __init__(self, **_kwargs: object) -> None:
        pass

    def start(self) -> None:
        pass

    def join(self, *, timeout: float) -> None:
        raise OSError("synthetic reader cannot join")

    def is_alive(self) -> bool:
        return True


def test_unjoined_reader_keeps_its_real_pipe_open(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import threading

    child = FakeChild(poll_error=False, join_error=False)
    monkeypatch.setattr(subprocess, "Popen", lambda *_args, **_kwargs: child)
    monkeypatch.setattr(threading, "Thread", UnjoinedReader)
    try:
        actual = p._capture(("synthetic",), tmp_path, 1.0)
        assert actual.DirectChildClosed and not actual.ReadersClosed
        assert not child.stdout.closed and not child.stderr.closed
        assert actual.Failure is not None
    finally:
        child.stdout.close()
        child.stderr.close()


def test_output_bytes_survive_real_close_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prepared = prepare(tmp_path)
    output = tmp_path / "attempt/receipt.json"
    original_close = os.close
    closed: list[int] = []

    def close(fd: int) -> None:
        target = output.exists() and os.fstat(fd).st_ino == output.stat().st_ino
        original_close(fd)
        if target:
            closed.append(fd)
            raise OSError("receipt close after actual read")

    def capture(
        argv: tuple[str, ...], _cwd: Path, _timeout: float
    ) -> p.NativeObservation:
        return synthetic_capture(prepared, argv)

    monkeypatch.setattr(p, "_capture", capture)
    monkeypatch.setattr(os, "close", close)
    actual = p.launch_native(
        prepared, b"{}", identity(b"{}").Sha256, "fixture", {}, tmp_path / "attempt"
    )
    assert not actual.Complete and actual.Failure is not None
    assert actual.Receipt == output.read_bytes()
    assert actual.Output is not None and actual.Producer is not None
    assert len(closed) == 1
    assert actual.Failure.Code == "FileClose"
    assert all(d.After is not None for d in actual.Dependencies)


def test_reader_can_cancel_when_owned_pipe_writer_remains_open(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    child = FakeChild(poll_error=False, join_error=False)
    child.stdout.close()
    read_fd, write_fd = os.pipe()
    child.stdout = os.fdopen(read_fd, "rb")
    monkeypatch.setattr(subprocess, "Popen", lambda *_args, **_kwargs: child)
    try:
        actual = p._capture(("synthetic",), tmp_path, 1.0)
        assert actual.DirectChildClosed and actual.ReadersClosed
        assert not actual.StdoutEof and child.stdout.closed
        assert actual.Failure is not None and actual.Failure.Code == "IncompleteStreams"
    finally:
        os.close(write_fd)
