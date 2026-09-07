from __future__ import annotations

import dataclasses
import hashlib
import json
import os
import stat
from pathlib import Path

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_record_encoding as encoding
from zeta_interp import hidden_switch_compiled_record_store as r
from zeta_interp import hidden_switch_compiled_storage as storage


def opened(tmp_path: Path, limits: r.Limits = r.DEFAULT_LIMITS) -> r.Store:
    value = r.open_store(tmp_path, "owned-attempt", limits)
    assert isinstance(value, r.Opened), value
    return value.Store


def view(store: r.Store) -> r.Snapshot:
    value = r.snapshot(store)
    assert isinstance(value, a.Admitted)
    return value.value


@dataclasses.dataclass(frozen=True)
class ActualReturn:
    Complete: bool
    Count: int
    Raw: bytes


def test_exact_result_retention_and_pre_final_snapshot(tmp_path: Path) -> None:
    store = opened(tmp_path)
    initial = view(store)
    assert initial.ReservedRawBytes == initial.ReservedStoredBytes == 4 * 1024 * 1024
    assert initial.ReservedSlots == 1
    actual = ActualReturn(False, 3, b"\x00\xff")
    saved = r.append_result(store, "actual/return", actual)
    assert isinstance(saved, r.Stored)
    assert saved.Attempt.Supplied.Value is actual
    assert saved.Attempt.Encoding is not None and saved.Attempt.Write is not None
    assert saved.Attempt.Read is not None
    assert isinstance(saved.Attempt.Write.Returned, a.Admitted)
    assert isinstance(saved.Attempt.Read.Returned, a.Admitted)
    raw = (tmp_path / saved.Artifact.File).read_bytes()
    assert saved.Attempt.Read.Returned.value == raw
    assert json.loads(raw) == {
        "Type": __name__ + ".ActualReturn",
        "Fields": {"Complete": False, "Count": 3, "Raw": {"BytesHex": "00FF"}},
    }
    assert saved.Artifact.Bytes == saved.Artifact.StoredBytes == len(raw)
    assert saved.Artifact.Sha256 == hashlib.sha256(raw).hexdigest().upper()
    assert initial.Artifacts == () and initial.Attempts == ()
    final = r.finalize(store)
    assert isinstance(final, r.Finalized), final
    assert final.Before.FinalAttempt is None and not final.Before.FinalizationStarted
    assert final.After.FinalizationStarted
    assert len(final.Before.Artifacts) == 1 and len(final.After.Artifacts) == 2
    assert final.After.ReservedSlots == 2
    journal = json.loads((tmp_path / final.Artifact.File).read_bytes())
    assert journal["Artifacts"] == [saved.Artifact.descriptor()]
    assert len(journal["Attempts"]) == 1
    assert "FinalAttempt" not in journal
    assert journal["Attempts"][0]["ReadObservation"]["Sha256"] == saved.Artifact.Sha256
    assert journal["Attempts"][0]["Expected"] == saved.Artifact.descriptor()
    assert final.After.ReservedRawBytes == final.Before.ReservedRawBytes
    changed = saved.Artifact.descriptor()
    changed["Bytes"] = 1
    assert saved.Artifact.Bytes == len(raw)


def test_raw_files_are_exact_and_bypass_result_encoder(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = opened(tmp_path)
    monkeypatch.setattr(
        encoding,
        "encode_public_result",
        lambda *args, **kwargs: pytest.fail("raw bytes must not be encoded"),
    )
    first = r.append_bytes(store, "first", b"first\x00\xfe")
    second = r.append_bytes(store, "second", b"second")
    assert isinstance(first, r.Stored) and isinstance(second, r.Stored)
    assert first.Artifact.File.endswith("record-000000.bin")
    assert second.Artifact.File.endswith("record-000001.bin")
    assert (tmp_path / first.Artifact.File).read_bytes() == b"first\x00\xfe"
    assert first.Attempt.Encoding is None
    assert first.Attempt.ReservedRawBytes == first.Attempt.ReservedStoredBytes == 7


def test_combined_quota_charges_both_copies_and_preserves_late_return(
    tmp_path: Path,
) -> None:
    store = opened(tmp_path, r.Limits(52, 20, 4))
    first = r.append_bytes(store, "first", b"x" * 16)
    assert isinstance(first, r.Stored)
    assert first.Snapshot.ReservedRawBytes + first.Snapshot.ReservedStoredBytes == 52
    actual = ActualReturn(True, 9, b"already-returned")
    refused = r.append_result(store, "late", actual)
    assert isinstance(refused, r.StoreFailed)
    assert refused.Failure.code == "store-byte-bound"
    assert refused.Supplied.Value is actual
    assert refused.Attempt is not None and refused.Attempt.Encoding is None
    assert refused.Snapshot is not None and refused.Snapshot.Artifacts == (
        first.Artifact,
    )
    assert (
        refused.Snapshot.ReservedRawBytes + refused.Snapshot.ReservedStoredBytes == 52
    )
    assert not (tmp_path / refused.Attempt.File).exists()
    final = r.finalize(store)
    assert isinstance(final, r.FinalizationFailed)
    assert final.PrimaryFailure is refused.PrimaryFailure
    assert final.Failure.code == "record-byte-bound"
    assert final.After is not None and final.After.ReservedRawBytes == 26


def test_encoder_receives_remaining_quota_before_expansion(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = opened(tmp_path, r.Limits(1024, 512, 10))
    target = encoding.encode_public_result
    seen: list[int] = []

    def encode(value: object, *, maximum_bytes: object) -> object:
        assert type(maximum_bytes) is int
        seen.append(maximum_bytes)
        return target(value, maximum_bytes=maximum_bytes)

    monkeypatch.setattr(encoding, "encode_public_result", encode)
    actual = b"\xff" * 256
    result = r.append_result(store, "expanded", actual)
    assert isinstance(result, r.StoreFailed)
    assert seen == [256]
    assert result.Failure.code == "record-byte-bound"
    assert result.Supplied.Value is actual
    assert result.Attempt is not None and result.Attempt.Encoding is not None
    assert isinstance(result.Attempt.Encoding.Returned, a.Refused)
    assert result.Attempt.Write is None
    assert view(store).ReservedRawBytes + view(store).ReservedStoredBytes == 512


def test_reserved_final_slot_cannot_be_consumed_by_empty_normal_files(
    tmp_path: Path,
) -> None:
    store = opened(tmp_path, r.Limits(32768, 24576, 2))
    first = r.append_bytes(store, "empty", b"")
    assert isinstance(first, r.Stored)
    failed = r.append_bytes(store, "too-many", b"")
    assert isinstance(failed, r.StoreFailed)
    assert failed.Failure.code == "store-artifact-bound"
    assert failed.Attempt is not None and not failed.Attempt.ReservedSlot
    assert view(store).ReservedSlots == 2
    final = r.finalize(store)
    assert isinstance(final, r.Finalized), final
    assert len(final.After.Artifacts) == 2 and final.After.ReservedSlots == 2
    assert final.After.ReservedRawBytes + final.After.ReservedStoredBytes == 24576


def test_no_normal_retry_after_encoding_refusal_and_final_metadata_is_truthful(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = opened(tmp_path)
    actual = object()
    failed = r.append_result(store, "opaque", actual)
    assert isinstance(failed, r.StoreFailed)
    assert failed.Failure.code == "result-type"
    assert failed.Supplied.Value is actual
    assert failed.Attempt is not None and failed.Attempt.Expected is None
    original = encoding.encode_public_result
    monkeypatch.setattr(
        encoding,
        "encode_public_result",
        lambda *args, **kwargs: pytest.fail("stopped writes cannot call encoder"),
    )
    stopped = r.append_result(store, "later", ActualReturn(True, 1, b""))
    assert isinstance(stopped, r.StoreFailed)
    assert stopped.PrimaryFailure is failed.PrimaryFailure and stopped.Attempt is None
    assert stopped.Snapshot == failed.Snapshot
    monkeypatch.setattr(encoding, "encode_public_result", original)
    final = r.finalize(store)
    assert isinstance(final, r.Finalized)
    data = json.loads((tmp_path / final.Artifact.File).read_bytes())
    assert data["Attempts"][0]["Expected"] is None
    assert "Supplied" not in data["Attempts"][0]
    assert "durable serialization only" in data["Attempts"][0]["SuppliedValueRetention"]
    assert final.After.PrimaryFailure is failed.PrimaryFailure


def test_actual_operation_is_called_once_before_store_and_not_reexecuted(
    tmp_path: Path,
) -> None:
    store = opened(tmp_path)
    calls: list[str] = []

    def operation() -> ActualReturn:
        calls.append("returned")
        return ActualReturn(False, 4, b"observed")

    actual = operation()
    result = r.append_result(store, "observed", actual)
    assert isinstance(result, r.Stored)
    assert result.Attempt.Supplied.Value is actual and calls == ["returned"]
    failed = r.append_result(store, "not-an-operation-api", operation)
    assert isinstance(failed, r.StoreFailed)
    assert failed.Supplied.Value is operation and calls == ["returned"]


def test_partial_write_keeps_prefix_full_reservation_and_earlier_artifacts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = opened(tmp_path)
    first = r.append_bytes(store, "first", b"accepted")
    assert isinstance(first, r.Stored)
    original = os.write
    count = 0

    def partial(fd: int, raw: bytes) -> int:
        nonlocal count
        count += 1
        if count == 1:
            return original(fd, raw[:3])
        raise OSError("injected partial-write failure")

    monkeypatch.setattr(os, "write", partial)
    failed = r.append_bytes(store, "partial", b"0123456789")
    assert isinstance(failed, r.StoreFailed)
    attempt = failed.Attempt
    assert attempt is not None and attempt.Write is not None and attempt.Read is None
    assert isinstance(attempt.Write.Returned, a.Refused)
    assert (tmp_path / attempt.File).read_bytes() == b"012"
    assert attempt.ReservedRawBytes == attempt.ReservedStoredBytes == 10
    assert attempt.Expected is not None and attempt.Expected.Bytes == 10
    assert failed.Snapshot is not None and failed.Snapshot.Artifacts == (
        first.Artifact,
    )
    assert failed.Snapshot.ReservedRawBytes == first.Snapshot.ReservedRawBytes + 10
    assert count == 2


def test_file_fsync_failure_keeps_written_bytes_and_return(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = opened(tmp_path)
    original = os.fsync

    def fsync(fd: int) -> None:
        if stat.S_ISREG(os.fstat(fd).st_mode):
            raise OSError("file fsync refused")
        original(fd)

    monkeypatch.setattr(os, "fsync", fsync)
    failed = r.append_bytes(store, "fsync", b"complete-bytes")
    assert isinstance(failed, r.StoreFailed)
    assert failed.Attempt is not None and failed.Attempt.Write is not None
    assert isinstance(failed.Attempt.Write.Returned, a.Refused)
    assert failed.Failure is failed.Attempt.Write.Returned
    assert (tmp_path / failed.Attempt.File).read_bytes() == b"complete-bytes"
    assert failed.Attempt.Read is None


def test_actual_close_then_error_is_not_retried(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = opened(tmp_path)
    original = os.close
    repeated_after_failure: list[int] = []
    failed_fd: list[int] = []

    def close(fd: int) -> None:
        if failed_fd and fd == failed_fd[0]:
            repeated_after_failure.append(fd)
        is_file = stat.S_ISREG(os.fstat(fd).st_mode)
        original(fd)
        if is_file:
            failed_fd.append(fd)
            raise OSError("closed, then injected refusal")

    monkeypatch.setattr(os, "close", close)
    failed = r.append_bytes(store, "close", b"complete")
    assert isinstance(failed, r.StoreFailed)
    assert failed.Failure.code == "descriptor-cleanup"
    assert len(failed_fd) == 1 and repeated_after_failure == []
    assert (
        failed.Attempt is not None
        and (tmp_path / failed.Attempt.File).read_bytes() == b"complete"
    )
    assert failed.Attempt.Read is None


def test_read_refusal_keeps_actual_write_return_and_never_admits_descriptor(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = opened(tmp_path)
    original = storage.read_artifact
    observed: list[object] = []
    refusal = a.Refused("injected-late-read", "File", "after actual read")

    def read(
        root: Path,
        descriptor: object,
        *,
        maximum_stored_bytes: int,
        maximum_original_bytes: int,
    ) -> object:
        result = original(
            root,
            descriptor,
            maximum_stored_bytes=maximum_stored_bytes,
            maximum_original_bytes=maximum_original_bytes,
        )
        observed.append(result)
        return refusal

    monkeypatch.setattr(storage, "read_artifact", read)
    failed = r.append_bytes(store, "late-read", b"complete")
    assert isinstance(failed, r.StoreFailed)
    assert observed and isinstance(observed[0], a.Admitted)
    assert (
        failed.Attempt is not None
        and failed.Attempt.Write is not None
        and failed.Attempt.Read is not None
    )
    assert isinstance(failed.Attempt.Write.Returned, a.Admitted)
    assert failed.Attempt.Read.Returned is refusal and failed.PrimaryFailure is refusal
    assert view(store).Artifacts == ()
    assert (tmp_path / failed.Attempt.File).read_bytes() == b"complete"


def test_actual_same_length_byte_change_is_caught_by_shared_reader(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = opened(tmp_path)
    original = storage.write_exclusive

    def change(root: Path, relative: str, raw: bytes) -> object:
        result = original(root, relative, raw)
        assert isinstance(result, a.Admitted)
        (root / relative).write_bytes(b"x" * len(raw))
        return result

    monkeypatch.setattr(storage, "write_exclusive", change)
    failed = r.append_bytes(store, "changed", b"observed")
    assert isinstance(failed, r.StoreFailed)
    assert failed.Attempt is not None and failed.Attempt.Read is not None
    assert isinstance(failed.Attempt.Read.Returned, a.Refused)
    assert failed.Attempt.Write is not None and isinstance(
        failed.Attempt.Write.Returned, a.Admitted
    )
    assert view(store).Artifacts == ()


def test_reservation_precedes_normal_write_and_final_uses_existing_reservation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = opened(tmp_path)
    before = view(store)
    original = storage.write_exclusive
    observations: list[r.Snapshot] = []

    def write(root: Path, relative: str, raw: bytes) -> object:
        observations.append(view(store))
        return original(root, relative, raw)

    monkeypatch.setattr(storage, "write_exclusive", write)
    value = r.append_bytes(store, "one", b"12345")
    assert isinstance(value, r.Stored)
    final = r.finalize(store)
    assert isinstance(final, r.Finalized)
    assert observations[0].ReservedRawBytes == before.ReservedRawBytes + 5
    assert observations[0].ReservedStoredBytes == before.ReservedStoredBytes + 5
    assert observations[0].ReservedSlots == 2
    assert observations[1].ReservedRawBytes == observations[0].ReservedRawBytes
    assert observations[1].FinalizationStarted


def test_final_write_collision_never_overwrites_or_retries_and_preserves_primary(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = opened(tmp_path)
    primary = r.append_result(store, "opaque", object())
    assert isinstance(primary, r.StoreFailed)
    target = tmp_path / "owned-attempt/final-journal.json"
    target.write_bytes(b"prior-content")
    final = r.finalize(store)
    assert isinstance(final, r.FinalizationFailed)
    assert final.Failure.code == "existing-output"
    assert final.PrimaryFailure is primary.PrimaryFailure
    assert final.Attempt is not None and final.Attempt.Expected is not None
    assert target.read_bytes() == b"prior-content"
    monkeypatch.setattr(
        storage,
        "write_exclusive",
        lambda *args: pytest.fail("cannot retry final write"),
    )
    again = r.finalize(store)
    assert isinstance(again, r.FinalizationFailed)
    assert again.Failure.code == "store-finalized" and again.Attempt is final.Attempt
    assert again.PrimaryFailure is primary.PrimaryFailure


def test_failed_final_read_does_not_mask_normal_encoding_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = opened(tmp_path)
    original = r.append_result(store, "opaque", object())
    assert isinstance(original, r.StoreFailed)
    late = a.Refused("journal-read-refusal", "journal", "retained separately")
    monkeypatch.setattr(storage, "read_artifact", lambda *args, **kwargs: late)
    final = r.finalize(store)
    assert isinstance(final, r.FinalizationFailed)
    assert final.PrimaryFailure is original.PrimaryFailure and final.Failure is late
    assert final.Attempt is not None and final.Attempt.Write is not None
    assert isinstance(final.Attempt.Write.Returned, a.Admitted)
    assert (tmp_path / final.Attempt.File).is_file()


def test_unexpected_raised_write_retains_actual_file_and_no_invented_return(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = opened(tmp_path)
    original = storage.write_exclusive

    def write(root: Path, relative: str, raw: bytes) -> object:
        result = original(root, relative, raw)
        assert isinstance(result, a.Admitted)
        raise RuntimeError("after actual helper return; wrapper raised")

    monkeypatch.setattr(storage, "write_exclusive", write)
    failed = r.append_bytes(store, "raised", b"complete")
    assert isinstance(failed, r.StoreFailed)
    assert failed.Attempt is not None and failed.Attempt.Write is not None
    assert failed.Attempt.Write.Returned is None
    assert failed.Attempt.Write.Raised == r.Raised(
        "builtins.RuntimeError", "after actual helper return; wrapper raised"
    )
    assert (tmp_path / failed.Attempt.File).read_bytes() == b"complete"
    assert failed.Attempt.ReservedRawBytes == 8


def test_existing_attempt_is_not_adopted_and_no_operation_runs(tmp_path: Path) -> None:
    target = tmp_path / "existing"
    target.mkdir()
    (target / "keep").write_bytes(b"owned-by-other")
    result = r.open_store(tmp_path, "existing")
    assert isinstance(result, r.OpenFailed)
    assert (
        result.Failure.code == "existing-output"
        and result.Ownership == "not-established"
    )
    assert result.Creation is not None and result.Creation.Returned is result.Failure
    assert (target / "keep").read_bytes() == b"owned-by-other"
    assert isinstance(r.append_result(result, "not-opened", object()), r.StoreFailed)


def test_create_after_mkdir_failure_retains_known_path_without_ownership(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail(fd: int) -> None:
        raise OSError("directory fsync refused after mkdir")

    monkeypatch.setattr(os, "fsync", fail)
    result = r.open_store(tmp_path, "ambiguous")
    assert isinstance(result, r.OpenFailed)
    assert (tmp_path / "ambiguous").is_dir()
    assert result.AttemptedPath == str(tmp_path / "ambiguous")
    assert (
        result.Ownership == "not-established"
        and result.Failure.code == "directory-write"
    )
    assert result.Creation is not None and result.Creation.Returned is result.Failure


@pytest.mark.parametrize(
    "name", ["../outside", "a/b", "", ".", "..", "a\x00b", "x" * 65, False]
)
def test_invalid_attempt_refuses_before_filesystem(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, name: object
) -> None:
    monkeypatch.setattr(
        storage,
        "create_directory",
        lambda *args: pytest.fail("invalid input reached filesystem"),
    )
    result = r.open_store(tmp_path, name)
    assert isinstance(result, r.OpenFailed) and result.Creation is None


@pytest.mark.parametrize(
    "limits",
    [
        r.Limits(True, 2, 1),
        r.Limits(10, 3, 1),
        r.Limits(9, 2, 1),
        r.Limits(10, 12, 1),
        r.Limits(10, 2, 0),
        r.Limits(10, 2, 4097),
        r.Limits(256 * 1024 * 1024 + 2, 2, 1),
        r.Limits(r.MAX_COMBINED_BYTES, r.FINAL_JOURNAL_BYTES + 2, 1),
        object(),
    ],
)
def test_invalid_limits_are_refused_without_setup(
    tmp_path: Path, limits: object
) -> None:
    result = r.open_store(tmp_path, "attempt", limits)
    assert isinstance(result, r.OpenFailed) and result.Failure.code == "store-limits"
    assert result.Creation is None and not (tmp_path / "attempt").exists()


def test_root_nul_and_unissued_copied_handles_refuse(tmp_path: Path) -> None:
    result = r.open_store(Path(str(tmp_path) + "\x00"), "attempt")
    assert isinstance(result, r.OpenFailed) and result.Creation is None
    store = opened(tmp_path)
    copied = dataclasses.replace(store)
    assert isinstance(r.snapshot(copied), a.Refused)
    assert isinstance(r.append_bytes(copied, "copy", b""), r.StoreFailed)
    assert isinstance(r.finalize(copied), r.FinalizationFailed)
    assert view(store).Attempts == ()


@pytest.mark.parametrize(
    "helper,replacement",
    [
        ("write", a.Admitted(1)),
        ("write", object()),
        ("read", a.Admitted(b"wrong")),
        ("encode", a.Admitted("not-bytes")),
    ],
)
def test_wrong_helper_returns_remain_observed_and_refuse(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, helper: str, replacement: object
) -> None:
    store = opened(tmp_path)
    mapping = {
        "write": (storage, "write_exclusive"),
        "read": (storage, "read_artifact"),
        "encode": (encoding, "encode_public_result"),
    }
    module, name = mapping[helper]
    monkeypatch.setattr(module, name, lambda *args, **kwargs: replacement)
    result = r.append_result(store, "actual", ActualReturn(True, 7, b""))
    assert isinstance(result, r.StoreFailed)
    assert result.Attempt is not None
    observation = {
        "write": result.Attempt.Write,
        "read": result.Attempt.Read,
        "encode": result.Attempt.Encoding,
    }[helper]
    assert observation is not None and observation.Returned is replacement
    assert view(store).Artifacts == ()


def test_unexpected_encoder_raise_is_preserved_after_actual_operation_return(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = opened(tmp_path)
    actual = ActualReturn(True, 1, b"returned")

    def fail(*args: object, **kwargs: object) -> object:
        raise ValueError("encoder inspection failed")

    monkeypatch.setattr(encoding, "encode_public_result", fail)
    result = r.append_result(store, "actual", actual)
    assert isinstance(result, r.StoreFailed)
    assert result.Supplied.Value is actual
    assert result.Attempt is not None and result.Attempt.Encoding is not None
    assert (
        result.Attempt.Encoding.Returned is None
        and result.Attempt.Encoding.Raised is not None
    )
    assert result.Attempt.Write is None


def test_known_raw_descriptor_survives_slot_refusal(tmp_path: Path) -> None:
    store = opened(tmp_path, r.Limits(32768, 16384, 1))
    raw = b"known-before-any-write"
    result = r.append_bytes(store, "no-slot", raw)
    assert isinstance(result, r.StoreFailed)
    assert result.Failure.code == "store-artifact-bound"
    assert result.Attempt is not None and result.Attempt.Expected is not None
    assert result.Attempt.Expected.Bytes == len(raw)
    assert result.Attempt.Expected.Sha256 == hashlib.sha256(raw).hexdigest().upper()
    assert not result.Attempt.ReservedSlot and result.Attempt.Write is None


def test_normal_collision_charges_reservation_and_retains_foreign_bytes(
    tmp_path: Path,
) -> None:
    store = opened(tmp_path)
    path = tmp_path / "owned-attempt/record-000000.bin"
    path.write_bytes(b"prior-output")
    result = r.append_bytes(store, "collision", b"new-output")
    assert isinstance(result, r.StoreFailed)
    assert result.Failure.code == "existing-output"
    assert result.Attempt is not None and result.Attempt.Expected is not None
    assert result.Attempt.ReservedRawBytes == result.Attempt.ReservedStoredBytes == 10
    assert path.read_bytes() == b"prior-output"
    assert view(store).Artifacts == ()
    again = r.append_bytes(store, "other", b"must-not-write")
    assert isinstance(again, r.StoreFailed) and again.Attempt is None
    assert again.PrimaryFailure is result.PrimaryFailure
    assert not (tmp_path / "owned-attempt/record-000001.bin").exists()


def test_primary_write_failure_survives_actual_close_then_cleanup_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = opened(tmp_path)
    original_close = os.close

    def write(fd: int, raw: bytes) -> int:
        raise OSError("primary write error")

    def close(fd: int) -> None:
        is_file = stat.S_ISREG(os.fstat(fd).st_mode)
        original_close(fd)
        if is_file:
            raise OSError("secondary cleanup error")

    monkeypatch.setattr(os, "write", write)
    monkeypatch.setattr(os, "close", close)
    result = r.append_bytes(store, "first-failure", b"reserved")
    assert isinstance(result, r.StoreFailed)
    assert result.Failure.code == "file-write"
    assert result.Failure.detail == "primary write error"
    assert (
        result.Attempt is not None
        and (tmp_path / result.Attempt.File).read_bytes() == b""
    )


def test_open_cleanup_refusal_does_not_create_an_admitted_handle(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = os.close

    def close(fd: int) -> None:
        # Let directory traversal close normally; refuse the final parent close
        # after mkdir has actually produced the candidate directory.
        created = (tmp_path / "ambiguous-close").exists()
        original(fd)
        if created:
            raise OSError("closed parent, then reported failure")

    monkeypatch.setattr(os, "close", close)
    result = r.open_store(tmp_path, "ambiguous-close")
    assert isinstance(result, r.OpenFailed)
    assert result.Failure.code == "descriptor-cleanup"
    assert result.Ownership == "not-established"
    assert result.AttemptedPath == str(tmp_path / "ambiguous-close")
    assert (tmp_path / "ambiguous-close").is_dir()


def test_custom_helper_exception_is_observed_without_fabricated_return(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    class RaisedDuringEncoding(Exception):
        pass

    def encode(*args: object, **kwargs: object) -> object:
        raise RaisedDuringEncoding("custom boundary error")

    store = opened(tmp_path)
    actual = ActualReturn(True, 6, b"already returned")
    monkeypatch.setattr(encoding, "encode_public_result", encode)
    result = r.append_result(store, "actual", actual)
    assert isinstance(result, r.StoreFailed)
    assert result.Supplied.Value is actual
    assert result.Attempt is not None and result.Attempt.Encoding is not None
    assert result.Attempt.Encoding.Returned is None
    assert result.Attempt.Encoding.Raised is not None
    assert result.Attempt.Encoding.Raised.Type.endswith("RaisedDuringEncoding")


def test_invalid_limits_retain_known_attempted_path(tmp_path: Path) -> None:
    result = r.open_store(tmp_path, "known-attempt", r.Limits(10, 11, 1))
    assert isinstance(result, r.OpenFailed)
    assert result.AttemptedPath == str(tmp_path / "known-attempt")
    assert result.Creation is None
