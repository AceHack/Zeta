"""Owned Python/synthetic witnesses, never native-produced conformance data.

Fixture ledgers are assembled here from the old Python full runner and the
independent numerical APIs, without importing checker expectation routines.
The checker executes its own live reference calls. No registered RNG, native
runtime, external artifact admission or timing experiment occurs.
"""

import copy
import struct
from dataclasses import asdict, replace

import pytest

from zeta_interp import hidden_switch_compiled_certificate as c
from zeta_interp import hidden_switch_compiled_falsifiers as f
from zeta_interp import hidden_switch_compiled_ieee as s
from zeta_interp import hidden_switch_compiled_old_replay as old_replay
from zeta_interp import hidden_switch_compiled_reference as r
from zeta_interp import hidden_switch_compiled_replay as new_replay
from zeta_interp import hidden_switch_reference as previous

BINDINGS = {"ProtocolSha256": c.PROTOCOL_SHA256, "fixture/independent.py": "A" * 64}
STRATEGIES = ("native-recursive", "compiled-guarded")
KINDS = (
    "action-before-feedback",
    "future-suffix",
    "scorer-receipt-noninterference",
    "private-band-noninterference",
    "caller-copy-isolation",
)
REFUSALS = (
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


def value(result):
    assert isinstance(result, s.Success), result
    return result.value


def bits(number):
    return struct.pack(">d", number).hex().upper()


def snapshot(belief, seen=0, pending=-1):
    return {
        "Effect": True,
        "Geometry": "dot",
        "BeliefBits": belief,
        "Observed": seen,
        "PendingAction": pending,
        "FilterCounters": {"Predictions": max(0, seen - 1), "Updates": seen},
    }


def event(seq, kind, index, before, after):
    return {
        "Sequence": seq,
        "Kind": kind,
        "Index": index,
        "Input": before,
        "Output": after,
    }


def cells(frame):
    return "".join(map(str, frame.Cells))


def frame_for(cue, index=0, reward=None):
    return value(r.render(cue, "dot", "fixed", index, reward))


def old_episode(tape, effect=True, geometry="dot", palette="fixed", index=18):
    return previous.run_episode(
        "belief-depth3",
        effect,
        geometry,
        palette,
        previous.Tape(tape.initial, tape.drift, tape.errors),
        index,
    )


def ledger(strategy, tape, cert):
    old = old_episode(tape)
    episode = value(
        r.run_episode(strategy, True, "dot", "fixed", tape, 18, certificate=cert)
    )
    assert old["Actions"] == episode["Actions"]
    assert [bits(x) for x in old["Beliefs"]] == episode["BeliefBits"]
    events = []
    current = snapshot(bits(0.5))
    for i in range(17):
        frame = frame_for(int(old["Cues"][i]), i, old["Reward4"][i - 1] if i else None)
        projection = value(r.project(frame))
        observed = snapshot(bits(old["Beliefs"][i]), i + 1)
        events.append(
            event(
                len(events),
                "observe",
                i,
                {"Cells": cells(projection), "Before": current},
                {"Cue": int(old["Cues"][i]), "After": observed},
            )
        )
        current = observed
        if i == 16:
            break
        action = int(old["Actions"][i])
        committed = snapshot(bits(old["Beliefs"][i]), i + 1, action)
        events.append(
            event(
                len(events),
                "choose",
                i,
                {"Before": current},
                {"Choice": episode["ChoiceWork"][i], "After": committed},
            )
        )
        events.append(
            event(
                len(events),
                "feedback",
                i,
                {
                    "State": int(old["States"][i]),
                    "Action": action,
                    "Drift": tape.drift[i],
                },
                {"State": int(old["States"][i + 1]), "Reward4": old["Reward4"][i]},
            )
        )
        current = committed
    return events, episode, current


def choice(strategy, belief, cert):
    return asdict(
        value(
            r.native_choice(belief, True, 3)
            if strategy == STRATEGIES[0]
            else r.compiled_choice(cert, belief, True, 3)
        )
    )


def simple_prefix(strategy, cert):
    projected = value(r.project(frame_for(0)))
    seen = snapshot(bits(0.25), 1)
    selected = choice(strategy, int(bits(0.25), 16), cert)
    committed = snapshot(bits(0.25), 1, selected["Action"])
    events = [
        event(
            0,
            "observe",
            0,
            {"Cells": cells(projected), "Before": snapshot(bits(0.5))},
            {"Cue": 0, "After": seen},
        ),
        event(
            1, "choose", 0, {"Before": seen}, {"Choice": selected, "After": committed}
        ),
    ]
    return events, projected, selected


def copy_fixture(strategy, cert):
    events, first, selected = simple_prefix(strategy, cert)
    second = value(r.project(frame_for(1)))
    control = choice(strategy, int(bits(0.75), 16), cert)
    observed = snapshot(bits(0.75), 1)
    control_after = snapshot(bits(0.75), 1, control["Action"])
    retained = events[1]["Output"]["After"]
    selected_event = copy.deepcopy(events[1])
    selected_event["Sequence"] = 2
    events = [
        events[0],
        event(1, "caller-mutate", 0, {"Cells": cells(first)}, {"Cells": cells(second)}),
        selected_event,
        event(
            3,
            "observe",
            0,
            {"Cells": cells(second), "Before": snapshot(bits(0.5))},
            {"Cue": 1, "After": observed},
        ),
        event(
            4,
            "choose",
            0,
            {"Before": observed},
            {"Choice": control, "After": control_after},
        ),
    ]
    return {
        "CaseId": f"caller-copy-isolation/{strategy}",
        "Strategy": strategy,
        "Input": {"Effect": True, "Geometry": "dot", "Palette": "fixed"},
        "Before": {"Cells": cells(first), "Snapshot": snapshot(bits(0.25), 1)},
        "After": {
            "Cells": cells(second),
            "RetainedChoice": selected,
            "RetainedSnapshot": retained,
            "ControlObservedSnapshot": observed,
            "ControlChoice": control,
            "ControlSnapshot": control_after,
        },
        "Events": events,
    }


def tape_json(tape):
    return {
        "Initial": tape.initial,
        "Drift": "".join(map(str, tape.drift)),
        "Errors": "".join(map(str, tape.errors)),
    }


def intervention_fixture(kind, strategy, cert):
    if kind == "caller-copy-isolation":
        return copy_fixture(strategy, cert)
    tape = dict(r.hand_tapes())["sparse"]
    chronology, baseline, _ = ledger(strategy, tape, cert)
    row = {
        "CaseId": f"{kind}/{strategy}",
        "Strategy": strategy,
        "Input": {
            "Tape": "sparse",
            "Effect": True,
            "Geometry": "dot",
            "Palette": "fixed",
            "Index": 18,
        },
        "Before": baseline,
        "After": copy.deepcopy(baseline),
        "Events": [],
    }
    if kind == KINDS[0]:
        row["Before"], row["Events"] = None, chronology
    elif kind == KINDS[1]:
        drift = list(tape.drift)
        drift[8] ^= 1
        other = r.Tape(tape.initial, tuple(drift), tape.errors)
        row["After"] = value(
            r.run_episode(strategy, True, "dot", "fixed", other, 18, certificate=cert)
        )
        row["Events"] = [
            event(
                0,
                "tape-replace",
                8,
                {"Tape": tape_json(tape)},
                {"Tape": tape_json(other)},
            )
        ]
    elif kind == KINDS[2]:
        row["After"]["Reward4"], row["After"]["TotalReward4"] = [0] * 16, 0
        row["Events"] = [
            event(i, "score", i, {"Reward4": reward}, {"Reward4": 0})
            for i, reward in enumerate(baseline["Reward4"])
        ]
    else:
        pattern = bytes([0, 1] * 256)
        row["After"] = value(
            r.run_episode(
                strategy,
                True,
                "dot",
                "fixed",
                tape,
                18,
                certificate=cert,
                private_band=pattern,
            )
        )
        for i, cue in enumerate(baseline["Cues"]):
            original = frame_for(int(cue), i, baseline["Reward4"][i - 1] if i else None)
            replaced = r.Frame(bytes(original.Cells[:1536]) + pattern)
            row["Events"].append(
                event(
                    i,
                    "frame-replace",
                    i,
                    {"Cells": cells(original)},
                    {"Cells": cells(replaced)},
                )
            )
    return row


def invocation_fixtures(cert):
    entries = [
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
    for prefix in ("real-fallback", "stubbed-fallback"):
        for depth in (2, 3):
            guard = cert.Guards[depth - 2]
            belief = value(s.next_up(guard.SmaxBits))
            assert s._value(belief) < s._value(guard.HminBits)
            entries.append((f"{prefix}-depth-{depth}", "guarded", belief, True, depth))
    rows = []
    for case, mode, belief, effect, depth in entries:
        actual = value(r.native_choice(belief, effect, depth))
        stub = case.startswith("stubbed")
        if stub:
            actual = r.Choice(1 - actual.Action, 0, 0, 0, 0, 0, 0, 0)
        input_row = {"BeliefBits": f"{belief:016X}", "Effect": effect, "Depth": depth}
        rows.append(
            {
                "CaseId": case,
                "Input": input_row,
                "Mode": mode,
                "Choice": asdict(
                    replace(
                        actual,
                        Path=4,
                        GuardComparisons=0 if mode == "unsupported-runtime" else 2,
                    )
                ),
                "Invocations": [
                    {
                        "Sequence": 0,
                        "Kind": "deliberate-stub" if stub else "real-recursive",
                        "Input": input_row,
                        "DelegateEntries": 1,
                        "EvaluatorEntries": 0 if stub else 1,
                        "Returned": asdict(actual),
                        "Failure": None,
                    }
                ],
                "Mutation": {
                    "BaselineCaseId": f"real-fallback-depth-{depth}",
                    "Kind": "opposite-action-no-evaluator",
                }
                if stub
                else None,
            }
        )
    return rows


def counts(entries=0, services=0, evaluators=0):
    return {
        "EntryCalls": entries,
        "ServiceEntries": services,
        "EvaluatorEntries": evaluators,
    }


def refusal_fixtures(cert):
    groups = []
    bad = (
        "7FF8000000000000",
        "7FF0000000000000",
        "FFF0000000000000",
        "8000000000000001",
        "3FF0000000000001",
    )
    for group, case in enumerate(REFUSALS):
        if group < 5:
            roster = [
                (arm, effect, depth)
                for arm in STRATEGIES
                for effect, depth in ((True, 1), (False, 3), (True, 3))
            ]
        elif group < 7:
            roster = [
                (arm, effect, 0 if group == 5 else 4)
                for arm in STRATEGIES
                for effect in (True, False)
            ]
        elif group < 14:
            roster = [(arm, True, 3) for arm in STRATEGIES]
        else:
            roster = [("common", True, 3)]
        operations = []
        for arm, effect, depth in roster:
            ident = f"{case}/{arm}"
            setup = {"Initial": None, "Events": []}
            setup_counts, tested_counts = counts(), counts(1)
            stage, code = "policy", "belief"
            if group < 7:
                ident += f"/effect-{str(effect).lower()}-depth-{depth}"
                operation = "fixture-raw-bits-service"
                given = {
                    "BeliefBits": bad[group] if group < 5 else bits(0.5),
                    "Effect": effect,
                    "Depth": depth,
                }
                tested_counts = counts(1, 1)
                if group >= 5:
                    code = "depth"
            elif group == 7:
                operation, stage, code = "parse-dispatch", "input", "binary64-bits"
                given = {"BeliefBits": "3fe0000000000000", "Effect": True, "Depth": 3}
            elif group == 14:
                operation, code = "predict", "prediction-input"
                given = {"BeliefBits": bits(0.5), "Effect": True, "Action": 2}
            else:
                events, projection, selected = simple_prefix(arm, cert)
                setup["Initial"], setup_counts = snapshot(bits(0.5)), counts(1)
                if group == 11:
                    setup["Events"], setup_counts = events[:1], counts(2)
                elif group == 12:
                    setup["Events"], setup_counts = (
                        events,
                        counts(3, 1, selected["RecursiveCalls"]),
                    )
                elif group == 13:
                    setup["Events"], ep, _ = ledger(
                        arm, dict(r.hand_tapes())["sparse"], cert
                    )
                    setup_counts = counts(
                        34, 16, sum(w["RecursiveCalls"] for w in ep["ChoiceWork"])
                    )
                if group in (8, 9, 11):
                    raw = bytearray(projection.Cells)
                    if group == 8:
                        raw[0] = 2
                    given = {
                        "Frame": {
                            "Width": 63 if group == 9 else 64,
                            "Height": 32,
                            "Palette": 2,
                            "CellsHex": raw.hex().upper(),
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
                else:
                    given, operation, code = {}, "choose", "choice-order"
            failure = {
                "Stage": stage,
                "Code": code,
                "Detail": "synthetic native-style refusal",
                "Panel": None,
                "Mode": None,
                "Strategy": None,
                "Replicate": None,
                "Episode": None,
                "Call": None,
            }
            operations.append(
                {
                    "OperationId": ident,
                    "Strategy": arm,
                    "Operation": operation,
                    "Input": given,
                    "Setup": setup,
                    "Outcome": {"Kind": "refused", "Failure": failure},
                    "Calls": {"Setup": setup_counts, "Operation": tested_counts},
                }
            )
        groups.append({"CaseId": case, "Operations": operations})
    return groups


@pytest.fixture(scope="module")
def data():
    cert = value(c.verify_certificate(value(c.build_certificate(BINDINGS)), BINDINGS))
    scalars, hands, controls = [], [], []
    for item in value(r.scalar_roster(cert)):
        belief, effect, depth = (
            int(item["BeliefBits"], 16),
            item["Effect"],
            item["Depth"],
        )
        scalars.append(
            {
                "Input": item,
                "QBits": [
                    f"{b:016X}"
                    for b in value(r.evaluate_bits(belief, effect, depth)).QBits
                ],
                "Native": asdict(value(r.native_choice(belief, effect, depth))),
                "Compiled": asdict(
                    value(r.compiled_choice(cert, belief, effect, depth))
                ),
            }
        )
    for name, tape in r.hand_tapes():
        for effect in (True, False):
            for geometry, palette in (
                ("dot", "fixed"),
                ("bar", "fixed"),
                ("dot", "odd-complement"),
            ):
                index = len(controls)
                header = {
                    "Tape": name,
                    "Effect": effect,
                    "Geometry": geometry,
                    "Palette": palette,
                }
                controls.append(
                    {
                        **header,
                        "Episode": old_episode(tape, effect, geometry, palette, index),
                    }
                )
                for arm in STRATEGIES:
                    hands.append(
                        {
                            **header,
                            "Strategy": arm,
                            "Episode": value(
                                r.run_episode(
                                    arm,
                                    effect,
                                    geometry,
                                    palette,
                                    tape,
                                    index,
                                    certificate=cert,
                                )
                            ),
                        }
                    )
    falsifiers = {
        "Schema": "zeta.hidden-switch.compiled.falsifiers.v1",
        "ScalarCoverage": list(range(222)),
        "HandCoverage": [
            {"OldIndex": i, "NewIndices": [2 * i, 2 * i + 1]} for i in range(24)
        ],
        "InvocationCases": invocation_fixtures(cert),
        "InterventionCases": [
            intervention_fixture(kind, arm, cert)
            for kind in KINDS
            for arm in STRATEGIES
        ],
        "RefusalCases": refusal_fixtures(cert),
        "OuterNegativeEvidence": {
            "File": "not-opened/outer.json",
            "Bytes": 1,
            "Sha256": "A" * 64,
            "Encoding": "identity",
            "StoredBytes": 1,
            "StoredSha256": "A" * 64,
        },
    }
    return cert, scalars, hands, controls, falsifiers


def replay(data, changed=None):
    cert, scalars, hands, controls, falsifiers = data
    return f.replay_falsifiers(
        scalars, hands, controls, falsifiers if changed is None else changed, cert
    )


def test_complete_live_replay_and_actual_invalid_service_paths(data, monkeypatch):
    calls = []
    native, compiled = r.native_choice, r.compiled_choice
    for name, original in (("native", native), ("compiled", compiled)):

        def spy(*args, _name=name, _original=original, **kwargs):
            b, effect, depth = args if _name == "native" else args[1:]
            if b in tuple(
                int(x, 16)
                for x in (
                    "7FF8000000000000",
                    "7FF0000000000000",
                    "FFF0000000000000",
                    "8000000000000001",
                    "3FF0000000000001",
                )
            ) or depth not in (1, 2, 3):
                calls.append((_name, b, effect, depth))
            return _original(*args, **kwargs)

        monkeypatch.setattr(
            r, "native_choice" if name == "native" else "compiled_choice", spy
        )

    def forbidden(*args, **kwargs):
        raise AssertionError(
            "pure checker must not open files or call old runner/source generators"
        )

    monkeypatch.setattr(previous, "run_episode", forbidden)
    monkeypatch.setattr(previous, "source_tapes", forbidden)
    monkeypatch.setattr(r, "source_tapes", forbidden)
    monkeypatch.setattr("builtins.open", forbidden)
    result = value(replay(data))
    assert result.Completed == f.FalsifierCounts(222, 48, 24, 10, 10, 53, 15, 10, 8)
    assert len(calls) == 38
    assert sum(x[0] == "compiled" for x in calls) == 19
    assert ("compiled", int("7FF8000000000000", 16), True, 1) in calls
    assert ("compiled", int("FFF0000000000000", 16), False, 3) in calls
    assert len(result.MutantRefusals) == 2
    assert all(
        x.Path.endswith(".Choice.Action") and x.Code == "ValueMismatch"
        for x in result.MutantRefusals
    )
    assert result.OuterNegativeAdmission == "pending-coordinator-replay"
    assert result.RuntimeAdmission == "not-performed-by-pure-replay"


MUTANTS = [
    (["Schema"], "other"),
    (["ScalarCoverage", 221], 220),
    (["ScalarCoverage", 0], False),
    (["HandCoverage", 23, "NewIndices", 1], 46),
    (["InvocationCases", 0, "Input", "Effect"], 1),
    (["InvocationCases", 0, "Choice", "GuardComparisons"], 1),
    (["InvocationCases", 0, "Invocations", 0, "DelegateEntries"], 0),
    (["InvocationCases", 0, "Invocations", 0, "EvaluatorEntries"], 21),
    (["InvocationCases", 0, "Invocations", 0, "Returned", "Nodes"], 21),
    (["InvocationCases", 6, "Choice", "Path"], 1),
    (["InvocationCases", 8, "Invocations", 0, "EvaluatorEntries"], 1),
    (["InvocationCases", 8, "Invocations", 0, "Returned", "Nodes"], 5),
    (["InvocationCases", 8, "Mutation", "BaselineCaseId"], "real-fallback-depth-3"),
    (["InterventionCases", 0, "Events", 1, "Kind"], "feedback"),
    (["InterventionCases", 0, "Events", 48, "Index"], 15),
    (["InterventionCases", 2, "Events", 0, "Index"], 7),
    (["InterventionCases", 4, "After", "Reward4", 15], 4),
    (["InterventionCases", 4, "After", "TotalReward4"], -1),
    (["InterventionCases", 4, "Events", 0, "Output", "Reward4"], -1),
    (["InterventionCases", 6, "Events", 16, "Output", "Cells"], "0" * 2048),
    (["InterventionCases", 8, "After", "ControlObservedSnapshot", "Observed"], 2),
    (
        ["InterventionCases", 8, "Events", 3, "Input", "Before", "BeliefBits"],
        "3FD0000000000000",
    ),
    (["RefusalCases", 0, "Operations", 3, "Calls", "Operation", "ServiceEntries"], 0),
    (["RefusalCases", 0, "Operations", 3, "Outcome", "Failure", "Stage"], "input"),
    (["RefusalCases", 0, "Operations", 3, "Outcome", "Failure", "Code"], "nonfinite"),
    (["RefusalCases", 7, "Operations", 0, "Calls", "Operation", "ServiceEntries"], 1),
    (["RefusalCases", 8, "Operations", 0, "Input", "Frame", "Width"], 63),
    (["RefusalCases", 10, "Operations", 0, "Calls", "Setup", "EntryCalls"], 0),
    (["RefusalCases", 12, "Operations", 1, "Calls", "Setup", "EntryCalls"], 2),
    (["RefusalCases", 13, "Operations", 0, "Calls", "Setup", "EntryCalls"], 50),
    (
        [
            "RefusalCases",
            13,
            "Operations",
            0,
            "Setup",
            "Events",
            48,
            "Output",
            "After",
            "Observed",
        ],
        16,
    ),
    (["RefusalCases", 14, "Operations", 0, "Input", "Action"], 0),
    (["RefusalCases", 14, "Operations", 0, "Outcome", "Failure", "Detail"], ""),
    (["RefusalCases", 14, "Operations", 0, "Outcome", "Failure", "Episode"], 18),
    (["OuterNegativeEvidence", "Bytes"], True),
    (["OuterNegativeEvidence", "StoredBytes"], 2),
    (["OuterNegativeEvidence", "File"], "../outer.json"),
    (["OuterNegativeEvidence", "Sha256"], "a" * 64),
    (["OuterNegativeEvidence", "Encoding"], "gzip"),
]


@pytest.mark.parametrize("path,replacement", MUTANTS)
def test_exact_nested_mutations_refuse(data, path, replacement):
    changed = copy.deepcopy(data[4])
    node = changed
    for part in path[:-1]:
        node = node[part]
    node[path[-1]] = replacement
    result = replay(data, changed)
    assert isinstance(result, f.FalsifierFailure), result
    assert result.Path.startswith("Falsifiers.")
    assert result.OuterNegativeAdmission == "pending-coordinator-replay"


@pytest.mark.parametrize(
    "key", ["InvocationCases", "InterventionCases", "RefusalCases"]
)
@pytest.mark.parametrize("mutation", ["omit", "duplicate", "reorder", "extra-key"])
def test_complete_ordered_case_rosters(data, key, mutation):
    changed = copy.deepcopy(data[4])
    rows = changed[key]
    if mutation == "omit":
        rows.pop()
    elif mutation == "duplicate":
        rows[1] = copy.deepcopy(rows[0])
    elif mutation == "reorder":
        rows[0], rows[1] = rows[1], rows[0]
    else:
        rows[0]["Passed"] = True
    assert isinstance(replay(data, changed), f.FalsifierFailure)


def test_late_failure_counts_only_checked_operations(data):
    changed = copy.deepcopy(data[4])
    changed["RefusalCases"][14]["Operations"][0]["Input"]["Action"] = 0
    failure = replay(data, changed)
    assert isinstance(failure, f.FalsifierFailure)
    assert failure.Completed == f.FalsifierCounts(222, 48, 24, 10, 10, 52, 14, 10, 8)
    assert failure.Path.endswith(".Input.Action")


def test_source_acceptance_bug_cannot_hide_behind_admission_helper(data, monkeypatch):
    original = r.compiled_choice

    def broken(cert, belief, effect, depth, **kwargs):
        if belief == int("7FF8000000000000", 16) and depth == 1:
            return s.Success(r.Choice(0, 3, 0, 0, 0, 0, 0, 0))
        return original(cert, belief, effect, depth, **kwargs)

    monkeypatch.setattr(r, "compiled_choice", broken)
    failure = replay(data)
    assert isinstance(failure, f.FalsifierFailure)
    assert failure.Code == "ReferenceAccepted"
    assert failure.Completed.RefusalOperations == 3


def test_empty_reference_roster_cannot_pass(data, monkeypatch):
    monkeypatch.setattr(f, "_invocation_roster", lambda cert: [])
    failure = replay(data)
    assert isinstance(failure, f.FalsifierFailure)
    assert failure.Code == "ReferenceRoster"
    assert failure.Completed.InvocationCases == 0


def test_all_raw_slices_are_checked_and_prefixes_preserved(data):
    cert, scalars, hands, controls, witnesses = data
    changed = copy.deepcopy(controls)
    changed[23]["Episode"]["TreeRootQ"][15][0] = 0.0
    failure = f.replay_falsifiers(scalars, hands, changed, witnesses, cert)
    assert isinstance(failure, f.FalsifierFailure)
    assert failure.Completed == f.FalsifierCounts(222, 48, 23)
    assert "TreeRootQ" in failure.Path
    changed_hands = copy.deepcopy(hands)
    changed_hands[47]["Episode"]["ProjectionSha256"][16] = "F" * 64
    failure = f.replay_falsifiers(scalars, changed_hands, controls, witnesses, cert)
    assert isinstance(failure, f.FalsifierFailure)
    assert failure.Completed == f.FalsifierCounts(222, 47)


def test_no_incomplete_raw_slice_admission_waiver(data, monkeypatch):
    monkeypatch.setattr(
        old_replay,
        "replay_old_hand",
        lambda rows: s.Success(old_replay.OldReplayCounts("fake", 0, 0, 0, 0)),
    )
    failure = replay(data)
    assert isinstance(failure, f.FalsifierFailure)
    assert failure.Code == "IncompleteReplay"
    assert failure.Completed == f.FalsifierCounts(222, 48)


def test_complete_slices_called_once_and_external_descriptor_stays_unopened(
    data, monkeypatch
):
    calls = []
    first, second = new_replay.replay_scalar_and_new_hand, old_replay.replay_old_hand

    def new(*args):
        calls.append("new")
        return first(*args)

    def old(*args):
        calls.append("old")
        return second(*args)

    monkeypatch.setattr(new_replay, "replay_scalar_and_new_hand", new)
    monkeypatch.setattr(old_replay, "replay_old_hand", old)
    result = value(replay(data))
    assert calls == ["new", "old"]
    result.OuterNegativeEvidence["File"] = "changed"
    assert data[4]["OuterNegativeEvidence"]["File"] == "not-opened/outer.json"


@pytest.mark.parametrize("bad", [None, {}, True, "certificate"])
def test_unissued_certificate_is_typed_refusal(data, bad):
    _, scalars, hands, controls, witnesses = data
    failure = f.replay_falsifiers(scalars, hands, controls, witnesses, bad)
    assert isinstance(failure, f.FalsifierFailure)
    assert failure.Completed == f.FalsifierCounts()
