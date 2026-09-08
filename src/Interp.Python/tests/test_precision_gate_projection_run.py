"""Synthetic callback/store discrimination; never final projection evidence.

Every receipt and NativeObservation below is a disposable handcrafted fixture.
CollectionAndCriteriaPassed exercises bookkeeping, not authenticated invocation.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_record_encoding as encoding
from zeta_interp import hidden_switch_compiled_record_store as store
from zeta_interp import precision_gate_projection_cases as cases
from zeta_interp import precision_gate_projection_comparison as criteria
from zeta_interp import precision_gate_projection_reference as ref
from zeta_interp import precision_gate_projection_run as run
from zeta_interp.precision_gate_projection_process import (
    NativeObservation,
    ProcessFailure,
)


def bindings() -> dict[str, str]:
    return {
        "ProtocolSha256": criteria.PROTOCOL_SHA256,
        "docs/research/2026-09-08-precision-gate-projection-decimal-admission-clarification.md": "BA359E4FEC2484A680B6B149E6E887FBEA82AFBB67A15EAFBDB99949101BDAB8",
        "docs/research/2026-09-08-precision-gate-projection-rendered-zero-clarification.md": "67B7C9EFB6B42CEFE341507738B6122FAC4BEDF18C07A72564F3DEEFEE71235E",
    }


def target(tmp_path: Path, name: str = "fixture") -> store.Store:
    result = store.open_store(tmp_path, name, run.LIMITS)
    assert isinstance(result, store.Opened)
    return result.Store


def fail(code: str, stage: str) -> dict[str, object]:
    return {
        "Code": code,
        "Stage": stage,
        "Field": "Fixture",
        "Message": "synthetic",
        "OriginalKernelFailure": None,
    }


def receipt(request: run.Request, op: str) -> dict[str, Any]:
    case = request.CaseId
    kind = {
        "NativeSolve": "candidate",
        "ReferenceRoot": "enclosure",
        "CertifyNative": "certified",
    }[op]
    outcome: dict[str, Any] = {"Kind": kind}
    if case.startswith("wire/"):
        outcome = {"Kind": "refused", "Failure": fail("Wire", "input")}
    elif case.startswith("domain/"):
        outcome = {
            "Kind": "no-candidate" if op == "CertifyNative" else "refused",
            "NativeFailure" if op == "CertifyNative" else "Failure": fail(
                "Domain", "input" if op == "ReferenceRoot" else "parameters"
            ),
        }
    elif (case, op) in (
        ("limit/native-midpoints", "NativeSolve"),
        ("limit/reference-midpoints", "ReferenceRoot"),
    ):
        outcome = {"Kind": "refused", "Failure": fail("IterationLimit", "midpoint")}
    elif case.startswith("cert/"):
        outcome = {"Kind": "refused", "Failure": fail("CandidateShape", "certificate")}
    result: dict[str, Any] = {
        "Schema": criteria.SCHEMAS[op],
        "CaseId": request.NumericId,
        "InputSha256": request.InputSha256,
        "Bindings": dict(request.Bindings),
        "Counters": {"Starts": 0},
        "Outcome": outcome,
    }
    if outcome["Kind"] == "candidate":
        result["Outcome"]["Value"] = {
            "MeanBits": "0000000000000000",
            "VarianceBits": "3FF0000000000000",
            "LogRatioBits": "3FF0000000000000",
            "RatioBits": "3FF0000000000000",
            "RBits": "3FF0000000000000",
            "TargetBits": {"U": "0000000000000000"},
            "OriginalObjective": {
                "ValueBits": "3FF0000000000000",
                "DerivativeMeanBits": "3FF0000000000000",
                "DerivativeVarianceBits": "3FF0000000000000",
            },
            "Bracket": {
                "LowerBits": "BFF0000000000000",
                "UpperBits": "3FF0000000000000",
            },
        }
    if op == "CertifyNative":
        assert request.RawNative is not None
        result["NativeRaw"] = {
            "BytesHex": request.RawNative.hex(),
            "Bytes": len(request.RawNative),
            "Sha256": hashlib.sha256(request.RawNative).hexdigest().upper(),
        }
    if outcome["Kind"] == "certified":
        outcome.update(
            TargetScope="exact-native-dyadic",
            NativeTrajectoryCertified=False,
            GraphApplicationPerformed=False,
        )
        result["Reference"] = receipt(request, "ReferenceRoot")
    return result


def native(request: run.Request) -> NativeObservation:
    return NativeObservation(
        Complete=True,
        Receipt=json.dumps(receipt(request, "NativeSolve")).encode(),
        ExitCode=0,
        DirectChildClosed=True,
        LaunchAttempted=True,
        ChildPid=123,
        ReadersClosed=True,
    )


def services() -> run.Services:
    return run.Services(
        native,
        lambda request: ref.Success(receipt(request, "ReferenceRoot")),
        lambda request: ref.Success(receipt(request, "CertifyNative")),
    )


def test_fixed_collection_preserves_baseline_and_fresh_mutations(
    tmp_path: Path,
) -> None:
    result = run.run_comparison(target(tmp_path), bindings(), services())
    assert (
        result.CollectionAndCriteriaPassed
        and result.RosterCollected
        and result.ExpectedOutcomesPassed
    )
    assert result.Counters == {
        "Planned": 88,
        "Entered": 88,
        "Returned": 88,
        "Raised": 0,
        "CompleteReceipts": 88,
        "RetainedReceipts": 88,
        "Checked": 88,
        "NativeLaunchAttempts": 27,
        "NativeChildrenStarted": 27,
        "NativeChildrenClosed": 27,
    }
    assert (
        not result.Pending
        and len(result.CoreCertified) == 12
        and result.Baseline is not None
    )
    baseline = next(
        row
        for row in result.Entries
        if row.CaseId == "core/unconstructed" and row.Operation == "NativeSolve"
    )
    assert baseline.Observation is not None and isinstance(
        baseline.Observation.Returned, NativeObservation
    )
    baseline_bytes = baseline.Observation.Returned.Receipt
    assert baseline_bytes is not None
    for row in result.Entries[-12:]:
        assert row.Request is not None
        changed = cases.mutate_native(row.CaseId, baseline_bytes)
        assert (
            isinstance(changed, a.Admitted) and row.Request.RawNative == changed.value
        )
    assert isinstance(result.Finalization, store.Finalized)
    assert len([h for h in result.Helpers if h.Operation == "finalize"]) == 1


def test_missing_certified_baseline_leaves_twelve_slots_unexecuted(
    tmp_path: Path,
) -> None:
    def no_baseline(request: run.Request) -> object:
        r = receipt(request, "CertifyNative")
        if request.CaseId == "core/unconstructed":
            r["Outcome"] = {
                "Kind": "refused",
                "Failure": fail("NotCloseToMinimum", "certificate"),
            }
        return ref.Success(r)

    s = replace(services(), CertifyNative=no_baseline)
    result = run.run_comparison(target(tmp_path), bindings(), s)
    assert (
        result.PrimaryFailure is not None
        and result.PrimaryFailure.code == "baseline-missing"
    )
    assert result.Counters["Entered"] == 76 and len(result.Pending) == 12
    assert result.Baseline is None and not result.CollectionAndCriteriaPassed
    assert all(
        not row.Entered for row in result.Entries if row.CaseId.startswith("cert/")
    )


def test_failed_launch_is_a_return_but_no_complete_receipt(tmp_path: Path) -> None:
    actual = NativeObservation(
        LaunchAttempted=True, Failure=ProcessFailure("launch", "MissingHost", "fixture")
    )
    result = run.run_comparison(
        target(tmp_path), bindings(), replace(services(), NativeSolve=lambda _: actual)
    )
    assert result.Counters["Returned"] == 1 and result.Counters["CompleteReceipts"] == 0
    assert len(result.Pending) == 88 and result.Entries[0].Observation is not None
    assert result.Entries[0].Observation.Returned is actual
    assert (
        result.PrimaryFailure is not None
        and result.PrimaryFailure.code == "native-incomplete"
    )


def test_crash_partial_bytes_remain_retained_but_not_complete(tmp_path: Path) -> None:
    actual = NativeObservation(
        Receipt=b"partial",
        LaunchAttempted=True,
        ChildPid=9,
        ExitCode=-9,
        DirectChildClosed=True,
        Stdout=b"prefix",
    )
    result = run.run_comparison(
        target(tmp_path), bindings(), replace(services(), NativeSolve=lambda _: actual)
    )
    row = result.Entries[0]
    assert (
        not row.CompleteReceipt
        and row.Observation is not None
        and row.Observation.Returned is actual
    )
    assert any(
        artifact.Sha256 == hashlib.sha256(b"partial").hexdigest().upper()
        for artifact in row.Artifacts
    )


def test_raised_callback_is_distinct_from_returned_none(tmp_path: Path) -> None:
    def raised(_: run.Request) -> object:
        raise RuntimeError("fixture failure")

    r = run.run_comparison(
        target(tmp_path, "raised"), bindings(), replace(services(), NativeSolve=raised)
    )
    n = run.run_comparison(
        target(tmp_path, "none"),
        bindings(),
        replace(services(), NativeSolve=lambda _: None),
    )
    assert r.Counters["Raised"] == 1 and r.Counters["Returned"] == 0
    assert n.Counters["Raised"] == 0 and n.Counters["Returned"] == 1
    assert r.PrimaryFailure is not None and r.PrimaryFailure.code == "service-raised"
    assert n.PrimaryFailure is not None and n.PrimaryFailure.code == "native-return"


def test_reference_encoding_failure_retains_exact_actual_object(tmp_path: Path) -> None:
    actual = ref.ReceiptFailure(
        ref.Failure("ResultTooLarge", "encoding", "Receipt", "fixture"),
        {"complete actual object": object()},
    )
    result = run.run_comparison(
        target(tmp_path),
        bindings(),
        replace(services(), ReferenceRoot=lambda _: actual),
    )
    row = result.Entries[1]
    assert row.Observation is not None and row.Observation.Returned is actual
    assert (
        result.PrimaryFailure is not None
        and result.PrimaryFailure.code == "reference-incomplete"
    )
    assert not row.ReceiptRetained and result.SecondaryFailures
    assert isinstance(result.Finalization, store.Finalized)


def test_encoder_failure_preserves_complete_return_before_storage(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = encoding.encode_public_result

    def reject(
        value: object, *, maximum_bytes: object = encoding.MAX_RECORD_BYTES
    ) -> a.Admission[bytes]:
        if (
            type(value) is dict
            and value.get("Schema") == criteria.SCHEMAS["ReferenceRoot"]
        ):
            return a.Refused("fixture-encoding", "Receipt", "fixture")
        return original(value, maximum_bytes=maximum_bytes)

    monkeypatch.setattr(encoding, "encode_public_result", reject)
    result = run.run_comparison(target(tmp_path), bindings(), services())
    row = result.Entries[1]
    assert row.Observation is not None and isinstance(
        row.Observation.Returned, ref.Success
    )
    assert row.CompleteReceipt and not row.ReceiptRetained
    assert result.Counters["Entered"] == 2 and result.PrimaryFailure is not None
    assert result.PrimaryFailure.code == "encoding"


def test_reused_store_is_not_appended_or_finalized(tmp_path: Path) -> None:
    s = target(tmp_path)
    old = store.append_bytes(s, "prior", b"prior")
    assert isinstance(old, store.Stored)
    before = store.snapshot(s)
    result = run.run_comparison(s, bindings(), services())
    assert (
        result.PrimaryFailure is not None
        and result.PrimaryFailure.code == "store-admission"
    )
    assert result.Finalization is None and store.snapshot(s) == before


def test_finalized_store_is_not_finalized_again(tmp_path: Path) -> None:
    s = target(tmp_path)
    assert isinstance(store.finalize(s), store.Finalized)
    before = store.snapshot(s)
    result = run.run_comparison(s, bindings(), services())
    assert result.Finalization is None and store.snapshot(s) == before


def test_current_failed_return_storage_fault_keeps_process_failure_primary(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = store.storage.write_exclusive
    writes: list[str] = []

    def write(root: object, file: object, value: object) -> object:
        writes.append(str(file))
        if len(writes) == 2:
            return a.Refused("fixture-write", "Store", "synthetic storage failure")
        return original(root, file, value)

    monkeypatch.setattr(store.storage, "write_exclusive", write)
    actual = NativeObservation(
        LaunchAttempted=True, Failure=ProcessFailure("launch", "MissingHost", "fixture")
    )
    result = run.run_comparison(
        target(tmp_path), bindings(), replace(services(), NativeSolve=lambda _: actual)
    )
    assert (
        result.PrimaryFailure is not None
        and result.PrimaryFailure.code == "native-incomplete"
    )
    assert result.Terminal is None and isinstance(result.Finalization, store.Finalized)
    assert len(writes) == 3  # input, failed current observation, reserved journal only
    assert (
        result.Entries[0].Observation is not None
        and result.Entries[0].Observation.Returned is actual
    )
    assert result.Counters["NativeLaunchAttempts"] == 1
    assert (
        result.Counters["NativeChildrenStarted"]
        == result.Counters["NativeChildrenClosed"]
        == 0
    )


def test_finalization_failure_never_replaces_primary_or_retries(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = store.storage.write_exclusive
    finals: list[str] = []

    def write(root: object, file: object, value: object) -> object:
        if "final" in str(file):
            finals.append(str(file))
            return a.Refused(
                "fixture-final", "Journal", "synthetic finalization failure"
            )
        return original(root, file, value)

    monkeypatch.setattr(store.storage, "write_exclusive", write)
    actual = NativeObservation(
        LaunchAttempted=True, Failure=ProcessFailure("launch", "MissingHost", "fixture")
    )
    result = run.run_comparison(
        target(tmp_path), bindings(), replace(services(), NativeSolve=lambda _: actual)
    )
    assert (
        result.PrimaryFailure is not None
        and result.PrimaryFailure.code == "native-incomplete"
    )
    assert (
        isinstance(result.Finalization, store.FinalizationFailed) and len(finals) == 1
    )
    assert result.SecondaryFailures and not result.CollectionAndCriteriaPassed


def test_real_entrypoint_wrappers_forward_numeric_id_and_exact_objects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    raw = b"synthetic input"
    original = object()
    seen: list[tuple[object, ...]] = []

    def root(raw_input: object, expected_bindings: object, **kwargs: object) -> object:
        seen.append((raw_input, expected_bindings, kwargs))
        return original

    def certificate(
        raw_input: object,
        raw_native: object,
        expected_bindings: object,
        **kwargs: object,
    ) -> object:
        seen.append((raw_input, raw_native, expected_bindings, kwargs))
        return original

    monkeypatch.setattr(ref, "reference_root", root)
    monkeypatch.setattr(ref, "certify_native", certificate)
    request = run.Request(
        76,
        "cert/mean",
        "core/unconstructed",
        raw,
        b"synthetic native",
        "A" * 64,
        bindings(),
    )
    s = run.reference_services(native)
    assert s.ReferenceRoot(request) is original
    assert s.CertifyNative(request) is original
    assert seen[0][0] is raw and seen[0][1] is request.Bindings
    assert seen[1][0] is raw and seen[1][1] is request.RawNative
    assert (
        seen[0][-1]
        == seen[1][-1]
        == {"expected_input_sha256": "A" * 64, "expected_case_id": "core/unconstructed"}
    )


def test_existing_journal_reservation_is_not_charged_twice(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    s = target(tmp_path)
    observed = store.snapshot(s)
    assert isinstance(observed, a.Admitted)
    # Synthetic near-capacity snapshot: four MiB remain after all existing
    # reservations, including the store's journal. Two MiB cover the adapter's
    # terminal envelope and the small current record still fits.
    near = replace(
        observed.value,
        ReservedRawBytes=126 * 1024 * 1024,
        ReservedStoredBytes=126 * 1024 * 1024,
    )
    monkeypatch.setattr(store, "snapshot", lambda _: a.Admitted(near))
    coordinator = run._Run(s, bindings(), services())
    encoded, retained = coordinator.put("fixture-quota", b"small", raw=True)
    assert isinstance(encoded, a.Admitted) and isinstance(retained, store.Stored)
    assert coordinator.primary is None
