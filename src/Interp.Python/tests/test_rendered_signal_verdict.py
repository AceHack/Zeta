"""Hand-authored receipt witnesses for threshold logic, not experiment results."""

import copy
import json
import sys

import pytest

from zeta_interp import rendered_signal_verdict as target


def fixture():
    native = {
        "Protocol": "rendered-signal-predictor-v1",
        "Complete": True,
        "Failure": "",
        "ActionReturn": "not-measured-passive-carrier",
        "Models": [
            {"Seed": seed, "Hidden": 8, "Status": "complete"} for seed in target.SEEDS
        ],
        "PredictionPanels": [],
        "DetectionPanels": [],
    }
    for renderer, length, tag in target.PANELS:
        native["PredictionPanels"].append(
            {
                "Name": f"{renderer}-{length}",
                "Renderer": renderer,
                "ContextLength": length,
                "Domain": tag,
                "Examples": 2048,
                "Arms": [
                    {
                        "Name": name,
                        "Seed": seed,
                        "SampledLossBits": 0.5 if name == "trained-rnn" else 0.75,
                        "Brier": 0.1,
                    }
                    for name, seed in target.ARMS
                ],
            }
        )
    for tag in range(201, 206):
        native["DetectionPanels"].append(
            {
                "Name": "nuisance-null" if tag == 202 else f"panel-{tag}",
                "Renderer": "nuisance" if tag == 202 else "train-dot",
                "ChangeDuration": 0,
                "Domain": tag,
                "Examples": 2048,
                "Arms": [
                    {"Name": name, "Seed": seed, "AlarmCount": 10}
                    for name, seed in target.DETECTORS
                ],
            }
        )
    cost = {"Protocol": "rendered-signal-inference-v1", "Complete": True, "Rows": []}
    for path in ("tokens", "end-to-end"):
        for repetition in range(5):
            for name, seed in target.ARMS:
                calls, warmups = (4096, 256) if path == "tokens" else (256, 16)
                cost["Rows"].append(
                    {
                        "Name": name,
                        "Seed": seed,
                        "Path": path,
                        "Repetition": repetition,
                        "Calls": calls,
                        "WarmupCalls": warmups,
                        "Resource": {
                            "ElapsedMilliseconds": calls,
                            "CpuMilliseconds": calls,
                            "AllocatedBytes": calls * 100,
                        },
                    }
                )
    replay = {
        "Complete": True,
        "Passed": True,
        "PredictionArmPanels": 72,
        "DetectorArmPanels": 30,
        "Comparisons": 102,
        "MaximumNumericError": 0.0,
        "CostReplay": {"Complete": True, "Rows": 120, "MaximumChecksumError": 0.0},
        "TrainingReplay": {
            "status": "passed",
            "seed": 41,
            "hidden": 8,
            "dtype": "torch.float64",
            "device": "cpu",
            "training_sequences": 4096,
            "sequence_length": 33,
            "passes": 4,
            "optimizer_updates": 1024,
            "target_visits": 524288,
            "parameter_comparisons": 106,
            "trace_comparisons": 3,
            "tolerance": 1e-8,
            "maximum_initial_parameter_error": 0.0,
            "maximum_parameter_error": 0.0,
            "maximum_trace_error": 0.0,
        },
    }
    return native, cost, replay


def bind(native, cost, replay):
    native_bytes = json.dumps(native).encode()
    cost["InputSha256"] = target.digest(native_bytes)
    cost_bytes = json.dumps(cost).encode()
    replay["InputSha256"] = target.digest(native_bytes)
    replay["CostInputSha256"] = target.digest(cost_bytes)
    return native_bytes, cost_bytes, json.dumps(replay).encode()


def selected(native, seed=53, length=64):
    panel = next(
        row
        for row in native["PredictionPanels"]
        if row["Name"] == f"heldout-bar-{length}"
    )
    return next(
        row
        for row in panel["Arms"]
        if row["Name"] == "trained-rnn" and row["Seed"] == seed
    )


def test_complete_pass_retains_every_seed_and_exact_input_bindings():
    raw = bind(*fixture())
    result = target.verdict(*raw)
    assert result["PromotionEligible"] and result["MemorySanityPassed"]
    assert result["AllRegisteredConditionsMet"]
    assert [row["Seed"] for row in result["Seeds"]] == [41, 53, 67]
    assert result["InputSha256"] == target.digest(raw[0])
    assert result["CostInputSha256"] == target.digest(raw[1])
    assert result["ReplayInputSha256"] == target.digest(raw[2])


@pytest.mark.parametrize("index", [0, 1])
def test_same_json_with_changed_bytes_breaks_replay_binding(index):
    raw = list(bind(*fixture()))
    raw[index] += b"\n"
    with pytest.raises(ValueError, match="hashes"):
        target.verdict(*raw)


@pytest.mark.parametrize(
    "kind",
    ["missing-training", "mismatch", "short-training", "failed", "incomplete-cost"],
)
def test_partial_or_failed_replay_cannot_issue_a_verdict(kind):
    native, cost, replay = fixture()
    if kind == "missing-training":
        del replay["TrainingReplay"]
    elif kind == "mismatch":
        replay["TrainingReplay"]["status"] = "mismatch"
    elif kind == "short-training":
        replay["TrainingReplay"]["optimizer_updates"] = 1
    elif kind == "failed":
        replay["Passed"] = False
    else:
        replay["CostReplay"]["Complete"] = False
    with pytest.raises((KeyError, ValueError)):
        target.verdict(*bind(native, cost, replay))


def test_one_seed_one_panel_failure_blocks_promotion_without_discarding_seed():
    native, cost, replay = fixture()
    selected(native)["SampledLossBits"] = 0.75
    result = target.verdict(*bind(native, cost, replay))
    assert not result["PromotionEligible"]
    assert result["NextCandidate"] == "order-two"
    assert [row["PromotionConditionsMet"] for row in result["Seeds"]] == [
        True,
        False,
        True,
    ]


@pytest.mark.parametrize("cost_error", [False, True])
@pytest.mark.parametrize("error", [1.0, float("nan"), float("inf"), True])
def test_passed_flag_cannot_override_invalid_replay_error(cost_error, error):
    native, cost, replay = fixture()
    if cost_error:
        replay["CostReplay"]["MaximumChecksumError"] = error
    else:
        replay["MaximumNumericError"] = error
    with pytest.raises(ValueError, match="replay error"):
        target.verdict(*bind(native, cost, replay))


def test_sanity_and_stronger_promotion_are_reported_separately():
    native, cost, replay = fixture()
    for panel in native["PredictionPanels"]:
        for arm in panel["Arms"]:
            if arm["Name"] == "bigram":
                arm["SampledLossBits"] = 0.5
    result = target.verdict(*bind(native, cost, replay))
    assert result["PromotionEligible"]
    assert not result["MemorySanityPassed"]
    assert not result["AllRegisteredConditionsMet"]


def test_inclusive_loss_brier_and_cost_thresholds_without_rounding():
    native, cost, replay = fixture()
    for panel in native["PredictionPanels"]:
        for arm in panel["Arms"]:
            arm["Brier"] = 0.005 if arm["Name"] == "trained-rnn" else 0.0
            arm["SampledLossBits"] = {
                "trained-rnn": 0.0,
                "order-two": 0.01,
                "bigram": 0.05,
            }.get(arm["Name"], 0.75)
    for row in cost["Rows"]:
        if row["Name"] == "trained-rnn":
            row["Resource"]["ElapsedMilliseconds"] *= 2
            row["Resource"]["AllocatedBytes"] *= 2
    result = target.verdict(*bind(native, cost, replay))
    assert result["AllRegisteredConditionsMet"]
    selected(native)["Brier"] += 1e-12
    assert not target.verdict(*bind(native, cost, replay))["PromotionEligible"]


def test_alarm_fraction_uses_all_2048_null_streams():
    native, cost, replay = fixture()
    null = next(row for row in native["DetectionPanels"] if row["Domain"] == 202)
    learned = next(row for row in null["Arms"] if row["Seed"] == 67)
    learned["AlarmCount"] = 50
    assert target.verdict(*bind(native, cost, replay))["PromotionEligible"]
    learned["AlarmCount"] = 51
    result = target.verdict(*bind(native, cost, replay))
    assert not result["PromotionEligible"]
    assert result["Seeds"][2]["NuisanceAlarmIncrease"] == 41 / 2048


def test_cost_uses_median_per_call_not_mean_or_a_selected_repetition():
    native, cost, replay = fixture()
    for row in cost["Rows"]:
        if (
            row["Path"] == "end-to-end"
            and row["Name"] == "trained-rnn"
            and row["Seed"] == 41
        ):
            row["Resource"]["ElapsedMilliseconds"] *= [1, 1, 2, 1000, 1000][
                row["Repetition"]
            ]
    result = target.verdict(*bind(native, cost, replay))
    assert result["Seeds"][0]["EndToEndTimeRatio"] == 2
    assert result["PromotionEligible"]


@pytest.mark.parametrize(
    "kind", ["seed", "panel", "arm", "cost-row", "nan", "zero-control"]
)
def test_missing_duplicate_or_invalid_measurements_refuse(kind):
    native, cost, replay = fixture()
    if kind == "seed":
        native["Models"].pop()
    elif kind == "panel":
        native["PredictionPanels"][-1] = copy.deepcopy(native["PredictionPanels"][0])
    elif kind == "arm":
        native["PredictionPanels"][0]["Arms"].pop()
    elif kind == "cost-row":
        cost["Rows"][-1] = copy.deepcopy(cost["Rows"][0])
    elif kind == "nan":
        selected(native)["SampledLossBits"] = float("nan")
    else:
        for row in cost["Rows"]:
            if row["Name"] == "order-two":
                row["Resource"]["ElapsedMilliseconds"] = 0
    with pytest.raises(ValueError):
        target.verdict(*bind(native, cost, replay))


def test_cli_writes_new_artifact_and_never_overwrites(tmp_path, monkeypatch):
    paths = [tmp_path / name for name in ("native.json", "cost.json", "replay.json")]
    for path, raw in zip(paths, bind(*fixture()), strict=True):
        path.write_bytes(raw)
    output = tmp_path / "verdict.json"
    monkeypatch.setattr(
        sys, "argv", ["verdict", *(str(path) for path in paths), str(output)]
    )
    target.main()
    original = output.read_bytes()
    with pytest.raises(SystemExit, match="overwrite"):
        target.main()
    assert output.read_bytes() == original
