"""Carrier mutation, chronology and independent scoring witnesses."""

import copy
import hashlib
import itertools
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

from zeta_interp import rendered_signal_replay as replay_module
from zeta_interp.mess3_replay import Network, digest, initial_parameters
from zeta_interp.rendered_signal_carrier import (
    compile_rom,
    describe_frame,
    interpret,
    validate_rom,
)
from zeta_interp.rendered_signal_replay import (
    CONFIG,
    close,
    detector,
    fit_counts,
    keyed,
    probabilities,
    score,
)


@pytest.mark.parametrize("renderer", ["train-dot", "heldout-bar", "nuisance"])
def test_every_short_word_survives_real_restricted_execution(renderer):
    for word in itertools.product([0, 1], repeat=5):
        rom = compile_rom(renderer, word)
        frames = []
        decoded, diagnostics = interpret(renderer, len(word), rom, frames.append)
        assert decoded.tolist() == list(word)
        assert len(frames) == len(word)
        assert all(len(frame) == 2048 for frame in frames)
        assert diagnostics["Comparisons"] == len(word) - 1
        assert diagnostics["StructureChanges"] == (4 if renderer == "nuisance" else 0)
        assert diagnostics["PaletteChanges"] == (4 if renderer == "nuisance" else 0)


def test_full_budget_and_jump_bit_boundary():
    for renderer, length in (("train-dot", 2053), ("nuisance", 3078)):
        word = [0, 1] * 128
        rom = compile_rom(renderer, word)
        assert len(rom) == length
        assert interpret(renderer, 256, rom)[0].tolist() == word
    rom = bytearray(compile_rom("train-dot", [0] * 65))
    # The jump at 0x402 must reach 0x404; forcing bit9 recreates the reviewed bug.
    rom[0x402 - 0x200] |= 2
    with pytest.raises(ValueError, match="opcode"):
        validate_rom("train-dot", 65, bytes(rom))


def test_malformed_roms_and_ambiguous_visual_evidence_refuse():
    rom = compile_rom("train-dot", [0, 1])
    with pytest.raises(ValueError, match="shape"):
        validate_rom("train-dot", 2, rom[:-1])
    for offset in (0, 4, 8, len(rom) - 1):
        mutated = bytearray(rom)
        mutated[offset] ^= 1
        with pytest.raises(ValueError):
            validate_rom("train-dot", 2, bytes(mutated))
    empty = np.zeros((32, 64), dtype=np.uint8)
    with pytest.raises(ValueError, match="missing"):
        describe_frame(empty)
    empty[8, 16] = empty[8, 48] = 1
    with pytest.raises(ValueError, match="ambiguous"):
        describe_frame(empty)
    empty.fill(0)
    empty[8, 31:33] = 1
    with pytest.raises(ValueError, match="midpoint"):
        describe_frame(empty)


def test_future_frame_cannot_change_prefix_and_palette_preserves_symbol():
    first, second = [0, 1, 0, 1, 1], [0, 1, 0, 1, 0]
    left, right = [], []
    interpret("nuisance", 5, compile_rom("nuisance", first), left.append)
    interpret("nuisance", 5, compile_rom("nuisance", second), right.append)
    assert left[:4] == right[:4]
    assert hashlib.sha256(left[-1]).digest() != hashlib.sha256(right[-1]).digest()
    for cells in left:
        frame = np.frombuffer(cells, dtype=np.uint8).reshape(32, 64)
        assert describe_frame(frame)["Token"] == describe_frame(frame ^ 1)["Token"]


def test_chronology_and_order_two_baseline_have_independent_witness():
    rows = np.array([[0, 0, 1], [0, 1, 0]], dtype=np.uint8)
    counts = fit_counts(rows)
    assert sorted(rows[0]) == sorted(rows[1])
    assert probabilities("known", rows, counts).tolist() == [0.25, 0.75]
    # Count each observed transition once, plus one pseudocount per outcome.
    np.testing.assert_allclose(counts["Bigram"], [[2 / 5, 3 / 5], [2 / 3, 1 / 3]])
    np.testing.assert_allclose(counts["OrderTwo"][0, 0], [1 / 3, 2 / 3])
    np.testing.assert_allclose(counts["OrderTwo"][0, 1], [2 / 3, 1 / 3])
    result = score("fair", -1, rows, counts)
    assert result["SampledLossBits"] == 1.0
    assert result["Brier"] == 0.25
    assert result["Accuracy"] == 0.5


def test_full_sequence_ratio_includes_preswitch_denominator():
    rows = np.array([[0] * 16, [0, 1] * 8], dtype=np.uint8)
    counts = fit_counts(rows)
    known = detector("known", -1, rows, counts)
    wrong = detector("fair", -1, rows, counts)
    np.testing.assert_allclose(known["FinalLogRatios"], [0, 0], atol=1e-12)
    np.testing.assert_allclose(wrong["FinalLogRatios"], [14 * np.log(1.5)] * 2)
    assert known["FirstCrossings"] == [-1, -1]
    assert all(0 <= t < 16 for t in wrong["FirstCrossings"])


def test_missing_rosters_and_modified_metrics_cannot_pass():
    with pytest.raises(ValueError, match="roster"):
        keyed([], [41, 53, 67], lambda row: row["Seed"])
    with pytest.raises(ValueError, match="registered"):
        keyed([{"Seed": 41}] * 3, [41, 53, 67], lambda row: row["Seed"])
    changed = copy.deepcopy(CONFIG)
    changed["Training"]["Steps"] += 1
    with pytest.raises(ValueError):
        close(changed, CONFIG, tolerance=0)
    for value in (float("nan"), float("inf"), 0.2):
        with pytest.raises(ValueError):
            close({"P1": [value]}, {"P1": [0.1]})
    with pytest.raises(ValueError):
        close({"P1": []}, {"P1": [0.1]})


def test_cli_refuses_unpreserved_source_before_replaying(tmp_path, monkeypatch):
    def refuse(_):
        raise ValueError("unpreserved replay source")

    def unexpected(*_):
        pytest.fail("replay must not run before source preservation check")

    monkeypatch.setattr(replay_module, "replay_provenance", refuse)
    monkeypatch.setattr(replay_module, "replay", unexpected)
    monkeypatch.setattr(
        sys, "argv", ["replay", "input.json", str(tmp_path / "out.json")]
    )
    with pytest.raises(SystemExit, match="unpreserved replay source"):
        replay_module.main()


def test_cli_cost_argument_cannot_be_silently_ignored(tmp_path, monkeypatch):
    source, destination = tmp_path / "source.json", tmp_path / "result.json"
    source.write_text("{}")
    monkeypatch.setattr(replay_module, "replay_provenance", lambda _: {})
    monkeypatch.setattr(
        replay_module, "replay", lambda *_: {"Complete": True, "Passed": True}
    )
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "replay",
            str(source),
            str(destination),
            "--cost",
            str(tmp_path / "absent.json"),
        ],
    )
    with pytest.raises(SystemExit, match="replay refused"):
        replay_module.main()
    assert not destination.exists()


def test_cli_retains_training_mismatch_but_exits_unsuccessfully(tmp_path, monkeypatch):
    source, destination = tmp_path / "source.json", tmp_path / "result.json"
    source.write_text("{}")
    monkeypatch.setattr(replay_module, "replay_provenance", lambda _: {})
    monkeypatch.setattr(
        replay_module,
        "replay",
        lambda *_: {
            "Complete": True,
            "Passed": False,
            "TrainingReplay": {"status": "mismatch"},
        },
    )
    monkeypatch.setattr(
        sys, "argv", ["replay", str(source), str(destination), "--training"]
    )
    with pytest.raises(SystemExit, match="retained numerical mismatch"):
        replay_module.main()
    assert json.loads(destination.read_text())["Passed"] is False


def test_invalid_resource_metadata_and_pipeline_ledger_refuse():
    resource = {
        "ElapsedMilliseconds": 1.0,
        "CpuMilliseconds": 1.0,
        "AllocatedBytes": 32,
    }
    replay_module.validate_resource(resource)
    for key in resource:
        mutated = resource | {key: -1}
        with pytest.raises(ValueError):
            replay_module.validate_resource(mutated)
    with pytest.raises(ValueError):
        replay_module.validate_pipeline_payload({"RomBytes": 516})


def test_native_hand_fixture_agrees_with_independent_interpreter_and_prediction():
    root = Path(__file__).resolve().parents[3]
    completed = subprocess.run(
        [
            "dotnet",
            "fsi",
            "--warnaserror",
            "src/Research.FSharp/check-rendered-signal-kernel.fsx",
        ],
        cwd=root,
        text=True,
        capture_output=True,
        timeout=120,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr
    fixture = json.loads(completed.stdout)
    assert fixture["Protocol"] == "rendered-signal-kernel-v1"
    replay_module.validate_assemblies(fixture["LoadedAssemblies"])
    word = fixture["Tokens"]
    for row in fixture["Carriers"]:
        rom = compile_rom(row["Renderer"], word)
        frames = hashlib.sha256()
        decoded, diagnostics = interpret(row["Renderer"], len(word), rom, frames.update)
        close(
            row,
            {
                "Renderer": row["Renderer"],
                "RomSha256": hashlib.sha256(rom).hexdigest().upper(),
                "FrameSha256": frames.hexdigest().upper(),
                "Tokens": decoded,
                "Diagnostics": diagnostics,
            },
        )
    counts = fit_counts(np.asarray(fixture["TrainingRows"], dtype=np.uint8))
    close(fixture["Counts"], counts)
    parameters = initial_parameters(8, 41, 2)
    close(fixture["Parameters"], parameters, tolerance=1e-14)
    assert fixture["InitialSha256"] == digest(parameters)
    network = Network(8, parameters, 2)
    for row in fixture["Predictions"]:
        contexts = np.asarray([row["Context"]], dtype=np.uint8)
        for arm in row["Arms"]:
            expected = probabilities(arm["Name"], contexts, counts, network)[0]
            close(arm["P1"], expected)
    for row in fixture["Detection"]:
        tokens = np.asarray([row["Tokens"]], dtype=np.uint8)
        for arm in row["Arms"]:
            expected = detector(
                arm["Name"],
                -1,
                tokens,
                counts,
                network if arm["Name"] == "untrained-rnn" else None,
            )
            close(arm["FinalLogRatio"], expected["FinalLogRatios"][0])
            assert arm["FirstCrossing"] == expected["FirstCrossings"][0]
