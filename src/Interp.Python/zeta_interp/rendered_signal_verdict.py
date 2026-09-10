"""Apply frozen engineering thresholds to byte-bound, fully replayed receipts.

This reads measurements; it does not train, replay experiments, measure timing,
select a seed, infer statistical significance, or promote an ARC policy.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
from pathlib import Path

SEEDS = (41, 53, 67)
ARMS = tuple(
    (name, -1) for name in ("unigram", "bigram", "order-two", "known", "fair", "last")
) + tuple((name, seed) for name in ("untrained-rnn", "trained-rnn") for seed in SEEDS)
DETECTORS = (("known", -1), ("order-two", -1), ("fair", -1)) + tuple(
    ("trained-rnn", seed) for seed in SEEDS
)
PANELS = tuple(
    (renderer, length, tag)
    for renderer, first in (("train-dot", 103), ("heldout-bar", 105), ("nuisance", 107))
    for length, tag in ((16, first), (64, first + 1))
)
THRESHOLDS = {
    "BigramLossGainBits": 0.05,
    "OrderTwoLossGainBits": 0.01,
    "MaximumBrierIncrease": 0.005,
    "MaximumNuisanceAlarmIncrease": 0.02,
    "MaximumEndToEndTimeRatio": 2.0,
    "MaximumEndToEndAllocationRatio": 2.0,
}


def digest(raw):
    return hashlib.sha256(raw).hexdigest().upper()


def number(value, label, maximum=None):
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value < 0
        or (maximum is not None and value > maximum)
    ):
        raise ValueError(f"{label}: expected a finite nonnegative number")
    return value


def keyed(rows, expected, key, label):
    if not isinstance(rows, list) or len(rows) != len(expected):
        raise ValueError(f"{label}: wrong row count")
    found = {}
    for row in rows:
        if not isinstance(row, dict):
            raise TypeError(f"{label}: row must be an object")
        identity = key(row)
        if identity not in expected or identity in found:
            raise ValueError(f"{label}: duplicate or unknown row")
        found[identity] = row
    if set(found) != set(expected):
        raise ValueError(f"{label}: missing registered row")
    return found


def _replay_admission(native, cost, replay, input_hash, cost_hash):
    if (
        native["Protocol"] != "rendered-signal-predictor-v1"
        or native["Complete"] is not True
        or native["Failure"] != ""
        or native["ActionReturn"] != "not-measured-passive-carrier"
        or cost["Protocol"] != "rendered-signal-inference-v1"
        or cost["Complete"] is not True
    ):
        raise ValueError("incomplete native/cost receipt or changed evidence boundary")
    if (
        replay["Complete"] is not True
        or replay["Passed"] is not True
        or replay["PredictionArmPanels"] != 72
        or replay["DetectorArmPanels"] != 30
        or replay["Comparisons"] != 102
        or replay["CostReplay"]["Complete"] is not True
        or replay["CostReplay"]["Rows"] != 120
    ):
        raise ValueError(
            "requires passed complete prediction, detection and cost replay"
        )
    number(replay["MaximumNumericError"], "prediction/detector replay error", 1e-10)
    number(replay["CostReplay"]["MaximumChecksumError"], "cost replay error", 1e-10)
    training = replay["TrainingReplay"]
    expected = {
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
    }
    if any(training[key] != value for key, value in expected.items()):
        raise ValueError("requires the complete passed registered training replay")
    for key in (
        "maximum_initial_parameter_error",
        "maximum_parameter_error",
        "maximum_trace_error",
    ):
        number(training[key], key, 1e-8)
    if (
        cost["InputSha256"] != input_hash
        or replay["InputSha256"] != input_hash
        or replay["CostInputSha256"] != cost_hash
    ):
        raise ValueError(
            "native, cost and replay hashes do not bind the same input bytes"
        )


def _panels(native):
    models = keyed(native["Models"], SEEDS, lambda row: row["Seed"], "models")
    if any(
        row["Hidden"] != 8 or row["Status"] != "complete" for row in models.values()
    ):
        raise ValueError("requires every registered complete width-8 model")
    panels = keyed(
        native["PredictionPanels"],
        PANELS,
        lambda row: (row["Renderer"], row["ContextLength"], row["Domain"]),
        "prediction panels",
    )
    predictions = {}
    for identity, panel in panels.items():
        if panel["Examples"] != 2048 or panel["Name"] != f"{identity[0]}-{identity[1]}":
            raise ValueError("wrong prediction panel identity or size")
        arms = keyed(
            panel["Arms"],
            ARMS,
            lambda row: (row["Name"], row["Seed"]),
            "prediction arms",
        )
        for arm in arms.values():
            number(arm["SampledLossBits"], "sampled loss")
            number(arm["Brier"], "Brier score", 1.0)
        predictions[identity] = arms
    detectors = keyed(
        native["DetectionPanels"],
        tuple(range(201, 206)),
        lambda row: row["Domain"],
        "detector panels",
    )
    nuisance = None
    for tag, panel in detectors.items():
        if panel["Examples"] != 2048:
            raise ValueError("wrong detector panel size")
        arms = keyed(
            panel["Arms"],
            DETECTORS,
            lambda row: (row["Name"], row["Seed"]),
            "detector arms",
        )
        for arm in arms.values():
            if type(arm["AlarmCount"]) is not int or not 0 <= arm["AlarmCount"] <= 2048:
                raise ValueError("invalid detector alarm count")
        if tag == 202:
            if (
                panel["Name"] != "nuisance-null"
                or panel["Renderer"] != "nuisance"
                or panel["ChangeDuration"] != 0
            ):
                raise ValueError("changed nuisance null")
            nuisance = arms
    return predictions, nuisance


def _cost_medians(cost):
    roster = tuple(
        (path, repetition, name, seed)
        for path in ("tokens", "end-to-end")
        for repetition in range(5)
        for name, seed in ARMS
    )
    rows = keyed(
        cost["Rows"],
        roster,
        lambda row: (row["Path"], row["Repetition"], row["Name"], row["Seed"]),
        "cost rows",
    )
    for (path, _, _, _), row in rows.items():
        calls, warmups = (4096, 256) if path == "tokens" else (256, 16)
        if (
            type(row["Calls"]) is not int
            or row["Calls"] != calls
            or row["WarmupCalls"] != warmups
        ):
            raise ValueError("changed registered cost workload")
        for key in ("ElapsedMilliseconds", "CpuMilliseconds", "AllocatedBytes"):
            number(row["Resource"][key], key)
    result = {}
    for name, seed in ARMS:
        selected = [
            rows[("end-to-end", repetition, name, seed)] for repetition in range(5)
        ]
        elapsed = [
            row["Resource"]["ElapsedMilliseconds"] / row["Calls"] for row in selected
        ]
        allocation = [
            row["Resource"]["AllocatedBytes"] / row["Calls"] for row in selected
        ]
        result[(name, seed)] = {
            "MillisecondsPerCall": elapsed,
            "AllocatedBytesPerCall": allocation,
            "MedianMillisecondsPerCall": statistics.median(elapsed),
            "MedianAllocatedBytesPerCall": statistics.median(allocation),
        }
    control = result[("order-two", -1)]
    if (
        control["MedianMillisecondsPerCall"] <= 0
        or control["MedianAllocatedBytesPerCall"] <= 0
    ):
        raise ValueError("cost ratios require positive order-two control medians")
    return result


def verdict(native_bytes, cost_bytes, replay_bytes):
    """Return every seed's decision; all hash checks use the bytes parsed here."""
    native, cost, replay = (
        json.loads(raw) for raw in (native_bytes, cost_bytes, replay_bytes)
    )
    input_hash, cost_hash = digest(native_bytes), digest(cost_bytes)
    _replay_admission(native, cost, replay, input_hash, cost_hash)
    predictions, nuisance = _panels(native)
    medians = _cost_medians(cost)
    control = medians[("order-two", -1)]
    seed_rows = []
    for seed in SEEDS:
        panels = []
        for length, domain in ((16, 105), (64, 106)):
            arms = predictions[("heldout-bar", length, domain)]
            learned, order_two, bigram = (
                arms[key]
                for key in (("trained-rnn", seed), ("order-two", -1), ("bigram", -1))
            )
            bigram_gain = bigram["SampledLossBits"] - learned["SampledLossBits"]
            order_gain = order_two["SampledLossBits"] - learned["SampledLossBits"]
            brier_delta = learned["Brier"] - order_two["Brier"]
            panels.append(
                {
                    "ContextLength": length,
                    "Domain": domain,
                    "LossGainAgainstBigramBits": bigram_gain,
                    "LossGainAgainstOrderTwoBits": order_gain,
                    "BrierIncreaseAgainstOrderTwo": brier_delta,
                    "MemorySanityPassed": bigram_gain
                    >= THRESHOLDS["BigramLossGainBits"],
                    "OrderTwoLossPassed": order_gain
                    >= THRESHOLDS["OrderTwoLossGainBits"],
                    "BrierPassed": brier_delta <= THRESHOLDS["MaximumBrierIncrease"],
                }
            )
        alarm = nuisance[("trained-rnn", seed)]["AlarmCount"] / 2048
        control_alarm = nuisance[("order-two", -1)]["AlarmCount"] / 2048
        alarm_delta = alarm - control_alarm
        resources = medians[("trained-rnn", seed)]
        time_ratio = (
            resources["MedianMillisecondsPerCall"]
            / control["MedianMillisecondsPerCall"]
        )
        allocation_ratio = (
            resources["MedianAllocatedBytesPerCall"]
            / control["MedianAllocatedBytesPerCall"]
        )
        alarm_pass = alarm_delta <= THRESHOLDS["MaximumNuisanceAlarmIncrease"]
        time_pass = time_ratio <= THRESHOLDS["MaximumEndToEndTimeRatio"]
        allocation_pass = (
            allocation_ratio <= THRESHOLDS["MaximumEndToEndAllocationRatio"]
        )
        seed_rows.append(
            {
                "Seed": seed,
                "HeldoutPanels": panels,
                "NuisanceAlarmFraction": alarm,
                "OrderTwoNuisanceAlarmFraction": control_alarm,
                "NuisanceAlarmIncrease": alarm_delta,
                "NuisanceAlarmPassed": alarm_pass,
                "EndToEnd": resources,
                "EndToEndTimeRatio": time_ratio,
                "EndToEndAllocationRatio": allocation_ratio,
                "EndToEndTimePassed": time_pass,
                "EndToEndAllocationPassed": allocation_pass,
                "MemorySanityPassed": all(row["MemorySanityPassed"] for row in panels),
                "PromotionConditionsMet": all(
                    row["OrderTwoLossPassed"] and row["BrierPassed"] for row in panels
                )
                and alarm_pass
                and time_pass
                and allocation_pass,
            }
        )
    sanity = all(row["MemorySanityPassed"] for row in seed_rows)
    promotion = all(row["PromotionConditionsMet"] for row in seed_rows)
    return {
        "Protocol": "rendered-signal-verdict-v1",
        "Complete": True,
        "InputSha256": input_hash,
        "CostInputSha256": cost_hash,
        "ReplayInputSha256": digest(replay_bytes),
        "VerdictSourceSha256": digest(Path(__file__).read_bytes()),
        "Thresholds": THRESHOLDS,
        "Seeds": seed_rows,
        "OrderTwoEndToEnd": control,
        "MemorySanityPassed": sanity,
        "PromotionEligible": promotion,
        "AllRegisteredConditionsMet": sanity and promotion,
        "NextCandidate": "trained-rnn-all-seeds" if promotion else "order-two",
        "Interpretation": "Engineering thresholds, not statistical significance. Passing earns only a newly preregistered acting-carrier trial; no ARC policy is promoted.",
        "Arithmetic": "Inclusive thresholds applied to unrounded binary64 receipt metrics; cost ratios divide five-repetition medians of per-call measurements.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("native", type=Path)
    parser.add_argument("cost", type=Path)
    parser.add_argument("replay", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    try:
        if args.output.exists():
            raise ValueError("refusing to overwrite verdict output")
        result = verdict(
            args.native.read_bytes(), args.cost.read_bytes(), args.replay.read_bytes()
        )
        encoded = json.dumps(result, indent=2, allow_nan=False) + "\n"
        with args.output.open("x", encoding="utf-8") as output:
            output.write(encoded)
    except (KeyError, TypeError, ValueError, OverflowError, OSError) as error:
        raise SystemExit(f"verdict refused: {error}") from error


if __name__ == "__main__":
    main()
