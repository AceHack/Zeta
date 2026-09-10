"""Sequential fixed-roster projection collection with retained actual returns.

Trusted, source-pinned service callbacks own execution. This coordinator does
not prove loaded code identity or transitive runtime closure. It stops new work
at the first infrastructure failure and leaves dependent slots unexecuted.
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from dataclasses import dataclass, fields
from functools import partial

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_record_encoding as encoding
from . import hidden_switch_compiled_record_store as store
from . import precision_gate_projection_cases as cases
from . import precision_gate_projection_comparison as criteria
from . import precision_gate_projection_reference as reference
from .precision_gate_projection_process import NativeObservation

LIMITS = store.Limits(256 * 1024 * 1024, 8 * 1024 * 1024, 512)
TERMINAL_BYTES = 1024 * 1024


@dataclass(frozen=True, slots=True)
class Request:
    Index: int
    CaseId: str
    NumericId: str
    RawInput: bytes
    RawNative: bytes | None
    InputSha256: str
    Bindings: dict[str, str]


@dataclass(frozen=True, slots=True)
class Services:
    NativeSolve: Callable[[Request], object]
    ReferenceRoot: Callable[[Request], object]
    CertifyNative: Callable[[Request], object]


@dataclass(slots=True)
class Entry:
    Index: int
    CaseId: str
    Operation: str
    Preparation: object = None
    Request: Request | None = None
    Entered: bool = False
    Observation: store.CallObservation | None = None
    Encoding: object = None
    Retention: object = None
    Assessment: object = None
    CompleteReceipt: bool = False
    ReceiptRetained: bool = False
    Artifacts: tuple[store.Artifact, ...] = ()


@dataclass(frozen=True, slots=True)
class RunResult:
    Entries: tuple[Entry, ...]
    Pending: tuple[tuple[str, str], ...]
    PrimaryFailure: a.Refused | None
    SecondaryFailures: tuple[object, ...]
    Helpers: tuple[store.CallObservation, ...]
    Terminal: object
    Finalization: object
    Counters: dict[str, int]
    CoreCertified: tuple[str, ...]
    ExpectedOutcomesPassed: bool
    RosterCollected: bool
    CollectionAndCriteriaPassed: bool
    Baseline: store.Artifact | None
    Scope: str = "finite-local-projection-with-separate-execution-custody"


def _observe(name: str, call: Callable[[], object]) -> store.CallObservation:
    try:
        return store.CallObservation(name, call(), None)
    except Exception as error:  # noqa: BLE001 - retain actual callback boundary failures
        return store.CallObservation(
            name,
            None,
            store.Raised(
                type(error).__module__ + "." + type(error).__qualname__, str(error)
            ),
        )


def _receipt_shaped(value: object, operation: str) -> bool:
    """Minimal service-envelope shape; full schema and custody remain separate."""
    return (
        type(value) is dict
        and value.get("Schema") == criteria.SCHEMAS[operation]
        and all(
            type(value.get(key)) is str for key in ("Schema", "CaseId", "InputSha256")
        )
        and type(value.get("Bindings")) is dict
        and type(value.get("Counters")) is dict
        and type(value.get("Outcome")) is dict
        and type(value["Outcome"].get("Kind")) is str
    )


class _Run:
    def __init__(
        self, target: store.Store, bindings: dict[str, str], services: Services
    ):
        self.target = target
        self.bindings = bindings
        self.services = services
        self.entries: list[Entry] = []
        self.helpers: list[store.CallObservation] = []
        self.secondary: list[object] = []
        self.primary: a.Refused | None = None
        self.native: dict[str, tuple[bytes, store.Artifact]] = {}
        self.baseline: tuple[bytes, store.Artifact] | None = None
        self.baseline_reference = False
        self.core: list[str] = []
        self.terminal: object = None
        self.finalization: object = None
        self.admitted_store = False
        self.finalization_entered = False

    def fail(self, code: str, path: str, detail: str) -> None:
        value = a.Refused(code, path, detail)
        if self.primary is None:
            self.primary = value
        else:
            self.secondary.append(value)

    def helper(self, name: str, call: Callable[[], object]) -> object:
        obs = _observe(name, call)
        self.helpers.append(obs)
        if obs.Raised is not None:
            self.fail("helper-raised", name, obs.Raised.Message)
            return None
        return obs.Returned

    def put(
        self, role: str, value: object, *, raw: bool = False, terminal: bool = False
    ) -> tuple[object, object]:
        # Reserve a bounded terminal envelope and one ordinary slot in addition
        # to the store's own final journal. Full helper returns remain in memory.
        cap = TERMINAL_BYTES if terminal else cases.RESULT_BYTES
        encoded: object = (
            a.Admitted(value)
            if raw and type(value) is bytes and len(value) <= cap
            else self.helper(
                "encode/" + role,
                lambda: encoding.encode_public_result(value, maximum_bytes=cap),
            )
            if not raw
            else a.Refused("record-size", role, "bounded exact bytes required")
        )
        if not isinstance(encoded, a.Admitted) or type(encoded.value) is not bytes:
            self.fail("encoding", role, "actual result could not be completely encoded")
            return encoded, None
        snapshot = self.helper("snapshot/" + role, lambda: store.snapshot(self.target))
        if (
            not isinstance(snapshot, a.Admitted)
            or type(snapshot.value) is not store.Snapshot
        ):
            self.fail("store-handle", role, "actual issued-store snapshot required")
            return encoded, None
        state = snapshot.value
        reserve = 0 if terminal else 2 * TERMINAL_BYTES
        slots = 0 if terminal else 1
        if (
            state.PrimaryFailure is not None
            or state.FinalizationStarted
            or 2 * len(encoded.value) + reserve
            > state.Limits.CombinedBytes
            - state.ReservedRawBytes
            - state.ReservedStoredBytes
            or state.ReservedSlots + 1 + slots > state.Limits.Artifacts
        ):
            self.fail(
                "retention-boundary",
                role,
                "store unavailable or terminal reservation would be consumed",
            )
            return encoded, None
        retained = self.helper(
            "append/" + role,
            lambda: store.append_bytes(self.target, role, encoded.value),
        )
        if not isinstance(retained, store.Stored):
            self.fail("storage", role, "actual artifact append did not complete")
        return encoded, retained

    def artifact(
        self, entry: Entry, role: str, value: object, *, raw: bool = False
    ) -> store.Artifact | None:
        encoded, retained = self.put(f"{entry.Index:03d}/{role}", value, raw=raw)
        entry.Encoding = encoded
        entry.Retention = retained
        if isinstance(retained, store.Stored):
            entry.Artifacts += (retained.Artifact,)
            return retained.Artifact
        return None

    def step(self, index: int, case_id: str, operation: str) -> None:
        row = Entry(index, case_id, operation)
        self.entries.append(row)
        numeric_id = (
            "core/unconstructed"
            if case_id in (*cases.CERTIFICATE_IDS, *cases.WIRE_IDS)
            else case_id
        )
        if case_id in cases.CERTIFICATE_IDS and self.baseline is None:
            self.fail(
                "baseline-missing",
                case_id,
                "actual retained certified core/unconstructed baseline required",
            )
            return
        row.Preparation = self.helper(
            "prepare/" + case_id,
            lambda: cases.render_input(
                "core/unconstructed" if case_id in cases.CERTIFICATE_IDS else case_id
            ),
        )
        if not isinstance(row.Preparation, a.Admitted):
            self.fail("input-preparation", case_id, "fixed input rendering refused")
            return
        raw_input = row.Preparation.value
        if self.artifact(row, "input", raw_input, raw=True) is None:
            return
        raw_native = None
        if operation == "CertifyNative":
            if case_id in cases.CERTIFICATE_IDS:
                assert self.baseline is not None
                baseline = self.baseline
                mutation = self.helper(
                    "mutate/" + case_id,
                    lambda: cases.mutate_native(case_id, baseline[0]),
                )
                if not isinstance(mutation, a.Admitted):
                    self.fail("mutation", case_id, "registered mutation refused")
                    return
                raw_native = mutation.value
            elif case_id in self.native:
                raw_native = self.native[case_id][0]
            else:
                self.fail("native-missing", case_id, "actual native receipt absent")
                return
            if self.artifact(row, "native-input", raw_native, raw=True) is None:
                return
        request = Request(
            index,
            case_id,
            numeric_id,
            raw_input,
            raw_native,
            hashlib.sha256(raw_input).hexdigest().upper(),
            dict(self.bindings),
        )
        row.Request = request
        callback = {
            "NativeSolve": self.services.NativeSolve,
            "ReferenceRoot": self.services.ReferenceRoot,
            "CertifyNative": self.services.CertifyNative,
        }[operation]
        row.Entered = True
        row.Observation = _observe(operation, lambda: callback(request))
        # No parsing/encoding/comparison precedes this actual observation.
        if row.Observation.Raised is not None:
            self.fail("service-raised", case_id, row.Observation.Raised.Message)
            self.artifact(row, "raised", row.Observation)
            return
        actual = row.Observation.Returned
        if operation == "NativeSolve":
            if type(actual) is not NativeObservation:
                self.fail(
                    "native-return",
                    case_id,
                    "native callback did not return its source-specific observation",
                )
                self.artifact(row, "invalid-return", actual)
                return
            native_complete = (
                actual.Complete
                and actual.ExitCode == 0
                and actual.DirectChildClosed
                and type(actual.Receipt) is bytes
                and len(actual.Receipt) <= cases.RESULT_BYTES
            )
            if not native_complete:
                self.fail(
                    "native-incomplete",
                    case_id,
                    "native process or complete report did not finish",
                )
            metadata = {
                field.name: getattr(actual, field.name)
                for field in fields(actual)
                if field.name != "Receipt"
            }
            if self.artifact(row, "process", metadata) is None:
                return
            raw_receipt = actual.Receipt
            receipt_artifact = None
            if type(raw_receipt) is bytes:
                receipt_artifact = self.artifact(row, "receipt", raw_receipt, raw=True)
            if not native_complete or receipt_artifact is None:
                self.fail(
                    "native-incomplete",
                    case_id,
                    "actual native command or complete retained output absent",
                )
                return
            assert isinstance(raw_receipt, bytes)
            decoded = a.strict_json(raw_receipt, maximum_bytes=cases.RESULT_BYTES)
            self.helpers.append(
                store.CallObservation("decode-native/" + case_id, decoded, None)
            )
            if isinstance(decoded, a.Refused):
                self.fail("native-json", case_id, decoded.detail)
                return
            receipt = decoded.value
            if not _receipt_shaped(receipt, operation):
                self.fail(
                    "native-receipt-shape", case_id, "actual receipt envelope required"
                )
                return
            row.CompleteReceipt = True
            row.ReceiptRetained = True
        else:
            # Preserve outer API/encoding failures too; a ReceiptFailure's
            # complete actual in-memory receipt must never be replaced by None.
            if not isinstance(actual, reference.Success):
                self.fail(
                    "reference-incomplete",
                    case_id,
                    "no complete admitted reference receipt",
                )
                self.artifact(row, "outer-return", actual)
                return
            receipt = actual.Value
            if not _receipt_shaped(receipt, operation):
                self.fail(
                    "reference-receipt-shape",
                    case_id,
                    "success wrapper did not contain a receipt",
                )
                self.artifact(row, "invalid-receipt", receipt)
                return
            row.CompleteReceipt = True
            receipt_artifact = self.artifact(row, "receipt", receipt)
            if receipt_artifact is None:
                return
            row.CompleteReceipt = True
            row.ReceiptRetained = True
        row.Assessment = self.helper(
            "comparison/" + case_id + "/" + operation,
            lambda: criteria.assess_receipt(
                case_id,
                operation,
                receipt,
                raw_input,
                self.bindings,
                raw_native=raw_native,
            ),
        )
        if isinstance(row.Assessment, a.Refused):
            self.fail("receipt-envelope", case_id, row.Assessment.detail)
            return
        if (
            not (
                isinstance(row.Assessment, a.Admitted)
                and type(row.Assessment.value) is criteria.Assessment
            )
            or type(row.Assessment.value) is not criteria.Assessment
        ):
            self.fail("comparison-return", case_id, "actual assessment absent")
            return
        result = row.Assessment.value
        if operation == "NativeSolve":
            assert (
                type(actual) is NativeObservation
                and actual.Receipt is not None
                and receipt_artifact is not None
            )
            self.native[case_id] = (actual.Receipt, receipt_artifact)
        if case_id == "core/unconstructed" and operation == "ReferenceRoot":
            self.baseline_reference = result.Kind == "enclosure"
        if result.CoreCertified:
            self.core.append(case_id)
            if case_id == "core/unconstructed" and self.baseline_reference:
                self.baseline = self.native.get(case_id)
        if result.Abnormal:
            self.fail(
                "abnormal-result",
                case_id,
                "unexpected or encoding refusal is not an expected control result",
            )

    def finish(self) -> RunResult:
        plan = cases.ordered_calls()
        completed = sum(row.CompleteReceipt for row in self.entries)
        retained = sum(row.ReceiptRetained for row in self.entries)
        checked = sum(
            (
                isinstance(row.Assessment, a.Admitted)
                and type(row.Assessment.value) is criteria.Assessment
            )
            for row in self.entries
        )
        returned = sum(
            row.Observation is not None and row.Observation.Raised is None
            for row in self.entries
        )
        raised = sum(
            row.Observation is not None and row.Observation.Raised is not None
            for row in self.entries
        )
        entered = sum(row.Entered for row in self.entries)
        native_observations = [
            row.Observation.Returned
            for row in self.entries
            if row.Observation is not None
            and type(row.Observation.Returned) is NativeObservation
        ]
        counters = {
            "Planned": len(plan),
            "Entered": entered,
            "Returned": returned,
            "Raised": raised,
            "CompleteReceipts": completed,
            "RetainedReceipts": retained,
            "Checked": checked,
            "NativeLaunchAttempts": sum(
                value.LaunchAttempted for value in native_observations
            ),
            "NativeChildrenStarted": sum(
                value.ChildPid is not None for value in native_observations
            ),
            "NativeChildrenClosed": sum(
                value.ChildPid is not None and value.DirectChildClosed
                for value in native_observations
            ),
        }
        pending = (
            tuple(
                plan[row.Index]
                for row in self.entries
                if not row.ReceiptRetained
                or not (
                    isinstance(row.Assessment, a.Admitted)
                    and type(row.Assessment.value) is criteria.Assessment
                )
            )
            + plan[len(self.entries) :]
        )
        collected = (
            completed == len(plan) and retained == len(plan) and checked == len(plan)
        )
        expected = checked == len(plan) and all(
            (
                isinstance(row.Assessment, a.Admitted)
                and type(row.Assessment.value) is criteria.Assessment
            )
            and row.Assessment.value.Expected is not False
            for row in self.entries
        )
        body = {
            "Schema": "zeta.precision-projection.run.v1",
            "Counters": counters,
            "Pending": pending,
            "PrimaryFailure": self.primary,
            "CoreCertified": tuple(self.core),
            "ExpectedOutcomesPassed": expected,
            "RosterCollected": collected,
            "Baseline": self.baseline[1].descriptor() if self.baseline else None,
            "Entries": tuple(
                {
                    "Index": row.Index,
                    "CaseId": row.CaseId,
                    "Operation": row.Operation,
                    "Entered": row.Entered,
                    "CompleteReceipt": row.CompleteReceipt,
                    "ReceiptRetained": row.ReceiptRetained,
                    "Assessment": row.Assessment,
                    "Artifacts": tuple(x.descriptor() for x in row.Artifacts),
                }
                for row in self.entries
            ),
            "FailedValueRetention": "actual objects remain in returned in-memory ledger; only linked artifacts are durable",
            "Finalization": "separate once-only store journal follows",
        }
        snap = self.helper("snapshot/final", lambda: store.snapshot(self.target))
        if (
            self.admitted_store
            and isinstance(snap, a.Admitted)
            and type(snap.value) is store.Snapshot
            and snap.value.PrimaryFailure is None
            and not snap.value.FinalizationStarted
        ):
            self.terminal = self.put("terminal", body, terminal=True)
        if self.admitted_store:
            self.finalization_entered = True
            self.finalization = self.helper(
                "finalize", lambda: store.finalize(self.target)
            )
        finalized = isinstance(self.finalization, store.Finalized)
        if self.admitted_store and not finalized:
            self.fail("finalization", "Run", "once-only final journal did not complete")
        terminal_ok = type(self.terminal) is tuple and isinstance(
            self.terminal[1], store.Stored
        )
        return RunResult(
            tuple(self.entries),
            pending,
            self.primary,
            tuple(self.secondary),
            tuple(self.helpers),
            self.terminal,
            self.finalization,
            counters,
            tuple(self.core),
            expected,
            collected,
            collected
            and expected
            and len(self.core) == 12
            and finalized
            and terminal_ok
            and self.primary is None,
            self.baseline[1] if self.baseline else None,
        )


def run_comparison(
    target: store.Store, bindings: object, services: Services
) -> RunResult:
    """Execute the frozen roster once on a fresh issued store; finalize once.

    The caller must separately admit the complete archived source map and actual
    service wrappers. Disposable callbacks cannot constitute a registered run.
    """
    run = _Run(target, {}, services)
    admitted = run.helper(
        "bindings-admission", lambda: criteria.validate_bindings(bindings)
    )
    state = run.helper("store-admission", lambda: store.snapshot(target))
    if type(services) is not Services or not all(
        callable(value)
        for value in (
            services.NativeSolve,
            services.ReferenceRoot,
            services.CertifyNative,
        )
    ):
        run.fail("services", "Run", "three callable source-bound services required")
    elif not isinstance(admitted, a.Admitted) or type(admitted.value) is not dict:
        run.fail("bindings", "Run", "independent binding admission did not complete")
    elif (
        not isinstance(state, a.Admitted)
        or type(state.value) is not store.Snapshot
        or not (
            LIMITS.FinalJournalBytes + 2 * TERMINAL_BYTES
            < state.value.Limits.CombinedBytes
            <= LIMITS.CombinedBytes
            and state.value.Limits.FinalJournalBytes == LIMITS.FinalJournalBytes
            and 3 <= state.value.Limits.Artifacts <= LIMITS.Artifacts
        )
        or state.value.Artifacts
        or state.value.Attempts
        or state.value.FinalizationStarted
    ):
        run.fail(
            "store-admission",
            "Run",
            "fresh issued store within registered ceilings and with journal/terminal reserves required",
        )
    else:
        run.admitted_store = True
        run.bindings = admitted.value
        for index, (case_id, operation) in enumerate(cases.ordered_calls()):
            run.helper(
                "slot/" + str(index), partial(run.step, index, case_id, operation)
            )
            if run.primary is not None:
                break
    try:
        return run.finish()
    except Exception as error:  # noqa: BLE001 - preserve prefix if envelope construction fails
        raised = store.Raised(
            type(error).__module__ + "." + type(error).__qualname__, str(error)
        )
        run.helpers.append(store.CallObservation("finish-envelope", None, raised))
        run.fail("finish-envelope", "Run", raised.Message)
        if run.admitted_store and not run.finalization_entered:
            run.finalization_entered = True
            run.finalization = run.helper("finalize", lambda: store.finalize(target))
        # No descriptor reconstruction or comparison is attempted in this
        # fallback. The complete entries and actual helper returns stay present.
        counters = {
            "Planned": len(cases.ordered_calls()),
            "Entered": sum(row.Entered for row in run.entries),
            "Returned": sum(
                row.Observation is not None and row.Observation.Raised is None
                for row in run.entries
            ),
            "Raised": sum(
                row.Observation is not None and row.Observation.Raised is not None
                for row in run.entries
            ),
            "CompleteReceipts": sum(row.CompleteReceipt for row in run.entries),
            "RetainedReceipts": sum(row.ReceiptRetained for row in run.entries),
        }
        return RunResult(
            tuple(run.entries),
            cases.ordered_calls(),
            run.primary,
            tuple(run.secondary),
            tuple(run.helpers),
            run.terminal,
            run.finalization,
            counters,
            tuple(run.core),
            False,
            False,
            False,
            run.baseline[1] if run.baseline else None,
            "incomplete-envelope-preserved-prefix; pending slots are unverified, not invented failures",
        )


def reference_services(native: Callable[[Request], object]) -> Services:
    """Bind each Python service once to its reviewed public entrypoint.

    The supplied native closure owns PreparedNative and its exclusive call
    directories. Source/archive admission is a separate coordinator obligation.
    """

    def root(request: Request) -> object:
        return reference.reference_root(
            request.RawInput,
            request.Bindings,
            expected_input_sha256=request.InputSha256,
            expected_case_id=request.NumericId,
        )

    def certificate(request: Request) -> object:
        return reference.certify_native(
            request.RawInput,
            request.RawNative,
            request.Bindings,
            expected_input_sha256=request.InputSha256,
            expected_case_id=request.NumericId,
        )

    return Services(native, root, certificate)
