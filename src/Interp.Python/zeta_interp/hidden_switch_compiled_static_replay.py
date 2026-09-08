"""Replay the 32 source-fixed static cases and their 36 real shared-API calls.

Fresh preparation plus independently supplied BindingContext defines expected
input bytes. Producer type labels remain data. Complete original result bytes
are retained separately from canonical semantic comparison; filesystem/source/
runtime and the full outer evidence chain are the coordinator's obligations.
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from dataclasses import asdict, dataclass, field, replace
from functools import partial

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_bindings as bindings
from . import hidden_switch_compiled_conformance as c
from . import hidden_switch_compiled_record_encoding as encoding
from . import hidden_switch_compiled_static_fixtures as fixtures

MAX_RESULT_BYTES = 1024 * 1024
CASE_COUNT = 32
CALL_COUNT = 36


@dataclass(frozen=True, slots=True)
class RecordedCall:
    Operation: str
    InputRoles: tuple[str, ...]
    ResultRaw: bytes


@dataclass(frozen=True, slots=True)
class RecordedCase:
    CaseId: str
    Inputs: tuple[c.NamedInput, ...]
    SupportingArtifacts: tuple[fixtures.SupportingArtifact, ...]
    Calls: tuple[RecordedCall, ...]


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
class Preparation:
    CaseId: str
    Observation: Observation


@dataclass(frozen=True, slots=True)
class ByteIdentity:
    Bytes: int
    Sha256: str


@dataclass(frozen=True, slots=True)
class ReplayedCall:
    CaseId: str
    CallIndex: int
    Recorded: object
    Actual: c.CallResult | None
    Raised: Raised | None
    RawIdentity: ByteIdentity | None = None
    ActualEncoding: Observation | None = None
    RecordedParsing: Observation | None = None
    RecordedEncoding: Observation | None = None
    Matched: bool = False


@dataclass(frozen=True, slots=True)
class Counts:
    PreparedCases: int
    StartedCalls: int
    ReturnedCalls: int
    MatchedCalls: int
    MatchedCases: int


@dataclass(frozen=True, slots=True)
class StaticReplaySucceeded:
    Records: object
    Context: bindings.BindingContext
    ContextObservation: Observation
    Preparations: tuple[Preparation, ...]
    Calls: tuple[ReplayedCall, ...]
    Counts: Counts
    Scope: str = "32-static-cases-and-36-shared-api-calls-only"
    OuterSourceAndRuntimeAdmission: str = "not-performed"


@dataclass(frozen=True, slots=True)
class StaticReplayFailed:
    Failure: a.Refused
    Records: object
    Context: object
    ContextObservation: Observation | None
    Preparations: tuple[Preparation, ...]
    Calls: tuple[ReplayedCall, ...]
    Counts: Counts
    Scope: str = "incomplete-static-case-replay"
    OuterSourceAndRuntimeAdmission: str = "not-performed"


@dataclass(slots=True)
class _Ledger:
    records: object
    context: object
    context_observation: Observation | None = None
    preparations: list[Preparation] = field(default_factory=list)
    calls: list[ReplayedCall] = field(default_factory=list)
    prepared: int = 0
    returned: int = 0
    matched: int = 0
    cases: int = 0

    def counts(self) -> Counts:
        return Counts(
            self.prepared, len(self.calls), self.returned, self.matched, self.cases
        )

    def fail(self, code: str, path: str, detail: str) -> StaticReplayFailed:
        return StaticReplayFailed(
            a.Refused(code, path, detail),
            self.records,
            self.context,
            self.context_observation,
            tuple(self.preparations),
            tuple(self.calls),
            self.counts(),
        )


def _observe(stage: str, call: Callable[[], object]) -> Observation:
    try:
        return Observation(stage, call(), None)
    except Exception as error:  # noqa: BLE001 - retain raised boundary failures without inventing returns
        kind = type(error)
        return Observation(
            stage, None, Raised(kind.__module__ + "." + kind.__qualname__, str(error))
        )


def _input_match(
    row: RecordedCase, expected: fixtures.PreparedCase, path: str
) -> a.Refused | None:
    if type(row.Inputs) is not tuple or len(row.Inputs) != len(expected.Inputs):
        return a.Refused(
            "static-inputs", path + ".Inputs", "complete ordered fixed inputs required"
        )
    for index, (actual, fixed) in enumerate(
        zip(row.Inputs, expected.Inputs, strict=True)
    ):
        here = f"{path}.Inputs[{index}]"
        if (
            type(actual) is not c.NamedInput
            or type(actual.Role) is not str
            or type(actual.Raw) is not bytes
        ):
            return a.Refused(
                "static-inputs", here, "exact immutable NamedInput required"
            )
        if actual.Role != fixed.Role or actual.Raw != fixed.Raw:
            return a.Refused(
                "static-inputs", here, "input differs from fresh fixed preparation"
            )
    if type(row.SupportingArtifacts) is not tuple or len(
        row.SupportingArtifacts
    ) != len(expected.SupportingArtifacts):
        return a.Refused(
            "static-support",
            path + ".SupportingArtifacts",
            "complete ordered fixed support required",
        )
    for index, (artifact, fixed_artifact) in enumerate(
        zip(row.SupportingArtifacts, expected.SupportingArtifacts, strict=True)
    ):
        here = f"{path}.SupportingArtifacts[{index}]"
        if (
            type(artifact) is not fixtures.SupportingArtifact
            or type(artifact.File) is not str
            or type(artifact.Stored) is not bytes
            or type(artifact.Original) is not bytes
        ):
            return a.Refused(
                "static-support", here, "exact immutable support artifact required"
            )
        if (
            artifact.File != fixed_artifact.File
            or artifact.Stored != fixed_artifact.Stored
            or artifact.Original != fixed_artifact.Original
        ):
            return a.Refused(
                "static-support", here, "support differs from fresh fixed preparation"
            )
    return None


def _encoded(call: Observation) -> bytes | None:
    result = call.Returned
    if (
        call.Raised is None
        and isinstance(result, a.Admitted)
        and type(result.value) is bytes
    ):
        return result.value
    return None


def _compare_call(
    ledger: _Ledger, expected: c.OperationSpec, path: str
) -> StaticReplayFailed | None:
    captured = ledger.calls[-1]
    recorded = captured.Recorded
    if type(recorded) is not RecordedCall:
        return ledger.fail("static-call-shape", path, "explicit RecordedCall required")
    if (
        type(recorded.Operation) is not str
        or recorded.Operation != expected.Operation
        or type(recorded.InputRoles) is not tuple
        or any(type(role) is not str for role in recorded.InputRoles)
        or recorded.InputRoles != expected.InputRoles
    ):
        return ledger.fail(
            "static-operation",
            path,
            "complete fixed operation and ordered roles required",
        )
    if (
        type(recorded.ResultRaw) is not bytes
        or len(recorded.ResultRaw) > MAX_RESULT_BYTES
    ):
        return ledger.fail(
            "static-result-bytes",
            path + ".ResultRaw",
            "exact result bytes within the one-MiB bound required",
        )
    identity = ByteIdentity(
        len(recorded.ResultRaw), hashlib.sha256(recorded.ResultRaw).hexdigest().upper()
    )
    captured = replace(captured, RawIdentity=identity)
    ledger.calls[-1] = captured
    actual = captured.Actual
    if actual is None:
        return ledger.fail(
            "static-missing-actual", path, "no actual returned result is available"
        )
    actual_encoding = _observe(
        "actual-result-encoding",
        partial(
            encoding.encode_public_result, actual.Result, maximum_bytes=MAX_RESULT_BYTES
        ),
    )
    captured = replace(captured, ActualEncoding=actual_encoding)
    ledger.calls[-1] = captured
    actual_raw = _encoded(actual_encoding)
    if actual_raw is None:
        return ledger.fail(
            "static-actual-encoding",
            path,
            "actual return could not be canonically encoded; complete observation retained",
        )
    parsing = _observe(
        "recorded-result-parsing", lambda: a.strict_json(recorded.ResultRaw)
    )
    captured = replace(captured, RecordedParsing=parsing)
    ledger.calls[-1] = captured
    if parsing.Raised is not None or not isinstance(parsing.Returned, a.Admitted):
        return ledger.fail(
            "static-recorded-json",
            path + ".ResultRaw",
            "strict result JSON refused; actual return and original bytes retained",
        )
    tree = parsing.Returned.value
    recorded_encoding = _observe(
        "recorded-result-encoding",
        lambda: encoding.encode_public_result(tree, maximum_bytes=MAX_RESULT_BYTES),
    )
    captured = replace(captured, RecordedEncoding=recorded_encoding)
    ledger.calls[-1] = captured
    recorded_raw = _encoded(recorded_encoding)
    if recorded_raw is None:
        return ledger.fail(
            "static-recorded-encoding",
            path,
            "recorded result tree could not be canonically encoded",
        )
    if actual_raw != recorded_raw:
        return ledger.fail(
            "static-result-mismatch",
            path + ".ResultRaw",
            "complete typed result differs from actual fixed API return",
        )
    ledger.calls[-1] = replace(captured, Matched=True)
    ledger.matched += 1
    return None


def replay_static_cases(
    records: object, *, context: object
) -> StaticReplaySucceeded | StaticReplayFailed:
    """Replay a complete ordered static slice while preserving every executed prefix.

    Records/context are caller-held observations, not deep-copied or admitted
    files. Present fixed call slots execute once after exact fixture admission;
    the actual return is retained before producer-call/result validation. Missing
    slots never produce invented calls. Helper preparation is counted separately.
    """
    ledger = _Ledger(records, context)
    if type(records) is not tuple:
        return ledger.fail(
            "static-records", "Cases", "immutable ordered RecordedCase tuple required"
        )
    if type(context) is not bindings.BindingContext:
        return ledger.fail(
            "static-context",
            "Context",
            "independently supplied BindingContext required",
        )
    observation = _observe(
        "binding-context", lambda: bindings._context(asdict(context), "Context")
    )
    ledger.context_observation = observation
    if (
        observation.Raised is not None
        or not isinstance(observation.Returned, a.Admitted)
        or type(observation.Returned.value) is not bindings.BindingContext
    ):
        return ledger.fail(
            "static-context",
            "Context",
            "caller context refused; actual context observation retained",
        )
    admitted_context = observation.Returned.value
    specs = tuple(
        row for row in c.case_specs() if row.CaseId in fixtures.STATIC_CASE_IDS
    )
    if (
        len(specs) != CASE_COUNT
        or tuple(row.CaseId for row in specs) != fixtures.STATIC_CASE_IDS
        or sum(len(row.Calls) for row in specs) != CALL_COUNT
    ):
        return ledger.fail(
            "static-catalog", "Cases", "fixed 32-case/36-call source roster differs"
        )
    for index, spec in enumerate(specs):
        path = f"Cases[{index}]"
        if index >= len(records):
            return ledger.fail(
                "static-missing-case", path, "missing required fixed case"
            )
        prepared = _observe(
            "fixed-case-preparation",
            partial(
                fixtures.prepare_static_case, spec.CaseId, context=admitted_context
            ),
        )
        ledger.preparations.append(Preparation(spec.CaseId, prepared))
        if (
            prepared.Raised is not None
            or not isinstance(prepared.Returned, a.Admitted)
            or type(prepared.Returned.value) is not fixtures.PreparedCase
        ):
            return ledger.fail(
                "static-preparation",
                path,
                "fresh preparation failed; actual helper result retained",
            )
        expected = prepared.Returned.value
        ledger.prepared += 1
        row = records[index]
        if (
            type(row) is not RecordedCase
            or type(row.CaseId) is not str
            or row.CaseId != spec.CaseId
        ):
            return ledger.fail(
                "static-case", path, "complete fixed case order required"
            )
        mismatch = _input_match(row, expected, path)
        if mismatch is not None:
            return ledger.fail(mismatch.code, mismatch.path, mismatch.detail)
        if type(row.Calls) is not tuple:
            return ledger.fail(
                "static-calls", path + ".Calls", "immutable ordered call tuple required"
            )
        for call_index, operation in enumerate(spec.Calls):
            here = f"{path}.Calls[{call_index}]"
            if call_index >= len(row.Calls):
                return ledger.fail(
                    "static-missing-call", here, "missing required fixed call"
                )
            result = _observe(
                "fixed-call",
                partial(
                    fixtures.execute_static_call,
                    spec.CaseId,
                    call_index,
                    row.Inputs,
                    row.SupportingArtifacts,
                ),
            )
            actual = (
                None
                if result.Raised is not None
                else c.CallResult(
                    operation.Operation, operation.InputRoles, result.Returned
                )
            )
            # Preserve the real call before touching the producer result metadata.
            ledger.calls.append(
                ReplayedCall(
                    spec.CaseId,
                    call_index,
                    row.Calls[call_index],
                    actual,
                    result.Raised,
                )
            )
            if result.Raised is not None:
                return ledger.fail(
                    "static-call-raised",
                    here,
                    "fixed shared API raised; no returned result is invented",
                )
            ledger.returned += 1
            failure = _compare_call(ledger, operation, here)
            if failure is not None:
                return failure
        if len(row.Calls) != len(spec.Calls):
            return ledger.fail(
                "static-extra-call",
                path + ".Calls",
                "extra call after the complete fixed case",
            )
        ledger.cases += 1
    if len(records) != len(specs):
        return ledger.fail(
            "static-extra-case", "Cases", "extra case after the complete fixed roster"
        )
    return StaticReplaySucceeded(
        records,
        admitted_context,
        observation,
        tuple(ledger.preparations),
        tuple(ledger.calls),
        ledger.counts(),
    )
