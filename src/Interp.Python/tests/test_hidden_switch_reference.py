"""Hand-only causal and independent exact-oracle checks for hidden switch.

Never generate either registered behavioral or cost seed in this file.
The complete hand roster is deterministic and source-stream independent.
"""

import copy
import hashlib
from dataclasses import FrozenInstanceError
from fractions import Fraction as F
from itertools import product

import pytest

from zeta_interp import hidden_switch_reference as ref

RENDERINGS = (("dot", "fixed"), ("bar", "fixed"), ("dot", "odd-complement"))


def test_exhaustive_transition_and_reward_tables_discriminate_timing():
    inputs = tuple(product((0, 1), repeat=3))
    assert [ref.transition(x, a, d, True) for x, a, d in inputs] == [
        0,
        1,
        1,
        0,
        1,
        0,
        0,
        1,
    ]
    assert [ref.transition(x, a, d, False) for x, a, d in inputs] == [
        0,
        1,
        0,
        1,
        1,
        0,
        1,
        0,
    ]
    assert [ref.reward_quarters(x, a) for x, a, _ in inputs] == [
        0,
        0,
        -1,
        -1,
        4,
        4,
        -1,
        -1,
    ]
    assert [ref.cue(x, e) for x, e in product((0, 1), repeat=2)] == [0, 1, 1, 0]
    # Harvest scores the state before drift, not the next state.
    assert ref.reward_quarters(1, 0) == 4
    assert ref.reward_quarters(ref.transition(1, 0, 1, True), 0) == 0


def test_registered_constants_and_hand_tapes_are_complete_and_immutable():
    assert ref.ARMS == (
        "belief-depth3",
        "belief-myopic",
        "belief-myopic-padded",
        "latest-cue-depth3",
    )
    assert [row["Name"] for row in ref.PANELS] == [
        "dot-switch",
        "bar-switch",
        "palette-switch",
        "dot-null",
    ]
    tapes = dict(ref.hand_tapes())
    assert tuple(tapes) == ("zero", "one", "alternating", "sparse")
    assert tapes["sparse"].drift == (1,) + (0,) * 6 + (1,) + (0,) * 7 + (1,)
    assert tapes["sparse"].errors == tuple(int(j in (0, 2, 8, 16)) for j in range(17))
    drift, errors = [0] * 16, [0] * 17
    tape = ref.Tape(0, drift, errors)
    drift[0], errors[0] = 1, 1
    assert tape.drift[0] == tape.errors[0] == 0
    with pytest.raises(FrozenInstanceError):
        tape.initial = 1


@pytest.mark.parametrize("geometry,palette", RENDERINGS)
@pytest.mark.parametrize("symbol,reward", tuple(product((0, 1), (-1, 0, 4))))
def test_renderer_exact_pixels_and_projection(geometry, palette, symbol, reward):
    frame = ref.render(symbol, geometry, palette, 1, reward)
    expected = bytearray(2048)
    center = 16 if symbol == 0 else 48
    positions = (
        [8 * 64 + center]
        if geometry == "dot"
        else [20 * 64 + center, 20 * 64 + center + 1, 20 * 64 + center + 2]
    )
    for position in positions + [26 * 64 + {-1: 20, 0: 4, 4: 12}[reward]]:
        expected[position] = 1
    if palette == "odd-complement":
        expected = bytearray(1 - value for value in expected)
    assert frame.cells == bytes(expected)
    projected = ref.project(frame)
    assert ref.decode(projected, geometry) == symbol
    assert projected.cells[1536:] == bytes((int(palette == "odd-complement"),)) * 512
    assert ref.render(symbol, geometry, palette, 0).cells[1536:] == bytes(512)


@pytest.mark.parametrize("effect", (False, True))
def test_rational_filter_and_contingent_tree_oracle(effect):
    for depth, count, counters in (
        (1, 2, {"Nodes": 1, "ActionValues": 2, "Predictions": 0, "Updates": 0}),
        (2, 8, {"Nodes": 5, "ActionValues": 10, "Predictions": 2, "Updates": 4}),
        (3, 128, {"Nodes": 21, "ActionValues": 42, "Predictions": 10, "Updates": 20}),
    ):
        trees = ref.alpha_vectors(depth, effect)
        assert len(trees) == count
        assert sum(tree.action == 0 for tree in trees) == count // 2
        for prior in map(F, (0, F(1, 4), F(1, 2), F(3, 4), 1)):
            actual, executed = ref.plan(float(prior), depth, effect)
            assert executed == counters
            assert actual == pytest.approx(
                tuple(map(float, ref.oracle_q(prior, effect, depth))), abs=1e-10, rel=0
            )
            for action, observation in product((0, 1), repeat=2):
                numerical = ref.condition(
                    ref.predict(float(prior), action, effect), observation
                )
                assert numerical == pytest.approx(
                    float(ref.exact_after(prior, action, observation, effect)),
                    abs=1e-10,
                    rel=0,
                )
    assert ref.exact_condition(F(1, 2), 0) == F(1, 4)
    assert ref.exact_condition(F(1, 2), 1) == F(3, 4)
    assert ref.exact_after(F(0), 0, 1, effect) == F(3, 10)


def test_exact_oracle_never_calls_numerical_filter_planner_or_simulator(monkeypatch):
    def denied(*_args, **_kwargs):
        raise AssertionError("shared numerical or simulator path")

    for name in (
        "condition",
        "predict",
        "plan",
        "transition",
        "cue",
        "reward_quarters",
    ):
        monkeypatch.setattr(ref, name, denied)
    assert ref.oracle_q(F(0), True, 2, q=F(0)) == (F(0), F(3, 4))
    assert ref.exact_after(F(0), 1, 1, True) == F(21, 22)


def test_noiseless_opportunity_null_dominance_and_tie_rule():
    assert ref.plan(0.0, 2, True, q=0)[0] == (0.0, 0.75)
    for prior, depth in product((0.0, 0.25, 0.5, 0.75, 1.0), (1, 2, 3)):
        values, _ = ref.plan(prior, depth, False)
        assert values[0] > values[1]
        assert ref.select(values) == 0
        assert ref.select(ref.plan(prior, 1, True)[0]) == 0
    assert ref.select((0.0, 1e-12)) == 0
    assert ref.select((0.0, 1.01e-12)) == 1
    assert ref.select((1e-12, 0.0)) == 0
    # This tolerance is for selection; recursive values must use max(Q).
    assert max((0.0, 1e-12)) == 1e-12


@pytest.fixture(scope="module")
def hands():
    return {
        (name, effect, geometry, palette, arm): ref.run_episode(
            arm, effect, geometry, palette, tape
        )
        for (name, tape), effect, (geometry, palette), arm in product(
            ref.hand_tapes(), (False, True), RENDERINGS, ref.ARMS
        )
    }


def test_all_96_hand_episodes_have_complete_causal_rosters(hands):
    assert len(hands) == 96
    for key, episode in hands.items():
        _, effect, geometry, palette, arm = key
        assert episode["Complete"] is True and episode["Failure"] is None
        assert (
            len(episode["Cues"])
            == len(episode["States"])
            == len(episode["Beliefs"])
            == 17
        )
        assert len(episode["Actions"]) == len(episode["Reward4"]) == 16
        assert all(
            len(episode[field]) == 16
            for field in ("DecisionQ", "TreeRootQ", "PlanningCounters")
        )
        assert all(
            len(episode[field]) == 17 for field in ("FrameSha256", "ProjectionSha256")
        )
        assert episode["TotalReward4"] == sum(episode["Reward4"])
        assert episode["FilterCounters"] == {
            "Predictions": 0 if arm == "latest-cue-depth3" else 16,
            "Updates": 17,
        }
        assert episode["Actions"][-1] == "0"
        totals = {
            field: sum(row[field] for row in episode["PlanningCounters"])
            for field in ("Nodes", "ActionValues", "Predictions", "Updates")
        }
        assert totals == (
            {"Nodes": 16, "ActionValues": 32, "Predictions": 0, "Updates": 0}
            if arm == "belief-myopic"
            else {"Nodes": 300, "ActionValues": 600, "Predictions": 142, "Updates": 284}
        )
        if not effect:
            assert episode["Actions"] == "0" * 16
        for index, symbol in enumerate(episode["Cues"]):
            reward = None if index == 0 else episode["Reward4"][index - 1]
            frame = ref.render(int(symbol), geometry, palette, index, reward)
            assert (
                episode["FrameSha256"][index]
                == hashlib.sha256(frame.cells).hexdigest().upper()
            )


def test_natural_padded_control_and_rendering_metamorphisms(hands):
    semantic_fields = (
        "Cues",
        "Actions",
        "States",
        "Reward4",
        "Beliefs",
        "DecisionQ",
        "TreeRootQ",
        "PlanningCounters",
        "FilterCounters",
        "TotalReward4",
    )
    for name, effect in product(dict(ref.hand_tapes()), (False, True)):
        for arm in ref.ARMS:
            base = hands[name, effect, "dot", "fixed", arm]
            for geometry, palette in RENDERINGS[1:]:
                variant = hands[name, effect, geometry, palette, arm]
                assert all(base[field] == variant[field] for field in semantic_fields)
        natural = hands[name, effect, "dot", "fixed", "belief-myopic"]
        padded = hands[name, effect, "dot", "fixed", "belief-myopic-padded"]
        assert all(
            natural[field] == padded[field]
            for field in (
                "Actions",
                "Reward4",
                "Beliefs",
                "DecisionQ",
                "FrameSha256",
                "TotalReward4",
            )
        )
        assert natural["TreeRootQ"] != padded["TreeRootQ"]


@pytest.mark.parametrize("arm", ref.ARMS)
def test_real_runner_unrevealed_suffix_noninterference(arm):
    original = dict(ref.hand_tapes())["sparse"]
    cut = 8
    changed = ref.Tape(
        original.initial,
        original.drift[:cut] + tuple(1 - bit for bit in original.drift[cut:]),
        original.errors[: cut + 1]
        + tuple(1 - bit for bit in original.errors[cut + 1 :]),
    )
    first = ref.run_episode(arm, True, "dot", "fixed", original)
    second = ref.run_episode(arm, True, "dot", "fixed", changed)
    for field in (
        "Cues",
        "Beliefs",
        "Actions",
        "DecisionQ",
        "TreeRootQ",
        "PlanningCounters",
    ):
        assert first[field][: cut + 1] == second[field][: cut + 1]
    assert first["States"] != second["States"]


@pytest.mark.parametrize("arm", ref.ARMS)
def test_real_runner_private_pixels_and_scorer_do_not_enter_policy(arm, monkeypatch):
    tape = dict(ref.hand_tapes())["sparse"]
    base = ref.run_episode(arm, True, "bar", "odd-complement", tape)
    render = ref.render

    def changed_render(*args, **kwargs):
        frame = render(*args, **kwargs)
        return ref.Frame(frame.cells[:1536] + bytes(index % 2 for index in range(512)))

    monkeypatch.setattr(ref, "render", changed_render)
    monkeypatch.setattr(ref, "reward_quarters", lambda state, action: 0)
    changed = ref.run_episode(arm, True, "bar", "odd-complement", tape)
    assert base["Reward4"] != changed["Reward4"]
    assert base["FrameSha256"] != changed["FrameSha256"]
    for field in ("Actions", "Beliefs", "DecisionQ", "TreeRootQ", "ProjectionSha256"):
        assert base[field] == changed[field]


def test_policy_observe_choose_boundaries_and_copied_inputs():
    policy = ref.Policy("belief-depth3", True, "dot")
    with pytest.raises(ValueError, match="decision boundary"):
        policy.choose()
    caller = bytearray(ref.project(ref.render(0, "dot", "fixed", 0)).cells)
    frame = ref.Frame(caller)
    policy.observe(frame)
    saved = policy.fork()
    caller[8 * 64 + 16] = 0
    caller[8 * 64 + 48] = 1
    assert policy.belief == saved.belief == 0.25
    with pytest.raises(ValueError, match="observation boundary"):
        policy.observe(frame)
    for _ in range(16):
        assert policy.choose() == saved.choose()
        with pytest.raises(ValueError, match="decision boundary"):
            policy.choose()
        policy.observe(frame)
        saved.observe(frame)
    with pytest.raises(ValueError, match="decision boundary"):
        policy.choose()
    with pytest.raises(ValueError, match="observation boundary"):
        policy.observe(frame)


@pytest.mark.parametrize(
    "mutation",
    (
        "extra",
        "wrong-geometry",
        "cross-position",
        "private",
        "dimension",
        "nonbinary",
        "tie",
    ),
)
def test_malformed_frames_cannot_be_decoded(mutation):
    original = ref.project(ref.render(0, "dot", "fixed", 0))
    cells = bytearray(original.cells)
    geometry = "dot"
    if mutation == "extra":
        cells[0] = 1
    elif mutation == "wrong-geometry":
        geometry = "bar"
    elif mutation == "cross-position":
        cells[8 * 64 + 48] = 1
    elif mutation == "private":
        cells[1600] = 1
    elif mutation == "dimension":
        with pytest.raises(ValueError):
            ref.decode(ref.Frame(bytes(cells), width=True), geometry)
        return
    elif mutation == "nonbinary":
        cells[1600] = 2
    else:
        cells[:1536] = bytes([0, 1]) * 768
    with pytest.raises(ValueError):
        ref.decode(ref.Frame(bytes(cells)), geometry)


@pytest.mark.parametrize("bad", (True, -1, 2, 0.5, None, "0"))
def test_malformed_action_bit_and_observation_refuse(bad):
    for call in (
        lambda: ref.transition(0, bad, 0, True),
        lambda: ref.cue(0, bad),
        lambda: ref.reward_quarters(0, bad),
        lambda: ref.condition(0.5, bad),
        lambda: ref.predict(0.5, bad, True),
    ):
        with pytest.raises(ValueError):
            call()


@pytest.mark.parametrize(
    "bad", (True, -0.1, 1.1, float("nan"), float("inf"), "0.5", None)
)
def test_nonfinite_or_malformed_belief_refuses_without_repair(bad):
    for call in (
        lambda: ref.condition(bad, 0),
        lambda: ref.predict(bad, 0, True),
        lambda: ref.plan(bad, 3, True),
    ):
        with pytest.raises(ValueError):
            call()


def test_impossible_conditioning_bad_depth_and_episode_configuration_refuse():
    with pytest.raises(ValueError, match="impossible"):
        ref.condition(0.0, 1, p=1.0)
    with pytest.raises(ValueError, match="impossible"):
        ref.exact_condition(F(0), 1, p=F(1))
    for bad in (0, 4, True, 1.5):
        with pytest.raises(ValueError):
            ref.plan(0.5, bad, True)
    arguments = {
        "arm": ref.ARMS[0],
        "effect": True,
        "geometry": "dot",
        "palette": "fixed",
        "tape": ref.hand_tapes()[0][1],
        "index": 0,
    }
    for key, value in (
        ("arm", "invented"),
        ("effect", 1),
        ("geometry", "unknown"),
        ("palette", "unknown"),
        ("tape", None),
        ("index", True),
    ):
        changed = dict(arguments, **{key: value})
        with pytest.raises(ValueError):
            ref.run_episode(**changed)
    with pytest.raises(ValueError):
        ref.Tape(0, [False] * 16, [0] * 17)
    with pytest.raises(ValueError):
        ref.Tape(0, [0] * 15, [0] * 17)


def test_source_accounting_uses_only_unregistered_seed_and_rejects_bad_configuration():
    # No native source import and no registered 9101/9203 invocation.
    stream = ref.Stream(ref.domain(17, 29))
    expected = []
    for _ in range(2):
        initial = int(2 * stream.next())
        errors = [int(stream.next() >= 0.75)]
        drifts = []
        for _ in range(16):
            drifts.append(int(stream.next() < 0.125))
            errors.append(int(stream.next() >= 0.75))
        expected.append(ref.Tape(initial, drifts, errors))
    assert stream.draws == 68
    assert ref.source_tapes(17, 29, 2) == expected
    assert ref.source_tapes(17, 29, 1) == expected[:1]
    for seed, domain, count in (
        (True, 29, 1),
        (17, False, 1),
        (17, 29, True),
        (17, 29, 0),
        (-1, 29, 1),
        (17, 29, 1025),
    ):
        with pytest.raises(ValueError):
            ref.source_tapes(seed, domain, count)


def test_episode_index_admits_roster_edge_and_refuses_out_of_bounds():
    tape = ref.hand_tapes()[0][1]
    edge = ref.run_episode(ref.ARMS[0], True, "dot", "fixed", tape, index=1023)
    assert edge["Index"] == 1023 and edge["Complete"] is True
    for index in (-1, 1024, 2**31 - 1):
        with pytest.raises(ValueError, match="episode index"):
            ref.run_episode(ref.ARMS[0], True, "dot", "fixed", tape, index=index)


def test_mixer_matches_preexisting_cross_language_golden_vectors():
    # Literal roster from src/Core.TypeScript/splitmix64/golden-vectors.json
    # at registration 6a3150037. No experiment stream is instantiated here.
    vectors = (
        (0, 0),
        (1, 16294208416658607535),
        (2, 7960286522194355700),
        (10, 17561866513979060390),
        (255, 80788758552623550),
        (18446744073709551615, 3703370420611038912),
        (11400714819323198485, 5878998237028904013),
        (9223372036854775808, 2720858781877447050),
        (12345678901234567890, 284664278009360702),
        (1000000000000000000, 11308661470685490763),
    )
    assert [(value, ref.mix(value)) for value, _ in vectors] == list(vectors)


def test_oversized_integers_refuse_through_the_documented_value_boundary():
    for call in (lambda: ref.condition(10**500, 0), lambda: ref.select((10**500, 0.0))):
        with pytest.raises(ValueError):
            call()


def test_returned_trace_mutation_does_not_change_another_episode(hands):
    original = hands["zero", True, "dot", "fixed", "belief-depth3"]
    changed = copy.deepcopy(original)
    changed["PlanningCounters"][0]["Nodes"] = 0
    replay = ref.run_episode(
        "belief-depth3", True, "dot", "fixed", ref.hand_tapes()[0][1]
    )
    assert replay == original and changed != original


def test_callable_falsifiers_execute_complete_named_roster():
    flags = ref.verify_falsifiers()
    assert tuple(flags) == (
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
    assert all(type(value) is bool and value for value in flags.values())


def test_callable_falsifiers_detect_ignored_action_and_fabricated_counters(monkeypatch):
    transition = ref.transition
    episode = ref.run_episode

    def ignored_action(state, action, drift, effect):
        return transition(state, action, drift, False)

    def altered_counter(*args, **kwargs):
        result = episode(*args, **kwargs)
        result["PlanningCounters"][0]["Nodes"] += 1
        return result

    monkeypatch.setattr(ref, "transition", ignored_action)
    monkeypatch.setattr(ref, "run_episode", altered_counter)
    flags = ref.verify_falsifiers()
    assert flags["action-effect"] is False
    assert flags["counter-accounting"] is False


@pytest.mark.parametrize(
    "override",
    (
        {"private_band": bytes(511)},
        {"private_band": bytes([2]) * 512},
        {"private_band": bytearray(512)},
        {"scorer_override": True},
        {"scorer_override": 1},
    ),
)
def test_evaluator_only_interventions_validate_their_full_domain(override):
    with pytest.raises(ValueError):
        ref.run_episode(
            ref.ARMS[0], True, "dot", "fixed", ref.hand_tapes()[0][1], **override
        )
