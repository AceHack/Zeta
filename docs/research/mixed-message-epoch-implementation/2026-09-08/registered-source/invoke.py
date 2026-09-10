"""Fixed first-control invocation; execution requires separate frozen admission.

Import is inert. This artifact does not select data, fit a replacement model,
retry a route, evaluate a numerical pass verdict, or serialize BridgeResult.
Its stdout is a caller receipt referencing the bridge's original durable records.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from dataclasses import asdict
from pathlib import Path

from zeta_interp import hidden_switch_compiled_admission as admission
from zeta_interp import hidden_switch_compiled_record_store as records
from zeta_interp import hidden_switch_compiled_storage as storage
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
    handle: bridge.Bridge,
    plan: controls.ControlPlan | bridge.Failure,
    name: str,
    calls: list[bridge.CallObservation],
) -> bridge.SessionResult | None:
    calls.append(bridge.CallObservation("plan/" + name, plan, None))
    if isinstance(plan, bridge.Failure):
        return None
    call = bridge._observe(
        "run_session/" + name,
        lambda: bridge.run_session(handle, plan.Raw, name, forecasts=plan.Forecasts),
        calls,
    )
    return call.Returned if isinstance(call.Returned, bridge.SessionResult) else None


def finish(
    handle: bridge.Bridge, name: str, calls: list[bridge.CallObservation]
) -> bridge.BridgeResult | None:
    # Retain the full actual object before its separate fallible console summary.
    call = bridge._observe(
        "finish_bridge/" + name, lambda: bridge.finish_bridge(handle), calls
    )
    result = call.Returned
    if isinstance(result, bridge.BridgeResult):
        bridge._observe("console/" + name, lambda: final_receipt(result), calls)
        return result
    return None


def eligible(result: bridge.SessionResult | None) -> bool:
    return result is not None and result.Closed and result.ForecastEligible


def m5_sessions(
    handle: bridge.Bridge,
    first: controls.ControlPlan,
    calls: list[bridge.CallObservation],
) -> tuple[bridge.SessionResult, bridge.SessionResult] | None:
    child = session(handle, first, "m5/child-train/1", calls)
    if not eligible(child) or child is None:
        return None
    query_two = session(
        handle, controls.m5_query_two_plan(child), "m5/query-2/1", calls
    )
    if not eligible(query_two) or query_two is None:
        return None
    query_three = session(
        handle, controls.m5_query_three_plan(child), "m5/query-3/1", calls
    )
    if not eligible(query_three) or query_three is None:
        return None
    parent = session(
        handle,
        controls.m5_parent_plan(child, query_two, query_three),
        "m5/parent-train/1",
        calls,
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


def invoke(args: argparse.Namespace, calls: list[bridge.CallObservation]) -> int:
    metadata = bridge._observe("manifest/lstat", args.manifest.lstat, calls)
    observed_metadata = metadata.Returned
    if not isinstance(observed_metadata, os.stat_result):
        return 2
    read = bridge._observe(
        "manifest/read_exact",
        lambda: storage.read_exact(
            args.manifest.parent,
            args.manifest.name,
            expected_bytes=observed_metadata.st_size,
            maximum_bytes=64 * 1024,
        ),
        calls,
    )
    if (
        not isinstance(read.Returned, admission.Admitted)
        or type(read.Returned.value) is not bytes
    ):
        return 2
    raw = read.Returned.value
    service = bridge._observe(
        "admit_service_manifest",
        lambda: bridge.admit_service_manifest(raw, args.manifest_sha256),
        calls,
    )
    admitted = service.Returned
    if not isinstance(admitted, bridge.ServiceManifest):
        return 2
    plan = bridge._observe(
        "first-plan",
        lambda: (
            controls.m4_plan(dict(admitted.Bindings))
            if args.mode == "m4"
            else controls.m5_child_plan(dict(admitted.Bindings))
        ),
        calls,
    )
    first = plan.Returned
    if not isinstance(first, controls.ControlPlan):
        return 2
    opened = bridge._observe(
        "open_bridge/first",
        lambda: bridge.open_bridge(
            args.source_root,
            args.attempt_parent,
            "m4-registered-1" if args.mode == "m4" else "m5-registered-1",
            args.host,
            raw,
            args.manifest_sha256,
            first.Raw,
            route="single" if args.mode == "m4" else "m5-child-parent",
        ),
        calls,
    )
    handle = opened.Returned
    if isinstance(handle, bridge.BridgeResult):
        bridge._observe("console/setup-refusal", lambda: final_receipt(handle), calls)
        return 2
    if not isinstance(handle, bridge.Bridge):
        return 2
    learned = None
    try:
        if args.mode == "m4":
            session(handle, first, "m4/registered-1", calls)
        else:
            learned = m5_sessions(handle, first, calls)
    finally:
        finished = finish(handle, "first", calls)
    if finished is None or any(call.Raised is not None for call in calls):
        return 2
    if args.mode == "m4":
        # A closed numerical refusal can be M4's expected actual outcome.
        # The coordinator must inspect it before separately invoking M5.
        return 0 if finished.Closed else 2
    if learned is None or not m5_work_matches(finished):
        calls.append(
            bridge.CallObservation(
                "frozen-query/not-entered",
                "M5 completion/work/custody prerequisite failed",
                None,
            )
        )
        return 2
    plan = bridge._observe(
        "frozen-query/plan",
        lambda: controls.frozen_nested_query_plan(*learned, hidden_row()),
        calls,
    )
    nested = plan.Returned
    if not isinstance(nested, controls.ControlPlan):
        return 2
    opened = bridge._observe(
        "open_bridge/frozen-query",
        lambda: bridge.open_bridge(
            args.source_root,
            args.attempt_parent,
            "frozen-nested-1",
            args.host,
            raw,
            args.manifest_sha256,
            nested.Raw,
        ),
        calls,
    )
    fresh = opened.Returned
    if isinstance(fresh, bridge.BridgeResult):
        bridge._observe(
            "console/frozen-setup-refusal", lambda: final_receipt(fresh), calls
        )
        return 2
    if not isinstance(fresh, bridge.Bridge):
        return 2
    query = None
    try:
        query = session(fresh, nested, "frozen-nested/1", calls)
    finally:
        frozen_finished = finish(fresh, "frozen-query", calls)
    return (
        0
        if frozen_finished is not None and frozen_finished.Closed and eligible(query)
        else 2
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
    calls: list[bridge.CallObservation] = []
    outcome = bridge._observe("invocation", lambda: invoke(args, calls), calls)
    summaries = []
    for call in calls:
        value = call.Returned
        summaries.append(
            {
                "Operation": call.Operation,
                "ReturnedType": type(value).__name__,
                "ReturnedScalar": value
                if type(value) in (type(None), bool, int, str)
                else None,
                "ReturnedFailure": asdict(value)
                if isinstance(value, (bridge.Failure, admission.Refused))
                else None,
                "Raised": None if call.Raised is None else asdict(call.Raised),
            }
        )
    console = bridge._observe(
        "console/caller-observations",
        lambda: emit("CallerObservations", summaries),
        calls,
    )
    console_failure = console.Raised
    if console_failure is not None:
        # One separate stderr attempt; no recursive console recovery or retry.
        bridge._observe(
            "console/stderr-failure",
            lambda: print(
                json.dumps({"CallerConsoleFailure": asdict(console_failure)}),
                file=sys.stderr,
                flush=True,
            ),
            calls,
        )
    return (
        0 if outcome.Returned == 0 and all(call.Raised is None for call in calls) else 2
    )


if __name__ == "__main__":
    raise SystemExit(main())
