"""Strict archival admission and independent full rendered-catch replay."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import re
import subprocess
import sys
import uuid
from datetime import datetime
from pathlib import Path

from zeta_interp.mess3_replay import Stream, domain
from zeta_interp.rendered_catch_carrier import (
    ARMS,
    COUNTS_SHA,
    MODEL_SHA,
    binary,
    compile_rom,
    count_hash,
    counters,
    run_batch,
    sha,
    source_rows,
)

PROTOCOL = "rendered-catch-actions-v1"
ARCHIVE = "refs/tags/archive/experiments/081M1W8T690087G0R002DJ91MJ"
REGISTRATION = "refs/tags/archive/experiments/081M1W8T690087G0R002DJ91MJ-registration"
PROTOCOL_FILE = "docs/research/2026-09-06-rendered-catch-actions-protocol.md"
MODEL_FILE = "src/Research.FSharp/rendered-signal-results.json"
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
    "src/Interp.Python/zeta_interp/rendered_catch_verdict.py",
    MODEL_FILE,
    PROTOCOL_FILE,
)
CONFIG = {
    "Arms": list(ARMS),
    "Panels": [
        {
            "Name": name,
            "Episodes": 1024,
            "SourceSeed": 4001,
            "SourceDomain": 401 + index,
            "ActionSeed": 5003,
            "ActionDomain": 501 + index,
            "CopyProbability": probability,
            "Geometry": geometry,
            "Palette": palette,
        }
        for index, (name, probability, geometry, palette) in enumerate(
            (
                ("dot-three-quarter", 0.75, "dot", "fixed"),
                ("bar-three-quarter", 0.75, "bar", "fixed"),
                ("palette-three-quarter", 0.75, "dot", "odd-complement"),
                ("dot-iid-half", 0.5, "dot", "fixed"),
            )
        )
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


def exact(actual, expected, label="receipt"):
    """No tolerance, bool-as-int, omitted/extra field, or vacuous zip acceptance."""
    if isinstance(expected, dict):
        if type(actual) is not dict or actual.keys() != expected.keys():
            raise ValueError(f"{label}: fields")
        for key, value in expected.items():
            exact(actual[key], value, f"{label}.{key}")
    elif isinstance(expected, (list, tuple)):
        if type(actual) is not list or len(actual) != len(expected):
            raise ValueError(f"{label}: row count")
        for index, (left, right) in enumerate(zip(actual, expected, strict=True)):
            exact(left, right, f"{label}[{index}]")
    elif type(expected) is float:
        if (
            type(actual) not in (float, int)
            or not math.isfinite(actual)
            or actual != expected
        ):
            raise ValueError(f"{label}: numeric value")
    elif type(actual) is not type(expected) or actual != expected:
        raise ValueError(f"{label}: discrete value")


def fields(value, names, label):
    if type(value) is not dict or set(value) != set(names.split()):
        raise ValueError(f"{label}: fields")


def nonempty(value, label):
    if type(value) is not str or not value.strip():
        raise ValueError(f"{label}: empty text")


def digest(value, label):
    if type(value) is not str or re.fullmatch(r"[0-9A-F]{64}", value) is None:
        raise ValueError(f"{label}: SHA256")


def git(root, *args):
    result = subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, check=False
    )
    if result.returncode:
        raise ValueError(
            f"archive git: {result.stderr.decode(errors='replace').strip()}"
        )
    return result.stdout


def admitted_sources(root):
    implementation = (
        git(root, "rev-parse", "--verify", ARCHIVE + "^{commit}").decode().strip()
    )
    registration = (
        git(root, "rev-parse", "--verify", REGISTRATION + "^{commit}").decode().strip()
    )
    git(root, "merge-base", "--is-ancestor", registration, implementation)
    hashes = []
    for name in SOURCE_FILES:
        raw = (root / name).read_bytes()
        if raw != git(root, "show", f"{implementation}:{name}"):
            raise ValueError(f"unarchived source bytes: {name}")
        hashes.append({"File": name, "Sha256": sha(raw)})
    return implementation, hashes


def source_manifest(root, arguments):
    from zeta_interp import mess3_replay, rendered_catch_carrier

    for module, name in (
        (sys.modules[__name__], "rendered_catch_replay.py"),
        (mess3_replay, "mess3_replay.py"),
        (rendered_catch_carrier, "rendered_catch_carrier.py"),
    ):
        expected = (root / "src/Interp.Python/zeta_interp" / name).resolve()
        if Path(module.__file__).resolve() != expected:
            raise ValueError("executed Python module is outside admitted root")
    if not arguments or any(type(argument) is not str for argument in arguments):
        raise ValueError("nonempty invocation arguments required")
    implementation, hashes = admitted_sources(root)
    commit = git(root, "rev-parse", "HEAD").decode().strip()
    for row in hashes:
        if sha(git(root, "show", f"{commit}:{row['File']}")) != row["Sha256"]:
            raise ValueError("current HEAD differs from admitted source bytes")
    return {
        "SourceCommit": commit,
        "ImplementationArchive": ARCHIVE,
        "ImplementationCommit": implementation,
        "SourceHashes": hashes,
        "LoadedAssemblies": [],
        "Runtime": platform.python_implementation() + " " + platform.python_version(),
        "OperatingSystem": platform.platform(),
        "Arguments": list(arguments),
    }


def validate_provenance(provenance, root):
    fields(
        provenance,
        "SourceCommit ImplementationArchive ImplementationCommit SourceHashes LoadedAssemblies Runtime OperatingSystem Arguments",
        "provenance",
    )
    implementation, hashes = admitted_sources(root)
    exact(provenance["ImplementationArchive"], ARCHIVE)
    exact(provenance["ImplementationCommit"], implementation)
    exact(provenance["SourceHashes"], hashes)
    commit = provenance["SourceCommit"]
    if type(commit) is not str or re.fullmatch("[0-9a-f]{40}", commit) is None:
        raise ValueError("source commit")
    git(root, "cat-file", "-e", commit + "^{commit}")
    for row in hashes:
        if sha(git(root, "show", f"{commit}:{row['File']}")) != row["Sha256"]:
            raise ValueError("recorded source commit differs from source manifest")
    for name in ("Runtime", "OperatingSystem"):
        nonempty(provenance[name], name)
    arguments = provenance["Arguments"]
    if (
        type(arguments) is not list
        or not arguments
        or any(type(arg) is not str for arg in arguments)
    ):
        raise ValueError("arguments")
    assemblies = provenance["LoadedAssemblies"]
    if type(assemblies) is not list:
        raise ValueError("assembly roster")
    if assemblies:
        if len(assemblies) != 2:
            raise ValueError("assembly roster")
        for row, name in zip(
            assemblies, ("Zeta.Core", "Zeta.Core.Abstractions"), strict=True
        ):
            fields(row, "Name Mvid Sha256", "assembly")
            exact(row["Name"], name)
            digest(row["Sha256"], name)
            if (
                type(row["Mvid"]) is not str
                or str(uuid.UUID(row["Mvid"])) != row["Mvid"]
            ):
                raise ValueError("assembly MVID")


def parse(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("duplicate JSON field")
            result[key] = value
        return result

    def constant(value):
        raise ValueError(f"nonfinite JSON: {value}")

    return json.loads(raw, object_pairs_hook=pairs, parse_constant=constant)


def load_model(root):
    raw = (root / MODEL_FILE).read_bytes()
    if sha(raw) != MODEL_SHA:
        raise ValueError("registered model input bytes")
    model = parse(raw)
    exact(model["Complete"], True)
    counts = model["Counts"]
    exact(count_hash(counts), COUNTS_SHA)
    return counts


def native_payload(name):
    parameters = 14 if name == "order-two" else 6 if name == "bigram" else 0
    slots = (
        2
        if name in ("order-two", "known-lag-two")
        else 0
        if name == "fair-independent"
        else 1
    )
    fair = 8 if name == "fair-independent" else 0
    return {
        "ParameterFloat64Values": parameters,
        "ParameterBytes": parameters * 8,
        "HistoryInt32Slots": slots,
        "HistoryBytes": slots * 4,
        "ObservationCountBytes": 4,
        "FairStreamStateBytes": fair,
        "FairInitialSeedBytes": fair,
        "FairDrawCountBytes": fair,
        "RomBytes": 2247,
        "FullFrameCellBytes": 2048,
        "ProjectedFrameCellBytes": 2048,
        "Scope": "partial numeric and frame-array ledger; excludes object headers, maps, registers, stack, keys, trace buffers and metadata; not retained heap or peak memory",
    }


def check_bits(value, count, label):
    if type(value) is not str or len(value) != count or set(value) - {"0", "1"}:
        raise ValueError(f"{label}: binary string")


def check_batch_shape(batch, count, start, name):
    fields(
        batch,
        "Complete Failure ActionDraws TotalHits MeanHitFraction Counters FrameSha256 ProjectionSha256 ShadowTraceSha256 Episodes",
        "batch",
    )
    exact(batch["Complete"], True)
    exact(batch["Failure"], None)
    exact(batch["Counters"], counters(count))
    exact(batch["ActionDraws"], 64 * count if name == "fair-independent" else 0)
    for key in ("FrameSha256", "ProjectionSha256", "ShadowTraceSha256"):
        digest(batch[key], key)
    if type(batch["Episodes"]) is not list or len(batch["Episodes"]) != count:
        raise ValueError("episode roster")
    total = 0
    for index, episode in enumerate(batch["Episodes"], start=start):
        fields(
            episode,
            "Index Complete Failure Actions Hits Observations WarmupHit Return Counters FrameSha256 ProjectionSha256 ShadowTraceSha256",
            "episode",
        )
        for key, value in (
            ("Index", index),
            ("Complete", True),
            ("Failure", None),
            ("Counters", counters(1)),
        ):
            exact(episode[key], value, key)
        for key, size in (("Actions", 64), ("Hits", 64), ("Observations", 66)):
            check_bits(episode[key], size, key)
        hits = episode["Hits"].count("1")
        exact(episode["Return"], hits)
        if type(episode["WarmupHit"]) is not int or episode["WarmupHit"] not in (0, 1):
            raise ValueError("warmup hit")
        for key in ("FrameSha256", "ProjectionSha256", "ShadowTraceSha256"):
            digest(episode[key], key)
        total += hits
    exact(batch["TotalHits"], total)
    exact(batch["MeanHitFraction"], total / (count * 64))


def paired(arms):
    order = arms[0]["Batch"]["Episodes"]
    result = []
    for control in arms[1:4]:
        differences = [
            left["Return"] - right["Return"]
            for left, right in zip(order, control["Batch"]["Episodes"], strict=True)
        ]
        result.append(
            {
                "Control": control["Name"],
                "Differences": differences,
                "TotalDifference": sum(differences),
            }
        )
    return result


def source_receipt(rows, seed, tag, geometry):
    symbols, roms = hashlib.sha256(), hashlib.sha256()
    for row in rows:
        symbols.update(row)
        roms.update(compile_rom(row, geometry))
    return {
        "SourceSeed": seed,
        "SourceDomain": tag,
        "SourceDraws": len(rows) * 66,
        "SourceSymbols": [binary(row) for row in rows],
        "SourceSymbolsSha256": symbols.hexdigest().upper(),
        "SourceRomSha256": roms.hexdigest().upper(),
        "Episodes": len(rows),
        "SymbolsPerEpisode": 66,
        "RomBytes": 2247,
    }


def timestamps(receipt):
    values = []
    for key in ("StartedAtUtc", "FinishedAtUtc"):
        nonempty(receipt[key], key)
        value = datetime.fromisoformat(receipt[key])
        if value.utcoffset() is None or value.utcoffset().total_seconds() != 0:
            raise ValueError("timestamp must have UTC offset")
        values.append(value)
    if values[1] < values[0]:
        raise ValueError("reversed timestamps")


def validate_envelope(native, cost, root):
    """Reject changed archival bytes and incomplete rosters before opcode replay.

    Raw native/cost hash binding is checked by the caller over its single byte
    reads. This function admits parsed metadata, not an independent execution.
    """
    fields(
        native,
        "Protocol Kind Complete Failure ProtocolSha256 InputSha256 CountsSha256Before CountsSha256After Config Provenance StartedAtUtc FinishedAtUtc Panels",
        "native",
    )
    fields(
        cost,
        "Protocol Kind Complete Failure ProtocolSha256 InputSha256 ModelInputSha256 CountsSha256Before CountsSha256After Config Provenance StartedAtUtc FinishedAtUtc QuietWindowDeclaration HostActivity Source Measurements",
        "cost",
    )
    protocol_hash = sha((root / PROTOCOL_FILE).read_bytes())
    for receipt, kind in ((native, "behavior"), (cost, "cost")):
        validate_provenance(receipt["Provenance"], root)
        if not receipt["Provenance"]["LoadedAssemblies"]:
            raise ValueError("missing native binary provenance")
        for key, value in (
            ("Protocol", PROTOCOL),
            ("Kind", kind),
            ("Complete", True),
            ("Failure", None),
            ("ProtocolSha256", protocol_hash),
            ("CountsSha256Before", COUNTS_SHA),
            ("CountsSha256After", COUNTS_SHA),
            ("Config", CONFIG),
        ):
            exact(receipt[key], value, key)
        timestamps(receipt)
    if datetime.fromisoformat(cost["StartedAtUtc"]) < datetime.fromisoformat(
        native["FinishedAtUtc"]
    ):
        raise ValueError("cost starts before behavioral completion")
    for key in (
        "SourceHashes",
        "ImplementationArchive",
        "ImplementationCommit",
        "LoadedAssemblies",
        "Runtime",
        "OperatingSystem",
    ):
        exact(cost["Provenance"][key], native["Provenance"][key], f"cost.{key}")
    exact(native["InputSha256"], MODEL_SHA)
    exact(cost["ModelInputSha256"], MODEL_SHA)
    digest(cost["InputSha256"], "cost input")
    for key in ("QuietWindowDeclaration", "HostActivity"):
        nonempty(cost[key], key)
    if type(native["Panels"]) is not list or len(native["Panels"]) != 4:
        raise ValueError("panel roster")
    for panel, config in zip(native["Panels"], CONFIG["Panels"], strict=True):
        fields(panel, "Config Source Arms PairedReturns", "panel")
        exact(panel["Config"], config)
        rows = source_rows(
            config["SourceSeed"],
            config["SourceDomain"],
            1024,
            config["CopyProbability"],
        )
        exact(
            panel["Source"],
            source_receipt(
                rows, config["SourceSeed"], config["SourceDomain"], config["Geometry"]
            ),
        )
        if type(panel["Arms"]) is not list or len(panel["Arms"]) != 5:
            raise ValueError("arm roster")
        for arm, name in zip(panel["Arms"], ARMS, strict=True):
            fields(arm, "Name Payload Batch", "arm")
            exact(arm["Name"], name)
            exact(arm["Payload"], native_payload(name))
            check_batch_shape(arm["Batch"], 1024, 0, name)
        exact(panel["PairedReturns"], paired(panel["Arms"]))
    rows = source_rows(7001, 701, 72, 0.75)
    source = source_receipt(rows, 7001, 701, "dot")
    exact(cost["Source"], source)
    if type(cost["Measurements"]) is not list or len(cost["Measurements"]) != 25:
        raise ValueError("cost row roster")
    for index, row in enumerate(cost["Measurements"]):
        repetition, position = divmod(index, 5)
        name = ARMS[(position + repetition) % 5]
        fields(
            row,
            "Repetition Name Payload Warmup Timed Resource WarmupSourceDraws TimedSourceDraws WarmupActionDraws TimedActionDraws SourceSymbolsSha256 SourceRomSha256",
            "cost row",
        )
        for key, value in (
            ("Repetition", repetition),
            ("Name", name),
            ("Payload", native_payload(name)),
            ("WarmupSourceDraws", 0),
            ("TimedSourceDraws", 0),
            ("WarmupActionDraws", 512 if name == "fair-independent" else 0),
            ("TimedActionDraws", 4096 if name == "fair-independent" else 0),
            ("SourceSymbolsSha256", source["SourceSymbolsSha256"]),
            ("SourceRomSha256", source["SourceRomSha256"]),
        ):
            exact(row[key], value, key)
        check_batch_shape(row["Warmup"], 8, 0, name)
        check_batch_shape(row["Timed"], 64, 8, name)
        resource = row["Resource"]
        fields(
            resource, "ElapsedMilliseconds CpuMilliseconds AllocatedBytes", "resource"
        )
        for key in ("ElapsedMilliseconds", "CpuMilliseconds"):
            value = resource[key]
            if (
                type(value) not in (int, float)
                or not math.isfinite(value)
                or value < 0
                or (key == "ElapsedMilliseconds" and value == 0)
            ):
                raise ValueError("nonfinite/nonpositive resource metadata")
        if (
            type(resource["AllocatedBytes"]) is not int
            or resource["AllocatedBytes"] <= 0
        ):
            raise ValueError("nonpositive allocation metadata")
    return load_model(root)


def attempt_context():
    return {
        "InputSha256": None,
        "CostInputSha256": None,
        "ProtocolSha256": None,
        "CountsSha256": None,
        "Provenance": None,
        "Stage": "input-read",
        "Panel": None,
        "Arm": None,
        "EpisodeOffset": 0,
        "CompletedBehaviorArmPanels": 0,
        "CompletedCostRows": 0,
    }


def replay(native_raw, cost_raw, root, arguments=(), progress=print, attempt=None):
    state = attempt if attempt is not None else attempt_context()
    state.update(
        InputSha256=sha(native_raw),
        CostInputSha256=sha(cost_raw),
        Stage="source-admission",
    )
    provenance = source_manifest(
        root, arguments
    )  # Admission precedes expensive execution.
    state["Provenance"] = provenance
    state["ProtocolSha256"] = next(
        row["Sha256"]
        for row in provenance["SourceHashes"]
        if row["File"] == PROTOCOL_FILE
    )
    state["Stage"] = "JSON-and-byte-binding"
    native, cost = parse(native_raw), parse(cost_raw)
    exact(cost["InputSha256"], sha(native_raw), "cost/native bytes")
    state["Stage"] = "envelope-admission"
    counts = validate_envelope(native, cost, root)
    state["CountsSha256"] = COUNTS_SHA
    for panel in native["Panels"]:
        config = panel["Config"]
        rows = source_rows(
            config["SourceSeed"],
            config["SourceDomain"],
            1024,
            config["CopyProbability"],
        )
        for arm in panel["Arms"]:
            name = arm["Name"]
            state.update(
                Stage="behavior-replay", Panel=config["Name"], Arm=name, EpisodeOffset=0
            )
            rng = (
                Stream(domain(config["ActionSeed"], config["ActionDomain"]))
                if name == "fair-independent"
                else None
            )
            expected = run_batch(
                rows, config["Geometry"], config["Palette"], name, counts, rng
            )
            exact(arm["Batch"], expected, config["Name"] + "/" + name)
            state["CompletedBehaviorArmPanels"] += 1
            progress(f"replayed {config['Name']}/{name}: 1024 episodes", flush=True)
    rows = source_rows(7001, 701, 72, 0.75)
    for row in cost["Measurements"]:
        name = row["Name"]
        state.update(
            Stage="cost-warmup-replay",
            Panel="cost-dot-three-quarter",
            Arm=name,
            EpisodeOffset=0,
        )
        rng = Stream(domain(8003, 801)) if name == "fair-independent" else None
        warmup = run_batch(rows[:8], "dot", "fixed", name, counts, rng)
        exact(row["Warmup"], warmup, "cost warmup")
        state.update(Stage="cost-timed-replay", EpisodeOffset=8)
        timed = run_batch(rows[8:], "dot", "fixed", name, counts, rng, start_index=8)
        exact(row["Timed"], timed, "cost timed")
        state["CompletedCostRows"] += 1
        progress(f"replayed cost {row['Repetition']}/{name}", flush=True)
    exact(count_hash(counts), COUNTS_SHA)
    return {
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
        "InputSha256": sha(native_raw),
        "CostInputSha256": sha(cost_raw),
        "ProtocolSha256": native["ProtocolSha256"],
        "CountsSha256": COUNTS_SHA,
        "Provenance": provenance,
    }


def write_new(path, receipt):
    path = Path(path)
    partial = path.with_name(path.name + ".partial")
    if path.exists():
        raise ValueError("refusing to overwrite existing receipt")
    with partial.open("xb") as output:
        output.write((json.dumps(receipt, indent=2, allow_nan=False) + "\n").encode())
        output.flush()
        os.fsync(output.fileno())
    os.link(
        partial, path
    )  # Atomic no-clobber publication, including competing writers.
    partial.unlink()


def failure_receipt(error, state):
    match = re.search(r"\.Episodes\[(\d+)\]", str(error))
    episode = getattr(error, "episode", None)
    if episode is None and match:
        episode = int(match.group(1)) + state["EpisodeOffset"]
    return {
        "Protocol": PROTOCOL,
        "Kind": "independent-replay",
        "Complete": False,
        "Passed": False,
        **{
            key: state[key]
            for key in (
                "InputSha256",
                "CostInputSha256",
                "ProtocolSha256",
                "CountsSha256",
                "Provenance",
                "CompletedBehaviorArmPanels",
                "CompletedCostRows",
            )
        },
        "Failure": {
            "Stage": state["Stage"],
            "Code": type(error).__name__,
            "Detail": str(error),
            "Panel": state["Panel"],
            "Arm": state["Arm"],
            "Episode": episode,
        },
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("native", type=Path)
    parser.add_argument("cost", type=Path)
    parser.add_argument("output", type=Path)
    arguments = list(sys.argv[1:] if argv is None else argv)
    args = parser.parse_args(arguments)
    if (
        args.output.exists()
        or args.output.with_name(args.output.name + ".partial").exists()
    ):
        parser.error("refusing existing output or partial attempt")
    root = Path(__file__).resolve().parents[3]
    state = attempt_context()
    try:
        native_raw = args.native.read_bytes()
        state["InputSha256"] = sha(native_raw)
        cost_raw = args.cost.read_bytes()
        state["CostInputSha256"] = sha(cost_raw)
        result = replay(native_raw, cost_raw, root, arguments, attempt=state)
    except (ValueError, KeyError, TypeError, OSError, OverflowError) as error:
        result = failure_receipt(error, state)
        write_new(args.output, result)
        raise SystemExit(1) from error
    write_new(args.output, result)
    print(f"full replay passed: {args.output}")


if __name__ == "__main__":
    main()
