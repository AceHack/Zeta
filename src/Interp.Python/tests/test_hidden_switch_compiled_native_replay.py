"""Actual retained native values plus owned result mutants, no native launches.

The hand and certificate captures used different placeholder binding maps. Their
numerical fixture semantics compose here; this is explicitly not combined source,
process or runtime admission. Native outcomes are never manufactured by Python.
"""

from __future__ import annotations

import gzip
import hashlib
import json
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_certificate as cert
from zeta_interp import hidden_switch_compiled_ieee as s
from zeta_interp import hidden_switch_compiled_native_fixtures as f
from zeta_interp import hidden_switch_compiled_native_replay as r
from zeta_interp import hidden_switch_compiled_record_encoding as enc


def raw(value: object) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=True
    ).encode("ascii")


def decoded(value: bytes) -> Any:
    result = a.strict_json(value, maximum_bytes=8 * 1024 * 1024)
    assert isinstance(result, a.Admitted), result
    return result.value


def encoded(value: object) -> bytes:
    result = enc.encode_public_result(value, maximum_bytes=32 * 1024 * 1024)
    assert isinstance(result, a.Admitted), result
    return result.value


@pytest.fixture(scope="module")
def supplied() -> dict[str, Any]:
    base = (
        Path(__file__).resolve().parents[3]
        / "docs/research/hidden-switch-compiled-validation/2026-09-07"
    )
    inputs = base / "native-replay-inputs"
    manifest = json.loads((inputs / "manifest.json").read_bytes())
    for item in manifest["Artifacts"]:
        stored = (inputs / item["File"]).read_bytes()
        assert len(stored) == item["StoredBytes"]
        assert hashlib.sha256(stored).hexdigest().upper() == item["StoredSha256"]
        plain = gzip.decompress(stored)
        assert (
            len(plain) == item["Bytes"]
            and hashlib.sha256(plain).hexdigest().upper() == item["Sha256"]
        )
    bound_raw = gzip.decompress((inputs / "bindings.json.gz").read_bytes())
    bound = decoded(bound_raw)
    built = cert.build_certificate(bound)
    assert isinstance(built, s.Success)
    issued = cert.verify_certificate(built.value, bound)
    assert isinstance(issued, s.Success)
    hand_raw = gzip.decompress(
        (base / "native-semantic-replay-attempt-1/native-semantic.json.gz").read_bytes()
    )
    assert (
        hashlib.sha256(hand_raw).hexdigest().upper()
        == "E83775583A18712E4495EB57EFAC80A61316129E85D4EFAC0D02C8E1AB6C1451"
    )
    hand = decoded(hand_raw)["Payload"]
    invocation_raw = gzip.decompress(
        (
            base / "native-invocation-replay-attempt-1/native-invocations.json.gz"
        ).read_bytes()
    )
    assert (
        hashlib.sha256(invocation_raw).hexdigest().upper()
        == "9EBBC621583A24BF45DB3AD50F665CCD3EF3D4A7070004F9CDF4E58D705FD78D"
    )
    native = tuple(
        r.NativeCertificateEvidence(
            "certificate/" + p.name[3:-8], gzip.decompress(p.read_bytes())
        )
        for p in sorted(inputs.glob("[0-9][0-9]-*.json.gz"))
    )
    assert len(native) == 31
    return {
        "certificate": issued.value,
        "expected_bindings": bound,
        "certificate_raw": raw(built.value),
        "bindings_raw": bound_raw,
        "hand_slices_raw": raw(
            {key: hand[key] for key in ("Scalars", "Episodes", "OldControls")}
        ),
        "semantic_raw": raw(hand["Semantic"]),
        "selector_raw": raw(decoded(invocation_raw)["SelectorWitness"]),
        "choice_context_raw": raw(
            {
                "CertificateId": "certificate",
                "SourceManifestSha256": "A" * 64,
                "NativeRecordSha256": "B" * 64,
                "Passes": 2,
            }
        ),
        "native_evidence": native,
    }


@pytest.fixture(scope="module")
def records(supplied: dict[str, Any]) -> tuple[r.RecordedCase, ...]:
    prep = f.prepare_native_fixtures(
        **{k: v for k, v in supplied.items() if k != "native_evidence"}
    )
    assert isinstance(prep, s.Success), prep
    cases = []
    for index, case in enumerate(prep.value.Cases):
        calls = []
        for number, operation in enumerate(case.Calls):
            if operation.Operation == "native-certificate-verify":
                original = decoded(supplied["native_evidence"][index].RawReport)
                # Only this declared three-member case projection is constructed;
                # the unchanged complete original process report is separate.
                result_raw = raw(
                    {
                        key: original[key]
                        for key in ("InputSha256", "BindingsSha256", "Outcome")
                    }
                )
            else:
                returned = f.dispatch_native_fixture(prep.value, case.CaseId, number)
                assert isinstance(returned, f.Dispatched), returned
                result_raw = encoded(returned.Call.Result)
            calls.append(
                r.RecordedCall(operation.Operation, operation.InputRoles, result_raw)
            )
        cases.append(
            r.RecordedCase(case.CaseId, case.ControlId, case.Inputs, tuple(calls))
        )
    return tuple(cases)


def run(
    records: object, supplied: dict[str, Any], **changes: object
) -> r.NativeReplayCompleted | r.NativeReplayPending | r.NativeReplayFailed:
    return r.replay_native_cases(records, **{**supplied, **changes})


def case_changed(
    records: tuple[r.RecordedCase, ...], index: int, **changes: Any
) -> tuple[r.RecordedCase, ...]:
    rows = list(records)
    rows[index] = replace(rows[index], **changes)
    return tuple(rows)


def call_changed(
    records: tuple[r.RecordedCase, ...], index: int, number: int, **changes: Any
) -> tuple[r.RecordedCase, ...]:
    calls = list(records[index].Calls)
    calls[number] = replace(calls[number], **changes)
    return case_changed(records, index, Calls=tuple(calls))


def test_complete_actual43_python_and31_compared_native_are_distinct_and_encodable(
    records: tuple[r.RecordedCase, ...], supplied: dict[str, Any]
) -> None:
    got = run(records, supplied)
    assert isinstance(got, r.NativeReplayCompleted), got
    assert (
        got.Counts.PreparedCases,
        got.Counts.PythonStarted,
        got.Counts.PythonReturned,
        got.Counts.PythonMatched,
        got.Counts.NativeCompared,
        got.Counts.NativePending,
        got.Counts.MatchedCases,
    ) == (38, 43, 43, 43, 31, 0, 38)
    assert len(got.Calls) == 74
    assert sum(row.Dispatch is not None for row in got.Calls) == 43
    assert sum(row.NativeParsing is not None for row in got.Calls) == 31
    assert isinstance(got.Preparation.Returned, r.PreparationSnapshot)
    assert got.Preparation.Returned.Projection == "issued-handle-public-fields-only"
    assert not isinstance(got.Preparation.Returned, s.Success)
    assert encoded(got)
    assert got.NativeExecutionAndRuntimeAdmission == "caller-prerequisite-not-performed"
    assert got.WholeOuterAdmission == "not-performed"


def test_absent_native_reports_are_pending_and_not_fake_rejections(
    records: tuple[r.RecordedCase, ...], supplied: dict[str, Any]
) -> None:
    got = run(records, supplied, native_evidence=None)
    assert isinstance(got, r.NativeReplayPending)
    assert (
        got.Counts.PythonReturned,
        got.Counts.PythonMatched,
        got.Counts.NativeCompared,
        got.Counts.NativePending,
        got.Counts.MatchedCases,
    ) == (43, 43, 0, 31, 7)
    assert all(
        row.NativeParsing is None and row.NativeProjection is None
        for row in got.Calls
        if row.Pending
    )
    assert encoded(got)


def test_dispatch_is_fresh_and_fixed_not_preparation_cache(
    records: tuple[r.RecordedCase, ...],
    supplied: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = f.dispatch_native_fixture
    seen = []

    def track(prepared: object, name: object, index: object) -> object:
        seen.append((name, index))
        return original(prepared, name, index)

    monkeypatch.setattr(f, "dispatch_native_fixture", track)
    got = run(records, supplied)
    assert isinstance(got, r.NativeReplayCompleted)
    assert len(seen) == 43 and all(
        index == 0 for name, index in seen if str(name).startswith("certificate/")
    )


@pytest.mark.parametrize(
    "index,change",
    [(0, "id"), (1, "control"), (31, "role"), (32, "raw"), (37, "order")],
)
def test_fixed_case_input_and_control_roster(
    records: tuple[r.RecordedCase, ...],
    supplied: dict[str, Any],
    index: int,
    change: str,
) -> None:
    row = records[index]
    changes: dict[str, Any] = {}
    if change == "id":
        changes["CaseId"] = "producer/arbitrary"
    elif change == "control":
        changes["ControlId"] = None
    elif change == "role":
        changes["Inputs"] = (
            replace(row.Inputs[0], Role="producer-role"),
            *row.Inputs[1:],
        )
    elif change == "raw":
        changes["Inputs"] = (
            replace(row.Inputs[0], Raw=b" " + row.Inputs[0].Raw),
            *row.Inputs[1:],
        )
    else:
        changes["Inputs"] = tuple(reversed(row.Inputs))
    got = run(case_changed(records, index, **changes), supplied)
    assert isinstance(got, r.NativeReplayFailed)
    assert got.Counts.MatchedCases == index
    assert got.Failure.code in ("native-replay-case", "native-replay-inputs")


@pytest.mark.parametrize(
    "change",
    [
        "type",
        "operation",
        "roles",
        "bool-int",
        "int-float",
        "zero-sign",
        "duplicate",
        "nonfinite",
        "extra",
    ],
)
def test_late_python_return_precedes_full_result_refusal(
    records: tuple[r.RecordedCase, ...], supplied: dict[str, Any], change: str
) -> None:
    tree = decoded(records[-1].Calls[1].ResultRaw)
    changed: dict[str, Any] = {}
    if change == "type":
        tree["Type"] = "producer.Invented"
    elif change == "operation":
        changed["Operation"] = "producer-import"
    elif change == "roles":
        changed["InputRoles"] = ("compiled-buffer",)
    elif change == "bool-int":
        tree["Fields"]["CompletedCalls"] = False
    elif change == "int-float":
        tree["Fields"]["CompletedCalls"] = 0.0
    elif change == "zero-sign":
        tree["Fields"]["CompletedCalls"] = -0.0
    elif change == "extra":
        tree["Fields"]["ProducerPassed"] = True
    result_raw = raw(tree)
    if change == "duplicate":
        result_raw = b'{"Type":0,"Type":1}'
    elif change == "nonfinite":
        result_raw = b'{"Type":NaN}'
    changed["ResultRaw"] = result_raw
    got = run(call_changed(records, 37, 1, **changed), supplied)
    assert isinstance(got, r.NativeReplayFailed)
    assert (
        got.Counts.PythonReturned,
        got.Counts.PythonMatched,
        got.Counts.NativeCompared,
        got.Counts.MatchedCases,
    ) == (43, 42, 31, 37)
    assert isinstance(got.Calls[-1].Dispatch.Returned, f.Dispatched)  # type: ignore[union-attr]


def test_harmless_result_and_report_json_whitespace(
    records: tuple[r.RecordedCase, ...], supplied: dict[str, Any]
) -> None:
    evidence = tuple(
        replace(x, RawReport=b"\n " + x.RawReport + b" \n")
        for x in supplied["native_evidence"]
    )
    changed = tuple(
        replace(
            row,
            Calls=tuple(
                replace(call, ResultRaw=b" \n" + call.ResultRaw + b"\n")
                for call in row.Calls
            ),
        )
        for row in records
    )
    got = run(changed, supplied, native_evidence=evidence)
    assert isinstance(got, r.NativeReplayCompleted)
    assert got.NativeEvidence == evidence and got.Records == changed


@pytest.mark.parametrize(
    "kind",
    [
        "missing-case",
        "extra-case",
        "missing-call",
        "extra-call",
        "missing-native",
        "extra-native",
        "reordered-native",
        "missing-all-native",
    ],
)
def test_late_roster_faults_preserve_completed_prefix(
    records: tuple[r.RecordedCase, ...], supplied: dict[str, Any], kind: str
) -> None:
    changed = records
    kwargs: dict[str, Any] = {}
    if kind == "missing-case":
        changed = records[:-1]
    elif kind == "extra-case":
        changed = (*records, records[-1])
    elif kind == "missing-call":
        changed = case_changed(records, 37, Calls=records[-1].Calls[:1])
    elif kind == "extra-call":
        changed = case_changed(
            records, 37, Calls=(*records[-1].Calls, records[-1].Calls[0])
        )
    elif kind == "missing-native":
        kwargs["native_evidence"] = supplied["native_evidence"][:-1]
    elif kind == "extra-native":
        kwargs["native_evidence"] = (
            *supplied["native_evidence"],
            supplied["native_evidence"][-1],
        )
    elif kind == "missing-all-native":
        kwargs["native_evidence"] = ()
    else:
        xs = list(supplied["native_evidence"])
        xs[-2:] = reversed(xs[-2:])
        kwargs["native_evidence"] = tuple(xs)
    got = run(changed, supplied, **kwargs)
    assert isinstance(got, r.NativeReplayFailed)
    if kind == "missing-native":
        assert (
            got.Counts.PythonReturned,
            got.Counts.PythonMatched,
            got.Counts.NativeCompared,
        ) == (31, 31, 30)
        assert got.Failure.path == "NativeEvidence[30]"
    elif kind == "missing-all-native":
        assert got.Counts.PythonReturned == 1 and got.Counts.NativeCompared == 0
    elif kind == "missing-call":
        assert got.Counts.PythonReturned == 42
    elif kind == "missing-case":
        assert got.Counts.PythonReturned == 41
    elif kind in ("extra-call", "extra-case", "extra-native"):
        assert got.Counts.PythonReturned == 43
    else:
        assert got.Counts.PythonReturned == 30 and got.Counts.NativeCompared == 29


@pytest.mark.parametrize(
    "change",
    [
        "incomplete",
        "command-failure",
        "bool-calls",
        "two-calls",
        "source-draw",
        "runtime",
        "hash",
        "bindings",
        "wrong-stage",
        "wrong-code",
        "location",
        "detail",
        "extra",
        "duplicate",
        "nonfinite",
        "empty",
        "wrong-id",
    ],
)
def test_native_report_failure_retains_earlier_python_actual_and_raw(
    records: tuple[r.RecordedCase, ...], supplied: dict[str, Any], change: str
) -> None:
    evidence = list(supplied["native_evidence"])
    report = decoded(evidence[-1].RawReport)
    if change == "incomplete":
        report["Complete"] = False
    elif change == "command-failure":
        report["Failure"] = {"Reason": "lost output"}
    elif change == "bool-calls":
        report["VerifyCalls"] = True
    elif change == "two-calls":
        report["VerifyCalls"] = 2
    elif change == "source-draw":
        report["SourceDraws"] = 1
    elif change == "runtime":
        report["RuntimeAdmitted"] = True
    elif change == "hash":
        report["InputSha256"] = "C" * 64
    elif change == "bindings":
        report["BindingsSha256"] = "D" * 64
    elif change == "wrong-stage":
        report["Outcome"]["Failure"]["Stage"] = "input"
    elif change == "wrong-code":
        report["Outcome"]["Failure"]["Code"] = "json-string"
    elif change == "location":
        report["Outcome"]["Failure"]["Call"] = 0
    elif change == "detail":
        report["Outcome"]["Failure"]["Detail"] = "owned changed parser detail"
    elif change == "extra":
        report["SourceAdmitted"] = True
    value = raw(report)
    if change == "duplicate":
        value = b'{"Kind":0,"Kind":1}'
    elif change == "nonfinite":
        value = b'{"Kind":NaN}'
    elif change == "empty":
        value = b""
    evidence[-1] = replace(
        evidence[-1],
        RawReport=value,
        CaseId="producer/case" if change == "wrong-id" else evidence[-1].CaseId,
    )
    got = run(records, supplied, native_evidence=tuple(evidence))
    assert isinstance(got, r.NativeReplayFailed)
    assert got.Counts.PythonReturned == 31 and got.Counts.NativeCompared == 30
    assert got.Calls[-1].Evidence is evidence[-1]
    assert got.Calls[-2].Dispatch is not None
    if change == "detail":
        assert got.Calls[-1].NativeProjection is not None
        assert got.Failure.code == "native-replay-result"


def test_recorded_wrong_native_acceptance_is_not_python_substituted(
    records: tuple[r.RecordedCase, ...], supplied: dict[str, Any]
) -> None:
    value = decoded(records[1].Calls[1].ResultRaw)
    value["Outcome"] = {
        "Kind": "accepted",
        "NumericCertificateSha256": supplied["certificate"].NumericSha256,
    }
    got = run(call_changed(records, 1, 1, ResultRaw=raw(value)), supplied)
    assert isinstance(got, r.NativeReplayFailed)
    assert got.Counts.NativeCompared == 1 and got.Counts.PythonReturned == 2
    assert got.Calls[-1].NativeProjection["Outcome"]["Kind"] == "refused"  # type: ignore[index]


def test_actual_return_survives_encoder_failure(
    records: tuple[r.RecordedCase, ...],
    supplied: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        enc,
        "encode_public_result",
        lambda *args, **kwargs: a.Refused("injected", "actual", "after return"),
    )
    got = run(records, supplied)
    assert isinstance(got, r.NativeReplayFailed)
    assert got.Counts.PythonReturned == 1 and got.Counts.PythonMatched == 0
    assert isinstance(got.Calls[0].Dispatch.Returned, f.Dispatched)  # type: ignore[union-attr]
    assert got.Calls[0].ActualEncoding.Returned.code == "injected"  # type: ignore[union-attr]


def test_actual_return_survives_aggregate_and_per_result_limits(
    records: tuple[r.RecordedCase, ...],
    supplied: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    changed = call_changed(records, 0, 0, ResultRaw=b" " * (r.MAX_RESULT_BYTES + 1))
    got = run(changed, supplied)
    assert isinstance(got, r.NativeReplayFailed) and got.Counts.PythonReturned == 1
    original = f.dispatch_native_fixture

    def reduce_after_return(*args: Any) -> object:
        result = original(*args)
        monkeypatch.setattr(r, "MAX_TOTAL_BYTES", 1)
        return result

    monkeypatch.setattr(f, "dispatch_native_fixture", reduce_after_return)
    got = run(records, supplied)
    assert (
        isinstance(got, r.NativeReplayFailed)
        and got.Failure.code == "native-replay-total"
    )
    assert got.Counts.PythonReturned == 1 and got.Calls[0].Dispatch is not None


def test_preparation_failure_retains_actual_helper_prefix(
    records: tuple[r.RecordedCase, ...], supplied: dict[str, Any]
) -> None:
    got = run(records, supplied, choice_context_raw=b"{}")
    assert isinstance(got, r.NativeReplayFailed) and got.Counts.PythonStarted == 0
    assert got.Preparation is not None and isinstance(
        got.Preparation.Returned, f.PreparationFailure
    )
    assert len(got.Preparation.Returned.Cases) == 33
    assert got.Preparation.Returned.Preparation and got.Preparation.Returned.Inputs


def test_raised_dispatch_keeps_observation_not_return(
    records: tuple[r.RecordedCase, ...],
    supplied: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def explode(*args: Any) -> Any:
        raise RuntimeError("owned injected call fault")

    monkeypatch.setattr(f, "dispatch_native_fixture", explode)
    got = run(records, supplied)
    assert isinstance(got, r.NativeReplayFailed)
    assert got.Counts.PythonStarted == 1 and got.Counts.PythonReturned == 0
    assert (
        got.Calls[0].Dispatch is not None and got.Calls[0].Dispatch.Raised is not None
    )


def test_issued_capability_required_without_executed_case(
    records: tuple[r.RecordedCase, ...], supplied: dict[str, Any]
) -> None:
    got = run(records, supplied, certificate=object())
    assert isinstance(got, r.NativeReplayFailed) and got.Counts.PythonStarted == 0
