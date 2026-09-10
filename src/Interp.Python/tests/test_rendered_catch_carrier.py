"""Causal/action witnesses for the independent rendered catch interpreter."""

import copy
import json
from pathlib import Path

import pytest

from zeta_interp.mess3_replay import Stream, domain
from zeta_interp.rendered_catch_carrier import (
    ARMS,
    COUNTS_SHA,
    Frame,
    Machine,
    Policy,
    admit_rom,
    background,
    compile_rom,
    count_hash,
    decode,
    project,
    reward,
    run_batch,
    source_rows,
)

ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture
def counts():
    return json.loads(
        (ROOT / "src/Research.FSharp/rendered-signal-results.json").read_bytes()
    )["Counts"]


@pytest.mark.parametrize("geometry", ["dot", "bar"])
@pytest.mark.parametrize("target", [0, 1])
def test_actual_key_changes_catcher_and_rendered_reward(geometry, target):
    machine = Machine(compile_rom(bytes([1, target] + [0] * 64), geometry), geometry)
    machine.advance(None)
    frames = []
    for key in (0, 1):
        fork = copy.deepcopy(machine)
        frame, trace = fork.advance(key)
        assert len(trace) == 17 * 6
        assert reward(frame) == int(key == target)
        assert decode(project(frame)) == target
        assert frame.cells[24 * 64 + 16 + 32 * key] == 1
        frames.append(frame)
    assert frames[0] != frames[1]
    assert project(frames[0]) == project(frames[1])


@pytest.mark.parametrize("name", ARMS)
def test_projection_and_next_action_ignore_every_valid_lower_band(name, counts):
    machine = Machine(compile_rom(bytes([0, 1] * 33), "dot"), "dot")
    policy = Policy(name, counts, Stream(domain(17, 29)))
    first, _ = machine.advance(None)
    second, _ = machine.advance(0)
    policy.observe(project(first))
    variants = [
        bytes(512),
        bytes([1]) * 512,
        bytes([0, 1]) * 256,
        bytes(((index * 13) ^ (index >> 3)) & 1 for index in range(512)),
    ]
    projections, actions = [], []
    for lower in variants:
        altered = Frame(second.cells[:1536] + lower)
        projected = project(altered)
        fork = policy.fork()  # Includes identical independent RNG state/draw index.
        fork.observe(projected)
        projections.append(projected)
        actions.append(fork.choose())
    assert all(frame == projections[0] for frame in projections)
    assert len(set(actions)) == 1


@pytest.mark.parametrize("name", ARMS)
def test_unrevealed_suffix_cannot_change_committed_action(name, counts):
    actions = []
    for suffix in (bytes(64), bytes([1]) * 64):
        machine = Machine(compile_rom(bytes([0, 1]) + suffix, "bar"), "bar")
        policy = Policy(name, counts, Stream(domain(17, 29)))
        for key in (None, 0):
            frame, _ = machine.advance(key)
            policy.observe(project(frame))
        actions.append(policy.choose())
    assert actions[0] == actions[1]


def test_top_majority_tie_refuses_for_all_lower_bands():
    top = bytes([0, 1]) * 768
    for lower in (bytes(512), bytes([1]) * 512, bytes([0, 1]) * 256):
        with pytest.raises(ValueError, match="tie"):
            project(Frame(top + lower))
    # A full-frame majority would vary with the lower band; top background does not.
    top = bytes(769) + bytes([1]) * 767
    assert background(Frame(top + bytes([1]) * 512)) == 0
    assert background(Frame(top + bytes(512))) == 0


def test_changed_top_target_changes_projection_and_observation():
    projections = []
    for target in (0, 1):
        machine = Machine(compile_rom(bytes([target]) * 66, "dot"), "dot")
        frame, _ = machine.advance(None)
        projections.append(project(frame))
        assert decode(projections[-1]) == target
    assert projections[0] != projections[1]


@pytest.mark.parametrize(
    "geometry,palette", [("dot", "fixed"), ("bar", "fixed"), ("dot", "odd-complement")]
)
def test_full_episode_boundaries_and_known_action_diagnostic(geometry, palette, counts):
    rows = [bytes([0, 1] * 33)]
    fitted = run_batch(rows, geometry, palette, "order-two", counts)
    known = run_batch(rows, geometry, palette, "known-lag-two", counts)
    assert fitted == known
    assert fitted["TotalHits"] == 64
    assert fitted["Episodes"][0]["Actions"] == "01" * 32
    machine = Machine(compile_rom(rows[0], geometry), geometry)
    for index in range(66):
        machine.advance(None if index == 0 else index % 2)
    assert machine.pc == 0xAC4
    with pytest.raises(ValueError, match="boundary"):
        machine.advance(0)


def test_malformed_rom_pc_key_frame_and_reward_refuse():
    rom = compile_rom(bytes(66), "dot")
    for offset in (0, 11, 34, 2244, 2246):
        mutated = bytearray(rom)
        mutated[offset] ^= 1
        with pytest.raises(ValueError):
            admit_rom(bytes(mutated), "dot")
    machine = Machine(rom, "dot")
    with pytest.raises(ValueError, match="key"):
        machine.advance(0)
    machine.advance(None)
    for bad in (None, True, 2, -1):
        with pytest.raises(ValueError, match="key"):
            machine.advance(bad)
    machine.pc += 2
    with pytest.raises(ValueError, match="boundary"):
        machine.advance(0)
    for frame in (
        Frame(bytes(2047)),
        Frame(bytes([2]) * 2048),
        Frame(bytes(2048), width=32),
    ):
        with pytest.raises(ValueError, match="binary"):
            project(frame)
    with pytest.raises(ValueError, match="glyph"):
        reward(Frame(bytes(2048)))
    malformed = bytearray(2048)
    malformed[24 * 64] = 1
    with pytest.raises(ValueError, match="lower-band"):
        decode(Frame(bytes(malformed)))


def test_fx0a_zero_is_held_key_and_absence_stalls():
    machine = Machine(compile_rom(bytes(66), "dot"), "dot")
    machine.advance(None)
    before = machine.pc
    machine.step(None)
    assert machine.pc == before
    machine.step(0)
    assert machine.pc == before + 2 and machine.v[0] == 0


def test_fair_stream_persists_across_episodes_and_source_history_resets(counts):
    rows = source_rows(19, 31, 2, 0.75)  # Conformance seed, not evaluation panel.
    rng = Stream(domain(23, 37))
    batch = run_batch(rows, "dot", "fixed", "fair-independent", counts, rng)
    reference = Stream(domain(23, 37))
    assert "".join(ep["Actions"] for ep in batch["Episodes"]) == "".join(
        str(int(2 * reference.next())) for _ in range(128)
    )
    assert batch["ActionDraws"] == 128
    assert source_rows(19, 31, 2, 0.75) == rows
    assert count_hash(counts) == COUNTS_SHA
    mutated = copy.deepcopy(counts)
    mutated["Unigram"][0] = True
    with pytest.raises(ValueError, match="probability"):
        count_hash(mutated)


def test_interpreter_failure_keeps_the_corpus_episode_index(counts):
    from zeta_interp.rendered_catch_carrier import EpisodeExecutionError

    with pytest.raises(EpisodeExecutionError) as refused:
        run_batch([bytes(65)], "dot", "fixed", "order-two", counts, start_index=8)
    assert refused.value.episode == 8
    assert "ROM source" in str(refused.value)
    with pytest.raises(ValueError, match="empty"):
        run_batch([], "dot", "fixed", "order-two", counts)
