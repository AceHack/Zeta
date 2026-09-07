"""Pure replay of the finite compiled-controller conformance witnesses.

All three raw hand slices are rechecked before the 10 invocation, 10
intervention and 53 refusal operations. Expected events come from independent
software binary64/reference calls, not native code or producer pass flags.
The six-field outer-negative descriptor is shape-checked only. This module
opens no files, collects no runtime data, generates no source tapes and caches
no numerical results. Native event authenticity requires separate source and
runtime admission; Python fixtures alone are not native conformance.
"""

from __future__ import annotations

import copy
import re
from dataclasses import asdict, dataclass, replace
from typing import cast

from . import hidden_switch_compiled_certificate as c
from . import hidden_switch_compiled_ieee as s
from . import hidden_switch_compiled_old_replay as old
from . import hidden_switch_compiled_reference as r
from . import hidden_switch_compiled_replay as strict

SCHEMA = "zeta.hidden-switch.compiled.falsifiers.v1"
_KINDS = (
    "action-before-feedback",
    "future-suffix",
    "scorer-receipt-noninterference",
    "private-band-noninterference",
    "caller-copy-isolation",
)
_REFUSALS = (
    "belief-nan",
    "belief-positive-infinity",
    "belief-negative-infinity",
    "belief-negative-subnormal",
    "belief-above-one",
    "depth-zero",
    "depth-four",
    "noncanonical-bits",
    "nonbinary-frame",
    "wrong-frame-dimensions",
    "choose-before-observe",
    "observe-without-action",
    "duplicate-choose",
    "terminal-choose",
    "invalid-prediction-action",
)
_BAD_BITS = (
    "7FF8000000000000",
    "7FF0000000000000",
    "FFF0000000000000",
    "8000000000000001",
    "3FF0000000000001",
)
_BAND = bytes(i % 2 for i in range(512))
_FAILURE_KEYS = {
    "Stage",
    "Code",
    "Detail",
    "Panel",
    "Mode",
    "Strategy",
    "Replicate",
    "Episode",
    "Call",
}
_TOP = {
    "Schema",
    "ScalarCoverage",
    "HandCoverage",
    "InvocationCases",
    "InterventionCases",
    "RefusalCases",
    "OuterNegativeEvidence",
}


@dataclass(frozen=True, slots=True)
class FalsifierCounts:
    ScalarPositions: int = 0
    NewHandEpisodes: int = 0
    OldControlEpisodes: int = 0
    InvocationCases: int = 0
    InterventionCases: int = 0
    RefusalOperations: int = 0
    RefusalGroups: int = 0
    DelegateEntries: int = 0
    EvaluatorEntries: int = 0


@dataclass(frozen=True, slots=True)
class MutantRefusal:
    CaseId: str
    Code: str
    Path: str
    Message: str


@dataclass(frozen=True, slots=True)
class FalsifierReplay:
    NumericCertificateSha256: str
    Completed: FalsifierCounts
    MutantRefusals: tuple[MutantRefusal, ...]
    OuterNegativeEvidence: dict[str, c.Json]
    Scope: str = "pure-complete-hand-and-falsifier-replay"
    OuterNegativeAdmission: str = "pending-coordinator-replay"
    RuntimeAdmission: str = "not-performed-by-pure-replay"


@dataclass(frozen=True, slots=True)
class FalsifierFailure(s.Failure):
    Path: str
    Completed: FalsifierCounts
    Scope: str = "pure-complete-hand-and-falsifier-replay"
    OuterNegativeAdmission: str = "pending-coordinator-replay"
    RuntimeAdmission: str = "not-performed-by-pure-replay"


def _need[T](result: s.Result[T], path: str) -> T:
    return strict._need(result, path)


def _refused(result: s.Result[object], path: str) -> None:
    if not isinstance(result, s.Failure):
        raise strict._Mismatch(
            "ReferenceAccepted", "invalid operation must refuse", path
        )


def _same(expected: c.Json, actual: object, path: str) -> None:
    strict._same(expected, actual, path)


def _snapshot(policy: r.Policy) -> dict[str, c.Json]:
    # This is the independently authored reference's own state, not a native read.
    return {
        "Effect": policy._effect,
        "Geometry": policy._geometry,
        "BeliefBits": f"{policy._belief:016X}",
        "Observed": policy._seen,
        "PendingAction": -1 if policy._pending is None else policy._pending,
        "FilterCounters": {
            "Predictions": policy._predictions,
            "Updates": policy._updates,
        },
    }


def _cells(frame: r.Frame) -> str:
    return "".join(str(x) for x in frame.Cells)


def _tape_json(tape: r.Tape) -> dict[str, c.Json]:
    return {
        "Initial": tape.initial,
        "Drift": "".join(map(str, tape.drift)),
        "Errors": "".join(map(str, tape.errors)),
    }


def _event(
    events: list[c.Json],
    kind: str,
    index: int,
    given: dict[str, c.Json],
    result: dict[str, c.Json],
) -> None:
    events.append(
        {
            "Sequence": len(events),
            "Kind": kind,
            "Index": index,
            "Input": given,
            "Output": result,
        }
    )


def _new(strategy: str, cert: c.VerifiedCertificate) -> r.Policy:
    return _need(r.create_policy(strategy, True, "dot", cert), "Reference.Create")


def _cue(cue: int) -> r.Frame:
    frame = _need(r.render(cue, "dot", "fixed", 0), "Reference.Render")
    return _need(r.project(frame), "Reference.Project")


def _observe(
    policy: r.Policy, frame: r.Frame, events: list[c.Json], index: int
) -> r.Policy:
    before = _snapshot(policy)
    after = _need(r.observe(policy, frame), "Reference.Observe")
    cue = _need(r.decode(frame, "dot"), "Reference.Decode")
    _event(
        events,
        "observe",
        index,
        {"Cells": _cells(frame), "Before": before},
        {"Cue": cue, "After": _snapshot(after)},
    )
    return after


def _choose(
    policy: r.Policy, events: list[c.Json], index: int
) -> tuple[r.Choice, r.Policy]:
    before = _snapshot(policy)
    choice, after = _need(r.choose(policy), "Reference.Choose")
    _event(
        events,
        "choose",
        index,
        {"Before": before},
        {"Choice": asdict(choice), "After": _snapshot(after)},
    )
    return choice, after


@dataclass(frozen=True, slots=True)
class _Timeline:
    episode: dict[str, c.Json]
    initial: dict[str, c.Json]
    events: list[c.Json]
    policy: r.Policy
    frames: tuple[r.Frame, ...]
    choices: tuple[r.Choice, ...]


def _timeline(
    strategy: str, tape: r.Tape, cert: c.VerifiedCertificate, band: bytes | None = None
) -> _Timeline:
    episode = _need(
        r.run_episode(
            strategy,
            True,
            "dot",
            "fixed",
            tape,
            18,
            certificate=cert,
            private_band=band,
        ),
        "Reference.Episode",
    )
    policy = _new(strategy, cert)
    initial = _snapshot(policy)
    events: list[c.Json] = []
    frames: list[r.Frame] = []
    choices: list[r.Choice] = []
    state, reward = tape.initial, None
    for index in range(17):
        frame = _need(
            r.render(state ^ tape.errors[index], "dot", "fixed", index, reward),
            "Reference.Render",
        )
        if band is not None:
            frame = r.Frame(bytes(frame.Cells[:1536]) + band)
        frames.append(frame)
        projected = _need(r.project(frame), "Reference.Project")
        policy = _observe(policy, projected, events, index)
        if index == 16:
            break
        choice, policy = _choose(policy, events, index)
        choices.append(choice)
        reward = 4 * state if choice.Action == 0 else -1
        successor = state ^ choice.Action ^ tape.drift[index]
        _event(
            events,
            "feedback",
            index,
            {"State": state, "Action": choice.Action, "Drift": tape.drift[index]},
            {"State": successor, "Reward4": reward},
        )
        state = successor
    return _Timeline(episode, initial, events, policy, tuple(frames), tuple(choices))


def _sparse() -> r.Tape:
    tapes = r.hand_tapes()
    if len(tapes) != 4 or tuple(name for name, _ in tapes) != (
        "zero",
        "one",
        "alternating",
        "sparse",
    ):
        raise strict._Mismatch(
            "ReferenceRoster", "four explicit hand tapes required", "Reference"
        )
    return tapes[3][1]


def _copy_case(strategy: str, cert: c.VerifiedCertificate) -> dict[str, c.Json]:
    events: list[c.Json] = []
    original, alternate = _cue(0), _cue(1)
    caller = bytearray(original.Cells)
    frame = r.Frame(caller)
    policy = _observe(_new(strategy, cert), frame, events, 0)
    before: dict[str, c.Json] = {"Cells": _cells(frame), "Snapshot": _snapshot(policy)}
    caller[:] = alternate.Cells
    _event(
        events,
        "caller-mutate",
        0,
        {"Cells": _cells(original)},
        {"Cells": _cells(frame)},
    )
    retained, policy = _choose(policy, events, 0)
    control = _observe(_new(strategy, cert), frame, events, 0)
    control_seen = _snapshot(control)
    other, control = _choose(control, events, 0)
    if policy._belief == control._belief:
        raise strict._Mismatch(
            "VacuousMutation", "copy control must change belief", "Reference.Copy"
        )
    return {
        "CaseId": f"caller-copy-isolation/{strategy}",
        "Strategy": strategy,
        "Input": {"Effect": True, "Geometry": "dot", "Palette": "fixed"},
        "Before": before,
        "After": {
            "Cells": _cells(frame),
            "RetainedChoice": asdict(retained),
            "RetainedSnapshot": _snapshot(policy),
            "ControlObservedSnapshot": control_seen,
            "ControlChoice": asdict(other),
            "ControlSnapshot": _snapshot(control),
        },
        "Events": events,
    }


def _intervention(
    kind: str, strategy: str, cert: c.VerifiedCertificate
) -> dict[str, c.Json]:
    if kind == "caller-copy-isolation":
        return _copy_case(strategy, cert)
    tape = _sparse()
    base = _timeline(strategy, tape, cert)
    events: list[c.Json] = []
    before: c.Json = base.episode
    after = base.episode
    if kind == "action-before-feedback":
        before, events = None, base.events
    elif kind == "future-suffix":
        drift = tuple(bit ^ int(i == 8) for i, bit in enumerate(tape.drift))
        changed = replace(tape, drift=drift)
        after = _timeline(strategy, changed, cert).episode
        _event(
            events,
            "tape-replace",
            8,
            {"Tape": _tape_json(tape)},
            {"Tape": _tape_json(changed)},
        )
        for key in ("Actions", "Cues"):
            left, right = cast(str, base.episode[key]), cast(str, after[key])
            if left[:9] != right[:9]:
                raise strict._Mismatch(
                    "ReferenceChronology", "suffix changed the protected prefix", key
                )
        for key in ("States", "Cues"):
            if cast(str, base.episode[key])[9] == cast(str, after[key])[9]:
                raise strict._Mismatch(
                    "VacuousMutation", "suffix must change state and cue9", key
                )
    elif kind == "scorer-receipt-noninterference":
        after = copy.deepcopy(base.episode)
        rewards = cast(list[c.Json], base.episode["Reward4"])
        if not any(value != 0 for value in rewards):
            raise strict._Mismatch(
                "VacuousMutation", "receipt reward must change", "Reward4"
            )
        after["Reward4"], after["TotalReward4"] = [0] * 16, 0
        for index, reward in enumerate(rewards):
            _event(events, "score", index, {"Reward4": reward}, {"Reward4": 0})
    elif kind == "private-band-noninterference":
        changed_run = _timeline(strategy, tape, cert, _BAND)
        after = changed_run.episode
        before_hashes = strict._array(
            base.episode["FrameSha256"], 17, "Reference.Band.BeforeHashes"
        )
        after_hashes = strict._array(
            after["FrameSha256"], 17, "Reference.Band.AfterHashes"
        )
        if any(left == right for left, right in zip(before_hashes, after_hashes)):
            raise strict._Mismatch(
                "VacuousMutation",
                "all seventeen full-frame hashes must change",
                "Reference.Band.FrameSha256",
            )
        for index, (original_frame, changed_frame) in enumerate(
            zip(base.frames, changed_run.frames)
        ):
            if (
                original_frame.Cells == changed_frame.Cells
                or original_frame.Cells[:1536] != changed_frame.Cells[:1536]
            ):
                raise strict._Mismatch(
                    "VacuousMutation", "only private band must change", "Frames"
                )
            _event(
                events,
                "frame-replace",
                index,
                {"Cells": _cells(original_frame)},
                {"Cells": _cells(changed_frame)},
            )
        for key, value in base.episode.items():
            if key != "FrameSha256":
                _same(value, after[key], f"Reference.Band.{key}")
    else:
        raise strict._Mismatch("ReferenceRoster", "unknown intervention", "Reference")
    return {
        "CaseId": f"{kind}/{strategy}",
        "Strategy": strategy,
        "Input": {
            "Tape": "sparse",
            "Effect": True,
            "Geometry": "dot",
            "Palette": "fixed",
            "Index": 18,
        },
        "Before": before,
        "After": after,
        "Events": events,
    }


def _scalar_input(bits: int, effect: bool, depth: int) -> dict[str, c.Json]:
    return {"BeliefBits": f"{bits:016X}", "Effect": effect, "Depth": depth}


def _invocation_roster(
    cert: c.VerifiedCertificate,
) -> list[tuple[str, str, int, bool, int]]:
    result = [
        (
            f"unsupported-runtime-effect-{str(effect).lower()}-depth-{depth}",
            "unsupported-runtime",
            s.HALF,
            effect,
            depth,
        )
        for effect in (True, False)
        for depth in (1, 2, 3)
    ]
    interiors = []
    for depth in (2, 3):
        guard = cert.Guards[depth - 2]
        belief = _need(s.next_up(guard.SmaxBits), "Reference.Guard")
        if not s._value(guard.SmaxBits) < s._value(belief) < s._value(guard.HminBits):
            raise strict._Mismatch(
                "NoInterior", "registered strict interior required", "Reference.Guard"
            )
        interiors.append((belief, depth))
    for kind in ("real-fallback", "stubbed-fallback"):
        result.extend(
            (f"{kind}-depth-{depth}", "guarded", b, True, depth)
            for b, depth in interiors
        )
    return result


def _invocation(
    case: str,
    mode: str,
    belief: int,
    effect: bool,
    depth: int,
    cert: c.VerifiedCertificate,
) -> tuple[dict[str, c.Json], r.Choice]:
    source = _scalar_input(belief, effect, depth)
    native = _need(r.native_choice(belief, effect, depth), "Reference.Native")
    normal = _need(
        r.compiled_choice(
            cert,
            belief,
            effect,
            depth,
            unsupported_runtime=mode == "unsupported-runtime",
        ),
        "Reference.Compiled",
    )
    if normal.Path != 4 or normal.RecursiveCalls != 1:
        raise strict._Mismatch(
            "ReferenceFallback", "actual fallback expected", "Reference.Invocation"
        )
    stub = case.startswith("stubbed-fallback")
    returned = r.Choice(1 - normal.Action, 0, 0, 0, 0, 0, 0, 0) if stub else native
    choice = replace(returned, Path=4, GuardComparisons=normal.GuardComparisons)
    mutation: c.Json = (
        {
            "BaselineCaseId": f"real-fallback-depth-{depth}",
            "Kind": "opposite-action-no-evaluator",
        }
        if stub
        else None
    )
    return (
        {
            "CaseId": case,
            "Input": source,
            "Mode": mode,
            "Choice": asdict(choice),
            "Invocations": [
                {
                    "Sequence": 0,
                    "Kind": "deliberate-stub" if stub else "real-recursive",
                    "Input": source,
                    "DelegateEntries": 1,
                    "EvaluatorEntries": 0 if stub else 1,
                    "Returned": asdict(returned),
                    "Failure": None,
                }
            ],
            "Mutation": mutation,
        },
        normal,
    )


def _counts(
    entries: int = 0, services: int = 0, evaluators: int = 0
) -> dict[str, c.Json]:
    return {
        "EntryCalls": entries,
        "ServiceEntries": services,
        "EvaluatorEntries": evaluators,
    }


def _failure(stage: str, code: str) -> dict[str, c.Json]:
    return {
        "Stage": stage,
        "Code": code,
        "Detail": "independent expected refusal",
        "Panel": None,
        "Mode": None,
        "Strategy": None,
        "Replicate": None,
        "Episode": None,
        "Call": None,
    }


def _service(
    strategy: str, belief: int, effect: bool, depth: int, cert: c.VerifiedCertificate
) -> s.Result[r.Choice]:
    return (
        r.native_choice(belief, effect, depth)
        if strategy == r.STRATEGIES[0]
        else r.compiled_choice(cert, belief, effect, depth)
    )


def _refusal_roster(group: int) -> list[tuple[str, bool, int]]:
    if group < 5:
        return [
            (strategy, effect, depth)
            for strategy in r.STRATEGIES
            for effect, depth in ((True, 1), (False, 3), (True, 3))
        ]
    if group < 7:
        return [
            (strategy, effect, 0 if group == 5 else 4)
            for strategy in r.STRATEGIES
            for effect in (True, False)
        ]
    if group < 14:
        return [(strategy, True, 3) for strategy in r.STRATEGIES]
    return [("common", True, 3)]


def _refusal_operation(
    group: int, strategy: str, effect: bool, depth: int, cert: c.VerifiedCertificate
) -> dict[str, c.Json]:
    case = _REFUSALS[group]
    operation_id = f"{case}/{strategy}"
    setup: dict[str, c.Json] = {"Initial": None, "Events": []}
    setup_counts, operation_counts = _counts(), _counts(1)
    stage, code = "policy", "belief"
    if group < 7:
        operation_id += f"/effect-{str(effect).lower()}-depth-{depth}"
        bits = int(_BAD_BITS[group], 16) if group < 5 else s.HALF
        given = _scalar_input(bits, effect, depth)
        operation = "fixture-raw-bits-service"
        # Invalid nonfinite patterns reach the actual independent service boundary.
        _refused(_service(strategy, bits, effect, depth, cert), "Reference.Refusal")
        operation_counts = _counts(1, 1)
        code = "belief" if group < 5 else "depth"
    elif group == 7:
        given = {"BeliefBits": "3fe0000000000000", "Effect": True, "Depth": 3}
        operation, stage, code = "parse-dispatch", "input", "binary64-bits"
        _refused(s.parse_bits(given["BeliefBits"]), "Reference.Wire")
    elif group == 14:
        given = {"BeliefBits": f"{s.HALF:016X}", "Effect": True, "Action": 2}
        operation, code = "predict", "prediction-input"
        _refused(r.predict_bits(s.HALF, 2, True), "Reference.Predict")
    else:
        policy = _new(strategy, cert)
        initial = _snapshot(policy)
        events: list[c.Json] = []
        setup_counts = _counts(1)
        frame = _cue(0)
        if group in (11, 12):
            policy = _observe(policy, frame, events, 0)
            setup_counts = _counts(2)
            if group == 12:
                choice, policy = _choose(policy, events, 0)
                setup_counts = _counts(3, 1, choice.RecursiveCalls)
        elif group == 13:
            run = _timeline(strategy, _sparse(), cert)
            initial, events, policy = run.initial, run.events, run.policy
            setup_counts = _counts(34, 16, sum(x.RecursiveCalls for x in run.choices))
        setup = {"Initial": initial, "Events": events}
        if group in (8, 9, 11):
            if group == 8:
                malformed = bytearray(frame.Cells)
                malformed[0] = 2
                frame = replace(frame, Cells=bytes(malformed))
            elif group == 9:
                frame = replace(frame, Width=63)
            given = {
                "Frame": {
                    "Width": frame.Width,
                    "Height": frame.Height,
                    "Palette": frame.Palette,
                    "CellsHex": bytes(frame.Cells).hex().upper(),
                }
            }
            operation = "observe"
            stage, code = (
                ("observation", "frame-palette")
                if group == 8
                else ("observation", "frame-shape")
                if group == 9
                else ("policy", "observation-order")
            )
            _refused(r.observe(policy, frame), "Reference.ObserveRefusal")
        else:
            given = {}
            operation, code = "choose", "choice-order"
            _refused(r.choose(policy), "Reference.ChooseRefusal")
    return {
        "OperationId": operation_id,
        "Strategy": strategy,
        "Operation": operation,
        "Input": given,
        "Setup": setup,
        "Outcome": {"Kind": "refused", "Failure": _failure(stage, code)},
        "Calls": {"Setup": setup_counts, "Operation": operation_counts},
    }


def _descriptor(actual: object, path: str) -> dict[str, c.Json]:
    row = strict._object(
        actual,
        {"File", "Bytes", "Sha256", "Encoding", "StoredBytes", "StoredSha256"},
        path,
    )
    for key in ("Bytes", "StoredBytes"):
        if type(row[key]) is not int or not 0 <= cast(int, row[key]) <= (1 << 63) - 1:
            raise strict._Mismatch(
                "ArtifactLength", "nonnegative int64 length required", f"{path}.{key}"
            )
    for key in ("Sha256", "StoredSha256"):
        if (
            type(row[key]) is not str
            or re.fullmatch(r"[0-9A-F]{64}", cast(str, row[key])) is None
        ):
            raise strict._Mismatch(
                "ArtifactHash", "uppercase SHA256 required", f"{path}.{key}"
            )
    name = row["File"]
    if (
        type(name) is not str
        or re.fullmatch(r"[A-Za-z0-9._/-]+", name) is None
        or any(part in ("", ".", "..") for part in name.split("/"))
    ):
        raise strict._Mismatch(
            "ArtifactPath", "canonical relative ASCII path required", f"{path}.File"
        )
    encoding = row["Encoding"]
    if type(encoding) is not str or encoding not in ("identity", "gzip"):
        raise strict._Mismatch(
            "ArtifactEncoding", "identity or gzip required", f"{path}.Encoding"
        )
    if encoding == "identity" and (
        row["Bytes"] != row["StoredBytes"] or row["Sha256"] != row["StoredSha256"]
    ):
        raise strict._Mismatch(
            "ArtifactIdentity", "raw/stored identity must agree", path
        )
    if encoding == "gzip" and not name.endswith(".gz"):
        raise strict._Mismatch(
            "ArtifactEncoding", "gzip suffix required", f"{path}.File"
        )
    return copy.deepcopy(cast(dict[str, c.Json], row))


class _Checker:
    def __init__(self) -> None:
        self.completed = FalsifierCounts()
        self.mutants: list[MutantRefusal] = []

    def slices(
        self,
        scalars: object,
        episodes: object,
        controls: object,
        cert: c.VerifiedCertificate,
    ) -> None:
        new = strict.replay_scalar_and_new_hand(scalars, episodes, cert)
        if isinstance(new, strict.ReplayFailure):
            self.completed = replace(
                self.completed,
                ScalarPositions=new.Completed.ScalarRows,
                NewHandEpisodes=new.Completed.NewHandEpisodes,
            )
            raise strict._Mismatch(new.Code, new.Message, new.Path)
        admitted = _need(new, "Slices")
        if (admitted.ScalarRows, admitted.NewHandEpisodes) != (222, 48):
            raise strict._Mismatch(
                "IncompleteReplay", "complete new slices required", "Slices"
            )
        self.completed = replace(
            self.completed, ScalarPositions=222, NewHandEpisodes=48
        )
        previous = old.replay_old_hand(controls)
        if isinstance(previous, old.OldReplayFailure):
            self.completed = replace(
                self.completed, OldControlEpisodes=previous.Completed.OldControlEpisodes
            )
            raise strict._Mismatch(previous.Code, previous.Message, previous.Path)
        admitted_old = _need(previous, "OldControls")
        if admitted_old.OldControlEpisodes != 24:
            raise strict._Mismatch(
                "IncompleteReplay", "complete old slice required", "OldControls"
            )
        self.completed = replace(self.completed, OldControlEpisodes=24)

    def invocations(self, raw: object, cert: c.VerifiedCertificate) -> None:
        rows = strict._array(raw, 10, "Falsifiers.InvocationCases")
        roster = _invocation_roster(cert)
        if len(roster) != 10:
            raise strict._Mismatch(
                "ReferenceRoster", "ten invocation cases required", "Reference"
            )
        for index, values in enumerate(roster):
            path = f"Falsifiers.InvocationCases[{index}]"
            expected, normal = _invocation(*values, cert)
            _same(expected, rows[index], path)
            # Read only after exact recursive shape/type/value admission.
            actual = cast(dict[str, c.Json], rows[index])
            logs = cast(list[dict[str, c.Json]], actual["Invocations"])
            if values[0].startswith("stubbed-fallback"):
                try:
                    _same(asdict(normal), actual["Choice"], f"{path}.Choice")
                except strict._Mismatch as mismatch:
                    self.mutants.append(
                        MutantRefusal(
                            values[0], mismatch.code, mismatch.path, mismatch.message
                        )
                    )
                else:
                    raise strict._Mismatch(
                        "UndetectedMutant", "stub must fail the ordinary contract", path
                    )
            self.completed = replace(
                self.completed,
                InvocationCases=index + 1,
                DelegateEntries=self.completed.DelegateEntries
                + sum(cast(int, x["DelegateEntries"]) for x in logs),
                EvaluatorEntries=self.completed.EvaluatorEntries
                + sum(cast(int, x["EvaluatorEntries"]) for x in logs),
            )

    def interventions(self, raw: object, cert: c.VerifiedCertificate) -> None:
        rows = strict._array(raw, 10, "Falsifiers.InterventionCases")
        index = 0
        for kind in _KINDS:
            for strategy in r.STRATEGIES:
                expected = _intervention(kind, strategy, cert)
                _same(expected, rows[index], f"Falsifiers.InterventionCases[{index}]")
                index += 1
                self.completed = replace(self.completed, InterventionCases=index)

    def refusals(self, raw: object, cert: c.VerifiedCertificate) -> None:
        groups = strict._array(raw, 15, "Falsifiers.RefusalCases")
        if len(_REFUSALS) != 15:
            raise strict._Mismatch(
                "ReferenceRoster", "fifteen refusal groups required", "Reference"
            )
        for group, name in enumerate(_REFUSALS):
            path = f"Falsifiers.RefusalCases[{group}]"
            row = strict._object(groups[group], {"CaseId", "Operations"}, path)
            _same(name, row["CaseId"], f"{path}.CaseId")
            roster = _refusal_roster(group)
            operations = strict._array(
                row["Operations"], len(roster), f"{path}.Operations"
            )
            for index, (strategy, effect, depth) in enumerate(roster):
                position = f"{path}.Operations[{index}]"
                expected = _refusal_operation(group, strategy, effect, depth, cert)
                actual = strict._object(operations[index], set(expected), position)
                outcome = strict._object(
                    actual["Outcome"], {"Kind", "Failure"}, f"{position}.Outcome"
                )
                failure = strict._object(
                    outcome["Failure"], _FAILURE_KEYS, f"{position}.Outcome.Failure"
                )
                detail = failure["Detail"]
                if type(detail) is not str or not detail:
                    raise strict._Mismatch(
                        "FailureDetail",
                        "nonempty native detail required",
                        f"{position}.Outcome.Failure.Detail",
                    )
                expected_outcome = cast(dict[str, c.Json], expected["Outcome"])
                expected_failure = cast(dict[str, c.Json], expected_outcome["Failure"])
                expected_failure["Detail"] = detail
                _same(expected, actual, position)
                self.completed = replace(
                    self.completed,
                    RefusalOperations=self.completed.RefusalOperations + 1,
                )
            self.completed = replace(self.completed, RefusalGroups=group + 1)


def replay_falsifiers(
    scalars: object,
    episodes: object,
    old_controls: object,
    falsifiers: object,
    certificate: object,
) -> s.Result[FalsifierReplay]:
    """Replay complete supplied hand data and witnesses; outer bytes stay pending."""
    checker = _Checker()
    try:
        cert = c._admitted(certificate)
        checker.slices(scalars, episodes, old_controls, cert)
        row = strict._object(falsifiers, _TOP, "Falsifiers")
        _same(SCHEMA, row["Schema"], "Falsifiers.Schema")
        _same(list(range(222)), row["ScalarCoverage"], "Falsifiers.ScalarCoverage")
        coverage: list[c.Json] = [
            {"OldIndex": i, "NewIndices": [2 * i, 2 * i + 1]} for i in range(24)
        ]
        _same(coverage, row["HandCoverage"], "Falsifiers.HandCoverage")
        descriptor = _descriptor(
            row["OuterNegativeEvidence"], "Falsifiers.OuterNegativeEvidence"
        )
        checker.invocations(row["InvocationCases"], cert)
        checker.interventions(row["InterventionCases"], cert)
        checker.refusals(row["RefusalCases"], cert)
        if (
            checker.completed != FalsifierCounts(222, 48, 24, 10, 10, 53, 15, 10, 8)
            or len(checker.mutants) != 2
        ):
            raise strict._Mismatch(
                "IncompleteReplay",
                "complete finite witness roster required",
                "Falsifiers",
            )
        return s.Success(
            FalsifierReplay(
                cert.NumericSha256,
                checker.completed,
                tuple(checker.mutants),
                descriptor,
            )
        )
    except strict._Mismatch as mismatch:
        return FalsifierFailure(
            mismatch.code, mismatch.message, mismatch.path, checker.completed
        )
    except s._Refusal as refusal:
        return FalsifierFailure(
            refusal.code, refusal.message, "CertificateOrReference", checker.completed
        )
