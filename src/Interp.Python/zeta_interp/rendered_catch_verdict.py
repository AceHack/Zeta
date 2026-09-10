"""Strict byte/source admission and registered arithmetic for rendered catch.

This checker reads completed receipts. It neither executes the registered
experiment nor interprets a promotion decision as planning or ARC competence.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import re
import statistics
import struct
import subprocess
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

PROTOCOL = "rendered-catch-actions-v1"
ARCHIVE = "refs/tags/archive/experiments/081M1W8T690087G0R002DJ91MJ"
REGISTRATION = ARCHIVE + "-registration"
PROTOCOL_FILE = "docs/research/2026-09-06-rendered-catch-actions-protocol.md"
MODEL_FILE = "src/Research.FSharp/rendered-signal-results.json"
OWN_FILE = "src/Interp.Python/zeta_interp/rendered_catch_verdict.py"
MODEL_SHA = "C59468575B140DA146265182EE40B03D6F6B5103FAAC9A0137CE8A288DF357B3"
COUNTS_SHA = "8BEFD54B878D600A31A75BB5FA159588D2FDA4A849CAFB1410F03D6BC9B5B2A5"
SOURCE_FILES = (
    "src/Core/Chip8.fs",
    "src/Core/Chip8Cow.fs",
    "src/Core/ControlScheme.fs",
    "src/Core/FrameMotion.fs",
    "src/Core/FrameSignals.fs",
    "src/Core/GameEnvironment.fs",
    "src/Core/SplitMix64.fs",
    "src/Research.FSharp/ResearchRandom.fs",
    "src/Research.FSharp/RenderedSignalCarrier.fs",
    "src/Research.FSharp/RenderedCatchReceipt.fs",
    "src/Research.FSharp/RenderedCatchCarrier.fs",
    "src/Research.FSharp/RenderedCatchPolicy.fs",
    "src/Research.FSharp/RenderedCatchExperiment.fs",
    "src/Research.FSharp/RenderedCatchRuntime.fsx",
    "src/Research.FSharp/run-rendered-catch-experiment.fsx",
    "src/Research.FSharp/measure-rendered-catch-inference.fsx",
    "src/Research.FSharp/check-rendered-catch-kernel.fsx",
    "src/Interp.Python/zeta_interp/mess3_replay.py",
    "src/Interp.Python/zeta_interp/rendered_catch_carrier.py",
    "src/Interp.Python/zeta_interp/rendered_catch_replay.py",
    OWN_FILE,
    MODEL_FILE,
    PROTOCOL_FILE,
)
ARMS = ("order-two", "bigram", "last-beacon", "fair-independent", "known-lag-two")
CONTROLS = ARMS[1:4]
PANELS = (
    "dot-three-quarter",
    "bar-three-quarter",
    "palette-three-quarter",
    "dot-iid-half",
)
CONFIG = {
    "Arms": list(ARMS),
    "Panels": [
        {
            "Name": name,
            "Episodes": 1024,
            "SourceSeed": 4001,
            "SourceDomain": 401 + i,
            "ActionSeed": 5003,
            "ActionDomain": 501 + i,
            "CopyProbability": 0.5 if i == 3 else 0.75,
            "Geometry": "bar" if i == 1 else "dot",
            "Palette": "odd-complement" if i == 2 else "fixed",
        }
        for i, name in enumerate(PANELS)
    ],
    "Symbols": 66,
    "ScoredChoices": 64,
    "WarmupKey": 0,
    "EmulatorSeed": 1,
    "CyclesPerCall": 17,
    "RomBytes": 2247,
    "ProjectionRows": 24,
    "Cost": {
        "SourceSeed": 7001,
        "SourceDomain": 701,
        "Episodes": 72,
        "WarmupEpisodes": 8,
        "TimedEpisodes": 64,
        "ActionSeed": 8003,
        "ActionDomain": 801,
        "Repetitions": 5,
        "Rotation": "left-by-repetition",
    },
    "PositiveGainNumerator": 15,
    "PositiveGainDenominator": 100,
    "NullGainNumerator": 3,
    "NullGainDenominator": 100,
    "MaximumCostRatio": 2.0,
}
PROVENANCE_KEYS = "SourceCommit ImplementationArchive ImplementationCommit SourceHashes LoadedAssemblies Runtime OperatingSystem Arguments"
REPLAY_EXPECTED = {
    "Protocol": PROTOCOL,
    "Kind": "independent-replay",
    "Complete": True,
    "Failure": None,
    "Passed": True,
    "ExactMatch": True,
    "MismatchCount": 0,
    "MaximumAbsoluteError": 0.0,
    "FullBehaviorEpisodes": 20480,
    "BehaviorArmPanels": 20,
    "CostRows": 25,
    "CostWarmupEpisodes": 200,
    "CostTimedEpisodes": 1600,
    "CountsSha256": COUNTS_SHA,
}


def digest(raw):
    return hashlib.sha256(raw).hexdigest().upper()


def keys(value, expected, label):
    wanted = set(expected.split() if isinstance(expected, str) else expected)
    if type(value) is not dict or set(value) != wanted:
        raise ValueError(f"{label}: missing or unexpected fields")


def exact(actual, expected, label):
    """Strict integer/bool/container comparison; JSON may render a float as 2."""
    if type(expected) is dict:
        keys(actual, expected, label)
        for key, value in expected.items():
            exact(actual[key], value, f"{label}.{key}")
    elif type(expected) is list:
        if type(actual) is not list or len(actual) != len(expected):
            raise ValueError(f"{label}: wrong ordered roster length")
        for index, (left, right) in enumerate(zip(actual, expected, strict=True)):
            exact(left, right, f"{label}[{index}]")
    elif type(expected) is float:
        if (
            type(actual) not in (int, float)
            or not math.isfinite(actual)
            or actual != expected
        ):
            raise ValueError(f"{label}: changed numeric value")
    elif type(actual) is not type(expected) or actual != expected:
        raise ValueError(f"{label}: changed value or scalar type")


def integer(value, label, minimum=0, maximum=2**63 - 1):
    if type(value) is not int or not minimum <= value <= maximum:
        raise ValueError(f"{label}: expected bounded integer")
    return value


def number(value, label, positive=False):
    if (
        type(value) not in (int, float)
        or not math.isfinite(value)
        or value < 0
        or (positive and value == 0)
    ):
        raise ValueError(
            f"{label}: expected finite {'positive' if positive else 'nonnegative'} number"
        )
    return value


def text(value, label):
    if type(value) is not str or not value.strip():
        raise ValueError(f"{label}: expected nonempty text")
    return value


def sha(value, label):
    if type(value) is not str or not re.fullmatch(r"[A-F0-9]{64}", value):
        raise ValueError(f"{label}: expected uppercase SHA256")
    return value


def bits(value, count, label):
    if type(value) is not str or len(value) != count or set(value) - {"0", "1"}:
        raise ValueError(f"{label}: expected {count} binary characters")
    return value


def load_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    def constant(value):
        raise ValueError(f"nonfinite JSON constant: {value}")

    return json.loads(raw, object_pairs_hook=pairs, parse_constant=constant)


def _git(root, *args):
    try:
        return subprocess.run(
            ["git", "-C", str(root), *args],
            check=True,
            capture_output=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError) as error:
        raise ValueError(
            f"source archive verification failed: {' '.join(args[:2])}"
        ) from error


def _commit(root, ref):
    result = _git(root, "rev-parse", "--verify", ref + "^{commit}").decode().strip()
    if not re.fullmatch(r"[0-9a-f]{40}", result):
        raise ValueError("expected resolved full source commit")
    return result


def _archive_hashes(root):
    implementation = _commit(root, ARCHIVE)
    registration = _commit(root, REGISTRATION)
    _git(root, "merge-base", "--is-ancestor", registration, implementation)
    hashes = []
    for file in SOURCE_FILES:
        archived = _git(root, "show", f"{implementation}:{file}")
        current = (root / file).read_bytes()
        if current != archived:
            raise ValueError(f"source bytes differ from immutable archive: {file}")
        hashes.append({"File": file, "Sha256": digest(archived)})
    return implementation, hashes


def validate_provenance(provenance, root, admitted=None, python=False):
    keys(provenance, PROVENANCE_KEYS, "provenance")
    implementation, hashes = admitted or _archive_hashes(root)
    exact(provenance["ImplementationArchive"], ARCHIVE, "implementation archive")
    exact(provenance["ImplementationCommit"], implementation, "implementation commit")
    exact(provenance["SourceHashes"], hashes, "source manifest")
    commit = provenance["SourceCommit"]
    if type(commit) is not str or not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("source commit must be a full SHA")
    exact(_commit(root, commit), commit, "source commit")
    # Squash merges may preserve every admitted byte without archive ancestry.
    # The commit label must describe these files, not merely resolve to a commit.
    for row in hashes:
        exact(
            digest(_git(root, "show", f"{commit}:{row['File']}")),
            row["Sha256"],
            "committed source bytes",
        )
    for key in ("Runtime", "OperatingSystem"):
        text(provenance[key], key)
    arguments = provenance["Arguments"]
    if type(arguments) is not list or not arguments:
        raise ValueError("provenance arguments must record the invocation")
    for item in arguments:
        text(item, "argument")
    assemblies = provenance["LoadedAssemblies"]
    if python:
        exact(assemblies, [], "Python assemblies")
    else:
        if type(assemblies) is not list or len(assemblies) != 2:
            raise ValueError("native loaded assembly roster")
        for row, name in zip(
            assemblies, ("Zeta.Core", "Zeta.Core.Abstractions"), strict=True
        ):
            keys(row, "Name Mvid Sha256", "assembly")
            exact(row["Name"], name, "assembly name")
            sha(row["Sha256"], "assembly hash")
            if (
                type(row["Mvid"]) is not str
                or str(uuid.UUID(row["Mvid"])) != row["Mvid"]
            ):
                raise ValueError("assembly MVID must be canonical")


def source_manifest(root, arguments):
    root = Path(root).resolve()
    if Path(__file__).resolve() != (root / OWN_FILE).resolve():
        raise ValueError("executed verdict module is outside the admitted source root")
    implementation, hashes = _archive_hashes(root)
    value = {
        "SourceCommit": _commit(root, "HEAD"),
        "ImplementationArchive": ARCHIVE,
        "ImplementationCommit": implementation,
        "SourceHashes": hashes,
        "LoadedAssemblies": [],
        "Runtime": f"{platform.python_implementation()} {platform.python_version()}",
        "OperatingSystem": platform.platform(),
        "Arguments": list(arguments),
    }
    validate_provenance(value, root, (implementation, hashes), python=True)
    return value


def load_model(root):
    raw = (root / MODEL_FILE).read_bytes()
    exact(digest(raw), MODEL_SHA, "model input hash")
    document = load_json(raw)
    exact(document["Complete"], True, "model complete")
    counts = document["Counts"]
    keys(counts, "Unigram Bigram OrderTwo", "model counts")
    if (
        type(counts["Bigram"]) is not list
        or len(counts["Bigram"]) != 2
        or type(counts["OrderTwo"]) is not list
        or len(counts["OrderTwo"]) != 2
        or any(type(row) is not list or len(row) != 2 for row in counts["OrderTwo"])
    ):
        raise ValueError("model count shape")
    rows = [
        counts["Unigram"],
        *counts["Bigram"],
        *[row for matrix in counts["OrderTwo"] for row in matrix],
    ]
    values = []
    for row in rows:
        if type(row) is not list or len(row) != 2:
            raise ValueError("model binary row")
        for value in row:
            if number(value, "probability", True) >= 1:
                raise ValueError("model probability must be interior")
        if abs(sum(row) - 1.0) > 1e-12:
            raise ValueError("model row normalization")
        values.extend(row)
    exact(digest(struct.pack("<14d", *values)), COUNTS_SHA, "count fingerprint")
    return counts


def counters(episodes):
    return {
        "Episodes": episodes,
        "EnvironmentCalls": episodes * 66,
        "KeyActions": episodes * 65,
        "ScoredChoices": episodes * 64,
        "PrimaryInstructions": episodes * 1122,
        "ShadowInstructions": episodes * 1122,
        "TotalTransitions": episodes * 2244,
        "PrimaryTimerTicks": episodes * 66,
        "ShadowTimerTicks": episodes * 66,
        "AdapterGroupsChecked": episodes * 66,
    }


def payload(row, name):
    expected_keys = "ParameterFloat64Values ParameterBytes HistoryInt32Slots HistoryBytes ObservationCountBytes FairStreamStateBytes FairInitialSeedBytes FairDrawCountBytes RomBytes FullFrameCellBytes ProjectedFrameCellBytes Scope"
    keys(row, expected_keys, "payload")
    parameters = 14 if name == "order-two" else 6 if name == "bigram" else 0
    slots = (
        2
        if name in ("order-two", "known-lag-two")
        else 1
        if name in ("bigram", "last-beacon")
        else 0
    )
    expected = {
        "ParameterFloat64Values": parameters,
        "ParameterBytes": 8 * parameters,
        "HistoryInt32Slots": slots,
        "HistoryBytes": slots * 4,
        "ObservationCountBytes": 4,
        "FairStreamStateBytes": 8 if name == "fair-independent" else 0,
        "FairInitialSeedBytes": 8 if name == "fair-independent" else 0,
        "FairDrawCountBytes": 8 if name == "fair-independent" else 0,
        "RomBytes": 2247,
        "FullFrameCellBytes": 2048,
        "ProjectedFrameCellBytes": 2048,
    }
    for key, value in expected.items():
        exact(row[key], value, f"payload {key}")
    text(row["Scope"], "payload scope")


def source(row, episodes, seed, domain):
    keys(
        row,
        "SourceSeed SourceDomain SourceDraws SourceSymbols SourceSymbolsSha256 SourceRomSha256 Episodes SymbolsPerEpisode RomBytes",
        "source",
    )
    for key, value in {
        "SourceSeed": seed,
        "SourceDomain": domain,
        "SourceDraws": 66 * episodes,
        "Episodes": episodes,
        "SymbolsPerEpisode": 66,
        "RomBytes": 2247,
    }.items():
        exact(row[key], value, key)
    symbols = row["SourceSymbols"]
    if type(symbols) is not list or len(symbols) != episodes:
        raise ValueError("source episode roster")
    raw = bytearray()
    for symbol in symbols:
        raw.extend(int(x) for x in bits(symbol, 66, "source symbols"))
    exact(row["SourceSymbolsSha256"], digest(raw), "source symbol hash")
    sha(row["SourceRomSha256"], "source ROM hash")
    return symbols


def batch(row, name, symbols, start, counts):
    keys(
        row,
        "Complete Failure ActionDraws TotalHits MeanHitFraction Counters FrameSha256 ProjectionSha256 ShadowTraceSha256 Episodes",
        "batch",
    )
    size = len(symbols)
    exact(row["Complete"], True, "batch complete")
    exact(row["Failure"], None, "batch failure")
    exact(row["Counters"], counters(size), "batch counters")
    exact(
        row["ActionDraws"],
        size * 64 if name == "fair-independent" else 0,
        "action draws",
    )
    episodes = row["Episodes"]
    if type(episodes) is not list or len(episodes) != size:
        raise ValueError("episode roster")
    returns = []
    for index, (episode, observations) in enumerate(
        zip(episodes, symbols, strict=True), start
    ):
        keys(
            episode,
            "Index Complete Failure Actions Hits Observations WarmupHit Return Counters FrameSha256 ProjectionSha256 ShadowTraceSha256",
            "episode",
        )
        for key, value in {
            "Index": index,
            "Complete": True,
            "Failure": None,
            "Counters": counters(1),
        }.items():
            exact(episode[key], value, f"episode {key}")
        exact(
            episode["Observations"],
            observations,
            "decoded observations/source conformance",
        )
        actions = bits(episode["Actions"], 64, "actions")
        hits = bits(episode["Hits"], 64, "hits")
        # This is receipt consistency, not replacement of the full rendered replay.
        expected_hits = "".join(
            str(int(key == target))
            for key, target in zip(actions, observations[2:], strict=True)
        )
        exact(hits, expected_hits, "rendered hits/key/observation conformance")
        exact(episode["WarmupHit"], int(observations[1] == "0"), "fixed warmup hit")
        if name != "fair-independent":
            expected = []
            for t in range(2, 66):
                a, b = int(observations[t - 2]), int(observations[t - 1])
                key = (
                    int(counts["OrderTwo"][a][b][1] > 0.5)
                    if name == "order-two"
                    else int(counts["Bigram"][b][1] > 0.5)
                    if name == "bigram"
                    else a
                    if name == "known-lag-two"
                    else b
                )
                expected.append(str(key))
            exact(actions, "".join(expected), "prefix policy actions")
        value = sum(int(hit) for hit in hits)
        exact(episode["Return"], value, "episode return")
        returns.append(value)
        for field in ("FrameSha256", "ProjectionSha256", "ShadowTraceSha256"):
            sha(episode[field], field)
    exact(row["TotalHits"], sum(returns), "total hits")
    exact(row["MeanHitFraction"], sum(returns) / (64 * size), "mean hit fraction")
    for field in ("FrameSha256", "ProjectionSha256", "ShadowTraceSha256"):
        sha(row[field], field)
    return returns


def timestamp(value):
    parsed = datetime.fromisoformat(text(value, "UTC timestamp"))
    if parsed.utcoffset() != timedelta(0):
        raise ValueError("timestamp must identify UTC")
    return parsed


def validate_metadata(native, cost, replay, root, counts, own):
    native_keys = "Protocol Kind Complete Failure ProtocolSha256 InputSha256 CountsSha256Before CountsSha256After Config Provenance StartedAtUtc FinishedAtUtc Panels"
    cost_keys = "Protocol Kind Complete Failure ProtocolSha256 InputSha256 ModelInputSha256 CountsSha256Before CountsSha256After Config Provenance StartedAtUtc FinishedAtUtc QuietWindowDeclaration HostActivity Source Measurements"
    keys(native, native_keys, "native")
    keys(cost, cost_keys, "cost")
    keys(
        replay,
        set(REPLAY_EXPECTED)
        | {"InputSha256", "CostInputSha256", "ProtocolSha256", "Provenance"},
        "replay",
    )
    for key, value in REPLAY_EXPECTED.items():
        exact(replay[key], value, f"replay {key}")
    protocol_hash = digest((root / PROTOCOL_FILE).read_bytes())
    admitted = (own["ImplementationCommit"], own["SourceHashes"])
    for receipt, kind, is_python in (
        (native, "behavior", False),
        (cost, "cost", False),
        (replay, "independent-replay", True),
    ):
        exact(receipt["Protocol"], PROTOCOL, "protocol")
        exact(receipt["Kind"], kind, "kind")
        exact(receipt["Complete"], True, "complete")
        exact(receipt["Failure"], None, "failure")
        exact(receipt["ProtocolSha256"], protocol_hash, "protocol hash")
        validate_provenance(receipt["Provenance"], root, admitted, python=is_python)
        if not is_python:
            exact(receipt["Config"], CONFIG, "registered config")
            exact(receipt["CountsSha256Before"], COUNTS_SHA, "count hash before")
            exact(receipt["CountsSha256After"], COUNTS_SHA, "count hash after")
            if timestamp(receipt["StartedAtUtc"]) > timestamp(receipt["FinishedAtUtc"]):
                raise ValueError("reversed attempt timestamps")
    exact(native["InputSha256"], MODEL_SHA, "native model input")
    exact(cost["ModelInputSha256"], MODEL_SHA, "cost model input")
    for key in ("LoadedAssemblies", "Runtime", "OperatingSystem"):
        exact(
            native["Provenance"][key],
            cost["Provenance"][key],
            "matched native/cost runtime",
        )
    if timestamp(cost["StartedAtUtc"]) < timestamp(native["FinishedAtUtc"]):
        raise ValueError("cost run began before behavioral completion")
    text(cost["QuietWindowDeclaration"], "quiet window declaration")
    text(cost["HostActivity"], "uncontrolled host activity")
    panels = native["Panels"]
    if type(panels) is not list or len(panels) != 4:
        raise ValueError("panel roster")
    totals = {}
    known_matches = []
    for panel, config in zip(panels, CONFIG["Panels"], strict=True):
        keys(panel, "Config Source Arms PairedReturns", "panel")
        exact(panel["Config"], config, "panel config")
        symbols = source(
            panel["Source"], 1024, config["SourceSeed"], config["SourceDomain"]
        )
        arms = panel["Arms"]
        if type(arms) is not list or len(arms) != 5:
            raise ValueError("arm roster")
        returns = {}
        for arm, name in zip(arms, ARMS, strict=True):
            keys(arm, "Name Payload Batch", "arm")
            exact(arm["Name"], name, "arm order")
            payload(arm["Payload"], name)
            returns[name] = batch(arm["Batch"], name, symbols, 0, counts)
            projection = arm["Batch"]["ProjectionSha256"]
            exact(
                projection,
                arms[0]["Batch"]["ProjectionSha256"],
                "cross-arm projected stream",
            )
            for left, right in zip(
                arm["Batch"]["Episodes"], arms[0]["Batch"]["Episodes"], strict=True
            ):
                exact(
                    left["ProjectionSha256"],
                    right["ProjectionSha256"],
                    "cross-arm episode projection",
                )
        diagnostic = all(
            a["Actions"] == b["Actions"]
            for a, b in zip(
                arms[0]["Batch"]["Episodes"], arms[4]["Batch"]["Episodes"], strict=True
            )
        )
        known_matches.append(
            {"Panel": config["Name"], "ComparedChoices": 65536, "Passed": diagnostic}
        )
        expected_pairs = []
        for name in CONTROLS:
            differences = [
                a - b for a, b in zip(returns["order-two"], returns[name], strict=True)
            ]
            expected_pairs.append(
                {
                    "Control": name,
                    "Differences": differences,
                    "TotalDifference": sum(differences),
                }
            )
        exact(panel["PairedReturns"], expected_pairs, "paired returns")
        totals[config["Name"]] = {name: sum(values) for name, values in returns.items()}
    return totals, known_matches


def cost_medians(cost, counts):
    symbols = source(cost["Source"], 72, 7001, 701)
    rows = cost["Measurements"]
    if type(rows) is not list or len(rows) != 25:
        raise ValueError("cost repetition roster")
    resources = {name: [] for name in ARMS}
    for position, row in enumerate(rows):
        repetition, ordinal = divmod(position, 5)
        name = ARMS[(ordinal + repetition) % 5]
        keys(
            row,
            "Repetition Name Payload Warmup Timed Resource WarmupSourceDraws TimedSourceDraws WarmupActionDraws TimedActionDraws SourceSymbolsSha256 SourceRomSha256",
            "cost row",
        )
        exact(row["Repetition"], repetition, "cost repetition")
        exact(row["Name"], name, "rotated cost arm")
        payload(row["Payload"], name)
        batch(row["Warmup"], name, symbols[:8], 0, counts)
        batch(row["Timed"], name, symbols[8:], 8, counts)
        for key, expected in {
            "WarmupSourceDraws": 0,
            "TimedSourceDraws": 0,
            "WarmupActionDraws": 512 if name == "fair-independent" else 0,
            "TimedActionDraws": 4096 if name == "fair-independent" else 0,
        }.items():
            exact(row[key], expected, key)
        for key in ("SourceSymbolsSha256", "SourceRomSha256"):
            exact(row[key], cost["Source"][key], "cost corpus hash")
        resource = row["Resource"]
        keys(resource, "ElapsedMilliseconds CpuMilliseconds AllocatedBytes", "resource")
        wall = (
            number(resource["ElapsedMilliseconds"], "elapsed milliseconds", True) / 64
        )
        cpu = number(resource["CpuMilliseconds"], "CPU milliseconds") / 64
        allocated = (
            integer(resource["AllocatedBytes"], "allocated bytes", minimum=1) / 64
        )
        resources[name].append(
            {
                "Repetition": repetition,
                "MillisecondsPerEpisode": wall,
                "CpuMillisecondsPerEpisode": cpu,
                "AllocatedBytesPerEpisode": allocated,
            }
        )
    medians = []
    for name in ARMS:
        values = resources[name]
        row = {"Name": name, "Repetitions": values}
        for field in (
            "MillisecondsPerEpisode",
            "CpuMillisecondsPerEpisode",
            "AllocatedBytesPerEpisode",
        ):
            row["Median" + field] = statistics.median(value[field] for value in values)
        medians.append(row)
    control = medians[1]
    for field in ("MillisecondsPerEpisode", "AllocatedBytesPerEpisode"):
        number(control["Median" + field], "bigram denominator", True)
    return medians


def threshold_verdict(totals, known_matches, medians):
    conditions = []
    for panel in PANELS:
        for control in CONTROLS:
            order, baseline = totals[panel]["order-two"], totals[panel][control]
            difference = order - baseline
            null = panel == "dot-iid-half"
            left = 100 * (abs(difference) if null else difference)
            right = (3 if null else 15) * 65536
            conditions.append(
                {
                    "Panel": panel,
                    "Control": control,
                    "OrderTwoHits": order,
                    "ControlHits": baseline,
                    "TotalDifference": difference,
                    "MeanHitFractionDifference": difference / 65536,
                    "LeftOperand": left,
                    "Operator": "<=" if null else ">=",
                    "RightOperand": right,
                    "Passed": left <= right if null else left >= right,
                }
            )
    cost_conditions = []
    for field in ("MillisecondsPerEpisode", "AllocatedBytesPerEpisode"):
        numerator, denominator = (
            medians[0]["Median" + field],
            medians[1]["Median" + field],
        )
        number(denominator, "cost denominator", True)
        ratio = numerator / denominator
        number(ratio, "cost ratio")
        cost_conditions.append(
            {
                "Metric": field,
                "OrderTwoMedian": numerator,
                "BigramMedian": denominator,
                "Ratio": ratio,
                "MaximumRatio": 2.0,
                "Passed": ratio <= 2.0,
            }
        )
    descriptive = []
    for row in medians:
        ratios = {}
        for field in (
            "MillisecondsPerEpisode",
            "AllocatedBytesPerEpisode",
            "CpuMillisecondsPerEpisode",
        ):
            numerator = row["Median" + field]
            denominator = medians[1]["Median" + field]
            quotient = numerator / denominator if denominator > 0 else None
            finite = quotient is not None and math.isfinite(quotient)
            ratios[field] = {
                "Ratio": quotient if finite else None,
                "Status": "finite"
                if finite
                else "zero-denominator"
                if denominator == 0
                else "nonfinite-quotient",
            }
        descriptive.append(
            {"Name": row["Name"], "ReferenceArm": "bigram", "Ratios": ratios}
        )
    return {
        "DescriptiveCostRatios": descriptive,
        "ReturnConditions": conditions,
        "KnownLagTwoConformance": known_matches,
        "CostMedians": medians,
        "CostConditions": cost_conditions,
        "PromotionEligible": all(
            row["Passed"] for row in conditions + cost_conditions + known_matches
        ),
    }


def verdict(
    native_bytes, cost_bytes, replay_bytes, root=None, arguments=None, attempt=None
):
    attempt = {} if attempt is None else attempt
    attempt.update(
        InputSha256=digest(native_bytes),
        CostInputSha256=digest(cost_bytes),
        ReplayInputSha256=digest(replay_bytes),
        Stage="source-admission",
    )
    root = (
        Path(root).resolve()
        if root is not None
        else Path(__file__).resolve().parents[3]
    )
    own = source_manifest(
        root, arguments or [sys.executable, "-m", "zeta_interp.rendered_catch_verdict"]
    )
    attempt["Provenance"] = own
    attempt["Stage"] = "receipt-json"
    native, cost, replay = (
        load_json(raw) for raw in (native_bytes, cost_bytes, replay_bytes)
    )
    if any(type(row) is not dict for row in (native, cost, replay)):
        raise ValueError("receipt must be a JSON object")
    native_hash, cost_hash = digest(native_bytes), digest(cost_bytes)
    attempt["Stage"] = "receipt-byte-binding"
    for actual, expected in (
        (cost.get("InputSha256"), native_hash),
        (replay.get("InputSha256"), native_hash),
        (replay.get("CostInputSha256"), cost_hash),
    ):
        exact(actual, expected, "receipt byte binding")
    attempt["Stage"] = "frozen-model-admission"
    counts = load_model(root)
    attempt["Stage"] = "receipt-metadata"
    totals, known_matches = validate_metadata(native, cost, replay, root, counts, own)
    attempt["Stage"] = "cost-arithmetic"
    medians = cost_medians(cost, counts)
    attempt["Stage"] = "threshold-arithmetic"
    result = threshold_verdict(totals, known_matches, medians)
    return {
        "Protocol": PROTOCOL,
        "Kind": "verdict",
        "Complete": True,
        "Failure": None,
        "InputSha256": native_hash,
        "CostInputSha256": cost_hash,
        "ReplayInputSha256": digest(replay_bytes),
        "ProtocolSha256": native["ProtocolSha256"],
        "CountsSha256": COUNTS_SHA,
        "Provenance": own,
        "AdmissionPassed": True,
        **result,
        "AllRegisteredConditionsMet": result["PromotionEligible"],
        "Interpretation": "Registered practical thresholds for a supplied-representation contextual bandit; no statistical-significance, planning, learned-vision or ARC claim.",
        "Arithmetic": "Exact integer hit thresholds; five-repetition medians of whole-episode resources including primary and shadow execution. Timing metadata is not independently remeasured.",
    }


def _write_new(path, result):
    raw = (json.dumps(result, indent=2, allow_nan=False) + "\n").encode()
    partial = path.with_name(path.name + ".partial")
    if path.exists() or partial.exists():
        raise ValueError("refusing to overwrite a receipt or partial attempt")
    with partial.open("xb") as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    os.link(
        partial, path
    )  # exclusive destination creation; never replace an existing receipt
    partial.unlink()
    return digest(raw)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("native", "cost", "replay", "output"):
        parser.add_argument(name, type=Path)
    parser.add_argument(
        "--root", type=Path, default=Path(__file__).resolve().parents[3]
    )
    args = parser.parse_args(argv)
    if (
        args.output.exists()
        or args.output.with_name(args.output.name + ".partial").exists()
    ):
        raise SystemExit("verdict refused: output or partial attempt already exists")
    raw = []
    attempt = {
        "InputSha256": None,
        "CostInputSha256": None,
        "ReplayInputSha256": None,
        "Provenance": None,
        "Stage": "input-read",
    }
    failed = False
    try:
        for path, field in (
            (args.native, "InputSha256"),
            (args.cost, "CostInputSha256"),
            (args.replay, "ReplayInputSha256"),
        ):
            attempt["Stage"] = "input-read:" + field
            value = path.read_bytes()
            raw.append(value)
            attempt[field] = digest(value)
        attempt["Stage"] = "verdict-admission"
        result = verdict(
            *raw,
            root=args.root,
            attempt=attempt,
            arguments=[sys.executable, *sys.argv]
            if argv is None
            else [sys.executable, "rendered_catch_verdict", *map(str, argv)],
        )
    except (
        OSError,
        ValueError,
        TypeError,
        KeyError,
        OverflowError,
        AttributeError,
    ) as error:
        failed = True
        result = {
            "Protocol": PROTOCOL,
            "Kind": "verdict",
            "Complete": False,
            "Failure": {
                "Stage": attempt["Stage"],
                "Code": "refused",
                "Detail": str(error),
            },
            "InputSha256": attempt["InputSha256"],
            "CostInputSha256": attempt["CostInputSha256"],
            "ReplayInputSha256": attempt["ReplayInputSha256"],
            "Provenance": attempt["Provenance"],
        }
    try:
        print(_write_new(args.output, result))
    except (OSError, ValueError) as error:
        raise SystemExit(f"verdict output refused: {error}") from error
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
