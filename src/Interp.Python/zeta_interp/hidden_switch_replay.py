"""Admission and independent replay for the frozen hidden-switch experiment.

The reference implementation owns transitions, rendering, filtering and planning.
This boundary admits source bytes and complete rosters before generating any
registered tape. CLI failures are preserved as structured, exclusive receipts.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import os
import platform
import subprocess
import sys
import uuid
from datetime import UTC, datetime
from fractions import Fraction
from pathlib import Path
from typing import Any, cast

from zeta_interp import hidden_switch_reference as reference

PROTOCOL = "hidden-switch-v1"
TASK = "081M1XK02XM087G0R00043EW05"
PROTOCOL_FILE = "docs/research/2026-09-07-hidden-switch-protocol.md"
PROTOCOL_SHA = "E6E2943D5991E70DBC95D3ED1E620AA7505D3E692315E80588729C9FCD03946A"
REGISTRATION = f"refs/tags/archive/experiments/{TASK}-registration"
REGISTRATION_COMMIT = "6a3150037a1e6be6ae89996dc8562f2061f7c75d"
IMPLEMENTATION = f"refs/tags/archive/experiments/{TASK}-implementation"
HAND_FILE = "docs/research/hidden-switch-validation/2026-09-07/hand-fixture.json"
SOURCE_FILES = (
    "src/Core/ControlScheme.fs",
    "src/Core/GameEnvironment.fs",
    "src/Core/SplitMix64.fs",
    "src/Core/Result.fs",
    "src/Research.FSharp/ResearchRandom.fs",
    "src/Research.FSharp/HiddenSwitchReceipt.fs",
    "src/Research.FSharp/HiddenSwitchObservation.fs",
    "src/Research.FSharp/HiddenSwitchCarrier.fs",
    "src/Research.FSharp/HiddenSwitchPolicy.fs",
    "src/Research.FSharp/HiddenSwitchExperiment.fs",
    "src/Research.FSharp/HiddenSwitchRuntime.fsx",
    "src/Research.FSharp/run-hidden-switch-experiment.fsx",
    "src/Research.FSharp/measure-hidden-switch-inference.fsx",
    "src/Research.FSharp/check-hidden-switch-kernel.fsx",
    "src/Interp.Python/zeta_interp/hidden_switch_reference.py",
    "src/Interp.Python/zeta_interp/hidden_switch_replay.py",
    "src/Interp.Python/zeta_interp/hidden_switch_verdict.py",
    PROTOCOL_FILE,
    HAND_FILE,
)
ARMS = (
    "belief-depth3",
    "belief-myopic",
    "belief-myopic-padded",
    "latest-cue-depth3",
)
PANELS: tuple[dict[str, Any], ...] = tuple(
    {
        "Name": name,
        "Episodes": 1024,
        "Seed": 9101,
        "Domain": 911 + index,
        "Effect": index != 3,
        "Geometry": "bar" if index == 1 else "dot",
        "Palette": "odd-complement" if index == 2 else "fixed",
    }
    for index, name in enumerate(
        ("dot-switch", "bar-switch", "palette-switch", "dot-null")
    )
)
CONFIG = {
    "Arms": list(ARMS),
    "Panels": list(PANELS),
    "Horizon": 16,
    "Observations": 17,
    "DriftProbability": 0.125,
    "CueReliability": 0.75,
    "InitialBelief": 0.5,
    "PlanningDepth": 3,
    "TieTolerance": 1e-12,
    "ReplayTolerance": 1e-10,
    "ReturnScale": 64,
    "MinimumGain": 0.10,
    "MaximumCostRatio": 1.25,
    "FrameWidth": 64,
    "FrameHeight": 32,
    "ProjectionRows": 24,
    "Cost": {
        "Seed": 9203,
        "Domain": 921,
        "SourceEpisodes": 72,
        "WarmupEpisodes": 8,
        "TimedEpisodes": 64,
        "Replicates": 5,
        "Rotation": "left-by-replicate",
    },
}
FALSIFIERS = (
    "action-effect",
    "suffix-noninterference",
    "private-band-noninterference",
    "scorer-noninterference",
    "caller-frame-isolation",
    "geometry-palette-invariance",
    "malformed-input-refusal",
    "padded-equivalence",
    "counter-accounting",
    "null-dominance",
)
PAYLOAD = [
    {
        "Name": name,
        "BeliefFloat64Slots": 1,
        "ModelFloat64Slots": 0,
        "ModelBoolSlots": 1,
        "ChronologyInt32Slots": 4,
        "FullFrameCellBytes": 2048,
        "ProjectionCellBytes": 2048,
        "Scope": "partial logical numeric/frame ledger; model probabilities are code constants; excludes object headers, strings, options, recursion, Q arrays, trace arrays, digests, allocator overhead and peak heap",
    }
    for name in ARMS
]


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest().upper()


def utc() -> str:
    return datetime.now(UTC).isoformat()


def attempt(kind: str, arguments: list[str]) -> dict[str, Any]:
    return {
        "Protocol": PROTOCOL,
        "Kind": kind,
        "Complete": False,
        "Failure": None,
        "ProtocolSha256": PROTOCOL_SHA,
        "StartedAtUtc": utc(),
        "Arguments": list(arguments),
        "Environment": {"Python": sys.version, "OperatingSystem": platform.platform()},
        "Config": copy.deepcopy(CONFIG),
        "AttemptedRoster": {
            "BehaviorArmPanels": 16,
            "BehaviorEpisodes": 16384,
            "CostRows": 20,
            "CostWarmupEpisodes": 160,
            "CostTimedEpisodes": 1280,
        },
        "ExecutionProgress": {
            "Phase": "admission",
            "BehaviorEpisodesCompared": 0,
            "CostEpisodesCompared": 0,
            "Current": None,
        },
    }


def require(condition: bool, reason: str) -> None:
    if not condition:
        raise ValueError(reason)


def strict_json(raw: bytes) -> Any:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in items:
            require(key not in result, f"duplicate JSON field: {key}")
            result[key] = value
        return result

    def constant(value: str) -> Any:
        raise ValueError(f"nonfinite JSON constant: {value}")

    result = json.loads(raw, object_pairs_hook=pairs, parse_constant=constant)

    def finite(node: Any) -> None:
        if type(node) is float:
            require(math.isfinite(node), "nonfinite JSON numeric value")
        elif isinstance(node, dict):
            for child in node.values():
                finite(child)
        elif isinstance(node, list):
            for child in node:
                finite(child)

    finite(result)
    return result


def git(root: Path, *args: str) -> bytes:
    result = subprocess.run(["git", *args], cwd=root, capture_output=True, check=False)
    require(result.returncode == 0, "git admission: " + result.stderr.decode().strip())
    return result.stdout


def object_id(root: Path, ref: str) -> str:
    value = git(root, "rev-parse", "--verify", ref).decode().strip()
    require(len(value) == 40 and all(c in "0123456789abcdef" for c in value), "git oid")
    return value


def admit_sources(root: Path, caller: Path | None = None) -> dict[str, Any]:
    root = root.resolve()
    expected_modules = {
        Path(
            __file__
        ).resolve(): "src/Interp.Python/zeta_interp/hidden_switch_replay.py",
        Path(
            reference.__file__
        ).resolve(): "src/Interp.Python/zeta_interp/hidden_switch_reference.py",
    }
    if caller is not None:
        require(
            caller.resolve()
            in {
                (
                    root / "src/Interp.Python/zeta_interp/hidden_switch_replay.py"
                ).resolve(),
                (
                    root / "src/Interp.Python/zeta_interp/hidden_switch_verdict.py"
                ).resolve(),
            },
            "executing wrapper path is outside the admitted source tree",
        )
    for actual, relative in expected_modules.items():
        require(actual == (root / relative).resolve(), "executing module path mismatch")
    registration = object_id(root, REGISTRATION + "^{commit}")
    require(registration == REGISTRATION_COMMIT, "registration tag changed")
    implementation = object_id(root, IMPLEMENTATION + "^{commit}")
    git(root, "merge-base", "--is-ancestor", registration, implementation)
    head = object_id(root, "HEAD")
    hashes = []
    for relative in SOURCE_FILES:
        raw = (root / relative).read_bytes()
        require(
            raw == git(root, "show", f"{implementation}:{relative}"),
            f"archive bytes: {relative}",
        )
        require(
            raw == git(root, "show", f"{head}:{relative}"),
            f"uncommitted source: {relative}",
        )
        hashes.append({"File": relative, "Sha256": sha(raw)})
    require(
        sha((root / PROTOCOL_FILE).read_bytes()) == PROTOCOL_SHA, "protocol changed"
    )
    require(
        sha(git(root, "show", f"{registration}:{PROTOCOL_FILE}")) == PROTOCOL_SHA,
        "registration protocol bytes",
    )
    return {
        "SourceCommit": head,
        "RegistrationTag": REGISTRATION,
        "RegistrationCommit": registration,
        "ImplementationTag": IMPLEMENTATION,
        "ImplementationCommit": implementation,
        "SourceHashes": hashes,
        "Python": sys.version,
        "OperatingSystem": platform.platform(),
    }


def exact(actual: Any, expected: Any, path: str = "value") -> None:
    """Match JSON shape and types, allowing int encodings for real constants."""
    if type(expected) is float:
        require(type(actual) in (int, float), f"{path}: numeric type")
        require(math.isfinite(actual) and actual == expected, f"{path}: numeric value")
    elif isinstance(expected, dict):
        require(
            isinstance(actual, dict) and actual.keys() == expected.keys(),
            f"{path}: fields",
        )
        for key, value in expected.items():
            exact(actual[key], value, f"{path}.{key}")
    elif isinstance(expected, list):
        require(
            isinstance(actual, list) and len(actual) == len(expected), f"{path}: length"
        )
        for index, (left, right) in enumerate(zip(actual, expected, strict=True)):
            exact(left, right, f"{path}[{index}]")
    else:
        require(
            type(actual) is type(expected) and actual == expected, f"{path}: value/type"
        )


def compare_episode(actual: Any, expected: Any, path: str = "episode") -> float:
    maximum = 0.0

    def visit(left: Any, right: Any, label: str) -> None:
        nonlocal maximum
        if type(right) is float:
            require(
                type(left) in (int, float) and math.isfinite(left),
                f"{label}: finite numeric",
            )
            difference = abs(left - right)
            maximum = max(maximum, difference)
            require(difference <= 1e-10, f"{label}: numeric mismatch {difference}")
        elif isinstance(right, dict):
            require(
                isinstance(left, dict) and left.keys() == right.keys(),
                f"{label}: fields",
            )
            for key, value in right.items():
                visit(left[key], value, f"{label}.{key}")
        elif isinstance(right, list):
            require(
                isinstance(left, list) and len(left) == len(right), f"{label}: length"
            )
            for index, (a, b) in enumerate(zip(left, right, strict=True)):
                visit(a, b, f"{label}[{index}]")
        else:
            require(type(left) is type(right) and left == right, f"{label}: value/type")

    visit(actual, expected, path)
    return maximum


def admitted_header(receipt: Any, kind: str, provenance: dict[str, Any]) -> None:
    require(isinstance(receipt, dict), f"{kind}: object")
    require(
        receipt.get("Complete") is True
        and "Failure" in receipt
        and receipt["Failure"] is None,
        f"{kind}: incomplete",
    )
    exact(receipt.get("Protocol"), PROTOCOL, f"{kind}.Protocol")
    exact(receipt.get("Kind"), kind, f"{kind}.Kind")
    exact(receipt.get("ProtocolSha256"), PROTOCOL_SHA, f"{kind}.ProtocolSha256")
    exact(receipt.get("Config"), CONFIG, f"{kind}.Config")
    native = receipt.get("Provenance")
    require(isinstance(native, dict), f"{kind}: provenance")
    for key in (
        "RegistrationTag",
        "RegistrationCommit",
        "ImplementationTag",
        "ImplementationCommit",
    ):
        exact(native.get(key), provenance[key], f"{kind}.{key}")
    hashes = native.get("SourceHashes")
    require(isinstance(hashes, list), "source manifest list")
    exact(
        sorted(hashes, key=lambda entry: entry["File"]),
        sorted(provenance["SourceHashes"], key=lambda entry: entry["File"]),
        "source manifest",
    )
    require(isinstance(native.get("SourceCommit"), str), "native source commit")
    for key in ("StartedAtUtc", "FinishedAtUtc"):
        require(isinstance(receipt.get(key), str), f"{kind}.{key}")
        timestamp = datetime.fromisoformat(receipt[key])
        require(
            timestamp.utcoffset() == UTC.utcoffset(timestamp),
            f"{kind}: non-UTC timestamp",
        )
    require(
        datetime.fromisoformat(receipt["FinishedAtUtc"])
        >= datetime.fromisoformat(receipt["StartedAtUtc"]),
        f"{kind}: reversed timestamps",
    )


def admit_native_commits(
    root: Path, behavior: dict[str, Any], cost: dict[str, Any]
) -> None:
    for receipt in (behavior, cost):
        native = receipt["Provenance"]
        validate_declared_commit(root, native)
        for key in ("Runtime", "OperatingSystem"):
            require(
                isinstance(native.get(key), str) and bool(native[key].strip()),
                f"native {key}",
            )
        require(
            isinstance(native.get("Arguments"), list)
            and bool(native["Arguments"])
            and all(isinstance(arg, str) for arg in native["Arguments"]),
            "native arguments",
        )
        assemblies = native.get("LoadedAssemblies")
        require(
            isinstance(assemblies, list) and len(assemblies) == 2,
            "native assembly roster",
        )
        require(
            sorted(item["Name"] for item in assemblies)
            == ["Zeta.Core", "Zeta.Core.Abstractions"],
            "native assembly names",
        )
        for item in assemblies:
            require(
                isinstance(item, dict) and set(item) == {"Name", "Mvid", "Sha256"},
                "native assembly fields",
            )
            require(isinstance(item["Mvid"], str), "MVID string")
            identity = uuid.UUID(item["Mvid"])
            require(
                str(identity) == item["Mvid"] and identity.int != 0,
                "canonical nonzero MVID",
            )
            require(
                isinstance(item["Sha256"], str)
                and len(item["Sha256"]) == 64
                and all(c in "0123456789ABCDEF" for c in item["Sha256"]),
                "native assembly SHA256",
            )
    for key in (
        "SourceCommit",
        "SourceHashes",
        "LoadedAssemblies",
        "Runtime",
        "OperatingSystem",
    ):
        require(
            key in behavior["Provenance"] and key in cost["Provenance"],
            f"native provenance missing {key}",
        )
        exact(
            cost["Provenance"][key],
            behavior["Provenance"][key],
            f"cost provenance {key}",
        )
    require(
        datetime.fromisoformat(cost["StartedAtUtc"])
        >= datetime.fromisoformat(behavior["FinishedAtUtc"]),
        "cost started before behavior completed",
    )


def validate_declared_commit(root: Path, provenance: dict[str, Any]) -> None:
    commit = cast(str, provenance.get("SourceCommit"))
    require(
        isinstance(commit, str)
        and len(commit) == 40
        and all(c in "0123456789abcdef" for c in commit),
        "declared source commit",
    )
    require(
        object_id(root, commit + "^{commit}") == commit,
        "declared source commit identity",
    )
    for entry in provenance["SourceHashes"]:
        require(
            sha(git(root, "show", f"{commit}:{entry['File']}")) == entry["Sha256"],
            "declared source bytes",
        )


def admitted_rosters(behavior: dict[str, Any], cost: dict[str, Any]) -> None:
    exact(cost.get("SourceDraws"), 2448, "cost source draw count")
    exact(cost.get("Payload"), PAYLOAD, "cost partial payload ledger")
    for key in ("QuietWindowDeclaration", "HostActivity"):
        require(
            isinstance(cost.get(key), str) and bool(cost[key].strip()), f"cost {key}"
        )
    panels = behavior.get("Panels")
    require(isinstance(panels, list) and len(panels) == 4, "behavior panels")
    for index, (panel, config) in enumerate(
        zip(cast(list[Any], panels), PANELS, strict=True)
    ):
        require(isinstance(panel, dict), "panel object")
        exact(panel.get("Config"), config, f"panel[{index}].Config")
        arms = panel.get("Arms")
        require(isinstance(arms, list) and len(arms) == 4, "arm roster")
        for arm, name in zip(arms, ARMS, strict=True):
            require(isinstance(arm, dict), "arm object")
            require(arm.get("Name") == name, "arm order")
            require(
                arm.get("Complete") is True and arm.get("Failure") is None,
                "incomplete arm",
            )
            episodes = arm.get("Episodes")
            require(
                isinstance(episodes, list) and len(episodes) == 1024, "episode roster"
            )
            for ordinal, episode in enumerate(episodes):
                require(isinstance(episode, dict), "episode object")
                exact(episode.get("Index"), ordinal, "episode order")
                require(
                    episode.get("Complete") is True and episode.get("Failure") is None,
                    "incomplete episode",
                )
    rows = cost.get("Rows")
    require(isinstance(rows, list) and len(rows) == 20, "cost row roster")
    for index, row in enumerate(cast(list[Any], rows)):
        replicate, order = divmod(index, 4)
        require(isinstance(row, dict), "cost row object")
        exact(row.get("Replicate"), replicate, "replicate order")
        exact(row.get("Order"), order, "arm position")
        exact(row.get("Name"), ARMS[(replicate + order) % 4], "rotated arm order")
        for key in ("WallMsTotal", "CpuMsTotal", "AllocatedBytesTotal"):
            value = row.get(key)
            require(
                type(value) in (int, float) and math.isfinite(value),
                f"cost {key}: numeric",
            )
            require(
                value >= 0 if key == "CpuMsTotal" else value > 0, f"cost {key}: range"
            )
        require(
            type(row["AllocatedBytesTotal"]) is int,
            "allocated byte count must be integer",
        )
        for key, count, start in (("WarmupEpisodes", 8, 0), ("TimedEpisodes", 64, 8)):
            episodes = row.get(key)
            require(
                isinstance(episodes, list) and len(episodes) == count,
                f"cost {key}: count",
            )
            for ordinal, episode in enumerate(episodes, start):
                require(isinstance(episode, dict), "cost episode object")
                exact(episode.get("Index"), ordinal, "cost episode order")
                require(
                    episode.get("Complete") is True and episode.get("Failure") is None,
                    "incomplete cost episode",
                )


def replay_registered(
    behavior: dict[str, Any],
    cost: dict[str, Any],
    progress: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Call only after source/header/roster admission; never during hand tests."""
    maximum = 0.0
    count = 0
    progress = {} if progress is None else progress
    progress.update(
        {
            "Phase": "behavior-replay",
            "BehaviorEpisodesCompared": 0,
            "CostEpisodesCompared": 0,
            "Current": None,
        }
    )
    for panel, config in zip(behavior["Panels"], PANELS, strict=True):
        tapes = reference.source_tapes(9101, config["Domain"], 1024)
        for arm, name in zip(panel["Arms"], ARMS, strict=True):
            for index, (episode, tape) in enumerate(
                zip(arm["Episodes"], tapes, strict=True)
            ):
                progress["Current"] = f"{config['Name']}/{name}/{index}"
                expected = reference.run_episode(
                    name,
                    config["Effect"],
                    config["Geometry"],
                    config["Palette"],
                    tape,
                    index,
                )
                maximum = max(
                    maximum,
                    compare_episode(
                        episode, expected, f"{config['Name']}/{name}/{index}"
                    ),
                )
                count += 1
                progress["BehaviorEpisodesCompared"] = count
    progress["Phase"] = "cost-replay"
    tapes = reference.source_tapes(9203, 921, 72)
    cost_count = 0
    for row in cost["Rows"]:
        for episode in row["WarmupEpisodes"] + row["TimedEpisodes"]:
            index = episode["Index"]
            progress["Current"] = f"cost/{row['Replicate']}/{row['Name']}/{index}"
            expected = reference.run_episode(
                row["Name"], True, "dot", "fixed", tapes[index], index
            )
            maximum = max(
                maximum,
                compare_episode(
                    episode, expected, f"cost/{row['Replicate']}/{row['Name']}/{index}"
                ),
            )
            cost_count += 1
            progress["CostEpisodesCompared"] = cost_count
    progress.update({"Phase": "complete", "Current": None})
    return {
        "BehaviorEpisodes": count,
        "CostEpisodes": cost_count,
        "MaximumAbsoluteError": maximum,
        "Mismatches": 0,
        "CostsRemeasured": False,
    }


def verify_hand(raw: bytes) -> dict[str, Any]:
    """Recompute all bounded hand values without using registered random tapes."""
    hand = strict_json(raw)
    require(isinstance(hand, dict), "hand object")
    for key, value in {
        "Protocol": PROTOCOL,
        "Kind": "hand-conformance",
        "Complete": True,
        "Failure": None,
        "ProtocolSha256": PROTOCOL_SHA,
    }.items():
        require(key in hand, f"hand missing {key}")
        exact(hand[key], value, f"hand {key}")
    transitions = []
    for effect in (False, True):
        for state in (0, 1):
            for action in (0, 1):
                for drift in (0, 1):
                    transitions.append(
                        {
                            "Effect": effect,
                            "X": state,
                            "Action": action,
                            "Drift": drift,
                            "Next": state ^ (int(effect) * action) ^ drift,
                            "Reward4": 4 * state if action == 0 else -1,
                        }
                    )

    # Keyed matching keeps complete uniqueness without imposing incidental grid
    # enumeration order that the protocol does not require.
    def keyed(rows: Any, keys: tuple[str, ...]) -> dict[tuple[Any, ...], Any]:
        require(isinstance(rows, list), "hand grid list")
        result = {}
        for row in rows:
            require(isinstance(row, dict), "hand grid row")
            identity = tuple(row[key] for key in keys)
            require(identity not in result, "duplicate hand grid row")
            result[identity] = row
        return result

    actual_transitions = keyed(
        hand.get("Transitions"), ("Effect", "X", "Action", "Drift")
    )
    expected_transitions = keyed(transitions, ("Effect", "X", "Action", "Drift"))
    exact(actual_transitions, expected_transitions, "transition grid")
    expected_cues = [
        {"X": state, "Error": error, "Y": state ^ error}
        for state in (0, 1)
        for error in (0, 1)
    ]
    exact(
        keyed(hand.get("Cues"), ("X", "Error")),
        keyed(expected_cues, ("X", "Error")),
        "cue grid",
    )
    conditioning = keyed(hand.get("Conditioning"), ("Prior", "Effect", "Action", "Cue"))
    planning = keyed(hand.get("Planning"), ("Prior", "Effect", "Depth"))
    require(len(conditioning) == 40 and len(planning) == 30, "complete hand math grids")
    maximum = 0.0
    for prior in (
        Fraction(0),
        Fraction(1, 4),
        Fraction(1, 2),
        Fraction(3, 4),
        Fraction(1),
    ):
        for effect in (False, True):
            for action in (0, 1):
                prior_after_action = 1 - prior if effect and action else prior
                predicted = Fraction(1, 8) + Fraction(3, 4) * prior_after_action
                for cue in (0, 1):
                    likelihood = Fraction(3, 4) if cue else Fraction(1, 4)
                    probability = likelihood * predicted + (1 - likelihood) * (
                        1 - predicted
                    )
                    posterior = likelihood * predicted / probability
                    expected_condition: dict[str, Any] = {
                        "Prior": float(prior),
                        "Effect": effect,
                        "Action": action,
                        "Cue": cue,
                        "Predicted": float(predicted),
                        "Posterior": float(posterior),
                    }
                    maximum = max(
                        maximum,
                        compare_episode(
                            conditioning[(float(prior), effect, action, cue)],
                            expected_condition,
                            "hand conditioning",
                        ),
                    )
            for depth in (1, 2, 3):
                values = reference.oracle_q(prior, effect, depth)
                nodes = (4**depth - 1) // 3
                predictions = 2 * ((4 ** (depth - 1) - 1) // 3)
                expected_plan: dict[str, Any] = {
                    "Prior": float(prior),
                    "Effect": effect,
                    "Depth": depth,
                    "Q": [float(value) for value in values],
                    "Counters": {
                        "Nodes": nodes,
                        "ActionValues": 2 * nodes,
                        "Predictions": predictions,
                        "Updates": 2 * predictions,
                    },
                }
                maximum = max(
                    maximum,
                    compare_episode(
                        planning[(float(prior), effect, depth)],
                        expected_plan,
                        "hand planning",
                    ),
                )
    episodes = keyed(
        hand.get("Episodes"), ("Tape", "Effect", "Geometry", "Palette", "Arm")
    )
    require(len(episodes) == 96, "complete hand episode roster")
    for tape_name, tape in reference.hand_tapes():
        for effect in (False, True):
            for geometry, palette in (
                ("dot", "fixed"),
                ("bar", "fixed"),
                ("dot", "odd-complement"),
            ):
                for arm in ARMS:
                    row = episodes[(tape_name, effect, geometry, palette, arm)]
                    expected_episode = reference.run_episode(
                        arm, effect, geometry, palette, tape, 0
                    )
                    maximum = max(
                        maximum,
                        compare_episode(
                            row["Episode"], expected_episode, "hand episode"
                        ),
                    )
    flags = keyed(hand.get("Falsifiers"), ("Name",))
    exact(
        flags,
        {(name,): {"Name": name, "Passed": True} for name in FALSIFIERS},
        "native hand falsifiers",
    )
    independent = reference.verify_falsifiers()
    exact(
        independent, {name: True for name in FALSIFIERS}, "independent hand falsifiers"
    )
    return {
        "InputSha256": sha(raw),
        "Transitions": 16,
        "Cues": 4,
        "Conditioning": 40,
        "Planning": 30,
        "Episodes": 96,
        "MaximumAbsoluteError": maximum,
        "NativeAndIndependentFalsifiers": list(FALSIFIERS),
    }


def write_new(output: Path, receipt: dict[str, Any]) -> None:
    partial = output.with_name(output.name + ".partial")
    output_available(output)
    raw = (json.dumps(receipt, indent=2, allow_nan=False) + "\n").encode()
    with partial.open("xb") as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    # Hard-link creation is exclusive even if another writer appeared meanwhile.
    os.link(partial, output)
    partial.unlink()


def output_available(output: Path) -> None:
    partial = output.with_name(output.name + ".partial")
    require(
        not output.exists() and not partial.exists(), "output or partial already exists"
    )


def run_replay(
    root: Path, behavior_path: Path, cost_path: Path, arguments: list[str] | None = None
) -> dict[str, Any]:
    result = attempt(
        "replay",
        arguments
        if arguments is not None
        else ["run_replay", str(root), str(behavior_path), str(cost_path)],
    )
    try:
        provenance = admit_sources(root, Path(__file__))
        result["Provenance"] = provenance
        result["HandConformance"] = verify_hand((root / HAND_FILE).read_bytes())
        raw_behavior = behavior_path.read_bytes()
        result["InputBehaviorSha256"] = sha(raw_behavior)
        raw_cost = cost_path.read_bytes()
        result["InputCostSha256"] = sha(raw_cost)
        behavior, cost = strict_json(raw_behavior), strict_json(raw_cost)
        admitted_header(behavior, "behavior", provenance)
        admitted_header(cost, "cost", provenance)
        admit_native_commits(root, behavior, cost)
        exact(cost.get("InputBehaviorSha256"), sha(raw_behavior), "cost input binding")
        admitted_rosters(behavior, cost)
        result["Replay"] = replay_registered(
            behavior, cost, result["ExecutionProgress"]
        )
        exact(
            admit_sources(root, Path(__file__)),
            provenance,
            "source state changed during replay",
        )
        result["Complete"] = True
    except (ValueError, OSError, KeyError, TypeError, OverflowError) as error:
        result["Failure"] = {
            "Stage": "replay",
            "Code": type(error).__name__,
            "Detail": str(error),
        }
    result["FinishedAtUtc"] = utc()
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("behavior", type=Path)
    parser.add_argument("cost", type=Path)
    parser.add_argument(
        "--root", type=Path, default=Path(__file__).resolve().parents[3]
    )
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        output_available(args.output)
        result = run_replay(args.root, args.behavior, args.cost, sys.argv[1:])
        write_new(args.output, result)
    except (OSError, ValueError) as error:
        print(f"hidden-switch output refusal: {error}", file=sys.stderr)
        return 2
    print(json.dumps({"Complete": result["Complete"], "Failure": result["Failure"]}))
    return 0 if result["Complete"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
