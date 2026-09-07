from __future__ import annotations

import json
import os
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_conformance as c
from zeta_interp import hidden_switch_compiled_file_fixtures as f
from zeta_interp import hidden_switch_compiled_storage as storage


def prepare(root: Path, name: str) -> f.PreparedFileFixture:
    result = f.prepare_file_fixture(name, root.resolve() / name.replace("/", "-"))
    assert isinstance(result, f.PreparedFileFixture), result
    return result


def call(fixture: f.PreparedFileFixture, index: int) -> f.FileCallObservation:
    result = f.execute_file_call(fixture, index)
    assert isinstance(result, f.FileCallObservation), result
    return result


@pytest.mark.parametrize("name", f.FILE_CASE_IDS)
def test_actual_file_operations_keep_observed_state_and_exact_return(
    name: str, tmp_path: Path
) -> None:
    fixture = prepare(tmp_path, name)
    spec = next(row for row in c.case_specs() if row.CaseId == name)
    observations = tuple(call(fixture, index) for index in range(len(spec.Calls)))
    assert all(
        row.CompletedOperation == 1 and row.Failure is None for row in observations
    )
    assert all(
        isinstance(row.ActualResult, (a.Admitted, a.Refused)) for row in observations
    )
    for index, row in enumerate(observations):
        expected_refusal = (
            name.startswith("artifact/")
            or name in ("storage/partial-write", "storage/changed-read")
            or name in ("storage/reused-attempt", "storage/reused-file")
            and index == 1
        )
        assert isinstance(
            row.ActualResult, a.Refused if expected_refusal else a.Admitted
        ), row
        assert isinstance(c.result_tree(row), a.Admitted)
    final = f.file_fixture_inputs(fixture, observations)
    assert isinstance(final, a.Admitted), final
    assert tuple(row.Role for row in final.value) == spec.InputRoles
    raw = next(row.Raw for row in final.value if row.Role == "fixture")
    value = json.loads(raw)
    assert value["Root"] == str(fixture.Root) and value["CaseId"] == name
    encoded = c.result_tree({"Setup": fixture.Setup, "Observations": observations})
    assert isinstance(encoded, a.Admitted) and value["Audit"] == encoded.value
    if name == "storage/control" or name == "storage/reused-file":
        assert (fixture.Root / fixture.Target).read_bytes() == b"original"
    elif name == "storage/partial-write":
        assert (fixture.Root / fixture.Target).read_bytes() == b"ori"
        assert [row.Kind for row in observations[0].Faults] == [
            "actual-prefix-write",
            "injected-write-failure",
        ]
        first, second = observations
        assert (
            isinstance(first.ActualResult, a.Refused)
            and first.ActualResult.code == "file-write"
        )
        assert (
            isinstance(second.ActualResult, a.Refused)
            and second.ActualResult.code == "existing-output"
        )
    elif name == "storage/changed-read":
        assert (fixture.Root / fixture.Target).read_bytes() == b"ORIGINAL"
        assert (
            isinstance(observations[0].ActualResult, a.Refused)
            and observations[0].ActualResult.code == "file-changed"
        )
        assert [row.Kind for row in observations[0].Faults] == [
            "before-mutation-fstat",
            "actual-same-length-mutation",
        ]
    elif name == "artifact/symlink-path":
        assert (fixture.Root / fixture.Target).is_symlink()
        assert (fixture.Root / "sibling.bin").read_bytes() == b"ABC"
        assert (
            isinstance(observations[0].Before, a.Admitted)
            and observations[0].Before.value.SymlinkTarget == "sibling.bin"
        )


def test_case_roster_is_exactly_seven_cases_eleven_operations() -> None:
    assert len(f.FILE_CASE_IDS) == 7
    assert (
        sum(len(row.Calls) for row in c.case_specs() if row.CaseId in f.FILE_CASE_IDS)
        == 11
    )


def test_prepare_existing_root_retains_original_and_typed_setup_result(
    tmp_path: Path,
) -> None:
    fixture = prepare(tmp_path, "storage/control")
    (fixture.Root / "sentinel").write_bytes(b"preserve")
    again = f.prepare_file_fixture(fixture.CaseId, fixture.Root)
    assert isinstance(again, f.FileFixtureFailed)
    assert again.Stage == "create-fixture-root"
    assert isinstance(again.Setup[-1].ActualResult, a.Refused)
    assert again.Setup[-1].ActualResult.code == "existing-output"
    assert (fixture.Root / "sentinel").read_bytes() == b"preserve"
    assert isinstance(c.result_tree(again), a.Admitted)


def test_root_created_before_fsync_failure_remains_recorded(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail(_fd: int) -> None:
        raise OSError("injected fsync after actual mkdir")

    monkeypatch.setattr(os, "fsync", fail)
    root = tmp_path.resolve() / "partial-root"
    result = f.prepare_file_fixture("storage/control", root)
    assert isinstance(result, f.FileFixtureFailed) and root.is_dir()
    assert isinstance(result.Setup[0].ActualResult, a.Refused)
    assert "injected fsync" in result.Setup[0].ActualResult.detail
    assert isinstance(c.result_tree(result), a.Admitted)


def test_before_observation_failure_never_becomes_a_counted_operation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = prepare(tmp_path, "storage/reused-file")
    problem = a.Refused("before-observation", "file.bin", "actual read failure")
    monkeypatch.setattr(f, "observe_file", lambda *_args: problem)
    row = call(fixture, 0)
    assert (
        row.CompletedOperation == 0
        and row.ActualResult is None
        and row.Failure is problem
    )
    assert not (fixture.Root / fixture.Target).exists()
    assert isinstance(f.file_fixture_inputs(fixture, (row,)), a.Admitted)


@pytest.mark.parametrize("name", ["storage/reused-file", "storage/partial-write"])
def test_after_observation_failure_keeps_actual_return_and_written_prefix(
    name: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = prepare(tmp_path, name)
    real = f.observe_file
    calls = 0
    problem = a.Refused("after-observation", "file.bin", "actual after read failed")

    def observe(root: Path, relative: str) -> a.Admission[f.FileState]:
        nonlocal calls
        calls += 1
        return real(root, relative) if calls == 1 else problem

    monkeypatch.setattr(f, "observe_file", observe)
    row = call(fixture, 0)
    assert row.CompletedOperation == 1 and row.Failure is problem
    assert isinstance(
        row.ActualResult, a.Refused if name.endswith("partial-write") else a.Admitted
    )
    assert (fixture.Root / fixture.Target).read_bytes() == (
        b"ori" if name.endswith("partial-write") else b"original"
    )
    assert isinstance(f.file_fixture_inputs(fixture, (row,)), a.Admitted)


def test_hooks_delegate_unrelated_file_and_restore_even_after_actual_refusal(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = prepare(tmp_path, "storage/partial-write")
    other = tmp_path / "other"
    fd = os.open(other, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    real_api = storage.write_exclusive
    original_write, original_stat = os.write, os.fstat

    def write(root: Path, relative: str, raw: bytes) -> a.Admission[int]:
        written = os.write(fd, b"unrelated")
        assert written == 9
        return real_api(root, relative, raw)

    monkeypatch.setattr(storage, "write_exclusive", write)
    try:
        row = call(fixture, 0)
    finally:
        os.close(fd)
    assert row.CompletedOperation == 1 and isinstance(row.ActualResult, a.Refused)
    assert other.read_bytes() == b"unrelated"
    assert os.write is original_write and os.fstat is original_stat


def test_operation_exception_retains_fault_prefix_and_restores_hooks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = prepare(tmp_path, "storage/partial-write")
    write, fstat = os.write, os.fstat

    def crash(_fixture: f.PreparedFileFixture, _index: int) -> object:
        fd = os.open(
            fixture.Root / fixture.Target, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600
        )
        try:
            written = os.write(fd, b"original")
            assert written == 3
        finally:
            os.close(fd)
        raise RuntimeError("actual call did not return")

    monkeypatch.setattr(f, "_invoke", crash)
    row = call(fixture, 0)
    assert row.CompletedOperation == 0 and row.ActualResult is None
    assert row.Failure is not None and row.Failure.code == "fixture-operation-crash"
    assert [event.Kind for event in row.Faults] == ["actual-prefix-write"]
    assert (fixture.Root / fixture.Target).read_bytes() == b"ori"
    assert os.write is write and os.fstat is fstat


@pytest.mark.parametrize("primary", [False, True])
def test_real_close_then_error_never_masks_an_earlier_mutation_failure(
    primary: bool, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = prepare(tmp_path, "storage/changed-read")
    actual_close = f._close_mutation_descriptor
    closed: list[int] = []

    def uncertain_close(descriptor: int) -> None:
        closed.append(descriptor)
        actual_close(descriptor)
        raise OSError("retained cleanup failure after actual close")

    def broken_fsync(_descriptor: int) -> None:
        raise OSError("retained first mutation fsync failure")

    monkeypatch.setattr(f, "_close_mutation_descriptor", uncertain_close)
    if primary:
        monkeypatch.setattr(os, "fsync", broken_fsync)
    row = call(fixture, 0)
    assert len(closed) == 1
    assert row.CompletedOperation == 1 and isinstance(row.ActualResult, a.Refused)
    assert row.ActualResult.code == "file-read"
    assert (
        "first mutation fsync" if primary else "cleanup failure"
    ) in row.ActualResult.detail
    assert [event.Kind for event in row.Faults][-1] == "mutation-cleanup-failure"
    assert (
        any(event.Kind == "mutation-primary-failure" for event in row.Faults) == primary
    )
    assert (fixture.Root / fixture.Target).read_bytes() == b"ORIGINAL"
    assert isinstance(f.file_fixture_inputs(fixture, (row,)), a.Admitted)


@pytest.mark.parametrize("value", [None, False, 8])
def test_missing_or_untyped_return_retains_observation_without_counting_call(
    value: object, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = prepare(tmp_path, "storage/reused-file")
    real = f._invoke

    def wrong_return(prepared: f.PreparedFileFixture, index: int) -> object:
        real(prepared, index)
        return value

    monkeypatch.setattr(f, "_invoke", wrong_return)
    row = call(fixture, 0)
    assert row.CompletedOperation == 0 and row.ActualResult is None
    assert row.UnexpectedReturn is value
    assert row.Failure is not None and row.Failure.code == "fixture-operation-return"
    assert (fixture.Root / fixture.Target).read_bytes() == b"original"
    assert isinstance(f.file_fixture_inputs(fixture, (row,)), a.Admitted)


def test_source_fixed_observation_prefix_rejects_reordering_alias_and_post_failure(
    tmp_path: Path,
) -> None:
    fixture = prepare(tmp_path, "storage/reused-file")
    first, second = call(fixture, 0), call(fixture, 1)
    assert isinstance(f.file_fixture_inputs(fixture, (first, second)), a.Admitted)
    for rows in (
        (second, first),
        (first, second, second),
        (replace(first, CompletedOperation=True),),
        (replace(first, ActualResult=None),),
        (replace(first, Failure=a.Refused("audit", "x", "stop")), second),
    ):
        assert isinstance(f.file_fixture_inputs(fixture, rows), a.Refused)


def test_after_result_encoding_refusal_does_not_modify_file_or_actual_result(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = prepare(tmp_path, "storage/reused-file")
    row = call(fixture, 0)
    problem = a.Refused("result-bound", "$", "retainer unavailable")
    monkeypatch.setattr(c, "result_tree", lambda _value: problem)
    assert f.file_fixture_inputs(fixture, (row,)) is problem
    assert row.CompletedOperation == 1 and row.ActualResult == a.Admitted(8)
    assert (fixture.Root / fixture.Target).read_bytes() == b"original"


def test_observed_disappearance_after_actual_read_is_a_failure_not_initial_absence(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path.resolve()
    (root / "file.bin").write_bytes(b"original")
    real = storage.read_exact

    def disappearing(*args: Any, **kwargs: Any) -> a.Admission[bytes]:
        result = real(*args, **kwargs)
        (root / "file.bin").rename(root / "retained-original")
        return result

    monkeypatch.setattr(storage, "read_exact", disappearing)
    observed = f.observe_file(root, "file.bin")
    assert isinstance(observed, a.Refused) and observed.code == "fixture-observation"
    assert (root / "retained-original").read_bytes() == b"original"


def test_observation_size_limit_does_not_read_large_or_nonregular_files(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path.resolve()
    (root / "large").write_bytes(b"x" * (f.MAX_FILE_BYTES + 1))
    os.mkfifo(root / "fifo")
    assert isinstance(f.observe_file(root, "large"), a.Refused)
    assert isinstance(f.observe_file(root, "fifo"), a.Refused)
    assert isinstance(f.observe_file(root, "missing"), a.Admitted)


@pytest.mark.parametrize("bad", [None, True, "storage/unknown", "source/control"])
def test_unknown_case_does_not_create_root(bad: object, tmp_path: Path) -> None:
    root = tmp_path.resolve() / "unused"
    assert isinstance(f.prepare_file_fixture(bad, root), f.FileFixtureFailed)
    assert not root.exists()


@pytest.mark.parametrize("bad", [True, -1, 1.0, "0", 2])
def test_call_index_domain_refuses_without_file_creation(
    bad: object, tmp_path: Path
) -> None:
    fixture = prepare(tmp_path, "storage/reused-file")
    assert isinstance(f.execute_file_call(fixture, bad), a.Refused)
    assert not (fixture.Root / fixture.Target).exists()
