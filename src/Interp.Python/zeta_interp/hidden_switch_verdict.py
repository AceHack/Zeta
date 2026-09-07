"""Recompute the registered hidden-switch conditions from admitted raw receipts."""

from __future__ import annotations

import argparse
import math
import statistics
import sys
from pathlib import Path
from typing import Any

from zeta_interp import hidden_switch_replay as replay


def conditions(behavior: dict[str, Any], cost: dict[str, Any]) -> dict[str, Any]:
    """Receipts must already have complete roster and reference replay admission."""
    rows: list[dict[str, Any]] = []
    descriptive = []
    for panel in behavior["Panels"]:
        name = panel["Config"]["Name"]
        arms = {arm["Name"]: arm["Episodes"] for arm in panel["Arms"]}
        totals = {
            arm: sum(episode["TotalReward4"] for episode in episodes)
            for arm, episodes in arms.items()
        }
        count = panel["Config"]["Episodes"]
        means = {arm: total / (64 * count) for arm, total in totals.items()}
        descriptive.append({"Panel": name, "MeanNormalizedReturns": means})
        if panel["Config"]["Effect"]:
            difference = totals["belief-depth3"] - totals["belief-myopic"]
            rows.append(
                {
                    "Name": f"{name}/planning-gain",
                    "Passed": difference * 10 >= 64 * count,
                    "Value": difference / (64 * count),
                    "Minimum": 0.10,
                }
            )
        paired = zip(arms["belief-myopic"], arms["belief-myopic-padded"], strict=True)
        action_mismatches = reward_mismatches = 0
        max_belief_error = 0.0
        for natural, padded in paired:
            action_mismatches += natural["Actions"] != padded["Actions"]
            reward_mismatches += natural["Reward4"] != padded["Reward4"]
            max_belief_error = max(
                max_belief_error,
                *(
                    abs(a - b)
                    for a, b in zip(natural["Beliefs"], padded["Beliefs"], strict=True)
                ),
            )
        rows.append(
            {
                "Name": f"{name}/padded-myopic-equivalence",
                "Passed": action_mismatches == 0
                and reward_mismatches == 0
                and max_belief_error <= 1e-10,
                "ActionMismatches": action_mismatches,
                "RewardMismatches": reward_mismatches,
                "MaximumBeliefError": max_belief_error,
            }
        )
        if not panel["Config"]["Effect"]:
            harvest_only = all(
                episode["Actions"] == "0" * 16
                for episodes in arms.values()
                for episode in episodes
            )
            same_rewards = all(
                episode["Reward4"] == arms["belief-myopic"][index]["Reward4"]
                for episodes in arms.values()
                for index, episode in enumerate(episodes)
            )
            rows.append(
                {
                    "Name": "dot-null/action-dominance",
                    "Passed": harvest_only and same_rewards,
                    "AllHarvest": harvest_only,
                    "SameRewards": same_rewards,
                }
            )
    metrics = ("WallMsTotal", "CpuMsTotal", "AllocatedBytesTotal")
    medians = {
        arm: {
            metric: statistics.median(
                row[metric] / 64 for row in cost["Rows"] if row["Name"] == arm
            )
            for metric in metrics
        }
        for arm in replay.ARMS
    }
    for arm, values in medians.items():
        for metric, median in values.items():
            replay.require(
                math.isfinite(median), f"nonfinite cost median {arm}/{metric}"
            )
            replay.require(
                median >= 0 if metric == "CpuMsTotal" else median > 0,
                f"invalid cost median {arm}/{metric}",
            )
    ratios: dict[str, dict[str, float | None]] = {}
    unavailable = []
    for denominator in ("belief-myopic", "belief-myopic-padded", "latest-cue-depth3"):
        ratios[denominator] = {}
        for metric in metrics:
            lower = medians[denominator][metric]
            value = medians["belief-depth3"][metric] / lower if lower > 0 else None
            reason = "nonpositive descriptive ratio denominator"
            if value is not None and not math.isfinite(value):
                replay.require(
                    metric == "CpuMsTotal",
                    f"nonfinite cost ratio {denominator}/{metric}",
                )
                value = None
                reason = "nonfinite descriptive ratio"
            ratios[denominator][metric] = value
            if value is None:
                unavailable.append(
                    {
                        "DenominatorArm": denominator,
                        "Metric": metric,
                        "Reason": reason,
                    }
                )
            if denominator == "belief-myopic-padded" and metric != "CpuMsTotal":
                rows.append(
                    {
                        "Name": f"cost/{metric}/planner-over-padded",
                        "Passed": value is not None and value <= 1.25,
                        "Value": value,
                        "Maximum": 1.25,
                    }
                )
    return {
        "Conditions": rows,
        "BehavioralConditionsMet": all(
            row["Passed"] for row in rows if not row["Name"].startswith("cost/")
        ),
        "CostConditionsMet": all(
            row["Passed"] for row in rows if row["Name"].startswith("cost/")
        ),
        "AllRegisteredConditionsMet": all(row["Passed"] for row in rows),
        "PanelReturns": descriptive,
        "CostMediansPerEpisode": medians,
        "PlannerCostRatios": ratios,
        "UnavailableRatios": unavailable,
        "CpuRatioIsDescriptiveOnly": True,
        "LatestCueComparisonIsDescriptive": True,
        "PaddedWorkIsIntentionallyDiscarded": True,
        "ClaimsOnlineSearchNecessary": False,
    }


def compute_verdict(
    root: Path,
    behavior_path: Path,
    cost_path: Path,
    replay_path: Path,
    arguments: list[str] | None = None,
) -> dict[str, Any]:
    result = replay.attempt(
        "verdict",
        arguments
        if arguments is not None
        else [
            "compute_verdict",
            str(root),
            str(behavior_path),
            str(cost_path),
            str(replay_path),
        ],
    )
    result.update({"Admission": False, "PromotionEligible": False})
    try:
        provenance = replay.admit_sources(root, Path(__file__))
        result["Provenance"] = provenance
        result["HandConformance"] = replay.verify_hand(
            (root / replay.HAND_FILE).read_bytes()
        )
        native_raw = behavior_path.read_bytes()
        result["InputBehaviorSha256"] = replay.sha(native_raw)
        cost_raw = cost_path.read_bytes()
        result["InputCostSha256"] = replay.sha(cost_raw)
        independent_raw = replay_path.read_bytes()
        result["InputReplaySha256"] = replay.sha(independent_raw)
        behavior, cost, independent = map(
            replay.strict_json, (native_raw, cost_raw, independent_raw)
        )
        replay.admitted_header(behavior, "behavior", provenance)
        replay.admitted_header(cost, "cost", provenance)
        replay.admit_native_commits(root, behavior, cost)
        replay.exact(
            cost.get("InputBehaviorSha256"), replay.sha(native_raw), "cost input"
        )
        replay.admitted_rosters(behavior, cost)
        replay.require(isinstance(independent, dict), "independent replay object")
        for key, value in {
            "Protocol": replay.PROTOCOL,
            "Kind": "replay",
            "Complete": True,
            "Failure": None,
            "ProtocolSha256": replay.PROTOCOL_SHA,
            "InputBehaviorSha256": replay.sha(native_raw),
            "InputCostSha256": replay.sha(cost_raw),
            "Config": replay.CONFIG,
            "AttemptedRoster": result["AttemptedRoster"],
            "HandConformance": result["HandConformance"],
            "ExecutionProgress": {
                "Phase": "complete",
                "BehaviorEpisodesCompared": 16384,
                "CostEpisodesCompared": 1440,
                "Current": None,
            },
        }.items():
            replay.require(key in independent, f"replay missing {key}")
            replay.exact(independent[key], value, f"replay {key}")
        for key in (
            "RegistrationTag",
            "RegistrationCommit",
            "ImplementationTag",
            "ImplementationCommit",
            "SourceHashes",
        ):
            replay.exact(
                independent["Provenance"][key],
                provenance[key],
                f"replay provenance {key}",
            )
        replay.validate_declared_commit(root, independent["Provenance"])
        for key in ("Python", "OperatingSystem"):
            replay.require(
                isinstance(independent["Provenance"].get(key), str)
                and bool(independent["Provenance"][key].strip()),
                f"replay {key}",
            )
        replay.exact(
            independent.get("Environment"),
            {
                key: independent["Provenance"][key]
                for key in ("Python", "OperatingSystem")
            },
            "replay Environment",
        )
        replay.require(
            isinstance(independent.get("Arguments"), list)
            and bool(independent["Arguments"])
            and all(isinstance(arg, str) for arg in independent["Arguments"]),
            "replay arguments",
        )
        from datetime import UTC, datetime

        for key in ("StartedAtUtc", "FinishedAtUtc"):
            replay.require(isinstance(independent.get(key), str), f"replay {key}")
            timestamp = datetime.fromisoformat(independent[key])
            replay.require(
                timestamp.utcoffset() == UTC.utcoffset(timestamp),
                "replay timestamp UTC",
            )
        replay.require(
            datetime.fromisoformat(independent["FinishedAtUtc"])
            >= datetime.fromisoformat(independent["StartedAtUtc"])
            >= datetime.fromisoformat(cost["FinishedAtUtc"]),
            "replay chronology",
        )
        # Re-execute the reference, so a fabricated success flag/error summary
        # cannot substitute for agreement on the raw episode trajectories.
        actual_replay = replay.replay_registered(
            behavior, cost, result["ExecutionProgress"]
        )
        replay.exact(
            independent.get("Replay"), actual_replay, "independently recomputed replay"
        )
        result["Replay"] = actual_replay
        result.update(conditions(behavior, cost))
        replay.exact(
            replay.admit_sources(root, Path(__file__)),
            provenance,
            "source state changed during verdict",
        )
        result["Admission"] = True
        result["Complete"] = True
        result["PromotionEligible"] = result["AllRegisteredConditionsMet"]
    except (ValueError, OSError, KeyError, TypeError, OverflowError) as error:
        result["Failure"] = {
            "Stage": "verdict",
            "Code": type(error).__name__,
            "Detail": str(error),
        }
    result["FinishedAtUtc"] = replay.utc()
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("behavior", type=Path)
    parser.add_argument("cost", type=Path)
    parser.add_argument("replay", type=Path)
    parser.add_argument(
        "--root", type=Path, default=Path(__file__).resolve().parents[3]
    )
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        replay.output_available(args.output)
        result = compute_verdict(
            args.root, args.behavior, args.cost, args.replay, sys.argv[1:]
        )
        replay.write_new(args.output, result)
    except (OSError, ValueError) as error:
        print(f"hidden-switch verdict output refusal: {error}", file=sys.stderr)
        return 2
    print({key: result[key] for key in ("Complete", "Failure", "PromotionEligible")})
    return 0 if result["Complete"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
