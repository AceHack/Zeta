"""Pure replay of 43 Python calls plus comparison of 31 supplied native reports.

Fresh fixed preparation defines expectations; producer names never dispatch.
Native reports require independent coordinator custody/execution admission. This
module reads no files, launches no native process and generates no study stream.
The charged-byte bound counts repeated consumed raw/canonical positions, not
caller-held objects, preparation allocation, peak memory or hostile Python state.
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from functools import partial
from typing import Any, Literal

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_conformance as c
from . import hidden_switch_compiled_ieee as s
from . import hidden_switch_compiled_native_fixtures as f
from . import hidden_switch_compiled_record_encoding as encoding

MAX_RESULT_BYTES = 1024 * 1024
MAX_TOTAL_BYTES = 128 * 1024 * 1024
_REPORT_FIELDS = frozenset(
    {
        "Kind",
        "Complete",
        "Failure",
        "VerifyCalls",
        "InputSha256",
        "BindingsSha256",
        "Outcome",
        "AssemblyFile",
        "AssemblySha256",
        "Runtime",
        "Arguments",
        "StartedAtUtc",
        "FinishedAtUtc",
        "SourceDraws",
        "RuntimeAdmitted",
    }
)
_LOCATION_FIELDS = ("Panel", "Mode", "Strategy", "Replicate", "Episode", "Call")


@dataclass(frozen=True, slots=True)
class RecordedCall:
    Operation: str
    InputRoles: tuple[str, ...]
    ResultRaw: bytes


@dataclass(frozen=True, slots=True)
class RecordedCase:
    CaseId: str
    ControlId: str | None
    Inputs: tuple[c.NamedInput, ...]
    Calls: tuple[RecordedCall, ...]


@dataclass(frozen=True, slots=True)
class NativeCertificateEvidence:
    CaseId: str
    RawReport: bytes


@dataclass(frozen=True, slots=True)
class Raised:
    Type: str
    Message: str


@dataclass(frozen=True, slots=True)
class Observation:
    Stage: str
    Returned: object
    Raised: Raised | None


@dataclass(frozen=True, slots=True)
class PreparationSnapshot:
    """Exact public handle fields; the issued capability itself is not serialized."""

    Cases: tuple[f.PreparedCase, ...]
    Inputs: tuple[c.NamedInput, ...]
    Preparation: tuple[f.PreparationResult, ...]
    CompletedOperation: int
    Scope: str
    OuterAndRuntimeAdmission: str
    Projection: str = "issued-handle-public-fields-only"


@dataclass(frozen=True, slots=True)
class ReplayedCall:
    CaseId: str
    CallIndex: int
    Recorded: object
    Dispatch: Observation | None = None
    Evidence: object = None
    NativeParsing: Observation | None = None
    NativeProjection: object = None
    ActualEncoding: Observation | None = None
    RecordedParsing: Observation | None = None
    RecordedEncoding: Observation | None = None
    Matched: bool = False
    Pending: bool = False


@dataclass(frozen=True, slots=True)
class Counts:
    PreparedCases: int
    PythonStarted: int
    PythonReturned: int
    PythonMatched: int
    NativeCompared: int
    NativePending: int
    MatchedCases: int
    ChargedBytes: int


@dataclass(frozen=True, slots=True)
class NativeReplayCompleted:
    Records: object
    NativeEvidence: object
    Prerequisites: object
    Preparation: Observation
    Calls: tuple[ReplayedCall, ...]
    Counts: Counts
    Scope: str = "43-python-calls-and-31-native-report-comparisons-only"
    NativeExecutionAndRuntimeAdmission: str = "caller-prerequisite-not-performed"
    WholeOuterAdmission: str = "not-performed"


@dataclass(frozen=True, slots=True)
class NativeReplayPending:
    Records: object
    NativeEvidence: object
    Prerequisites: object
    Preparation: Observation
    Calls: tuple[ReplayedCall, ...]
    Counts: Counts
    Scope: str = "43-python-calls-with-31-native-evidence-slots-pending"
    NativeExecutionAndRuntimeAdmission: str = "caller-prerequisite-not-performed"
    WholeOuterAdmission: str = "not-performed"


@dataclass(frozen=True, slots=True)
class NativeReplayFailed:
    Failure: a.Refused
    Records: object
    NativeEvidence: object
    Prerequisites: object
    Preparation: Observation | None
    Calls: tuple[ReplayedCall, ...]
    Counts: Counts
    Scope: str = "incomplete-native-dependent-replay"
    NativeExecutionAndRuntimeAdmission: str = "caller-prerequisite-not-performed"
    WholeOuterAdmission: str = "not-performed"


@dataclass(slots=True)
class _Ledger:
    records: object
    evidence: object
    prerequisites: object
    preparation: Observation | None = None
    calls: list[ReplayedCall] = field(default_factory=list)
    prepared: int = 0
    started: int = 0
    returned: int = 0
    matched: int = 0
    native: int = 0
    pending: int = 0
    cases: int = 0
    charged: int = 0

    def counts(self) -> Counts:
        return Counts(
            self.prepared,
            self.started,
            self.returned,
            self.matched,
            self.native,
            self.pending,
            self.cases,
            self.charged,
        )

    def fail(self, code: str, path: str, detail: str) -> NativeReplayFailed:
        return NativeReplayFailed(
            a.Refused(code, path, detail),
            self.records,
            self.evidence,
            self.prerequisites,
            self.preparation,
            tuple(self.calls),
            self.counts(),
        )

    def charge(self, raw: object, maximum: int, path: str) -> a.Refused | None:
        if type(raw) is not bytes or len(raw) > maximum:
            return a.Refused(
                "native-replay-bytes",
                path,
                "exact bytes within the per-position bound required",
            )
        if len(raw) > MAX_TOTAL_BYTES - self.charged:
            return a.Refused(
                "native-replay-total",
                path,
                "consumed byte positions exceed the aggregate bound",
            )
        self.charged += len(raw)
        return None


def _observe(stage: str, call: Callable[[], object]) -> Observation:
    try:
        return Observation(stage, call(), None)
    except Exception as error:  # noqa: BLE001 - retain unexpected ordinary boundary errors
        kind = type(error)
        return Observation(
            stage, None, Raised(kind.__module__ + "." + kind.__qualname__, str(error))
        )


def _refusal(ledger: _Ledger, value: a.Refused) -> NativeReplayFailed:
    return ledger.fail(value.code, value.path, value.detail)


def _inputs(
    ledger: _Ledger, given: object, expected: tuple[c.NamedInput, ...], path: str
) -> a.Refused | None:
    if type(given) is not tuple or len(given) != len(expected):
        return a.Refused(
            "native-replay-inputs", path, "complete ordered immutable inputs required"
        )
    for index, fixed in enumerate(expected):
        row = given[index]
        here = f"{path}[{index}]"
        if type(row) is not c.NamedInput or type(row.Role) is not str:
            return a.Refused("native-replay-inputs", here, "exact NamedInput required")
        failure = ledger.charge(row.Raw, f.MAX_RAW_BYTES, here + ".Raw")
        if failure is not None:
            return failure
        if row.Role != fixed.Role or row.Raw != fixed.Raw:
            return a.Refused(
                "native-replay-inputs",
                here,
                "input differs from fresh independent fixed preparation",
            )
    return None


def _metadata(recorded: object, spec: c.OperationSpec, path: str) -> a.Refused | None:
    if type(recorded) is not RecordedCall:
        return a.Refused("native-replay-call", path, "explicit RecordedCall required")
    if (
        type(recorded.Operation) is not str
        or recorded.Operation != spec.Operation
        or type(recorded.InputRoles) is not tuple
        or any(type(role) is not str for role in recorded.InputRoles)
        or recorded.InputRoles != spec.InputRoles
    ):
        return a.Refused(
            "native-replay-operation",
            path,
            "fixed operation and exact ordered roles required",
        )
    return None


def _encoded(
    ledger: _Ledger,
    value: object,
    stage: str,
    field_name: Literal["ActualEncoding", "RecordedEncoding"],
    path: str,
) -> bytes | NativeReplayFailed:
    maximum = min(MAX_RESULT_BYTES, MAX_TOTAL_BYTES - ledger.charged)
    observation = _observe(
        stage, partial(encoding.encode_public_result, value, maximum_bytes=maximum)
    )
    ledger.calls[-1] = (
        replace(ledger.calls[-1], ActualEncoding=observation)
        if field_name == "ActualEncoding"
        else replace(ledger.calls[-1], RecordedEncoding=observation)
    )
    result = observation.Returned
    if (
        observation.Raised is not None
        or not isinstance(result, a.Admitted)
        or type(result.value) is not bytes
    ):
        return ledger.fail(
            "native-replay-encoding",
            path,
            "bounded canonical encoding refused; actual observation retained",
        )
    failed = ledger.charge(result.value, MAX_RESULT_BYTES, path)
    return _refusal(ledger, failed) if failed else result.value


def _compare_result(
    ledger: _Ledger, actual: object, spec: c.OperationSpec, path: str
) -> NativeReplayFailed | None:
    row = ledger.calls[-1]
    metadata = _metadata(row.Recorded, spec, path)
    if metadata:
        return _refusal(ledger, metadata)
    assert isinstance(row.Recorded, RecordedCall)
    given = row.Recorded.ResultRaw
    failure = ledger.charge(given, MAX_RESULT_BYTES, path + ".ResultRaw")
    if failure:
        return _refusal(ledger, failure)
    canonical = _encoded(
        ledger, actual, "actual-result-encoding", "ActualEncoding", path
    )
    if isinstance(canonical, NativeReplayFailed):
        return canonical
    parsing = _observe(
        "recorded-result-parsing",
        partial(a.strict_json, given, maximum_bytes=MAX_RESULT_BYTES),
    )
    ledger.calls[-1] = replace(ledger.calls[-1], RecordedParsing=parsing)
    if parsing.Raised is not None or not isinstance(parsing.Returned, a.Admitted):
        return ledger.fail(
            "native-replay-json",
            path,
            "strict recorded result refused after actual outcome retention",
        )
    recorded = _encoded(
        ledger,
        parsing.Returned.value,
        "recorded-result-encoding",
        "RecordedEncoding",
        path,
    )
    if isinstance(recorded, NativeReplayFailed):
        return recorded
    if canonical != recorded:
        return ledger.fail(
            "native-replay-result",
            path,
            "complete canonical typed result differs from actual fixed outcome",
        )
    ledger.calls[-1] = replace(ledger.calls[-1], Matched=True)
    return None


def _report(
    raw: object, index: int, expected: f.PreparedCase, numeric_hash: str
) -> a.Admission[dict[str, Any]]:
    path = f"NativeEvidence[{index}]"
    if type(raw) is not dict or set(raw) != _REPORT_FIELDS:
        return a.Refused(
            "native-report-shape",
            path,
            "exact original fifteen-field native report required",
        )
    required = {
        "Kind": "certificate-verification",
        "Complete": True,
        "Failure": None,
        "VerifyCalls": 1,
        "SourceDraws": 0,
        "RuntimeAdmitted": False,
    }
    for key, value in required.items():
        if type(raw[key]) is not type(value) or raw[key] != value:
            return a.Refused(
                "native-report-incomplete",
                path + "." + key,
                "normal one-return prerequisite report required; flags do not prove execution",
            )
    for key in ("AssemblyFile", "Runtime", "StartedAtUtc", "FinishedAtUtc"):
        if type(raw[key]) is not str or not raw[key] or "\x00" in raw[key]:
            return a.Refused(
                "native-report-metadata",
                path + "." + key,
                "nonempty retained metadata string required",
            )
    args = raw["Arguments"]
    if (
        type(args) is not list
        or len(args) != 4
        or args[0] != "certificate-check"
        or any(type(x) is not str or not x or "\x00" in x for x in args)
    ):
        return a.Refused(
            "native-report-arguments",
            path,
            "fixed command and three retained path arguments required",
        )
    by_role = {item.Role: item.Raw for item in expected.Inputs}
    for key in ("InputSha256", "BindingsSha256", "AssemblySha256"):
        check = a.sha256(raw[key], path + "." + key)
        if isinstance(check, a.Refused):
            return check
    for key, role in (("InputSha256", "raw"), ("BindingsSha256", "bindings")):
        if raw[key] != hashlib.sha256(by_role[role]).hexdigest().upper():
            return a.Refused(
                "native-report-input",
                path + "." + key,
                "native input identity differs from independent fixed bytes",
            )
    outcome = raw["Outcome"]
    if index == 0:
        if (
            type(outcome) is not dict
            or set(outcome) != {"Kind", "NumericCertificateSha256"}
            or outcome["Kind"] != "accepted"
            or outcome["NumericCertificateSha256"] != numeric_hash
        ):
            return a.Refused(
                "native-report-baseline",
                path + ".Outcome",
                "baseline must accept the independently reconstructed complete certificate",
            )
    else:
        if (
            type(outcome) is not dict
            or set(outcome) != {"Kind", "Failure"}
            or outcome["Kind"] != "refused"
        ):
            return a.Refused(
                "native-report-outcome",
                path + ".Outcome",
                "fixed negative must return its real typed refusal",
            )
        error = outcome["Failure"]
        if type(error) is not dict or set(error) != {
            "Stage",
            "Code",
            "Detail",
            *_LOCATION_FIELDS,
        }:
            return a.Refused(
                "native-report-failure",
                path + ".Outcome.Failure",
                "complete nine-field failure required",
            )
        code = "json" if index in (26, 30) else "bytes" if index == 29 else "mismatch"
        if (
            error["Stage"] != "numeric-certificate"
            or error["Code"] != code
            or any(error[key] is not None for key in _LOCATION_FIELDS)
        ):
            return a.Refused(
                "native-report-boundary",
                path + ".Outcome.Failure",
                "source-fixed native stage/code/null locations differ",
            )
        detail = error["Detail"]
        if type(detail) is not str or not detail:
            return a.Refused(
                "native-report-detail",
                path,
                "actual parser/verifier detail must be retained",
            )
        fixed_detail = (
            "requires a nonempty certificate of at most 16 MiB"
            if code == "bytes"
            else "certificate differs from the full independent finite-model reconstruction"
        )
        if code != "json" and detail != fixed_detail:
            return a.Refused(
                "native-report-detail",
                path,
                "source-fixed native verifier detail differs",
            )
    return a.Admitted(
        {key: raw[key] for key in ("InputSha256", "BindingsSha256", "Outcome")}
    )


def _native(
    ledger: _Ledger,
    index: int,
    expected: f.PreparedCase,
    spec: c.OperationSpec,
    numeric_hash: str,
    path: str,
) -> NativeReplayFailed | None:
    if ledger.evidence is None:
        metadata = _metadata(ledger.calls[-1].Recorded, spec, path)
        if metadata:
            return _refusal(ledger, metadata)
        recorded = ledger.calls[-1].Recorded
        assert isinstance(recorded, RecordedCall)
        failure = ledger.charge(
            recorded.ResultRaw, MAX_RESULT_BYTES, path + ".ResultRaw"
        )
        if failure:
            return _refusal(ledger, failure)
        ledger.pending += 1
        ledger.calls[-1] = replace(ledger.calls[-1], Pending=True)
        return None
    if type(ledger.evidence) is not tuple:
        return ledger.fail(
            "native-evidence-roster",
            path,
            "independent immutable native evidence tuple or explicit None required",
        )
    if index >= len(ledger.evidence):
        return ledger.fail(
            "native-evidence-missing",
            f"NativeEvidence[{index}]",
            "missing independently supplied native report",
        )
    evidence = ledger.evidence[index]
    ledger.calls[-1] = replace(ledger.calls[-1], Evidence=evidence)
    if (
        type(evidence) is not NativeCertificateEvidence
        or type(evidence.CaseId) is not str
        or evidence.CaseId != expected.CaseId
    ):
        return ledger.fail(
            "native-evidence-case",
            f"NativeEvidence[{index}]",
            "exact fixed native evidence order required",
        )
    failure = ledger.charge(
        evidence.RawReport, MAX_RESULT_BYTES, f"NativeEvidence[{index}].RawReport"
    )
    if failure:
        return _refusal(ledger, failure)
    parsed = _observe(
        "independent-native-report-parsing",
        partial(a.strict_json, evidence.RawReport, maximum_bytes=MAX_RESULT_BYTES),
    )
    ledger.calls[-1] = replace(ledger.calls[-1], NativeParsing=parsed)
    if parsed.Raised is not None or not isinstance(parsed.Returned, a.Admitted):
        return ledger.fail(
            "native-evidence-json",
            path,
            "strict original native report refused; raw observation retained",
        )
    checked = _report(parsed.Returned.value, index, expected, numeric_hash)
    if isinstance(checked, a.Refused):
        return _refusal(ledger, checked)
    ledger.calls[-1] = replace(ledger.calls[-1], NativeProjection=checked.value)
    mismatch = _compare_result(ledger, checked.value, spec, path)
    if mismatch:
        return mismatch
    ledger.native += 1
    return None


def replay_native_cases(
    records: object,
    certificate: object,
    expected_bindings: object,
    *,
    certificate_raw: object,
    bindings_raw: object,
    hand_slices_raw: object,
    semantic_raw: object,
    selector_raw: object,
    choice_context_raw: object,
    native_evidence: object,
) -> NativeReplayCompleted | NativeReplayPending | NativeReplayFailed:
    """Replay fixed cases from independent inputs, preserving first failure/prefix.

    None native evidence means pending, not refusal or execution evidence. An
    explicitly supplied missing/malformed row fails at its fixed position. The
    coordinator must bind original raw files and actual native process custody;
    this pure reader checks only bytes and outcome semantics supplied to it.
    """
    inputs = {
        "certificate_raw": certificate_raw,
        "bindings_raw": bindings_raw,
        "hand_slices_raw": hand_slices_raw,
        "semantic_raw": semantic_raw,
        "selector_raw": selector_raw,
        "choice_context_raw": choice_context_raw,
    }
    ledger = _Ledger(
        records,
        native_evidence,
        {"ExpectedBindings": expected_bindings, "Inputs": inputs},
    )
    if type(records) is not tuple:
        return ledger.fail(
            "native-replay-roster",
            "Cases",
            "immutable complete RecordedCase tuple required",
        )
    for name, raw in inputs.items():
        failed = ledger.charge(raw, f.MAX_RAW_BYTES, "Prerequisites." + name)
        if failed:
            return _refusal(ledger, failed)
    observed = _observe(
        "fresh-fixed-preparation",
        partial(f.prepare_native_fixtures, certificate, expected_bindings, **inputs),
    )
    ledger.preparation = observed
    if (
        observed.Raised is not None
        or not isinstance(observed.Returned, s.Success)
        or type(observed.Returned.value) is not f.PreparedNativeFixtures
    ):
        return ledger.fail(
            "native-replay-preparation",
            "Preparation",
            "fresh fixed preparation failed; actual public failure/raised outcome retained",
        )
    prepared = observed.Returned.value
    ledger.preparation = Observation(
        "fresh-fixed-preparation",
        PreparationSnapshot(
            prepared.Cases,
            prepared.Inputs,
            prepared.Preparation,
            prepared.CompletedOperation,
            prepared.Scope,
            prepared.OuterAndRuntimeAdmission,
        ),
        None,
    )
    ledger.prepared = len(prepared.Cases)
    for index, item in enumerate(prepared.Inputs):
        failure = ledger.charge(
            item.Raw, f.MAX_RAW_BYTES, f"Preparation.Inputs[{index}]"
        )
        if failure:
            return _refusal(ledger, failure)
    specs = tuple(row for row in c.case_specs() if row.CaseId in f.CASE_IDS)
    if (
        len(specs) != 38
        or tuple(row.CaseId for row in specs) != f.CASE_IDS
        or sum(len(row.Calls) for row in specs) != 74
        or len(prepared.Cases) != 38
    ):
        return ledger.fail(
            "native-replay-catalog", "Cases", "fixed38case74slot source catalog differs"
        )
    for index, spec in enumerate(specs):
        path = f"Cases[{index}]"
        if index >= len(records):
            return ledger.fail("native-replay-missing-case", path, "missing fixed case")
        fixed = prepared.Cases[index]
        if (
            fixed.CaseId != spec.CaseId
            or fixed.ControlId != spec.ControlId
            or fixed.Calls != spec.Calls
        ):
            return ledger.fail(
                "native-replay-prepared-roster",
                path,
                "fresh preparation differs from independent fixed source catalog",
            )
        row = records[index]
        if (
            type(row) is not RecordedCase
            or type(row.CaseId) is not str
            or row.CaseId != spec.CaseId
            or type(row.ControlId) is not type(spec.ControlId)
            or row.ControlId != spec.ControlId
        ):
            return ledger.fail(
                "native-replay-case", path, "exact fixed case/control order required"
            )
        failure = _inputs(ledger, row.Inputs, fixed.Inputs, path + ".Inputs")
        if failure:
            return _refusal(ledger, failure)
        if type(row.Calls) is not tuple:
            return ledger.fail(
                "native-replay-calls", path, "immutable ordered call tuple required"
            )
        case_pending = False
        for call_index, operation in enumerate(spec.Calls):
            here = f"{path}.Calls[{call_index}]"
            if call_index >= len(row.Calls):
                return ledger.fail(
                    "native-replay-missing-call", here, "missing fixed call slot"
                )
            ledger.calls.append(
                ReplayedCall(spec.CaseId, call_index, row.Calls[call_index])
            )
            if operation.Operation == "native-certificate-verify":
                replay_failure = _native(
                    ledger,
                    index,
                    fixed,
                    operation,
                    prepared._certificate.NumericSha256,
                    here,
                )
                case_pending = case_pending or ledger.calls[-1].Pending
                if replay_failure:
                    return replay_failure
            else:
                ledger.started += 1
                actual = _observe(
                    "actual-fixed-python-dispatch",
                    partial(
                        f.dispatch_native_fixture, prepared, spec.CaseId, call_index
                    ),
                )
                ledger.calls[-1] = replace(ledger.calls[-1], Dispatch=actual)
                if (
                    actual.Raised is not None
                    or type(actual.Returned) is not f.Dispatched
                ):
                    return ledger.fail(
                        "native-replay-dispatch",
                        here,
                        "actual Python dispatch did not return a completed operation; observation retained",
                    )
                ledger.returned += 1
                result = actual.Returned
                if (
                    result.CaseId != spec.CaseId
                    or result.CallIndex != call_index
                    or type(result.CompletedOperation) is not int
                    or result.CompletedOperation != 1
                    or result.Call.Operation != operation.Operation
                    or result.Call.InputRoles != operation.InputRoles
                ):
                    return ledger.fail(
                        "native-replay-dispatch-contract",
                        here,
                        "actual completed dispatch metadata differs from source catalog",
                    )
                replay_failure = _compare_result(
                    ledger, result.Call.Result, operation, here
                )
                if replay_failure:
                    return replay_failure
                ledger.matched += 1
        if len(row.Calls) != len(spec.Calls):
            return ledger.fail(
                "native-replay-extra-call", path, "extra call after complete fixed case"
            )
        if not case_pending:
            ledger.cases += 1
    if len(records) != len(specs):
        return ledger.fail(
            "native-replay-extra-case",
            "Cases",
            "extra case after complete fixed roster",
        )
    if native_evidence is not None and (
        type(native_evidence) is not tuple or len(native_evidence) != 31
    ):
        return ledger.fail(
            "native-evidence-extra",
            "NativeEvidence",
            "extra native evidence after complete31report roster",
        )
    assert ledger.preparation is not None
    result_type = (
        NativeReplayPending if native_evidence is None else NativeReplayCompleted
    )
    return result_type(
        records,
        native_evidence,
        ledger.prerequisites,
        ledger.preparation,
        tuple(ledger.calls),
        ledger.counts(),
    )
