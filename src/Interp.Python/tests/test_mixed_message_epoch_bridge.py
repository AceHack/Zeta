"""Protocol/retention development fixtures; never the registered M4/M5 routes."""

from __future__ import annotations

import hashlib
import json
import os
import struct
from dataclasses import replace
from pathlib import Path
from typing import Any, cast

import pytest

from zeta_interp import hidden_switch_compiled_admission as admission
from zeta_interp import hidden_switch_compiled_record_encoding as encoding
from zeta_interp import hidden_switch_compiled_record_store as records
from zeta_interp import mixed_message_epoch_bridge as bridge
from zeta_interp import precision_gate_projection_process as native
from zeta_interp import precision_gate_projection_reference as reference


def _ready() -> dict[str, object]:
    return {
        "Kind": "Ready",
        "Schema": bridge.SCHEMA,
        "SessionId": "fixture",
        "PlanSha256": "A" * 64,
        "ServiceSha256": "B" * 64,
    }


def _frame(value: object) -> bytes:
    return json.dumps(value, separators=(",", ":")).encode() + b"\n"


def _hex(value: float) -> str:
    return struct.pack(">d", value).hex().upper()


def _request() -> bridge.Frame:
    # This is a transport-only target. No real numerical service is called.
    raw = b'{"Schema":"zeta.precision-projection.input.v1","Id":"fixture/p","Parameters":{"T":"2","U":"0.5","K":"0","C":"2"},"Profile":"default"}'
    value = {
        "Kind": "ProjectionRequest",
        "Schema": bridge.SCHEMA,
        "SessionId": "fixture",
        "Sequence": 1,
        "RequestId": "fixture/p",
        "InputRevision": 0,
        "Base": {"PrecisionMean": _hex(1), "Precision": _hex(2)},
        "TargetBits": {"T": _hex(2), "U": _hex(0.5), "K": _hex(0), "C": _hex(2)},
        "RawInputHex": raw.hex(),
        "InputSha256": hashlib.sha256(raw).hexdigest().upper(),
        "CaseId": "fixture/p",
        "BindingsSha256": hashlib.sha256(b"{}").hexdigest().upper(),
        "Remaining": {},
    }
    result = bridge.decode_frame(_frame(value), "fixture")
    assert isinstance(result, bridge.Frame)
    return result


def _budget() -> bridge._Budget:
    return bridge._Budget(bridge.Reservation(1, 0, 0, records.Limits()), 0, lambda: 1)


def _store(parent: Path) -> records.Store:
    opened = records.open_store(parent, "records")
    assert isinstance(opened, records.Opened)
    return opened.Store


def _prepared() -> native.PreparedNative:
    return native.PreparedNative(True, "fixture", None, None, (), (), (), None, ())


def test_ready_retains_exact_original_bytes() -> None:
    raw = _frame(_ready())
    value = bridge.decode_frame(raw, "fixture")
    assert isinstance(value, bridge.Frame)
    assert value.Raw == raw
    assert value.Sha256 == hashlib.sha256(raw).hexdigest().upper()


@pytest.mark.parametrize(
    "raw",
    [
        b"{}",
        b"{}\n{}\n",
        b'{"Kind":"Ready","Kind":"Ready"}\n',
        b'{"Kind":"Ready","n":1e400}\n',
        b'{"Kind":"Ready","n":NaN}\n',
        b'{"Kind":"Ready","n":1.0}\n',
        b'{"Kind":"Ready","n":9223372036854775808}\n',
        b'{"Kind":"Ready","n":"\\ud800"}\n',
        b"\xff\n",
    ],
)
def test_strict_frame_refuses_malformed_input(raw: bytes) -> None:
    assert isinstance(bridge.decode_frame(raw, "fixture"), bridge.Failure)


@pytest.mark.parametrize(
    "change", [{"extra": None}, {"SessionId": "other"}, {"Schema": "other"}]
)
def test_exact_outer_keys_and_bindings(change: dict[str, object]) -> None:
    value = _ready() | change
    assert isinstance(bridge.decode_frame(_frame(value), "fixture"), bridge.Failure)


def test_boolean_sequence_is_not_one() -> None:
    value = _request().Value | {"Sequence": True}
    assert isinstance(bridge.decode_frame(_frame(value), "fixture"), bridge.Failure)


def test_canonical_keeps_array_order_unicode_and_signed_zero_bits() -> None:
    value = {"z": ["é", "\\", "\n"], "a": _hex(-0.0)}
    expected = b'{"a":"8000000000000000","z":["\xc3\xa9","\\\\","\\n"]}'
    assert bridge._canonical(value, len(expected)) == expected
    with pytest.raises(bridge._Stop):
        bridge._canonical(value, len(expected) - 1)


def test_source_reservation_is_not_refunded_or_reset() -> None:
    pins = {
        "@host": native.FileIdentity(100, "A" * 64),
        native.SCRIPT: native.FileIdentity(20, "B" * 64),
        "a.dll": native.FileIdentity(30, "C" * 64),
        "b.dll": native.FileIdentity(40, "D" * 64),
        "c.dll": native.FileIdentity(50, "E" * 64),
    }
    result = bridge._reservation(2, pins)
    assert result.ExternalBytes == 2 * (140 + 2 * (65536 + 65536 + 2097152))
    assert result.ExternalSlots == 10
    assert result.StoreLimits.CombinedBytes + result.ExternalBytes == 256 * 1024 * 1024
    assert result.StoreLimits.Artifacts + result.ExternalSlots == 4096
    zero = bridge._reservation(0, {})
    assert zero.ExternalBytes == zero.ExternalSlots == 0


def test_returned_refusal_is_retained_before_encoding(tmp_path: Path) -> None:
    actual = native.NativeObservation(
        Failure=native.ProcessFailure("fixture", "control", "returned")
    )
    called = []

    def launch(*args: object, **kwargs: object) -> object:
        called.append((args, kwargs))
        return actual

    def forbidden(*_: object, **__: object) -> object:
        raise AssertionError("incomplete native return must not enter certificate")

    budget = _budget()
    retained: list[bridge.ProjectionExchange] = []
    result = bridge._projection(
        _request(),
        _prepared(),
        {},
        "B" * 64,
        tmp_path / "native",
        _store(tmp_path),
        budget,
        retained,
        bridge._Services(launch, forbidden),
    )
    assert len(called) == 1
    assert budget.NativeCallEntered == budget.NativeReturned == 1
    assert budget.CertificateEntered == 0
    assert retained[0].Native is not None and retained[0].Native.Returned is actual
    assert result["Native"]["Type"].endswith("NativeObservation")
    assert result["Certificate"] is None and result["Failure"]["Code"] == "Service"


def test_raised_native_is_not_a_return_or_known_launch(tmp_path: Path) -> None:
    def launch(*_: object, **__: object) -> object:
        raise OSError("fixture")

    budget = _budget()
    retained: list[bridge.ProjectionExchange] = []
    bridge._projection(
        _request(),
        _prepared(),
        {},
        "B" * 64,
        tmp_path / "native",
        _store(tmp_path),
        budget,
        retained,
        bridge._Services(launch, launch),
    )
    assert budget.NativeCallEntered == 1 and budget.NativeReturned == 0
    assert "NativeLaunchAttempted" in budget.RemoteIncomplete
    assert retained[0].Native is not None and retained[0].Native.Raised is not None


def test_actual_certificate_failure_retains_native_and_nested_count(
    tmp_path: Path,
) -> None:
    actual_native = native.NativeObservation(
        Complete=True, Receipt=b"fixture", LaunchAttempted=True
    )
    actual_certificate = reference.ReceiptFailure(
        reference.Failure("ResultTooLarge", "output", None, "fixture"),
        {"Counters": {"ReferenceRootCalls": 1}},
    )
    observed_args: list[object] = []

    def launch(*args: object, **kwargs: object) -> object:
        observed_args.append((args, kwargs))
        return actual_native

    def certify(*args: object, **kwargs: object) -> object:
        observed_args.append((args, kwargs))
        return actual_certificate

    budget = _budget()
    retained: list[bridge.ProjectionExchange] = []
    result = bridge._projection(
        _request(),
        _prepared(),
        {},
        "B" * 64,
        tmp_path / "native",
        _store(tmp_path),
        budget,
        retained,
        bridge._Services(launch, certify),
    )
    assert len(observed_args) == 2
    assert (
        budget.NativeCallEntered,
        budget.NativeReturned,
        budget.CertificateEntered,
        budget.CertificateReturned,
        budget.NestedReferenceEntered,
    ) == (1, 1, 1, 1, 1)
    assert (
        retained[0].Certificate is not None
        and retained[0].Certificate.Returned is actual_certificate
    )
    assert result["Certificate"] is None
    assert result["Failure"]["Code"] == "Storage"


def test_actual_normal_wrong_type_counts_as_return(tmp_path: Path) -> None:
    def launch(*_: object, **__: object) -> object:
        return {"not": "NativeObservation"}

    budget = _budget()
    retained: list[bridge.ProjectionExchange] = []
    result = bridge._projection(
        _request(),
        _prepared(),
        {},
        "B" * 64,
        tmp_path / "native",
        _store(tmp_path),
        budget,
        retained,
        bridge._Services(launch, launch),
    )
    assert budget.NativeCallEntered == budget.NativeReturned == 1
    assert retained[0].Native is not None and retained[0].Native.Returned == {
        "not": "NativeObservation"
    }
    assert result["Failure"]["Code"] == "Unexpected"


def test_budget_keeps_terminal_reserve_and_first_failure() -> None:
    budget = _budget()
    budget.ProtocolBytes = bridge.TRANSCRIPT_LIMIT - bridge.TERMINAL_RESERVE
    with pytest.raises(bridge._Stop):
        budget.charge_frame(1)
    budget.charge_frame(1, terminal=True)
    first = bridge.Failure("Storage", "publish", None, "first")
    budget.stop(first)
    budget.stop(bridge.Failure("Transport", "publish", None, "later"))
    assert budget.Failure is first


@pytest.mark.parametrize("name,bits", [("U", "8000000000000000"), ("T", _hex(4.0))])
def test_request_target_correspondence_precedes_native(name: str, bits: str) -> None:
    request = _request()
    value: dict[str, Any] = json.loads(request.Raw)
    value["TargetBits"][name] = bits
    parsed = bridge.decode_frame(_frame(value), "fixture")
    assert isinstance(parsed, bridge.Frame)
    with pytest.raises(bridge._Stop):
        bridge._request_input(parsed, {})


def test_transport_charges_unterminated_incoming_frame(tmp_path: Path) -> None:
    import sys
    import time

    budget = bridge._Budget(
        bridge.Reservation(0, 0, 0, records.Limits()), time.monotonic()
    )
    peer = bridge._Peer(
        (sys.executable, "-c", "import os; os.write(1,b'prefix')"), tmp_path, budget, 1
    )
    try:
        with pytest.raises(bridge._Stop):
            peer.receive()
        observed = peer.available()
        assert observed.PendingStdout == b"prefix"
        assert budget.Frames == 1
        assert budget.ProtocolBytes == 6
    finally:
        peer.close(normal=False)


def test_transport_failed_write_is_latched(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import sys
    import time

    budget = bridge._Budget(
        bridge.Reservation(0, 0, 0, records.Limits()), time.monotonic()
    )
    peer = bridge._Peer(
        (sys.executable, "-c", "import sys; sys.stdin.buffer.read()"),
        tmp_path,
        budget,
        1,
    )
    calls = []

    def write(fd: int, raw: bytes) -> int:
        calls.append((fd, raw))
        if len(calls) == 1:
            return 1
        if len(calls) == 2:
            raise OSError("after one byte")
        return len(raw)

    monkeypatch.setattr(os, "write", write)
    monkeypatch.setattr(peer, "_poll_io", lambda **_: True)
    try:
        with pytest.raises(bridge._Stop):
            peer.send(b"first\n")
        with pytest.raises(bridge._Stop):
            peer.send(b"later\n")
        assert len(calls) == 2
        assert len(peer.available().Writes) == 1
        assert peer.available().Writes[0].WrittenBytes == 1
    finally:
        peer.close(normal=False)


def test_error_variant_requires_actual_nonnull_failure() -> None:
    with pytest.raises(bridge._Stop):
        bridge._unit_result({"Kind": "Error", "Failure": None})


def _query_plan() -> dict[str, Any]:
    row = {
        "Id": "fixture/query",
        "Origin": 0,
        "FeatureAvailable": 0,
        "TargetTime": 1,
        "LabelAvailable": 1,
        "Split": "control",
        "Features": [_hex(0)] * 8,
        "Target": None,
        "Uses": [],
    }
    row["ContentSha256"] = bridge._sha(bridge._canonical(row, bridge.MIB))
    cut: dict[str, Any] = {
        "Id": "fixture/cut",
        "Rows": [row],
        "ActiveIds": ["fixture/query"],
        "PriorOwners": {},
        "ParentCut": None,
        "Retractions": [],
    }
    cut["PriorOwners"] = {
        bridge._sha(
            bridge._canonical(
                {
                    "Kind": "mixed-epoch-variable-v1",
                    "InstancePath": "fixture/gate",
                    "Role": "z",
                },
                4096,
            )
        ): "fixture/prior"
    }
    state = {
        "Revision": 0,
        "Weights": {},
        "GaussianSites": [],
        "GammaSites": [],
        "Outputs": {},
        "ActiveCut": bridge._sha(bridge._canonical(cut, bridge.MIB)),
    }
    node: dict[str, Any] = {
        "Id": "fixture/gate",
        "InstancePath": "fixture/gate",
        "Kind": "precision-gate",
        "Inputs": [],
        "Artifact": None,
        "Prior": {
            "Gaussian": {"PrecisionMean": _hex(0), "Precision": _hex(1)},
            "Gammas": [],
        },
        "Unary": {"K": _hex(0), "C": _hex(1)},
        "Children": None,
        "OutputAlias": None,
    }
    return {
        "Id": "fixture/plan",
        "Mode": "query",
        "EvidenceCut": cut,
        "QueryRowId": "fixture/query",
        "Nodes": [node],
        "SelectedVersions": {},
        "InitialState": state,
        "Operations": [{"Kind": "GaussianBlock", "NodeId": "fixture/gate", "Sweep": 0}],
        "Sweeps": 1,
        "Damping": _hex(1),
        "Training": None,
        "Horizon": 1,
        "SourceBindings": {},
    }


def test_fixed_plan_derives_one_projection_without_entering_it() -> None:
    plan = _query_plan()
    admitted = bridge.admit_plan(_frame(plan), {})
    assert isinstance(admitted, bridge.AdmittedPlan)
    assert admitted.Projections == 1
    assert admitted.Operations == tuple(plan["Operations"])


@pytest.mark.parametrize(
    "mutation",
    [
        "omitted-operation",
        "boolean-sweeps",
        "unknown-field",
        "target-visible",
        "gamma-without-input",
        "cut-content",
        "node-cycle",
    ],
)
def test_complete_plan_refuses_structural_drift(mutation: str) -> None:
    plan = _query_plan()
    if mutation == "omitted-operation":
        plan["Operations"] = []
    elif mutation == "boolean-sweeps":
        plan["Sweeps"] = True
    elif mutation == "unknown-field":
        plan["extra"] = None
    elif mutation == "target-visible":
        plan["EvidenceCut"]["Rows"][0]["Target"] = _hex(1)
    elif mutation == "gamma-without-input":
        plan["Nodes"][0]["Prior"]["Gammas"] = [{"Shape": _hex(1), "Rate": _hex(1)}]
    elif mutation == "cut-content":
        plan["EvidenceCut"]["Rows"][0]["Features"][0] = _hex(2)
    else:
        plan["Nodes"][0]["Inputs"] = [
            {"SourceNode": "fixture/gate", "SourcePort": "mean", "TargetSlot": 0}
        ]
        plan["Nodes"][0]["Prior"]["Gammas"] = [{"Shape": _hex(1), "Rate": _hex(1)}]
    admitted = bridge.admit_plan(_frame(plan), {})
    assert isinstance(admitted, bridge.Failure)


def test_public_frame_cannot_drift_from_retained_original() -> None:
    request = _request()
    request.Value["TargetBits"]["K"] = _hex(1)
    with pytest.raises(bridge._Stop):
        bridge._request_input(request, {})


def test_public_handle_cannot_be_constructed_or_used_without_issuance() -> None:
    with pytest.raises(TypeError):
        bridge.Bridge(None)
    fake = object.__new__(bridge.Bridge)
    result = bridge.run_session(fake, b"{}", "fixture")
    assert isinstance(result, bridge.Failure)
    finished = bridge.finish_bridge(fake)
    assert finished.Closed is False and finished.Failure is not None


def test_shared_string_escaping_golden() -> None:
    value = {
        "Type": "Zeta.Bayesian.BoundedModuleLearner+StepAttempt",
        "Text": '<>&"\\/é😀\u2028\u2029',
        "Controls": "".join(chr(i) for i in range(32)),
    }
    controls = b"\\u0000\\u0001\\u0002\\u0003\\u0004\\u0005\\u0006\\u0007\\b\\t\\n\\u000b\\f\\r\\u000e\\u000f\\u0010\\u0011\\u0012\\u0013\\u0014\\u0015\\u0016\\u0017\\u0018\\u0019\\u001a\\u001b\\u001c\\u001d\\u001e\\u001f"
    expected = (
        b'{"Controls":"'
        + controls
        + b'","Text":"<>&\\"\\\\/\xc3\xa9\xf0\x9f\x98\x80\xe2\x80\xa8\xe2\x80\xa9","Type":"Zeta.Bayesian.BoundedModuleLearner+StepAttempt"}'
    )
    actual = bridge._canonical(value, 4096)
    assert actual == expected
    decoded = bridge._json(actual, 4096)
    assert decoded == value


def _forward_plan() -> bridge.AdmittedPlan:
    plan = _query_plan()
    node = plan["Nodes"][0]
    node.update(Kind="neural", Artifact="fixture/model", Prior=None, Unary=None)
    plan["EvidenceCut"]["PriorOwners"] = {}
    plan["InitialState"]["ActiveCut"] = bridge._sha(
        bridge._canonical(plan["EvidenceCut"], bridge.MIB)
    )
    artifact = {
        "Id": "fixture/model",
        "ParentVersion": None,
        "TrainingCut": "A" * 64,
        "Architecture": "point-mlp-12-4-1-v1",
        "Ports": ["absent", "absent"],
        "Parameters": [_hex(0)] * 57,
        "Preprocessing": {
            "TrainingCut": "A" * 64,
            "Count": 1,
            "Means": [_hex(0)] * 8,
            "Scales": [_hex(1)] * 8,
        },
        "UpdateReceiptSha256": "B" * 64,
        "SourceBindings": {},
    }
    plan["SelectedVersions"] = {
        "fixture/model": {
            "Version": bridge._sha(bridge._canonical(artifact, 65536)),
            "Artifact": artifact,
        }
    }
    plan["Operations"] = [
        {"Kind": "NeuralForward", "NodeId": "fixture/gate", "Sweep": 0}
    ]
    admitted = bridge.admit_plan(_frame(plan), {})
    assert isinstance(admitted, bridge.AdmittedPlan)
    return admitted


def _simulated_owner(tmp_path: Path) -> bridge._Owner:
    import time

    owner = bridge._Owner(bridge._ISSUER)
    owner.SourceRoot = tmp_path
    owner.Host = tmp_path / "dotnet"
    owner.AttemptRoot = tmp_path
    owner.AttemptOwned = True
    owner.Manifest = bridge.ServiceManifest(b"fixture", "B" * 64, (), (), ())
    owner.Store = _store(tmp_path)
    owner.Budget = bridge._Budget(
        bridge.Reservation(0, 0, 0, records.Limits()), time.monotonic()
    )
    owner.Budget.Calls = owner.Calls
    return owner


def _counter_fixture() -> dict[str, Any]:
    result: dict[str, Any] = dict.fromkeys(bridge._COUNTER_CAPS, 0)
    result.update(
        SchedulerEntered=1, ForwardEntered=1, Returned=1, Proposed=1, Applied=1
    )
    result["Remote"] = {
        name: {"Observed": 0, "Complete": True} for name in bridge._REMOTE_KEYS
    }
    return result


class _FixturePeer:
    """Declared transport simulation; no peer/core/native numerical process."""

    mutation = "none"

    def __init__(
        self,
        argv: tuple[str, ...],
        cwd: Path,
        budget: bridge._Budget,
        maximum_launches: int,
    ):
        self.budget = budget
        budget.PeerLaunches += 1
        self.received: list[bytes] = []
        self.sent: list[bytes] = []
        self.queue: list[bytes] = []
        self.observation = bridge.PeerObservation(
            argv, "synthetic transport fixture", LaunchAttempted=True, StderrEof=True
        )
        self.result: dict[str, Any] = {}
        self.plan: dict[str, Any] = {}
        self.checkpoint: dict[str, Any] = {}
        self.session = ""
        self.checkpoint_raw = b""
        self.return_raw = b""

    def available(self) -> bridge.PeerObservation:
        return self.observation

    def header(self, kind: str) -> dict[str, Any]:
        return {"Kind": kind, "Schema": bridge.SCHEMA, "SessionId": self.session}

    def send(self, raw: bytes) -> bridge.WriteObservation:
        self.budget.charge_frame(len(raw))
        self.sent.append(raw)
        value = json.loads(raw)
        if value["Kind"] == "Start":
            self.session = value["SessionId"]
            self.plan = value["Plan"]
            self.queue.append(
                _frame(
                    self.header("Ready")
                    | {
                        "PlanSha256": value["PlanSha256"],
                        "ServiceSha256": value["ServiceSha256"],
                    }
                )
            )
            state = json.loads(json.dumps(self.plan["InitialState"]))
            state["Revision"] = 1
            state["Outputs"] = {
                "fixture/gate": {"Mean": _hex(0), "Variance": None, "SourceSequence": 1}
            }
            call = {
                "Kind": "Returned",
                "Result": {
                    "Type": "Zeta.Bayesian.BoundedModuleLearner+ForwardAttempt",
                    "Fields": {
                        "Input": {
                            "Parameters": [_hex(0)] * 57,
                            "Inputs": [_hex(0)] * 12,
                        },
                        "Preactivations": [_hex(0)] * 4,
                        "Hidden": [_hex(0)] * 4,
                        "Outcome": {"Kind": "Ok", "Value": _hex(0)},
                    },
                },
            }
            observation = {
                "Sequence": 1,
                "Operation": self.plan["Operations"][0],
                "InputRevision": 0,
                "Inputs": {
                    "Kind": "NeuralForward",
                    "NodeId": "fixture/gate",
                    "RowId": self.plan["QueryRowId"],
                    "ArtifactVersion": self.plan["SelectedVersions"]["fixture/model"][
                        "Version"
                    ],
                    "Transform": {"Kind": "NotEntered"},
                    "Inputs": [_hex(0)] * 12,
                },
                "Call": call,
                "Proposal": {
                    "ExpectedRevision": 0,
                    "ExpectedStateSha256": bridge._sha(
                        bridge._canonical(self.plan["InitialState"], bridge.MIB)
                    ),
                    "State": state,
                    "Details": {},
                },
                "Admission": {"Kind": "Ok", "Value": None},
                "AppliedRevision": None,
                "Failure": None,
            }
            self.checkpoint = self.header("Checkpoint") | {
                "Sequence": 1,
                "Observation": observation,
                "LastRevision": 0,
                "StateSha256": observation["Proposal"]["ExpectedStateSha256"],
            }
            self.checkpoint_raw = _frame(self.checkpoint)
            self.queue.append(self.checkpoint_raw)
        elif value["Sequence"] == 1:
            assert value["CheckpointSha256"] == bridge._sha(self.checkpoint_raw)
            descriptor = value["Outcome"]["Artifact"]
            assert descriptor["Sha256"] == bridge._sha(self.checkpoint_raw)
            committed = json.loads(json.dumps(self.checkpoint["Observation"]))
            committed["AppliedRevision"] = 1
            counters = _counter_fixture()
            commit = self.header("Commit") | {
                "Sequence": 1,
                "CheckpointSha256": bridge._sha(self.checkpoint_raw),
                "AppliedRevision": 1,
                "LastCommitted": committed["Proposal"]["State"],
                "Counters": counters,
            }
            if self.mutation == "wrong-commit":
                commit["CheckpointSha256"] = "C" * 64
            if self.mutation != "missing-commit":
                self.queue.append(_frame(commit))
            self.result = {
                "PlanSha256": bridge._sha(bridge._canonical(self.plan, bridge.MIB)),
                "Outcome": "completed",
                "Termination": "BudgetCompleted",
                "Failure": None,
                "LastCommitted": committed["Proposal"]["State"],
                "ProposedArtifacts": [],
                "Observations": [committed],
                "Counters": counters,
                "PendingRequest": None,
                "Scheduler": {"Kind": "Returned", "Result": {"Kind": "Ok", "Value": 1}},
                "Publication": {
                    "Recorder": [],
                    "Unpublished": [],
                    "Failure": None,
                    "BudgetSnapshot": value["BudgetSnapshot"],
                },
            }
            if self.mutation == "changed-return":
                self.result["Observations"][0]["Inputs"] = {"changed": True}
            if self.mutation == "missing-return":
                self.queue.append(
                    _frame(
                        self.header("Terminal")
                        | {
                            key: self.result[key]
                            for key in (
                                "Outcome",
                                "Termination",
                                "Failure",
                                "Counters",
                                "LastCommitted",
                                "PendingRequest",
                            )
                        }
                        | {
                            "LedgerCount": 1,
                            "LedgerSha256": bridge._sha(
                                bridge._canonical(
                                    self.result["Observations"], 16 * bridge.MIB
                                )
                            ),
                            "Publication": {},
                        }
                    )
                )
            else:
                returned = self.header("EpochReturn") | {
                    "Sequence": 2,
                    "Result": self.result,
                    "ResultSha256": bridge._sha(
                        bridge._canonical(self.result, 16 * bridge.MIB)
                    ),
                }
                self.return_raw = _frame(returned)
                self.queue.append(self.return_raw)
        else:
            transport = {
                "IncomingBytes": sum(map(len, self.sent)),
                "IncomingFrames": len(self.sent),
                "OutgoingReservedBytes": sum(map(len, self.received)),
                "OutgoingReservedFrames": len(self.received),
                "OutgoingCompletedBytes": sum(map(len, self.received)),
                "OutgoingCompletedFrames": len(self.received),
                "PartialWrite": None,
            }
            publication: dict[str, Any] = {
                "EpochReturn": {
                    "Sequence": 2,
                    "ResultSha256": bridge._sha(
                        bridge._canonical(self.result, 16 * bridge.MIB)
                    ),
                    "FrameSha256": bridge._sha(self.return_raw),
                    "Artifact": value["Outcome"]["Artifact"],
                },
                "ResultRetention": "acknowledged",
                "Failure": None,
                "Transport": {
                    "Coordinator": value["BudgetSnapshot"],
                    "Peer": transport,
                },
            }
            terminal = (
                self.header("Terminal")
                | {
                    key: self.result[key]
                    for key in (
                        "Outcome",
                        "Termination",
                        "Failure",
                        "Counters",
                        "LastCommitted",
                        "PendingRequest",
                    )
                }
                | {
                    "LedgerCount": 1,
                    "LedgerSha256": bridge._sha(
                        bridge._canonical(self.result["Observations"], 16 * bridge.MIB)
                    ),
                    "Publication": publication,
                }
            )
            if self.mutation == "wrong-return-link":
                publication["EpochReturn"]["ResultSha256"] = "D" * 64
            self.queue.append(_frame(terminal))
            if self.mutation == "after-terminal":
                self.queue.append(b"{}\n")
        return bridge.WriteObservation(raw, len(raw), None)

    def receive(self, *, terminal: bool = False) -> bytes | None:
        if not self.queue:
            self.observation = replace(self.observation, StdoutEof=True)
            return None
        raw = self.queue.pop(0)
        self.budget.charge_frame(len(raw), terminal=terminal)
        self.received.append(raw)
        return raw

    def close(self, *, normal: bool) -> bridge.PeerObservation:
        self.observation = replace(
            self.observation,
            DirectChildClosed=True,
            ExitCode=0,
            Stdout=tuple(self.received),
        )
        return self.observation


def test_actual_store_ack_commit_and_complete_return_chain(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = _simulated_owner(tmp_path)
    plan = _forward_plan()
    session = bridge.SessionResult("fixture", plan.Raw, Plan=plan)
    monkeypatch.setattr(bridge, "_Peer", _FixturePeer)
    bridge._run_peer(owner, session)
    assert session.Failure is None
    assert session.Closed and session.ForecastEligible
    assert (
        session.LastObservedCommitted is not None
        and session.LastObservedCommitted["Revision"] == 1
    )
    assert (
        len(session.Checkpoints)
        == len(session.Commits)
        == len(session.CommitPages)
        == 1
    )
    assert session.EpochReturn is not None and session.EpochReturnArtifact is not None
    assert (
        session.EpochReturn.Value["Result"]["Publication"]["BudgetSnapshot"]
        != cast(Any, session.Terminal).Value["Publication"]["Transport"]["Coordinator"]
    )
    assert session.EpochReturnAck is not None and session.EpochReturnAck.Failure is None
    assert (
        owner.Budget is not None
        and owner.Budget.NativeCallEntered == owner.Budget.CertificateEntered == 0
    )


@pytest.mark.parametrize(
    "mutation",
    [
        "wrong-commit",
        "missing-commit",
        "changed-return",
        "missing-return",
        "wrong-return-link",
        "after-terminal",
    ],
)
def test_transport_association_refusals_keep_actual_prefix(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, mutation: str
) -> None:
    owner = _simulated_owner(tmp_path)
    plan = _forward_plan()
    session = bridge.SessionResult("fixture", plan.Raw, Plan=plan)

    class MutatedPeer(_FixturePeer):
        pass

    MutatedPeer.mutation = mutation
    monkeypatch.setattr(bridge, "_Peer", MutatedPeer)
    bridge._run_peer(owner, session)
    assert session.Failure is not None
    assert not session.Closed and not session.ForecastEligible
    assert session.Checkpoints[0][1] is not None
    assert session.Peer is not None and session.Peer.DirectChildClosed
    if mutation in ("wrong-commit", "missing-commit"):
        assert session.LastObservedCommitted == plan.Value["InitialState"]
    else:
        assert (
            session.LastObservedCommitted is not None
            and session.LastObservedCommitted["Revision"] == 1
        )


def _manifest_fixture() -> dict[str, Any]:
    paths = sorted(bridge.REQUIRED_SOURCES)
    sources = [
        {
            "Path": path,
            "Bytes": 1,
            "Sha256": bridge.FIXED_SOURCE_PINS.get(path, "A" * 64),
        }
        for path in paths
    ]
    direct = [
        {"Role": role, "Bytes": 1, "Sha256": "A" * 64} for role in bridge.DIRECT_ROLES
    ]
    bindings = {row["Path"]: row["Sha256"] for row in sources}
    bindings.update(
        {
            row["Role"]: row["Sha256"]
            for row in direct
            if not str(row["Role"]).startswith("@")
        }
    )
    bindings["ProtocolSha256"] = reference.PROTOCOL_SHA256
    return {
        "Schema": bridge.SERVICE_SCHEMA,
        "ExpectedBindings": bindings,
        "SourceFiles": sources,
        "DirectFiles": direct,
    }


def test_complete_independent_manifest_is_pure_and_exact() -> None:
    value = _manifest_fixture()
    raw = _frame(value)
    observed = bridge.admit_service_manifest(raw, bridge._sha(raw))
    assert isinstance(observed, bridge.ServiceManifest)
    assert observed.Raw == raw
    assert len(observed.DirectFiles) == 7
    assert dict(observed.Bindings)["ProtocolSha256"] == reference.PROTOCOL_SHA256


@pytest.mark.parametrize(
    "mutation",
    [
        "missing-contract",
        "source-order",
        "bool-size",
        "host-overcap",
        "protocol",
        "extra-binding",
    ],
)
def test_manifest_drift_refuses_before_source_read_or_setup(mutation: str) -> None:
    value = _manifest_fixture()
    if mutation == "missing-contract":
        value["SourceFiles"] = [
            row
            for row in value["SourceFiles"]
            if row["Path"] != bridge.TRANSPORT_AMENDMENT
        ]
    elif mutation == "source-order":
        value["SourceFiles"][0], value["SourceFiles"][1] = (
            value["SourceFiles"][1],
            value["SourceFiles"][0],
        )
    elif mutation == "bool-size":
        value["DirectFiles"][0]["Bytes"] = True
    elif mutation == "host-overcap":
        value["DirectFiles"][1]["Bytes"] = native.FILE_CAP + 1
    elif mutation == "protocol":
        value["ExpectedBindings"]["ProtocolSha256"] = "F" * 64
    else:
        value["ExpectedBindings"]["unknown"] = "F" * 64
    raw = _frame(value)
    observed = bridge.admit_service_manifest(raw, bridge._sha(raw))
    assert isinstance(observed, bridge.Failure)


def test_source_identity_refusal_keeps_actual_read_and_hash(tmp_path: Path) -> None:
    import time

    root = Path(__file__).resolve().parents[3]
    path = tmp_path / "source.txt"
    path.write_bytes(b"read me")
    relative = str(path.relative_to(root))
    manifest = bridge.ServiceManifest(
        b"fixture", "A" * 64, (), (bridge.SourceFile(relative, 7, "B" * 64),), ()
    )
    budget = bridge._Budget(
        bridge.Reservation(0, 0, 0, records.Limits()), time.monotonic()
    )
    snapshot = bridge._sources(root, root / "unused-host", manifest, budget)
    assert snapshot.Failure is not None and snapshot.Failure.Code == "Conflict"
    assert len(snapshot.Reads) == 1
    assert snapshot.Reads[0].Actual == native.FileIdentity(7, bridge._sha(b"read me"))
    assert cast(Any, snapshot.Reads[0].Observation.Returned).value == b"read me"


def test_ordinary_store_write_preserves_terminal_reserve(tmp_path: Path) -> None:
    import time

    limits = records.Limits(12 * bridge.MIB, 8 * bridge.MIB, 8)
    opened = records.open_store(tmp_path, "limited", limits)
    assert isinstance(opened, records.Opened)
    budget = bridge._Budget(bridge.Reservation(0, 0, 0, limits), time.monotonic())
    with pytest.raises(bridge._Stop):
        bridge._store_bytes(opened.Store, "too-large", b"x" * (bridge.MIB + 1), budget)
    actual = records.snapshot(opened.Store)
    assert isinstance(actual, admission.Admitted)
    assert (
        actual.value.ReservedRawBytes + actual.value.ReservedStoredBytes
        == 8 * bridge.MIB
    )
    assert not any(call.Operation.startswith("append_bytes/") for call in budget.Calls)


def test_final_counter_failure_preserves_first_failure_and_finalizes_once(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = _simulated_owner(tmp_path)
    first = bridge.Failure("Service", "project", "Native", "actual first failure")
    bridge._bridge_failure(owner, first)
    finalizations = []
    actual_finalize = records.finalize

    def finalize(store: records.Store) -> object:
        finalizations.append(store)
        return actual_finalize(store)

    def failed_clock() -> float:
        raise OSError("counter clock")

    assert owner.Budget is not None
    owner.Budget.Clock = failed_clock
    monkeypatch.setattr(records, "finalize", finalize)
    result = bridge._finish_bridge(owner)
    assert result.Failure is first
    assert len(finalizations) == 1 and result.Finalization is not None
    again = bridge._finish_bridge(owner)
    assert again is result and len(finalizations) == 1


def test_native_refusal_precedes_later_encoding_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    actual = native.NativeObservation(
        Failure=native.ProcessFailure("fixture", "control", "original")
    )

    def launch(*_: object, **__: object) -> object:
        return actual

    def refused_encoder(*_: object, **__: object) -> object:
        raise OSError("later encoding")

    monkeypatch.setattr(encoding, "encode_public_result", refused_encoder)
    budget = _budget()
    retained: list[bridge.ProjectionExchange] = []
    response = bridge._projection(
        _request(),
        _prepared(),
        {},
        "B" * 64,
        tmp_path / "native",
        _store(tmp_path),
        budget,
        retained,
        bridge._Services(launch, launch),
    )
    assert response["Failure"]["Code"] == "Service"
    assert retained[0].Native is not None and retained[0].Native.Returned is actual
    assert any(
        call.Operation.startswith("encode_public_result/") and call.Raised is not None
        for call in budget.Calls
    )


def _complete_session(
    owner: bridge._Owner, monkeypatch: pytest.MonkeyPatch
) -> bridge.SessionResult:
    plan = _forward_plan()
    owner.FirstPlan = plan
    monkeypatch.setattr(
        bridge, "_sources", lambda *_: bridge.SourceSnapshot((), (), None)
    )
    monkeypatch.setattr(bridge, "_Peer", _FixturePeer)
    result = bridge._run_session(owner, plan.Raw, "fixture")
    assert isinstance(result, bridge.SessionResult)
    return result


def test_seal_encoding_refusal_retains_actual_session(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = _simulated_owner(tmp_path)

    def refused_seal(_: object) -> bytes:
        raise OSError("seal encoding")

    monkeypatch.setattr(bridge, "_session_seal", refused_seal)
    result = _complete_session(owner, monkeypatch)
    assert (
        result.LastObservedCommitted is not None
        and result.LastObservedCommitted["Revision"] == 1
    )
    assert result.Failure is not None and not result.ForecastEligible
    assert result.EpochReturn is not None and result.EpochReturnAck is not None
    final = bridge._finish_bridge(owner)
    assert final.Finalization is not None and not final.Closed


def test_finalization_retains_original_summary_on_caller_drift(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = _simulated_owner(tmp_path)
    session = _complete_session(owner, monkeypatch)
    assert session.ForecastEligible and session.LastObservedCommitted is not None
    session.LastObservedCommitted["Revision"] = 99
    result = bridge._finish_bridge(owner)
    assert result.Failure is not None and not result.Closed
    assert result.Finalization is not None and result.FinalRecord is not None
    assert result.FinalRecord.Encoding == "identity"
    raw = (tmp_path / result.FinalRecord.File).read_bytes()
    summary = json.loads(raw)
    assert summary["Sessions"][0]["LastObservedCommitted"]["Revision"] == 1


@pytest.mark.parametrize(
    "path,sha",
    [
        (
            "docs/research/2026-09-08-precision-gate-projection-decimal-admission-clarification.md",
            "BA359E4FEC2484A680B6B149E6E887FBEA82AFBB67A15EAFBDB99949101BDAB8",
        ),
        (
            "docs/research/2026-09-08-precision-gate-projection-rendered-zero-clarification.md",
            "67B7C9EFB6B42CEFE341507738B6122FAC4BEDF18C07A72564F3DEEFEE71235E",
        ),
    ],
)
@pytest.mark.parametrize("mutation", ["missing", "changed"])
def test_service_manifest_requires_unchanged_scalar_clarifications(
    path: str, sha: str, mutation: str
) -> None:
    value = _manifest_fixture()
    value["SourceFiles"] = [row for row in value["SourceFiles"] if row["Path"] != path]
    value["ExpectedBindings"].pop(path, None)
    if mutation == "changed":
        value["SourceFiles"].append({"Path": path, "Bytes": 1, "Sha256": "F" * 64})
        value["SourceFiles"].sort(key=lambda row: row["Path"])
        value["ExpectedBindings"][path] = "F" * 64
    raw = _frame(value)
    result = bridge.admit_service_manifest(raw, bridge._sha(raw))
    assert isinstance(result, bridge.Failure)


def test_inert_fixed_initial_controls_do_not_enter_services(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from zeta_interp import mixed_message_epoch_controls as controls

    def forbidden(*_: object, **__: object) -> object:
        pytest.fail("inert builder entered a service")

    monkeypatch.setattr(native, "launch_native", forbidden)
    monkeypatch.setattr(reference, "certify_native", forbidden)
    m4 = controls.m4_plan({})
    child = controls.m5_child_plan({})
    assert isinstance(m4, controls.ControlPlan) and isinstance(
        child, controls.ControlPlan
    )
    m4_plan = bridge.admit_plan(m4.Raw, {})
    child_plan = bridge.admit_plan(child.Raw, {})
    assert isinstance(m4_plan, bridge.AdmittedPlan) and m4_plan.Projections == 2
    assert [op["NodeId"] for op in m4_plan.Operations] == [
        "control/0-positive",
        "control/1-cancellation",
    ]
    assert (
        m4_plan.Value["Nodes"][1]["Prior"]["Gaussian"]["Precision"]
        == "01A56E1FC2F8F359"
    )
    assert isinstance(child_plan, bridge.AdmittedPlan) and child_plan.Projections == 0
    assert [op["RowId"] for op in child_plan.Operations] == [
        "control/learn/0",
        "control/learn/1",
    ] * 2
    assert child_plan.Value["Training"]["CutEnd"] == 3
    assert not m4.Forecasts and not child.Forecasts


def test_dependent_controls_refuse_unissued_sessions() -> None:
    from zeta_interp import mixed_message_epoch_controls as controls

    fake = bridge.SessionResult("fake", b"{}")
    for result in (
        controls.m5_query_two_plan(fake),
        controls.m5_query_three_plan(fake),
        controls.m5_parent_plan(fake, fake, fake),
        controls.frozen_nested_query_plan(fake, fake, {}),
    ):
        assert isinstance(result, bridge.Failure)


def _gamma_codec_golden() -> dict[str, Any]:
    contribution = (
        hashlib.sha256(
            b'{"Factor":"normal/0","InstancePath":"fixture/gamma","Kind":"mixed-epoch-factor-v1"}'
        )
        .hexdigest()
        .upper()
    )
    state = {
        "Revision": 1,
        "Weights": {},
        "GaussianSites": [],
        "GammaSites": [
            {
                "Key": {
                    "InstancePath": "fixture/gamma",
                    "Factor": "normal/0",
                    "Port": "gamma",
                    "ContributionId": contribution,
                },
                "Value": {"LogPower": "0000000000000000", "Rate": "3FF0000000000000"},
            }
        ],
        "Outputs": {},
        "ActiveCut": "A" * 64,
    }
    call = {
        "Kind": "Returned",
        "Result": {
            "Type": "Zeta.Bayesian.MixedMessageEpoch+BlockAttempt",
            "Fields": {
                "Inputs": {},
                "Calls": [
                    {
                        "Operation": "tryGammaProduct",
                        "Inputs": {},
                        "Call": {
                            "Kind": "Returned",
                            "Result": {
                                "Kind": "Ok",
                                "Value": {
                                    "LogPower": "0000000000000000",
                                    "Rate": "3FF0000000000000",
                                },
                            },
                        },
                    }
                ],
                "Proposal": {
                    "ExpectedRevision": 0,
                    "ExpectedStateSha256": "B" * 64,
                    "State": state,
                    "Details": {},
                },
                "Outcome": {"Kind": "Ok", "Value": None},
            },
        },
    }
    return {"State": state, "Call": call}


def test_nonempty_gamma_state_and_closed_kernel_catalog_golden() -> None:
    value = _gamma_codec_golden()
    bridge._state(value["State"])
    bridge._call(value["Call"], "GammaBlock")
    raw = bridge._canonical(value, bridge.MIB)
    assert json.loads(raw) == value
    assert len(raw) == 1235
    assert (
        hashlib.sha256(raw).hexdigest().upper()
        == "7EC5B37CA1D3998375A50432765E7241E1FD0F9108BB2F72CE04602CBB7C6009"
    )
    assert b'"LogPower":"0000000000000000"' in raw
    assert b"ShapeMinusOne" not in raw


@pytest.mark.parametrize(
    "mutation",
    [
        "unknown-type",
        "unknown-operation",
        "null-error",
        "unknown-kernel-field",
        "missing-rate",
        "wrong-gamma-name",
        "bool-bits",
    ],
)
def test_closed_nested_gamma_catalog_refuses_shape_drift(mutation: str) -> None:
    value = _gamma_codec_golden()
    fields = value["Call"]["Result"]["Fields"]
    primitive = fields["Calls"][0]
    if mutation == "unknown-type":
        value["Call"]["Result"]["Type"] += ".Unknown"
    elif mutation == "unknown-operation":
        primitive["Operation"] = "eval"
    elif mutation == "null-error":
        primitive["Call"]["Result"] = {"Kind": "Error", "Failure": None}
    elif mutation == "unknown-kernel-field":
        primitive["Call"]["Result"]["Value"]["extra"] = 0
    elif mutation == "missing-rate":
        primitive["Call"]["Result"]["Value"].pop("Rate")
    elif mutation == "wrong-gamma-name":
        value["State"]["GammaSites"][0]["Value"]["ShapeMinusOne"] = value["State"][
            "GammaSites"
        ][0]["Value"].pop("LogPower")
    else:
        primitive["Call"]["Result"]["Value"]["Rate"] = True
    with pytest.raises(bridge._Stop):
        bridge._call(value["Call"], "GammaBlock")


@pytest.mark.parametrize(
    "value",
    [
        None,
        {"Kind": "NotEntered"},
        {"Kind": "Returned", "Result": {"Kind": "Ok", "Value": True}},
        {"Kind": "Returned", "Result": {"Kind": "Error", "Failure": None}},
        {
            "Kind": "Returned",
            "Result": {"Kind": "Error", "Failure": {"Kind": "MadeUp", "Message": "x"}},
        },
    ],
)
def test_scheduler_closed_union_rejects_malformed_normal_returns(value: object) -> None:
    with pytest.raises(bridge._Stop):
        bridge._scheduler(value)


def test_sequence_gap_retains_admitted_original_return_before_transport_refusal(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    class GapPeer(_FixturePeer):
        def receive(self, *, terminal: bool = False) -> bytes | None:
            raw = super().receive(terminal=terminal)
            if raw is not None:
                value = json.loads(raw)
                if value["Kind"] == "EpochReturn":
                    value["Sequence"] += 1
                    value["Result"].update(
                        Outcome="refused",
                        Termination="Refused",
                        Failure={
                            "Code": "Service",
                            "Stage": "project",
                            "Field": "Original",
                            "Message": "retained core refusal",
                        },
                    )
                    value["ResultSha256"] = bridge._sha(
                        bridge._canonical(value["Result"], 16 * bridge.MIB)
                    )
                    return _frame(value)
            return raw

    owner = _simulated_owner(tmp_path)
    plan = _forward_plan()
    session = bridge.SessionResult("fixture", plan.Raw, Plan=plan)
    monkeypatch.setattr(bridge, "_Peer", GapPeer)
    bridge._run_peer(owner, session)
    assert session.ReturnAdmitted and session.EpochReturn is not None
    assert session.EpochReturn.Value["Result"]["Failure"]["Field"] == "Original"
    assert session.Failure is not None and session.Failure.Field == "Sequence"
    assert not session.ForecastEligible and session.EpochReturnArtifact is None
    assert (
        session.LastObservedCommitted is not None
        and session.LastObservedCommitted["Revision"] == 1
    )


def test_admission_elapsed_time_is_not_refunded_before_owned_setup(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from types import SimpleNamespace

    now = [0.0]
    plan = _forward_plan()
    manifest = _manifest_fixture()
    raw = _frame(manifest)
    actual_admit_plan = bridge.admit_plan
    original_budget = bridge._Budget
    source_calls: list[object] = []

    def elapsed_admission(*args: Any, **kwargs: Any) -> object:
        result = actual_admit_plan(*args, **kwargs)
        now[0] = 301.0
        return result

    def sources(*args: object) -> bridge.SourceSnapshot:
        source_calls.append(args)
        return bridge.SourceSnapshot((), (), None)

    def budget(reservation: bridge.Reservation, started: float) -> bridge._Budget:
        return original_budget(reservation, started, lambda: now[0])

    # Only the local cooperative clock is replaced; no sleep or actual service.
    monkeypatch.setattr(bridge, "time", SimpleNamespace(monotonic=lambda: now[0]))
    monkeypatch.setattr(bridge, "_Budget", budget)
    monkeypatch.setattr(bridge, "_sources", sources)
    monkeypatch.setattr(bridge, "admit_plan", elapsed_admission)
    plan_value = json.loads(plan.Raw)
    plan_value["SourceBindings"] = manifest["ExpectedBindings"]
    artifact = plan_value["SelectedVersions"]["fixture/model"]["Artifact"]
    artifact["SourceBindings"] = manifest["ExpectedBindings"]
    plan_value["SelectedVersions"]["fixture/model"]["Version"] = bridge._sha(
        bridge._canonical(artifact, 65536)
    )
    observed = bridge._open_bridge(
        tmp_path,
        tmp_path,
        "timed",
        tmp_path / "host",
        raw,
        bridge._sha(raw),
        _frame(plan_value),
    )
    if isinstance(observed, bridge._Owner):
        bridge._finish_bridge(observed)
    assert isinstance(observed, bridge.BridgeResult)
    assert observed.Failure is not None and observed.Failure.Code == "Budget"
    assert not source_calls and not observed.AttemptOwned


def test_preparation_refusal_precedes_later_return_encoding_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from zeta_interp import mixed_message_epoch_controls as controls

    value = _manifest_fixture()
    raw = _frame(value)
    plan = controls.m4_plan(value["ExpectedBindings"])
    assert isinstance(plan, controls.ControlPlan)
    actual = replace(_prepared(), Complete=False)
    monkeypatch.setattr(
        bridge, "_sources", lambda *_: bridge.SourceSnapshot((), (), None)
    )
    monkeypatch.setattr(native, "prepare_native", lambda *_: actual)

    def refused_encoder(*_: object, **__: object) -> object:
        raise OSError("late preparation encoding")

    monkeypatch.setattr(encoding, "encode_public_result", refused_encoder)
    observed = bridge._open_bridge(
        tmp_path,
        tmp_path,
        "preparation",
        tmp_path / "host",
        raw,
        bridge._sha(raw),
        plan.Raw,
    )
    assert isinstance(observed, bridge.BridgeResult)
    assert observed.Failure is not None and observed.Failure.Code == "Service"
    assert observed.Preparation is not None and observed.Preparation.Returned is actual
    assert observed.Finalization is not None


def test_completed_return_cannot_claim_an_unparsed_pending_request(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    class PendingPeer(_FixturePeer):
        def receive(self, *, terminal: bool = False) -> bytes | None:
            raw = super().receive(terminal=terminal)
            if raw is not None:
                value = json.loads(raw)
                if value["Kind"] == "EpochReturn":
                    value["Result"]["PendingRequest"] = {"unparsed": True}
                    self.result["PendingRequest"] = {"unparsed": True}
                    value["ResultSha256"] = bridge._sha(
                        bridge._canonical(value["Result"], 16 * bridge.MIB)
                    )
                    self.return_raw = _frame(value)
                    return self.return_raw
            return raw

    owner = _simulated_owner(tmp_path)
    plan = _forward_plan()
    session = bridge.SessionResult("fixture", plan.Raw, Plan=plan)
    monkeypatch.setattr(bridge, "_Peer", PendingPeer)
    bridge._run_peer(owner, session)
    assert session.Failure is not None and not session.ReturnAdmitted
    assert session.EpochReturn is not None


@pytest.mark.parametrize("which", ["m4-sweep", "m5-pass"])
def test_fixed_operation_roster_distinguishes_boolean_and_integer(which: str) -> None:
    from zeta_interp import mixed_message_epoch_controls as controls

    built = controls.m4_plan({}) if which == "m4-sweep" else controls.m5_child_plan({})
    assert isinstance(built, controls.ControlPlan)
    value = json.loads(built.Raw)
    if which == "m4-sweep":
        value["Operations"][0]["Sweep"] = False
    else:
        value["Operations"][2]["Pass"] = True
    observed = bridge.admit_plan(_frame(value), {})
    assert isinstance(observed, bridge.Failure)


def test_checkpoint_operation_distinguishes_boolean_sweep() -> None:
    plan = _forward_plan()
    value = {
        "Sequence": 1,
        "Operation": dict(plan.Operations[0], Sweep=False),
        "InputRevision": 0,
        "Inputs": {},
        "Call": {"Kind": "NotEntered"},
        "Proposal": None,
        "Admission": None,
        "AppliedRevision": None,
        "Failure": None,
    }
    # Inputs are the source-fixed closed record so only operation kind matters.
    value["Inputs"] = {
        "Kind": "NeuralForward",
        "NodeId": "fixture/gate",
        "RowId": plan.Value["QueryRowId"],
        "ArtifactVersion": plan.Value["SelectedVersions"]["fixture/model"]["Version"],
        "Transform": {"Kind": "NotEntered"},
        "Inputs": [],
    }
    with pytest.raises(bridge._Stop):
        bridge._observation(value, plan, 0, before_apply=True)


@pytest.mark.parametrize("mutated", [False, True])
def test_passive_projection_return_preserves_bool_integer_identity(
    mutated: bool,
) -> None:
    # Association-only fixture: no native DTO admission or numerical service.
    snapshot = {"SnapshotIndex": 1}
    response = {"Sequence": 1, "Native": {"Type": "fixture", "Fields": {"ExitCode": 0}}}
    session = bridge.SessionResult("fixture", b"{}")
    session.Outgoing.append(_frame({"Kind": "Start", "BudgetSnapshot": snapshot}))
    session.Projections.append(
        bridge.ProjectionExchange(_request(), None, None, response, None)
    )
    copied = json.loads(json.dumps(response))
    if mutated:
        copied["Native"]["Fields"]["ExitCode"] = False
    result = {
        "Publication": {"BudgetSnapshot": snapshot, "Recorder": []},
        "Outcome": "completed",
        "Observations": [
            {
                "Operation": {"Kind": "GaussianBlock"},
                "Call": {
                    "Kind": "Returned",
                    "Result": {
                        "Fields": {
                            "Calls": [
                                {
                                    "Operation": "ProjectionService",
                                    "Call": {
                                        "Kind": "Returned",
                                        "Result": {"Kind": "Ok", "Value": copied},
                                    },
                                }
                            ]
                        }
                    },
                },
            }
        ],
    }
    if mutated:
        with pytest.raises(bridge._Stop) as caught:
            bridge._return_call_links(result, session)
        assert caught.value.failure.Field == "ProjectionService"
    else:
        bridge._return_call_links(result, session)


@pytest.mark.parametrize(
    ("core_count", "core_complete", "outer_count", "outer_complete", "compatible"),
    [
        (0, True, 0, True, True),
        (1, True, 0, True, False),
        (0, False, 1, True, True),
        (2, False, 1, True, False),
        (1, True, 0, False, True),
        (1, True, 2, False, False),
        (2, False, 1, False, True),
        (1, False, 2, False, True),
        (0, False, 0, True, True),
        (0, True, 0, False, True),
    ],
)
def test_returned_remote_counts_preserve_each_observers_knowledge(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    core_count: int,
    core_complete: bool,
    outer_count: int,
    outer_complete: bool,
    compatible: bool,
) -> None:
    # Full returned-frame admission with synthetic counter observations only.
    # No certificate, native process, or reference root is entered.
    owner = _simulated_owner(tmp_path)
    session = _complete_session(owner, monkeypatch)
    assert session.EpochReturn is not None and session.Plan is not None
    assert owner.Budget is not None
    budget = owner.Budget
    budget.CertificateEntered = outer_count
    if not outer_complete:
        budget.RemoteIncomplete.add("CertificateEntered")
    value = json.loads(session.EpochReturn.Raw)
    actual = {"Observed": core_count, "Complete": core_complete}
    value["Result"]["Counters"]["Remote"]["CertificateEntered"] = actual
    value["Result"]["Outcome"] = "refused"
    value["Result"]["Termination"] = "Refused"
    value["Result"]["Failure"] = {
        "Code": "Service",
        "Stage": "project",
        "Field": "Certificate",
        "Message": "synthetic unavailable reply",
    }
    value["ResultSha256"] = bridge._sha(
        bridge._canonical(value["Result"], 16 * bridge.MIB)
    )
    candidate = bridge.decode_frame(_frame(value), session.SessionId)
    assert isinstance(candidate, bridge.Frame)
    original = candidate.Raw
    if compatible:
        bridge._returned(candidate, session, session.Plan, budget)
    else:
        with pytest.raises(bridge._Stop) as caught:
            bridge._returned(candidate, session, session.Plan, budget)
        assert caught.value.failure.Field == "CertificateEntered"
    assert candidate.Raw == original
    assert (
        candidate.Value["Result"]["Counters"]["Remote"]["CertificateEntered"] == actual
    )
    assert budget.CertificateEntered == outer_count
    assert ("CertificateEntered" not in budget.RemoteIncomplete) is outer_complete


def test_completed_session_prior_work_uses_coordinator_observed_delta(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Synthetic full transport session: the counters are injected observations,
    # not evidence of a certificate/native/reference invocation.
    class CounterPeer(_FixturePeer):
        def send(self, raw: bytes) -> bridge.WriteObservation:
            sent = super().send(raw)
            message = json.loads(raw)
            if message["Kind"] == "CheckpointAck" and message["Sequence"] == 1:
                self.budget.CertificateEntered += 1
                self.result["Counters"]["Remote"]["CertificateEntered"] = {
                    "Observed": 0,
                    "Complete": False,
                }
                self.result["Outcome"] = "refused"
                self.result["Termination"] = "Refused"
                self.result["Failure"] = {
                    "Code": "Service",
                    "Stage": "project",
                    "Field": "Certificate",
                    "Message": "synthetic unavailable reply",
                }
                returned = self.header("EpochReturn") | {
                    "Sequence": 2,
                    "Result": self.result,
                    "ResultSha256": bridge._sha(
                        bridge._canonical(self.result, 16 * bridge.MIB)
                    ),
                }
                self.return_raw = _frame(returned)
                self.queue[-1] = self.return_raw
            return sent

        def close(self, *, normal: bool) -> bridge.PeerObservation:
            return replace(super().close(normal=normal), ExitCode=2)

    owner = _simulated_owner(tmp_path)
    plan = _forward_plan()
    owner.FirstPlan = plan
    monkeypatch.setattr(
        bridge, "_sources", lambda *_: bridge.SourceSnapshot((), (), None)
    )
    monkeypatch.setattr(bridge, "_Peer", CounterPeer)
    result = bridge._run_session(owner, plan.Raw, "fixture")
    assert isinstance(result, bridge.SessionResult)
    assert result.ReturnAdmitted and result.Closed and not result.ForecastEligible
    assert result.EpochReturn is not None and owner.Budget is not None
    assert owner.Budget.PriorWork["CertificateEntered"] == 1
    assert result.EpochReturn.Value["Result"]["Counters"]["Remote"][
        "CertificateEntered"
    ] == {"Observed": 0, "Complete": False}
    final = bridge._finish_bridge(owner)
    assert final.Counters["Remote"]["CertificateEntered"] == {
        "Observed": 1,
        "Complete": True,
    }


@pytest.mark.parametrize(
    ("path", "refused"),
    [
        ("extra/" + "x" * 257, True),
        ("extra/\nmodule.py", True),
        ("extra/\x7fmodule.py", True),
        ("extra/" + "x" * 250, False),
    ],
)
def test_manifest_source_paths_match_compiled_binding_admission(
    path: str, refused: bool
) -> None:
    value = _manifest_fixture()
    value["SourceFiles"].append({"Path": path, "Bytes": 1, "Sha256": "A" * 64})
    value["SourceFiles"].sort(key=lambda row: row["Path"])
    value["ExpectedBindings"][path] = "A" * 64
    raw = _frame(value)
    result = bridge.admit_service_manifest(raw, bridge._sha(raw))
    assert isinstance(result, bridge.Failure) is refused
    if not refused:
        assert len(path) == 256
        assert isinstance(result, bridge.ServiceManifest)
        assert result.Raw == raw


def _withdrawal_mark(plan: dict[str, Any]) -> None:
    plan["EvidenceCut"]["Retractions"] = ["fixture/withdrawn-history"]
    plan["InitialState"]["ActiveCut"] = bridge._sha(
        bridge._canonical(plan["EvidenceCut"], bridge.MIB)
    )


def _withdrawal_weight() -> dict[str, Any]:
    parameters = [_hex(0)] * 57
    return {
        "fixture/model": {
            "BaseArtifactId": "fixture/model",
            "VectorSha256": bridge._sha(bridge._canonical(parameters, 65536)),
            "Parameters": parameters,
        }
    }


def _withdrawal_compensation() -> dict[str, Any]:
    # Inert plan-admission payloads only: no actual historical epoch is claimed.
    retained = _query_plan()
    plan: dict[str, Any] = json.loads(json.dumps(retained))
    _withdrawal_mark(plan)
    plan.update(Mode="compensate", QueryRowId=None, Sweeps=0)
    plan["InitialState"]["Revision"] = 1
    checkpoint = json.loads(json.dumps(plan["InitialState"]))
    checkpoint["Revision"] = 0
    prior = {
        "PlanSha256": bridge._sha(bridge._canonical(retained, bridge.MIB)),
        "Outcome": "completed",
        "Termination": "BudgetCompleted",
        "Failure": None,
        "LastCommitted": json.loads(json.dumps(plan["InitialState"])),
        "ProposedArtifacts": [],
        "Observations": [],
        "Counters": _counter_fixture(),
        "PendingRequest": None,
        "Scheduler": {"Kind": "NotEntered"},
        "Publication": {
            "Recorder": [],
            "Unpublished": [],
            "Failure": None,
            "BudgetSnapshot": None,
        },
    }
    plan["Operations"] = [
        {
            "Kind": "Compensate",
            "Inputs": {
                "TargetRevision": 1,
                "RetainedPlan": retained,
                "RetainedResult": prior,
                "Checkpoint": {
                    "State": checkpoint,
                    "StateSha256": bridge._sha(
                        bridge._canonical(checkpoint, bridge.MIB)
                    ),
                    "Prefix": [],
                    "PrefixSha256": bridge._sha(bridge._canonical([], bridge.MIB)),
                },
            },
        }
    ]
    return plan


@pytest.mark.parametrize(
    "mutation",
    [
        "selected",
        "weights",
        "child-cuts",
        "child-forecasts",
        "retained-selected",
        "retained-weights",
        "checkpoint-weights",
        "overlap",
    ],
)
def test_withdrawal_admission_refuses_unproved_learned_reuse(mutation: str) -> None:
    from zeta_interp import mixed_message_epoch_controls as controls

    if mutation.startswith("child-"):
        built = controls.m5_child_plan({})
        assert isinstance(built, controls.ControlPlan)
        plan = json.loads(built.Raw)
        _withdrawal_mark(plan)
        if mutation == "child-cuts":
            cut = _query_plan()["EvidenceCut"]
            plan["Training"]["ChildCuts"] = {
                bridge._sha(bridge._canonical(cut, bridge.MIB)): cut
            }
        else:
            plan["Training"]["ChildForecasts"] = [
                {
                    "ArtifactId": "control/child",
                    "TrainingRowId": "control/learn/0",
                    "TargetSlot": 0,
                    "BundleSha256": "A" * 64,
                    "QueryRowId": "fixture/query",
                    "ProducerNode": "fixture/gate",
                    "OutputPort": "mean",
                    "ProducerVersion": "B" * 64,
                    "ProducerTrainingCut": "C" * 64,
                    "ObservationSequence": 1,
                    "CommitRevision": 1,
                    "Mean": _hex(0),
                }
            ]
    elif mutation.startswith("retained-") or mutation == "checkpoint-weights":
        plan = _withdrawal_compensation()
        context = plan["Operations"][0]["Inputs"]
        if mutation == "retained-selected":
            context["RetainedPlan"] = _forward_plan().Value
        elif mutation == "retained-weights":
            context["RetainedPlan"]["InitialState"]["Weights"] = _withdrawal_weight()
        else:
            context["Checkpoint"]["State"]["Weights"] = _withdrawal_weight()
            context["Checkpoint"]["StateSha256"] = bridge._sha(
                bridge._canonical(context["Checkpoint"]["State"], bridge.MIB)
            )
        context["RetainedResult"]["PlanSha256"] = bridge._sha(
            bridge._canonical(context["RetainedPlan"], bridge.MIB)
        )
    else:
        plan = _forward_plan().Value if mutation == "selected" else _query_plan()
        _withdrawal_mark(plan)
        if mutation == "weights":
            plan["InitialState"]["Weights"] = _withdrawal_weight()
        elif mutation == "overlap":
            plan["EvidenceCut"]["Retractions"] = [plan["QueryRowId"]]
            plan["InitialState"]["ActiveCut"] = bridge._sha(
                bridge._canonical(plan["EvidenceCut"], bridge.MIB)
            )
    result = bridge.admit_plan(_frame(plan), {})
    assert isinstance(result, bridge.Failure), result
    assert result.Code == "Conflict" and result.Stage == "admit"
    assert result.Field == "Retractions"


def test_withdrawal_admission_keeps_cold_start_and_pure_plan_scope() -> None:
    from zeta_interp import mixed_message_epoch_controls as controls

    built = controls.m5_child_plan({})
    assert isinstance(built, controls.ControlPlan)
    training = json.loads(built.Raw)
    _withdrawal_mark(training)
    training["Training"]["Artifacts"][0]["ParentVersion"] = "A" * 64
    pure_query = _query_plan()
    _withdrawal_mark(pure_query)
    for candidate in (training, pure_query, _withdrawal_compensation()):
        result = bridge.admit_plan(_frame(candidate), {})
        assert isinstance(result, bridge.AdmittedPlan), result
    # The static admission pass does not establish actual compensation history.
    # That remains the core's retained source/checkpoint/operation admission.


@pytest.mark.parametrize("wrong_hash", [False, True])
def test_withdrawal_manifest_requires_exact_clarification(wrong_hash: bool) -> None:
    path = (
        "docs/research/2026-09-08-mixed-message-withdrawal-admission-clarification.md"
    )
    value = _manifest_fixture()
    value["SourceFiles"] = [row for row in value["SourceFiles"] if row["Path"] != path]
    value["ExpectedBindings"].pop(path, None)
    if wrong_hash:
        value["SourceFiles"].append({"Path": path, "Bytes": 4448, "Sha256": "D" * 64})
        value["SourceFiles"].sort(key=lambda row: row["Path"])
        value["ExpectedBindings"][path] = "D" * 64
    raw = _frame(value)
    result = bridge.admit_service_manifest(raw, bridge._sha(raw))
    assert isinstance(result, bridge.Failure), result
