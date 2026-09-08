"""Bounded mixed-epoch coordinator; actual returns precede fallible publication.

The service/source identities are independently supplied caller premises.
This module neither establishes transitive runtime closure nor selects a
numerical experiment. A handle owns its one recorder and finite session route;
normal refusals never authorize a replacement session or a budget refund.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import select
import struct
import subprocess
import sys
import time
from collections.abc import Callable, Mapping
from copy import deepcopy
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from functools import partial
from pathlib import Path
from typing import Any, BinaryIO, NoReturn, cast
from weakref import WeakKeyDictionary

from . import hidden_switch_compiled_admission as admission
from . import hidden_switch_compiled_record_encoding as encoding
from . import hidden_switch_compiled_record_store as records
from . import hidden_switch_compiled_storage as storage
from . import mixed_message_epoch_controls as controls
from . import precision_gate_projection_process as native
from . import precision_gate_projection_reference as reference

SCHEMA = "zeta.mixed-epoch.peer.v1"
CONTRACT_SHA256 = "4234015EE650FA7190CF3375C58654499F3BB9EC9C96E4BE21D2FC97A30EC979"
MIB = 1024 * 1024
TRANSCRIPT_LIMIT = 64 * MIB
TERMINAL_RESERVE = MIB
FRAME_LIMIT = 16384
RETENTION_LIMIT = 256 * MIB
ARTIFACT_LIMIT = 4096
JOURNAL_RESERVE = 8 * MIB
PEER_SCRIPT = "src/Research.FSharp/MixedMessageEpochReplay.fsx"
_HASH = re.compile(r"[0-9A-F]{64}\Z", re.ASCII)
_BITS = re.compile(r"[0-9A-F]{16}\Z", re.ASCII)
_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._/-]{0,63}\Z", re.ASCII)
_DECIMAL = re.compile(r"-?(0|[1-9][0-9]*)(\.[0-9]+)?(e[+-]?[0-9]+)?\Z", re.ASCII)
_HEADER = frozenset(("Kind", "Schema", "SessionId"))
_KEYS = {
    "Start": _HEADER
    | {"Plan", "PlanSha256", "ServiceSha256", "ExpectedBindings", "BudgetSnapshot"},
    "Ready": _HEADER | {"PlanSha256", "ServiceSha256"},
    "Checkpoint": _HEADER | {"Sequence", "Observation", "LastRevision", "StateSha256"},
    "ProjectionRequest": _HEADER
    | {
        "Sequence",
        "RequestId",
        "InputRevision",
        "Base",
        "TargetBits",
        "RawInputHex",
        "InputSha256",
        "CaseId",
        "BindingsSha256",
        "Remaining",
    },
    "CheckpointAck": _HEADER
    | {"Sequence", "CheckpointSha256", "Outcome", "BudgetSnapshot"},
    "Commit": _HEADER
    | {
        "Sequence",
        "CheckpointSha256",
        "AppliedRevision",
        "LastCommitted",
        "Counters",
    },
    "ProjectionResponse": _HEADER
    | {
        "Sequence",
        "RequestId",
        "InputSha256",
        "BindingsSha256",
        "ServiceSha256",
        "Native",
        "Certificate",
        "Failure",
        "BudgetSnapshot",
    },
    "EpochReturn": _HEADER | {"Sequence", "Result", "ResultSha256"},
    "Terminal": _HEADER
    | {
        "Outcome",
        "Termination",
        "Failure",
        "Counters",
        "LastCommitted",
        "LedgerCount",
        "LedgerSha256",
        "PendingRequest",
        "Publication",
    },
}
_CAPS = {
    "Start": MIB,
    "Ready": 64 * 1024,
    "Checkpoint": 16 * MIB,
    "ProjectionRequest": 256 * 1024,
    "CheckpointAck": 64 * 1024,
    "Commit": 64 * 1024,
    "ProjectionResponse": 12 * MIB,
    "EpochReturn": 16 * MIB,
    "Terminal": MIB,
}
type Tree = dict[str, Any]


@dataclass(frozen=True, slots=True)
class Failure:
    Code: str
    Stage: str
    Field: str | None
    Message: str


BridgeFailure = Failure


@dataclass(frozen=True, slots=True)
class Raised:
    Type: str
    Message: str


@dataclass(frozen=True, slots=True)
class CallObservation:
    Operation: str
    Returned: object
    Raised: Raised | None


@dataclass(frozen=True, slots=True)
class Frame:
    Raw: bytes
    Sha256: str
    Value: Tree


@dataclass(frozen=True, slots=True)
class Reservation:
    Projections: int
    ExternalBytes: int
    ExternalSlots: int
    StoreLimits: records.Limits


class _Stop(Exception):
    def __init__(self, failure: Failure) -> None:
        super().__init__(failure.Message)
        self.failure = failure


def _fail(code: str, stage: str, name: str | None, message: str) -> NoReturn:
    raise _Stop(Failure(code, stage, name, message))


def _sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest().upper()


def _keys(value: object, names: set[str] | frozenset[str], name: str) -> Tree:
    if type(value) is not dict or set(value) != names:
        _fail("Admission", "admit", name, "exact record keys required")
    return cast(Tree, value)


def _integer(value: object, name: str, lower: int, upper: int) -> int:
    if type(value) is not int or not lower <= value <= upper:
        _fail("Admission", "admit", name, "exact bounded integer required")
    return value


def _hash(value: object, name: str) -> str:
    if type(value) is not str or _HASH.fullmatch(value) is None:
        _fail("Admission", "admit", name, "uppercase SHA256 required")
    return value


def _id(value: object, name: str) -> str:
    if type(value) is not str or _ID.fullmatch(value) is None:
        _fail("Admission", "admit", name, "bounded ASCII identity required")
    return value


def _pairs(items: list[tuple[str, object]]) -> Tree:
    result: Tree = {}
    for key, value in items:
        if key in result:
            _fail("Admission", "admit", key, "duplicate JSON key")
        result[key] = value
    return result


def _non_integer(_: str) -> NoReturn:
    _fail("Admission", "admit", "JSON", "floating or nonfinite JSON number")


def _bounded_integer(text: str) -> int:
    if len(text) > 20:
        _fail("Admission", "admit", "JSON", "integer exceeds int64")
    value = int(text)
    return _integer(value, "JSON", -(1 << 63), (1 << 63) - 1)


def _tree(value: object, *, maximum_nodes: int = 100_000) -> None:
    pending = [(value, 0)]
    nodes = 0
    while pending:
        item, depth = pending.pop()
        nodes += 1
        if nodes > maximum_nodes or depth > 128:
            _fail("Budget", "admit", "JSON", "JSON node/depth allowance exhausted")
        if item is None or type(item) is bool:
            continue
        if type(item) is int:
            _integer(item, "JSON", -(1 << 63), (1 << 63) - 1)
        elif type(item) is str:
            item.encode("utf-8", errors="strict")
        elif type(item) is list:
            if len(item) > maximum_nodes - nodes:
                _fail(
                    "Budget", "admit", "JSON", "array exceeds remaining node allowance"
                )
            pending.extend((child, depth + 1) for child in item)
        elif type(item) is dict:
            if len(item) > maximum_nodes - nodes:
                _fail(
                    "Budget", "admit", "JSON", "record exceeds remaining node allowance"
                )
            for key, child in item.items():
                if type(key) is not str or not key.isascii():
                    _fail("Admission", "admit", "JSON", "ASCII object keys required")
                pending.append((child, depth + 1))
        else:
            _fail("Admission", "admit", "JSON", "unsupported JSON value")


def _json(raw: object, cap: int) -> object:
    if type(raw) is not bytes or len(raw) > cap:
        _fail("Budget", "admit", "Raw", "bounded original bytes required")
    result = json.loads(
        raw.decode("utf-8", errors="strict"),
        object_pairs_hook=_pairs,
        parse_float=_non_integer,
        parse_constant=_non_integer,
        parse_int=_bounded_integer,
    )
    _tree(result)
    return result


def _same(left: object, right: object) -> bool:
    """Bounded structural equality that preserves JSON primitive types."""
    pending = [(left, right, 0)]
    nodes = 0
    while pending:
        actual, expected, depth = pending.pop()
        nodes += 1
        if nodes > 100_000 or depth > 128 or type(actual) is not type(expected):
            return False
        if actual is None:
            continue
        if type(actual) in (bool, int, str):
            if actual != expected:
                return False
        elif isinstance(actual, dict):
            other = cast(dict[str, object], expected)
            if (
                any(type(key) is not str for key in actual)
                or any(type(key) is not str for key in other)
                or actual.keys() != other.keys()
                or len(actual) > 100_000 - nodes
            ):
                return False
            pending.extend(
                (value, other[key], depth + 1) for key, value in actual.items()
            )
        elif isinstance(actual, (list, tuple)):
            sequence = cast(list[object] | tuple[object, ...], expected)
            if len(actual) != len(sequence) or len(actual) > 100_000 - nodes:
                return False
            pending.extend(
                (a, b, depth + 1) for a, b in zip(actual, sequence, strict=True)
            )
        else:
            return False
    return True


def _canonical(value: object, cap: int, *, newline: bool = False) -> bytes:
    _tree(value)
    encoded = bytearray()
    allowance = cap - int(newline)

    def emit(raw: bytes) -> None:
        if len(raw) > allowance - len(encoded):
            _fail("Budget", "publish", "JSON", "encoded record exceeds allowance")
        encoded.extend(raw)

    def string(text: str) -> None:
        emit(b'"')
        for offset in range(0, len(text), 512):
            part = text[offset : offset + 512]
            raw = json.dumps(part, ensure_ascii=False)[1:-1].encode(
                "utf-8", errors="strict"
            )
            emit(raw)
        emit(b'"')

    def visit(item: object) -> None:
        if item is None:
            emit(b"null")
        elif type(item) is bool:
            emit(b"true" if item else b"false")
        elif type(item) is int:
            emit(str(item).encode("ascii"))
        elif type(item) is str:
            string(item)
        elif type(item) is list:
            emit(b"[")
            for index, child in enumerate(item):
                if index:
                    emit(b",")
                visit(child)
            emit(b"]")
        else:
            record = cast(Tree, item)
            emit(b"{")
            for index, key in enumerate(sorted(record)):
                if index:
                    emit(b",")
                string(key)
                emit(b":")
                visit(record[key])
            emit(b"}")

    visit(value)
    if newline:
        encoded.append(10)
    return bytes(encoded)


def decode_frame(raw: object, session_id: object) -> Frame | Failure:
    """Admit an already retained frame; no session progression or numerical call."""
    try:
        session = _id(session_id, "SessionId")
        if type(raw) is not bytes or len(raw) > 16 * MIB:
            _fail("Budget", "admit", "Frame", "frame exceeds absolute cap")
        if not raw.endswith(b"\n") or raw.count(b"\n") != 1:
            _fail(
                "Transport",
                "admit",
                "Frame",
                "one complete LF-terminated record required",
            )
        value = _json(raw, 16 * MIB)
        if type(value) is not dict:
            _fail("Admission", "admit", "Frame", "object frame required")
        kind = value.get("Kind")
        if type(kind) is not str or kind not in _KEYS:
            _fail("Admission", "admit", "Kind", "unknown protocol frame")
        record = _keys(value, _KEYS[kind], "Frame")
        if record["Schema"] != SCHEMA or record["SessionId"] != session:
            _fail(
                "Conflict", "admit", "SessionId", "protocol/session identity mismatch"
            )
        if len(raw) > _CAPS[kind]:
            _fail("Budget", "admit", "Frame", "kind-specific frame allowance exceeded")
        if "Sequence" in record:
            _integer(record["Sequence"], "Sequence", 1, FRAME_LIMIT)
        return Frame(raw, _sha(raw), record)
    except _Stop as error:
        return error.failure
    except (ValueError, UnicodeError, RecursionError) as error:
        return Failure("Admission", "admit", "Frame", type(error).__name__)


def _observe(
    operation: str, call: Callable[[], object], ledger: list[CallObservation]
) -> CallObservation:
    try:
        value = call()
    except Exception as error:  # noqa: BLE001 - actual boundary preserves raised vs returned.
        result = CallObservation(
            operation, None, Raised(type(error).__name__, str(error)[:1024])
        )
    else:
        result = CallObservation(operation, value, None)
    ledger.append(result)
    return result


def _bits(value: object, name: str) -> float:
    if type(value) is not str or _BITS.fullmatch(value) is None:
        _fail("Admission", "admit", name, "exact binary64 bits required")
    number = struct.unpack(">d", bytes.fromhex(value))[0]
    if not math.isfinite(number):
        _fail("Arithmetic", "admit", name, "finite binary64 value required")
    return cast(float, number)


def _round_trip(text: object, bits: object, name: str) -> None:
    _bits(bits, name)
    if type(text) is not str or len(text) > 4096 or _DECIMAL.fullmatch(text) is None:
        _fail("Admission", "admit", name, "invariant decimal text required")
    number = float(text)
    if not math.isfinite(number) or struct.pack(">d", number).hex().upper() != bits:
        _fail("Conflict", "admit", name, "rendered target differs from admitted bits")


def _reservation(
    projections: int, expected_files: Mapping[str, native.FileIdentity]
) -> Reservation:
    _integer(projections, "Projections", 0, 32)
    if projections == 0:
        external, slots = 0, 0
    else:
        if (
            len(expected_files) != 5
            or native.SCRIPT not in expected_files
            or "@host" not in expected_files
        ):
            _fail(
                "Admission",
                "admit",
                "NativeFiles",
                "exact independently admitted native roster required",
            )
        total = 0
        for path, pin in expected_files.items():
            if type(pin) is not native.FileIdentity:
                _fail("Admission", "admit", path, "typed direct file identity required")
            _integer(pin.Bytes, path, 0, native.FILE_CAP)
            _hash(pin.Sha256, path)
            if path != "@host":
                total += pin.Bytes
        external = 2 * (total + projections * (64 * 1024 + 64 * 1024 + 2 * MIB))
        slots = 4 + 3 * projections
    available = RETENTION_LIMIT - external
    remaining_slots = ARTIFACT_LIMIT - slots
    if available <= 10 * MIB or remaining_slots < 3:
        _fail(
            "Budget",
            "admit",
            "Reservation",
            "insufficient journal, terminal and ordinary room",
        )
    return Reservation(
        projections,
        external,
        slots,
        records.Limits(available, JOURNAL_RESERVE, remaining_slots),
    )


@dataclass(slots=True)
class _Budget:
    Reservation: Reservation
    Started: float
    Clock: Callable[[], float] = time.monotonic
    ProtocolBytes: int = 0
    Frames: int = 0
    PeerLaunches: int = 0
    NativePreparationEntered: int = 0
    SnapshotIndex: int = 0
    CompletedSessions: int = 0
    NativeCallEntered: int = 0
    NativeLaunchAttempted: int = 0
    NativeReturned: int = 0
    CertificateEntered: int = 0
    CertificateReturned: int = 0
    NestedReferenceEntered: int = 0
    Calls: list[CallObservation] = field(default_factory=list)
    RemoteIncomplete: set[str] = field(default_factory=set)
    PriorWork: dict[str, int] = field(
        default_factory=lambda: dict.fromkeys(
            (
                "SchedulerEntered",
                "KernelEntered",
                "ForwardEntered",
                "LearnEntered",
                "ProjectionRequested",
                "NativeLaunchAttempted",
                "CertificateEntered",
                "NestedReferenceEntered",
                "TrainingArtifacts",
            ),
            0,
        )
    )
    LastSnapshot: Tree | None = None
    Failure: Failure | None = None

    def stop(self, failure: BridgeFailure) -> None:
        if self.Failure is None:
            self.Failure = failure

    def check(self) -> None:
        if self.Failure is not None:
            raise _Stop(self.Failure)
        if self.Clock() - self.Started > 300:
            _fail(
                "Budget", "scheduler", "Elapsed", "outer cooperative deadline exhausted"
            )

    def charge_frame(self, size: int, *, terminal: bool = False) -> None:
        self.check()
        _integer(size, "ProtocolBytes", 1, 16 * MIB)
        cap = TRANSCRIPT_LIMIT if terminal else TRANSCRIPT_LIMIT - TERMINAL_RESERVE
        if size > cap - self.ProtocolBytes or self.Frames >= FRAME_LIMIT:
            _fail(
                "Budget",
                "publish",
                "ProtocolBytes",
                "shared transcript/frame allowance exhausted",
            )
        self.ProtocolBytes += size
        self.Frames += 1


def _snapshot(store: records.Store, budget: _Budget) -> Tree:
    observed = _observe("snapshot", lambda: records.snapshot(store), budget.Calls)
    if (
        observed.Raised is not None
        or type(observed.Returned) is not admission.Admitted
        or type(observed.Returned.value) is not records.Snapshot
    ):
        _fail(
            "Storage",
            "publish",
            "BudgetSnapshot",
            "actual recorder reservation snapshot unavailable",
        )
    state = observed.Returned.value
    remaining = max(0, math.floor((300 - (budget.Clock() - budget.Started)) * 1000))
    remaining = min(300000, remaining)
    budget.SnapshotIndex += 1
    snapshot = {
        "SnapshotIndex": budget.SnapshotIndex,
        "CompletedSessions": budget.CompletedSessions,
        "PriorWork": dict(budget.PriorWork),
        "Store": {
            "ReservedCombinedBytes": budget.Reservation.ExternalBytes
            + state.ReservedRawBytes
            + state.ReservedStoredBytes,
            "ReservedArtifactSlots": budget.Reservation.ExternalSlots
            + state.ReservedSlots,
        },
        "TranscriptBytes": budget.ProtocolBytes,
        "TranscriptFrames": budget.Frames,
        "PeerLaunchAttempted": budget.PeerLaunches,
        "NativePreparationEntered": budget.NativePreparationEntered,
        "RemainingMilliseconds": remaining,
    }
    if budget.LastSnapshot is not None:
        snapshot["RemainingMilliseconds"] = min(
            remaining, budget.LastSnapshot["RemainingMilliseconds"]
        )
    budget.LastSnapshot = snapshot
    return snapshot


@dataclass(frozen=True, slots=True)
class WriteObservation:
    Original: bytes
    WrittenBytes: int
    Failure: Failure | None


@dataclass(frozen=True, slots=True)
class PeerObservation:
    Argv: tuple[str, ...]
    StartedAtUtc: str
    FinishedAtUtc: str | None = None
    LaunchAttempted: bool = False
    ChildPid: int | None = None
    ExitCode: int | None = None
    CleanupExitCode: int | None = None
    DirectChildClosed: bool = False
    StdoutEof: bool = False
    StderrEof: bool = False
    Stdout: tuple[bytes, ...] = ()
    Stderr: bytes = b""
    PendingStdout: bytes = b""
    Writes: tuple[WriteObservation, ...] = ()
    Failure: Failure | None = None
    Cleanup: tuple[CallObservation, ...] = ()


class _Peer:
    """Single-threaded finite pipes; cleanup attempts are independent observations."""

    def __init__(
        self, argv: tuple[str, ...], cwd: Path, budget: _Budget, maximum_launches: int
    ) -> None:
        self.budget = budget
        self.process: subprocess.Popen[bytes] | None = None
        self.buffer = bytearray()
        self.stdout: list[bytes] = []
        self.stderr = bytearray()
        self.writes: list[WriteObservation] = []
        self.cleanup: list[CallObservation] = []
        self.closed = False
        self.incoming_open = False
        self.output_failure: Failure | None = None
        self.delivered: list[bytes] = []
        self.observation = PeerObservation(argv, datetime.now(UTC).isoformat())
        budget.check()
        if budget.PeerLaunches >= maximum_launches:
            _fail(
                "Budget",
                "admit",
                "PeerLaunchAttempted",
                "fixed outer route launch allowance exhausted",
            )
        budget.PeerLaunches += 1
        self.observation = replace(self.observation, LaunchAttempted=True)
        observed = _observe(
            "peer/Popen",
            lambda: subprocess.Popen(
                argv,
                cwd=cwd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=0,
                env=os.environ | native.ENVIRONMENT,
            ),
            budget.Calls,
        )
        if observed.Raised is not None:
            self.observation = replace(
                self.observation,
                Failure=Failure("Transport", "admit", "Popen", "peer launch raised"),
            )
            return
        self.process = cast(subprocess.Popen[bytes], observed.Returned)
        self.observation = replace(self.observation, ChildPid=self.process.pid)
        try:
            for pipe in (self.process.stdin, self.process.stdout, self.process.stderr):
                if pipe is None:
                    _fail("Transport", "admit", "Pipe", "owned peer pipe unavailable")
                os.set_blocking(pipe.fileno(), False)
        except Exception as error:  # noqa: BLE001 - child remains owned for guarded cleanup.
            self.observation = replace(
                self.observation,
                Failure=Failure("Transport", "admit", "Pipe", type(error).__name__),
            )

    def available(self) -> PeerObservation:
        return replace(
            self.observation,
            Stdout=tuple(self.stdout),
            Stderr=bytes(self.stderr),
            PendingStdout=bytes(self.buffer),
            Writes=tuple(self.writes),
            Cleanup=tuple(self.cleanup),
        )

    def _pipes(self) -> tuple[BinaryIO, BinaryIO, BinaryIO]:
        if self.process is None or self.observation.Failure is not None:
            _fail(
                "Transport",
                "publish",
                "Peer",
                "peer unavailable; launch prefix retained",
            )
        assert (
            self.process.stdin is not None
            and self.process.stdout is not None
            and self.process.stderr is not None
        )
        return (
            cast(BinaryIO, self.process.stdin),
            cast(BinaryIO, self.process.stdout),
            cast(BinaryIO, self.process.stderr),
        )

    def _poll_io(self, *, writing: bool, terminal: bool = False) -> bool:
        self.budget.check()
        stdin, stdout, stderr = self._pipes()
        reads = ([] if self.observation.StdoutEof else [stdout]) + (
            [] if self.observation.StderrEof else [stderr]
        )
        readable, writable, _ = select.select(
            reads, [stdin] if writing else [], [], 0.05
        )
        for pipe in readable:
            if pipe is stderr:
                allowance = 64 * 1024 - len(self.stderr)
            else:
                cap = (
                    TRANSCRIPT_LIMIT
                    if terminal
                    else TRANSCRIPT_LIMIT - TERMINAL_RESERVE
                )
                allowance = cap - self.budget.ProtocolBytes
            try:
                raw = os.read(pipe.fileno(), min(65536, max(0, allowance) + 1))
            except BlockingIOError:
                continue
            if not raw:
                self.observation = (
                    replace(self.observation, StderrEof=True)
                    if pipe is stderr
                    else replace(self.observation, StdoutEof=True)
                )
                continue
            if pipe is stderr:
                self.stderr.extend(raw)
            else:
                self.stdout.append(raw)
                self.buffer.extend(raw)
                self.budget.ProtocolBytes += len(raw)
                self.budget.Frames += (
                    raw.count(b"\n")
                    + int(not self.incoming_open)
                    - int(raw.endswith(b"\n"))
                )
                self.incoming_open = not raw.endswith(b"\n")
                if self.budget.Frames > FRAME_LIMIT:
                    _fail(
                        "Budget",
                        "admit",
                        "Frames",
                        "retained incoming frame positions exceed allowance",
                    )
            if len(raw) > allowance:
                _fail(
                    "Budget",
                    "publish",
                    "Stderr" if pipe is stderr else "TranscriptBytes",
                    "retained one-byte witness of exhausted stream allowance",
                )
        return bool(writable)

    def send(self, raw: bytes) -> WriteObservation:
        if self.output_failure is not None:
            raise _Stop(self.output_failure)
        self.budget.charge_frame(len(raw))
        written = 0
        failure: Failure | None = None
        try:
            stdin, _, _ = self._pipes()
            while written < len(raw):
                if self._poll_io(writing=True):
                    try:
                        count = os.write(stdin.fileno(), raw[written : written + 65536])
                    except BlockingIOError:
                        continue
                    if count <= 0:
                        _fail(
                            "Transport",
                            "publish",
                            "Write",
                            "peer pipe made no progress",
                        )
                    written += count
        except _Stop as error:
            failure = error.failure
        except Exception as error:  # noqa: BLE001 - retain exact known write prefix.
            failure = Failure("Transport", "publish", "Write", type(error).__name__)
        result = WriteObservation(raw, written, failure)
        self.writes.append(result)
        if failure is not None:
            self.output_failure = failure
            raise _Stop(failure)
        return result

    def receive(self, *, terminal: bool = False) -> bytes | None:
        while True:
            self.budget.check()
            marker = self.buffer.find(10)
            if marker >= 0:
                raw = bytes(self.buffer[: marker + 1])
                self.delivered.append(raw)
                del self.buffer[: marker + 1]
                if len(raw) > (MIB if terminal else 16 * MIB):
                    _fail(
                        "Budget",
                        "admit",
                        "Frame",
                        "retained frame exceeds its receiving allowance",
                    )
                return raw
            if len(self.buffer) > (MIB if terminal else 16 * MIB):
                _fail(
                    "Budget",
                    "admit",
                    "Frame",
                    "retained unterminated frame exceeds receiving allowance",
                )
            if self.observation.StdoutEof:
                if self.buffer:
                    _fail(
                        "Transport",
                        "admit",
                        "LF",
                        "peer EOF with retained unterminated bytes",
                    )
                return None
            self._poll_io(writing=False, terminal=terminal)

    def close(self, *, normal: bool) -> PeerObservation:
        if self.closed:
            return self.available()
        self.closed = True
        process = self.process
        if process is not None:
            poll = _observe("peer/poll", process.poll, self.cleanup)
            if not normal and (poll.Raised is not None or poll.Returned is None):
                _observe("peer/kill", process.kill, self.cleanup)
            joined = _observe(
                "peer/wait", lambda: process.wait(timeout=2), self.cleanup
            )
            if joined.Raised is not None:
                _observe("peer/kill-after-wait", process.kill, self.cleanup)
                joined = _observe(
                    "peer/cleanup-wait", lambda: process.wait(timeout=2), self.cleanup
                )
                if joined.Raised is None and type(joined.Returned) is int:
                    self.observation = replace(
                        self.observation, CleanupExitCode=joined.Returned
                    )
            elif type(joined.Returned) is int:
                self.observation = replace(self.observation, ExitCode=joined.Returned)
            closed = joined.Raised is None and type(joined.Returned) is int
            self.observation = replace(self.observation, DirectChildClosed=closed)
            for name, pipe in (
                ("stdin", process.stdin),
                ("stdout", process.stdout),
                ("stderr", process.stderr),
            ):
                if pipe is not None:
                    _observe("peer/close-" + name, pipe.close, self.cleanup)
        self.observation = replace(
            self.observation, FinishedAtUtc=datetime.now(UTC).isoformat()
        )
        return self.available()


@dataclass(frozen=True, slots=True)
class ProjectionExchange:
    Request: Frame
    Native: CallObservation | None
    Certificate: CallObservation | None
    Response: Tree | None
    Failure: Failure | None


@dataclass(frozen=True, slots=True)
class _Services:
    Launch: Callable[..., object] = native.launch_native
    Certify: Callable[..., object] = reference.certify_native


_DEFAULT_SERVICES = _Services()


def _store_bytes(
    store: records.Store, role: str, raw: bytes, budget: _Budget
) -> records.Artifact:
    # Leave the named two-MiB combined terminal reserve and its slot inside
    # the existing Store. A refusal does not reclaim already charged records.
    current = _observe(
        "snapshot/before-store", partial(records.snapshot, store), budget.Calls
    )
    if (
        current.Raised is not None
        or type(current.Returned) is not admission.Admitted
        or type(current.Returned.value) is not records.Snapshot
    ):
        _fail("Storage", "publish", role, "actual recorder snapshot unavailable")
    snapshot = current.Returned.value
    limits = budget.Reservation.StoreLimits
    if (
        snapshot.ReservedRawBytes
        + snapshot.ReservedStoredBytes
        + 2 * len(raw)
        + 2 * MIB
        > limits.CombinedBytes
        or snapshot.ReservedSlots + 2 > limits.Artifacts
    ):
        _fail(
            "Budget",
            "publish",
            role,
            "ordinary write would consume the reserved terminal bytes/slot",
        )
    observed = _observe(
        "append_bytes/" + role,
        lambda: records.append_bytes(store, role, raw),
        budget.Calls,
    )
    if observed.Raised is not None or type(observed.Returned) is not records.Stored:
        _fail(
            "Storage",
            "publish",
            role,
            "actual record-store refusal or raised outcome retained",
        )
    return observed.Returned.Artifact


def _retained_public(
    value: object, store: records.Store, role: str, budget: _Budget, cap: int
) -> object:
    observed = _observe(
        "encode_public_result/" + role,
        lambda: encoding.encode_public_result(value, maximum_bytes=cap),
        budget.Calls,
    )
    if observed.Raised is not None or type(observed.Returned) is not admission.Admitted:
        _fail(
            "Storage",
            "publish",
            role,
            "complete actual return remains in memory after encoding refusal",
        )
    raw = observed.Returned.value
    if type(raw) is not bytes:
        _fail("Unexpected", "publish", role, "encoder returned an untyped byte record")
    _store_bytes(store, role, raw, budget)
    return _json(raw, cap)


def _request_input(
    request: Frame, bindings: Mapping[str, str]
) -> tuple[bytes, str, str]:
    if type(request) is not Frame or type(request.Value) is not dict:
        _fail("Admission", "project", "Frame", "actual admitted frame required")
    rechecked = decode_frame(request.Raw, request.Value.get("SessionId"))
    if (
        not isinstance(rechecked, Frame)
        or rechecked.Sha256 != request.Sha256
        or not _same(rechecked.Value, request.Value)
    ):
        _fail(
            "Conflict",
            "project",
            "Frame",
            "public frame drifted from its retained original bytes",
        )
    value = request.Value
    if value["Kind"] != "ProjectionRequest":
        _fail("Admission", "project", "Kind", "actual projection request required")
    return _request_values(
        {name: item for name, item in value.items() if name not in _HEADER}, bindings
    )


def _request_values(
    payload: object, bindings: Mapping[str, str]
) -> tuple[bytes, str, str]:
    value = _keys(
        payload, _KEYS["ProjectionRequest"] - _HEADER, "ProjectionRequest.Payload"
    )
    _integer(value["Sequence"], "Sequence", 1, FRAME_LIMIT)
    _integer(value["InputRevision"], "InputRevision", 0, 4096)
    _id(value["RequestId"], "RequestId")
    sha = _hash(value["InputSha256"], "InputSha256")
    case = value["CaseId"]
    if (
        type(case) is not str
        or len(case) > 128
        or re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]{0,127}", case, re.ASCII) is None
    ):
        _fail(
            "Admission",
            "project",
            "CaseId",
            "bounded session-derived scalar identity required",
        )
    encoded = value["RawInputHex"]
    if (
        type(encoded) is not str
        or len(encoded) > 2 * native.INPUT_CAP
        or re.fullmatch(r"(?:[0-9a-fA-F]{2})*", encoded) is None
    ):
        _fail(
            "Admission",
            "project",
            "RawInputHex",
            "bounded whole-byte hex input required",
        )
    raw = bytes.fromhex(encoded)
    if _sha(raw) != sha:
        _fail("Conflict", "project", "InputSha256", "request input hash mismatch")
    inputs = _keys(
        _json(raw, native.INPUT_CAP),
        {"Schema", "Id", "Parameters", "Profile"},
        "NativeInput",
    )
    if (
        inputs["Schema"] != "zeta.precision-projection.input.v1"
        or inputs["Id"] != case
        or inputs["Profile"] != "default"
    ):
        _fail(
            "Conflict",
            "project",
            "NativeInput",
            "unchanged scalar schema/default profile and case identity required",
        )
    parameters = _keys(inputs["Parameters"], {"T", "U", "K", "C"}, "Parameters")
    bits = _keys(value["TargetBits"], {"T", "U", "K", "C"}, "TargetBits")
    for name in ("T", "U", "K", "C"):
        _round_trip(parameters[name], bits[name], name)
    base = _keys(value["Base"], {"PrecisionMean", "Precision"}, "Base")
    precision = _bits(base["Precision"], "Base.Precision")
    eta = _bits(base["PrecisionMean"], "Base.PrecisionMean")
    if precision <= 0 or _bits(bits["C"], "C") <= 0 or base["Precision"] != bits["T"]:
        _fail(
            "Improper",
            "project",
            "Base",
            "proper matching base precision and positive C required",
        )
    mean = eta / precision
    if not math.isfinite(mean) or struct.pack(">d", mean).hex().upper() != bits["U"]:
        _fail("Conflict", "project", "U", "actual represented base quotient mismatch")
    binding_raw = _canonical(dict(bindings), native.INPUT_CAP)
    if value["BindingsSha256"] != _sha(binding_raw):
        _fail(
            "Conflict",
            "project",
            "BindingsSha256",
            "independent binding identity mismatch",
        )
    return raw, sha, case


def _projection(
    request: Frame,
    prepared: native.PreparedNative,
    bindings: Mapping[str, str],
    service_sha256: str,
    attempt_root: Path,
    store: records.Store,
    budget: _Budget,
    retained: list[ProjectionExchange],
    services: _Services = _DEFAULT_SERVICES,
) -> Tree:
    native_call: CallObservation | None = None
    certificate_call: CallObservation | None = None
    native_tree: object = None
    certificate_tree: object = None
    failure: Failure | None = None
    response: Tree | None = None
    try:
        budget.check()
        raw, sha, case = _request_input(request, bindings)
        if budget.NativeCallEntered >= budget.Reservation.Projections:
            _fail(
                "Budget",
                "project",
                "NativeCallEntered",
                "pre-reserved projection count exhausted",
            )
        budget.NativeCallEntered += 1
        native_call = _observe(
            "launch_native",
            lambda: services.Launch(
                prepared, raw, sha, case, bindings, attempt_root, timeout_seconds=30
            ),
            budget.Calls,
        )
        if native_call.Raised is not None:
            budget.RemoteIncomplete.add("NativeLaunchAttempted")
            _fail(
                "Service",
                "project",
                "Native",
                "native API raised; actual observation retained",
            )
        budget.NativeReturned += 1
        actual = native_call.Returned
        if type(actual) is not native.NativeObservation:
            budget.RemoteIncomplete.add("NativeLaunchAttempted")
            _fail(
                "Unexpected",
                "project",
                "Native",
                "native API returned an unexpected value",
            )
        if type(actual.LaunchAttempted) is not bool:
            budget.RemoteIncomplete.add("NativeLaunchAttempted")
            _fail(
                "Unexpected",
                "project",
                "Native.LaunchAttempted",
                "typed actual launch count required",
            )
        budget.NativeLaunchAttempted += int(actual.LaunchAttempted)
        if actual.Complete is not True or type(actual.Receipt) is not bytes:
            failure = Failure(
                "Service",
                "project",
                "Native",
                "native process did not return a complete admitted receipt",
            )
        native_tree = _retained_public(actual, store, "native-return", budget, 6 * MIB)
        if failure is not None:
            raise _Stop(failure)
        budget.check()
        if budget.CertificateEntered >= 32:
            _fail(
                "Budget",
                "project",
                "CertificateEntered",
                "certificate-entry allowance exhausted",
            )
        budget.CertificateEntered += 1
        certificate_call = _observe(
            "certify_native",
            lambda: services.Certify(
                raw,
                actual.Receipt,
                bindings,
                expected_input_sha256=sha,
                expected_case_id=case,
            ),
            budget.Calls,
        )
        if certificate_call.Raised is not None:
            budget.RemoteIncomplete.add("NestedReferenceEntered")
            _fail(
                "Service",
                "project",
                "Certificate",
                "certificate API raised; actual native return retained",
            )
        budget.CertificateReturned += 1
        certificate = certificate_call.Returned
        receipt: object = None
        if type(certificate) is reference.Success:
            receipt = certificate.Value
        elif type(certificate) is reference.ReceiptFailure:
            receipt = certificate.Receipt
        elif type(certificate) is not reference.Failure:
            budget.RemoteIncomplete.add("NestedReferenceEntered")
            _fail(
                "Unexpected",
                "project",
                "Certificate",
                "certificate API returned an unexpected value",
            )
        if type(receipt) is dict:
            counters = receipt.get("Counters")
            if (
                type(counters) is not dict
                or type(counters.get("ReferenceRootCalls")) is not int
                or not 0 <= counters["ReferenceRootCalls"] <= 1
            ):
                budget.RemoteIncomplete.add("NestedReferenceEntered")
                _fail(
                    "Unexpected",
                    "project",
                    "NestedReferenceEntered",
                    "actual nested-entry count unavailable",
                )
            budget.NestedReferenceEntered += counters["ReferenceRootCalls"]
        elif type(certificate) is not reference.Failure:
            budget.RemoteIncomplete.add("NestedReferenceEntered")
            _fail(
                "Unexpected",
                "project",
                "Certificate",
                "complete typed reference receipt required",
            )
        if type(certificate) is reference.ReceiptFailure:
            failure = Failure(
                "Storage",
                "publish",
                "Certificate",
                "actual ReceiptFailure retained; no encoded certificate claimed",
            )
        published_certificate = _retained_public(
            certificate, store, "certificate-return", budget, 6 * MIB
        )
        if type(certificate) is reference.ReceiptFailure:
            _fail(
                "Storage",
                "publish",
                "Certificate",
                "actual ReceiptFailure retained; no encoded certificate claimed",
            )
        certificate_tree = published_certificate
        budget.check()
    except _Stop as error:
        failure = failure or error.failure
    except Exception as error:  # noqa: BLE001 - retain actual service returns on later boundary failure.
        failure = failure or Failure(
            "Unexpected", "project", None, type(error).__name__
        )
    finally:
        response = {
            "Kind": "ProjectionResponse",
            "Schema": SCHEMA,
            "SessionId": request.Value["SessionId"],
            "Sequence": request.Value["Sequence"],
            "RequestId": request.Value["RequestId"],
            "InputSha256": request.Value["InputSha256"],
            "BindingsSha256": request.Value["BindingsSha256"],
            "ServiceSha256": service_sha256,
            "Native": native_tree,
            "Certificate": certificate_tree,
            "Failure": None
            if failure is None
            else {
                "Code": failure.Code,
                "Stage": failure.Stage,
                "Field": failure.Field,
                "Message": failure.Message,
            },
        }
        retained.append(
            ProjectionExchange(
                request, native_call, certificate_call, response, failure
            )
        )
    return response


SOURCE_CONTRACT = (
    "docs/research/2026-09-08-checked-mixed-message-module-epoch-source-contract.md"
)
TRANSPORT_AMENDMENT = (
    "docs/research/2026-09-08-mixed-message-epoch-transport-amendment.md"
)
IDENTITY_CONVENTIONS = (
    "docs/research/2026-09-08-mixed-message-epoch-identity-codec-conventions.md"
)
SERVICE_SCHEMA = "zeta.mixed-epoch.service.v1"
DLL_PATHS = (
    "src/Core/bin/Release/net10.0/Zeta.Core.dll",
    "src/Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll",
    "src/Bayesian/bin/Release/net10.0/Zeta.Bayesian.dll",
)
DIRECT_ROLES = ("@python", "@host", PEER_SCRIPT, native.SCRIPT, *DLL_PATHS)
MODULE_STEMS = (
    "__init__",
    "activations",
    "hidden_switch_compiled_admission",
    "hidden_switch_compiled_ieee",
    "hidden_switch_compiled_record_encoding",
    "hidden_switch_compiled_record_store",
    "hidden_switch_compiled_storage",
    "precision_gate_projection_process",
    "precision_gate_projection_reference",
    "precision_gate_projection_intervals",
    "mixed_message_epoch_bridge",
    "mixed_message_epoch_controls",
)
FIXED_SOURCE_PINS = {
    "docs/research/2026-09-08-checked-mixed-message-module-epoch-source-contract.md": "4234015EE650FA7190CF3375C58654499F3BB9EC9C96E4BE21D2FC97A30EC979",
    "docs/research/2026-09-08-mixed-message-epoch-transport-amendment.md": "ABB0E47938DF9ECD8CD4A64536289451D70FF0245B84EF9C05D1A2710C340707",
    "docs/research/2026-09-08-mixed-message-epoch-identity-codec-conventions.md": "BB623AB96A329A075E8C9BC06953D7284DA62BA10766B0D06479D51A011F98C2",
    "docs/research/2026-09-08-precision-gate-projection-decimal-admission-clarification.md": "BA359E4FEC2484A680B6B149E6E887FBEA82AFBB67A15EAFBDB99949101BDAB8",
    "docs/research/2026-09-08-precision-gate-projection-rendered-zero-clarification.md": "67B7C9EFB6B42CEFE341507738B6122FAC4BEDF18C07A72564F3DEEFEE71235E",
}
REQUIRED_SOURCES = frozenset(
    (
        *FIXED_SOURCE_PINS,
        SOURCE_CONTRACT,
        TRANSPORT_AMENDMENT,
        IDENTITY_CONVENTIONS,
        "src/Interp.Python/zeta_interp/mixed_message_epoch_controls.py",
        PEER_SCRIPT,
        native.SCRIPT,
        "docs/DECISIONS/2026-09-08-checked-mixed-message-module-epochs.md",
        "src/Interp.Python/tests/test_mixed_message_epoch_bridge.py",
        "src/Interp.Python/pyproject.toml",
        "src/Interp.Python/uv.lock",
        "Directory.Build.props",
        "Directory.Packages.props",
        "global.json",
        "src/Bayesian/Bayesian.fsproj",
        "src/Core/Core.fsproj",
        "src/Bayesian/PrecisionGateProjection.fs",
        "src/Bayesian/PrecisionGateKernels.fs",
        "src/Bayesian/BoundedModuleLearner.fs",
        "src/Bayesian/MixedMessageEpoch.fs",
        *("src/Interp.Python/zeta_interp/" + name + ".py" for name in MODULE_STEMS),
    )
)


@dataclass(frozen=True, slots=True)
class SourceFile:
    Path: str
    Bytes: int
    Sha256: str


@dataclass(frozen=True, slots=True)
class ServiceManifest:
    Raw: bytes
    Sha256: str
    Bindings: tuple[tuple[str, str], ...]
    SourceFiles: tuple[SourceFile, ...]
    DirectFiles: tuple[tuple[str, native.FileIdentity], ...]


@dataclass(frozen=True, slots=True)
class SourceRead:
    Role: str
    Path: str
    Expected: native.FileIdentity
    Observation: CallObservation
    Actual: native.FileIdentity | None


@dataclass(frozen=True, slots=True)
class SourceSnapshot:
    Reads: tuple[SourceRead, ...]
    Modules: tuple[tuple[str, str | None, str | None], ...]
    Failure: Failure | None


def _relative(value: object, field_name: str) -> str:
    if (
        type(value) is not str
        or not value.isascii()
        or len(value) > 512
        or "\\" in value
        or "\x00" in value
    ):
        _fail(
            "Admission", "admit", field_name, "bounded ASCII repository path required"
        )
    path = Path(value)
    if path.is_absolute() or any(part in ("", ".", "..") for part in value.split("/")):
        _fail(
            "Admission",
            "admit",
            field_name,
            "canonical relative repository path required",
        )
    return value


def admit_service_manifest(
    raw: object, expected_sha256: object
) -> ServiceManifest | Failure:
    """Exact independently selected bytes; no reads, setup or service execution."""
    try:
        if type(raw) is not bytes or len(raw) > 64 * 1024:
            _fail("Budget", "admit", "Manifest", "original manifest exceeds 64 KiB")
        if _sha(raw) != _hash(expected_sha256, "ServiceSha256"):
            _fail(
                "Conflict",
                "admit",
                "ServiceSha256",
                "independent manifest identity mismatch",
            )
        value = _keys(
            _json(raw, 64 * 1024),
            {"Schema", "ExpectedBindings", "SourceFiles", "DirectFiles"},
            "Manifest",
        )
        if value["Schema"] != SERVICE_SCHEMA:
            _fail(
                "Admission", "admit", "Schema", "fixed service manifest schema required"
            )
        rows = value["SourceFiles"]
        if type(rows) is not list or not len(REQUIRED_SOURCES) <= len(rows) <= 128:
            _fail(
                "Budget",
                "admit",
                "SourceFiles",
                "bounded complete source roster required",
            )
        sources: list[SourceFile] = []
        total = 0
        for item in rows:
            row = _keys(item, {"Path", "Bytes", "Sha256"}, "SourceFile")
            path = _relative(row["Path"], "SourceFile.Path")
            count = _integer(row["Bytes"], path, 0, 8 * MIB)
            sha = _hash(row["Sha256"], path)
            if sources and path <= sources[-1].Path:
                _fail(
                    "Admission",
                    "admit",
                    "SourceFiles",
                    "unique ordinal source row order required",
                )
            sources.append(SourceFile(path, count, sha))
            total += count
            if total > 64 * MIB:
                _fail(
                    "Budget",
                    "admit",
                    "SourceFiles",
                    "source-read aggregate exceeds 64 MiB",
                )
        if not REQUIRED_SOURCES <= {row.Path for row in sources}:
            _fail(
                "Admission",
                "admit",
                "SourceFiles",
                "required contracts/helpers/wiring missing",
            )
        direct_rows = value["DirectFiles"]
        if type(direct_rows) is not list or len(direct_rows) != len(DIRECT_ROLES):
            _fail(
                "Admission", "admit", "DirectFiles", "exact seven direct roles required"
            )
        direct: list[tuple[str, native.FileIdentity]] = []
        for item, role in zip(direct_rows, DIRECT_ROLES, strict=True):
            row = _keys(item, {"Role", "Bytes", "Sha256"}, "DirectFile")
            if row["Role"] != role:
                _fail(
                    "Admission",
                    "admit",
                    "DirectFiles",
                    "fixed direct-file role order required",
                )
            direct.append(
                (
                    role,
                    native.FileIdentity(
                        _integer(row["Bytes"], role, 0, native.FILE_CAP),
                        _hash(row["Sha256"], role),
                    ),
                )
            )
        bindings = value["ExpectedBindings"]
        expected = {row.Path: row.Sha256 for row in sources}
        for role, pin in direct:
            if role.startswith("@"):
                continue
            if role in expected and expected[role] != pin.Sha256:
                _fail(
                    "Conflict",
                    "admit",
                    role,
                    "source/direct script identities disagree",
                )
            expected[role] = pin.Sha256
        expected["ProtocolSha256"] = reference.PROTOCOL_SHA256
        if len(expected) > 132:
            _fail(
                "Budget",
                "admit",
                "ExpectedBindings",
                "128 sources plus three direct DLLs and protocol maximum",
            )
        if type(bindings) is not dict or bindings != expected:
            _fail(
                "Conflict",
                "admit",
                "ExpectedBindings",
                "exact complete independent flat binding map required",
            )
        for path, sha in FIXED_SOURCE_PINS.items():
            if expected.get(path) != sha:
                _fail(
                    "Conflict",
                    "admit",
                    path,
                    "reviewed source contract or scalar clarification identity changed",
                )
        _canonical(bindings, native.INPUT_CAP)
        return ServiceManifest(
            raw,
            _sha(raw),
            tuple(sorted(expected.items())),
            tuple(sources),
            tuple(direct),
        )
    except _Stop as error:
        return error.failure
    except (ValueError, UnicodeError, RecursionError) as error:
        return Failure("Admission", "admit", "Manifest", type(error).__name__)


def _sources(
    source_root: Path, host: Path, manifest: ServiceManifest, budget: _Budget
) -> SourceSnapshot:
    reads: list[SourceRead] = []
    modules: list[tuple[str, str | None, str | None]] = []
    failure: Failure | None = None
    try:
        for stem in MODULE_STEMS:
            name = "zeta_interp" if stem == "__init__" else "zeta_interp." + stem
            module = sys.modules.get(name)
            actual = getattr(module, "__file__", None)
            origin = getattr(getattr(module, "__spec__", None), "origin", None)
            modules.append((name, actual, origin))
            expected_path = str(
                source_root / "src/Interp.Python/zeta_interp" / (stem + ".py")
            )
            if actual != expected_path or origin != expected_path:
                _fail(
                    "Conflict",
                    "admit",
                    name,
                    "actual loaded file/origin differs from admitted clone",
                )
        selected: list[tuple[str, Path, native.FileIdentity, int]] = [
            (
                row.Path,
                source_root / row.Path,
                native.FileIdentity(row.Bytes, row.Sha256),
                8 * MIB,
            )
            for row in manifest.SourceFiles
        ]
        for role, pin in manifest.DirectFiles:
            path = (
                Path(sys.executable).resolve(strict=True)
                if role == "@python"
                else host
                if role == "@host"
                else source_root / role
            )
            selected.append((role, path, pin, native.FILE_CAP))
        for role, path, expected, cap in selected:
            budget.check()
            call = _observe(
                "source-read/" + role,
                partial(
                    storage.read_exact,
                    path.parent,
                    path.name,
                    expected_bytes=expected.Bytes,
                    maximum_bytes=cap,
                ),
                budget.Calls,
            )
            reads.append(SourceRead(role, str(path), expected, call, None))
            if (
                call.Raised is not None
                or type(call.Returned) is not admission.Admitted
                or type(call.Returned.value) is not bytes
            ):
                _fail(
                    "Storage",
                    "admit",
                    role,
                    "bounded source read did not return original bytes",
                )
            raw = call.Returned.value
            actual_pin = native.FileIdentity(len(raw), _sha(raw))
            reads[-1] = replace(reads[-1], Actual=actual_pin)
            if actual_pin != expected:
                _fail(
                    "Conflict",
                    "admit",
                    role,
                    "actual source/direct-file identity changed",
                )
            if role in (PEER_SCRIPT, native.SCRIPT):
                references: list[str] = []
                for line in raw.decode("utf-8", errors="strict").splitlines():
                    if line.startswith("#r "):
                        match = re.fullmatch(r'#r "([^"\r\n]+)"', line)
                        if match is None:
                            _fail(
                                "Admission",
                                "admit",
                                role,
                                "exact direct-reference declaration required",
                            )
                        resolved = Path(os.path.normpath(path.parent / match[1]))
                        references.append(str(resolved.relative_to(source_root)))
                if tuple(references) != DLL_PATHS:
                    _fail(
                        "Conflict",
                        "admit",
                        role,
                        "three declared DLL paths differ from fixed direct roles",
                    )
    except _Stop as error:
        failure = error.failure
    except Exception as error:  # noqa: BLE001 - retain actual source/read prefix.
        failure = Failure("Unexpected", "admit", "SourceSnapshot", type(error).__name__)
    return SourceSnapshot(tuple(reads), tuple(modules), failure)


_PLAN_KEYS = frozenset(
    (
        "Id",
        "Mode",
        "EvidenceCut",
        "QueryRowId",
        "Nodes",
        "SelectedVersions",
        "InitialState",
        "Operations",
        "Sweeps",
        "Damping",
        "Training",
        "Horizon",
        "SourceBindings",
    )
)
_STATE_KEYS = frozenset(
    ("Revision", "Weights", "GaussianSites", "GammaSites", "Outputs", "ActiveCut")
)
_OBSERVATION_KEYS = frozenset(
    (
        "Sequence",
        "Operation",
        "InputRevision",
        "Inputs",
        "Call",
        "Proposal",
        "Admission",
        "AppliedRevision",
        "Failure",
    )
)
_RESULT_KEYS = frozenset(
    (
        "PlanSha256",
        "Outcome",
        "Termination",
        "Failure",
        "LastCommitted",
        "ProposedArtifacts",
        "Observations",
        "Counters",
        "PendingRequest",
        "Scheduler",
        "Publication",
    )
)
_COUNTER_CAPS = {
    "SchedulerEntered": 4096,
    "KernelEntered": 256,
    "ForwardEntered": 4096,
    "LearnEntered": 2048,
    "Returned": 4096,
    "Proposed": 4096,
    "Certified": 32,
    "Applied": 4096,
    "ProjectionRequested": 32,
    "ProtocolBytes": TRANSCRIPT_LIMIT,
    "ReservedBytes": RETENTION_LIMIT,
    "ArtifactSlots": ARTIFACT_LIMIT,
}
_REMOTE_KEYS = frozenset(
    (
        "NativeCallEntered",
        "NativeLaunchAttempted",
        "NativeReturned",
        "CertificateEntered",
        "CertificateReturned",
        "NestedReferenceEntered",
    )
)


@dataclass(frozen=True, slots=True)
class AdmittedPlan:
    Raw: bytes
    Value: Tree
    Sha256: str
    Projections: int
    Operations: tuple[Tree, ...]


def _array(value: object, name: str, cap: int, *, minimum: int = 0) -> list[Any]:
    if type(value) is not list or not minimum <= len(value) <= cap:
        _fail("Budget", "admit", name, "bounded ordered array required")
    return value


def _map(value: object, name: str, cap: int) -> Tree:
    if type(value) is not dict or len(value) > cap:
        _fail("Budget", "admit", name, "bounded map required")
    return cast(Tree, value)


def _failure_record(value: object) -> None:
    if value is None:
        return
    row = _keys(value, {"Code", "Stage", "Field", "Message"}, "Failure")
    if row["Code"] not in {
        "Admission",
        "Conflict",
        "Stale",
        "Family",
        "Improper",
        "Arithmetic",
        "Service",
        "Uncertified",
        "Budget",
        "Storage",
        "Transport",
        "Unexpected",
    }:
        _fail("Admission", "admit", "Failure.Code", "unknown failure code")
    if row["Stage"] not in {
        "admit",
        "learn",
        "forward",
        "gamma",
        "gaussian",
        "project",
        "apply",
        "publish",
        "retract",
        "scheduler",
    }:
        _fail("Admission", "admit", "Failure.Stage", "unknown failure stage")
    name = row["Field"]
    if name is not None and (
        type(name) is not str or not name.isascii() or len(name) > 256
    ):
        _fail(
            "Admission",
            "admit",
            "Failure.Field",
            "bounded optional ASCII field required",
        )
    message = row["Message"]
    if type(message) is not str or len(message.encode("utf-8")) > 1024:
        _fail(
            "Budget",
            "admit",
            "Failure.Message",
            "bounded UTF8 failure message required",
        )


def _cut(value: object) -> Tree:
    cut = _keys(
        value,
        {"Id", "Rows", "ActiveIds", "PriorOwners", "ParentCut", "Retractions"},
        "EvidenceCut",
    )
    _id(cut["Id"], "Cut.Id")
    if cut["ParentCut"] is not None:
        _hash(cut["ParentCut"], "ParentCut")
    rows = _array(cut["Rows"], "Rows", 1024)
    ids: set[str] = set()
    for item in rows:
        row = _keys(
            item,
            {
                "Id",
                "ContentSha256",
                "Origin",
                "FeatureAvailable",
                "TargetTime",
                "LabelAvailable",
                "Split",
                "Features",
                "Target",
                "Uses",
            },
            "EvidenceRow",
        )
        identity = _id(row["Id"], "Row.Id")
        if identity in ids:
            _fail("Conflict", "admit", "Rows", "duplicate evidence row identity")
        ids.add(identity)
        preimage = {key: value for key, value in row.items() if key != "ContentSha256"}
        if _sha(_canonical(preimage, MIB)) != _hash(
            row["ContentSha256"], "ContentSha256"
        ):
            _fail(
                "Conflict",
                "admit",
                "ContentSha256",
                "evidence content identity mismatch",
            )
        for name in ("Origin", "FeatureAvailable", "TargetTime", "LabelAvailable"):
            _integer(row[name], name, 0, (1 << 63) - 1)
        if row["Split"] not in ("train", "validation", "test", "control"):
            _fail("Admission", "admit", "Split", "unknown evidence split")
        features = _array(row["Features"], "Features", 8, minimum=8)
        for bits in features:
            _bits(bits, "Feature")
        if row["Target"] is not None:
            _bits(row["Target"], "Target")
        uses = _array(row["Uses"], "Uses", 8)
        for item_use in uses:
            use = _keys(
                item_use,
                {"ContributionId", "Role", "ProducerArtifact", "ProducerTrainingCut"},
                "Use",
            )
            _id(use["ContributionId"], "ContributionId")
            if use["Role"] not in ("observation", "prior", "forecast"):
                _fail("Admission", "admit", "Use.Role", "unknown contribution role")
            for name in ("ProducerArtifact", "ProducerTrainingCut"):
                if use[name] is not None:
                    _hash(use[name], name)
    for name in ("ActiveIds", "Retractions"):
        members = _array(cut[name], name, 1024)
        if len({_id(member, name) for member in members}) != len(members):
            _fail("Conflict", "admit", name, "unique evidence IDs required")
        if name == "ActiveIds" and not set(members) <= ids:
            _fail("Conflict", "admit", name, "active row not present in complete cut")
    for variable, owner in _map(cut["PriorOwners"], "PriorOwners", 32).items():
        _id(variable, "Variable")
        _id(owner, "PriorOwner")
    return cut


def _artifact(value: object, bindings: Mapping[str, str]) -> Tree:
    row = _keys(
        value,
        {
            "Id",
            "ParentVersion",
            "TrainingCut",
            "Architecture",
            "Ports",
            "Parameters",
            "Preprocessing",
            "UpdateReceiptSha256",
            "SourceBindings",
        },
        "ModuleArtifact",
    )
    _id(row["Id"], "Artifact.Id")
    if row["ParentVersion"] is not None:
        _hash(row["ParentVersion"], "ParentVersion")
    _hash(row["TrainingCut"], "TrainingCut")
    _hash(row["UpdateReceiptSha256"], "UpdateReceiptSha256")
    if row["Architecture"] != "point-mlp-12-4-1-v1" or row["SourceBindings"] != dict(
        bindings
    ):
        _fail(
            "Conflict",
            "admit",
            "Artifact",
            "fixed architecture and complete source bindings required",
        )
    ports = _array(row["Ports"], "Ports", 2, minimum=2)
    if any(port not in ("required", "optional", "absent") for port in ports):
        _fail("Admission", "admit", "Ports", "unknown child port state")
    for bits in _array(row["Parameters"], "Parameters", 57, minimum=57):
        _bits(bits, "Parameter")
    preprocessing = _keys(
        row["Preprocessing"],
        {"TrainingCut", "Count", "Means", "Scales"},
        "Preprocessing",
    )
    if preprocessing["TrainingCut"] != row["TrainingCut"]:
        _fail("Conflict", "admit", "TrainingCut", "preprocessing/artifact cut mismatch")
    _integer(preprocessing["Count"], "Count", 1, 256)
    for bits in _array(preprocessing["Means"], "Means", 8, minimum=8):
        _bits(bits, "Mean")
    for bits in _array(preprocessing["Scales"], "Scales", 8, minimum=8):
        if _bits(bits, "Scale") <= 0:
            _fail(
                "Improper",
                "admit",
                "Scale",
                "strictly positive preprocessing scale required",
            )
    _canonical(row, 64 * 1024)
    return row


def _state(value: object) -> Tree:
    row = _keys(value, _STATE_KEYS, "State")
    _integer(row["Revision"], "Revision", 0, 4096)
    _hash(row["ActiveCut"], "ActiveCut")
    for identity, raw_weight in _map(row["Weights"], "Weights", 4).items():
        _id(identity, "Weight.Id")
        weight = _keys(
            raw_weight, {"BaseArtifactId", "VectorSha256", "Parameters"}, "Weight"
        )
        _id(weight["BaseArtifactId"], "BaseArtifactId")
        params = _array(weight["Parameters"], "Parameters", 57, minimum=57)
        for bits in params:
            _bits(bits, "Parameter")
        if _sha(_canonical(params, 64 * 1024)) != weight["VectorSha256"]:
            _fail(
                "Conflict", "admit", "VectorSha256", "actual vector identity mismatch"
            )
    for name, fields in (
        ("GaussianSites", {"PrecisionMean", "Precision"}),
        ("GammaSites", {"LogPower", "Rate"}),
    ):
        keys = []
        for item in _array(row[name], name, 64):
            site = _keys(item, {"Key", "Value"}, "Site")
            key = _keys(
                site["Key"],
                {"InstancePath", "Factor", "Port", "ContributionId"},
                "Site.Key",
            )
            for component in key.values():
                _id(component, "Site.Key")
            keys.append(
                tuple(
                    key[field]
                    for field in ("InstancePath", "Factor", "Port", "ContributionId")
                )
            )
            natural = _keys(site["Value"], fields, "Site.Value")
            for bits in natural.values():
                _bits(bits, "Site.Value")
        if keys != sorted(set(keys)):
            _fail("Conflict", "admit", name, "unique ordinal site keys required")
    for node, value_output in _map(row["Outputs"], "Outputs", 8).items():
        _id(node, "Output.Node")
        output = _keys(value_output, {"Mean", "Variance", "SourceSequence"}, "Output")
        _bits(output["Mean"], "Mean")
        if (
            output["Variance"] is not None
            and _bits(output["Variance"], "Variance") <= 0
        ):
            _fail(
                "Improper", "admit", "Variance", "positive Gaussian variance required"
            )
        _integer(output["SourceSequence"], "SourceSequence", 1, 4096)
    return row


def _nodes(value: object) -> tuple[dict[str, Tree], list[str], Callable[[str], str]]:
    nodes: dict[str, Tree] = {}
    for item in _array(value, "Nodes", 8, minimum=1):
        row = _keys(
            item,
            {
                "Id",
                "InstancePath",
                "Kind",
                "Inputs",
                "Artifact",
                "Prior",
                "Unary",
                "Children",
                "OutputAlias",
            },
            "Node",
        )
        identity = _id(row["Id"], "Node.Id")
        _id(row["InstancePath"], "InstancePath")
        if identity in nodes or row["Kind"] not in (
            "neural",
            "precision-gate",
            "composite",
        ):
            _fail(
                "Admission", "admit", "Nodes", "unique known node identities required"
            )
        nodes[identity] = row
    for kind in ("neural", "precision-gate"):
        if sum(node["Kind"] == kind for node in nodes.values()) > 4:
            _fail("Budget", "admit", "Nodes", "module-kind count exceeds four")
    children_owned: set[str] = set()
    for identity, node in nodes.items():
        inputs = _array(node["Inputs"], "Node.Inputs", 2)
        if node["Kind"] == "composite":
            if inputs or any(
                node[key] is not None for key in ("Artifact", "Prior", "Unary")
            ):
                _fail("Admission", "admit", identity, "composite has numerical fields")
            children = _array(node["Children"], "Children", 8, minimum=1)
            for child in children:
                if (
                    _id(child, "Child") not in nodes
                    or child == identity
                    or child in children_owned
                ):
                    _fail(
                        "Conflict",
                        "admit",
                        "Children",
                        "unique existing child ownership required",
                    )
                children_owned.add(child)
            alias = _keys(
                node["OutputAlias"], {"SourceNode", "SourcePort"}, "OutputAlias"
            )
            if alias["SourceNode"] not in children or alias["SourcePort"] != "mean":
                _fail(
                    "Conflict",
                    "admit",
                    "OutputAlias",
                    "explicit declared child mean alias required",
                )
        else:
            if node["Children"] is not None or node["OutputAlias"] is not None:
                _fail(
                    "Admission",
                    "admit",
                    identity,
                    "computational node cannot own aliases",
                )
            if node["Kind"] == "neural":
                _id(node["Artifact"], "Artifact")
                if node["Prior"] is not None or node["Unary"] is not None:
                    _fail(
                        "Admission",
                        "admit",
                        identity,
                        "neural unused fields must be null",
                    )
            else:
                if node["Artifact"] is not None:
                    _fail(
                        "Admission",
                        "admit",
                        identity,
                        "precision artifact must be null",
                    )
                prior = _keys(node["Prior"], {"Gaussian", "Gammas"}, "Prior")
                gaussian = _keys(
                    prior["Gaussian"], {"PrecisionMean", "Precision"}, "Gaussian"
                )
                _bits(gaussian["PrecisionMean"], "PrecisionMean")
                if _bits(gaussian["Precision"], "Precision") <= 0:
                    _fail(
                        "Improper",
                        "admit",
                        "Precision",
                        "proper Gaussian prior required",
                    )
                gammas = _array(prior["Gammas"], "Gammas", 2)
                if len(gammas) != len(inputs):
                    _fail(
                        "Conflict",
                        "admit",
                        "Gammas",
                        "ordered Gamma priors must align exactly to node inputs",
                    )
                for gamma in gammas:
                    shape_rate = _keys(gamma, {"Shape", "Rate"}, "Gamma")
                    if any(
                        _bits(shape_rate[name], name) <= 0 for name in ("Shape", "Rate")
                    ):
                        _fail(
                            "Improper",
                            "admit",
                            "Gamma",
                            "positive shape/rate inputs required",
                        )
                unary = _keys(node["Unary"], {"K", "C"}, "Unary")
                _bits(unary["K"], "K")
                if _bits(unary["C"], "C") <= 0:
                    _fail("Improper", "admit", "C", "positive unary C required")
        seen_slots = set()
        for edge in inputs:
            edge = _keys(edge, {"SourceNode", "SourcePort", "TargetSlot"}, "InputEdge")
            slot = _integer(edge["TargetSlot"], "TargetSlot", 0, 1)
            if (
                edge["SourceNode"] not in nodes
                or edge["SourcePort"] != "mean"
                or slot in seen_slots
            ):
                _fail(
                    "Conflict",
                    "admit",
                    "InputEdge",
                    "existing mean producer and unique slot required",
                )
            seen_slots.add(slot)

    def resolve(identity: str, trail: tuple[str, ...] = ()) -> str:
        if identity not in nodes or identity in trail or len(trail) >= 3:
            _fail("Conflict", "admit", "Topology", "alias depth/cycle or unknown node")
        node = nodes[identity]
        return (
            resolve(node["OutputAlias"]["SourceNode"], (*trail, identity))
            if node["Kind"] == "composite"
            else identity
        )

    # Check every child chain, including non-output children, independently of aliases.
    def child_depth(identity: str, trail: tuple[str, ...] = ()) -> None:
        if identity in trail or len(trail) >= 3:
            _fail("Conflict", "admit", "Children", "nesting depth/cycle exceeded")
        if nodes[identity]["Kind"] == "composite":
            for child in nodes[identity]["Children"]:
                child_depth(child, (*trail, identity))

    for identity in nodes:
        child_depth(identity)
        resolve(identity)
    computational = {
        key: node for key, node in nodes.items() if node["Kind"] != "composite"
    }
    dependencies = {
        key: {resolve(edge["SourceNode"]) for edge in node["Inputs"]}
        for key, node in computational.items()
    }
    ordered: list[str] = []
    while len(ordered) < len(computational):
        ready = sorted(
            key
            for key in computational
            if key not in ordered and dependencies[key] <= set(ordered)
        )
        if not ready:
            _fail("Conflict", "admit", "Topology", "computational DAG contains a cycle")
        ordered.append(ready[0])
    return nodes, ordered, resolve


def _identity_definitions(nodes: Mapping[str, Tree], cut: Tree, state: Tree) -> None:
    paths = [node["InstancePath"] for node in nodes.values()]
    if len(paths) != len(set(paths)):
        _fail(
            "Conflict",
            "admit",
            "InstancePath",
            "distinct node instances must have distinct paths",
        )
    definitions: dict[str, Tree] = {}
    variables: set[str] = set()
    sites: set[tuple[str, str, str, str, str]] = set()
    for node in nodes.values():
        if node["Kind"] != "precision-gate":
            continue
        path = node["InstancePath"]
        for role in [
            "z",
            *["gamma/" + str(edge["TargetSlot"]) for edge in node["Inputs"]],
        ]:
            preimage = {
                "Kind": "mixed-epoch-variable-v1",
                "InstancePath": path,
                "Role": role,
            }
            sha = _sha(_canonical(preimage, 4096))
            if sha in definitions:
                _fail(
                    "Conflict",
                    "admit",
                    "Variable",
                    "duplicate or colliding derived definition",
                )
            definitions[sha] = preimage
            variables.add(sha)
        for factor in [
            "unary",
            *["normal/" + str(edge["TargetSlot"]) for edge in node["Inputs"]],
        ]:
            preimage = {
                "Kind": "mixed-epoch-factor-v1",
                "InstancePath": path,
                "Factor": factor,
            }
            sha = _sha(_canonical(preimage, 4096))
            if sha in definitions:
                _fail(
                    "Conflict",
                    "admit",
                    "Factor",
                    "duplicate or colliding derived definition",
                )
            definitions[sha] = preimage
            sites.add(("GaussianSites", path, factor, "z", sha))
            if factor != "unary":
                sites.add(("GammaSites", path, factor, "gamma", sha))
    if len(variables) > 32 or set(cut["PriorOwners"]) != variables:
        _fail(
            "Conflict", "admit", "PriorOwners", "exact derived variable roster required"
        )
    owners = list(cut["PriorOwners"].values())
    if len(owners) != len(set(owners)):
        _fail(
            "Conflict",
            "admit",
            "PriorOwners",
            "distinct variables need distinct independently supplied priors",
        )
    external = (
        set(owners)
        | {row["Id"] for row in cut["Rows"]}
        | {use["ContributionId"] for row in cut["Rows"] for use in row["Uses"]}
    )
    if set(definitions) & external:
        _fail(
            "Conflict",
            "admit",
            "Identity",
            "derived definition collides with an external contribution or row",
        )
    for family in ("GaussianSites", "GammaSites"):
        for site in state[family]:
            key = site["Key"]
            if (
                family,
                key["InstancePath"],
                key["Factor"],
                key["Port"],
                key["ContributionId"],
            ) not in sites:
                _fail(
                    "Conflict",
                    "admit",
                    "Site.Key",
                    "site is outside exact model-factor and port roster",
                )


def _plan(
    raw: bytes, bindings: Mapping[str, str], *, compensation: bool = True
) -> AdmittedPlan:
    plan = _keys(_json(raw, MIB), _PLAN_KEYS, "Plan")
    _id(plan["Id"], "Plan.Id")
    if plan["Mode"] not in ("train", "query", "compensate") or plan[
        "SourceBindings"
    ] != dict(bindings):
        _fail(
            "Conflict",
            "admit",
            "Plan",
            "known mode and independent source map required",
        )
    mode = plan["Mode"]
    if mode == "compensate" and not compensation:
        _fail(
            "Admission",
            "admit",
            "Compensate",
            "recursive retained compensation plan refused",
        )
    horizon = _integer(plan["Horizon"], "Horizon", 1, 1024)
    cut = _cut(plan["EvidenceCut"])
    state = _state(plan["InitialState"])
    if state["ActiveCut"] != _sha(_canonical(cut, MIB)):
        _fail("Conflict", "admit", "ActiveCut", "initial state/cut mismatch")
    damping = _bits(plan["Damping"], "Damping")
    if not 0 < damping <= 1:
        _fail("Improper", "admit", "Damping", "damping in (0,1] required")
    nodes, ordered, _ = _nodes(plan["Nodes"])
    _identity_definitions(nodes, cut, state)
    selected = _map(plan["SelectedVersions"], "SelectedVersions", 4)
    neural_ids = {
        node["Artifact"] for node in nodes.values() if node["Kind"] == "neural"
    }
    if mode != "train" and set(selected) != neural_ids:
        _fail(
            "Conflict",
            "admit",
            "SelectedVersions",
            "exact selected neural artifact roster required",
        )
    for identity, item in selected.items():
        row = _keys(item, {"Version", "Artifact"}, "SelectedVersion")
        artifact = _artifact(row["Artifact"], bindings)
        if artifact["Id"] != identity or _sha(_canonical(artifact, 64 * 1024)) != _hash(
            row["Version"], "Version"
        ):
            _fail("Conflict", "admit", "Version", "complete artifact version mismatch")
    expected: list[Tree] = []
    sweeps = _integer(plan["Sweeps"], "Sweeps", 0, 8)
    if mode == "train":
        if plan["QueryRowId"] is not None or sweeps != 0:
            _fail(
                "Admission", "admit", "Training", "training has no query row or sweeps"
            )
        training = _keys(
            plan["Training"],
            {"Artifacts", "RowIds", "CutEnd", "ChildCuts", "ChildForecasts"},
            "Training",
        )
        requests = _array(training["Artifacts"], "Artifacts", 4, minimum=1)
        identities = []
        for request in requests:
            row = _keys(request, {"Id", "ParentVersion", "Ports"}, "Training.Artifact")
            identity = _id(row["Id"], "Artifact.Id")
            identities.append(identity)
            if row["ParentVersion"] is not None:
                _hash(row["ParentVersion"], "ParentVersion")
            if any(
                port not in ("required", "optional", "absent")
                for port in _array(row["Ports"], "Ports", 2, minimum=2)
            ):
                _fail("Admission", "admit", "Ports", "known child slot modes required")
        if identities != sorted(set(identities)) or set(identities) != neural_ids:
            _fail(
                "Conflict",
                "admit",
                "Artifacts",
                "ordinal exact training artifact roster required",
            )
        row_ids = _map(training["RowIds"], "RowIds", 4)
        if set(row_ids) != set(identities):
            _fail(
                "Conflict", "admit", "RowIds", "exact training request mapping required"
            )
        end = _integer(training["CutEnd"], "CutEnd", 0, (1 << 63) - 1)
        rows = {row["Id"]: row for row in cut["Rows"]}
        for identity in identities:
            selected_rows = _array(row_ids[identity], "RowIds", 256, minimum=1)
            if len(set(selected_rows)) != len(selected_rows):
                _fail(
                    "Conflict",
                    "admit",
                    "RowIds",
                    "training rows cannot repeat within a pass",
                )
            for row_id in selected_rows:
                if row_id not in cut["ActiveIds"]:
                    _fail("Conflict", "admit", "RowIds", "training row must be active")
                row = rows[row_id]
                if any(
                    abs(_bits(item, "Training.Features")) > 64
                    for item in row["Features"]
                ) or (
                    row["Target"] is not None
                    and abs(_bits(row["Target"], "Training.Target")) > 64
                ):
                    _fail(
                        "Admission",
                        "admit",
                        "Training.Row",
                        "raw training features and targets have absolute bound 64",
                    )
                if (
                    row["Target"] is None
                    or row["Split"] not in ("train", "control")
                    or not row["FeatureAvailable"]
                    <= row["Origin"]
                    < row["TargetTime"]
                    <= row["LabelAvailable"]
                    <= end
                    or row["TargetTime"] != row["Origin"] + horizon
                ):
                    _fail(
                        "Admission",
                        "admit",
                        "Training.Row",
                        "source chronology/target/split refused",
                    )
            for pass_index in range(2):
                expected.extend(
                    {
                        "Kind": "LearnStep",
                        "ArtifactId": identity,
                        "Pass": pass_index,
                        "RowId": row_id,
                    }
                    for row_id in selected_rows
                )
        for child_hash, child_cut in _map(
            training["ChildCuts"], "ChildCuts", 16
        ).items():
            checked = _cut(child_cut)
            if _hash(child_hash, "ChildCutHash") != _sha(_canonical(checked, MIB)):
                _fail(
                    "Conflict",
                    "admit",
                    "ChildCutHash",
                    "complete child cut differs from its map identity",
                )
        _array(training["ChildForecasts"], "ChildForecasts", 2048)
    else:
        if plan["Training"] is not None:
            _fail(
                "Admission",
                "admit",
                "Training",
                "nontraining plan must have null training",
            )
        if mode == "query":
            if sweeps == 0 or plan["QueryRowId"] not in cut["ActiveIds"]:
                _fail(
                    "Admission",
                    "admit",
                    "QueryRowId",
                    "active query row and nonzero sweeps required",
                )
            row = next(row for row in cut["Rows"] if row["Id"] == plan["QueryRowId"])
            if (
                row["Target"] is not None
                or row["FeatureAvailable"] > row["Origin"]
                or row["TargetTime"] != row["Origin"] + horizon
            ):
                _fail(
                    "Admission",
                    "admit",
                    "QueryRow",
                    "target-hidden chronological query required",
                )
        else:
            if plan["QueryRowId"] is not None:
                _fail(
                    "Admission",
                    "admit",
                    "QueryRowId",
                    "compensation names its retained original row",
                )
            operations = _array(plan["Operations"], "Operations", 4096, minimum=1)
            first = _keys(operations[0], {"Kind", "Inputs"}, "Compensate")
            if first["Kind"] != "Compensate":
                _fail(
                    "Admission",
                    "admit",
                    "Compensate",
                    "compensation must begin with the fixed operation",
                )
            context = _keys(
                first["Inputs"],
                {"TargetRevision", "RetainedPlan", "RetainedResult", "Checkpoint"},
                "Compensate.Inputs",
            )
            retained = _plan(
                _canonical(context["RetainedPlan"], MIB), bindings, compensation=False
            )
            if retained.Value["Mode"] != "query":
                _fail(
                    "Admission",
                    "admit",
                    "RetainedPlan",
                    "retained original plan must be query-only",
                )
            prior = _keys(context["RetainedResult"], _RESULT_KEYS, "RetainedResult")
            if prior["PlanSha256"] != retained.Sha256 or not _same(
                prior["LastCommitted"], state
            ):
                _fail(
                    "Conflict",
                    "admit",
                    "RetainedResult",
                    "retained plan/result/current-state association differs",
                )
            checkpoint = _keys(
                context["Checkpoint"],
                {"State", "StateSha256", "Prefix", "PrefixSha256"},
                "Checkpoint",
            )
            checkpoint_state = _state(checkpoint["State"])
            if (
                _sha(_canonical(checkpoint_state, MIB)) != checkpoint["StateSha256"]
                or _sha(_canonical(checkpoint["Prefix"], MIB))
                != checkpoint["PrefixSha256"]
            ):
                _fail(
                    "Conflict",
                    "admit",
                    "Checkpoint",
                    "retained state/prefix identity differs",
                )
            _integer(
                context["TargetRevision"],
                "TargetRevision",
                checkpoint_state["Revision"] + 1,
                state["Revision"],
            )
            expected.append(first)
    projections = 0
    if mode != "train":
        for sweep in range(sweeps):
            for identity in ordered:
                node = nodes[identity]
                if node["Kind"] == "neural":
                    expected.append(
                        {"Kind": "NeuralForward", "NodeId": identity, "Sweep": sweep}
                    )
                else:
                    if node["Prior"]["Gammas"]:
                        expected.append(
                            {"Kind": "GammaBlock", "NodeId": identity, "Sweep": sweep}
                        )
                    expected.append(
                        {"Kind": "GaussianBlock", "NodeId": identity, "Sweep": sweep}
                    )
                    projections += 1
    if (
        projections > 32
        or len(expected) > 4096
        or not _same(plan["Operations"], expected)
    ):
        _fail(
            "Conflict",
            "admit",
            "Operations",
            "complete fixed schedule differs or exceeds bounds",
        )
    return AdmittedPlan(
        raw, plan, _sha(_canonical(plan, MIB)), projections, tuple(expected)
    )


def admit_plan(raw: object, bindings: Mapping[str, str]) -> AdmittedPlan | Failure:
    """Validate source-fixed schedule and P before any owned setup or child entry."""
    try:
        if type(raw) is not bytes:
            _fail("Admission", "admit", "Plan", "original plan bytes required")
        return _plan(raw, bindings)
    except _Stop as error:
        return error.failure
    except Exception as error:  # noqa: BLE001 - public malformed-value boundary.
        return Failure("Admission", "admit", "Plan", type(error).__name__)


@dataclass(slots=True, weakref_slot=True, eq=False)
class SessionResult:
    SessionId: str
    RawPlan: object
    Plan: AdmittedPlan | None = None
    Ready: Frame | None = None
    Incoming: list[bytes] = field(default_factory=list)
    Outgoing: list[bytes] = field(default_factory=list)
    Checkpoints: list[tuple[Frame, records.Artifact | None]] = field(
        default_factory=list
    )
    Commits: list[Frame] = field(default_factory=list)
    CommitPages: list[tuple[bytes, records.Artifact | None]] = field(
        default_factory=list
    )
    PendingCommitPage: list[bytes] = field(default_factory=list)
    Projections: list[ProjectionExchange] = field(default_factory=list)
    EpochReturn: Frame | None = None
    EpochReturnArtifact: records.Artifact | None = None
    ReturnAdmitted: bool = False
    EpochReturnAck: WriteObservation | None = None
    Terminal: Frame | None = None
    Peer: PeerObservation | None = None
    SourceBefore: SourceSnapshot | None = None
    SourceAfter: SourceSnapshot | None = None
    LastObservedCommitted: Tree | None = None
    Failure: Failure | None = None
    Closed: bool = False
    ForecastEligible: bool = False
    RemoteStart: dict[str, int] = field(default_factory=dict)


def _counter(value: object) -> Tree:
    row = _keys(value, set(_COUNTER_CAPS) | {"Remote"}, "Counters")
    for name, cap in _COUNTER_CAPS.items():
        _integer(row[name], name, 0, cap)
    remote = _keys(row["Remote"], _REMOTE_KEYS, "Remote")
    for name, value_counter in remote.items():
        observed = _keys(value_counter, {"Observed", "Complete"}, name)
        _integer(observed["Observed"], name, 0, 32)
        if type(observed["Complete"]) is not bool:
            _fail(
                "Admission",
                "admit",
                name,
                "actual remote completeness boolean required",
            )
    if row["Applied"] > row["Proposed"] or row["Returned"] > row["SchedulerEntered"]:
        _fail(
            "Conflict",
            "admit",
            "Counters",
            "returned/proposed/applied prefix association refused",
        )
    return row


def _unit_result(value: object) -> bool:
    if type(value) is not dict or value.get("Kind") not in ("Ok", "Error"):
        _fail("Admission", "admit", "Result", "closed unit result required")
    if value["Kind"] == "Ok":
        result = _keys(value, {"Kind", "Value"}, "Ok")
        if result["Value"] is not None:
            _fail("Admission", "admit", "Ok.Value", "unit result value must be null")
        return True
    failure = _keys(value, {"Kind", "Failure"}, "Error")
    if failure["Failure"] is None:
        _fail(
            "Admission",
            "admit",
            "Error.Failure",
            "Error requires an actual non-null failure",
        )
    _failure_record(failure["Failure"])
    return False


def _required_failure(value: object) -> None:
    if value is None:
        _fail(
            "Admission", "admit", "Failure", "Error requires a non-null actual failure"
        )
    _failure_record(value)


def _exception(value: object) -> None:
    row = _keys(value, {"Type", "Message"}, "Exception")
    for name, cap in (("Type", 256), ("Message", 1024)):
        if type(row[name]) is not str or len(row[name].encode("utf-8")) > cap:
            _fail(
                "Admission", "admit", name, "bounded actual exception string required"
            )


def _value_result(
    value: object,
    ok: Callable[[Any], None],
    error: Callable[[Any], None] = _required_failure,
) -> None:
    if type(value) is not dict:
        _fail("Admission", "admit", "Result", "closed result union required")
    if value.get("Kind") == "Ok":
        row = _keys(value, {"Kind", "Value"}, "Ok")
        ok(row["Value"])
    elif value.get("Kind") == "Error":
        row = _keys(value, {"Kind", "Failure"}, "Error")
        error(row["Failure"])
    else:
        _fail("Admission", "admit", "Result.Kind", "unknown result variant")


def _unit(value: object) -> None:
    if value is not None:
        _fail("Admission", "admit", "Value", "unit return must be null")


def _call_value(value: object, returned: Callable[[Any], None]) -> Tree:
    if type(value) is not dict:
        _fail("Admission", "admit", "Call", "actual call observation required")
    if value.get("Kind") == "NotEntered":
        return _keys(value, {"Kind"}, "Call")
    if value.get("Kind") == "Raised":
        row = _keys(value, {"Kind", "Exception"}, "Call")
        _exception(row["Exception"])
        return row
    row = _keys(value, {"Kind", "Result"}, "Call")
    if row["Kind"] != "Returned":
        _fail("Admission", "admit", "Call.Kind", "unknown call variant")
    returned(row["Result"])
    return row


def _bit_vector(value: object, name: str, size: int, *, complete: bool = False) -> None:
    for entry in _array(value, name, size, minimum=size if complete else 0):
        _bits(entry, name)


def _preprocessing(value: object) -> None:
    row = _keys(value, {"TrainingCut", "Count", "Means", "Scales"}, "Preprocessing")
    _hash(row["TrainingCut"], "TrainingCut")
    _integer(row["Count"], "Count", 1, 256)
    _bit_vector(row["Means"], "Means", 8, complete=True)
    _bit_vector(row["Scales"], "Scales", 8, complete=True)
    if any(_bits(entry, "Scale") <= 0 for entry in row["Scales"]):
        _fail("Improper", "admit", "Scales", "proper preprocessing scales required")


def _proposal(value: object) -> None:
    if value is None:
        return
    row = _keys(
        value,
        {"ExpectedRevision", "ExpectedStateSha256", "State", "Details"},
        "Proposal",
    )
    revision = _integer(row["ExpectedRevision"], "ExpectedRevision", 0, 4096)
    _hash(row["ExpectedStateSha256"], "ExpectedStateSha256")
    if _state(row["State"])["Revision"] != revision + 1:
        _fail("Conflict", "admit", "Proposal", "one next revision required")


def _kernel_error(value: object) -> None:
    if type(value) is not dict:
        _fail("Admission", "admit", "KernelError", "closed kernel error required")
    variants = {
        "InvalidInput": {"Kind", "Field", "Requirement"},
        "NumericalFailure": {"Kind", "Operation", "Reason"},
        "ImproperBelief": {"Kind", "Family"},
    }
    kind = value.get("Kind")
    if type(kind) is not str or kind not in variants:
        _fail("Admission", "admit", "KernelError", "unknown kernel error")
    for name, item in _keys(value, variants[kind], "KernelError").items():
        if type(item) is not str or len(item.encode("utf-8")) > 1024:
            _fail("Budget", "admit", name, "bounded kernel error string required")


def _kernel_result(value: object, operation: str) -> None:
    _value_result(value, partial(_kernel_value, operation=operation), _kernel_error)


def _kernel_value(value: object, operation: str) -> None:
    keys = {
        "tryEncodeGamma": {"RequestedShape", "RepresentedShape", "Kernel"},
        "tryGammaProduct": {"LogPower", "Rate"},
        "tryGammaMoments": {"RepresentedShape", "Rate", "Mean", "Variance"},
        "tryGaussianProduct": {"PrecisionMean", "Precision"},
        "tryGaussianQuotient": {"PrecisionMean", "Precision"},
        "tryGaussianMoments": {"Mean", "Variance"},
        "tryNormalPrecisionVmp": {
            "ResidualSecondMoment",
            "ToY",
            "ToMean",
            "ToPrecision",
        },
    }
    row = _keys(value, keys[operation], operation)
    for name, item in row.items():
        if name in ("Kernel", "ToPrecision"):
            _kernel_value(item, "tryGammaProduct")
        elif name in ("ToY", "ToMean"):
            _kernel_value(item, "tryGaussianProduct")
        else:
            _bits(item, name)


def _snapshot_value(value: object) -> None:
    row = _keys(
        value,
        {
            "SnapshotIndex",
            "CompletedSessions",
            "PriorWork",
            "Store",
            "TranscriptBytes",
            "TranscriptFrames",
            "PeerLaunchAttempted",
            "NativePreparationEntered",
            "RemainingMilliseconds",
        },
        "BudgetSnapshot",
    )
    for name, cap in (
        ("SnapshotIndex", FRAME_LIMIT),
        ("CompletedSessions", 4),
        ("TranscriptBytes", TRANSCRIPT_LIMIT),
        ("TranscriptFrames", FRAME_LIMIT),
        ("PeerLaunchAttempted", 4),
        ("NativePreparationEntered", 1),
        ("RemainingMilliseconds", 300000),
    ):
        _integer(row[name], name, 0, cap)
    work = _keys(
        row["PriorWork"],
        {
            "SchedulerEntered",
            "KernelEntered",
            "ForwardEntered",
            "LearnEntered",
            "ProjectionRequested",
            "NativeLaunchAttempted",
            "CertificateEntered",
            "NestedReferenceEntered",
            "TrainingArtifacts",
        },
        "PriorWork",
    )
    caps = {
        "SchedulerEntered": 4096,
        "KernelEntered": 256,
        "ForwardEntered": 4096,
        "LearnEntered": 2048,
        "ProjectionRequested": 32,
        "NativeLaunchAttempted": 32,
        "CertificateEntered": 32,
        "NestedReferenceEntered": 32,
        "TrainingArtifacts": 4,
    }
    for name, item in work.items():
        _integer(item, name, 0, caps[name])
    store = _keys(
        row["Store"], {"ReservedCombinedBytes", "ReservedArtifactSlots"}, "Store"
    )
    _integer(
        store["ReservedCombinedBytes"], "ReservedCombinedBytes", 0, RETENTION_LIMIT
    )
    _integer(store["ReservedArtifactSlots"], "ReservedArtifactSlots", 0, ARTIFACT_LIMIT)


def _projection_return(value: object) -> None:
    row = _keys(
        value,
        {
            "Sequence",
            "RequestId",
            "InputSha256",
            "BindingsSha256",
            "ServiceSha256",
            "Native",
            "Certificate",
            "Failure",
            "BudgetSnapshot",
        },
        "ProjectionResponse",
    )
    _integer(row["Sequence"], "Sequence", 1, FRAME_LIMIT)
    _id(row["RequestId"], "RequestId")
    for name in ("InputSha256", "BindingsSha256", "ServiceSha256"):
        _hash(row[name], name)
    _failure_record(row["Failure"])
    _snapshot_value(row["BudgetSnapshot"])
    # The original complete passive trees are compared to actual coordinator
    # responses separately; no Type label is dispatched or reconstructed here.


def _transport_failure(value: object) -> None:
    row = _keys(
        value,
        {"Failure", "Received", "RawSha256", "ReceivedBytes", "Exception"},
        "TransportFailure",
    )
    _required_failure(row["Failure"])
    if row["RawSha256"] is not None:
        _hash(row["RawSha256"], "RawSha256")
    _integer(row["ReceivedBytes"], "ReceivedBytes", 0, 16 * MIB)
    if row["Exception"] is not None:
        _exception(row["Exception"])


def _source_result(value: object, kind: str) -> None:
    result = _keys(value, {"Type", "Fields"}, "Call.Result")
    namespace = (
        "Zeta.Bayesian.MixedMessageEpoch+"
        if kind == "BlockAttempt"
        else "Zeta.Bayesian.BoundedModuleLearner+"
    )
    if result["Type"] != namespace + kind:
        _fail(
            "Admission",
            "admit",
            "Call.Result.Type",
            "source-fixed return type required",
        )
    shapes = {
        "ForwardAttempt": {"Input", "Preactivations", "Hidden", "Outcome"},
        "StepAttempt": {
            "Input",
            "Forward",
            "Loss",
            "Gradient",
            "ProposedParameters",
            "Outcome",
        },
        "PreprocessingAttempt": {
            "TrainingCut",
            "Rows",
            "Means",
            "Variances",
            "Scales",
            "Outcome",
        },
        "TransformAttempt": {"Preprocessing", "Row", "Values", "Outcome"},
        "BlockAttempt": {"Inputs", "Calls", "Proposal", "Outcome"},
    }
    fields = _keys(result["Fields"], shapes[kind], kind)
    if kind in ("ForwardAttempt", "StepAttempt"):
        if fields["Input"] is not None:
            source_input = _keys(
                fields["Input"],
                {"Parameters", "Inputs"}
                | ({"Target"} if kind == "StepAttempt" else set()),
                "Input",
            )
            _bit_vector(source_input["Parameters"], "Parameters", 57, complete=True)
            _bit_vector(source_input["Inputs"], "Inputs", 12, complete=True)
            if kind == "StepAttempt":
                _bits(source_input["Target"], "Target")
        if kind == "ForwardAttempt":
            _bit_vector(fields["Preactivations"], "Preactivations", 4)
            _bit_vector(fields["Hidden"], "Hidden", 4)
            _value_result(
                fields["Outcome"], lambda item: _bits_void(item, "Prediction")
            )
        else:
            if fields["Forward"] is not None:
                _source_result(fields["Forward"], "ForwardAttempt")
            if fields["Loss"] is not None:
                _bits(fields["Loss"], "Loss")
            for name in ("Gradient", "ProposedParameters"):
                _bit_vector(fields[name], name, 57)
            _value_result(fields["Outcome"], _unit)
    elif kind == "PreprocessingAttempt":
        _hash(fields["TrainingCut"], "TrainingCut")
        for row in _array(fields["Rows"], "Rows", 256):
            _bit_vector(row, "Row", 8, complete=True)
        for name in ("Means", "Variances", "Scales"):
            _bit_vector(fields[name], name, 8)
        _value_result(fields["Outcome"], _preprocessing)
    elif kind == "TransformAttempt":
        _preprocessing(fields["Preprocessing"])
        _bit_vector(fields["Row"], "Row", 8, complete=True)
        _bit_vector(fields["Values"], "Values", 8)
        _value_result(fields["Outcome"], _unit)
    else:
        for item in _array(fields["Calls"], "Calls", 256):
            call = _keys(item, {"Operation", "Inputs", "Call"}, "Block.Call")
            operation = call["Operation"]
            if operation == "ProjectionService":
                _call_value(
                    call["Call"],
                    lambda returned: _value_result(
                        returned, _projection_return, _transport_failure
                    ),
                )
            elif operation in (
                "tryEncodeGamma",
                "tryGammaProduct",
                "tryGammaMoments",
                "tryGaussianProduct",
                "tryGaussianQuotient",
                "tryGaussianMoments",
                "tryNormalPrecisionVmp",
            ):
                _call_value(call["Call"], partial(_kernel_result, operation=operation))
            else:
                _fail(
                    "Admission",
                    "admit",
                    "Block.Operation",
                    "unknown fixed kernel/service operation",
                )
        _proposal(fields["Proposal"])
        _value_result(fields["Outcome"], _unit)


def _bits_void(value: object, name: str) -> None:
    _bits(value, name)


def _call(value: object, operation: str) -> Tree:
    kinds = {
        "LearnStep": "StepAttempt",
        "NeuralForward": "ForwardAttempt",
        "GammaBlock": "BlockAttempt",
        "GaussianBlock": "BlockAttempt",
        "Compensate": "BlockAttempt",
    }
    if operation not in kinds:
        _fail("Admission", "admit", "Operation", "unknown fixed operation")
    return _call_value(value, partial(_source_result, kind=kinds[operation]))


def _scheduler(value: object) -> None:
    def feedback(error: object) -> None:
        if type(error) is not dict:
            _fail("Admission", "admit", "Scheduler.Failure", "actual feedback required")
        kind = error.get("Kind")
        field_name = "Message" if kind == "Failed" else "Interrupt"
        if kind not in ("Failed", "Interrupted"):
            _fail("Admission", "admit", "Scheduler.Failure", "unknown feedback variant")
        row = _keys(error, {"Kind", field_name}, "Scheduler.Failure")
        if (
            type(row[field_name]) is not str
            or len(row[field_name].encode("utf-8")) > 1024
        ):
            _fail(
                "Budget",
                "admit",
                "Scheduler.Failure",
                "bounded actual feedback string required",
            )

    if type(value) is not dict or value.get("Kind") == "NotEntered":
        _fail(
            "Admission",
            "admit",
            "Scheduler",
            "actual scheduler return or raise required",
        )
    _call_value(
        value,
        lambda returned: _value_result(
            returned,
            lambda index: _integer_void(index, "Scheduler.Index", 0, 4096),
            feedback,
        ),
    )


def _integer_void(value: object, name: str, low: int, high: int) -> None:
    _integer(value, name, low, high)


def _descriptor(value: object) -> None:
    row = _keys(
        value,
        {"File", "Encoding", "Bytes", "Sha256", "StoredBytes", "StoredSha256"},
        "Artifact",
    )
    _relative(row["File"], "Artifact.File")
    if row["Encoding"] not in ("identity", "gzip"):
        _fail(
            "Admission", "admit", "Artifact.Encoding", "known storage encoding required"
        )
    for name in ("Bytes", "StoredBytes"):
        _integer(row[name], name, 0, RETENTION_LIMIT)
    for name in ("Sha256", "StoredSha256"):
        _hash(row[name], name)


def _recorder_value(value: object, kind: str) -> None:
    def stored(item: object) -> None:
        row = _keys(
            item,
            {"Sequence", "CheckpointSha256", "Artifact", "BudgetSnapshot"},
            "StoredCheckpoint",
        )
        _integer(row["Sequence"], "Sequence", 1, FRAME_LIMIT)
        _hash(row["CheckpointSha256"], "CheckpointSha256")
        _descriptor(row["Artifact"])
        _snapshot_value(row["BudgetSnapshot"])

    _value_result(
        value,
        stored
        if kind == "Checkpoint"
        else _unit
        if kind == "Commit"
        else _snapshot_value,
    )


def _core_publication(value: object) -> Tree:
    row = _keys(
        value,
        {"Recorder", "Unpublished", "Failure", "BudgetSnapshot"},
        "CorePublication",
    )
    for item in _array(row["Recorder"], "Recorder", FRAME_LIMIT):
        call = _keys(item, {"Kind", "Sequence", "Call"}, "Recorder.Call")
        if call["Kind"] not in ("Checkpoint", "Commit", "Snapshot"):
            _fail("Admission", "admit", "Recorder.Kind", "unknown recorder callback")
        if call["Kind"] == "Snapshot":
            _unit(call["Sequence"])
        else:
            _integer(call["Sequence"], "Sequence", 1, FRAME_LIMIT)
        _call_value(call["Call"], partial(_recorder_value, kind=call["Kind"]))
    for sequence in _array(row["Unpublished"], "Unpublished", 4096):
        _integer(sequence, "Unpublished.Sequence", 1, FRAME_LIMIT)
    _failure_record(row["Failure"])
    _snapshot_value(row["BudgetSnapshot"])
    return row


def _operation_inputs(value: object, operation: Tree, plan: AdmittedPlan) -> None:
    kind = operation["Kind"]
    if kind == "LearnStep":
        row = _keys(
            value,
            {
                "Kind",
                "ArtifactId",
                "Pass",
                "RowId",
                "Row",
                "OldVector",
                "Inputs",
                "Target",
                "ArtifactEntry",
                "Transform",
            },
            "LearnStep.Inputs",
        )
        for name in ("Kind", "ArtifactId", "Pass", "RowId"):
            if (
                type(row[name]) is not type(operation[name])
                or row[name] != operation[name]
            ):
                _fail(
                    "Conflict",
                    "admit",
                    name,
                    "actual learner inputs differ from fixed operation",
                )
        evidence = next(
            item
            for item in plan.Value["EvidenceCut"]["Rows"]
            if item["Id"] == operation["RowId"]
        )
        if not _same(row["Row"], evidence) or row["Target"] != evidence["Target"]:
            _fail(
                "Conflict",
                "admit",
                "Row",
                "actual learner row/target differs from admitted original",
            )
        _bit_vector(row["OldVector"], "OldVector", 57)
        _bit_vector(row["Inputs"], "Inputs", 12)
        if row["ArtifactEntry"] is not None:
            entry = _keys(
                row["ArtifactEntry"], {"Request", "Preprocessing"}, "ArtifactEntry"
            )
            expected = next(
                item
                for item in plan.Value["Training"]["Artifacts"]
                if item["Id"] == operation["ArtifactId"]
            )
            if not _same(entry["Request"], expected):
                _fail(
                    "Conflict",
                    "admit",
                    "ArtifactEntry.Request",
                    "actual first artifact request differs",
                )
            _call_value(
                entry["Preprocessing"],
                partial(_source_result, kind="PreprocessingAttempt"),
            )
        _call_value(row["Transform"], partial(_source_result, kind="TransformAttempt"))
    elif kind == "NeuralForward":
        row = _keys(
            value,
            {"Kind", "NodeId", "RowId", "ArtifactVersion", "Transform", "Inputs"},
            "NeuralForward.Inputs",
        )
        node = next(
            item for item in plan.Value["Nodes"] if item["Id"] == operation["NodeId"]
        )
        if (
            row["Kind"] != kind
            or row["NodeId"] != node["Id"]
            or row["RowId"] != plan.Value["QueryRowId"]
            or row["ArtifactVersion"]
            != plan.Value["SelectedVersions"][node["Artifact"]]["Version"]
        ):
            _fail(
                "Conflict",
                "admit",
                "NeuralForward.Inputs",
                "actual selected query/model inputs differ",
            )
        _bit_vector(row["Inputs"], "Inputs", 12)
        _call_value(row["Transform"], partial(_source_result, kind="TransformAttempt"))
    elif type(value) is not dict:
        _fail(
            "Admission", "admit", "Block.Inputs", "source block input record required"
        )
    # Block's numeric input/detail payload remains a retained finite JSON value;
    # the closed source codec and actual complete call associations supply its
    # provenance. This validator does not recompute arithmetic or infer execution.


def _return_call_links(result: Tree, session: SessionResult) -> None:
    snapshots: dict[int, Tree] = {}
    acknowledgments: dict[int, Tree] = {}
    for raw in session.Outgoing:
        frame = _map(_json(raw, 16 * MIB), "Outgoing", 32)
        if "BudgetSnapshot" in frame:
            snap = frame["BudgetSnapshot"]
            snapshots[snap["SnapshotIndex"]] = snap
        if frame["Kind"] == "CheckpointAck":
            acknowledgments[frame["Sequence"]] = frame

    def actual_snapshot(snapshot: Tree) -> None:
        if not _same(snapshots.get(snapshot["SnapshotIndex"]), snapshot):
            _fail(
                "Conflict",
                "publish",
                "BudgetSnapshot",
                "returned snapshot differs from an actual outgoing coordinator observation",
            )

    actual_snapshot(result["Publication"]["BudgetSnapshot"])
    for recorder in result["Publication"]["Recorder"]:
        call = recorder["Call"]
        if call["Kind"] != "Returned" or call["Result"]["Kind"] != "Ok":
            continue
        value = call["Result"]["Value"]
        if recorder["Kind"] == "Snapshot":
            actual_snapshot(value)
        elif recorder["Kind"] == "Checkpoint":
            ack = acknowledgments.get(recorder["Sequence"])
            if (
                ack is None
                or ack["Outcome"]["Kind"] != "stored"
                or not _same(
                    value,
                    {
                        "Sequence": ack["Sequence"],
                        "CheckpointSha256": ack["CheckpointSha256"],
                        "Artifact": ack["Outcome"]["Artifact"],
                        "BudgetSnapshot": ack["BudgetSnapshot"],
                    },
                )
            ):
                _fail(
                    "Conflict",
                    "publish",
                    "Recorder.Checkpoint",
                    "returned stored checkpoint differs from the actual complete ACK",
                )
        elif not any(
            frame.Value["Sequence"] == recorder["Sequence"] for frame in session.Commits
        ):
            _fail(
                "Conflict",
                "publish",
                "Recorder.Commit",
                "successful callback lacks an actual received Commit",
            )
    responses = {
        item.Request.Value["Sequence"]: {
            name: value for name, value in item.Response.items() if name not in _HEADER
        }
        for item in session.Projections
        if item.Response is not None
    }
    used: set[int] = set()
    entered_artifacts: set[str] = set()
    for observation in result["Observations"]:
        kind = observation["Operation"]["Kind"]
        if kind == "LearnStep" and observation["Inputs"]["ArtifactEntry"] is not None:
            identity = observation["Operation"]["ArtifactId"]
            if identity in entered_artifacts:
                _fail(
                    "Conflict",
                    "publish",
                    "ArtifactEntry",
                    "actual artifact entry cannot repeat",
                )
            entered_artifacts.add(identity)
        call = observation["Call"]
        if kind != "GaussianBlock" or call["Kind"] != "Returned":
            continue
        for primitive in call["Result"]["Fields"]["Calls"]:
            returned = primitive["Call"]
            if (
                primitive["Operation"] != "ProjectionService"
                or returned["Kind"] != "Returned"
                or returned["Result"]["Kind"] != "Ok"
            ):
                continue
            value = returned["Result"]["Value"]
            sequence = value["Sequence"]
            if sequence in used or not _same(responses.get(sequence), value):
                _fail(
                    "Conflict",
                    "publish",
                    "ProjectionService",
                    "returned service payload differs from actual coordinator response",
                )
            used.add(sequence)
    if result["Outcome"] == "completed" and used != set(responses):
        _fail(
            "Conflict",
            "publish",
            "ProjectionService",
            "completed return omitted an actual service response",
        )


def _observation(
    value: object, plan: AdmittedPlan, index: int, *, before_apply: bool
) -> Tree:
    row = _keys(value, _OBSERVATION_KEYS, "Observation")
    if index >= len(plan.Operations) or not _same(
        row["Operation"], plan.Operations[index]
    ):
        _fail(
            "Conflict",
            "admit",
            "Operation",
            "actual observation differs from next fixed source operation",
        )
    if type(row["Sequence"]) is not int or not 1 <= row["Sequence"] <= FRAME_LIMIT:
        _fail(
            "Conflict",
            "admit",
            "Observation.Sequence",
            "ordered observation prefix required",
        )
    _integer(row["InputRevision"], "InputRevision", 0, 4096)
    if before_apply and row["AppliedRevision"] is not None:
        _fail(
            "Conflict",
            "admit",
            "AppliedRevision",
            "checkpoint cannot claim application before ACK",
        )
    if row["AppliedRevision"] is not None:
        _integer(
            row["AppliedRevision"],
            "AppliedRevision",
            row["InputRevision"] + 1,
            row["InputRevision"] + 1,
        )
    _failure_record(row["Failure"])
    _call(row["Call"], row["Operation"]["Kind"])
    _operation_inputs(row["Inputs"], row["Operation"], plan)
    if row["Admission"] is not None:
        _unit_result(row["Admission"])
    if row["Proposal"] is not None:
        proposal = _keys(
            row["Proposal"],
            {"ExpectedRevision", "ExpectedStateSha256", "State", "Details"},
            "Proposal",
        )
        _integer(
            proposal["ExpectedRevision"],
            "ExpectedRevision",
            row["InputRevision"],
            row["InputRevision"],
        )
        _hash(proposal["ExpectedStateSha256"], "ExpectedStateSha256")
        state = _state(proposal["State"])
        if state["Revision"] != row["InputRevision"] + 1:
            _fail(
                "Conflict",
                "admit",
                "Proposal.State.Revision",
                "proposal must name one next state revision",
            )
    return row


def _remaining(value: object, budget: _Budget) -> None:
    row = _keys(
        value,
        {
            "Work",
            "Store",
            "TranscriptBytes",
            "TranscriptFrames",
            "RemainingMilliseconds",
            "SnapshotIndex",
        },
        "Remaining",
    )
    snapshot = budget.LastSnapshot
    if (
        snapshot is None
        or type(row["SnapshotIndex"]) is not int
        or row["SnapshotIndex"] != snapshot["SnapshotIndex"]
    ):
        _fail(
            "Conflict",
            "project",
            "SnapshotIndex",
            "request must bind the last actually sent budget snapshot",
        )
    work = _keys(row["Work"], set(budget.PriorWork), "Remaining.Work")
    caps = _COUNTER_CAPS | {
        "NativeLaunchAttempted": 32,
        "CertificateEntered": 32,
        "NestedReferenceEntered": 32,
        "TrainingArtifacts": 4,
    }
    for name in budget.PriorWork:
        _integer(work[name], name, 0, caps[name] - budget.PriorWork[name])
    store = _keys(row["Store"], {"CombinedBytes", "ArtifactSlots"}, "Remaining.Store")
    if (
        store["CombinedBytes"]
        != RETENTION_LIMIT - snapshot["Store"]["ReservedCombinedBytes"]
        or store["ArtifactSlots"]
        != ARTIFACT_LIMIT - snapshot["Store"]["ReservedArtifactSlots"]
    ):
        _fail(
            "Conflict",
            "project",
            "Remaining.Store",
            "snapshot-relative remaining reservation differs",
        )
    for name, cap in (
        ("TranscriptBytes", TRANSCRIPT_LIMIT),
        ("TranscriptFrames", FRAME_LIMIT),
    ):
        _integer(row[name], name, cap - snapshot[name], cap - snapshot[name])
    _integer(
        row["RemainingMilliseconds"],
        "RemainingMilliseconds",
        0,
        snapshot["RemainingMilliseconds"],
    )


def _flush_commits(
    session: SessionResult, store: records.Store, budget: _Budget
) -> None:
    if not session.PendingCommitPage:
        return
    raw = b"".join(session.PendingCommitPage)
    session.CommitPages.append((raw, None))
    artifact = _store_bytes(store, "commit-page", raw, budget)
    session.CommitPages[-1] = (raw, artifact)
    session.PendingCommitPage.clear()


def _send_record(
    peer: _Peer,
    value: Tree,
    session: SessionResult,
    store: records.Store,
    budget: _Budget,
    role: str,
) -> WriteObservation:
    # Snapshot is sampled before serialization; the outgoing original is charged
    # before its first possible byte is written to the pipe.
    if value["Kind"] in ("Start", "CheckpointAck", "ProjectionResponse"):
        value["BudgetSnapshot"] = _snapshot(store, budget)
    raw = _canonical(
        value,
        min(
            _CAPS[value["Kind"]],
            TRANSCRIPT_LIMIT - TERMINAL_RESERVE - budget.ProtocolBytes,
        ),
        newline=True,
    )
    session.Outgoing.append(raw)
    _store_bytes(store, role, raw, budget)
    return peer.send(raw)


def _ack(
    peer: _Peer,
    frame: Frame,
    artifact: records.Artifact,
    session: SessionResult,
    store: records.Store,
    budget: _Budget,
) -> WriteObservation:
    return _send_record(
        peer,
        {
            "Kind": "CheckpointAck",
            "Schema": SCHEMA,
            "SessionId": session.SessionId,
            "Sequence": frame.Value["Sequence"],
            "CheckpointSha256": frame.Sha256,
            "Outcome": {"Kind": "stored", "Artifact": artifact.descriptor()},
        },
        session,
        store,
        budget,
        "checkpoint-ack",
    )


def _terminal(frame: Frame, session: SessionResult, budget: _Budget) -> None:
    row = frame.Value
    _failure_record(row["Failure"])
    _counter(row["Counters"])
    publication = _keys(
        row["Publication"],
        {"EpochReturn", "ResultRetention", "Failure", "Transport"},
        "Publication",
    )
    _failure_record(publication["Failure"])
    transport = _keys(publication["Transport"], {"Coordinator", "Peer"}, "Transport")
    if not _same(transport["Coordinator"], budget.LastSnapshot):
        _fail(
            "Conflict",
            "publish",
            "BudgetSnapshot",
            "terminal differs from last actual coordinator snapshot",
        )
    peer = _keys(
        transport["Peer"],
        {
            "IncomingBytes",
            "IncomingFrames",
            "OutgoingReservedBytes",
            "OutgoingReservedFrames",
            "OutgoingCompletedBytes",
            "OutgoingCompletedFrames",
            "PartialWrite",
        },
        "PeerTransport",
    )
    for name in ("IncomingBytes", "OutgoingReservedBytes", "OutgoingCompletedBytes"):
        _integer(peer[name], name, 0, TRANSCRIPT_LIMIT)
    for name in ("IncomingFrames", "OutgoingReservedFrames", "OutgoingCompletedFrames"):
        _integer(peer[name], name, 0, FRAME_LIMIT)
    if peer["PartialWrite"] is not None:
        partial = _keys(
            peer["PartialWrite"],
            {"Sequence", "ReservedBytes", "ObservedWrittenBytes"},
            "PartialWrite",
        )
        if partial["Sequence"] is not None:
            _integer(partial["Sequence"], "Sequence", 1, FRAME_LIMIT)
        reserved = _integer(partial["ReservedBytes"], "ReservedBytes", 1, 16 * MIB)
        if partial["ObservedWrittenBytes"] is not None:
            _integer(
                partial["ObservedWrittenBytes"], "ObservedWrittenBytes", 0, reserved
            )
        _fail(
            "Transport",
            "publish",
            "PartialWrite",
            "terminal cannot certify an intact stream after partial output",
        )
    if (
        session.EpochReturn is None
        or session.EpochReturnArtifact is None
        or session.EpochReturnAck is None
    ):
        _fail(
            "Transport",
            "publish",
            "EpochReturn",
            "terminal has no complete actually acknowledged returned result",
        )
    actual = session.EpochReturn
    reference_row = _keys(
        publication["EpochReturn"],
        {"Sequence", "ResultSha256", "FrameSha256", "Artifact"},
        "EpochReturnReference",
    )
    expected = {
        "Sequence": actual.Value["Sequence"],
        "ResultSha256": actual.Value["ResultSha256"],
        "FrameSha256": actual.Sha256,
        "Artifact": session.EpochReturnArtifact.descriptor(),
    }
    if (
        not _same(reference_row, expected)
        or publication["ResultRetention"] != "acknowledged"
        or publication["Failure"] is not None
    ):
        _fail(
            "Conflict",
            "publish",
            "EpochReturnReference",
            "actual returned frame/ACK/publication association differs",
        )
    result = actual.Value["Result"]
    for name in (
        "Outcome",
        "Termination",
        "Failure",
        "Counters",
        "LastCommitted",
        "PendingRequest",
    ):
        if not _same(row[name], result[name]):
            _fail(
                "Conflict",
                "publish",
                name,
                "terminal summary differs from unchanged actual result",
            )
    observations = result["Observations"]
    if (
        type(row["LedgerCount"]) is not int
        or row["LedgerCount"] != len(observations)
        or row["LedgerSha256"] != _sha(_canonical(observations, 16 * MIB))
    ):
        _fail(
            "Conflict", "publish", "Ledger", "terminal observation count/hash differs"
        )
    # Successful pipe writes and complete received frames give actual directional
    # byte/frame correspondence. Terminal's own frame is excluded by definition.
    incoming_bytes = sum(len(raw) for raw in session.Outgoing)
    outgoing_bytes = sum(len(raw) for raw in session.Incoming[:-1])
    expected_transport = {
        "IncomingBytes": incoming_bytes,
        "IncomingFrames": len(session.Outgoing),
        "OutgoingReservedBytes": outgoing_bytes,
        "OutgoingReservedFrames": len(session.Incoming) - 1,
        "OutgoingCompletedBytes": outgoing_bytes,
        "OutgoingCompletedFrames": len(session.Incoming) - 1,
    }
    if any(
        peer[name] != expected_value
        for name, expected_value in expected_transport.items()
    ):
        _fail(
            "Conflict",
            "publish",
            "PeerTransport",
            "pre-terminal actual directional frame/byte totals differ",
        )


def _returned(
    frame: Frame, session: SessionResult, plan: AdmittedPlan, budget: _Budget
) -> None:
    row = _keys(frame.Value["Result"], _RESULT_KEYS, "EpochResult")
    if (
        frame.Value["ResultSha256"] != _sha(_canonical(row, 16 * MIB))
        or row["PlanSha256"] != plan.Sha256
    ):
        _fail(
            "Conflict",
            "publish",
            "ResultSha256",
            "actual returned result/plan identity mismatch",
        )
    _failure_record(row["Failure"])
    _counter(row["Counters"])
    if row["PendingRequest"] is not None:
        _request_values(row["PendingRequest"], plan.Value["SourceBindings"])
        if row["Outcome"] == "completed":
            _fail(
                "Conflict",
                "publish",
                "PendingRequest",
                "completed result cannot leave a pending service request",
            )
    if row["Outcome"] not in ("completed", "refused") or row["Termination"] != (
        "BudgetCompleted" if row["Outcome"] == "completed" else "Refused"
    ):
        _fail(
            "Conflict",
            "publish",
            "Outcome",
            "fixed outcome/termination association required",
        )
    if (row["Failure"] is None) != (row["Outcome"] == "completed"):
        _fail(
            "Conflict",
            "publish",
            "Failure",
            "result failure/outcome association differs",
        )
    if not _same(_state(row["LastCommitted"]), session.LastObservedCommitted):
        _fail(
            "Conflict",
            "publish",
            "LastCommitted",
            "result cannot invent an unobserved committed state",
        )
    observations = _array(row["Observations"], "Observations", 4096)
    if len(observations) < len(session.Checkpoints):
        _fail(
            "Conflict",
            "publish",
            "Observations",
            "actual return omitted acknowledged observations",
        )
    for index, observed in enumerate(observations):
        checked = _observation(observed, plan, index, before_apply=False)
        if index and checked["Sequence"] <= observations[index - 1]["Sequence"]:
            _fail(
                "Conflict",
                "publish",
                "Observation.Sequence",
                "ledger sequence must increase across intervening service requests",
            )
        if index < len(session.Checkpoints):
            checkpoint = session.Checkpoints[index][0].Value["Observation"]
            for name in (
                "Sequence",
                "Operation",
                "InputRevision",
                "Inputs",
                "Call",
                "Proposal",
                "Admission",
            ):
                if not _same(checked[name], checkpoint[name]):
                    _fail(
                        "Conflict",
                        "publish",
                        name,
                        "actual result changed earlier checkpoint content",
                    )
            matched_commits = [
                commit
                for commit in session.Commits
                if commit.Value["Sequence"]
                == session.Checkpoints[index][0].Value["Sequence"]
            ]
            revision = (
                matched_commits[0].Value["AppliedRevision"] if matched_commits else None
            )
            if checked["AppliedRevision"] != revision:
                _fail(
                    "Conflict",
                    "publish",
                    "AppliedRevision",
                    "actual result/observed Commit association differs",
                )
    if row["Outcome"] == "completed" and (
        len(observations) != len(plan.Operations)
        or len(session.Checkpoints) != len(observations)
    ):
        _fail(
            "Conflict",
            "publish",
            "Observations",
            "completed result requires complete acknowledged fixed roster",
        )
    _core_publication(row["Publication"])
    _scheduler(row["Scheduler"])
    _return_call_links(row, session)
    # The core publication snapshot precedes EpochReturn encoding and its ACK.
    # Eligibility is checked against the actual outer chain, never by mutating it.
    artifacts = _array(row["ProposedArtifacts"], "ProposedArtifacts", 4)
    if row["Outcome"] != "completed" and artifacts:
        _fail(
            "Conflict",
            "publish",
            "ProposedArtifacts",
            "refused training cannot publish an artifact",
        )
    for artifact in artifacts:
        _artifact(artifact, dict(plan.Value["SourceBindings"]))
    for name in _REMOTE_KEYS:
        remote = row["Counters"]["Remote"][name]
        coordinator_observed = getattr(budget, name) - session.RemoteStart[name]
        coordinator_complete = name not in budget.RemoteIncomplete
        # Each side retains its own knowledge: an exact singleton when complete,
        # otherwise a lower bound. Neither observer upgrades the other's total.
        if (remote["Complete"] and coordinator_observed > remote["Observed"]) or (
            coordinator_complete and remote["Observed"] > coordinator_observed
        ):
            _fail(
                "Conflict",
                "publish",
                name,
                "core and coordinator remote knowledge intervals are disjoint",
            )


@dataclass(frozen=True, slots=True)
class BridgeResult:
    ManifestRaw: object
    ExpectedManifestSha256: object
    SourceRoot: str | None
    AttemptRoot: str | None
    AttemptOwned: bool
    Route: str
    Reservation: Reservation | None
    Sessions: tuple[SessionResult, ...]
    Calls: tuple[CallObservation, ...]
    Sources: tuple[SourceSnapshot, ...]
    Preparation: CallObservation | None
    FinalRecord: records.Artifact | None
    Finalization: CallObservation | None
    Failure: Failure | None
    SecondaryFailures: tuple[BridgeFailure, ...]
    Counters: Tree
    Closed: bool
    InitialPlanRaw: object = None


class _Owner:
    """Issued sequential owner. Public functions validate its issuance/lifetime.

    It is a caller-trust handle, not isolation from hostile same-process Python.
    The only multiple-session route is the fixed dependent four-session M5 path.
    """

    def __init__(self, token: object) -> None:
        if token is not _ISSUER:
            raise TypeError("use open_bridge")
        self.ManifestRaw: object = None
        self.ExpectedManifestSha256: object = None
        self.SourceRoot: Path | None = None
        self.AttemptRoot: Path | None = None
        self.AttemptOwned = False
        self.Host: Path | None = None
        self.Manifest: ServiceManifest | None = None
        self.Route = "single"
        self.FirstPlan: AdmittedPlan | None = None
        self.InitialPlanRaw: object = None
        self.Store: records.Store | None = None
        self.Budget: _Budget | None = None
        self.Calls: list[CallObservation] = []
        self.Sources: list[SourceSnapshot] = []
        self.Sessions: list[SessionResult] = []
        self.SessionSummaries: list[tuple[SessionResult, Tree]] = []
        self.Preparation: CallObservation | None = None
        self.Prepared: native.PreparedNative | None = None
        self.FinalRecord: records.Artifact | None = None
        self.Finalization: CallObservation | None = None
        self.SecondaryFailures: list[Failure] = []
        self.Failure: Failure | None = None
        self.Final: BridgeResult | None = None
        self.Running = False
        self.Services = _Services()


_ISSUER = object()


def _bridge_failure(handle: _Owner, failure: Failure) -> None:
    if handle.Failure is None:
        handle.Failure = failure
    elif handle.Failure != failure:
        handle.SecondaryFailures.append(failure)
    if handle.Budget is not None:
        handle.Budget.stop(handle.Failure)


def _source_summary(snapshot: SourceSnapshot) -> Tree:
    return {
        "Reads": [
            {
                "Role": row.Role,
                "Path": row.Path,
                "Expected": {
                    "Bytes": row.Expected.Bytes,
                    "Sha256": row.Expected.Sha256,
                },
                "Actual": None
                if row.Actual is None
                else {"Bytes": row.Actual.Bytes, "Sha256": row.Actual.Sha256},
                "ReadReturned": row.Observation.Raised is None,
                "Raised": None
                if row.Observation.Raised is None
                else {
                    "Type": row.Observation.Raised.Type,
                    "Message": row.Observation.Raised.Message,
                },
            }
            for row in snapshot.Reads
        ],
        "Modules": [
            {"Name": name, "File": path, "Origin": origin}
            for name, path, origin in snapshot.Modules
        ],
        "Failure": _failure_tree(snapshot.Failure),
    }


def _failure_tree(value: Failure | None) -> Tree | None:
    return (
        None
        if value is None
        else {
            "Code": value.Code,
            "Stage": value.Stage,
            "Field": value.Field,
            "Message": value.Message,
        }
    )


def _native_pins(manifest: ServiceManifest) -> dict[str, native.FileIdentity]:
    return {
        role: pin
        for role, pin in manifest.DirectFiles
        if role in {"@host", native.SCRIPT, *DLL_PATHS}
    }


def _m5_plan(handle: _Owner, plan: AdmittedPlan) -> None:
    index = len(handle.Sessions)
    if index >= 4 or plan.Projections != 0:
        _fail(
            "Conflict",
            "admit",
            "M5.Route",
            "fixed four-session zero-projection route required",
        )
    if index == 0:
        expected = controls.m5_child_plan(plan.Value["SourceBindings"])
    elif index == 1:
        expected = controls.m5_query_two_plan(handle.Sessions[0])
    elif index == 2:
        _check_session_seal(handle.Sessions[1])
        expected = controls.m5_query_three_plan(handle.Sessions[0])
    else:
        expected = controls.m5_parent_plan(*handle.Sessions)
    if isinstance(expected, Failure):
        raise _Stop(expected)
    if not _same(_json(expected.Raw, MIB), plan.Value):
        _fail(
            "Conflict",
            "admit",
            "M5.Plan",
            "complete fixed dependent route plan changed",
        )


def _open_bridge(
    source_root: Path,
    attempt_parent: Path,
    attempt_name: str,
    host: Path,
    manifest_raw: object,
    expected_manifest_sha256: object,
    first_plan_raw: object,
    *,
    route: str = "single",
) -> _Owner | BridgeResult:
    """Open one exact source-admitted finite route; no peer is launched here.

    Call run_session with the complete admitted plan for each fixed route entry,
    then finish_bridge once. M5 derives later plans only after earlier returns.
    """
    handle = _Owner(_ISSUER)
    handle.ManifestRaw = manifest_raw
    handle.ExpectedManifestSha256 = expected_manifest_sha256
    handle.Route = route
    handle.InitialPlanRaw = first_plan_raw
    first_failure: Failure | None = None
    try:
        started = _observe("cooperative-clock/start", time.monotonic, handle.Calls)
        if (
            started.Raised is not None
            or type(started.Returned) is not float
            or not math.isfinite(started.Returned)
        ):
            _fail(
                "Unexpected",
                "admit",
                "Clock",
                "actual finite cooperative start observation unavailable",
            )
        for name, path in (
            ("SourceRoot", source_root),
            ("AttemptParent", attempt_parent),
            ("Host", host),
        ):
            if (
                not isinstance(path, Path)
                or not path.is_absolute()
                or os.path.normpath(path) != str(path)
            ):
                _fail(
                    "Admission",
                    "admit",
                    name,
                    "canonical absolute caller path required",
                )
        if (
            type(attempt_name) is not str
            or re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", attempt_name, re.ASCII)
            is None
        ):
            _fail(
                "Admission",
                "admit",
                "AttemptName",
                "exclusive bounded child name required",
            )
        if route not in ("single", "m5-child-parent"):
            _fail(
                "Admission",
                "admit",
                "Route",
                "only single or fixed M5 dependent route exists",
            )
        handle.SourceRoot, handle.Host, handle.AttemptRoot = (
            source_root,
            host,
            attempt_parent / attempt_name,
        )
        manifest = admit_service_manifest(manifest_raw, expected_manifest_sha256)
        if not isinstance(manifest, ServiceManifest):
            raise _Stop(manifest)
        handle.Manifest = manifest
        plan = admit_plan(first_plan_raw, dict(manifest.Bindings))
        if not isinstance(plan, AdmittedPlan):
            raise _Stop(plan)
        handle.FirstPlan = plan
        if route == "m5-child-parent":
            _m5_plan(handle, plan)
        reservation = _reservation(plan.Projections, _native_pins(manifest))
        budget = _Budget(reservation, started.Returned)
        budget.Calls = handle.Calls
        handle.Budget = budget
        budget.check()
        snapshot = _sources(source_root, host, manifest, budget)
        handle.Sources.append(snapshot)
        if snapshot.Failure is not None:
            raise _Stop(snapshot.Failure)
        created = _observe(
            "create-attempt",
            lambda: storage.create_directory(attempt_parent, attempt_name),
            handle.Calls,
        )
        if (
            created.Raised is not None
            or type(created.Returned) is not admission.Admitted
        ):
            _fail(
                "Storage",
                "admit",
                "AttemptRoot",
                "exclusive setup refused; ambiguous owned prefix retained",
            )
        handle.AttemptOwned = True
        opened = _observe(
            "open_store",
            lambda: records.open_store(
                handle.AttemptRoot, "records", reservation.StoreLimits
            ),
            handle.Calls,
        )
        if opened.Raised is not None or type(opened.Returned) is not records.Opened:
            _fail(
                "Storage", "admit", "Store", "actual exclusive recorder setup refused"
            )
        handle.Store = opened.Returned.Store
        _store_bytes(handle.Store, "service-manifest", manifest.Raw, budget)
        _store_bytes(
            handle.Store,
            "source-before",
            _canonical(_source_summary(snapshot), MIB, newline=True),
            budget,
        )
        _store_bytes(handle.Store, "first-plan", plan.Raw, budget)
        if reservation.Projections:
            budget.check()
            budget.NativePreparationEntered += 1
            prepared = _observe(
                "prepare_native",
                lambda: native.prepare_native(
                    source_root,
                    attempt_parent / attempt_name / "native-prepared",
                    host,
                    _native_pins(manifest),
                ),
                handle.Calls,
            )
            handle.Preparation = prepared
            if (
                prepared.Raised is not None
                or type(prepared.Returned) is not native.PreparedNative
            ):
                _fail(
                    "Service",
                    "admit",
                    "PreparedNative",
                    "actual native preparation outcome unavailable",
                )
            handle.Prepared = prepared.Returned
            if prepared.Returned.Complete is not True:
                first_failure = Failure(
                    "Service",
                    "admit",
                    "PreparedNative",
                    "native preparation refused with actual owned prefix",
                )
            _retained_public(
                prepared.Returned, handle.Store, "native-preparation", budget, MIB
            )
            if prepared.Returned.Complete is not True:
                _fail(
                    "Service",
                    "admit",
                    "PreparedNative",
                    "native preparation refused with actual owned prefix",
                )
        return handle
    except _Stop as error:
        _bridge_failure(handle, first_failure or error.failure)
        if first_failure is not None and first_failure != error.failure:
            handle.SecondaryFailures.append(error.failure)
    except Exception as error:  # noqa: BLE001 - public setup retains actual available ownership/outcomes.
        failure = Failure("Unexpected", "admit", None, type(error).__name__)
        _bridge_failure(handle, first_failure or failure)
        if first_failure is not None:
            handle.SecondaryFailures.append(failure)
    return _finish_bridge(handle)


def _run_peer(handle: _Owner, session: SessionResult) -> None:
    budget, store, plan = handle.Budget, handle.Store, session.Plan
    if (
        budget is None
        or store is None
        or plan is None
        or handle.SourceRoot is None
        or handle.Host is None
        or handle.Manifest is None
        or handle.AttemptRoot is None
    ):
        _fail("Admission", "admit", "Handle", "complete admitted owned setup required")
    session.RemoteStart = {name: getattr(budget, name) for name in _REMOTE_KEYS}
    session.LastObservedCommitted = plan.Value["InitialState"]
    peer: _Peer | None = None
    expected_sequence = 1
    pending_checkpoint: Frame | None = None
    terminal_seen = False
    returned_seen = False
    normal = False
    service_failed = False
    try:
        peer = _Peer(
            (
                str(handle.Host),
                "fsi",
                "--quiet",
                "--exec",
                str(handle.SourceRoot / PEER_SCRIPT),
            ),
            handle.SourceRoot,
            budget,
            4 if handle.Route == "m5-child-parent" else 1,
        )
        session.Peer = peer.available()
        if session.Peer.Failure is not None:
            raise _Stop(session.Peer.Failure)
        _send_record(
            peer,
            {
                "Kind": "Start",
                "Schema": SCHEMA,
                "SessionId": session.SessionId,
                "Plan": plan.Value,
                "PlanSha256": plan.Sha256,
                "ServiceSha256": handle.Manifest.Sha256,
                "ExpectedBindings": dict(handle.Manifest.Bindings),
            },
            session,
            store,
            budget,
            "start",
        )
        while True:
            raw = peer.receive(terminal=returned_seen)
            if raw is None:
                if not terminal_seen:
                    _fail(
                        "Transport",
                        "publish",
                        "EOF",
                        "peer ended before a complete terminal",
                    )
                break
            session.Incoming.append(raw)
            if terminal_seen:
                _fail(
                    "Transport",
                    "publish",
                    "AfterTerminal",
                    "actual bytes arrived after terminal",
                )
            admitted = decode_frame(raw, session.SessionId)
            if not isinstance(admitted, Frame):
                raise _Stop(admitted)
            frame = admitted
            value = frame.Value
            kind = value["Kind"]
            if session.Ready is None:
                if kind != "Ready":
                    if kind == "Terminal":
                        session.Terminal = frame
                        _store_bytes(store, "pre-ready-terminal", raw, budget)
                    _fail(
                        "Transport",
                        "admit",
                        "Ready",
                        "peer did not become ready before work",
                    )
                session.Ready = frame
                _store_bytes(store, "ready", raw, budget)
                if (
                    value["PlanSha256"] != plan.Sha256
                    or value["ServiceSha256"] != handle.Manifest.Sha256
                ):
                    _fail(
                        "Conflict",
                        "admit",
                        "Ready",
                        "ready/source/plan identity differs",
                    )
                continue
            if kind == "Terminal":
                session.Terminal = frame
                _flush_commits(session, store, budget)
                _store_bytes(store, "peer-terminal", raw, budget)
                _terminal(frame, session, budget)
                terminal_seen = True
                continue
            if returned_seen:
                _fail(
                    "Transport",
                    "publish",
                    "AfterReturn",
                    "operational frame after actual EpochReturn",
                )
            if kind == "Commit":
                # Retain the actual frame before any association check or later page write.
                session.Commits.append(frame)
                if sum(map(len, session.PendingCommitPage)) + len(raw) > MIB:
                    _flush_commits(session, store, budget)
                session.PendingCommitPage.append(raw)
                if (
                    pending_checkpoint is None
                    or value["Sequence"] != pending_checkpoint.Value["Sequence"]
                    or value["CheckpointSha256"] != pending_checkpoint.Sha256
                ):
                    _fail(
                        "Conflict",
                        "apply",
                        "Commit",
                        "Commit lacks matching actual stored checkpoint ACK",
                    )
                observation = pending_checkpoint.Value["Observation"]
                proposal = observation["Proposal"]
                if (
                    proposal is None
                    or observation["Failure"] is not None
                    or observation["Admission"] is None
                    or not _unit_result(observation["Admission"])
                ):
                    _fail(
                        "Conflict",
                        "apply",
                        "Commit",
                        "refused/nonproposed observation cannot be applied",
                    )
                state = _state(value["LastCommitted"])
                if (
                    not _same(state, proposal["State"])
                    or type(value["AppliedRevision"]) is not int
                    or value["AppliedRevision"] != state["Revision"]
                ):
                    _fail(
                        "Conflict",
                        "apply",
                        "LastCommitted",
                        "actual Commit differs from acknowledged proposed state",
                    )
                _counter(value["Counters"])
                session.LastObservedCommitted = state
                pending_checkpoint = None
                if (
                    len(session.PendingCommitPage) >= 16
                    or sum(map(len, session.PendingCommitPage)) == MIB
                ):
                    _flush_commits(session, store, budget)
                continue
            if kind == "EpochReturn":
                # Retain the actual received candidate before any sequence or
                # schema judgment. It is admitted only after _returned succeeds.
                session.EpochReturn = frame
                _returned(frame, session, plan, budget)
                session.ReturnAdmitted = True
            if (
                kind not in ("Checkpoint", "ProjectionRequest", "EpochReturn")
                or value["Sequence"] != expected_sequence
            ):
                _fail(
                    "Conflict",
                    "admit",
                    "Sequence",
                    "unexpected/duplicate/missing protocol sequence",
                )
            expected_sequence += 1
            if pending_checkpoint is not None:
                previous = pending_checkpoint.Value["Observation"]
                if (
                    previous["Proposal"] is not None
                    and previous["Failure"] is None
                    and previous["Admission"] is not None
                    and _unit_result(previous["Admission"])
                ):
                    _fail(
                        "Transport",
                        "apply",
                        "Commit",
                        "new frame before observing required actual Commit",
                    )
                pending_checkpoint = None
            if kind == "Checkpoint":
                session.Checkpoints.append((frame, None))
                observation = _observation(
                    value["Observation"],
                    plan,
                    len(session.Checkpoints) - 1,
                    before_apply=True,
                )
                if value["Sequence"] != observation["Sequence"]:
                    _fail(
                        "Conflict",
                        "publish",
                        "Observation.Sequence",
                        "checkpoint and its actual observation allocation differ",
                    )
                if (
                    value["LastRevision"] != session.LastObservedCommitted["Revision"]
                    or type(value["LastRevision"]) is not int
                    or value["StateSha256"]
                    != _sha(_canonical(session.LastObservedCommitted, MIB))
                ):
                    _fail(
                        "Conflict",
                        "apply",
                        "Checkpoint",
                        "pre-apply state/revision differs from actual committed prefix",
                    )
                if observation["InputRevision"] != value["LastRevision"]:
                    _fail(
                        "Conflict",
                        "apply",
                        "InputRevision",
                        "observation input is not the last committed state",
                    )
                if (
                    observation["Proposal"] is not None
                    and observation["Proposal"]["ExpectedStateSha256"]
                    != value["StateSha256"]
                ):
                    _fail(
                        "Conflict",
                        "apply",
                        "ExpectedStateSha256",
                        "proposal expected-state hash differs",
                    )
                if (
                    observation["Operation"]["Kind"] != "GaussianBlock"
                    and len(raw) > 64 * 1024
                ):
                    _fail(
                        "Budget",
                        "publish",
                        "Checkpoint",
                        "nonprojection checkpoint exceeds 64 KiB",
                    )
                artifact = _store_bytes(store, "checkpoint", raw, budget)
                session.Checkpoints[-1] = (frame, artifact)
                _ack(peer, frame, artifact, session, store, budget)
                pending_checkpoint = frame
            elif kind == "ProjectionRequest":
                _flush_commits(session, store, budget)
                _store_bytes(store, "projection-request", raw, budget)
                if service_failed or handle.Prepared is None:
                    _fail(
                        "Service",
                        "project",
                        "ProjectionRequest",
                        "no next service request is admissible",
                    )
                next_index = len(session.Checkpoints)
                if (
                    next_index >= len(plan.Operations)
                    or plan.Operations[next_index]["Kind"] != "GaussianBlock"
                    or value["InputRevision"]
                    != session.LastObservedCommitted["Revision"]
                ):
                    _fail(
                        "Conflict",
                        "project",
                        "ProjectionRequest",
                        "request is outside its fixed current Gaussian block",
                    )
                if value["RequestId"] != "projection/" + str(
                    value["Sequence"]
                ) or value["CaseId"] != session.SessionId + "/projection/" + str(
                    value["Sequence"]
                ):
                    _fail(
                        "Conflict",
                        "project",
                        "CaseId",
                        "request/scalar identity is not session-derived",
                    )
                _remaining(value["Remaining"], budget)
                response = _projection(
                    frame,
                    handle.Prepared,
                    dict(handle.Manifest.Bindings),
                    handle.Manifest.Sha256,
                    handle.AttemptRoot
                    / ("native-call-" + str(budget.NativeCallEntered)),
                    store,
                    budget,
                    session.Projections,
                    handle.Services,
                )
                service_failed = response["Failure"] is not None
                _send_record(
                    peer, response, session, store, budget, "projection-response"
                )
                if service_failed and response["Failure"]["Code"] in (
                    "Storage",
                    "Transport",
                    "Unexpected",
                ):
                    _fail(
                        response["Failure"]["Code"],
                        response["Failure"]["Stage"],
                        response["Failure"]["Field"],
                        response["Failure"]["Message"],
                    )
            else:
                _flush_commits(session, store, budget)
                artifact = _store_bytes(store, "epoch-return", raw, budget)
                session.EpochReturnArtifact = artifact
                session.EpochReturnAck = _ack(
                    peer, frame, artifact, session, store, budget
                )
                returned_seen = True
        # EOF on stdout is not fabricated stderr closure. Drain the separately
        # bounded stderr stream, then observe one normal child wait and all closes.
        while not peer.observation.StderrEof:
            peer._poll_io(writing=False, terminal=True)
        normal = True
    except _Stop as error:
        session.Failure = error.failure
    except Exception as error:  # noqa: BLE001 - retain actual peer/service/frame prefix before cleanup.
        session.Failure = Failure("Unexpected", "publish", None, type(error).__name__)
    finally:
        if peer is not None:
            session.Peer = peer.close(normal=normal)
    actual_peer = session.Peer
    if session.Failure is None:
        if (
            actual_peer is None
            or not actual_peer.DirectChildClosed
            or not actual_peer.StdoutEof
            or not actual_peer.StderrEof
            or any(call.Raised is not None for call in actual_peer.Cleanup)
        ):
            session.Failure = Failure(
                "Transport",
                "publish",
                "Closure",
                "actual direct-child/pipe cleanup refused",
            )
        elif session.Terminal is None or actual_peer.ExitCode != (
            0 if session.Terminal.Value["Outcome"] == "completed" else 2
        ):
            session.Failure = Failure(
                "Transport",
                "publish",
                "ExitCode",
                "actual process exit differs from terminal outcome",
            )
    session.Closed = session.Failure is None
    session.ForecastEligible = (
        session.Closed
        and session.EpochReturn is not None
        and session.EpochReturn.Value["Result"]["Outcome"] == "completed"
    )


@dataclass(frozen=True, slots=True)
class ForecastSource:
    Raw: bytes
    ExpectedSha256: str
    Session: SessionResult


def _models(plan: AdmittedPlan) -> tuple[Tree, Tree]:
    nodes, ordered, resolve = _nodes(plan.Value["Nodes"])
    versions: dict[str, str] = {}
    models: Tree = {}
    ancestry: Tree = {}
    for identity in ordered:
        node = nodes[identity]
        dependencies = sorted({resolve(edge["SourceNode"]) for edge in node["Inputs"]})
        ancestor_rows = {
            row["NodeId"]: row
            for dependency in dependencies
            for row in ancestry[dependency]
        }
        if node["Kind"] == "neural":
            selected = plan.Value["SelectedVersions"][node["Artifact"]]
            versions[identity] = selected["Version"]
            ancestor_rows[identity] = {
                "NodeId": identity,
                "ArtifactVersion": selected["Version"],
                "TrainingCut": selected["Artifact"]["TrainingCut"],
            }
        else:
            preimage = {
                "Node": node,
                "Dependencies": [
                    {
                        "Id": dependency,
                        "Kind": nodes[dependency]["Kind"],
                        "Version": versions[dependency],
                    }
                    for dependency in dependencies
                ],
                "SourceBindings": plan.Value["SourceBindings"],
            }
            models[identity] = preimage
            versions[identity] = _sha(_canonical(preimage, 8 * MIB))
        ancestry[identity] = [ancestor_rows[key] for key in sorted(ancestor_rows)]
    return models, ancestry


def forecast_source(session: SessionResult) -> ForecastSource | Failure:
    """Build finite bundle bytes from an actually received closed query result.

    The later owning bridge checks object membership and its retained closure;
    this constructor does not turn an arbitrary caller object into provenance.
    """
    try:
        if (
            type(session) is not SessionResult
            or not session.ForecastEligible
            or session.Plan is None
            or session.Plan.Value["Mode"] != "query"
            or session.EpochReturn is None
        ):
            _fail(
                "Service",
                "admit",
                "Forecast",
                "actual closed successful query return required",
            )
        _check_session_seal(session)
        models, ancestry = _models(session.Plan)
        raw = _canonical(
            {
                "Schema": "zeta.mixed-epoch.forecast.v1",
                "Plan": session.Plan.Value,
                "Result": session.EpochReturn.Value["Result"],
                "ProducerModels": models,
                "Ancestry": ancestry,
            },
            8 * MIB,
        )
        return ForecastSource(raw, _sha(raw), session)
    except _Stop as error:
        return error.failure
    except Exception as error:  # noqa: BLE001 - caller-supplied malformed session boundary.
        return Failure("Admission", "admit", "Forecast", type(error).__name__)


def _forecasts(
    handle: _Owner, plan: AdmittedPlan, supplied: tuple[ForecastSource, ...]
) -> None:
    if type(supplied) is not tuple or len(supplied) > 256:
        _fail(
            "Budget",
            "admit",
            "Forecasts",
            "bounded explicit source-admitted tuple required",
        )
    if plan.Value["Mode"] != "train":
        if supplied:
            _fail(
                "Admission",
                "admit",
                "Forecasts",
                "nontraining plan cannot consume forecasts",
            )
        return
    training = plan.Value["Training"]
    if handle.Store is None or handle.Budget is None:
        _fail("Admission", "admit", "Store", "actual shared recorder required")
    bundles: dict[str, tuple[Tree, SessionResult]] = {}
    total = 0
    for source in supplied:
        if (
            type(source) is not ForecastSource
            or type(source.Raw) is not bytes
            or len(source.Raw) > 8 * MIB
        ):
            _fail(
                "Admission",
                "admit",
                "Forecast",
                "complete bounded actual bundle required",
            )
        total += len(source.Raw)
        if total > 16 * MIB:
            _fail(
                "Budget",
                "admit",
                "Forecasts",
                "repeated original input positions exceed 16 MiB",
            )
        actual_sha = _sha(source.Raw)
        if actual_sha != _hash(source.ExpectedSha256, "BundleSha256"):
            _fail(
                "Conflict",
                "admit",
                "BundleSha256",
                "independently supplied bundle identity differs",
            )
        origin = source.Session
        _check_session_seal(origin)
        if (
            not any(origin is prior for prior in handle.Sessions)
            or not origin.ForecastEligible
            or origin.Plan is None
            or origin.EpochReturn is None
        ):
            _fail(
                "Service",
                "admit",
                "Forecast.Source",
                "actual source/closure/work in this shared ledger required",
            )
        if origin.Plan.Value["Mode"] != "query":
            _fail("Admission", "admit", "Forecast.Plan", "query source required")
        bundle = _keys(
            _json(source.Raw, 8 * MIB),
            {"Schema", "Plan", "Result", "ProducerModels", "Ancestry"},
            "Forecast",
        )
        models, ancestry = _models(origin.Plan)
        if (
            bundle["Schema"] != "zeta.mixed-epoch.forecast.v1"
            or not _same(bundle["Plan"], origin.Plan.Value)
            or not _same(bundle["Result"], origin.EpochReturn.Value["Result"])
            or not _same(bundle["ProducerModels"], models)
            or not _same(bundle["Ancestry"], ancestry)
        ):
            _fail(
                "Conflict",
                "admit",
                "Forecast.Source",
                "bundle differs from actual returned source/call/model/ancestry evidence",
            )
        if actual_sha not in bundles:
            _store_bytes(handle.Store, "forecast-bundle", source.Raw, handle.Budget)
            bundles[actual_sha] = (bundle, origin)
        elif not _same(bundles[actual_sha][0], bundle):
            _fail(
                "Conflict",
                "admit",
                "Forecast",
                "same identity changed complete content",
            )
    cuts: dict[str, Tree] = {}
    for expected_cut_hash, cut in training["ChildCuts"].items():
        raw = _canonical(cut, MIB)
        identity = _sha(raw)
        if identity != expected_cut_hash:
            _fail(
                "Conflict",
                "admit",
                "ChildCuts",
                "child cut map key differs from complete canonical cut",
            )
        if identity in cuts:
            _fail("Conflict", "admit", "ChildCuts", "duplicate full child cut")
        cuts[identity] = cut
    row_lookup = {row["Id"]: row for row in plan.Value["EvidenceCut"]["Rows"]}
    requests = {request["Id"]: request for request in training["Artifacts"]}
    bindings = training["ChildForecasts"]
    ordered_positions = [
        (identity, row_id, slot)
        for identity in sorted(requests)
        for row_id in training["RowIds"][identity]
        for slot in range(2)
    ]
    previous_position = -1
    consumed: set[str] = set()
    matched: set[tuple[str, str, int]] = set()
    for value in bindings:
        row = _keys(
            value,
            {
                "ArtifactId",
                "TrainingRowId",
                "TargetSlot",
                "BundleSha256",
                "QueryRowId",
                "ProducerNode",
                "OutputPort",
                "ProducerVersion",
                "ProducerTrainingCut",
                "ObservationSequence",
                "CommitRevision",
                "Mean",
            },
            "ChildForecast",
        )
        position = (
            row["ArtifactId"],
            row["TrainingRowId"],
            _integer(row["TargetSlot"], "TargetSlot", 0, 1),
        )
        if position not in ordered_positions or position in matched:
            _fail(
                "Conflict", "admit", "ChildForecast", "unknown/duplicate training slot"
            )
        ordinal = ordered_positions.index(position)
        if ordinal <= previous_position:
            _fail(
                "Conflict",
                "admit",
                "ChildForecasts",
                "exact artifact/row/slot order required",
            )
        previous_position = ordinal
        matched.add(position)
        if requests[position[0]]["Ports"][position[2]] == "absent":
            _fail(
                "Conflict",
                "admit",
                "ChildForecast",
                "absent child slot cannot consume a forecast",
            )
        sha = _hash(row["BundleSha256"], "BundleSha256")
        if sha not in bundles:
            _fail(
                "Service",
                "admit",
                "ChildForecast",
                "required full actual source bundle absent",
            )
        consumed.add(sha)
        bundle, origin = bundles[sha]
        if origin.Plan is None:
            _fail("Service", "admit", "Origin", "actual source plan unavailable")
        query_plan = origin.Plan
        query_row = next(
            item
            for item in query_plan.Value["EvidenceCut"]["Rows"]
            if item["Id"] == query_plan.Value["QueryRowId"]
        )
        training_row = row_lookup[position[1]]
        if (
            row["QueryRowId"] != query_row["Id"]
            or query_row["Id"] == training_row["Id"]
            or query_row["Target"] is not None
            or query_plan.Value["Horizon"] != plan.Value["Horizon"]
        ):
            _fail(
                "Conflict",
                "admit",
                "QueryRowId",
                "distinct actual target-hidden source row required",
            )
        for key in ("Features", "Origin", "FeatureAvailable", "TargetTime"):
            if not _same(query_row[key], training_row[key]):
                _fail("Conflict", "admit", key, "query/training row projection differs")
        nodes, _, resolve = _nodes(query_plan.Value["Nodes"])
        producer = resolve(_id(row["ProducerNode"], "ProducerNode"))
        if row["OutputPort"] != "mean":
            _fail(
                "Admission",
                "admit",
                "OutputPort",
                "only actual mean output is admissible",
            )
        node = nodes[producer]
        result = bundle["Result"]
        output = result["LastCommitted"]["Outputs"].get(producer)
        if (
            output is None
            or row["Mean"] != output["Mean"]
            or type(row["ObservationSequence"]) is not int
            or row["ObservationSequence"] != output["SourceSequence"]
        ):
            _fail(
                "Conflict",
                "admit",
                "Mean",
                "forecast differs from actual committed producer output",
            )
        observed_index = row["ObservationSequence"] - 1
        observations = result["Observations"]
        if not 0 <= observed_index < len(observations):
            _fail(
                "Conflict",
                "admit",
                "ObservationSequence",
                "actual source observation absent",
            )
        observation = observations[observed_index]
        if (
            observation["Failure"] is not None
            or type(row["CommitRevision"]) is not int
            or row["CommitRevision"] != observation["AppliedRevision"]
            or observation["Operation"].get("NodeId") != producer
        ):
            _fail(
                "Conflict",
                "admit",
                "CommitRevision",
                "actual successful source operation/commit differs",
            )
        if node["Kind"] == "neural":
            attempt = observation["Call"]["Result"]["Fields"]
            if attempt["Outcome"] != {"Kind": "Ok", "Value": row["Mean"]}:
                _fail(
                    "Conflict",
                    "admit",
                    "Forward",
                    "actual complete forward result differs from forecast mean",
                )
            version = query_plan.Value["SelectedVersions"][node["Artifact"]]["Version"]
        else:
            version = _sha(_canonical(bundle["ProducerModels"][producer], 8 * MIB))
        ancestors = bundle["Ancestry"][producer]
        ancestor_hash = _sha(_canonical(ancestors, 8 * MIB)) if ancestors else None
        if (
            row["ProducerVersion"] != version
            or row["ProducerTrainingCut"] != ancestor_hash
        ):
            _fail(
                "Conflict",
                "admit",
                "ProducerVersion",
                "full model/ancestry identity differs",
            )
        for ancestor in ancestors:
            selected = query_plan.Value["SelectedVersions"][
                nodes[ancestor["NodeId"]]["Artifact"]
            ]
            child_cut = cuts.get(ancestor["TrainingCut"])
            if (
                child_cut is None
                or selected["Version"] != ancestor["ArtifactVersion"]
                or selected["Artifact"]["TrainingCut"] != ancestor["TrainingCut"]
            ):
                _fail(
                    "Conflict",
                    "admit",
                    "ChildCut",
                    "full selected ancestor training-cut association absent",
                )
            active_rows = [
                item
                for item in child_cut["Rows"]
                if item["Id"] in child_cut["ActiveIds"]
            ]
            if (
                not active_rows
                or max(item["LabelAvailable"] for item in active_rows)
                >= training_row["Origin"]
            ):
                _fail(
                    "Conflict",
                    "admit",
                    "ChildCut",
                    "ancestor's latest training label must precede parent origin",
                )
    if consumed != set(bundles):
        _fail("Conflict", "admit", "Forecasts", "extra unconsumed source bundle")
    for position in ordered_positions:
        if (
            requests[position[0]]["Ports"][position[2]] == "required"
            and position not in matched
        ):
            _fail("Service", "admit", "ChildForecast", "required child slot is missing")


def _run_session(
    handle: _Owner,
    raw_plan: object,
    session_id: object,
    *,
    forecasts: tuple[ForecastSource, ...] = (),
) -> SessionResult | Failure:
    """Enter the next sole/fixed dependent session once; actual values survive failure."""
    if type(handle) is not _Owner:
        return Failure("Admission", "admit", "Handle", "issued bridge required")
    if handle.Final is not None or handle.Running or handle.Failure is not None:
        return Failure(
            "Conflict",
            "admit",
            "Handle",
            "closed, failed or currently running route cannot enter again",
        )
    session = SessionResult(
        str(session_id) if type(session_id) is str else "", raw_plan
    )
    try:
        session.SessionId = _id(session_id, "SessionId")
        if any(previous.SessionId == session.SessionId for previous in handle.Sessions):
            _fail(
                "Conflict",
                "admit",
                "SessionId",
                "nonresumable identities cannot be reused",
            )
        if (
            handle.Manifest is None
            or handle.Budget is None
            or handle.Store is None
            or handle.SourceRoot is None
            or handle.Host is None
        ):
            _fail("Admission", "admit", "Handle", "complete owned setup required")
        handle.Budget.check()
        plan = admit_plan(raw_plan, dict(handle.Manifest.Bindings))
        if not isinstance(plan, AdmittedPlan):
            raise _Stop(plan)
        session.Plan = plan
        if not handle.Sessions and (
            handle.FirstPlan is None or not _same(plan.Value, handle.FirstPlan.Value)
        ):
            _fail(
                "Conflict",
                "admit",
                "FirstPlan",
                "first admitted complete plan cannot be replaced after setup",
            )
        if handle.Route == "single" and handle.Sessions:
            _fail(
                "Conflict", "admit", "Route", "single-session route has no next session"
            )
        if handle.Route == "m5-child-parent":
            _m5_plan(handle, plan)
        _forecasts(handle, plan, forecasts)
        # Admission of dependencies precedes entry. From here, even a source or
        # launch refusal occupies this finite route position; it is never retried.
        handle.Sessions.append(session)
        handle.Running = True
        snapshot = _sources(
            handle.SourceRoot, handle.Host, handle.Manifest, handle.Budget
        )
        session.SourceBefore = snapshot
        handle.Sources.append(snapshot)
        if snapshot.Failure is not None:
            raise _Stop(snapshot.Failure)
        _store_bytes(handle.Store, "session-plan", plan.Raw, handle.Budget)
        _store_bytes(
            handle.Store,
            "session-source-before",
            _canonical(_source_summary(snapshot), MIB, newline=True),
            handle.Budget,
        )
        _run_peer(handle, session)
        # Source re-observation is independent of the numerical outcome, and does
        # not change the already returned core result into a later snapshot.
        after = _sources(handle.SourceRoot, handle.Host, handle.Manifest, handle.Budget)
        session.SourceAfter = after
        handle.Sources.append(after)
        if after.Failure is not None:
            if session.Failure is None:
                session.Failure = after.Failure
            else:
                handle.SecondaryFailures.append(after.Failure)
        _store_bytes(
            handle.Store,
            "session-source-after",
            _canonical(_source_summary(after), MIB, newline=True),
            handle.Budget,
        )
        if session.Peer is not None:
            # Full process bytes are already protocol records; this summary binds
            # those records and retains separately bounded actual stderr/cleanup.
            peer = session.Peer
            summary = {
                "Argv": list(peer.Argv),
                "StartedAtUtc": peer.StartedAtUtc,
                "FinishedAtUtc": peer.FinishedAtUtc,
                "LaunchAttempted": peer.LaunchAttempted,
                "ChildPid": peer.ChildPid,
                "ExitCode": peer.ExitCode,
                "CleanupExitCode": peer.CleanupExitCode,
                "DirectChildClosed": peer.DirectChildClosed,
                "StdoutEof": peer.StdoutEof,
                "StderrEof": peer.StderrEof,
                "StdoutBytes": sum(map(len, peer.Stdout)),
                "StdoutSha256": _sha(b"".join(peer.Stdout)),
                "Failure": _failure_tree(peer.Failure),
                "Cleanup": [
                    {
                        "Operation": call.Operation,
                        "Returned": call.Returned,
                        "Raised": None
                        if call.Raised is None
                        else {"Type": call.Raised.Type, "Message": call.Raised.Message},
                    }
                    for call in peer.Cleanup
                ],
            }
            _store_bytes(
                handle.Store,
                "peer-process",
                _canonical(summary, MIB, newline=True),
                handle.Budget,
            )
            _store_bytes(handle.Store, "peer-stderr", peer.Stderr, handle.Budget)
            if peer.PendingStdout:
                _store_bytes(
                    handle.Store,
                    "peer-pending-stdout",
                    peer.PendingStdout,
                    handle.Budget,
                )
        if session.Failure is not None:
            raise _Stop(session.Failure)
        session.Closed = True
        session.ForecastEligible = (
            session.EpochReturn is not None
            and session.EpochReturn.Value["Result"]["Outcome"] == "completed"
        )
        if session.EpochReturn is not None:
            counters = session.EpochReturn.Value["Result"]["Counters"]
            for name in (
                "SchedulerEntered",
                "KernelEntered",
                "ForwardEntered",
                "LearnEntered",
                "ProjectionRequested",
            ):
                handle.Budget.PriorWork[name] += counters[name]
            for name in (
                "NativeLaunchAttempted",
                "CertificateEntered",
                "NestedReferenceEntered",
            ):
                # PriorWork belongs to this coordinator. Keep its observed
                # delta without upgrading incomplete totals from a core receipt.
                handle.Budget.PriorWork[name] += (
                    getattr(handle.Budget, name) - session.RemoteStart[name]
                )
            if plan.Value["Mode"] == "train":
                entered_artifacts: set[str] = set()
                for observation in session.EpochReturn.Value["Result"]["Observations"]:
                    if (
                        observation["Operation"]["Kind"] == "LearnStep"
                        and observation["Inputs"].get("ArtifactEntry") is not None
                    ):
                        entry = _keys(
                            observation["Inputs"]["ArtifactEntry"],
                            {"Request", "Preprocessing"},
                            "ArtifactEntry",
                        )
                        identity = observation["Operation"]["ArtifactId"]
                        expected_request = next(
                            item
                            for item in plan.Value["Training"]["Artifacts"]
                            if item["Id"] == identity
                        )
                        if (
                            not _same(entry["Request"], expected_request)
                            or identity in entered_artifacts
                        ):
                            _fail(
                                "Conflict",
                                "publish",
                                "ArtifactEntry",
                                "actual admitted training entry identity repeated or changed",
                            )
                        entered_artifacts.add(identity)
                handle.Budget.PriorWork["TrainingArtifacts"] += len(entered_artifacts)
            handle.Budget.CompletedSessions += 1
        if handle.Route == "m5-child-parent" and not session.ForecastEligible:
            _fail(
                "Service",
                "scheduler",
                "M5.Route",
                "actual refused session stops the dependent route",
            )
    except _Stop as error:
        session.Failure = session.Failure or error.failure
        session.Closed = False
        session.ForecastEligible = False
        _bridge_failure(handle, session.Failure)
        if session.Failure != error.failure:
            handle.SecondaryFailures.append(error.failure)
    except Exception as error:  # noqa: BLE001 - retain actual route prefix and all callbacks.
        failure = Failure("Unexpected", "scheduler", None, type(error).__name__)
        session.Failure = session.Failure or failure
        session.Closed = False
        session.ForecastEligible = False
        _bridge_failure(handle, session.Failure)
        if session.Failure != failure:
            handle.SecondaryFailures.append(failure)
    finally:
        handle.Running = False
        if not any(previous is session for previous in handle.Sessions):
            handle.Sessions.append(session)
    try:
        if session.Closed:
            _SESSION_SEALS[session] = _session_seal(session)
    except _Stop as error:
        session.Failure = session.Failure or error.failure
        session.Closed = session.ForecastEligible = False
        _bridge_failure(handle, session.Failure)
    except Exception as error:  # noqa: BLE001 - actual committed prefix precedes closure encoding.
        failure = Failure("Unexpected", "publish", "SessionSeal", type(error).__name__)
        session.Failure = session.Failure or failure
        session.Closed = session.ForecastEligible = False
        _bridge_failure(handle, session.Failure)
    try:
        # Private copy is captured before exposing this mutable public DTO.
        handle.SessionSummaries.append((session, deepcopy(_session_summary(session))))
    except Exception as error:  # noqa: BLE001 - retain actual result even if private summary fails.
        session.Closed = session.ForecastEligible = False
        session.Failure = session.Failure or Failure(
            "Unexpected", "publish", "SessionSummary", type(error).__name__
        )
        _bridge_failure(handle, session.Failure)
    return session


def _session_summary(session: SessionResult) -> Tree:
    return {
        "SessionId": session.SessionId,
        "PlanSha256": None if session.Plan is None else session.Plan.Sha256,
        "Closed": session.Closed,
        "ForecastEligible": session.ForecastEligible,
        "Failure": _failure_tree(session.Failure),
        "EpochReturn": None
        if session.EpochReturnArtifact is None
        else session.EpochReturnArtifact.descriptor(),
        "TerminalSha256": None if session.Terminal is None else session.Terminal.Sha256,
        "ReturnAdmitted": session.ReturnAdmitted,
        "LastObservedCommitted": session.LastObservedCommitted,
    }


def _outer_counts(handle: _Owner) -> Tree:
    budget = handle.Budget
    if budget is None:
        return {"Available": False}
    return {
        "Available": True,
        "CompletedSessions": budget.CompletedSessions,
        "PeerLaunchAttempted": budget.PeerLaunches,
        "NativePreparationEntered": budget.NativePreparationEntered,
        "TranscriptBytes": budget.ProtocolBytes,
        "TranscriptFrames": budget.Frames,
        "PriorWork": dict(budget.PriorWork),
        "Remote": {
            name: {
                "Observed": getattr(budget, name),
                "Complete": name not in budget.RemoteIncomplete,
            }
            for name in sorted(_REMOTE_KEYS)
        },
        "ElapsedMilliseconds": max(
            0, math.floor((budget.Clock() - budget.Started) * 1000)
        ),
        "ExternalReservedCombinedBytes": budget.Reservation.ExternalBytes,
        "ExternalReservedArtifactSlots": budget.Reservation.ExternalSlots,
    }


def _finish_bridge(handle: _Owner) -> BridgeResult:
    """Once-only terminal/finalization; never resume a failed or exhausted route."""
    if type(handle) is not _Owner:
        return BridgeResult(
            None,
            None,
            None,
            None,
            False,
            "unknown",
            None,
            (),
            (),
            (),
            None,
            None,
            None,
            Failure("Admission", "admit", "Handle", "issued bridge required"),
            (),
            {},
            False,
        )
    if handle.Final is not None:
        return handle.Final
    if handle.Running:
        _bridge_failure(
            handle,
            Failure(
                "Conflict", "publish", "Handle", "cannot finalize a running session"
            ),
        )
    expected_sessions = 4 if handle.Route == "m5-child-parent" else 1
    if handle.Failure is None and len(handle.Sessions) != expected_sessions:
        _bridge_failure(
            handle,
            Failure(
                "Conflict",
                "publish",
                "Route",
                "finite route stopped before its required session count",
            ),
        )
    counts_call = _observe("outer-counts", lambda: _outer_counts(handle), handle.Calls)
    counts = (
        counts_call.Returned
        if counts_call.Raised is None and type(counts_call.Returned) is dict
        else {"Available": False}
    )
    if counts_call.Raised is not None:
        _bridge_failure(
            handle,
            Failure("Unexpected", "publish", "Counters", counts_call.Raised.Type),
        )
    summaries: list[Tree] = []
    for session, original in handle.SessionSummaries:
        summaries.append(deepcopy(original))
        try:
            if not _same(_session_summary(session), original):
                _fail(
                    "Conflict",
                    "publish",
                    "Session",
                    "public session changed after actual return; original summary retained",
                )
            if original["Closed"]:
                _check_session_seal(session)
        except _Stop as error:
            _bridge_failure(handle, error.failure)
        except Exception as error:  # noqa: BLE001 - DTO drift cannot prevent finalization.
            _bridge_failure(
                handle,
                Failure("Unexpected", "publish", "Session", type(error).__name__),
            )
    if len(summaries) != len(handle.Sessions):
        _bridge_failure(
            handle,
            Failure(
                "Storage",
                "publish",
                "SessionSummary",
                "actual session summary prefix is incomplete",
            ),
        )
    if handle.Store is not None and handle.Budget is not None:
        try:
            terminal = {
                "Schema": "zeta.mixed-epoch.bridge-result.v1",
                "ServiceSha256": None
                if handle.Manifest is None
                else handle.Manifest.Sha256,
                "Route": handle.Route,
                "Failure": _failure_tree(handle.Failure),
                "Sessions": summaries,
                "Counters": counts,
                "FullActualReturnRetention": "memory; records referenced without duplicate Store snapshots",
            }
            raw = _canonical(terminal, MIB, newline=True)
            call = _observe(
                "append_bytes/outer-terminal",
                lambda: records.append_bytes(handle.Store, "outer-terminal", raw),
                handle.Calls,
            )
            if call.Raised is not None or type(call.Returned) is not records.Stored:
                _fail(
                    "Storage",
                    "publish",
                    "OuterTerminal",
                    "actual once-only outer terminal publication refused",
                )
            handle.FinalRecord = call.Returned.Artifact
        except _Stop as error:
            _bridge_failure(handle, error.failure)
        except Exception as error:  # noqa: BLE001 - final publication cannot erase the earlier actual prefix.
            _bridge_failure(
                handle,
                Failure("Unexpected", "publish", "OuterTerminal", type(error).__name__),
            )
        finalized = _observe(
            "finalize", lambda: records.finalize(handle.Store), handle.Calls
        )
        handle.Finalization = finalized
        if (
            finalized.Raised is not None
            or type(finalized.Returned) is not records.Finalized
        ):
            _bridge_failure(
                handle,
                Failure(
                    "Storage",
                    "publish",
                    "FinalJournal",
                    "actual once-only finalization refused",
                ),
            )
    result = BridgeResult(
        handle.ManifestRaw,
        handle.ExpectedManifestSha256,
        None if handle.SourceRoot is None else str(handle.SourceRoot),
        None if handle.AttemptRoot is None else str(handle.AttemptRoot),
        handle.AttemptOwned,
        handle.Route,
        None if handle.Budget is None else handle.Budget.Reservation,
        tuple(handle.Sessions),
        tuple(handle.Calls),
        tuple(handle.Sources),
        handle.Preparation,
        handle.FinalRecord,
        handle.Finalization,
        handle.Failure,
        tuple(handle.SecondaryFailures),
        counts,
        handle.Failure is None and all(row["Closed"] for row in summaries),
        InitialPlanRaw=handle.InitialPlanRaw,
    )
    handle.Final = result
    return result


class Bridge:
    """Privately issued finite-route capability; it exposes no mutable state DTO."""

    __slots__ = ("__weakref__",)

    def __init__(self, issuer: object) -> None:
        if issuer is not _ISSUER:
            raise TypeError("use open_bridge")


_OWNERS: WeakKeyDictionary[Bridge, _Owner] = WeakKeyDictionary()


def open_bridge(
    source_root: Path,
    attempt_parent: Path,
    attempt_name: str,
    host: Path,
    manifest_raw: object,
    expected_manifest_sha256: object,
    first_plan_raw: object,
    *,
    route: str = "single",
) -> Bridge | BridgeResult:
    """Create one source-admitted finite route; no peer is launched during setup."""
    result = _open_bridge(
        source_root,
        attempt_parent,
        attempt_name,
        host,
        manifest_raw,
        expected_manifest_sha256,
        first_plan_raw,
        route=route,
    )
    if isinstance(result, BridgeResult):
        return result
    handle = Bridge(_ISSUER)
    _OWNERS[handle] = result
    return handle


def run_session(
    handle: Bridge,
    raw_plan: object,
    session_id: object,
    *,
    forecasts: tuple[ForecastSource, ...] = (),
) -> SessionResult | Failure:
    """Use one complete actual plan at the next fixed session, without retries."""
    if type(handle) is not Bridge or handle not in _OWNERS:
        return Failure(
            "Admission", "admit", "Handle", "actually issued bridge required"
        )
    return _run_session(_OWNERS[handle], raw_plan, session_id, forecasts=forecasts)


def finish_bridge(handle: Bridge) -> BridgeResult:
    """Finalize the actual owned Store once; all prior call outcomes stay retained."""
    if type(handle) is not Bridge or handle not in _OWNERS:
        return _finish_bridge(cast(Any, None))
    return _finish_bridge(_OWNERS[handle])


_SESSION_SEALS: WeakKeyDictionary[SessionResult, bytes] = WeakKeyDictionary()


def _session_seal(session: SessionResult) -> bytes:
    if (
        session.Plan is None
        or session.EpochReturn is None
        or session.Terminal is None
        or session.Peer is None
        or session.EpochReturnArtifact is None
        or session.EpochReturnAck is None
    ):
        _fail(
            "Service",
            "admit",
            "Session",
            "actual full closed session chain is unavailable",
        )
    plan = _plan(session.Plan.Raw, session.Plan.Value["SourceBindings"])
    if (
        not _same(plan.Value, session.Plan.Value)
        or plan.Sha256 != session.Plan.Sha256
        or not _same(plan.Operations, session.Plan.Operations)
    ):
        _fail(
            "Conflict", "admit", "Plan", "public plan DTO changed after raw admission"
        )
    for frame in (session.EpochReturn, session.Terminal):
        current = decode_frame(frame.Raw, session.SessionId)
        if (
            not isinstance(current, Frame)
            or current.Sha256 != frame.Sha256
            or not _same(current.Value, frame.Value)
        ):
            _fail(
                "Conflict",
                "admit",
                "Frame",
                "public result/terminal DTO changed after original-byte admission",
            )
    if session.EpochReturn.Value["ResultSha256"] != _sha(
        _canonical(session.EpochReturn.Value["Result"], 16 * MIB)
    ):
        _fail("Conflict", "admit", "ResultSha256", "actual result identity changed")
    peer = session.Peer
    return _canonical(
        {
            "SessionId": session.SessionId,
            "PlanSha256": plan.Sha256,
            "ReturnSha256": session.EpochReturn.Sha256,
            "TerminalSha256": session.Terminal.Sha256,
            "Artifact": session.EpochReturnArtifact.descriptor(),
            "Ack": {
                "Sha256": _sha(session.EpochReturnAck.Original),
                "WrittenBytes": session.EpochReturnAck.WrittenBytes,
                "Failure": _failure_tree(session.EpochReturnAck.Failure),
            },
            "Closed": session.Closed,
            "Eligible": session.ForecastEligible,
            "Failure": _failure_tree(session.Failure),
            "Peer": {
                "Argv": list(peer.Argv),
                "ChildPid": peer.ChildPid,
                "ExitCode": peer.ExitCode,
                "DirectChildClosed": peer.DirectChildClosed,
                "StdoutEof": peer.StdoutEof,
                "StderrEof": peer.StderrEof,
                "StdoutSha256": _sha(b"".join(peer.Stdout)),
                "StderrSha256": _sha(peer.Stderr),
            },
            "SourceBefore": None
            if session.SourceBefore is None
            else _source_summary(session.SourceBefore),
            "SourceAfter": None
            if session.SourceAfter is None
            else _source_summary(session.SourceAfter),
            "Incoming": [
                {"Bytes": len(raw), "Sha256": _sha(raw)} for raw in session.Incoming
            ],
            "Outgoing": [
                {"Bytes": len(raw), "Sha256": _sha(raw)} for raw in session.Outgoing
            ],
            "LastObservedCommitted": session.LastObservedCommitted,
            "ReturnAdmitted": session.ReturnAdmitted,
        },
        4 * MIB,
    )


def _check_session_seal(session: SessionResult) -> None:
    if (
        type(session) is not SessionResult
        or session not in _SESSION_SEALS
        or _session_seal(session) != _SESSION_SEALS[session]
    ):
        _fail(
            "Conflict",
            "admit",
            "Session",
            "source session is unissued or changed after actual closure",
        )
