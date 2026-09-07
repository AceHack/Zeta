"""Sequential exclusive retention, not operation execution or phase admission.

The combined raw-plus-stored reservation ceiling includes a reserved final
journal and its artifact slot. Identity encoding charges every byte twice.
Quotas bound retained/reserved output, not caller inputs or peak Python memory.
The caller trusts the loaded helpers, sequential access and stable input values;
an issued handle is not protection against hostile Python or filesystem changes.
"""

from __future__ import annotations

import hashlib
import re
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from pathlib import Path
from weakref import WeakSet

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_record_encoding as encoding
from . import hidden_switch_compiled_storage as storage

MAX_COMBINED_BYTES = 256 * 1024 * 1024
FINAL_JOURNAL_BYTES = 8 * 1024 * 1024
MAX_ARTIFACTS = 4096
_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}\Z")
_ROLE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._/-]{0,127}\Z")


@dataclass(frozen=True, slots=True)
class Limits:
    CombinedBytes: int = MAX_COMBINED_BYTES
    FinalJournalBytes: int = FINAL_JOURNAL_BYTES
    Artifacts: int = MAX_ARTIFACTS


DEFAULT_LIMITS = Limits()


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
class Artifact:
    File: str
    Bytes: int
    Sha256: str
    Encoding: str
    StoredBytes: int
    StoredSha256: str

    def descriptor(self) -> dict[str, object]:
        return {
            "File": self.File,
            "Bytes": self.Bytes,
            "Sha256": self.Sha256,
            "Encoding": self.Encoding,
            "StoredBytes": self.StoredBytes,
            "StoredSha256": self.StoredSha256,
        }


@dataclass(frozen=True, slots=True)
class Supplied:
    Kind: str
    Role: object
    Value: object


@dataclass(frozen=True, slots=True)
class RecordAttempt:
    Sequence: int
    File: str
    Supplied: Supplied
    Expected: Artifact | None = None
    Encoding: CallObservation | None = None
    Write: CallObservation | None = None
    Read: CallObservation | None = None
    ReservedRawBytes: int = 0
    ReservedStoredBytes: int = 0
    ReservedSlot: bool = False
    Failure: a.Refused | None = None


@dataclass(frozen=True, slots=True)
class Snapshot:
    Root: str
    AttemptName: str
    Creation: CallObservation
    Limits: Limits
    Artifacts: tuple[Artifact, ...]
    Attempts: tuple[RecordAttempt, ...]
    ReservedRawBytes: int
    ReservedStoredBytes: int
    ReservedSlots: int
    PrimaryFailure: a.Refused | None
    FinalizationStarted: bool
    FinalAttempt: RecordAttempt | None
    Scope: str = "sequential-artifact-retention-only"


@dataclass(slots=True)
class _State:
    root: Path
    name: str
    limits: Limits
    creation: CallObservation
    artifacts: list[Artifact] = field(default_factory=list)
    attempts: list[RecordAttempt] = field(default_factory=list)
    raw: int = 0
    stored: int = 0
    slots: int = 1
    primary: a.Refused | None = None
    finalizing: bool = False
    final_attempt: RecordAttempt | None = None


@dataclass(frozen=True, slots=True, eq=False, weakref_slot=True)
class Store:
    _state: _State


_ISSUED: WeakSet[Store] = WeakSet()


@dataclass(frozen=True, slots=True)
class Opened:
    Store: Store
    Snapshot: Snapshot


@dataclass(frozen=True, slots=True)
class OpenFailed:
    Failure: a.Refused
    Root: str | None
    AttemptName: str | None
    AttemptedPath: str | None
    Creation: CallObservation | None
    Ownership: str = "not-established"


@dataclass(frozen=True, slots=True)
class Stored:
    Artifact: Artifact
    Attempt: RecordAttempt
    Snapshot: Snapshot


@dataclass(frozen=True, slots=True)
class StoreFailed:
    Failure: a.Refused
    PrimaryFailure: a.Refused
    Supplied: Supplied
    Attempt: RecordAttempt | None
    Snapshot: Snapshot | None


@dataclass(frozen=True, slots=True)
class Finalized:
    Artifact: Artifact
    Attempt: RecordAttempt
    Before: Snapshot
    After: Snapshot


@dataclass(frozen=True, slots=True)
class FinalizationFailed:
    Failure: a.Refused
    PrimaryFailure: a.Refused | None
    Attempt: RecordAttempt | None
    Before: Snapshot | None
    After: Snapshot | None


def _observe(operation: str, call: Callable[[], object]) -> CallObservation:
    try:
        return CallObservation(operation, call(), None)
    except Exception as error:  # noqa: BLE001 - retain raised helper failures at this boundary
        kind = type(error)
        return CallObservation(
            operation,
            None,
            Raised(kind.__module__ + "." + kind.__qualname__, str(error)),
        )


def _returned(call: CallObservation, path: str) -> object:
    if call.Raised is not None:
        return a.Refused("store-helper-raised", path, call.Raised.Message)
    if not isinstance(call.Returned, (a.Admitted, a.Refused)):
        return a.Refused("store-helper-result", path, "helper returned no admission")
    return call.Returned


def _state(store: object) -> _State | None:
    if type(store) is Store and store in _ISSUED:
        return store._state
    return None


def _snapshot(state: _State) -> Snapshot:
    return Snapshot(
        str(state.root),
        state.name,
        state.creation,
        state.limits,
        tuple(state.artifacts),
        tuple(state.attempts),
        state.raw,
        state.stored,
        state.slots,
        state.primary,
        state.finalizing,
        state.final_attempt,
    )


def snapshot(store: object) -> a.Admission[Snapshot]:
    """Observe immutable ledger tuples; caller-owned values are not deep copied."""
    state = _state(store)
    if state is None:
        return a.Refused("store-handle", "Store", "an issued store is required")
    return a.Admitted(_snapshot(state))


def open_store(
    root: object, attempt_name: object, limits: object = DEFAULT_LIMITS
) -> Opened | OpenFailed:
    """Attempt one exclusive directory creation; never infer ownership on refusal."""
    known_root = str(root) if isinstance(root, Path) else None
    known_name = attempt_name if type(attempt_name) is str else None
    attempted = None
    refusal = None
    if (
        isinstance(root, Path)
        and root.is_absolute()
        and "\x00" not in str(root)
        and type(attempt_name) is str
        and _NAME.fullmatch(attempt_name) is not None
    ):
        attempted = str(root / attempt_name)
    if not isinstance(root, Path) or not root.is_absolute() or "\x00" in str(root):
        refusal = a.Refused(
            "store-root", "Root", "absolute caller-admitted Path required"
        )
    elif type(attempt_name) is not str or _NAME.fullmatch(attempt_name) is None:
        refusal = a.Refused(
            "store-name", "AttemptName", "one bounded path component required"
        )
    elif (
        type(limits) is not Limits
        or any(
            type(value) is not int
            for value in (
                limits.CombinedBytes,
                limits.FinalJournalBytes,
                limits.Artifacts,
            )
        )
        or not (
            2 <= limits.FinalJournalBytes <= FINAL_JOURNAL_BYTES
            and limits.FinalJournalBytes <= limits.CombinedBytes <= MAX_COMBINED_BYTES
            and limits.FinalJournalBytes % 2 == 0
            and limits.CombinedBytes % 2 == 0
            and 1 <= limits.Artifacts <= MAX_ARTIFACTS
        )
    ):
        refusal = a.Refused(
            "store-limits",
            "Limits",
            "finite even byte budgets and reserved slot required",
        )
    if refusal is not None:
        return OpenFailed(refusal, known_root, known_name, attempted, None)
    assert (
        isinstance(root, Path)
        and isinstance(attempt_name, str)
        and isinstance(limits, Limits)
    )
    attempted = str(root / attempt_name)
    call = _observe(
        "create_directory", lambda: storage.create_directory(root, attempt_name)
    )
    result = _returned(call, attempted)
    if isinstance(result, a.Refused):
        return OpenFailed(result, known_root, known_name, attempted, call)
    if not isinstance(result, a.Admitted) or result.value != attempt_name:
        return OpenFailed(
            a.Refused("store-created-name", attempted, "unexpected creation return"),
            known_root,
            known_name,
            attempted,
            call,
        )
    half = limits.FinalJournalBytes // 2
    state = _State(root, attempt_name, limits, call, raw=half, stored=half)
    store = Store(state)
    _ISSUED.add(store)
    return Opened(store, _snapshot(state))


def _artifact(path: str, raw: bytes) -> Artifact:
    digest = hashlib.sha256(raw).hexdigest().upper()
    return Artifact(path, len(raw), digest, "identity", len(raw), digest)


def _save(state: _State, attempt: RecordAttempt, raw: bytes) -> RecordAttempt:
    """Reservation is already charged before this first fallible write."""
    expected = attempt.Expected
    assert expected is not None
    write = _observe(
        "write_exclusive",
        lambda: storage.write_exclusive(state.root, attempt.File, raw),
    )
    attempt = replace(attempt, Write=write)
    result = _returned(write, attempt.File)
    if isinstance(result, a.Refused):
        return replace(attempt, Failure=result)
    if (
        not isinstance(result, a.Admitted)
        or type(result.value) is not int
        or result.value != len(raw)
    ):
        return replace(
            attempt,
            Failure=a.Refused(
                "store-write-count",
                attempt.File,
                "write return differs from exact reservation",
            ),
        )
    read = _observe(
        "read_artifact",
        lambda: storage.read_artifact(
            state.root,
            expected.descriptor(),
            maximum_stored_bytes=len(raw),
            maximum_original_bytes=len(raw),
        ),
    )
    attempt = replace(attempt, Read=read)
    result = _returned(read, attempt.File)
    if isinstance(result, a.Refused):
        return replace(attempt, Failure=result)
    if (
        not isinstance(result, a.Admitted)
        or type(result.value) is not bytes
        or result.value != raw
    ):
        return replace(
            attempt,
            Failure=a.Refused(
                "store-read-back",
                attempt.File,
                "read return differs from exact input bytes",
            ),
        )
    state.artifacts.append(expected)
    return attempt


def _append(store: object, supplied: Supplied) -> Stored | StoreFailed:
    state = _state(store)
    if state is None:
        failure = a.Refused("store-handle", "Store", "an issued store is required")
        return StoreFailed(failure, failure, supplied, None, None)
    if state.primary is not None or state.finalizing:
        failure = a.Refused("store-stopped", state.name, "normal writes have stopped")
        return StoreFailed(
            failure, state.primary or failure, supplied, None, _snapshot(state)
        )
    index = len(state.attempts)
    suffix = "json" if supplied.Kind == "result" else "bin"
    attempt = RecordAttempt(
        index, f"{state.name}/record-{index:06d}.{suffix}", supplied
    )
    remaining = state.limits.CombinedBytes - state.raw - state.stored
    raw = (
        supplied.Value
        if supplied.Kind == "bytes" and type(supplied.Value) is bytes
        else None
    )
    if raw is not None:
        attempt = replace(attempt, Expected=_artifact(attempt.File, raw))
    if state.slots >= state.limits.Artifacts:
        attempt = replace(
            attempt,
            Failure=a.Refused(
                "store-artifact-bound",
                attempt.File,
                "reserved final slot cannot fund normal writes",
            ),
        )
    else:
        state.slots += 1
        attempt = replace(attempt, ReservedSlot=True)
        if type(supplied.Role) is not str or _ROLE.fullmatch(supplied.Role) is None:
            attempt = replace(
                attempt,
                Failure=a.Refused(
                    "store-role", attempt.File, "bounded role text required"
                ),
            )
        elif supplied.Kind == "result":
            if remaining < 2:
                attempt = replace(
                    attempt,
                    Failure=a.Refused(
                        "store-byte-bound",
                        attempt.File,
                        "no normal encoding quota remains",
                    ),
                )
            else:
                call = _observe(
                    "encode_public_result",
                    lambda: encoding.encode_public_result(
                        supplied.Value, maximum_bytes=remaining // 2
                    ),
                )
                attempt = replace(attempt, Encoding=call)
                result = _returned(call, attempt.File)
                if isinstance(result, a.Refused):
                    attempt = replace(attempt, Failure=result)
                elif (
                    not isinstance(result, a.Admitted)
                    or type(result.value) is not bytes
                ):
                    attempt = replace(
                        attempt,
                        Failure=a.Refused(
                            "store-encoded-bytes",
                            attempt.File,
                            "encoder returned no exact bytes",
                        ),
                    )
                else:
                    raw = result.value
                    attempt = replace(attempt, Expected=_artifact(attempt.File, raw))
        elif type(supplied.Value) is not bytes:
            attempt = replace(
                attempt,
                Failure=a.Refused("store-bytes", attempt.File, "exact bytes required"),
            )
        else:
            raw = supplied.Value
            attempt = replace(attempt, Expected=_artifact(attempt.File, raw))
    if attempt.Failure is None:
        assert attempt.Expected is not None
        count = attempt.Expected.Bytes
        if 2 * count > remaining:
            attempt = replace(
                attempt,
                Failure=a.Refused(
                    "store-byte-bound",
                    attempt.File,
                    "raw plus stored bytes exceed remaining normal quota",
                ),
            )
        else:
            state.raw += count
            state.stored += count
            attempt = replace(
                attempt, ReservedRawBytes=count, ReservedStoredBytes=count
            )
            assert type(raw) is bytes
            attempt = _save(state, attempt, raw)
    state.attempts.append(attempt)
    if attempt.Failure is not None:
        state.primary = attempt.Failure
        return StoreFailed(
            attempt.Failure, state.primary, supplied, attempt, _snapshot(state)
        )
    assert attempt.Expected is not None
    return Stored(attempt.Expected, attempt, _snapshot(state))


def append_bytes(store: object, role: object, raw: object) -> Stored | StoreFailed:
    return _append(store, Supplied("bytes", role, raw))


def append_result(
    store: object, role: object, actual_result: object
) -> Stored | StoreFailed:
    """Retain a supplied actual return; serialization never executes its operation."""
    return _append(store, Supplied("result", role, actual_result))


def _byte_observation(call: CallObservation | None) -> object:
    if (
        call is None
        or call.Raised is not None
        or not isinstance(call.Returned, a.Admitted)
    ):
        return call
    raw = call.Returned.value
    if type(raw) is not bytes:
        return call
    return {
        "Operation": call.Operation,
        "Kind": "admitted-byte-observation",
        "Bytes": len(raw),
        "Sha256": hashlib.sha256(raw).hexdigest().upper(),
    }


def _journal(before: Snapshot) -> dict[str, object]:
    return {
        "Schema": "zeta.hidden-switch.compiled.record-store-journal.v1",
        "Scope": "metadata snapshot before final encoding/write/read; no execution or whole-envelope admission",
        "Root": before.Root,
        "AttemptName": before.AttemptName,
        "Creation": before.Creation,
        "Limits": before.Limits,
        "Artifacts": tuple(row.descriptor() for row in before.Artifacts),
        "ReservedRawBytes": before.ReservedRawBytes,
        "ReservedStoredBytes": before.ReservedStoredBytes,
        "ReservedSlots": before.ReservedSlots,
        "PrimaryFailure": before.PrimaryFailure,
        "Attempts": tuple(
            {
                "Sequence": row.Sequence,
                "File": row.File,
                "Kind": row.Supplied.Kind,
                "Role": row.Supplied.Role
                if type(row.Supplied.Role) is str and len(row.Supplied.Role) <= 128
                else None,
                "Expected": row.Expected.descriptor()
                if row.Expected is not None
                else None,
                "EncodingObservation": _byte_observation(row.Encoding),
                "Write": row.Write,
                "ReadObservation": _byte_observation(row.Read),
                "ReservedRawBytes": row.ReservedRawBytes,
                "ReservedStoredBytes": row.ReservedStoredBytes,
                "ReservedSlot": row.ReservedSlot,
                "Failure": row.Failure,
                "SuppliedValueRetention": "exact value remains in public return; durable serialization only if its artifact was admitted",
            }
            for row in before.Attempts
        ),
    }


def finalize(store: object) -> Finalized | FinalizationFailed:
    """Use the reserved slot/budget once, even after failure; never rewrite it."""
    state = _state(store)
    if state is None:
        return FinalizationFailed(
            a.Refused("store-handle", "Store", "an issued store is required"),
            None,
            None,
            None,
            None,
        )
    before = _snapshot(state)
    if state.finalizing:
        return FinalizationFailed(
            a.Refused(
                "store-finalized", state.name, "finalization was already attempted"
            ),
            state.primary,
            state.final_attempt,
            before,
            before,
        )
    state.finalizing = True
    maximum = state.limits.FinalJournalBytes // 2
    body = _journal(before)
    attempt = RecordAttempt(
        len(state.attempts),
        f"{state.name}/final-journal.json",
        Supplied("journal", "final-journal", body),
        ReservedRawBytes=maximum,
        ReservedStoredBytes=maximum,
        ReservedSlot=True,
    )
    call = _observe(
        "encode_public_result",
        lambda: encoding.encode_public_result(body, maximum_bytes=maximum),
    )
    attempt = replace(attempt, Encoding=call)
    result = _returned(call, attempt.File)
    if isinstance(result, a.Refused):
        attempt = replace(attempt, Failure=result)
    elif not isinstance(result, a.Admitted) or type(result.value) is not bytes:
        attempt = replace(
            attempt,
            Failure=a.Refused(
                "store-encoded-bytes", attempt.File, "encoder returned no exact bytes"
            ),
        )
    else:
        raw = result.value
        attempt = replace(attempt, Expected=_artifact(attempt.File, raw))
        if len(raw) > maximum:
            attempt = replace(
                attempt,
                Failure=a.Refused(
                    "store-journal-bound",
                    attempt.File,
                    "encoder exceeded reserved journal quota",
                ),
            )
        else:
            attempt = _save(state, attempt, raw)
    state.final_attempt = attempt
    if attempt.Failure is not None:
        return FinalizationFailed(
            attempt.Failure, state.primary, attempt, before, _snapshot(state)
        )
    assert attempt.Expected is not None
    return Finalized(attempt.Expected, attempt, before, _snapshot(state))
