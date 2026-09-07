"""Pure replay using Python-produced hand payloads, never native-produced data.

Fixture generation executes the independent reference. No native process,
filesystem/runtime admission, registered RNG or timing is involved. Mutants and
spies establish that every field/position and the real reference are checked.
"""

import copy
from dataclasses import asdict, replace

import pytest
from zeta_interp import hidden_switch_compiled_certificate as c
from zeta_interp import hidden_switch_compiled_ieee as s
from zeta_interp import hidden_switch_compiled_reference as r
from zeta_interp import hidden_switch_compiled_replay as replay

BINDINGS = {"ProtocolSha256": c.PROTOCOL_SHA256, "hand/source.py": "A" * 64}


def value[T](result: s.Result[T]) -> T:
    assert isinstance(result, s.Success), result
    return result.value


@pytest.fixture(scope="module")
def data():
    cert = value(c.verify_certificate(value(c.build_certificate(BINDINGS)), BINDINGS))
    scalars = []
    for row in value(r.scalar_roster(cert)):
        belief = value(s.parse_bits(row["BeliefBits"]))
        effect, depth = row["Effect"], row["Depth"]
        evaluation = value(r.evaluate_bits(belief, effect, depth))
        scalars.append(
            {
                "Input": row,
                "QBits": [f"{bits:016X}" for bits in evaluation.QBits],
                "Native": asdict(value(r.native_choice(belief, effect, depth))),
                "Compiled": asdict(
                    value(r.compiled_choice(cert, belief, effect, depth))
                ),
            }
        )
    hands = []
    case = 0
    for name, tape in r.hand_tapes():
        for effect in (True, False):
            for geometry, palette in (
                ("dot", "fixed"),
                ("bar", "fixed"),
                ("dot", "odd-complement"),
            ):
                for strategy in r.STRATEGIES:
                    hands.append(
                        {
                            "Tape": name,
                            "Effect": effect,
                            "Geometry": geometry,
                            "Palette": palette,
                            "Strategy": strategy,
                            "Episode": value(
                                r.run_episode(
                                    strategy,
                                    effect,
                                    geometry,
                                    palette,
                                    tape,
                                    case,
                                    certificate=cert,
                                )
                            ),
                        }
                    )
                case += 1
    return cert, scalars, hands


def test_complete_live_replay_counts_and_exact_order(data, monkeypatch):
    cert, scalars, hands = data
    scalar_calls = []
    hand_calls = []
    native, episode = r.native_choice, r.run_episode

    def scalar_spy(belief, effect, depth):
        scalar_calls.append((f"{belief:016X}", effect, depth))
        return native(belief, effect, depth)

    def hand_spy(strategy, effect, geometry, palette, tape, index, **kwargs):
        hand_calls.append((strategy, effect, geometry, palette, index))
        return episode(strategy, effect, geometry, palette, tape, index, **kwargs)

    def forbidden_source(*args, **kwargs):
        raise AssertionError("pure hand replay must not call a source generator")

    monkeypatch.setattr(r, "native_choice", scalar_spy)
    monkeypatch.setattr(r, "run_episode", hand_spy)
    monkeypatch.setattr(r, "source_tapes", forbidden_source)
    counts = value(replay.replay_scalar_and_new_hand(scalars, hands, cert))
    assert counts.Scope == "scalars-and-new-hand-only"
    assert counts.NumericCertificateSha256 == cert.NumericSha256
    assert (counts.ScalarRows, counts.ScalarChoiceRecords) == (222, 444)
    assert (
        counts.NewHandEpisodes,
        counts.HandChoiceRecords,
        counts.HandObservationRecords,
    ) == (48, 768, 816)
    assert counts.OldNativeControls == 0
    assert (
        counts.OldNativeControlAdmission
        == counts.FalsifierAdmission
        == "pending-separate-admission"
    )
    assert counts.RuntimeAndOuterAdmission == "not-performed-by-pure-replay"
    assert scalar_calls == [
        (row["Input"]["BeliefBits"], row["Input"]["Effect"], row["Input"]["Depth"])
        for row in scalars
    ]
    assert hand_calls == [
        (
            row["Strategy"],
            row["Effect"],
            row["Geometry"],
            row["Palette"],
            row["Episode"]["Index"],
        )
        for row in hands
    ]
    assert len(scalar_calls) == 222 and len(hand_calls) == 48


@pytest.mark.parametrize(
    "kind",
    [
        "omit",
        "extra",
        "duplicate",
        "reorder",
        "missing-key",
        "extra-timing",
        "bool-index",
        "bool-effect",
        "negative-zero",
        "q-bit",
        "q-length",
        "q-type",
        "action",
        "path",
        "guard-count",
        "recursive-count",
        "node-count",
        "value-count",
        "prediction-count",
        "update-count",
        "bool-count",
    ],
)
def test_scalar_omission_order_bits_and_work_mutants_refuse(data, kind):
    cert, original, _ = data
    rows = copy.deepcopy(original)
    if kind == "omit":
        rows.pop()
    elif kind == "extra":
        rows.append(copy.deepcopy(rows[-1]))
    elif kind == "duplicate":
        rows[1] = copy.deepcopy(rows[0])
    elif kind == "reorder":
        rows[0], rows[1] = rows[1], rows[0]
    elif kind == "missing-key":
        del rows[0]["Compiled"]
    elif kind == "extra-timing":
        rows[0]["WallNanoseconds"] = 1
    elif kind == "bool-index":
        rows[0]["Input"]["Index"] = False
    elif kind == "bool-effect":
        rows[0]["Input"]["Effect"] = 1
    elif kind == "negative-zero":
        rows[0]["Input"]["BeliefBits"] = "0000000000000000"
    elif kind == "q-bit":
        rows[0]["QBits"][0] = "0000000000000000"
    elif kind == "q-length":
        rows[0]["QBits"].pop()
    elif kind == "q-type":
        rows[0]["QBits"] = tuple(rows[0]["QBits"])
    elif kind == "action":
        rows[0]["Native"]["Action"] ^= 1
    elif kind == "path":
        rows[0]["Compiled"]["Path"] = 0
    elif kind == "guard-count":
        rows[0]["Compiled"]["GuardComparisons"] += 1
    elif kind == "recursive-count":
        rows[0]["Native"]["RecursiveCalls"] = 0
    elif kind == "node-count":
        rows[0]["Native"]["Nodes"] += 1
    elif kind == "value-count":
        rows[0]["Native"]["ActionValues"] += 1
    elif kind == "prediction-count":
        rows[0]["Native"]["Predictions"] += 1
    elif kind == "update-count":
        rows[0]["Native"]["Updates"] += 1
    elif kind == "bool-count":
        rows[0]["Native"]["Predictions"] = False
    result = replay.replay_scalars(rows, cert)
    assert isinstance(result, replay.ReplayFailure), kind
    assert result.Path.startswith("Scalars")
    assert result.Completed.ScalarRows in (0, 1)
    assert result.Completed.NewHandEpisodes == 0


@pytest.mark.parametrize(
    "kind",
    [
        "omit",
        "extra",
        "duplicate",
        "reorder",
        "wrapper-key",
        "nested-key",
        "timing",
        "strategy",
        "tape",
        "effect-type",
        "geometry",
        "palette",
        "index",
        "complete-type",
        "failure",
        "cue",
        "terminal-cue",
        "action",
        "state",
        "reward",
        "reward-type",
        "belief-bit",
        "terminal-belief",
        "frame-hash",
        "projection-hash",
        "terminal-frame",
        "terminal-projection",
        "filter-predict",
        "filter-update",
        "work",
        "terminal-work",
        "work-type",
        "total",
        "array-length",
    ],
)
def test_every_hand_field_and_terminal_observation_mutants_refuse(data, kind):
    cert, _, original = data
    rows = copy.deepcopy(original)
    episode = rows[0]["Episode"]
    if kind == "omit":
        rows.pop()
    elif kind == "extra":
        rows.append(copy.deepcopy(rows[-1]))
    elif kind == "duplicate":
        rows[1] = copy.deepcopy(rows[0])
    elif kind == "reorder":
        rows[0], rows[1] = rows[1], rows[0]
    elif kind == "wrapper-key":
        rows[0]["OldControl"] = True
    elif kind == "nested-key":
        episode["DecisionQ"] = []
    elif kind == "timing":
        episode["WallNanoseconds"] = 1
    elif kind == "strategy":
        rows[0]["Strategy"] = r.STRATEGIES[1]
    elif kind == "tape":
        rows[0]["Tape"] = "one"
    elif kind == "effect-type":
        rows[0]["Effect"] = 1
    elif kind == "geometry":
        rows[0]["Geometry"] = "bar"
    elif kind == "palette":
        rows[0]["Palette"] = "odd-complement"
    elif kind == "index":
        episode["Index"] = 1
    elif kind == "complete-type":
        episode["Complete"] = 1
    elif kind == "failure":
        episode["Failure"] = {}
    elif kind == "cue":
        episode["Cues"] = str(1 - int(episode["Cues"][0])) + episode["Cues"][1:]
    elif kind == "terminal-cue":
        episode["Cues"] = episode["Cues"][:-1] + str(1 - int(episode["Cues"][-1]))
    elif kind == "action":
        episode["Actions"] = (
            str(1 - int(episode["Actions"][0])) + episode["Actions"][1:]
        )
    elif kind == "state":
        episode["States"] = "1" + episode["States"][1:]
    elif kind == "reward":
        episode["Reward4"][0] += 1
    elif kind == "reward-type":
        episode["Reward4"][0] = False
    elif kind == "belief-bit":
        episode["BeliefBits"][0] = "0000000000000000"
    elif kind == "terminal-belief":
        episode["BeliefBits"][-1] = "0000000000000000"
    elif kind == "frame-hash":
        episode["FrameSha256"][0] = "0" * 64
    elif kind == "projection-hash":
        episode["ProjectionSha256"][0] = "0" * 64
    elif kind == "terminal-frame":
        episode["FrameSha256"][-1] = "0" * 64
    elif kind == "terminal-projection":
        episode["ProjectionSha256"][-1] = "0" * 64
    elif kind == "filter-predict":
        episode["FilterCounters"]["Predictions"] -= 1
    elif kind == "filter-update":
        episode["FilterCounters"]["Updates"] -= 1
    elif kind == "work":
        episode["ChoiceWork"][0]["Nodes"] += 1
    elif kind == "terminal-work":
        episode["ChoiceWork"][-1]["ActionValues"] += 1
    elif kind == "work-type":
        episode["ChoiceWork"][0]["GuardComparisons"] = False
    elif kind == "total":
        episode["TotalReward4"] += 1
    elif kind == "array-length":
        episode["FrameSha256"].pop()
    result = replay.replay_new_hand(rows, cert)
    assert isinstance(result, replay.ReplayFailure), kind
    assert result.Path.startswith("Episodes")
    assert result.Completed.NewHandEpisodes in (0, 1)


def test_late_failure_retains_exact_completed_prefix_without_whole_success(data):
    cert, scalars, original = data
    rows = copy.deepcopy(original)
    rows[7]["Episode"]["FrameSha256"][16] = "F" * 64
    refusal = replay.replay_scalar_and_new_hand(scalars, rows, cert)
    assert isinstance(refusal, replay.ReplayFailure)
    assert refusal.Path == "Episodes[7].Episode.FrameSha256[16]"
    assert (refusal.Completed.ScalarRows, refusal.Completed.ScalarChoiceRecords) == (
        222,
        444,
    )
    assert (
        refusal.Completed.NewHandEpisodes,
        refusal.Completed.HandChoiceRecords,
        refusal.Completed.HandObservationRecords,
    ) == (7, 112, 119)


def test_reference_is_live_and_no_empty_roster_can_pass(data, monkeypatch):
    cert, scalars, hands = data
    original = r.native_choice
    monkeypatch.setattr(
        r,
        "native_choice",
        lambda *args: s.Success(replace(value(original(*args)), Action=1)),
    )
    refusal = replay.replay_scalars(scalars, cert)
    assert isinstance(refusal, replay.ReplayFailure)
    assert refusal.Path == "Scalars[0].Native.Action"
    monkeypatch.setattr(r, "scalar_roster", lambda _: s.Success([]))
    assert isinstance(replay.replay_scalars(scalars, cert), replay.ReplayFailure)
    monkeypatch.setattr(r, "hand_tapes", lambda: ())
    assert isinstance(replay.replay_new_hand(hands, cert), replay.ReplayFailure)


def test_refusal_of_bad_certificate_and_non_json_containers(data):
    cert, scalars, hands = data
    for bad in (None, {}, replace(cert, NumericSha256="0" * 64)):
        failure = replay.replay_scalar_and_new_hand(scalars, hands, bad)
        assert isinstance(failure, replay.ReplayFailure)
        assert failure.Path == "Certificate"
        assert failure.Completed.ScalarRows == failure.Completed.NewHandEpisodes == 0
    for container in (None, {}, True, tuple(scalars), {"Scalars": scalars}):
        assert isinstance(replay.replay_scalars(container, cert), replay.ReplayFailure)
    assert isinstance(replay.replay_new_hand(tuple(hands), cert), replay.ReplayFailure)
