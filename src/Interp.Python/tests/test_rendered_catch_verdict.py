"""Hand-built receipts and mutations; no registered source/episode execution."""

import copy
import json
import subprocess
import sys
from unittest.mock import patch

import pytest

from zeta_interp import rendered_catch_verdict as target

COUNTS = {
    "Unigram": [0.5, 0.5],
    "Bigram": [[0.75, 0.25], [0.25, 0.75]],
    "OrderTwo": [[[0.75, 0.25], [0.75, 0.25]], [[0.25, 0.75], [0.25, 0.75]]],
}
HASH = "A" * 64


def fake_payload(name):
    parameters = 14 if name == "order-two" else 6 if name == "bigram" else 0
    slots = (
        2
        if name in ("order-two", "known-lag-two")
        else 1
        if name in ("bigram", "last-beacon")
        else 0
    )
    return {
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
        "Scope": "hand fixture of the partial numeric payload ledger",
    }


def fake_source(episodes, seed, domain, symbols):
    rows = [symbols] * episodes
    return {
        "SourceSeed": seed,
        "SourceDomain": domain,
        "SourceDraws": 66 * episodes,
        "SourceSymbols": rows,
        "SourceSymbolsSha256": target.digest(
            bytes(int(x) for row in rows for x in row)
        ),
        "SourceRomSha256": HASH,
        "Episodes": episodes,
        "SymbolsPerEpisode": 66,
        "RomBytes": 2247,
    }


def fake_batch(name, symbols, start=0):
    episodes = []
    for index, row in enumerate(symbols, start):
        actions = (
            row[:-2]
            if name in ("order-two", "known-lag-two")
            else row[1:-1]
            if name in ("bigram", "last-beacon")
            else ("1" if row[1] == "1" else "0") * 64
        )
        hits = "".join(str(int(a == b)) for a, b in zip(actions, row[2:], strict=True))
        episodes.append(
            {
                "Index": index,
                "Complete": True,
                "Failure": None,
                "Actions": actions,
                "Hits": hits,
                "Observations": row,
                "WarmupHit": int(row[1] == "0"),
                "Return": hits.count("1"),
                "Counters": target.counters(1),
                "FrameSha256": HASH,
                "ProjectionSha256": HASH,
                "ShadowTraceSha256": HASH,
            }
        )
    total = sum(row["Return"] for row in episodes)
    return {
        "Complete": True,
        "Failure": None,
        "ActionDraws": len(symbols) * 64 if name == "fair-independent" else 0,
        "TotalHits": total,
        "MeanHitFraction": total / (64 * len(symbols)),
        "Counters": target.counters(len(symbols)),
        "FrameSha256": HASH,
        "ProjectionSha256": HASH,
        "ShadowTraceSha256": HASH,
        "Episodes": episodes,
    }


def fixture(root):
    """Synthetic shapes/counts; source and runtime admission are mocked separately."""
    provenance = {
        "ImplementationCommit": "a" * 40,
        "SourceHashes": [],
        "LoadedAssemblies": [],
        "Runtime": "fixture",
        "OperatingSystem": "fixture",
    }
    common = {
        "Protocol": target.PROTOCOL,
        "Complete": True,
        "Failure": None,
        "ProtocolSha256": target.digest((root / target.PROTOCOL_FILE).read_bytes()),
        "CountsSha256Before": target.COUNTS_SHA,
        "CountsSha256After": target.COUNTS_SHA,
        "Config": copy.deepcopy(target.CONFIG),
        "Provenance": provenance,
        "StartedAtUtc": "2026-09-06T10:00:00+00:00",
        "FinishedAtUtc": "2026-09-06T11:00:00+00:00",
    }
    native = {
        **common,
        "Kind": "behavior",
        "InputSha256": target.MODEL_SHA,
        "Panels": [],
    }
    for config in target.CONFIG["Panels"]:
        row = "0" * 66 if config["Name"] == "dot-iid-half" else "01" * 33
        source = fake_source(1024, 4001, config["SourceDomain"], row)
        arms = [
            {
                "Name": name,
                "Payload": fake_payload(name),
                "Batch": fake_batch(name, source["SourceSymbols"]),
            }
            for name in target.ARMS
        ]
        pairs = []
        for index, control in enumerate(target.CONTROLS, 1):
            differences = [
                a["Return"] - b["Return"]
                for a, b in zip(
                    arms[0]["Batch"]["Episodes"],
                    arms[index]["Batch"]["Episodes"],
                    strict=True,
                )
            ]
            pairs.append(
                {
                    "Control": control,
                    "Differences": differences,
                    "TotalDifference": sum(differences),
                }
            )
        native["Panels"].append(
            {
                "Config": copy.deepcopy(config),
                "Source": source,
                "Arms": arms,
                "PairedReturns": pairs,
            }
        )
    source = fake_source(72, 7001, 701, "01" * 33)
    cost = {
        **common,
        "Kind": "cost",
        "InputSha256": "",
        "ModelInputSha256": target.MODEL_SHA,
        "StartedAtUtc": "2026-09-06T12:00:00+00:00",
        "FinishedAtUtc": "2026-09-06T13:00:00+00:00",
        "QuietWindowDeclaration": "synthetic unit fixture",
        "HostActivity": "no measurement",
        "Source": source,
        "Measurements": [],
    }
    for repetition in range(5):
        for ordinal in range(5):
            name = target.ARMS[(ordinal + repetition) % 5]
            cost["Measurements"].append(
                {
                    "Repetition": repetition,
                    "Name": name,
                    "Payload": fake_payload(name),
                    "Warmup": fake_batch(name, source["SourceSymbols"][:8]),
                    "Timed": fake_batch(name, source["SourceSymbols"][8:], 8),
                    "Resource": {
                        "ElapsedMilliseconds": 64.0,
                        "CpuMilliseconds": 32.0,
                        "AllocatedBytes": 6400,
                    },
                    "WarmupSourceDraws": 0,
                    "TimedSourceDraws": 0,
                    "WarmupActionDraws": 512 if name == "fair-independent" else 0,
                    "TimedActionDraws": 4096 if name == "fair-independent" else 0,
                    "SourceSymbolsSha256": source["SourceSymbolsSha256"],
                    "SourceRomSha256": HASH,
                }
            )
    replay = {
        **target.REPLAY_EXPECTED,
        "InputSha256": "",
        "CostInputSha256": "",
        "ProtocolSha256": common["ProtocolSha256"],
        "Provenance": provenance,
    }
    return native, cost, replay, provenance


def bound(native, cost, replay):
    a = json.dumps(native).encode()
    cost["InputSha256"] = target.digest(a)
    b = json.dumps(cost).encode()
    replay["InputSha256"] = target.digest(a)
    replay["CostInputSha256"] = target.digest(b)
    return a, b, json.dumps(replay).encode()


@pytest.fixture(scope="module")
def root(tmp_path_factory):
    path = tmp_path_factory.mktemp("rendered-catch-verdict")
    protocol = path / target.PROTOCOL_FILE
    protocol.parent.mkdir(parents=True)
    protocol.write_text("synthetic unit protocol; no registered run\n")
    return path


@pytest.fixture(scope="module")
def base(root):
    return fixture(root)


def decide(raw, root, provenance):
    with (
        patch.object(target, "source_manifest", return_value=provenance),
        patch.object(target, "validate_provenance"),
        patch.object(target, "load_model", return_value=COUNTS),
    ):
        return target.verdict(*raw, root=root)


def test_complete_synthetic_roster_has_exact_binding_and_all_operands(base, root):
    a, b, c, provenance = copy.deepcopy(base)
    raw = bound(a, b, c)
    result = decide(raw, root, provenance)
    assert result["PromotionEligible"] and result["AllRegisteredConditionsMet"]
    assert len(result["ReturnConditions"]) == 12
    assert len(result["KnownLagTwoConformance"]) == 4
    assert len(result["CostMedians"]) == 5
    assert len(result["CostConditions"]) == 2
    assert result["ReplayInputSha256"] == target.digest(raw[2])
    assert result["ReturnConditions"][0]["LeftOperand"] == 100 * 65536
    assert result["ReturnConditions"][0]["RightOperand"] == 15 * 65536
    assert result["CostConditions"][0]["Ratio"] == 1.0


@pytest.mark.parametrize(
    "field,value",
    [
        ("Passed", False),
        ("Passed", 1),
        ("MismatchCount", True),
        ("MismatchCount", 1),
        ("MaximumAbsoluteError", 1e-30),
        ("MaximumAbsoluteError", True),
        ("FullBehaviorEpisodes", 20479),
        ("CostRows", 24),
        ("CostTimedEpisodes", 1599),
    ],
)
def test_passed_flag_does_not_override_incomplete_or_nonexact_replay(
    base, root, field, value
):
    a, b, c, provenance = copy.deepcopy(base)
    c[field] = value
    with pytest.raises(ValueError, match="replay"):
        decide(bound(a, b, c), root, provenance)


@pytest.mark.parametrize(
    "kind",
    [
        "panel",
        "arm",
        "episode",
        "duplicate-index",
        "boolean-counter",
        "return",
        "paired",
        "projection",
        "cost-order",
        "cost-counter",
        "cost-draws",
        "cost-fractional-bytes",
        "cost-time-reversal",
    ],
)
def test_complete_looking_receipt_mutations_refuse(base, root, kind):
    a, b, c, provenance = copy.deepcopy(base)
    panel = a["Panels"][0]
    episode = panel["Arms"][0]["Batch"]["Episodes"][0]
    if kind == "panel":
        a["Panels"].pop()
    elif kind == "arm":
        panel["Arms"][1]["Name"] = "order-two"
    elif kind == "episode":
        panel["Arms"][0]["Batch"]["Episodes"].pop()
    elif kind == "duplicate-index":
        episode["Index"] = 1
    elif kind == "boolean-counter":
        episode["Counters"]["Episodes"] = True
    elif kind == "return":
        episode["Return"] = 63
    elif kind == "paired":
        panel["PairedReturns"][0]["Differences"][0] -= 1
    elif kind == "projection":
        panel["Arms"][1]["Batch"]["Episodes"][0]["ProjectionSha256"] = "B" * 64
    elif kind == "cost-order":
        b["Measurements"][0], b["Measurements"][1] = (
            b["Measurements"][1],
            b["Measurements"][0],
        )
    elif kind == "cost-counter":
        b["Measurements"][0]["Timed"]["Counters"]["TotalTransitions"] -= 1122
    elif kind == "cost-draws":
        b["Measurements"][0]["TimedSourceDraws"] = 4224
    elif kind == "cost-fractional-bytes":
        b["Measurements"][0]["Resource"]["AllocatedBytes"] = 6400.0
    else:
        b["StartedAtUtc"] = "2026-09-06T10:30:00+00:00"
    with pytest.raises(ValueError):
        decide(bound(a, b, c), root, provenance)


@pytest.mark.parametrize("index", [0, 1])
def test_same_json_different_bytes_cannot_reuse_replay_binding(base, root, index):
    a, b, c, provenance = copy.deepcopy(base)
    raw = list(bound(a, b, c))
    raw[index] += b"\n"
    with pytest.raises(ValueError, match="byte binding"):
        decide(raw, root, provenance)


def test_median_costs_preserve_all_rotated_rows_and_do_not_use_best_repetition(base):
    cost = copy.deepcopy(base[1])
    values = [64, 192, 192, 192, 32000]
    for row in cost["Measurements"]:
        if row["Name"] == "order-two":
            row["Resource"]["ElapsedMilliseconds"] = values[row["Repetition"]]
    medians = target.cost_medians(cost, COUNTS)
    assert medians[0]["MedianMillisecondsPerEpisode"] == 3.0
    assert len(medians[0]["Repetitions"]) == 5
    totals = {name: {arm: 32768 for arm in target.ARMS} for name in target.PANELS}
    result = target.threshold_verdict(totals, [], medians)
    assert result["CostConditions"][0]["Ratio"] == 3
    assert not result["CostConditions"][0]["Passed"]


def test_integer_return_thresholds_and_inclusive_cost_ties():
    totals = {name: {arm: 0 for arm in target.ARMS} for name in target.PANELS}
    for name in target.PANELS[:3]:
        totals[name]["order-two"] = 9831  # ceil(.15*65536)
    totals[target.PANELS[3]]["order-two"] = 1966  # floor(.03*65536)
    medians = [
        {
            "Name": "order-two",
            "MedianCpuMillisecondsPerEpisode": 0.0,
            "MedianMillisecondsPerEpisode": 2.0,
            "MedianAllocatedBytesPerEpisode": 2.0,
        },
        {
            "Name": "bigram",
            "MedianCpuMillisecondsPerEpisode": 0.0,
            "MedianMillisecondsPerEpisode": 1.0,
            "MedianAllocatedBytesPerEpisode": 1.0,
        },
    ]
    result = target.threshold_verdict(totals, [{"Passed": True}], medians)
    assert result["PromotionEligible"]
    assert result["DescriptiveCostRatios"][0]["Ratios"][
        "CpuMillisecondsPerEpisode"
    ] == {"Ratio": None, "Status": "zero-denominator"}
    totals[target.PANELS[0]]["order-two"] -= 1
    totals[target.PANELS[3]]["order-two"] += 1
    result = target.threshold_verdict(totals, [{"Passed": True}], medians)
    assert not result["ReturnConditions"][0]["Passed"]
    assert not result["ReturnConditions"][-1]["Passed"]
    assert not result["PromotionEligible"]


@pytest.mark.parametrize("raw", [b'{"x":1,"x":2}', b'{"x":NaN}', b'{"x":Infinity}'])
def test_json_duplicate_and_nonfinite_refusal(raw):
    with pytest.raises(ValueError):
        target.load_json(raw)


def git(root, *args):
    return (
        subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True)
        .stdout.decode()
        .strip()
    )


def archive_fixture(root):
    git(root, "init", "-q")
    git(root, "config", "user.email", "fixture@example.invalid")
    git(root, "config", "user.name", "Unit Fixture")
    (root / "registration").write_text("unit registration\n")
    git(root, "add", ".")
    git(root, "commit", "-qm", "fixture registration")
    git(root, "tag", target.REGISTRATION.removeprefix("refs/tags/"))
    for file in target.SOURCE_FILES:
        path = root / file
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"unit source {file}\n")
    git(root, "add", ".")
    git(root, "commit", "-qm", "fixture implementation")
    git(root, "tag", target.ARCHIVE.removeprefix("refs/tags/"))
    commit, hashes = target._archive_hashes(root)
    provenance = {
        "SourceCommit": commit,
        "ImplementationCommit": commit,
        "ImplementationArchive": target.ARCHIVE,
        "SourceHashes": hashes,
        "LoadedAssemblies": [],
        "Runtime": "unit runtime",
        "OperatingSystem": "unit OS",
        "Arguments": ["unit-verdict"],
    }
    return provenance


def test_archive_admission_requires_all_sources_and_actual_committed_bytes(tmp_path):
    provenance = archive_fixture(tmp_path)
    target.validate_provenance(provenance, tmp_path, python=True)
    victim = tmp_path / target.OWN_FILE
    original = victim.read_bytes()
    victim.write_bytes(original + b"changed\n")
    with pytest.raises(ValueError, match="source bytes differ"):
        target._archive_hashes(tmp_path)
    git(tmp_path, "add", ".")
    git(tmp_path, "commit", "-qm", "fixture different source commit")
    provenance["SourceCommit"] = git(tmp_path, "rev-parse", "HEAD")
    victim.write_bytes(
        original
    )  # matching working bytes cannot launder a different commit
    with pytest.raises(ValueError, match="committed source bytes"):
        target.validate_provenance(provenance, tmp_path, python=True)
    provenance["SourceCommit"] = provenance["ImplementationCommit"]
    provenance["SourceHashes"] = provenance["SourceHashes"][:-1]
    with pytest.raises(ValueError, match="source manifest"):
        target.validate_provenance(provenance, tmp_path, python=True)


def test_identical_sources_on_independent_commit_tree_are_admitted(tmp_path):
    provenance = archive_fixture(tmp_path)
    tree = git(tmp_path, "rev-parse", "HEAD^{tree}")
    independent = git(
        tmp_path, "commit-tree", tree, "-m", "independent identical-source snapshot"
    )
    ancestry = subprocess.run(
        [
            "git",
            "-C",
            str(tmp_path),
            "merge-base",
            "--is-ancestor",
            provenance["ImplementationCommit"],
            independent,
        ],
        check=False,
        capture_output=True,
    )
    assert ancestry.returncode == 1
    provenance["SourceCommit"] = independent
    target.validate_provenance(provenance, tmp_path, python=True)


def test_verdict_cli_preserves_admission_failure_and_refuses_overwrite(tmp_path):
    inputs = []
    for name in ("native", "cost", "replay"):
        path = tmp_path / f"{name}.json"
        path.write_text("{}")
        inputs.append(str(path))
    output = tmp_path / "result.json"
    args = [*inputs, str(output), "--root", str(tmp_path)]
    with (
        patch.object(target, "verdict", side_effect=ValueError("source refused")),
        pytest.raises(SystemExit) as exit_info,
    ):
        target.main(args)
    assert exit_info.value.code == 1
    raw = output.read_bytes()
    receipt = json.loads(raw)
    assert receipt["Complete"] is False and receipt["Provenance"] is None
    assert receipt["Failure"]["Detail"] == "source refused"
    assert receipt["InputSha256"] == target.digest(b"{}")
    assert receipt["CostInputSha256"] == target.digest(b"{}")
    assert receipt["ReplayInputSha256"] == target.digest(b"{}")
    with pytest.raises(SystemExit, match="already exists"):
        target.main(args)
    assert output.read_bytes() == raw


def test_verdict_failure_retains_admitted_provenance_and_all_checked_bytes(tmp_path):
    native = b"{}"
    cost = json.dumps({"InputSha256": target.digest(native)}).encode()
    replay = json.dumps(
        {
            "InputSha256": target.digest(native),
            "CostInputSha256": target.digest(cost),
        }
    ).encode()
    inputs = []
    for name, value in zip(
        ("native", "cost", "replay"), (native, cost, replay), strict=True
    ):
        path = tmp_path / f"{name}.json"
        path.write_bytes(value)
        inputs.append(str(path))
    output = tmp_path / "failed.json"
    args = [*inputs, str(output), "--root", str(tmp_path)]
    admitted = {"UnitFixture": "successfully admitted source and runtime"}
    with (
        patch.object(target, "source_manifest", return_value=admitted),
        patch.object(target, "load_model", return_value=COUNTS),
        patch.object(
            target,
            "validate_metadata",
            side_effect=ValueError("behavior arm panels: wrong ordered roster length"),
        ),
        pytest.raises(SystemExit) as exit_info,
    ):
        target.main(args)
    assert exit_info.value.code == 1
    preserved = output.read_bytes()
    receipt = json.loads(preserved)
    assert receipt["Complete"] is False
    assert receipt["InputSha256"] == target.digest(native)
    assert receipt["CostInputSha256"] == target.digest(cost)
    assert receipt["ReplayInputSha256"] == target.digest(replay)
    assert receipt["Provenance"] == admitted
    assert receipt["Failure"]["Stage"] == "receipt-metadata"
    assert receipt["Failure"]["Detail"].startswith("behavior arm panels:")
    with pytest.raises(SystemExit, match="already exists"):
        target.main(args)
    assert output.read_bytes() == preserved


def test_verdict_input_read_failure_preserves_each_successfully_read_hash(tmp_path):
    native = tmp_path / "native.json"
    native.write_bytes(b'{"read": true}')
    cost = tmp_path / "missing-cost.json"
    replay = tmp_path / "replay.json"
    output = tmp_path / "failed-read.json"
    with pytest.raises(SystemExit) as exit_info:
        target.main([str(path) for path in (native, cost, replay, output)])
    assert exit_info.value.code == 1
    receipt = json.loads(output.read_bytes())
    assert receipt["Complete"] is False
    assert receipt["InputSha256"] == target.digest(native.read_bytes())
    assert receipt["CostInputSha256"] is None
    assert receipt["ReplayInputSha256"] is None
    assert receipt["Provenance"] is None
    assert receipt["Failure"]["Stage"] == "input-read:CostInputSha256"


def test_executed_module_must_belong_to_the_admitted_root(tmp_path):
    with pytest.raises(ValueError, match="outside the admitted source root"):
        target.source_manifest(tmp_path, [sys.executable])


def test_payload_rejects_unreported_backing_arrays():
    row = fake_payload("bigram")
    row["ParameterFloat64Values"] = 14
    with pytest.raises(ValueError, match="payload"):
        target.payload(row, "bigram")


@pytest.mark.parametrize(
    "resource,value",
    [
        ("ElapsedMilliseconds", 0),
        ("ElapsedMilliseconds", float("inf")),
        ("CpuMilliseconds", -1),
        ("AllocatedBytes", 0),
        ("AllocatedBytes", True),
    ],
)
def test_resource_metadata_refuses_impossible_or_nonfinite_values(
    base, resource, value
):
    cost = copy.deepcopy(base[1])
    cost["Measurements"][0]["Resource"][resource] = value
    with pytest.raises(ValueError):
        target.cost_medians(cost, COUNTS)


def test_cost_ratio_overflow_does_not_escape_as_nonfinite_json():
    medians = [
        {"MedianMillisecondsPerEpisode": 1e308, "MedianAllocatedBytesPerEpisode": 1.0},
        {"MedianMillisecondsPerEpisode": 1e-308, "MedianAllocatedBytesPerEpisode": 1.0},
    ]
    totals = {panel: {name: 0 for name in target.ARMS} for panel in target.PANELS}
    with pytest.raises(ValueError, match="cost ratio"):
        target.threshold_verdict(totals, [], medians)
