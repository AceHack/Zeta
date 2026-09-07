"""Independent hidden-switch simulator and bounded belief-planning reference.

The float64 runner follows the registered observable interface. A separate
Fraction oracle enumerates contingent policies in hidden-state coordinates;
it never calls the numerical filter or planner. Neither path imports native
implementation, saved native traces, source manifests or filesystem handles.
"""

from __future__ import annotations

import copy
import hashlib
import math
from collections.abc import Sequence
from dataclasses import dataclass
from fractions import Fraction as F
from itertools import product
from typing import NamedTuple, TypedDict


class PanelConfig(TypedDict):
    Name: str
    Episodes: int
    Seed: int
    Domain: int
    Effect: bool
    Geometry: str
    Palette: str


ARMS = (
    "belief-depth3",
    "belief-myopic",
    "belief-myopic-padded",
    "latest-cue-depth3",
)
PANELS: tuple[PanelConfig, ...] = tuple(
    {
        "Name": name,
        "Episodes": 1024,
        "Seed": 9101,
        "Domain": domain,
        "Effect": effect,
        "Geometry": geometry,
        "Palette": palette,
    }
    for name, domain, effect, geometry, palette in (
        ("dot-switch", 911, True, "dot", "fixed"),
        ("bar-switch", 912, True, "bar", "fixed"),
        ("palette-switch", 913, True, "dot", "odd-complement"),
        ("dot-null", 914, False, "dot", "fixed"),
    )
)
HORIZON = 16
Q = 1 / 8
P = 3 / 4
MASK = (1 << 64) - 1
GOLDEN = 0x9E3779B97F4A7C15


class Counters(TypedDict):
    Nodes: int
    ActionValues: int
    Predictions: int
    Updates: int


class FilterCounters(TypedDict):
    Predictions: int
    Updates: int


class Episode(TypedDict):
    Index: int
    Complete: bool
    Failure: None
    Cues: str
    Actions: str
    States: str
    Reward4: list[int]
    Beliefs: list[float]
    DecisionQ: list[list[float]]
    TreeRootQ: list[list[float]]
    PlanningCounters: list[Counters]
    FilterCounters: FilterCounters
    FrameSha256: list[str]
    ProjectionSha256: list[str]
    TotalReward4: int


def _integer(value: int, lower: int, upper: int, label: str) -> None:
    if type(value) is not int or not lower <= value <= upper:
        raise ValueError(label)


def _effect(value: bool) -> None:
    if type(value) is not bool:
        raise ValueError("effect must be boolean")


def _probability(value: float, label: str) -> float:
    if (
        type(value) not in (int, float)
        or not 0 <= value <= 1
        or not math.isfinite(value)
    ):
        raise ValueError(label)
    return float(value)


def _bits(values: Sequence[int], length: int, label: str) -> tuple[int, ...]:
    if not isinstance(values, (tuple, list, bytes, bytearray)) or len(values) != length:
        raise ValueError(label)
    if any(type(bit) is not int or bit not in (0, 1) for bit in values):
        raise ValueError(label)
    return tuple(values)


@dataclass(frozen=True, slots=True, init=False)
class Tape:
    initial: int
    drift: tuple[int, ...]
    errors: tuple[int, ...]

    def __init__(self, initial: int, drift: Sequence[int], errors: Sequence[int]):
        _integer(initial, 0, 1, "initial state")
        object.__setattr__(self, "initial", initial)
        object.__setattr__(self, "drift", _bits(drift, 16, "sixteen drift bits"))
        object.__setattr__(
            self, "errors", _bits(errors, 17, "seventeen cue-error bits")
        )


def hand_tapes() -> tuple[tuple[str, Tape], ...]:
    return (
        ("zero", Tape(0, (0,) * 16, (0,) * 17)),
        ("one", Tape(1, (0,) * 16, (0,) * 17)),
        (
            "alternating",
            Tape(0, tuple(t % 2 for t in range(16)), tuple(j % 2 for j in range(17))),
        ),
        (
            "sparse",
            Tape(
                1,
                tuple(int(t in (0, 7, 15)) for t in range(16)),
                tuple(int(j in (0, 2, 8, 16)) for j in range(17)),
            ),
        ),
    )


def mix(value: int) -> int:
    """The registered Zeta mixer includes its initial golden-ratio multiply."""
    _integer(value, 0, MASK, "unsigned mixer input")
    result = value * GOLDEN & MASK
    result = (result ^ (result >> 30)) * 0xBF58476D1CE4E5B9 & MASK
    result = (result ^ (result >> 27)) * 0x94D049BB133111EB & MASK
    return result ^ (result >> 31)


def domain(seed: int, tag: int) -> int:
    _integer(seed, 0, MASK, "unsigned source seed")
    _integer(tag, 0, MASK, "unsigned source domain")
    return mix(seed ^ (tag * GOLDEN & MASK))


class Stream:
    def __init__(self, seed: int):
        _integer(seed, 0, MASK, "unsigned stream seed")
        self.state = seed
        self.draws = 0

    def next(self) -> float:
        self.state = (self.state + GOLDEN) & MASK
        self.draws += 1
        return (mix(self.state) >> 11) / 9007199254740992


def source_tapes(seed: int, domain: int, count: int) -> list[Tape]:
    _integer(seed, 0, MASK, "unsigned source seed")
    _integer(domain, 0, MASK, "unsigned source domain")
    _integer(count, 1, 1024, "source count must be in [1,1024]")
    stream = Stream(mix(seed ^ (domain * GOLDEN & MASK)))
    tapes = []
    for _ in range(count):
        initial = int(2 * stream.next())
        errors = [int(stream.next() >= P)]
        drift = []
        for _ in range(HORIZON):
            drift.append(int(stream.next() < Q))
            errors.append(int(stream.next() >= P))
        tapes.append(Tape(initial, drift, errors))
    if stream.draws != 34 * count:
        raise ValueError("source draw accounting")
    return tapes


def transition(state: int, action: int, drift: int, effect: bool) -> int:
    for value, label in ((state, "state"), (action, "action"), (drift, "drift")):
        _integer(value, 0, 1, label)
    _effect(effect)
    return state ^ int(effect and action == 1) ^ drift


def cue(state: int, error: int) -> int:
    _integer(state, 0, 1, "state")
    _integer(error, 0, 1, "cue error")
    return state ^ error


def reward_quarters(state: int, action: int) -> int:
    _integer(state, 0, 1, "state")
    _integer(action, 0, 1, "action")
    return 4 * state if action == 0 else -1


@dataclass(frozen=True, slots=True, init=False)
class Frame:
    cells: bytes
    width: int = 64
    height: int = 32
    palette: int = 2

    def __init__(
        self,
        cells: bytes | bytearray,
        width: int = 64,
        height: int = 32,
        palette: int = 2,
    ):
        if not isinstance(cells, (bytes, bytearray)):
            raise ValueError("frame cells must be bytes")  # noqa: TRY004 - Wrapper converts ValueError to typed refusals.
        object.__setattr__(self, "cells", bytes(cells))
        object.__setattr__(self, "width", width)
        object.__setattr__(self, "height", height)
        object.__setattr__(self, "palette", palette)


def _geometry(geometry: str) -> None:
    if geometry not in ("dot", "bar"):
        raise ValueError("geometry")


def _palette(palette: str) -> None:
    if palette not in ("fixed", "odd-complement"):
        raise ValueError("palette")


def render(
    symbol: int, geometry: str, palette: str, index: int, reward4: int | None = None
) -> Frame:
    _integer(symbol, 0, 1, "cue")
    _integer(index, 0, 16, "observation index")
    _geometry(geometry)
    _palette(palette)
    if (index == 0 and reward4 is not None) or (
        index > 0 and (type(reward4) is not int or reward4 not in (-1, 0, 4))
    ):
        raise ValueError("private rendered reward")
    cells = bytearray(2048)
    x = 16 + 32 * symbol
    y = 8 if geometry == "dot" else 20
    for offset in range(1 if geometry == "dot" else 3):
        cells[64 * y + x + offset] = 1
    if reward4 is not None:
        cells[64 * 26 + {-1: 20, 0: 4, 4: 12}[reward4]] = 1
    if palette == "odd-complement" and index % 2:
        cells = bytearray(value ^ 1 for value in cells)
    return Frame(bytes(cells))


def background(frame: Frame) -> int:
    if (
        not isinstance(frame, Frame)
        or any(
            type(value) is not int
            for value in (frame.width, frame.height, frame.palette)
        )
        or (frame.width, frame.height, frame.palette) != (64, 32, 2)
    ):
        raise ValueError("frame dimensions or palette")
    if len(frame.cells) != 2048 or any(value > 1 for value in frame.cells):
        raise ValueError("binary frame")
    ones = sum(frame.cells[:1536])
    if ones == 768:
        raise ValueError("upper-band majority tie")
    return int(ones > 768)


def project(frame: Frame) -> Frame:
    fill = background(frame)
    return Frame(frame.cells[:1536] + bytes((fill,)) * 512)


def decode(frame: Frame, geometry: str) -> int:
    _geometry(geometry)
    fill = background(frame)
    if frame.cells[1536:] != bytes((fill,)) * 512:
        raise ValueError("private band remains in projection")
    foreground = {index for index, value in enumerate(frame.cells) if value != fill}
    y = 8 if geometry == "dot" else 20
    for symbol in (0, 1):
        expected = {
            64 * y + 16 + 32 * symbol + offset
            for offset in range(1 if geometry == "dot" else 3)
        }
        if foreground == expected:
            return symbol
    raise ValueError("cue geometry, position or extra marks")


def condition(prior: float, observation: int, p: float = P) -> float:
    prior = _probability(prior, "prior")
    p = _probability(p, "observation accuracy")
    _integer(observation, 0, 1, "observation")
    likelihood_one = p if observation else 1 - p
    likelihood_zero = 1 - likelihood_one
    one = prior * likelihood_one
    zero = (1 - prior) * likelihood_zero
    if one + zero <= 0:
        raise ValueError("impossible observation")
    return one / (one + zero)


def predict(belief: float, action: int, effect: bool, q: float = Q) -> float:
    belief = _probability(belief, "belief")
    q = _probability(q, "drift probability")
    _integer(action, 0, 1, "action")
    _effect(effect)
    after_action = 1 - belief if effect and action else belief
    return q + (1 - 2 * q) * after_action


def select(values: tuple[float, float]) -> int:
    if (
        not isinstance(values, tuple)
        or len(values) != 2
        or any(type(value) not in (int, float) for value in values)
    ):
        raise ValueError("two finite action values")
    try:
        finite = all(math.isfinite(value) for value in values)
    except OverflowError as error:
        raise ValueError("action value exceeds float64") from error
    if not finite:
        raise ValueError("two finite action values")
    return 0 if abs(values[0] - values[1]) <= 1e-12 else int(values[1] > values[0])


def plan(
    belief: float, depth: int, effect: bool, q: float = Q, p: float = P
) -> tuple[tuple[float, float], Counters]:
    belief = _probability(belief, "belief")
    q = _probability(q, "drift probability")
    p = _probability(p, "observation accuracy")
    _integer(depth, 1, 3, "depth must be in [1,3]")
    _effect(effect)
    counters: Counters = {"Nodes": 0, "ActionValues": 0, "Predictions": 0, "Updates": 0}

    def visit(current: float, remaining: int) -> tuple[float, float]:
        counters["Nodes"] += 1
        values = []
        for action in (0, 1):
            counters["ActionValues"] += 1
            value = current if action == 0 else -0.25
            if remaining > 1:
                prior = predict(current, action, effect, q)
                counters["Predictions"] += 1
                for observation in (0, 1):
                    probability = (1 - prior) * (
                        p if observation == 0 else 1 - p
                    ) + prior * (p if observation == 1 else 1 - p)
                    posterior = condition(prior, observation, p)
                    counters["Updates"] += 1
                    value += probability * max(visit(posterior, remaining - 1))
            values.append(value)
        return values[0], values[1]

    return visit(belief, depth), counters


class Decision(NamedTuple):
    action: int
    decision_q: tuple[float, float]
    tree_q: tuple[float, float]
    counters: Counters


class Policy:
    """Owns only declared model constants, admitted cues and its own actions."""

    __slots__ = (
        "_arm",
        "_belief",
        "_effect",
        "_geometry",
        "_pending",
        "_predictions",
        "_seen",
        "_updates",
    )

    def __init__(self, arm: str, effect: bool, geometry: str):
        if arm not in ARMS:
            raise ValueError("arm")
        _effect(effect)
        _geometry(geometry)
        self._arm = arm
        self._effect = effect
        self._geometry = geometry
        self._belief = 0.5
        self._seen = 0
        self._pending: int | None = None
        self._predictions = 0
        self._updates = 0

    @property
    def belief(self) -> float:
        return self._belief

    @property
    def filter_counters(self) -> FilterCounters:
        return {"Predictions": self._predictions, "Updates": self._updates}

    def observe(self, projected: Frame) -> None:
        if self._seen > 16 or (self._seen > 0 and self._pending is None):
            raise ValueError("observation boundary")
        observation = decode(projected, self._geometry)
        prior = self._belief
        if self._arm == "latest-cue-depth3":
            prior = 0.5
        elif self._pending is not None:
            prior = predict(prior, self._pending, self._effect)
            self._predictions += 1
        self._belief = condition(prior, observation)
        self._updates += 1
        self._seen += 1
        self._pending = None

    def choose(self) -> Decision:
        if not 1 <= self._seen <= 16 or self._pending is not None:
            raise ValueError("decision boundary")
        depth = 1 if self._arm == "belief-myopic" else min(3, 17 - self._seen)
        tree_q, counters = plan(self._belief, depth, self._effect)
        decision_q = (
            (self._belief, -0.25) if self._arm == "belief-myopic-padded" else tree_q
        )
        action = select(decision_q)
        self._pending = action
        return Decision(action, decision_q, tree_q, counters)

    def fork(self) -> Policy:
        return copy.copy(self)


def run_episode(
    arm: str,
    effect: bool,
    geometry: str,
    palette: str,
    tape: Tape,
    index: int = 0,
    *,
    private_band: bytes | None = None,
    scorer_override: int | None = None,
) -> Episode:
    _integer(index, 0, 1023, "episode index must be in [0,1023]")
    _palette(palette)
    if not isinstance(tape, Tape):
        raise ValueError("immutable tape required")  # noqa: TRY004 - Wrapper converts ValueError to typed refusals.
    if private_band is not None and (
        type(private_band) is not bytes
        or len(private_band) != 512
        or any(value > 1 for value in private_band)
    ):
        raise ValueError("private-band intervention requires 512 binary bytes")
    if scorer_override is not None and (
        type(scorer_override) is not int or scorer_override not in (-1, 0, 4)
    ):
        raise ValueError("scorer intervention requires a reward4 category")
    # Re-admit the full record at the evaluator boundary, never in the policy.
    tape = Tape(tape.initial, tape.drift, tape.errors)
    policy = Policy(arm, effect, geometry)
    state = tape.initial
    states, cues, actions, rewards = [], [], [], []
    beliefs, decisions, roots = [], [], []
    counts: list[Counters] = []
    frame_hashes, projection_hashes = [], []

    def observe(observation_index: int, last_reward: int | None) -> None:
        observed = cue(state, tape.errors[observation_index])
        frame = render(observed, geometry, palette, observation_index, last_reward)
        # Named conformance interventions remain in the evaluator. Registered
        # wrappers pass neither override; Policy has no argument for either.
        if private_band is not None:
            frame = Frame(frame.cells[:1536] + private_band)
        projected = project(frame)
        policy.observe(projected)
        cues.append(observed)
        beliefs.append(policy.belief)
        frame_hashes.append(hashlib.sha256(frame.cells).hexdigest().upper())
        projection_hashes.append(hashlib.sha256(projected.cells).hexdigest().upper())

    observe(0, None)
    for position in range(HORIZON):
        decision = policy.choose()
        actions.append(decision.action)  # Commit before scorer/state advancement.
        states.append(state)
        decisions.append(list(decision.decision_q))
        roots.append(list(decision.tree_q))
        counts.append(decision.counters)
        reward = reward_quarters(state, decision.action)
        if scorer_override is not None:
            reward = scorer_override
        rewards.append(reward)
        state = transition(state, decision.action, tape.drift[position], effect)
        observe(position + 1, reward)
    states.append(state)
    return {
        "Index": index,
        "Complete": True,
        "Failure": None,
        "Cues": "".join(map(str, cues)),
        "Actions": "".join(map(str, actions)),
        "States": "".join(map(str, states)),
        "Reward4": rewards,
        "Beliefs": beliefs,
        "DecisionQ": decisions,
        "TreeRootQ": roots,
        "PlanningCounters": counts,
        "FilterCounters": policy.filter_counters,
        "FrameSha256": frame_hashes,
        "ProjectionSha256": projection_hashes,
        "TotalReward4": sum(rewards),
    }


# Exact oracle: hidden-state transition/emission tables and contingent trees.
# No calls to condition, predict, plan, Policy, transition, cue or reward_quarters.
def _fraction(value: F, label: str) -> F:
    if type(value) not in (int, F) or not 0 <= value <= 1:
        raise ValueError(label)
    return F(value)


def exact_tables(
    effect: bool, q: F = F(1, 8), p: F = F(3, 4)
) -> tuple[tuple[tuple[tuple[F, ...], ...], ...], tuple[tuple[F, ...], ...]]:
    _effect(effect)
    q = _fraction(q, "exact drift probability")
    p = _fraction(p, "exact observation accuracy")
    transitions = tuple(
        tuple(
            tuple(
                (1 - q)
                if destination == ((1 - source) if effect and action else source)
                else q
                for destination in (0, 1)
            )
            for source in (0, 1)
        )
        for action in (0, 1)
    )
    emissions = ((p, 1 - p), (1 - p, p))
    return transitions, emissions


def exact_condition(prior: F, observation: int, p: F = F(3, 4)) -> F:
    prior = _fraction(prior, "exact prior")
    _integer(observation, 0, 1, "observation")
    _, emissions = exact_tables(False, F(0), p)
    weights = tuple(
        weight * emissions[state][observation]
        for state, weight in enumerate((1 - prior, prior))
    )
    mass = sum(weights, F(0))
    if mass <= 0:
        raise ValueError("impossible exact observation")
    return weights[1] / mass


def exact_after(
    belief: F,
    action: int,
    observation: int,
    effect: bool,
    q: F = F(1, 8),
    p: F = F(3, 4),
) -> F:
    belief = _fraction(belief, "exact belief")
    _integer(action, 0, 1, "action")
    _integer(observation, 0, 1, "observation")
    transitions, emissions = exact_tables(effect, q, p)
    weights = tuple(
        sum(
            (
                prior * transitions[action][source][destination]
                for source, prior in enumerate((1 - belief, belief))
            ),
            F(0),
        )
        * emissions[destination][observation]
        for destination in (0, 1)
    )
    mass = sum(weights, F(0))
    if mass <= 0:
        raise ValueError("impossible exact observation")
    return weights[1] / mass


class Alpha(NamedTuple):
    action: int
    values: tuple[F, F]


def alpha_vectors(
    depth: int, effect: bool, q: F = F(1, 8), p: F = F(3, 4)
) -> tuple[Alpha, ...]:
    _integer(depth, 1, 3, "exact depth must be in [1,3]")
    transitions, emissions = exact_tables(effect, q, p)
    rewards = ((F(0), F(1)), (F(-1, 4), F(-1, 4)))
    population = tuple(Alpha(action, rewards[action]) for action in (0, 1))
    for _ in range(1, depth):
        expanded = []
        for action, zero, one in product((0, 1), population, population):
            values = []
            for source in (0, 1):
                continuation = sum(
                    (
                        transitions[action][source][destination]
                        * emissions[destination][observation]
                        * branch.values[destination]
                        for observation, branch in enumerate((zero, one))
                        for destination in (0, 1)
                    ),
                    F(0),
                )
                values.append(rewards[action][source] + continuation)
            expanded.append(Alpha(action, (values[0], values[1])))
        population = tuple(expanded)
    return population


def oracle_q(
    belief: F, effect: bool, depth: int, q: F = F(1, 8), p: F = F(3, 4)
) -> tuple[F, F]:
    belief = _fraction(belief, "exact belief")
    trees = alpha_vectors(depth, effect, q, p)
    result = tuple(
        max(
            (1 - belief) * tree.values[0] + belief * tree.values[1]
            for tree in trees
            if tree.action == action
        )
        for action in (0, 1)
    )
    return result[0], result[1]


def verify_falsifiers() -> dict[str, bool]:
    """Execute bounded hand-only discriminators; never generate a source tape.

    Flags describe exercised calls and traces, not process isolation. JSON
    envelope/type/provenance mutation checks belong to the separate wrapper.
    """
    renderings = (("dot", "fixed"), ("bar", "fixed"), ("dot", "odd-complement"))
    hands = {
        (name, effect, geometry, palette, arm): run_episode(
            arm, effect, geometry, palette, tape
        )
        for (name, tape), effect, (geometry, palette), arm in product(
            hand_tapes(), (False, True), renderings, ARMS
        )
    }
    flags = dict.fromkeys(
        (
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
        ),
        True,
    )
    inputs = tuple(product((0, 1), repeat=3))
    flags["action-effect"] = (
        [transition(x, a, d, True) for x, a, d in inputs] == [0, 1, 1, 0, 1, 0, 0, 1]
        and [transition(x, a, d, False) for x, a, d in inputs]
        == [0, 1, 0, 1, 1, 0, 1, 0]
        and [reward_quarters(x, a) for x, a, _ in inputs]
        == [0, 0, -1, -1, 4, 4, -1, -1]
    )

    def same_policy(left: Episode, right: Episode) -> bool:
        return (
            left["Actions"],
            left["Beliefs"],
            left["DecisionQ"],
            left["TreeRootQ"],
            left["PlanningCounters"],
        ) == (
            right["Actions"],
            right["Beliefs"],
            right["DecisionQ"],
            right["TreeRootQ"],
            right["PlanningCounters"],
        )

    for (name, effect, geometry, palette, arm), episode in hands.items():
        reference = hands[name, effect, "dot", "fixed", arm]
        flags["geometry-palette-invariance"] &= (
            same_policy(reference, episode) and reference["Cues"] == episode["Cues"]
        )
        counts = episode["PlanningCounters"]
        totals = (
            sum(row["Nodes"] for row in counts),
            sum(row["ActionValues"] for row in counts),
            sum(row["Predictions"] for row in counts),
            sum(row["Updates"] for row in counts),
        )
        expected = (16, 32, 0, 0) if arm == "belief-myopic" else (300, 600, 142, 284)
        flags["counter-accounting"] &= totals == expected and episode[
            "FilterCounters"
        ] == {"Predictions": 0 if arm == "latest-cue-depth3" else 16, "Updates": 17}
        if not effect:
            flags["null-dominance"] &= episode["Actions"] == "0" * 16
        if arm == "belief-myopic-padded":
            natural = hands[name, effect, geometry, palette, "belief-myopic"]
            planner = hands[name, effect, geometry, palette, "belief-depth3"]
            flags["padded-equivalence"] &= (
                episode["Actions"],
                episode["Reward4"],
                episode["Beliefs"],
                episode["DecisionQ"],
            ) == (
                natural["Actions"],
                natural["Reward4"],
                natural["Beliefs"],
                natural["DecisionQ"],
            )
            flags["padded-equivalence"] &= (
                episode["PlanningCounters"] == planner["PlanningCounters"]
            )

    original = dict(hand_tapes())["sparse"]
    changed_tape = Tape(
        original.initial,
        original.drift[:8] + tuple(1 - bit for bit in original.drift[8:]),
        original.errors[:9] + tuple(1 - bit for bit in original.errors[9:]),
    )
    bands = (
        bytes(512),
        bytes([1]) * 512,
        bytes([0, 1]) * 256,
        bytes((i * 13 ^ i >> 3) & 1 for i in range(512)),
    )
    for arm in ARMS:
        base = hands["sparse", True, "dot", "fixed", arm]
        changed = run_episode(arm, True, "dot", "fixed", changed_tape)
        flags["suffix-noninterference"] &= (
            base["States"] != changed["States"]
            and base["Cues"][:9] == changed["Cues"][:9]
            and base["Actions"][:9] == changed["Actions"][:9]
            and base["Beliefs"][:9] == changed["Beliefs"][:9]
            and base["DecisionQ"][:9] == changed["DecisionQ"][:9]
            and base["TreeRootQ"][:9] == changed["TreeRootQ"][:9]
        )
        for band in bands:
            altered = run_episode(
                arm, True, "dot", "fixed", original, private_band=band
            )
            flags["private-band-noninterference"] &= (
                same_policy(base, altered)
                and base["ProjectionSha256"] == altered["ProjectionSha256"]
                and base["FrameSha256"] != altered["FrameSha256"]
            )
        rescored = run_episode(arm, True, "dot", "fixed", original, scorer_override=0)
        flags["scorer-noninterference"] &= (
            same_policy(base, rescored) and base["Reward4"] != rescored["Reward4"]
        )
        caller = bytearray(project(render(0, "dot", "fixed", 0)).cells)
        policy = Policy(arm, True, "dot")
        policy.observe(Frame(caller))
        fork = policy.fork()
        caller[8 * 64 + 16], caller[8 * 64 + 48] = 0, 1
        flags["caller-frame-isolation"] &= (
            policy.belief == fork.belief and policy.choose() == fork.choose()
        )

    for prior, depth in product((0.0, 0.25, 0.5, 0.75, 1.0), (1, 2, 3)):
        values, _ = plan(prior, depth, False)
        flags["null-dominance"] &= values[0] > values[1] and select(values) == 0
    malformed = (
        lambda: transition(0, True, 0, True),
        lambda: plan(float("nan"), 3, True),
        lambda: plan(0.5, 4, True),
        lambda: condition(0.0, 1, p=1.0),
        lambda: decode(render(0, "dot", "fixed", 1, 4), "dot"),
        lambda: project(Frame(bytes([0, 1]) * 1024)),
        lambda: run_episode(ARMS[0], True, "wrong", "fixed", original),
        lambda: run_episode(
            ARMS[0], True, "dot", "fixed", original, private_band=bytes(511)
        ),
    )
    for call in malformed:
        try:
            call()
        except ValueError:
            continue
        flags["malformed-input-refusal"] = False
    return flags
