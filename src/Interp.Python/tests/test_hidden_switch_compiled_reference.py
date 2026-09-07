"""Executable hand, scalar and refusal witnesses; no registered RNG/cost runs."""

import struct
from dataclasses import asdict, replace
from fractions import Fraction as F

import pytest
from zeta_interp import hidden_switch_compiled_certificate as c
from zeta_interp import hidden_switch_compiled_ieee as s
from zeta_interp import hidden_switch_compiled_reference as r
from zeta_interp import hidden_switch_reference as old

BINDINGS = {"ProtocolSha256": c.PROTOCOL_SHA256, "hand/source.py": "A" * 64}


def value[T](result: s.Result[T]) -> T:
    assert isinstance(result, s.Success), result
    return result.value


def bit(number: float) -> int:
    return int.from_bytes(struct.pack(">d", number), "big")


@pytest.fixture(scope="module")
def cert():
    raw = value(c.build_certificate(BINDINGS))
    return value(c.verify_certificate(raw, BINDINGS))


def test_all_222_scalar_positions_and_exact_error_certificate(cert):
    rows = value(r.scalar_roster(cert))
    assert len(rows) == 222
    assert [row["Index"] for row in rows] == list(range(222))
    assert [row["BeliefBits"] for row in rows[:12:6]] == [
        "8000000000000000",
        "0000000000000000",
    ]
    assert [(row["Effect"], row["Depth"]) for row in rows[:6]] == [
        (effect, depth) for effect in (True, False) for depth in (1, 2, 3)
    ]
    # Duplicate numerical values remain separate indexed roster positions.
    assert (
        len(
            {
                value(s.exact_fraction(value(s.parse_bits(row["BeliefBits"]))))
                for row in rows
            }
        )
        < 37
    )
    for row in rows:
        belief = value(s.parse_bits(row["BeliefBits"]))
        effect, depth = row["Effect"], row["Depth"]
        native = value(r.native_choice(belief, effect, depth))
        compiled = value(r.compiled_choice(cert, belief, effect, depth))
        evaluation = value(r.evaluate_bits(belief, effect, depth))
        exact = value(c.oracle_q(value(s.exact_fraction(belief)), effect, depth))
        error = F({1: 0, 2: 266, 3: 1592}[depth], 1 << 48)
        assert all(
            abs(value(s.exact_fraction(q)) - intended) <= error
            for q, intended in zip(evaluation.QBits, exact)
        )
        assert native.Action == compiled.Action
        assert native.RecursiveCalls == 1 and native.Path == 0
        assert native.Action == value(r.select_bits(evaluation.QBits))
        expected_counts = {1: (1, 2, 0, 0), 2: (5, 10, 2, 4), 3: (21, 42, 10, 20)}[
            depth
        ]
        assert tuple(asdict(evaluation.Counters).values()) == expected_counts
        assert (
            len(value(r.encode_choice(native)))
            == len(value(r.encode_choice(compiled)))
            == 28
        )


def test_exact_selector_epsilon_and_actual_child_numerical_maximum(monkeypatch):
    assert value(r.select_bits((0, r.EPSILON))) == 0
    assert value(r.select_bits((0, r.EPSILON + 1))) == 1
    epsilon = value(s.exact_fraction(r.EPSILON))
    child_prior = F(1, 5) - epsilon / 5
    child_bits = value(s.round_fraction(child_prior))
    child = value(r.evaluate_bits(child_bits, True, 2))
    assert value(r.select_bits(child.QBits)) == 0
    assert value(s.exact_fraction(child.QBits[1])) > value(
        s.exact_fraction(child.QBits[0])
    )
    assert r._maximum(*child.QBits) == child.QBits[1]
    predicted = 3 * child_prior / (1 + 2 * child_prior)
    root = value(s.round_fraction((predicted - F(1, 8)) / F(3, 4)))
    correct = value(r.evaluate_bits(root, True, 3))
    monkeypatch.setattr(
        r, "_maximum", lambda left, right: (left, right)[r._select((left, right))]
    )
    tolerance_propagated = value(r.evaluate_bits(root, True, 3))
    assert correct.QBits != tolerance_propagated.QBits


def test_actual_fallback_calls_and_mutant_discriminator(cert, monkeypatch):
    guard = cert.Guards[0]
    belief = guard.SmaxBits + (guard.HminBits - guard.SmaxBits) // 2
    native = value(r.native_choice(belief, True, 2))
    real_evaluate = r._evaluate
    calls = []

    def traced(belief, effect, depth):
        calls.append((belief, effect, depth))
        return real_evaluate(belief, effect, depth)

    monkeypatch.setattr(r, "_evaluate", traced)
    fallback = value(r.compiled_choice(cert, belief, True, 2))
    assert calls == [(belief, True, 2)]
    assert fallback.Path == 4 and fallback.GuardComparisons == 2
    assert fallback.RecursiveCalls == 1 and fallback.Nodes == native.Nodes
    assert fallback.Action == native.Action
    for boundary, path in ((guard.SmaxBits, 1), (guard.HminBits, 2)):
        before = len(calls)
        assert value(r.compiled_choice(cert, boundary, True, 2)).Path == path
        assert len(calls) == before
    # A deliberately wrong real fallback replacement is detected by the same
    # independent action/work comparison, not by trusting its reported pass flag.
    wrong_q = (s.ONE, 0) if native.Action else (0, s.ONE)
    monkeypatch.setattr(
        r, "_evaluate", lambda *args: r.Evaluation(wrong_q, r.TreeCounters())
    )
    mutant = value(r.compiled_choice(cert, belief, True, 2))
    assert mutant.Action != native.Action and mutant.Nodes != native.Nodes


def test_unsupported_runtime_conformance_really_recurses_on_trivial_inputs(cert):
    for effect, depth in ((False, 3), (True, 1)):
        choice = value(
            r.compiled_choice(cert, 0, effect, depth, unsupported_runtime=True)
        )
        native = value(r.native_choice(0, effect, depth))
        assert choice.Path == 4 and choice.GuardComparisons == 0
        assert choice.RecursiveCalls == 1 and choice.Nodes == native.Nodes
        assert choice.Action == native.Action


def test_prediction_conditioning_manual_fractions_and_signed_zero():
    for belief in (0, s.SIGN, s.HALF, s.ONE):
        for action in (0, 1):
            for effect in (False, True):
                exact_b = value(s.exact_fraction(belief))
                after = 1 - exact_b if effect and action else exact_b
                assert value(r.predict_bits(belief, action, effect)) == value(
                    s.round_fraction(F(1, 8) + F(3, 4) * after)
                )
    for cue, exact in ((0, F(1, 4)), (1, F(3, 4))):
        mass, posterior = value(r.condition_bits(s.HALF, cue))
        assert mass == s.HALF and posterior == value(s.round_fraction(exact))
    assert value(r.condition_bits(s.SIGN, 0))[1] == s.SIGN


def test_choice_wire_is_byte_byte_reserved_zero_then_six_uint32():
    choice = r.Choice(1, 4, 2, 1, 21, 42, 10, 20)
    expected = b"\x01\x04\x00\x00" + b"".join(
        n.to_bytes(4, "little") for n in (2, 1, 21, 42, 10, 20)
    )
    assert value(r.encode_choice(choice)) == expected
    for bad in (
        replace(choice, Action=True),
        replace(choice, Path=5),
        replace(choice, Nodes=-1),
        replace(choice, Updates=1 << 32),
    ):
        assert isinstance(r.encode_choice(bad), s.Failure)


@pytest.mark.parametrize("effect", [True, False])
@pytest.mark.parametrize(
    ("geometry", "palette"),
    [("dot", "fixed"), ("bar", "fixed"), ("dot", "odd-complement")],
)
@pytest.mark.parametrize("tape_index", range(4))
def test_all_48_new_hand_episodes_against_24_unchanged_old_controls(
    cert, effect, geometry, palette, tape_index
):
    name, tape = r.hand_tapes()[tape_index]
    old_name, old_tape = old.hand_tapes()[tape_index]
    assert name == old_name
    control = old.run_episode(
        "belief-depth3", effect, geometry, palette, old_tape, index=tape_index
    )
    new = [
        value(
            r.run_episode(
                strategy, effect, geometry, palette, tape, tape_index, certificate=cert
            )
        )
        for strategy in r.STRATEGIES
    ]
    common = (
        "Index",
        "Complete",
        "Failure",
        "Cues",
        "Actions",
        "States",
        "Reward4",
        "FilterCounters",
        "FrameSha256",
        "ProjectionSha256",
        "TotalReward4",
    )
    for field in common:
        assert new[0][field] == new[1][field] == control[field]
    assert (
        new[0]["BeliefBits"]
        == new[1]["BeliefBits"]
        == [f"{bit(x):016X}" for x in control["Beliefs"]]
    )
    assert new[0]["FilterCounters"] == {"Predictions": 16, "Updates": 17}
    assert len(new[0]["ChoiceWork"]) == 16 and "DecisionQ" not in new[0]
    assert sum(w["Nodes"] for w in new[0]["ChoiceWork"]) == 300
    assert (
        all(w["RecursiveCalls"] == 0 for w in new[1]["ChoiceWork"])
        if not effect
        else True
    )


def test_source_generator_hand_domain_matches_old_source_without_registered_calls():
    # One bounded nonregistered seed/domain, solely a mixer/timing-order fixture.
    tapes = value(r.source_tapes(1, 11, 2))
    expected = old.source_tapes(1, 11, 2)
    assert [(t.initial, t.drift, t.errors) for t in tapes] == [
        (t.initial, t.drift, t.errors) for t in expected
    ]
    for seed, domain, count in ((True, 11, 2), (1, -1, 2), (1, 11, 0), (1, 11, 1025)):
        assert isinstance(r.source_tapes(seed, domain, count), s.Failure)


def test_policy_boundary_copy_isolation_and_no_source_capabilities(cert):
    policy = value(r.create_policy(r.STRATEGIES[1], True, "dot", cert))
    assert isinstance(r.choose(policy), s.Failure)
    initial = value(r.render(0, "dot", "fixed", 0))
    pixels = bytearray(value(r.project(initial)).Cells)
    observed = value(r.observe(policy, r.Frame(pixels)))
    pixels[:] = bytes([1]) * 2048
    assert isinstance(r.observe(observed, value(r.project(initial))), s.Failure)
    choice, pending = value(r.choose(observed))
    assert choice.Action in (0, 1)
    assert isinstance(r.choose(pending), s.Failure)
    assert observed._belief == r.QUARTER
    assert set(r.Policy.__slots__) == {
        "_strategy",
        "_effect",
        "_geometry",
        "_belief",
        "_seen",
        "_pending",
        "_predictions",
        "_updates",
        "_guards",
        "__weakref__",
    }
    assert not hasattr(observed, "__dict__")
    assert not any(
        isinstance(getattr(observed, field), c.VerifiedCertificate)
        for field in r.Policy.__slots__
        if field != "__weakref__"
    )


def test_suffix_private_band_and_scorer_interventions_are_evaluator_only(cert):
    tape = r.hand_tapes()[0][1]
    baseline = value(
        r.run_episode(r.STRATEGIES[1], True, "dot", "fixed", tape, certificate=cert)
    )
    drift = list(tape.drift)
    drift[8] ^= 1
    changed = replace(tape, drift=tuple(drift))
    suffix = value(
        r.run_episode(r.STRATEGIES[1], True, "dot", "fixed", changed, certificate=cert)
    )
    assert baseline["Actions"][:9] == suffix["Actions"][:9]
    assert baseline["BeliefBits"][:9] == suffix["BeliefBits"][:9]
    assert baseline["States"][9] != suffix["States"][9]
    band = value(
        r.run_episode(
            r.STRATEGIES[1],
            True,
            "dot",
            "fixed",
            tape,
            certificate=cert,
            private_band=bytes([1]) * 512,
        )
    )
    scorer = value(
        r.run_episode(
            r.STRATEGIES[1],
            True,
            "dot",
            "fixed",
            tape,
            certificate=cert,
            scorer_override=-1,
        )
    )
    for field in (
        "Actions",
        "States",
        "Cues",
        "BeliefBits",
        "ChoiceWork",
        "ProjectionSha256",
    ):
        assert baseline[field] == band[field] == scorer[field]
    assert baseline["FrameSha256"] != band["FrameSha256"]
    assert baseline["Reward4"] != scorer["Reward4"]


def test_malformed_frames_and_public_scalar_inputs_refuse(cert):
    for frame in (
        None,
        r.Frame(bytes(2047)),
        r.Frame(bytes([2]) * 2048),
        r.Frame(bytes(2048), Width=True),
        r.Frame(bytes([0, 1]) * 1024),
    ):
        assert isinstance(r.project(frame), s.Failure)
    for belief in (True, -1, 1 << 64, s.SIGN | 1, s.ONE + 1, 0x7FF0000000000000):
        assert isinstance(r.native_choice(belief, True, 3), s.Failure)
        assert isinstance(r.compiled_choice(cert, belief, True, 3), s.Failure)
    for effect, depth in ((1, 3), (True, True), (True, 0), (False, 4)):
        assert isinstance(r.native_choice(0, effect, depth), s.Failure)
    assert isinstance(r.compiled_choice({}, 0, True, 3), s.Failure)
    assert isinstance(
        r.compiled_choice(cert, 0, True, 3, unsupported_runtime=1), s.Failure
    )
    assert isinstance(r.make_tape(0, (), ()), s.Failure)
    for field, bad in (
        ("index", 1024),
        ("private_band", bytes([2]) * 512),
        ("scorer_override", True),
    ):
        kwargs = {
            "index": 0,
            "certificate": cert,
            "private_band": None,
            "scorer_override": None,
        }
        kwargs[field] = bad
        assert isinstance(
            r.run_episode(
                r.STRATEGIES[0], True, "dot", "fixed", r.hand_tapes()[0][1], **kwargs
            ),
            s.Failure,
        )
    assert isinstance(r.select_bits({}), s.Failure)
    assert isinstance(r.select_bits([True, 0]), s.Failure)


def test_counters_match_instrumented_executed_boundaries(monkeypatch):
    calls = {"predict": 0, "condition": 0}
    actual_predict, actual_condition = r._predict, r._condition

    def prediction(*args):
        calls["predict"] += 1
        return actual_predict(*args)

    def conditioning(*args):
        calls["condition"] += 1
        return actual_condition(*args)

    monkeypatch.setattr(r, "_predict", prediction)
    monkeypatch.setattr(r, "_condition", conditioning)
    choice = value(r.native_choice(s.HALF, True, 3))
    assert calls["predict"] == choice.Predictions == 10
    assert calls["condition"] == choice.Updates == 20
    assert choice.Nodes == 1 + calls["condition"]
