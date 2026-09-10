"""Inert complete-plan builders for the fixed M4 and dependent M5 controls.

Import performs no I/O, preparation, numerical call, child launch or registration.
Dependencies must be actually closed bridge sessions before a later plan is built.
The coordinator still admits each returned original plan at its route position.
"""

from __future__ import annotations

import struct
from collections.abc import Mapping
from copy import deepcopy
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .mixed_message_epoch_bridge import Failure, ForecastSource, SessionResult

Tree = dict[str, Any]


@dataclass(frozen=True, slots=True)
class ControlPlan:
    Raw: bytes
    Forecasts: tuple[ForecastSource, ...] = ()


def _bits(value: float) -> str:
    return struct.pack(">d", value).hex().upper()


def _hash(value: object) -> str:
    from . import mixed_message_epoch_bridge as bridge

    return bridge._sha(bridge._canonical(value, bridge.MIB))


def _row(index: int, *, hidden: bool = False) -> Tree:
    value = (-1.0, -0.5, 0.5, 1.0)[index]
    row = {
        "Id": ("control/child-query/" if hidden else "control/learn/") + str(index),
        "Origin": 2 * index,
        "FeatureAvailable": 2 * index,
        "TargetTime": 2 * index + 1,
        "LabelAvailable": 2 * index + 1,
        "Split": "train",
        "Features": [_bits(value), *([_bits(0)] * 7)],
        "Target": None if hidden else _bits(value),
        "Uses": [],
    }
    row["ContentSha256"] = _hash(row)
    return row


def _cut(
    identity: str,
    rows: list[Tree],
    active: list[str],
    *,
    priors: Tree | None = None,
    parent: str | None = None,
) -> Tree:
    return {
        "Id": identity,
        "Rows": rows,
        "ActiveIds": active,
        "PriorOwners": {} if priors is None else priors,
        "ParentCut": parent,
        "Retractions": [],
    }


def _state(cut: Tree) -> Tree:
    return {
        "Revision": 0,
        "Weights": {},
        "GaussianSites": [],
        "GammaSites": [],
        "Outputs": {},
        "ActiveCut": _hash(cut),
    }


def _node(identity: str) -> Tree:
    return {
        "Id": identity,
        "InstancePath": identity,
        "Kind": "neural",
        "Inputs": [],
        "Artifact": identity,
        "Prior": None,
        "Unary": None,
        "Children": None,
        "OutputAlias": None,
    }


def _base(
    identity: str, mode: str, cut: Tree, nodes: list[Tree], bindings: Mapping[str, str]
) -> Tree:
    return {
        "Id": identity,
        "Mode": mode,
        "EvidenceCut": cut,
        "QueryRowId": None,
        "Nodes": nodes,
        "SelectedVersions": {},
        "InitialState": _state(cut),
        "Operations": [],
        "Sweeps": 0,
        "Damping": _bits(1),
        "Training": None,
        "Horizon": 1,
        "SourceBindings": dict(bindings),
    }


def _training(
    identity: str,
    artifact_id: str,
    indices: tuple[int, int],
    cut_end: int,
    ports: list[str],
    bindings: Mapping[str, str],
) -> Tree:
    rows = [_row(index) for index in indices]
    cut = _cut(identity + "/cut", rows, [row["Id"] for row in rows])
    plan = _base(identity, "train", cut, [_node(artifact_id)], bindings)
    plan["Training"] = {
        "Artifacts": [{"Id": artifact_id, "ParentVersion": None, "Ports": ports}],
        "RowIds": {artifact_id: [row["Id"] for row in rows]},
        "CutEnd": cut_end,
        "ChildCuts": {},
        "ChildForecasts": [],
    }
    plan["Operations"] = [
        {
            "Kind": "LearnStep",
            "ArtifactId": artifact_id,
            "Pass": pass_index,
            "RowId": row["Id"],
        }
        for pass_index in range(2)
        for row in rows
    ]
    return plan


def _built(
    plan: Tree, forecasts: tuple[ForecastSource, ...] = ()
) -> ControlPlan | Failure:
    from . import mixed_message_epoch_bridge as bridge

    raw = bridge._canonical(plan, bridge.MIB)
    admitted = bridge.admit_plan(raw, plan["SourceBindings"])
    if isinstance(admitted, bridge.Failure):
        return admitted
    return ControlPlan(raw, forecasts)


def _failure(error: Exception) -> Failure:
    from . import mixed_message_epoch_bridge as bridge

    if isinstance(error, bridge._Stop):
        return error.failure
    return bridge.Failure("Admission", "admit", "ControlPlan", type(error).__name__)


def m4_plan(bindings: Mapping[str, str]) -> ControlPlan | Failure:
    """Construct the two original precision nodes; do not enter either service."""
    try:
        row: Tree = {
            "Id": "control/m4/query",
            "Origin": 0,
            "FeatureAvailable": 0,
            "TargetTime": 1,
            "LabelAvailable": 1,
            "Split": "control",
            "Features": [_bits(0)] * 8,
            "Target": None,
            "Uses": [],
        }
        row["ContentSha256"] = _hash(row)
        nodes: list[Tree] = []
        priors: Tree = {}
        for identity, eta, precision, linear, owner in (
            ("control/0-positive", 1.5, 1.0, -0.75, "control/m4/prior-positive"),
            (
                "control/1-cancellation",
                0.0,
                1e-300,
                0.0,
                "control/m4/prior-cancellation",
            ),
        ):
            node = _node(identity)
            node.update(
                Kind="precision-gate",
                Artifact=None,
                Prior={
                    "Gaussian": {
                        "PrecisionMean": _bits(eta),
                        "Precision": _bits(precision),
                    },
                    "Gammas": [],
                },
                Unary={"K": _bits(linear), "C": _bits(1)},
            )
            nodes.append(node)
            priors[
                _hash(
                    {
                        "Kind": "mixed-epoch-variable-v1",
                        "InstancePath": identity,
                        "Role": "z",
                    }
                )
            ] = owner
        cut = _cut("control/m4/cut", [row], [row["Id"]], priors=priors)
        plan = _base("control/m4", "query", cut, nodes, bindings)
        plan.update(
            QueryRowId=row["Id"],
            Sweeps=1,
            Operations=[
                {"Kind": "GaussianBlock", "NodeId": node["Id"], "Sweep": 0}
                for node in nodes
            ],
        )
        return _built(plan)
    except Exception as error:  # noqa: BLE001 - bounded builder returns typed failure.
        return _failure(error)


def m5_child_plan(bindings: Mapping[str, str]) -> ControlPlan | Failure:
    """Construct only the first child-training plan in the four-session route."""
    try:
        return _built(
            _training(
                "control/m5/child-train",
                "control/child",
                (0, 1),
                3,
                ["absent", "absent"],
                bindings,
            )
        )
    except Exception as error:  # noqa: BLE001 - bounded builder returns typed failure.
        return _failure(error)


def _child(child: SessionResult) -> tuple[Tree, Tree]:
    from . import mixed_message_epoch_bridge as bridge

    bridge._check_session_seal(child)
    if child.Plan is None or child.EpochReturn is None or not child.ForecastEligible:
        bridge._fail(
            "Service", "admit", "Child", "actual closed child training result required"
        )
    expected = _training(
        "control/m5/child-train",
        "control/child",
        (0, 1),
        3,
        ["absent", "absent"],
        child.Plan.Value["SourceBindings"],
    )
    if child.Plan.Value != expected:
        bridge._fail(
            "Conflict", "admit", "Child.Plan", "fixed original child plan required"
        )
    artifacts = child.EpochReturn.Value["Result"]["ProposedArtifacts"]
    if (
        len(artifacts) != 1
        or artifacts[0]["Id"] != "control/child"
        or artifacts[0]["TrainingCut"] != _hash(expected["EvidenceCut"])
    ):
        bridge._fail(
            "Conflict",
            "admit",
            "Child.Artifact",
            "one actual artifact from the fixed child cut required",
        )
    return expected, deepcopy(artifacts[0])


def _query(child: SessionResult, index: int) -> ControlPlan | Failure:
    try:
        original, artifact = _child(child)
        query = _row(index, hidden=True)
        cut = _cut(
            "control/m5/query-" + str(index) + "/cut",
            [*deepcopy(original["EvidenceCut"]["Rows"]), query],
            [query["Id"]],
            parent=_hash(original["EvidenceCut"]),
        )
        plan = _base(
            "control/m5/query-" + str(index),
            "query",
            cut,
            deepcopy(original["Nodes"]),
            original["SourceBindings"],
        )
        plan.update(
            QueryRowId=query["Id"],
            SelectedVersions={
                "control/child": {"Version": _hash(artifact), "Artifact": artifact}
            },
            Sweeps=1,
            Operations=[
                {"Kind": "NeuralForward", "NodeId": "control/child", "Sweep": 0}
            ],
        )
        return _built(plan)
    except Exception as error:  # noqa: BLE001 - missing real dependency never becomes a fabricated plan.
        return _failure(error)


def m5_query_two_plan(child: SessionResult) -> ControlPlan | Failure:
    return _query(child, 2)


def m5_query_three_plan(child: SessionResult) -> ControlPlan | Failure:
    return _query(child, 3)


def m5_parent_plan(
    child: SessionResult, query_two: SessionResult, query_three: SessionResult
) -> ControlPlan | Failure:
    """Use the two full actual query returns, preserving their original bundles."""
    from . import mixed_message_epoch_bridge as bridge

    try:
        original, artifact = _child(child)
        plan = _training(
            "control/m5/parent-train",
            "control/parent",
            (2, 3),
            7,
            ["required", "absent"],
            original["SourceBindings"],
        )
        plan["Training"]["ChildCuts"] = {
            _hash(original["EvidenceCut"]): deepcopy(original["EvidenceCut"])
        }
        forecasts: list[ForecastSource] = []
        for index, session in ((2, query_two), (3, query_three)):
            expected = _query(child, index)
            if not isinstance(expected, ControlPlan):
                return expected
            bridge._check_session_seal(session)
            if (
                session.Plan is None
                or session.Plan.Raw != expected.Raw
                or session.EpochReturn is None
            ):
                bridge._fail(
                    "Conflict",
                    "admit",
                    "Query.Plan",
                    "fixed actual dependent query plan required",
                )
            source = bridge.forecast_source(session)
            if isinstance(source, bridge.Failure):
                return source
            forecasts.append(source)
            output = session.EpochReturn.Value["Result"]["LastCommitted"]["Outputs"][
                "control/child"
            ]
            sequence = output["SourceSequence"]
            commits = [
                frame
                for frame in session.Commits
                if frame.Value["Sequence"] == sequence
            ]
            if len(commits) != 1:
                bridge._fail(
                    "Conflict",
                    "admit",
                    "Query.Commit",
                    "one observed successful producer commit required",
                )
            plan["Training"]["ChildForecasts"].append(
                {
                    "ArtifactId": "control/parent",
                    "TrainingRowId": "control/learn/" + str(index),
                    "TargetSlot": 0,
                    "BundleSha256": source.ExpectedSha256,
                    "QueryRowId": "control/child-query/" + str(index),
                    "ProducerNode": "control/child",
                    "OutputPort": "mean",
                    "ProducerVersion": _hash(artifact),
                    "ProducerTrainingCut": artifact["TrainingCut"],
                    "ObservationSequence": sequence,
                    "CommitRevision": commits[0].Value["AppliedRevision"],
                    "Mean": output["Mean"],
                }
            )
        return _built(plan, tuple(forecasts))
    except Exception as error:  # noqa: BLE001 - retain refusal without entering any service.
        return _failure(error)


def frozen_nested_query_plan(
    child: SessionResult, parent: SessionResult, query_row: Mapping[str, object]
) -> ControlPlan | Failure:
    """Build a separate frozen query, outside the four-session M5 ledger.

    The caller preregisters the exact supplied hidden row and a fresh finite
    single-session budget. Both weights come from received closed training
    results; no learner, projection, process or recorder is entered here.
    """
    from . import mixed_message_epoch_bridge as bridge

    try:
        child_plan, child_artifact = _child(child)
        bridge._check_session_seal(parent)
        if (
            parent.Plan is None
            or parent.EpochReturn is None
            or not parent.ForecastEligible
        ):
            bridge._fail(
                "Service",
                "admit",
                "Parent",
                "actual closed parent training return required",
            )
        source_plan = parent.Plan.Value
        if (
            source_plan["Id"] != "control/m5/parent-train"
            or source_plan["Mode"] != "train"
            or source_plan["SourceBindings"] != child_plan["SourceBindings"]
        ):
            bridge._fail(
                "Conflict",
                "admit",
                "Parent.Plan",
                "closed source-bound parent training required",
            )
        artifacts = parent.EpochReturn.Value["Result"]["ProposedArtifacts"]
        if (
            len(artifacts) != 1
            or artifacts[0]["Id"] != "control/parent"
            or artifacts[0]["TrainingCut"] != _hash(source_plan["EvidenceCut"])
        ):
            bridge._fail(
                "Conflict",
                "admit",
                "Parent.Artifact",
                "one actual parent artifact from its complete cut required",
            )
        parent_artifact = deepcopy(artifacts[0])
        query: Tree = deepcopy(dict(query_row))
        if (
            query.get("Target") is not None
            or type(query.get("Origin")) is not int
            or query["Origin"]
            < max(child_plan["Training"]["CutEnd"], source_plan["Training"]["CutEnd"])
        ):
            bridge._fail(
                "Conflict",
                "admit",
                "QueryRow",
                "independently supplied target-hidden row must follow both training cuts",
            )
        rows = [
            *deepcopy(child_plan["EvidenceCut"]["Rows"]),
            *deepcopy(source_plan["EvidenceCut"]["Rows"]),
            query,
        ]
        cut = _cut(
            "control/m5/frozen-nested/cut",
            rows,
            [query["Id"]],
            parent=_hash(source_plan["EvidenceCut"]),
        )
        parent_node = _node("control/parent")
        parent_node["Inputs"] = [
            {"SourceNode": "control/child", "SourcePort": "mean", "TargetSlot": 0}
        ]
        alias = {
            "Id": "control/nested",
            "InstancePath": "control/nested",
            "Kind": "composite",
            "Inputs": [],
            "Artifact": None,
            "Prior": None,
            "Unary": None,
            "Children": ["control/child", "control/parent"],
            "OutputAlias": {"SourceNode": "control/parent", "SourcePort": "mean"},
        }
        plan = _base(
            "control/m5/frozen-nested",
            "query",
            cut,
            [_node("control/child"), parent_node, alias],
            child_plan["SourceBindings"],
        )
        plan.update(
            QueryRowId=query["Id"],
            Sweeps=1,
            SelectedVersions={
                artifact["Id"]: {"Version": _hash(artifact), "Artifact": artifact}
                for artifact in (child_artifact, parent_artifact)
            },
            Operations=[
                {"Kind": "NeuralForward", "NodeId": identity, "Sweep": 0}
                for identity in ("control/child", "control/parent")
            ],
        )
        return _built(plan)
    except Exception as error:  # noqa: BLE001 - absent actual dependency is an explicit builder refusal.
        return _failure(error)
