"""Full old DTO fixtures from unchanged old Python, not native-produced inputs.

The checker independently reconstructs arithmetic with software binary64. Owned
hand fixtures and deliberate data/reference mutations run no registered sources.
"""

import copy
import struct
from dataclasses import replace

import pytest

from zeta_interp import hidden_switch_compiled_ieee as s
from zeta_interp import hidden_switch_compiled_old_replay as replay
from zeta_interp import hidden_switch_compiled_reference as r
from zeta_interp import hidden_switch_reference as old


def value[T](result: s.Result[T]) -> T:
    assert isinstance(result, s.Success), result
    return result.value


def to_float(bits):
    return struct.unpack(">d", bits.to_bytes(8, "big"))[0]


def toggle_last_bit(number):
    bits = int.from_bytes(struct.pack(">d", number), "big")
    return to_float(bits ^ 1)


@pytest.fixture(scope="module")
def rows():
    result = []
    for name, tape in old.hand_tapes():
        for effect in (True, False):
            for geometry, palette in (
                ("dot", "fixed"),
                ("bar", "fixed"),
                ("dot", "odd-complement"),
            ):
                result.append(
                    {
                        "Tape": name,
                        "Effect": effect,
                        "Geometry": geometry,
                        "Palette": palette,
                        "Episode": old.run_episode(
                            "belief-depth3",
                            effect,
                            geometry,
                            palette,
                            tape,
                            len(result),
                        ),
                    }
                )
    return result


def test_all_24_old_python_controls_replay_every_field_and_actual_calls(
    rows, monkeypatch
):
    calls = []
    conditioning = []
    original_evaluate = r.evaluate_bits
    original_condition = r.condition_bits

    def evaluate(belief, effect, depth):
        calls.append((belief, effect, depth))
        return original_evaluate(belief, effect, depth)

    def condition(prior, cue):
        conditioning.append((prior, cue))
        return original_condition(prior, cue)

    def forbidden(*args, **kwargs):
        raise AssertionError(
            "no old runner or source generator may supply replay expectations"
        )

    monkeypatch.setattr(r, "evaluate_bits", evaluate)
    monkeypatch.setattr(r, "condition_bits", condition)
    monkeypatch.setattr(old, "run_episode", forbidden)
    monkeypatch.setattr(old, "source_tapes", forbidden)
    monkeypatch.setattr(r, "source_tapes", forbidden)
    counts = value(replay.replay_old_hand(rows))
    assert counts.Scope == "old-hand-only"
    assert (
        counts.OldControlEpisodes,
        counts.PlanningRecords,
        counts.ObservationRecords,
        counts.NumericValues,
    ) == (24, 384, 408, 1944)
    assert counts.RuntimeAndOuterAdmission == "not-performed-by-pure-replay"
    assert counts.FalsifierAdmission == "pending-separate-admission"
    assert len(calls) == 384 and len(conditioning) == 408
    assert [depth for _, _, depth in calls] == ([3] * 14 + [2, 1]) * 24
    assert [effect for _, effect, _ in calls] == [
        row["Effect"] for row in rows for _ in range(16)
    ]


@pytest.mark.parametrize(
    "kind",
    [
        "omit",
        "extra",
        "duplicate",
        "reorder",
        "wrapper-key",
        "tape",
        "effect",
        "geometry",
        "palette",
        "missing-q",
        "extra-no-q",
        "timing",
        "index",
        "complete-type",
        "failure",
        "cue",
        "terminal-cue",
        "action",
        "state",
        "terminal-state",
        "reward",
        "reward-type",
        "belief",
        "terminal-belief",
        "decision-q",
        "root-q",
        "both-q",
        "terminal-decision-q",
        "terminal-root-q",
        "q-nan",
        "q-infinity",
        "q-bool",
        "q-string",
        "q-integer-inexact",
        "q-length",
        "q-container",
        "belief-length",
        "planning-node",
        "planning-values",
        "planning-predict",
        "planning-update",
        "terminal-planning",
        "counter-type",
        "filter-predict",
        "filter-update",
        "frame",
        "projection",
        "terminal-frame",
        "terminal-projection",
        "total",
    ],
)
def test_full_old_dto_mutations_refuse(rows, kind):
    data = copy.deepcopy(rows)
    episode = data[0]["Episode"]
    if kind == "omit":
        data.pop()
    elif kind == "extra":
        data.append(copy.deepcopy(data[-1]))
    elif kind == "duplicate":
        data[1] = copy.deepcopy(data[0])
    elif kind == "reorder":
        data[0], data[1] = data[1], data[0]
    elif kind == "wrapper-key":
        data[0]["Strategy"] = "native-recursive"
    elif kind == "tape":
        data[0]["Tape"] = "one"
    elif kind == "effect":
        data[0]["Effect"] = 1
    elif kind == "geometry":
        data[0]["Geometry"] = "bar"
    elif kind == "palette":
        data[0]["Palette"] = "odd-complement"
    elif kind == "missing-q":
        del episode["DecisionQ"]
    elif kind == "extra-no-q":
        episode["ChoiceWork"] = []
    elif kind == "timing":
        episode["WallMs"] = 1
    elif kind == "index":
        episode["Index"] = 1
    elif kind == "complete-type":
        episode["Complete"] = 1
    elif kind == "failure":
        episode["Failure"] = {}
    elif kind == "cue":
        episode["Cues"] = "1" + episode["Cues"][1:]
    elif kind == "terminal-cue":
        episode["Cues"] = episode["Cues"][:-1] + str(1 - int(episode["Cues"][-1]))
    elif kind == "action":
        episode["Actions"] = (
            str(1 - int(episode["Actions"][0])) + episode["Actions"][1:]
        )
    elif kind == "state":
        episode["States"] = "1" + episode["States"][1:]
    elif kind == "terminal-state":
        episode["States"] = episode["States"][:-1] + str(1 - int(episode["States"][-1]))
    elif kind == "reward":
        episode["Reward4"][0] += 1
    elif kind == "reward-type":
        episode["Reward4"][0] = float(episode["Reward4"][0])
    elif kind in ("belief", "terminal-belief"):
        index = 16 if kind.startswith("terminal") else 0
        episode["Beliefs"][index] = toggle_last_bit(episode["Beliefs"][index])
    elif kind in (
        "decision-q",
        "root-q",
        "terminal-decision-q",
        "terminal-root-q",
        "both-q",
    ):
        keys = (
            ("DecisionQ", "TreeRootQ")
            if kind == "both-q"
            else (("TreeRootQ",) if "root" in kind else ("DecisionQ",))
        )
        index = 15 if kind.startswith("terminal") else 0
        for key in keys:
            episode[key][index][0] = toggle_last_bit(episode[key][index][0])
    elif kind == "q-nan":
        episode["DecisionQ"][0][0] = float("nan")
    elif kind == "q-infinity":
        episode["TreeRootQ"][0][0] = float("inf")
    elif kind == "q-bool":
        episode["DecisionQ"][0][0] = False
    elif kind == "q-string":
        episode["DecisionQ"][0][0] = str(episode["DecisionQ"][0][0])
    elif kind == "q-integer-inexact":
        episode["DecisionQ"][0][0] = 2**53 + 1
    elif kind == "q-length":
        episode["TreeRootQ"].pop()
    elif kind == "q-container":
        episode["DecisionQ"][0] = tuple(episode["DecisionQ"][0])
    elif kind == "belief-length":
        episode["Beliefs"].pop()
    elif kind.startswith("planning-"):
        key = {
            "planning-node": "Nodes",
            "planning-values": "ActionValues",
            "planning-predict": "Predictions",
            "planning-update": "Updates",
        }[kind]
        episode["PlanningCounters"][0][key] += 1
    elif kind == "terminal-planning":
        episode["PlanningCounters"][15]["Predictions"] = 1
    elif kind == "counter-type":
        episode["PlanningCounters"][15]["Predictions"] = False
    elif kind == "filter-predict":
        episode["FilterCounters"]["Predictions"] -= 1
    elif kind == "filter-update":
        episode["FilterCounters"]["Updates"] -= 1
    elif kind in ("frame", "projection", "terminal-frame", "terminal-projection"):
        key = "ProjectionSha256" if "projection" in kind else "FrameSha256"
        episode[key][16 if kind.startswith("terminal") else 0] = "0" * 64
    elif kind == "total":
        episode["TotalReward4"] += 1
    result = replay.replay_old_hand(data)
    assert isinstance(result, replay.OldReplayFailure), kind
    assert result.Path.startswith("OldControls")
    assert result.Completed.OldControlEpisodes in (0, 1)


def test_sub_tolerance_q_mutation_is_still_refused_with_exact_location(rows):
    data = copy.deepcopy(rows)
    original = data[0]["Episode"]["TreeRootQ"][0][0]
    changed = toggle_last_bit(original)
    assert 0 < abs(changed - original) < 1e-10
    data[0]["Episode"]["TreeRootQ"][0][0] = changed
    result = replay.replay_old_hand(data)
    assert isinstance(result, replay.OldReplayFailure)
    assert result.Path == "OldControls[0].Episode.TreeRootQ[0][0]"


def test_late_failure_preserves_only_whole_completed_old_rows(rows):
    data = copy.deepcopy(rows)
    data[23]["Episode"]["Beliefs"][16] = toggle_last_bit(
        data[23]["Episode"]["Beliefs"][16]
    )
    result = replay.replay_old_hand(data)
    assert isinstance(result, replay.OldReplayFailure)
    assert result.Path == "OldControls[23].Episode.Beliefs[16]"
    assert (
        result.Completed.OldControlEpisodes,
        result.Completed.PlanningRecords,
        result.Completed.ObservationRecords,
        result.Completed.NumericValues,
    ) == (23, 368, 391, 1863)


def test_generic_supplied_tape_and_index_are_independent_of_received_data():
    tape = r.Tape(
        1,
        tuple(int(i in (1, 4, 9)) for i in range(16)),
        tuple(int(i in (3, 11, 15)) for i in range(17)),
    )
    episode = old.run_episode(
        "belief-depth3",
        False,
        "bar",
        "odd-complement",
        old.Tape(tape.initial, tape.drift, tape.errors),
        1023,
    )
    counts = value(
        replay.compare_old_episode(episode, tape, False, "bar", "odd-complement", 1023)
    )
    assert counts.Scope == "one-supplied-tape-old-control-only"
    assert counts.OldControlEpisodes == 1 and counts.NumericValues == 81
    assert isinstance(
        replay.compare_old_episode(episode, tape, False, "bar", "odd-complement", 0),
        replay.OldReplayFailure,
    )


def test_number_admission_preserves_signed_zero_and_finite_bits():
    for bits in (0, s.SIGN, 1, s.SIGN | 1, s.ONE, s.MAX_FINITE):
        assert value(replay.decode_old_number_bits(to_float(bits))) == bits
    assert value(replay.decode_old_number_bits(0)) == 0
    assert value(replay.decode_old_number_bits(1)) == s.ONE
    # An int(0) cannot carry the sign of an already-lost lexical '-0'.
    assert value(replay.decode_old_number_bits(-0)) != s.SIGN
    for value_ in (
        True,
        "0",
        None,
        [],
        float("nan"),
        float("inf"),
        2**53 + 1,
        10**1000,
    ):
        assert isinstance(replay.decode_old_number_bits(value_), s.Failure)


def test_reference_work_and_omission_faults_are_detected(rows, monkeypatch):
    original = r.evaluate_bits

    def wrong(belief, effect, depth):
        result = value(original(belief, effect, depth))
        return s.Success(replace(result, Counters=replace(result.Counters, Nodes=0)))

    monkeypatch.setattr(r, "evaluate_bits", wrong)
    result = replay.replay_old_hand(rows)
    assert isinstance(result, replay.OldReplayFailure)
    assert result.Path == "OldControls[0].Episode.PlanningCounters[0].Nodes"
    monkeypatch.setattr(r, "hand_tapes", lambda: ())
    assert isinstance(replay.replay_old_hand(rows), replay.OldReplayFailure)


def test_public_invalid_arguments_refuse(rows):
    for actual in (None, {}, (), [], rows[:1]):
        assert isinstance(replay.replay_old_hand(actual), replay.OldReplayFailure)
    tape = r.hand_tapes()[0][1]
    for bad in (None, r.Tape(2, tape.drift, tape.errors), r.Tape(0, (), tape.errors)):
        assert isinstance(
            replay.compare_old_episode(rows[0]["Episode"], bad, True, "dot", "fixed"),
            replay.OldReplayFailure,
        )
    for effect, geometry, palette, index in (
        (1, "dot", "fixed", 0),
        (True, "bad", "fixed", 0),
        (True, "dot", "bad", 0),
        (True, "dot", "fixed", 1024),
        (True, "dot", "fixed", False),
    ):
        assert isinstance(
            replay.expected_old_episode_bits(tape, effect, geometry, palette, index),
            s.Failure,
        )
