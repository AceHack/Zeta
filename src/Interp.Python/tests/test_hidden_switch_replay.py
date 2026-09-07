"""Synthetic admission fixtures are never registered experiment measurements."""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from zeta_interp import hidden_switch_replay as subject


def roster_fixture():
    def episode(index):
        return {"Index": index, "Complete": True, "Failure": None}

    behavior = {
        "Panels": [
            {
                "Config": dict(config),
                "Arms": [
                    {
                        "Name": arm,
                        "Complete": True,
                        "Failure": None,
                        "Episodes": [episode(index) for index in range(1024)],
                    }
                    for arm in subject.ARMS
                ],
            }
            for config in subject.PANELS
        ]
    }
    cost = {
        "SourceDraws": 2448,
        "Payload": copy.deepcopy(subject.PAYLOAD),
        "QuietWindowDeclaration": "synthetic admission fixture, no timings",
        "HostActivity": "not a host measurement",
        "Rows": [
            {
                "Replicate": replicate,
                "Order": order,
                "Name": subject.ARMS[(replicate + order) % 4],
                "WallMsTotal": 64.0,
                "CpuMsTotal": 0.0,
                "AllocatedBytesTotal": 6400,
                "WarmupEpisodes": [episode(index) for index in range(8)],
                "TimedEpisodes": [episode(index) for index in range(8, 72)],
            }
            for replicate in range(5)
            for order in range(4)
        ],
    }
    return behavior, cost


@pytest.mark.parametrize(
    "raw",
    [
        b'{"Complete":true,"Complete":false}',
        b'{"x":{"y":1,"y":2}}',
        b'{"x":NaN}',
        b'{"x":Infinity}',
        b'{"x":-Infinity}',
        b'{"x":1e400}',
    ],
)
def test_json_rejects_duplicate_and_nonfinite_receipts(raw):
    with pytest.raises(ValueError):
        subject.strict_json(raw)


def test_complete_roster_admission_counts_all_rows_without_generating_tapes(
    monkeypatch,
):
    monkeypatch.setattr(
        subject.reference,
        "source_tapes",
        lambda *args: pytest.fail("roster admission generated a stochastic source"),
    )
    behavior, cost = roster_fixture()
    subject.admitted_rosters(behavior, cost)


@pytest.mark.parametrize(
    "mutation",
    (
        "missing-panel",
        "swapped-arm",
        "missing-episode",
        "duplicate-index",
        "boolean-index",
        "failed-arm",
        "failed-episode",
        "changed-model",
        "missing-cost-row",
        "wrong-rotation",
        "missing-warmup",
        "missing-timed",
        "wrong-cost-index",
        "zero-wall",
        "nan-cpu",
        "fractional-bytes",
        "boolean-cost",
        "missing-payload",
        "wrong-payload",
        "wrong-draws",
        "empty-activity",
    ),
)
def test_roster_corruptions_refuse_before_reference_execution(mutation):
    behavior, cost = roster_fixture()
    panel = behavior["Panels"][0]
    arm = panel["Arms"][0]
    row = cost["Rows"][0]
    match mutation:
        case "missing-panel":
            behavior["Panels"].pop()
        case "swapped-arm":
            panel["Arms"].reverse()
        case "missing-episode":
            arm["Episodes"].pop()
        case "duplicate-index":
            arm["Episodes"][1]["Index"] = 0
        case "boolean-index":
            arm["Episodes"][1]["Index"] = True
        case "failed-arm":
            arm["Complete"] = False
        case "failed-episode":
            arm["Episodes"][0]["Failure"] = {"Code": "fixture"}
        case "changed-model":
            panel["Config"]["Effect"] = False
        case "missing-cost-row":
            cost["Rows"].pop()
        case "wrong-rotation":
            row["Name"] = subject.ARMS[1]
        case "missing-warmup":
            row["WarmupEpisodes"].pop()
        case "missing-timed":
            row["TimedEpisodes"].pop()
        case "wrong-cost-index":
            row["TimedEpisodes"][0]["Index"] = 0
        case "zero-wall":
            row["WallMsTotal"] = 0
        case "nan-cpu":
            row["CpuMsTotal"] = float("nan")
        case "fractional-bytes":
            row["AllocatedBytesTotal"] = 6400.5
        case "boolean-cost":
            row["CpuMsTotal"] = True
        case "missing-payload":
            del cost["Payload"]
        case "wrong-payload":
            cost["Payload"][0]["BeliefFloat64Slots"] = 0
        case "wrong-draws":
            cost["SourceDraws"] = 0
        case "empty-activity":
            cost["HostActivity"] = " "
    with pytest.raises(ValueError):
        subject.admitted_rosters(behavior, cost)


@pytest.mark.parametrize("bad", [True, float("nan"), 0.5 + 2e-10, "0.5"])
def test_numeric_replay_requires_finite_typed_values_and_tolerance(bad):
    with pytest.raises(ValueError):
        subject.compare_episode({"Belief": bad}, {"Belief": 0.5})


def test_replay_never_uses_numeric_tolerance_for_discrete_actions_or_shape():
    subject.compare_episode({"Belief": 0.5 + 1e-11}, {"Belief": 0.5})
    for actual in (
        {"Action": 0.0},
        {"Action": False},
        {"Action": 1},
        {"Action": 0, "extra": 0},
    ):
        with pytest.raises(ValueError):
            subject.compare_episode(actual, {"Action": 0})


def test_exclusive_receipts_preserve_existing_output_and_interrupted_partial(tmp_path):
    output = tmp_path / "receipt.json"
    subject.write_new(output, {"Complete": False, "Failure": "retained"})
    original = output.read_bytes()
    with pytest.raises(ValueError):
        subject.write_new(output, {"Complete": True})
    assert output.read_bytes() == original
    interrupted = tmp_path / "interrupted.json"
    partial = interrupted.with_name(interrupted.name + ".partial")
    partial.write_bytes(b"interrupted original")
    with pytest.raises(ValueError):
        subject.write_new(interrupted, {"Complete": True})
    assert partial.read_bytes() == b"interrupted original"
    assert not interrupted.exists()


def test_exclusive_final_creation_cannot_overwrite_a_racing_writer(
    tmp_path, monkeypatch
):
    output = tmp_path / "race.json"
    actual_link = subject.os.link

    def racing_link(source, target):
        Path(target).write_bytes(b"other writer")
        actual_link(source, target)

    monkeypatch.setattr(subject.os, "link", racing_link)
    with pytest.raises(FileExistsError):
        subject.write_new(output, {"Complete": True})
    assert output.read_bytes() == b"other writer"
    assert json.loads(output.with_name(output.name + ".partial").read_bytes()) == {
        "Complete": True
    }


def test_admission_failure_is_a_retained_receipt_and_never_generates_a_tape(
    tmp_path, monkeypatch
):
    def refuse(*args):
        raise ValueError("fixture archive unavailable")

    monkeypatch.setattr(subject, "admit_sources", refuse)
    monkeypatch.setattr(
        subject,
        "replay_registered",
        lambda *args: pytest.fail("ran after admission failure"),
    )
    result = subject.run_replay(tmp_path, tmp_path / "absent", tmp_path / "absent")
    assert result["Complete"] is False
    assert result["Failure"]["Detail"] == "fixture archive unavailable"
    assert "Replay" not in result


def test_header_binds_every_registered_configuration_value():
    provenance = {
        "RegistrationTag": subject.REGISTRATION,
        "RegistrationCommit": subject.REGISTRATION_COMMIT,
        "ImplementationTag": subject.IMPLEMENTATION,
        "ImplementationCommit": "a" * 40,
        "SourceHashes": [],
    }
    receipt = {
        "Protocol": subject.PROTOCOL,
        "Kind": "behavior",
        "Complete": True,
        "Failure": None,
        "ProtocolSha256": subject.PROTOCOL_SHA,
        "Config": copy.deepcopy(subject.CONFIG),
        "Provenance": {**provenance, "SourceCommit": "a" * 40},
        "StartedAtUtc": "2026-09-07T00:00:00Z",
        "FinishedAtUtc": "2026-09-07T00:00:01Z",
    }
    subject.admitted_header(receipt, "behavior", provenance)
    for path, value in (
        ("Horizon", 15),
        ("PlanningDepth", 2),
        ("MinimumGain", 0.01),
        ("CueReliability", True),
    ):
        changed = copy.deepcopy(receipt)
        changed["Config"][path] = value
        with pytest.raises(ValueError):
            subject.admitted_header(changed, "behavior", provenance)
    del receipt["Failure"]
    with pytest.raises(ValueError):
        subject.admitted_header(receipt, "behavior", provenance)


def test_later_input_failure_retains_earlier_read_digest(tmp_path, monkeypatch):
    monkeypatch.setattr(subject, "admit_sources", lambda *args: {})
    monkeypatch.setattr(subject, "verify_hand", lambda *args: {})
    hand = tmp_path / subject.HAND_FILE
    hand.parent.mkdir(parents=True)
    hand.write_bytes(b"fixture hand")
    behavior = tmp_path / "behavior.json"
    behavior.write_bytes(b"read before absent cost")
    result = subject.run_replay(tmp_path, behavior, tmp_path / "absent-cost.json")
    assert result["Complete"] is False
    assert result["InputBehaviorSha256"] == subject.sha(behavior.read_bytes())
    assert "InputCostSha256" not in result
    assert result["Config"] == subject.CONFIG
    assert result["Arguments"]
    assert result["AttemptedRoster"]["BehaviorEpisodes"] == 16384


@pytest.mark.parametrize(
    "mutation",
    ("empty-assemblies", "bad-mvid", "bad-sha", "empty-runtime", "reversed-runs"),
)
def test_native_identity_and_cross_receipt_chronology_are_admitted(
    tmp_path, monkeypatch, mutation
):
    monkeypatch.setattr(subject, "validate_declared_commit", lambda *args: None)
    provenance = {
        "SourceCommit": "a" * 40,
        "SourceHashes": [],
        "Arguments": ["fixture"],
        "Runtime": ".NET fixture",
        "OperatingSystem": "fixture OS",
        "LoadedAssemblies": [
            {
                "Name": name,
                "Mvid": "12345678-1234-1234-1234-123456789abc",
                "Sha256": "A" * 64,
            }
            for name in ("Zeta.Core", "Zeta.Core.Abstractions")
        ],
    }
    behavior = {
        "Provenance": copy.deepcopy(provenance),
        "FinishedAtUtc": "2026-09-07T00:00:01Z",
    }
    cost = {
        "Provenance": copy.deepcopy(provenance),
        "StartedAtUtc": "2026-09-07T00:00:02Z",
    }
    subject.admit_native_commits(tmp_path, behavior, cost)
    for receipt in (behavior, cost):
        native = receipt["Provenance"]
        match mutation:
            case "empty-assemblies":
                native["LoadedAssemblies"] = []
            case "bad-mvid":
                native["LoadedAssemblies"][0]["Mvid"] = "not a uuid"
            case "bad-sha":
                native["LoadedAssemblies"][0]["Sha256"] = "bad"
            case "empty-runtime":
                native["Runtime"] = ""
    if mutation == "reversed-runs":
        cost["StartedAtUtc"] = "2026-09-07T00:00:00Z"
    with pytest.raises(ValueError):
        subject.admit_native_commits(tmp_path, behavior, cost)


def test_existing_cli_destination_refuses_before_any_replay(tmp_path, monkeypatch):
    output = tmp_path / "existing.json"
    output.write_bytes(b"existing")
    monkeypatch.setattr(
        subject.sys,
        "argv",
        ["hidden-switch", "behavior", "cost", "--output", str(output)],
    )
    monkeypatch.setattr(
        subject,
        "run_replay",
        lambda *args: pytest.fail("replayed before output refusal"),
    )
    assert subject.main() == 2
    assert output.read_bytes() == b"existing"


def test_partial_comparison_retains_exact_progress_without_real_source_draws(
    monkeypatch,
):
    behavior, cost = roster_fixture()
    # Inject synthetic rows at the source boundary; the registered RNG is never run.
    monkeypatch.setattr(subject.reference, "source_tapes", lambda *args: [None] * 1024)

    def expected_episode(arm, effect, geometry, palette, tape, index):
        return {"Index": index, "Complete": index != 1, "Failure": None}

    monkeypatch.setattr(subject.reference, "run_episode", expected_episode)
    progress = {}
    with pytest.raises(ValueError, match="dot-switch/belief-depth3/1"):
        subject.replay_registered(behavior, cost, progress)
    assert progress == {
        "Phase": "behavior-replay",
        "BehaviorEpisodesCompared": 1,
        "CostEpisodesCompared": 0,
        "Current": "dot-switch/belief-depth3/1",
    }


def test_foreign_repository_root_refuses_before_any_git_query(tmp_path, monkeypatch):
    monkeypatch.setattr(
        subject,
        "git",
        lambda *args: pytest.fail("git called for foreign executing module root"),
    )
    with pytest.raises(ValueError, match="executing module path"):
        subject.admit_sources(tmp_path)
