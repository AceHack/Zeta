"""Regenerate the registered rendered corpus and independently score all arms."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
import uuid
from pathlib import Path

import numpy as np

from zeta_interp.mess3_replay import Network, digest, initial_parameters
from zeta_interp.rendered_signal_carrier import corpus

SEEDS = (41, 53, 67)
PREDICTION_PANELS = tuple(
    (renderer, length, tag)
    for renderer, first in (("train-dot", 103), ("heldout-bar", 105), ("nuisance", 107))
    for length, tag in ((16, first), (64, first + 1))
)
DETECTION_PANELS = (
    ("train-dot", 201, 0.75, 0),
    ("nuisance", 202, 0.75, 0),
    ("train-dot", 203, 0.5, 128),
    ("train-dot", 204, 0.25, 128),
    ("train-dot", 205, 0.5, 16),
)
CONFIG = {
    "Training": {
        "Steps": 1024,
        "Batch": 16,
        "SequenceSteps": 32,
        "LearningRate": 0.003,
    },
    "CorpusSequences": 4096,
    "CorpusLength": 33,
    "CorpusSeed": 1009,
    "CorpusDomain": 101,
    "Passes": 4,
    "Alphabet": 2,
    "Hidden": 8,
    "ModelSeeds": [41, 53, 67],
    "InitializationDomain": 1,
    "AdamBeta1": 0.9,
    "AdamBeta2": 0.999,
    "AdamEpsilon": 1e-8,
    "GradientNormCap": 1.0,
    "CountPseudocount": 1,
    "PredictionExamples": 2048,
    "PredictionSeed": 1009,
    "PredictionDomains": [103, 104, 105, 106, 107, 108],
    "PredictionLengths": [16, 64, 16, 64, 16, 64],
    "DetectionExamples": 2048,
    "DetectionLength": 256,
    "DetectionSeed": 2003,
    "DetectionDomains": [201, 202, 203, 204, 205],
    "ChangeStart": 128,
    "AlternativePositions": [32, 64, 96, 128],
    "AlternativeProbabilities": [0.5, 0.25],
    "DetectionThreshold": 20.0,
    "Renderers": ["train-dot", "heldout-bar", "nuisance"],
    "CalibrationBins": 10,
    "ScoreTolerance": 1e-10,
    "ParameterTolerance": 1e-8,
}
SOURCE_FILES = (
    "src/Core/Chip8.fs",
    "src/Core/FrameMotion.fs",
    "src/Core/FrameSignals.fs",
    "src/Core/GameEnvironment.fs",
    "src/Core/SplitMix64.fs",
    "src/Research.FSharp/ResearchRandom.fs",
    "src/Research.FSharp/SmallRnn.fs",
    "src/Research.FSharp/SmallRnnTraining.fs",
    "src/Research.FSharp/RenderedSignalCarrier.fs",
    "src/Research.FSharp/RenderedSignalPrediction.fs",
    "src/Research.FSharp/RenderedSignalDetection.fs",
    "src/Research.FSharp/RenderedSignalExperiment.fs",
    "src/Research.FSharp/RenderedSignalRuntime.fsx",
    "src/Research.FSharp/run-rendered-signal-experiment.fsx",
    "src/Research.FSharp/measure-rendered-signal-inference.fsx",
    "docs/research/2026-09-06-rendered-signal-predictor-protocol.md",
)
COMMON = ("unigram", "bigram", "order-two", "known", "fair", "last")
ARMS = tuple((name, -1) for name in COMMON) + tuple(
    (name, seed) for name in ("untrained-rnn", "trained-rnn") for seed in SEEDS
)
DETECTORS = (("known", -1), ("order-two", -1), ("fair", -1)) + tuple(
    ("trained-rnn", seed) for seed in SEEDS
)


def close(actual, expected, label="receipt", tolerance=1e-10):
    """Complete semantic comparison: missing arrays and empty joins cannot pass."""
    if isinstance(expected, dict):
        if not isinstance(actual, dict) or actual.keys() != expected.keys():
            raise ValueError(f"{label}: changed fields")
        return max(
            (
                close(actual[k], v, f"{label}.{k}", tolerance)
                for k, v in expected.items()
            ),
            default=0.0,
        )
    if isinstance(expected, (list, tuple, np.ndarray)):
        if not isinstance(actual, (list, tuple, np.ndarray)) or len(actual) != len(
            expected
        ):
            raise ValueError(f"{label}: changed row count")
        return max(
            (
                close(a, e, label, tolerance)
                for a, e in zip(actual, expected, strict=True)
            ),
            default=0.0,
        )
    if isinstance(expected, (float, np.floating)):
        if (
            isinstance(actual, bool)
            or not isinstance(actual, (int, float))
            or not math.isfinite(actual)
        ):
            raise ValueError(f"{label}: nonfinite or nonnumeric value")
        error = abs(actual - expected)
        if error > tolerance:
            raise ValueError(f"{label}: error {error:.12g} exceeds {tolerance}")
        return float(error)
    if actual != expected or (
        isinstance(expected, (int, np.integer)) and isinstance(actual, bool)
    ):
        raise ValueError(f"{label}: changed discrete value")
    return 0.0


def fit_counts(rows):
    rows = np.asarray(rows)
    if (
        rows.ndim != 2
        or rows.shape[0] == 0
        or not 3 <= rows.shape[1] <= 256
        or not np.isin(rows, [0, 1]).all()
    ):
        raise ValueError("invalid count corpus")
    unigram = np.bincount(rows[:, 1:].ravel(), minlength=2).astype(float) + 1
    bigram = (
        np.bincount((2 * rows[:, :-1] + rows[:, 1:]).ravel(), minlength=4)
        .reshape(2, 2)
        .astype(float)
        + 1
    )
    order = (
        np.bincount(
            (4 * rows[:, :-2] + 2 * rows[:, 1:-1] + rows[:, 2:]).ravel(), minlength=8
        )
        .reshape(2, 2, 2)
        .astype(float)
        + 1
    )
    return {
        "Unigram": unigram / unigram.sum(),
        "Bigram": bigram / bigram.sum(axis=-1, keepdims=True),
        "OrderTwo": order / order.sum(axis=-1, keepdims=True),
    }


def count_prediction(counts, order, contexts):
    if not contexts.shape[1] or order == 0:
        return np.full(len(contexts), counts["Unigram"][1])
    if contexts.shape[1] == 1 or order == 1:
        return counts["Bigram"][contexts[:, -1], 1]
    return counts["OrderTwo"][contexts[:, -2], contexts[:, -1], 1]


def probabilities(name, contexts, counts, model=None):
    if name == "fair":
        p = np.full(len(contexts), 0.5)
    elif name == "last":
        p = (
            np.where(contexts[:, -1] == 1, 0.95, 0.05)
            if contexts.shape[1]
            else np.full(len(contexts), 0.5)
        )
    elif name == "known":
        p = (
            np.where(contexts[:, -2] == 1, 0.75, 0.25)
            if contexts.shape[1] >= 2
            else np.full(len(contexts), 0.5)
        )
    elif name in ("unigram", "bigram", "order-two"):
        p = count_prediction(
            counts, ("unigram", "bigram", "order-two").index(name), contexts
        )
    elif name in ("trained-rnn", "untrained-rnn") and model is not None:
        p = model.after(contexts)[1][:, 1]
    else:
        raise ValueError("unknown prediction arm")
    if not np.isfinite(p).all() or np.any((p <= 0) | (p >= 1)):
        raise ValueError("nonfinite or non-interior probabilities")
    return p


def score(name, seed, rows, counts, network=None):
    contexts, target = rows[:, :-1], rows[:, -1]
    p = probabilities(name, contexts, counts, network)
    q = probabilities("known", contexts, counts)
    reference = probabilities("order-two", contexts, counts)
    losses = -np.log2(np.where(target == 1, p, 1 - p))
    reference_losses = -np.log2(np.where(target == 1, reference, 1 - reference))
    expected = -q * np.log2(p) - (1 - q) * np.log2(1 - p)
    entropy = -q * np.log2(q) - (1 - q) * np.log2(1 - q)
    index = np.minimum(9, (10 * p).astype(int))
    bins = []
    for i in range(10):
        mask = index == i
        bins.append(
            {
                "Index": i,
                "Count": int(mask.sum()),
                "SumP1": float(p[mask].sum()),
                "SumY": float(target[mask].sum()),
            }
        )
    return {
        "Name": name,
        "Seed": seed,
        "P1": p.tolist(),
        "SampledLossBits": float(losses.mean()),
        "ExpectedCrossEntropyBits": float(expected.mean()),
        "ExcessKlBits": float((expected - entropy).mean()),
        "Brier": float(np.square(p - target).mean()),
        "Accuracy": float(((p > 0.5) == target).mean()),
        "Bins": bins,
        "LossDifferenceOrderTwo": (losses - reference_losses).tolist(),
    }


def detector(name, seed, rows, counts, network=None):
    alternatives = [
        (position, p) for position in (32, 64, 96, 128) for p in (0.5, 0.25)
    ]
    numerator = np.zeros((len(rows), len(alternatives)))
    denominator = np.zeros(len(rows))
    first = np.full(len(rows), -1)
    state = np.zeros((len(rows), 8))
    p = np.full(len(rows), 0.5)
    for t, target in enumerate(rows.T):
        if network is None:
            p = probabilities(name, rows[:, :t], counts)
        denominator += np.log(np.where(target == 1, p, 1 - p))
        for a, (position, probability) in enumerate(alternatives):
            copy = probability if t >= position else 0.75
            emission = (
                np.full(len(rows), 0.5)
                if t < 2
                else np.where(target == rows[:, t - 2], copy, 1 - copy)
            )
            numerator[:, a] += np.log(emission)
        maximum = numerator.max(axis=1)
        ratio = (
            maximum
            + np.log(np.exp(numerator - maximum[:, None]).mean(axis=1))
            - denominator
        )
        first[(first < 0) & (ratio >= math.log(20))] = t
        if network is not None:
            state, predicted = network.step(state, target)
            if not np.isfinite(predicted).all() or np.any(
                (predicted <= 0) | (predicted >= 1)
            ):
                raise ValueError("invalid recurrent denominator")
            p = predicted[:, 1]
    alarm = int((first >= 0).sum())
    pre = int(((first >= 0) & (first < 128)).sum())
    delays = (first[first >= 128] - 128).tolist()
    n, z = len(rows), 1.959963984540054
    fraction = alarm / n
    center = (fraction + z * z / (2 * n)) / (1 + z * z / n)
    radius = (
        z
        * math.sqrt((fraction * (1 - fraction) + z * z / (4 * n)) / n)
        / (1 + z * z / n)
    )
    return {
        "Name": name,
        "Seed": seed,
        "FirstCrossings": first.tolist(),
        "FinalLogRatios": ratio.tolist(),
        "AlarmCount": alarm,
        "PreChangeAlarms": pre,
        "Eligible": n - pre,
        "Detected": len(delays),
        "Misses": n - pre - len(delays),
        "Delays": delays,
        "WilsonLow": center - radius,
        "WilsonHigh": center + radius,
    }


def keyed(rows, expected, key):
    if not isinstance(rows, list) or len(rows) != len(expected):
        raise ValueError("changed registered roster size")
    mapping = {key(row): row for row in rows}
    if set(mapping) != set(expected):
        raise ValueError("missing, duplicated or unknown registered entry")
    return mapping


def validate_models(receipt):
    rows = keyed(receipt["Models"], SEEDS, lambda row: row["Seed"])
    networks = {}
    for seed, model in rows.items():
        if (
            model["Hidden"] != 8
            or model["Status"] != "complete"
            or model["Failure"] != ""
            or model["TrainedTokens"] != 524288
        ):
            raise ValueError("changed model shape, status or training budget")
        for field, digest_field in (
            ("InitialParameters", "InitialSha256"),
            ("Parameters", "TrainedSha256"),
        ):
            values = np.asarray(model[field])
            if (
                values.shape != (106,)
                or not np.isfinite(values).all()
                or digest(values) != model[digest_field]
            ):
                raise ValueError("model parameter fingerprint mismatch")
        if digest(initial_parameters(8, seed, 2)) != model["InitialSha256"]:
            raise ValueError("initialization fingerprint differs from registered seed")
        close(
            model["InitialParameters"],
            initial_parameters(8, seed, 2),
            "initialization",
            1e-14,
        )
        if [row["Step"] for row in model["TrainingTrace"]] != [1, 512, 1024]:
            raise ValueError("changed training trace steps")
        if any(
            not math.isfinite(row["LossNats"]) or row["LossNats"] < 0
            for row in model["TrainingTrace"]
        ):
            raise ValueError("invalid training trace")
        networks[("trained-rnn", seed)] = Network(8, model["Parameters"], 2)
        networks[("untrained-rnn", seed)] = Network(8, model["InitialParameters"], 2)
    return networks


def verify_sources(receipt, root):
    entries = receipt["SourceHashes"]
    if not isinstance(entries, list) or not entries:
        raise ValueError("missing source provenance")
    names = [row["File"] for row in entries]
    if len(set(names)) != len(names) or set(names) != set(SOURCE_FILES):
        raise ValueError("missing or duplicate source provenance")
    for row in entries:
        path = (root / row["File"]).resolve()
        if not path.is_relative_to(root.resolve()) or not path.is_file():
            raise ValueError("source path outside repository or unavailable")
        if hashlib.sha256(path.read_bytes()).hexdigest().upper() != row["Sha256"]:
            raise ValueError(f"source fingerprint mismatch: {row['File']}")
        saved = subprocess.run(
            ["git", "show", f"{receipt['SourceCommit']}:{row['File']}"],
            cwd=root,
            capture_output=True,
            check=False,
        )
        if (
            saved.returncode
            or hashlib.sha256(saved.stdout).hexdigest().upper() != row["Sha256"]
        ):
            raise ValueError(
                f"source commit differs or unavailable: {row['File']}; fetch the experiment archive tag"
            )


def replay(receipt, root, training=False):
    if (
        receipt["Protocol"] != "rendered-signal-predictor-v1"
        or receipt["Complete"] is not True
    ):
        raise ValueError("wrong or incomplete experiment")
    close(receipt["Config"], CONFIG, "frozen configuration", 0.0)
    if (
        receipt["Failure"] != ""
        or receipt["ActionReturn"] != "not-measured-passive-carrier"
    ):
        raise ValueError("failed run or changed action-return boundary")
    commit = receipt["SourceCommit"]
    if (
        not isinstance(commit, str)
        or len(commit) != 40
        or any(c not in "0123456789abcdef" for c in commit)
    ):
        raise ValueError("missing source commit")
    verify_sources(receipt, root)
    validate_assemblies(receipt["LoadedAssemblies"])
    networks = validate_models(receipt)
    # Native runner schema is validated against the exact frozen configuration below.
    training_rows, fingerprints, diagnostics = corpus("train-dot", 4096, 33, 1009, 101)
    close(receipt["Corpus"]["Fingerprints"], fingerprints, "training fingerprints")
    close(receipt["Corpus"]["Diagnostics"], diagnostics, "training diagnostics")
    for key in ("Generation", "Extraction"):
        validate_resource(receipt["Corpus"][key])
    fitted_resources = keyed(receipt["Fitting"], SEEDS, lambda row: row["Seed"])
    for fitting in fitted_resources.values():
        validate_resource(fitting["Resource"])
    counts = fit_counts(training_rows)
    close(receipt["Counts"], counts, "fitted counts")
    panels = keyed(
        receipt["PredictionPanels"],
        PREDICTION_PANELS,
        lambda row: (row["Renderer"], row["ContextLength"], row["Domain"]),
    )
    maximum, comparisons = 0.0, 0
    for (renderer, length, tag), panel in panels.items():
        if panel["Examples"] != 2048 or panel["Name"] != f"{renderer}-{length}":
            raise ValueError("changed prediction panel size")
        rows, fingerprints, diagnostics = corpus(renderer, 2048, length + 1, 1009, tag)
        close(panel["Fingerprints"], fingerprints, "panel fingerprints")
        close(panel["Diagnostics"], diagnostics, "panel diagnostics")
        close(panel["Targets"], rows[:, -1], "targets")
        for key in ("Generation", "Extraction", "Prediction"):
            validate_resource(panel[key])
        arms = keyed(panel["Arms"], ARMS, lambda row: (row["Name"], row["Seed"]))
        for key, arm in arms.items():
            maximum = max(
                maximum,
                close(arm, score(*key, rows, counts, networks.get(key)), "prediction"),
            )
            comparisons += 1
        print(f"replayed prediction {renderer} L{length}", flush=True)
    panels = keyed(
        receipt["DetectionPanels"],
        [spec[1] for spec in DETECTION_PANELS],
        lambda row: row["Domain"],
    )
    for renderer, tag, probability, duration in DETECTION_PANELS:
        panel = panels[tag]
        if panel["Renderer"] != renderer or panel["Examples"] != 2048:
            raise ValueError("changed detector panel")
        names = {
            201: "unchanged",
            202: "nuisance-null",
            203: "permanent-half",
            204: "permanent-quarter",
            205: "transient-half",
        }
        close(
            {
                key: panel[key]
                for key in (
                    "Name",
                    "Length",
                    "ChangeProbability",
                    "ChangeStart",
                    "ChangeDuration",
                )
            },
            {
                "Name": names[tag],
                "Length": 256,
                "ChangeProbability": probability,
                "ChangeStart": 128,
                "ChangeDuration": duration,
            },
            "detector definition",
        )
        rows, fingerprints, diagnostics = corpus(
            renderer, 2048, 256, 2003, tag, probability, 128, duration
        )
        close(panel["Fingerprints"], fingerprints, "detector fingerprints")
        close(panel["Diagnostics"], diagnostics, "detector diagnostics")
        for key in ("Generation", "Extraction", "Detection"):
            validate_resource(panel[key])
        arms = keyed(panel["Arms"], DETECTORS, lambda row: (row["Name"], row["Seed"]))
        for key, arm in arms.items():
            maximum = max(
                maximum,
                close(arm, detector(*key, rows, counts, networks.get(key)), "detector"),
            )
            comparisons += 1
        print(f"replayed detection domain {tag}", flush=True)
    result = {
        "Complete": True,
        "Passed": True,
        "PredictionArmPanels": 72,
        "DetectorArmPanels": 30,
        "Comparisons": comparisons,
        "MaximumNumericError": maximum,
    }
    if training:
        from zeta_interp.rendered_signal_training import retrain

        result["TrainingReplay"] = retrain(
            training_rows, next(m for m in receipt["Models"] if m["Seed"] == 41)
        )
        result["Passed"] = result["TrainingReplay"]["status"] == "passed"
    return result


def validate_resource(resource):
    if set(resource) != {"ElapsedMilliseconds", "CpuMilliseconds", "AllocatedBytes"}:
        raise ValueError("changed resource schema")
    if any(
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value < 0
        for value in resource.values()
    ):
        raise ValueError("invalid resource measurement")
    if not isinstance(resource["AllocatedBytes"], int):
        raise TypeError("allocation is an integer byte count")


def validate_assemblies(rows):
    entries = keyed(
        rows, ("Zeta.Core", "Zeta.Core.Abstractions"), lambda row: row["Name"]
    )
    for row in entries.values():
        if (
            set(row) != {"Name", "Mvid", "Sha256"}
            or str(uuid.UUID(row["Mvid"])) != row["Mvid"]
        ):
            raise ValueError("invalid loaded assembly identity")
        digest_value = row["Sha256"]
        if len(digest_value) != 64 or any(
            char not in "0123456789ABCDEF" for char in digest_value
        ):
            raise ValueError("invalid loaded assembly digest")


def validate_pipeline_payload(payload):
    close(
        payload,
        {
            "CurrentPreviousFrameCellBytes": 4096,
            "EmulatorMemoryBytes": 4096,
            "EmulatorDisplayLogicalBooleans": 2048,
            "RomBytes": 517,
            "Scope": "partial array ledger; excludes registers, stack, keys and metadata; managed heap and peak RSS not measured",
        },
        "partial pipeline ledger",
    )


def replay_cost(cost, receipt, root, input_hash):
    if (
        cost["Protocol"] != "rendered-signal-inference-v1"
        or cost["Complete"] is not True
        or cost["InputSha256"] != input_hash
    ):
        raise ValueError("wrong, incomplete or unbound cost receipt")
    verify_sources(cost, root)
    validate_pipeline_payload(cost["PipelinePayload"])
    validate_assemblies(cost["LoadedAssemblies"])
    close(
        cost["LoadedAssemblies"], receipt["LoadedAssemblies"], "loaded binary linkage"
    )
    close(cost["SourceHashes"], receipt["SourceHashes"], "cost source linkage")
    close(
        cost["Config"],
        {
            "Seed": 3001,
            "Domain": 301,
            "Contexts": 256,
            "ContextLength": 64,
            "Renderer": "train-dot",
            "Repetitions": 5,
            "TokenCalls": 4096,
            "TokenWarmups": 256,
            "EndToEndCalls": 256,
            "EndToEndWarmups": 16,
            "Rotation": "left-by-repetition",
        },
        "cost configuration",
        0.0,
    )
    rows, fingerprints, diagnostics = corpus("train-dot", 256, 64, 3001, 301)
    close(cost["Corpus"]["Fingerprints"], fingerprints, "benchmark corpus")
    close(cost["Corpus"]["Diagnostics"], diagnostics, "benchmark diagnostics")
    for key in ("Generation", "Extraction"):
        validate_resource(cost["Corpus"][key])
    networks = validate_models(receipt)
    counts = {key: np.asarray(value) for key, value in receipt["Counts"].items()}
    payloads = {
        "unigram": (16, 16),
        "bigram": (48, 20),
        "order-two": (112, 24),
        "known": (0, 24),
        "fair": (0, 16),
        "last": (0, 20),
        "trained-rnn": (848, 80),
        "untrained-rnn": (848, 80),
    }
    expected_order = [
        (path, repetition, *ARMS[(index + repetition) % 12])
        for path in ("tokens", "end-to-end")
        for repetition in range(5)
        for index in range(12)
    ]
    close(
        [
            (row["Path"], row["Repetition"], row["Name"], row["Seed"])
            for row in cost["Rows"]
        ],
        expected_order,
        "benchmark order",
    )
    maximum = 0.0
    cached = {
        key: probabilities(key[0], rows, counts, networks.get(key)) for key in ARMS
    }
    for row in cost["Rows"]:
        calls, warmups = (4096, 256) if row["Path"] == "tokens" else (256, 16)
        name, seed = row["Name"], row["Seed"]
        close(
            [
                row["Calls"],
                row["WarmupCalls"],
                row["ParameterBytes"],
                row["PredictorStateBytes"],
            ],
            [calls, warmups, *payloads[name]],
            "cost workload and payload",
        )
        # Mirror the declared consuming reduction, not Python's compensated sum.
        expected = 0.0
        for index in range(calls):
            expected += float(cached[(name, seed)][index % 256])
        maximum = max(maximum, close(row["Checksum"], expected, "cost checksum"))
        validate_resource(row["Resource"])
    return {
        "Complete": True,
        "Rows": 120,
        "MaximumChecksumError": maximum,
        "TimingClaim": "measurement metadata and workload checked; elapsed time is not independently reproducible",
    }


def replay_provenance(root):
    result = {}
    result["ReplaySourceCommit"] = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=root,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    result["ReplaySources"] = []
    for path in (
        Path(__file__).resolve(),
        Path(__file__).with_name("rendered_signal_carrier.py"),
        Path(__file__).with_name("rendered_signal_training.py"),
        Path(__file__).with_name("mess3_replay.py"),
    ):
        name = str(path.relative_to(root))
        source_bytes = path.read_bytes()
        saved = subprocess.run(
            ["git", "show", f"{result['ReplaySourceCommit']}:{name}"],
            cwd=root,
            capture_output=True,
            check=False,
        )
        if saved.returncode or saved.stdout != source_bytes:
            raise ValueError(
                f"replay source is not preserved at its recorded commit: {name}"
            )
        result["ReplaySources"].append(
            {
                "File": name,
                "Sha256": hashlib.sha256(source_bytes).hexdigest().upper(),
            }
        )
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--training", action="store_true")
    parser.add_argument("--cost", type=Path)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit("refusing to overwrite replay result")
    root = Path(__file__).resolve().parents[3]
    try:
        provenance = replay_provenance(root)
        input_bytes = args.input.read_bytes()
        cost_bytes = args.cost.read_bytes() if args.cost is not None else None
        receipt = json.loads(input_bytes)
        result = replay(receipt, root, args.training)
        result["InputSha256"] = hashlib.sha256(input_bytes).hexdigest().upper()
        if cost_bytes is not None:
            result["CostReplay"] = replay_cost(
                json.loads(cost_bytes), receipt, root, result["InputSha256"]
            )
            result["CostInputSha256"] = hashlib.sha256(cost_bytes).hexdigest().upper()
        result.update(provenance)
        with args.output.open("x") as output:
            json.dump(result, output, indent=2, allow_nan=False)
            output.write("\n")
        if result.get("Passed") is not True:
            raise SystemExit("replay completed with a retained numerical mismatch")
    except (KeyError, TypeError, ValueError, OSError) as error:
        raise SystemExit(f"replay refused: {error}") from error


if __name__ == "__main__":
    main()
