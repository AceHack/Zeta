from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path
from typing import Any, cast

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_conformance as c
from zeta_interp import hidden_switch_compiled_file_fixtures as f
from zeta_interp import hidden_switch_compiled_file_replay as r
from zeta_interp import hidden_switch_compiled_record_encoding as encoding


def encode(value: object) -> bytes:
    out = encoding.encode_public_result(value, maximum_bytes=r.MAX_RESULT_BYTES)
    assert isinstance(out, a.Admitted), out
    return out.value


def capture(parent: Path, case: str) -> tuple[r.RecordedFileCase, Path]:
    root = parent / "producer" / case.replace("/", "-")
    root.parent.mkdir()
    prepared = f.prepare_file_fixture(case, root)
    assert isinstance(prepared, f.PreparedFileFixture), prepared
    spec = next(row for row in c.case_specs() if row.CaseId == case)
    observations = []
    calls = []
    for index, expected in enumerate(spec.Calls):
        actual = f.execute_file_call(prepared, index)
        assert isinstance(actual, f.FileCallObservation), actual
        assert actual.CompletedOperation == 1 and actual.Failure is None
        observations.append(actual)
        calls.append(
            r.RecordedCall(
                expected.Operation, expected.InputRoles, encode(actual.ActualResult)
            )
        )
    inputs = f.file_fixture_inputs(prepared, tuple(observations))
    assert isinstance(inputs, a.Admitted), inputs
    return r.RecordedFileCase(case, inputs.value, tuple(calls)), root


def replay(parent: Path, record: r.RecordedFileCase, original: Path) -> r.FileReplay:
    parent.mkdir()
    return r.replay_file_case(
        record,
        parent,
        fixed_case_id=original.name.replace("-", "/", 1),
        producer_root=original,
    )


def fixture(record: r.RecordedFileCase) -> dict[str, Any]:
    return cast(
        dict[str, Any],
        json.loads(next(row.Raw for row in record.Inputs if row.Role == "fixture")),
    )


def changed(record: r.RecordedFileCase, value: object) -> r.RecordedFileCase:
    return replace(
        record,
        Inputs=tuple(
            c.NamedInput(row.Role, encode(value)) if row.Role == "fixture" else row
            for row in record.Inputs
        ),
    )


def typed_nodes(value: Any, suffix: str) -> list[dict[str, Any]]:
    result = []
    if type(value) is dict:
        if str(value.get("Type", "")).endswith(suffix):
            result.append(value["Fields"])
        for item in value.values():
            result.extend(typed_nodes(item, suffix))
    elif type(value) is list:
        for item in value:
            result.extend(typed_nodes(item, suffix))
    return result


@pytest.mark.parametrize("case", f.FILE_CASE_IDS)
def test_fresh_fixed_operations_match_complete_original_observations(
    case: str, tmp_path: Path
) -> None:
    recorded, original = capture(tmp_path, case)
    result = replay(tmp_path / "replay", recorded, original)
    assert result.Failure is None and result.CaseMatched, result
    assert result.CompletedOperations == result.MatchedCalls == len(recorded.Calls)
    assert result.Recorded is recorded and result.ProducerRoot == original
    assert result.OuterSourceAndRuntimeAdmission == "not-performed"
    assert all(
        row.Comparison is not None and row.Comparison.Matched for row in result.Calls
    )
    assert all(row.Matched for row in result.InputComparisons)
    assert result.ActualInputs is not None
    actual = result.ActualInputs.Returned
    assert isinstance(actual, a.Admitted)
    fresh = next(row.Raw for row in actual.value if row.Role == "fixture")
    assert fresh != next(row.Raw for row in recorded.Inputs if row.Role == "fixture")
    assert original.exists() and (tmp_path / "replay" / original.name).exists()


def test_catalog_contains_seven_cases_and_eleven_actual_operations() -> None:
    specs = [row for row in c.case_specs() if row.CaseId in f.FILE_CASE_IDS]
    assert len(specs) == 7 and sum(len(row.Calls) for row in specs) == 11


@pytest.mark.parametrize(
    "mutation", ["result", "operation", "roles", "missing", "extra", "input-content"]
)
def test_late_discriminators_keep_actual_prefix(mutation: str, tmp_path: Path) -> None:
    record, original = capture(tmp_path, "storage/reused-file")
    calls = list(record.Calls)
    if mutation == "result":
        calls[-1] = replace(calls[-1], ResultRaw=encode(a.Admitted(True)))
    elif mutation == "operation":
        calls[-1] = replace(calls[-1], Operation="producer-selected-command")
    elif mutation == "roles":
        calls[-1] = replace(calls[-1], InputRoles=("replacement", "fixture"))
    elif mutation == "missing":
        calls.pop()
    elif mutation == "extra":
        calls.append(calls[-1])
    record = replace(record, Calls=tuple(calls))
    if mutation == "input-content":
        value = fixture(record)
        nodes = typed_nodes(value, ".FileState")
        target = next(row for row in nodes if row["Kind"] == "regular")
        target["Content"] = {"BytesHex": b"ORIGINAL".hex().upper()}
        record = changed(record, value)
    result = replay(tmp_path / "replay", record, original)
    assert not result.CaseMatched and result.Failure is not None
    assert result.CompletedOperations == (1 if mutation == "missing" else 2)
    assert result.Calls[0].Comparison is not None and result.Calls[0].Comparison.Matched
    assert (
        tmp_path / "replay" / original.name / "file.bin"
    ).read_bytes() == b"original"
    assert result.Recorded is record


@pytest.mark.parametrize(
    "mutation",
    [
        "root",
        "case",
        "target",
        "extra",
        "missing",
        "metadata-bool",
        "metadata-negative",
        "mode",
        "inode-change",
        "fault-target",
        "fault-bytes",
        "fault-order",
        "missing-result",
        "added-audit-field",
    ],
)
def test_complete_audit_and_internal_os_associations_are_load_bearing(
    mutation: str, tmp_path: Path
) -> None:
    record, original = capture(tmp_path, "storage/partial-write")
    value = fixture(record)
    states = [
        row for row in typed_nodes(value, ".FileState") if row["Kind"] == "regular"
    ]
    faults = typed_nodes(value, ".FaultObservation")
    if mutation == "root":
        value["Root"] = str(tmp_path / "arbitrary")
    elif mutation == "case":
        value["CaseId"] = "storage/control"
    elif mutation == "target":
        value["Target"] = "../escape"
    elif mutation == "extra":
        value["Extra"] = 0
    elif mutation == "missing":
        del value["Audit"]
    elif mutation == "metadata-bool":
        states[0]["ModifiedNs"] = True
    elif mutation == "metadata-negative":
        states[0]["ChangedNs"] = -1
    elif mutation == "mode":
        states[0]["Mode"] = 0
    elif mutation == "inode-change":
        states[0]["Inode"] += 1
    elif mutation == "fault-target":
        faults[0]["Inode"] += 1
    elif mutation == "fault-bytes":
        faults[0]["Bytes"] = 2
    elif mutation == "fault-order":
        observations = typed_nodes(value, ".FileCallObservation")
        observations[0]["Faults"].reverse()
    elif mutation == "missing-result":
        observations = typed_nodes(value, ".FileCallObservation")
        observations[0]["ActualResult"] = None
    elif mutation == "added-audit-field":
        value["Audit"]["Unexpected"] = None
    result = replay(tmp_path / "replay", changed(record, value), original)
    assert (
        result.Failure is not None and result.Failure.code == "file-input-mismatch"
    ), result
    assert result.CompletedOperations == result.MatchedCalls == 2
    assert not result.CaseMatched
    assert (original / "file.bin").read_bytes() == b"ori"


def test_valid_distinct_os_values_are_retained_without_cross_root_equality(
    tmp_path: Path,
) -> None:
    record, original = capture(tmp_path, "storage/partial-write")
    value = fixture(record)
    for row in typed_nodes(value, ".FileState"):
        if row["Kind"] != "absent":
            row.update(
                Device=row["Device"] + 1000,
                Inode=row["Inode"] + 2000,
                ModifiedNs=4,
                ChangedNs=5,
                Mode=(row["Mode"] & ~0o777) | 0o400,
            )
    for row in typed_nodes(value, ".FaultObservation"):
        row.update(Device=row["Device"] + 1000, Inode=row["Inode"] + 2000)
    modified = changed(record, value)
    result = replay(tmp_path / "replay", modified, original)
    assert result.CaseMatched and result.Failure is None, result
    assert result.Recorded is modified and fixture(modified) == value


def test_ordinary_exception_is_missing_return_and_keeps_prior_actual_call(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    record, original = capture(tmp_path, "storage/reused-file")
    execute = f.execute_file_call

    class BoundaryFailure(Exception):
        pass

    def call(prepared: f.PreparedFileFixture, index: object) -> object:
        if index == 1:
            raise BoundaryFailure("actual boundary failed")
        return execute(prepared, index)

    monkeypatch.setattr(f, "execute_file_call", call)
    result = replay(tmp_path / "replay", record, original)
    assert result.Failure is not None and result.Failure.code == "file-call-return"
    assert result.CompletedOperations == result.MatchedCalls == 1
    assert len(result.Calls) == 2 and result.Calls[-1].Actual.Returned is None
    assert result.Calls[-1].Actual.RaisedType is not None
    assert result.Calls[-1].Actual.RaisedDetail == "actual boundary failed"


def test_after_audit_failure_retains_return_and_stops_before_second_call(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    record, original = capture(tmp_path, "storage/reused-file")
    execute = f.execute_file_call
    problem = a.Refused("after-observation", "file.bin", "actual late audit failed")

    def call(prepared: f.PreparedFileFixture, index: object) -> object:
        actual = execute(prepared, index)
        assert isinstance(actual, f.FileCallObservation)
        return replace(actual, Failure=problem)

    monkeypatch.setattr(f, "execute_file_call", call)
    result = replay(tmp_path / "replay", record, original)
    assert (
        result.Failure is not None
        and result.CompletedOperations == 1
        and result.MatchedCalls == 0
    )
    assert len(result.Calls) == 1
    observed = result.Calls[0].Actual.Returned
    assert isinstance(observed, f.FileCallObservation) and observed.Failure is problem
    assert isinstance(observed.ActualResult, a.Admitted)


def test_independent_original_path_is_never_read(tmp_path: Path) -> None:
    record, original = capture(tmp_path, "storage/control")
    moved = original.with_name("relocated-owned-original")
    original.rename(moved)
    result = replay(tmp_path / "replay", record, original)
    assert result.CaseMatched and not original.exists()
    assert (moved / "attempt/file.bin").read_bytes() == b"original"


def test_reused_fresh_root_refuses_and_keeps_first_tree(tmp_path: Path) -> None:
    record, original = capture(tmp_path, "storage/control")
    first = replay(tmp_path / "replay", record, original)
    assert first.CaseMatched
    second = r.replay_file_case(
        record,
        tmp_path / "replay",
        fixed_case_id=original.name.replace("-", "/", 1),
        producer_root=original,
    )
    assert second.Failure is not None and second.Failure.code == "file-preparation"
    assert second.CompletedOperations == 0 and not second.Calls
    assert (
        tmp_path / "replay" / original.name / "attempt/file.bin"
    ).read_bytes() == b"original"


@pytest.mark.parametrize("kind", ["float", "bool", "type", "field"])
def test_complete_result_types_and_fields_do_not_coerce(
    kind: str, tmp_path: Path
) -> None:
    record, original = capture(tmp_path, "storage/control")
    value = json.loads(record.Calls[-1].ResultRaw)
    if kind == "float":
        value["Fields"]["value"] = 8.0
    elif kind == "bool":
        value["Fields"]["value"] = True
    elif kind == "type":
        value["Type"] = "untrusted.Admitted"
    elif kind == "field":
        value["Fields"]["unused"] = None
    modified = replace(
        record,
        Calls=(record.Calls[0], replace(record.Calls[-1], ResultRaw=encode(value))),
    )
    result = replay(tmp_path / "replay", modified, original)
    assert result.Failure is not None and result.Failure.code == "file-result-mismatch"
    assert result.CompletedOperations == 2 and result.MatchedCalls == 1
    assert result.Calls[-1].Actual.Returned is not None


def test_encoder_exception_keeps_actual_return_before_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    record, original = capture(tmp_path, "storage/control")

    def fail(_value: object, **_kwargs: object) -> object:
        raise KeyError("actual encoder failed")

    monkeypatch.setattr(encoding, "encode_public_result", fail)
    result = replay(tmp_path / "replay", record, original)
    assert (
        result.Failure is not None
        and result.CompletedOperations == 1
        and result.MatchedCalls == 0
    )
    comparison = result.Calls[0].Comparison
    assert (
        comparison is not None
        and comparison.ActualEncoding.RaisedType == "builtins.KeyError"
    )
    actual = result.Calls[0].Actual.Returned
    assert isinstance(actual, f.FileCallObservation) and isinstance(
        actual.ActualResult, a.Admitted
    )


def test_producer_cannot_change_caller_fixed_case_before_any_operation(
    tmp_path: Path,
) -> None:
    record, original = capture(tmp_path, "storage/control")
    changed_case = replace(record, CaseId="storage/changed-read")
    parent = tmp_path / "replay"
    result = r.replay_file_case(
        changed_case, parent, fixed_case_id="storage/control", producer_root=original
    )
    assert result.Failure is not None and result.Failure.code == "file-case"
    assert result.FixedCaseId == "storage/control" and result.Recorded is changed_case
    assert result.Preparation is None and not result.Calls and not parent.exists()


@pytest.mark.parametrize(
    "bad",
    [
        (None,),
        ("wrong",),
        (c.NamedInput("foreign", b"x"), c.NamedInput("original", b"original")),
        (None, None),
        ("wrong", "wrong"),
    ],
)
def test_malformed_actual_input_return_retains_calls_and_object(
    bad: tuple[object, ...], tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    record, original = capture(tmp_path, "storage/control")
    actual = a.Admitted(bad)
    monkeypatch.setattr(f, "file_fixture_inputs", lambda *_args: actual)
    result = replay(tmp_path / "replay", record, original)
    assert (
        result.Failure is not None
        and result.Failure.code == "file-input-capture-contract"
    )
    assert result.CompletedOperations == result.MatchedCalls == 2
    assert result.ActualInputs is not None and result.ActualInputs.Returned is actual
    assert not result.CaseMatched
