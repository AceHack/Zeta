"""Actual owned Git and Python children; no policies or registered source tapes."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_identity_fixtures as f
from zeta_interp import hidden_switch_compiled_storage as storage


@pytest.fixture
def python_sources() -> tuple[f.FixtureSource, ...]:
    root = Path(__file__).resolve().parents[1]
    return tuple(
        f.FixtureSource(
            name,
            f.PACKAGE_PATH + "/" + name.rsplit(".", 1)[1] + ".py",
            (root / "zeta_interp" / (name.rsplit(".", 1)[1] + ".py")).read_bytes(),
        )
        for name in (f.COLLECTOR, f.IEEE)
    )


def _ready(result: f.FixtureReady | f.FixtureFailed) -> f.FixtureReady:
    assert isinstance(result, f.FixtureReady), result
    return result


def _read_inputs(result: f.FixtureReady) -> tuple[dict[str, Any], dict[str, Any]]:
    assert tuple(item.Role for item in result.Inputs) == ("fixture", "expected")
    return json.loads(result.Inputs[0].Raw), json.loads(result.Inputs[1].Raw)


def _verify_inventory(result: f.FixtureReady) -> None:
    root = Path(result.Root)
    manifest = json.loads((root / "manifest.json").read_bytes())
    files = manifest["Files"]
    assert len(files) == len({item["File"] for item in files})
    assert set(result.TraceFiles) == {item["File"] for item in files} | {
        "manifest.json"
    }
    for item in files:
        raw = (root / item["File"]).read_bytes()
        assert len(raw) == item["Bytes"]
        assert hashlib.sha256(raw).hexdigest().upper() == item["Sha256"]


@pytest.mark.parametrize("case", f.SOURCE_CASES)
def test_all_seven_real_git_cases_retain_exact_input_and_actual_outcome(
    tmp_path: Path,
    case: str,
) -> None:
    result = _ready(f.run_identity_fixture(case, tmp_path / "case"))
    assert result.CompletedOperation == 1
    assert result.Call.Operation == "verify-source-files"
    assert result.Call.InputRoles == ("fixture", "expected")
    fixture, expected = _read_inputs(result)
    repo = Path(fixture["Repository"])
    assert (repo / ".git" / "objects").is_dir()
    assert fixture["InitialFiles"][0]["Raw"] == {"BytesHex": b"A = 1\n".hex().upper()}
    assert fixture["InitialFiles"][1]["Raw"] == {"BytesHex": b"B = 2\n".hex().upper()}
    outcome = result.Call.Result
    if case == "source/control":
        assert isinstance(outcome, a.Admitted)
        assert [row.File for row in outcome.value] == ["a.py", "b.py"]
        assert all(row.Commit == expected["Commit"] for row in outcome.value)
        assert all(len(row.Blob) == 40 for row in outcome.value)
    else:
        assert isinstance(outcome, a.Refused)
        codes = {
            "source/current-bytes": "source-bytes",
            "source/wrong-archive": "archive-hash",
            "source/omitted-helper": "source-roster",
            "source/reordered": "source-order",
            "source/unarchived-helper": "archive-file",
            "source/symlink": "file-read",
        }
        assert outcome.code == codes[case], outcome
    if case == "source/wrong-archive":
        assert fixture["BaselineCommit"] != expected["Commit"]
        assert (repo / "a.py").read_bytes() == b"A = 1\n"
        assert (repo / "a.changed").read_bytes() == b"A = 3\n"
    if case == "source/symlink":
        assert (repo / "a.py").is_symlink()
        assert os.readlink(repo / "a.py") == "a.original"
    _verify_inventory(result)


@pytest.mark.parametrize("case", f.PYTHON_CASES)
def test_all_eight_actual_module_children_preserve_entry_and_mutation_scope(
    tmp_path: Path,
    python_sources: tuple[f.FixtureSource, ...],
    case: str,
) -> None:
    result = _ready(
        f.run_identity_fixture(case, tmp_path / "case", python_sources=python_sources)
    )
    assert (
        result.CompletedOperation == 1
        and result.Call.Operation == "python-identity-child"
    )
    outcome = result.Call.Result
    assert isinstance(outcome, f.PythonChildOutcome)
    assert outcome.CollectorEntries == outcome.CollectorReturns == 1
    assert outcome.Process.ReturnCode == 0 and outcome.Process.Signal is None
    assert not outcome.Process.TimedOut and outcome.Process.Error is None
    assert outcome.Process.Arguments[-2:] == ("-m", f.ENTRY)
    assert outcome.Process.DeadlineSeconds == 30
    root = Path(result.Root)
    assert (root / outcome.Process.Stderr).read_bytes() == b""
    record = outcome.CollectorResult
    assert isinstance(record, dict)
    trace = [
        json.loads(line) for line in (root / outcome.Trace).read_bytes().splitlines()
    ]
    assert trace[1]["Result"] == record
    facts = {row["Name"]: row for row in trace[0]["After"]}
    fixture, expected = _read_inputs(result)
    first, second = fixture["Clones"]["A"], fixture["Clones"]["B"]
    if case == "python/control":
        assert record["Type"] == f.IEEE + ".Success"
        assert record["Fields"]["value"]["EntryAdmitted"] is True
        assert record["Fields"]["value"]["EntryModule"] == f.ENTRY
    else:
        assert record["Type"] == f.IEEE + ".Failure"
        code = {
            "python/foreign-entry": "ModuleOrigin",
            "python/foreign-helper": "ModuleOrigin",
            "python/missing-helper": "ModuleMissing",
            "python/unlisted-module": "UnlistedModule",
            "python/dynamic-module": "ModuleIdentity",
            "python/changed-origin": "ModuleOrigin",
            "python/changed-bytes": "SourceBytes",
        }[case]
        assert record["Fields"]["Code"] == code
    if case in ("python/foreign-entry", "python/foreign-helper"):
        foreign = f.ENTRY if case.endswith("entry") else f.HELPER
        assert facts[foreign]["File"].startswith(second + "/")
        assert all(
            row["File"].startswith(first + "/")
            for name, row in facts.items()
            if name != foreign
        )
        # The refusal must name the isolated foreign subject, not the package.
        assert record["Fields"]["Message"].endswith(foreign)
    elif case == "python/changed-origin":
        assert facts[f.HELPER]["File"].startswith(first + "/")
        assert facts[f.HELPER]["SpecOrigin"].startswith(second + "/")
    elif case == "python/unlisted-module":
        assert f.EXTRA in facts and f.EXTRA not in expected["Modules"]
    elif case == "python/changed-bytes":
        assert (root / "helper-before-mutation.py").read_bytes() == b"VALUE = 7\n"
        assert (
            Path(first) / f.PACKAGE_PATH / "hidden_switch_fixture_helper.py"
        ).read_bytes() == b"VALUE = 8\n"
    assert set(expected["Modules"]) == {
        "zeta_interp",
        f.COLLECTOR,
        f.IEEE,
        f.ENTRY,
        f.HELPER,
    }
    _verify_inventory(result)


def test_reused_case_is_refused_without_changing_any_preserved_byte(
    tmp_path: Path,
) -> None:
    result = _ready(f.run_identity_fixture("source/control", tmp_path / "case"))
    before = {p: (Path(result.Root) / p).read_bytes() for p in result.TraceFiles}
    refused = f.run_identity_fixture("source/current-bytes", tmp_path / "case")
    assert isinstance(refused, f.FixtureFailed)
    assert refused.CompletedOperation == 0 and refused.Code == "existing-output"
    assert before == {
        p: (Path(result.Root) / p).read_bytes() for p in result.TraceFiles
    }


@pytest.mark.parametrize("case", [None, True, "python/unknown", "../escape"])
def test_unknown_cases_refuse_before_creating_output(
    tmp_path: Path, case: object
) -> None:
    result = f.run_identity_fixture(case, tmp_path / "case")
    assert isinstance(result, f.FixtureFailed) and result.Code == "FixtureCase"
    assert result.Root is None and not (tmp_path / "case").exists()


def test_invalid_roots_and_missing_sources_are_typed(tmp_path: Path) -> None:
    for root in (
        Path("relative"),
        Path(str(tmp_path) + "/nul\0root"),
        tmp_path / "missing" / "case",
    ):
        result = f.run_identity_fixture("source/control", root)
        assert isinstance(result, f.FixtureFailed)
        assert result.CompletedOperation == 0
    result = f.run_identity_fixture("python/control", tmp_path / "case")
    assert isinstance(result, f.FixtureFailed) and result.Code == "FixtureSources"


def test_real_child_crash_is_preserved_without_claiming_a_completed_operation(
    tmp_path: Path,
    python_sources: tuple[f.FixtureSource, ...],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(f, "_ENTRY", b"raise RuntimeError('owned fixture crash')\n")
    result = f.run_identity_fixture(
        "python/control", tmp_path / "case", python_sources=python_sources
    )
    assert isinstance(result, f.FixtureFailed)
    assert (
        result.Code == "PythonChild"
        and result.CompletedOperation == 0
        and result.Call is None
    )
    assert isinstance(result.ObservedOutcome, f.PythonChildOutcome)
    process = result.ObservedOutcome.Process
    assert process.ReturnCode == 1 and process.Pid is not None
    assert result.Root is not None
    assert b"owned fixture crash" in (Path(result.Root) / process.Stderr).read_bytes()
    assert (Path(result.Root) / process.Stdout).read_bytes() == b""
    assert "fixture.json" in result.TraceFiles and "expected.json" in result.TraceFiles


def test_missing_child_result_is_an_incomplete_operation(
    tmp_path: Path,
    python_sources: tuple[f.FixtureSource, ...],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(f, "_ENTRY", b"print('{}')\n")
    result = f.run_identity_fixture(
        "python/control", tmp_path / "case", python_sources=python_sources
    )
    assert isinstance(result, f.FixtureFailed)
    assert result.Code == "ChildSchema" and result.CompletedOperation == 0
    assert isinstance(result.ObservedOutcome, f.PythonChildOutcome)
    assert result.ObservedOutcome.Process.ReturnCode == 0


def test_returned_source_refusal_is_retained_if_later_record_write_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = f._Run.event

    def fail_return(self: f._Run, kind: str, value: object) -> None:
        if kind == "operation-return":
            raise OSError("owned result-record failure")
        original(self, kind, value)

    monkeypatch.setattr(f._Run, "event", fail_return)
    result = f.run_identity_fixture("source/current-bytes", tmp_path / "case")
    assert isinstance(result, f.FixtureFailed) and result.CompletedOperation == 1
    assert result.Call is not None and isinstance(result.Call.Result, a.Refused)
    assert result.Call.Result.code == "source-bytes"
    assert "owned result-record failure" in result.Detail
    assert result.Inputs and result.Root
    assert (Path(result.Root) / "repository" / "a.py").read_bytes() == b"A = 3\n"


def test_real_child_timeout_keeps_output_and_zero_completed_operations(
    tmp_path: Path,
    python_sources: tuple[f.FixtureSource, ...],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(f, "DEADLINE_SECONDS", 1)
    monkeypatch.setattr(
        f, "_ENTRY", b"import time\nprint('owned prefix', flush=True)\ntime.sleep(60)\n"
    )
    result = f.run_identity_fixture(
        "python/control", tmp_path / "case", python_sources=python_sources
    )
    assert isinstance(result, f.FixtureFailed) and result.CompletedOperation == 0
    assert result.Call is None and isinstance(
        result.ObservedOutcome, f.PythonChildOutcome
    )
    process = result.ObservedOutcome.Process
    assert process.TimedOut and process.ReturnCode == -9 and process.Signal == 9
    assert result.Root is not None
    assert (Path(result.Root) / process.Stdout).read_bytes() == b"owned prefix\n"


def test_actual_close_then_error_is_not_retried_and_keeps_returned_collector(
    tmp_path: Path,
    python_sources: tuple[f.FixtureSource, ...],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    closed: list[int] = []
    original = f._close_descriptor

    def uncertain(descriptor: int) -> None:
        closed.append(descriptor)
        original(descriptor)
        if len(closed) == 1:
            raise OSError("owned post-close error")

    monkeypatch.setattr(f, "_close_descriptor", uncertain)
    result = f.run_identity_fixture(
        "python/control", tmp_path / "case", python_sources=python_sources
    )
    assert isinstance(result, f.FixtureFailed) and result.Code == "DescriptorCleanup"
    assert result.CompletedOperation == 1 and result.Call is not None
    assert len(closed) == 2 and len(set(closed)) == 2
    outcome = result.Call.Result
    assert isinstance(outcome, f.PythonChildOutcome) and outcome.CollectorReturns == 1
    assert outcome.Process.CleanupErrors == ("close: owned post-close error",)


def test_created_root_is_retained_if_creation_cleanup_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = storage.create_directory

    def fail_after_create(parent: Path, relative: str) -> a.Admission[str]:
        result = original(parent, relative)
        assert isinstance(result, a.Admitted)
        return a.Refused("descriptor-cleanup", relative, "owned post-create error")

    monkeypatch.setattr(storage, "create_directory", fail_after_create)
    root = tmp_path / "case"
    result = f.run_identity_fixture("source/control", root)
    assert isinstance(result, f.FixtureFailed) and result.Root == str(root)
    assert result.CompletedOperation == 0 and root.is_dir()
    assert result.TraceFiles and "owned post-create error" in result.Detail


@pytest.mark.parametrize("corruption", ["entries-bool", "trace-bool", "trace-missing"])
def test_child_count_and_trace_corruption_never_count_as_completed(
    tmp_path: Path,
    python_sources: tuple[f.FixtureSource, ...],
    monkeypatch: pytest.MonkeyPatch,
    corruption: str,
) -> None:
    if corruption == "entries-bool":
        source = f._ENTRY.replace(
            b'print(json.dumps({"CollectorEntries": 1',
            b'print(json.dumps({"CollectorEntries": True',
        )
    elif corruption == "trace-bool":
        source = f._ENTRY.replace(
            b'"Return": 1, "Result": encoded', b'"Return": True, "Result": encoded'
        )
    else:
        source = f._ENTRY.replace(
            b'trace.write(json.dumps({"Kind": "collector-return"',
            b'# trace.write(json.dumps({"Kind": "collector-return"',
        )
    assert source != f._ENTRY
    monkeypatch.setattr(f, "_ENTRY", source)
    result = f.run_identity_fixture(
        "python/control", tmp_path / "case", python_sources=python_sources
    )
    assert isinstance(result, f.FixtureFailed)
    assert result.CompletedOperation == 0 and result.Call is None
    assert isinstance(result.ObservedOutcome, f.PythonChildOutcome)
    assert result.ObservedOutcome.Process.ReturnCode == 0
    assert result.Code in ("ChildEntries", "ChildTrace")
