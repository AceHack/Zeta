"""Pure preparation/dispatch of 38 native-dependent coordinator cases.

Actual standalone input admission is the coordinator's prerequisite. This module
retains supplied bytes, reconstructs fixed fixtures and executes only the named
independent Python checker calls. Native certificate slots remain requests.
Preparation helpers are retained separately and never counted as case calls.
No files, processes, study source generation or standalone policies run here.
"""

from __future__ import annotations

import json
import struct
from dataclasses import dataclass
from typing import cast
from weakref import WeakSet

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_certificate as certs
from . import hidden_switch_compiled_certificate_cases as corpus
from . import hidden_switch_compiled_choice_replay as choice
from . import hidden_switch_compiled_conformance as contract
from . import hidden_switch_compiled_falsifiers as semantic
from . import hidden_switch_compiled_ieee as s
from . import hidden_switch_compiled_outer_negatives as selector
from . import hidden_switch_compiled_reference as reference
from . import hidden_switch_compiled_replay as strict

CASE_IDS = tuple("certificate/" + name for name in corpus.CASE_IDS) + (
    "semantic/full-hand",
    "selector/epsilon-tie",
    "choice/control",
    "choice/late-counter",
    "choice/truncated",
    "choice/reordered",
    "choice/reserved-byte",
)
# Finite preparation bounds, separate from any scientific sample/cost threshold.
MAX_RAW_BYTES = 8 * 1024 * 1024
MAX_BINDINGS_BYTES = 1024 * 1024
MAX_CONTEXT_BYTES = 4096
_RECORD = struct.Struct("<BBH6I")
_SEAL = object()


@dataclass(frozen=True, slots=True)
class PreparationResult:
    Helper: str
    InputRoles: tuple[str, ...]
    Result: object


@dataclass(frozen=True, slots=True)
class PreparedCase:
    CaseId: str
    ControlId: str | None
    Inputs: tuple[contract.NamedInput, ...]
    Calls: tuple[contract.OperationSpec, ...]


@dataclass(frozen=True, slots=True, eq=False, weakref_slot=True)
class PreparedNativeFixtures:
    """Issued immutable case bytes; ordinary process trust, not a Python sandbox.

    The coordinator records Cases, Inputs and Preparation individually. The
    internal verified certificate/issuance token is not an evidence DTO.
    """

    Cases: tuple[PreparedCase, ...]
    Inputs: tuple[contract.NamedInput, ...]
    Preparation: tuple[PreparationResult, ...]
    _certificate: certs.VerifiedCertificate
    _seal: object
    CompletedOperation: int = 0
    Scope: str = "pure-native-dependent-fixture-preparation"
    OuterAndRuntimeAdmission: str = "caller-prerequisite-not-performed"


_ISSUED: WeakSet[PreparedNativeFixtures] = WeakSet()


@dataclass(frozen=True, slots=True)
class PreparationFailure(s.Failure):
    Path: str
    Cases: tuple[PreparedCase, ...]
    Inputs: tuple[contract.NamedInput, ...]
    Preparation: tuple[PreparationResult, ...]
    CompletedOperation: int = 0
    Scope: str = "incomplete-pure-native-dependent-fixture-preparation"


@dataclass(frozen=True, slots=True)
class Dispatched:
    CaseId: str
    CallIndex: int
    Call: contract.CallResult
    CompletedOperation: int = 1
    Scope: str = "one-actual-independent-python-coordinator-call"
    OuterAndRuntimeAdmission: str = "not-performed"


@dataclass(frozen=True, slots=True)
class NativeCallPending:
    CaseId: str
    CallIndex: int
    Call: contract.OperationSpec
    Inputs: tuple[contract.NamedInput, ...]
    CompletedOperation: int = 0
    Scope: str = "native-certificate-call-required-not-executed"


@dataclass(frozen=True, slots=True)
class DispatchFailure(s.Failure):
    Path: str
    CaseId: str | None
    CallIndex: int | None
    CompletedOperation: int = 0
    Scope: str = "incomplete-coordinator-call-dispatch"


class _Refusal(s._Refusal):
    def __init__(self, code: str, message: str, path: str):
        super().__init__(code, message)
        self.path = path


def _encode(value: object) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False
    ).encode("ascii")


def _need[T](value: s.Result[T], path: str) -> T:
    if isinstance(value, s.Failure):
        raise _Refusal(value.Code, value.Message, path)
    return value.value


def _admitted[T](value: a.Admission[T], path: str) -> T:
    if isinstance(value, a.Refused):
        raise _Refusal(value.code, value.detail, path + ":" + value.path)
    return value.value


class _Preparation:
    def __init__(self) -> None:
        self.cases: list[PreparedCase] = []
        self.inputs: list[contract.NamedInput] = []
        self.calls: list[PreparationResult] = []
        self.specs = {
            row.CaseId: row for row in contract.case_specs() if row.CaseId in CASE_IDS
        }

    def raw(self, role: str, raw: object, maximum: int = MAX_RAW_BYTES) -> bytes:
        if type(raw) is not bytes or len(raw) > maximum:
            raise _Refusal("FixtureBytes", "exact bounded input bytes required", role)
        self.inputs.append(contract.NamedInput(role, raw))
        return raw

    def decode(self, role: str, raw: bytes) -> object:
        actual = a.strict_json(raw, maximum_bytes=MAX_RAW_BYTES)
        self.calls.append(PreparationResult("strict-json", (role,), actual))
        return _admitted(actual, role)

    def result[T](self, helper: str, roles: tuple[str, ...], actual: s.Result[T]) -> T:
        self.calls.append(PreparationResult(helper, roles, actual))
        return _need(actual, helper)

    def case(self, case_id: str, inputs: tuple[contract.NamedInput, ...]) -> None:
        spec = self.specs.get(case_id)
        if spec is None or tuple(item.Role for item in inputs) != spec.InputRoles:
            raise _Refusal(
                "FixtureRoster", "fixed input-role contract differs", case_id
            )
        self.cases.append(PreparedCase(case_id, spec.ControlId, inputs, spec.Calls))


def _context(raw: object) -> dict[str, object]:
    row = strict._object(
        raw,
        {"CertificateId", "SourceManifestSha256", "NativeRecordSha256", "Passes"},
        "Context",
    )
    strict._same("certificate", row["CertificateId"], "Context.CertificateId")
    strict._same(2, row["Passes"], "Context.Passes")
    for key in ("SourceManifestSha256", "NativeRecordSha256"):
        _admitted(a.sha256(row[key], key), "Context")
    return row


def _buffers(
    prep: _Preparation, scalars: object, certificate: certs.VerifiedCertificate
) -> tuple[bytes, bytes, bytes]:
    rows = strict._array(scalars, 222, "Scalars")
    roster = prep.result(
        "scalar-roster", ("certificate",), reference.scalar_roster(certificate)
    )
    if len(roster) != 222:
        raise _Refusal(
            "FixtureRoster", "complete fixed scalar input roster required", "Scalars"
        )
    tuples: list[dict[str, object]] = []
    records: list[list[bytes]] = [[], []]
    for index in (0, 1):
        row = strict._object(
            rows[index], {"Input", "QBits", "Native", "Compiled"}, f"Scalars[{index}]"
        )
        strict._same(roster[index], row["Input"], f"Scalars[{index}].Input")
        given = strict._object(
            row["Input"], {"Index", "BeliefBits", "Effect", "Depth"}, "Scalar.Input"
        )
        tuples.append({key: given[key] for key in ("BeliefBits", "Effect", "Depth")})
        for strategy_index, name in enumerate(("Native", "Compiled")):
            result = a.choice_record(row[name], f"Scalars[{index}].{name}")
            prep.calls.append(
                PreparationResult("choice-record", ("hand-slices",), result)
            )
            values = _admitted(result, name)
            records[strategy_index].append(
                _RECORD.pack(
                    values["Action"],
                    values["Path"],
                    0,
                    *(values[key] for key in a.WORK_FIELDS),
                )
            )
    for strategy_records in records:
        if strategy_records[0] == strategy_records[1]:
            raise _Refusal(
                "FixtureVacuity",
                "positions 0 and 1 must give different records",
                "ChoiceBuffers",
            )
    return _encode(tuples), b"".join(records[0]) * 2, b"".join(records[1]) * 2


def _mutate(raw: bytes, name: str) -> bytes:
    changed = bytearray(raw)
    if name == "late-counter":
        # record2 + four header bytes + GuardComparisons/RecursiveCalls uint32s.
        offset = 2 * _RECORD.size + 12
        nodes = struct.unpack_from("<I", changed, offset)[0]
        if nodes == a.UINT32_MAX:
            raise _Refusal(
                "FixtureCounter", "Nodes increment must not wrap", "Choices[2].Nodes"
            )
        struct.pack_into("<I", changed, offset, nodes + 1)
    elif name == "truncated":
        del changed[-_RECORD.size :]
    elif name == "reordered":
        changed[: 2 * _RECORD.size] = (
            raw[_RECORD.size : 2 * _RECORD.size] + raw[: _RECORD.size]
        )
    elif name == "reserved-byte":
        changed[2] = 1
    elif name != "control":
        raise _Refusal("FixtureCase", "fixed choice mutation required", name)
    if name != "control" and bytes(changed) == raw:
        raise _Refusal("FixtureVacuity", "mutation did not change input bytes", name)
    return bytes(changed)


def prepare_native_fixtures(
    certificate: object,
    expected_bindings: object,
    *,
    certificate_raw: object,
    bindings_raw: object,
    hand_slices_raw: object,
    semantic_raw: object,
    selector_raw: object,
    choice_context_raw: object,
) -> s.Success[PreparedNativeFixtures] | PreparationFailure:
    """Prepare 38 fixed cases and preserve actual helper results on every refusal.

    Binding/source/native-input provenance is supplied independently by the
    coordinator. Existing construction/parser helpers execute during preparation;
    their outcomes never stand in for the freshly dispatched case operations.
    """
    prep = _Preparation()
    try:
        admitted = certs._admitted(certificate)
        expected = certs._bindings(expected_bindings)
        if tuple(expected.items()) != admitted.Bindings:
            raise _Refusal(
                "FixtureBindings",
                "supplied certificate binding identity differs",
                "Bindings",
            )
        cert_raw = prep.raw("certificate", certificate_raw)
        bound_raw = prep.raw("bindings", bindings_raw, MAX_BINDINGS_BYTES)
        supplied_bindings = prep.decode("bindings", bound_raw)
        strict._same(cast(certs.Json, expected), supplied_bindings, "Bindings")
        supplied_certificate = prep.decode("certificate", cert_raw)
        cases = prep.result(
            "certificate-cases", ("bindings",), corpus.certificate_cases(expected)
        )
        if tuple(row.CaseId for row in cases.Cases) != corpus.CASE_IDS:
            raise _Refusal(
                "FixtureRoster",
                "complete ordered certificate corpus required",
                "CertificateCases",
            )
        baseline = prep.decode("certificate-corpus-baseline", cases.Cases[0].Raw)
        strict._same(cast(certs.Json, baseline), supplied_certificate, "Certificate")
        if cases.BaselineSha256 != admitted.NumericSha256:
            raise _Refusal(
                "FixtureCertificate",
                "complete reconstructed certificate digest differs",
                "Certificate",
            )
        for row in cases.Cases:
            prep.case(
                "certificate/" + row.CaseId,
                (
                    contract.NamedInput("raw", row.Raw),
                    contract.NamedInput("bindings", bound_raw),
                ),
            )
        hand_raw = prep.raw("hand-slices", hand_slices_raw)
        hand = strict._object(
            prep.decode("hand-slices", hand_raw),
            {"Scalars", "Episodes", "OldControls"},
            "HandSlices",
        )
        for key, length in (("Scalars", 222), ("Episodes", 48), ("OldControls", 24)):
            strict._array(hand[key], length, "HandSlices." + key)
        sem_raw = prep.raw("semantic", semantic_raw)
        strict._object(
            prep.decode("semantic", sem_raw),
            {
                "Schema",
                "ScalarCoverage",
                "HandCoverage",
                "InvocationCases",
                "InterventionCases",
                "RefusalCases",
            },
            "Semantic",
        )
        prep.case(
            "semantic/full-hand",
            (
                contract.NamedInput("hand-slices", hand_raw),
                contract.NamedInput("semantic", sem_raw),
                contract.NamedInput("certificate", cert_raw),
            ),
        )
        witness_raw = prep.raw("witness", selector_raw)
        strict._object(
            prep.decode("witness", witness_raw),
            {"Input", "ActualAction", "Mutation"},
            "Witness",
        )
        prep.case(
            "selector/epsilon-tie",
            (
                contract.NamedInput("witness", witness_raw),
                contract.NamedInput("certificate", cert_raw),
            ),
        )
        context_raw = prep.raw("context", choice_context_raw, MAX_CONTEXT_BYTES)
        _context(prep.decode("context", context_raw))
        tuples, native, compiled = _buffers(prep, hand["Scalars"], admitted)
        for name in (
            "control",
            "late-counter",
            "truncated",
            "reordered",
            "reserved-byte",
        ):
            prep.case(
                "choice/" + name,
                (
                    contract.NamedInput("native-buffer", _mutate(native, name)),
                    contract.NamedInput("tuples", tuples),
                    contract.NamedInput("context", context_raw),
                    contract.NamedInput("compiled-buffer", _mutate(compiled, name)),
                ),
            )
        if tuple(row.CaseId for row in prep.cases) != CASE_IDS:
            raise _Refusal(
                "FixtureRoster", "complete fixed 38-case order required", "Cases"
            )
        issued = PreparedNativeFixtures(
            tuple(prep.cases), tuple(prep.inputs), tuple(prep.calls), admitted, _SEAL
        )
        _ISSUED.add(issued)
        return s.Success(issued)
    except s._Refusal as failure:
        return PreparationFailure(
            failure.code,
            failure.message,
            getattr(failure, "path", "CertificateOrBindings"),
            tuple(prep.cases),
            tuple(prep.inputs),
            tuple(prep.calls),
        )


def _decoded(inputs: dict[str, bytes], role: str) -> object:
    return _admitted(a.strict_json(inputs[role], maximum_bytes=MAX_RAW_BYTES), role)


def dispatch_native_fixture(
    prepared: object,
    case_id: object,
    call_index: object,
) -> Dispatched | NativeCallPending | DispatchFailure:
    """Return one fresh actual Python result, or an explicit unexecuted native slot."""
    try:
        if (
            type(prepared) is not PreparedNativeFixtures
            or prepared._seal is not _SEAL
            or prepared not in _ISSUED
        ):
            raise _Refusal(
                "FixtureNotPrepared", "issued fixture handle required", "Prepared"
            )
        certificate = certs._admitted(prepared._certificate)
        if type(case_id) is not str or case_id not in CASE_IDS:
            raise _Refusal(
                "FixtureCase", "fixed native-dependent case required", "CaseId"
            )
        case = prepared.Cases[CASE_IDS.index(case_id)]
        if type(call_index) is not int or not 0 <= call_index < len(case.Calls):
            raise _Refusal(
                "FixtureCall", "fixed zero-based case call index required", "CallIndex"
            )
        spec = case.Calls[call_index]
        by_role = {item.Role: item.Raw for item in case.Inputs}
        if spec.Operation == "native-certificate-verify":
            return NativeCallPending(
                case_id,
                call_index,
                spec,
                tuple(
                    contract.NamedInput(role, by_role[role]) for role in spec.InputRoles
                ),
            )
        if spec.Operation == "python-certificate-verify":
            bindings = _decoded(by_role, "bindings")
            strict._same(dict(certificate.Bindings), bindings, "Bindings")
            result: object = corpus.python_outcome(by_role["raw"], bindings)
        elif spec.Operation == "semantic-falsifier-replay":
            hand = strict._object(
                _decoded(by_role, "hand-slices"),
                {"Scalars", "Episodes", "OldControls"},
                "HandSlices",
            )
            result = semantic.replay_semantic_falsifiers(
                hand["Scalars"],
                hand["Episodes"],
                hand["OldControls"],
                _decoded(by_role, "semantic"),
                certificate,
            )
        elif spec.Operation == "selector-witness-replay":
            result = selector.replay_selector_tie(
                _decoded(by_role, "witness"), certificate
            )
        elif spec.Operation == "replay-choice-buffer":
            context = _context(_decoded(by_role, "context"))
            rows = strict._array(_decoded(by_role, "tuples"), 2, "Tuples")
            cycle = []
            for index, raw in enumerate(rows):
                row = strict._object(
                    raw, {"BeliefBits", "Effect", "Depth"}, f"Tuples[{index}]"
                )
                # Exact types/domains are also admitted by the actual replay API.
                cycle.append(
                    choice.ChoiceInput(
                        cast(str, row["BeliefBits"]),
                        cast(bool, row["Effect"]),
                        cast(int, row["Depth"]),
                    )
                )
            result = choice.replay_choice_buffer(
                by_role[spec.InputRoles[0]],
                tuple(cycle),
                context["Passes"],
                certificate,
                reference.STRATEGIES[call_index],
                source_manifest_sha256=context["SourceManifestSha256"],
                native_runtime_sha256=context["NativeRecordSha256"],
            )
        else:
            raise _Refusal(
                "FixtureOperation",
                "no dispatch exists for this operation",
                spec.Operation,
            )
        return Dispatched(
            case_id,
            call_index,
            contract.CallResult(spec.Operation, spec.InputRoles, result),
        )
    except s._Refusal as failure:
        return DispatchFailure(
            failure.code,
            failure.message,
            getattr(failure, "path", "Certificate"),
            case_id if type(case_id) is str else None,
            call_index if type(call_index) is int else None,
        )
