from __future__ import annotations

import copy
import gzip
import hashlib
from pathlib import Path
from typing import Any

import pytest
from test_hidden_switch_compiled_outer_structure import descriptor, encode, fixture

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_outer_artifacts as reader
from zeta_interp import hidden_switch_compiled_outer_structure as structure
from zeta_interp import hidden_switch_compiled_storage as storage


def inputs(
    root: Path, *, complete: bool = False
) -> tuple[dict[str, Any], structure.ExpectedOuter]:
    row, expected = fixture()
    if not complete:
        row["Complete"] = False
        row["Failure"] = {
            "Stage": "setup",
            "CaseId": None,
            "Call": None,
            "Code": "incomplete",
            "Path": "Attempt",
            "Detail": "synthetic structure-only fixture",
        }
        row["Cases"] = []
        row["Completed"] = {"Cases": 0, "Calls": 0}
    plan = structure.admit_outer_structure(encode(row), expected)
    assert isinstance(plan, a.Admitted)
    for ref in plan.value.References:
        with (root / ref.File).open("xb") as output:
            output.write(b"{}")
    return row, expected


def test_complete_plan_executes_strict_reads_without_outcome_replay(
    tmp_path: Path,
) -> None:
    row, expected = inputs(tmp_path, complete=True)
    result = reader.read_outer_artifacts(encode(row), expected, tmp_path)
    assert isinstance(result, a.Admitted)
    assert len(result.value.ReferenceReads) == len(result.value.Structure.References)
    assert len(result.value.Reads) == len(result.value.ReferenceReads)
    assert result.value.ReferenceReads == tuple(range(len(result.value.Reads)))
    assert result.value.ReservedBytes == len(encode(row)) + 4 * len(result.value.Reads)
    assert result.value.OutcomeReplay == "not-performed"
    for attempt in result.value.Reads:
        assert attempt.Returned and isinstance(attempt.ActualResult, a.Admitted)
        assert attempt.ActualResult.value == b"{}"


def test_alias_reads_once_and_uses_the_actual_retained_bytes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    row, expected = inputs(tmp_path)
    for item in row["Prerequisites"]:
        item["Artifact"] = copy.deepcopy(row["Producer"]["PythonIdentity"])
    original = storage.read_artifact
    calls: list[str] = []

    def read(
        root: Path,
        artifact: Any,
        *,
        maximum_stored_bytes: int,
        maximum_original_bytes: int,
    ) -> a.Admission[bytes]:
        calls.append(artifact["File"])
        actual = original(
            root,
            artifact,
            maximum_stored_bytes=maximum_stored_bytes,
            maximum_original_bytes=maximum_original_bytes,
        )
        (root / artifact["File"]).write_bytes(b"changed after the actual read")
        return actual

    monkeypatch.setattr(storage, "read_artifact", read)
    result = reader.read_outer_artifacts(encode(row), expected, tmp_path)
    assert isinstance(result, a.Admitted)
    assert calls == ["python.json"] and result.value.ReferenceReads == (0,) * 9
    assert result.value.ReservedBytes == len(encode(row)) + 4
    assert isinstance(result.value.Reads[0].ActualResult, a.Admitted)
    assert result.value.Reads[0].ActualResult.value == b"{}"


@pytest.mark.parametrize("problem", ["missing", "symlink", "changed", "extra-byte"])
def test_late_real_file_refusal_keeps_all_prior_bytes(
    tmp_path: Path, problem: str
) -> None:
    row, expected = inputs(tmp_path)
    target = tmp_path / "p7.json"
    if problem in ("missing", "symlink"):
        target.unlink()
        if problem == "symlink":
            target.symlink_to(tmp_path / "python.json")
    else:
        target.write_bytes(b"xx" if problem == "changed" else b"{}x")
    result = reader.read_outer_artifacts(encode(row), expected, tmp_path)
    assert isinstance(result, reader.ReadFailure)
    assert result.Stage == "artifact-read"
    assert len(result.Reads) == 9 and result.ReferenceReads == tuple(range(8))
    assert (
        result.FailedReference is not None and result.FailedReference.File == "p7.json"
    )
    assert isinstance(result.Reads[-1].ActualResult, a.Refused)
    assert result.Problem is result.Reads[-1].ActualResult
    assert all(
        isinstance(attempt.ActualResult, a.Admitted)
        and attempt.ActualResult.value == b"{}"
        for attempt in result.Reads[:-1]
    )
    assert result.ReservedBytes == len(encode(row)) + 36


@pytest.mark.parametrize("trailing", [False, True])
def test_actual_gzip_relation_is_checked(tmp_path: Path, trailing: bool) -> None:
    row, expected = inputs(tmp_path)
    original = b"{}"
    stored = gzip.compress(original, mtime=0)
    if trailing:
        stored += gzip.compress(b"", mtime=0)
    target = tmp_path / "p7.json.gz"
    with target.open("xb") as output:
        output.write(stored)
    value = descriptor(target.name)
    value.update(
        Encoding="gzip",
        StoredBytes=len(stored),
        StoredSha256=hashlib.sha256(stored).hexdigest().upper(),
    )
    row["Prerequisites"][-1]["Artifact"] = value
    result = reader.read_outer_artifacts(encode(row), expected, tmp_path)
    if trailing:
        assert isinstance(result, reader.ReadFailure) and isinstance(
            result.Problem, a.Refused
        )
        assert result.Problem.code == "artifact-gzip"
    else:
        assert isinstance(result, a.Admitted)
        assert result.value.ReservedBytes == len(encode(row)) + 32 + 2 + len(stored)


def test_aggregate_budget_checks_before_the_next_real_read(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    row, expected = inputs(tmp_path)
    raw = encode(row)
    original = storage.read_artifact
    calls: list[str] = []

    def read(
        root: Path,
        artifact: Any,
        *,
        maximum_stored_bytes: int,
        maximum_original_bytes: int,
    ) -> a.Admission[bytes]:
        calls.append(artifact["File"])
        return original(
            root,
            artifact,
            maximum_stored_bytes=maximum_stored_bytes,
            maximum_original_bytes=maximum_original_bytes,
        )

    monkeypatch.setattr(storage, "read_artifact", read)
    failure = reader.read_outer_artifacts(
        raw, expected, tmp_path, maximum_bytes=len(raw) + 35
    )
    assert isinstance(failure, reader.ReadFailure) and failure.Stage == "budget"
    assert len(calls) == len(failure.Reads) == 8
    assert failure.ReservedBytes == len(raw) + 32
    assert (
        failure.FailedReference is not None
        and failure.FailedReference.File == "p7.json"
    )
    admitted = reader.read_outer_artifacts(
        raw, expected, tmp_path, maximum_bytes=len(raw) + 36
    )
    assert isinstance(admitted, a.Admitted)


@pytest.mark.parametrize(
    "invalid", [True, False, 0, -1, 1.0, reader.MAXIMUM_READ_BYTES + 1, None]
)
def test_invalid_budget_never_enters_structure_or_reader(
    tmp_path: Path, invalid: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    def forbidden(*args: object, **kwargs: object) -> None:
        raise AssertionError("invalid budget must refuse before any admission or read")

    monkeypatch.setattr(structure, "admit_outer_structure", forbidden)
    monkeypatch.setattr(storage, "read_artifact", forbidden)
    result = reader.read_outer_artifacts(
        b"{}", object(), tmp_path, maximum_bytes=invalid
    )
    assert (
        isinstance(result, reader.ReadFailure)
        and result.ReservedBytes == 0
        and result.Reads == ()
    )


def test_small_budget_and_invalid_root_or_bytes_refuse_without_reads(
    tmp_path: Path,
) -> None:
    row, expected = inputs(tmp_path)
    for root, raw, bound in (
        (Path("relative"), encode(row), 1000000),
        (tmp_path, None, 1000000),
        (tmp_path, encode(row), 1),
    ):
        result = reader.read_outer_artifacts(raw, expected, root, maximum_bytes=bound)
        assert isinstance(result, reader.ReadFailure) and result.Reads == ()


def test_independent_identity_refusal_precedes_all_file_reads(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    row, expected = inputs(tmp_path)
    row["Prerequisites"][-1]["Artifact"] = descriptor("p7.json", b" {}")

    def forbidden(*args: object, **kwargs: object) -> None:
        raise AssertionError("unbound structure must not read any artifact")

    monkeypatch.setattr(storage, "read_artifact", forbidden)
    result = reader.read_outer_artifacts(encode(row), expected, tmp_path)
    assert isinstance(result, reader.ReadFailure) and result.Stage == "structure"
    assert result.Reads == () and result.ReferenceReads == ()


@pytest.mark.parametrize(
    "kind", ["raised", "untyped", "wrong-bytes", "wrong-value", "refused"]
)
def test_actual_reader_contract_failure_is_not_a_successful_negative(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, kind: str
) -> None:
    row, expected = inputs(tmp_path)
    original = storage.read_artifact
    marker = object()
    refusal = a.Refused("actual-refusal", "p7.json", "complete original detail")

    def read(
        root: Path,
        artifact: Any,
        *,
        maximum_stored_bytes: int,
        maximum_original_bytes: int,
    ) -> object:
        if artifact["File"] != "p7.json":
            return original(
                root,
                artifact,
                maximum_stored_bytes=maximum_stored_bytes,
                maximum_original_bytes=maximum_original_bytes,
            )
        if kind == "raised":
            raise RuntimeError("actual missing return")
        if kind == "untyped":
            return marker
        if kind == "wrong-bytes":
            return a.Admitted(b"xx")
        if kind == "wrong-value":
            return a.Admitted(None)
        return refusal

    monkeypatch.setattr(storage, "read_artifact", read)
    result = reader.read_outer_artifacts(encode(row), expected, tmp_path)
    assert isinstance(result, reader.ReadFailure) and len(result.Reads) == 9
    assert result.ReferenceReads == tuple(range(8))
    observed = result.Reads[-1]
    if kind == "raised":
        assert not observed.Returned and observed.ActualResult is None
        assert (
            observed.RaisedType == "builtins.RuntimeError"
            and observed.RaisedDetail == "actual missing return"
        )
    else:
        assert observed.Returned
        if kind == "untyped":
            assert observed.ActualResult is marker
        if kind == "refused":
            assert observed.ActualResult is refusal and result.Problem is refusal
