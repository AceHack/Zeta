"""Owned Git/Python fixture replay; no native targets or registered policy tapes."""

from __future__ import annotations

import dataclasses
import json
from pathlib import Path
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_conformance as c
from zeta_interp import hidden_switch_compiled_identity_fixtures as fixtures
from zeta_interp import hidden_switch_compiled_identity_replay as r
from zeta_interp import hidden_switch_compiled_record_encoding as encoding
from zeta_interp import hidden_switch_compiled_storage as storage


def encoded(value: object) -> bytes:
    result = encoding.encode_public_result(value, maximum_bytes=fixtures.FILE_BYTES)
    assert isinstance(result, a.Admitted), result
    return result.value


@pytest.fixture(scope="module")
def python_sources() -> tuple[fixtures.FixtureSource, ...]:
    root = Path(__file__).resolve().parents[1]
    return tuple(
        fixtures.FixtureSource(
            name,
            fixtures.PACKAGE_PATH + "/" + name.rsplit(".", 1)[1] + ".py",
            (root / "zeta_interp" / (name.rsplit(".", 1)[1] + ".py")).read_bytes(),
        )
        for name in (fixtures.COLLECTOR, fixtures.IEEE)
    )


def produce(
    case_id: str, root: Path, python_sources: tuple[fixtures.FixtureSource, ...]
) -> tuple[r.RecordedIdentityCase, fixtures.FixtureReady]:
    supplied = python_sources if case_id in fixtures.PYTHON_CASES else ()
    actual = fixtures.run_identity_fixture(case_id, root, python_sources=supplied)
    assert isinstance(actual, fixtures.FixtureReady), actual
    child = (
        tuple(
            c.NamedInput(role, (root / name).read_bytes())
            for role, name in zip(r.CHILD_ROLES, r.CHILD_FILES, strict=True)
        )
        if case_id in fixtures.PYTHON_CASES
        else ()
    )
    return r.RecordedIdentityCase(
        case_id,
        actual.Inputs,
        actual.Call.Operation,
        actual.Call.InputRoles,
        encoded(actual.Call.Result),
        child,
    ), actual


@pytest.fixture(scope="module")
def originals(
    tmp_path_factory: pytest.TempPathFactory,
    python_sources: tuple[fixtures.FixtureSource, ...],
) -> tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...]:
    parent = tmp_path_factory.mktemp("identity-producer").resolve()
    return tuple(
        produce(case_id, parent / f"case-{index:02d}", python_sources)
        for index, case_id in enumerate(fixtures.CASE_IDS)
    )


def selected(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    case_id: str,
) -> tuple[r.RecordedIdentityCase, fixtures.FixtureReady]:
    return originals[fixtures.CASE_IDS.index(case_id)]


def replay(
    record: r.RecordedIdentityCase,
    original: fixtures.FixtureReady,
    root: Path,
    python_sources: tuple[fixtures.FixtureSource, ...],
) -> r.IdentityReplaySucceeded | r.IdentityReplayFailed:
    return r.replay_identity_case(
        record,
        fixed_case_id=original.CaseId,
        producer_root=original.Root,
        replay_root=root,
        python_sources=python_sources
        if original.CaseId in fixtures.PYTHON_CASES
        else (),
    )


def result_tree(record: r.RecordedIdentityCase) -> dict[str, Any]:
    value = json.loads(record.ResultRaw)
    assert type(value) is dict
    return value


def with_tree(
    record: r.RecordedIdentityCase, tree: dict[str, Any]
) -> r.RecordedIdentityCase:
    return dataclasses.replace(record, ResultRaw=encoded(tree))


@pytest.mark.parametrize("case_id", fixtures.CASE_IDS)
def test_every_fixed_case_reexecutes_real_fixture_with_complete_return(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    python_sources: tuple[fixtures.FixtureSource, ...],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    case_id: str,
) -> None:
    record, producer = selected(originals, case_id)
    calls: list[object] = []
    original = fixtures.run_identity_fixture

    def run(
        case: object,
        root: Path,
        *,
        python_sources: tuple[fixtures.FixtureSource, ...] = (),
    ) -> object:
        assert case == case_id
        result = original(case, root, python_sources=python_sources)
        calls.append(result)
        return result

    monkeypatch.setattr(fixtures, "run_identity_fixture", run)
    result = replay(record, producer, tmp_path / "fresh", python_sources)
    assert isinstance(result, r.IdentityReplaySucceeded), result
    assert result.Counts == r.Counts(1, 1, 1, 1) and len(calls) == 1
    assert result.Cases[0].Actual.Returned is calls[0]
    assert result.OuterSourceAndRuntimeAdmission == "not-performed"
    assert result.Scope == "one-fixed-identity-case-only"
    assert result.Cases[0].Association is not None
    assert (tmp_path / "fresh/manifest.json").is_file()
    if case_id in fixtures.PYTHON_CASES:
        assert len(result.Cases[0].ChildReads) == 3
        assert all(
            row.Outcome is not None and isinstance(row.Outcome.Returned, a.Admitted)
            for row in result.Cases[0].ChildReads
        )


def test_complete_fifteen_roster_and_actual_prefix_counts(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    python_sources: tuple[fixtures.FixtureSource, ...],
    tmp_path: Path,
) -> None:
    records = tuple(record for record, _ in originals)
    roots = tuple(r.ProducerRoot(actual.CaseId, actual.Root) for _, actual in originals)
    result = r.replay_identity_cases(
        records, tmp_path, producer_roots=roots, python_sources=python_sources
    )
    assert isinstance(result, r.IdentityReplaySucceeded), result
    assert result.Counts == r.Counts(15, 15, 15, 15)
    assert [case.CaseId for case in result.Cases] == list(fixtures.CASE_IDS)
    assert result.Scope == "fifteen-fixed-identity-cases-only"
    stored = encoding.encode_public_result(result, maximum_bytes=32 * 1024 * 1024)
    assert isinstance(stored, a.Admitted), stored


@pytest.mark.parametrize("kind", ("missing", "extra", "late-malformed"))
def test_late_roster_or_result_failure_retains_real_completed_prefix(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    python_sources: tuple[fixtures.FixtureSource, ...],
    tmp_path: Path,
    kind: str,
) -> None:
    records = tuple(record for record, _ in originals)
    roots = tuple(r.ProducerRoot(actual.CaseId, actual.Root) for _, actual in originals)
    if kind == "missing":
        records = records[:-1]
    elif kind == "extra":
        records = (*records, records[0])
    else:
        records = (
            *records[:-1],
            dataclasses.replace(records[-1], ResultRaw=b'{"a":0,"a":0}'),
        )
    result = r.replay_identity_cases(
        records, tmp_path, producer_roots=roots, python_sources=python_sources
    )
    assert isinstance(result, r.IdentityReplayFailed)
    assert result.Counts == (
        r.Counts(14, 14, 14, 14)
        if kind == "missing"
        else r.Counts(15, 15, 15, 15 if kind == "extra" else 14)
    )
    assert all(
        isinstance(case.Actual.Returned, fixtures.FixtureReady) for case in result.Cases
    )


@pytest.mark.parametrize(
    "kind", ("mutation", "input-whitespace", "operation", "case-label", "input-role")
)
def test_producer_cannot_choose_mutation_bytes_or_dispatch(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    python_sources: tuple[fixtures.FixtureSource, ...],
    tmp_path: Path,
    kind: str,
) -> None:
    record, producer = selected(originals, "source/control")
    if kind in ("mutation", "input-whitespace"):
        inputs = list(record.Inputs)
        if kind == "mutation":
            tree = json.loads(inputs[0].Raw)
            tree["Mutation"] = "../execute"
            inputs[0] = c.NamedInput("fixture", encoded(tree))
        else:
            inputs[0] = c.NamedInput("fixture", b" " + inputs[0].Raw)
        record = dataclasses.replace(record, Inputs=tuple(inputs))
    elif kind == "operation":
        record = dataclasses.replace(record, Operation="os.system")
    elif kind == "case-label":
        record = dataclasses.replace(record, CaseId="python/foreign-entry")
    else:
        record = dataclasses.replace(record, InputRoles=("expected", "fixture"))
    result = replay(record, producer, tmp_path / "fresh", python_sources)
    assert isinstance(result, r.IdentityReplayFailed) and result.Counts == r.Counts(
        1, 1, 1, 0
    )
    actual = result.Cases[0].Actual.Returned
    assert (
        isinstance(actual, fixtures.FixtureReady) and actual.CaseId == "source/control"
    )


@pytest.mark.parametrize(
    "kind", ("wrong-refusal", "unexpected-success", "changed-blob", "bool-bytes")
)
def test_complete_source_result_is_compared_exactly(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    python_sources: tuple[fixtures.FixtureSource, ...],
    tmp_path: Path,
    kind: str,
) -> None:
    case_id = (
        "source/current-bytes"
        if kind in ("wrong-refusal", "unexpected-success")
        else "source/control"
    )
    record, producer = selected(originals, case_id)
    tree = result_tree(record)
    if kind == "wrong-refusal":
        tree["Fields"]["code"] = "archive-hash"
    elif kind == "unexpected-success":
        tree = result_tree(selected(originals, "source/control")[0])
    else:
        tree["Fields"]["value"][0]["Fields"][
            "Blob" if kind == "changed-blob" else "Bytes"
        ] = "0" * 40 if kind == "changed-blob" else True
    result = replay(
        with_tree(record, tree), producer, tmp_path / "fresh", python_sources
    )
    assert (
        isinstance(result, r.IdentityReplayFailed)
        and result.Failure.code == "identity-result-mismatch"
    )
    assert result.Counts.CompletedOperations == 1


@pytest.mark.parametrize(
    "kind",
    (
        "missing-stdout",
        "missing-trace",
        "extra-trace",
        "wrong-return",
        "wrong-foreign-path",
    ),
)
def test_original_child_artifacts_must_bind_own_result_and_fixed_module_paths(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    python_sources: tuple[fixtures.FixtureSource, ...],
    tmp_path: Path,
    kind: str,
) -> None:
    record, producer = selected(originals, "python/foreign-entry")
    children = list(record.ChildArtifacts)
    if kind == "missing-stdout":
        children[0] = c.NamedInput("stdout", b"")
    elif kind == "missing-trace":
        children.pop()
    elif kind == "extra-trace":
        children[2] = c.NamedInput("trace", children[2].Raw + b"{}\n")
    else:
        lines = [json.loads(line) for line in children[2].Raw.splitlines()]
        if kind == "wrong-return":
            lines[1]["Result"]["Fields"]["Code"] = "ModuleMissing"
        else:
            for phase in ("Before", "After"):
                for row in lines[0][phase]:
                    if row["Name"] == fixtures.ENTRY:
                        row["File"] = row["File"].replace("/B/", "/A/")
        children[2] = c.NamedInput("trace", b"".join(encoded(line) for line in lines))
    result = replay(
        dataclasses.replace(record, ChildArtifacts=tuple(children)),
        producer,
        tmp_path / "fresh",
        python_sources,
    )
    assert isinstance(result, r.IdentityReplayFailed) and result.Counts == r.Counts(
        1, 1, 1, 0
    )
    assert len(result.Cases[0].ChildReads) == 3


@pytest.mark.parametrize(
    "kind",
    (
        "bool-pid",
        "wrong-directory",
        "wrong-module-path",
        "wrong-cache-path",
        "wrong-environment",
    ),
)
def test_only_enumerated_valid_path_and_pid_associations_are_allowed(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    python_sources: tuple[fixtures.FixtureSource, ...],
    tmp_path: Path,
    kind: str,
) -> None:
    record, producer = selected(originals, "python/control")
    tree = result_tree(record)
    row = tree["Fields"]
    if kind == "bool-pid":
        row["Process"]["Fields"]["Pid"] = True
    elif kind == "wrong-directory":
        row["Process"]["Fields"]["Directory"] += "-foreign"
    elif kind == "wrong-environment":
        row["Process"]["Fields"]["Environment"][0][1] = "unrelated"
    elif kind == "wrong-module-path":
        row["CollectorResult"]["Fields"]["value"]["Modules"][0]["AbsolutePath"] = (
            producer.Root + "/B/" + fixtures.PACKAGE_PATH + "/__init__.py"
        )
    else:
        row["CollectorResult"]["Fields"]["value"]["Modules"][0]["CachedPath"] = (
            producer.Root + "/elsewhere.pyc"
        )
    result = replay(
        with_tree(record, tree), producer, tmp_path / "fresh", python_sources
    )
    assert (
        isinstance(result, r.IdentityReplayFailed)
        and result.Counts.CompletedOperations == 1
    )


def test_internally_consistent_false_interpreter_identity_still_refuses(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    python_sources: tuple[fixtures.FixtureSource, ...],
    tmp_path: Path,
) -> None:
    record, producer = selected(originals, "python/control")
    tree = result_tree(record)
    collector = tree["Fields"]["CollectorResult"]
    collector["Fields"]["value"]["Interpreter"]["Version"] = "fabricated version"
    children = list(record.ChildArtifacts)
    stdout = json.loads(children[0].Raw)
    stdout["Result"] = collector
    lines = [json.loads(line) for line in children[2].Raw.splitlines()]
    lines[1]["Result"] = collector
    children[0] = c.NamedInput("stdout", encoded(stdout))
    children[2] = c.NamedInput("trace", b"".join(encoded(line) for line in lines))
    changed = dataclasses.replace(
        with_tree(record, tree), ChildArtifacts=tuple(children)
    )
    result = replay(changed, producer, tmp_path / "fresh", python_sources)
    assert (
        isinstance(result, r.IdentityReplayFailed)
        and result.Failure.code == "identity-result-mismatch"
    )


@pytest.mark.parametrize("after_return", (False, True))
def test_actual_child_crash_is_incomplete_even_when_collector_return_survives(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    python_sources: tuple[fixtures.FixtureSource, ...],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    after_return: bool,
) -> None:
    record, producer = selected(originals, "python/control")
    crash = b"raise RuntimeError('retained actual fixture crash')\n"
    monkeypatch.setattr(
        fixtures, "_ENTRY", (fixtures._ENTRY if after_return else b"") + crash
    )
    result = replay(record, producer, tmp_path / "fresh", python_sources)
    assert isinstance(result, r.IdentityReplayFailed) and result.Counts == r.Counts(
        1, 1, 0, 0
    )
    actual = result.Cases[0].Actual.Returned
    assert isinstance(actual, fixtures.FixtureFailed) and isinstance(
        actual.ObservedOutcome, fixtures.PythonChildOutcome
    )
    if after_return:
        assert (
            actual.ObservedOutcome.CollectorReturns == 1
            and actual.ObservedOutcome.CollectorResult is not None
        )
    assert (tmp_path / "fresh/process-0001.stderr").read_bytes()


@pytest.mark.parametrize("failure", ("encoding", "read"))
def test_actual_return_survives_later_encoder_or_read_failure(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    python_sources: tuple[fixtures.FixtureSource, ...],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    failure: str,
) -> None:
    record, producer = selected(originals, "python/control")
    original = fixtures.run_identity_fixture
    observed: list[object] = []
    refusal = a.Refused(
        "injected-late", "AfterReturn", "actual operation already returned"
    )

    def run(
        case: object,
        root: Path,
        *,
        python_sources: tuple[fixtures.FixtureSource, ...] = (),
    ) -> object:
        result = original(case, root, python_sources=python_sources)
        assert isinstance(result, fixtures.FixtureReady)
        observed.append(result)
        if failure == "encoding":
            monkeypatch.setattr(
                encoding, "encode_public_result", lambda *args, **kwargs: refusal
            )
        else:
            monkeypatch.setattr(storage, "read_exact", lambda *args, **kwargs: refusal)
        return result

    monkeypatch.setattr(fixtures, "run_identity_fixture", run)
    result = replay(record, producer, tmp_path / "fresh", python_sources)
    assert isinstance(result, r.IdentityReplayFailed) and result.Counts == r.Counts(
        1, 1, 1, 0
    )
    assert result.Cases[0].Actual.Returned is observed[0]
    if failure == "encoding":
        assert result.Cases[0].Helpers[-1].Returned is refusal
    else:
        assert result.Cases[0].ChildReads[-1].Outcome is not None
        assert result.Cases[0].ChildReads[-1].Outcome.Returned is refusal


def test_original_root_need_not_exist_and_is_never_read(
    python_sources: tuple[fixtures.FixtureSource, ...], tmp_path: Path
) -> None:
    record, producer = produce("python/control", tmp_path / "producer", python_sources)
    (tmp_path / "producer").rename(tmp_path / "retained-original-elsewhere")
    assert isinstance(
        replay(record, producer, tmp_path / "fresh", python_sources),
        r.IdentityReplaySucceeded,
    )


def test_existing_replay_root_is_not_adopted_or_overwritten(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    python_sources: tuple[fixtures.FixtureSource, ...],
    tmp_path: Path,
) -> None:
    root = tmp_path / "existing"
    root.mkdir()
    (root / "prior").write_bytes(b"retain")
    record, producer = selected(originals, "source/control")
    result = replay(record, producer, root, python_sources)
    assert isinstance(result, r.IdentityReplayFailed) and result.Counts == r.Counts(
        1, 1, 0, 0
    )
    assert (root / "prior").read_bytes() == b"retain"


@pytest.mark.parametrize("case", (None, False, "python/unknown", "../source/control"))
def test_invalid_caller_selectors_do_not_launch_fixture(
    tmp_path: Path, case: object
) -> None:
    result = r.replay_identity_case(
        None,
        fixed_case_id=case,
        producer_root="/original",
        replay_root=tmp_path / "fresh",
    )
    assert isinstance(result, r.IdentityReplayFailed) and result.Counts == r.Counts(
        0, 0, 0, 0
    )
    assert not (tmp_path / "fresh").exists()


@pytest.mark.parametrize("relationship", ("equal", "ancestor", "descendant"))
def test_original_replay_overlap_refuses_before_any_write(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    python_sources: tuple[fixtures.FixtureSource, ...],
    relationship: str,
) -> None:
    record, producer = selected(originals, "source/control")
    target = Path(producer.Root)
    if relationship == "ancestor":
        target = target.parent
    elif relationship == "descendant":
        target = target / "nested"
    result = replay(record, producer, target, python_sources)
    assert (
        isinstance(result, r.IdentityReplayFailed)
        and result.Failure.code == "identity-root-overlap"
    )
    assert result.Counts == r.Counts(0, 0, 0, 0)


def test_raw_result_whitespace_does_not_change_typed_equivalence(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    python_sources: tuple[fixtures.FixtureSource, ...],
    tmp_path: Path,
) -> None:
    record, producer = selected(originals, "source/control")
    record = dataclasses.replace(record, ResultRaw=b" \n" + record.ResultRaw + b"\t ")
    assert isinstance(
        replay(record, producer, tmp_path / "fresh", python_sources),
        r.IdentityReplaySucceeded,
    )


def test_moved_original_cannot_be_regenerated_at_its_old_name(
    python_sources: tuple[fixtures.FixtureSource, ...], tmp_path: Path
) -> None:
    record, producer = produce("source/control", tmp_path / "producer", python_sources)
    (tmp_path / "producer").rename(tmp_path / "retained-original")
    result = replay(record, producer, tmp_path / "producer", python_sources)
    assert (
        isinstance(result, r.IdentityReplayFailed)
        and result.Failure.code == "identity-root-overlap"
    )
    assert result.Counts == r.Counts(0, 0, 0, 0)
    assert not (tmp_path / "producer").exists()
    assert (tmp_path / "retained-original/repository/a.py").read_bytes() == b"A = 1\n"


def test_every_target_is_checked_against_every_original_before_launch(
    originals: tuple[tuple[r.RecordedIdentityCase, fixtures.FixtureReady], ...],
    python_sources: tuple[fixtures.FixtureSource, ...],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    roots = [r.ProducerRoot(actual.CaseId, actual.Root) for _, actual in originals]
    roots[-1] = r.ProducerRoot(fixtures.CASE_IDS[-1], str(tmp_path / "case-00"))
    monkeypatch.setattr(
        fixtures,
        "run_identity_fixture",
        lambda *args, **kwargs: pytest.fail(
            "fixture launched before complete overlap admission"
        ),
    )
    result = r.replay_identity_cases(
        tuple(record for record, _ in originals),
        tmp_path,
        producer_roots=tuple(roots),
        python_sources=python_sources,
    )
    assert (
        isinstance(result, r.IdentityReplayFailed)
        and result.Failure.code == "identity-root-overlap"
    )
    assert result.Counts == r.Counts(0, 0, 0, 0)
    assert not (tmp_path / "case-00").exists()
