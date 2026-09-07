"""Seven owned filesystem fixtures with actual results and retained observations.

Setup and before/after observations are separate from counted storage calls.
No failed output is deleted or reused. Explicit fault hooks touch only the
owned target file and delegate other descriptors. This module supplies no
scientific output, runtime admission or complete coordinator envelope.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import stat
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_conformance as c
from . import hidden_switch_compiled_storage as storage

FILE_CASE_IDS = (
    "artifact/symlink-path",
    "artifact/truncated-gzip",
    "storage/control",
    "storage/reused-attempt",
    "storage/reused-file",
    "storage/partial-write",
    "storage/changed-read",
)
MAX_FILE_BYTES = 256
MAX_FIXTURE_BYTES = 1024 * 1024
_FAULT_LOCK = threading.Lock()


def _close_mutation_descriptor(descriptor: int) -> None:
    """One owned close; separate seam for real-close-then-error validation."""
    os.close(descriptor)


@dataclass(frozen=True, slots=True)
class FileState:
    File: str
    Kind: str
    Device: int | None = None
    Inode: int | None = None
    Mode: int | None = None
    Bytes: int | None = None
    ModifiedNs: int | None = None
    ChangedNs: int | None = None
    Content: bytes | None = None
    SymlinkTarget: str | None = None


@dataclass(frozen=True, slots=True)
class SetupObservation:
    Operation: str
    ActualResult: object
    State: object | None = None


@dataclass(frozen=True, slots=True)
class PreparedFileFixture:
    CaseId: str
    Root: Path
    Target: str
    Setup: tuple[SetupObservation, ...]
    Descriptor: bytes | None


@dataclass(frozen=True, slots=True)
class FileFixtureFailed:
    Code: str
    Stage: str
    Root: str | None
    Setup: tuple[SetupObservation, ...]
    Detail: object


@dataclass(frozen=True, slots=True)
class FaultObservation:
    Kind: str
    Device: int
    Inode: int
    Bytes: int | None = None
    Detail: str | None = None


@dataclass(frozen=True, slots=True)
class FileCallObservation:
    CaseId: str
    Index: int
    Operation: str
    InputRoles: tuple[str, ...]
    CompletedOperation: int
    ActualResult: object | None
    Before: object | None
    After: object | None
    Faults: tuple[FaultObservation, ...]
    Failure: a.Refused | None
    UnexpectedReturn: object | None = None


def _raw(value: Any) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode()


def _digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest().upper()


def _identity(info: os.stat_result) -> tuple[int, int, int, int, int, int]:
    return (
        info.st_dev,
        info.st_ino,
        info.st_mode,
        info.st_size,
        info.st_mtime_ns,
        info.st_ctime_ns,
    )


def observe_file(root: Path, relative: str) -> a.Admission[FileState]:
    """Read only a bounded owned leaf; preserve symlinks without following them."""
    checked = a.relative_artifact_path(relative, "File")
    if isinstance(checked, a.Refused):
        return checked
    path = root / relative
    try:
        before = path.lstat()
    except FileNotFoundError:
        return a.Admitted(FileState(relative, "absent"))
    except (OSError, ValueError) as error:
        return a.Refused("fixture-observation", relative, str(error))
    try:
        content = None
        link = None
        if stat.S_ISREG(before.st_mode):
            raw = storage.read_exact(
                root,
                relative,
                expected_bytes=before.st_size,
                maximum_bytes=MAX_FILE_BYTES,
            )
            if isinstance(raw, a.Refused):
                return raw
            content = raw.value
            kind = "regular"
        elif stat.S_ISLNK(before.st_mode):
            if before.st_size > MAX_FILE_BYTES:
                return a.Refused(
                    "fixture-link-bound",
                    relative,
                    "symlink exceeds fixed fixture bound",
                )
            link = os.readlink(path)
            if len(link.encode("utf-8", errors="strict")) > MAX_FILE_BYTES:
                return a.Refused(
                    "fixture-link-bound", relative, "observed symlink exceeds bound"
                )
            kind = "symlink"
        elif stat.S_ISDIR(before.st_mode):
            kind = "directory"
        else:
            return a.Refused(
                "fixture-file-kind", relative, "unexpected nonregular fixture leaf"
            )
        if _identity(before) != _identity(path.lstat()):
            return a.Refused(
                "fixture-observation-changed",
                relative,
                "leaf changed across observation",
            )
        return a.Admitted(
            FileState(
                relative,
                kind,
                before.st_dev,
                before.st_ino,
                before.st_mode,
                before.st_size,
                before.st_mtime_ns,
                before.st_ctime_ns,
                content,
                link,
            )
        )
    except (OSError, ValueError, UnicodeError) as error:
        return a.Refused("fixture-observation", relative, str(error))


def prepare_file_fixture(
    case_id: object, case_root: Path
) -> PreparedFileFixture | FileFixtureFailed:
    """Create one absent owned root and preserve separately counted setup calls."""
    setup: list[SetupObservation] = []

    def failed(stage: str, detail: object) -> FileFixtureFailed:
        return FileFixtureFailed(
            "file-fixture-setup",
            stage,
            str(case_root) if isinstance(case_root, Path) else None,
            tuple(setup),
            detail,
        )

    if type(case_id) is not str or case_id not in FILE_CASE_IDS:
        return failed(
            "case",
            a.Refused("fixture-case", "CaseId", "requires one of seven file cases"),
        )
    if (
        not isinstance(case_root, Path)
        or not case_root.is_absolute()
        or case_root.name in ("", ".", "..")
    ):
        return failed(
            "root",
            a.Refused("fixture-root", "Root", "requires absolute absent owned root"),
        )
    try:
        if case_root.parent.resolve(strict=True) != case_root.parent:
            return failed(
                "root",
                a.Refused("fixture-root", "Root", "parent must already be canonical"),
            )
    except (OSError, ValueError, RuntimeError) as error:
        return failed("root", a.Refused("fixture-root", "Root", str(error)))
    created = storage.create_directory(case_root.parent, case_root.name)
    setup.append(SetupObservation("create-fixture-root", created))
    if isinstance(created, a.Refused):
        return failed("create-fixture-root", created)
    target = (
        "attempt"
        if case_id == "storage/reused-attempt"
        else "attempt/file.bin"
        if case_id == "storage/control"
        else "file.bin"
    )
    descriptor = None
    writes: list[tuple[str, bytes]] = []
    if case_id == "storage/changed-read":
        writes.append((target, b"original"))
    elif case_id.startswith("artifact/"):
        original = b"ABC"
        stored = (
            original
            if case_id.endswith("symlink-path")
            else gzip.compress(original, mtime=0)[:-1]
        )
        descriptor = _raw(
            {
                "File": target,
                "Bytes": len(original),
                "Sha256": _digest(original),
                "Encoding": "identity" if case_id.endswith("symlink-path") else "gzip",
                "StoredBytes": len(stored),
                "StoredSha256": _digest(stored),
            }
        )
        writes.append(
            ("sibling.bin" if case_id.endswith("symlink-path") else target, stored)
        )
    for relative, raw in writes:
        written = storage.write_exclusive(case_root, relative, raw)
        # Save the actual write before any fallible after-observation.
        setup.append(SetupObservation("write-fixture-input", written))
        if isinstance(written, a.Refused):
            return failed("write-fixture-input", written)
        state = observe_file(case_root, relative)
        setup.append(SetupObservation("observe-fixture-input", state))
        if isinstance(state, a.Refused):
            return failed("observe-fixture-input", state)
    if case_id == "artifact/symlink-path":
        try:
            (case_root / target).symlink_to("sibling.bin")
            linked: a.Admission[str] = a.Admitted("sibling.bin")
        except (OSError, ValueError) as error:
            linked = a.Refused("fixture-symlink", target, str(error))
        setup.append(SetupObservation("create-owned-symlink", linked))
        if isinstance(linked, a.Refused):
            return failed("create-owned-symlink", linked)
    return PreparedFileFixture(case_id, case_root, target, tuple(setup), descriptor)


class _Faults:
    """One serial fixture; unrelated descriptors always keep their real behavior."""

    def __init__(self, fixture: PreparedFileFixture, index: int):
        self.fixture = fixture
        self.index = index
        self.write = os.write
        self.fstat = os.fstat
        self.events: list[FaultObservation] = []
        self.used = False
        self.owned: tuple[int, int, int] | None = None

    def target(self, fd: int) -> os.stat_result | None:
        info = self.fstat(fd)
        try:
            leaf = (self.fixture.Root / self.fixture.Target).lstat()
        except FileNotFoundError:
            return None
        identity = (fd, info.st_dev, info.st_ino)
        if (
            stat.S_ISREG(info.st_mode)
            and (info.st_dev, info.st_ino) == (leaf.st_dev, leaf.st_ino)
            and (self.owned is None or self.owned == identity)
        ):
            self.owned = identity
            return info
        return None

    def interrupted_write(self, fd: int, raw: Any) -> int:
        info = self.target(fd)
        if info is None:
            return self.write(fd, raw)
        if not self.used:
            self.used = True
            written = self.write(fd, raw[:3])
            self.events.append(
                FaultObservation(
                    "actual-prefix-write", info.st_dev, info.st_ino, written
                )
            )
            if written != 3:
                raise OSError(
                    "fixture prefix write did not produce exactly three bytes"
                )
            return written
        self.events.append(
            FaultObservation(
                "injected-write-failure",
                info.st_dev,
                info.st_ino,
                Detail="after actual ori prefix",
            )
        )
        raise OSError("injected owned-file write failure after ori")

    def changed_metadata(self, fd: int) -> os.stat_result:
        observed = self.fstat(fd)
        info = self.target(fd)
        if info is None or self.used:
            return observed
        self.used = True
        self.events.append(
            FaultObservation(
                "before-mutation-fstat", info.st_dev, info.st_ino, observed.st_size
            )
        )
        mutation_fd = os.open(
            self.fixture.Root / self.fixture.Target, os.O_WRONLY | os.O_NOFOLLOW
        )
        mutation_completed = False
        try:
            mutation_info = self.fstat(mutation_fd)
            if (mutation_info.st_dev, mutation_info.st_ino) != (
                info.st_dev,
                info.st_ino,
            ):
                raise OSError("owned mutation descriptor identity differs")
            written = self.write(mutation_fd, b"ORIGINAL")
            self.events.append(
                FaultObservation(
                    "actual-same-length-mutation", info.st_dev, info.st_ino, written
                )
            )
            if written != 8:
                raise OSError("owned mutation did not write eight bytes")
            os.fsync(mutation_fd)
            mutation_completed = True
        except OSError as error:
            self.events.append(
                FaultObservation(
                    "mutation-primary-failure",
                    info.st_dev,
                    info.st_ino,
                    Detail=str(error),
                )
            )
            raise
        finally:
            try:
                _close_mutation_descriptor(mutation_fd)
            except OSError as error:
                self.events.append(
                    FaultObservation(
                        "mutation-cleanup-failure",
                        info.st_dev,
                        info.st_ino,
                        Detail=str(error),
                    )
                )
                # An active mutation exception continues unchanged. A close-only
                # failure still refuses. Never retry this uncertain close.
                if mutation_completed:
                    raise
        return observed


def _invoke(fixture: PreparedFileFixture, index: int) -> object:
    case_id, root = fixture.CaseId, fixture.Root
    if case_id.startswith("artifact/"):
        assert fixture.Descriptor is not None
        descriptor = a.strict_json(fixture.Descriptor)
        if isinstance(descriptor, a.Refused):
            return descriptor
        return storage.read_artifact(
            root,
            descriptor.value,
            maximum_stored_bytes=MAX_FILE_BYTES,
            maximum_original_bytes=MAX_FILE_BYTES,
        )
    if (
        case_id == "storage/reused-attempt"
        or case_id == "storage/control"
        and index == 0
    ):
        return storage.create_directory(root, "attempt")
    if case_id == "storage/changed-read":
        return storage.read_exact(
            root, fixture.Target, expected_bytes=8, maximum_bytes=MAX_FILE_BYTES
        )
    return storage.write_exclusive(
        root,
        fixture.Target,
        b"replacement"
        if index == 1 and case_id in ("storage/reused-file", "storage/partial-write")
        else b"original",
    )


def execute_file_call(
    fixture: PreparedFileFixture, call_index: object
) -> FileCallObservation | a.Refused:
    """Return the actual call first, preserving it through any later audit failure."""
    if type(fixture) is not PreparedFileFixture or fixture.CaseId not in FILE_CASE_IDS:
        return a.Refused(
            "fixture-case", "CaseId", "requires a prepared owned file fixture"
        )
    spec = next(row for row in c.case_specs() if row.CaseId == fixture.CaseId)
    checked = a.integer(call_index, 0, len(spec.Calls) - 1, "CallIndex")
    if isinstance(checked, a.Refused):
        return checked
    index = checked.value
    operation = spec.Calls[index]
    target = "attempt" if operation.Operation == "create-directory" else fixture.Target
    before = observe_file(fixture.Root, target)
    actual: object | None = None
    unexpected: object | None = None
    completed = 0
    failure: a.Refused | None = before if isinstance(before, a.Refused) else None
    after: object | None = None
    faults = _Faults(fixture, index)
    inject = index == 0 and fixture.CaseId in (
        "storage/partial-write",
        "storage/changed-read",
    )
    locked = False
    if failure is None and inject:
        locked = _FAULT_LOCK.acquire(blocking=False)
        if not locked:
            failure = a.Refused(
                "fixture-fault-busy", "Fault", "another fixture owns process hooks"
            )
    if failure is None:
        try:
            if inject and fixture.CaseId == "storage/partial-write":
                os.write = faults.interrupted_write
            elif inject:
                os.fstat = faults.changed_metadata
            returned = _invoke(fixture, index)
            if isinstance(returned, (a.Admitted, a.Refused)):
                # Preserve before after-observation and hook restoration can fail.
                actual = returned
                completed = 1
            else:
                unexpected = returned
                failure = a.Refused(
                    "fixture-operation-return",
                    operation.Operation,
                    "storage API did not return its typed public result",
                )
        except (OSError, ValueError, RuntimeError) as error:
            failure = a.Refused(
                "fixture-operation-crash", operation.Operation, str(error)
            )
        finally:
            if inject:
                try:
                    os.write = faults.write
                    os.fstat = faults.fstat
                except (AttributeError, RuntimeError) as error:
                    if failure is None:
                        failure = a.Refused(
                            "fixture-hook-restoration", "Fault", str(error)
                        )
                finally:
                    if locked:
                        _FAULT_LOCK.release()
        after = observe_file(fixture.Root, target)
        if isinstance(after, a.Refused) and failure is None:
            failure = after
    return FileCallObservation(
        fixture.CaseId,
        index,
        operation.Operation,
        operation.InputRoles,
        completed,
        actual,
        before,
        after,
        tuple(faults.events),
        failure,
        unexpected,
    )


def file_fixture_inputs(
    fixture: PreparedFileFixture, observations: tuple[FileCallObservation, ...]
) -> a.Admission[tuple[c.NamedInput, ...]]:
    """Finalize immutable input/audit bytes only after the actual observations exist.

    Callers retain each actual result as soon as it returns. A failed prefix can
    still be finalized here; this function does not promote that prefix or check
    the intended outcomes. Raw OS facts remain unnormalized in the fixture.
    """
    if type(fixture) is not PreparedFileFixture or fixture.CaseId not in FILE_CASE_IDS:
        return a.Refused("fixture-case", "CaseId", "requires a prepared file fixture")
    spec = next(row for row in c.case_specs() if row.CaseId == fixture.CaseId)
    if type(observations) is not tuple or len(observations) > len(spec.Calls):
        return a.Refused(
            "fixture-observations", "Observations", "requires bounded actual prefix"
        )
    for index, row in enumerate(observations):
        expected = spec.Calls[index]
        if (
            type(row) is not FileCallObservation
            or type(row.Index) is not int
            or row.Index != index
            or row.CaseId != fixture.CaseId
            or (row.Operation, row.InputRoles)
            != (expected.Operation, expected.InputRoles)
        ):
            return a.Refused(
                "fixture-observations", "Observations", "wrong case/operation order"
            )
        if (
            type(row.CompletedOperation) is not int
            or row.CompletedOperation not in (0, 1)
            or (row.ActualResult is None) != (row.CompletedOperation == 0)
        ):
            return a.Refused(
                "fixture-observations",
                "Observations",
                "actual returned result/count differ",
            )
        if (row.Failure is not None or row.CompletedOperation == 0) and index != len(
            observations
        ) - 1:
            return a.Refused(
                "fixture-observations",
                "Observations",
                "no later operation after fixture failure",
            )
    encoded = c.result_tree({"Setup": fixture.Setup, "Observations": observations})
    if isinstance(encoded, a.Refused):
        return encoded
    raw = _raw(
        {
            "Schema": "zeta.hidden-switch.compiled.file-fixture.v1",
            "CaseId": fixture.CaseId,
            "Root": str(fixture.Root),
            "Target": fixture.Target,
            "Audit": encoded.value,
        }
    )
    if len(raw) > MAX_FIXTURE_BYTES:
        return a.Refused(
            "fixture-output-bound",
            "Fixture",
            "actual encoded fixture exceeds fixed byte quota",
        )
    values = {
        "fixture": raw,
        "original": b"original",
        "replacement": b"replacement",
        "expected": _raw({"Bytes": 8, "Sha256": _digest(b"original")}),
    }
    if fixture.Descriptor is not None:
        values["descriptor"] = fixture.Descriptor
    return a.Admitted(
        tuple(c.NamedInput(role, values[role]) for role in spec.InputRoles)
    )
