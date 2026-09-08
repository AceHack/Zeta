"""Fixed first-control invocation; execution requires separate frozen admission.

Import is inert. This artifact does not select data, fit a replacement model,
retry a route, evaluate a numerical pass verdict, or serialize BridgeResult.
Its stdout is a caller receipt referencing the bridge's original durable records.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import asdict
from pathlib import Path

from zeta_interp import hidden_switch_compiled_record_store as records
from zeta_interp import mixed_message_epoch_bridge as bridge
from zeta_interp import mixed_message_epoch_controls as controls


def emit(kind: str, value: object) -> None:
    print(json.dumps({"Kind": kind, "Value": value}, allow_nan=False), flush=True)


def final_receipt(result: bridge.BridgeResult) -> None:
    finalized = result.Finalization
    journal = (
        finalized.Returned.Artifact.descriptor()
        if finalized is not None
        and finalized.Raised is None
        and isinstance(finalized.Returned, records.Finalized)
        else None
    )
    emit(
        "ActualBridgeSummary",
        {
            "AttemptRoot": result.AttemptRoot,
            "AttemptOwned": result.AttemptOwned,
            "Route": result.Route,
            "Closed": result.Closed,
            "Failure": None if result.Failure is None else asdict(result.Failure),
            "SecondaryFailures": [asdict(item) for item in result.SecondaryFailures],
            "Counters": result.Counters,
            "FinalRecord": None
            if result.FinalRecord is None
            else result.FinalRecord.descriptor(),
            "FinalJournal": journal,
            "FullActualReturnRetention": "memory; existing original records are referenced",
            "NumericalControlVerdict": "not evaluated by this invocation",
        },
    )


def session(
    handle: bridge.Bridge, plan: controls.ControlPlan | bridge.Failure, name: str
) -> bridge.SessionResult | None:
    if isinstance(plan, bridge.Failure):
        emit("ActualPlanRefusal", asdict(plan))
        return None
    result = bridge.run_session(handle, plan.Raw, name, forecasts=plan.Forecasts)
    if isinstance(result, bridge.Failure):
        emit("ActualSessionRefusal", asdict(result))
        return None
    return result


def eligible(result: bridge.SessionResult | None) -> bool:
    return result is not None and result.Closed and result.ForecastEligible


def m5_sessions(
    handle: bridge.Bridge, first: controls.ControlPlan
) -> tuple[bridge.SessionResult, bridge.SessionResult] | None:
    child = session(handle, first, "m5/child-train/1")
    if not eligible(child) or child is None:
        return None
    query_two = session(handle, controls.m5_query_two_plan(child), "m5/query-2/1")
    if not eligible(query_two) or query_two is None:
        return None
    query_three = session(handle, controls.m5_query_three_plan(child), "m5/query-3/1")
    if not eligible(query_three) or query_three is None:
        return None
    parent = session(
        handle,
        controls.m5_parent_plan(child, query_two, query_three),
        "m5/parent-train/1",
    )
    if not eligible(parent) or parent is None:
        return None
    return child, parent


def hidden_row() -> bridge.Tree:
    row: bridge.Tree = {
        "Id": "control/frozen-nested/query",
        "Origin": 8,
        "FeatureAvailable": 8,
        "TargetTime": 9,
        "LabelAvailable": 9,
        "Split": "control",
        "Features": ["3FE8000000000000", *(["0000000000000000"] * 7)],
        "Target": None,
        "Uses": [],
    }
    # This fixed row contains ASCII keys/values, integer times and no floats.
    raw = json.dumps(row, sort_keys=True, separators=(",", ":")).encode("utf-8")
    row["ContentSha256"] = hashlib.sha256(raw).hexdigest().upper()
    return row


def m5_work_matches(result: bridge.BridgeResult) -> bool:
    counts = result.Counters
    work = counts.get("PriorWork", {})
    remote = counts.get("Remote", {})
    return (
        result.Closed
        and len(result.Sessions) == 4
        and counts.get("CompletedSessions") == 4
        and counts.get("PeerLaunchAttempted") == 4
        and counts.get("NativePreparationEntered") == 0
        and work.get("ForwardEntered") == 10
        and work.get("LearnEntered") == 8
        and work.get("ProjectionRequested") == 0
        and work.get("TrainingArtifacts") == 2
        and len(remote) == 6
        and all(item == {"Observed": 0, "Complete": True} for item in remote.values())
        and result.Finalization is not None
        and result.Finalization.Raised is None
        and isinstance(result.Finalization.Returned, records.Finalized)
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("m4", "m5-and-frozen-nested"))
    parser.add_argument("source_root", type=Path)
    parser.add_argument("attempt_parent", type=Path)
    parser.add_argument("host", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("manifest_sha256")
    args = parser.parse_args()
    with args.manifest.open("rb") as stream:
        raw = stream.read(64 * 1024 + 1)
    admitted = bridge.admit_service_manifest(raw, args.manifest_sha256)
    if isinstance(admitted, bridge.Failure):
        emit("ActualServiceManifestRefusal", asdict(admitted))
        return 2
    first = (
        controls.m4_plan(dict(admitted.Bindings))
        if args.mode == "m4"
        else controls.m5_child_plan(dict(admitted.Bindings))
    )
    if isinstance(first, bridge.Failure):
        emit("ActualPlanRefusal", asdict(first))
        return 2
    handle = bridge.open_bridge(
        args.source_root,
        args.attempt_parent,
        "m4-registered-1" if args.mode == "m4" else "m5-registered-1",
        args.host,
        raw,
        args.manifest_sha256,
        first.Raw,
        route="single" if args.mode == "m4" else "m5-child-parent",
    )
    if isinstance(handle, bridge.BridgeResult):
        final_receipt(handle)
        return 2
    learned = None
    try:
        if args.mode == "m4":
            session(handle, first, "m4/registered-1")
        else:
            learned = m5_sessions(handle, first)
    finally:
        finished = bridge.finish_bridge(handle)
        final_receipt(finished)
    if args.mode == "m4":
        # A closed numerical refusal can be M4's expected actual outcome.
        # The coordinator must inspect it before separately invoking M5.
        return 0 if finished.Closed else 2
    if learned is None or not m5_work_matches(finished):
        emit("FrozenQueryNotEntered", "M5 completion/work/custody prerequisite failed")
        return 2
    nested = controls.frozen_nested_query_plan(*learned, hidden_row())
    if isinstance(nested, bridge.Failure):
        emit("ActualFrozenPlanRefusal", asdict(nested))
        return 2
    fresh = bridge.open_bridge(
        args.source_root,
        args.attempt_parent,
        "frozen-nested-1",
        args.host,
        raw,
        args.manifest_sha256,
        nested.Raw,
    )
    if isinstance(fresh, bridge.BridgeResult):
        final_receipt(fresh)
        return 2
    query = None
    try:
        query = session(fresh, nested, "frozen-nested/1")
    finally:
        frozen_finished = bridge.finish_bridge(fresh)
        final_receipt(frozen_finished)
    return 0 if frozen_finished.Closed and eligible(query) else 2


if __name__ == "__main__":
    raise SystemExit(main())
