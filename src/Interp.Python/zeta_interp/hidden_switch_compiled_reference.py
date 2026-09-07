"""Independent software-binary64 controller, source and rendered episode audit.

No native implementation, host float arithmetic, saved receipt, filesystem or
runtime collector is imported. Public functions return Success.value or
Failure.Code/Message. Policy state contains only supplied numeric model/guard
constants, admitted observations and its own committed action chronology.
The ordinary source generator is callable only after implementation archival;
its presence or hand tests do not authorize registered seed/domain calls.
"""

from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass, replace
from fractions import Fraction as F
from typing import cast
from weakref import WeakSet

from . import hidden_switch_compiled_certificate as c
from . import hidden_switch_compiled_ieee as s

STRATEGIES = ("native-recursive", "compiled-guarded")
HORIZON = 16
QUARTER = 0x3FD0000000000000
THREE_QUARTERS = 0x3FE8000000000000
EIGHTH = 0x3FC0000000000000
SWITCH_REWARD = s.SIGN | QUARTER
EPSILON = s._round(F(1, 10**12))
GOLDEN = 0x9E3779B97F4A7C15


@dataclass(frozen=True, slots=True)
class TreeCounters:
    Nodes: int = 0
    ActionValues: int = 0
    Predictions: int = 0
    Updates: int = 0


@dataclass(frozen=True, slots=True)
class Evaluation:
    QBits: tuple[int, int]
    Counters: TreeCounters


@dataclass(frozen=True, slots=True)
class Choice:
    Action: int
    Path: int
    GuardComparisons: int
    RecursiveCalls: int
    Nodes: int
    ActionValues: int
    Predictions: int
    Updates: int


@dataclass(frozen=True, slots=True)
class Tape:
    initial: int
    drift: tuple[int, ...]
    errors: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class Frame:
    Cells: bytes | bytearray
    Width: int = 64
    Height: int = 32
    Palette: int = 2


@dataclass(frozen=True, slots=True, eq=False, weakref_slot=True)
class Policy:
    _strategy: str
    _effect: bool
    _geometry: str
    _belief: int
    _seen: int
    _pending: int | None
    _predictions: int
    _updates: int
    _guards: tuple[c.Guard, c.Guard]


_POLICIES: WeakSet[Policy] = WeakSet()


def _integer(value: object, lower: int, upper: int, label: str) -> int:
    if type(value) is not int or not lower <= value <= upper:
        raise s._Refusal("InvalidInput", label)
    return value


def _belief(value: object) -> int:
    bits = s._finite(value)
    if not 0 <= s._value(bits) <= 1:
        raise s._Refusal("InvalidBelief", "belief must be in [0,1]")
    return bits


def _effect(value: object) -> bool:
    if type(value) is not bool:
        raise s._Refusal("InvalidEffect", "effect must be boolean")
    return value


def _member(value: object, allowed: tuple[str, ...], label: str) -> str:
    if type(value) is not str or value not in allowed:
        raise s._Refusal("InvalidInput", label)
    return value


def _predict(belief: int, action: int, effect: bool) -> int:
    after = s._sub(s.ONE, belief) if effect and action == 1 else belief
    return s._add(EIGHTH, s._mul(THREE_QUARTERS, after))


def predict_bits(belief: object, action: object, effect: object) -> s.Result[int]:
    return s._capture(
        lambda: _predict(
            _belief(belief), _integer(action, 0, 1, "binary action"), _effect(effect)
        )
    )


def _condition(prior: int, cue: int) -> tuple[int, int]:
    one, zero = (THREE_QUARTERS, QUARTER) if cue == 1 else (QUARTER, THREE_QUARTERS)
    mass = s._add(s._mul(one, prior), s._mul(zero, s._sub(s.ONE, prior)))
    if s._value(mass) <= 0:
        raise s._Refusal("ZeroMass", "conditioning requires positive evidence mass")
    posterior = s._div(s._mul(one, prior), mass)
    return mass, _belief(posterior)


def condition_bits(prior: object, cue: object) -> s.Result[tuple[int, int]]:
    """Return (mass bits, posterior bits) in the frozen expression order."""
    return s._capture(
        lambda: _condition(_belief(prior), _integer(cue, 0, 1, "binary cue"))
    )


def _maximum(left: int, right: int) -> int:
    return left if s._value(left) >= s._value(right) else right


def _evaluate(belief: int, effect: bool, depth: int) -> Evaluation:
    nodes = values = predictions = updates = 0

    def visit(current: int, remaining: int) -> tuple[int, int]:
        nonlocal nodes, values, predictions, updates
        nodes += 1
        action_values = []
        for action in (0, 1):
            values += 1
            immediate = current if action == 0 else SWITCH_REWARD
            if remaining == 1:
                action_values.append(immediate)
                continue
            predictions += 1
            prior = _predict(current, action, effect)
            continuations = []
            for cue in (0, 1):
                updates += 1
                probability, posterior = _condition(prior, cue)
                child = visit(posterior, remaining - 1)
                maximum = _maximum(child[0], child[1])
                continuations.append(s._mul(probability, maximum))
            action_values.append(
                s._add(s._add(immediate, continuations[0]), continuations[1])
            )
        return action_values[0], action_values[1]

    q = visit(belief, depth)
    return Evaluation(q, TreeCounters(nodes, values, predictions, updates))


def evaluate_bits(
    belief: object, effect: object, depth: object
) -> s.Result[Evaluation]:
    return s._capture(
        lambda: _evaluate(
            _belief(belief), _effect(effect), _integer(depth, 1, 3, "depth1..3")
        )
    )


def _select(values: tuple[int, int]) -> int:
    return int(s._value(s._sub(values[1], values[0])) > s._value(EPSILON))


def select_bits(values: object) -> s.Result[int]:
    def operation() -> int:
        if type(values) not in (tuple, list):
            raise s._Refusal("InvalidQ", "two finite Q bit patterns required")
        sequence = cast(list[object] | tuple[object, ...], values)
        if len(sequence) != 2:
            raise s._Refusal("InvalidQ", "two finite Q bit patterns required")
        return _select((s._finite(sequence[0]), s._finite(sequence[1])))

    return s._capture(operation)


def _recursive_choice(
    belief: int, effect: bool, depth: int, path: int, comparisons: int
) -> Choice:
    evaluation = _evaluate(belief, effect, depth)
    work = evaluation.Counters
    return Choice(
        _select(evaluation.QBits),
        path,
        comparisons,
        1,
        work.Nodes,
        work.ActionValues,
        work.Predictions,
        work.Updates,
    )


def native_choice(belief: object, effect: object, depth: object) -> s.Result[Choice]:
    return s._capture(
        lambda: _recursive_choice(
            _belief(belief), _effect(effect), _integer(depth, 1, 3, "depth1..3"), 0, 0
        )
    )


def _compiled_choice(
    guards: tuple[c.Guard, c.Guard],
    belief: int,
    effect: bool,
    depth: int,
    unsupported_runtime: bool = False,
) -> Choice:
    if unsupported_runtime:
        # Explicit conformance-only mode. It executes no guard and admits no cost row.
        return _recursive_choice(belief, effect, depth, 4, 0)
    if depth == 1 or not effect:
        return Choice(0, 3, 0, 0, 0, 0, 0, 0)
    guard = guards[depth - 2]
    comparisons = 1
    if s._value(belief) <= s._value(guard.SmaxBits):
        return Choice(1, 1, comparisons, 0, 0, 0, 0, 0)
    comparisons += 1
    if s._value(belief) >= s._value(guard.HminBits):
        return Choice(0, 2, comparisons, 0, 0, 0, 0, 0)
    return _recursive_choice(belief, effect, depth, 4, comparisons)


def compiled_choice(
    certificate: object,
    belief: object,
    effect: object,
    depth: object,
    *,
    unsupported_runtime: object = False,
) -> s.Result[Choice]:
    def operation() -> Choice:
        admitted = c._admitted(certificate)
        if type(unsupported_runtime) is not bool:
            raise s._Refusal(
                "RuntimeMode", "explicit boolean conformance mode required"
            )
        return _compiled_choice(
            admitted.Guards,
            _belief(belief),
            _effect(effect),
            _integer(depth, 1, 3, "depth1..3"),
            unsupported_runtime,
        )

    return s._capture(operation)


def encode_choice(value: object) -> s.Result[bytes]:
    def operation() -> bytes:
        if type(value) is not Choice:
            raise s._Refusal("ChoiceRecord", "typed choice record required")
        action = _integer(value.Action, 0, 1, "binary action")
        path = _integer(value.Path, 0, 4, "registered path")
        counts = (
            value.GuardComparisons,
            value.RecursiveCalls,
            value.Nodes,
            value.ActionValues,
            value.Predictions,
            value.Updates,
        )
        output = bytes((action, path, 0, 0))
        for count in counts:
            output += _integer(count, 0, (1 << 32) - 1, "uint32 work count").to_bytes(
                4, "little"
            )
        return output

    return s._capture(operation)


def scalar_roster(certificate: object) -> s.Result[list[dict[str, c.Json]]]:
    def operation() -> list[dict[str, c.Json]]:
        admitted = c._admitted(certificate)
        beliefs = [s.SIGN, 0, 1, (1 << 52) - 1, 1 << 52, s.ONE - 1, s.ONE]
        epsilon = s._value(admitted.EpsilonBits)
        centers = [
            F(1, 5),
            F(51, 190),
            F(17, 42),
            F(25, 42),
            F(1, 5) - F(2, 5) * epsilon,
            F(51, 190) - F(32, 95) * epsilon,
        ]
        for center in centers:
            middle = s._round(center)
            beliefs.extend(
                (s._neighbor(middle, False), middle, s._neighbor(middle, True))
            )
        for guard in admitted.Guards:
            for middle in (guard.SmaxBits, guard.HminBits):
                beliefs.extend(
                    (s._neighbor(middle, False), middle, s._neighbor(middle, True))
                )
        rows: list[dict[str, c.Json]] = []
        for belief in beliefs:
            for effect in (True, False):
                for depth in (1, 2, 3):
                    rows.append(
                        {
                            "Index": len(rows),
                            "BeliefBits": f"{belief:016X}",
                            "Effect": effect,
                            "Depth": depth,
                        }
                    )
        return rows

    return s._capture(operation)


def _tape(value: object) -> Tape:
    if type(value) is not Tape:
        raise s._Refusal("Tape", "immutable tape required")
    _integer(value.initial, 0, 1, "initial bit")
    for items, length in ((value.drift, 16), (value.errors, 17)):
        if type(items) is not tuple or len(items) != length:
            raise s._Refusal("Tape", "sixteen drift and seventeen error bits required")
        for item in items:
            _integer(item, 0, 1, "binary tape entry")
    return value


def make_tape(initial: object, drift: object, errors: object) -> s.Result[Tape]:
    def operation() -> Tape:
        if type(drift) not in (tuple, list) or type(errors) not in (tuple, list):
            raise s._Refusal("Tape", "tuple/list tape bit collections required")
        return _tape(
            Tape(
                _integer(initial, 0, 1, "initial bit"),
                tuple(
                    _integer(x, 0, 1, "drift bit")
                    for x in cast(list[object] | tuple[object, ...], drift)
                ),
                tuple(
                    _integer(x, 0, 1, "error bit")
                    for x in cast(list[object] | tuple[object, ...], errors)
                ),
            )
        )

    return s._capture(operation)


def hand_tapes() -> tuple[tuple[str, Tape], ...]:
    return (
        ("zero", Tape(0, (0,) * 16, (0,) * 17)),
        ("one", Tape(1, (0,) * 16, (0,) * 17)),
        (
            "alternating",
            Tape(0, tuple(t % 2 for t in range(16)), tuple(t % 2 for t in range(17))),
        ),
        (
            "sparse",
            Tape(
                1,
                tuple(int(t in (0, 7, 15)) for t in range(16)),
                tuple(int(t in (0, 2, 8, 16)) for t in range(17)),
            ),
        ),
    )


def _mix(value: int) -> int:
    result = value * GOLDEN & s.MASK
    result = (result ^ (result >> 30)) * 0xBF58476D1CE4E5B9 & s.MASK
    result = (result ^ (result >> 27)) * 0x94D049BB133111EB & s.MASK
    return result ^ (result >> 31)


def source_tapes(seed: object, domain: object, count: object) -> s.Result[list[Tape]]:
    def operation() -> list[Tape]:
        initial_seed = _integer(seed, 0, s.MASK, "unsigned source seed")
        tag = _integer(domain, 0, s.MASK, "unsigned source domain")
        size = _integer(count, 1, 1024, "source count1..1024")
        state = _mix(initial_seed ^ (tag * GOLDEN & s.MASK))
        draws = 0

        def next53() -> int:
            nonlocal state, draws
            state = (state + GOLDEN) & s.MASK
            draws += 1
            return _mix(state) >> 11

        tapes = []
        for _ in range(size):
            initial = int(next53() >= 1 << 52)
            errors = [int(next53() >= 3 << 51)]
            drift = []
            for _ in range(16):
                drift.append(int(next53() < 1 << 50))
                errors.append(int(next53() >= 3 << 51))
            tapes.append(Tape(initial, tuple(drift), tuple(errors)))
        if draws != 34 * size:
            raise s._Refusal("SourceAccounting", "source draw accounting differs")
        return tapes

    return s._capture(operation)


def _frame(value: object) -> Frame:
    if (
        type(value) is not Frame
        or any(type(x) is not int for x in (value.Width, value.Height, value.Palette))
        or (value.Width, value.Height, value.Palette) != (64, 32, 2)
    ):
        raise s._Refusal("Frame", "64x32 binary frame required")
    if type(value.Cells) not in (bytes, bytearray) or len(value.Cells) != 2048:
        raise s._Refusal("Frame", "2048 copied binary cells required")
    cells = bytes(value.Cells)
    if any(x > 1 for x in cells):
        raise s._Refusal("Frame", "nonbinary cell")
    return Frame(cells)


def _background(frame: Frame) -> int:
    ones = sum(frame.Cells[:1536])
    if ones == 768:
        raise s._Refusal("Frame", "upper background majority tie")
    return int(ones > 768)


def _render(
    symbol: int, geometry: str, palette: str, index: int, reward: int | None
) -> Frame:
    cells = bytearray(2048)
    row = 8 if geometry == "dot" else 20
    for offset in range(1 if geometry == "dot" else 3):
        cells[64 * row + 16 + 32 * symbol + offset] = 1
    if reward is not None:
        cells[64 * 26 + {-1: 20, 0: 4, 4: 12}[reward]] = 1
    if palette == "odd-complement" and index % 2:
        cells = bytearray(x ^ 1 for x in cells)
    return Frame(bytes(cells))


def render(
    symbol: object,
    geometry: object,
    palette: object,
    index: object,
    reward4: object = None,
) -> s.Result[Frame]:
    def operation() -> Frame:
        observation = _integer(index, 0, 16, "observation index0..16")
        if (observation == 0 and reward4 is not None) or (
            observation > 0 and (type(reward4) is not int or reward4 not in (-1, 0, 4))
        ):
            raise s._Refusal(
                "RenderReward", "admitted previous private reward required"
            )
        return _render(
            _integer(symbol, 0, 1, "binary cue"),
            _member(geometry, ("dot", "bar"), "geometry"),
            _member(palette, ("fixed", "odd-complement"), "palette"),
            observation,
            cast(int | None, reward4),
        )

    return s._capture(operation)


def _project(frame: Frame) -> Frame:
    return Frame(bytes(frame.Cells[:1536]) + bytes((_background(frame),)) * 512)


def project(frame: object) -> s.Result[Frame]:
    return s._capture(lambda: _project(_frame(frame)))


def _decode(frame: Frame, geometry: str) -> int:
    background = _background(frame)
    if frame.Cells[1536:] != bytes((background,)) * 512:
        raise s._Refusal("Projection", "private band remains in admitted observation")
    foreground = {i for i, value in enumerate(frame.Cells) if value != background}
    row = 8 if geometry == "dot" else 20
    for cue in (0, 1):
        expected = {
            64 * row + 16 + 32 * cue + k for k in range(1 if geometry == "dot" else 3)
        }
        if foreground == expected:
            return cue
    raise s._Refusal("Decode", "cue geometry/position or foreground differs")


def decode(frame: object, geometry: object) -> s.Result[int]:
    return s._capture(
        lambda: _decode(_frame(frame), _member(geometry, ("dot", "bar"), "geometry"))
    )


def _issued(policy: Policy) -> Policy:
    _POLICIES.add(policy)
    return policy


def _policy(value: object) -> Policy:
    if type(value) is not Policy or value not in _POLICIES:
        raise s._Refusal("Policy", "owned policy from create/observe/choose required")
    return value


def create_policy(
    strategy: object, effect: object, geometry: object, certificate: object
) -> s.Result[Policy]:
    def operation() -> Policy:
        admitted = c._admitted(certificate)
        return _issued(
            Policy(
                _member(strategy, STRATEGIES, "strategy"),
                _effect(effect),
                _member(geometry, ("dot", "bar"), "geometry"),
                s.HALF,
                0,
                None,
                0,
                0,
                admitted.Guards,
            )
        )

    return s._capture(operation)


def _observe(policy: Policy, frame: Frame) -> Policy:
    if (
        policy._seen > 16
        or (policy._seen == 0 and policy._pending is not None)
        or (policy._seen > 0 and policy._pending is None)
    ):
        raise s._Refusal(
            "ObservationOrder", "observe initially or after one committed action"
        )
    cue = _decode(frame, policy._geometry)
    prior = policy._belief
    predictions = policy._predictions
    if policy._pending is not None:
        prior = _predict(prior, policy._pending, policy._effect)
        predictions += 1
    _, posterior = _condition(prior, cue)
    return _issued(
        replace(
            policy,
            _belief=posterior,
            _seen=policy._seen + 1,
            _pending=None,
            _predictions=predictions,
            _updates=policy._updates + 1,
        )
    )


def observe(policy: object, projected_frame: object) -> s.Result[Policy]:
    return s._capture(lambda: _observe(_policy(policy), _frame(projected_frame)))


def _choose(policy: Policy) -> tuple[Choice, Policy]:
    if not 1 <= policy._seen <= 16 or policy._pending is not None:
        raise s._Refusal(
            "ChoiceOrder", "choose exactly once after a nonterminal observation"
        )
    depth = min(3, 17 - policy._seen)
    choice = (
        _recursive_choice(policy._belief, policy._effect, depth, 0, 0)
        if policy._strategy == STRATEGIES[0]
        else _compiled_choice(policy._guards, policy._belief, policy._effect, depth)
    )
    return choice, _issued(replace(policy, _pending=choice.Action))


def choose(policy: object) -> s.Result[tuple[Choice, Policy]]:
    return s._capture(lambda: _choose(_policy(policy)))


def run_episode(
    strategy: object,
    effect: object,
    geometry: object,
    palette: object,
    tape: object,
    index: object = 0,
    *,
    certificate: object,
    private_band: object = None,
    scorer_override: object = None,
) -> s.Result[dict[str, c.Json]]:
    def operation() -> dict[str, c.Json]:
        admitted = c._admitted(certificate)
        arm = _member(strategy, STRATEGIES, "strategy")
        actual_effect = _effect(effect)
        shape = _member(geometry, ("dot", "bar"), "geometry")
        colors = _member(palette, ("fixed", "odd-complement"), "palette")
        source = _tape(tape)
        episode_index = _integer(index, 0, 1023, "episode index0..1023")
        if private_band is not None and (
            type(private_band) is not bytes
            or len(private_band) != 512
            or any(x > 1 for x in private_band)
        ):
            raise s._Refusal(
                "PrivateBand", "512 binary evaluator-only replacement cells required"
            )
        if scorer_override is not None and (
            type(scorer_override) is not int or scorer_override not in (-1, 0, 4)
        ):
            raise s._Refusal("Scorer", "evaluator-only reward in {-1,0,4} required")
        policy = _issued(
            Policy(arm, actual_effect, shape, s.HALF, 0, None, 0, 0, admitted.Guards)
        )
        state = source.initial
        cues: list[str] = []
        states: list[str] = []
        actions: list[str] = []
        rewards: list[c.Json] = []
        beliefs: list[c.Json] = []
        frames: list[c.Json] = []
        projections: list[c.Json] = []
        work: list[c.Json] = []
        previous_reward: int | None = None
        total = 0
        for observation in range(17):
            cue = state ^ source.errors[observation]
            frame = _render(cue, shape, colors, observation, previous_reward)
            if private_band is not None:
                frame = Frame(frame.Cells[:1536] + private_band)
            projected = _project(_frame(frame))
            policy = _observe(policy, _frame(projected))
            cues.append(str(cue))
            states.append(str(state))
            beliefs.append(f"{policy._belief:016X}")
            frames.append(hashlib.sha256(frame.Cells).hexdigest().upper())
            projections.append(hashlib.sha256(projected.Cells).hexdigest().upper())
            if observation == 16:
                break
            decision, policy = _choose(policy)
            actions.append(str(decision.Action))
            reward = (
                (4 * state if decision.Action == 0 else -1)
                if scorer_override is None
                else scorer_override
            )
            rewards.append(reward)
            total += reward
            work.append(asdict(decision))
            previous_reward = reward
            state = (
                state
                ^ int(actual_effect and decision.Action == 1)
                ^ source.drift[observation]
            )
        return {
            "Index": episode_index,
            "Complete": True,
            "Failure": None,
            "Cues": "".join(cues),
            "Actions": "".join(actions),
            "States": "".join(states),
            "Reward4": rewards,
            "BeliefBits": beliefs,
            "ChoiceWork": work,
            "FilterCounters": {
                "Predictions": policy._predictions,
                "Updates": policy._updates,
            },
            "FrameSha256": frames,
            "ProjectionSha256": projections,
            "TotalReward4": total,
        }

    return s._capture(operation)
