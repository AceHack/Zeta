"""Arithmetic/negative-verdict fixtures, never stochastic research outcomes."""

from __future__ import annotations

import copy
import json

import pytest

from zeta_interp import hidden_switch_replay as replay
from zeta_interp import hidden_switch_verdict as subject


def condition_fixture():
    def episode(total):
        return {
            "Actions": "0" * 16,
            "Reward4": [total // 16] * 16,
            "TotalReward4": total,
            "Beliefs": [0.5] * 17,
        }

    behavior = {
        "Panels": [
            {
                "Config": {**config, "Episodes": 2},
                "Arms": [
                    {
                        "Name": arm,
                        "Episodes": [
                            episode(
                                16 if arm == replay.ARMS[0] and config["Effect"] else 0
                            )
                            for _ in range(2)
                        ],
                    }
                    for arm in replay.ARMS
                ],
            }
            for config in replay.PANELS
        ]
    }
    cost = {
        "Rows": [
            {
                "Name": arm,
                "WallMsTotal": 64.0,
                "CpuMsTotal": 32.0,
                "AllocatedBytesTotal": 6400,
            }
            for _ in range(5)
            for arm in replay.ARMS
        ]
    }
    return behavior, cost


def test_all_three_structured_panels_must_pass_without_pooling():
    behavior, cost = condition_fixture()
    assert subject.conditions(behavior, cost)["AllRegisteredConditionsMet"] is True
    # One failed panel cannot be rescued by the other panels' larger gains.
    for episode in behavior["Panels"][1]["Arms"][0]["Episodes"]:
        episode["TotalReward4"] = 0
    result = subject.conditions(behavior, cost)
    assert result["AllRegisteredConditionsMet"] is False
    assert result["BehavioralConditionsMet"] is False


def test_exact_integer_threshold_is_not_an_inclusive_float_rounding_guess():
    behavior, cost = condition_fixture()
    first = behavior["Panels"][0]["Arms"][0]["Episodes"]
    first[0]["TotalReward4"], first[1]["TotalReward4"] = 6, 6
    assert subject.conditions(behavior, cost)["BehavioralConditionsMet"] is False
    first[1]["TotalReward4"] = 7
    assert subject.conditions(behavior, cost)["BehavioralConditionsMet"] is True


@pytest.mark.parametrize("field", ["Actions", "Reward4", "Beliefs"])
def test_padded_equivalence_has_action_reward_and_belief_conditions(field):
    behavior, cost = condition_fixture()
    episode = behavior["Panels"][0]["Arms"][2]["Episodes"][0]
    episode[field] = {"Actions": "1" * 16, "Reward4": [-1] * 16, "Beliefs": [0.4] * 17}[
        field
    ]
    assert subject.conditions(behavior, cost)["AllRegisteredConditionsMet"] is False


def test_null_requires_all_arms_harvest_with_equal_rewards():
    behavior, cost = condition_fixture()
    behavior["Panels"][3]["Arms"][3]["Episodes"][0]["Actions"] = "1" + "0" * 15
    assert subject.conditions(behavior, cost)["AllRegisteredConditionsMet"] is False


def test_cost_uses_ratio_of_arm_medians_and_keeps_first_outlier():
    behavior, cost = condition_fixture()
    planner = [1, 2, 3, 4, 100]
    padded = [100, 1, 2, 3, 4]
    for index in range(5):
        cost["Rows"][4 * index]["WallMsTotal"] = 64 * planner[index]
        cost["Rows"][4 * index + 2]["WallMsTotal"] = 64 * padded[index]
    original = copy.deepcopy(cost)
    result = subject.conditions(behavior, cost)
    assert result["PlannerCostRatios"]["belief-myopic-padded"]["WallMsTotal"] == 1.0
    assert result["CostConditionsMet"] is True
    assert cost == original


def test_behavior_can_pass_while_resource_claim_fails():
    behavior, cost = condition_fixture()
    for row in cost["Rows"]:
        if row["Name"] == "belief-depth3":
            row["AllocatedBytesTotal"] = 10000
    result = subject.conditions(behavior, cost)
    assert result["BehavioralConditionsMet"] is True
    assert result["CostConditionsMet"] is False
    assert result["AllRegisteredConditionsMet"] is False


def test_source_refusal_never_becomes_promotion(tmp_path, monkeypatch):
    def refuse(*args):
        raise ValueError("source mismatch witness")

    monkeypatch.setattr(replay, "admit_sources", refuse)
    result = subject.compute_verdict(
        tmp_path, tmp_path / "a", tmp_path / "b", tmp_path / "c"
    )
    assert result["Complete"] is False
    assert result["Admission"] is False
    assert result["PromotionEligible"] is False
    assert result["Failure"]["Detail"] == "source mismatch witness"


def test_absent_third_input_retains_both_previously_read_hashes(tmp_path, monkeypatch):
    monkeypatch.setattr(replay, "admit_sources", lambda *args: {})
    monkeypatch.setattr(replay, "verify_hand", lambda *args: {})
    hand = tmp_path / replay.HAND_FILE
    hand.parent.mkdir(parents=True)
    hand.write_bytes(b"hand fixture")
    behavior, cost = tmp_path / "behavior.json", tmp_path / "cost.json"
    behavior.write_bytes(b"behavior fixture")
    cost.write_bytes(b"cost fixture")
    result = subject.compute_verdict(tmp_path, behavior, cost, tmp_path / "absent.json")
    assert result["Complete"] is False
    assert result["PromotionEligible"] is False
    assert result["InputBehaviorSha256"] == replay.sha(behavior.read_bytes())
    assert result["InputCostSha256"] == replay.sha(cost.read_bytes())
    assert "InputReplaySha256" not in result


def test_zero_cpu_diagnostic_refuses_ratio_without_creating_cpu_performance_gate():
    behavior, cost = condition_fixture()
    for row in cost["Rows"]:
        row["CpuMsTotal"] = 0.0
    result = subject.conditions(behavior, cost)
    assert result["AllRegisteredConditionsMet"] is True
    assert result["CpuRatioIsDescriptiveOnly"] is True
    assert len(result["UnavailableRatios"]) == 3
    assert result["PlannerCostRatios"]["belief-myopic-padded"]["CpuMsTotal"] is None


def synthetic_verdict_inputs(tmp_path, monkeypatch):
    """Exercise verdict control flow with no actual source tapes or git archive."""
    provenance = {
        "RegistrationTag": "synthetic",
        "RegistrationCommit": "a" * 40,
        "ImplementationTag": "synthetic",
        "ImplementationCommit": "b" * 40,
        "SourceHashes": [],
        "SourceCommit": "c" * 40,
        "Python": "synthetic Python",
        "OperatingSystem": "synthetic OS",
    }
    monkeypatch.setattr(replay, "admit_sources", lambda *args: provenance)
    monkeypatch.setattr(replay, "verify_hand", lambda *args: {})
    monkeypatch.setattr(replay, "admitted_header", lambda *args: None)
    monkeypatch.setattr(replay, "admit_native_commits", lambda *args: None)
    monkeypatch.setattr(replay, "admitted_rosters", lambda *args: None)
    monkeypatch.setattr(replay, "validate_declared_commit", lambda *args: None)
    monkeypatch.setattr(replay, "replay_registered", lambda *args: {})
    monkeypatch.setattr(
        replay.reference,
        "source_tapes",
        lambda *args: pytest.fail("synthetic verdict generated source tapes"),
    )
    hand = tmp_path / replay.HAND_FILE
    hand.parent.mkdir(parents=True)
    hand.write_bytes(b"synthetic hand")
    behavior, cost = condition_fixture()
    behavior_raw = json.dumps(behavior).encode()
    cost["InputBehaviorSha256"] = replay.sha(behavior_raw)
    cost["FinishedAtUtc"] = "2026-09-07T00:00:00+00:00"
    independent = replay.attempt("replay", ["synthetic replay"])
    independent.update(
        {
            "Complete": True,
            "Provenance": provenance,
            "HandConformance": {},
            "InputBehaviorSha256": replay.sha(behavior_raw),
            "Replay": {},
            "Environment": {
                key: provenance[key] for key in ("Python", "OperatingSystem")
            },
            "StartedAtUtc": "2026-09-07T00:01:00+00:00",
            "FinishedAtUtc": "2026-09-07T00:02:00+00:00",
            "ExecutionProgress": {
                "Phase": "complete",
                "BehaviorEpisodesCompared": 16384,
                "CostEpisodesCompared": 1440,
                "Current": None,
            },
        }
    )
    paths = [tmp_path / name for name in ("behavior.json", "cost.json", "replay.json")]
    paths[0].write_bytes(behavior_raw)

    def write_inputs():
        cost_raw = json.dumps(cost).encode()
        paths[1].write_bytes(cost_raw)
        independent["InputCostSha256"] = replay.sha(cost_raw)
        paths[2].write_text(json.dumps(independent))

    return cost, independent, paths, write_inputs


@pytest.mark.parametrize("mutation", ["missing", "contradictory", "valid"])
def test_supplied_replay_environment_is_required_and_bound_to_provenance(
    tmp_path, monkeypatch, mutation
):
    _, independent, paths, write_inputs = synthetic_verdict_inputs(
        tmp_path, monkeypatch
    )
    if mutation == "missing":
        del independent["Environment"]
    elif mutation == "contradictory":
        independent["Environment"]["Python"] = "different interpreter"
    write_inputs()
    result = subject.compute_verdict(tmp_path, *paths)
    assert result["Complete"] is (mutation == "valid")
    if mutation != "valid":
        assert "replay Environment" in result["Failure"]["Detail"]
        assert result["PromotionEligible"] is False


def test_finite_cost_inputs_with_overflowing_ratio_retain_failed_verdict(
    tmp_path, monkeypatch
):
    cost, _, paths, write_inputs = synthetic_verdict_inputs(tmp_path, monkeypatch)
    for row in cost["Rows"]:
        row["WallMsTotal"] = 1e308 if row["Name"] == replay.ARMS[0] else 1e-300
    write_inputs()
    result = subject.compute_verdict(tmp_path, *paths)
    assert result["Complete"] is False
    assert result["PromotionEligible"] is False
    assert "nonfinite cost ratio" in result["Failure"]["Detail"]
    output = tmp_path / "retained-overflow.json"
    replay.write_new(output, result)
    assert json.loads(output.read_bytes())["InputReplaySha256"] == replay.sha(
        paths[2].read_bytes()
    )


def test_cpu_overflow_is_explicitly_unavailable_without_a_cpu_gate():
    behavior, cost = condition_fixture()
    for row in cost["Rows"]:
        row["CpuMsTotal"] = 1e308 if row["Name"] == replay.ARMS[0] else 1e-300
    result = subject.conditions(behavior, cost)
    assert result["AllRegisteredConditionsMet"] is True
    assert len(result["UnavailableRatios"]) == 3
    assert all(
        row["Reason"] == "nonfinite descriptive ratio"
        for row in result["UnavailableRatios"]
    )
    json.dumps(result, allow_nan=False)
