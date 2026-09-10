"""Synthetic full-shaped receipts, never a registered source or policy run.

Source generation, interpreter execution, own runtime-manifest capture, and
Git byte transport are synthetic. The recorded-provenance validator, envelope,
byte-binding and full-loop readers run unchanged.
Carrier correctness is checked separately against the live native hand fixture.
"""

import copy
import json
from pathlib import Path

import pytest

from zeta_interp import rendered_catch_replay as reader
from zeta_interp.rendered_catch_carrier import (
    ARMS,
    COUNTS_SHA,
    MODEL_SHA,
    counters,
    sha,
)

ROOT = Path(__file__).resolve().parents[3]
SYNTHETIC_ROW = bytes(66)


def synthetic_batch(size, name, start=0):
    episodes = [
        {
            "Index": index,
            "Complete": True,
            "Failure": None,
            "Actions": "0" * 64,
            "Hits": "1" * 64,
            "Observations": "0" * 66,
            "WarmupHit": 1,
            "Return": 64,
            "Counters": counters(1),
            "FrameSha256": "0" * 64,
            "ProjectionSha256": "0" * 64,
            "ShadowTraceSha256": "0" * 64,
        }
        for index in range(start, start + size)
    ]
    return {
        "Complete": True,
        "Failure": None,
        "ActionDraws": size * 64 if name == "fair-independent" else 0,
        "TotalHits": size * 64,
        "MeanHitFraction": 1.0,
        "Counters": counters(size),
        "FrameSha256": "0" * 64,
        "ProjectionSha256": "0" * 64,
        "ShadowTraceSha256": "0" * 64,
        "Episodes": episodes,
    }


@pytest.fixture
def full_receipts(monkeypatch):
    # Tiny fake archive and own runtime manifest; recorded-provenance and
    # declared-commit validators remain live.
    sources = {
        reader.PROTOCOL_FILE: (ROOT / reader.PROTOCOL_FILE).read_bytes(),
        "synthetic.py": b"synthetic archived source\n",
    }
    hashes = [{"File": key, "Sha256": sha(raw)} for key, raw in sources.items()]
    implementation, commit = "a" * 40, "b" * 40
    monkeypatch.setattr(
        reader, "admitted_sources", lambda root: (implementation, hashes)
    )

    def fake_git(root, *args):
        if args[:1] == ("cat-file",):
            return b""
        if args[:1] == ("show",):
            return sources[args[1].split(":", 1)[1]]
        raise AssertionError(f"unexpected fake Git request: {args}")

    monkeypatch.setattr(reader, "git", fake_git)
    provenance = {
        "SourceCommit": commit,
        "ImplementationArchive": reader.ARCHIVE,
        "ImplementationCommit": implementation,
        "SourceHashes": hashes,
        "LoadedAssemblies": [
            {
                "Name": name,
                "Mvid": "00000000-0000-0000-0000-000000000001",
                "Sha256": "0" * 64,
            }
            for name in ("Zeta.Core", "Zeta.Core.Abstractions")
        ],
        "Runtime": "synthetic native runtime",
        "OperatingSystem": "synthetic OS",
        "Arguments": ["synthetic.json"],
    }
    own = copy.deepcopy(provenance)
    own["LoadedAssemblies"] = []
    own["Runtime"] = "synthetic Python runtime"
    monkeypatch.setattr(
        reader, "source_manifest", lambda root, arguments: copy.deepcopy(own)
    )
    monkeypatch.setattr(
        reader,
        "source_rows",
        lambda seed, tag, count, probability: [SYNTHETIC_ROW] * count,
    )
    panels = []
    for config in reader.CONFIG["Panels"]:
        arms = [
            {
                "Name": name,
                "Payload": reader.native_payload(name),
                "Batch": synthetic_batch(1024, name),
            }
            for name in ARMS
        ]
        panels.append(
            {
                "Config": copy.deepcopy(config),
                "Source": reader.source_receipt(
                    [SYNTHETIC_ROW] * 1024,
                    config["SourceSeed"],
                    config["SourceDomain"],
                    config["Geometry"],
                ),
                "Arms": arms,
                "PairedReturns": reader.paired(arms),
            }
        )
    common = {
        "Protocol": reader.PROTOCOL,
        "Complete": True,
        "Failure": None,
        "ProtocolSha256": sha(sources[reader.PROTOCOL_FILE]),
        "CountsSha256Before": COUNTS_SHA,
        "CountsSha256After": COUNTS_SHA,
        "Config": copy.deepcopy(reader.CONFIG),
        "Provenance": provenance,
        "StartedAtUtc": "2026-09-06T00:00:00Z",
        "FinishedAtUtc": "2026-09-06T00:00:01Z",
    }
    native = {
        **copy.deepcopy(common),
        "Kind": "behavior",
        "InputSha256": MODEL_SHA,
        "Panels": panels,
    }
    source = reader.source_receipt([SYNTHETIC_ROW] * 72, 7001, 701, "dot")
    rows = []
    for repetition in range(5):
        for position in range(5):
            name = ARMS[(position + repetition) % 5]
            rows.append(
                {
                    "Repetition": repetition,
                    "Name": name,
                    "Payload": reader.native_payload(name),
                    "Warmup": synthetic_batch(8, name),
                    "Timed": synthetic_batch(64, name, 8),
                    "Resource": {
                        "ElapsedMilliseconds": 64.0,
                        "CpuMilliseconds": 0.0,
                        "AllocatedBytes": 4096,
                    },
                    "WarmupSourceDraws": 0,
                    "TimedSourceDraws": 0,
                    "WarmupActionDraws": 512 if name == "fair-independent" else 0,
                    "TimedActionDraws": 4096 if name == "fair-independent" else 0,
                    "SourceSymbolsSha256": source["SourceSymbolsSha256"],
                    "SourceRomSha256": source["SourceRomSha256"],
                }
            )
    cost = {
        **copy.deepcopy(common),
        "Kind": "cost",
        "InputSha256": "0" * 64,
        "ModelInputSha256": MODEL_SHA,
        "StartedAtUtc": "2026-09-06T00:00:02Z",
        "FinishedAtUtc": "2026-09-06T00:00:03Z",
        "QuietWindowDeclaration": "synthetic fixture only",
        "HostActivity": "no measurement",
        "Source": source,
        "Measurements": rows,
    }
    return native, cost, own


def bound_bytes(native, cost):
    native_raw = json.dumps(native).encode()
    cost["InputSha256"] = sha(native_raw)
    return native_raw, json.dumps(cost).encode()


def test_admitted_full_roster_reaches_all_interpreter_batches(
    full_receipts, monkeypatch
):
    native, cost, own = full_receipts
    calls = []

    def interpreter(rows, geometry, palette, name, counts, rng=None, start_index=0):
        calls.append((len(rows), name, start_index))
        return synthetic_batch(len(rows), name, start_index)

    monkeypatch.setattr(reader, "run_batch", interpreter)
    raw, cost_raw = bound_bytes(native, cost)
    result = reader.replay(
        raw, cost_raw, ROOT, ["synthetic"], progress=lambda *args, **kwargs: None
    )
    assert result["Passed"] and result["ExactMatch"]
    assert result["InputSha256"] == sha(raw) and result["CostInputSha256"] == sha(
        cost_raw
    )
    assert result["Provenance"] == own
    assert len(calls) == 70  # 20 behavioral batches; 25 warmup/timed pairs.
    assert sum(size for size, _, _ in calls) == 20480 + 200 + 1600


@pytest.mark.parametrize(
    "mutation",
    [
        "missing-arm",
        "duplicate-arm",
        "missing-episode",
        "duplicate-episode",
        "model-input",
        "count-hash",
        "source-symbol",
        "source-rom",
        "source-manifest",
        "recorded-commit-bytes",
        "cost-repetition",
        "cost-rotation",
        "missing-cost-row",
        "duplicate-cost-row",
        "cost-runtime",
    ],
)
def test_full_envelope_mutations_refuse_before_interpreter(
    full_receipts, monkeypatch, mutation
):
    native, cost, _ = full_receipts
    if mutation == "missing-arm":
        native["Panels"][0]["Arms"].pop()
    elif mutation == "duplicate-arm":
        native["Panels"][0]["Arms"][1] = copy.deepcopy(native["Panels"][0]["Arms"][0])
    elif mutation == "missing-episode":
        native["Panels"][0]["Arms"][0]["Batch"]["Episodes"].pop()
    elif mutation == "duplicate-episode":
        episodes = native["Panels"][0]["Arms"][0]["Batch"]["Episodes"]
        episodes[1] = copy.deepcopy(episodes[0])
    elif mutation == "model-input":
        native["InputSha256"] = "F" * 64
    elif mutation == "count-hash":
        native["CountsSha256After"] = "F" * 64
    elif mutation == "source-symbol":
        native["Panels"][0]["Source"]["SourceSymbols"][0] = "1" + "0" * 65
    elif mutation == "source-rom":
        native["Panels"][0]["Source"]["SourceRomSha256"] = "F" * 64
    elif mutation == "source-manifest":
        for receipt in (native, cost):
            receipt["Provenance"]["SourceHashes"][0]["Sha256"] = "F" * 64
    elif mutation == "recorded-commit-bytes":
        original = reader.git
        monkeypatch.setattr(
            reader,
            "git",
            lambda root, *args: (
                b"altered committed source"
                if args[0] == "show"
                else original(root, *args)
            ),
        )
    elif mutation == "cost-repetition":
        cost["Measurements"][6]["Repetition"] = 2
    elif mutation == "cost-rotation":
        cost["Measurements"][5]["Name"] = "order-two"
    elif mutation == "missing-cost-row":
        cost["Measurements"].pop()
    elif mutation == "duplicate-cost-row":
        cost["Measurements"][1] = copy.deepcopy(cost["Measurements"][0])
    else:
        cost["Provenance"]["Runtime"] = "different runtime"

    def forbidden(*args, **kwargs):
        pytest.fail("interpreter ran before invalid full envelope was refused")

    monkeypatch.setattr(reader, "run_batch", forbidden)
    raw, cost_raw = bound_bytes(native, cost)
    with pytest.raises(ValueError):
        reader.replay(
            raw, cost_raw, ROOT, ["synthetic"], progress=lambda *args, **kwargs: None
        )


def test_mid_replay_failure_keeps_inputs_provenance_and_location(
    full_receipts, monkeypatch, tmp_path
):
    native, cost, own = full_receipts
    # Valid SHA syntax and sums: only a full comparison reveals this changed trace.
    native["Panels"][0]["Arms"][2]["Batch"]["Episodes"][7]["FrameSha256"] = "F" * 64
    monkeypatch.setattr(
        reader,
        "run_batch",
        lambda rows, geometry, palette, name, counts, rng=None, start_index=0: (
            synthetic_batch(len(rows), name, start_index)
        ),
    )
    raw, cost_raw = bound_bytes(native, cost)
    native_path, cost_path, output = (
        tmp_path / name for name in ("native.json", "cost.json", "failed.json")
    )
    native_path.write_bytes(raw)
    cost_path.write_bytes(cost_raw)
    with pytest.raises(SystemExit) as stopped:
        reader.main([str(native_path), str(cost_path), str(output)])
    assert stopped.value.code == 1
    receipt = reader.parse(output.read_bytes())
    assert receipt["Complete"] is False and receipt["Passed"] is False
    assert receipt["InputSha256"] == sha(raw) and receipt["CostInputSha256"] == sha(
        cost_raw
    )
    assert receipt["Provenance"] == own
    assert receipt["CompletedBehaviorArmPanels"] == 2
    assert receipt["Failure"]["Stage"] == "behavior-replay"
    assert receipt["Failure"]["Panel"] == "dot-three-quarter"
    assert receipt["Failure"]["Arm"] == "last-beacon"
    assert receipt["Failure"]["Episode"] == 7
    assert "FrameSha256" in receipt["Failure"]["Detail"]
    before = output.read_bytes()
    with pytest.raises(SystemExit) as refused:
        reader.main([str(native_path), str(cost_path), str(output)])
    assert refused.value.code == 2 and output.read_bytes() == before


def test_partial_input_read_keeps_first_hash(tmp_path):
    native, missing, output = (
        tmp_path / name for name in ("native.json", "missing.json", "failure.json")
    )
    native.write_bytes(b"checked first input bytes")
    with pytest.raises(SystemExit) as stopped:
        reader.main([str(native), str(missing), str(output)])
    assert stopped.value.code == 1
    receipt = reader.parse(output.read_bytes())
    assert receipt["InputSha256"] == sha(native.read_bytes())
    assert receipt["CostInputSha256"] is None and receipt["Provenance"] is None
    assert receipt["Failure"]["Stage"] == "input-read"
